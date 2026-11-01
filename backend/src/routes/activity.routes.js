const express = require('express')

function createActivityRouter(activityService, getUserForToken) {
  const router = express.Router()

  const getBearerToken = (req) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    return scheme?.toLowerCase() === 'bearer' ? token : null
  }

  const requireAdmin = async (req, res) => {
    const token = getBearerToken(req)
    const user = token && await getUserForToken(token)
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Solo administración puede consultar estos datos.' })
      return false
    }
    return true
  }

  const handleError = (res, error) => {
    if (!error.status) console.error('Error procesando actividad:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar la solicitud.',
    })
  }

  router.post('/eventos', async (req, res) => {
    try {
      const event = await activityService.track(req.body, getBearerToken(req))
      res.status(201).json(event)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.get('/eventos', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      res.json(await activityService.listEvents())
    } catch (error) {
      handleError(res, error)
    }
  })

  router.delete('/eventos', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      await activityService.clearEvents()
      res.status(204).end()
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/Tickets_soporte', async (req, res) => {
    try {
      res.status(201).json(await activityService.createTicket(req.body))
    } catch (error) {
      handleError(res, error)
    }
  })

  router.get('/Tickets_soporte', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      res.json(await activityService.listTickets())
    } catch (error) {
      handleError(res, error)
    }
  })

  router.delete('/Tickets_soporte', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      await activityService.clearTickets()
      res.status(204).end()
    } catch (error) {
      handleError(res, error)
    }
  })

  return router
}

module.exports = { createActivityRouter }
