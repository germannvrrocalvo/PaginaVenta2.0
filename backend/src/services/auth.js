const { randomBytes, scrypt: scryptCallback, scryptSync, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(scryptCallback)
const DEMO_USERS = [
  { email: 'cliente@ucam.test', password: 'demo1234', name: 'Cliente Demo', role: 'cliente' },
  { email: 'admin@ucam.test', password: 'admin1234', name: 'Admin Demo', role: 'admin' },
]

function publicUser(user) {
  const { id, name, email, role, joinedAt } = user
  return { id, name, email, role, joinedAt }
}

function createAuthService() {
  const users = new Map()
  const sessions = new Map()

  for (const demo of DEMO_USERS) {
    const salt = randomBytes(16).toString('hex')
    const passwordHash = scryptSync(demo.password, salt, 64).toString('hex')
    const user = {
      id: randomBytes(16).toString('hex'),
      name: demo.name,
      email: demo.email,
      role: demo.role,
      joinedAt: new Date().toISOString(),
      salt,
      passwordHash,
    }
    users.set(user.email, user)
  }

  async function hashPassword(password, salt) {
    return (await scrypt(password, salt, 64)).toString('hex')
  }

  function createSession(user) {
    const token = randomBytes(32).toString('base64url')
    sessions.set(token, user.email)
    return { token, user: publicUser(user) }
  }

  return {
    async register({ name, email, password }) {
      const normalizedEmail = email.trim().toLowerCase()
      const normalizedName = name.trim()
      if (normalizedName.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8) {
        const error = new Error('Revisa tus datos. La contraseña debe tener al menos 8 caracteres.')
        error.status = 400
        throw error
      }
      if (users.has(normalizedEmail)) {
        const error = new Error('Ya existe una cuenta con este correo. Inicia sesión.')
        error.status = 409
        throw error
      }

      const salt = randomBytes(16).toString('hex')
      const user = {
        id: randomBytes(16).toString('hex'),
        name: normalizedName,
        email: normalizedEmail,
        role: 'cliente',
        joinedAt: new Date().toISOString(),
        salt,
        passwordHash: await hashPassword(password, salt),
      }
      if (users.has(normalizedEmail)) {
        const error = new Error('Ya existe una cuenta con este correo. Inicia sesión.')
        error.status = 409
        throw error
      }
      users.set(normalizedEmail, user)
      return createSession(user)
    },

    async login({ email, password }) {
      const user = users.get(email.trim().toLowerCase())
      if (!user) {
        const error = new Error('Correo o contraseña incorrectos.')
        error.status = 401
        throw error
      }

      const passwordHash = await hashPassword(password, user.salt)
      const expected = Buffer.from(user.passwordHash, 'hex')
      const actual = Buffer.from(passwordHash, 'hex')
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        const error = new Error('Correo o contraseña incorrectos.')
        error.status = 401
        throw error
      }
      return createSession(user)
    },

    getUserForToken(token) {
      const email = sessions.get(token)
      const user = email && users.get(email)
      return user ? publicUser(user) : null
    },

    revokeToken(token) {
      return sessions.delete(token)
    },
  }
}

module.exports = { createAuthService }
