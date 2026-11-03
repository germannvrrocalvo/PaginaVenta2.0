const { bearerToken, safeEqual } = require('../lib/security')

function requireIntegration(registro) {
  return async (req, res, next) => {
    const expected = process.env.BO_INTEGRATION_TOKEN
    if (!expected) {
      return res.status(503).json({ ok: false, error: 'BO_INTEGRATION_TOKEN no está configurado en el back-office.' })
    }
    const provided = bearerToken(req)
    if (!provided || !safeEqual(provided, expected)) {
      await registro.log({
        tipo_evento: 'auth.integracion',
        origen: 'n8n',
        resultado: 'error',
        codigo_http: 401,
        tipo_error: 'autenticacion',
        mensaje: `Token de integración ausente o incorrecto en ${req.method} ${req.originalUrl}`,
      })
      return res.status(401).json({ ok: false, error: 'Token de integración no válido.' })
    }
    next()
  }
}

module.exports = { requireIntegration }