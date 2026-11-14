// HTTP routes for DSH Reel Desk (`制片台` Flow v3) client panel.
//
// Registered via connection.fetch.register under /api/reel_desk/*:
//   GET  /api/reel_desk/view    -> workbench snapshot (or lightweight `unchanged: true` on `sinceVersion`) + capabilities
//   POST /api/reel_desk/action  -> atomic direct edits, conflict check, suggest_scene, handoff, undo/restore, export
//   POST /api/reel_desk/asset   -> raw binary image upload (<=10MB, magic-byte + dimensions + SHA-256 content hash)
//   GET  /api/reel_desk/media   -> path-contained streaming (with HTTP 206 Range) of MP4, GIF & image assets

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { assertSafeSegment, resolveContainedPath } from './store.js'
import { BRAND_GLYPHS, ReelConflictError, ReelValidationError } from './schema.js'
import { detectNodeAndInstaller, detectWechatCli } from './renderer.js'
import { isInlineRewriteAvailable, suggestSceneVariants } from './suggest.js'

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function jsonReply(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  })
}

function isCrossSiteWrite(request) {
  const fetchSite = request.headers?.get?.('sec-fetch-site') || ''
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return true
  }
  const origin = request.headers?.get?.('origin') || ''
  if (origin) {
    try {
      const o = new URL(origin)
      if (!['127.0.0.1', 'localhost', '::1'].includes(o.hostname) && !['dsh-app:', 'app:', 'file:'].includes(o.protocol)) {
        return true
      }
    } catch {
      return true
    }
  }
  return false
}

function execFilePromise(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: options.timeout || 15_000, env: options.env || process.env }, (err, stdout, stderr) => {
      if (err) {
        const detail = String(stderr || stdout || err.message || '').trim()
        reject(new Error(detail || err.message))
        return
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
    })
  })
}

function parseByteRange(rangeHeader, totalSize) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null
  const spec = rangeHeader.slice('bytes='.length).split(',')[0].trim()
  const dashIdx = spec.indexOf('-')
  if (dashIdx < 0) return { invalid: true }
  const startStr = spec.slice(0, dashIdx).trim()
  const endStr = spec.slice(dashIdx + 1).trim()

  let start
  let end
  if (startStr === '') {
    const suffixLen = Number(endStr)
    if (!Number.isInteger(suffixLen) || suffixLen <= 0) return { invalid: true }
    start = Math.max(0, totalSize - suffixLen)
    end = totalSize - 1
  } else {
    start = Number(startStr)
    end = endStr === '' ? totalSize - 1 : Number(endStr)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end) {
      return { invalid: true }
    }
  }
  if (start >= totalSize) return { invalid: true }
  end = Math.min(end, totalSize - 1)
  return { start, end }
}

export function resolveHostWorkspaces(ctx) {
  const reg =
    ctx?.get?.('workspaceRegistry', false) ||
    ctx?.workspaceRegistry ||
    ctx?.get?.('workspaces', false) ||
    ctx?.workspaces ||
    null
  if (!reg) return []
  try {
    const raw = typeof reg.list === 'function'
      ? reg.list()
      : (reg.list?.getSnapshot?.() || [])
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : [])
    return arr
      .filter(w => w && typeof w.path === 'string' && w.path.trim())
      .map(w => ({
        id: String(w.id || w.workspaceId || w.path),
        name: String(w.name || path.basename(w.path) || w.path),
        path: w.path,
      }))
  } catch {
    return []
  }
}

export function resolveServerAllowedRoots(ctx, workspaceId) {
  const reg =
    ctx?.get?.('workspaceRegistry', false) ||
    ctx?.workspaceRegistry ||
    ctx?.get?.('workspaces', false) ||
    ctx?.workspaces ||
    null
  if (!reg) return { baseDir: undefined, allowedRoots: [] }

  if (workspaceId && String(workspaceId).trim()) {
    const wid = String(workspaceId).trim()
    try {
      const direct = typeof reg.get === 'function' ? reg.get(wid) : null
      if (direct?.path) {
        return { baseDir: direct.path, allowedRoots: [direct.path] }
      }
    } catch { /* ignore */ }
    const all = resolveHostWorkspaces(ctx)
    const matched = all.find(w => w.id === wid || w.path === wid)
    if (matched?.path) {
      return { baseDir: matched.path, allowedRoots: [matched.path] }
    }
    return { baseDir: undefined, allowedRoots: [] }
  }

  const all = resolveHostWorkspaces(ctx)
  const paths = all.map(w => w.path).filter(Boolean)
  return {
    baseDir: paths[0],
    allowedRoots: paths,
  }
}

export async function handleDeskAction({ ctx, store, renderer }, body = {}, reqMeta = {}) {
  const action = String(body?.action || '').trim()

  switch (action) {
    case 'select_project': {
      const id = String(body.id || '').trim()
      store.setActiveProject(id)
      return { ok: true, snapshot: store.buildSnapshot(id), renderer: renderer.getStatus() }
    }

    case 'create_project': {
      const rec = store.createBlankOrTemplateProject({
        title: body.title,
        aspect: body.aspect,
        brandKitId: body.brandKitId,
        brief: body.brief,
        productTag: body.productTag,
        glyph: body.glyph,
        workspaceId: body.workspaceId || null,
      })
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'create_from_sample': {
      const rec = store.createFromSample(String(body.sampleId || ''))
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'duplicate_project': {
      const rec = store.duplicateProject(String(body.id || ''))
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'delete_project': {
      const res = store.deleteProject(String(body.id || ''))
      return {
        ok: true,
        deletedId: res.deletedId,
        snapshot: store.buildSnapshot(res.activeProjectId),
        renderer: renderer.getStatus(),
      }
    }

    case 'rename_project': {
      const rec = store.renameProject(String(body.id || ''), body.title)
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'save_storyboard': {
      const rec = store.saveStoryboard(body.storyboard || {}, {
        projectId: body.id ? String(body.id) : undefined,
        createNew: Boolean(body.createNew),
        by: 'user',
        strict: false,
        baseVersion: Number.isInteger(body.baseVersion) ? body.baseVersion : undefined,
        coalesceKey: body.coalesceKey ? String(body.coalesceKey) : undefined,
        note: body.note || '面板修改',
      })
      return {
        ok: true,
        warnings: rec.warnings || [],
        snapshot: store.buildSnapshot(rec.id),
        renderer: renderer.getStatus(),
      }
    }

    case 'patch_scene': {
      const rec = store.patchScene(String(body.id || ''), {
        op: body.op || 'update',
        ops: Array.isArray(body.ops) ? body.ops : undefined,
        sceneIndex: body.sceneIndex,
        sceneId: body.sceneId ? String(body.sceneId) : undefined,
        toIndex: body.toIndex,
        scene: body.scene,
        by: 'user',
        strict: false,
        baseVersion: Number.isInteger(body.baseVersion) ? body.baseVersion : undefined,
        baseSceneRev: Number.isInteger(body.baseSceneRev) ? body.baseSceneRev : undefined,
        changedFields: Array.isArray(body.changedFields) ? body.changedFields : undefined,
        forceResolveConflict: Boolean(body.forceResolveConflict),
        coalesceKey: body.coalesceKey ? String(body.coalesceKey) : undefined,
        note: body.note,
      })
      return {
        ok: true,
        autoMerged: rec.autoMerged || [],
        warnings: rec.warnings || [],
        snapshot: store.buildSnapshot(rec.id),
        renderer: renderer.getStatus(),
      }
    }

    case 'set_brand_kit': {
      const rec = store.readProjectRecord(String(body.id || ''))
      const sb = { ...rec.storyboard, brandKitId: String(body.brandKitId || 'paper') }
      const updated = store.saveStoryboard(sb, {
        projectId: rec.id,
        by: 'user',
        strict: false,
        note: `换配色为 ${sb.brandKitId}`,
      })
      return { ok: true, snapshot: store.buildSnapshot(updated.id), renderer: renderer.getStatus() }
    }

    case 'set_aspect': {
      const aspect = body.aspect === '9:16' ? '9:16' : '16:9'
      const updated = store.setAspect(String(body.id || ''), aspect, { by: 'user' })
      return {
        ok: true,
        reframed: updated.reframed || [],
        snapshot: store.buildSnapshot(updated.id),
        renderer: renderer.getStatus(),
      }
    }

    case 'set_glyph': {
      const rec = store.readProjectRecord(String(body.id || ''))
      const glyph = BRAND_GLYPHS.includes(body.glyph) ? body.glyph : 'none'
      const sb = { ...rec.storyboard, glyph }
      const updated = store.saveStoryboard(sb, {
        projectId: rec.id,
        by: 'user',
        strict: false,
        note: '换画面小图形',
      })
      return { ok: true, snapshot: store.buildSnapshot(updated.id), renderer: renderer.getStatus() }
    }

    case 'set_show_hud': {
      const rec = store.readProjectRecord(String(body.id || ''))
      const showHud = Boolean(body.showHud)
      const sb = { ...rec.storyboard, showHud }
      const updated = store.saveStoryboard(sb, {
        projectId: rec.id,
        by: 'user',
        strict: false,
        note: showHud ? '开启镜号时间码' : '隐藏镜号时间码',
      })
      return { ok: true, snapshot: store.buildSnapshot(updated.id), renderer: renderer.getStatus() }
    }

    case 'save_brand_kit': {
      const kit = store.saveBrandKit(body.kit || {})
      return { ok: true, kit, snapshot: store.buildSnapshot(body.id), renderer: renderer.getStatus() }
    }

    case 'add_asset': {
      // D.1 Security invariant: NEVER trust client-supplied `body.allowedRoots`!
      const { baseDir, allowedRoots } = resolveServerAllowedRoots(ctx, body.workspaceId)
      const res = store.addProjectAsset(String(body.id || ''), body.path, {
        baseDir,
        allowedRoots,
        source: 'workspace',
      })
      return {
        ok: true,
        asset: res.asset,
        width: res.width,
        height: res.height,
        sizeBytes: res.sizeBytes,
        snapshot: store.buildSnapshot(res.projectId),
        renderer: renderer.getStatus(),
      }
    }

    case 'note_handoff': {
      const pending = store.noteHandoff({
        sessionId: body.sessionId,
        workspaceId: body.workspaceId,
        brief: body.brief,
        aspect: body.aspect,
        targetDurationSec: body.targetDurationSec,
      })
      return {
        ok: true,
        pendingHandoff: pending,
        snapshot: store.buildSnapshot(body.id),
        renderer: renderer.getStatus(),
      }
    }

    case 'clear_handoff': {
      store.clearHandoff(body.sessionId || null)
      return {
        ok: true,
        snapshot: store.buildSnapshot(body.id),
        renderer: renderer.getStatus(),
      }
    }

    case 'ack_changes': {
      const rec = store.ackChanges(String(body.id || ''), {
        sceneId: body.sceneId ? String(body.sceneId) : undefined,
      })
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'revert_scene': {
      const rec = store.revertScene(
        String(body.id || ''),
        String(body.sceneId || ''),
        Number.isInteger(body.toVersion) ? body.toVersion : null,
      )
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'restore_version': {
      const rec = store.restoreVersion(String(body.id || ''), Number(body.version))
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'undo': {
      const rec = store.undoProject(String(body.id || ''))
      return { ok: true, snapshot: store.buildSnapshot(rec.id), renderer: renderer.getStatus() }
    }

    case 'suggest_scene': {
      const rec = store.readProjectRecord(String(body.id || ''))
      let sceneIndex = Number.isInteger(body.sceneIndex) ? body.sceneIndex : 0
      if (body.sceneId) {
        const byId = rec.storyboard.scenes.findIndex(s => s.id === String(body.sceneId))
        if (byId >= 0) sceneIndex = byId
      }
      const res = await suggestSceneVariants(ctx, {
        project: rec,
        sceneIndex,
        intent: body.intent,
        n: Number(body.n) || 3,
        signal: reqMeta.signal || null,
      })
      return {
        ...res,
        projectId: rec.id,
        version: rec.version,
      }
    }

    case 'start_render': {
      const quality = body.quality === 'draft' || body.draft ? 'draft' : 'full'
      const format = body.format === 'gif' ? 'gif' : 'mp4'
      const job = renderer.startBackgroundRender(String(body.id || ''), {
        stillFrame: body.stillFrame,
        quality,
        format,
        draft: quality === 'draft',
      })
      return { ok: true, job, snapshot: store.buildSnapshot(body.id), renderer: renderer.getStatus() }
    }

    case 'cancel_render': {
      renderer.cancelRender()
      return { ok: true, snapshot: store.buildSnapshot(body.id), renderer: renderer.getStatus() }
    }

    case 'clear_render_status':
    case 'clear_render_error': {
      renderer.clearJobStatus()
      return { ok: true, snapshot: store.buildSnapshot(body.id), renderer: renderer.getStatus() }
    }

    case 'reveal_in_finder': {
      if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/open')) {
        throw new Error('当前系统不支持在访达中定位文件')
      }
      const projectId = assertSafeSegment(String(body.id || ''), '项目 id')
      const fileName = assertSafeSegment(String(body.fileName || ''), '文件名')
      const target = resolveContainedPath(store.getRenderDir(projectId), fileName)
      if (!fs.existsSync(target)) {
        throw new Error(`找不到成片文件：${fileName}`)
      }
      await execFilePromise('/usr/bin/open', ['-R', target], { timeout: 8_000 })
      return { ok: true, revealed: target }
    }

    case 'send_wechat': {
      const wechatCli = detectWechatCli()
      if (!wechatCli) {
        throw new Error('未检测到本机 dsh-wechat 通道（~/bin/dsh-wechat.mjs）')
      }
      const projectId = assertSafeSegment(String(body.id || ''), '项目 id')
      const fileName = assertSafeSegment(String(body.fileName || ''), '文件名')
      const target = resolveContainedPath(store.getRenderDir(projectId), fileName)
      if (!fs.existsSync(target)) {
        throw new Error(`找不到成片文件：${fileName}`)
      }
      const rec = store.readProjectRecord(projectId)
      const caption = String(body.caption || `${rec.storyboard.title}（第 ${rec.version} 版成片）`).slice(0, 120)
      const { nodeBin, useElectronAsNode } = detectNodeAndInstaller()
      const env = {
        ...process.env,
        ...(useElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      }
      const subCmd = target.toLowerCase().endsWith('.mp4') ? 'video' : 'file'
      await execFilePromise(nodeBin, [wechatCli, subCmd, target, caption], { timeout: 45_000, env })
      return { ok: true, sent: target }
    }

    default:
      throw new Error(`未知操作：${action || '(空)'}`)
  }
}

export function registerReelRoutes(scope, { ctx, store, renderer }) {
  const connection = scope?.connection ?? scope?.get?.('connection', false) ?? null
  if (!connection || typeof connection.fetch?.register !== 'function') return null

  const hostCtx = ctx || scope
  const disposers = []

  const offView = connection.fetch.register({
    path: '/api/reel_desk/view',
    methods: ['GET'],
    requestBody: 'buffered',
    async fetch(request) {
      try {
        const url = new URL(request.url ?? '', 'http://localhost')
        const projectId = url.searchParams.get('project') || undefined
        const sinceRaw = url.searchParams.get('sinceVersion')
        const snap = store.buildSnapshot(projectId)
        const rendererStatus = renderer.getStatus()
        const capabilities = {
          wechat: Boolean(rendererStatus.canSendWechat),
          inlineRewrite: await isInlineRewriteAvailable(hostCtx),
        }

        if (sinceRaw !== null && sinceRaw !== '' && Number.isInteger(Number(sinceRaw))) {
          const sinceVer = Number(sinceRaw)
          const matchesSameProject = projectId
            ? (snap.activeProject?.id === projectId && (snap.activeProject?.version ?? 0) === sinceVer)
            : (!snap.activeProject && sinceVer === 0)
          if (matchesSameProject) {
            return jsonReply({
              ok: true,
              unchanged: true,
              activeProjectId: snap.activeProjectId,
              version: snap.activeProject?.version ?? 0,
              pendingHandoff: snap.pendingHandoff || null,
              renderer: rendererStatus,
              capabilities,
            })
          }
        }

        return jsonReply({
          ok: true,
          unchanged: false,
          snapshot: snap,
          workspaces: resolveHostWorkspaces(hostCtx),
          renderer: rendererStatus,
          capabilities,
        })
      } catch (err) {
        return jsonReply({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    },
  })
  if (typeof offView === 'function') disposers.push(offView)

  const offAction = connection.fetch.register({
    path: '/api/reel_desk/action',
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      if (isCrossSiteWrite(request)) {
        return jsonReply({ error: '拒绝跨站写请求' }, 403)
      }
      const ct = request.headers?.get?.('content-type') || ''
      if (ct && !/^application\/json(?:\s*;|$)/i.test(ct)) {
        return jsonReply({ error: '请求需为 application/json' }, 415)
      }
      let body = {}
      try {
        const rawBytes = await request.arrayBuffer()
        if (rawBytes.byteLength > 262144) {
          return jsonReply({ error: '请求体积超出限制 (256KB)' }, 413)
        }
        body = JSON.parse(new TextDecoder().decode(rawBytes))
      } catch {
        return jsonReply({ error: '无效的 JSON 请求体' }, 400)
      }
      try {
        const result = await handleDeskAction(
          { ctx: hostCtx, store, renderer },
          body,
          { signal: request.signal || null },
        )
        return jsonReply(result, 200)
      } catch (err) {
        const isConflict = err instanceof ReelConflictError || err?.code === 'VERSION_CONFLICT' || err?.code === 'SCENE_CONFLICT'
        const status = isConflict ? 409 : (err?.status || (err instanceof ReelValidationError ? 400 : 422))
        let safeSnapshot = null
        try {
          safeSnapshot = store.buildSnapshot(body?.id ? String(body.id) : undefined)
        } catch {
          // ignore snapshot read error on invalid project id
        }
        return jsonReply({
          ok: false,
          code: err?.code || undefined,
          error: err instanceof Error ? err.message : String(err),
          conflict: isConflict
            ? {
                code: err.code,
                sceneId: err.sceneId || null,
                sceneIndex: err.sceneIndex ?? null,
                fields: err.fields || [],
                nonConflictingFields: err.nonConflictingFields || [],
                theirs: err.theirsScene || null,
                baseScene: err.baseScene || null,
                by: err.by || 'agent',
                version: err.version ?? err.currentVersion ?? null,
                serverNote: err.serverNote || '',
              }
            : undefined,
          snapshot: safeSnapshot,
          renderer: renderer.getStatus(),
        }, status)
      }
    },
  })
  if (typeof offAction === 'function') disposers.push(offAction)

  const offAsset = connection.fetch.register({
    path: '/api/reel_desk/asset',
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      if (isCrossSiteWrite(request)) {
        return jsonReply({ ok: false, error: '拒绝跨站写请求' }, 403)
      }
      try {
        const url = new URL(request.url ?? '', 'http://localhost')
        const projectId = assertSafeSegment(url.searchParams.get('id') || url.searchParams.get('project') || '', '项目 id')
        const hintName = url.searchParams.get('name') || ''
        const rawBytes = await request.arrayBuffer()
        const buf = Buffer.from(rawBytes)
        const res = store.addUploadedAssetBuffer(projectId, buf, hintName)
        return jsonReply({
          ok: true,
          asset: res.asset,
          width: res.width,
          height: res.height,
          format: res.format,
          sizeBytes: res.sizeBytes,
          deduplicated: Boolean(res.deduplicated),
          snapshot: store.buildSnapshot(res.projectId),
          renderer: renderer.getStatus(),
        }, 200)
      } catch (err) {
        const status = Number.isInteger(err?.status)
          ? err.status
          : (err instanceof ReelValidationError ? 400 : 422)
        return jsonReply({
          ok: false,
          code: err?.code || undefined,
          error: err instanceof Error ? err.message : String(err),
        }, status)
      }
    },
  })
  if (typeof offAsset === 'function') disposers.push(offAsset)

  const offMedia = connection.fetch.register({
    path: '/api/reel_desk/media',
    methods: ['GET'],
    requestBody: 'buffered',
    async fetch(request) {
      try {
        const url = new URL(request.url ?? '', 'http://localhost')
        const projectId = assertSafeSegment(url.searchParams.get('project') || '', '项目 id')
        const assetParam = url.searchParams.get('asset')
        const fileParam = url.searchParams.get('file')

        let baseDir
        let fileName
        if (assetParam) {
          fileName = assertSafeSegment(assetParam, '素材名')
          baseDir = store.getAssetDir(projectId)
        } else {
          fileName = assertSafeSegment(fileParam || '', '文件名')
          baseDir = store.getRenderDir(projectId)
        }

        const target = resolveContainedPath(baseDir, fileName)
        if (!fs.existsSync(target)) {
          return jsonReply({ error: '找不到媒体文件' }, 404)
        }

        const stat = fs.statSync(target)
        const totalSize = stat.size
        const ext = path.extname(fileName).toLowerCase()
        const contentType = MIME_BY_EXT[ext] || 'application/octet-stream'

        const rangeHeader = request.headers?.get?.('range') || ''
        const range = parseByteRange(rangeHeader, totalSize)

        if (range?.invalid) {
          return new Response(null, {
            status: 416,
            headers: {
              ...BASE_HEADERS,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes */${totalSize}`,
            },
          })
        }

        if (range && totalSize > 0) {
          const chunkLen = range.end - range.start + 1
          const buf = Buffer.allocUnsafe(chunkLen)
          const fd = fs.openSync(target, 'r')
          try {
            fs.readSync(fd, buf, 0, chunkLen, range.start)
          } finally {
            fs.closeSync(fd)
          }
          return new Response(buf, {
            status: 206,
            headers: {
              ...BASE_HEADERS,
              'Accept-Ranges': 'bytes',
              'Content-Type': contentType,
              'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
              'Content-Length': String(chunkLen),
            },
          })
        }

        const bytes = fs.readFileSync(target)
        return new Response(bytes, {
          status: 200,
          headers: {
            ...BASE_HEADERS,
            'Accept-Ranges': 'bytes',
            'Content-Type': contentType,
            'Content-Length': String(bytes.byteLength),
          },
        })
      } catch (err) {
        return jsonReply({ error: err instanceof Error ? err.message : String(err) }, 400)
      }
    },
  })
  if (typeof offMedia === 'function') disposers.push(offMedia)

  return () => {
    for (const off of disposers.splice(0).reverse()) {
      try { off() } catch { /* ignore */ }
    }
  }
}
