import { Link } from 'react-router-dom'

export default function HelpButton() {
  return (
    <Link to="/soporte" className="help-btn" aria-label="Ayuda y soporte" title="Ayuda y soporte">
      ?
    </Link>
  )
}