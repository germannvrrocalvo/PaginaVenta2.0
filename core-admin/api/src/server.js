const express = require('express')
const cors = require('cors')
const { createPool, applySchema } = require('./db/pool')
const { HttpError } = require('./lib/errors')
const { createAuthService } = require('./services/auth')
const { createRegistroService } = require('./services/registro')
const { createPedidosService } = require('./services/pedidos')
const { createIncidenciasService } = require('./services/incidencias')
const { requireIntegration } = require('./middleware/integracion')
const { createAuthRouter } = require('./routes/auth')
const { createIntegracionRouter } = require('./routes/integracion')

function createApp({ pool }) {
  const app = express()
  const authService = createAuthService(pool)
  const registro = createRegistroService(pool)
  const pedidos = createPedidosService(pool)
  const incidencias = createIncidenciasService(pool)

  const origins = (process.env.BO_CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
  app.use(cors({ origin: origins.length ? origins : true }))
  app.use(express.json({ limit: '200kb' }))

  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ estado: 'ok', servicio: 'coreadmin-api', baseDatos: 'conectada' })
    } catch (error) {
      res.status(503).json({ estado: 'error', baseDatos: 'sin conexión', detalle: error.message })
    }
  })

  // Panel (CoreAdmin)
  app.use('/api/auth', createAuthRouter(authService))

  // Integración (n8n): protegida con BO_INTEGRATION_TOKEN
  app.use(
    '/api/integracion',
    requireIntegration(registro),
    createIntegracionRouter({ pedidos, incidencias, registro }),
  )

  // Ruta no encontrada
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} ${req.path}` })
  })

  // Errores: mismo formato JSON siempre
  app.use(async (error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      // Un JSON mal formado enviado por n8n también queda en el log
      if (req.path.startsWith('/api/integracion')) {
        await registro.log({
          tipo_evento: 'payload.invalido',
          origen: 'n8n',
          resultado: 'error',
          codigo_http: 400,
          tipo_error: 'json_invalido',
          mensaje: `JSON mal formado en ${req.method} ${req.originalUrl}`,
        })
      }
      return res.status(400).json({ ok: false, error: 'El cuerpo no es un JSON válido.' })
    }
    if (error instanceof HttpError) {
      return res.status(error.status).json({ ok: false, error: error.message, errores: error.details })
    }
    console.error(error)
    res.status(500).json({ ok: false, error: 'Error interno del back-office.' })
  })

  app.locals.authService = authService
  return app
}

async function start() {
  const pool = createPool()
  await applySchema(pool)
  console.log('Esquema de la BD aplicado')

  const app = createApp({ pool })

  const adminId = await app.locals.authService.seedAdmin({
    email: process.env.BO_ADMIN_EMAIL,
    password: process.env.BO_ADMIN_PASSWORD,
  })
  console.log(adminId ? `Admin listo: ${process.env.BO_ADMIN_EMAIL}` : 'AVISO: falta BO_ADMIN_EMAIL / BO_ADMIN_PASSWORD')
  if (!process.env.BO_INTEGRATION_TOKEN) {
    console.log('AVISO: falta BO_INTEGRATION_TOKEN (n8n no podrá llamar a la API)')
  }

  const PORT = process.env.PORT || 4000
  app.listen(PORT, () => {
    console.log(`CoreAdmin API escuchando en http://localhost:${PORT}`)
  })
}

if (require.main === module) {
  start().catch((error) => {
    console.error('No se pudo arrancar la API:', error.message)
    process.exit(1)
  })
}

module.exports = { createApp }