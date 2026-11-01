import { Star } from 'lucide-react'

export default function Stars({ rating, reviews }) {
  return (
    <span className="stars" aria-label={`Valoración ${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} fill={n <= rating ? 'currentColor' : 'none'} className={n <= rating ? '' : 'off'} />
      ))}
      {reviews != null && <span className="stars-count">({reviews})</span>}
    </span>
  )
}