const { withTransaction } = require('../db/pool')
const { createChecker } = require('../lib/validate')
const { ValidationError, fail } = require('../lib/errors')
const {
  INCIDENT_STATUSES, INCIDENT_TYPES, PRIORITIES,
  normalizeIncidentStatus, normalizeIncidentType, normalizePriority, normalizeEmail, cleanText,
} = require('../lib/normalize')
const { upsertCliente } = require('./clientes')
const { markProcessed } = require('./pedidos')

const INTERACTION_CHANNELS = ['telegram', 'email', 'web', 'interno']
const INTERACTION_DIRECTIONS = ['entrante', 'saliente']
const INTERACTION_STATUSES = ['enviado', 'simulado', 'recibido', 'error']

function createIncidenciasService(pool) {
  function validateCreated(payload) {
    const c = createChecker(payload)
    c.string('event_id', { max: 160 })
    c.oneOf('event_type', ['support.requested'])
    c.date('timestamp')
    if (c.required('customer')) {
      c.email('customer.email')
      c.string('customer.name', { min: 2, max: 120 })
      c.string('customer.telegram_chat_id', { required: false, max: 40 })
    }
    if (c.required('incident')) {
      c.string('incident.reference', { max: 30 })
      c.string('incident.subject', { min: 4, max: 200 })
      c.string('incident.message', { min: 10 })
      c.orderNumber('incident.order_number', { required: false })
      const priority = c.value('incident.priority')
      c.custom('incident.priority', priority == null || normalizePriority(priority) !== null,
        `prioridad no reconocida (${PRIORITIES.join(', ')} o low/medium/high)`)
      const type = c.value('incident.type')
      c.custom('incident.type', type == null || normalizeIncidentType(type) !== null,
        `tipo no reconocido (${INCIDENT_TYPES.join(', ')} o question/delay/return...)`)
    }
    if (c.errors.length) throw new ValidationError(c.errors)
  }

  async function ingestCreated(payload) {
    validateCreated(payload)
    const customer = payload.customer
    const incident = payload.incident
    const referencia = cleanText(incident.reference)
    const tipo = normalizeIncidentType(incident.type) || 'consulta'
    const prioridad = normalizePriority(incident.priority) || 'media'
    const numeroPedido = incident.order_number ? incident.order_number.trim() : null

    const result = await withTransaction(pool, async (db) => {
      if (!(await markProcessed(db, payload.event_id, 'support.requested', referencia))) {
        return { duplicado: true, motivo: 'event_id ya procesado' }
      }
      const existing = await db.query('SELECT id FROM incidencia WHERE referencia = $1', [referencia])
      if (existing.rowCount) return { duplicado: true, motivo: 'la referencia ya existe en el back-office' }

      const clienteId = await upsertCliente(db, {
        email: normalizeEmail(customer.email),
        nombre: cleanText(customer.name),
        telegramChatId: customer.telegram_chat_id,
      })
      const pedidoResult = numeroPedido
        ? await db.query('SELECT id FROM pedido WHERE numero = $1', [numeroPedido])
        : { rowCount: 0, rows: [] }
      const pedidoId = pedidoResult.rowCount ? pedidoResult.rows[0].id : null
      const { rows } = await db.query(
        `INSERT INTO incidencia
           (referencia, pedido_id, numero_pedido_indicado, cliente_id, tipo, asunto, descripcion,
            prioridad, estado, canal, evento_origen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'abierta','web',$9)
         RETURNING id`,
        [
          referencia, pedidoId, numeroPedido, clienteId, tipo, cleanText(incident.subject),
          cleanText(incident.message), prioridad, payload.event_id,
        ],
      )
      const incidenciaId = rows[0].id
      await db.query(
        `INSERT INTO interaccion (incidencia_id, canal, direccion, contenido, estado)
         VALUES ($1, 'web', 'entrante', $2, 'recibido')`,
        [incidenciaId, cleanText(incident.message)],
      )
      await db.query(
        `INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, origen, nota)
         VALUES ('incidencia', $1, NULL, 'abierta', 'integracion', $2)`,
        [incidenciaId, `Alta desde ${payload.event_id}`],
      )
      return { duplicado: false, pedidoVinculado: Boolean(pedidoId) }
    })

    if (result.duplicado) {
      return {
        status: 200,
        resultado: 'duplicado',
        mensaje: `Incidencia ${referencia} no procesada: ${result.motivo}.`,
        entidad_ref: referencia,
        body: { ok: true, resultado: 'already_processed', referencia, motivo: result.motivo },
      }
    }

    const advertencias = numeroPedido && !result.pedidoVinculado
      ? [`El pedido ${numeroPedido} no existe en el back-office; se conserva el número indicado.`]
      : []
    return {
      status: 201,
      resultado: advertencias.length ? 'advertencia' : 'correcto',
      mensaje: `Incidencia ${referencia} registrada.${advertencias.length ? ` ${advertencias[0]}` : ''}`,
      entidad_ref: referencia,
      body: {
        ok: true,
        resultado: 'created',
        referencia,
        estado: 'abierta',
        pedido_vinculado: result.pedidoVinculado,
        advertencias,
      },
    }
  }

  async function createInteraction(referencia, payload) {
    const c = createChecker(payload)
    c.string('event_id', { required: false, max: 160 })
    c.oneOf('canal', INTERACTION_CHANNELS)
    c.oneOf('direccion', INTERACTION_DIRECTIONS)
    c.string('mensaje', { max: 10_000 })
    c.oneOf('estado', INTERACTION_STATUSES)
    c.string('telegram_chat_id', { required: false, max: 40 })
    if (c.errors.length) throw new ValidationError(c.errors)

    const result = await withTransaction(pool, async (db) => {
      const found = await db.query(
        `SELECT i.id, i.cliente_id
         FROM incidencia i
         WHERE i.referencia = $1
         FOR UPDATE`,
        [referencia],
      )
      if (!found.rowCount) fail(404, `La incidencia ${referencia} no existe.`, { code: 'entidad_no_encontrada' })
      if (payload.event_id && !(await markProcessed(db, payload.event_id, 'support.interaction', referencia))) {
        return { duplicado: true }
      }
      if (payload.telegram_chat_id) {
        await db.query(
          'UPDATE cliente SET telegram_chat_id = $2, actualizado_en = now() WHERE id = $1',
          [found.rows[0].cliente_id, String(payload.telegram_chat_id).trim()],
        )
      }
      await db.query(
        `INSERT INTO interaccion (incidencia_id, canal, direccion, contenido, estado)
         VALUES ($1,$2,$3,$4,$5)`,
        [found.rows[0].id, payload.canal, payload.direccion, cleanText(payload.mensaje), payload.estado],
      )
      return { duplicado: false }
    })

    if (result.duplicado) {
      return {
        status: 200, resultado: 'duplicado', mensaje: `Interacción de ${referencia} ya procesada.`,
        entidad_ref: referencia,
        body: { ok: true, resultado: 'already_processed', referencia },
      }
    }
    const fallo = payload.estado === 'error'
    return {
      status: 201,
      resultado: fallo ? 'error' : 'correcto',
      mensaje: fallo
        ? `Interacción registrada con error para la incidencia ${referencia}.`
        : `Interacción registrada para la incidencia ${referencia}.`,
      entidad_ref: referencia,
      body: { ok: true, resultado: 'created', referencia, estado: payload.estado },
    }
  }

  async function updateIncident(referencia, payload) {
    const c = createChecker(payload)
    c.string('event_id', { max: 160 })
    c.oneOf('event_type', ['support.status_changed'])
    c.custom('cambio', payload.estado !== undefined || payload.prioridad !== undefined || payload.tipo !== undefined,
      'debe indicar estado, prioridad o tipo')
    if (payload.estado !== undefined) {
      c.custom('estado', normalizeIncidentStatus(payload.estado) !== null,
        `estado no reconocido (${INCIDENT_STATUSES.join(', ')} o open/in_progress/resolved/closed)`)
    }
    if (payload.prioridad !== undefined) {
      c.custom('prioridad', normalizePriority(payload.prioridad) !== null,
        `prioridad no reconocida (${PRIORITIES.join(', ')} o low/medium/high)`)
    }
    if (payload.tipo !== undefined) {
      c.custom('tipo', normalizeIncidentType(payload.tipo) !== null,
        `tipo no reconocido (${INCIDENT_TYPES.join(', ')} o question/delay/return...)`)
    }
    c.string('nota', { required: false, max: 500 })
    if (c.errors.length) throw new ValidationError(c.errors)

    const result = await withTransaction(pool, async (db) => {
      const found = await db.query(
        'SELECT id, estado, prioridad, tipo, resuelta_en FROM incidencia WHERE referencia = $1 FOR UPDATE',
        [referencia],
      )
      if (!found.rowCount) fail(404, `La incidencia ${referencia} no existe.`, { code: 'entidad_no_encontrada' })
      if (!(await markProcessed(db, payload.event_id, 'support.status_changed', referencia))) {
        return { duplicado: true }
      }

      const current = found.rows[0]
      const estado = payload.estado === undefined ? current.estado : normalizeIncidentStatus(payload.estado)
      const prioridad = payload.prioridad === undefined ? current.prioridad : normalizePriority(payload.prioridad)
      const tipo = payload.tipo === undefined ? current.tipo : normalizeIncidentType(payload.tipo)
      const changed = estado !== current.estado || prioridad !== current.prioridad || tipo !== current.tipo
      if (estado !== current.estado) {
        await db.query(
          `INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, origen, nota)
           VALUES ('incidencia', $1, $2, $3, 'integracion', $4)`,
          [
            current.id, current.estado, estado,
            cleanText(payload.nota) || `Cambio desde ${payload.event_id}`,
          ],
        )
      }
      if (changed) {
        await db.query(
          `UPDATE incidencia
           SET estado = $2, prioridad = $3, tipo = $4,
               resuelta_en = CASE WHEN $5 THEN COALESCE(resuelta_en, now()) ELSE NULL END,
               actualizado_en = now()
           WHERE id = $1`,
          [current.id, estado, prioridad, tipo, ['resuelta', 'cerrada'].includes(estado)],
        )
      }
      return { duplicado: false, changed, estadoAnterior: current.estado, estado, prioridad, tipo }
    })

    if (result.duplicado) {
      return {
        status: 200, resultado: 'duplicado', mensaje: `Cambio de ${referencia} ya procesado.`,
        entidad_ref: referencia,
        body: { ok: true, resultado: 'already_processed', referencia },
      }
    }
    return {
      status: 200,
      resultado: 'correcto',
      mensaje: result.changed ? `Incidencia ${referencia} actualizada.` : `Incidencia ${referencia} sin cambios.`,
      entidad_ref: referencia,
      body: {
        ok: true, resultado: 'updated', referencia, estado_anterior: result.estadoAnterior,
        estado: result.estado, prioridad: result.prioridad, tipo: result.tipo,
      },
    }
  }

  return { ingestCreated, createInteraction, updateIncident }
}

module.exports = { createIncidenciasService }
