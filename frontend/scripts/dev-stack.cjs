const { spawn } = require('node:child_process')
const path = require('node:path')

const frontendDir = path.resolve(__dirname, '..')
const projectRoot = path.resolve(frontendDir, '..')
const idleTimeoutMs = Number(process.env.DEV_IDLE_TIMEOUT_MS) || 20 * 60 * 1000
const warningBeforeMs = Math.min(60 * 1000, Math.floor(idleTimeoutMs / 2))
let lastActivity = Date.now()
let shuttingDown = false
let warned = false

function start(label, executable, args, cwd, extraEnv = {}) {
  const child = spawn(executable, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })

  child.on('message', (message) => {
    if (message?.type === 'http-activity') {
      lastActivity = Date.now()
      warned = false
    }
  })

  child.on('error', (error) => {
    console.error(`[${label}] No se pudo iniciar: ${error.message}`)
    shutdown(1)
  })

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[${label}] Se detuvo inesperadamente (${signal || code}).`)
      shutdown(code || 1)
    }
  })

  return child
}

const backend = start(
  'backend',
  process.execPath,
  [path.join(projectRoot, 'backend', 'src', 'server.js')],
  path.join(projectRoot, 'backend'),
  { PORT: '3000' },
)
const frontend = start(
  'frontend',
  process.execPath,
  [path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'],
  frontendDir,
  { VITE_API_URL: '' },
)
const children = [backend, frontend]

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(idleTimer)
  console.log('\nDeteniendo frontend y backend...')

  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGINT')
  }

  Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', resolve)
  }))).finally(() => process.exit(exitCode))
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

const idleTimer = setInterval(() => {
  const idleFor = Date.now() - lastActivity
  const remaining = idleTimeoutMs - idleFor

  if (remaining <= 0) {
    console.log(`${Math.ceil(idleTimeoutMs / 60000)} minuto(s) sin peticiones. Cerrando los servidores y liberando los puertos.`)
    shutdown(0)
  } else if (!warned && remaining <= warningBeforeMs) {
    warned = true
    const remainingText = remaining < 60000
      ? `${Math.ceil(remaining / 1000)} segundo(s)`
      : `${Math.ceil(remaining / 60000)} minuto(s)`
    console.log(`Aviso: los servidores se apagarán en ${remainingText} si no reciben peticiones.`)
  }
}, 1000)
