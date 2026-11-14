import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'

import {
  PRIMITIVE_KINDS,
  createStarterScene,
  normalizeScene,
  normalizeStoryboard,
  computeTimeline,
  ReelValidationError,
} from '../lib/schema.js'
import { KIND_LABELS } from '../shared/kinds.js'
import { createReelStore, resolveContainedPath } from '../lib/store.js'
import { REEL_SYSTEM_PROMPT, REEL_PROMPT_MAX_BYTES } from '../lib/prompt.js'
import { createReelTools } from '../lib/tools.js'
import { createReelRenderer } from '../lib/renderer.js'
import {
  renderStoryboardFrame,
  computeShotGeometry,
  shotImageRectToViewport,
} from '../shared/composition-core.js'
import { apply } from '../index.js'

const mockReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
}

function makeValidPngBuffer(width, height, fillByte = 0x55) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    let crc = 0xffffffff
    for (const b of Buffer.concat([typeBuf, data])) {
      crc ^= b
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const textChunk = chunk('tEXt', Buffer.alloc(16, fillByte))
  const idat = chunk('IDAT', Buffer.from('789c63606060000000040001', 'hex'))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, chunk('IHDR', ihdr), textChunk, idat, iend])
}

function collectTextFromTree(node, out = []) {
  if (node == null || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const item of node) collectTextFromTree(item, out)
    return out
  }
  if (typeof node === 'object' && node.children) {
    collectTextFromTree(node.children, out)
  }
  return out
}

function findNodeWhere(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findNodeWhere(item, predicate)
      if (hit) return hit
    }
    return null
  }
  if (predicate(node)) return node
  if (node.children) return findNodeWhere(node.children, predicate)
  return null
}

function createMockHostHarness({ rootDir, workspacePath, llmStreamImpl }) {
  const routes = new Map()
  const registeredTools = new Map()
  let promptSpec = null
  const effects = []

  const workspaceRegistry = {
    list: () => (workspacePath ? [{ id: 'ws-main', name: 'Agent', path: workspacePath }] : []),
    get: id => (id === 'ws-main' && workspacePath ? { id: 'ws-main', name: 'Agent', path: workspacePath } : null),
  }

  const llmService = llmStreamImpl
    ? {
        stream: llmStreamImpl,
        listProviders: async () => [
          { id: 'deepseek-official', name: 'DeepSeek' },
          { id: 'deepseek-account', name: 'DeepSeek Account' },
        ],
        listModels: async providerId => [{ provider: providerId, id: 'deepseek-chat' }],
      }
    : null

  const mockCtx = {
    workspaceRegistry,
    effect(fn) { effects.push(fn()) },
    get(service) {
      if (service === 'tools') return { get: name => registeredTools.get(name) }
      if (service === 'workspaceRegistry' || service === 'workspaces') return workspaceRegistry
      if (service === 'llm') return llmService
      if (service === 'agents') {
        return {
          defaults: {
            getSnapshot: () => ({ model: { provider: 'deepseek', model: 'deepseek-chat' } }),
          },
        }
      }
      return null
    },
    inject(deps, cb) {
      const name = deps[0]
      if (name === 'tools') {
        effects.push(cb({
          tools: {
            register(def) {
              registeredTools.set(def.name, def)
              return () => registeredTools.delete(def.name)
            },
          },
        }))
      } else if (name === 'systemPrompt') {
        effects.push(cb({
          systemPrompt: {
            section(spec) {
              promptSpec = spec
              return () => { promptSpec = null }
            },
          },
        }))
      } else if (name === 'connection') {
        effects.push(cb({
          connection: {
            fetch: {
              register(spec) {
                routes.set(spec.path, spec)
                return () => routes.delete(spec.path)
              },
            },
          },
        }))
      } else if (name === 'llm' && llmService) {
        effects.push(cb({ llm: llmService }))
      }
    },
  }

  const dispose = apply(mockCtx, { rootDir })
  return { mockCtx, routes, registeredTools, getPromptSpec: () => promptSpec, dispose }
}

test('Prompt budget + 6 DSH tool schemas + Check #1 (empty first-open projects vs read-only samples)', async () => {
  const bytes = Buffer.byteLength(REEL_SYSTEM_PROMPT, 'utf8')
  assert.ok(bytes > 100 && bytes <= REEL_PROMPT_MAX_BYTES, `Prompt bytes ${bytes} exceeds ${REEL_PROMPT_MAX_BYTES}`)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-v3-c1-'))
  try {
    const store = createReelStore({ rootDir: tmpDir })
    const snap0 = store.buildSnapshot()

    // Check #1: Fresh empty store has 0 user projects, activeProject: null, and samples separated!
    assert.equal(snap0.projects.length, 0)
    assert.equal(snap0.activeProject, null)
    assert.ok(snap0.samples.length >= 3, 'Read-only samples must be exposed separately')

    const dummyRenderer = {
      getStatus: () => ({ runtimeReady: false, browserReady: true, activeJob: null }),
      startBackgroundRender: () => ({ id: 'j1', stage: 'done' }),
      waitForJob: async id => ({ id, stage: 'done', outputPath: '/tmp/x.mp4' }),
      cancelRender: () => null,
    }
    const defs = createReelTools({ store, renderer: dummyRenderer })
    assert.equal(defs.length, 6)
    for (const def of defs) {
      assert.equal(def.parameters.type, 'object')
      for (const [propName, propSpec] of Object.entries(def.parameters.properties || {})) {
        assert.notEqual(propSpec.required, false, `${def.name}.${propName} must omit required instead of false`)
      }
    }

    const listText = await defs.find(d => d.name === 'reel_list').execute()
    assert.ok(listText.includes('我的片子 0 条') && listText.includes('暂无用户片子'))
    assert.ok(listText.includes('只读示例'))
    for (const kind of PRIMITIVE_KINDS) {
      assert.ok(listText.includes(`**${kind}**`), `reel_list missing ${kind}`)
    }

    // Creating from sample makes 1 user project; deleting it returns projects back to 0!
    const created = store.createFromSample(snap0.samples[0].id)
    assert.equal(store.listProjects().length, 1)
    store.deleteProject(created.id)
    assert.equal(store.listProjects().length, 0)
    assert.equal(store.buildSnapshot().activeProject, null)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Checks #2, #3, #4, #5: session origin binding, FilmCard/PatchCard meta, batch ops (1 version + 1 undo), and single-scene revert', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-v3-c2345-'))
  try {
    const store = createReelStore({ rootDir: tmpDir })
    const dummyRenderer = {
      getStatus: () => ({ runtimeReady: false, browserReady: true, activeJob: null }),
      startBackgroundRender: () => ({}),
      waitForJob: async () => ({}),
      cancelRender: () => null,
    }
    const tools = createReelTools({ store, renderer: dummyRenderer })
    const saveTool = tools.find(t => t.name === 'reel_save_storyboard')
    const patchTool = tools.find(t => t.name === 'reel_patch_scene')
    const getTool = tools.find(t => t.name === 'reel_get')

    // Record pending handoff first (Check #3)
    store.noteHandoff({
      sessionId: 'session-origin-001',
      workspaceId: 'ws-dot',
      brief: '给 Dot 做一条 15 秒发布片',
      aspect: '16:9',
      targetDurationSec: 15,
    })

    // Check #2: reel_save_storyboard claims pendingHandoff, records origin.sessionId, and returns FilmCard presentationMeta
    const execCtx = {
      agent: {
        id: 'session-origin-001',
        session: { id: 'session-origin-001', header: { cwd: tmpDir } },
      },
    }
    const saveRes = await saveTool.execute({
      title: 'Dot 发布片',
      scenes: [
        { id: 's1', kind: 'quote-kinetic', label: '开场', durationSec: 3.2, headline: '你不在的时候，事情没有停。', lines: ['第一句', '第二句'] },
        { id: 's2', kind: 'lego-snap', label: '机制', durationSec: 3.6, headline: '先看变化，再对上你手上的事。', blocks: [{ name: '看变化', role: '自动巡检', status: 'ready', tag: '自动' }, { name: '对齐手头', role: '补齐上下文', status: 'missing', tag: '待补', solvedTag: '已通' }] },
        { id: 's3', kind: 'end-cta', label: '收尾', durationSec: 2.6, headline: '装上 Dot，离开一会儿也不怕漏。', ctaLabel: '安装 Dot' },
      ],
    }, execCtx)

    const card = saveTool.output.presentationMeta({}, saveRes)?.reelDeskCard
    assert.ok(card, 'reel_save_storyboard must emit presentationMeta.reelDeskCard')
    assert.equal(card.kind, 'film-card')
    assert.equal(card.title, 'Dot 发布片')
    assert.equal(card.storyboard.scenes.length, 3)

    const snapAfterCreate = store.buildSnapshot(card.projectId)
    assert.equal(snapAfterCreate.pendingHandoff, null, 'pendingHandoff must be claimed on save')
    assert.equal(snapAfterCreate.activeProject.storyboard.title, card.title)
    // Check #3: origin.sessionId matches the first session!
    assert.equal(snapAfterCreate.activeProject.origin.sessionId, 'session-origin-001')
    assert.equal(snapAfterCreate.activeProject.origin.workspaceId, 'ws-dot')

    // Pure Chinese title non-collision
    const saveRes2 = await saveTool.execute({
      title: '第二条中文片',
      scenes: [{ kind: 'end-cta', headline: '第二条', ctaLabel: '试试' }],
    }, execCtx)
    assert.notEqual(saveRes2.meta.reelDeskCard.projectId, card.projectId)

    // Acknowledge initial creation so subsequent patch creates clean `patched` diff
    store.ackChanges(card.projectId)
    const verBeforeBatch = store.readProjectRecord(card.projectId).version

    // Check #4: Single reel_patch_scene call with 2 `ops` -> version + 1, and 1 undo reverts BOTH scenes!
    const patchRes = await patchTool.execute({
      id: card.projectId,
      baseVersion: verBeforeBatch,
      note: '压到 7 秒',
      ops: [
        { op: 'update', sceneIndex: 0, scene: { headline: '开场压缩版', durationSec: 2.2 } },
        { op: 'update', sceneIndex: 2, scene: { headline: '收尾压缩版', durationSec: 2.0 } },
      ],
    }, execCtx)

    const patchCard = patchTool.output.presentationMeta({}, patchRes)?.reelDeskCard
    assert.equal(patchCard.kind, 'patch-card')
    assert.equal(patchCard.pairs.length, 2)

    const recAfterBatch = store.readProjectRecord(card.projectId)
    assert.equal(recAfterBatch.version, verBeforeBatch + 1, 'Batch ops must increment version by exactly 1')
    assert.equal(recAfterBatch.storyboard.scenes[0].headline, '开场压缩版')
    assert.equal(recAfterBatch.storyboard.scenes[2].headline, '收尾压缩版')

    // Check #5: Revert ONLY scene 3 (index 2, id='s3') -> scene 3 reverts to before, while scene 1 keeps Agent's edit!
    const snapPatched = store.buildSnapshot(card.projectId)
    assert.deepEqual(snapPatched.activeProject.agentChanges.sceneIds, ['s1', 's3'])

    store.revertScene(card.projectId, 's3')
    const getTextAfterRevertS3 = await getTool.execute({ id: card.projectId })
    assert.ok(getTextAfterRevertS3.includes('装上 Dot，离开一会儿也不怕漏。'), 'Scene 3 must revert to pre-Agent headline')
    assert.ok(getTextAfterRevertS3.includes('开场压缩版'), 'Scene 1 must retain Agent edit when only Scene 3 is reverted')

    // Check #4 part 2: Undo 1 step after a batch op reverts both scenes at once!
    const verPreBatch2 = store.readProjectRecord(card.projectId).version
    await patchTool.execute({
      id: card.projectId,
      baseVersion: verPreBatch2,
      ops: [
        { op: 'update', sceneIndex: 0, scene: { headline: '二次批改一' } },
        { op: 'update', sceneIndex: 1, scene: { headline: '二次批改二' } },
      ],
    }, execCtx)
    assert.equal(store.readProjectRecord(card.projectId).version, verPreBatch2 + 1)
    store.undoProject(card.projectId)
    const afterSingleUndo = store.readProjectRecord(card.projectId)
    assert.equal(afterSingleUndo.storyboard.scenes[0].headline, '开场压缩版')
    assert.equal(afterSingleUndo.storyboard.scenes[1].headline, '先看变化，再对上你手上的事。')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})


test('Checks #7, #8, #9, #12: suggest_scene strict zero-mutation + upload hash dedup + strict workspace path containment (route & tool) + wechat capability gate', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-v3-c78912-'))
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-v3-ws-'))
  const outsidePath = path.join(tmpDir, 'outside-secret.png')
  fs.writeFileSync(outsidePath, makeValidPngBuffer(400, 300, 0x22))
  const insidePath = path.join(wsDir, 'inside-shot.png')
  fs.writeFileSync(insidePath, makeValidPngBuffer(1280, 800, 0x33))

  const prevWechat = process.env.REEL_DESK_WECHAT_CLI
  try {
    process.env.REEL_DESK_WECHAT_CLI = '/nonexistent/dsh-wechat.mjs'

    const { routes, registeredTools, dispose } = createMockHostHarness({
      rootDir: tmpDir,
      workspacePath: wsDir,
      llmStreamImpl: async function* (req) {
        if (req.provider === 'deepseek-account') {
          yield {
            type: 'finish',
            finishReason: {
              kind: 'error',
              failure: { code: 'ACCOUNT_SIGN_IN_REQUIRED', message: 'Sign in to DeepSeek' },
            },
          }
          return
        }
        assert.equal(req.provider, 'deepseek-official')
        assert.equal(req.model, 'deepseek-chat')
        yield {
          type: 'text-delta',
          text: JSON.stringify({
            candidates: [
              { why: '更口语', patch: { headline: '东西一变，Dot 先替你看一遍。' } },
              { why: '突出先知道', patch: { headline: '谁改了什么，Dot 比你先知道。' } },
              { why: '最短适合竖屏', patch: { headline: '你没空盯的，Dot 替你盯着。' } },
            ],
          }),
        }
        yield { type: 'finish', finishReason: { kind: 'stop' } }
      },
    })

    assert.equal(routes.size, 4, 'Must register view, action, asset, and media routes')

    // Check #12: Machine without ~/bin/dsh-wechat.mjs reports capabilities.wechat === false!
    const viewEmpty = await (await routes.get('/api/reel_desk/view').fetch(new Request('http://127.0.0.1/api/reel_desk/view'))).json()
    assert.equal(viewEmpty.capabilities.wechat, false, 'Check #12: wechat capability must be false when CLI is absent')
    assert.equal(viewEmpty.capabilities.inlineRewrite, true)

    // Create a project via route
    const createRes = await (await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_from_sample', sampleId: 'plugin-finder-v8' }),
    }))).json()
    const pid = createRes.snapshot.activeProject.id
    const verBeforeSuggest = createRes.snapshot.activeProject.version

    // Check #7: suggest_scene returns 3 strict-valid candidates and NEVER bumps project version or mutates disk!
    const sugRes = await (await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'suggest_scene', id: pid, sceneIndex: 0, intent: '口语一点', n: 3 }),
    }))).json()
    assert.equal(sugRes.ok, true)
    assert.equal(sugRes.candidates.length, 3)
    for (const c of sugRes.candidates) {
      const strictChecked = normalizeScene(c.scene, 0, 60, { strict: true })
      assert.equal(strictChecked.headline, c.scene.headline)
    }
    const viewAfterSuggest = await (await routes.get('/api/reel_desk/view').fetch(new Request(`http://127.0.0.1/api/reel_desk/view?project=${pid}`))).json()
    assert.equal(viewAfterSuggest.snapshot.activeProject.version, verBeforeSuggest, 'Check #7: suggest_scene must not increment version')

    // Lightweight sinceVersion polling returns unchanged: true
    const pollClean = await (await routes.get('/api/reel_desk/view').fetch(new Request(`http://127.0.0.1/api/reel_desk/view?project=${pid}&sinceVersion=${verBeforeSuggest}`))).json()
    assert.equal(pollClean.unchanged, true)

    // Check #8: Paste / upload image via POST /api/reel_desk/asset -> content-hashed file; uploading same bytes again -> no duplicate file!
    const pngBuf = makeValidPngBuffer(2880, 3120, 0x77)
    const up1 = await (await routes.get('/api/reel_desk/asset').fetch(new Request(`http://127.0.0.1/api/reel_desk/asset?id=${pid}&name=clip.png`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: pngBuf,
    }))).json()
    assert.equal(up1.ok, true)
    assert.match(up1.asset, /^shot-[0-9a-f]{12}\.png$/)
    assert.equal(up1.width, 2880)
    assert.equal(up1.height, 3120)
    const assetDir = path.join(tmpDir, 'projects', pid, 'assets')
    assert.equal(fs.readdirSync(assetDir).length, 1)

    const up2 = await (await routes.get('/api/reel_desk/asset').fetch(new Request(`http://127.0.0.1/api/reel_desk/asset?id=${pid}&name=same-again.png`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: pngBuf,
    }))).json()
    assert.equal(up2.asset, up1.asset)
    assert.equal(fs.readdirSync(assetDir).length, 1, 'Check #8: identical paste must not add duplicate file')

    // Reject >10MB with 413 and non-image with 415
    const nonImgRes = await routes.get('/api/reel_desk/asset').fetch(new Request(`http://127.0.0.1/api/reel_desk/asset?id=${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: Buffer.from('not an image'),
    }))
    assert.equal(nonImgRes.status, 415)

    // Check #9 (Part A — Panel Route): add_asset outside workspace MUST be rejected even if client forges allowedRoots!
    const forgedRes = await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_asset',
        id: pid,
        path: outsidePath,
        allowedRoots: [tmpDir, '/'],
      }),
    }))
    assert.equal(forgedRes.ok, false, 'Check #9A: Panel add_asset must ignore client allowedRoots and reject outside-workspace file')

    const etcRes = await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_asset', id: pid, path: '/etc/hosts', allowedRoots: ['/etc'] }),
    }))
    assert.equal(etcRes.ok, false)

    // Inside-workspace PNG succeeds via panel route
    const okWsAsset = await (await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_asset', id: pid, path: 'inside-shot.png', workspaceId: 'ws-main' }),
    }))).json()
    assert.equal(okWsAsset.ok, true)

    // Check #9 (Part B — Agent Tool): reel_add_asset rejects outside-workspace PNG and accepts inside-workspace PNG!
    const addAssetTool = registeredTools.get('reel_add_asset')
    const agentExec = {
      agent: {
        id: 'sess-sec-check',
        session: { id: 'sess-sec-check', header: { cwd: wsDir } },
      },
    }
    await assert.rejects(
      () => addAssetTool.execute({ id: pid, path: outsidePath }, agentExec),
      /图片路径必须位于当前工作区目录内/,
      'Check #9B: reel_add_asset must reject outside-workspace PNG when session cwd is wsDir',
    )
    await assert.rejects(
      () => addAssetTool.execute({ id: pid, path: outsidePath }, {}),
      /工作区目录/,
      'Check #9B: reel_add_asset must fail closed when exec has no session cwd',
    )
    const okToolAsset = await addAssetTool.execute({ id: pid, path: 'inside-shot.png' }, agentExec)
    assert.ok(okToolAsset.includes('已导入截图素材'))

    dispose()
  } finally {
    if (prevWechat === undefined) delete process.env.REEL_DESK_WECHAT_CLI
    else process.env.REEL_DESK_WECHAT_CLI = prevWechat
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.rmSync(wsDir, { recursive: true, force: true })
  }
})

test('Checks #6, #11, #13, #14, #15, #16, #17, #18: duration drag, inline rename, H.2 shot geometry & aspect reframing, and 3-way concurrency', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-v3-conc-'))
  try {
    const store = createReelStore({ rootDir: tmpDir })
    const dummyRenderer = {
      getStatus: () => ({ runtimeReady: false, browserReady: true, activeJob: null }),
      startBackgroundRender: () => ({}),
      waitForJob: async () => ({}),
      cancelRender: () => null,
    }
    const tools = createReelTools({ store, renderer: dummyRenderer })
    const getTool = tools.find(t => t.name === 'reel_get')
    const patchTool = tools.find(t => t.name === 'reel_patch_scene')

    const pngBuf = makeValidPngBuffer(2880, 3120, 0x44)
    const rec0 = store.saveStoryboard({
      title: '并发与取景测试片',
      aspect: '16:9',
      scenes: [
        { id: 's1', kind: 'pain-input', label: '开场', durationSec: 3.0, headline: '第一镜标题', typedQuery: '测试输入', ctaLabel: '开始' },
        { id: 's2', kind: 'quote-kinetic', label: '第二镜', durationSec: 3.0, headline: '第二镜原稿', lines: ['A', 'B'] },
        { id: 's3', kind: 'lego-snap', label: '第三镜', durationSec: 3.6, headline: '第三镜原稿', blocks: [{ name: '甲', role: '乙', status: 'ready', tag: '稳' }, { name: '丙', role: '丁', status: 'missing', tag: '待补', solvedTag: '已通' }] },
        { id: 's4', kind: 'end-cta', label: '收尾', durationSec: 2.5, headline: '第四镜原稿', ctaLabel: '试试' },
      ],
    }, { by: 'agent' })
    const pid = rec0.id
    const uploaded = store.addUploadedAssetBuffer(pid, pngBuf, 'tall-ui.png')

    // Insert a screen-shot scene with focus & cursor
    store.patchScene(pid, {
      op: 'update',
      sceneIndex: 1,
      scene: {
        id: 's2',
        kind: 'screen-shot',
        label: '真实界面特写',
        durationSec: 3.0,
        headline: '资料一变，先替你看一遍。',
        asset: uploaded.asset,
        view: { x: 0.5, y: 0, z: 1 },
        focus: { x: 0.12, y: 0.55, w: 0.45, h: 0.25 },
        cursor: { x: 0.35, y: 0.68 },
      },
      by: 'user',
    })

    // Check #11: Dragging scene 1 (index 0) right edge from 3.0s -> 4.0s updates reel_get to 4s while other scenes keep exact durations!
    store.patchScene(pid, { op: 'update', sceneIndex: 0, scene: { durationSec: 4.0 }, by: 'user' })
    const get11 = await getTool.execute({ id: pid })
    assert.ok(get11.includes('[sceneIndex=0 | id=s1') && get11.includes('(4s, frames 0..240)'), 'Check #11: scene 0 must be 4.0s')
    assert.ok(get11.includes('(3s, frames 240..420)'), 'Check #11: scene 1 duration ratio preserved')

    // Check #13: Rename label -> '今天页' (version + 1); clear label -> falls back to KIND_LABELS['screen-shot'] ('真实界面特写')
    const verPreRen = store.readProjectRecord(pid).version
    store.patchScene(pid, { op: 'update', sceneIndex: 1, scene: { label: '今天页' }, by: 'user', note: '把「真实界面特写」改名为「今天页」' })
    const recRen1 = store.readProjectRecord(pid)
    assert.equal(recRen1.version, verPreRen + 1)
    assert.equal(recRen1.storyboard.scenes[1].label, '今天页')

    store.patchScene(pid, { op: 'update', sceneIndex: 1, scene: { label: '' }, by: 'user' })
    const recRenEmpty = store.readProjectRecord(pid)
    assert.equal(recRenEmpty.storyboard.scenes[1].label, KIND_LABELS['screen-shot'], 'Check #13: empty label falls back to kind default label')

    // Check #14: Panning view.y from 0 -> 0.5 leaves `focus` image coordinates untouched, and rendered viewport box tracks same image region!
    const beforePanFocus = structuredClone(recRenEmpty.storyboard.scenes[1].focus)
    store.patchScene(pid, { op: 'update', sceneIndex: 1, scene: { view: { x: 0.5, y: 0.5, z: 1 } }, by: 'user' })
    const afterPanRec = store.readProjectRecord(pid)
    const scPan = afterPanRec.storyboard.scenes[1]
    assert.deepEqual(scPan.focus, beforePanFocus, 'Check #14: image-space focus coordinates must remain identical after panning view.y')

    const geomY0 = computeShotGeometry(afterPanRec.storyboard, { ...scPan, view: { x: 0.5, y: 0, z: 1 } }, afterPanRec.storyboard.assetMeta)
    const geomY5 = computeShotGeometry(afterPanRec.storyboard, scPan, afterPanRec.storyboard.assetMeta)
    const vpRect0 = shotImageRectToViewport(geomY0, scPan.focus)
    const vpRect5 = shotImageRectToViewport(geomY5, scPan.focus)
    assert.ok(vpRect5.y < vpRect0.y, 'Check #14: panning down shifts viewport-projected focus upward to stay anchored on the same image pixels')

    // Check #15: Switch aspect 16:9 -> 9:16 reframes screen-shot scene so focus center lands inside visible viewport [0..1], text scenes unchanged; switching back 9:16 -> 16:9 keeps exact same focus!
    const textSceneBefore = structuredClone(afterPanRec.storyboard.scenes[0])
    const tallRes = store.setAspect(pid, '9:16', { by: 'user' })
    assert.ok(tallRes.reframed.some(r => r.sceneId === 's2'), 'Check #15: reframed list must include screen-shot scene id')
    const tallSc2 = tallRes.storyboard.scenes[1]
    const tallGeom = computeShotGeometry(tallRes.storyboard, tallSc2, tallRes.storyboard.assetMeta)
    const tallVpFocus = shotImageRectToViewport(tallGeom, tallSc2.focus)
    const centerX = tallVpFocus.x + tallVpFocus.w / 2
    const centerY = tallVpFocus.y + tallVpFocus.h / 2
    assert.ok(centerX >= 0 && centerX <= 1 && centerY >= 0 && centerY <= 1, `Check #15: focus center (${centerX}, ${centerY}) must fall inside 9:16 viewport`)
    assert.equal(tallRes.storyboard.scenes[0].headline, textSceneBefore.headline, 'Check #15: text scene fields unchanged')

    const wideAgain = store.setAspect(pid, '16:9', { by: 'user' })
    assert.deepEqual(wideAgain.storyboard.scenes[1].focus, beforePanFocus, 'Check #15: switching back to 16:9 preserves original focus coordinates')

    // Check #6: Panel edits scene 2 (index 1) while Agent edits scene 4 (index 3) -> BOTH succeed without 409!
    const baseRec6 = store.readProjectRecord(pid)
    const s2Rev0 = baseRec6.storyboard.scenes[1].rev
    await patchTool.execute({
      id: pid,
      baseVersion: baseRec6.version,
      op: 'update',
      sceneIndex: 3,
      scene: { headline: '第四镜被模型改了' },
    }, {})
    const merged6 = store.patchScene(pid, {
      op: 'update',
      sceneIndex: 1,
      sceneId: 's2',
      baseSceneRev: s2Rev0,
      changedFields: ['headline'],
      scene: { headline: '第二镜被面板改了' },
      by: 'user',
    })
    assert.equal(merged6.storyboard.scenes[1].headline, '第二镜被面板改了')
    assert.equal(merged6.storyboard.scenes[3].headline, '第四镜被模型改了')

    // Check #16: Panel holds baseSceneRev on scene 3 (index 2) editing `headline`, while Agent updates scene 3 `durationSec` -> auto-merges cleanly without 409!
    const recPre16 = store.readProjectRecord(pid)
    const s3RevPre16 = recPre16.storyboard.scenes[2].rev
    await patchTool.execute({
      id: pid,
      baseVersion: recPre16.version,
      op: 'update',
      sceneIndex: 2,
      scene: { durationSec: 2.4 },
    }, {})
    const res16 = store.patchScene(pid, {
      op: 'update',
      sceneIndex: 2,
      sceneId: 's3',
      baseSceneRev: s3RevPre16,
      changedFields: ['headline'],
      scene: { headline: '面板手改第三镜标题' },
      by: 'user',
    })
    assert.equal(res16.storyboard.scenes[2].headline, '面板手改第三镜标题')
    assert.equal(res16.storyboard.scenes[2].durationSec, 2.4, 'Check #16: Agent durationSec and user headline both preserved')

    // Check #17: Both user and Agent edit scene 3 `headline` (while Agent also edits `durationSec: 2.8`) -> throws SCENE_CONFLICT (409) with theirsScene; choosing `留我的` keeps user's headline AND Agent's 2.8s duration!
    const recPre17 = store.readProjectRecord(pid)
    const s3RevPre17 = recPre17.storyboard.scenes[2].rev
    await patchTool.execute({
      id: pid,
      baseVersion: recPre17.version,
      op: 'update',
      sceneIndex: 2,
      scene: { headline: '模型的第三镜标题', durationSec: 2.8 },
    }, {})
    let caught17 = null
    try {
      store.patchScene(pid, {
        op: 'update',
        sceneIndex: 2,
        sceneId: 's3',
        baseSceneRev: s3RevPre17,
        changedFields: ['headline'],
        scene: { headline: '我的第三镜标题' },
        by: 'user',
      })
    } catch (err) {
      caught17 = err
    }
    assert.ok(caught17 && caught17.code === 'SCENE_CONFLICT', 'Check #17: overlapping headline edit must raise SCENE_CONFLICT')
    assert.ok(caught17.fields.includes('headline'))
    assert.equal(caught17.theirsScene.headline, '模型的第三镜标题')
    assert.equal(caught17.theirsScene.durationSec, 2.8)

    // User clicks `留我的` (merges user's headline onto theirsScene with forceResolveConflict: true)
    store.patchScene(pid, {
      op: 'update',
      sceneIndex: 2,
      sceneId: 's3',
      forceResolveConflict: true,
      scene: { ...caught17.theirsScene, headline: '我的第三镜标题' },
      by: 'user',
    })
    const final17 = store.readProjectRecord(pid)
    assert.equal(final17.storyboard.scenes[2].headline, '我的第三镜标题')
    assert.equal(final17.storyboard.scenes[2].durationSec, 2.8, 'Check #17: keeping mine preserves Agent non-conflicting durationSec')

    // Check #18: Agent reads `reel_get` (oldBaseVer), panel edits scene 2, Agent calls `reel_patch_scene` on scene 2 with stale `baseVersion` -> rejected with latest scene 2 JSON!
    const oldBaseVer = store.readProjectRecord(pid).version
    store.patchScene(pid, {
      op: 'update',
      sceneIndex: 1,
      sceneId: 's2',
      changedFields: ['headline'],
      scene: { headline: '面板刚刚改过的最新第二镜标题' },
      by: 'user',
    })
    await assert.rejects(
      () => patchTool.execute({
        id: pid,
        baseVersion: oldBaseVer,
        op: 'update',
        sceneIndex: 1,
        scene: { headline: '模型基于旧版本的覆盖尝试' },
      }, {}),
      err => err.message.includes('面板刚刚改过的最新第二镜标题') && err.code === 'VERSION_CONFLICT',
      'Check #18: stale Agent baseVersion must be rejected and surface the latest target scene JSON',
    )
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Check #10 + Missing Chrome + HTTP 206 Range: export freezes snapshot version, missing Chrome fails cleanly, and media serves Range', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-v3-render-'))
  const prevChrome = process.env.REEL_DESK_CHROME_EXECUTABLE
  try {
    const { routes, dispose } = createMockHostHarness({ rootDir: tmpDir })
    const created = await (await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_from_sample', sampleId: 'superagent-s3' }),
    }))).json()
    const pid = created.snapshot.activeProject.id

    // Missing Chrome check
    process.env.REEL_DESK_CHROME_EXECUTABLE = '/nonexistent/chrome'
    const failRes = await routes.get('/api/reel_desk/action').fetch(new Request('http://127.0.0.1/api/reel_desk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start_render', id: pid }),
    }))
    assert.equal(failRes.status, 422)
    const failData = await failRes.json()
    assert.equal(failData.renderer.activeJob.stage, 'failed')
    assert.equal(failData.renderer.activeJob.errorDetail.code, 'CHROME_NOT_FOUND')

    // Check #10 (Store & Snapshot stale tracking): when a render completes for version V, editing 1 character bumps version to V+1 -> stale by 1!
    const store = createReelStore({ rootDir: tmpDir })
    const vBefore = store.readProjectRecord(pid).version
    const renderDir = store.getRenderDir(pid)
    const fakeMp4 = path.join(renderDir, `${pid}-full.mp4`)
    fs.writeFileSync(fakeMp4, Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'))
    store.recordRenderOutput(pid, {
      file: `${pid}-full.mp4`,
      outputPath: fakeMp4,
      format: 'mp4',
      quality: 'full',
      version: vBefore,
      bytes: 36,
      elapsedMs: 4200,
    })

    // Edit 1 character after render recorded
    store.patchScene(pid, {
      op: 'update',
      sceneIndex: 0,
      scene: { headline: '导出完之后又改了一处标题' },
      by: 'user',
    })
    const snapAfterEdit = store.buildSnapshot(pid)
    const latestR = snapAfterEdit.activeProject.renders[0]
    assert.equal(latestR.version, vBefore)
    assert.equal(snapAfterEdit.activeProject.version - latestR.version, 1, 'Check #10: stale count equals 1 after 1 edit post-export')

    // HTTP 206 Range check
    const rangeRes = await routes.get('/api/reel_desk/media').fetch(new Request(
      `http://127.0.0.1/api/reel_desk/media?project=${encodeURIComponent(pid)}&file=${encodeURIComponent(`${pid}-full.mp4`)}`,
      { headers: { Range: 'bytes=10-15' } },
    ))
    assert.equal(rangeRes.status, 206)
    assert.equal(await rangeRes.text(), 'ABCDEF')

    // In-flight render cancellation cleans up immediately and leaves zero partial `.tmp-*` files
    if (prevChrome === undefined) delete process.env.REEL_DESK_CHROME_EXECUTABLE
    else process.env.REEL_DESK_CHROME_EXECUTABLE = prevChrome
    const fakeChrome = path.join(tmpDir, 'fake-chrome')
    fs.writeFileSync(fakeChrome, '#!/bin/sh\nsleep 10\n', { mode: 0o755 })
    process.env.REEL_DESK_CHROME_EXECUTABLE = fakeChrome
    const cancelRenderer = createReelRenderer({ store })
    const startedJob = cancelRenderer.startBackgroundRender(pid, { quality: 'draft', format: 'mp4' })
    assert.ok(['bootstrapping', 'bundling', 'rendering'].includes(startedJob.stage))
    const cancelled = cancelRenderer.cancelRender()
    assert.equal(cancelled.stage, 'cancelled')
    const settled = await cancelRenderer.waitForJob(startedJob.id, 3000)
    assert.equal(settled.stage, 'cancelled')
    const leftoverTmp = fs.readdirSync(renderDir).filter(f => f.startsWith('.tmp-'))
    assert.equal(leftoverTmp.length, 0, 'Cancelling render must leave zero .tmp-* files')

    dispose()
  } finally {
    if (prevChrome === undefined) delete process.env.REEL_DESK_CHROME_EXECUTABLE
    else process.env.REEL_DESK_CHROME_EXECUTABLE = prevChrome
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Reel Desk client panel uses official workspace.picker in RC3, picks newly mounted workspace, and falls back in RC2', async () => {
  const clientCode = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.equal(/^\s*export\s+/m.test(clientCode), false, 'client.js must contain zero ESM export statements')

  function createReactHarness() {
    const slots = []
    let cursor = 0
    const effects = []
    const React = {
      Fragment: Symbol.for('react.fragment'),
      createElement: (type, props, ...children) => ({
        type,
        props: props || {},
        children: children.flat(Infinity).filter(v => v !== null && v !== false && v !== undefined),
      }),
      useState: initial => {
        const idx = cursor++
        if (!(idx in slots)) slots[idx] = typeof initial === 'function' ? initial() : initial
        const set = updater => {
          slots[idx] = typeof updater === 'function' ? updater(slots[idx]) : updater
        }
        return [slots[idx], set]
      },
      useRef: initial => {
        const idx = cursor++
        if (!(idx in slots)) slots[idx] = { current: initial }
        return slots[idx]
      },
      useEffect: (fn, deps) => {
        const idx = cursor++
        const prev = slots[idx]
        const changed = !prev || !deps || !prev.deps || deps.some((d, i) => d !== prev.deps[i])
        if (changed) {
          effects.push(() => {
            if (prev?.cleanup) prev.cleanup()
            slots[idx] = { deps, cleanup: fn() }
          })
        }
      },
      useMemo: fn => fn(),
      useCallback: fn => fn,
    }
    return {
      React,
      render: (Component, props) => {
        cursor = 0
        return Component(props)
      },
      flush: () => {
        while (effects.length) effects.shift()()
      },
    }
  }

  function findNodes(node, pred, out = []) {
    if (!node || typeof node !== 'object') return out
    if (pred(node)) out.push(node)
    for (const c of node.children || []) findNodes(c, pred, out)
    return out
  }
  function nodeText(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (!node || typeof node !== 'object') return ''
    return (node.children || []).map(nodeText).join(' ')
  }

  async function mountWithHost({ hasFactory, guarded = false }) {
    const harness = createReactHarness()
    let loadedRow = null
    let wsItems = [{ workspaceId: 'w-main', title: '主仓库', path: '/tmp/w-main' }]
    const wsListeners = new Set()
    const mountedSlots = new Map()
    const factoryCalls = []

    const fetchMock = async () => ({
      ok: true,
      json: async () => ({
        snapshot: { projects: [], samples: [], brandKits: [], activeProject: null, pendingHandoff: null },
        renderer: { runtimeReady: false },
        capabilities: { wechat: false, inlineRewrite: true },
        workspaces: wsItems,
      }),
    })

    vm.runInNewContext(clientCode, {
      window: {
        __ModuleLoader__: { load: row => { loadedRow = row } },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      },
      fetch: fetchMock,
      performance: { now: () => 0 },
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      setTimeout,
      clearTimeout,
      setInterval: () => 1,
      clearInterval: () => {},
    })

    assert.ok(loadedRow)
    const plugin = loadedRow.factory(name => {
      assert.equal(name, 'react')
      return harness.React
    })

    const slotsSvc = {
      snapshot: root => (hasFactory && root === 'factory:workspace.picker' ? [{ type: 'factory', name: 'workspace.picker' }] : []),
      subscribe: () => () => {},
      inject: (_name, reg) => reg(),
      register: (opts, Component) => {
        mountedSlots.set(opts.name, { opts, Component })
        return () => mountedSlots.delete(opts.name)
      },
    }
    const workspacesSvc = {
      list: {
        getSnapshot: () => ({ items: wsItems }),
        subscribe: fn => {
          wsListeners.add(fn)
          return () => wsListeners.delete(fn)
        },
      },
    }
    const uiWorkspaceSvc = { state: { getSnapshot: () => ({ activeWorkspaceId: 'w-main' }) } }

    const rawCtx = guarded
      ? new Proxy({
          effect: fn => fn(),
          slots: slotsSvc,
          get(name) {
            if (name === 'slots') return slotsSvc
            if (name === 'workspaces') return workspacesSvc
            if (name === 'uiWorkspace') return uiWorkspaceSvc
            return undefined
          },
        }, {
          get(target, prop) {
            if (prop === 'inject' || prop === 'workspaces' || prop === 'uiWorkspace' || prop === 'sessions' || prop === 'uiConversation' || prop === 'conversation' || prop === 'layout') {
              throw new Error(`guarded ctx forbids direct read of "${String(prop)}"`)
            }
            return target[prop]
          },
        })
      : {
          effect: fn => fn(),
          workspaces: workspacesSvc,
          uiWorkspace: uiWorkspaceSvc,
          slots: slotsSvc,
        }

    plugin.apply(rawCtx)

    // Restraint rule: Reel Desk must NEVER occupy sidebar.session.action
    assert.equal(mountedSlots.has('sidebar.session.action'), false)

    const panelEntry = mountedSlots.get('main')
    assert.ok(panelEntry)
    const renderProps = {
      useWorkspaces: selector => selector({ items: wsItems }),
      renderFactorySlot: (name, input) => {
        factoryCalls.push({ name, input })
        return harness.React.createElement('factory-slot', { name, open: input.open })
      },
    }

    let tree = harness.render(panelEntry.Component, renderProps)
    harness.flush()
    await new Promise(r => setTimeout(r, 20))
    tree = harness.render(panelEntry.Component, renderProps)

    return {
      harness,
      panelEntry,
      renderProps,
      factoryCalls,
      tree,
      addWorkspaceAndReRender: item => {
        wsItems = [...wsItems, item]
        for (const fn of wsListeners) fn()
        return harness.render(panelEntry.Component, renderProps)
      },
    }
  }

  // 1. RC3 path: #btnWsPicker renders, opens workspace.picker, and adopts newly added workspace
  const rc3 = await mountWithHost({ hasFactory: true })
  const wsBtn = findNodes(rc3.tree, n => n.type === 'button' && n.props.id === 'btnWsPicker')[0]
  assert.ok(wsBtn, 'RC3 must render #btnWsPicker button')
  assert.match(nodeText(wsBtn), /读这个工作区：主仓库/)
  assert.equal(findNodes(rc3.tree, n => n.type === 'select').length, 0)

  wsBtn.props.onClick()
  rc3.tree = rc3.harness.render(rc3.panelEntry.Component, rc3.renderProps)
  const lastCall = rc3.factoryCalls.at(-1)
  assert.equal(lastCall.name, 'workspace.picker')
  assert.equal(lastCall.input.open, true)
  assert.equal(lastCall.input.selectedId, 'w-main')

  // Simulate directoryFlow creating & picking a brand-new workspace
  rc3.tree = rc3.addWorkspaceAndReRender({ workspaceId: 'w-fresh', title: '新加的仓库', path: '/tmp/w-fresh' })
  lastCall.input.onPick('w-fresh')
  rc3.tree = rc3.harness.render(rc3.panelEntry.Component, rc3.renderProps)
  const updatedBtn = findNodes(rc3.tree, n => n.type === 'button' && n.props.id === 'btnWsPicker')[0]
  assert.match(nodeText(updatedBtn), /读这个工作区：新加的仓库/)
  assert.equal(rc3.factoryCalls.at(-1).input.open, false)

  // 2. RC2 fallback: no #btnWsPicker, preserves static span / select
  const rc2 = await mountWithHost({ hasFactory: false })
  assert.equal(findNodes(rc2.tree, n => n.type === 'button' && n.props.id === 'btnWsPicker').length, 0)
  assert.ok(findNodes(rc2.tree, n => n.type === 'span' && n.props.className === 'rd-chip').length >= 1)

  // 3. Guarded Proxy ctx + props.useWorkspaces: resolves via ctx.get(..., false) without direct property reads
  const guarded = await mountWithHost({ hasFactory: true, guarded: true })
  const guardedBtn = findNodes(guarded.tree, n => n.type === 'button' && n.props.id === 'btnWsPicker')[0]
  assert.ok(guardedBtn)
  assert.match(nodeText(guardedBtn), /读这个工作区：主仓库/)
  guarded.tree = guarded.addWorkspaceAndReRender({ workspaceId: 'w-hook', title: '勾子新增', path: '/tmp/w-hook' })
  guarded.tree.props // keep object live
  const guardedPicker = guarded.factoryCalls.at(-1)
  guardedPicker.input.onPick('w-hook')
  guarded.tree = guarded.harness.render(guarded.panelEntry.Component, guarded.renderProps)
  const guardedUpdated = findNodes(guarded.tree, n => n.type === 'button' && n.props.id === 'btnWsPicker')[0]
  assert.match(nodeText(guardedUpdated), /读这个工作区：勾子新增/)
})
