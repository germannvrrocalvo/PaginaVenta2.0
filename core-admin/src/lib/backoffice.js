import { api } from './api'

export const listIncidents = () => api('/backoffice/Tickets_soporte')

export const listOrders = () => api('/backoffice/pedidos')

export const updateIncidentStatus = (reference, status) => api(
  `/backoffice/Tickets_soporte/${encodeURIComponent(reference)}/estado`,
  { method: 'PATCH', body: { status } }
)

export const analyzeIncident = (reference) => api(
  `/backoffice/incidencias/${encodeURIComponent(reference)}/analizar`,
  { method: 'POST' }
)

export const reviewProposal = (reference, decision) => api(
  `/backoffice/incidencias/${encodeURIComponent(reference)}/revision`,
  { method: 'PATCH', body: { decision } }
)
