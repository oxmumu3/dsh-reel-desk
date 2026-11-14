// Isomorphic f(frame) Scene Composition Core (shared between DSH Client Player & Remotion 4 Renderer).
//
// Zero external dependencies: accepts any React-like `{ createElement }`, plus optional
// `{ Img, resolveAsset }` so browser preview uses `'img'` + `/api/reel_desk/media` while
// headless Remotion export uses `<Img src={staticFile(...)}>` (preventing blank undecoded frames).

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

export function interpolate(frame, inputRange, outputRange, options = {}) {
  const [inMin, inMax] = inputRange
  const [outMin, outMax] = outputRange
  if (inMax === inMin) return outMax
  let t = (frame - inMin) / (inMax - inMin)
  if (options.extrapolateLeft !== 'extend') t = Math.max(0, t)
  if (options.extrapolateRight !== 'extend') t = Math.min(1, t)
  return outMin + t * (outMax - outMin)
}

// Analytical damped harmonic oscillator matching Remotion's spring({ frame, fps, config })
export function spring({ frame, fps = 60, delay = 0, config = {} }) {
  const localFrame = frame - delay
  if (localFrame <= 0) return 0
  const c = Number(config.damping) || 16
  const k = Number(config.stiffness) || 120
  const m = Number(config.mass) || 1
  const t = localFrame / fps
  const omega0 = Math.sqrt(k / m)
  const zeta = c / (2 * Math.sqrt(k * m))

  let value
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const envelope = Math.exp(-zeta * omega0 * t)
    value = 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * t))
  } else {
    const envelope = Math.exp(-omega0 * t)
    value = 1 - envelope * (1 + omega0 * t)
  }
  if (Math.abs(1 - value) < 0.0005 && t > 0.25) return 1
  return value
}

const SERIF_STACK = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif'
const SANS_STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif'
const MONO_STACK = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

function pad2(n) {
  return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, '0')
}

// Broadcast-grade video typography: readable on a 390px mobile feed (~0.20x of 1920px)
function headlineFontSize(text, isVertical, scale = 1) {
  const len = Array.from(String(text || '')).length
  let base
  if (isVertical) {
    if (len <= 14) base = 96
    else if (len <= 24) base = 82
    else if (len <= 34) base = 70
    else base = 58
  } else {
    if (len <= 15) base = 104
    else if (len <= 24) base = 88
    else if (len <= 34) base = 74
    else base = 62
  }
  return Math.round(base * scale)
}

function sceneFramesOf(sc, fps) {
  if (Number.isFinite(Number(sc?.durationSec)) && Number(sc.durationSec) > 0) {
    return Math.max(1, Math.round(Number(sc.durationSec) * fps))
  }
  return Math.max(1, Math.round(Number(sc?.durationInFrames) || 3 * fps))
}

export function resolveActiveScene(storyboard, globalFrame) {
  const scenes = storyboard?.scenes || []
  const fps = storyboard?.fps || 60
  if (!scenes.length) return { scene: null, index: 0, localFrame: 0, sceneDuration: 1, totalFrames: 1 }
  const durations = scenes.map(sc => sceneFramesOf(sc, fps))
  const totalFrames = Math.max(1, durations.reduce((a, b) => a + b, 0))
  let cursor = 0
  for (let i = 0; i < scenes.length; i++) {
    const dur = durations[i]
    const end = cursor + dur
    if (globalFrame < end || i === scenes.length - 1) {
      return {
        scene: scenes[i],
        index: i,
        localFrame: clamp(globalFrame - cursor, 0, Math.max(0, dur - 1)),
        sceneDuration: dur,
        totalFrames,
      }
    }
    cursor = end
  }
  return { scene: scenes[0], index: 0, localFrame: 0, sceneDuration: durations[0] || 1, totalFrames }
}

// ── H.2: Deterministic `screen-shot` viewport & image-space coordinate projection ──
export function normalizeShotView(view) {
  const x = Number.isFinite(Number(view?.x)) ? clamp(Number(view.x), 0, 1) : 0.5
  const y = Number.isFinite(Number(view?.y)) ? clamp(Number(view.y), 0, 1) : 0
  const z = Number.isFinite(Number(view?.z)) ? clamp(Number(view.z), 1, 3) : 1
  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    z: Number(z.toFixed(3)),
  }
}

export function computeShotViewportSize(storyboard, scene) {
  const width = Number(storyboard?.width) || (storyboard?.aspect === '9:16' ? 1080 : 1920)
  const height = Number(storyboard?.height) || (storyboard?.aspect === '9:16' ? 1920 : 1080)
  const isVertical = height > width
  const hasCaption = Boolean(scene?.caption && String(scene.caption).trim())
  if (isVertical) {
    return { w: 932, h: hasCaption ? 1120 : 1200 }
  }
  return { w: 1676, h: hasCaption ? 556 : 624 }
}

export function resolveShotAssetDims(storyboard, scene, assetMeta) {
  const name = scene?.asset
  const meta = (name && assetMeta && assetMeta[name]) ||
    (name && storyboard?.assetMeta && storyboard.assetMeta[name]) ||
    scene?.assetDims ||
    null
  const w = Math.max(1, Number(meta?.width || meta?.w) || 1600)
  const h = Math.max(1, Number(meta?.height || meta?.h) || 1000)
  return { w, h }
}

export function computeShotGeometry(storyboard, scene, assetMeta) {
  const vp = computeShotViewportSize(storyboard, scene)
  const im = resolveShotAssetDims(storyboard, scene, assetMeta)
  const v = normalizeShotView(scene?.view)
  const s = Math.max(vp.w / im.w, vp.h / im.h) * v.z
  const dw = im.w * s
  const dh = im.h * s
  const ox = (vp.w - dw) * v.x
  const oy = (vp.h - dh) * v.y
  const uw = Math.min(1, vp.w / dw)
  const vh = Math.min(1, vp.h / dh)
  const u0 = dw > 0 ? clamp(-ox / dw, 0, Math.max(0, 1 - uw)) : 0
  const v0 = dh > 0 ? clamp(-oy / dh, 0, Math.max(0, 1 - vh)) : 0
  return { vp, im, v, s, dw, dh, ox, oy, u0, v0, uw, vh }
}

export function shotImageToViewport(geom, pt) {
  return {
    x: (geom.ox + Number(pt.x || 0) * geom.dw) / geom.vp.w,
    y: (geom.oy + Number(pt.y || 0) * geom.dh) / geom.vp.h,
  }
}

export function shotImageRectToViewport(geom, rect) {
  const tl = shotImageToViewport(geom, rect)
  return {
    x: tl.x,
    y: tl.y,
    w: (Number(rect.w || 0.28) * geom.dw) / geom.vp.w,
    h: (Number(rect.h || 0.2) * geom.dh) / geom.vp.h,
  }
}

export function shotViewportToImage(geom, pt) {
  return {
    x: clamp((Number(pt.x || 0) * geom.vp.w - geom.ox) / geom.dw, 0, 1),
    y: clamp((Number(pt.y || 0) * geom.vp.h - geom.oy) / geom.dh, 0, 1),
  }
}

export function shotViewportRectToImage(geom, rect) {
  const tl = shotViewportToImage(geom, rect)
  const w = clamp((Number(rect.w || 0.28) * geom.vp.w) / geom.dw, 0.04, 1)
  const h = clamp((Number(rect.h || 0.2) * geom.vp.h) / geom.dh, 0.04, 1)
  return {
    x: Number(clamp(tl.x, 0, 1 - w).toFixed(4)),
    y: Number(clamp(tl.y, 0, 1 - h).toFixed(4)),
    w: Number(w.toFixed(4)),
    h: Number(h.toFixed(4)),
  }
}

export function reframeShotForAspect(storyboard, scene, assetMeta) {
  const z = normalizeShotView(scene?.view).z
  const target = scene?.focus
    ? { x: Number(scene.focus.x) + Number(scene.focus.w) / 2, y: Number(scene.focus.y) + Number(scene.focus.h) / 2 }
    : (scene?.cursor ? { x: Number(scene.cursor.x), y: Number(scene.cursor.y) } : null)

  const baseView = { x: 0.5, y: 0, z }
  if (!target) {
    scene.view = baseView
    return baseView
  }
  const g = computeShotGeometry(storyboard, { ...scene, view: baseView }, assetMeta)
  const uw = g.vp.w / g.dw
  const vh = g.vp.h / g.dh
  const vx = uw < 0.999 ? clamp((target.x - uw / 2) / (1 - uw), 0, 1) : 0.5
  const vy = vh < 0.999 ? clamp((target.y - vh / 2) / (1 - vh), 0, 1) : 0
  scene.view = {
    x: Number(vx.toFixed(4)),
    y: Number(vy.toFixed(4)),
    z: Number(z.toFixed(3)),
  }
  return scene.view
}

// Product-following minimalist glyph (`dot` | `tag` | `plugin` | `none`)
export function renderBrandGlyph(h, { glyph = 'none', status = 'ready', kit, size = 36 }) {
  if (!glyph || glyph === 'none') return null
  const isAmber = status === 'gap'
  const isSolved = status === 'solved'
  const stroke = isAmber ? kit.amber : isSolved ? kit.emerald : kit.accent
  const fill = isAmber ? kit.amberTint : isSolved ? kit.emeraldTint : kit.accentTint
  const dash = isAmber ? '4 3' : undefined

  if (glyph === 'dot') {
    return h('svg', {
      width: size,
      height: size,
      viewBox: '0 0 36 36',
      fill: 'none',
      style: { display: 'block', flexShrink: 0 },
    },
      h('circle', {
        cx: 18,
        cy: 18,
        r: 14,
        fill,
        stroke,
        strokeWidth: 2.4,
        strokeDasharray: dash,
      }),
      h('circle', {
        cx: 18,
        cy: 18,
        r: 5.5,
        fill: isAmber ? 'none' : stroke,
        stroke: isAmber ? stroke : undefined,
        strokeWidth: isAmber ? 2 : undefined,
      }),
    )
  }

  if (glyph === 'tag') {
    return h('svg', {
      width: size,
      height: size,
      viewBox: '0 0 36 36',
      fill: 'none',
      style: { display: 'block', flexShrink: 0 },
    },
      h('rect', {
        x: 5,
        y: 4,
        width: 26,
        height: 28,
        rx: 7,
        fill,
        stroke,
        strokeWidth: 2.3,
        strokeDasharray: dash,
      }),
      h('line', {
        x1: 11,
        y1: 13,
        x2: 25,
        y2: 13,
        stroke,
        strokeWidth: 2.4,
        strokeLinecap: 'round',
      }),
      h('line', {
        x1: 11,
        y1: 20,
        x2: 20,
        y2: 20,
        stroke,
        strokeWidth: 2.4,
        strokeLinecap: 'round',
      }),
    )
  }

  // `plugin` brick glyph
  return h('svg', {
    width: size,
    height: Math.round(size * 0.78),
    viewBox: '0 0 44 34',
    fill: 'none',
    style: { display: 'block', flexShrink: 0 },
  },
    h('rect', {
      x: 7,
      y: 2,
      width: 10,
      height: 6,
      rx: 2,
      fill,
      stroke,
      strokeWidth: 2.2,
      strokeDasharray: isAmber ? '3 2' : undefined,
    }),
    h('rect', {
      x: 27,
      y: 2,
      width: 10,
      height: 6,
      rx: 2,
      fill,
      stroke,
      strokeWidth: 2.2,
      strokeDasharray: isAmber ? '3 2' : undefined,
    }),
    h('rect', {
      x: 2,
      y: 7,
      width: 40,
      height: 25,
      rx: 6,
      fill,
      stroke,
      strokeWidth: 2.4,
      strokeDasharray: dash,
    }),
  )
}

function renderPainInput(h, { scene, localFrame, sceneDuration, fps, kit, isVertical, headingFont }) {
  const enter = spring({ frame: localFrame, fps, config: { damping: 17, stiffness: 120 } })
  const barEnter = spring({ frame: localFrame, fps, delay: 10, config: { damping: 16, stiffness: 115 } })
  const chars = Array.from(String(scene.typedQuery || ''))
  const typeWindow = Math.max(32, Math.min(105, Math.round(sceneDuration * 0.54)))
  const visibleChars = Math.floor(interpolate(localFrame, [16, 16 + typeWindow], [0, chars.length]))
  const typed = chars.slice(0, visibleChars).join('')
  const btnPress = localFrame > 20 + typeWindow
    ? 1 - 0.045 * Math.sin(clamp((localFrame - (20 + typeWindow)) / 12, 0, 1) * Math.PI)
    : 1
  const cursorOn = Math.floor(localFrame / 16) % 2 === 0

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1620,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 42 : 34,
    },
  },
    scene.eyebrow
      ? h('div', {
          style: {
            fontSize: isVertical ? 34 : 32,
            fontWeight: 500,
            color: kit.inkSecondary,
            opacity: enter,
            transform: `translateY(${(1 - enter) * 20}px)`,
          },
        }, scene.eyebrow)
      : null,
    h('h1', {
      style: {
        margin: 0,
        fontFamily: headingFont,
        fontSize: headlineFontSize(scene.headline, isVertical),
        fontWeight: 700,
        lineHeight: 1.18,
        letterSpacing: '-0.02em',
        color: kit.ink,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 28}px)`,
      },
    }, scene.headline),
    h('div', {
      style: {
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: isVertical ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: 28,
        padding: isVertical ? '38px 40px' : '30px 34px 30px 46px',
        background: kit.surface,
        border: `2px solid ${kit.border}`,
        borderRadius: isVertical ? 34 : 999,
        boxShadow: '0 22px 54px rgba(0, 0, 0, 0.07)',
        opacity: barEnter,
        transform: `translateY(${(1 - barEnter) * 26}px) scale(${0.97 + 0.03 * barEnter})`,
      },
    },
      h('div', {
        style: {
          fontSize: isVertical ? 42 : 40,
          lineHeight: 1.4,
          color: kit.ink,
          minHeight: 58,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        },
      },
        h('span', null, typed),
        h('span', {
          style: {
            display: 'inline-block',
            width: 4,
            height: 44,
            marginLeft: 6,
            background: kit.accent,
            opacity: cursorOn ? 1 : 0.15,
          },
        }),
      ),
      scene.ctaLabel
        ? h('div', {
            style: {
              background: kit.ink,
              color: kit.bg,
              padding: isVertical ? '24px 40px' : '22px 44px',
              borderRadius: 999,
              fontSize: isVertical ? 36 : 34,
              fontWeight: 600,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              transform: `scale(${btnPress})`,
            },
          }, scene.ctaLabel)
        : null,
    ),
  )
}

function renderScreenShot(h, {
  scene,
  localFrame,
  sceneDuration,
  fps,
  kit,
  isVertical,
  headingFont,
  storyboard,
  ImgComp,
  resolveAssetUrl,
  assetMeta,
}) {
  const enter = spring({ frame: localFrame, fps, config: { damping: 17, stiffness: 120 } })
  const winEnter = spring({ frame: localFrame, fps, delay: 6, config: { damping: 16, stiffness: 115 } })
  const pushScale = interpolate(localFrame, [0, Math.max(30, sceneDuration)], [1.0, 1.055])
  const geom = computeShotGeometry(storyboard, scene, assetMeta)
  const isImageSpace = scene.coordSpace === 'image' || Boolean(scene.view)

  const rawFocus = scene.focus || null
  const focus = rawFocus
    ? (isImageSpace ? shotImageRectToViewport(geom, rawFocus) : rawFocus)
    : null

  const rawCursor = scene.cursor || null
  const cursor = rawCursor
    ? {
        ...rawCursor,
        ...(isImageSpace ? shotImageToViewport(geom, rawCursor) : { x: rawCursor.x, y: rawCursor.y }),
      }
    : null

  const originX = focus
    ? `${clamp(Math.round((focus.x + focus.w / 2) * 100), 0, 100)}%`
    : (cursor ? `${clamp(Math.round(cursor.x * 100), 0, 100)}%` : '50%')
  const originY = focus
    ? `${clamp(Math.round((focus.y + focus.h / 2) * 100), 0, 100)}%`
    : (cursor ? `${clamp(Math.round(cursor.y * 100), 0, 100)}%` : '45%')

  const assetSrc = scene.asset ? resolveAssetUrl(scene.asset) : ''
  const focusIn = focus ? spring({ frame: localFrame, fps, delay: 18, config: { damping: 16, stiffness: 125 } }) : 0

  let cursorNode = null
  if (cursor) {
    const moveP = spring({ frame: localFrame, fps, delay: 10, config: { damping: 17, stiffness: 105 } })
    const fromX = Number.isFinite(Number(cursor.fromX)) ? Number(cursor.fromX) : 0.84
    const fromY = Number.isFinite(Number(cursor.fromY)) ? Number(cursor.fromY) : 0.86
    const cx = interpolate(moveP, [0, 1], [fromX, cursor.x])
    const cy = interpolate(moveP, [0, 1], [fromY, cursor.y])
    const clickFrame = Number.isFinite(Number(cursor.clickFrame)) ? Number(cursor.clickFrame) : 38
    const press = localFrame >= clickFrame && localFrame <= clickFrame + 10
      ? 1 - 0.16 * Math.sin(((localFrame - clickFrame) / 10) * Math.PI)
      : 1
    const rippleP = interpolate(localFrame, [clickFrame, clickFrame + 26], [0, 1])

    cursorNode = h('div', {
      style: {
        position: 'absolute',
        left: `${(cx * 100).toFixed(2)}%`,
        top: `${(cy * 100).toFixed(2)}%`,
        pointerEvents: 'none',
        zIndex: 4,
      },
    },
      localFrame >= clickFrame && rippleP < 1
        ? h('div', {
            style: {
              position: 'absolute',
              left: -34,
              top: -34,
              width: 68,
              height: 68,
              borderRadius: '50%',
              border: `4px solid ${kit.accent}`,
              opacity: (1 - rippleP) * 0.9,
              transform: `scale(${0.35 + rippleP * 1.9})`,
            },
          })
        : null,
      h('svg', {
        width: 46,
        height: 46,
        viewBox: '0 0 32 32',
        fill: 'none',
        style: {
          display: 'block',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.34))',
          transform: `translate(-4px, -3px) scale(${press})`,
        },
      },
        h('path', {
          d: 'M5 3.5L26.5 14.2L16.4 17.3L12.6 27.2L5 3.5Z',
          fill: '#FFFFFF',
          stroke: '#141413',
          strokeWidth: 2.2,
          strokeLinejoin: 'round',
        }),
      ),
    )
  }

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      maxWidth: isVertical ? 936 : 1680,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 26 : 20,
    },
  },
    h('div', {
      style: {
        opacity: enter,
        transform: `translateY(${(1 - enter) * 20}px)`,
      },
    },
      scene.eyebrow
        ? h('div', {
            style: {
              fontSize: 30,
              color: kit.inkSecondary,
              marginBottom: 10,
            },
          }, scene.eyebrow)
        : null,
      h('h2', {
        style: {
          margin: 0,
          fontFamily: headingFont,
          fontSize: headlineFontSize(scene.headline, isVertical, 0.78),
          fontWeight: 700,
          lineHeight: 1.2,
          color: kit.ink,
        },
      }, scene.headline),
    ),

    // Window Mockup Frame with deterministic viewport size so browser & headless Remotion match pixel-for-pixel
    h('div', {
      style: {
        width: geom.vp.w + 4,
        maxWidth: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 26,
        overflow: 'hidden',
        background: '#161615',
        border: `2px solid ${kit.border}`,
        boxShadow: '0 28px 68px rgba(0, 0, 0, 0.18)',
        opacity: winEnter,
        transform: `translateY(${(1 - winEnter) * 24}px) scale(${0.97 + 0.03 * winEnter})`,
      },
    },
      h('div', {
        style: {
          height: 48,
          padding: '0 22px',
          background: '#20201E',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        },
      },
        h('span', { style: { width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' } }),
        h('span', { style: { width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' } }),
        h('span', { style: { width: 12, height: 12, borderRadius: '50%', background: '#28C840' } }),
        h('span', {
          style: {
            marginLeft: 12,
            fontSize: 22,
            color: '#B5B3AA',
            fontFamily: SANS_STACK,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }, scene.windowTitle || storyboard?.productTag || storyboard?.title || ''),
      ),

      h('div', {
        'data-reel-shot-viewport': '1',
        style: {
          position: 'relative',
          width: geom.vp.w,
          height: geom.vp.h,
          flexShrink: 0,
          overflow: 'hidden',
          background: kit.surfaceSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
        assetSrc
          ? h('div', {
              style: {
                position: 'relative',
                width: '100%',
                height: '100%',
                transform: `scale(${pushScale})`,
                transformOrigin: `${originX} ${originY}`,
              },
            },
              h(ImgComp, {
                src: assetSrc,
                alt: scene.caption || scene.headline || '',
                style: {
                  position: 'absolute',
                  left: `${(geom.ox / geom.vp.w * 100).toFixed(4)}%`,
                  top: `${(geom.oy / geom.vp.h * 100).toFixed(4)}%`,
                  width: `${(geom.dw / geom.vp.w * 100).toFixed(4)}%`,
                  height: `${(geom.dh / geom.vp.h * 100).toFixed(4)}%`,
                  maxWidth: 'none',
                  display: 'block',
                },
              }),
              focus
                ? h('div', {
                    style: {
                      position: 'absolute',
                      left: `${(focus.x * 100).toFixed(2)}%`,
                      top: `${(focus.y * 100).toFixed(2)}%`,
                      width: `${(focus.w * 100).toFixed(2)}%`,
                      height: `${(focus.h * 100).toFixed(2)}%`,
                      borderRadius: 16,
                      border: `4px solid ${kit.accent}`,
                      boxShadow: `0 0 0 9999px rgba(12, 12, 13, ${(0.34 * focusIn).toFixed(3)})`,
                      opacity: focusIn,
                      pointerEvents: 'none',
                    },
                  })
                : null,
              cursorNode,
            )
          : h('div', {
              style: {
                padding: 40,
                textAlign: 'center',
                fontSize: 32,
                color: kit.inkSecondary,
              },
            }, '把真实界面截图贴进这里，或从工作区选一张'),
      ),
    ),

    scene.caption
      ? h('div', {
          style: {
            alignSelf: 'flex-start',
            padding: '12px 28px',
            borderRadius: 999,
            background: kit.surface,
            border: `1.5px solid ${kit.border}`,
            fontSize: 30,
            color: kit.inkSecondary,
            opacity: winEnter,
          },
        }, scene.caption)
      : null,
  )
}

function renderFunnelTicker(h, { scene, localFrame, fps, kit, isVertical, headingFont }) {
  const headEnter = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 120 } })
  const steps = scene.steps || []

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1660,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 38 : 30,
    },
  },
    h('div', null,
      scene.eyebrow
        ? h('div', {
            style: {
              fontSize: 32,
              color: kit.inkSecondary,
              marginBottom: 14,
              opacity: headEnter,
            },
          }, scene.eyebrow)
        : null,
      h('h2', {
        style: {
          margin: 0,
          fontFamily: headingFont,
          fontSize: headlineFontSize(scene.headline, isVertical, 0.88),
          fontWeight: 700,
          lineHeight: 1.2,
          color: kit.ink,
          opacity: headEnter,
          transform: `translateY(${(1 - headEnter) * 22}px)`,
        },
      }, scene.headline),
    ),
    h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: isVertical ? 'repeat(2, minmax(0, 1fr))' : `repeat(${Math.max(2, steps.length)}, minmax(0, 1fr))`,
        gap: 24,
      },
    },
      steps.map((st, idx) => {
        const delay = 8 + idx * 10
        const sp = spring({ frame: localFrame, fps, delay, config: { damping: 16, stiffness: 125 } })
        const roll = interpolate(localFrame, [delay, delay + 32], [0, 1])
        const shownNum = Math.round((Number(st.count) || 0) * roll).toLocaleString('en-US')
        const isLast = idx === steps.length - 1
        const isPenultimate = steps.length > 2 && idx === steps.length - 2
        return h('div', {
          key: idx,
          style: {
            padding: isVertical ? '38px 32px' : '38px 34px',
            borderRadius: 28,
            background: isLast ? kit.ink : kit.surface,
            color: isLast ? kit.bg : kit.ink,
            border: `2px solid ${isPenultimate ? kit.accent : kit.border}`,
            boxShadow: isLast ? '0 22px 48px rgba(0,0,0,0.14)' : '0 10px 28px rgba(0,0,0,0.03)',
            opacity: sp,
            transform: `translateY(${(1 - sp) * 28}px) scale(${0.95 + 0.05 * sp})`,
          },
        },
          h('div', {
            style: {
              fontFamily: MONO_STACK,
              fontSize: 24,
              letterSpacing: '0.05em',
              color: isLast ? kit.inkTertiary : isPenultimate ? kit.accent : kit.inkTertiary,
              marginBottom: 16,
            },
          }, pad2(idx + 1)),
          h('div', {
            style: {
              fontFamily: headingFont,
              fontSize: isVertical ? 90 : 94,
              fontWeight: 700,
              lineHeight: 1.04,
              color: isLast ? kit.bg : isPenultimate ? kit.accent : kit.ink,
              marginBottom: 16,
            },
          },
            shownNum,
            st.unit
              ? h('span', { style: { fontSize: 36, fontWeight: 500, marginLeft: 8, opacity: 0.82 } }, st.unit)
              : null,
          ),
          h('div', {
            style: {
              fontSize: 34,
              lineHeight: 1.35,
              color: isLast ? kit.bg : kit.inkSecondary,
              opacity: isLast ? 0.92 : 1,
            },
          }, st.title),
        )
      }),
    ),
    scene.excluded && scene.excluded.length
      ? h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            opacity: interpolate(localFrame, [34, 54], [0, 1]),
          },
        },
          scene.excludedLabel
            ? h('span', { style: { fontSize: 28, color: kit.inkSecondary, marginRight: 4 } }, scene.excludedLabel)
            : null,
          scene.excluded.map((item, i) => h('span', {
            key: i,
            style: {
              padding: '10px 22px',
              borderRadius: 999,
              border: `1.5px solid ${kit.border}`,
              background: kit.surface,
              fontSize: 28,
              color: kit.inkSecondary,
            },
          }, item)),
        )
      : null,
  )
}

function renderLegoSnap(h, { scene, localFrame, sceneDuration, fps, kit, isVertical, headingFont, glyph }) {
  const enter = spring({ frame: localFrame, fps, config: { damping: 17, stiffness: 118 } })
  const snapFrame = Math.round(sceneDuration * 0.48)
  const solvedProgress = spring({ frame: localFrame, fps, delay: snapFrame, config: { damping: 15, stiffness: 130 } })
  const tiltDeg = interpolate(solvedProgress, [0, 1], [-1.2, 0])
  const blocks = scene.blocks || []

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1660,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 32 : 26,
    },
  },
    h('div', null,
      scene.eyebrow
        ? h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 30,
              color: kit.inkSecondary,
              marginBottom: 14,
              opacity: enter,
            },
          },
            renderBrandGlyph(h, { glyph, status: 'ready', kit, size: 32 }),
            h('span', null, scene.eyebrow),
          )
        : null,
      h('h2', {
        style: {
          margin: 0,
          fontFamily: headingFont,
          fontSize: headlineFontSize(scene.headline, isVertical, 0.88),
          fontWeight: 700,
          lineHeight: 1.2,
          color: kit.ink,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 22}px)`,
        },
      }, scene.headline),
    ),
    h('div', {
      style: {
        padding: isVertical ? 34 : 38,
        borderRadius: 32,
        background: kit.surface,
        border: `2px solid ${kit.border}`,
        boxShadow: '0 24px 56px rgba(0, 0, 0, 0.06)',
        transform: `perspective(1200px) rotateX(${(1 - solvedProgress) * 2.5}deg) rotateZ(${tiltDeg}deg)`,
      },
    },
      h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: isVertical ? 'minmax(0, 1fr)' : `repeat(${Math.max(1, blocks.length)}, minmax(0, 1fr))`,
          gap: 24,
        },
      },
        blocks.map((blk, idx) => {
          const cardIn = spring({ frame: localFrame, fps, delay: 10 + idx * 12, config: { damping: 15, stiffness: 115 } })
          const morphing = blk.status === 'gap-to-solved'
          const isSolvedNow = blk.status === 'solved' || (morphing && solvedProgress > 0.55)
          const glyphStatus = isSolvedNow ? 'solved' : (morphing ? 'gap' : 'ready')
          const borderCol = isSolvedNow ? kit.emerald : (morphing ? kit.amber : kit.accent)
          const bgCol = isSolvedNow ? kit.emeraldTint : (morphing ? kit.amberTint : kit.accentTint)
          const badgeText = isSolvedNow && morphing
            ? (blk.solvedTag || blk.tag || '')
            : (blk.tag || '')
          const cardGlyph = glyph && glyph !== 'none' ? glyph : 'plugin'

          return h('div', {
            key: idx,
            style: {
              padding: isVertical ? '30px 32px' : '32px 30px',
              borderRadius: 24,
              background: bgCol,
              border: `2.5px ${morphing && !isSolvedNow ? 'dashed' : 'solid'} ${borderCol}`,
              opacity: cardIn,
              transform: `translateX(${(1 - cardIn) * (idx === blocks.length - 1 ? 44 : 20)}px) scale(${0.95 + 0.05 * cardIn})`,
            },
          },
            h('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 20,
              },
            },
              renderBrandGlyph(h, { glyph: cardGlyph, status: glyphStatus, kit, size: 40 }),
              badgeText
                ? h('span', {
                    style: {
                      padding: '6px 18px',
                      borderRadius: 999,
                      background: kit.surface,
                      border: `1.5px solid ${borderCol}`,
                      color: borderCol,
                      fontSize: 24,
                      fontWeight: 600,
                    },
                  }, badgeText)
                : null,
            ),
            h('div', {
              style: {
                fontSize: isVertical ? 40 : 38,
                fontWeight: 700,
                lineHeight: 1.25,
                color: kit.ink,
                marginBottom: 12,
              },
            }, blk.name),
            h('div', {
              style: {
                fontSize: isVertical ? 32 : 30,
                lineHeight: 1.42,
                color: kit.inkSecondary,
              },
            }, blk.role),
          )
        }),
      ),
      (scene.footnote || scene.ctaLabel)
        ? h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              marginTop: 26,
              paddingTop: 22,
              borderTop: `1.5px solid ${kit.border}`,
            },
          },
            h('span', { style: { fontSize: 28, color: kit.inkSecondary } }, scene.footnote || ''),
            scene.ctaLabel
              ? h('span', {
                  style: {
                    background: kit.ink,
                    color: kit.bg,
                    padding: '14px 34px',
                    borderRadius: 999,
                    fontSize: 28,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  },
                }, scene.ctaLabel)
              : null,
          )
        : null,
    ),
  )
}

function renderDualShowcase(h, { scene, localFrame, sceneDuration, fps, kit, isVertical, headingFont, glyph }) {
  const lightIn = spring({ frame: localFrame, fps, delay: 4, config: { damping: 16, stiffness: 112 } })
  const darkIn = spring({ frame: localFrame, fps, delay: 18, config: { damping: 16, stiffness: 112 } })
  const drift = interpolate(localFrame, [0, sceneDuration], [0, 14])
  const brickCount = Number(scene.lightBrickCount) || 0
  const activeGlyph = glyph && glyph !== 'none' ? glyph : null
  const bricks = []
  if (activeGlyph && brickCount > 0) {
    for (let i = 0; i < brickCount; i++) {
      const st = i === brickCount - 1 ? 'gap' : (i % 4 === 0 ? 'solved' : 'ready')
      bricks.push(renderBrandGlyph(h, { glyph: activeGlyph, status: st, kit, size: 36 }))
    }
  }

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1660,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 32 : 24,
    },
  },
    scene.eyebrow
      ? h('div', { style: { fontSize: 30, color: kit.inkSecondary } }, scene.eyebrow)
      : null,
    h('div', {
      style: {
        padding: isVertical ? '38px 40px' : '36px 44px',
        borderRadius: 28,
        background: '#FFFFFF',
        color: '#141413',
        border: '2px solid rgba(20, 20, 19, 0.12)',
        boxShadow: '0 22px 50px rgba(0, 0, 0, 0.06)',
        width: isVertical ? '100%' : '68%',
        opacity: lightIn,
        transform: `translate(${(1 - lightIn) * -36 + drift * 0.4}px, ${(1 - lightIn) * 20}px) rotate(-0.5deg)`,
      },
    },
      scene.lightCardTitle
        ? h('div', { style: { fontSize: 28, color: '#6E6D66', marginBottom: 10 } }, scene.lightCardTitle)
        : null,
      h('div', {
        style: {
          fontFamily: headingFont,
          fontSize: isVertical ? 52 : 54,
          fontWeight: 700,
          lineHeight: 1.24,
          marginBottom: (scene.lightCardSub || bricks.length) ? 16 : 0,
        },
      }, scene.headline),
      scene.lightCardSub
        ? h('div', {
            style: {
              fontSize: 30,
              color: '#575650',
              lineHeight: 1.4,
              marginBottom: bricks.length ? 18 : 0,
            },
          }, scene.lightCardSub)
        : null,
      bricks.length
        ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } },
            bricks.map((b, idx) => h('span', { key: idx }, b)),
          )
        : null,
    ),
    h('div', {
      style: {
        alignSelf: isVertical ? 'stretch' : 'flex-end',
        padding: isVertical ? '38px 40px' : '38px 46px',
        borderRadius: 28,
        background: '#161615',
        color: '#F5F4EF',
        border: '2px solid rgba(245, 244, 239, 0.16)',
        boxShadow: '0 28px 64px rgba(0, 0, 0, 0.28)',
        width: isVertical ? '100%' : '64%',
        opacity: darkIn,
        transform: `translate(${(1 - darkIn) * 40 - drift * 0.5}px, ${(1 - darkIn) * 24}px) rotate(0.5deg)`,
      },
    },
      (scene.darkCardEyebrow || scene.darkCardBadge)
        ? h('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
              fontSize: 26,
            },
          },
            h('span', { style: { color: '#A5A39A' } }, scene.darkCardEyebrow || ''),
            scene.darkCardBadge
              ? h('span', { style: { fontFamily: MONO_STACK, color: '#4ADE80' } }, scene.darkCardBadge)
              : null,
          )
        : null,
      h('div', {
        style: {
          fontFamily: headingFont,
          fontSize: isVertical ? 44 : 46,
          fontWeight: 700,
          lineHeight: 1.3,
          marginBottom: (scene.ctaPrimary || scene.ctaSecondary) ? 26 : 0,
        },
      }, scene.darkCardTitle),
      (scene.ctaPrimary || scene.ctaSecondary)
        ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 16 } },
            scene.ctaPrimary
              ? h('span', {
                  style: {
                    background: '#F5F4EF',
                    color: '#161615',
                    padding: '14px 32px',
                    borderRadius: 999,
                    fontSize: 28,
                    fontWeight: 600,
                  },
                }, scene.ctaPrimary)
              : null,
            scene.ctaSecondary
              ? h('span', {
                  style: {
                    border: '1.5px solid rgba(245,244,239,0.32)',
                    color: '#D5D3CA',
                    padding: '14px 30px',
                    borderRadius: 999,
                    fontSize: 28,
                  },
                }, scene.ctaSecondary)
              : null,
          )
        : null,
    ),
  )
}

function renderCodeDiff(h, { scene, localFrame, fps, kit, isVertical, headingFont }) {
  const enter = spring({ frame: localFrame, fps, config: { damping: 17, stiffness: 120 } })
  const lines = scene.codeLines || []

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1620,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 34 : 24,
    },
  },
    h('div', null,
      scene.eyebrow
        ? h('div', { style: { fontSize: 32, color: kit.inkSecondary, marginBottom: 14, opacity: enter } }, scene.eyebrow)
        : null,
      h('h2', {
        style: {
          margin: 0,
          fontFamily: headingFont,
          fontSize: headlineFontSize(scene.headline, isVertical, 0.88),
          fontWeight: 700,
          lineHeight: 1.2,
          color: kit.ink,
          opacity: enter,
        },
      }, scene.headline),
    ),
    scene.beforeLabel
      ? h('div', {
          style: {
            alignSelf: 'flex-start',
            padding: '12px 26px',
            borderRadius: 999,
            background: kit.amberTint,
            border: `1.5px dashed ${kit.amber}`,
            color: kit.amber,
            fontSize: 28,
            fontWeight: 500,
          },
        }, scene.beforeLabel)
      : null,
    h('div', {
      style: {
        padding: isVertical ? '38px 34px' : '40px 46px',
        borderRadius: 28,
        background: '#161615',
        color: '#F5F4EF',
        border: '2px solid rgba(245, 244, 239, 0.14)',
        boxShadow: '0 26px 60px rgba(0, 0, 0, 0.24)',
      },
    },
      (scene.fileLabel || scene.badge)
        ? h('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              paddingBottom: 20,
              marginBottom: 24,
              borderBottom: '1px solid rgba(245, 244, 239, 0.12)',
              fontFamily: MONO_STACK,
              fontSize: 26,
              color: '#A19F96',
            },
          },
            h('span', null, scene.fileLabel || ''),
            scene.badge ? h('span', { style: { color: '#4ADE80' } }, scene.badge) : null,
          )
        : null,
      lines.map((line, idx) => {
        const sp = spring({ frame: localFrame, fps, delay: 12 + idx * 12, config: { damping: 16, stiffness: 125 } })
        return h('div', {
          key: idx,
          style: {
            fontFamily: MONO_STACK,
            fontSize: isVertical ? 32 : 34,
            lineHeight: 1.6,
            padding: '12px 20px',
            marginBottom: idx === lines.length - 1 ? 0 : 12,
            borderRadius: 14,
            background: idx === lines.length - 1 ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            borderLeft: `4px solid ${idx === lines.length - 1 ? '#4ADE80' : '#60A5FA'}`,
            opacity: sp,
            transform: `translateX(${(1 - sp) * 26}px)`,
            wordBreak: 'break-word',
          },
        }, line)
      }),
    ),
  )
}

function renderQuoteKinetic(h, { scene, localFrame, fps, kit, isVertical, headingFont }) {
  const headIn = spring({ frame: localFrame, fps, config: { damping: 17, stiffness: 120 } })
  const lines = scene.lines || []

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: isVertical ? 'space-between' : 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1580,
      margin: '0 auto',
      width: '100%',
      padding: isVertical ? '56px 0' : 0,
      gap: isVertical ? 44 : 36,
    },
  },
    h('div', null,
      scene.eyebrow
        ? h('div', {
            style: {
              fontSize: isVertical ? 36 : 32,
              color: kit.accent,
              fontWeight: 600,
              marginBottom: 20,
              opacity: headIn,
            },
          }, scene.eyebrow)
        : null,
      h('h1', {
        style: {
          margin: 0,
          fontFamily: headingFont,
          fontSize: headlineFontSize(scene.headline, isVertical),
          fontWeight: 700,
          lineHeight: 1.2,
          color: kit.ink,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * 24}px)`,
        },
      }, scene.headline),
    ),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: isVertical ? 28 : 22 } },
      lines.map((line, idx) => {
        const sp = spring({ frame: localFrame, fps, delay: 14 + idx * 13, config: { damping: 15, stiffness: 125 } })
        return h('div', {
          key: idx,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: isVertical ? '34px 36px' : '28px 36px',
            borderRadius: 24,
            background: kit.surface,
            border: `2px solid ${idx === lines.length - 1 ? kit.accent : kit.border}`,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.04)',
            fontSize: isVertical ? 46 : 42,
            fontWeight: 600,
            lineHeight: 1.32,
            color: kit.ink,
            opacity: sp,
            transform: `translateY(${(1 - sp) * 26}px) scale(${0.96 + 0.04 * sp})`,
          },
        },
          h('span', {
            style: {
              fontFamily: MONO_STACK,
              fontSize: 28,
              color: kit.accent,
              padding: '6px 16px',
              borderRadius: 999,
              background: kit.accentTint,
              flexShrink: 0,
            },
          }, pad2(idx + 1)),
          h('span', null, line),
        )
      }),
    ),
    scene.footnote
      ? h('div', {
          style: {
            fontFamily: SANS_STACK,
            fontSize: 30,
            color: kit.inkTertiary,
          },
        }, scene.footnote)
      : h('div', null),
  )
}

function renderEndCta(h, { scene, localFrame, fps, kit, isVertical, headingFont, glyph }) {
  const enter = spring({ frame: localFrame, fps, config: { damping: 16, stiffness: 115 } })
  const ctaEnter = spring({ frame: localFrame, fps, delay: 14, config: { damping: 14, stiffness: 125 } })

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      height: '100%',
      maxWidth: isVertical ? 940 : 1560,
      margin: '0 auto',
      width: '100%',
      gap: isVertical ? 44 : 36,
    },
  },
    scene.badge
      ? h('div', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 32px',
            borderRadius: 999,
            background: kit.surface,
            border: `1.5px solid ${kit.border}`,
            fontSize: 32,
            color: kit.inkSecondary,
            opacity: enter,
            transform: `translateY(${(1 - enter) * 18}px)`,
          },
        },
          renderBrandGlyph(h, { glyph, status: 'solved', kit, size: 34 }),
          h('span', null, scene.badge),
        )
      : null,
    h('h1', {
      style: {
        margin: 0,
        fontFamily: headingFont,
        fontSize: headlineFontSize(scene.headline, isVertical),
        fontWeight: 700,
        lineHeight: 1.22,
        color: kit.ink,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 24}px)`,
      },
    }, scene.headline),
    scene.ctaLabel
      ? h('div', {
          style: {
            background: kit.ink,
            color: kit.bg,
            padding: isVertical ? '30px 66px' : '26px 64px',
            borderRadius: 999,
            fontSize: isVertical ? 40 : 38,
            fontWeight: 600,
            boxShadow: '0 22px 48px rgba(0, 0, 0, 0.18)',
            opacity: ctaEnter,
            transform: `scale(${0.92 + 0.08 * ctaEnter})`,
          },
        }, scene.ctaLabel)
      : null,
    scene.subline
      ? h('div', {
          style: {
            fontFamily: MONO_STACK,
            fontSize: 26,
            color: kit.inkTertiary,
            opacity: ctaEnter,
          },
        }, scene.subline)
      : null,
  )
}

export function renderStoryboardFrame(
  React,
  {
    frame = 0,
    fps = 60,
    storyboard,
    brandKit,
    Img,
    resolveAsset,
    assetMeta,
    showHud: forceShowHud,
  } = {},
) {
  const h = React.createElement
  const kit = brandKit || {
    bg: '#FAF9F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#F3F1EA',
    ink: '#141413',
    inkSecondary: '#575650',
    inkTertiary: '#8A8880',
    accent: '#2563EB',
    accentTint: '#EFF5FF',
    amber: '#D97706',
    amberTint: '#FFF9EB',
    emerald: '#15803D',
    emeraldTint: '#ECFDF3',
    gridLine: 'rgba(20, 20, 19, 0.045)',
    border: 'rgba(20, 20, 19, 0.12)',
    serifHeadings: true,
    glyph: 'none',
  }

  const width = storyboard?.width || 1920
  const height = storyboard?.height || 1080
  const isVertical = height > width
  const effectiveFps = storyboard?.fps || fps
  const headingFont = kit.serifHeadings !== false ? SERIF_STACK : SANS_STACK
  const glyph = storyboard?.glyph || kit.glyph || 'none'
  const showHud = forceShowHud !== undefined ? Boolean(forceShowHud) : Boolean(storyboard?.showHud)
  const ImgComp = Img || 'img'
  const resolveAssetUrl = typeof resolveAsset === 'function' ? resolveAsset : (name => name)

  const { scene, index, localFrame, sceneDuration, totalFrames } = resolveActiveScene(storyboard, frame)
  const sceneCount = storyboard?.scenes?.length || 1
  const progressRatio = clamp((frame + 1) / Math.max(1, totalFrames), 0, 1)
  const timeSec = (frame / effectiveFps).toFixed(2).padStart(5, '0')

  // Smooth editorial exit glide on the last ~12 frames of every non-final scene (no hard slide cuts!)
  const isFinalScene = index >= sceneCount - 1
  const exitFrames = Math.min(14, Math.max(8, Math.round(effectiveFps * 0.2)))
  const exitStart = Math.max(12, sceneDuration - exitFrames)
  const exitRaw = !isFinalScene
    ? interpolate(localFrame, [exitStart, Math.max(exitStart + 1, sceneDuration - 1)], [0, 1])
    : 0
  const exitEase = exitRaw * exitRaw
  const contentOpacity = 1 - exitEase * 0.94
  const contentTranslateY = -exitEase * 28
  const contentScale = 1 - exitEase * 0.018

  let bodyNode = null
  if (scene) {
    const ctx = {
      scene,
      localFrame,
      sceneDuration,
      fps: effectiveFps,
      kit,
      isVertical,
      headingFont,
      glyph,
      storyboard,
      ImgComp,
      resolveAssetUrl,
      assetMeta,
    }
    switch (scene.kind) {
      case 'pain-input':
        bodyNode = renderPainInput(h, ctx)
        break
      case 'screen-shot':
        bodyNode = renderScreenShot(h, ctx)
        break
      case 'funnel-ticker':
        bodyNode = renderFunnelTicker(h, ctx)
        break
      case 'lego-snap':
        bodyNode = renderLegoSnap(h, ctx)
        break
      case 'dual-showcase':
        bodyNode = renderDualShowcase(h, ctx)
        break
      case 'code-diff':
        bodyNode = renderCodeDiff(h, ctx)
        break
      case 'quote-kinetic':
        bodyNode = renderQuoteKinetic(h, ctx)
        break
      case 'end-cta':
      default:
        bodyNode = renderEndCta(h, ctx)
        break
    }
  }

  return h('div', {
    style: {
      position: 'relative',
      width,
      height,
      overflow: 'hidden',
      backgroundColor: kit.bg,
      backgroundImage: `linear-gradient(to right, ${kit.gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${kit.gridLine} 1px, transparent 1px)`,
      backgroundSize: '96px 96px',
      color: kit.ink,
      fontFamily: SANS_STACK,
      boxSizing: 'border-box',
      padding: isVertical ? '96px 72px 104px' : '64px 96px 68px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      WebkitFontSmoothing: 'antialiased',
      userSelect: 'none',
    },
  },
    // Top bar: either full timing HUD (when user turns it on for editing) or clean optional productTag
    showHud
      ? h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            color: kit.inkSecondary,
            zIndex: 2,
            marginBottom: 16,
          },
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
            h('span', {
              style: {
                fontFamily: MONO_STACK,
                fontSize: 22,
                padding: '5px 16px',
                borderRadius: 999,
                border: `1.5px solid ${kit.border}`,
                background: kit.surface,
              },
            }, `${pad2(index + 1)} / ${pad2(sceneCount)}`),
            h('span', { style: { fontWeight: 600, color: kit.ink } }, scene?.label || ''),
          ),
          h('div', {
            style: {
              fontFamily: MONO_STACK,
              fontSize: 22,
              color: kit.inkTertiary,
            },
          }, `${storyboard?.productTag ? `${storyboard.productTag} · ` : ''}${timeSec}s · ${effectiveFps}fps`),
        )
      : (storyboard?.productTag && scene?.kind !== 'end-cta'
          ? h('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                fontSize: 26,
                fontWeight: 500,
                color: kit.inkTertiary,
                zIndex: 2,
                marginBottom: 8,
              },
            },
              renderBrandGlyph(h, { glyph, status: 'ready', kit, size: 26 }),
              h('span', null, storyboard.productTag),
            )
          : null),

    // Scene center stage with unified smooth exit envelope
    h('div', {
      style: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        opacity: contentOpacity,
        transform: `translateY(${contentTranslateY.toFixed(2)}px) scale(${contentScale.toFixed(4)})`,
      },
    }, bodyNode),

    // Bottom deterministic progress hairline (only when HUD is enabled)
    showHud
      ? h('div', {
          style: {
            position: 'relative',
            width: '100%',
            height: 4,
            background: kit.border,
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 16,
          },
        },
          h('div', {
            style: {
              width: `${(progressRatio * 100).toFixed(2)}%`,
              height: '100%',
              background: kit.ink,
            },
          }),
        )
      : null,
  )
}
