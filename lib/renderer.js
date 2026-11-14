// Local Remotion 4 MP4 / GIF / Keyframe Renderer for DSH Reel Desk (`制片台`).
//
// Flow v3 guarantees:
//   - Freezes storyboard + version + `assetMeta` at `start_render` time so concurrent edits never mutate in-flight jobs.
//   - Supports `quality: 'full' | 'draft'` (draft = 0.5x scale + 30fps) and `format: 'mp4' | 'gif'` (`codec: 'gif'`).
//   - Writes to `.tmp-*` first and cleans up on cancel/error so partial files never pollute `renders/`.
//   - Exposes `preflight` (`runtimeReady` + `chrome`) and structured `errorDetail` + `logTail` + `elapsedMs`.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { computeTimeline } from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHARED_CORE_SRC = path.resolve(__dirname, '..', 'shared', 'composition-core.js')

const INSTALL_TIMEOUT_MS = 180_000
const RENDER_TIMEOUT_MS = 240_000

const MAC_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

const DSH_BUNDLED_NODE = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node'
const DSH_BUNDLED_PNPM = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs'

export function resolveRuntimeDir(storeRootDir) {
  const explicit = process.env.REEL_DESK_REMOTION_RUNTIME
  if (explicit && String(explicit).trim()) {
    return path.resolve(String(explicit).trim())
  }
  return path.join(storeRootDir, 'runtime')
}

function hasRemotionInstalled(dir) {
  return (
    Boolean(dir) &&
    fs.existsSync(path.join(dir, 'node_modules', '@remotion', 'bundler', 'package.json')) &&
    fs.existsSync(path.join(dir, 'node_modules', '@remotion', 'renderer', 'package.json')) &&
    fs.existsSync(path.join(dir, 'node_modules', 'remotion', 'package.json'))
  )
}

function findCachedHeadlessShell(runtimeDir) {
  if (!runtimeDir) return null
  const remotionCache = path.join(runtimeDir, 'node_modules', '.remotion')
  if (!fs.existsSync(remotionCache)) return null
  try {
    const stack = [remotionCache]
    while (stack.length) {
      const cur = stack.pop()
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile() && (entry.name === 'chrome-headless-shell' || entry.name === 'Chromium')) {
          return full
        }
      }
    }
  } catch {
    // ignore scan errors
  }
  return null
}

export function detectBrowserInfo(runtimeDir) {
  const explicit = process.env.REEL_DESK_CHROME_EXECUTABLE
  if (explicit !== undefined && String(explicit).trim() !== '') {
    const trimmed = String(explicit).trim()
    if (fs.existsSync(trimmed)) {
      return {
        ready: true,
        executable: trimmed,
        source: 'env',
        reason: null,
      }
    }
    return {
      ready: false,
      executable: null,
      source: 'env-missing',
      reason: `这台电脑上没找到 Chrome 或 Edge（未找到指定的浏览器可执行文件：${trimmed}）`,
    }
  }

  const headlessShell = findCachedHeadlessShell(runtimeDir)
  if (headlessShell) {
    return {
      ready: true,
      executable: headlessShell,
      source: 'headless-shell',
      reason: null,
    }
  }

  for (const candidate of MAC_BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return {
        ready: true,
        executable: candidate,
        source: 'system-browser',
        reason: null,
      }
    }
  }

  return {
    ready: false,
    executable: null,
    source: 'missing',
    reason: '这台电脑上没找到 Chrome 或 Edge',
  }
}

export function detectBrowserExecutable(runtimeDir) {
  return detectBrowserInfo(runtimeDir).executable
}

export function detectNodeAndInstaller() {
  const nodeCandidates = [
    process.env.REEL_DESK_NODE_BIN,
    !process.versions.electron ? process.execPath : null,
    DSH_BUNDLED_NODE,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
  ].filter(Boolean)

  let nodeBin = null
  for (const c of nodeCandidates) {
    if (c && fs.existsSync(c)) {
      nodeBin = c
      break
    }
  }

  const pnpmCjs = fs.existsSync(DSH_BUNDLED_PNPM) ? DSH_BUNDLED_PNPM : null
  return {
    nodeBin: nodeBin || process.execPath,
    useElectronAsNode: !nodeBin && Boolean(process.versions.electron),
    pnpmCjs,
  }
}

export function detectWechatCli() {
  const explicit = process.env.REEL_DESK_WECHAT_CLI
  if (explicit !== undefined && String(explicit).trim() !== '') {
    const trimmed = String(explicit).trim()
    return fs.existsSync(trimmed) ? trimmed : null
  }
  const defaultPath = path.join(os.homedir(), 'bin', 'dsh-wechat.mjs')
  return fs.existsSync(defaultPath) ? defaultPath : null
}

function classifyRenderError(err) {
  const msg = String(err?.message || err || '导出失败')
  if (/Chrome|Edge|浏览器可执行文件/i.test(msg)) {
    return {
      code: 'CHROME_NOT_FOUND',
      title: '导出没成功：这台电脑上没找到 Chrome 或 Edge',
      hint: '合成画面要借用其中一个浏览器。装好以后点「再试一次」；分镜没有任何改动。',
    }
  }
  if (/初始化 Remotion|registry|ENOTFOUND|ECONN|network/i.test(msg)) {
    return {
      code: 'BOOTSTRAP_FAILED',
      title: '导出没成功：首次准备合成组件时网络未连通',
      hint: '请检查网络后点「再试一次」；一旦下载完成，后续导出不再需要联网。',
    }
  }
  if (/超过.*秒未响应|TIMEOUT/i.test(msg)) {
    return {
      code: 'RENDER_TIMEOUT',
      title: '导出没成功：合成画面超时',
      hint: '可以先选「草稿」规格快速导出，或稍后再试；分镜没有任何改动。',
    }
  }
  return {
    code: 'RENDER_FAILED',
    title: `导出没成功：${msg.slice(0, 72)}`,
    hint: '分镜没有任何改动，可展开日志查看原因后再试一次。',
  }
}

function spawnChecked(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let killTimer = null

    const finish = (err, val) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (killTimer) clearTimeout(killTimer)
      if (err) reject(err)
      else resolve(val)
    }

    const timeoutMs = Number(options.timeoutMs) || 0
    const timeoutId = timeoutMs > 0
      ? setTimeout(() => {
          try { child.kill('SIGTERM') } catch { /* ignore */ }
          killTimer = setTimeout(() => {
            try { child.kill('SIGKILL') } catch { /* ignore */ }
          }, 2000)
          const err = new Error(`渲染子进程超过 ${(timeoutMs / 1000).toFixed(0)} 秒未响应，已自动中止`)
          err.logTail = (stderr || stdout).trim().slice(-1500)
          finish(err)
        }, timeoutMs)
      : null

    child.stdout?.on('data', chunk => {
      const s = chunk.toString()
      stdout += s
      if (stdout.length > 32_000) stdout = stdout.slice(-24_000)
      options.onLine?.(s)
    })
    child.stderr?.on('data', chunk => {
      const s = chunk.toString()
      stderr += s
      if (stderr.length > 32_000) stderr = stderr.slice(-24_000)
      options.onLine?.(s)
    })

    if (options.signal) {
      if (options.signal.aborted) {
        try { child.kill('SIGTERM') } catch { /* ignore */ }
        const abortErr = new Error('已取消导出')
        abortErr.code = 'RENDER_CANCELLED'
        finish(abortErr)
        return
      }
      options.signal.addEventListener('abort', () => {
        try { child.kill('SIGTERM') } catch { /* ignore */ }
        killTimer = setTimeout(() => {
          try { child.kill('SIGKILL') } catch { /* ignore */ }
        }, 1500)
        const abortErr = new Error('已取消导出')
        abortErr.code = 'RENDER_CANCELLED'
        finish(abortErr)
      }, { once: true })
    }

    child.on('error', err => finish(err))
    child.on('close', code => {
      if (code === 0) {
        finish(null, { stdout, stderr })
      } else {
        const tail = (stderr || stdout).trim().slice(-1200)
        const err = new Error(`渲染子进程退出码 ${code}${tail ? `：${tail.split('\n').slice(-3).join(' ')}` : ''}`)
        err.logTail = tail
        finish(err)
      }
    })
  })
}

function hashBundleSignature(projectAssetDir) {
  const h = crypto.createHash('sha256')
  h.update('v3-gif-shotgeom:')
  h.update(fs.readFileSync(SHARED_CORE_SRC))
  if (projectAssetDir && fs.existsSync(projectAssetDir)) {
    const files = fs.readdirSync(projectAssetDir).filter(f => !f.startsWith('.')).sort()
    for (const f of files) {
      const st = fs.statSync(path.join(projectAssetDir, f))
      if (st.isFile()) {
        h.update(`${f}:${st.size}:${Math.floor(st.mtimeMs)};`)
      }
    }
  }
  return h.digest('hex').slice(0, 14)
}

function prepareStoryboardForQuality(rawStoryboard, quality) {
  const sb = structuredClone(rawStoryboard)
  if (quality !== 'draft') return sb
  const draftFps = 30
  sb.fps = draftFps
  sb.scenes = (sb.scenes || []).map(sc => {
    const sec = Number(sc.durationSec) > 0
      ? Number(sc.durationSec)
      : Math.max(1.5, (Number(sc.durationInFrames) || 90) / (rawStoryboard.fps || 60))
    return {
      ...sc,
      durationSec: sec,
      durationInFrames: Math.max(1, Math.round(sec * draftFps)),
    }
  })
  return sb
}

export function createReelRenderer({ store, log = () => {} }) {
  let activeJob = null
  const activeAbortControllers = new Set()
  const jobWaiters = new Map() // jobId -> Set<resolve>

  function notifyJobSettled(job) {
    if (!job?.id) return
    const set = jobWaiters.get(job.id)
    if (!set) return
    jobWaiters.delete(job.id)
    for (const fn of set) {
      try { fn(job) } catch { /* ignore */ }
    }
  }

  function getStatus() {
    const runtimeDir = resolveRuntimeDir(store.rootDir)
    const runtimeReady = hasRemotionInstalled(runtimeDir)
    const browserInfo = detectBrowserInfo(runtimeDir)
    const platformSupported = process.platform === 'darwin' || process.env.REEL_DESK_ALLOW_NON_DARWIN === '1'
    const wechatCli = detectWechatCli()
    return {
      platform: process.platform,
      platformSupported,
      runtimeReady,
      runtimeDir,
      browserReady: browserInfo.ready,
      browserSource: browserInfo.source,
      browserExecutable: browserInfo.executable,
      browserReason: browserInfo.reason,
      preflight: {
        runtimeReady,
        chrome: {
          found: browserInfo.ready,
          path: browserInfo.executable,
          source: browserInfo.source,
          reason: browserInfo.reason,
        },
      },
      canRevealInFinder: process.platform === 'darwin' && fs.existsSync('/usr/bin/open'),
      canSendWechat: Boolean(wechatCli),
      activeJob: activeJob ? { ...activeJob } : null,
    }
  }

  async function ensureRemotionRuntime({ onProgress, signal } = {}) {
    const runtimeDir = resolveRuntimeDir(store.rootDir)
    if (hasRemotionInstalled(runtimeDir)) return runtimeDir

    fs.mkdirSync(runtimeDir, { recursive: true })
    const pkgPath = path.join(runtimeDir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(pkgPath, JSON.stringify({
        name: 'dsh-reel-desk-remotion-runtime',
        private: true,
        type: 'module',
        dependencies: {
          remotion: '4.0.286',
          '@remotion/bundler': '4.0.286',
          '@remotion/renderer': '4.0.286',
          react: '18.3.1',
          'react-dom': '18.3.1',
        },
        pnpm: {
          onlyBuiltDependencies: ['esbuild'],
        },
      }, null, 2) + '\n', 'utf8')
    }
    const pnpmWsPath = path.join(runtimeDir, 'pnpm-workspace.yaml')
    if (!fs.existsSync(pnpmWsPath)) {
      fs.writeFileSync(pnpmWsPath, 'allowBuilds:\n  esbuild: true\n', 'utf8')
    }

    const { nodeBin, useElectronAsNode, pnpmCjs } = detectNodeAndInstaller()
    const baseEnv = {
      ...process.env,
      ...(useElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      PATH: `${path.dirname(nodeBin)}:${process.env.PATH || '/usr/bin:/bin'}`,
    }

    const registries = [
      process.env.REEL_DESK_NPM_REGISTRY,
      'https://registry.npmjs.org',
      'https://registry.npmmirror.com',
    ].filter(Boolean)

    onProgress?.({
      stage: 'bootstrapping',
      percent: 5,
      message: '首次导出：正在准备本机 Remotion 4 合成环境（仅首次需要联网下载）…',
    })

    let lastErr = null
    for (const reg of registries) {
      try {
        if (pnpmCjs) {
          await spawnChecked(
            nodeBin,
            [
              pnpmCjs,
              'install',
              '--prod',
              `--registry=${reg}`,
              `--store-dir=${path.join(store.rootDir, 'pnpm-store')}`,
            ],
            { cwd: runtimeDir, env: baseEnv, signal, timeoutMs: INSTALL_TIMEOUT_MS },
          )
        } else {
          await spawnChecked(
            'npm',
            ['install', '--omit=dev', `--registry=${reg}`],
            { cwd: runtimeDir, env: baseEnv, signal, timeoutMs: INSTALL_TIMEOUT_MS },
          )
        }
        if (hasRemotionInstalled(runtimeDir)) {
          log(`Remotion runtime initialized at ${runtimeDir} via ${reg}`)
          return runtimeDir
        }
      } catch (err) {
        if (err?.code === 'RENDER_CANCELLED') throw err
        lastErr = err
        log(`Remotion install attempt via ${reg} failed: ${err.message}`)
      }
    }

    const finalErr = new Error(`无法初始化 Remotion 渲染组件：${lastErr ? lastErr.message : '网络不可达'}`)
    finalErr.logTail = lastErr?.logTail || lastErr?.message || ''
    throw finalErr
  }

  function prepareRenderWorkspace(runtimeDir, projectId, storyboard) {
    const assetDir = store.getAssetDir(projectId)
    const sig = hashBundleSignature(assetDir)
    const jobWorkDir = path.join(runtimeDir, '.job-entry', sig)
    const bundleCacheDir = path.join(runtimeDir, '.bundle-cache', sig)
    const publicAssetsDir = path.join(jobWorkDir, 'public', 'assets')

    fs.mkdirSync(publicAssetsDir, { recursive: true })
    fs.copyFileSync(SHARED_CORE_SRC, path.join(jobWorkDir, 'composition-core.js'))

    if (fs.existsSync(assetDir)) {
      for (const f of fs.readdirSync(assetDir)) {
        if (f.startsWith('.')) continue
        const src = path.join(assetDir, f)
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(publicAssetsDir, f))
        }
      }
    }

    const tl = computeTimeline(storyboard)
    const entryPath = path.join(jobWorkDir, 'index.js')
    fs.writeFileSync(entryPath, [
      "import React from 'react';",
      "import { Composition, Img, registerRoot, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';",
      "import { renderStoryboardFrame } from './composition-core.js';",
      '',
      'function ActiveComposition(props) {',
      '  const frame = useCurrentFrame();',
      '  const { fps } = useVideoConfig();',
      '  return renderStoryboardFrame(React, {',
      '    frame,',
      '    fps,',
      '    storyboard: props.storyboard,',
      '    brandKit: props.brandKit,',
      '    assetMeta: props.storyboard?.assetMeta,',
      '    Img,',
      "    resolveAsset: (name) => staticFile('assets/' + name),",
      '  });',
      '}',
      '',
      'function Root() {',
      '  return React.createElement(Composition, {',
      "    id: 'ReelDeskOutput',",
      '    component: ActiveComposition,',
      '    defaultProps: { storyboard: null, brandKit: null, totalFrames: 90 },',
      '    durationInFrames: 90,',
      '    fps: 60,',
      '    width: 1920,',
      '    height: 1080,',
      '    calculateMetadata: ({ props }) => ({',
      '      durationInFrames: Math.max(1, Number(props.totalFrames) || 90),',
      '      fps: Number(props.storyboard?.fps) || 60,',
      '      width: Number(props.storyboard?.width) || 1920,',
      '      height: Number(props.storyboard?.height) || 1080,',
      '    }),',
      '  });',
      '}',
      '',
      'registerRoot(Root);',
      '',
    ].join('\n'), 'utf8')

    const runnerPath = path.join(jobWorkDir, 'run-render.mjs')
    fs.writeFileSync(runnerPath, [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      "import { bundle } from '@remotion/bundler';",
      "import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';",
      '',
      'const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));',
      'let serveUrl = cfg.bundleCacheDir;',
      'if (!fs.existsSync(path.join(cfg.bundleCacheDir, "index.html"))) {',
      "  console.log(JSON.stringify({ event: 'stage', stage: 'bundling', percent: 12, message: '正在打包画面代码与截图素材…' }));",
      '  serveUrl = await bundle({',
      '    entryPoint: cfg.entryPath,',
      '    publicDir: cfg.publicDir,',
      '    outDir: cfg.bundleCacheDir,',
      '  });',
      '} else {',
      "  console.log(JSON.stringify({ event: 'stage', stage: 'bundling', percent: 15, message: '已命中画面打包缓存，准备合成…' }));",
      '}',
      '',
      'let browserExecutable = cfg.browserExecutable || null;',
      'let chromeMode = cfg.chromeMode || undefined;',
      'if (cfg.tryEnsureBrowser) {',
      '  try {',
      '    await ensureBrowser({ logLevel: "error" });',
      '    browserExecutable = null;',
      '    chromeMode = "headless-shell";',
      '  } catch (_e) {',
      '    // Fall back to system browserExecutable + chrome-for-testing',
      '  }',
      '}',
      '',
      'const browserOpts = {};',
      'if (browserExecutable) browserOpts.browserExecutable = browserExecutable;',
      'if (chromeMode) browserOpts.chromeMode = chromeMode;',
      '',
      'const composition = await selectComposition({',
      '  serveUrl,',
      "  id: 'ReelDeskOutput',",
      '  inputProps: cfg.inputProps,',
      '  ...browserOpts,',
      '});',
      '',
      'if (cfg.stillFrame !== undefined && cfg.stillFrame !== null) {',
      '  await renderStill({',
      '    composition,',
      '    serveUrl,',
      '    inputProps: cfg.inputProps,',
      '    output: cfg.outputPath,',
      '    frame: cfg.stillFrame,',
      '    scale: cfg.scale || 1,',
      '    ...browserOpts,',
      '  });',
      "  console.log(JSON.stringify({ event: 'done', outputPath: cfg.outputPath }));",
      '  process.exit(0);',
      '}',
      '',
      'const isGif = cfg.codec === "gif";',
      'let lastPct = -1;',
      'const mediaOpts = {',
      '  composition,',
      '  serveUrl,',
      '  inputProps: cfg.inputProps,',
      "  codec: isGif ? 'gif' : 'h264',",
      '  scale: cfg.scale || 1,',
      '  outputLocation: cfg.outputPath,',
      '  frameRange: cfg.frameRange || null,',
      '  concurrency: cfg.concurrency || 2,',
      '  ...browserOpts,',
      '  onProgress: ({ renderedFrames, progress }) => {',
      '    const pct = Math.min(99, Math.max(16, Math.round(16 + progress * 83)));',
      '    if (pct !== lastPct) {',
      '      lastPct = pct;',
      '      const total = cfg.totalFrames || composition.durationInFrames;',
      '      const doneFrames = Math.min(total, Math.max(0, Number(renderedFrames) || Math.round(progress * total)));',
      '      console.log(JSON.stringify({',
      "        event: 'progress',",
      "        stage: 'rendering',",
      '        percent: pct,',
      '        renderedFrames: doneFrames,',
      '        totalFrames: total,',
      '        message: `正在合成画面 ${doneFrames} / ${total} 帧`,',
      '      }));',
      '    }',
      '  },',
      '};',
      'if (!isGif) {',
      '  mediaOpts.enforceAudioTrack = true;',
      '} else {',
      '  mediaOpts.everyNthFrame = cfg.everyNthFrame || 3;',
      '  mediaOpts.numberOfGifLoops = null;',
      '}',
      'await renderMedia(mediaOpts);',
      "console.log(JSON.stringify({ event: 'done', outputPath: cfg.outputPath }));",
      '',
    ].join('\n'), 'utf8')

    return {
      jobWorkDir,
      publicDir: path.join(jobWorkDir, 'public'),
      bundleCacheDir,
      entryPath,
      runnerPath,
      timeline: tl,
    }
  }

  function validatePreFlight(projectId) {
    const platformSupported = process.platform === 'darwin' || process.env.REEL_DESK_ALLOW_NON_DARWIN === '1'
    if (!platformSupported) {
      throw new Error(`当前系统 (${process.platform}) 暂不支持本机视频导出，目前仅支持 macOS`)
    }
    const rec = store.readProjectRecord(projectId)
    const runtimeDir = resolveRuntimeDir(store.rootDir)
    const browserInfo = detectBrowserInfo(runtimeDir)

    const allowAutoDownloadBrowser = process.env.REEL_DESK_AUTO_ENSURE_BROWSER === '1'
    if (!browserInfo.ready && (browserInfo.source === 'env-missing' || !allowAutoDownloadBrowser)) {
      throw new Error(browserInfo.reason || '这台电脑上没找到 Chrome 或 Edge')
    }

    // Freeze project snapshot at job creation time (`Check #10`)
    const frozenRec = {
      id: rec.id,
      version: rec.version || 1,
      assets: structuredClone(rec.assets || []),
      storyboard: structuredClone(rec.storyboard),
    }

    return { rec: frozenRec, runtimeDir, browserInfo }
  }

  async function runPreparedRender(jobId, frozenRec, runtimeDir, browserInfo, options = {}) {
    const startedAtMs = Date.now()
    const kits = store.listBrandKits()
    const isStill = options.stillFrame !== undefined && options.stillFrame !== null
    const quality = (options.quality === 'draft' || options.draft) ? 'draft' : 'full'
    const isDraft = quality === 'draft'
    const format = isStill ? 'png' : (options.format === 'gif' ? 'gif' : 'mp4')
    const isGif = format === 'gif'

    const effectiveSb = isStill
      ? structuredClone(frozenRec.storyboard)
      : prepareStoryboardForQuality(frozenRec.storyboard, quality)
    const kit = kits.find(k => k.id === effectiveSb.brandKitId) || kits[0]
    const renderDir = store.getRenderDir(frozenRec.id)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `${frozenRec.id}-v${frozenRec.version}${isDraft ? '-draft' : ''}-${stamp}.${format}`
    const outputPath = path.join(renderDir, fileName)
    const tmpOutputPath = path.join(renderDir, `.tmp-${jobId}.${format}`)

    const ac = new AbortController()
    activeAbortControllers.add(ac)
    let logTail = ''

    try {
      const ensuredRuntimeDir = await ensureRemotionRuntime({
        signal: ac.signal,
        onProgress: p => {
          if (activeJob?.id === jobId) {
            activeJob = { ...activeJob, ...p }
          }
        },
      })

      const ws = prepareRenderWorkspace(ensuredRuntimeDir, frozenRec.id, effectiveSb)
      const { nodeBin, useElectronAsNode } = detectNodeAndInstaller()
      const env = {
        ...process.env,
        ...(useElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      }

      const rawFrames = Array.isArray(options.frameRange) && options.frameRange.length === 2
        ? Math.max(1, options.frameRange[1] - options.frameRange[0] + 1)
        : ws.timeline.totalFrames
      const everyNthFrame = isGif ? (isDraft ? 2 : 3) : 1
      const totalExpectedFrames = isGif ? Math.max(1, Math.ceil(rawFrames / everyNthFrame)) : rawFrames
      const scaleFactor = (isDraft || isGif) ? 0.5 : 1

      if (activeJob?.id === jobId) {
        activeJob = {
          ...activeJob,
          fileName,
          format,
          quality,
          totalFrames: totalExpectedFrames,
          renderedFrames: 0,
        }
      }

      const cfgPath = path.join(ws.jobWorkDir, `cfg-${jobId}.json`)
      const useSystemChrome = browserInfo.source === 'system-browser' || browserInfo.source === 'env'
      fs.writeFileSync(cfgPath, JSON.stringify({
        entryPath: ws.entryPath,
        publicDir: ws.publicDir,
        bundleCacheDir: ws.bundleCacheDir,
        outputPath: tmpOutputPath,
        codec: isGif ? 'gif' : 'h264',
        everyNthFrame,
        browserExecutable: browserInfo.executable,
        chromeMode: useSystemChrome ? 'chrome-for-testing' : 'headless-shell',
        tryEnsureBrowser: Boolean(process.env.REEL_DESK_AUTO_ENSURE_BROWSER === '1' && browserInfo.source !== 'env'),
        stillFrame: isStill ? Math.max(0, Math.min(ws.timeline.totalFrames - 1, Number(options.stillFrame))) : null,
        frameRange: Array.isArray(options.frameRange) ? options.frameRange : null,
        scale: scaleFactor,
        concurrency: Number(options.concurrency) || 2,
        totalFrames: totalExpectedFrames,
        inputProps: {
          storyboard: effectiveSb,
          brandKit: kit,
          totalFrames: ws.timeline.totalFrames,
        },
      }, null, 2), 'utf8')

      try {
        await spawnChecked(nodeBin, [ws.runnerPath, cfgPath], {
          cwd: ensuredRuntimeDir,
          env,
          signal: ac.signal,
          timeoutMs: RENDER_TIMEOUT_MS,
          onLine: chunk => {
            logTail = (logTail + chunk).slice(-2400)
            for (const rawLine of chunk.split('\n')) {
              const trimmed = rawLine.trim()
              if (!trimmed.startsWith('{')) continue
              try {
                const evt = JSON.parse(trimmed)
                if ((evt.event === 'stage' || evt.event === 'progress') && activeJob?.id === jobId) {
                  activeJob = {
                    ...activeJob,
                    stage: evt.stage || activeJob.stage,
                    percent: evt.percent ?? activeJob.percent,
                    renderedFrames: evt.renderedFrames ?? activeJob.renderedFrames,
                    totalFrames: evt.totalFrames ?? activeJob.totalFrames,
                    message: evt.message || activeJob.message,
                  }
                }
              } catch {
                // ignore non-JSON console lines
              }
            }
          },
        })
      } finally {
        try { fs.unlinkSync(cfgPath) } catch { /* ignore */ }
      }

      if (ac.signal.aborted || activeJob?.stage === 'cancelled') {
        const cancelErr = new Error('已取消导出')
        cancelErr.code = 'RENDER_CANCELLED'
        throw cancelErr
      }

      fs.renameSync(tmpOutputPath, outputPath)
      const stat = fs.statSync(outputPath)
      const elapsedMs = Date.now() - startedAtMs
      const entry = {
        id: jobId,
        kind: isStill ? 'still' : format,
        format,
        quality,
        spec: { quality, format },
        draft: isDraft,
        file: fileName,
        fileName,
        outputPath,
        bytes: stat.size,
        sizeBytes: stat.size,
        width: Math.round(effectiveSb.width * scaleFactor),
        height: Math.round(effectiveSb.height * scaleFactor),
        fps: isGif ? Math.round(effectiveSb.fps / everyNthFrame) : effectiveSb.fps,
        totalFrames: totalExpectedFrames,
        durationSec: Number((rawFrames / effectiveSb.fps).toFixed(2)),
        elapsedMs,
        version: frozenRec.version,
        createdAt: new Date().toISOString(),
      }
      store.recordRenderOutput(frozenRec.id, entry)

      activeJob = {
        ...activeJob,
        stage: 'done',
        percent: 100,
        renderedFrames: totalExpectedFrames,
        totalFrames: totalExpectedFrames,
        message: `成片已导出 · 第 ${frozenRec.version} 版`,
        outputPath,
        file: fileName,
        fileName,
        format,
        quality,
        spec: { quality, format },
        bytes: stat.size,
        sizeBytes: stat.size,
        elapsedMs,
        version: frozenRec.version,
        entry,
      }
      notifyJobSettled(activeJob)
      return entry
    } catch (err) {
      try {
        if (fs.existsSync(tmpOutputPath)) fs.unlinkSync(tmpOutputPath)
      } catch { /* ignore */ }

      if (err?.code === 'RENDER_CANCELLED' || activeJob?.stage === 'cancelled') {
        activeJob = {
          ...(activeJob || {}),
          id: jobId,
          projectId: frozenRec.id,
          stage: 'cancelled',
          message: '已取消导出',
          error: null,
          errorDetail: null,
        }
        notifyJobSettled(activeJob)
        throw err
      }
      const detail = classifyRenderError(err)
      activeJob = {
        ...(activeJob || {}),
        id: jobId,
        projectId: frozenRec.id,
        stage: 'failed',
        message: detail.title,
        error: err.message,
        errorDetail: detail,
        logTail: err.logTail || logTail || err.message,
      }
      notifyJobSettled(activeJob)
      throw err
    } finally {
      activeAbortControllers.delete(ac)
    }
  }

  async function renderProject(projectId, options = {}) {
    if (activeJob && ['bootstrapping', 'bundling', 'rendering'].includes(activeJob.stage)) {
      throw new Error(`当前已有导出任务正在运行（${activeJob.projectId} · ${activeJob.percent}%），请等待完成或先取消`)
    }
    const jobId = `render-${Date.now().toString(36)}`
    let pre
    try {
      pre = validatePreFlight(projectId)
    } catch (err) {
      const detail = classifyRenderError(err)
      activeJob = {
        id: jobId,
        projectId: String(projectId || ''),
        stage: 'failed',
        percent: 0,
        startedAt: new Date().toISOString(),
        message: detail.title,
        error: err.message,
        errorDetail: detail,
        logTail: err.message,
      }
      throw err
    }

    const quality = (options.quality === 'draft' || options.draft) ? 'draft' : 'full'
    const format = options.stillFrame !== undefined && options.stillFrame !== null
      ? 'png'
      : (options.format === 'gif' ? 'gif' : 'mp4')
    const effectiveSb = format === 'png'
      ? pre.rec.storyboard
      : prepareStoryboardForQuality(pre.rec.storyboard, quality)
    const tl = computeTimeline(effectiveSb)

    activeJob = {
      id: jobId,
      projectId: pre.rec.id,
      version: pre.rec.version,
      format,
      quality,
      stage: 'bootstrapping',
      percent: 2,
      renderedFrames: 0,
      totalFrames: tl.totalFrames,
      message: '正在检查合成环境…',
      startedAt: new Date().toISOString(),
      fileName: null,
      outputPath: null,
      error: null,
      errorDetail: null,
      logTail: '',
    }

    return runPreparedRender(jobId, pre.rec, pre.runtimeDir, pre.browserInfo, options)
  }

  function startBackgroundRender(projectId, options = {}) {
    if (activeJob && ['bootstrapping', 'bundling', 'rendering'].includes(activeJob.stage)) {
      throw new Error(`当前已有导出任务正在运行（${activeJob.projectId} · ${activeJob.percent}%）`)
    }
    const jobId = `render-${Date.now().toString(36)}`
    let pre
    try {
      pre = validatePreFlight(projectId)
    } catch (err) {
      const detail = classifyRenderError(err)
      activeJob = {
        id: jobId,
        projectId: String(projectId || ''),
        stage: 'failed',
        percent: 0,
        startedAt: new Date().toISOString(),
        message: detail.title,
        error: err.message,
        errorDetail: detail,
        logTail: err.message,
      }
      throw err
    }

    const quality = (options.quality === 'draft' || options.draft) ? 'draft' : 'full'
    const format = options.stillFrame !== undefined && options.stillFrame !== null
      ? 'png'
      : (options.format === 'gif' ? 'gif' : 'mp4')
    const effectiveSb = format === 'png'
      ? pre.rec.storyboard
      : prepareStoryboardForQuality(pre.rec.storyboard, quality)
    const tl = computeTimeline(effectiveSb)

    activeJob = {
      id: jobId,
      projectId: pre.rec.id,
      version: pre.rec.version,
      format,
      quality,
      stage: 'bootstrapping',
      percent: 2,
      renderedFrames: 0,
      totalFrames: tl.totalFrames,
      message: '正在准备合成画面…',
      startedAt: new Date().toISOString(),
      fileName: null,
      outputPath: null,
      error: null,
      errorDetail: null,
      logTail: '',
    }

    runPreparedRender(jobId, pre.rec, pre.runtimeDir, pre.browserInfo, options).catch(err => {
      if (err?.code !== 'RENDER_CANCELLED') {
        log(`background render failed: ${err.message}`)
      }
    })

    return { ...activeJob }
  }

  function waitForJob(jobId, timeoutMs = 25_000) {
    if (activeJob && activeJob.id === jobId && ['done', 'failed', 'cancelled'].includes(activeJob.stage)) {
      return Promise.resolve({ ...activeJob })
    }
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        const set = jobWaiters.get(jobId)
        if (set) set.delete(onDone)
        resolve(activeJob ? { ...activeJob } : null)
      }, timeoutMs)

      function onDone(job) {
        clearTimeout(timer)
        resolve({ ...job })
      }

      if (!jobWaiters.has(jobId)) jobWaiters.set(jobId, new Set())
      jobWaiters.get(jobId).add(onDone)
    })
  }

  function cancelRender() {
    if (!activeJob || !['bootstrapping', 'bundling', 'rendering'].includes(activeJob.stage)) {
      return null
    }
    const cancelledJob = {
      ...activeJob,
      stage: 'cancelled',
      message: '已取消导出',
      error: null,
      errorDetail: null,
    }
    activeJob = cancelledJob
    for (const ac of activeAbortControllers) {
      try { ac.abort() } catch { /* ignore */ }
    }
    activeAbortControllers.clear()
    notifyJobSettled(cancelledJob)
    return cancelledJob
  }

  function clearJobStatus() {
    if (activeJob && !['bootstrapping', 'bundling', 'rendering'].includes(activeJob.stage)) {
      activeJob = null
    }
    return null
  }

  function dispose() {
    cancelRender()
    jobWaiters.clear()
  }

  return {
    getStatus,
    ensureRemotionRuntime,
    renderProject,
    startBackgroundRender,
    waitForJob,
    cancelRender,
    clearJobStatus,
    dispose,
  }
}
