import { CheckCircle2, X } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'

export default function CartNotice() {
  const { notice, dismissNotice, openCart } = useCart()
  if (!notice) return null

  return (
    <aside className="cart-notice" role="status" aria-live="polite">
      <CheckCircle2 size={22} aria-hidden="true" />
      <div>
        <strong>Producto añadido al carrito</strong>
        <span>{notice.name}{notice.variantValue ? ` - ${notice.variantValue}` : ''}</span>
      </div>
      <button type="button" className="cart-notice-link" onClick={openCart}>Ver carrito</button>
      <button type="button" onClick={dismissNotice} aria-label="Cerrar aviso"><X size={18} /></button>
    </aside>
  )
}
