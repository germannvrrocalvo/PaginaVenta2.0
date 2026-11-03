function createBackofficeIncidentSync(storePool, backofficeActivity, {
  intervalMs = Number(process.env.BACKOFFICE_SYNC_INTERVAL_MS || 5000),
  logger = console,
} = {}) {
  let timer = null
  let running = false

  async function loadTicket(reference) {
    const { rows } = await storePool.query(
      `SELECT i.referencia, i.fecha_creacion, i.nombre_contacto, i.email_contacto,
              i.numero_pedido_indicado, i.asunto, i.descripcion, i.estado,
              i.agent_incident_id, ai.priority
       FROM incidencia i
       LEFT JOIN incidents ai ON ai.incident_id = i.agent_incident_id
       WHERE i.referencia = $1`,
      [reference]
    )
    if (!rows[0]) return null
    const row = rows[0]
    return {
      id: row.referencia,
      createdAt: new Date(row.fecha_creacion).toISOString(),
      name: row.nombre_contacto,
      email: row.email_contacto,
      orderId: row.numero_pedido_indicado,
      subject: row.asunto,
      message: row.descripcion,
      status: row.estado,
      agentIncidentId: row.agent_incident_id,
      priority: row.priority || 'medium',
    }
  }

  async function markRetry(reference, error) {
    await storePool.query(
      `UPDATE incidencia
       SET backoffice_sync_status = 'retry',
           backoffice_sync_attempts = backoffice_sync_attempts + 1,
           backoffice_sync_error = $2,
           backoffice_next_attempt_at = now() +
             (LEAST(300, POWER(2, LEAST(backoffice_sync_attempts, 8))) * interval '1 second')
       WHERE referencia = $1`,
      [reference, String(error?.message || error).slice(0, 500)]
    )
  }

  async function syncReference(reference) {
    const ticket = await loadTicket(reference)
    if (!ticket) return false
    try {
      await backofficeActivity.upsertTicket(ticket)
      const { rows: actions } = await storePool.query(
        `SELECT id, case_type, consulted_data, proposed_action, justification,
                confidence, risks, review_status, reviewed_by, reviewed_at, created_at
         FROM agent_actions
         WHERE incident_id = $1
         ORDER BY created_at, id`,
        [ticket.agentIncidentId]
      )
      for (const action of actions) {
        await backofficeActivity.upsertAgentAction(ticket.agentIncidentId, {
          id: action.id,
          caseType: action.case_type,
          consultedData: action.consulted_data,
          proposedAction: action.proposed_action,
          justification: action.justification,
          confidence: action.confidence,
          risks: action.risks,
          reviewStatus: action.review_status,
          reviewedBy: action.reviewed_by,
          reviewedAt: action.reviewed_at,
          createdAt: action.created_at,
        })
      }
      await storePool.query(
        `UPDATE incidencia
         SET backoffice_sync_status = 'delivered', backoffice_synced_at = now(),
             backoffice_sync_error = NULL
         WHERE referencia = $1`,
        [reference]
      )
      return true
    } catch (error) {
      await markRetry(reference, error)
      throw error
    }
  }

  async function syncDue(limit = 20) {
    if (running) return
    running = true
    try {
      const { rows } = await storePool.query(
        `SELECT referencia FROM incidencia
         WHERE backoffice_sync_status IN ('pending', 'retry')
           AND backoffice_next_attempt_at <= now()
         ORDER BY fecha_creacion
         LIMIT $1`,
        [limit]
      )
      for (const row of rows) {
        try {
          await syncReference(row.referencia)
        } catch (error) {
          logger.warn?.(`No se pudo sincronizar ${row.referencia} con el back office; se reintentará.`)
        }
      }
    } finally {
      running = false
    }
  }

  function start() {
    if (timer) return
    void syncDue()
    timer = setInterval(() => void syncDue(), Math.max(1000, intervalMs))
    timer.unref?.()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { start, stop, syncDue, syncReference }
}

module.exports = { createBackofficeIncidentSync }
