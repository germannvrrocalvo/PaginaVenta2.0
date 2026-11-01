import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement, dialog = ref.current
    dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === ref.current) onClose() }}>
    <div className="modal-content"><button className="icon-btn dark modal-close" onClick={onClose} aria-label="Cerrar ventana"><X size={20} /></button><h2 id="modal-title" className="h-md">{title}</h2>{children}</div>
  </dialog>
}
