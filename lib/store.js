// Atomic persistent store for DSH Reel Desk projects, assets, revisions, conflicts, and Brand Kits.
//
// Flow v3 engineering guarantees:
//   1. Atomic write-temp + renameSync in the same directory.
//   2. Strict path containment inside rootDir AND mandatory non-empty `allowedRoots` on `addProjectAsset`.
//   3. Content-hashed binary image upload (`addUploadedAssetBuffer`) with magic-byte & dimension parsing.
//   4. Clean separation between user `projects` (empty on fresh install) and read-only `samples`.
//   5. Origin session tracking (`origin: { by, sessionId, workspaceId, brief }`) + `pendingHandoff`.
//   6. Per-scene `rev`, field-level non-overlapping auto-merge, `409 SCENE_CONFLICT`, per-scene `revertScene`,
//      and `restoreVersion` (preserving forward history so nothing is ever lost).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  ASPECT_PRESETS,
  BRAND_GLYPH_META,
  BRAND_GLYPHS,
  computeTimeline,
  createStarterScene,
  deriveProjectSlug,
  normalizeScene,
  normalizeStoryboard,
  PRIMITIVE_KINDS,
  PRIMITIVE_META,
  REEL_LIMITS,
  ReelConflictError,
  ReelValidationError,
  slugifyId,
} from './schema.js'
import { buildSeedStoryboards, DEFAULT_BRAND_KITS } from './seeds.js'
import {
  buildContentHashedAssetName,
  inspectImageBuffer,
  MAX_UPLOAD_ASSET_BYTES,
} from './image-meta.js'
import {
  computeShotGeometry,
  reframeShotForAspect,
  shotViewportRectToImage,
  shotViewportToImage,
} from '../shared/composition-core.js'

const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const MAX_ASSET_BYTES = 20 * 1024 * 1024
const COALESCE_WINDOW_MS = 12_000
const HANDOFF_TTL_MS = 15 * 60 * 1000

export function resolveReelHome(explicitRoot) {
  if (explicitRoot && String(explicitRoot).trim()) {
    return path.resolve(String(explicitRoot).trim())
  }
  if (process.env.REEL_DESK_HOME && process.env.REEL_DESK_HOME.trim()) {
    return path.resolve(process.env.REEL_DESK_HOME.trim())
  }
  const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim()
    ? path.resolve(process.env.DSH_HOME.trim())
    : path.join(os.homedir(), '.dsh')
  return path.join(dshHome, 'reel-desk')
}

function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = path.join(dir, `.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`)
  const payload = JSON.stringify(value, null, 2) + '\n'
  fs.writeFileSync(tmp, payload, 'utf8')
  fs.renameSync(tmp, filePath)
}

function writeBufferAtomic(filePath, buf) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = path.join(dir, `.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`)
  fs.writeFileSync(tmp, buf)
  fs.renameSync(tmp, filePath)
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

export function assertSafeSegment(segment, label = 'id') {
  const s = String(segment ?? '').trim()
  if (!s || s.length > 96 || s.startsWith('.') || s.includes('/') || s.includes('\\') || s.includes('..')) {
    throw new Error(`非法${label}：${s || '(空)'}`)
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) {
    throw new Error(`非法${label}格式：${s}`)
  }
  return s
}

export function resolveContainedPath(rootDir, ...segments) {
  const base = fs.existsSync(rootDir) ? fs.realpathSync(rootDir) : path.resolve(rootDir)
  const candidate = path.resolve(base, ...segments)
  const rel = path.relative(base, candidate)
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('路径越界，已拒绝访问')
  }
  if (fs.existsSync(candidate)) {
    const real = fs.realpathSync(candidate)
    const realRel = path.relative(base, real)
    if (realRel === '..' || realRel.startsWith(`..${path.sep}`) || path.isAbsolute(realRel)) {
      throw new Error('符号链接越界，已拒绝访问')
    }
    return real
  }
  return candidate
}

function isInsideDir(realTarget, rootCandidate) {
  try {
    const realRoot = fs.existsSync(rootCandidate) ? fs.realpathSync(rootCandidate) : path.resolve(rootCandidate)
    const rel = path.relative(realRoot, realTarget)
    return Boolean(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
  } catch {
    return false
  }
}

function sanitizeAssetFileName(rawBaseName, fallbackExt = '.png') {
  const rawExt = path.extname(rawBaseName).toLowerCase()
  const ext = ALLOWED_IMAGE_EXTS.has(rawExt) ? rawExt : fallbackExt
  const stemRaw = path.basename(rawBaseName, path.extname(rawBaseName))
  const asciiStem = slugifyId(stemRaw, '')
  const stem = asciiStem || deriveProjectSlug(stemRaw, 'shot')
  return `${stem.slice(0, 48)}${ext}`
}

// Unmodified legacy preview.2 seed projects are treated as read-only samples rather than user projects
function isUnmodifiedSeedRecord(rec) {
  if (!rec || rec.origin !== 'seed') return false
  if ((rec.version || 1) > 1) return false
  if (Array.isArray(rec.revisions) && rec.revisions.length > 0) return false
  if (Array.isArray(rec.renders) && rec.renders.length > 0) return false
  if (Array.isArray(rec.assets) && rec.assets.length > 0) return false
  return true
}

function normalizeOriginObject(rawOrigin, fallbackBy = 'user') {
  if (rawOrigin && typeof rawOrigin === 'object' && !Array.isArray(rawOrigin)) {
    return {
      by: rawOrigin.by || fallbackBy,
      sessionId: rawOrigin.sessionId || null,
      workspaceId: rawOrigin.workspaceId || null,
      brief: rawOrigin.brief ? String(rawOrigin.brief).slice(0, 300) : '',
      sampleId: rawOrigin.sampleId || null,
    }
  }
  if (typeof rawOrigin === 'string') {
    return {
      by: rawOrigin === 'agent' ? 'agent' : (rawOrigin === 'seed' ? 'seed' : 'user'),
      sessionId: null,
      workspaceId: null,
      brief: '',
      sampleId: null,
    }
  }
  return {
    by: fallbackBy,
    sessionId: null,
    workspaceId: null,
    brief: '',
    sampleId: null,
  }
}

function buildAssetMetaMap(assets) {
  const map = {}
  for (const item of assets || []) {
    if (!item?.name) continue
    map[item.name] = {
      width: Number(item.width) || 1600,
      height: Number(item.height) || 1000,
      sizeBytes: Number(item.sizeBytes) || 0,
    }
  }
  return map
}

function diffSceneContentKeys(sceneA, sceneB) {
  if (!sceneA || !sceneB) return ['headline']
  const ignore = new Set(['id', 'rev', 'durationInFrames', 'coordSpace', 'assetDims'])
  const keys = new Set([...Object.keys(sceneA), ...Object.keys(sceneB)])
  const changed = []
  for (const k of keys) {
    if (ignore.has(k)) continue
    if (JSON.stringify(sceneA[k] ?? null) !== JSON.stringify(sceneB[k] ?? null)) {
      changed.push(k)
    }
  }
  return changed
}

export function createReelStore(options = {}) {
  const rootDir = resolveReelHome(options.rootDir)
  const projectsDir = path.join(rootDir, 'projects')
  const stateFile = path.join(rootDir, 'desk-state.json')
  const kitsFile = path.join(rootDir, 'brand-kits.json')

  function ensureInitialized() {
    fs.mkdirSync(projectsDir, { recursive: true })

    if (!fs.existsSync(kitsFile)) {
      writeJsonAtomic(kitsFile, { schemaVersion: 3, kits: DEFAULT_BRAND_KITS })
    }

    let state = readJsonSafe(stateFile, null)
    if (!state) {
      // Fresh v3 store: `projects` starts empty (`[]`), samples live in `buildSeedStoryboards()`
      const existingDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name)
        .filter(id => {
          const rec = readJsonSafe(path.join(projectsDir, id, 'project.json'), null)
          return rec?.storyboard && !isUnmodifiedSeedRecord(rec)
        })
      state = {
        schemaVersion: 3,
        activeProjectId: existingDirs[0] || null,
        pendingHandoff: null,
      }
      writeJsonAtomic(stateFile, state)
    }

    // Expire stale pendingHandoff automatically (> 15 min)
    if (state.pendingHandoff?.at) {
      const age = Date.now() - Date.parse(state.pendingHandoff.at)
      if (!Number.isFinite(age) || age > HANDOFF_TTL_MS) {
        state.pendingHandoff = null
        writeJsonAtomic(stateFile, state)
      }
    }

    return state
  }

  function allocateUniqueProjectId(rawTitleOrId) {
    ensureInitialized()
    const base = assertSafeSegment(deriveProjectSlug(rawTitleOrId, 'reel'), '项目 id')
    let candidate = base
    let suffix = 2
    while (fs.existsSync(path.join(projectsDir, candidate))) {
      const existing = readJsonSafe(path.join(projectsDir, candidate, 'project.json'), null)
      if (isUnmodifiedSeedRecord(existing)) {
        // Safe to replace an untouched legacy seed slot when explicitly creating from that sample
        candidate = `${base}-${suffix++}`
        continue
      }
      candidate = `${base}-${suffix++}`
    }
    return candidate
  }

  function listBrandKits() {
    ensureInitialized()
    const raw = readJsonSafe(kitsFile, { kits: DEFAULT_BRAND_KITS })
    const custom = Array.isArray(raw?.kits) ? raw.kits.filter(k => k && !k.builtIn) : []
    return [...DEFAULT_BRAND_KITS, ...custom]
  }

  function saveBrandKit(kitInput = {}) {
    ensureInitialized()
    const id = assertSafeSegment(deriveProjectSlug(kitInput.id || kitInput.name || 'custom-kit', 'kit'), '品牌包 id')
    if (DEFAULT_BRAND_KITS.some(k => k.id === id)) {
      throw new Error(`内置配色 "${id}" 不可覆盖，请换一个名称另存`)
    }
    const base = DEFAULT_BRAND_KITS[0]
    const hex = (v, fb) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fb)
    const kit = {
      ...base,
      id,
      name: String(kitInput.name || id).trim().slice(0, 28),
      description: String(kitInput.description || '自定义配色').trim().slice(0, 80),
      bg: hex(kitInput.bg, base.bg),
      surface: hex(kitInput.surface, base.surface),
      surfaceSubtle: hex(kitInput.surfaceSubtle, base.surfaceSubtle),
      ink: hex(kitInput.ink, base.ink),
      inkSecondary: hex(kitInput.inkSecondary, base.inkSecondary),
      accent: hex(kitInput.accent, base.accent),
      serifHeadings: kitInput.serifHeadings !== false,
      glyph: BRAND_GLYPHS.includes(kitInput.glyph) ? kitInput.glyph : 'none',
      builtIn: false,
    }
    const current = listBrandKits().filter(k => !k.builtIn && k.id !== id)
    writeJsonAtomic(kitsFile, { schemaVersion: 3, kits: [...DEFAULT_BRAND_KITS, ...current, kit] })
    return kit
  }

  function projectFileOf(projectId) {
    const safeId = assertSafeSegment(projectId, '项目 id')
    return resolveContainedPath(projectsDir, safeId, 'project.json')
  }

  function getRenderDir(projectId) {
    const safeId = assertSafeSegment(projectId, '项目 id')
    const dir = resolveContainedPath(projectsDir, safeId, 'renders')
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  function getAssetDir(projectId) {
    const safeId = assertSafeSegment(projectId, '项目 id')
    const dir = resolveContainedPath(projectsDir, safeId, 'assets')
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  function listProjectAssets(projectId, storedAssets = null) {
    const dir = getAssetDir(projectId)
    if (!fs.existsSync(dir)) return []
    const prevByName = new Map(
      Array.isArray(storedAssets) ? storedAssets.filter(a => a?.name).map(a => [a.name, a]) : [],
    )
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isFile() && !d.name.startsWith('.') && ALLOWED_IMAGE_EXTS.has(path.extname(d.name).toLowerCase()))
      .map(d => {
        const fullPath = path.join(dir, d.name)
        const st = fs.statSync(fullPath)
        const prev = prevByName.get(d.name)
        if (prev && prev.sizeBytes === st.size && prev.width && prev.height) {
          return {
            name: d.name,
            sizeBytes: st.size,
            width: prev.width,
            height: prev.height,
            source: prev.source || 'workspace',
          }
        }
        let width = 1600
        let height = 1000
        try {
          const headBuf = fs.readFileSync(fullPath)
          const info = inspectImageBuffer(headBuf)
          if (info) {
            width = info.width
            height = info.height
          }
        } catch {
          // keep fallback dimensions
        }
        return {
          name: d.name,
          sizeBytes: st.size,
          width,
          height,
          source: prev?.source || 'workspace',
        }
      })
  }

  function migrateRecordIfNeeded(record) {
    if (!record?.storyboard?.scenes) return record
    const assets = listProjectAssets(record.id, record.assets)
    const assetMeta = buildAssetMetaMap(assets)
    let dirty = false

    for (const sc of record.storyboard.scenes) {
      if (!Number.isInteger(sc.rev) || sc.rev < 1) {
        sc.rev = 1
        dirty = true
      }
      if (sc.kind === 'screen-shot') {
        if (!sc.view) {
          sc.view = { x: 0.5, y: 0, z: 1 }
          dirty = true
        }
        if ((sc.focus || sc.cursor) && sc.coordSpace !== 'image') {
          const geom = computeShotGeometry(record.storyboard, { ...sc, view: null }, assetMeta)
          if (sc.focus) {
            sc.focus = shotViewportRectToImage(geom, sc.focus)
          }
          if (sc.cursor) {
            sc.cursor = { ...sc.cursor, ...shotViewportToImage(geom, sc.cursor) }
          }
          sc.coordSpace = 'image'
          dirty = true
        } else if (!sc.coordSpace) {
          sc.coordSpace = 'image'
          dirty = true
        }
      }
    }

    if (typeof record.origin === 'string') {
      record.origin = record.origin === 'seed' ? 'seed' : normalizeOriginObject(record.origin)
      if (record.origin !== 'seed') dirty = true
    }

    record.assets = assets
    record.storyboard.assetMeta = assetMeta

    if (dirty && record.origin !== 'seed') {
      writeJsonAtomic(projectFileOf(record.id), record)
    }
    return record
  }

  function readProjectRecord(projectId) {
    ensureInitialized()
    const file = projectFileOf(projectId)
    const record = readJsonSafe(file, null)
    if (!record || !record.storyboard) {
      throw new Error(`视频项目不存在：${projectId}`)
    }
    return migrateRecordIfNeeded(record)
  }

  function addProjectAsset(projectId, sourceFilePath, opts = {}) {
    const rec = readProjectRecord(projectId)
    const rawPath = String(sourceFilePath ?? '').trim()
    if (!rawPath) {
      throw new ReelValidationError('请提供工作区内的图片文件路径 path', 'path')
    }

    // D.1 Security invariant: `allowedRoots` MUST be non-empty!
    const allowedRoots = Array.isArray(opts.allowedRoots)
      ? opts.allowedRoots.map(r => String(r || '').trim()).filter(Boolean)
      : []
    if (allowedRoots.length === 0) {
      throw new ReelValidationError(
        '未检测到关联的工作区目录边界，已拒绝读取外部路径；请直接在面板中粘贴（⌘V）或拖入截图',
        'path',
      )
    }

    const resolvedSrc = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : path.resolve(opts.baseDir || allowedRoots[0], rawPath)

    if (!fs.existsSync(resolvedSrc)) {
      throw new Error(`找不到图片文件：${rawPath}`)
    }
    const realSrc = fs.realpathSync(resolvedSrc)
    const stat = fs.statSync(realSrc)
    if (!stat.isFile()) {
      throw new Error(`路径不是普通图片文件：${rawPath}`)
    }

    // Block sensitive host directories unconditionally
    const home = os.homedir()
    const forbiddenRoots = [
      path.join(home, '.ssh'),
      path.join(home, '.gnupg'),
      path.join(home, '.aws'),
      '/etc',
      '/private/etc',
    ]
    const dshDotDir = path.join(home, '.dsh')
    if (!isInsideDir(rootDir, dshDotDir)) {
      forbiddenRoots.push(dshDotDir)
    }
    for (const bad of forbiddenRoots) {
      if (isInsideDir(realSrc, bad)) {
        throw new Error('拒绝从受保护的系统或凭据目录导入文件，请放入项目工作区后再导入')
      }
    }

    const insideAllowed = allowedRoots.some(r => isInsideDir(realSrc, r))
    if (!insideAllowed) {
      throw new Error(`图片路径必须位于当前工作区目录内：${rawPath}`)
    }

    const ext = path.extname(realSrc).toLowerCase()
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      throw new Error(`不支持的图片格式 "${ext || '(无扩展名)'}"，仅支持 PNG / JPG / WEBP / GIF`)
    }
    if (stat.size <= 0 || stat.size > MAX_ASSET_BYTES) {
      throw new Error(`图片文件大小超出限制（最大 20MB）：${(stat.size / (1024 * 1024)).toFixed(2)} MB`)
    }

    const fileBuf = fs.readFileSync(realSrc)
    const imgInfo = inspectImageBuffer(fileBuf)
    if (!imgInfo) {
      throw new Error(`文件内容不是有效的 PNG / JPEG / WebP / GIF 图片：${rawPath}`)
    }

    const assetDir = getAssetDir(rec.id)
    const safeName = assertSafeSegment(sanitizeAssetFileName(path.basename(realSrc), imgInfo.ext), '素材文件名')
    const destPath = resolveContainedPath(assetDir, safeName)
    writeBufferAtomic(destPath, fileBuf)

    const prevFiltered = (rec.assets || []).filter(a => a.name !== safeName)
    const nextAssetEntry = {
      name: safeName,
      sizeBytes: fileBuf.length,
      width: imgInfo.width,
      height: imgInfo.height,
      source: 'workspace',
    }
    const assets = listProjectAssets(rec.id, [...prevFiltered, nextAssetEntry])
    const assetMeta = buildAssetMetaMap(assets)
    const nextOrigin = rec.origin === 'seed' ? normalizeOriginObject('user') : rec.origin

    const updated = {
      ...rec,
      origin: nextOrigin,
      updatedAt: new Date().toISOString(),
      assets,
      storyboard: {
        ...rec.storyboard,
        assetMeta,
      },
    }
    writeJsonAtomic(projectFileOf(rec.id), updated)

    return {
      projectId: rec.id,
      asset: safeName,
      sizeBytes: fileBuf.length,
      width: imgInfo.width,
      height: imgInfo.height,
      destPath,
      assets,
    }
  }

  function addUploadedAssetBuffer(projectId, buf, originalName = '') {
    const rec = readProjectRecord(projectId)
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      const err = new Error('上传的图片内容为空')
      err.status = 400
      throw err
    }
    if (buf.length > MAX_UPLOAD_ASSET_BYTES) {
      const err = new Error(`粘贴或拖入的图片不能超过 10 MB（当前 ${(buf.length / (1024 * 1024)).toFixed(2)} MB）`)
      err.status = 413
      throw err
    }
    const imgInfo = inspectImageBuffer(buf)
    if (!imgInfo) {
      const err = new Error('仅支持粘贴或拖入 PNG、JPEG、WebP 或 GIF 图片')
      err.status = 415
      throw err
    }

    const assetDir = getAssetDir(rec.id)
    const hashedName = assertSafeSegment(buildContentHashedAssetName(buf, imgInfo.ext), '素材文件名')
    const destPath = resolveContainedPath(assetDir, hashedName)
    if (!fs.existsSync(destPath)) {
      writeBufferAtomic(destPath, buf)
    }

    const prevFiltered = (rec.assets || []).filter(a => a.name !== hashedName)
    const nextEntry = {
      name: hashedName,
      originalName: originalName ? String(originalName).slice(0, 80) : undefined,
      sizeBytes: buf.length,
      width: imgInfo.width,
      height: imgInfo.height,
      source: 'upload',
    }
    const assets = listProjectAssets(rec.id, [...prevFiltered, nextEntry])
    const assetMeta = buildAssetMetaMap(assets)
    const nextOrigin = rec.origin === 'seed' ? normalizeOriginObject('user') : rec.origin

    const updated = {
      ...rec,
      origin: nextOrigin,
      updatedAt: new Date().toISOString(),
      assets,
      storyboard: {
        ...rec.storyboard,
        assetMeta,
      },
    }
    writeJsonAtomic(projectFileOf(rec.id), updated)

    return {
      projectId: rec.id,
      asset: hashedName,
      sizeBytes: buf.length,
      width: imgInfo.width,
      height: imgInfo.height,
      destPath,
      assets,
    }
  }

  function listProjects() {
    ensureInitialized()
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    const rows = []
    for (const d of entries) {
      const rawRec = readJsonSafe(path.join(projectsDir, d.name, 'project.json'), null)
      if (!rawRec?.storyboard || isUnmodifiedSeedRecord(rawRec)) continue
      const rec = migrateRecordIfNeeded(rawRec)
      const tl = computeTimeline(rec.storyboard)
      rows.push({
        id: rec.id,
        title: rec.storyboard.title,
        productTag: rec.storyboard.productTag,
        aspect: rec.storyboard.aspect,
        fps: rec.storyboard.fps,
        width: rec.storyboard.width,
        height: rec.storyboard.height,
        brandKitId: rec.storyboard.brandKitId,
        glyph: rec.storyboard.glyph || 'none',
        sceneCount: rec.storyboard.scenes.length,
        totalFrames: tl.totalFrames,
        totalDurationSec: tl.totalDurationSec,
        origin: normalizeOriginObject(rec.origin),
        version: rec.version || 1,
        revisionCount: Array.isArray(rec.revisions) ? rec.revisions.length : 0,
        lastUndoNote: Array.isArray(rec.revisions) && rec.revisions[0]?.note ? rec.revisions[0].note : null,
        renderCount: Array.isArray(rec.renders) ? rec.renders.length : 0,
        latestRender: Array.isArray(rec.renders) && rec.renders.length ? rec.renders[0] : null,
        coverStoryboard: rec.storyboard,
        updatedAt: rec.updatedAt,
      })
    }
    rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    return rows
  }

  function updateDeskState(mutator) {
    const state = ensureInitialized()
    mutator(state)
    writeJsonAtomic(stateFile, state)
    return state
  }

  function noteHandoff(info = {}) {
    const sessionId = info.sessionId ? String(info.sessionId).trim() : null
    const workspaceId = info.workspaceId ? String(info.workspaceId).trim() : null
    const brief = info.brief ? String(info.brief).trim().slice(0, 300) : ''
    const projectId = info.projectId ? String(info.projectId).trim() : null

    if (projectId) {
      const rec = readProjectRecord(projectId)
      const nextOrigin = {
        ...normalizeOriginObject(rec.origin),
        sessionId: sessionId || normalizeOriginObject(rec.origin).sessionId,
        workspaceId: workspaceId || normalizeOriginObject(rec.origin).workspaceId,
      }
      const updated = {
        ...rec,
        origin: nextOrigin,
      }
      writeJsonAtomic(projectFileOf(rec.id), updated)
      return { projectId: rec.id, origin: nextOrigin }
    }

    const pending = sessionId || brief
      ? {
          sessionId,
          workspaceId,
          brief,
          at: new Date().toISOString(),
        }
      : null
    updateDeskState(st => {
      st.pendingHandoff = pending
    })
    return { pendingHandoff: pending }
  }

  function clearHandoff() {
    updateDeskState(st => {
      st.pendingHandoff = null
    })
    return { pendingHandoff: null }
  }

  function setActiveProject(projectId) {
    readProjectRecord(projectId)
    return updateDeskState(st => { st.activeProjectId = projectId })
  }

  function saveStoryboard(rawStoryboard, meta = {}) {
    const deskState = ensureInitialized()
    const by = meta.by || 'user' // 'user' | 'agent'
    const strict = meta.strict !== undefined ? Boolean(meta.strict) : (by === 'agent')
    const warnings = []

    const explicitId = String(rawStoryboard?.id || meta.projectId || '').trim()
    const existingCandidate = explicitId
      ? readJsonSafe(path.join(projectsDir, deriveProjectSlug(explicitId, 'reel'), 'project.json'), null)
      : null
    const shouldAllocateFresh =
      !explicitId ||
      Boolean(meta.createNew) ||
      (existingCandidate && isUnmodifiedSeedRecord(existingCandidate) && meta.createNew !== false && by === 'agent')

    const targetId = shouldAllocateFresh
      ? allocateUniqueProjectId(explicitId || rawStoryboard?.title || 'reel')
      : assertSafeSegment(deriveProjectSlug(explicitId, 'reel'), '项目 id')

    const kits = listBrandKits()
    const targetKit = kits.find(k => k.id === (rawStoryboard?.brandKitId || 'paper')) || kits[0]

    const safeId = assertSafeSegment(targetId, '项目 id')
    const pDir = resolveContainedPath(projectsDir, safeId)
    fs.mkdirSync(path.join(pDir, 'renders'), { recursive: true })
    fs.mkdirSync(path.join(pDir, 'assets'), { recursive: true })
    const pFile = path.join(pDir, 'project.json')
    const rawPrev = readJsonSafe(pFile, null)
    const prev = rawPrev && !isUnmodifiedSeedRecord(rawPrev) ? migrateRecordIfNeeded(rawPrev) : null

    if (prev && Number.isInteger(meta.baseVersion) && (prev.version || 1) !== meta.baseVersion) {
      throw new ReelConflictError(
        `分镜已更新至第 ${prev.version} 版（传入的 baseVersion=${meta.baseVersion} 已过期）`,
        {
          code: 'VERSION_CONFLICT',
          currentVersion: prev.version || 1,
        },
      )
    }

    const assets = listProjectAssets(safeId, prev?.assets)
    const assetMeta = buildAssetMetaMap(assets)

    const normalized = normalizeStoryboard(
      { ...rawStoryboard, id: safeId, assetMeta },
      {
        strict,
        warnings,
        defaultGlyph: targetKit?.glyph || 'none',
      },
    )

    // Preserve or increment per-scene `rev` compared to `prev.storyboard`
    const prevSceneById = new Map((prev?.storyboard?.scenes || []).map(s => [s.id, s]))
    const changedSceneIds = []
    for (const sc of normalized.scenes) {
      const oldSc = prevSceneById.get(sc.id)
      if (!oldSc) {
        sc.rev = Number.isInteger(sc.rev) && sc.rev >= 1 ? sc.rev : 1
        changedSceneIds.push(sc.id)
      } else {
        const changedKeys = diffSceneContentKeys(oldSc, sc)
        if (changedKeys.length > 0 || sc.label !== oldSc.label) {
          sc.rev = (oldSc.rev || 1) + 1
          changedSceneIds.push(sc.id)
        } else {
          sc.rev = oldSc.rev || 1
        }
      }
    }

    const now = new Date().toISOString()
    const nowMs = Date.now()
    const defaultNote = !prev
      ? (by === 'agent' ? `排好分镜（${normalized.scenes.length} 镜）` : '新建片子')
      : (by === 'agent' ? 'DeepSeek 重排分镜' : '面板修改')
    const note = String(meta.note || defaultNote).slice(0, 64)
    const coalesceKey = meta.coalesceKey ? String(meta.coalesceKey) : ''

    // Origin & pendingHandoff claiming
    let claimedHandoff = null
    if (!prev && by === 'agent' && deskState.pendingHandoff) {
      if (!meta.sessionId || meta.sessionId === deskState.pendingHandoff.sessionId) {
        claimedHandoff = deskState.pendingHandoff
      }
    }

    const prevOrigin = prev ? normalizeOriginObject(prev.origin) : null
    const nextOrigin = prevOrigin
      ? {
          ...prevOrigin,
          sessionId: meta.sessionId || prevOrigin.sessionId || null,
          workspaceId: meta.workspaceId || prevOrigin.workspaceId || null,
        }
      : {
          by,
          sessionId: meta.sessionId || claimedHandoff?.sessionId || null,
          workspaceId: meta.workspaceId || claimedHandoff?.workspaceId || null,
          brief: normalized.brief || claimedHandoff?.brief || '',
          sampleId: meta.sampleId || null,
        }

    const revisions = Array.isArray(prev?.revisions) ? [...prev.revisions] : []
    if (prev?.storyboard) {
      const topRev = revisions[0]
      const canCoalesce = Boolean(
        by === 'user' &&
        !meta.noCoalesce &&
        coalesceKey &&
        topRev &&
        topRev.coalesceKey === coalesceKey &&
        topRev.savedAt &&
        nowMs - Date.parse(topRev.savedAt) < COALESCE_WINDOW_MS
      )
      if (canCoalesce) {
        revisions[0] = {
          ...topRev,
          savedAt: now,
          note,
        }
      } else {
        revisions.unshift({
          at: prev.updatedAt || now,
          savedAt: now,
          version: prev.version || 1,
          by: prev.lastBy || 'user',
          sessionId: prev.lastSessionId || null,
          note: prev.lastNote || '上一版',
           prevNote: note,
          changedSceneIds: prev.lastChangedSceneIds || [],
          coalesceKey: coalesceKey || undefined,
          storyboard: prev.storyboard,
        })
        if (revisions.length > REEL_LIMITS.MAX_REVISIONS) {
          revisions.length = REEL_LIMITS.MAX_REVISIONS
        }
      }
    }

    const nextVersion = (prev?.version || 0) + 1

    // Track unacknowledged Agent changes so panel highlights `新` / `改过` + before/after + per-scene revert
    let unackedAgent = prev?.unackedAgent ? structuredClone(prev.unackedAgent) : null
    if (by === 'agent') {
      if (!prev) {
        unackedAgent = {
          kind: 'created',
          baseVersion: 0,
          toVersion: nextVersion,
          sessionId: nextOrigin.sessionId,
          note,
          sceneIds: normalized.scenes.map(s => s.id),
          baseStoryboard: null,
        }
      } else {
        const canCoalesceAgent = Boolean(
          unackedAgent &&
          unackedAgent.kind === 'patched' &&
          prev.lastBy === 'agent' &&
          unackedAgent.baseVersion >= 1 &&
          unackedAgent.baseStoryboard,
        )
        const baseSb = canCoalesceAgent ? unackedAgent.baseStoryboard : structuredClone(prev.storyboard)
        const baseVer = canCoalesceAgent ? unackedAgent.baseVersion : (prev.version || 1)
        const mergedIds = canCoalesceAgent
          ? new Set([...(unackedAgent.sceneIds || []), ...changedSceneIds])
          : new Set(changedSceneIds)
        unackedAgent = {
          kind: 'patched',
          baseVersion: baseVer,
          toVersion: nextVersion,
          sessionId: meta.sessionId || nextOrigin.sessionId,
          note,
          sceneIds: [...mergedIds],
          baseStoryboard: baseSb,
        }
      }
    } else if (meta.clearUnackedAgent || unackedAgent?.kind === 'created') {
      unackedAgent = null
    }

    const record = {
      id: safeId,
      origin: nextOrigin,
      version: nextVersion,
      lastBy: by,
      lastSessionId: meta.sessionId || nextOrigin.sessionId || null,
      lastNote: note,
      lastChangedSceneIds: changedSceneIds,
      unackedAgent,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      storyboard: normalized,
      assets,
      revisions,
      renders: Array.isArray(prev?.renders) ? prev.renders : [],
    }
    writeJsonAtomic(pFile, record)

    updateDeskState(st => {
      st.activeProjectId = safeId
      if (claimedHandoff || (!prev && by === 'agent')) {
        st.pendingHandoff = null
      }
    })

    return { ...record, warnings }
  }

  function findSceneInHistoryByRev(rec, sceneId, targetRev) {
    if (!Number.isInteger(targetRev)) return null
    for (const revEntry of rec.revisions || []) {
      const hit = (revEntry.storyboard?.scenes || []).find(s => s.id === sceneId && (s.rev || 1) === targetRev)
      if (hit) return hit
    }
    return null
  }

  function resolveSceneIndex(sb, opSpec) {
    if (opSpec.sceneId) {
      const byIdIdx = sb.scenes.findIndex(s => s.id === opSpec.sceneId)
      if (byIdIdx >= 0) return byIdIdx
    }
    return Number(opSpec.sceneIndex)
  }

  function patchScene(projectId, options = {}) {
    const rec = readProjectRecord(projectId)
    const prevSb = structuredClone(rec.storyboard)
    const prevTl = computeTimeline(prevSb)
    const sb = structuredClone(rec.storyboard)
    const by = options.by || 'user'
    const strict = options.strict !== undefined ? Boolean(options.strict) : (by === 'agent')
    const warnings = []

    const rawOps = Array.isArray(options.ops) && options.ops.length > 0
      ? options.ops
      : [options]

    // Check #18: Agent `baseVersion` conflict returns latest JSON of target scene(s) for immediate merge+retry
    if (Number.isInteger(options.baseVersion) && (rec.version || 1) !== options.baseVersion) {
      if (by === 'agent') {
        const targetScenes = rawOps
          .map(item => {
            const i = resolveSceneIndex(rec.storyboard, item)
            return Number.isInteger(i) && rec.storyboard.scenes[i]
              ? { sceneIndex: i, scene: rec.storyboard.scenes[i] }
              : null
          })
          .filter(Boolean)
        throw new ReelConflictError(
          `项目已更新至第 ${rec.version} 版（传入的 baseVersion=${options.baseVersion} 已过期）。目标镜头最新内容：${JSON.stringify(targetScenes.length ? targetScenes : rec.storyboard.scenes)}。请将你的修改合并到上述最新内容后，改传 baseVersion=${rec.version} 重试。`,
          {
            code: 'VERSION_CONFLICT',
            currentVersion: rec.version,
            latestScenes: targetScenes,
          },
        )
      }
      throw new ReelConflictError(
        `分镜已更新至第 ${rec.version} 版（基于第 ${options.baseVersion} 版）`,
        { code: 'VERSION_CONFLICT', currentVersion: rec.version },
      )
    }

    const opNotes = []
    const touchedIds = new Set()
    const autoMergedReport = []

    for (const item of rawOps) {
      const op = item.op || 'update'
      if (!['update', 'insert', 'delete', 'move'].includes(op)) {
        throw new ReelValidationError(`未知操作 op="${op}"，可选值为 update | insert | delete | move`, 'op')
      }

      if (op === 'insert') {
        const rawIdx = Number(item.sceneIndex)
        const insertAt = Number.isFinite(rawIdx) ? Math.max(0, Math.min(sb.scenes.length, rawIdx)) : sb.scenes.length
        if (sb.scenes.length >= REEL_LIMITS.MAX_SCENES) {
          throw new ReelValidationError(`单条视频最多 ${REEL_LIMITS.MAX_SCENES} 镜，无法继续插入`, 'scenes')
        }
        const rawNew = strict
          ? item.scene
          : {
              ...createStarterScene(item.scene?.kind || 'quote-kinetic', insertAt, sb.fps, null),
              ...(item.scene || {}),
            }
        const nextScene = normalizeScene(rawNew, insertAt, sb.fps, { strict, warnings })
        // Ensure unique scene ID
        let uid = nextScene.id
        let suffix = 2
        while (sb.scenes.some(s => s.id === uid)) {
          uid = `${nextScene.id}-${suffix++}`
        }
        nextScene.id = uid
        nextScene.rev = 1
        sb.scenes.splice(insertAt, 0, nextScene)
        touchedIds.add(uid)
        opNotes.push(item.note || `加一镜「${nextScene.label}」`)
      } else if (op === 'delete') {
        const idx = resolveSceneIndex(sb, item)
        if (!Number.isInteger(idx) || idx < 0 || idx >= sb.scenes.length) {
          throw new ReelValidationError(`sceneIndex 越界（当前共 ${sb.scenes.length} 镜，索引 0..${sb.scenes.length - 1}）`, 'sceneIndex')
        }
        if (sb.scenes.length <= REEL_LIMITS.MIN_SCENES) {
          throw new ReelValidationError('至少需保留 1 个分镜，不能删除最后一镜', 'scenes')
        }
        const removed = sb.scenes[idx]
        sb.scenes.splice(idx, 1)
        touchedIds.add(removed.id)
        opNotes.push(item.note || `删掉「${removed.label}」`)
      } else if (op === 'move') {
        const idx = resolveSceneIndex(sb, item)
        const toIndex = Number(item.toIndex)
        if (!Number.isInteger(idx) || idx < 0 || idx >= sb.scenes.length || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= sb.scenes.length) {
          throw new ReelValidationError('移动分镜的起止索引无效', 'sceneIndex')
        }
        const [moved] = sb.scenes.splice(idx, 1)
        sb.scenes.splice(toIndex, 0, moved)
        touchedIds.add(moved.id)
        opNotes.push(item.note || `挪动「${moved.label}」`)
      } else {
        const idx = resolveSceneIndex(sb, item)
        if (!Number.isInteger(idx) || idx < 0 || idx >= sb.scenes.length) {
          throw new ReelValidationError(`sceneIndex 越界（当前共 ${sb.scenes.length} 镜，索引 0..${sb.scenes.length - 1}）`, 'sceneIndex')
        }
        const oldScene = sb.scenes[idx]
        const rawPatch = item.scene || {}
        let effectivePatch = rawPatch

        // H.3: Per-scene `baseSceneRev` field-level merge / conflict check for panel edits
        const baseSceneRev = Number.isInteger(item.baseSceneRev)
          ? item.baseSceneRev
          : (Number.isInteger(options.baseSceneRev) ? options.baseSceneRev : null)

        if (by === 'user' && baseSceneRev !== null && (oldScene.rev || 1) !== baseSceneRev && !options.forceResolveConflict) {
          const baseScene = findSceneInHistoryByRev(rec, oldScene.id, baseSceneRev)
          const explicitFields = Array.isArray(item.changedFields) && item.changedFields.length > 0
            ? item.changedFields
            : (Array.isArray(options.changedFields) && options.changedFields.length > 0 ? options.changedFields : null)

          const clientFields = explicitFields || Object.keys(rawPatch).filter(
            k => !['id', 'rev', 'coordSpace', 'assetDims'].includes(k) &&
              JSON.stringify((baseScene || oldScene)[k] ?? null) !== JSON.stringify(rawPatch[k] ?? null),
          ).map(k => (k === 'durationInFrames' ? 'durationSec' : k))

          const uniqueClientFields = [...new Set(clientFields)]
          const serverFields = baseScene
            ? diffSceneContentKeys(baseScene, oldScene)
            : uniqueClientFields.filter(k => JSON.stringify(oldScene[k] ?? null) !== JSON.stringify(rawPatch[k] ?? null))

          const conflicting = uniqueClientFields.filter(k => {
            if (!serverFields.includes(k)) return false
            return JSON.stringify(rawPatch[k] ?? null) !== JSON.stringify(oldScene[k] ?? null)
          })

          if (conflicting.length > 0) {
            throw new ReelConflictError(
              `你和 DeepSeek 都改了第 ${idx + 1} 镜`,
              {
                code: 'SCENE_CONFLICT',
                sceneId: oldScene.id,
                sceneIndex: idx,
                fields: conflicting,
                nonConflictingFields: serverFields.filter(k => !conflicting.includes(k)),
                theirsScene: oldScene,
                baseScene: baseScene || null,
                by: rec.lastBy || 'agent',
                version: rec.version || 1,
                serverNote: rec.lastNote || '',
              },
            )
          }

          // Zero overlap! Apply ONLY the user's changed fields onto `oldScene` so server's non-conflicting fields stay intact!
          effectivePatch = {}
          for (const k of uniqueClientFields) {
            if (k === 'durationSec') {
              if (rawPatch.durationSec !== undefined) effectivePatch.durationSec = rawPatch.durationSec
              else if (rawPatch.durationInFrames !== undefined) effectivePatch.durationInFrames = rawPatch.durationInFrames
            } else if (rawPatch[k] !== undefined) {
              effectivePatch[k] = rawPatch[k]
            }
          }
          autoMergedReport.push({
            sceneId: oldScene.id,
            mergedServerFields: serverFields,
          })
        }

        const kindChanged = Boolean(effectivePatch.kind && effectivePatch.kind !== oldScene.kind)
        let merged
        if (kindChanged) {
          const baseForNewKind = strict
            ? {
                id: oldScene.id,
                rev: oldScene.rev,
                label: effectivePatch.label || PRIMITIVE_META[effectivePatch.kind]?.label || oldScene.label,
                durationSec: oldScene.durationSec,
                eyebrow: oldScene.eyebrow,
                headline: oldScene.headline,
              }
            : createStarterScene(effectivePatch.kind, idx, sb.fps, oldScene)
          merged = { ...baseForNewKind, ...effectivePatch, id: oldScene.id }
        } else {
          merged = { ...oldScene, ...effectivePatch, id: oldScene.id }
        }

        if (effectivePatch.durationSec !== undefined && effectivePatch.durationSec !== null) {
          delete merged.durationInFrames
        } else if (effectivePatch.durationInFrames !== undefined && effectivePatch.durationInFrames !== null) {
          delete merged.durationSec
        }

        const normalizedScene = normalizeScene(merged, idx, sb.fps, { strict, warnings })
        normalizedScene.id = oldScene.id
        normalizedScene.rev = oldScene.rev || 1
        sb.scenes[idx] = normalizedScene
        touchedIds.add(oldScene.id)
        opNotes.push(item.note || (kindChanged ? `把第 ${idx + 1} 镜换成「${normalizedScene.label}」` : `改第 ${idx + 1} 镜`))
      }
    }

    const actionNote = options.note || (opNotes.length === 1 ? opNotes[0] : `改了 ${opNotes.length} 处分镜`)

    const saved = saveStoryboard(sb, {
      projectId: rec.id,
      by,
      sessionId: options.sessionId || null,
      strict: false,
      coalesceKey: options.coalesceKey,
      note: actionNote,
    })

    // Build before/after pairs for Agent `PatchCard`
    const nextTl = computeTimeline(saved.storyboard)
    const prevById = new Map(prevSb.scenes.map((s, idx) => [s.id, { scene: s, index: idx }]))
    const nextById = new Map(saved.storyboard.scenes.map((s, idx) => [s.id, { scene: s, index: idx }]))
    const changedPairs = []
    for (const id of touchedIds) {
      const bef = prevById.get(id) || null
      const aft = nextById.get(id) || null
      if (bef || aft) {
        changedPairs.push({
          sceneId: id,
          sceneIndex: aft ? aft.index : bef.index,
          beforeScene: bef ? bef.scene : null,
          afterScene: aft ? aft.scene : null,
          diffKeys: bef && aft ? diffSceneContentKeys(bef.scene, aft.scene) : ['kind'],
        })
      }
    }

    return {
      ...saved,
      changedPairs,
      autoMerged: autoMergedReport,
      prevDurationSec: prevTl.totalDurationSec,
      nextDurationSec: nextTl.totalDurationSec,
      warnings: [...warnings, ...(saved.warnings || [])],
    }
  }

  function setAspect(projectId, aspect, opts = {}) {
    if (aspect !== '16:9' && aspect !== '9:16') {
      throw new ReelValidationError('画幅仅支持 "16:9" 或 "9:16"', 'aspect')
    }
    const rec = readProjectRecord(projectId)
    const sb = structuredClone(rec.storyboard)
    const preset = ASPECT_PRESETS[aspect]
    sb.aspect = aspect
    sb.width = preset.width
    sb.height = preset.height

    const assetMeta = buildAssetMetaMap(rec.assets)
    const reframed = []
    sb.scenes.forEach((sc, index) => {
      if (sc.kind === 'screen-shot' && sc.asset) {
        reframeShotForAspect(sb, sc, assetMeta)
        reframed.push({
          sceneId: sc.id,
          sceneIndex: index,
          label: sc.label,
        })
      }
    })

    const saved = saveStoryboard(sb, {
      projectId: rec.id,
      by: opts.by || 'user',
      strict: false,
      noCoalesce: true,
      note: opts.note || `换成${aspect === '9:16' ? '竖屏' : '横屏'}`,
    })
    return { ...saved, reframed }
  }

  function renameProject(projectId, newTitle) {
    const cleanTitle = String(newTitle ?? '').trim().slice(0, 60)
    if (!cleanTitle) {
      throw new ReelValidationError('片名不能为空', 'title')
    }
    const rec = readProjectRecord(projectId)
    const sb = structuredClone(rec.storyboard)
    sb.title = cleanTitle
    return saveStoryboard(sb, {
      projectId: rec.id,
      by: 'user',
      strict: false,
      noCoalesce: true,
      note: '改片名',
    })
  }

  function ackChanges(projectId, opts = {}) {
    const rec = readProjectRecord(projectId)
    if (!rec.unackedAgent) return rec
    let nextUnacked = structuredClone(rec.unackedAgent)
    if (opts.sceneId) {
      nextUnacked.sceneIds = (nextUnacked.sceneIds || []).filter(id => id !== opts.sceneId)
      if (nextUnacked.sceneIds.length === 0) {
        nextUnacked = null
      }
    } else {
      nextUnacked = null
    }
    const updated = {
      ...rec,
      unackedAgent: nextUnacked,
    }
    writeJsonAtomic(projectFileOf(rec.id), updated)
    return updated
  }

  function revertScene(projectId, sceneId, toVersion = null) {
    const rec = readProjectRecord(projectId)
    const sb = structuredClone(rec.storyboard)
    const idx = sb.scenes.findIndex(s => s.id === sceneId)
    if (idx < 0) {
      throw new Error(`找不到要退回的镜头：${sceneId}`)
    }

    let targetScene = null
    if (Number.isInteger(toVersion)) {
      const hitRev = (rec.revisions || []).find(r => r.version === toVersion)
      targetScene = hitRev?.storyboard?.scenes?.find(s => s.id === sceneId) || null
    }
    if (!targetScene && rec.unackedAgent?.baseStoryboard) {
      targetScene = rec.unackedAgent.baseStoryboard.scenes.find(s => s.id === sceneId) || null
    }
    if (!targetScene) {
      for (const revEntry of rec.revisions || []) {
        const candidate = revEntry.storyboard?.scenes?.find(s => s.id === sceneId)
        if (candidate && diffSceneContentKeys(candidate, sb.scenes[idx]).length > 0) {
          targetScene = candidate
          break
        }
      }
    }
    if (!targetScene) {
      throw new Error('没有找到这一镜改之前的版本')
    }

    sb.scenes[idx] = {
      ...structuredClone(targetScene),
      id: sceneId,
      rev: (sb.scenes[idx].rev || 1) + 1,
    }

    const saved = saveStoryboard(sb, {
      projectId: rec.id,
      by: 'user',
      strict: false,
      noCoalesce: true,
      note: `退回第 ${idx + 1} 镜`,
    })

    // Remove only this scene from `unackedAgent` so other changed scenes keep their diff cards!
    return ackChanges(saved.id, { sceneId })
  }

  function restoreVersion(projectId, targetVersion) {
    const rec = readProjectRecord(projectId)
    const ver = Number(targetVersion)
    if (ver === rec.version) return rec
    const hit = (rec.revisions || []).find(r => r.version === ver)
    if (!hit?.storyboard) {
      throw new Error(`找不到第 ${ver} 版的历史记录`)
    }
    const restoredSb = structuredClone(hit.storyboard)
    return saveStoryboard(restoredSb, {
      projectId: rec.id,
      by: 'user',
      strict: false,
      noCoalesce: true,
      clearUnackedAgent: true,
      note: `回到第 ${ver} 版`,
    })
  }

  function undoProject(projectId) {
    const rec = readProjectRecord(projectId)
    if (!Array.isArray(rec.revisions) || rec.revisions.length === 0) {
      throw new Error('当前片子没有可撤销的修改记录')
    }
    const [latestRev, ...restRevs] = rec.revisions
    const now = new Date().toISOString()
    const assets = listProjectAssets(projectId, rec.assets)
    const restoredSb = {
      ...structuredClone(latestRev.storyboard),
      assetMeta: buildAssetMetaMap(assets),
    }
    const updated = {
      ...rec,
      version: (rec.version || 1) + 1,
      lastBy: 'user',
      lastNote: `撤销「${rec.lastNote || '上一改'}」`,
      unackedAgent: null,
      updatedAt: now,
      storyboard: restoredSb,
      assets,
      revisions: restRevs,
    }
    writeJsonAtomic(projectFileOf(projectId), updated)
    return updated
  }

  function createBlankOrTemplateProject(input = {}) {
    ensureInitialized()
    const title = String(input.title || '新建产品短片').trim().slice(0, 60) || '新建产品短片'
    const candidateId = allocateUniqueProjectId(input.id || title)
    const aspect = input.aspect === '9:16' ? '9:16' : '16:9'
    const brandKitId = String(input.brandKitId || 'paper')
    const sb = {
      id: candidateId,
      title,
      productTag: String(input.productTag || '').trim().slice(0, 24),
      brief: String(input.brief || '').trim().slice(0, 200),
      aspect,
      fps: 60,
      brandKitId,
      glyph: BRAND_GLYPHS.includes(input.glyph) ? input.glyph : 'none',
      showHud: false,
      scenes: [
        createStarterScene('pain-input', 0, 60, {
          label: '一句话开场',
          headline: `${title}：把核心价值一句话讲清楚`,
        }),
        createStarterScene('quote-kinetic', 1, 60, {
          label: '核心亮点',
          headline: '三个最值得记住的产品细节',
        }),
        createStarterScene('end-cta', 2, 60, {
          label: '片尾号召',
          headline: '现在打开试试，亲自感受一下。',
        }),
      ],
    }
    return saveStoryboard(sb, {
      createNew: true,
      by: 'user',
      strict: false,
      workspaceId: input.workspaceId || null,
      note: '新建空白片子',
    })
  }

  function duplicateProject(projectId) {
    const rec = readProjectRecord(projectId)
    const newTitle = `${rec.storyboard.title}（副本）`.slice(0, 60)
    const newId = allocateUniqueProjectId(`${rec.id}-copy`)
    const clonedSb = {
      ...structuredClone(rec.storyboard),
      id: newId,
      title: newTitle,
    }
    const created = saveStoryboard(clonedSb, { createNew: true, by: 'user', strict: false, note: '复制片子' })
    const srcAssets = getAssetDir(rec.id)
    const dstAssets = getAssetDir(created.id)
    for (const item of listProjectAssets(rec.id, rec.assets)) {
      fs.copyFileSync(path.join(srcAssets, item.name), path.join(dstAssets, item.name))
    }
    return readProjectRecord(created.id)
  }

  function createFromSample(sampleId) {
    ensureInitialized()
    const seeds = buildSeedStoryboards()
    const sample = seeds.find(s => s.id === sampleId) || seeds[0]
    const freshId = allocateUniqueProjectId(`${sample.id}-mine`)
    const cloned = {
      ...structuredClone(sample),
      id: freshId,
    }
    return saveStoryboard(cloned, {
      createNew: true,
      by: 'user',
      strict: false,
      sampleId: sample.id,
      note: `从示例「${sample.title}」创建`,
    })
  }

  function deleteProject(projectId) {
    const safeId = assertSafeSegment(projectId, '项目 id')
    const pDir = resolveContainedPath(projectsDir, safeId)
    if (!fs.existsSync(pDir)) {
      throw new Error(`视频项目不存在：${safeId}`)
    }
    fs.rmSync(pDir, { recursive: true, force: true })
    const remaining = listProjects()
    const nextActive = remaining[0]?.id || null
    updateDeskState(st => {
      if (st.activeProjectId === safeId) {
        st.activeProjectId = nextActive
      }
    })
    return { deletedId: safeId, activeProjectId: nextActive }
  }

  function recordRenderOutput(projectId, renderEntry) {
    const rec = readProjectRecord(projectId)
    const renders = Array.isArray(rec.renders) ? [...rec.renders] : []
    renders.unshift(renderEntry)
    if (renders.length > 12) renders.length = 12
    const updated = {
      ...rec,
      updatedAt: new Date().toISOString(),
      renders,
    }
    writeJsonAtomic(projectFileOf(projectId), updated)
    return updated
  }

  function buildAgentChangesSummary(rec) {
    if (!rec?.unackedAgent) return null
    const ua = rec.unackedAgent
    if (ua.kind === 'created') {
      return {
        kind: 'created',
        baseVersion: 0,
        toVersion: ua.toVersion || rec.version || 1,
        sessionId: ua.sessionId || normalizeOriginObject(rec.origin).sessionId,
        note: ua.note || rec.lastNote || '',
        sceneIds: (ua.sceneIds || []).filter(id => rec.storyboard.scenes.some(s => s.id === id)),
        scenes: {},
      }
    }

    const baseSb = ua.baseStoryboard
    if (!baseSb) return null
    const baseById = new Map((baseSb.scenes || []).map(s => [s.id, s]))
    const scenesMap = {}
    const activeIds = []
    for (const id of ua.sceneIds || []) {
      const curIdx = rec.storyboard.scenes.findIndex(s => s.id === id)
      if (curIdx < 0) continue
      const curSc = rec.storyboard.scenes[curIdx]
      const befSc = baseById.get(id) || null
      if (befSc) {
        const keys = diffSceneContentKeys(befSc, curSc)
        if (keys.length === 0) continue
        scenesMap[id] = {
          sceneId: id,
          sceneIndex: curIdx,
          beforeScene: befSc,
          diffKeys: keys,
          toVersion: ua.baseVersion,
        }
        activeIds.push(id)
      } else {
        scenesMap[id] = {
          sceneId: id,
          sceneIndex: curIdx,
          beforeScene: null,
          diffKeys: ['new'],
          toVersion: ua.baseVersion,
        }
        activeIds.push(id)
      }
    }
    if (activeIds.length === 0) return null

    const baseTl = computeTimeline(baseSb)
    const curTl = computeTimeline(rec.storyboard)
    return {
      kind: 'patched',
      baseVersion: ua.baseVersion,
      toVersion: ua.toVersion || rec.version,
      sessionId: ua.sessionId || normalizeOriginObject(rec.origin).sessionId,
      note: ua.note || rec.lastNote || '',
      prevDurationSec: baseTl.totalDurationSec,
      nextDurationSec: curTl.totalDurationSec,
      sceneIds: activeIds,
      scenes: scenesMap,
    }
  }

  function buildVersionHistory(rec) {
    if (!rec) return []
    const currentRow = {
      version: rec.version || 1,
      by: rec.lastBy || 'user',
      sessionId: rec.lastSessionId || null,
      note: rec.lastNote || '当前版本',
      at: rec.updatedAt,
      current: true,
    }
    const pastRows = (rec.revisions || []).map(r => ({
      version: r.version || 1,
      by: r.by || 'user',
      sessionId: r.sessionId || null,
      note: r.note || '历史修改',
      at: r.at || r.savedAt,
      current: false,
    }))
    return [currentRow, ...pastRows]
  }

  function buildSnapshot(selectedProjectId) {
    const state = ensureInitialized()
    const projects = listProjects()
    const kits = listBrandKits()
    const targetId = selectedProjectId && projects.some(p => p.id === selectedProjectId)
      ? selectedProjectId
      : (state.activeProjectId && projects.some(p => p.id === state.activeProjectId)
          ? state.activeProjectId
          : projects[0]?.id || null)

    const activeRecord = targetId ? readProjectRecord(targetId) : null
    const timeline = activeRecord ? computeTimeline(activeRecord.storyboard) : null
    const activeKit = kits.find(k => k.id === activeRecord?.storyboard?.brandKitId) || kits[0]
    const assets = activeRecord ? activeRecord.assets || [] : []

    return {
      rootDir,
      activeProjectId: targetId,
      pendingHandoff: state.pendingHandoff || null,
      projects,
      activeProject: activeRecord
        ? {
            id: activeRecord.id,
            origin: normalizeOriginObject(activeRecord.origin),
            version: activeRecord.version || 1,
            lastBy: activeRecord.lastBy || 'user',
            lastNote: activeRecord.lastNote || '',
            updatedAt: activeRecord.updatedAt,
            canUndo: Array.isArray(activeRecord.revisions) && activeRecord.revisions.length > 0,
            lastUndoNote: Array.isArray(activeRecord.revisions) && activeRecord.revisions.length > 0
              ? (activeRecord.lastNote || activeRecord.revisions[0]?.prevNote || activeRecord.revisions[0]?.note || null)
              : null,
            revisionCount: Array.isArray(activeRecord.revisions) ? activeRecord.revisions.length : 0,
            history: buildVersionHistory(activeRecord),
            agentChanges: buildAgentChangesSummary(activeRecord),
            assets,
            renders: activeRecord.renders || [],
            storyboard: activeRecord.storyboard,
            timeline,
          }
        : null,
      brandKits: kits,
      activeBrandKit: activeKit,
      samples: buildSeedStoryboards(),
      primitives: PRIMITIVE_KINDS.map(k => ({
        kind: k,
        label: PRIMITIVE_META[k].label,
        fit: PRIMITIVE_META[k].fit,
        summary: PRIMITIVE_META[k].summary,
        defaultSec: PRIMITIVE_META[k].defaultSec,
      })),
      glyphs: BRAND_GLYPHS.map(g => ({ id: g, ...BRAND_GLYPH_META[g] })),
      limits: REEL_LIMITS,
    }
  }

  return {
    rootDir,
    projectsDir,
    ensureInitialized,
    allocateUniqueProjectId,
    listBrandKits,
    saveBrandKit,
    listProjects,
    readProjectRecord,
    listProjectAssets,
    addProjectAsset,
    addUploadedAssetBuffer,
    noteHandoff,
    clearHandoff,
    setActiveProject,
    saveStoryboard,
    patchScene,
    setAspect,
    renameProject,
    ackChanges,
    revertScene,
    restoreVersion,
    undoProject,
    createBlankOrTemplateProject,
    createFromSample,
    duplicateProject,
    deleteProject,
    recordRenderOutput,
    getRenderDir,
    getAssetDir,
    buildSnapshot,
  }
}
