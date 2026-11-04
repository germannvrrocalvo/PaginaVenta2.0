const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  createBackofficeOrderReconciliation,
} = require('../src/services/backoffice-order-reconciliation')

test('reconcilia pedidos, importes, pago y líneas en la base del back office', async () => {
  const storePool = {
    async query(sql) {
      if (sql.includes('FROM linea_pedido')) {
        return { rows: [{
          order_id: 'UC-2026-01027',
          product_id: 'vinilo-azul',
          variant_id: 'edicion-limitada',
          product_name: 'Vinilo Azul',
          brand: 'UCAM Records',
          variant_type: 'Color',
          variant_value: 'Azul',
          quantity: 2,
          unit_price: '25.00',
          line_total: '50.00',
        }] }
      }
      return { rows: [{
        order_id: 'UC-2026-01027',
        customer_id: '7',
        customer_email: 'cliente@example.test',
        customer_name: 'Cliente Ejemplo',
        customer_phone: '600000000',
        envio_direccion: 'Calle Prueba 1',
        envio_ciudad: 'Murcia',
        envio_provincia: 'Murcia',
        envio_codigopostal: '30001',
        envio_pais: 'España',
        subtotal: '50.00',
        descuento: '0.00',
        gastos_envio: '6.90',
        total: '56.90',
        tipo_iva: '21.00',
        base_imponible: '47.02',
        impuesto: '9.88',
        order_status: 'pagado',
        payment_status: 'approved',
        payment_method: 'paypal_simulado',
        payment_reference: 'PAY-ABC123',
        paypal_order_id: 'PAYPAL-ORDER',
        paypal_capture_id: 'PAYPAL-CAPTURE',
        paid_at: new Date('2026-11-04T17:00:00.000Z'),
        receipt_sent_at: null,
        created_at: new Date('2026-11-04T16:55:00.000Z'),
        source_updated_at: new Date('2026-11-04T17:00:00.000Z'),
      }] }
    },
  }

  const statements = []
  const client = {
    async query(sql, parameters) {
      statements.push({ sql, parameters })
      return { rows: [] }
    },
    release() {},
  }
  const backofficePool = { async connect() { return client } }
  const reconciliation = createBackofficeOrderReconciliation(
    storePool,
    backofficePool,
    { logger: { info() {}, error() {} } }
  )

  const result = await reconciliation.reconcile()

  assert.deepEqual(result, { skipped: false, orders: 1, items: 1 })
  assert.equal(statements[0].sql, 'BEGIN')
  assert.match(statements[1].sql, /INSERT INTO orders/)
  assert.match(statements[1].sql, /ON CONFLICT \(order_id\) DO UPDATE/)
  assert.equal(statements[1].parameters[0], 'UC-2026-01027')
  assert.equal(statements[1].parameters[9], '56.90')
  assert.equal(statements[1].parameters[14], 'approved')
  assert.match(statements[2].sql, /DELETE FROM order_items/)
  assert.match(statements[3].sql, /INSERT INTO order_items/)
  assert.equal(statements[3].parameters[1], 'vinilo-azul:edicion-limitada')
  assert.equal(statements.at(-1).sql, 'COMMIT')
})

test('revierte la reconciliación si la base del back office falla', async () => {
  const storePool = {
    async query(sql) {
      if (sql.includes('FROM linea_pedido')) return { rows: [] }
      return { rows: [{
        order_id: 'UC-2026-01001',
        customer_id: '1',
        customer_email: 'cliente@example.test',
        customer_name: 'Cliente',
        customer_phone: '600000000',
        envio_direccion: 'Calle Prueba 1',
        envio_ciudad: 'Murcia',
        envio_provincia: 'Murcia',
        envio_codigopostal: '30001',
        envio_pais: 'España',
        subtotal: '10', descuento: '0', gastos_envio: '6.9', total: '16.9',
        tipo_iva: '21', base_imponible: '13.97', impuesto: '2.93',
        order_status: 'creado', payment_status: null, payment_method: null,
        payment_reference: null, paypal_order_id: null, paypal_capture_id: null,
        paid_at: null, receipt_sent_at: null,
        created_at: new Date(), source_updated_at: new Date(),
      }] }
    },
  }
  const statements = []
  const client = {
    async query(sql) {
      statements.push(sql)
      if (sql.includes('INSERT INTO orders')) throw new Error('back office no disponible')
      return { rows: [] }
    },
    release() {},
  }
  const reconciliation = createBackofficeOrderReconciliation(
    storePool,
    { async connect() { return client } },
    { logger: { info() {}, error() {} } }
  )

  await assert.rejects(() => reconciliation.reconcile(), /no disponible/)
  assert.ok(statements.includes('ROLLBACK'))
})
