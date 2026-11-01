import { getStoredToken } from '../services/auth.js'
import { trackEvent } from './events.js'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

export const ORDER_STATUS = {
  creado: 'Creado',
  pagado: 'Pagado',
  pendiente_preparacion: 'Pendiente de preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  con_incidencia: 'Con incidencia',
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getStoredToken()
  const response = await fetch(`${API_URL}/pedidos${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data.error || 'No se pudo completar la operación del pedido.')
    error.status = response.status
    throw error
  }
  return response.status === 204 ? null : response.json()
}

export const getOrders = () => request('')
export const getOrder = (id, trackingToken = '') => {
  const query = trackingToken ? `?tracking=${encodeURIComponent(trackingToken)}` : ''
  return request(`/${encodeURIComponent(id)}${query}`)
}

export async function createOrder({ customer, items }) {
  const shipping = Object.fromEntries(
    ['nombre', 'apellidos', 'email', 'telefono', 'direccion', 'ciudad', 'provincia', 'cp', 'pais']
      .filter((field) => typeof customer[field] === 'string')
      .map((field) => [field, customer[field]])
  )
  const order = await request('', {
    method: 'POST',
    body: {
      items: items.map((item) => ({
        productId: item.productId ?? item.id,
        variantId: item.variantId ?? null,
        qty: item.qty,
      })),
      shipping,
    },
  })
  trackEvent('order.created', { orderId: order.id, total: order.totals.total, lines: order.lines.length })
  return order
}

export async function registerPayment(orderId, { method, last4, result }) {
  const order = await request(`/${encodeURIComponent(orderId)}/pago`, {
    method: 'POST',
    body: { method, last4, result },
  })
  trackEvent('payment.simulated', { orderId, paymentId: order.payment.id, result })
  return order
}

export async function updateOrderStatus(id, status) {
  const order = await request(`/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    body: { status },
  })
  trackEvent('order.status_changed', { orderId: id, to: status })
  return order
}
