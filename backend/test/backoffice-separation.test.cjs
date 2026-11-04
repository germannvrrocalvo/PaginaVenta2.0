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

test('lista únicamente pedidos reales del back office con sus líneas', async () => {
  const queries = []
  const pool = {
    async query(sql, parameters) {
      queries.push({ sql, parameters })
      if (sql.includes('FROM orders')) {
        return { rows: [{
          order_id: 'UC-2026-01027',
          customer_id: '7',
          customer_email: 'cliente@example.test',
          customer_name: 'Cliente Ejemplo',
          customer_phone: '600000000',
          shipping_address: { city: 'Murcia' },
          subtotal_amount: '50.00',
          discount_amount: '0.00',
          shipping_amount: '6.90',
          tax_rate: '21.00',
          tax_base_amount: '47.02',
          tax_amount: '9.88',
          total_amount: '56.90',
          currency: 'EUR',
          order_status: 'pagado',
          payment_status: 'approved',
          payment_method: 'paypal_simulado',
          payment_reference: 'PAY-ABC123',
          created_at: new Date('2026-11-04T16:55:00.000Z'),
          source_updated_at: new Date('2026-11-04T17:00:00.000Z'),
          source_synced_at: new Date('2026-11-04T17:01:00.000Z'),
        }] }
      }
      return { rows: [{
        order_id: 'UC-2026-01027',
        product_id: 'vinilo-azul:edicion-limitada',
        source_product_id: 'vinilo-azul',
        variant_id: 'edicion-limitada',
        product_name: 'Vinilo Azul',
        brand: 'UCAM Records',
        variant_type: 'Color',
        variant_value: 'Azul',
        quantity: 2,
        unit_price: '25.00',
        line_total: '50.00',
      }] }
    },
  }

  const orders = await createBackofficeActivityService(pool).listOrders()

  assert.equal(orders.length, 1)
  assert.equal(orders[0].id, 'UC-2026-01027')
  assert.equal(orders[0].status, 'Pagado')
  assert.equal(orders[0].payment, 'Pagado')
  assert.equal(orders[0].total, 56.9)
  assert.deepEqual(orders[0].products[0], {
    id: 'vinilo-azul:edicion-limitada',
    sourceProductId: 'vinilo-azul',
    variantId: 'edicion-limitada',
    name: 'Vinilo Azul',
    brand: 'UCAM Records',
    variantType: 'Color',
    variantValue: 'Azul',
    quantity: 2,
    price: 25,
    lineTotal: 50,
  })
  assert.match(queries[0].sql, /source_system = 'store'/)
  assert.deepEqual(queries[1].parameters, [['UC-2026-01027']])
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
