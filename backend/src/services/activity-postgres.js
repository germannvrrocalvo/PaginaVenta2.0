const { randomBytes } = require('node:crypto')
const { EVENT_TYPES } = require('./activity')

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function createPostgresActivityService(pool, getUserForToken, incidentSync = null, integrationOutbox = null) {
  async function track(input, token) {
    const { type, payload = {}, sessionId } = input ?? {}
    if (!EVENT_TYPES.has(type)) fail(400, 'El tipo de evento no es válido.')
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      fail(400, 'Los datos del evento no son válidos.')
    }
    const user = token ? await getUserForToken(token) : null
    const { rows } = await pool.query(
      `INSERT INTO evento (id_cliente, id_producto, id_pedido, id_sesion_web, tipo, datos_adicionales)
       VALUES (
         $1,
         (SELECT id_producto FROM producto WHERE codigo = $2),
         (SELECT id_pedido FROM pedido WHERE numero_pedido = $3),
         $4, $5, $6::jsonb
       )
       RETURNING id_evento, tipo, fecha_creacion, id_sesion_web, datos_adicionales`,
      [
        user ? Number(user.id) : null,
        typeof payload.productId === 'string' ? payload.productId : null,
        typeof payload.orderId === 'string' ? payload.orderId : null,
        typeof sessionId === 'string' ? sessionId.slice(0, 20) : null,
        type,
        JSON.stringify(payload),
      ]
    )
    return {
      id: String(rows[0].id_evento),
      type: rows[0].tipo,
      timestamp: new Date(rows[0].fecha_creacion).toISOString(),
      sessionId: rows[0].id_sesion_web,
      user: user?.email ?? null,
      payload: rows[0].datos_adicionales,
    }
  }

  async function createTicket(input) {
    const { name, email, orderId, subject, message } = input ?? {}
    if (typeof name !== 'string' || name.trim().length < 3) fail(400, 'Escribe tu nombre.')
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(400, 'Introduce un correo válido.')
    }
    if (orderId && (typeof orderId !== 'string' || !/^UC-\d{4}-\d{5}$/.test(orderId))) {
      fail(400, 'Formato UC-2026-01001.')
    }
    if (typeof subject !== 'string' || subject.trim().length < 4) fail(400, 'Indica un asunto.')
    if (typeof message !== 'string' || message.trim().length < 10) {
      fail(400, 'Cuéntanos qué ha pasado (mín. 10 caracteres).')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const reference = `INC-${randomBytes(3).toString('hex').toUpperCase()}`
      const { rows: agentRows } = await client.query(
        `INSERT INTO incidents (
           order_id, customer_id, incident_type, description,
           priority, status, source_reference
         ) VALUES ($1, $2, 'support_request', $3, 'medium', 'open', $4)
         RETURNING incident_id`,
        [
          orderId || null,
          email.trim().toLowerCase(),
          `${subject.trim()}\n\n${message.trim()}`,
          reference,
        ]
      )
      const { rows } = await client.query(
        `INSERT INTO incidencia (
           referencia, id_pedido, numero_pedido_indicado,
           nombre_contacto, email_contacto, asunto, descripcion, agent_incident_id
         ) VALUES (
           $1, (SELECT id_pedido FROM pedido WHERE numero_pedido = $2),
           $2, $3, $4, $5, $6, $7
         )
         RETURNING referencia, fecha_creacion, nombre_contacto, email_contacto,
                   numero_pedido_indicado, asunto, descripcion, estado, agent_incident_id`,
        [
          reference,
          orderId || null,
          name.trim(),
          email.trim().toLowerCase(),
          subject.trim(),
          message.trim(),
          agentRows[0].incident_id,
        ]
      )
      const ticket = rows[0]
      await client.query(
        `INSERT INTO evento (tipo, datos_adicionales, id_pedido)
         VALUES ('support.requested', $1::jsonb,
                 (SELECT id_pedido FROM pedido WHERE numero_pedido = $2))`,
        [JSON.stringify({
          ticketId: ticket.referencia,
          orderId: ticket.numero_pedido_indicado,
          subject: ticket.asunto,
        }), ticket.numero_pedido_indicado]
      )
      if (integrationOutbox) {
        await integrationOutbox.enqueueSupportRequested(client, {
          incidentId: ticket.agent_incident_id,
          reference: ticket.referencia,
          name: ticket.nombre_contacto,
          email: ticket.email_contacto,
          orderId: ticket.numero_pedido_indicado,
          subject: ticket.asunto,
          message: ticket.descripcion,
          createdAt: ticket.fecha_creacion,
          telegramChatId: process.env.TELEGRAM_TEST_CHAT_ID || null,
        })
      }
      await client.query('COMMIT')
      integrationOutbox?.kick()
      if (incidentSync) {
        try {
          await incidentSync.syncReference(ticket.referencia)
        } catch {
          // El ticket ya está confirmado en la tienda. El worker conserva el
          // error y reintentará sin hacer fallar la solicitud del cliente.
        }
      }
      return {
        id: ticket.referencia,
        createdAt: new Date(ticket.fecha_creacion).toISOString(),
        name: ticket.nombre_contacto,
        email: ticket.email_contacto,
        orderId: ticket.numero_pedido_indicado,
        subject: ticket.asunto,
        message: ticket.descripcion,
        status: ticket.estado,
        agentIncidentId: ticket.agent_incident_id,
        analysisStatus: 'idle',
        agentAction: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function listEvents() {
    const { rows } = await pool.query(
      `SELECT e.id_evento, e.tipo, e.fecha_creacion, e.id_sesion_web,
              e.datos_adicionales, c.email
       FROM evento e LEFT JOIN cliente c ON c.id_cliente = e.id_cliente
       ORDER BY e.fecha_creacion DESC`
    )
    return rows.map((row) => ({
      id: String(row.id_evento),
      type: row.tipo,
      timestamp: new Date(row.fecha_creacion).toISOString(),
      sessionId: row.id_sesion_web,
      user: row.email,
      payload: row.datos_adicionales,
    }))
  }

  async function listTickets() {
    const { rows } = await pool.query(
      `SELECT i.referencia, i.fecha_creacion, i.nombre_contacto, i.email_contacto,
              i.numero_pedido_indicado, i.asunto, i.descripcion, i.estado,
              i.agent_incident_id, i.agent_analysis_status, i.agent_analysis_error,
              ai.priority AS agent_priority, ai.incident_type,
              a.id AS action_id, a.case_type, a.proposed_action, a.justification,
              a.confidence, a.risks, a.review_status, a.reviewed_by,
              a.reviewed_at, a.created_at AS action_created_at
       FROM incidencia i
       LEFT JOIN incidents ai ON ai.incident_id = i.agent_incident_id
       LEFT JOIN LATERAL (
         SELECT * FROM agent_actions
         WHERE incident_id = i.agent_incident_id
         ORDER BY created_at DESC, id DESC LIMIT 1
       ) a ON true
       ORDER BY i.fecha_creacion DESC`
    )
    return rows.map((row) => ({
      id: row.referencia,
      createdAt: new Date(row.fecha_creacion).toISOString(),
      name: row.nombre_contacto,
      email: row.email_contacto,
      orderId: row.numero_pedido_indicado,
      subject: row.asunto,
      message: row.descripcion,
      status: row.estado,
      agentIncidentId: row.agent_incident_id,
      analysisStatus: row.agent_analysis_status,
      analysisError: row.agent_analysis_error,
      priority: row.agent_priority || 'medium',
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
        createdAt: new Date(row.action_created_at).toISOString(),
      } : null,
    }))
  }

  async function updateTicketStatus(reference, status) {
    const statusMap = {
      abierta: 'open',
      en_curso: 'in_progress',
      resuelta: 'resolved',
      cerrada: 'closed',
    }
    if (!Object.hasOwn(statusMap, status)) fail(400, 'El estado de la incidencia no es válido.')
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE incidencia SET estado = $2
         WHERE referencia = $1
         RETURNING agent_incident_id
       )
       UPDATE incidents ai
       SET status = $3, updated_at = now(),
           resolved_at = CASE WHEN $3 IN ('resolved', 'closed') THEN COALESCE(resolved_at, now()) ELSE NULL END
       FROM updated u WHERE ai.incident_id = u.agent_incident_id
       RETURNING ai.incident_id`,
      [reference, status, statusMap[status]]
    )
    if (!rows[0]) {
      const exists = await pool.query('SELECT 1 FROM incidencia WHERE referencia = $1', [reference])
      if (!exists.rows[0]) fail(404, 'Incidencia no encontrada.')
    }
    const tickets = await listTickets()
    return tickets.find((ticket) => ticket.id === reference)
  }

  return {
    track,
    createTicket,
    listEvents,
    listTickets,
    updateTicketStatus,
    async clearEvents() {
      await pool.query('DELETE FROM evento')
    },
    async clearTickets() {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const { rows } = await client.query(
          'SELECT agent_incident_id FROM incidencia WHERE agent_incident_id IS NOT NULL'
        )
        const ids = rows.map((row) => row.agent_incident_id)
        await client.query('DELETE FROM incidencia')
        if (ids.length) {
          await client.query('DELETE FROM agent_actions WHERE incident_id = ANY($1::uuid[])', [ids])
          await client.query('DELETE FROM incidents WHERE incident_id = ANY($1::uuid[])', [ids])
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
  }
}

module.exports = { createPostgresActivityService }
