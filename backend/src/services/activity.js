const { randomBytes } = require('node:crypto')

const EVENT_TYPES = new Set([
  'product.viewed',
  'cart.item_added',
  'checkout.started',
  'order.created',
  'payment.simulated',
  'support.requested',
  'order.status_changed',
])

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function createActivityService({ getUserForToken, now = () => new Date() }) {
  const Tickets_soporte = []
  const events = []

  function track(type, payload, sessionId, user) {
    if (!EVENT_TYPES.has(type)) fail(400, 'El tipo de evento no es válido.')
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      fail(400, 'Los datos del evento no son válidos.')
    }
    const event = {
      id: `evt_${randomBytes(5).toString('hex')}`,
      type,
      timestamp: now().toISOString(),
      sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 40) : null,
      user: user?.email ?? null,
      payload,
    }
    events.push(event)
    return event
  }

  function createTicket(input) {
    const { name, email, orderId, subject, message } = input ?? {}
    if (typeof name !== 'string' || name.trim().length < 3) fail(400, 'Escribe tu nombre.')
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(400, 'Introduce un correo válido.')
    }
    if (orderId && (typeof orderId !== 'string' || !/^UC-\d{4}-\d{5}$/.test(orderId))) {
      fail(400, 'Formato UC-2026-01001.')
    }
    if (typeof subject !== 'string' || subject.trim().length < 4) fail(400, 'Indica un asunto.')
    if (typeof message !== 'string' || message.trim().length < 10) {
      fail(400, 'Cuéntanos qué ha pasado (mín. 10 caracteres).')
    }

    const ticket = {
      id: `INC-${randomBytes(4).toString('hex').toUpperCase()}`,
      createdAt: now().toISOString(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      orderId: orderId || null,
      subject: subject.trim(),
      message: message.trim(),
      status: 'abierta',
    }
    Tickets_soporte.push(ticket)
    track('support.requested', {
      ticketId: ticket.id,
      orderId: ticket.orderId,
      subject: ticket.subject,
    }, null, null)
    return ticket
  }

  return {
    track(input, token) {
      const user = token ? getUserForToken(token) : null
      return track(input?.type, input?.payload ?? {}, input?.sessionId, user)
    },
    createTicket,
    listEvents() {
      return [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    },
    listTickets() {
      return [...Tickets_soporte].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    clearEvents() {
      events.length = 0
    },
    clearTickets() {
      Tickets_soporte.length = 0
    },
  }
}

module.exports = { createActivityService, EVENT_TYPES }
