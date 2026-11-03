const assert = require('node:assert/strict')
const { test } = require('node:test')
const { adminConfig } = require('../src/services/backoffice-auth-postgres')
const { createBackofficeActivityService } = require('../src/services/backoffice-activity-postgres')
const { createBackofficeIncidentSync } = require('../src/services/backoffice-incident-sync')

const incidentId = '49a972fb-755f-4a89-8230-df61ff971b28'

test('CoreAdmin exige credenciales propias y no incluye una contraseña en código', () => {
  assert.deepEqual(adminConfig({
    BO_ADMIN_EMAIL: 'COREADMIN@UCAM.TEST',
    BO_ADMIN_PASSWORD: 'clave-segura-de-prueba',
  }), {
    email: 'coreadmin@ucam.test',
    password: 'clave-segura-de-prueba',
    name: 'Administrador CoreAdmin',
    role: 'admin',
  })
  assert.throws(() => adminConfig({}), /son obligatorias/)
})

test('sincroniza una incidencia en el modelo independiente del back office', async () => {
  let insert
  const pool = {
    async query(sql, parameters) {
      insert = { sql, parameters }
      return { rows: [] }
    },
  }
  const service = createBackofficeActivityService(pool)
  await service.upsertTicket({
    id: 'INC-ABC123',
    agentIncidentId: incidentId,
    orderId: 'UC-2026-01001',
    email: 'cliente@example.test',
    name: 'Cliente Ejemplo',
    subject: 'Pedido retrasado',
    message: 'El pedido todavía no ha llegado.',
    status: 'abierta',
    priority: 'medium',
    createdAt: '2026-11-03T20:00:00.000Z',
  })
  assert.match(insert.sql, /INSERT INTO incidents/)
  assert.match(insert.sql, /ON CONFLICT \(incident_id\) DO UPDATE/)
  assert.equal(insert.parameters[0], incidentId)
  assert.equal(insert.parameters[1], 'INC-ABC123')
  assert.equal(insert.parameters[8], 'open')
})

test('un fallo del back office queda marcado para reintento', async () => {
  const updates = []
  const storePool = {
    async query(sql, parameters) {
      if (sql.includes('SELECT i.referencia')) {
        return { rows: [{
          referencia: 'INC-ABC123',
          fecha_creacion: new Date('2026-11-03T20:00:00.000Z'),
          nombre_contacto: 'Cliente Ejemplo',
          email_contacto: 'cliente@example.test',
          numero_pedido_indicado: null,
          asunto: 'Consulta',
          descripcion: 'Descripción suficientemente larga.',
          estado: 'abierta',
          agent_incident_id: incidentId,
          priority: 'medium',
        }] }
      }
      updates.push({ sql, parameters })
      return { rows: [] }
    },
  }
  const sync = createBackofficeIncidentSync(storePool, {
    async upsertTicket() { throw new Error('back office no disponible') },
  })
  await assert.rejects(() => sync.syncReference('INC-ABC123'), /no disponible/)
  assert.ok(updates.some(({ sql }) => sql.includes("backoffice_sync_status = 'retry'")))
})
