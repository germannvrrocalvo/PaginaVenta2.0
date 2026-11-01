import { getStoredToken } from '../services/auth.js'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

export const EVENT_TYPES = [
  'product.viewed',
  'cart.item_added',
  'checkout.started',
  'order.created',
  'payment.simulated',
  'support.requested',
  'order.status_changed',
]

const SESSION_KEY = 'ucam_session_id'

function getSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = `ses_${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

export function trackEvent(type, payload = {}) {
  const token = getStoredToken()
  const request = fetch(`${API_URL}/eventos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, payload, sessionId: getSessionId() }),
  }).then(async (response) => {
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'No se pudo registrar el evento.')
    return result
  })
  request.catch((error) => console.error('No se pudo registrar el evento:', error))
  return request
}

function requestEvents(path = '', options = {}) {
  const token = getStoredToken()
  return fetch(`${API_URL}/eventos${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (response) => {
    if (response.status === 204) return null
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los eventos.')
    return result
  })
}

export function getEvents() {
  return requestEvents()
}

export function clearEvents() {
  return requestEvents('', { method: 'DELETE' })
}

export function downloadEvents(events, format = 'json') {
  const content = format === 'csv'
    ? [
        'id,type,timestamp,sessionId,user,payload',
        ...events.map((event) => [
          event.id,
          event.type,
          event.timestamp,
          event.sessionId,
          event.user,
          JSON.stringify(event.payload),
        ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')),
      ].join('\n')
    : JSON.stringify(events, null, 2)
  const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ucam-events.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}
