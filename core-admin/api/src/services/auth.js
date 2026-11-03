const { hashPassword, verifyPassword, newToken, sha256 } = require('../lib/security')
const { fail } = require('../lib/errors')

const SESSION_HOURS = 12

function createAuthService(pool) {
  // Crea o actualiza el admin definido en el .env
  async function seedAdmin({ email, password, nombre = 'Administrador' }) {
    if (!email || !password) return null
    const normalized = email.trim().toLowerCase()
    const existing = await pool.query(
      'SELECT id, password_hash FROM usuario_admin WHERE email = $1',
      [normalized],
    )
    if (existing.rowCount && verifyPassword(password, existing.rows[0].password_hash)) {
      return existing.rows[0].id
    }
    const { rows } = await pool.query(
      `INSERT INTO usuario_admin (email, nombre, password_hash, rol)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [normalized, nombre, hashPassword(password)],
    )
    return rows[0].id
  }

  async function login(email, password) {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      fail(400, 'Introduce email y contraseña.')
    }
    const { rows } = await pool.query(
      'SELECT id, email, nombre, rol, password_hash FROM usuario_admin WHERE email = $1',
      [email.trim().toLowerCase()],
    )
    const user = rows[0]
    if (!user || !verifyPassword(password, user.password_hash)) {
      fail(401, 'Credenciales incorrectas.')
    }
    const token = newToken()
    await pool.query(
      `INSERT INTO sesion_admin (token_hash, usuario_id, expira_en)
       VALUES ($1, $2, now() + make_interval(hours => $3))`,
      [sha256(token), user.id, SESSION_HOURS],
    )
    await pool.query('DELETE FROM sesion_admin WHERE expira_en < now()')
    return { token, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } }
  }

  async function getUserForToken(token) {
    if (!token) return null
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.rol
         FROM sesion_admin s JOIN usuario_admin u ON u.id = s.usuario_id
        WHERE s.token_hash = $1 AND s.expira_en > now()`,
      [sha256(token)],
    )
    return rows[0] || null
  }

  async function logout(token) {
    if (token) await pool.query('DELETE FROM sesion_admin WHERE token_hash = $1', [sha256(token)])
  }

  return { seedAdmin, login, getUserForToken, logout }
}

module.exports = { createAuthService }