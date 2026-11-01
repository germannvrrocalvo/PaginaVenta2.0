const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createPaypalService } = require('../src/services/paypal')
const { createReceiptEmailService } = require('../src/services/receipt-email')

test('PayPal service obtains a Sandbox token and uses PayPal request IDs', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/v1/oauth2/token')) {
      return Response.json({ access_token: 'sandbox-access-token', expires_in: 3600 })
    }
    if (url.endsWith('/v2/checkout/orders')) {
      return Response.json({ id: 'ORDER-123', status: 'CREATED' })
    }
    return Response.json({ id: 'ORDER-123', status: 'COMPLETED' })
  }
  const paypal = createPaypalService({
    clientId: 'sandbox-client-id',
    clientSecret: 'sandbox-client-secret',
    apiBase: 'https://sandbox.example.test',
    fetchImpl,
  })

  const order = await paypal.createOrder({
    orderId: 'UC-2026-01001',
    amount: 28.21,
    items: [{ name: 'UCAM Disco Vinilo (Negro)', qty: 2, unitPrice: 10 }],
    subtotal: 20,
    discount: 2,
    shipping: 10.21,
    requestId: 'UC-2026-01001-create-123',
  })
  await paypal.captureOrder('ORDER-123', 'UC-2026-01001-capture')

  assert.equal(order.id, 'ORDER-123')
  assert.equal(calls.length, 3)
  assert.equal(calls[0].options.headers.Authorization.startsWith('Basic '), true)
  assert.equal(calls[1].options.headers['PayPal-Request-Id'], 'UC-2026-01001-create-123')
  assert.equal(calls[1].options.headers.Authorization, 'Bearer sandbox-access-token')
  assert.equal(
    JSON.parse(calls[1].options.body).purchase_units[0].amount.value,
    '28.21'
  )
  assert.deepEqual(
    JSON.parse(calls[1].options.body).purchase_units[0].items,
    [{ name: 'UCAM Disco Vinilo (Negro)', quantity: '2', unit_amount: { currency_code: 'EUR', value: '10.00' } }]
  )
  assert.deepEqual(
    JSON.parse(calls[1].options.body).purchase_units[0].amount.breakdown,
    {
      item_total: { currency_code: 'EUR', value: '20.00' },
      discount: { currency_code: 'EUR', value: '2.00' },
      shipping: { currency_code: 'EUR', value: '10.21' },
    }
  )
  assert.equal(
    JSON.parse(calls[1].options.body).application_context.brand_name,
    'UCAM Stereo'
  )
  assert.equal(
    calls[2].options.headers['PayPal-Request-Id'],
    'UC-2026-01001-capture'
  )
  assert.match(calls[2].url, /\/v2\/checkout\/orders\/ORDER-123\/capture$/)
})

test('PayPal capture retries recover an already-completed order after an API conflict', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/v1/oauth2/token')) {
      return Response.json({ access_token: 'sandbox-access-token', expires_in: 3600 })
    }
    if (url.endsWith('/capture')) {
      return Response.json({
        name: 'UNPROCESSABLE_ENTITY',
        message: 'Order already captured',
        details: [{ issue: 'ORDER_ALREADY_CAPTURED' }],
      }, { status: 422 })
    }
    return Response.json({ id: 'ORDER-123', status: 'COMPLETED' })
  }
  const paypal = createPaypalService({
    clientId: 'sandbox-client-id',
    clientSecret: 'sandbox-client-secret',
    apiBase: 'https://sandbox.example.test',
    fetchImpl,
  })

  const result = await paypal.captureOrder('ORDER-123', 'UC-2026-01001-capture')
  assert.equal(result.status, 'COMPLETED')
  assert.match(calls[1].url, /\/v2\/checkout\/orders\/ORDER-123\/capture$/)
  assert.match(calls[2].url, /\/v2\/checkout\/orders\/ORDER-123$/)
})

test('Ethereal receipt service sends the order total and returns its test preview link', async () => {
  const sentMessages = []
  const etherealAccount = {
    user: 'ethereal-user',
    pass: 'ethereal-password',
    smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
  }
  const emailService = createReceiptEmailService({
    createTestAccount: async () => etherealAccount,
    createTransport: (config) => ({
      async sendMail(message) {
        sentMessages.push({ config, message })
        return { messageId: 'receipt-test-id' }
      },
    }),
    logger: { info() {} },
  })

  const receipt = await emailService.send({
    id: 'UC-2026-01001',
    customer: { email: 'buyer@example.test' },
    lines: [{ qty: 2, brand: 'UCAM', name: 'Disco', variantValue: 'Azul', unitPrice: 10 }],
    totals: { total: 26.90 },
    payment: { paypalCaptureId: 'CAPTURE-123' },
  })

  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0].config.auth.user, etherealAccount.user)
  assert.equal(sentMessages[0].message.to, 'buyer@example.test')
  assert.match(sentMessages[0].message.text, /Total: 26\.90 EUR/)
  assert.match(sentMessages[0].message.text, /CAPTURE-123/)
  assert.equal(receipt.messageId, 'receipt-test-id')
})

test('Receipt service posts paid order and tracking data to n8n when configured', async () => {
  const calls = []
  const emailService = createReceiptEmailService({
    webhookUrl: 'http://localhost:5678/webhook/ucam-pedido-pagado',
    webhookSecret: 'test-webhook-secret',
    trackingSecret: 'test-tracking-secret',
    frontendUrl: 'http://127.0.0.1:5173',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(null, { status: 200 })
    },
    logger: { info() {} },
  })

  await emailService.send({
    id: 'UC-2026-01001',
    createdAt: '2026-10-06T10:00:00.000Z',
    status: 'pagado',
    customer: {
      email: 'buyer@example.test',
      nombre: 'Cliente Prueba',
      direccionCompleta: 'Calle Prueba 1, 30001 Murcia, España',
    },
    lines: [{ qty: 2, brand: 'UCAM', name: 'Disco', variantValue: 'Azul', unitPrice: 10 }],
    totals: { subtotal: 20, discount: 2, shipping: 8.9, total: 26.9 },
    payment: { paypalCaptureId: 'CAPTURE-123' },
  })

  assert.equal(calls.length, 1)
  const payload = JSON.parse(calls[0].options.body)
  assert.equal(calls[0].options.headers['x-ucam-webhook-secret'], 'test-webhook-secret')
  assert.equal(payload.event, 'order.paid')
  assert.equal(payload.order.customer.email, 'buyer@example.test')
  assert.equal(payload.order.id, 'UC-2026-01001')
  assert.equal(payload.order.items[0].quantity, 2)
  assert.equal(payload.order.totals.total, 26.9)
  const trackingUrl = new URL(payload.order.trackingUrl)
  assert.equal(trackingUrl.pathname, '/pedido/UC-2026-01001/estado')
  assert.match(trackingUrl.searchParams.get('tracking'), /^[A-Za-z0-9_-]{43}$/)
})
