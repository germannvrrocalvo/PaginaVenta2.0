import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { eur } from '../lib/format.js'
import { computeTotals } from '../lib/pricing.js'
import ImageSlot from './ImageSlot.jsx'

export default function CartPopover() {
  const { items, count, setQty, removeItem, getAvailableStock, closeCart } = useCart()
  const { user } = useAuth()
  const totals = computeTotals(items, { user })

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') closeCart() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [closeCart])

  return (
    <>
      <button type="button" className="cart-popover-backdrop" onClick={closeCart} aria-label="Cerrar carrito" />
      <aside className="cart-popover" aria-label="Carrito de compra">
        <header className="cart-popover-head">
          <div><ShoppingBag size={18} /><strong>Tu carrito</strong><span>{count}</span></div>
          <button type="button" onClick={closeCart} aria-label="Cerrar carrito"><X size={18} /></button>
        </header>

        {items.length === 0 ? (
          <div className="cart-popover-empty"><ShoppingBag size={28} /><strong>Tu carrito está vacío</strong><span>Descubre el catálogo y añade tu primer producto.</span><Link to="/catalogo" onClick={closeCart}>Explorar catálogo</Link></div>
        ) : (
          <>
            <ul className="cart-popover-lines">
              {items.map((item) => (
                <li key={item.cartKey}>
                  <ImageSlot src={item.image} alt={item.name} className="cart-popover-image" fit="contain" />
                  <div className="cart-popover-info">
                    <Link to={`/producto/${item.slug}`} onClick={closeCart}>{item.name}</Link>
                    <span>{item.variantValue ?? item.brand}</span>
                    <div className="cart-popover-qty">
                      <button type="button" onClick={() => setQty(item.cartKey, item.qty - 1)} disabled={item.qty <= 1} aria-label={`Restar ${item.name}`}><Minus size={13} /></button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => setQty(item.cartKey, item.qty + 1)} disabled={item.qty >= getAvailableStock(item.productId, item.variantId)} aria-label={`Sumar ${item.name}`}><Plus size={13} /></button>
                    </div>
                  </div>
                  <strong>{eur(item.price * item.qty)}</strong>
                  <button type="button" className="cart-popover-remove" onClick={() => removeItem(item.cartKey)} aria-label={`Quitar ${item.name}`}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
            <footer className="cart-popover-footer">
              <div><span>Total</span><strong>{eur(totals.total)}</strong></div>
              <small>Impuestos incluidos{totals.shipping ? ` · Envío ${eur(totals.shipping)}` : ' · Envío gratis'}</small>
              <Link to="/checkout" className="btn btn-dark btn-block" onClick={closeCart}>Continuar al checkout</Link>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
