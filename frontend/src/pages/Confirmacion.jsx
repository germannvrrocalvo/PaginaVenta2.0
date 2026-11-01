import { Check } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import CheckoutStepper, { CheckoutLogo } from '../components/CheckoutStepper.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { eur } from '../lib/format.js'
import { useOrder } from '../hooks/useOrder.js'

const longDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Confirmacion() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { order, loading, error: loadError } = useOrder(id, user)
  const canView = order && (order.customer.guest || (user && (order.customer.email === user.email || user.role === 'admin')))

  if (loading) {
    return <section className="commerce-page checkout-empty-page"><CheckoutLogo /><div className="commerce-empty"><h1>Cargando pedido…</h1></div></section>
  }

  if (!canView) {
    return <section className="commerce-page checkout-empty-page"><CheckoutLogo /><div className="commerce-empty"><h1>{loadError || 'Pedido no encontrado'}</h1><Link to="/catalogo" className="commerce-primary-button">Volver a la tienda</Link></div></section>
  }

  return (
    <section className="commerce-page confirmation-screen">
      <div className="confirmation-container">
        <CheckoutLogo />
        <CheckoutStepper active={4} />
        <div className="confirmation-content">
          {location.state?.stockRefreshWarning && <p className="alert" role="status">{location.state.stockRefreshWarning}</p>}
          <span className="confirmation-check"><Check size={34} strokeWidth={2.5} /></span>
          <p className="confirmation-eyebrow">¡Pedido confirmado!</p>
          <h1>Gracias por tu compra.</h1>
          <p className="confirmation-lead">Hemos recibido tu pedido correctamente. Recibirás una confirmación en {order.customer.email}</p>
          <dl className="confirmation-card">
            <div className="confirmation-order-number"><dt>Número de pedido</dt><dd>{order.id.replace('UC-', 'UCS-')}</dd></div>
            <div><dt>Fecha</dt><dd>{longDate(order.createdAt)}</dd></div>
            <div><dt>Método de pago</dt><dd>PayPal</dd></div>
            <div><dt>Email</dt><dd>{order.customer.email}</dd></div>
            <div className="total"><dt>Total</dt><dd>{eur(order.totals.total)}</dd></div>
          </dl>
          <div className="confirmation-actions">
            <Link to={`/pedido/${order.id}/estado`} className="commerce-primary-button">Ver estado del pedido</Link>
            <Link to="/" className="commerce-secondary-button">Volver a la tienda</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
