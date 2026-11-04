const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  createOrderStatusAutomation,
  DEFAULT_INTERVAL_MS,
} = require('../src/services/order-status-automation')

function createClient(handler) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      return handler(sql, params, calls)
    },
    release() {},
  }
}

test('usa tres horas como intervalo predeterminado', () => {
  assert.equal(DEFAULT_INTERVAL_MS, 10_800_000)
})

test('cambia exactamente un pedido pagado y encola su evento en la misma transacción', async () => {
  const client = createClient(async (sql) => {
    if (sql.includes('SELECT next_run_at')) {
      return { rows: [{ due: true, next_run_at: new Date('2026-11-04T21:00:00Z') }] }
    }
    if (sql.includes('FROM pedido p')) {
      return { rows: [{ id_pedido: 27, numero_pedido: 'UC-2026-01027', estado: 'pagado' }] }
    }
    if (sql.includes("SET estado = 'enviado'")) {
      return { rows: [{ fecha_actualizacion: new Date('2026-11-04T18:00:00Z') }] }
    }
    if (sql.includes('last_run_at = now()')) {
      return { rows: [{ next_run_at: new Date('2026-11-04T21:00:00Z') }] }
    }
    return { rows: [] }
  })
  const enqueued = []
  let kicked = 0
  const automation = createOrderStatusAutomation(
    { connect: async () => client },
    {
      async enqueueStatusChanged(queryClient, event) {
        enqueued.push({ queryClient, event })
      },
      kick() { kicked += 1 },
    },
    { enabled: true, intervalMs: 10_800_000, logger: { info() {}, error() {} } }
  )

  const result = await automation.runOnce()

  assert.equal(result.status, 'updated')
  assert.equal(result.orderId, 'UC-2026-01027')
  assert.equal(enqueued.length, 1)
  assert.equal(enqueued[0].queryClient, client)
  assert.deepEqual(enqueued[0].event, {
    id: 'UC-2026-01027',
    fromStatus: 'pagado',
    toStatus: 'enviado',
    changedAt: new Date('2026-11-04T18:00:00Z'),
    source: 'automatic_shipping_bot',
  })
  assert.equal(kicked, 1)
  assert.equal(client.calls.filter(({ sql }) => sql.includes("SET estado = 'enviado'")).length, 1)
  assert.match(client.calls.find(({ sql }) => sql.includes('FROM pedido p')).sql, /ORDER BY random\(\)/)
  assert.match(client.calls.find(({ sql }) => sql.includes('FROM pedido p')).sql, /resultado = 'approved'/)
  assert.equal(client.calls.at(-1).sql, 'COMMIT')
})

test('si todavía no han pasado tres horas no modifica ningún pedido', async () => {
  const client = createClient(async (sql) => {
    if (sql.includes('SELECT next_run_at')) {
      return { rows: [{ due: false, next_run_at: new Date('2026-11-04T21:00:00Z') }] }
    }
    return { rows: [] }
  })
  let enqueued = false
  const automation = createOrderStatusAutomation(
    { connect: async () => client },
    { async enqueueStatusChanged() { enqueued = true }, kick() {} },
    { enabled: true, logger: { info() {}, error() {} } }
  )

  const result = await automation.runOnce()

  assert.equal(result.status, 'not_due')
  assert.equal(enqueued, false)
  assert.equal(client.calls.some(({ sql }) => sql.includes('FROM pedido p')), false)
  assert.equal(client.calls.at(-1).sql, 'COMMIT')
})

test('si no hay pedidos pagados programa el siguiente intento sin cambiar datos', async () => {
  const client = createClient(async (sql) => {
    if (sql.includes('SELECT next_run_at')) return { rows: [{ due: true }] }
    if (sql.includes('FROM pedido p')) return { rows: [] }
    if (sql.includes('last_attempt_at = now()')) {
      return { rows: [{ next_run_at: new Date('2026-11-04T21:00:00Z') }] }
    }
    return { rows: [] }
  })
  let enqueued = false
  const automation = createOrderStatusAutomation(
    { connect: async () => client },
    { async enqueueStatusChanged() { enqueued = true }, kick() {} },
    { enabled: true, logger: { info() {}, error() {} } }
  )

  const result = await automation.runOnce()

  assert.equal(result.status, 'no_eligible_order')
  assert.equal(enqueued, false)
  assert.equal(client.calls.some(({ sql }) => sql.includes("SET estado = 'enviado'")), false)
  assert.equal(client.calls.at(-1).sql, 'COMMIT')
})

test('un fallo revierte la transacción y no lanza el envío de la outbox', async () => {
  const client = createClient(async (sql) => {
    if (sql.includes('SELECT next_run_at')) return { rows: [{ due: true }] }
    if (sql.includes('FROM pedido p')) {
      return { rows: [{ id_pedido: 27, numero_pedido: 'UC-2026-01027', estado: 'pagado' }] }
    }
    if (sql.includes("SET estado = 'enviado'")) throw new Error('fallo de prueba')
    return { rows: [] }
  })
  let kicked = false
  const automation = createOrderStatusAutomation(
    { connect: async () => client },
    { async enqueueStatusChanged() {}, kick() { kicked = true } },
    { enabled: true, logger: { info() {}, error() {} } }
  )

  await assert.rejects(() => automation.runOnce(), /fallo de prueba/)
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK')
  assert.equal(kicked, false)
})
