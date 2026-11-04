const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_POLL_INTERVAL_MS = 10_000
const DEFAULT_MAX_ATTEMPTS = 8
const BATCH_SIZE = 10

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function buildApprovedActionEvent({
  actionId,
  incidentId,
  reference,
  orderId,
  customerName,
  subject,
  telegramChatId,
  proposedAction,
  justification,
  reviewedBy,
  reviewedAt,
}) {
  const timestamp = new Date(reviewedAt).toISOString()
  return {
    event_id: `agent.action.approved:${actionId}`,
    event_type: 'agent.action.approved',
    timestamp,
    incident: {
      id: String(incidentId),
      reference,
      order_id: orderId || null,
      customer_name: customerName || null,
      subject: subject || 'Incidencia de soporte',
      telegram_chat_id: telegramChatId || null,
    },
    action: {
      id: String(actionId),
      proposed_action: proposedAction,
      justification: justification || null,
      reviewed_by: reviewedBy,
      reviewed_at: timestamp,
    },
  }
}

function configurationError(webhookUrl, headerName, secret, nodeEnv) {
  if (!webhookUrl) return 'falta N8N_INCIDENT_ACTION_WEBHOOK_URL'
  if (!headerName) return 'falta N8N_INCIDENT_ACTION_WEBHOOK_HEADER'
  if (!secret) return 'falta N8N_INCIDENT_ACTION_WEBHOOK_SECRET'
  try {
    const parsed = new URL(webhookUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'la URL no usa HTTP(S)'
    if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
      return 'N8N_INCIDENT_ACTION_WEBHOOK_URL debe usar HTTPS en producción'
    }
  } catch {
    return 'N8N_INCIDENT_ACTION_WEBHOOK_URL no es una URL válida'
  }
  return null
}

function retryDelayMs(attempts) {
  return Math.min(5_000 * (2 ** Math.max(0, attempts - 1)), 15 * 60_000)
}

function createAgentActionOutbox(pool, {
  fetchImpl = globalThis.fetch,
  webhookUrl = process.env.N8N_INCIDENT_ACTION_WEBHOOK_URL,
  headerName = process.env.N8N_INCIDENT_ACTION_WEBHOOK_HEADER
    || process.env.N8N_INCIDENT_AGENT_WEBHOOK_HEADER,
  secret = process.env.N8N_INCIDENT_ACTION_WEBHOOK_SECRET
    || process.env.N8N_INCIDENT_AGENT_WEBHOOK_SECRET,
  defaultChatId = process.env.TELEGRAM_TEST_CHAT_ID,
  timeoutMs = positiveInteger(
    process.env.N8N_INCIDENT_ACTION_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    { min: 100, max: 60_000 }
  ),
  pollIntervalMs = positiveInteger(
    process.env.N8N_INCIDENT_ACTION_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
    { min: 1_000, max: 5 * 60_000 }
  ),
  maxAttempts = positiveInteger(
    process.env.N8N_INCIDENT_ACTION_MAX_ATTEMPTS,
    DEFAULT_MAX_ATTEMPTS,
    { min: 1, max: 50 }
  ),
  nodeEnv = process.env.NODE_ENV,
  logger = console,
} = {}) {
  const configError = configurationError(webhookUrl, headerName, secret, nodeEnv)
  let interval = null
  let running = false
  let kickScheduled = false

  async function enqueue(client, event) {
    await client.query(
      `INSERT INTO agent_action_outbox (
         event_id, event_type, action_id, payload
       ) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.event_id, event.event_type, event.action.id, JSON.stringify(event)]
    )
    return event
  }

  async function claimBatch() {
    const { rows } = await pool.query(
      `WITH due AS (
         SELECT id
         FROM agent_action_outbox
         WHERE (
           status IN ('pending', 'retry') AND next_attempt_at <= now()
         ) OR (
           status = 'processing' AND locked_at < now() - interval '5 minutes'
         )
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE agent_action_outbox AS outbox
       SET status = 'processing', attempts = outbox.attempts + 1,
           locked_at = now(), updated_at = now()
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
      const payload = structuredClone(record.payload)
      payload.incident.telegram_chat_id = payload.incident.telegram_chat_id || defaultChatId || null
      if (!payload.incident.telegram_chat_id) {
        throw new Error('Falta TELEGRAM_TEST_CHAT_ID para la notificación académica')
      }

      const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          [headerName]: secret,
          'Idempotency-Key': record.event_id,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      httpStatus = response.status
      if (!response.ok) throw new Error(`n8n respondió con HTTP ${response.status}`)

      await pool.query(
        `UPDATE agent_action_outbox
         SET status = 'delivered', delivered_at = now(), last_http_status = $2,
             last_error = NULL, locked_at = NULL, updated_at = now()
         WHERE id = $1`,
        [record.id, httpStatus]
      )
      logger.info(`Evento ${record.event_id} entregado al workflow de Telegram.`)
    } catch (error) {
      const message = controller.signal.aborted
        ? `Tiempo de espera agotado tras ${timeoutMs} ms`
        : String(error?.message || error).slice(0, 500)
      const finalFailure = record.attempts >= maxAttempts
      const nextStatus = finalFailure ? 'dead_letter' : 'retry'
      const delay = retryDelayMs(record.attempts)
      await pool.query(
        `WITH failed AS (
           UPDATE agent_action_outbox
           SET status = $2, next_attempt_at = now() + ($3 * interval '1 millisecond'),
               last_http_status = $4, last_error = $5,
               locked_at = NULL, updated_at = now()
           WHERE id = $1
           RETURNING action_id
         )
         UPDATE agent_actions a
         SET execution_status = $6, execution_error = $5
         FROM failed WHERE a.id = failed.action_id
           AND a.execution_status <> 'executed'`,
        [
          record.id,
          nextStatus,
          delay,
          httpStatus,
          message,
          finalFailure ? 'failed' : 'retry',
        ]
      )
      logger.error(
        `No se pudo entregar ${record.event_id} al workflow de Telegram ` +
        `(intento ${record.attempts}/${maxAttempts}, estado ${nextStatus}, ` +
        `HTTP ${httpStatus ?? 'sin respuesta'}): ${message}`
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
        logger.error('Falló el procesador de acciones aprobadas:', error)
      })
    })
  }

  function start() {
    if (interval) return
    if (configError) {
      logger.warn(`Integración de Telegram en pausa: ${configError}. Las aprobaciones quedarán pendientes.`)
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
  buildApprovedActionEvent,
  createAgentActionOutbox,
  retryDelayMs,
}
