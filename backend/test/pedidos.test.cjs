const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createApp } = require('../src/server')
const { createAuthService } = require('../src/services/auth')
const { tokenFor } = require('../src/services/tracking-token')

let server
let baseUrl
let customerToken
let adminToken
let guestOrder
let customerOrder

const shipping = {
  nombre: 'Ada',
  apellidos: 'Ejemplo',
  email: 'ada@example.test',
  telefono: '612345678',
  direccion: 'Calle Ficticia 12',
  ciudad: 'Murcia',
  provincia: 'Murcia',
  cp: '30001',
  pais: 'España',
}

before(async () => {
  const authService = createAuthService()
  const app = createApp(authService)
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
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
  const response = await fetch(`${baseUrl}/api/pedidos${path}`, {
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

test('crea pedidos seguros y aplica acceso, stock, pago y permisos admin', async () => {
  const created = await request('', {
    method: 'POST',
    body: {
      items: [{
        productId: 'p001',
        variantId: 'aluminio-cepillado',
        qty: 2,
        price: 0,
        unitPrice: 0,
      }],
      shipping,
      totals: { total: 0 },
    },
  })
  assert.equal(created.status, 201)
  guestOrder = created.body
  assert.match(guestOrder.id, /^UC-\d{4}-\d{5}$/)
  assert.equal(guestOrder.status, 'creado')
  assert.equal(guestOrder.customer.guest, true)
  assert.equal(guestOrder.lines[0].unitPrice, 349)
  assert.equal(guestOrder.totals.subtotal, 698)
  assert.equal(guestOrder.totals.total, 698)
  const catalogResponse = await fetch(`${baseUrl}/api/productos`)
  const catalog = await catalogResponse.json()
  assert.equal(catalog.find((product) => product.id === 'p001').variants[0].stock, 7)

  assert.equal((await request(`/${guestOrder.id}`)).status, 200)
  assert.equal((await request(`/${guestOrder.id}`, { token: customerToken })).status, 200)

  const payment = await request(`/${guestOrder.id}/pago`, {
    method: 'POST',
    body: { method: 'paypal_simulado', result: 'approved' },
  })
  assert.equal(payment.status, 200)
  assert.equal(payment.body.status, 'pagado')
  const paidCatalogResponse = await fetch(`${baseUrl}/api/productos`)
  const paidCatalog = await paidCatalogResponse.json()
  assert.equal(paidCatalog.find((product) => product.id === 'p001').variants[0].stock, 5)

  const pendingOne = await request('', {
    method: 'POST',
    body: { items: [{ productId: 'p003', variantId: 'nogal-natural', qty: 2 }], shipping },
  })
  const pendingTwo = await request('', {
    method: 'POST',
    body: { items: [{ productId: 'p003', variantId: 'nogal-natural', qty: 2 }], shipping },
  })
  assert.equal(pendingOne.status, 201)
  assert.equal(pendingTwo.status, 201)
  const firstPayment = await request(`/${pendingOne.body.id}/pago`, {
    method: 'POST',
    body: { method: 'paypal_simulado', result: 'approved' },
  })
  assert.equal(firstPayment.status, 200)
  const secondPayment = await request(`/${pendingTwo.body.id}/pago`, {
    method: 'POST',
    body: { method: 'paypal_simulado', result: 'approved' },
  })
  assert.equal(secondPayment.status, 409)
  assert.equal((await request(`/${pendingTwo.body.id}`)).body.status, 'creado')
  const concurrencyCatalogResponse = await fetch(`${baseUrl}/api/productos`)
  const concurrencyCatalog = await concurrencyCatalogResponse.json()
  assert.equal(concurrencyCatalog.find((product) => product.id === 'p003').variants[0].stock, 1)

  const declinedOrder = await request('', {
    method: 'POST',
    body: { items: [{ productId: 'p002', variantId: 'aluminio-cepillado', qty: 1 }], shipping },
  })
  assert.equal(declinedOrder.status, 201)
  const declinedPayment = await request(`/${declinedOrder.body.id}/pago`, {
    method: 'POST',
    body: { method: 'paypal_simulado', result: 'declined' },
  })
  assert.equal(declinedPayment.status, 200)
  assert.equal(declinedPayment.body.status, 'con_incidencia')
  const declinedCatalogResponse = await fetch(`${baseUrl}/api/productos`)
  const declinedCatalog = await declinedCatalogResponse.json()
  assert.equal(declinedCatalog.find((product) => product.id === 'p002').variants[0].stock, 11)

  const insufficient = await request('', {
    method: 'POST',
    body: { items: [{ productId: 'p001', variantId: 'aluminio-cepillado', qty: 6 }], shipping },
  })
  assert.equal(insufficient.status, 409)

  const invalidShipping = await request('', {
    method: 'POST',
    body: {
      items: [{ productId: 'p001', variantId: null, qty: 1 }],
      shipping: { ...shipping, telefono: '123' },
    },
  })
  assert.equal(invalidShipping.status, 400)

  const registered = await request('', {
    method: 'POST',
    token: customerToken,
    body: {
      items: [{ productId: 'p002', variantId: null, qty: 1 }],
      shipping: { ...shipping, email: 'spoof@example.test' },
    },
  })
  assert.equal(registered.status, 201)
  customerOrder = registered.body
  assert.equal(customerOrder.customer.email, 'cliente@ucam.test')
  assert.equal(customerOrder.customer.guest, false)
  assert.equal(customerOrder.totals.discount, 24.9)

  assert.equal((await request(`/${customerOrder.id}`)).status, 404)
  const trackingToken = tokenFor(customerOrder)
  assert.equal((await request(`/${customerOrder.id}?tracking=${encodeURIComponent(trackingToken)}`)).status, 200)
  assert.equal((await request(`/${customerOrder.id}?tracking=${encodeURIComponent(`${trackingToken}alterado`)}`)).status, 404)
  assert.equal((await request(`/${customerOrder.id}`, { token: customerToken })).status, 200)
  assert.equal((await request(`/${guestOrder.id}/estado`, {
    method: 'PATCH',
    token: customerToken,
    body: { status: 'enviado' },
  })).status, 403)
  const updated = await request(`/${customerOrder.id}/estado`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'enviado' },
  })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.status, 'enviado')

  const ownOrders = await request('', { token: customerToken })
  assert.equal(ownOrders.status, 200)
  assert.deepEqual(ownOrders.body.map((order) => order.id), [customerOrder.id])
  const allOrders = await request('', { token: adminToken })
  assert.equal(allOrders.status, 200)
  assert.equal(allOrders.body.length, 5)
})
