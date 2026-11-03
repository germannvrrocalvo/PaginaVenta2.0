const DEFAULT_TIMEOUT_MS = 60_000

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 500 && parsed <= 60_000 ? parsed : fallback
}

function configurationError(webhookUrl, headerName, secret, nodeEnv) {
  if (!webhookUrl) return 'falta N8N_INCIDENT_AGENT_WEBHOOK_URL'
  if (!headerName) return 'falta N8N_INCIDENT_AGENT_WEBHOOK_HEADER'
  if (!secret) return 'falta N8N_INCIDENT_AGENT_WEBHOOK_SECRET'
  if (!/^[A-Za-z0-9-]+$/.test(headerName)) return 'el nombre de la cabecera de n8n no es válido'

  try {
    const parsed = new URL(webhookUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'la URL del agente no usa HTTP(S)'
    if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
      return 'N8N_INCIDENT_AGENT_WEBHOOK_URL debe usar HTTPS en producción'
    }
  } catch {
    return 'N8N_INCIDENT_AGENT_WEBHOOK_URL no es una URL válida'
  }
  return null
}

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function createIncidentAgentClient({
  fetchImpl = globalThis.fetch,
  webhookUrl = process.env.N8N_INCIDENT_AGENT_WEBHOOK_URL,
  headerName = process.env.N8N_INCIDENT_AGENT_WEBHOOK_HEADER,
  secret = process.env.N8N_INCIDENT_AGENT_WEBHOOK_SECRET,
  timeoutMs = positiveInteger(process.env.N8N_INCIDENT_AGENT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const configError = configurationError(webhookUrl, headerName, secret, nodeEnv)

  async function analyze(incidentId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incidentId)) {
      fail(400, 'El identificador de la incidencia no es válido.')
    }
    if (configError) fail(503, `El agente de IA no está configurado: ${configError}.`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          [headerName]: secret,
        },
        body: JSON.stringify({ incident_id: incidentId }),
        signal: controller.signal,
      })
      const text = await response.text()
      let result = null
      if (text) {
        try { result = JSON.parse(text) } catch { result = { message: text.slice(0, 500) } }
      }
      if (!response.ok) {
        fail(502, `El agente de n8n rechazó la solicitud (HTTP ${response.status}).`)
      }
      return result
    } catch (error) {
      if (controller.signal.aborted) fail(504, `El agente no respondió en ${timeoutMs} ms.`)
      if (error.status) throw error
      fail(502, 'No se pudo conectar con el agente de n8n.')
    } finally {
      clearTimeout(timeout)
    }
  }

  return { analyze, configurationError: configError }
}

module.exports = { createIncidentAgentClient, configurationError }
