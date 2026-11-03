const { bearerToken } = require('../lib/security')

// Protege las rutas del panel: exige un token de sesión válido
function requireAdmin(authService) {
  return async (req, res, next) => {
    const user = await authService.getUserForToken(bearerToken(req))
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Sesión no válida o caducada.' })
    }
    req.user = user
    next()
  }
}

module.exports = { requireAdmin }