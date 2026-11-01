import { useState } from 'react'
import { Disc3 } from 'lucide-react'

export default function ImageSlot({ src, alt = '', className = '', fit = 'cover' }) {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return (
      <div className={`image-unavailable ${className}`} role="img" aria-label={alt || 'Imagen pendiente'}>
        <Disc3 size={26} strokeWidth={1.5} />
        <strong>{alt}</strong><span>Imagen no disponible</span>
      </div>
    )
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      style={{ objectFit: fit }}
      onError={() => setFailedSrc(src)}
      loading="lazy"
    />
  )
}