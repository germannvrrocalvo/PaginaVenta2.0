const express = require('express')
const { bearerToken } = require('../lib/security')
const { requireAdmin } = require('../middleware/auth')

function createAuthRouter(authService) {
  const router = express.Router()

  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {}
    res.json(await authService.login(email, password))
  })

  router.get('/me', requireAdmin(authService), (req, res) => {
    res.json({ user: req.user })
  })

  router.post('/logout', async (req, res) => {
    await authService.logout(bearerToken(req))
    res.status(204).end()
  })

  return router
}

module.exports = { createAuthRouter }