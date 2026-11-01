import ImageSlot from './ImageSlot.jsx'
import { eur } from '../lib/format.js'

export default function CheckoutOrderCard({ items, totals, title = 'Tu pedido', compact = false }) {
  return (
    <section className={`checkout-order-card ${compact ? 'compact' : ''}`}>
      <h2>{title}</h2>
      <ul className="checkout-order-lines">
        {items.map((item) => (
          <li key={item.cartKey ?? item.productId}>
            <ImageSlot className="checkout-order-image" src={item.image} alt={item.name} fit="contain" />
            <div className="checkout-order-copy">
              <strong title={item.name}>{item.name}</strong>
              <span>{item.variantValue ? `${item.variantValue} · ` : ''}× {item.qty}</span>
            </div>
            <strong className="checkout-order-price">{eur((item.price ?? item.unitPrice) * item.qty)}</strong>
          </li>
        ))}
      </ul>
      <dl className="checkout-order-totals">
        <div><dt>Subtotal</dt><dd>{eur(totals.subtotal)}</dd></div>
        {totals.discount > 0 && <div className="discount"><dt>Descuento</dt><dd>-{eur(totals.discount)}</dd></div>}
        <div><dt>Envío</dt><dd>{totals.shipping ? eur(totals.shipping) : 'Gratis'}</dd></div>
        <div className="total"><dt>Total</dt><dd>{eur(totals.total)}</dd></div>
      </dl>
    </section>
  )
}
