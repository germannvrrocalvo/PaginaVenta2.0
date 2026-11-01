const pricing = (() => {
const IVA = 0.21
const DISCOUNT_RATE = 0.1
const FREE_SHIPPING_FROM = 300
const SHIPPING_COST = 6.9
const round = (value) => Math.round(value * 100) / 100

function welcomeEndsAt(joinedAt) {
  const start = new Date(joinedAt)
  if (!Number.isFinite(start.getTime())) return null

  const end = new Date(start)
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + 1)
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(start.getUTCDate(), last))
  return end
}

function isWelcomeEligible(user, now = new Date()) {
  if (!user || user.role !== 'cliente' || !user.joinedAt) return false
  const end = welcomeEndsAt(user.joinedAt)
  return !!end && now >= new Date(user.joinedAt) && now < end
}

function computeTotals(items, { user = null, now = new Date() } = {}) {
  const subtotal = round(items.reduce((sum, item) => sum + item.price * item.qty, 0))
  const discount = isWelcomeEligible(user, now) ? round(subtotal * DISCOUNT_RATE) : 0
  const base = round(subtotal - discount)
  const shipping = items.length === 0 || base >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST
  const total = round(base + shipping)
  return { subtotal, discount, shipping, total, ivaIncluded: round(total - total / (1 + IVA)) }
}

return {
  IVA,
  DISCOUNT_RATE,
  FREE_SHIPPING_FROM,
  SHIPPING_COST,
  welcomeEndsAt,
  isWelcomeEligible,
  computeTotals,
}
})()

globalThis.UcamPricing = pricing
if (typeof module !== 'undefined' && module.exports) module.exports = pricing
