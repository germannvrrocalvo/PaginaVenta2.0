const { randomBytes } = require('node:crypto')
const { computeTotals } = require('./pricing')

const round = (value) => Math.round(value * 100) / 100
const TAX_RATE = 21

const ORDER_STATUSES = new Set([
  'creado',
  'pagado',
  'pendiente_preparacion',
  'enviado',
  'cancelado',
  'con_incidencia',
  'entregado',
])

const shippingRules = {
  nombre: (value) => value.trim().length >= 2,
  apellidos: (value) => value.trim().length >= 2,
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  telefono: (value) => /^(?:\+34)?[6-9]\d{8}$/.test(value.replace(/\s/g, '')),
  direccion: (value) => value.trim().length >= 5,
  ciudad: (value) => value.trim().length >= 2,
  provincia: (value) => value.trim().length >= 2,
  cp: (value) => /^\d{5}$/.test(value),
}

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function validateShipping(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Indica los datos de envío.')
  for (const [field, rule] of Object.entries(shippingRules)) {
    if (typeof data[field] !== 'string' || !rule(data[field])) {
      fail(400, `Revisa el campo de envío: ${field}.`)
    }
  }
}

const ORDER_SELECT = `
  SELECT p.*, c.email AS customer_email, c.registrado AS customer_registered,
         pg.referencia_pago, pg.metodo, pg.resultado AS payment_result,
         pg.fecha_creacion AS payment_created_at,
         pg.paypal_order_id AS payment_paypal_order_id,
         pg.paypal_capture_id AS payment_paypal_capture_id,
         pg.recibo_enviado_en AS receipt_sent_at
  FROM pedido p
  JOIN cliente c ON c.id_cliente = p.id_cliente
  LEFT JOIN pago pg ON pg.id_pedido = p.id_pedido
`

function createPostgresOrderService(pool, products, getUserForToken, orderEventOutbox = null) {
  async function assembleOrders(rows) {
    if (!rows.length) return []
    const ids = rows.map((row) => row.id_pedido)
    const { rows: lineRows } = await pool.query(
      `SELECT lp.*, p.codigo AS product_id, p.slug, p.tipo_variante,
              v.codigo AS variant_id, v.imagen AS variant_image, p.imagen AS product_image
       FROM linea_pedido lp
       JOIN producto p ON p.id_producto = lp.id_producto
       JOIN variante_producto v ON v.id_variante = lp.id_variante
       WHERE lp.id_pedido = ANY($1::int[])
       ORDER BY lp.id_lineapedido`,
      [ids]
    )
    const linesByOrder = new Map(ids.map((id) => [id, []]))
    for (const line of lineRows) {
      const product = products.find((candidate) => candidate.id === line.product_id)
      const variant = product?.variants?.find((candidate) => candidate.id === line.variant_id)
      linesByOrder.get(line.id_pedido).push({
        productId: line.product_id,
        cartKey: line.variant_id ? `${line.product_id}:${line.variant_id}` : line.product_id,
        variantId: line.variant_id,
        variantType: line.tipo_variante,
        variantValue: line.variante_valor,
        name: line.nombre_producto,
        brand: line.marca,
        image: line.variant_image || variant?.image || line.product_image || product?.image,
        slug: line.slug,
        unitPrice: Number(line.precio_unitario),
        qty: line.cantidad,
      })
    }
    return rows.map((row) => ({
      id: row.numero_pedido,
      createdAt: new Date(row.fecha_creacion).toISOString(),
      status: row.estado,
      customer: {
        nombre: row.envio_nombre,
        email: row.customer_email,
        telefono: row.envio_telefono,
        direccion: row.envio_direccion,
        ciudad: row.envio_ciudad,
        provincia: row.envio_provincia,
        cp: row.envio_codigopostal.trim(),
        pais: row.envio_pais,
        guest: !row.customer_registered,
      },
      lines: linesByOrder.get(row.id_pedido),
      totals: {
        subtotal: Number(row.subtotal),
        discount: Number(row.descuento),
        shipping: Number(row.gastos_envio),
        total: Number(row.total),
        taxRate: Number(row.tipo_iva),
        taxBase: Number(row.base_imponible),
        taxAmount: Number(row.impuesto),
      },
      payment: row.referencia_pago ? {
        id: row.referencia_pago,
        method: row.metodo,
        result: row.payment_result,
        at: new Date(row.payment_created_at).toISOString(),
        paypalOrderId: row.payment_paypal_order_id,
        paypalCaptureId: row.payment_paypal_capture_id,
        receiptSentAt: row.receipt_sent_at ? new Date(row.receipt_sent_at).toISOString() : null,
      } : null,
      paypalOrderId: row.paypal_order_id,
    }))
  }

  async function getById(id) {
    const { rows } = await pool.query(`${ORDER_SELECT} WHERE p.numero_pedido = $1`, [id])
    return (await assembleOrders(rows))[0] ?? null
  }

  async function getRawById(client, id, lock = false) {
    const { rows } = await client.query(
      `SELECT p.*, c.email AS customer_email, c.registrado AS customer_registered,
              pg.referencia_pago, pg.metodo, pg.resultado AS payment_result,
              pg.fecha_creacion AS payment_created_at,
              pg.paypal_order_id AS payment_paypal_order_id,
              pg.paypal_capture_id AS payment_paypal_capture_id,
              pg.recibo_enviado_en AS receipt_sent_at
       FROM pedido p JOIN cliente c ON c.id_cliente = p.id_cliente
       LEFT JOIN pago pg ON pg.id_pedido = p.id_pedido
       WHERE p.numero_pedido = $1 ${lock ? 'FOR UPDATE OF p' : ''}`,
      [id]
    )
    return rows[0] ?? null
  }

  async function canAccess(order, user) {
    if (!order) return false
    if (order.customer.guest) return true
    const { rows } = await pool.query(
      'SELECT email FROM cliente WHERE id_cliente = (SELECT id_cliente FROM pedido WHERE numero_pedido = $1)',
      [order.id]
    )
    return Boolean(user && (user.role === 'admin' || rows[0]?.email === user.email))
  }

  async function listFor(user) {
    const params = []
    let where = ''
    if (user.role !== 'admin') {
      params.push(user.email)
      where = 'WHERE lower(c.email) = lower($1)'
    }
    const { rows } = await pool.query(
      `${ORDER_SELECT} ${where} ORDER BY p.fecha_creacion DESC`,
      params
    )
    return assembleOrders(rows)
  }

  async function create({ items, shipping }, user) {
    validateShipping(shipping)
    if (!Array.isArray(items) || items.length === 0) fail(400, 'El pedido debe incluir al menos un producto.')

    const quantities = new Map()
    for (const item of items) {
      if (!item || typeof item.productId !== 'string' ||
          !(item.variantId === null || typeof item.variantId === 'string') ||
          !Number.isInteger(item.qty) || item.qty < 1) {
        fail(400, 'Cada línea requiere producto, variante y cantidad válida.')
      }
      const key = `${item.productId}:${item.variantId ?? ''}`
      quantities.set(key, (quantities.get(key) ?? 0) + item.qty)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const lines = []
      for (const [key, qty] of quantities) {
        const [productId, variantId] = key.split(':')
        const product = products.find((candidate) => candidate.id === productId)
        if (!product) fail(400, 'Uno de los productos ya no está disponible.')
        const { rows } = await client.query(
          `SELECT p.id_producto, v.id_variante, v.stock
           FROM producto p JOIN variante_producto v ON v.id_producto = p.id_producto
           WHERE p.codigo = $1 AND p.activo AND v.activo
             AND (($2::text IS NULL AND v.es_base) OR v.codigo = $2)`,
          [productId, variantId || null]
        )
        if (!rows[0]) fail(400, 'Una variante ya no está disponible.')
        if (rows[0].stock < qty) {
          const variant = product.variants?.find((candidate) => candidate.id === variantId)
          fail(409, `Stock insuficiente para ${product.name}${variant ? ` (${variant.finish ?? variant.color})` : ''}.`)
        }
        const variant = variantId
          ? product.variants?.find((candidate) => candidate.id === variantId)
          : null
        lines.push({ product, variant, qty, productDbId: rows[0].id_producto, variantDbId: rows[0].id_variante })
      }

      let customerId
      if (user) {
        customerId = Number(user.id)
      } else {
        const { rows } = await client.query(
          `INSERT INTO cliente (nombre, apellidos, email, telefono, registrado, rol)
           VALUES ($1, $2, $3, $4, FALSE, 'cliente') RETURNING id_cliente`,
          [shipping.nombre.trim(), shipping.apellidos.trim(), shipping.email.trim().toLowerCase(), shipping.telefono.trim()]
        )
        customerId = rows[0].id_cliente
      }

      const totals = computeTotals(lines.map(({ product, qty }) => ({ price: product.price, qty })), {
        user: user ? { role: user.role, joinedAt: user.joinedAt } : null,
      })
      const { rows: orderRows } = await client.query(
        `INSERT INTO pedido (
           id_cliente, estado, envio_nombre, envio_email, envio_telefono,
           envio_direccion, envio_ciudad, envio_provincia, envio_codigopostal, envio_pais,
           subtotal, descuento, gastos_envio, total, tipo_iva, base_imponible, impuesto
         ) VALUES ($1, 'creado', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id_pedido, numero_pedido, fecha_creacion`,
        [
          customerId,
          `${shipping.nombre.trim()} ${shipping.apellidos.trim()}`,
          shipping.email.trim().toLowerCase(),
          shipping.telefono.trim(),
          shipping.direccion.trim(),
          shipping.ciudad.trim(),
          shipping.provincia.trim(),
          shipping.cp.trim(),
          typeof shipping.pais === 'string' && shipping.pais.trim() ? shipping.pais.trim() : 'España',
          totals.subtotal,
          totals.discount,
          totals.shipping,
          totals.total,
          TAX_RATE,
          round(totals.total - totals.ivaIncluded),
          totals.ivaIncluded,
        ]
      )
      const orderDb = orderRows[0]
      for (const line of lines) {
        const variantValue = line.variant?.finish ?? line.variant?.color ??
          line.product.finish ?? line.product.color ?? ''
        await client.query(
          `INSERT INTO linea_pedido (
             id_pedido, id_producto, id_variante, nombre_producto, marca,
             variante_tipo, variante_valor, precio_unitario, cantidad
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            orderDb.id_pedido,
            line.productDbId,
            line.variantDbId,
            line.product.name,
            line.product.brand,
            line.product.finish ? 'Acabado' : line.product.color ? 'Color' : 'Acabado',
            variantValue,
            line.product.price,
            line.qty,
          ]
        )
      }
      if (orderEventOutbox) {
        await orderEventOutbox.enqueue(client, {
          id: orderDb.numero_pedido,
          customerId,
          customerEmail: user ? user.email : shipping.email.trim().toLowerCase(),
          createdAt: orderDb.fecha_creacion,
          items: lines.map((line) => ({
            productId: line.product.id,
            name: line.product.name,
            quantity: line.qty,
            unitPrice: line.product.price,
          })),
          total: totals.total,
        })
      }
      await client.query('COMMIT')
      orderEventOutbox?.kick()
      return getById(orderDb.numero_pedido)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function registerPayment(id, { method, result, paypalOrderId, paypalCaptureId }, user) {
    if (method !== 'paypal_simulado' || !['approved', 'declined'].includes(result)) {
      fail(400, 'Los datos del pago no son válidos.')
    }
    for (const providerId of [paypalOrderId, paypalCaptureId]) {
      if (providerId !== undefined && providerId !== null &&
          (typeof providerId !== 'string' || providerId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(providerId))) {
        fail(400, 'La referencia de PayPal no es válida.')
      }
    }
    const accessibleOrder = await getById(id)
    if (!accessibleOrder || !(await canAccess(accessibleOrder, user))) fail(404, 'Pedido no encontrado.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const order = await getRawById(client, id, true)
      if (!order) fail(404, 'Pedido no encontrado.')
      if (order.estado !== 'creado' || order.referencia_pago) fail(409, 'El pedido ya no admite cambios de pago.')

      if (result === 'approved') {
        const { rows: stockLines } = await client.query(
          `SELECT lp.id_variante, lp.cantidad, lp.nombre_producto, lp.variante_valor, v.stock
           FROM linea_pedido lp JOIN variante_producto v ON v.id_variante = lp.id_variante
           WHERE lp.id_pedido = $1 FOR UPDATE OF v`,
          [order.id_pedido]
        )
        for (const line of stockLines) {
          if (line.stock < line.cantidad) {
            fail(409, `Stock insuficiente para ${line.nombre_producto} (${line.variante_valor}).`)
          }
        }
        for (const line of stockLines) {
          await client.query(
            'UPDATE variante_producto SET stock = stock - $1 WHERE id_variante = $2',
            [line.cantidad, line.id_variante]
          )
        }
      }

      const reference = `PAY-${randomBytes(3).toString('hex').toUpperCase()}`
      await client.query(
        `INSERT INTO pago (
           id_pedido, metodo, importe, resultado, referencia_pago,
           paypal_order_id, paypal_capture_id
         ) VALUES ($1, 'paypal_simulado', $2, $3, $4, $5, $6)`,
        [
          order.id_pedido,
          order.total,
          result,
          reference,
          typeof paypalOrderId === 'string' ? paypalOrderId : null,
          typeof paypalCaptureId === 'string' ? paypalCaptureId : null,
        ]
      )
      const nextStatus = result === 'approved' ? 'pagado' : 'con_incidencia'
      const { rows: statusRows } = await client.query(
        `UPDATE pedido SET estado = $1 WHERE id_pedido = $2
         RETURNING fecha_actualizacion`,
        [nextStatus, order.id_pedido]
      )
      if (orderEventOutbox) {
        await orderEventOutbox.enqueueStatusChanged(client, {
          id,
          fromStatus: order.estado,
          toStatus: nextStatus,
          changedAt: statusRows[0].fecha_actualizacion,
          source: 'payment',
        })
      }
      await client.query('COMMIT')
      orderEventOutbox?.kick()
      return getById(id)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function createPaypalOrder(id, user, paypalService) {
    const initial = await getById(id)
    if (!initial || !(await canAccess(initial, user))) fail(404, 'Pedido no encontrado.')
    if (initial.status !== 'creado') fail(409, 'El pedido ya no admite pagos.')

    let paypalOrderId = initial.paypalOrderId
    if (paypalOrderId) {
      const existing = await paypalService.getOrder(paypalOrderId)
      if (existing.status === 'CREATED' || existing.status === 'APPROVED') {
        return { id: paypalOrderId }
      }
      if (existing.status !== 'VOIDED') fail(409, 'La orden de PayPal no está disponible para continuar.')
      await pool.query(
        `UPDATE pedido SET paypal_order_id = NULL, paypal_request_id = NULL
         WHERE numero_pedido = $1 AND estado = 'creado' AND paypal_order_id = $2`,
        [id, paypalOrderId]
      )
    }

    const client = await pool.connect()
    let requestId
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT id_pedido, numero_pedido, estado, total, paypal_order_id, paypal_request_id
         FROM pedido WHERE numero_pedido = $1 FOR UPDATE`,
        [id]
      )
      const order = rows[0]
      if (!order || order.estado !== 'creado') fail(409, 'El pedido ya no admite pagos.')
      if (order.paypal_order_id) {
        await client.query('COMMIT')
        return { id: order.paypal_order_id }
      }
      const lineItems = initial.lines.map((line) => ({
        name: [
          line.brand,
          line.name,
          line.variantValue ? `(${line.variantValue})` : null,
        ].filter(Boolean).join(' '),
        qty: line.qty,
        unitPrice: line.unitPrice,
      }))
      const itemTotalCents = initial.lines.reduce(
        (sum, line) => sum + Math.round(line.unitPrice * 100) * line.qty,
        0
      )
      const subtotalCents = Math.round(initial.totals.subtotal * 100)
      const discountCents = Math.round(initial.totals.discount * 100)
      const shippingCents = Math.round(initial.totals.shipping * 100)
      const totalCents = Math.round(initial.totals.total * 100)
      if (itemTotalCents !== subtotalCents ||
          subtotalCents - discountCents + shippingCents !== totalCents) {
        fail(500, 'El desglose guardado del pedido no coincide con su total.')
      }
      requestId = order.paypal_request_id || `${id}-${randomBytes(8).toString('hex')}`
      await client.query(
        'UPDATE pedido SET paypal_request_id = $1 WHERE id_pedido = $2',
        [requestId, order.id_pedido]
      )
      await client.query('COMMIT')

      const paypalOrder = await paypalService.createOrder({
        orderId: id,
        amount: initial.totals.total,
        items: lineItems,
        subtotal: initial.totals.subtotal,
        discount: initial.totals.discount,
        shipping: initial.totals.shipping,
        requestId,
      })
      const paypalOrderDetails = paypalOrder.purchase_units?.length
        ? paypalOrder
        : await paypalService.getOrder(paypalOrder.id)
      const purchaseUnit = paypalOrderDetails.purchase_units?.[0]
      if (paypalOrderDetails.id !== paypalOrder.id ||
          paypalOrderDetails.status !== 'CREATED' ||
          purchaseUnit?.reference_id !== id ||
          purchaseUnit?.amount?.currency_code !== 'EUR' ||
          Number(purchaseUnit?.amount?.value) !== Number(order.total)) {
        console.error('PayPal order details did not match the saved order:', {
          id: paypalOrderDetails.id,
          status: paypalOrderDetails.status,
          purchaseUnit,
          expectedOrderId: id,
          expectedAmount: Number(order.total).toFixed(2),
        })
        fail(502, 'PayPal devolvió una orden que no coincide con el pedido.')
      }
      const savedPaypalOrder = await pool.query(
        `UPDATE pedido SET paypal_order_id = $1
         WHERE numero_pedido = $2 AND estado = 'creado' AND paypal_request_id = $3`,
        [paypalOrder.id, id, requestId]
      )
      if (savedPaypalOrder.rowCount !== 1) {
        fail(409, 'El pedido cambió mientras se preparaba el pago. Vuelve a intentarlo.')
      }
      return { id: paypalOrder.id }
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK') } catch (rollbackError) {
          console.error('No se pudo revertir la creación de orden PayPal:', rollbackError)
        }
      }
      throw error
    } finally {
      client.release()
    }
  }

  async function cancelPaypalOrder(id, paypalOrderId, user) {
    const order = await getById(id)
    if (!order || !(await canAccess(order, user))) fail(404, 'Pedido no encontrado.')
    if (order.status !== 'creado') return
    await pool.query(
      `UPDATE pedido SET paypal_order_id = NULL, paypal_request_id = NULL
       WHERE numero_pedido = $1 AND estado = 'creado' AND paypal_order_id = $2`,
      [id, paypalOrderId]
    )
  }

  async function capturePaypalOrder(id, paypalOrderId, user, paypalService) {
    const initial = await getById(id)
    if (!initial || !(await canAccess(initial, user))) fail(404, 'Pedido no encontrado.')
    if (initial.status === 'pagado' && initial.payment?.paypalOrderId === paypalOrderId) {
      return { order: initial, alreadyPaid: true, shouldSendReceipt: !initial.payment.receiptSentAt }
    }
    if (initial.status !== 'creado' || initial.paypalOrderId !== paypalOrderId) {
      fail(409, 'La orden de PayPal no pertenece a este pedido o ya no admite pagos.')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT id_pedido, numero_pedido, estado, total, paypal_order_id
         FROM pedido WHERE numero_pedido = $1 FOR UPDATE`,
        [id]
      )
      const order = rows[0]
      if (!order) fail(404, 'Pedido no encontrado.')
      if (order.estado === 'pagado') {
        await client.query('COMMIT')
        const paidOrder = await getById(id)
        return { order: paidOrder, alreadyPaid: true, shouldSendReceipt: !paidOrder.payment?.receiptSentAt }
      }
      if (order.estado !== 'creado' || order.paypal_order_id !== paypalOrderId) {
        fail(409, 'La orden de PayPal no pertenece a este pedido o ya no admite pagos.')
      }

      const captureResponse = await paypalService.captureOrder(paypalOrderId, `${id}-capture`)
      if (captureResponse.status !== 'COMPLETED') {
        fail(402, 'PayPal todavía no ha completado el pago.')
      }
      const purchaseUnit = captureResponse.purchase_units?.find(
        (unit) => unit.reference_id === id || unit.custom_id === id
      )
      const capture = purchaseUnit?.payments?.captures?.find((entry) => entry.status === 'COMPLETED')
      if (!purchaseUnit || !capture ||
          purchaseUnit.reference_id !== id ||
          Number(capture.amount?.value) !== Number(order.total) ||
          capture.amount?.currency_code !== 'EUR') {
        console.error('PayPal capture response did not match order:', {
          orderId: id,
          paypalOrderId,
          captureResponse,
        })
        fail(409, 'El pago capturado no coincide con el pedido (importe, moneda u orden).')
      }
      if (typeof capture.id !== 'string' || !capture.id) {
        fail(502, 'PayPal no devolvió la referencia de captura.')
      }

      const { rows: stockLines } = await client.query(
        `SELECT lp.id_variante, lp.cantidad, lp.nombre_producto, lp.variante_valor, v.stock
         FROM linea_pedido lp JOIN variante_producto v ON v.id_variante = lp.id_variante
         WHERE lp.id_pedido = $1 ORDER BY lp.id_variante FOR UPDATE OF v`,
        [order.id_pedido]
      )
      for (const line of stockLines) {
        if (line.stock < line.cantidad) {
          fail(409, `Stock insuficiente para ${line.nombre_producto} (${line.variante_valor}).`)
        }
      }
      for (const line of stockLines) {
        await client.query(
          'UPDATE variante_producto SET stock = stock - $1 WHERE id_variante = $2',
          [line.cantidad, line.id_variante]
        )
      }

      const reference = `PAY-${randomBytes(3).toString('hex').toUpperCase()}`
      await client.query(
        `INSERT INTO pago (
           id_pedido, metodo, importe, resultado, referencia_pago,
           paypal_order_id, paypal_capture_id
         ) VALUES ($1, 'paypal_simulado', $2, 'approved', $3, $4, $5)`,
        [order.id_pedido, order.total, reference, paypalOrderId, capture.id]
      )
      const { rows: statusRows } = await client.query(
        `UPDATE pedido SET estado = 'pagado'
         WHERE id_pedido = $1 AND estado = 'creado'
         RETURNING fecha_actualizacion`,
        [order.id_pedido]
      )
      if (orderEventOutbox) {
        await orderEventOutbox.enqueueStatusChanged(client, {
          id,
          fromStatus: order.estado,
          toStatus: 'pagado',
          changedAt: statusRows[0].fecha_actualizacion,
          source: 'paypal',
        })
      }
      await client.query('COMMIT')
      orderEventOutbox?.kick()
      return { order: await getById(id), alreadyPaid: false, shouldSendReceipt: true }
    } catch (error) {
      try { await client.query('ROLLBACK') } catch (rollbackError) {
        console.error('No se pudo revertir la captura de pago:', rollbackError)
      }
      throw error
    } finally {
      client.release()
    }
  }

  async function markReceiptSent(id) {
    await pool.query(
      `UPDATE pago pg SET recibo_enviado_en = COALESCE(recibo_enviado_en, now())
       FROM pedido p
       WHERE p.id_pedido = pg.id_pedido AND p.numero_pedido = $1
         AND pg.resultado = 'approved'`,
      [id]
    )
  }

  async function updateStatus(id, status) {
    if (typeof status !== 'string' || !ORDER_STATUSES.has(status)) fail(400, 'El estado indicado no es válido.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        'SELECT id_pedido, estado FROM pedido WHERE numero_pedido = $1 FOR UPDATE',
        [id]
      )
      const order = rows[0]
      if (!order) fail(404, 'Pedido no encontrado.')
      if (order.estado === status) {
        await client.query('COMMIT')
        return getById(id)
      }

      const { rows: statusRows } = await client.query(
        `UPDATE pedido SET estado = $1 WHERE id_pedido = $2
         RETURNING fecha_actualizacion`,
        [status, order.id_pedido]
      )
      if (orderEventOutbox) {
        await orderEventOutbox.enqueueStatusChanged(client, {
          id,
          fromStatus: order.estado,
          toStatus: status,
          changedAt: statusRows[0].fecha_actualizacion,
          source: 'admin',
        })
      }
      await client.query('COMMIT')
      orderEventOutbox?.kick()
      return getById(id)
    } catch (error) {
      try { await client.query('ROLLBACK') } catch (rollbackError) {
        console.error('No se pudo revertir el cambio de estado:', rollbackError)
      }
      throw error
    } finally {
      client.release()
    }
  }

  return {
    listFor,
    getById,
    canAccess,
    create,
    registerPayment,
    createPaypalOrder,
    cancelPaypalOrder,
    capturePaypalOrder,
    markReceiptSent,
    updateStatus,
    getUserForToken,
  }
}

module.exports = { createPostgresOrderService, ORDER_STATUSES }
