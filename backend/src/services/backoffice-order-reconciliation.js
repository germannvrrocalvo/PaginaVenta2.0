const DEFAULT_INTERVAL_MS = 30_000

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 5_000 && parsed <= 60 * 60_000
    ? parsed
    : fallback
}

const ORDERS_QUERY = `
  SELECT
    p.numero_pedido AS order_id,
    p.id_cliente::text AS customer_id,
    COALESCE(NULLIF(p.envio_email, ''), c.email) AS customer_email,
    p.envio_nombre AS customer_name,
    p.envio_telefono AS customer_phone,
    p.envio_direccion,
    p.envio_ciudad,
    p.envio_provincia,
    trim(p.envio_codigopostal) AS envio_codigopostal,
    p.envio_pais,
    p.subtotal,
    p.descuento,
    p.gastos_envio,
    p.total,
    p.tipo_iva,
    p.base_imponible,
    p.impuesto,
    p.estado AS order_status,
    p.fecha_creacion AS created_at,
    p.fecha_actualizacion AS source_updated_at,
    pg.metodo AS payment_method,
    pg.resultado AS payment_status,
    pg.referencia_pago AS payment_reference,
    COALESCE(pg.paypal_order_id, p.paypal_order_id) AS paypal_order_id,
    pg.paypal_capture_id,
    pg.fecha_creacion AS paid_at,
    pg.recibo_enviado_en AS receipt_sent_at
  FROM pedido p
  JOIN cliente c ON c.id_cliente = p.id_cliente
  LEFT JOIN LATERAL (
    SELECT pago.*
    FROM pago
    WHERE pago.id_pedido = p.id_pedido
    ORDER BY (pago.resultado = 'approved') DESC, pago.fecha_creacion DESC, pago.id_pago DESC
    LIMIT 1
  ) pg ON true
  ORDER BY p.fecha_creacion, p.id_pedido`

const ITEMS_QUERY = `
  SELECT
    p.numero_pedido AS order_id,
    pr.codigo AS product_id,
    v.codigo AS variant_id,
    lp.nombre_producto AS product_name,
    lp.marca AS brand,
    lp.variante_tipo AS variant_type,
    lp.variante_valor AS variant_value,
    lp.cantidad AS quantity,
    lp.precio_unitario AS unit_price,
    lp.subtotal_linea AS line_total
  FROM linea_pedido lp
  JOIN pedido p ON p.id_pedido = lp.id_pedido
  JOIN producto pr ON pr.id_producto = lp.id_producto
  JOIN variante_producto v ON v.id_variante = lp.id_variante
  ORDER BY p.fecha_creacion, p.id_pedido, lp.id_lineapedido`

function createBackofficeOrderReconciliation(storePool, backofficePool, {
  intervalMs = positiveInteger(
    process.env.BACKOFFICE_ORDER_SYNC_INTERVAL_MS,
    DEFAULT_INTERVAL_MS
  ),
  logger = console,
} = {}) {
  let timer = null
  let running = false

  async function reconcile() {
    if (running) return { skipped: true, orders: 0, items: 0 }
    running = true
    let client
    try {
      const [{ rows: orders }, { rows: items }] = await Promise.all([
        storePool.query(ORDERS_QUERY),
        storePool.query(ITEMS_QUERY),
      ])
      const itemsByOrder = new Map()
      for (const item of items) {
        const collection = itemsByOrder.get(item.order_id) || []
        collection.push(item)
        itemsByOrder.set(item.order_id, collection)
      }

      client = await backofficePool.connect()
      await client.query('BEGIN')
      for (const order of orders) {
        await client.query(
           `INSERT INTO orders (
             order_id, event_id, customer_id, customer_email, customer_name, customer_phone,
             shipping_address, subtotal_amount, discount_amount, shipping_amount,
             total_amount, tax_rate, tax_base_amount, tax_amount, currency,
             order_status, payment_status, payment_method, payment_reference,
             paypal_order_id, paypal_capture_id, paid_at, receipt_sent_at,
             created_at, source_updated_at, source_synced_at, source_system, integrated_at
           ) VALUES (
             $1, 'store.sync:' || $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13,
             'EUR', $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, now(),
             'store', now()
           )
           ON CONFLICT (order_id) DO UPDATE SET
             customer_id = EXCLUDED.customer_id,
             customer_email = EXCLUDED.customer_email,
             customer_name = EXCLUDED.customer_name,
             customer_phone = EXCLUDED.customer_phone,
             shipping_address = EXCLUDED.shipping_address,
             subtotal_amount = EXCLUDED.subtotal_amount,
             discount_amount = EXCLUDED.discount_amount,
             shipping_amount = EXCLUDED.shipping_amount,
             total_amount = EXCLUDED.total_amount,
             tax_rate = EXCLUDED.tax_rate,
             tax_base_amount = EXCLUDED.tax_base_amount,
             tax_amount = EXCLUDED.tax_amount,
             currency = EXCLUDED.currency,
             order_status = EXCLUDED.order_status,
             payment_status = EXCLUDED.payment_status,
             payment_method = EXCLUDED.payment_method,
             payment_reference = EXCLUDED.payment_reference,
             paypal_order_id = EXCLUDED.paypal_order_id,
             paypal_capture_id = EXCLUDED.paypal_capture_id,
             paid_at = EXCLUDED.paid_at,
             receipt_sent_at = EXCLUDED.receipt_sent_at,
             created_at = EXCLUDED.created_at,
             source_updated_at = EXCLUDED.source_updated_at,
             source_synced_at = now(),
             source_system = 'store',
             integrated_at = now()`,
          [
            order.order_id,
            order.customer_id,
            order.customer_email,
            order.customer_name,
            order.customer_phone,
            JSON.stringify({
              address: order.envio_direccion,
              city: order.envio_ciudad,
              province: order.envio_provincia,
              postalCode: order.envio_codigopostal,
              country: order.envio_pais,
            }),
            order.subtotal,
            order.descuento,
            order.gastos_envio,
            order.total,
            order.tipo_iva,
            order.base_imponible,
            order.impuesto,
            order.order_status,
            order.payment_status,
            order.payment_method,
            order.payment_reference,
            order.paypal_order_id,
            order.paypal_capture_id,
            order.paid_at,
            order.receipt_sent_at,
            order.created_at,
            order.source_updated_at,
          ]
        )

        await client.query('DELETE FROM order_items WHERE order_id = $1', [order.order_id])
        for (const item of itemsByOrder.get(order.order_id) || []) {
          const lineId = item.variant_id
            ? `${item.product_id}:${item.variant_id}`
            : item.product_id
          await client.query(
            `INSERT INTO order_items (
               order_id, product_id, source_product_id, variant_id, product_name,
               brand, variant_type, variant_value, quantity, unit_price, line_total
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              item.order_id,
              lineId,
              item.product_id,
              item.variant_id,
              item.product_name,
              item.brand,
              item.variant_type,
              item.variant_value,
              item.quantity,
              item.unit_price,
              item.line_total,
            ]
          )
        }
      }
      await client.query('COMMIT')
      logger.info?.(
        `Reconciliación del back office completada: ${orders.length} pedidos y ${items.length} líneas.`
      )
      return { skipped: false, orders: orders.length, items: items.length }
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK') } catch {}
      }
      logger.error?.('No se pudo reconciliar pedidos con el back office:', error)
      throw error
    } finally {
      client?.release()
      running = false
    }
  }

  function start() {
    if (timer) return
    void reconcile().catch(() => {})
    timer = setInterval(() => void reconcile().catch(() => {}), intervalMs)
    timer.unref?.()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { reconcile, start, stop }
}

module.exports = {
  createBackofficeOrderReconciliation,
  ORDERS_QUERY,
  ITEMS_QUERY,
}
