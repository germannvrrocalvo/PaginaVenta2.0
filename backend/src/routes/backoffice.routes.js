const express = require('express')

function createBackofficeRouter(activityService, getUserForToken) {
  const router = express.Router()

  const requireAdmin = async (req, res) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    const user = scheme?.toLowerCase() === 'bearer' && token
      ? await getUserForToken(token)
      : null
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Solo administración puede consultar estos datos.' })
      return false
    }
    return true
  }

  const handleError = (res, error) => {
    if (!error.status) console.error('Error procesando el back office:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar la solicitud.',
    })
  }

  router.get('/Tickets_soporte', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      res.json(await activityService.listTickets())
    } catch (error) {
      handleError(res, error)
    }
  })

  router.patch('/Tickets_soporte/:reference/estado', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      res.json(await activityService.updateTicketStatus(req.params.reference, req.body?.status))
    } catch (error) {
      handleError(res, error)
    }
  })

  return router
}

module.exports = { createBackofficeRouter }
