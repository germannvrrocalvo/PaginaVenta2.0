import { ChevronLeft, LockKeyhole, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ImageSlot from '../components/ImageSlot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { eur } from '../lib/format.js'
import { computeTotals, FREE_SHIPPING_FROM } from '../lib/pricing.js'

export default function Carrito() {
  const { items, setQty, removeItem, getAvailableStock } = useCart()
  const { user, openAccount } = useAuth()
  const totals = computeTotals(items, { user })
  const missingForFreeShipping = Math.max(0, FREE_SHIPPING_FROM - (totals.subtotal - totals.discount))

  return (
    <section className="commerce-page cart-screen">
      <div className="commerce-container">
        <nav className="commerce-breadcrumb" aria-label="Ruta"><Link to="/">Inicio</Link><span>/</span><strong>Carrito</strong></nav>
        <h1>Carrito</h1>

        {items.length === 0 ? (
          <div className="commerce-empty">
            <h2>Tu carrito está vacío</h2>
            <p>Añade un producto para empezar tu pedido.</p>
            <Link to="/catalogo" className="commerce-primary-button">Explorar catálogo</Link>
          </div>
        ) : (
          <div className="commerce-cart-grid">
            <div className="commerce-cart-main">
              {!user && (
                <div className="cart-login-callout">
                  <div><strong>Ahorra un 10 % iniciando sesión</strong><span>El descuento se aplica automáticamente en el resumen</span></div>
                  <button type="button" onClick={() => openAccount('login')}>Iniciar sesión</button>
                </div>
              )}

              <ul className="commerce-cart-list">
                {items.map((item) => (
                  <li key={item.cartKey} className="commerce-cart-line">
                    <ImageSlot className="commerce-cart-image" src={item.image} alt={item.name} fit="contain" />
                    <div className="commerce-cart-info">
                      <span>{item.brand}</span>
                      <Link to={`/producto/${item.slug}`}>{item.name}</Link>
                      {item.variantValue && <small>{item.variantType}: {item.variantValue}</small>}
                      <div className="commerce-qty" role="group" aria-label={`Cantidad de ${item.name}`}>
                        <button type="button" onClick={() => setQty(item.cartKey, item.qty - 1)} aria-label="Restar una unidad">−</button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => setQty(item.cartKey, item.qty + 1)} disabled={item.qty >= getAvailableStock(item.productId, item.variantId)} aria-label="Añadir una unidad">+</button>
                      </div>
                    </div>
                    <strong className="commerce-cart-price">{eur(item.price * item.qty)}</strong>
                    <button type="button" className="commerce-remove" onClick={() => removeItem(item.cartKey)} aria-label={`Quitar ${item.name}`}><Trash2 size={17} /></button>
                  </li>
                ))}
              </ul>

              <Link className="commerce-back-link" to="/catalogo"><ChevronLeft size={17} />Seguir comprando</Link>
            </div>

            <aside className="commerce-cart-summary">
              <h2>Resumen del pedido</h2>
              <dl>
                <div><dt>Subtotal</dt><dd>{eur(totals.subtotal)}</dd></div>
                {totals.discount > 0 && <div className="discount"><dt>Descuento</dt><dd>-{eur(totals.discount)}</dd></div>}
                <div><dt>Envío</dt><dd>{totals.shipping ? eur(totals.shipping) : 'Gratis'}</dd></div>
              </dl>
              {totals.shipping > 0 && <p className="shipping-progress">Añade {eur(missingForFreeShipping)} más para envío gratis</p>}
              <div className="commerce-summary-total"><span>Total</span><strong>{eur(totals.total)}</strong></div>
              <Link to="/checkout" className="commerce-primary-button">Continuar al checkout</Link>
              <p className="commerce-secure"><LockKeyhole size={15} />Pago seguro con PayPal</p>
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
