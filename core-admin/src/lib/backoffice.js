import { api } from './api'

export const listIncidents = () => api('/Tickets_soporte')

export const updateIncidentStatus = (reference, status) => api(
  `/Tickets_soporte/${encodeURIComponent(reference)}/estado`,
  { method: 'PATCH', body: { status } }
)

export const analyzeIncident = (reference) => api(
  `/incidencias/${encodeURIComponent(reference)}/analizar`,
  { method: 'POST' }
)

export const reviewProposal = (reference, decision) => api(
  `/incidencias/${encodeURIComponent(reference)}/revision`,
  { method: 'PATCH', body: { decision } }
)
