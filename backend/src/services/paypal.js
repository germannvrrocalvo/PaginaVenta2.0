const API_BASE = 'https://api-m.sandbox.paypal.com'

function createPaypalService({
  clientId = process.env.PAYPAL_CLIENT_ID,
  clientSecret = process.env.PAYPAL_CLIENT_SECRET,
  apiBase = API_BASE,
  fetchImpl = fetch,
} = {}) {
  let accessToken = null
  let tokenExpiresAt = 0

  function getClientId() {
    return clientId || ''
  }

  function isConfigured() {
    return Boolean(clientId && clientSecret)
  }

  async function getAccessToken() {
    if (!clientId || !clientSecret) {
      const error = new Error('PayPal Sandbox no está configurado en backend/.env.')
      error.status = 503
      throw error
    }
    if (accessToken && tokenExpiresAt > Date.now() + 30_000) return accessToken

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await fetchImpl(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const result = await response.json()
    if (!response.ok || !result.access_token) {
      console.error('PayPal OAuth failed:', result)
      const error = new Error('No se pudo autenticar con PayPal Sandbox.')
      error.status = 502
      throw error
    }
    accessToken = result.access_token
    tokenExpiresAt = Date.now() + Number(result.expires_in || 0) * 1000
    return accessToken
  }

  async function request(path, { method = 'GET', body, requestId } = {}) {
    const token = await getAccessToken()
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const result = response.status === 204 ? null : await response.json()
    if (!response.ok) {
      const error = new Error(result?.message || 'PayPal no pudo completar la operación.')
      error.status = response.status === 422 ? 409 : 502
      error.paypalIssue = result?.details?.[0]?.issue
      throw error
    }
    return result
  }

  async function createOrder({ orderId, amount, items, subtotal, discount, shipping, requestId }) {
    const breakdownAmount = (value) => ({
      currency_code: 'EUR',
      value: Number(value).toFixed(2),
    })
    const breakdown = {
      item_total: breakdownAmount(subtotal),
      ...(Number(discount) > 0 ? { discount: breakdownAmount(discount) } : {}),
      ...(Number(shipping) > 0 ? { shipping: breakdownAmount(shipping) } : {}),
    }
    return request('/v2/checkout/orders', {
      method: 'POST',
      requestId,
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          custom_id: orderId,
          amount: {
            ...breakdownAmount(amount),
            breakdown,
          },
          items: items.map((item) => ({
            name: item.name.slice(0, 127),
            quantity: String(item.qty),
            unit_amount: breakdownAmount(item.unitPrice),
          })),
        }],
        application_context: {
          brand_name: 'UCAM Stereo',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      },
    })
  }

  async function getOrder(paypalOrderId) {
    return request(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`)
  }

  async function captureOrder(paypalOrderId, requestId) {
    try {
      return await request(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
        requestId,
        body: {},
      })
    } catch (error) {
      if (error.status !== 409) throw error
      const existing = await getOrder(paypalOrderId)
      if (existing.status === 'COMPLETED') return existing
      throw error
    }
  }

  return { getClientId, isConfigured, createOrder, getOrder, captureOrder }
}

module.exports = { createPaypalService }
