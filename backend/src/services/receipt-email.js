const nodemailer = require('nodemailer')
const { tokenFor } = require('./tracking-token')

function createReceiptEmailService({
  createTestAccount = nodemailer.createTestAccount,
  createTransport = nodemailer.createTransport,
  fetchImpl = globalThis.fetch,
  webhookUrl = process.env.N8N_WEBHOOK_URL,
  webhookSecret = process.env.N8N_WEBHOOK_SECRET,
  trackingSecret = process.env.TRACKING_LINK_SECRET,
  frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173',
  logger = console,
} = {}) {
  let transporterPromise

  async function sendToN8n(order) {
    if (!webhookSecret) {
      throw new Error('Falta N8N_WEBHOOK_SECRET en backend/.env')
    }

    const trackingToken = tokenFor(order, trackingSecret)
    const trackingUrl = new URL(`/pedido/${encodeURIComponent(order.id)}/estado`, frontendUrl)
    trackingUrl.searchParams.set('tracking', trackingToken)

    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ucam-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({
        event: 'order.paid',
        eventId: order.payment?.paypalCaptureId || `paid-${order.id}`,
        order: {
          id: order.id,
          createdAt: order.createdAt,
          status: order.status,
          statusLabel: order.status === 'pagado' ? 'Pago confirmado' : order.status,
          customer: {
            email: order.customer.email,
            name: order.customer.nombre,
            phone: order.customer.telefono,
            address: {
              street: order.customer.direccion,
              postalCode: order.customer.cp,
              city: order.customer.ciudad,
              province: order.customer.provincia,
              country: order.customer.pais,
            },
          },
          items: order.lines.map((line) => ({
            name: line.name,
            brand: line.brand,
            variant: line.variantValue || null,
            quantity: line.qty,
            unitPrice: line.unitPrice,
            lineTotal: Number((line.qty * line.unitPrice).toFixed(2)),
          })),
          totals: {
            subtotal: order.totals.subtotal,
            discount: order.totals.discount,
            shipping: order.totals.shipping,
            total: order.totals.total,
          },
          payment: {
            method: 'PayPal',
            reference: order.payment?.paypalCaptureId || null,
          },
          trackingUrl: trackingUrl.toString(),
        },
      }),
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`n8n respondió con ${response.status}${details ? `: ${details.slice(0, 200)}` : ''}`)
    }

    return { messageId: `n8n-${order.id}` }
  }

  async function getTransporter() {
    if (!transporterPromise) {
      transporterPromise = createTestAccount().then((account) => ({
        account,
        transport: createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: { user: account.user, pass: account.pass },
        }),
      }))
    }
    return transporterPromise
  }

  return {
    async send(order) {
      if (webhookUrl) {
        const result = await sendToN8n(order)
        logger.info(`Pedido ${order.id} enviado al workflow de n8n.`)
        return result
      }

      const { account, transport } = await getTransporter()
      const lines = order.lines.map((line) =>
        `${line.qty} x ${line.brand} ${line.name}${line.variantValue ? ` (${line.variantValue})` : ''} — ${line.unitPrice.toFixed(2)} EUR`
      ).join('\n')
      const info = await transport.sendMail({
        from: `"UCAM Stereo" <${account.user}>`,
        to: order.customer.email,
        subject: `Recibo de tu pedido ${order.id}`,
        text: [
          `Gracias por tu compra. Pedido ${order.id}.`,
          '',
          lines,
          '',
          `Total: ${order.totals.total.toFixed(2)} EUR`,
          `Pago: PayPal Sandbox (${order.payment?.paypalCaptureId || 'captura completada'})`,
        ].join('\n'),
      })
      const previewUrl = nodemailer.getTestMessageUrl(info)
      if (previewUrl) logger.info(`Ethereal receipt preview: ${previewUrl}`)
      return { messageId: info.messageId, previewUrl }
    },
  }
}

module.exports = { createReceiptEmailService }
