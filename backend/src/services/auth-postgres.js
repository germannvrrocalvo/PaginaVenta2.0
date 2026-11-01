const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(scryptCallback)
const DEMO_USERS = [
  { email: 'cliente@ucam.test', password: 'demo1234', name: 'Cliente Demo', role: 'cliente' },
  { email: 'admin@ucam.test', password: 'admin1234', name: 'Admin Demo', role: 'admin' },
]
const SESSION_DAYS = 30

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function userFromRow(row) {
  return {
    id: String(row.id_cliente),
    name: row.nombre,
    email: row.email,
    role: row.rol,
    joinedAt: new Date(row.fecha_creacion).toISOString(),
  }
}

async function makePasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt, 64)).toString('hex')
  return `${salt}:${hash}`
}

async function passwordMatches(password, storedHash) {
  const [salt, expectedHex] = (storedHash || '').split(':')
  if (!salt || !expectedHex) return false
  const actual = Buffer.from((await scrypt(password, salt, 64)).toString('hex'), 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function createPostgresAuthService(pool) {
  async function getUserForToken(token) {
    if (!token) return null
    const { rows } = await pool.query(
      `SELECT c.id_cliente, c.nombre, c.email, c.rol, c.fecha_creacion
       FROM sesion s JOIN cliente c ON c.id_cliente = s.id_cliente
       WHERE s.token_hash = $1 AND s.fecha_expiracion > now() AND c.registrado`,
      [tokenHash(token)]
    )
    return rows[0] ? userFromRow(rows[0]) : null
  }

  async function createSession(client, userId) {
    const token = randomBytes(32).toString('base64url')
    const { rows } = await client.query(
      `INSERT INTO sesion (id_cliente, token_hash, fecha_expiracion)
       VALUES ($1, $2, now() + ($3 * interval '1 day'))
       RETURNING fecha_expiracion`,
      [userId, tokenHash(token), SESSION_DAYS]
    )
    const { rows: userRows } = await client.query(
      `SELECT id_cliente, nombre, email, rol, fecha_creacion FROM cliente WHERE id_cliente = $1`,
      [userId]
    )
    return { token, user: userFromRow(userRows[0]), expiresAt: rows[0].fecha_expiracion }
  }

  return {
    async initialize() {
      for (const demo of DEMO_USERS) {
        const passwordHash = await makePasswordHash(demo.password)
        const existing = await pool.query(
          'SELECT id_cliente FROM cliente WHERE lower(email) = lower($1) AND registrado',
          [demo.email]
        )
        if (existing.rows[0]) {
          await pool.query(
            `UPDATE cliente SET nombre = $2, rol = $3, password_hash = $4
             WHERE id_cliente = $1`,
            [existing.rows[0].id_cliente, demo.name, demo.role, passwordHash]
          )
        } else {
          await pool.query(
            `INSERT INTO cliente (nombre, email, password_hash, registrado, rol)
             VALUES ($1, $2, $3, TRUE, $4)`,
            [demo.name, demo.email, passwordHash, demo.role]
          )
        }
      }
    },

    async register({ name, email, password }) {
      const normalizedEmail = email.trim().toLowerCase()
      const normalizedName = name.trim()
      if (normalizedName.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8) {
        fail(400, 'Revisa tus datos. La contraseña debe tener al menos 8 caracteres.')
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const passwordHash = await makePasswordHash(password)
        const { rows } = await client.query(
          `INSERT INTO cliente (nombre, email, password_hash, registrado, rol)
           VALUES ($1, $2, $3, TRUE, 'cliente')
           RETURNING id_cliente`,
          [normalizedName, normalizedEmail, passwordHash]
        )
        const session = await createSession(client, rows[0].id_cliente)
        await client.query('COMMIT')
        return session
      } catch (error) {
        await client.query('ROLLBACK')
        if (error.code === '23505') fail(409, 'Ya existe una cuenta con este correo. Inicia sesión.')
        throw error
      } finally {
        client.release()
      }
    },

    async login({ email, password }) {
      const { rows } = await pool.query(
        `SELECT id_cliente, nombre, email, rol, fecha_creacion, password_hash
         FROM cliente WHERE lower(email) = lower($1) AND registrado`,
        [email.trim()]
      )
      const user = rows[0]
      if (!user || !(await passwordMatches(password, user.password_hash))) {
        fail(401, 'Correo o contraseña incorrectos.')
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const session = await createSession(client, user.id_cliente)
        await client.query('COMMIT')
        return session
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },

    getUserForToken,

    async revokeToken(token) {
      if (!token) return false
      const result = await pool.query('DELETE FROM sesion WHERE token_hash = $1', [tokenHash(token)])
      return result.rowCount > 0
    },
  }
}

module.exports = { createPostgresAuthService }
