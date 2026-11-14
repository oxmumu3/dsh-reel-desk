// Single-scene in-place copywriting rewrite via host `llm` service (`FLOW-V3-DESIGN` C.2).
//
// Invariants:
//   - Zero disk writes & zero project version bumps (returns up to 3 preview candidates).
//   - Only copywriting text fields of `scene.kind` may change (`validateSuggestCandidate`);
//     never alters `kind`, `asset`, `durationSec`, `focus`, `cursor`, `view`, or `funnel-ticker` numbers.
//   - Uses `maxTokens: 1200` so `deepseek-flash` reasoning tokens never truncate the JSON payload.

import { KIND_BY_ID } from '../shared/kinds.js'
import { validateSuggestCandidate } from './schema.js'

const SUGGEST_TIMEOUT_MS = 12_000

function extractJsonObject(rawText) {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return null
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(unfenced)
  } catch {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1))
      } catch {
        return null
      }
    }
    const arrStart = unfenced.indexOf('[')
    const arrEnd = unfenced.lastIndexOf(']')
    if (arrStart >= 0 && arrEnd > arrStart) {
      try {
        return { candidates: JSON.parse(unfenced.slice(arrStart, arrEnd + 1)) }
      } catch {
        return null
      }
    }
    return null
  }
}

function mapLlmFailure(errOrReason) {
  const raw = typeof errOrReason === 'string'
    ? errOrReason
    : (errOrReason?.message || JSON.stringify(errOrReason || ''))
  if (/ACCOUNT_SIGN_IN_REQUIRED|sign.?in|未登录/i.test(raw)) {
    return {
      code: 'ACCOUNT_SIGN_IN_REQUIRED',
      message: '当前还没登录 DeepSeek 账号，请先在客户端左下角登录，或直接去对话里改。',
      fallbackToChat: true,
    }
  }
  if (/AUTH|401|403|api.?key/i.test(raw)) {
    return {
      code: 'AUTH_FAILED',
      message: 'DeepSeek 模型鉴权未通过，请检查账号或密钥设置，或去对话里改。',
      fallbackToChat: true,
    }
  }
  if (/RATE_LIMIT|429|quota/i.test(raw)) {
    return {
      code: 'RATE_LIMIT',
      message: '请求太频繁，稍等几秒再试一次，或去对话里改。',
      fallbackToChat: true,
    }
  }
  return {
    code: 'LLM_ERROR',
    message: '暂时没拿到改写候选，可以再试一次，或去对话里改。',
    fallbackToChat: true,
  }
}

export async function isInlineRewriteAvailable(ctx) {
  try {
    const llm = ctx?.get?.('llm', false) || ctx?.llm || null
    if (!llm || typeof llm.listProviders !== 'function') return false
    const providers = await llm.listProviders()
    return Array.isArray(providers) && providers.some(p => p && p.configured !== false)
  } catch {
    return false
  }
}

export async function suggestSceneVariants(ctx, {
  project,
  sceneIndex = 0,
  intent = '口语一点',
  n = 3,
  signal = null,
} = {}) {
  const sb = project?.storyboard
  if (!sb || !Array.isArray(sb.scenes) || !sb.scenes[sceneIndex]) {
    throw new Error('找不到要改写的分镜')
  }
  const scene = sb.scenes[sceneIndex]
  const kindDef = KIND_BY_ID[scene.kind]
  if (!kindDef) {
    throw new Error(`不支持的镜头类型：${scene.kind}`)
  }

  const llm = ctx?.get?.('llm', false) || ctx?.llm || null
  if (!llm || typeof llm.stream !== 'function') {
    return {
      ok: false,
      code: 'LLM_UNAVAILABLE',
      message: '当前宿主未开启就地改写接口，请去对话里让 DeepSeek 改。',
      fallbackToChat: true,
      candidates: [],
    }
  }

  let providerQueue = []
  try {
    const providers = await llm.listProviders()
    const configured = (providers || []).filter(p => p && p.id && p.configured !== false)
    const preferredOrder = ['deepseek-account', 'deepseek-official']
    for (const pid of preferredOrder) {
      const hit = configured.find(p => p.id === pid)
      if (hit) providerQueue.push(hit)
    }
    for (const p of configured) {
      if (!providerQueue.some(x => x.id === p.id)) providerQueue.push(p)
    }
    if (providerQueue.length === 0) {
      return {
        ok: false,
        code: 'LLM_NOT_CONFIGURED',
        message: '还没有配置可用的 DeepSeek 模型账号，请先登录或去对话里改。',
        fallbackToChat: true,
        candidates: [],
      }
    }
  } catch (err) {
    return {
      ok: false,
      ...mapLlmFailure(err),
      candidates: [],
    }
  }

  const allowedKeys = kindDef.textRewriteKeys || ['headline', 'eyebrow']
  const editableSnapshot = {}
  for (const k of allowedKeys) {
    if (scene[k] !== undefined) editableSnapshot[k] = scene[k]
  }

  const sysPrompt = [
    '你是「制片台」的单镜文案润色助手。只改当前这一镜的文字，绝不改动镜头类型、时长、截图或数字。',
    `当前片名：《${sb.title}》；画幅：${sb.aspect === '9:16' ? '竖屏 9:16' : '横屏 16:9'}。`,
    sb.brief ? `片子简介：${sb.brief}` : '',
    `当前是第 ${sceneIndex + 1} 镜（${kindDef.label}），允许改写的字段只有：${allowedKeys.join(', ')}。`,
    '要求：',
    '1. 给出 3 个风格有区分度的中文改法，主标题 headline 控制在 10–26 字，像真人说话，不要空洞套话，不要编造任何数字。',
    '2. 只输出严格合法的 JSON，格式为：{"candidates":[{"why":"8-16字说明这版改法好在哪","patch":{"headline":"..."}}]}。',
    '3. 不要输出 Markdown 代码块以外的任何解释文字。',
  ].filter(Boolean).join('\n')

  const userAsk = String(intent || '口语一点').trim().slice(0, 160) || '口语一点'
  const userMessage = `当前这一镜的文字 JSON：\n${JSON.stringify(editableSnapshot)}\n\n我的修改要求：「${userAsk}」\n请直接返回包含 ${Math.min(3, Math.max(1, n))} 个候选的 JSON。`

  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(new Error('SUGGEST_TIMEOUT')), SUGGEST_TIMEOUT_MS)
  const combinedSignal = signal
    ? AbortSignal.any([timeoutCtrl.signal, signal])
    : timeoutCtrl.signal

  let providerId = null
  let modelId = null
  let fullText = ''
  let streamError = null

  function isCredentialFallbackError(errObj) {
    const raw = typeof errObj === 'string'
      ? errObj
      : (errObj?.code || '') + ' ' + (errObj?.message || JSON.stringify(errObj || ''))
    return /ACCOUNT_SIGN_IN_REQUIRED|AUTH|401|403|api.?key|missing|not.?configured|未登录/i.test(raw)
  }

  try {
    for (let pIdx = 0; pIdx < providerQueue.length; pIdx++) {
      if (combinedSignal.aborted) break
      const candidateProvider = providerQueue[pIdx]
      providerId = candidateProvider.id
      try {
        const models = await llm.listModels(providerId)
        const chosenModel =
          (models || []).find(m => m.id === 'deepseek-flash') ||
          (models || []).find(m => m.id === 'deepseek-chat') ||
          (models || [])[0] ||
          null
        modelId = chosenModel?.id || 'deepseek-flash'
      } catch (modelErr) {
        streamError = modelErr
        if (pIdx < providerQueue.length - 1 && isCredentialFallbackError(modelErr)) {
          continue
        }
        break
      }

      fullText = ''
      streamError = null
      try {
        const iterable = llm.stream({
          provider: providerId,
          model: modelId,
          system: sysPrompt,
          providerId,
          modelId,
          systemPrompt: sysPrompt,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: userMessage }],
            },
          ],
          maxTokens: 1200,
          temperature: 0.65,
          signal: combinedSignal,
          abortSignal: combinedSignal,
        })

        for await (const chunk of iterable) {
          if (combinedSignal.aborted) break
          if (!chunk || typeof chunk !== 'object') continue
          if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
            fullText += chunk.text
          } else if (chunk.type === 'error') {
            streamError = chunk.failure || chunk.error || chunk
            break
          } else if (chunk.type === 'finish') {
            const fr = chunk.finishReason ?? chunk.reason ?? null
            if (fr?.kind === 'aborted') {
              if (signal?.aborted) {
                return { ok: false, aborted: true, code: 'ABORTED', message: '已取消改写', candidates: [] }
              }
              if (timeoutCtrl.signal.aborted) {
                return {
                  ok: false,
                  code: 'TIMEOUT',
                  message: '等候超时了，可以点「再试一次」，或去对话里改。',
                  fallbackToChat: true,
                  candidates: [],
                }
              }
            }
            if (fr?.kind === 'error') {
              streamError = fr.failure || fr.error || fr
            }
            break
          }
        }
      } catch (innerErr) {
        if (signal?.aborted || timeoutCtrl.signal.aborted) throw innerErr
        streamError = innerErr
      }

      if (!streamError) {
        break
      }
      if (pIdx < providerQueue.length - 1 && isCredentialFallbackError(streamError)) {
        continue
      }
      break
    }
  } catch (err) {
    if (signal?.aborted) {
      return { ok: false, aborted: true, code: 'ABORTED', message: '已取消改写', candidates: [] }
    }
    if (timeoutCtrl.signal.aborted) {
      return {
        ok: false,
        code: 'TIMEOUT',
        message: '等候超时了，可以点「再试一次」，或去对话里改。',
        fallbackToChat: true,
        candidates: [],
      }
    }
    streamError = err
  } finally {
    clearTimeout(timer)
  }

  if (signal?.aborted) {
    return { ok: false, aborted: true, code: 'ABORTED', message: '已取消改写', candidates: [] }
  }

  if (streamError) {
    return {
      ok: false,
      ...mapLlmFailure(streamError),
      candidates: [],
    }
  }

  const parsed = extractJsonObject(fullText)
  const rawList = Array.isArray(parsed?.candidates)
    ? parsed.candidates
    : (Array.isArray(parsed) ? parsed : [])

  const validCandidates = []
  const seenHeadlines = new Set()
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue
    const validated = validateSuggestCandidate(scene, item.patch || item, sceneIndex, sb.fps || 60)
    if (!validated) continue
    const sig = JSON.stringify(validated.patch)
    if (seenHeadlines.has(sig)) continue
    seenHeadlines.add(sig)
    validCandidates.push({
      headline: validated.previewScene.headline,
      why: String(item.why || item.reason || item.label || '换一种说法').trim().slice(0, 36),
      patch: validated.patch,
      scene: validated.previewScene,
      previewScene: validated.previewScene,
    })
    if (validCandidates.length >= 3) break
  }

  if (validCandidates.length === 0) {
    return {
      ok: false,
      code: 'NO_VALID_CANDIDATES',
      message: '这次生成的改法不符合字数或字段约束，点「再试一次」重写。',
      fallbackToChat: true,
      candidates: [],
    }
  }

  return {
    ok: true,
    intent: userAsk,
    providerId,
    modelId,
    candidates: validCandidates,
  }
}
