import { getStoredToken } from '../services/auth.js'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const RESOURCE = 'Tickets_soporte'

async function request(path = '', options = {}) {
  const token = getStoredToken()
  const response = await fetch(`${API_URL}/${RESOURCE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (response.status === 204) return null
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud de soporte.')
  return result
}

export const createTicket = (ticket) => request('', {
  method: 'POST',
  body: JSON.stringify(ticket),
})

export const getTickets = () => request()
export const clearTickets = () => request('', { method: 'DELETE' })

async function requestIncident(reference, operation, options) {
  const token = getStoredToken()
  const response = await fetch(
    `${API_URL}/incidencias/${encodeURIComponent(reference)}/${operation}`,
    {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  )
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'No se pudo gestionar la incidencia.')
  return result
}

export const analyzeTicket = (reference) => requestIncident(reference, 'analizar', { method: 'POST' })

export const reviewAgentAction = (reference, decision) => requestIncident(
  reference,
  'revision',
  { method: 'PATCH', body: JSON.stringify({ decision }) }
)
