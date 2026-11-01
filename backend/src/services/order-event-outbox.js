const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_POLL_INTERVAL_MS = 10_000
const DEFAULT_MAX_ATTEMPTS = 8
const BATCH_SIZE = 10

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function buildOrderCreatedEvent({
  id,
  customerId,
  customerEmail,
  createdAt,
  items,
  total,
}) {
  const timestamp = new Date(createdAt).toISOString()
  return {
    event_id: `order.created:${id}`,
    event_type: 'order.created',
    timestamp,
    order: {
      id,
      customer_id: String(customerId),
      customer_email: customerEmail,
      items: items.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
      })),
      total: Number(total),
      currency: 'EUR',
      status: 'pending',
      created_at: timestamp,
    },
  }
}

function configurationError(webhookUrl, webhookSecret, nodeEnv) {
  if (!webhookUrl && !webhookSecret) {
    return 'faltan N8N_ORDER_WEBHOOK_URL y N8N_ORDER_WEBHOOK_SECRET'
  }
  if (!webhookUrl) return 'falta N8N_ORDER_WEBHOOK_URL'
  if (!webhookSecret) return 'falta N8N_ORDER_WEBHOOK_SECRET'

  try {
    const parsed = new URL(webhookUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'la URL del webhook no usa HTTP(S)'
    if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
      return 'N8N_ORDER_WEBHOOK_URL debe usar HTTPS en producción'
    }
  } catch {
    return 'N8N_ORDER_WEBHOOK_URL no es una URL válida'
  }
  return null
}

function retryDelayMs(attempts) {
  return Math.min(5_000 * (2 ** Math.max(0, attempts - 1)), 15 * 60_000)
}

function createOrderEventOutbox(pool, {
  fetchImpl = globalThis.fetch,
  webhookUrl = process.env.N8N_ORDER_WEBHOOK_URL,
  webhookSecret = process.env.N8N_ORDER_WEBHOOK_SECRET,
  timeoutMs = positiveInteger(process.env.N8N_ORDER_WEBHOOK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, {
    min: 100,
    max: 30_000,
  }),
  pollIntervalMs = positiveInteger(
    process.env.N8N_ORDER_WEBHOOK_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
    { min: 1_000, max: 5 * 60_000 }
  ),
  maxAttempts = positiveInteger(
    process.env.N8N_ORDER_WEBHOOK_MAX_ATTEMPTS,
    DEFAULT_MAX_ATTEMPTS,
    { min: 1, max: 50 }
  ),
  nodeEnv = process.env.NODE_ENV,
  logger = console,
} = {}) {
  const configError = configurationError(webhookUrl, webhookSecret, nodeEnv)
  let interval = null
  let running = false
  let kickScheduled = false

  async function enqueue(client, order) {
    const event = buildOrderCreatedEvent(order)
    await client.query(
      `INSERT INTO integration_outbox (event_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.event_id, event.event_type, JSON.stringify(event)]
    )
    return event
  }

  async function claimBatch() {
    const { rows } = await pool.query(
      `WITH due AS (
         SELECT id
         FROM integration_outbox
         WHERE (
           status IN ('pending', 'retry') AND next_attempt_at <= now()
         ) OR (
           status = 'processing' AND locked_at < now() - interval '5 minutes'
         )
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE integration_outbox AS outbox
       SET status = 'processing',
           attempts = outbox.attempts + 1,
           locked_at = now(),
           updated_at = now()
       FROM due
       WHERE outbox.id = due.id
       RETURNING outbox.*`,
      [BATCH_SIZE]
    )
    return rows
  }

  async function deliver(record) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let httpStatus = null

    try {
      const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${webhookSecret}`,
          'Idempotency-Key': record.event_id,
        },
        body: JSON.stringify(record.payload),
        signal: controller.signal,
      })
      httpStatus = response.status
      if (!response.ok) throw new Error(`n8n respondió con HTTP ${response.status}`)

      await pool.query(
        `UPDATE integration_outbox
         SET status = 'delivered', delivered_at = now(), last_http_status = $2,
             last_error = NULL, locked_at = NULL, updated_at = now()
         WHERE id = $1`,
        [record.id, httpStatus]
      )
      logger.info(`Evento ${record.event_id} entregado a n8n.`)
    } catch (error) {
      const message = controller.signal.aborted
        ? `Tiempo de espera agotado tras ${timeoutMs} ms`
        : String(error?.message || error).slice(0, 500)
      const finalFailure = record.attempts >= maxAttempts
      const nextStatus = finalFailure ? 'dead_letter' : 'retry'
      const delay = retryDelayMs(record.attempts)

      await pool.query(
        `UPDATE integration_outbox
         SET status = $2, next_attempt_at = now() + ($3 * interval '1 millisecond'),
             last_http_status = $4, last_error = $5, locked_at = NULL, updated_at = now()
         WHERE id = $1`,
        [record.id, nextStatus, delay, httpStatus, message]
      )
      logger.error(
        `No se pudo entregar ${record.event_id} a n8n (intento ${record.attempts}/${maxAttempts}, estado ${nextStatus}).`
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  async function processBatch() {
    if (configError || running) return 0
    running = true
    try {
      const records = await claimBatch()
      for (const record of records) await deliver(record)
      return records.length
    } finally {
      running = false
    }
  }

  function kick() {
    if (configError || kickScheduled) return
    kickScheduled = true
    setImmediate(() => {
      kickScheduled = false
      processBatch().catch((error) => {
        logger.error('Falló el procesador de eventos pendientes de n8n:', error)
      })
    })
  }

  function start() {
    if (interval) return
    if (configError) {
      logger.warn(`Integración order.created en pausa: ${configError}. Los eventos quedarán pendientes.`)
      return
    }
    kick()
    interval = setInterval(kick, pollIntervalMs)
    interval.unref?.()
  }

  function stop() {
    if (interval) clearInterval(interval)
    interval = null
  }

  return {
    enqueue,
    processBatch,
    kick,
    start,
    stop,
    configurationError: configError,
  }
}

module.exports = {
  buildOrderCreatedEvent,
  createOrderEventOutbox,
  retryDelayMs,
}
