const { randomBytes } = require('node:crypto')
const { EVENT_TYPES } = require('./activity')

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function createPostgresActivityService(pool, getUserForToken) {
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
      const { rows } = await client.query(
        `INSERT INTO incidencia (
           referencia, id_pedido, numero_pedido_indicado,
           nombre_contacto, email_contacto, asunto, descripcion
         ) VALUES (
           $1, (SELECT id_pedido FROM pedido WHERE numero_pedido = $2),
           $2, $3, $4, $5, $6
         )
         RETURNING referencia, fecha_creacion, nombre_contacto, email_contacto,
                   numero_pedido_indicado, asunto, descripcion, estado`,
        [
          reference,
          orderId || null,
          name.trim(),
          email.trim().toLowerCase(),
          subject.trim(),
          message.trim(),
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
      await client.query('COMMIT')
      return {
        id: ticket.referencia,
        createdAt: new Date(ticket.fecha_creacion).toISOString(),
        name: ticket.nombre_contacto,
        email: ticket.email_contacto,
        orderId: ticket.numero_pedido_indicado,
        subject: ticket.asunto,
        message: ticket.descripcion,
        status: ticket.estado,
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
      `SELECT referencia, fecha_creacion, nombre_contacto, email_contacto,
              numero_pedido_indicado, asunto, descripcion, estado
       FROM incidencia ORDER BY fecha_creacion DESC`
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
    }))
  }

  return {
    track,
    createTicket,
    listEvents,
    listTickets,
    async clearEvents() {
      await pool.query('DELETE FROM evento')
    },
    async clearTickets() {
      await pool.query('DELETE FROM incidencia')
    },
  }
}

module.exports = { createPostgresActivityService }
