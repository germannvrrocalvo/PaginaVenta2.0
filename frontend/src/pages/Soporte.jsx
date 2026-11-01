import { useState } from 'react'
import { createTicket } from '../lib/support.js'

const EMPTY = { name: '', email: '', orderId: '', subject: '', message: '' }

export default function Soporte() {
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [ticket, setTicket] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const change = (e) => setF((v) => ({ ...v, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (f.name.trim().length < 3) errs.name = 'Escribe tu nombre.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = 'Introduce un correo válido.'
    if (f.orderId && !/^UC-\d{4}-\d{5}$/.test(f.orderId)) errs.orderId = 'Formato UC-2026-01001.'
    if (f.subject.trim().length < 4) errs.subject = 'Indica un asunto.'
    if (f.message.trim().length < 10) errs.message = 'Cuéntanos qué ha pasado (mín. 10 caracteres).'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitError('')
    setSubmitting(true)
    try {
      setTicket(await createTicket(f))
      setF(EMPTY)
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="section section-cream page-top">
      <div className="container narrow">
        <div className="section-head">
          <p className="eyebrow">Soporte</p>
          <h1 className="h-xl">¿En qué te ayudamos?</h1>
          <p className="lead">Cuéntanos tu consulta o incidencia y te ayudaremos a encontrar una solución.</p>
        </div>

        {ticket && (
          <p className="alert ok" role="status">
            Solicitud registrada con el código <strong>{ticket.id}</strong>. Es una simulación: nadie responderá a este mensaje.
          </p>
        )}
        {submitError && <p className="alert" role="alert">{submitError}</p>}

        <form className="panel" onSubmit={submit} noValidate>
          {[
            ['name', 'Nombre', 'Ana Ficticia'],
            ['email', 'Correo electrónico', 'cliente@ucam.test'],
            ['orderId', 'Nº de pedido (opcional)', 'UC-2026-01001'],
            ['subject', 'Asunto', 'Mi pedido no aparece como enviado'],
          ].map(([name, label, ph]) => (
            <div className="field" key={name}>
              <label htmlFor={name}>{label}</label>
              <input id={name} name={name} value={f[name]} onChange={change} placeholder={ph} aria-invalid={!!errors[name]} />
              {errors[name] && <span className="field-error">{errors[name]}</span>}
            </div>
          ))}
          <div className="field">
            <label htmlFor="message">Mensaje</label>
            <textarea id="message" name="message" rows="5" value={f.message} onChange={change} aria-invalid={!!errors.message} />
            {errors.message && <span className="field-error">{errors.message}</span>}
          </div>
          <button className="btn btn-accent" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </section>
  )
}