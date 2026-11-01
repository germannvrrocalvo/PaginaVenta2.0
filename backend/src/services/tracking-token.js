const { createHmac, timingSafeEqual } = require('node:crypto')

function tokenFor(order, secret = process.env.TRACKING_LINK_SECRET) {
  if (!secret) throw new Error('Falta TRACKING_LINK_SECRET en backend/.env')
  const identity = `${order.id}:${order.customer.email.trim().toLowerCase()}`
  return createHmac('sha256', secret).update(identity).digest('base64url')
}

function verifyTrackingToken(order, token, secret = process.env.TRACKING_LINK_SECRET) {
  if (!order || typeof token !== 'string' || !token || !secret) return false
  const expected = tokenFor(order, secret)
  const receivedBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

module.exports = { tokenFor, verifyTrackingToken }
