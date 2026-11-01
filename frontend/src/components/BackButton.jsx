import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="back-button"
      aria-label="Volver atrás"
    >
      <ArrowLeft size={18} />
      Volver
    </button>
  )
}
