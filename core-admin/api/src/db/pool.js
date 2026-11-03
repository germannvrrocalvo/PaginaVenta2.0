const fs = require('node:fs')
const path = require('node:path')
const { Pool } = require('pg')

function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL en core-admin/api/.env')
  }
  const useSsl = process.env.PGSSL
    ? process.env.PGSSL !== 'false'
    : /neon\.tech|sslmode=require/.test(connectionString)

  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5,
  })
}

// Crea las tablas si no existen (no borra nada)
async function applySchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await pool.query(sql)
}

// Ejecuta varias consultas como una sola transacción
async function withTransaction(pool, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { createPool, applySchema, withTransaction }