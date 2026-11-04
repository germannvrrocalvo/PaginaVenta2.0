const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const { createPostgresProductService } = require('../src/services/products-postgres')

const structure = readFileSync(join(__dirname, '../../database/Estructura.sql'), 'utf8')
const migration = readFileSync(join(__dirname, '../../database/migrations/007_paypal.sql'), 'utf8')
const sandboxMigration = readFileSync(join(__dirname, '../../database/migrations/008_paypal_sandbox.sql'), 'utf8')
const outboxMigration = readFileSync(join(__dirname, '../../database/migrations/009_order_created_outbox.sql'), 'utf8')
const statusOutboxMigration = readFileSync(join(__dirname, '../../database/migrations/010_order_status_changed.sql'), 'utf8')
const supportOutboxMigration = readFileSync(join(__dirname, '../../database/migrations/013_support_requested.sql'), 'utf8')
const incidentAgentMigration = readFileSync(join(__dirname, '../../database/migrations/011_incident_agent.sql'), 'utf8')
const separateBackofficeMigration = readFileSync(join(__dirname, '../../database/migrations/012_separate_backoffice.sql'), 'utf8')
const backofficeSchema = readFileSync(join(__dirname, '../../database/backoffice/schema.sql'), 'utf8')

test('el esquema limita método/referencia de pago y persiste las referencias PayPal', () => {
  assert.match(structure, /metodo\s+VARCHAR\(20\)\s+NOT NULL DEFAULT 'paypal_simulado' CHECK \(metodo IN \('paypal_simulado'\)\)/)
  assert.match(structure, /referencia_pago\s+VARCHAR\(10\)\s+NOT NULL UNIQUE CHECK \(referencia_pago ~ '\^PAY-\[A-Z0-9\]\{6\}\$'\)/)
  assert.match(structure, /paypal_order_id\s+VARCHAR\(64\)\s+UNIQUE/)
  assert.match(structure, /paypal_capture_id\s+VARCHAR\(64\)\s+UNIQUE/)
  assert.match(structure, /CHECK \(estado IN \('creado','pagado'/)
  assert.match(migration, /paypal_order_id/)
  assert.match(migration, /paypal_capture_id/)
  assert.match(sandboxMigration, /paypal_request_id/)
  assert.match(sandboxMigration, /recibo_enviado_en/)
  assert.match(sandboxMigration, /CHECK \(metodo IN \('paypal_simulado'\)\)/)
  assert.match(structure, /paypal_request_id\s+VARCHAR\(38\)/)
  assert.match(structure, /recibo_enviado_en\s+TIMESTAMPTZ/)
})

test('el catálogo usa stock PostgreSQL para las claves de variante y no recurre al stock obsoleto', async () => {
  const products = [{
    id: 'p001',
    stock: 10,
    variants: [
      { id: 'aluminio-cepillado', stock: 8 },
      { id: 'otra-variante', stock: 2 },
    ],
  }]
  const pool = {
    async query() {
      return {
        rows: [
          { product_id: 'p001', variant_id: null, stock: 6, variant_active: true },
          { product_id: 'p001', variant_id: 'aluminio-cepillado', stock: 4, variant_active: true },
          { product_id: 'p001', variant_id: 'otra-variante', stock: 99, variant_active: false },
        ],
      }
    },
  }

  const result = await createPostgresProductService(pool, products).list()
  assert.equal(result[0].stock, 6)
  assert.deepEqual(result[0].variants, [{ id: 'aluminio-cepillado', stock: 4 }])
})

test('el esquema incluye una outbox idempotente con reintentos para order.created', () => {
  for (const sql of [structure, outboxMigration]) {
    assert.match(sql, /CREATE TABLE(?: IF NOT EXISTS)? integration_outbox/)
    assert.match(sql, /event_id\s+VARCHAR\(120\) NOT NULL UNIQUE/)
    assert.match(sql, /'dead_letter'/)
    assert.match(sql, /payload\s+JSONB\s+NOT NULL/)
  }
})

test('la outbox admite eventos de sincronización order.status_changed', () => {
  assert.match(structure, /'order\.created','order\.status_changed'/)
  assert.match(statusOutboxMigration, /'order\.created', 'order\.status_changed'/)
  assert.match(statusOutboxMigration, /DROP CONSTRAINT IF EXISTS integration_outbox_event_type_check/)
})

test('la outbox admite el escenario support.requested', () => {
  assert.match(supportOutboxMigration, /support\.requested/)
  assert.match(supportOutboxMigration, /integration_outbox_event_type_check/)
})

test('el agente enlaza incidencias de tienda y conserva revisión humana', () => {
  for (const sql of [structure, incidentAgentMigration]) {
    assert.match(sql, /CREATE TABLE(?: IF NOT EXISTS)? incidents/)
    assert.match(sql, /CREATE TABLE(?: IF NOT EXISTS)? agent_actions/)
    assert.match(sql, /agent_incident_id/)
    assert.match(sql, /review_status/)
  }
  assert.match(incidentAgentMigration, /pending_review/)
  assert.match(incidentAgentMigration, /ON CONFLICT \(source_reference\)/)
})

test('el back office tiene esquema, autenticación y reintentos independientes', () => {
  assert.match(backofficeSchema, /CREATE TABLE IF NOT EXISTS backoffice_admins/)
  assert.match(backofficeSchema, /CREATE TABLE IF NOT EXISTS incidents/)
  assert.match(backofficeSchema, /CREATE TABLE IF NOT EXISTS agent_actions/)
  assert.match(backofficeSchema, /source_reference/)
  assert.match(separateBackofficeMigration, /backoffice_sync_status/)
  assert.match(separateBackofficeMigration, /backoffice_next_attempt_at/)
})
