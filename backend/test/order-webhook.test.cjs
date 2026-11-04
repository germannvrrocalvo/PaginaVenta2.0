const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  buildOrderCreatedEvent,
  buildOrderStatusChangedEvent,
  buildSupportRequestedEvent,
  createOrderEventOutbox,
  retryDelayMs,
} = require('../src/services/order-event-outbox')

const order = {
  id: 'UC-2026-01004',
  customerId: 42,
  customerEmail: 'cliente@example.com',
  createdAt: '2026-11-01T10:00:00.000Z',
  items: [
    { productId: 'PROD-002', name: 'Auriculares de prueba', quantity: 1, unitPrice: 79.99 },
    { productId: 'PROD-003', name: 'Altavoz de prueba', quantity: 2, unitPrice: 35 },
  ],
  total: 149.99,
}

test('construye el contrato order.created aceptado por n8n', () => {
  assert.deepEqual(buildOrderCreatedEvent(order), {
    event_id: 'order.created:UC-2026-01004',
    event_type: 'order.created',
    timestamp: '2026-11-01T10:00:00.000Z',
    order: {
      id: 'UC-2026-01004',
      customer_id: '42',
      customer_email: 'cliente@example.com',
      items: [
        { product_id: 'PROD-002', name: 'Auriculares de prueba', quantity: 1, unit_price: 79.99 },
        { product_id: 'PROD-003', name: 'Altavoz de prueba', quantity: 2, unit_price: 35 },
      ],
      total: 149.99,
      currency: 'EUR',
      status: 'pending',
      created_at: '2026-11-01T10:00:00.000Z',
    },
  })
})

test('construye support.requested para crear la incidencia mediante n8n', () => {
  assert.deepEqual(buildSupportRequestedEvent({
    incidentId: '49a972fb-755f-4a89-8230-df611f971b28',
    reference: 'INC-3DFA48',
    name: 'German',
    email: 'Cliente@UCAM.test',
    orderId: 'UC-2026-01022',
    subject: 'Mi pedido no aparece',
    message: 'Necesito ayuda con el pedido.',
    createdAt: '2026-11-03T19:28:00.000Z',
    telegramChatId: '123456',
  }), {
    event_id: 'support.requested:INC-3DFA48',
    event_type: 'support.requested',
    timestamp: '2026-11-03T19:28:00.000Z',
    incident: {
      id: '49a972fb-755f-4a89-8230-df611f971b28',
      reference: 'INC-3DFA48',
      order_id: 'UC-2026-01022',
      customer_name: 'German',
      customer_email: 'cliente@ucam.test',
      subject: 'Mi pedido no aparece',
      description: 'Necesito ayuda con el pedido.',
      priority: 'medium',
      status: 'open',
      telegram_chat_id: '123456',
    },
  })
})

test('construye el contrato order.status_changed para sincronizar el back-office', () => {
  assert.deepEqual(buildOrderStatusChangedEvent({
    id: 'UC-2026-01004',
    fromStatus: 'creado',
    toStatus: 'pagado',
    changedAt: '2026-11-01T10:05:00.000Z',
    source: 'paypal',
    changeId: 'cambio-prueba',
  }), {
    event_id: 'order.status_changed:UC-2026-01004:cambio-prueba',
    event_type: 'order.status_changed',
    timestamp: '2026-11-01T10:05:00.000Z',
    order: {
      id: 'UC-2026-01004',
      previous_status: 'creado',
      status: 'pagado',
      changed_at: '2026-11-01T10:05:00.000Z',
      change_source: 'paypal',
    },
  })
})

test('envía order.status_changed al webhook específico sin afectar order.created', async () => {
  const calls = []
  const pool = {
    query: async (sql) => {
      if (sql.includes('WITH due AS')) {
        return {
          rows: [{
            id: 22,
            event_id: 'order.status_changed:UC-2026-01004:cambio-prueba',
            event_type: 'order.status_changed',
            payload: { event_type: 'order.status_changed' },
            attempts: 1,
          }],
        }
      }
      return { rows: [] }
    },
  }
  const outbox = createOrderEventOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/orders',
    statusWebhookUrl: 'https://n8n.example.test/webhook/order-status',
    webhookSecret: 'test-only-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return { ok: true, status: 200 }
    },
    logger: { info() {}, error() {}, warn() {} },
  })

  await outbox.processBatch()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://n8n.example.test/webhook/order-status')
})

test('encola el evento dentro de la transacción del pedido', async () => {
  const calls = []
  const client = { query: async (...args) => calls.push(args) }
  const outbox = createOrderEventOutbox({ query: async () => ({ rows: [] }) }, {
    webhookUrl: '',
    webhookSecret: '',
    logger: { info() {}, warn() {}, error() {} },
  })

  await outbox.enqueue(client, order)

  assert.match(calls[0][0], /INSERT INTO integration_outbox/)
  assert.equal(calls[0][1][0], 'order.created:UC-2026-01004')
  assert.equal(JSON.parse(calls[0][1][2]).event_type, 'order.created')
})

test('encola el cambio de estado en la misma outbox fiable', async () => {
  const calls = []
  const client = { query: async (...args) => calls.push(args) }
  const outbox = createOrderEventOutbox({ query: async () => ({ rows: [] }) }, {
    webhookUrl: '',
    webhookSecret: '',
    logger: { info() {}, warn() {}, error() {} },
  })

  await outbox.enqueueStatusChanged(client, {
    id: 'UC-2026-01004',
    fromStatus: 'creado',
    toStatus: 'pagado',
    changedAt: '2026-11-01T10:05:00.000Z',
    source: 'paypal',
    changeId: 'cambio-prueba',
  })

  assert.equal(calls[0][1][1], 'order.status_changed')
  assert.equal(JSON.parse(calls[0][1][2]).order.status, 'pagado')
})

test('envía con secreto e idempotencia y registra la entrega', async () => {
  const event = buildOrderCreatedEvent(order)
  const updates = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return { rows: [{ id: 7, event_id: event.event_id, payload: event, attempts: 1 }] }
      }
      updates.push({ sql, params })
      return { rows: [] }
    },
  }
  let request
  const outbox = createOrderEventOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/orders',
    webhookSecret: 'test-only-secret',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { ok: true, status: 200 }
    },
    logger: { info() {}, warn() {}, error() {} },
  })

  assert.equal(await outbox.processBatch(), 1)
  assert.equal(request.options.headers.Authorization, 'Bearer test-only-secret')
  assert.equal(request.options.headers['Idempotency-Key'], event.event_id)
  assert.deepEqual(JSON.parse(request.options.body), event)
  assert.match(updates[0].sql, /status = 'delivered'/)
  assert.deepEqual(updates[0].params, [7, 200])
})

test('un fallo de n8n queda registrado para reintento sin propagarse', async () => {
  const errors = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return {
          rows: [{
            id: 8,
            event_id: 'order.created:UC-2026-01005',
            payload: buildOrderCreatedEvent({ ...order, id: 'UC-2026-01005' }),
            attempts: 2,
          }],
        }
      }
      errors.push({ sql, params })
      return { rows: [] }
    },
  }
  const outbox = createOrderEventOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/orders',
    webhookSecret: 'test-only-secret',
    fetchImpl: async () => { throw new Error('n8n no disponible') },
    logger: { info() {}, warn() {}, error() {} },
  })

  assert.equal(await outbox.processBatch(), 1)
  assert.match(errors[0].sql, /status = \$2/)
  assert.equal(errors[0].params[1], 'retry')
  assert.equal(errors[0].params[2], retryDelayMs(2))
  assert.equal(errors[0].params[4], 'n8n no disponible')
})

test('agota los reintentos en dead_letter para revisión manual', async () => {
  const updates = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return {
          rows: [{
            id: 9,
            event_id: 'order.created:UC-2026-01006',
            payload: buildOrderCreatedEvent({ ...order, id: 'UC-2026-01006' }),
            attempts: 3,
          }],
        }
      }
      updates.push({ sql, params })
      return { rows: [] }
    },
  }
  const outbox = createOrderEventOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/orders',
    webhookSecret: 'test-only-secret',
    maxAttempts: 3,
    fetchImpl: async () => ({ ok: false, status: 503 }),
    logger: { info() {}, warn() {}, error() {} },
  })

  await outbox.processBatch()
  assert.equal(updates[0].params[1], 'dead_letter')
  assert.equal(updates[0].params[3], 503)
})

test('aborta una entrega que supera el timeout y la deja para reintento', async () => {
  const updates = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return {
          rows: [{
            id: 10,
            event_id: 'order.created:UC-2026-01007',
            payload: buildOrderCreatedEvent({ ...order, id: 'UC-2026-01007' }),
            attempts: 1,
          }],
        }
      }
      updates.push({ sql, params })
      return { rows: [] }
    },
  }
  const outbox = createOrderEventOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/orders',
    webhookSecret: 'test-only-secret',
    timeoutMs: 100,
    fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }),
    logger: { info() {}, warn() {}, error() {} },
  })

  await outbox.processBatch()
  assert.equal(updates[0].params[1], 'retry')
  assert.equal(updates[0].params[4], 'Tiempo de espera agotado tras 100 ms')
})
