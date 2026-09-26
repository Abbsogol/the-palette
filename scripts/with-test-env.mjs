import { spawn } from 'node:child_process'
import { testEnv } from '../tests/helpers/test-env.mjs'

const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('Usage: node scripts/with-test-env.mjs COMMAND [ARGS]')
const child = spawn(command === 'node' ? process.execPath : command, args, {
  stdio: 'inherit', env: { ...process.env, ...testEnv }, shell: false,
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })
