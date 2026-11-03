const express = require('express')

function createIncidentsRouter(incidentService, getUserForToken) {
  const router = express.Router()

  const requireAdmin = async (req, res) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    const user = scheme?.toLowerCase() === 'bearer' && token
      ? await getUserForToken(token)
      : null
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Solo administración puede gestionar el agente.' })
      return null
    }
    return user
  }

  const handleError = (res, error) => {
    if (!error.status) console.error('Error gestionando el agente de incidencias:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar la solicitud.',
    })
  }

  router.post('/:reference/analizar', async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return
      res.json(await incidentService.analyze(req.params.reference))
    } catch (error) {
      handleError(res, error)
    }
  })

  router.patch('/:reference/revision', async (req, res) => {
    try {
      const user = await requireAdmin(req, res)
      if (!user) return
      res.json(await incidentService.review(req.params.reference, req.body?.decision, user.email))
    } catch (error) {
      handleError(res, error)
    }
  })

  return router
}

module.exports = { createIncidentsRouter }
