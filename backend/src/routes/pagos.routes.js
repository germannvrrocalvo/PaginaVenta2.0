const express = require('express')

function createPaypalRouter({ orderService, paypalService, receiptEmailService }) {
  const router = express.Router()

  const getBearerToken = (req) => {
    const [scheme, token] = (req.get('authorization') || '').split(' ')
    return scheme?.toLowerCase() === 'bearer' ? token : null
  }

  const getUser = async (req) => {
    const token = getBearerToken(req)
    return token ? orderService.getUserForToken(token) : null
  }

  const handleError = (res, error) => {
    if (!error.status) console.error('Error procesando pago PayPal:', error)
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'No se pudo completar el pago con PayPal.',
    })
  }

  router.get('/paypal/config', (req, res) => {
    if (!paypalService.isConfigured()) {
      return res.status(503).json({ error: 'PayPal Sandbox no está configurado en backend/.env.' })
    }
    res.json({ clientId: paypalService.getClientId() })
  })

  router.post('/paypal/crear', async (req, res) => {
    try {
      if (typeof req.body?.orderId !== 'string') {
        return res.status(400).json({ error: 'Indica el número del pedido.' })
      }
      res.status(201).json(await orderService.createPaypalOrder(
        req.body.orderId,
        await getUser(req),
        paypalService
      ))
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/paypal/cancelar', async (req, res) => {
    try {
      if (typeof req.body?.orderId !== 'string' || typeof req.body?.paypalOrderId !== 'string') {
        return res.status(400).json({ error: 'Faltan los datos para cancelar el intento de pago.' })
      }
      await orderService.cancelPaypalOrder(
        req.body.orderId,
        req.body.paypalOrderId,
        await getUser(req)
      )
      res.status(204).end()
    } catch (error) {
      handleError(res, error)
    }
  })

  router.post('/paypal/capturar', async (req, res) => {
    try {
      if (typeof req.body?.orderId !== 'string' || typeof req.body?.paypalOrderId !== 'string') {
        return res.status(400).json({ error: 'Faltan los datos para capturar el pago.' })
      }
      const result = await orderService.capturePaypalOrder(
        req.body.orderId,
        req.body.paypalOrderId,
        await getUser(req),
        paypalService
      )
      let receipt = { sent: Boolean(result.order.payment?.receiptSentAt) }
      if (result.shouldSendReceipt) {
        try {
          const sent = await receiptEmailService.send(result.order)
          await orderService.markReceiptSent(result.order.id)
          receipt = { sent: true, previewUrl: sent.previewUrl }
        } catch (error) {
          console.error(`El pedido ${result.order.id} se pagó, pero no se pudo enviar su recibo Ethereal:`, error)
          receipt = { sent: false }
        }
      }
      res.json({ ...result.order, receipt })
    } catch (error) {
      handleError(res, error)
    }
  })

  return router
}

module.exports = { createPaypalRouter }
