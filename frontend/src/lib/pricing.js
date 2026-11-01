import '../../../shared/pricing.cjs'

const pricing = globalThis.UcamPricing

export const {
  IVA,
  DISCOUNT_RATE,
  FREE_SHIPPING_FROM,
  SHIPPING_COST,
  welcomeEndsAt,
  isWelcomeEligible,
  computeTotals,
} = pricing
