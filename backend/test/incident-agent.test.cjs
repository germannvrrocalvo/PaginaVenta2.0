const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createIncidentAgentClient } = require('../src/services/incident-agent-client')

const incidentId = '49a972fb-755f-4a89-8230-df61ff971b28'

test('envía al agente solo el UUID y el secreto en la cabecera configurada', async () => {
  let request
  const client = createIncidentAgentClient({
    webhookUrl: 'https://example.test/webhook/agente-incidencias',
    headerName: 'X-SIE-Agent-Secret',
    secret: 'secreto-solo-para-test',
    nodeEnv: 'production',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.deepEqual(await client.analyze(incidentId), { ok: true })
  assert.equal(request.url, 'https://example.test/webhook/agente-incidencias')
  assert.equal(request.options.headers['X-SIE-Agent-Secret'], 'secreto-solo-para-test')
  assert.deepEqual(JSON.parse(request.options.body), { incident_id: incidentId })
})

test('rechaza UUID inválido antes de llamar a n8n', async () => {
  let called = false
  const client = createIncidentAgentClient({
    webhookUrl: 'https://example.test/webhook/agente-incidencias',
    headerName: 'X-SIE-Agent-Secret',
    secret: 'test',
    fetchImpl: async () => { called = true },
  })
  await assert.rejects(() => client.analyze('INC-123'), (error) => error.status === 400)
  assert.equal(called, false)
})

test('informa de configuración incompleta sin revelar secretos', async () => {
  const client = createIncidentAgentClient({ webhookUrl: '', headerName: '', secret: '' })
  await assert.rejects(
    () => client.analyze(incidentId),
    (error) => error.status === 503 && /N8N_INCIDENT_AGENT_WEBHOOK_URL/.test(error.message)
  )
})
