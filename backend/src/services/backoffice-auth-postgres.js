const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(scryptCallback)
const SESSION_DAYS = 30

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

function adminConfig(env = process.env) {
  const email = String(env.BO_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = String(env.BO_ADMIN_PASSWORD || '')
  if (!email || !password) {
    throw new Error('BO_ADMIN_EMAIL y BO_ADMIN_PASSWORD son obligatorias para CoreAdmin.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    throw new Error('La cuenta de CoreAdmin necesita un correo válido y una contraseña de al menos 8 caracteres.')
  }
  return { email, password, name: 'Administrador CoreAdmin', role: 'admin' }
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function makePasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt, 64)).toString('hex')
  return `${salt}:${hash}`
}

async function passwordMatches(password, storedHash) {
  const [salt, expectedHex] = String(storedHash || '').split(':')
  if (!salt || !expectedHex) return false
  const actual = Buffer.from((await scrypt(password, salt, 64)).toString('hex'), 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function userFromRow(row) {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: 'admin',
    joinedAt: new Date(row.created_at).toISOString(),
  }
}

function createBackofficeAuthService(pool, env = process.env) {
  async function getUserForToken(token) {
    if (!token) return null
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.email, a.created_at
       FROM backoffice_sessions s
       JOIN backoffice_admins a ON a.id = s.admin_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND a.active`,
      [tokenHash(token)]
    )
    return rows[0] ? userFromRow(rows[0]) : null
  }

  return {
    async initialize() {
      const configured = adminConfig(env)
      const passwordHash = await makePasswordHash(configured.password)
      await pool.query(
        `INSERT INTO backoffice_admins (email, name, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT ((lower(email))) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
             active = TRUE, updated_at = now()`,
        [configured.email, configured.name, passwordHash]
      )
    },

    async login({ email, password }) {
      const { rows } = await pool.query(
        `SELECT id, name, email, password_hash, created_at
         FROM backoffice_admins
         WHERE lower(email) = lower($1) AND active`,
        [String(email || '').trim()]
      )
      const admin = rows[0]
      if (!admin || !(await passwordMatches(String(password || ''), admin.password_hash))) {
        fail(401, 'Correo o contraseña incorrectos.')
      }
      const token = randomBytes(32).toString('base64url')
      await pool.query(
        `INSERT INTO backoffice_sessions (admin_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
        [admin.id, tokenHash(token), SESSION_DAYS]
      )
      return { token, user: userFromRow(admin) }
    },

    getUserForToken,

    async revokeToken(token) {
      if (!token) return false
      const result = await pool.query(
        'DELETE FROM backoffice_sessions WHERE token_hash = $1',
        [tokenHash(token)]
      )
      return result.rowCount > 0
    },
  }
}

module.exports = { adminConfig, createBackofficeAuthService }
