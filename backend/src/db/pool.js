const { Pool } = require('pg')

function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada. Define la conexión PostgreSQL antes de iniciar el backend.')
  }
  return new Pool({
    connectionString,
    ...(process.env.PGSSL === 'true' ? { ssl: true } : {}),
  })
}

module.exports = { createPool }
