// Storyboard schema, strict validation, warnings collection, and timeline math.
//
// Guardrail principles (Flow v3):
//   1. Single source of truth (`shared/kinds.js`) for all 8 scene kinds, labels, field guides, & starters.
//   2. Never inject Reel Desk self-promotional copy or invented numbers when fields are missing.
//   3. Three validation modes:
//      - `strict: true` (Agent writes): rejects missing required fields with concrete JSON example; warns on truncation/unknown fields.
//      - `strict: false` (Panel interactive edits): allows temporarily empty fields while user is typing.
//      - `mode: 'suggest'` (In-place rewrite): rejects over-length or non-text fields rather than truncating into half-sentences.
//   4. Store canonical `durationSec`, per-scene `rev`, and `screen-shot` `view` + image-space `focus`/`cursor`.

import {
  SCENE_KINDS,
  PRIMITIVE_KINDS,
  KIND_BY_ID,
  createKindStarterScene,
} from '../shared/kinds.js'
import { normalizeShotView } from '../shared/composition-core.js'

export { SCENE_KINDS, PRIMITIVE_KINDS }

export const REEL_LIMITS = Object.freeze({
  MIN_SCENES: 1,
  MAX_SCENES: 12,
  RECOMMENDED_SCENES: '3–6',
  MIN_SCENE_SEC: 1.5,
  MAX_SCENE_SEC: 10.0,
  MAX_LABEL_CHARS: 16,
  RECOMMENDED_HEADLINE_CHARS: '10–28',
  MAX_HEADLINE_CHARS: 90,
  MAX_REVISIONS: 20,
})

export const BRAND_GLYPHS = ['dot', 'tag', 'plugin', 'none']

export const BRAND_GLYPH_META = {
  dot: { label: '点', hint: '适合 DSH.dot 等陪伴/助理类产品' },
  tag: { label: '小签', hint: '适合 Super Agent 等看板/台账类产品' },
  plugin: { label: '插件块', hint: '适合发现好插件等模块化拼装产品' },
  none: { label: '不放', hint: '干净无图形，适合通用产品或纯科普短片' },
}

export const PRIMITIVE_META = Object.fromEntries(
  SCENE_KINDS.map(item => [
    item.kind,
    {
      label: item.label,
      fit: item.fit,
      summary: item.summary,
      defaultSec: item.defaultSec,
      fieldGuide: item.fieldGuide,
      textRewriteKeys: item.textRewriteKeys,
      example: item.example,
    },
  ]),
)

export const ASPECT_PRESETS = {
  '16:9': { width: 1920, height: 1080, label: '横屏 16:9 (1920×1080)' },
  '9:16': { width: 1080, height: 1920, label: '竖屏 9:16 (1080×1920)' },
}

export class ReelValidationError extends Error {
  constructor(message, field = '', example = null) {
    const ex = example ? ` 参考示例：${JSON.stringify(example)}` : ''
    super(`分镜校验未通过${field ? `（${field}）` : ''}：${message}。${ex} 副作用未发生（原项目数据未改动），请修正后重试。`)
    this.name = 'ReelValidationError'
    this.code = 'INVALID_STORYBOARD'
    this.field = field
  }
}

export class ReelConflictError extends Error {
  constructor(message, payload = {}) {
    super(message)
    this.name = 'ReelConflictError'
    this.code = payload.code || 'VERSION_CONFLICT'
    this.status = 409
    Object.assign(this, payload)
  }
}

function cleanStr(val, fallback = '', maxLen = 240, warnCtx = null) {
  if (val === undefined || val === null) return fallback
  const s = String(val).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
  if (!s) return fallback
  const chars = Array.from(s)
  if (chars.length > maxLen) {
    if (warnCtx?.rejectOverflow) {
      throw new ReelValidationError(
        `${warnCtx.path} 长度 ${chars.length} 字超出上限 ${maxLen} 字`,
        warnCtx.path,
      )
    }
    if (warnCtx?.warnings) {
      warnCtx.warnings.push(`${warnCtx.path} 长度 ${chars.length} 字超出上限 ${maxLen} 字，已截断超出部分`)
    }
    return chars.slice(0, maxLen).join('')
  }
  return s
}

function cleanStrList(val, maxItems = 6, maxLen = 80, warnCtx = null) {
  if (!Array.isArray(val)) return []
  const cleaned = val
    .map((x, idx) => cleanStr(
      x,
      '',
      maxLen,
      warnCtx
        ? {
            warnings: warnCtx.warnings,
            path: `${warnCtx.path}[${idx}]`,
            rejectOverflow: warnCtx.rejectOverflow,
          }
        : null,
    ))
    .filter(Boolean)
  if (cleaned.length > maxItems) {
    if (warnCtx?.rejectOverflow) {
      throw new ReelValidationError(
        `${warnCtx.path} 传了 ${cleaned.length} 项，超出上限 ${maxItems} 项`,
        warnCtx.path,
      )
    }
    if (warnCtx?.warnings) {
      warnCtx.warnings.push(`${warnCtx.path} 传了 ${cleaned.length} 项，该镜头最多支持 ${maxItems} 项，已丢弃后 ${cleaned.length - maxItems} 项`)
    }
    return cleaned.slice(0, maxItems)
  }
  return cleaned
}

export function slugifyId(raw, fallback = '') {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return cleaned || fallback
}

// Deterministic pure-JS FNV-1a short hash so pure CJK titles get distinct base slugs
export function deriveProjectSlug(rawTitleOrId, fallbackPrefix = 'reel') {
  const ascii = slugifyId(rawTitleOrId, '')
  if (ascii) return ascii
  const text = String(rawTitleOrId ?? '').trim()
  if (!text) return `${fallbackPrefix}-${Date.now().toString(36).slice(-6)}`
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${fallbackPrefix}-${hash.toString(36).padStart(6, '0').slice(0, 7)}`
}

const COMMON_SCENE_KEYS = new Set([
  'id',
  'rev',
  'kind',
  'label',
  'durationSec',
  'durationInFrames',
  'eyebrow',
  'headline',
])

const KIND_ALLOWED_KEYS = {
  'pain-input': new Set(['typedQuery', 'ctaLabel', 'footnote']),
  'screen-shot': new Set(['asset', 'windowTitle', 'caption', 'view', 'focus', 'cursor', 'coordSpace', 'assetDims']),
  'funnel-ticker': new Set(['steps', 'excluded', 'excludedLabel']),
  'lego-snap': new Set(['blocks', 'ctaLabel', 'footnote']),
  'dual-showcase': new Set([
    'lightCardTitle',
    'lightCardSub',
    'lightBrickCount',
    'darkCardEyebrow',
    'darkCardTitle',
    'darkCardBadge',
    'ctaPrimary',
    'ctaSecondary',
  ]),
  'code-diff': new Set(['fileLabel', 'beforeLabel', 'codeLines', 'badge']),
  'quote-kinetic': new Set(['lines', 'footnote']),
  'end-cta': new Set(['badge', 'ctaLabel', 'subline']),
}

const TOP_STORYBOARD_KEYS = new Set([
  'schemaVersion',
  'id',
  'title',
  'productTag',
  'brief',
  'aspect',
  'fps',
  'width',
  'height',
  'brandKitId',
  'glyph',
  'showHud',
  'assetMeta',
  'scenes',
])

function checkUnknownKeys(obj, allowedSets, pathLabel, warnings) {
  if (!warnings || !obj || typeof obj !== 'object') return
  const unknown = []
  for (const k of Object.keys(obj)) {
    const ok = allowedSets.some(s => s.has(k))
    if (!ok) unknown.push(k)
  }
  if (unknown.length > 0) {
    warnings.push(`${pathLabel} 忽略未识别字段: ${unknown.join(', ')}`)
  }
}

function normalizeBox01(raw) {
  if (!raw || typeof raw !== 'object') return null
  const x = Number(raw.x)
  const y = Number(raw.y)
  const w = Number(raw.w)
  const h = Number(raw.h)
  if (![x, y, w, h].every(Number.isFinite)) return null
  const cx = Math.max(0, Math.min(0.96, Number(x.toFixed(4))))
  const cy = Math.max(0, Math.min(0.96, Number(y.toFixed(4))))
  const cw = Math.max(0.04, Math.min(1 - cx, Number(w.toFixed(4))))
  const ch = Math.max(0.04, Math.min(1 - cy, Number(h.toFixed(4))))
  return { x: cx, y: cy, w: cw, h: ch }
}

function normalizePoint01(raw) {
  if (!raw || typeof raw !== 'object') return null
  const x = Number(raw.x)
  const y = Number(raw.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const pt = {
    x: Math.max(0.01, Math.min(0.99, Number(x.toFixed(4)))),
    y: Math.max(0.01, Math.min(0.99, Number(y.toFixed(4)))),
  }
  if (Number.isFinite(Number(raw.fromX))) pt.fromX = Math.max(0, Math.min(1, Number(Number(raw.fromX).toFixed(3))))
  if (Number.isFinite(Number(raw.fromY))) pt.fromY = Math.max(0, Math.min(1, Number(Number(raw.fromY).toFixed(3))))
  if (Number.isFinite(Number(raw.clickFrame))) pt.clickFrame = Math.max(1, Math.round(Number(raw.clickFrame)))
  return pt
}

// Neutral starter scene for interactive human clicks ("+ 加一镜" / "换镜头样式") and unit tests.
export function createStarterScene(kind, index = 0, fps = 60, prevScene = null) {
  return createKindStarterScene(kind, index, fps, prevScene)
}

export function normalizeScene(raw, index = 0, fps = 60, options = {}) {
  const isSuggest = options.mode === 'suggest'
  const strict = isSuggest ? true : options.strict !== false
  const rejectOverflow = Boolean(isSuggest || options.rejectOverflow)
  const warnings = Array.isArray(options.warnings) ? options.warnings : null
  const scenePath = `scenes[${index}]`

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ReelValidationError('每一镜必须是 JSON 对象', scenePath)
  }

  const kind = cleanStr(raw.kind, '', 40)
  if (!PRIMITIVE_KINDS.includes(kind)) {
    throw new ReelValidationError(
      `未知镜头类型 "${raw.kind ?? ''}"，可选值为：${PRIMITIVE_KINDS.join(' | ')}`,
      `${scenePath}.kind`,
    )
  }

  const meta = PRIMITIVE_META[kind]
  checkUnknownKeys(raw, [COMMON_SCENE_KEYS, KIND_ALLOWED_KEYS[kind]], scenePath, warnings)

  let rawSec = null
  if (raw.durationSec !== undefined && raw.durationSec !== null && raw.durationSec !== '') {
    const parsedSec = Number(raw.durationSec)
    if (!Number.isFinite(parsedSec) || parsedSec <= 0) {
      throw new ReelValidationError('durationSec 必须是大于 0 的秒数', `${scenePath}.durationSec`, meta.example)
    }
    rawSec = parsedSec
  } else if (raw.durationInFrames !== undefined && raw.durationInFrames !== null && raw.durationInFrames !== '') {
    const parsedFrames = Number(raw.durationInFrames)
    if (Number.isFinite(parsedFrames) && parsedFrames > 0) {
      rawSec = parsedFrames / fps
    }
  }
  if (rawSec === null) {
    rawSec = meta.defaultSec
  }

  if (rawSec < REEL_LIMITS.MIN_SCENE_SEC || rawSec > REEL_LIMITS.MAX_SCENE_SEC) {
    if (warnings) {
      warnings.push(
        `${scenePath}.durationSec (${Number(rawSec.toFixed(2))}s) 超出 ${REEL_LIMITS.MIN_SCENE_SEC}–${REEL_LIMITS.MAX_SCENE_SEC}s 范围，已自动钳制`,
      )
    }
  }
  const durationSec = Number(
    Math.max(REEL_LIMITS.MIN_SCENE_SEC, Math.min(REEL_LIMITS.MAX_SCENE_SEC, rawSec)).toFixed(2),
  )
  const durationInFrames = Math.max(1, Math.round(durationSec * fps))

  const id = slugifyId(raw.id || `scene-${String(index + 1).padStart(2, '0')}-${kind}`, `scene-${index + 1}`)
  const rev = Number.isInteger(raw.rev) && raw.rev >= 1 ? raw.rev : 1
  const label = cleanStr(raw.label, meta.label, REEL_LIMITS.MAX_LABEL_CHARS, {
    warnings,
    path: `${scenePath}.label`,
    rejectOverflow,
  })
  const eyebrow = cleanStr(raw.eyebrow, '', 80, {
    warnings,
    path: `${scenePath}.eyebrow`,
    rejectOverflow,
  })
  const headline = cleanStr(raw.headline, '', REEL_LIMITS.MAX_HEADLINE_CHARS, {
    warnings,
    path: `${scenePath}.headline`,
    rejectOverflow,
  })
  if (strict && !headline) {
    throw new ReelValidationError(
      `每镜必须提供核心主标题 headline（建议 ${REEL_LIMITS.RECOMMENDED_HEADLINE_CHARS} 字）`,
      `${scenePath}.headline`,
      meta.example,
    )
  }

  const base = {
    id,
    rev,
    kind,
    label,
    durationSec,
    durationInFrames,
    eyebrow,
    headline,
  }

  switch (kind) {
    case 'pain-input': {
      const typedQuery = cleanStr(raw.typedQuery, '', 90, {
        warnings,
        path: `${scenePath}.typedQuery`,
        rejectOverflow,
      })
      if (strict && !typedQuery) {
        throw new ReelValidationError(
          'pain-input 镜头必须提供非空 typedQuery（输入框里逐字打出的演示句子）',
          `${scenePath}.typedQuery`,
          meta.example,
        )
      }
      return {
        ...base,
        typedQuery,
        ctaLabel: cleanStr(raw.ctaLabel, raw.ctaLabel === '' ? '' : '开始', 20, {
          warnings,
          path: `${scenePath}.ctaLabel`,
          rejectOverflow,
        }),
        footnote: cleanStr(raw.footnote, '', 72, {
          warnings,
          path: `${scenePath}.footnote`,
          rejectOverflow,
        }),
      }
    }

    case 'screen-shot': {
      const asset = cleanStr(raw.asset, '', 96, { warnings, path: `${scenePath}.asset`, rejectOverflow })
      if (strict && !isSuggest && !asset) {
        throw new ReelValidationError(
          'screen-shot 镜头必须提供 asset 素材文件名（请先调用 reel_add_asset 导入工作区真实截图）',
          `${scenePath}.asset`,
          meta.example,
        )
      }
      if (asset && (asset.includes('/') || asset.includes('\\') || asset.includes('..') || asset.startsWith('.'))) {
        throw new ReelValidationError(
          `asset 只能填已导入项目的纯文件名（如 "board.png"），不能包含路径：${asset}`,
          `${scenePath}.asset`,
          meta.example,
        )
      }
      return {
        ...base,
        asset,
        windowTitle: cleanStr(raw.windowTitle, '', 40, { warnings, path: `${scenePath}.windowTitle`, rejectOverflow }),
        caption: cleanStr(raw.caption, '', 80, { warnings, path: `${scenePath}.caption`, rejectOverflow }),
        view: raw.view ? normalizeShotView(raw.view) : { x: 0.5, y: 0, z: 1 },
        focus: normalizeBox01(raw.focus),
        cursor: normalizePoint01(raw.cursor),
        coordSpace: raw.coordSpace === 'window' ? 'window' : 'image',
      }
    }

    case 'funnel-ticker': {
      if (!Array.isArray(raw.steps) || raw.steps.length < 2) {
        if (strict) {
          throw new ReelValidationError(
            'funnel-ticker 镜头必须提供 steps 数组（2–4 项，每项含 { count: 数字, unit: 单位, title: 说明 }）',
            `${scenePath}.steps`,
            meta.example,
          )
        }
      }
      const inputSteps = Array.isArray(raw.steps) ? raw.steps : []
      if (inputSteps.length > 4) {
        if (rejectOverflow) {
          throw new ReelValidationError(`${scenePath}.steps 超出上限 4 项`, `${scenePath}.steps`)
        }
        if (warnings) {
          warnings.push(`${scenePath}.steps 传了 ${inputSteps.length} 项，该镜头最多支持 4 项，已丢弃后 ${inputSteps.length - 4} 项`)
        }
      }
      const stepAllowed = new Set(['count', 'unit', 'title'])
      const steps = inputSteps.slice(0, 4).map((st, sIdx) => {
        const itemPath = `${scenePath}.steps[${sIdx}]`
        if (!st || typeof st !== 'object' || Array.isArray(st)) {
          throw new ReelValidationError('steps 每项必须是对象 { count, unit, title }', itemPath, meta.example)
        }
        checkUnknownKeys(st, [stepAllowed], itemPath, warnings)
        const numCount = Number(st.count)
        const title = cleanStr(st.title, '', 28, { warnings, path: `${itemPath}.title`, rejectOverflow })
        if (strict && (!Number.isFinite(numCount) || st.count === undefined || st.count === null || st.count === '' || !title)) {
          throw new ReelValidationError(
            'steps 每项必须同时包含数字 count 与非空说明 title（例如 { "count": 48, "unit": "个", "title": "候选匹配" }）',
            itemPath,
            meta.example,
          )
        }
        return {
          count: Number.isFinite(numCount) ? Math.max(0, Math.min(9_999_999, Math.round(numCount))) : 0,
          unit: cleanStr(st.unit, '', 8, { warnings, path: `${itemPath}.unit`, rejectOverflow }),
          title,
        }
      })
      return {
        ...base,
        steps,
        excludedLabel: cleanStr(raw.excludedLabel, '', 24, { warnings, path: `${scenePath}.excludedLabel`, rejectOverflow }),
        excluded: cleanStrList(raw.excluded, 6, 44, { warnings, path: `${scenePath}.excluded`, rejectOverflow }),
      }
    }

    case 'lego-snap': {
      if (!Array.isArray(raw.blocks) || raw.blocks.length < 2) {
        if (strict) {
          throw new ReelValidationError(
            'lego-snap 镜头必须提供 blocks 数组（2–3 项，每项含 { name: 模块名, role: 作用说明 }）',
            `${scenePath}.blocks`,
            meta.example,
          )
        }
      }
      const inputBlocks = Array.isArray(raw.blocks) ? raw.blocks : []
      if (inputBlocks.length > 3) {
        if (rejectOverflow) {
          throw new ReelValidationError(`${scenePath}.blocks 超出上限 3 项`, `${scenePath}.blocks`)
        }
        if (warnings) {
          warnings.push(`${scenePath}.blocks 传了 ${inputBlocks.length} 项，该镜头最多支持 3 项，已丢弃后 ${inputBlocks.length - 3} 项`)
        }
      }
      const validStatuses = ['ready', 'gap-to-solved', 'solved']
      const blockAllowed = new Set(['name', 'role', 'status', 'tag', 'solvedTag'])
      const sliced = inputBlocks.slice(0, 3)
      const blocks = sliced.map((b, bIdx) => {
        const itemPath = `${scenePath}.blocks[${bIdx}]`
        if (!b || typeof b !== 'object' || Array.isArray(b)) {
          throw new ReelValidationError('blocks 每项必须是对象 { name, role, status?, tag? }', itemPath, meta.example)
        }
        checkUnknownKeys(b, [blockAllowed], itemPath, warnings)
        const name = cleanStr(b.name, '', 36, { warnings, path: `${itemPath}.name`, rejectOverflow })
        const role = cleanStr(b.role, '', 60, { warnings, path: `${itemPath}.role`, rejectOverflow })
        if (strict && (!name || !role)) {
          throw new ReelValidationError(
            'blocks 每项必须提供非空的模块名 name 与作用说明 role',
            itemPath,
            meta.example,
          )
        }
        const status = validStatuses.includes(b.status)
          ? b.status
          : (bIdx === sliced.length - 1 ? 'gap-to-solved' : 'ready')
        return {
          name,
          role,
          status,
          tag: cleanStr(b.tag, '', 18, { warnings, path: `${itemPath}.tag`, rejectOverflow }),
          solvedTag: cleanStr(b.solvedTag, '', 22, { warnings, path: `${itemPath}.solvedTag`, rejectOverflow }),
        }
      })
      return {
        ...base,
        blocks,
        ctaLabel: cleanStr(raw.ctaLabel, '', 22, { warnings, path: `${scenePath}.ctaLabel`, rejectOverflow }),
        footnote: cleanStr(raw.footnote, '', 72, { warnings, path: `${scenePath}.footnote`, rejectOverflow }),
      }
    }

    case 'dual-showcase': {
      const lightCardTitle = cleanStr(raw.lightCardTitle, '', 44, { warnings, path: `${scenePath}.lightCardTitle`, rejectOverflow })
      const darkCardTitle = cleanStr(raw.darkCardTitle, '', 56, { warnings, path: `${scenePath}.darkCardTitle`, rejectOverflow })
      if (strict && (!lightCardTitle || !darkCardTitle)) {
        throw new ReelValidationError(
          'dual-showcase 镜头必须同时提供 lightCardTitle 与 darkCardTitle',
          `${scenePath}`,
          meta.example,
        )
      }
      const parsedCount = Number(raw.lightBrickCount)
      return {
        ...base,
        lightCardTitle,
        lightCardSub: cleanStr(raw.lightCardSub, '', 64, { warnings, path: `${scenePath}.lightCardSub`, rejectOverflow }),
        lightBrickCount: Number.isFinite(parsedCount) ? Math.max(0, Math.min(24, Math.round(parsedCount))) : 0,
        darkCardEyebrow: cleanStr(raw.darkCardEyebrow, '', 36, { warnings, path: `${scenePath}.darkCardEyebrow`, rejectOverflow }),
        darkCardTitle,
        darkCardBadge: cleanStr(raw.darkCardBadge, '', 28, { warnings, path: `${scenePath}.darkCardBadge`, rejectOverflow }),
        ctaPrimary: cleanStr(raw.ctaPrimary, '', 18, { warnings, path: `${scenePath}.ctaPrimary`, rejectOverflow }),
        ctaSecondary: cleanStr(raw.ctaSecondary, '', 18, { warnings, path: `${scenePath}.ctaSecondary`, rejectOverflow }),
      }
    }

    case 'code-diff': {
      const codeLines = cleanStrList(raw.codeLines, 6, 84, { warnings, path: `${scenePath}.codeLines`, rejectOverflow })
      if (strict && codeLines.length === 0) {
        throw new ReelValidationError(
          'code-diff 镜头必须提供非空字符串数组 codeLines（1–6 行代码或终端命令）',
          `${scenePath}.codeLines`,
          meta.example,
        )
      }
      return {
        ...base,
        fileLabel: cleanStr(raw.fileLabel, '', 44, { warnings, path: `${scenePath}.fileLabel`, rejectOverflow }),
        beforeLabel: cleanStr(raw.beforeLabel, '', 56, { warnings, path: `${scenePath}.beforeLabel`, rejectOverflow }),
        codeLines,
        badge: cleanStr(raw.badge, '', 36, { warnings, path: `${scenePath}.badge`, rejectOverflow }),
      }
    }

    case 'quote-kinetic': {
      const lines = cleanStrList(raw.lines, 4, 56, { warnings, path: `${scenePath}.lines`, rejectOverflow })
      if (strict && lines.length === 0) {
        throw new ReelValidationError(
          'quote-kinetic 镜头必须提供非空字符串数组 lines（1–4 句核心要点）',
          `${scenePath}.lines`,
          meta.example,
        )
      }
      return {
        ...base,
        lines,
        footnote: cleanStr(raw.footnote, '', 56, { warnings, path: `${scenePath}.footnote`, rejectOverflow }),
      }
    }

    case 'end-cta': {
      const ctaLabel = cleanStr(raw.ctaLabel, '', 28, { warnings, path: `${scenePath}.ctaLabel`, rejectOverflow })
      if (strict && !ctaLabel) {
        throw new ReelValidationError(
          'end-cta 收尾镜头必须提供按钮文案 ctaLabel',
          `${scenePath}.ctaLabel`,
          meta.example,
        )
      }
      return {
        ...base,
        badge: cleanStr(raw.badge, '', 44, { warnings, path: `${scenePath}.badge` }),
        ctaLabel,
        subline: cleanStr(raw.subline, '', 80, { warnings, path: `${scenePath}.subline`, rejectOverflow }),
      }
    }

    default:
      return base
  }
}

// Validate a single-scene inline rewrite candidate (`suggest_scene`), stripping any non-text fields
// and rejecting candidates that overflow limits or invent numbers (`funnel-ticker` count changes).
export function validateSuggestCandidate(originalScene, rawCandidatePatch, index = 0, fps = 60) {
  if (!rawCandidatePatch || typeof rawCandidatePatch !== 'object' || Array.isArray(rawCandidatePatch)) {
    return null
  }
  const kindDef = KIND_BY_ID[originalScene.kind]
  if (!kindDef) return null

  const allowedTextKeys = new Set(kindDef.textRewriteKeys || ['headline', 'eyebrow'])
  const cleanPatch = {}

  for (const [k, v] of Object.entries(rawCandidatePatch)) {
    if (!allowedTextKeys.has(k) || v === undefined || v === null) continue
    cleanPatch[k] = v
  }

  // For funnel-ticker, steps[].title can also be rewritten ONLY if steps length and counts match 1:1
  if (originalScene.kind === 'funnel-ticker' && Array.isArray(rawCandidatePatch.steps)) {
    const origSteps = originalScene.steps || []
    if (rawCandidatePatch.steps.length === origSteps.length) {
      cleanPatch.steps = origSteps.map((origSt, i) => ({
        count: origSt.count, // Never let suggest_scene invent or alter numbers!
        unit: typeof rawCandidatePatch.steps[i]?.unit === 'string' ? rawCandidatePatch.steps[i].unit : origSt.unit,
        title: typeof rawCandidatePatch.steps[i]?.title === 'string' ? rawCandidatePatch.steps[i].title : origSt.title,
      }))
    }
  }

  if (Object.keys(cleanPatch).length === 0) return null

  try {
    const mergedRaw = {
      ...structuredClone(originalScene),
      ...cleanPatch,
      kind: originalScene.kind,
      id: originalScene.id,
      rev: originalScene.rev,
      label: originalScene.label,
      durationSec: originalScene.durationSec,
      durationInFrames: originalScene.durationInFrames,
    }
    const normalized = normalizeScene(mergedRaw, index, fps, { mode: 'suggest' })
    const finalPatch = {}
    for (const k of Object.keys(cleanPatch)) {
      if (JSON.stringify(normalized[k]) !== JSON.stringify(originalScene[k])) {
        finalPatch[k] = normalized[k]
      }
    }
    if (Object.keys(finalPatch).length === 0) return null
    return {
      patch: finalPatch,
      previewScene: normalized,
    }
  } catch {
    return null
  }
}

export function normalizeStoryboard(raw, options = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ReelValidationError('分镜单顶层必须是 JSON 对象', 'storyboard')
  }

  const strict = options.strict !== false
  const warnings = Array.isArray(options.warnings) ? options.warnings : null
  checkUnknownKeys(raw, [TOP_STORYBOARD_KEYS], 'storyboard', warnings)

  if (raw.aspect !== undefined && raw.aspect !== '16:9' && raw.aspect !== '9:16') {
    throw new ReelValidationError('aspect 画幅仅支持 "16:9" 或 "9:16"', 'aspect')
  }
  const aspect = raw.aspect === '9:16' ? '9:16' : '16:9'
  const preset = ASPECT_PRESETS[aspect]
  const fps = Number(raw.fps) === 30 ? 30 : 60
  const title = cleanStr(raw.title, '', 60, { warnings, path: 'title' })
  if (strict && !title) {
    throw new ReelValidationError('必须提供视频项目标题 title', 'title')
  }
  const finalTitle = title || '未命名短片'

  const explicitId = cleanStr(raw.id || options.fallbackId || '', '', 64)
  const id = explicitId
    ? deriveProjectSlug(explicitId, 'reel')
    : deriveProjectSlug(finalTitle, 'reel')

  const productTag = cleanStr(raw.productTag, '', 28, { warnings, path: 'productTag' })
  const brief = cleanStr(raw.brief, '', 200, { warnings, path: 'brief' })
  const brandKitId = cleanStr(raw.brandKitId, 'paper', 32)
  const glyph = BRAND_GLYPHS.includes(raw.glyph) ? raw.glyph : (options.defaultGlyph || 'none')
  const showHud = Boolean(raw.showHud)

  if (!Array.isArray(raw.scenes) || raw.scenes.length < REEL_LIMITS.MIN_SCENES) {
    throw new ReelValidationError(
      `至少需要 ${REEL_LIMITS.MIN_SCENES} 个分镜场景（建议 ${REEL_LIMITS.RECOMMENDED_SCENES} 镜）`,
      'scenes',
    )
  }
  if (raw.scenes.length > REEL_LIMITS.MAX_SCENES) {
    throw new ReelValidationError(
      `单条短片最多支持 ${REEL_LIMITS.MAX_SCENES} 个分镜场景，请精简合并`,
      'scenes',
    )
  }

  // Ensure unique scene IDs inside the storyboard so per-scene diff/conflict/revert never collides
  const usedIds = new Set()
  const scenes = raw.scenes.map((sc, idx) => {
    const normalized = normalizeScene(sc, idx, fps, { strict, warnings })
    let uid = normalized.id
    let suffix = 2
    while (usedIds.has(uid)) {
      uid = `${normalized.id}-${suffix++}`
    }
    usedIds.add(uid)
    normalized.id = uid
    return normalized
  })

  const out = {
    schemaVersion: 3,
    id,
    title: finalTitle,
    productTag,
    brief,
    aspect,
    fps,
    width: preset.width,
    height: preset.height,
    brandKitId,
    glyph,
    showHud,
    scenes,
  }
  if (raw.assetMeta && typeof raw.assetMeta === 'object') {
    out.assetMeta = raw.assetMeta
  }
  return out
}

export function computeTimeline(storyboard) {
  const fps = storyboard?.fps || 60
  let cursor = 0
  const ranges = (storyboard?.scenes || []).map((scene, index) => {
    const sec = Number.isFinite(Number(scene.durationSec)) && Number(scene.durationSec) > 0
      ? Number(scene.durationSec)
      : Number(((scene.durationInFrames || Math.round(3 * fps)) / fps).toFixed(2))
    const frames = Math.max(1, Math.round(sec * fps))
    const startFrame = cursor
    const endFrame = cursor + frames
    cursor = endFrame
    return {
      index,
      id: scene.id,
      rev: scene.rev || 1,
      kind: scene.kind,
      label: scene.label,
      startFrame,
      endFrame,
      durationInFrames: frames,
      durationSec: Number((frames / fps).toFixed(2)),
    }
  })
  return {
    fps,
    totalFrames: Math.max(1, cursor),
    totalDurationSec: Number((cursor / fps).toFixed(2)),
    ranges,
  }
}
