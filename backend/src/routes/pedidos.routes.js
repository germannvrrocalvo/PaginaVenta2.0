const express = require('express')
const { verifyTrackingToken } = require('../services/tracking-token')

function createOrdersRouter(orderService) {
  const router = express.Router()

  const getUser = async (req) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    return scheme?.toLowerCase() === 'bearer' && token
      ? await orderService.getUserForToken(token)
      : null
  }

  const handleError = (res, error) => {
    if (!error.status) console.error('Error procesando pedido:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar la solicitud.',
    })
  }

  router.post('/', async (req, res) => {
    try {
      const user = await getUser(req)
      const { items, shipping } = req.body ?? {}
      res.status(201).json(await orderService.create({ items, shipping }, user))
    } catch (error) {
      handleError(res, error)
    }
  })

  router.get('/', async (req, res) => {
    try {
      const user = await getUser(req)
      if (!user) return res.status(401).json({ error: 'Inicia sesión para consultar tus pedidos.' })
      res.json(await orderService.listFor(user))
    } catch (error) {
      handleError(res, error)
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const order = await orderService.getById(req.params.id)
      const userCanAccess = order && await orderService.canAccess(order, await getUser(req))
      const trackingCanAccess = order && verifyTrackingToken(order, req.query.tracking)
      if (!order || (!userCanAccess && !trackingCanAccess)) {
        return res.status(404).json({ error: 'Pedido no encontrado.' })
      }
      res.json(order)
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/:id/pago', async (req, res) => {
    try {
      res.json(await orderService.registerPayment(req.params.id, req.body ?? {}, await getUser(req)))
    } catch (error) {
      handleError(res, error)
    }
  })

  router.patch('/:id/estado', async (req, res) => {
    try {
      const user = await getUser(req)
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo administración puede cambiar el estado del pedido.' })
      }
      res.json(await orderService.updateStatus(req.params.id, req.body?.status))
    } catch (error) {
      handleError(res, error)
    }
  })

  return router
}

module.exports = { createOrdersRouter }
