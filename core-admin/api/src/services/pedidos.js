const { withTransaction } = require('../db/pool')
const { createChecker } = require('../lib/validate')
const { ValidationError, fail } = require('../lib/errors')
const { ORDER_STATUSES, normalizeOrderStatus, normalizeEmail, money, cleanText } = require('../lib/normalize')
const { upsertCliente } = require('./clientes')

// Idempotencia: devuelve false si ese event_id ya se había procesado
async function markProcessed(db, eventId, tipo, ref) {
  const { rowCount } = await db.query(
    `INSERT INTO evento_procesado (event_id, tipo_evento, entidad_ref)
     VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING`,
    [eventId, tipo, ref],
  )
  return rowCount === 1
}

function createPedidosService(pool) {
  // ---------- Escenario 1: order.created ----------
  function validateOrderCreated(p) {
    const c = createChecker(p)
    c.string('event_id', { max: 160 })
    c.oneOf('event_type', ['order.created'])
    c.date('timestamp')
    if (c.required('order')) {
      c.orderNumber('order.id')
      c.string('order.customer_id', { max: 60 })
      c.email('order.customer_email')
      c.string('order.customer_name', { required: false, min: 2, max: 120 })
      c.number('order.total', { min: 0, max: 1_000_000 })
      c.oneOf('order.currency', ['EUR'])
      c.custom('order.status', normalizeOrderStatus(c.value('order.status')) !== null,
        `estado no reconocido (${ORDER_STATUSES.join(', ')} o pending/paid/shipped...)`)
      c.date('order.created_at')
      if (c.array('order.items', { min: 1, max: 100 })) {
        c.value('order.items').forEach((_, i) => {
          c.string(`order.items.${i}.product_id`, { max: 60 })
          c.string(`order.items.${i}.name`, { max: 200 })
          c.number(`order.items.${i}.quantity`, { min: 1, max: 1000, integer: true })
          c.number(`order.items.${i}.unit_price`, { min: 0, max: 100_000 })
        })
      }
    }
    if (c.errors.length) throw new ValidationError(c.errors)
  }

  async function ingestOrderCreated(payload) {
    validateOrderCreated(payload)
    const o = payload.order
    const numero = o.id.trim()
    const estado = normalizeOrderStatus(o.status)
    const items = o.items.map((it) => ({
      producto_id: cleanText(String(it.product_id)),
      nombre: cleanText(it.name),
      cantidad: Number(it.quantity),
      precio_unitario: money(it.unit_price),
    }))

    // Aviso (no error) si las líneas no cuadran con el total: puede haber envío o descuentos
    const sumaLineas = money(items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0))
    const advertencias = []
    if (Math.abs(sumaLineas - money(o.total)) > 0.01) {
      advertencias.push(`La suma de líneas (${sumaLineas} €) no coincide con el total (${money(o.total)} €); puede incluir envío o descuentos.`)
    }

    const result = await withTransaction(pool, async (db) => {
      if (!(await markProcessed(db, payload.event_id, 'order.created', numero))) {
        return { duplicado: true, motivo: 'event_id ya procesado' }
      }
      const exists = await db.query('SELECT id FROM pedido WHERE numero = $1', [numero])
      if (exists.rowCount) return { duplicado: true, motivo: 'el pedido ya existe en el back-office' }

      const clienteId = await upsertCliente(db, {
        email: normalizeEmail(o.customer_email),
        nombre: cleanText(o.customer_name) || null,
        idExterno: String(o.customer_id).trim(),
      })
      const { rows } = await db.query(
        `INSERT INTO pedido (numero, cliente_id, total, moneda, estado, fecha_pedido, evento_origen, ultimo_evento_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [numero, clienteId, money(o.total), o.currency, estado, o.created_at, payload.event_id, payload.timestamp],
      )
      const pedidoId = rows[0].id
      for (const it of items) {
        await db.query(
          `INSERT INTO linea_pedido (pedido_id, producto_id, nombre, cantidad, precio_unitario)
           VALUES ($1,$2,$3,$4,$5)`,
          [pedidoId, it.producto_id, it.nombre, it.cantidad, it.precio_unitario],
        )
      }
      await db.query(
        `INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, origen, nota)
         VALUES ('pedido', $1, NULL, $2, 'integracion', $3)`,
        [pedidoId, estado, `Alta desde ${payload.event_id}`],
      )
      return { duplicado: false }
    })

    if (result.duplicado) {
      return {
        status: 200,
        resultado: 'duplicado',
        mensaje: `Pedido ${numero} no procesado: ${result.motivo}.`,
        entidad_ref: numero,
        body: { ok: true, resultado: 'already_processed', pedido: numero, motivo: result.motivo },
      }
    }
    return {
      status: 201,
      resultado: advertencias.length ? 'advertencia' : 'correcto',
      mensaje: `Pedido ${numero} registrado con ${items.length} línea(s).${advertencias.length ? ` ${advertencias[0]}` : ''}`,
      entidad_ref: numero,
      body: { ok: true, resultado: 'created', pedido: numero, estado, lineas: items.length, advertencias },
    }
  }

  // ---------- Escenario 2: order.status_changed ----------
  async function ingestStatusChanged(payload) {
    const c = createChecker(payload)
    c.string('event_id', { max: 160 })
    c.oneOf('event_type', ['order.status_changed'])
    c.date('timestamp')
    if (c.required('order')) {
      c.orderNumber('order.id')
      c.custom('order.status', normalizeOrderStatus(c.value('order.status')) !== null,
        `estado no reconocido (${ORDER_STATUSES.join(', ')})`)
    }
    c.string('reason', { required: false, max: 500 })
    if (c.errors.length) throw new ValidationError(c.errors)

    const numero = payload.order.id.trim()
    const estado = normalizeOrderStatus(payload.order.status)

    const r = await withTransaction(pool, async (db) => {
      const found = await db.query(
        'SELECT id, estado, ultimo_evento_en FROM pedido WHERE numero = $1 FOR UPDATE', [numero],
      )
      if (!found.rowCount) {
        fail(404, `El pedido ${numero} no existe en el back-office.`, { code: 'entidad_no_encontrada' })
      }
      const pedido = found.rows[0]
      if (!(await markProcessed(db, payload.event_id, 'order.status_changed', numero))) {
        return { tipo: 'duplicado', motivo: 'event_id ya procesado' }
      }
      // Si llega un evento más viejo que el último aplicado, se ignora
      if (pedido.ultimo_evento_en && new Date(payload.timestamp) < new Date(pedido.ultimo_evento_en)) {
        return { tipo: 'obsoleto', motivo: 'llega un evento más antiguo que el último aplicado' }
      }
      if (pedido.estado === estado) {
        await db.query('UPDATE pedido SET ultimo_evento_en = $2 WHERE id = $1', [pedido.id, payload.timestamp])
        return { tipo: 'sin_cambios', motivo: `el pedido ya estaba en estado ${estado}` }
      }
      await db.query(
        'UPDATE pedido SET estado = $2, ultimo_evento_en = $3, actualizado_en = now() WHERE id = $1',
        [pedido.id, estado, payload.timestamp],
      )
      await db.query(
        `INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, origen, nota)
         VALUES ('pedido', $1, $2, $3, 'integracion', $4)`,
        [pedido.id, pedido.estado, estado, cleanText(payload.reason) || `Sincronizado desde ${payload.event_id}`],
      )
      return { tipo: 'actualizado', anterior: pedido.estado }
    })

    if (r.tipo !== 'actualizado') {
      return {
        status: 200,
        resultado: r.tipo === 'obsoleto' ? 'advertencia' : 'duplicado',
        mensaje: `Pedido ${numero}: ${r.motivo}.`,
        entidad_ref: numero,
        body: { ok: true, resultado: r.tipo === 'duplicado' ? 'already_processed' : r.tipo, pedido: numero, motivo: r.motivo },
      }
    }
    return {
      status: 200,
      resultado: 'correcto',
      mensaje: `Pedido ${numero}: ${r.anterior} → ${estado}.`,
      entidad_ref: numero,
      body: { ok: true, resultado: 'updated', pedido: numero, estado_anterior: r.anterior, estado },
    }
  }

  return { ingestOrderCreated, ingestStatusChanged }
}

module.exports = { createPedidosService, markProcessed }