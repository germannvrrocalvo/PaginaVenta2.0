const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createApp } = require('../src/server')
const { createAuthService } = require('../src/services/auth')

let server
let baseUrl

before(async () => {
  server = createApp(createAuthService()).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  }
}

test('registro, login, identidad de servidor, demo y logout', async () => {
  const beforeRegistration = Date.now()
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Cliente Prueba',
      email: 'prueba@example.test',
      password: 'clave-segura-123',
    },
  })
  const afterRegistration = Date.now()

  assert.equal(registration.status, 201)
  assert.ok(registration.body.token)
  assert.equal(registration.body.user.role, 'cliente')
  assert.equal(registration.body.user.email, 'prueba@example.test')
  assert.ok(Date.parse(registration.body.user.joinedAt) >= beforeRegistration)
  assert.ok(Date.parse(registration.body.user.joinedAt) <= afterRegistration)
  assert.equal('passwordHash' in registration.body.user, false)

  const identity = await request('/api/auth/me', { token: registration.body.token })
  assert.equal(identity.status, 200)
  assert.equal(identity.body.user.joinedAt, registration.body.user.joinedAt)

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'PRUEBA@example.test', password: 'clave-segura-123' },
  })
  assert.equal(login.status, 200)
  assert.equal(login.body.user.joinedAt, registration.body.user.joinedAt)

  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Otra Cuenta',
      email: 'prueba@example.test',
      password: 'clave-segura-123',
    },
  })
  assert.equal(duplicate.status, 409)

  const invalidLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'prueba@example.test', password: 'incorrecta' },
  })
  assert.equal(invalidLogin.status, 401)

  const demoLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ucam.test', password: 'demo1234' },
  })
  assert.equal(demoLogin.status, 200)
  assert.equal(demoLogin.body.user.role, 'cliente')
  assert.ok(Date.parse(demoLogin.body.user.joinedAt))

  assert.equal((await request('/api/auth/logout', {
    method: 'POST',
    token: registration.body.token,
  })).status, 204)
  assert.equal((await request('/api/auth/me', { token: registration.body.token })).status, 401)
})
