const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createApp } = require('../src/server')
const { createAuthService } = require('../src/services/auth')

let server
let baseUrl
let customerToken
let adminToken

before(async () => {
  const authService = createAuthService()
  server = createApp(authService).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
  customerToken = (await authService.login({
    email: 'cliente@ucam.test',
    password: 'demo1234',
  })).token
  adminToken = (await authService.login({
    email: 'admin@ucam.test',
    password: 'admin1234',
  })).token
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  }
}

test('tickets y eventos se registran en backend y quedan restringidos a administración', async () => {
  const ticket = await request('/Tickets_soporte', {
    method: 'POST',
    body: {
      name: 'Ada Ejemplo',
      email: 'ada@example.test',
      orderId: 'UC-2026-01001',
      subject: 'Consulta sobre pedido',
      message: 'Necesito información sobre el estado de mi pedido.',
    },
  })
  assert.equal(ticket.status, 201)
  assert.match(ticket.body.id, /^INC-[A-F0-9]{8}$/)
  assert.equal(ticket.body.status, 'abierta')
  assert.equal(ticket.body.email, 'ada@example.test')

  assert.equal((await request('/Tickets_soporte')).status, 403)
  assert.equal((await request('/Tickets_soporte', { token: customerToken })).status, 403)
  const tickets = await request('/Tickets_soporte', { token: adminToken })
  assert.equal(tickets.status, 200)
  assert.equal(tickets.body.length, 1)
  assert.equal(tickets.body[0].id, ticket.body.id)

  const event = await request('/eventos', {
    method: 'POST',
    token: customerToken,
    body: {
      type: 'product.viewed',
      sessionId: 'ses_ab12cd34',
      payload: { productId: 'p001' },
    },
  })
  assert.equal(event.status, 201)
  assert.equal(event.body.user, 'cliente@ucam.test')
  assert.equal(event.body.sessionId, 'ses_ab12cd34')
  assert.equal((await request('/eventos')).status, 403)

  const events = await request('/eventos', { token: adminToken })
  assert.equal(events.status, 200)
  assert.equal(events.body.length, 2)
  assert.ok(events.body.some((entry) => entry.type === 'support.requested'))
  assert.ok(events.body.some((entry) => entry.id === event.body.id))

  assert.equal((await request('/eventos', {
    method: 'POST',
    body: { type: 'unknown.event', payload: {} },
  })).status, 400)
  assert.equal((await request('/Tickets_soporte', {
    method: 'POST',
    body: { name: 'A', email: 'bad-email', subject: 'X', message: 'corto' },
  })).status, 400)

  assert.equal((await request('/Tickets_soporte', { method: 'DELETE', token: adminToken })).status, 204)
  assert.equal((await request('/eventos', { method: 'DELETE', token: adminToken })).status, 204)
  assert.deepEqual((await request('/Tickets_soporte', { token: adminToken })).body, [])
  assert.deepEqual((await request('/eventos', { token: adminToken })).body, [])
})
