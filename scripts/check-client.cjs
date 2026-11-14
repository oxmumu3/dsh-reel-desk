const { strict: assert } = require('node:assert')
const { readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { runInNewContext } = require('node:vm')

const directory = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '..')
const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
assert.equal(manifest.name, '@oxmumu3/dsh-reel-desk', 'use the scoped Reel Desk package name')

const source = readFileSync(join(directory, manifest.exports['./client']), 'utf8')
assert.equal(/^\s*export\s+/m.test(source), false, 'client.js must not contain ESM export statements')

const factory = []
runInNewContext(source, {
  window: {
    __ModuleLoader__: { load: row => factory.push(row) },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  performance: { now: () => 0 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
})

assert.equal(factory.length, 1, 'one client factory per entry')
assert.equal(factory[0].id, manifest.name, 'the factory ID must match the package ID exactly')

const plugin = factory[0].factory(name => {
  assert.equal(name, 'react')
  return {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useRef: value => ({ current: value }),
    useMemo: fn => fn(),
    useCallback: fn => fn,
  }
})

assert.ok(plugin.inject.includes('slots'), 'wait for the host slot service')

const mounted = new Map()
const registeredEvents = []
const dispose = []
plugin.apply({
  effect(setup) {
    const clean = setup()
    if (typeof clean === 'function') dispose.push(clean)
  },
  uiConversation: {
    events: {
      register(spec) {
        registeredEvents.push(spec)
        return () => {
          const i = registeredEvents.indexOf(spec)
          if (i >= 0) registeredEvents.splice(i, 1)
        }
      },
    },
  },
  slots: {
    inject(_name, register) {
      const remove = register()
      assert.equal(typeof remove, 'function')
      return remove
    },
    register(options, Component) {
      const slotId = options.name + ':' + (options.key || options.id || 'default')
      assert.equal(mounted.has(slotId), false, `duplicate slot ${slotId}`)
      mounted.set(slotId, { options, Component })
      return () => mounted.delete(slotId)
    },
  },
})

const icon = mounted.get('sidebar.panellist:reel-desk')
const panel = mounted.get('main:reel-desk')
const turnTail = mounted.get('conversation.chat.turnTail:@oxmumu3/dsh-reel-desk')
const saveToolView = mounted.get('tool.call.toolview:reel_save_storyboard')
const patchToolView = mounted.get('tool.call.toolview:reel_patch_scene')
assert.ok(icon, 'sidebar icon registered')
assert.ok(panel, 'main panel registered')
assert.ok(turnTail, 'conversation turnTail card slot registered')
assert.ok(saveToolView, 'reel_save_storyboard toolview receipt registered')
assert.ok(patchToolView, 'reel_patch_scene toolview receipt registered')
assert.equal(registeredEvents.length, 1, 'uiConversation event projector registered')
assert.equal(icon.options.id, panel.options.key, 'sidebar entry must open its own panel')
assert.ok(icon.Component({ active: false, size: 18 }))
assert.ok(panel.Component())

for (const cleanup of dispose.reverse()) cleanup()
assert.equal(mounted.size, 0, 'plugin teardown removes its slots')
assert.equal(registeredEvents.length, 0, 'plugin teardown removes its event projectors')
console.log('Scoped bundle registration and slot lifecycle OK (@oxmumu3/dsh-reel-desk)')
