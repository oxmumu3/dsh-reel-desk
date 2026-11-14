// @oxmumu3/dsh-reel-desk — Host entry for DSH 制片台 (Remotion Video Workbench · Flow v3).
//
// Wires persistent Storyboard JSON + Brand Kit storage, local Remotion 4 MP4/GIF
// renderer, HTTP routes (/api/reel_desk/*), reel_* Agent tools, and byte-budgeted
// systemPrompt guidance cleanly inside ctx.effect lifecycle hooks.

import { createReelStore } from './lib/store.js'
import { createReelRenderer } from './lib/renderer.js'
import { registerReelRoutes } from './lib/routes.js'
import { installReelTools } from './lib/tools.js'
import { registerReelPrompt } from './lib/prompt.js'

export const name = 'dsh-reel-desk'
export const inject = []

const MOUNTED_CTX = new WeakSet()

export function apply(ctx, config = {}) {
  if (ctx && typeof ctx === 'object') {
    if (MOUNTED_CTX.has(ctx)) return () => {}
    MOUNTED_CTX.add(ctx)
  }

  const log = message => {
    try {
      ctx?.logger?.info?.(`[dsh-reel-desk] ${message}`)
    } catch {
      // Never let logger errors disrupt host boot.
    }
  }

  const store = createReelStore({ rootDir: config?.rootDir })
  try {
    store.ensureInitialized()
  } catch (err) {
    log(`store init warning: ${err instanceof Error ? err.message : String(err)}`)
  }

  const renderer = createReelRenderer({ store, log })
  log(`loaded; store=${store.rootDir}`)

  const disposeTools = installReelTools(ctx, { store, renderer }, log)
  const disposePrompt = registerReelPrompt(ctx, log)

  let disposeRoutes
  try {
    ctx.inject(['connection'], scope => {
      try {
        const off = registerReelRoutes(scope, { ctx, store, renderer })
        if (typeof off === 'function') {
          disposeRoutes = off
          log('routes registered: /api/reel_desk/view, /api/reel_desk/action, /api/reel_desk/asset, /api/reel_desk/media')
          return () => {
            try { off() } catch { /* ignore */ }
            if (disposeRoutes === off) disposeRoutes = undefined
          }
        }
        return undefined
      } catch (err) {
        log(`route registration failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      }
    })
  } catch (err) {
    log(`connection inject unavailable: ${err instanceof Error ? err.message : String(err)}`)
  }

  const dispose = () => {
    try { disposeRoutes?.() } catch { /* ignore */ }
    try { disposePrompt?.() } catch { /* ignore */ }
    try { disposeTools?.() } catch { /* ignore */ }
    try { renderer.dispose() } catch { /* ignore */ }
    if (ctx && typeof ctx === 'object') {
      MOUNTED_CTX.delete(ctx)
    }
  }

  if (typeof ctx?.effect === 'function') {
    ctx.effect(() => dispose)
  }
  return dispose
}
