const express = require('express')

function createAuthRouter(authService) {
  const router = express.Router()

  const respondWithError = (res, error) => {
    if (!error.status) console.error('Error procesando autenticación:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar la solicitud.',
    })
  }

  const getBearerToken = (req) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    return scheme?.toLowerCase() === 'bearer' ? token : null
  }

  router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body ?? {}
      if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' })
      }
      res.status(201).json(await authService.register({ name, email, password }))
    } catch (error) {
      respondWithError(res, error)
    }
  })

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
    const token = getBearerToken(req)
    try {
      const user = token && await authService.getUserForToken(token)
      if (!user) return res.status(401).json({ error: 'La sesión no es válida.' })
      res.json({ user })
    } catch (error) {
      respondWithError(res, error)
    }
  })

  router.post('/logout', async (req, res) => {
    const token = getBearerToken(req)
    try {
      if (token) await authService.revokeToken(token)
      res.status(204).end()
    } catch (error) {
      respondWithError(res, error)
    }
  })

  return router
}

module.exports = { createAuthRouter }
