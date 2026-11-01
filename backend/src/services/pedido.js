const { randomBytes } = require('node:crypto')
const { computeTotals } = require('./pricing')

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
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    fail(400, 'Indica los datos de envío.')
  }
  for (const [field, rule] of Object.entries(shippingRules)) {
    if (typeof data[field] !== 'string' || !rule(data[field])) {
      fail(400, `Revisa el campo de envío: ${field}.`)
    }
  }
}

function createOrderService({ products, getUserForToken, now = () => new Date() }) {
  const orders = new Map()
  let nextNumber = 1000

  function listFor(user) {
    return [...orders.values()]
      .filter((order) => user.role === 'admin' || order.customer.email === user.email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  function getById(id) {
    return orders.get(id) ?? null
  }

  function canAccess(order, user) {
    return Boolean(order && (
      order.customer.guest ||
      (user && (order.customer.email === user.email || user.role === 'admin'))
    ))
  }

  function create({ items, shipping }, user) {
    validateShipping(shipping)
    if (!Array.isArray(items) || items.length === 0) {
      fail(400, 'El pedido debe incluir al menos un producto.')
    }

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

    const lines = []
    for (const [key, qty] of quantities) {
      const [productId, variantId = ''] = key.split(':')
      const product = products.find((candidate) => candidate.id === productId)
      if (!product) fail(400, 'Uno de los productos ya no está disponible.')
      const variant = variantId
        ? product.variants?.find((candidate) => candidate.id === variantId)
        : null
      if (variantId && !variant) fail(400, 'Una variante ya no está disponible.')
      const stock = variant ? variant.stock : product.stock
      if (!Number.isInteger(stock) || stock < qty) {
        fail(409, `Stock insuficiente para ${product.name}${variant ? ` (${variant.finish ?? variant.color})` : ''}.`)
      }
      lines.push({
        product,
        variant,
        qty,
        stock,
      })
    }

    const lineItems = lines.map(({ product, variant, qty }) => ({
      price: product.price,
      qty,
    }))
    const pricingUser = user ? { role: user.role, joinedAt: user.joinedAt } : null
    const totals = computeTotals(lineItems, { user: pricingUser, now: now() })

    const createdAt = now().toISOString()
    nextNumber = nextNumber >= 99999 ? 1 : nextNumber + 1
    let sequence = nextNumber
    while (orders.has(`UC-${createdAt.slice(0, 4)}-${String(sequence).padStart(5, '0')}`)) {
      sequence = sequence >= 99999 ? 1 : sequence + 1
      nextNumber = sequence
    }
    const order = {
      id: `UC-${createdAt.slice(0, 4)}-${String(sequence).padStart(5, '0')}`,
      createdAt,
      status: 'creado',
      customer: {
        nombre: `${shipping.nombre.trim()} ${shipping.apellidos.trim()}`,
        email: user ? user.email : shipping.email.trim().toLowerCase(),
        telefono: shipping.telefono.trim(),
        direccion: shipping.direccion.trim(),
        ciudad: shipping.ciudad.trim(),
        provincia: shipping.provincia.trim(),
        cp: shipping.cp.trim(),
        pais: typeof shipping.pais === 'string' && shipping.pais.trim() ? shipping.pais.trim() : 'España',
        guest: !user,
      },
      lines: lines.map(({ product, variant, qty }) => ({
        productId: product.id,
        cartKey: variant ? `${product.id}:${variant.id}` : product.id,
        variantId: variant?.id ?? null,
        variantType: product.finish ? 'Acabado' : product.color ? 'Color' : null,
        variantValue: variant?.finish ?? variant?.color ?? product.finish ?? product.color ?? null,
        name: product.name,
        brand: product.brand,
        image: variant?.image ?? product.image,
        slug: product.slug,
        unitPrice: product.price,
        qty,
      })),
      totals,
      payment: null,
    }
    orders.set(order.id, order)
    return order
  }

  function registerPayment(id, { method, last4, result }, user) {
    const order = getById(id)
    if (!canAccess(order, user)) fail(404, 'Pedido no encontrado.')
    if (order.status !== 'creado') fail(409, 'El pedido ya no admite cambios de pago.')
    if (method !== 'paypal_simulado' ||
        !['approved', 'declined'].includes(result)) {
      fail(400, 'Los datos del pago no son válidos.')
    }
    if (result === 'approved') {
      const stockLines = order.lines.map((line) => {
        const product = products.find((candidate) => candidate.id === line.productId)
        const variant = line.variantId
          ? product?.variants?.find((candidate) => candidate.id === line.variantId)
          : null
        const stock = variant ? variant.stock : product?.stock
        if (!product || (line.variantId && !variant) || !Number.isInteger(stock) || stock < line.qty) {
          fail(409, `Stock insuficiente para ${line.name}${line.variantValue ? ` (${line.variantValue})` : ''}.`)
        }
        return { product, variant, qty: line.qty }
      })
      for (const line of stockLines) {
        if (line.variant) line.variant.stock -= line.qty
        else line.product.stock -= line.qty
      }
    }
    order.payment = {
      id: `PAY-${randomBytes(3).toString('hex').toUpperCase()}`,
      method,
      last4: typeof last4 === 'string' ? last4.slice(-4) : undefined,
      result,
      at: now().toISOString(),
    }
    order.status = result === 'approved' ? 'pagado' : 'con_incidencia'
    return order
  }

  function updateStatus(id, status) {
    const order = getById(id)
    if (!order) fail(404, 'Pedido no encontrado.')
    if (typeof status !== 'string' || !ORDER_STATUSES.has(status)) {
      fail(400, 'El estado indicado no es válido.')
    }
    order.status = status
    return order
  }

  return {
    listFor,
    getById,
    canAccess,
    create,
    registerPayment,
    updateStatus,
    getUserForToken,
  }
}

module.exports = { createOrderService, ORDER_STATUSES }
