function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

const TO_BACKOFFICE_STATUS = {
  abierta: 'open',
  en_curso: 'in_progress',
  resuelta: 'resolved',
  cerrada: 'closed',
}

const TO_UI_STATUS = {
  open: 'abierta',
  in_progress: 'en_curso',
  resolved: 'resuelta',
  closed: 'cerrada',
}

function mapTicket(row) {
  return {
    id: row.source_reference,
    createdAt: new Date(row.created_at).toISOString(),
    name: row.customer_name || row.customer_id,
    email: row.customer_id,
    orderId: row.order_id,
    subject: row.subject || row.incident_type,
    message: row.description,
    status: TO_UI_STATUS[row.status] || row.status,
    agentIncidentId: row.incident_id,
    analysisStatus: row.analysis_status,
    analysisError: row.analysis_error,
    priority: row.priority || 'medium',
    incidentType: row.incident_type || 'support_request',
    agentAction: row.action_id ? {
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
    } : null,
  }
}

function createBackofficeActivityService(pool) {
  const selection = `
    SELECT i.incident_id, i.source_reference, i.order_id, i.customer_id,
           i.customer_name, i.subject, i.incident_type, i.description,
           i.priority, i.status, i.created_at, i.analysis_status, i.analysis_error,
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
    ) a ON true`

  async function upsertTicket(ticket) {
    await pool.query(
      `INSERT INTO incidents (
         incident_id, source_reference, order_id, customer_id, customer_name,
         subject, incident_type, description, priority, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'support_request', $7, $8, $9, $10, now())
       ON CONFLICT (incident_id) DO UPDATE SET
         source_reference = EXCLUDED.source_reference,
         order_id = EXCLUDED.order_id,
         customer_id = EXCLUDED.customer_id,
         customer_name = EXCLUDED.customer_name,
         subject = EXCLUDED.subject,
         description = EXCLUDED.description,
         priority = EXCLUDED.priority,
         updated_at = now()`,
      [
        ticket.agentIncidentId,
        ticket.id,
        ticket.orderId || null,
        ticket.email,
        ticket.name,
        ticket.subject,
        ticket.message,
        ticket.priority || 'medium',
        TO_BACKOFFICE_STATUS[ticket.status] || 'open',
        ticket.createdAt,
      ]
    )
  }

  async function listTickets() {
    const { rows } = await pool.query(`${selection} ORDER BY i.created_at DESC`)
    return rows.map(mapTicket)
  }

  async function upsertAgentAction(incidentId, action) {
    await pool.query(
      `INSERT INTO agent_actions (
         source_action_id, incident_id, case_type, consulted_data,
         proposed_action, justification, confidence, risks,
         review_status, reviewed_by, reviewed_at, created_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (source_action_id) WHERE source_action_id IS NOT NULL DO UPDATE SET
         case_type = EXCLUDED.case_type,
         consulted_data = EXCLUDED.consulted_data,
         proposed_action = EXCLUDED.proposed_action,
         justification = EXCLUDED.justification,
         confidence = EXCLUDED.confidence,
         risks = EXCLUDED.risks,
         review_status = EXCLUDED.review_status,
         reviewed_by = EXCLUDED.reviewed_by,
         reviewed_at = EXCLUDED.reviewed_at`,
      [
        action.id,
        incidentId,
        action.caseType,
        JSON.stringify(action.consultedData || {}),
        action.proposedAction,
        action.justification,
        action.confidence,
        action.risks,
        action.reviewStatus || 'pending_review',
        action.reviewedBy,
        action.reviewedAt,
        action.createdAt,
      ]
    )
  }

  async function findTicket(reference) {
    const { rows } = await pool.query(
      `${selection} WHERE i.source_reference = $1`,
      [reference]
    )
    return rows[0] ? mapTicket(rows[0]) : null
  }

  async function updateTicketStatus(reference, status) {
    if (!Object.hasOwn(TO_BACKOFFICE_STATUS, status)) {
      fail(400, 'El estado de la incidencia no es válido.')
    }
    const normalized = TO_BACKOFFICE_STATUS[status]
    const { rows } = await pool.query(
      `UPDATE incidents
       SET status = $2, updated_at = now(),
           resolved_at = CASE
             WHEN $2 IN ('resolved', 'closed') THEN COALESCE(resolved_at, now())
             ELSE NULL
           END
       WHERE source_reference = $1
       RETURNING incident_id`,
      [reference, normalized]
    )
    if (!rows[0]) fail(404, 'Incidencia no encontrada.')
    return findTicket(reference)
  }

  return { upsertTicket, upsertAgentAction, listTickets, findTicket, updateTicketStatus }
}

module.exports = { createBackofficeActivityService }
