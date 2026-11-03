const assert = require('node:assert/strict')
const { test } = require('node:test')
const { usersToSeed } = require('../src/services/auth-postgres')

test('crea un administrador de CoreAdmin desde variables sin guardar su clave en código', () => {
  const users = usersToSeed({
    BO_ADMIN_EMAIL: 'COREADMIN@UCAM.TEST',
    BO_ADMIN_PASSWORD: 'clave-segura-de-prueba',
  })
  assert.equal(users.length, 2)
  assert.deepEqual(users[1], {
    email: 'coreadmin@ucam.test',
    password: 'clave-segura-de-prueba',
    name: 'Administrador CoreAdmin',
    role: 'admin',
  })
  assert.equal(users.some((user) => user.email === 'admin@ucam.test'), false)
})

test('rechaza una configuración parcial o una contraseña corta', () => {
  assert.throws(() => usersToSeed({ BO_ADMIN_EMAIL: 'coreadmin@ucam.test' }), /deben configurarse juntas/)
  assert.throws(() => usersToSeed({
    BO_ADMIN_EMAIL: 'coreadmin@ucam.test',
    BO_ADMIN_PASSWORD: 'corta',
  }), /al menos 12 caracteres/)
})
