import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const r1 = spawnSync(process.execPath, [path.join(__dirname, 'check-client.cjs'), rootDir], { stdio: 'inherit' })
if (r1.status !== 0) process.exit(r1.status ?? 1)

const r2 = spawnSync(process.execPath, ['--test', path.join(rootDir, 'test', 'reel-desk.test.mjs')], { stdio: 'inherit' })
process.exit(r2.status ?? 1)
