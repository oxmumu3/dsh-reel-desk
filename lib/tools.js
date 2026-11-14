// Agent-facing tools for DSH Reel Desk (`制片台` Flow v3).
//
// Shares the exact same store & renderer operations as the UI panel.
// Optional parameters omit `required` (never `required: false`).

import {
  BRAND_GLYPH_META,
  BRAND_GLYPHS,
  computeTimeline,
  PRIMITIVE_KINDS,
  PRIMITIVE_META,
  REEL_LIMITS,
  ReelValidationError,
} from './schema.js'

const textOut = value => [{ type: 'text', text: String(value ?? '') }]
const str = (description, extra = {}) => ({ type: 'string', description, ...extra })
const num = (description, extra = {}) => ({ type: 'number', description, ...extra })
const bool = description => ({ type: 'boolean', description })

const MAX_TOOL_OUTPUT_CHARS = 7500

const CARD_OUTPUT_SPEC = {
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'meta'],
    properties: {
      text: { type: 'string' },
      meta: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
  render: (_args, val) => textOut(typeof val === 'string' ? val : val?.text),
  presentationMeta: (_args, val) => (val && typeof val === 'object' ? val.meta : undefined),
}

function capOutput(raw, recoveryHint) {
  const s = String(raw ?? '')
  if (s.length <= MAX_TOOL_OUTPUT_CHARS) return s
  return `${s.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n…[输出已截断，完整内容请调用 ${recoveryHint}]`
}

function formatError(err, sideEffects = '无副作用（原项目与文件未改动）') {
  const msg = err instanceof Error ? err.message : String(err)
  const wrapped = new Error(`${msg} | 副作用：${sideEffects} | 可重试：修正参数后可直接重试`)
  if (err?.code) wrapped.code = err.code
  if (err?.currentVersion !== undefined) wrapped.currentVersion = err.currentVersion
  if (err?.latestScenes !== undefined) wrapped.latestScenes = err.latestScenes
  return wrapped
}

export function extractAgentExecutionContext(exec, explicitAllowedRoots) {
  const sessionId =
    exec?.agent?.session?.id ||
    exec?.agent?.id ||
    exec?.sessionId ||
    null

  if (Array.isArray(explicitAllowedRoots) && explicitAllowedRoots.length > 0) {
    return {
      sessionId,
      baseDir: explicitAllowedRoots[0],
      allowedRoots: explicitAllowedRoots,
    }
  }

  const sessionCwd = exec?.agent?.session?.header?.cwd
  if (sessionCwd && typeof sessionCwd === 'string' && sessionCwd.trim()) {
    return {
      sessionId,
      baseDir: sessionCwd,
      allowedRoots: [sessionCwd],
    }
  }

  return {
    sessionId,
    baseDir: undefined,
    allowedRoots: [],
  }
}

export function createReelTools({ store, renderer, allowedRoots } = {}) {
  return [
    {
      name: 'reel_list',
      description: '列出制片台中的我的片子、只读示例片、导出状态、配色包、产品小图形及 8 种镜头的精确字段契约与示例。排片或改片前先调用。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      output: { schema: { type: 'string' }, render: (_a, v) => textOut(v) },
      execute: async () => {
        try {
          const snap = store.buildSnapshot()
          const projects = snap.projects || []
          const samples = snap.samples || []
          const kits = snap.brandKits || store.listBrandKits()
          const rendererStatus = renderer.getStatus()
          const job = rendererStatus.activeJob
          const jobLine = job
            ? `- 最近导出任务：${job.id} [${job.projectId}] 状态=${job.stage} 帧=${job.renderedFrames ?? 0}/${job.totalFrames ?? 0} ${job.error ? `错误=${job.error}` : (job.outputPath || job.message || '')}`
            : '- 最近导出任务：空闲'

          const lines = [
            `# 制片台（我的片子 ${projects.length} 条 · 示例 ${samples.length} 条）`,
            `- 渲染环境：浏览器=${rendererStatus.browserReady ? '就绪' : '未就绪'} · Remotion引擎=${rendererStatus.runtimeReady ? '已就绪' : '首次导出自动准备'}`,
            jobLine,
            `- 分镜规范：建议 ${REEL_LIMITS.RECOMMENDED_SCENES} 镜（上限 ${REEL_LIMITS.MAX_SCENES} 镜），单镜时长 ${REEL_LIMITS.MIN_SCENE_SEC}–${REEL_LIMITS.MAX_SCENE_SEC}s，headline 建议 ${REEL_LIMITS.RECOMMENDED_HEADLINE_CHARS} 字（上限 ${REEL_LIMITS.MAX_HEADLINE_CHARS} 字）`,
            '',
            '## 我的片子',
            ...(projects.length
              ? projects.map(p => (
                  `- ${p.id} [${p.aspect} · ${p.totalDurationSec}s · ${p.sceneCount}镜 · 第${p.version}版 · kit=${p.brandKitId} · glyph=${p.glyph}] 「${p.title}」` +
                  (p.latestRender ? `（已导出: ${p.latestRender.fileName}）` : '')
                ))
              : ['- 暂无用户片子（新建片子请调用 reel_save_storyboard 且不要传 id）']),
            '',
            '## 只读示例（仅供参考，新建片子勿传示例 id）',
            ...samples.map(s => `- sampleId="${s.id}" [${s.aspect}] 「${s.title}」`),
            '',
            '## 配色包 (brandKitId) 与产品图形 (glyph)',
            ...kits.map(k => `- brandKitId="${k.id}"：${k.name} — ${k.description}`),
            `- glyph 可选值：${BRAND_GLYPHS.map(g => `${g}(${BRAND_GLYPH_META[g].label})`).join(' | ')}`,
            '',
            '## 8 种镜头样式 (scene.kind) 字段契约与最小示例',
            ...PRIMITIVE_KINDS.map(k => {
              const m = PRIMITIVE_META[k]
              return [
                `- **${k}**（${m.label}，适合：${m.fit}，默认 ${m.defaultSec}s）：${m.summary}`,
                `  字段：${m.fieldGuide}`,
                `  示例：${JSON.stringify(m.example)}`,
              ].join('\n')
            }),
          ]
          return capOutput(lines.join('\n'), 'reel_get({ id })')
        } catch (err) {
          throw formatError(err)
        }
      },
    },

    {
      name: 'reel_get',
      description: '读取指定片子的完整分镜单（Storyboard JSON）、当前版本号 version、逐镜 id/rev/时长区间、已导入截图素材与导出记录。修改已有片子前先调此工具获取最新 version。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: str('项目 id'),
        },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => textOut(v) },
      execute: async args => {
        try {
          const rec = store.readProjectRecord(String(args?.id ?? ''))
          const tl = computeTimeline(rec.storyboard)
          const assets = store.listProjectAssets(rec.id, rec.assets)
          const out = [
            `# ${rec.storyboard.title} (id: ${rec.id})`,
            `- 当前版本: version=${rec.version}（调用 reel_patch_scene 时建议传 baseVersion=${rec.version}）`,
            `- 画幅: ${rec.storyboard.aspect} (${rec.storyboard.width}×${rec.storyboard.height} @ ${rec.storyboard.fps}fps) · 总长: ${tl.totalDurationSec}s (${tl.totalFrames} 帧)`,
            `- 配色: ${rec.storyboard.brandKitId} · 图形: ${rec.storyboard.glyph || 'none'}`,
            rec.storyboard.brief ? `- 创作简报: ${rec.storyboard.brief}` : null,
            `- 已导入截图素材 (${assets.length}): ${assets.length ? assets.map(a => `${a.name}(${a.width}×${a.height})`).join(', ') : '无（可调 reel_add_asset 导入工作区截图）'}`,
            '',
            '## 分镜时间轴',
            ...tl.ranges.map(r => {
              const sc = rec.storyboard.scenes[r.index]
              return `- [sceneIndex=${r.index} | id=${sc.id} | rev=${sc.rev || 1}] ${r.kind} (${r.durationSec}s, frames ${r.startFrame}..${r.endFrame}) 「${sc.label}」— ${sc.headline}`
            }),
            '',
            '## 完整 Storyboard JSON',
            JSON.stringify(rec.storyboard, null, 2),
          ].filter(Boolean)
          return capOutput(out.join('\n'), 'reel_get')
        } catch (err) {
          throw formatError(err)
        }
      },
    },

    {
      name: 'reel_add_asset',
      description: '将当前对话所属工作区内的真实界面截图（PNG/JPG/WEBP/GIF）导入指定片子的素材目录，返回可用于 screen-shot 镜头 `asset` 字段的文件名与原图尺寸。禁止读取工作区外的路径。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'path'],
        properties: {
          id: str('目标片子的项目 id'),
          path: str('当前工作区内的截图文件路径（相对工作区或绝对路径）'),
        },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => textOut(v) },
      execute: async (args, exec) => {
        try {
          const { baseDir, allowedRoots: roots } = extractAgentExecutionContext(exec, allowedRoots)
          const res = store.addProjectAsset(String(args?.id ?? ''), String(args?.path ?? ''), {
            baseDir,
            allowedRoots: roots,
            source: 'agent',
          })
          const kb = (res.sizeBytes / 1024).toFixed(1)
          return [
            `已导入截图素材 "${res.asset}" 到片子 ${res.projectId}（${res.width}×${res.height} · ${kb} KB）`,
            `- 分镜引用示例：{ "kind": "screen-shot", "asset": "${res.asset}", "headline": "...", "view": { "x": 0.5, "y": 0, "z": 1 } }`,
            '- focus 与 cursor 坐标均按整张截图原图的 0..1 归一化坐标填写；用户也可在「制片台」取景小图或舞台上直接拖拽框选。',
          ].join('\n')
        } catch (err) {
          throw formatError(err)
        }
      },
    },

    {
      name: 'reel_save_storyboard',
      description: '新建一条视频片子或覆盖更新指定 id 的完整分镜单。开新片时请勿传 id（系统会自动分配不冲突的新 id 并生成对话内的分镜卡片）；若只是修改已有片子的部分镜头，请优先用 reel_patch_scene。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'scenes'],
        properties: {
          id: str('仅在明确要整片重排覆盖某条已有片子时传入其 id；新建片子时不要传此字段'),
          createNew: bool('可选：设为 true 时强制另存为一条新片子'),
          title: str('片名（中文或英文均可）'),
          productTag: str('画面右上角短标签（可选，16 字以内）'),
          brief: str('一句话创作说明（可选）'),
          aspect: str('画幅比例：16:9（横屏 1920×1080，默认）或 9:16（竖屏 1080×1920）', { enum: ['16:9', '9:16'] }),
          fps: num('帧率：60（默认）或 30', { enum: [30, 60] }),
          brandKitId: str('配色包 id：paper（家族纸白，默认）| ink（极夜深墨）| cobalt（克制蓝印）'),
          glyph: str('产品小图形：dot（点）| tag（小签）| plugin（插件块）| none（不放，默认）', { enum: BRAND_GLYPHS }),
          showHud: bool('是否在画面上显示排片用的镜号与时间码（默认 false，正式成片建议关闭）'),
          note: str('可选：本次排片或重排的简短说明（用于版本记录，24 字以内）'),
          scenes: {
            type: 'array',
            description: `分镜数组（建议 ${REEL_LIMITS.RECOMMENDED_SCENES} 镜，最多 ${REEL_LIMITS.MAX_SCENES} 镜）。请先调 reel_list 查看每种 kind 的必填子字段示例。`,
            items: { type: 'object' },
          },
        },
      },
      output: CARD_OUTPUT_SPEC,
      execute: async (args, exec) => {
        try {
          const { sessionId } = extractAgentExecutionContext(exec, allowedRoots)
          const rec = store.saveStoryboard(args || {}, {
            by: 'agent',
            strict: true,
            createNew: Boolean(args?.createNew),
            sessionId,
            note: args?.note || undefined,
          })
          const tl = computeTimeline(rec.storyboard)
          const kits = store.listBrandKits()
          const brandKit = kits.find(k => k.id === rec.storyboard.brandKitId) || kits[0]

          const lines = [
            `已保存片子「${rec.storyboard.title}」（id: ${rec.id}，第 ${rec.version} 版）`,
            `- 画幅：${rec.storyboard.aspect} (${rec.storyboard.width}×${rec.storyboard.height} @ ${rec.storyboard.fps}fps)`,
            `- 共 ${rec.storyboard.scenes.length} 镜，总时长 ${tl.totalDurationSec}s（${tl.totalFrames} 帧），配色：${rec.storyboard.brandKitId}，图形：${rec.storyboard.glyph}`,
            ...(rec.warnings && rec.warnings.length
              ? [`- ⚠️ 校验提示：${rec.warnings.join('；')}`]
              : []),
            '- 对话里已向用户展示实时缩略帧卡片，用户可直接点「去制片台看片改片」预览、拖胶片条或改字；仅在用户明确要求导出视频文件时调用 reel_render。',
          ]

          return {
            text: lines.join('\n'),
            meta: {
              reelDeskCard: {
                kind: 'film-card',
                projectId: rec.id,
                version: rec.version,
                isNew: rec.version === 1,
                title: rec.storyboard.title,
                aspect: rec.storyboard.aspect,
                width: rec.storyboard.width,
                height: rec.storyboard.height,
                fps: rec.storyboard.fps,
                brandKitId: rec.storyboard.brandKitId,
                brandKit,
                glyph: rec.storyboard.glyph,
                sceneCount: rec.storyboard.scenes.length,
                totalFrames: tl.totalFrames,
                totalDurationSec: tl.totalDurationSec,
                storyboard: rec.storyboard,
              },
            },
          }
        } catch (err) {
          throw formatError(err)
        }
      },
    },

    {
      name: 'reel_patch_scene',
      description: '局部修改、插入、删除或调序已有片子的单个或多个分镜（支持传入 ops 数组在一次调用中改完多镜并生成前后对比卡）。修改前建议先调 reel_get 获取最新 baseVersion。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: str('项目 id'),
          baseVersion: num('可选但推荐：上次 reel_get 读到的项目版本号 version。若面板在此期间也改了同一镜，工具会返回最新镜头 JSON 供你合并后重试，防止静默覆盖用户的手工修改'),
          note: str('可选：本次修改摘要（如“把节奏压到 12 秒”，24 字以内）'),
          op: str('单镜操作类型：update（修改指定镜）| insert（插入新镜）| delete（删除指定镜）| move（移动顺序）。若一次改多镜可改传 ops 数组', {
            enum: ['update', 'insert', 'delete', 'move'],
          }),
          sceneIndex: num('单镜操作时的目标分镜索引（从 0 开始）'),
          sceneId: str('可选：按分镜 id 定位目标分镜（优先于 sceneIndex）'),
          toIndex: num('仅 op=move 时使用：移动到的目标索引（从 0 开始）'),
          scene: {
            type: 'object',
            description: '单镜 op=update 或 insert 时传入的分镜字段（如 kind, label, headline, durationSec, typedQuery, asset, view, focus, cursor, steps, blocks, lines, codeLines, ctaLabel 等）',
          },
          ops: {
            type: 'array',
            description: '可选：多镜批量操作数组，每项含 { op, sceneIndex, sceneId, toIndex, scene }，一次调用原子提交为一个新版本',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['op'],
              properties: {
                op: str('操作类型：update | insert | delete | move', { enum: ['update', 'insert', 'delete', 'move'] }),
                sceneIndex: num('目标分镜索引（从 0 开始）'),
                sceneId: str('可选：按分镜 id 定位'),
                toIndex: num('仅 op=move 时的目标索引'),
                scene: { type: 'object', description: '分镜字段补丁或新分镜对象' },
              },
            },
          },
        },
      },
      output: CARD_OUTPUT_SPEC,
      execute: async (args, exec) => {
        try {
          const hasBatch = Array.isArray(args?.ops) && args.ops.length > 0
          if (!hasBatch && !args?.op) {
            throw new ReelValidationError('请传入 op（单镜修改）或非空 ops 数组（多镜批量修改）', 'op')
          }
          const { sessionId } = extractAgentExecutionContext(exec, allowedRoots)
          const rec = store.patchScene(String(args?.id ?? ''), {
            op: args?.op,
            sceneIndex: args?.sceneIndex,
            sceneId: args?.sceneId,
            toIndex: args?.toIndex,
            scene: args?.scene,
            ops: hasBatch ? args.ops : undefined,
            baseVersion: Number.isInteger(args?.baseVersion) ? args.baseVersion : undefined,
            note: args?.note || undefined,
            sessionId,
            by: 'agent',
            strict: true,
          })
          const tl = computeTimeline(rec.storyboard)
          const kits = store.listBrandKits()
          const brandKit = kits.find(k => k.id === rec.storyboard.brandKitId) || kits[0]
          const changedCount = (rec.changedPairs || []).length || 1

          const lines = [
            `已更新片子「${rec.storyboard.title}」（id: ${rec.id}，第 ${rec.version} 版）：改了 ${changedCount} 镜，总时长 ${rec.prevDurationSec}s → ${tl.totalDurationSec}s（共 ${rec.storyboard.scenes.length} 镜）。`,
            ...(rec.warnings && rec.warnings.length
              ? [`⚠️ 校验提示：${rec.warnings.join('；')}`]
              : []),
            '- 对话里已向用户展示修改前后对比卡片，用户可点「去制片台看改动」逐镜查看或单独退回某一镜。',
          ]

          return {
            text: lines.join('\n'),
            meta: {
              reelDeskCard: {
                kind: 'patch-card',
                projectId: rec.id,
                version: rec.version,
                baseVersion: Math.max(1, (rec.version || 2) - 1),
                title: rec.storyboard.title,
                aspect: rec.storyboard.aspect,
                width: rec.storyboard.width,
                height: rec.storyboard.height,
                fps: rec.storyboard.fps,
                brandKitId: rec.storyboard.brandKitId,
                brandKit,
                glyph: rec.storyboard.glyph,
                prevDurationSec: rec.prevDurationSec,
                nextDurationSec: tl.totalDurationSec,
                storyboard: rec.storyboard,
                pairs: rec.changedPairs || [],
              },
            },
          }
        } catch (err) {
          throw formatError(err)
        }
      },
    },

    {
      name: 'reel_render',
      description: '渲染导出高清 MP4 成片、用于 README 的循环 GIF 或单帧 PNG 抽检图，也可取消正在进行的导出任务。仅在用户明确需要导出文件时调用。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: str('要导出的项目 id'),
          format: str('可选：导出格式 mp4（默认，高清 H.264 视频）或 gif（半宽循环动图，适合贴进 README）', {
            enum: ['mp4', 'gif'],
          }),
          quality: str('可选：导出规格 full（正式全清，默认）或 draft（草稿半分辨率 30fps 快速预览）', {
            enum: ['full', 'draft'],
          }),
          draft: bool('可选：同 quality="draft"，设为 true 时快速导出半分辨率草稿片'),
          stillFrame: num('可选：仅导出一张 PNG 静帧抽检时传入帧号（0..totalFrames-1）'),
          cancel: bool('可选：设为 true 时取消当前正在运行的导出任务'),
          waitMs: num('可选：最多同步等待多少毫秒（默认 25000；超时后任务继续在后台完成）'),
        },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => textOut(v) },
      execute: async args => {
        try {
          if (args?.cancel) {
            const cancelled = renderer.cancelRender()
            return cancelled
              ? `已取消导出任务 ${cancelled.id}（${cancelled.projectId}）。`
              : '当前没有正在运行的导出任务。'
          }

          const waitBudget = Number.isFinite(Number(args?.waitMs))
            ? Math.max(1000, Math.min(180_000, Number(args.waitMs)))
            : 25_000

          const quality = args?.quality === 'draft' || args?.draft ? 'draft' : 'full'
          const format = args?.format === 'gif' ? 'gif' : 'mp4'

          const jobInfo = renderer.startBackgroundRender(String(args?.id ?? ''), {
            stillFrame: args?.stillFrame,
            quality,
            format,
            draft: quality === 'draft',
          })

          const completed = await renderer.waitForJob(jobInfo.id, waitBudget)
          if (completed && completed.stage === 'done' && completed.entry) {
            const entry = completed.entry
            const mb = (entry.sizeBytes / (1024 * 1024)).toFixed(2)
            return [
              `已完成导出 (${entry.kind.toUpperCase()} · 第 ${entry.version} 版)`,
              `- 文件路径: ${entry.outputPath}`,
              `- 规格: ${entry.width}×${entry.height} @ ${entry.fps}fps · ${entry.durationSec}s (${entry.totalFrames} 帧) · ${mb} MB`,
              '- 用户可在「制片台」直接看成片或点「在访达中显示」。',
            ].join('\n')
          }
          if (completed && completed.stage === 'failed') {
            throw new Error(completed.error || completed.message || '导出失败')
          }

          const latest = renderer.getStatus().activeJob || jobInfo
          return [
            `导出任务已在后台继续运行（任务 ${latest.id} · 阶段=${latest.stage} · 帧=${latest.renderedFrames || 0}/${latest.totalFrames || 0}）`,
            `- 说明：${latest.message || '正在准备合成环境或逐帧合成'}`,
            '- 可在「制片台」顶部状态条实时查看帧数进度或取消，稍后也可调用 reel_list 核对最终导出文件路径。',
          ].join('\n')
        } catch (err) {
          throw formatError(err, '原分镜数据未改动')
        }
      },
    },
  ]
}

export function installReelTools(ctx, { store, renderer }, log = () => {}) {
  let disposers = []
  const unregister = () => {
    for (const off of disposers.splice(0).reverse()) {
      try { off?.() } catch { /* ignore */ }
    }
  }

  try {
    ctx.inject(['tools'], scope => {
      try {
        const tools = scope?.tools ?? scope?.get?.('tools', false) ?? null
        if (!tools || typeof tools.register !== 'function') return undefined
        if (disposers.length > 0) return undefined
        for (const def of createReelTools({ store, renderer })) {
          const off = tools.register(def)
          if (typeof off === 'function') disposers.push(off)
        }
        log('tools registered: reel_list, reel_get, reel_add_asset, reel_save_storyboard, reel_patch_scene, reel_render')
        return unregister
      } catch (err) {
        log(`tool registration failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      }
    })
  } catch (err) {
    log(`tools inject unavailable: ${err instanceof Error ? err.message : String(err)}`)
  }

  return unregister
}
