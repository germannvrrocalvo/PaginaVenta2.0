const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  buildApprovedActionEvent,
  createAgentActionOutbox,
  retryDelayMs,
} = require('../src/services/agent-action-outbox')

const approved = {
  actionId: 73,
  incidentId: '49a972fb-755f-4a89-8230-df61ff971b28',
  reference: 'INC-3DFA48',
  orderId: 'UC-2026-01022',
  customerName: 'Cliente de prueba',
  subject: 'Restricción durante 3 días',
  telegramChatId: null,
  proposedAction: 'Informar del estado y solicitar datos adicionales.',
  justification: 'La incidencia necesita seguimiento humano.',
  reviewedBy: 'coreadmin@ucam.test',
  reviewedAt: '2026-11-04T10:00:00.000Z',
}

test('construye un evento sin datos sensibles para una acción aprobada', () => {
  assert.deepEqual(buildApprovedActionEvent(approved), {
    event_id: 'agent.action.approved:73',
    event_type: 'agent.action.approved',
    timestamp: '2026-11-04T10:00:00.000Z',
    incident: {
      id: approved.incidentId,
      reference: 'INC-3DFA48',
      order_id: 'UC-2026-01022',
      customer_name: 'Cliente de prueba',
      subject: 'Restricción durante 3 días',
      telegram_chat_id: null,
    },
    action: {
      id: '73',
      proposed_action: approved.proposedAction,
      justification: approved.justification,
      reviewed_by: 'coreadmin@ucam.test',
      reviewed_at: '2026-11-04T10:00:00.000Z',
    },
  })
})

test('encola la aprobación en la transacción de revisión humana', async () => {
  const calls = []
  const client = { query: async (...args) => calls.push(args) }
  const outbox = createAgentActionOutbox({ query: async () => ({ rows: [] }) }, {
    webhookUrl: '',
    headerName: '',
    secret: '',
    logger: { info() {}, warn() {}, error() {} },
  })
  const event = buildApprovedActionEvent(approved)
  await outbox.enqueue(client, event)
  assert.match(calls[0][0], /INSERT INTO agent_action_outbox/)
  assert.deepEqual(calls[0][1].slice(0, 3), [event.event_id, event.event_type, '73'])
})

test('entrega a n8n con secreto, idempotencia y chat académico', async () => {
  const event = buildApprovedActionEvent(approved)
  const updates = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return { rows: [{ id: 11, event_id: event.event_id, payload: event, attempts: 1 }] }
      }
      updates.push({ sql, params })
      return { rows: [] }
    },
  }
  let request
  const outbox = createAgentActionOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/telegram-aprobaciones',
    headerName: 'X-SIE-Agent-Secret',
    secret: 'test-only-secret',
    defaultChatId: '-1001234567890',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { ok: true, status: 200 }
    },
    logger: { info() {}, warn() {}, error() {} },
  })

  assert.equal(await outbox.processBatch(), 1)
  assert.equal(request.options.headers['X-SIE-Agent-Secret'], 'test-only-secret')
  assert.equal(request.options.headers['Idempotency-Key'], event.event_id)
  assert.equal(JSON.parse(request.options.body).incident.telegram_chat_id, '-1001234567890')
  assert.match(updates[0].sql, /status = 'delivered'/)
})

test('un fallo queda en reintento y no deshace la aprobación', async () => {
  const event = buildApprovedActionEvent(approved)
  const updates = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return { rows: [{ id: 12, event_id: event.event_id, payload: event, attempts: 2 }] }
      }
      updates.push({ sql, params })
      return { rows: [] }
    },
  }
  const outbox = createAgentActionOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/telegram-aprobaciones',
    headerName: 'X-SIE-Agent-Secret',
    secret: 'test-only-secret',
    defaultChatId: '-1001234567890',
    fetchImpl: async () => { throw new Error('Telegram temporalmente no disponible') },
    logger: { info() {}, warn() {}, error() {} },
  })

  assert.equal(await outbox.processBatch(), 1)
  assert.equal(updates[0].params[1], 'retry')
  assert.equal(updates[0].params[2], retryDelayMs(2))
  assert.equal(updates[0].params[5], 'retry')
  assert.match(updates[0].sql, /execution_status = \$6/)
})

test('sin chat configurado no llama a n8n y deja evidencia del error', async () => {
  const event = buildApprovedActionEvent(approved)
  const updates = []
  let called = false
  const pool = {
    async query(sql, params) {
      if (sql.includes('WITH due AS')) {
        return { rows: [{ id: 13, event_id: event.event_id, payload: event, attempts: 1 }] }
      }
      updates.push({ sql, params })
      return { rows: [] }
    },
  }
  const outbox = createAgentActionOutbox(pool, {
    webhookUrl: 'https://n8n.example.test/webhook/telegram-aprobaciones',
    headerName: 'X-SIE-Agent-Secret',
    secret: 'test-only-secret',
    defaultChatId: '',
    fetchImpl: async () => { called = true },
    logger: { info() {}, warn() {}, error() {} },
  })

  await outbox.processBatch()
  assert.equal(called, false)
  assert.match(updates[0].params[4], /TELEGRAM_TEST_CHAT_ID/)
})
