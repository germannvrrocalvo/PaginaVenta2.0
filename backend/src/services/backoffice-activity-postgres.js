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

const ORDER_STATUS_LABELS = {
  creado: 'Creado',
  pagado: 'Pagado',
  pendiente_preparacion: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  con_incidencia: 'Con incidencia',
}

const PAYMENT_STATUS_LABELS = {
  approved: 'Pagado',
  declined: 'Rechazado',
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

function mapOrder(row, products) {
  return {
    id: row.order_id,
    customerId: row.customer_id,
    customer: row.customer_name || row.customer_email || row.customer_id || 'Sin identificar',
    email: row.customer_email || '',
    phone: row.customer_phone || '',
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: row.source_updated_at ? new Date(row.source_updated_at).toISOString() : null,
    syncedAt: row.source_synced_at ? new Date(row.source_synced_at).toISOString() : null,
    subtotal: Number(row.subtotal_amount || 0),
    discount: Number(row.discount_amount || 0),
    shipping: Number(row.shipping_amount || 0),
    taxRate: Number(row.tax_rate || 0),
    taxBase: Number(row.tax_base_amount || 0),
    tax: Number(row.tax_amount || 0),
    total: Number(row.total_amount || 0),
    currency: row.currency || 'EUR',
    rawStatus: row.order_status,
    status: ORDER_STATUS_LABELS[row.order_status] || row.order_status,
    rawPaymentStatus: row.payment_status,
    payment: PAYMENT_STATUS_LABELS[row.payment_status] || (row.payment_status ? row.payment_status : 'Pendiente'),
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    shippingAddress: row.shipping_address || {},
    products,
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

  async function listOrders() {
    const { rows } = await pool.query(
      `SELECT order_id, customer_id, customer_email, customer_name, customer_phone,
              shipping_address, subtotal_amount, discount_amount, shipping_amount,
              tax_rate, tax_base_amount, tax_amount, total_amount, currency,
              order_status, payment_status, payment_method, payment_reference,
              created_at, source_updated_at, source_synced_at
       FROM orders
       WHERE source_system = 'store'
       ORDER BY created_at DESC, order_id DESC`
    )
    if (rows.length === 0) return []

    const orderIds = rows.map((row) => row.order_id)
    const { rows: itemRows } = await pool.query(
      `SELECT order_id, product_id, source_product_id, variant_id, product_name,
              brand, variant_type, variant_value, quantity, unit_price, line_total
       FROM order_items
       WHERE order_id = ANY($1::text[])
       ORDER BY order_id, id`,
      [orderIds]
    )
    const productsByOrder = new Map()
    for (const item of itemRows) {
      const products = productsByOrder.get(item.order_id) || []
      products.push({
        id: item.product_id,
        sourceProductId: item.source_product_id,
        variantId: item.variant_id,
        name: item.product_name || item.source_product_id || item.product_id,
        brand: item.brand,
        variantType: item.variant_type,
        variantValue: item.variant_value,
        quantity: Number(item.quantity),
        price: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })
      productsByOrder.set(item.order_id, products)
    }

    return rows.map((row) => mapOrder(row, productsByOrder.get(row.order_id) || []))
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

  return {
    upsertTicket,
    upsertAgentAction,
    listTickets,
    listOrders,
    findTicket,
    updateTicketStatus,
  }
}

module.exports = { createBackofficeActivityService }
