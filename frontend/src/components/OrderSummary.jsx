import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { computeTotals, FREE_SHIPPING_FROM } from '../lib/pricing.js'
import { eur } from '../lib/format.js'

export default function OrderSummary() {
  const { items } = useCart()
  const { user, openAccount } = useAuth()
  const t = computeTotals(items, { user })
  const missing = FREE_SHIPPING_FROM - (t.subtotal - t.discount)

  return (
    <div className="summary">
      <h2 className="h-md">Resumen</h2>
      <dl>
        <div><dt>Subtotal</dt><dd>{eur(t.subtotal)}</dd></div>
        {t.discount > 0 && <div className="discount"><dt>Descuento primer mes (10 %)</dt><dd>−{eur(t.discount)}</dd></div>}
        <div><dt>Envío</dt><dd>{t.shipping === 0 ? 'Gratis' : eur(t.shipping)}</dd></div>
        <div className="total"><dt>Total</dt><dd>{eur(t.total)}</dd></div>
        <div className="small"><dt>IVA incluido (21 %)</dt><dd>{eur(t.ivaIncluded)}</dd></div>
      </dl>
      {!user && <div className="guest-discount"><strong>Consigue un 10 % de descuento</strong><p>Regístrate para disfrutarlo durante tu primer mes.</p><button type="button" onClick={() => openAccount('register')}>Crear cuenta</button><small>Puedes finalizar la compra sin registrarte.</small></div>}
      {t.shipping > 0 && missing > 0 && <p className="hint">Te faltan {eur(missing)} para envío gratis.</p>}
    </div>
  )
}
