const crypto = require('node:crypto')

// Contraseñas: scrypt con sal aleatoria (nunca se guardan en claro)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected)
}

// Tokens de sesión: se entrega el token y en BD solo se guarda su hash
const newToken = () => crypto.randomBytes(32).toString('hex')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

// Comparación segura (para el token de integración de n8n)
function safeEqual(a, b) {
  const left = Buffer.from(sha256(String(a)))
  const right = Buffer.from(sha256(String(b)))
  return crypto.timingSafeEqual(left, right)
}

// Lee "Authorization: Bearer <token>"
function bearerToken(req) {
  const [scheme, token] = (req.get('authorization') || '').split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null
}

module.exports = { hashPassword, verifyPassword, newToken, sha256, safeEqual, bearerToken }