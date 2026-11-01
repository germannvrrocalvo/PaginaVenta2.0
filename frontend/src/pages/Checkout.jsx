import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import CheckoutOrderCard from '../components/CheckoutOrderCard.jsx'
import CheckoutStepper, { CheckoutLogo } from '../components/CheckoutStepper.jsx'
import ImageSlot from '../components/ImageSlot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { trackEvent } from '../lib/events.js'
import { eur } from '../lib/format.js'
import { createOrder as createStoreOrder } from '../lib/orders.js'
import { computeTotals } from '../lib/pricing.js'
import { getStoredToken } from '../services/auth.js'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

const EMPTY_FORM = {
  nombre: '', apellidos: '', email: '', telefono: '', direccion: '', ciudad: '', provincia: '', cp: '', pais: 'España', newsletter: false,
}

function validate(form) {
  const errors = {}
  for (const name of ['nombre', 'apellidos', 'ciudad', 'provincia']) {
    if (form[name].trim().length < 2) errors[name] = 'Completa este campo.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Introduce un correo válido.'
  if (!/^(?:\+34)?[6-9]\d{8}$/.test(form.telefono.replace(/\s/g, ''))) errors.telefono = 'Introduce un teléfono español válido.'
  if (form.direccion.trim().length < 5) errors.direccion = 'Indica calle y número.'
  if (!/^\d{5}$/.test(form.cp)) errors.cp = 'Introduce 5 dígitos.'
  return errors
}

export default function Checkout() {
  const { items, completePurchase } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, email: user?.email ?? '' }))
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(1)
  const [paying, setPaying] = useState(false)
  const [hasCreatedOrder, setHasCreatedOrder] = useState(false)
  const [payError, setPayError] = useState('')
  const [paypalConfig, setPaypalConfig] = useState(null)
  const [paypalConfigError, setPaypalConfigError] = useState('')
  const started = useRef(false)
  const paymentLock = useRef(false)
  const orderIdRef = useRef(null)
  const paypalOrderIdRef = useRef(null)
  const orderCreationRef = useRef(null)
  const totals = computeTotals(items, { user })

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/pagos/paypal/config`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudo cargar la configuración de PayPal.')
        return result
      })
      .then((config) => { if (!cancelled) setPaypalConfig(config) })
      .catch((error) => { if (!cancelled) setPaypalConfigError(error.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (items.length && !started.current) {
      started.current = true
      trackEvent('checkout.started', { items: items.length })
    }
  }, [items])

  const change = (event) => {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const moveTo = (nextStep) => {
    setStep(nextStep)
    setPayError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitDelivery = (event) => {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      document.getElementById(firstError)?.focus()
      return
    }
    moveTo(2)
  }

  const paypalRequest = async (path, body) => {
    const token = getStoredToken()
    const response = await fetch(`${API_URL}/pagos/paypal/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const result = response.status === 204 ? null : await response.json()
    if (!response.ok) throw new Error(result?.error || 'No se pudo completar el pago con PayPal.')
    return result
  }

  const createPaypalOrder = async () => {
    if (paypalOrderIdRef.current) return paypalOrderIdRef.current
    if (orderCreationRef.current) return orderCreationRef.current
    orderCreationRef.current = (async () => {
      setPaying(true)
      setPayError('')
      try {
        if (!orderIdRef.current) {
          const order = await createStoreOrder({
            customer: {
              ...form,
              nombre: `${form.nombre} ${form.apellidos}`.trim(),
              direccionCompleta: `${form.direccion}, ${form.cp} ${form.ciudad}, ${form.provincia}, ${form.pais}`,
            },
            items,
          })
          orderIdRef.current = order.id
          setHasCreatedOrder(true)
        }
        const paypalOrder = await paypalRequest('crear', { orderId: orderIdRef.current })
        paypalOrderIdRef.current = paypalOrder.id
        return paypalOrder.id
      } catch (error) {
        setPayError(`${error.message || 'No se pudo preparar el pago.'} El pedido puede reintentarse y el carrito sigue intacto.`)
        throw error
      } finally {
        orderCreationRef.current = null
        setPaying(false)
      }
    })()
    return orderCreationRef.current
  }

  const capturePaypalOrder = async (data) => {
    if (paymentLock.current) return
    paymentLock.current = true
    setPaying(true)
    setPayError('')
    try {
      const order = await paypalRequest('capturar', {
        orderId: orderIdRef.current,
        paypalOrderId: data.orderID,
      })
      let stockRefreshWarning = ''
      try {
        await completePurchase()
      } catch (refreshError) {
        console.error('Pedido pagado, pero no se pudo actualizar el catálogo:', refreshError)
        stockRefreshWarning = 'El pedido está confirmado, pero no se pudo actualizar el stock. Recarga la página para consultar las existencias actuales.'
      }
      const receiptWarning = order.receipt?.sent === false
        ? 'El pago está confirmado, pero el recibo de prueba no pudo enviarse. Se ha registrado el error en el servidor.'
        : ''
      navigate(`/pedido/${order.id}`, { state: { stockRefreshWarning, receiptWarning } })
    } catch (error) {
      setPayError(`${error.message || 'No se pudo completar el pago.'} El pedido sigue pendiente y tu carrito permanece intacto.`)
    } finally {
      paymentLock.current = false
      setPaying(false)
    }
  }

  const cancelPaypalOrder = async (data) => {
    setPaying(true)
    setPayError('')
    try {
      if (orderIdRef.current && data.orderID) {
        await paypalRequest('cancelar', {
          orderId: orderIdRef.current,
          paypalOrderId: data.orderID,
        })
      }
      paypalOrderIdRef.current = null
      setPayError('Has cancelado el pago. No se ha realizado ningún cargo y puedes intentarlo de nuevo; el carrito sigue intacto.')
    } catch (error) {
      setPayError(`${error.message} El carrito sigue intacto.`)
    } finally {
      setPaying(false)
    }
  }

  if (!items.length) {
    return (
      <section className="commerce-page checkout-empty-page">
        <CheckoutLogo />
        <div className="commerce-empty"><h1>Tu carrito está vacío</h1><Link to="/catalogo" className="commerce-primary-button">Explorar catálogo</Link></div>
      </section>
    )
  }

  return (
    <section className="commerce-page checkout-screen">
      <div className="checkout-container">
        <CheckoutLogo />
        <CheckoutStepper active={step} />

        <div key={step} className="checkout-stage">
          {step === 1 && (
            <div className="checkout-two-columns">
              <form className="checkout-delivery" onSubmit={submitDelivery} noValidate>
                <h1>Datos de envío</h1>
                <div className="checkout-form-grid">
                  {[
                    ['nombre', 'Nombre', 'given-name'], ['apellidos', 'Apellidos', 'family-name'],
                    ['email', 'Email', 'email'], ['telefono', 'Teléfono', 'tel'],
                    ['direccion', 'Dirección', 'address-line1'], ['ciudad', 'Ciudad', 'address-level2'],
                    ['provincia', 'Provincia', 'address-level1'], ['cp', 'Código postal', 'postal-code'],
                    ['pais', 'País', 'country-name'],
                  ].map(([name, label, autoComplete]) => (
                    <div className={`checkout-field ${name === 'direccion' || name === 'pais' ? 'wide' : ''}`} key={name}>
                      <label htmlFor={name}>{label}</label>
                      <input id={name} name={name} type={name === 'email' ? 'email' : 'text'} value={form[name]} onChange={change} autoComplete={autoComplete} readOnly={name === 'pais' || (name === 'email' && Boolean(user))} inputMode={name === 'cp' ? 'numeric' : name === 'telefono' ? 'tel' : undefined} aria-invalid={Boolean(errors[name])} />
                      {errors[name] && <span className="checkout-error">{errors[name]}</span>}
                    </div>
                  ))}
                </div>
                <label className="checkout-newsletter"><input type="checkbox" name="newsletter" checked={form.newsletter} onChange={change} />Quiero recibir novedades de UCAM Stereo.</label>
                <button className="commerce-primary-button" type="submit">Continuar</button>
                <Link className="checkout-bottom-back" to="/carrito"><ChevronLeft size={16} />Volver al carrito</Link>
              </form>
              <CheckoutOrderCard items={items} totals={totals} compact />
            </div>
          )}

          {step === 2 && (
            <div className="checkout-two-columns review-columns">
              <div className="checkout-review">
                <h1>Resumen del pedido</h1>
                <section className="checkout-review-panel address-panel">
                  <div><h2>Datos de envío</h2><button type="button" onClick={() => moveTo(1)} disabled={hasCreatedOrder}>Editar</button></div>
                  <p>{form.nombre} {form.apellidos}</p>
                  <p>{form.direccion}</p>
                  <p>{form.cp} {form.ciudad}, {form.provincia}</p>
                  <p>{form.pais}</p>
                  <p>{form.email} · {form.telefono}</p>
                </section>
                <section className="checkout-review-panel product-panel">
                  <h2>Productos</h2>
                  <ul>
                    {items.map((item) => (
                      <li key={item.cartKey}>
                        <ImageSlot src={item.image} alt={item.name} className="checkout-review-image" fit="contain" />
                        <div><strong>{item.name}</strong><span>{item.brand}{item.variantValue ? ` · ${item.variantValue}` : ''} · Cant: {item.qty}</span></div>
                        <strong>{eur(item.price * item.qty)}</strong>
                      </li>
                    ))}
                  </ul>
                  <dl className="checkout-review-totals">
                    <div><dt>Subtotal</dt><dd>{eur(totals.subtotal)}</dd></div>
                    {totals.discount > 0 && <div><dt>Descuento</dt><dd>-{eur(totals.discount)}</dd></div>}
                    <div><dt>Envío</dt><dd>{totals.shipping ? eur(totals.shipping) : 'Gratis'}</dd></div>
                    <div className="total"><dt>Total</dt><dd>{eur(totals.total)}</dd></div>
                  </dl>
                </section>
                <div className="checkout-review-actions">
                  <button className="commerce-secondary-button" type="button" onClick={() => moveTo(1)} disabled={hasCreatedOrder}>Atrás</button>
                  <button className="commerce-primary-button" type="button" onClick={() => moveTo(3)}>Continuar al pago</button>
                </div>
              </div>
              <CheckoutOrderCard items={items} totals={totals} compact />
            </div>
          )}

          {step === 3 && (
            <div className="checkout-two-columns payment-columns">
              <div className="checkout-payment">
                <h1>Pago seguro</h1>
                <section className="paypal-panel">
                  <div className="paypal-panel-title"><span className="paypal-icon">P</span><div><strong>Pago seguro con PayPal</strong><small>Protegido por PayPal Buyer Protection</small></div></div>
                  <div className="paypal-total"><div><strong>Total a pagar</strong><span>IVA incluido · Cargo único</span></div><strong>{eur(totals.total)}</strong></div>
                  {payError && <p className="checkout-payment-error" role="alert">{payError}</p>}
                  {paypalConfigError && <p className="checkout-payment-error" role="alert">{paypalConfigError}</p>}
                  {!paypalConfig && !paypalConfigError && <p role="status">Conectando con PayPal Sandbox…</p>}
                  {paypalConfig && (
                    <PayPalScriptProvider options={{
                      clientId: paypalConfig.clientId,
                      currency: 'EUR',
                      intent: 'capture',
                    }}>
                      <PayPalButtons
                        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
                        disabled={paying}
                        createOrder={createPaypalOrder}
                        onApprove={capturePaypalOrder}
                        onCancel={cancelPaypalOrder}
                        onError={(error) => {
                          console.error('PayPal Sandbox error:', error)
                          setPayError('PayPal no ha podido completar la operación. No se ha confirmado el pedido y tu carrito sigue intacto.')
                        }}
                      />
                    </PayPalScriptProvider>
                  )}
                  <p className="paypal-protection"><LockKeyhole size={15} />Tus datos están protegidos. Nunca almacenamos información de pago.</p>
                </section>
                <button className="checkout-bottom-back" type="button" onClick={() => moveTo(2)} disabled={hasCreatedOrder}><ChevronLeft size={16} />Volver al resumen</button>
                <p className="checkout-simulation-note"><ShieldCheck size={15} />Pago de prueba en PayPal Sandbox. No se realizan cargos reales.</p>
              </div>
              <CheckoutOrderCard items={items} totals={totals} compact />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
