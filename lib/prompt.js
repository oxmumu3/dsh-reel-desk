// Byte-budgeted system prompt guidance for DSH host models (e.g. DeepSeek).
//
// Follows DSH plugin lessons:
//   - Fixed text (only returned when reel_list is visible in scope).
//   - Strict UTF-8 byte budget (<= 1150 bytes), enforced by unit test.

import { REEL_LIMITS } from './schema.js'

export const REEL_PROMPT_MAX_BYTES = 1150

export const REEL_SYSTEM_PROMPT = [
  '【制片台 (reel_*)】当用户要求做产品发布片、演示短片、竖屏片或改分镜时，用 reel_* 工具编排分镜（若用户明确要在自己的 Remotion 工程写源码，直接写代码）：',
  '1. 先调 reel_list 看我的片子与 8 种镜头契约。工作区若有真实截图，先调 reel_add_asset 导入再用 screen-shot 入镜（focus/cursor 为截图 0..1 坐标）。',
  `2. 开新片调 reel_save_storyboard 勿传 id，建议 ${REEL_LIMITS.RECOMMENDED_SCENES} 镜、每镜 ${REEL_LIMITS.MIN_SCENE_SEC}–${REEL_LIMITS.MAX_SCENE_SEC}s、headline ${REEL_LIMITS.RECOMMENDED_HEADLINE_CHARS} 字。严禁编造数字，无真实数据勿用 funnel-ticker。`,
  '3. 改已有片子先调 reel_get 拿 version，再调 reel_patch_scene（传 baseVersion，改多镜用 ops 数组一次提交）；仅用户明确要导出 MP4/GIF 时调 reel_render。',
].join('\n')

export function registerReelPrompt(ctx, log = () => {}) {
  let disposePrompt
  const unregister = () => {
    try { disposePrompt?.() } catch { /* ignore */ }
    disposePrompt = undefined
  }

  try {
    ctx.inject(['systemPrompt'], scope => {
      try {
        const sp = scope?.systemPrompt ?? scope?.get?.('systemPrompt', false) ?? null
        if (!sp || typeof sp.section !== 'function') return undefined
        if (disposePrompt) return undefined
        disposePrompt = sp.section({
          name: 'reel-desk:storyboard-routing',
          order: 5200,
          text: ({ scope: turnScope } = {}) => {
            const tools = ctx.get?.('tools', false)
            if (tools && typeof tools.get === 'function' && turnScope) {
              if (!tools.get('reel_list', turnScope)) return ''
            }
            return REEL_SYSTEM_PROMPT
          },
        })
        log('systemPrompt section registered')
        return unregister
      } catch (err) {
        log(`systemPrompt registration failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      }
    })
  } catch (err) {
    log(`systemPrompt inject unavailable: ${err instanceof Error ? err.message : String(err)}`)
  }

  return unregister
}
