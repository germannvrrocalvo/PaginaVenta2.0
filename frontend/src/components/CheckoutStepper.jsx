import { Check, Disc3 } from 'lucide-react'
import { Link } from 'react-router-dom'

const STEPS = ['Datos', 'Pedido', 'Pago', 'Confirmación']

export function CheckoutLogo() {
  return (
    <Link className="checkout-logo" to="/" aria-label="Volver a UCAM Stereo">
      <span><Disc3 size={16} /></span>
      <strong>UCAM <em>Stereo</em></strong>
    </Link>
  )
}

export default function CheckoutStepper({ active }) {
  return (
    <ol className="checkout-progress" aria-label="Progreso de compra">
      {STEPS.map((label, index) => {
        const number = index + 1
        const completed = number < active
        return (
          <li key={label} className={`${completed ? 'completed' : ''} ${number === active ? 'current' : ''}`} aria-current={number === active ? 'step' : undefined}>
            <span className="checkout-step-dot">{completed ? <Check size={16} strokeWidth={3} /> : number}</span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
