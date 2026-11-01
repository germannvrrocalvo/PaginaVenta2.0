import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {computeTotals, isWelcomeEligible, welcomeEndsAt} from './src/lib/pricing.js'
import * as frontendPricing from './src/lib/pricing.js'

const require = createRequire(import.meta.url)
const backendPricing = require('../backend/src/services/pricing.js')
const user={role:'cliente',joinedAt:'2026-01-31T12:00:00Z'}
assert.equal(welcomeEndsAt(user.joinedAt).toISOString(),'2026-02-28T12:00:00.000Z')
assert.equal(isWelcomeEligible(user,new Date('2026-02-28T11:59:59Z')),true)
assert.equal(isWelcomeEligible(user,new Date('2026-02-28T12:00:00Z')),false)
assert.equal(isWelcomeEligible({...user,role:'admin'},new Date('2026-02-01')),false)
assert.equal(isWelcomeEligible({role:'cliente'},new Date()),false)
const t=computeTotals([{price:349,qty:1}],{user,now:new Date('2026-02-01')})
assert.deepEqual(t,{subtotal:349,discount:34.9,shipping:0,total:314.1,ivaIncluded:54.51})
assert.equal(computeTotals([{price:100,qty:1}]).total,106.9)
assert.equal(computeTotals([],{user}).total,0)

for (const key of ['IVA', 'DISCOUNT_RATE', 'FREE_SHIPPING_FROM', 'SHIPPING_COST']) {
  assert.equal(backendPricing[key], frontendPricing[key], `${key} debe coincidir`)
}
for (const key of ['welcomeEndsAt', 'isWelcomeEligible', 'computeTotals']) {
  assert.equal(backendPricing[key], frontendPricing[key], `${key} debe compartir la misma implementación`)
}

const cases = [
  { items: [{price:349,qty:1}], options: {user,now:new Date('2026-02-01')} },
  { items: [{price:100,qty:1}], options: {} },
  { items: [{price:150,qty:2}], options: {} },
  { items: [{price:200,qty:1}], options: {user,now:new Date('2026-03-01')} },
  { items: [], options: {user,now:new Date('2026-02-01')} },
]

for (const {items, options} of cases) {
  assert.deepEqual(
    backendPricing.computeTotals(items, options),
    frontendPricing.computeTotals(items, options),
    'Los totales de frontend y backend deben coincidir'
  )
}

assert.equal(
  backendPricing.welcomeEndsAt(user.joinedAt).toISOString(),
  frontendPricing.welcomeEndsAt(user.joinedAt).toISOString()
)
assert.equal(
  backendPricing.isWelcomeEligible(user,new Date('2026-02-28T11:59:59Z')),
  frontendPricing.isWelcomeEligible(user,new Date('2026-02-28T11:59:59Z'))
)
console.log('Precios frontend/backend: constantes, descuento, caducidad, IVA y envío coinciden')
