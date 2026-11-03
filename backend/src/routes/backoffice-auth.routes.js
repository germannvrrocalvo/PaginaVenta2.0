const express = require('express')

function createBackofficeAuthRouter(authService) {
  const router = express.Router()

  const respondWithError = (res, error) => {
    if (!error.status) console.error('Error procesando autenticación de CoreAdmin:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar la solicitud.',
    })
  }

  const getBearerToken = (req) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    return scheme?.toLowerCase() === 'bearer' ? token : null
  }

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body ?? {}
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' })
      }
      res.json(await authService.login({ email, password }))
    } catch (error) {
      respondWithError(res, error)
    }
  })

  router.get('/me', async (req, res) => {
    try {
      const user = await authService.getUserForToken(getBearerToken(req))
      if (!user) return res.status(401).json({ error: 'La sesión no es válida.' })
      res.json({ user })
    } catch (error) {
      respondWithError(res, error)
    }
  })

  router.post('/logout', async (req, res) => {
    try {
      await authService.revokeToken(getBearerToken(req))
      res.status(204).end()
    } catch (error) {
      respondWithError(res, error)
    }
  })

  return router
}

module.exports = { createBackofficeAuthRouter }
