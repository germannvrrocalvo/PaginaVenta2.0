const assert = require('node:assert/strict')
const { createHash, randomBytes } = require('node:crypto')
const { join } = require('node:path')
const { after, before, test } = require('node:test')
require('dotenv').config({ path: join(__dirname, '../.env') })
const { Pool } = require('pg')
const { createApp } = require('../src/server')

const enabled = Boolean(process.env.DATABASE_URL)
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ...(process.env.PGSSL === 'true' ? { ssl: true } : {}),
}
let app
let server
let pool
let baseUrl
const paypalOrders = new Map()
const captureOverrides = []
let captureCalls = 0
let receiptCalls = 0
const paypalService = {
  getClientId: () => 'sandbox-test-client-id',
  isConfigured: () => true,
  async createOrder({ orderId, amount, items, subtotal, discount, shipping, requestId }) {
    const id = `TEST-ORDER-${randomBytes(6).toString('hex')}`
    paypalOrders.set(id, {
      id,
      status: 'CREATED',
      requestId,
      items,
      breakdown: { subtotal, discount, shipping },
      purchase_units: [{
        reference_id: orderId,
        custom_id: orderId,
        amount: { currency_code: 'EUR', value: Number(amount).toFixed(2) },
      }],
    })
    return { id, status: 'CREATED', links: [] }
  },
  async getOrder(id) {
    return paypalOrders.get(id)
  },
  async captureOrder(id) {
    captureCalls += 1
    const order = paypalOrders.get(id)
    const override = captureOverrides.shift()
    if (override) return {
      id,
      status: 'COMPLETED',
      purchase_units: [{
        reference_id: override.referenceId ?? order.purchase_units[0].reference_id,
        custom_id: order.purchase_units[0].custom_id,
        payments: {
          captures: [{
            id: `TEST-CAPTURE-${randomBytes(6).toString('hex')}`,
            status: override.status ?? 'COMPLETED',
            amount: {
              currency_code: override.currency ?? 'EUR',
              value: override.amount ?? order.purchase_units[0].amount.value,
            },
          }],
        },
      }],
    }
    return {
      id,
      status: 'COMPLETED',
      purchase_units: [{
        reference_id: order.purchase_units[0].reference_id,
        custom_id: order.purchase_units[0].custom_id,
        payments: {
          captures: [{
            id: `TEST-CAPTURE-${randomBytes(6).toString('hex')}`,
            status: 'COMPLETED',
            amount: order.purchase_units[0].amount,
          }],
        },
      }],
    }
  },
}
const receiptEmailService = {
  async send() {
    receiptCalls += 1
    return { previewUrl: 'https://ethereal.test/preview' }
  },
}

before(async () => {
  if (!enabled) return
  app = createApp(null, { paypalService, receiptEmailService })
  await app.locals.ready
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
  pool = new Pool(poolConfig)
})

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
  if (app) await app.locals.closeDatabase()
  if (pool) await pool.end()
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

test('auth, pedidos, pago, stock, tickets y eventos sobreviven al reinicio del servicio', {
  skip: !enabled && 'DATABASE_URL not configured',
}, async () => {
  const suffix = randomBytes(6).toString('hex')
  const email = `phase7-${suffix}@example.test`
  const eventTestId = `phase7-${suffix}`
  const paypalOrderId = `ORDER-${suffix}`
  const paypalCaptureId = `CAPTURE-${suffix}`
  let token
  let sessionHash
  let orderId
  let paidOrderId
  let paidPaypalOrderId
  let ticketId
  let originalStock
  let restartedApp
  let restartedServer
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@ucam.test', password: 'admin1234' },
  })
  assert.equal(adminLogin.status, 200)

  try {
    const initialCatalog = await request('/productos')
    originalStock = initialCatalog.body.find((product) => product.id === 'p010').stock
    const registration = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Fase Persistencia', email, password: 'persistencia-segura' },
    })
    assert.equal(registration.status, 201)
    token = registration.body.token
    sessionHash = createHash('sha256').update(token).digest('hex')

    const created = await request('/pedidos', {
      method: 'POST',
      token,
      body: {
        items: [{ productId: 'p010', variantId: null, qty: 1 }],
        shipping: {
          nombre: 'Ada',
          apellidos: 'Persistencia',
          email,
          telefono: '612345678',
          direccion: 'Calle Ficticia 12',
          ciudad: 'Murcia',
          provincia: 'Murcia',
          cp: '30001',
          pais: 'España',
        },
      },
    })
    assert.equal(created.status, 201)
    orderId = created.body.id

    const declined = await request(`/pedidos/${orderId}/pago`, {
      method: 'POST',
      token,
      body: {
        method: 'paypal_simulado',
        result: 'declined',
        paypalOrderId,
        paypalCaptureId,
      },
    })
    assert.equal(declined.status, 200)
    assert.equal(declined.body.payment.paypalOrderId, paypalOrderId)
    assert.equal(declined.body.payment.paypalCaptureId, paypalCaptureId)

    const paidCreated = await request('/pedidos', {
      method: 'POST',
      token,
      body: {
        items: [{ productId: 'p010', variantId: null, qty: 1 }],
        shipping: {
          nombre: 'Ada',
          apellidos: 'Persistencia',
          email,
          telefono: '612345678',
          direccion: 'Calle Ficticia 12',
          ciudad: 'Murcia',
          provincia: 'Murcia',
          cp: '30001',
          pais: 'España',
        },
      },
    })
    assert.equal(paidCreated.status, 201)
    paidOrderId = paidCreated.body.id
    const paypalOrder = await request('/pagos/paypal/crear', {
      method: 'POST',
      token,
      body: { orderId: paidOrderId, amount: 0 },
    })
    assert.equal(paypalOrder.status, 201)
    paidPaypalOrderId = paypalOrder.body.id
    assert.equal(
      paypalOrders.get(paidPaypalOrderId).purchase_units[0].amount.value,
      paidCreated.body.totals.total.toFixed(2)
    )
    assert.deepEqual(
      paypalOrders.get(paidPaypalOrderId).items,
      paidCreated.body.lines.map((line) => ({
        name: [line.brand, line.name, line.variantValue ? `(${line.variantValue})` : null]
          .filter(Boolean).join(' '),
        qty: line.qty,
        unitPrice: line.unitPrice,
      }))
    )
    assert.deepEqual(paypalOrders.get(paidPaypalOrderId).breakdown, {
      subtotal: paidCreated.body.totals.subtotal,
      discount: paidCreated.body.totals.discount,
      shipping: paidCreated.body.totals.shipping,
    })
    assert.equal((await request('/pagos/paypal/capturar', {
      method: 'POST',
      token,
      body: { orderId: paidOrderId, paypalOrderId: 'NOT-THE-ORDER' },
    })).status, 409)

    const stockBeforeCapture = (await request('/productos')).body
      .find((product) => product.id === 'p010').stock
    for (const override of [
      { amount: '0.01' },
      { currency: 'USD' },
      { referenceId: 'UC-2099-99999' },
      { status: 'PENDING' },
    ]) {
      captureOverrides.push(override)
      const invalidCapture = await request('/pagos/paypal/capturar', {
        method: 'POST',
        token,
        body: { orderId: paidOrderId, paypalOrderId: paidPaypalOrderId },
      })
      assert.ok([402, 409].includes(invalidCapture.status))
      assert.equal((await request(`/pedidos/${paidOrderId}`, { token })).body.status, 'creado')
      assert.equal(
        (await request('/productos')).body.find((product) => product.id === 'p010').stock,
        stockBeforeCapture
      )
    }

    const approved = await request('/pagos/paypal/capturar', {
      method: 'POST',
      token,
      body: { orderId: paidOrderId, paypalOrderId: paidPaypalOrderId },
    })
    assert.equal(approved.status, 200)
    assert.equal(approved.body.status, 'pagado')
    assert.equal(approved.body.payment.method, 'paypal_simulado')
    assert.equal(approved.body.receipt.sent, true)
    assert.equal(receiptCalls, 1)
    const captureCallsAfterPayment = captureCalls
    const idempotentCapture = await request('/pagos/paypal/capturar', {
      method: 'POST',
      token,
      body: { orderId: paidOrderId, paypalOrderId: paidPaypalOrderId },
    })
    assert.equal(idempotentCapture.status, 200)
    assert.equal(idempotentCapture.body.status, 'pagado')
    assert.equal(captureCalls, captureCallsAfterPayment)
    assert.equal(receiptCalls, 1)

    const event = await request('/eventos', {
      method: 'POST',
      token,
      body: { type: 'product.viewed', payload: { productId: 'p010', testId: eventTestId } },
    })
    assert.equal(event.status, 201)

    const ticket = await request('/Tickets_soporte', {
      method: 'POST',
      body: {
        name: 'Fase Persistencia',
        email,
        orderId,
        subject: 'Prueba de persistencia',
        message: 'Verificar que el ticket permanece tras reiniciar el servicio.',
      },
    })
    assert.equal(ticket.status, 201)
    ticketId = ticket.body.id

    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    server = null
    await app.locals.closeDatabase()
    app = null

    restartedApp = createApp(null, { paypalService, receiptEmailService })
    await restartedApp.locals.ready
    restartedServer = restartedApp.listen(0, '127.0.0.1')
    await new Promise((resolve) => restartedServer.once('listening', resolve))
    app = restartedApp
    server = restartedServer
    baseUrl = `http://127.0.0.1:${server.address().port}/api`

    const identity = await request('/auth/me', { token })
    assert.equal(identity.status, 200)
    assert.equal(identity.body.user.email, email)
    const persistedOrder = await request(`/pedidos/${orderId}`, { token })
    assert.equal(persistedOrder.status, 200)
    assert.equal(persistedOrder.body.payment.paypalOrderId, paypalOrderId)
    assert.equal(persistedOrder.body.status, 'con_incidencia')
    const persistedPaidOrder = await request(`/pedidos/${paidOrderId}`, { token })
    assert.equal(persistedPaidOrder.body.status, 'pagado')
    const persistedCatalog = await request('/productos')
    assert.equal(
      persistedCatalog.body.find((product) => product.id === 'p010').stock,
      originalStock - 1
    )

    const admin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@ucam.test', password: 'admin1234' },
    })
    assert.equal(admin.status, 200)
    const tickets = await request('/Tickets_soporte', { token: admin.body.token })
    assert.ok(tickets.body.some((entry) => entry.id === ticketId))
    const events = await request('/eventos', { token: admin.body.token })
    assert.ok(events.body.some((entry) => entry.payload?.testId === eventTestId))
    assert.ok(events.body.some((entry) => entry.payload?.ticketId === ticketId))
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve))
    server = null
    if (app) await app.locals.closeDatabase()
    app = null
    if (ticketId) {
      await pool.query("DELETE FROM evento WHERE datos_adicionales->>'ticketId' = $1", [ticketId])
    }
    if (eventTestId) {
      await pool.query("DELETE FROM evento WHERE datos_adicionales->>'testId' = $1", [eventTestId])
    }
    if (email) {
      await pool.query('DELETE FROM sesion WHERE token_hash = $1', [sessionHash])
      await pool.query('DELETE FROM incidencia WHERE email_contacto = $1', [email])
      await pool.query('DELETE FROM pedido WHERE envio_email = $1', [email])
      await pool.query('DELETE FROM cliente WHERE email = $1', [email])
    }
    if (originalStock !== undefined) {
      await pool.query(
        `UPDATE variante_producto SET stock = $1
         WHERE es_base AND id_producto = (SELECT id_producto FROM producto WHERE codigo = 'p010')`,
        [originalStock]
      )
    }
  }
})
