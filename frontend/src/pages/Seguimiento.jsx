import { Check, ChevronLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ImageSlot from '../components/ImageSlot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { eur } from '../lib/format.js'
import { useOrder } from '../hooks/useOrder.js'

const shortDate = (date) => new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(date).replace('.', '')
const addDays = (iso, days) => {
  const date = new Date(iso)
  date.setDate(date.getDate() + days)
  return date
}

export default function Seguimiento() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const trackingToken = searchParams.get('tracking') || ''
  const { user } = useAuth()
  const { order, loading, error: loadError } = useOrder(id, user, trackingToken)
  const canView = order && (trackingToken || order.customer.guest || (user && (order.customer.email === user.email || user.role === 'admin')))

  if (loading) {
    return <section className="commerce-page"><div className="commerce-container commerce-empty"><h1>Cargando pedido…</h1></div></section>
  }

  if (!canView) {
    return <section className="commerce-page"><div className="commerce-container commerce-empty"><h1>{loadError || 'Pedido no encontrado'}</h1><Link to="/" className="commerce-primary-button">Volver a la tienda</Link></div></section>
  }

  const isSent = order.status === 'enviado'
  const isDelivered = order.status === 'entregado'
  const steps = [
    { title: 'Pedido recibido', date: shortDate(new Date(order.createdAt)), text: 'Tu pedido ha sido registrado en nuestro sistema.', state: 'done' },
    { title: 'Pago confirmado', date: shortDate(addDays(order.createdAt, 1)), text: 'El pago ha sido verificado y procesado correctamente.', state: 'done' },
    { title: 'Preparando pedido', text: 'Estamos preparando y embalando tu pedido con cuidado.', state: isSent || isDelivered ? 'done' : 'active', badge: isSent || isDelivered ? null : 'En proceso' },
    { title: 'Enviado', date: `Estimado: ${shortDate(addDays(order.createdAt, 4))}`, text: 'Tu pedido está en camino con el transportista.', state: isSent || isDelivered ? 'done' : 'pending' },
    { title: 'Entregado', date: `Estimado: ${shortDate(addDays(order.createdAt, 5))}`, text: 'Tu pedido ha sido entregado. ¡Disfruta de la música!', state: isDelivered ? 'done' : 'pending' },
  ]

  return (
    <section className="commerce-page tracking-screen">
      <div className="commerce-container">
        <nav className="commerce-breadcrumb" aria-label="Ruta"><Link to="/">Inicio</Link><span>/</span><strong>Estado del pedido</strong></nav>
        <header className="tracking-header">
          <div><p>Seguimiento</p><h1>Estado de tu pedido</h1></div>
          <div><span>Número de pedido</span><strong>{order.id.replace('UC-', 'UCS-')}</strong></div>
        </header>

        <div className="tracking-layout">
          <section className="tracking-timeline-card">
            <h2>Seguimiento del pedido</h2>
            <ol className="tracking-timeline">
              {steps.map((step) => (
                <li key={step.title} className={step.state}>
                  <span className="tracking-dot">{step.state === 'done' ? <Check size={17} strokeWidth={3} /> : <i />}</span>
                  <div><p><strong>{step.title}</strong>{step.badge && <em>{step.badge}</em>}{step.date && <span>{step.date}</span>}</p><small>{step.text}</small></div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="tracking-aside">
            <section className="tracking-card">
              <h2>Productos</h2>
              <ul>
                {order.lines.map((line) => (
                  <li key={line.cartKey ?? line.productId}>
                    <ImageSlot src={line.image} alt={line.name} className="tracking-product-image" fit="contain" />
                    <div><strong>{line.name}</strong><span>{line.variantValue ?? line.finish ? `${line.variantValue ?? line.finish} · ` : ''}× {line.qty}</span></div>
                    <strong>{eur(line.unitPrice * line.qty)}</strong>
                  </li>
                ))}
              </ul>
              <div className="tracking-total"><span>Total</span><strong>{eur(order.totals.total)}</strong></div>
            </section>
            <section className="tracking-card tracking-address"><h2>Dirección de entrega</h2><p>{order.customer.nombre}</p><p>{order.customer.direccion}</p><p>{order.customer.cp} {order.customer.ciudad}</p><p>{order.customer.pais}</p></section>
            <Link className="commerce-primary-button" to="/">Volver a la tienda</Link>
            <Link className="commerce-back-link" to={`/pedido/${order.id}`}><ChevronLeft size={16} />Volver a la confirmación</Link>
          </aside>
        </div>
      </div>
    </section>
  )
}
