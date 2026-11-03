function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

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
    createdAt: new Date(row.action_created_at).toISOString(),
  }
}

function createPostgresIncidentService(pool, agentClient) {
  async function findTicket(reference) {
    const { rows } = await pool.query(
      `SELECT i.referencia, i.agent_incident_id, i.agent_analysis_status,
              a.id AS action_id, a.case_type, a.proposed_action, a.justification,
              a.confidence, a.risks, a.review_status, a.reviewed_by,
              a.reviewed_at, a.created_at AS action_created_at
       FROM incidencia i
       LEFT JOIN LATERAL (
         SELECT * FROM agent_actions
         WHERE incident_id = i.agent_incident_id
         ORDER BY created_at DESC, id DESC LIMIT 1
       ) a ON true
       WHERE i.referencia = $1`,
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
      `UPDATE incidencia
       SET agent_analysis_status = 'running', agent_analysis_requested_at = now(),
           agent_analysis_error = NULL
       WHERE referencia = $1
         AND (agent_analysis_status <> 'running'
              OR agent_analysis_requested_at < now() - interval '5 minutes')
       RETURNING agent_incident_id`,
      [reference]
    )
    if (!rows[0]) fail(409, 'Esta incidencia ya se está analizando.')

    try {
      await agentClient.analyze(String(rows[0].agent_incident_id))
      const updated = await findTicket(reference)
      const action = mapAction(updated)
      if (!action) fail(502, 'n8n terminó sin registrar una propuesta del agente.')
      await pool.query(
        `UPDATE incidencia SET agent_analysis_status = 'completed', agent_analysis_error = NULL
         WHERE referencia = $1`,
        [reference]
      )
      return { status: 'completed', action }
    } catch (error) {
      await pool.query(
        `UPDATE incidencia SET agent_analysis_status = 'failed', agent_analysis_error = $2
         WHERE referencia = $1`,
        [reference, String(error.message || error).slice(0, 500)]
      )
      throw error
    }
  }

  async function review(reference, decision, reviewedBy) {
    if (!['approved', 'rejected'].includes(decision)) {
      fail(400, 'La revisión debe ser approved o rejected.')
    }
    const { rows } = await pool.query(
      `WITH target AS (
         SELECT a.id
         FROM incidencia i
         JOIN agent_actions a ON a.incident_id = i.agent_incident_id
         WHERE i.referencia = $1 AND a.review_status = 'pending_review'
         ORDER BY a.created_at DESC, a.id DESC LIMIT 1
       )
       UPDATE agent_actions a
       SET review_status = $2, reviewed_by = $3, reviewed_at = now()
       FROM target WHERE a.id = target.id
       RETURNING a.id AS action_id, a.case_type, a.proposed_action, a.justification,
                 a.confidence, a.risks, a.review_status, a.reviewed_by,
                 a.reviewed_at, a.created_at AS action_created_at`,
      [reference, decision, reviewedBy]
    )
    if (!rows[0]) fail(404, 'No hay ninguna propuesta pendiente para esta incidencia.')
    return mapAction(rows[0])
  }

  return { analyze, review }
}

module.exports = { createPostgresIncidentService }
