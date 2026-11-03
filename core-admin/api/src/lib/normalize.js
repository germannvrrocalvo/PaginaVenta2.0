// Normalización de datos que llegan de la tienda / n8n al modelo del back-office

const ORDER_STATUSES = [
  'creado', 'pagado', 'pendiente_preparacion', 'enviado', 'entregado', 'cancelado', 'con_incidencia',
]
const ORDER_STATUS_ALIASES = {
  pending: 'creado', created: 'creado', paid: 'pagado', processing: 'pendiente_preparacion',
  preparing: 'pendiente_preparacion', shipped: 'enviado', delivered: 'entregado',
  cancelled: 'cancelado', canceled: 'cancelado', incident: 'con_incidencia',
}

const INCIDENT_STATUSES = ['abierta', 'en_curso', 'resuelta', 'cerrada']
const INCIDENT_STATUS_ALIASES = {
  open: 'abierta', in_progress: 'en_curso', resolved: 'resuelta', closed: 'cerrada',
}

const INCIDENT_TYPES = ['consulta', 'retraso', 'devolucion', 'producto_defectuoso', 'pago', 'otro']
const INCIDENT_TYPE_ALIASES = {
  question: 'consulta', delay: 'retraso', return: 'devolucion', refund: 'devolucion',
  defective: 'producto_defectuoso', payment: 'pago', other: 'otro',
}

const PRIORITIES = ['baja', 'media', 'alta']
const PRIORITY_ALIASES = { low: 'baja', medium: 'media', high: 'alta' }

function fromAliases(value, allowed, aliases) {
  if (typeof value !== 'string') return null
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (allowed.includes(key)) return key
  return aliases[key] || null
}

const normalizeOrderStatus = (v) => fromAliases(v, ORDER_STATUSES, ORDER_STATUS_ALIASES)
const normalizeIncidentStatus = (v) => fromAliases(v, INCIDENT_STATUSES, INCIDENT_STATUS_ALIASES)
const normalizeIncidentType = (v) => fromAliases(v, INCIDENT_TYPES, INCIDENT_TYPE_ALIASES)
const normalizePriority = (v) => fromAliases(v, PRIORITIES, PRIORITY_ALIASES)

const normalizeEmail = (v) => String(v).trim().toLowerCase()
const money = (v) => Math.round(Number(v) * 100) / 100
const cleanText = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v)

module.exports = {
  ORDER_STATUSES, INCIDENT_STATUSES, INCIDENT_TYPES, PRIORITIES,
  normalizeOrderStatus, normalizeIncidentStatus, normalizeIncidentType, normalizePriority,
  normalizeEmail, money, cleanText,
}