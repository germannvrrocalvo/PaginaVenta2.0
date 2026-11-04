function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

const { buildApprovedActionEvent } = require('./agent-action-outbox')

function mapAction(row) {
  if (!row?.action_id) return null
  return {
    id: String(row.action_id),
    caseType: row.case_type,
    proposedAction: row.proposed_action,
    justification: row.justification,
    confidence: row.confidence == null ? null : Number(row.confidence),
    risks: row.risks,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    executionStatus: row.execution_status,
    executedAt: row.executed_at ? new Date(row.executed_at).toISOString() : null,
    executionError: row.execution_error,
    telegramMessageId: row.telegram_message_id,
    createdAt: new Date(row.action_created_at).toISOString(),
  }
}

function createPostgresIncidentService(pool, agentClient, actionOutbox = null) {
  async function findTicket(reference) {
    const { rows } = await pool.query(
      `SELECT i.source_reference AS referencia,
              i.incident_id AS agent_incident_id,
              i.analysis_status AS agent_analysis_status,
              a.id AS action_id, a.case_type, a.proposed_action, a.justification,
              a.confidence, a.risks, a.review_status, a.reviewed_by,
              a.reviewed_at, a.execution_status, a.executed_at,
              a.execution_error, a.telegram_message_id,
              a.created_at AS action_created_at
       FROM incidents i
       LEFT JOIN LATERAL (
         SELECT * FROM agent_actions
         WHERE incident_id = i.incident_id
         ORDER BY created_at DESC, id DESC LIMIT 1
       ) a ON true
       WHERE i.source_reference = $1`,
      [reference]
    )
    return rows[0] || null
  }

  async function analyze(reference) {
    const ticket = await findTicket(reference)
    if (!ticket) fail(404, 'Incidencia no encontrada.')
    if (!ticket.agent_incident_id) fail(409, 'La incidencia todavía no está vinculada al agente.')

    const existingAction = mapAction(ticket)
    if (existingAction?.reviewStatus === 'pending_review') {
      return { status: 'already_pending', action: existingAction }
    }

    const { rows } = await pool.query(
      `UPDATE incidents
       SET analysis_status = 'running', analysis_requested_at = now(),
           analysis_error = NULL, updated_at = now()
       WHERE source_reference = $1
         AND (analysis_status <> 'running'
              OR analysis_requested_at < now() - interval '5 minutes')
       RETURNING incident_id AS agent_incident_id`,
      [reference]
    )
    if (!rows[0]) fail(409, 'Esta incidencia ya se está analizando.')

    try {
      await agentClient.analyze(String(rows[0].agent_incident_id))
      const updated = await findTicket(reference)
      const action = mapAction(updated)
      if (!action) fail(502, 'n8n terminó sin registrar una propuesta del agente.')
      await pool.query(
        `UPDATE incidents
         SET analysis_status = 'completed', analysis_error = NULL, updated_at = now()
         WHERE source_reference = $1`,
        [reference]
      )
      return { status: 'completed', action }
    } catch (error) {
      await pool.query(
        `UPDATE incidents
         SET analysis_status = 'failed', analysis_error = $2, updated_at = now()
         WHERE source_reference = $1`,
        [reference, String(error.message || error).slice(0, 500)]
      )
      throw error
    }
  }

  async function review(reference, decision, reviewedBy) {
    if (!['approved', 'rejected'].includes(decision)) {
      fail(400, 'La revisión debe ser approved o rejected.')
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `WITH target AS (
           SELECT a.id, i.incident_id, i.source_reference, i.order_id,
                  i.customer_name, i.subject, i.telegram_chat_id
           FROM incidents i
           JOIN agent_actions a ON a.incident_id = i.incident_id
           WHERE i.source_reference = $1 AND a.review_status = 'pending_review'
           ORDER BY a.created_at DESC, a.id DESC LIMIT 1
           FOR UPDATE OF a
         )
         UPDATE agent_actions a
         SET review_status = $2, reviewed_by = $3, reviewed_at = now(),
             execution_status = CASE
               WHEN $2 = 'approved' THEN 'pending'
               ELSE 'not_applicable'
             END,
             execution_error = NULL
         FROM target WHERE a.id = target.id
         RETURNING a.id AS action_id, a.case_type, a.proposed_action, a.justification,
                   a.confidence, a.risks, a.review_status, a.reviewed_by,
                   a.reviewed_at, a.execution_status, a.executed_at,
                   a.execution_error, a.telegram_message_id,
                   a.created_at AS action_created_at,
                   target.incident_id, target.source_reference, target.order_id,
                   target.customer_name, target.subject, target.telegram_chat_id`,
        [reference, decision, reviewedBy]
      )
      const row = rows[0]
      if (!row) fail(404, 'No hay ninguna propuesta pendiente para esta incidencia.')

      if (decision === 'approved' && actionOutbox) {
        await actionOutbox.enqueue(client, buildApprovedActionEvent({
          actionId: row.action_id,
          incidentId: row.incident_id,
          reference: row.source_reference,
          orderId: row.order_id,
          customerName: row.customer_name,
          subject: row.subject,
          telegramChatId: row.telegram_chat_id,
          proposedAction: row.proposed_action,
          justification: row.justification,
          reviewedBy: row.reviewed_by,
          reviewedAt: row.reviewed_at,
        }))
      }
      await client.query('COMMIT')
      if (decision === 'approved') actionOutbox?.kick()
      return mapAction(row)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  return { analyze, review }
}

module.exports = { createPostgresIncidentService }
