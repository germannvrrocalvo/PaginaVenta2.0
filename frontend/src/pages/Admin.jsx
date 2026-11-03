import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getOrders, updateOrderStatus, ORDER_STATUS } from '../lib/orders.js'
import { getTickets, clearTickets, analyzeTicket, reviewAgentAction } from '../lib/support.js'
import { getEvents, clearEvents, downloadEvents, EVENT_TYPES } from '../lib/events.js'
import { eur, fechaHora } from '../lib/format.js'

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pedidos')
  const [adminData, setAdminData] = useState({ email: null, orders: [], tickets: [], events: [], error: '' })
  const [loadingData, setLoadingData] = useState(false)
  const [refreshData, setRefreshData] = useState(0)
  const [statusError, setStatusError] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(null)
  const [incidentBusy, setIncidentBusy] = useState(null)
  const [incidentNotice, setIncidentNotice] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user?.role !== 'admin') return undefined
    let cancelled = false
    Promise.all([getOrders(), getTickets(), getEvents()])
      .then(([orders, tickets, events]) => {
        if (!cancelled) setAdminData({ email: user.email, orders, tickets, events, error: '' })
      })
      .catch((error) => {
        if (!cancelled) setAdminData({ email: user.email, orders: [], tickets: [], events: [], error: error.message })
      })
      .finally(() => { if (!cancelled) setLoadingData(false) })
    return () => { cancelled = true }
  }, [user, refreshData])

  const dataMatchesUser = adminData.email === user?.email
  const orders = dataMatchesUser ? adminData.orders : []
  const tickets = dataMatchesUser ? adminData.tickets : []
  const events = dataMatchesUser ? adminData.events : []
  const dataError = dataMatchesUser ? adminData.error : ''
  const loadingOrders = user?.role === 'admin' && (loadingData || !dataMatchesUser)

  const refreshAdminData = () => {
    setLoadingData(true)
    setRefreshData((n) => n + 1)
  }

  if (user?.role !== 'admin') {
    return (
      <section className="section section-cream page-top">
        <div className="container narrow">
          <div className="panel">
            <h1 className="h-lg">Acceso restringido</h1>
            <p className="muted">El back-office es solo para la cuenta de prueba <code>admin@ucam.test</code>.</p>
            <Link to="/login" className="btn btn-dark">Iniciar sesión</Link>
          </div>
        </div>
      </section>
    )
  }

  const shown = filter === 'todos' ? events : events.filter((e) => e.type === filter)

  const reset = async () => {
    if (!window.confirm('¿Borrar todos los eventos e incidencias del servidor?')) return
    try {
      await Promise.all([clearTickets(), clearEvents()])
      refreshAdminData()
    } catch (error) {
      setAdminData((current) => ({ ...current, error: error.message }))
    }
  }

  const changeOrderStatus = async (id, status) => {
    setStatusError('')
    try {
      const updated = await updateOrderStatus(id, status)
      setAdminData((current) => ({
        ...current,
        orders: current.orders.map((order) => order.id === id ? updated : order),
      }))
    } catch (error) {
      setStatusError(error.message)
    }
  }

  const runIncidentAgent = async (reference) => {
    setIncidentBusy(reference)
    setIncidentNotice({ type: '', text: '' })
    try {
      const result = await analyzeTicket(reference)
      setIncidentNotice({
        type: 'ok',
        text: result.status === 'already_pending'
          ? 'Esta incidencia ya tenía una propuesta pendiente de revisión.'
          : 'El agente ha creado una propuesta. Revísala antes de aprobarla.',
      })
      refreshAdminData()
    } catch (error) {
      setIncidentNotice({ type: 'error', text: error.message })
    } finally {
      setIncidentBusy(null)
    }
  }

  const reviewProposal = async (reference, decision) => {
    setIncidentBusy(`${reference}:${decision}`)
    setIncidentNotice({ type: '', text: '' })
    try {
      await reviewAgentAction(reference, decision)
      setIncidentNotice({
        type: 'ok',
        text: decision === 'approved' ? 'Propuesta aprobada.' : 'Propuesta rechazada.',
      })
      refreshAdminData()
    } catch (error) {
      setIncidentNotice({ type: 'error', text: error.message })
    } finally {
      setIncidentBusy(null)
    }
  }

  return (
    <section className="section section-cream page-top">
      <div className="container">
        <div className="section-head row">
          <div>
            <p className="eyebrow">Back-office</p>
            <h1 className="h-xl">Panel de administración</h1>
          </div>
          <div className="chips">
            <button className="btn btn-outline btn-sm" onClick={refreshAdminData}>Actualizar datos</button>
            <button className="btn btn-outline btn-sm" onClick={reset}>Reiniciar eventos e incidencias</button>
          </div>
        </div>

        {dataError && <p className="alert" role="alert">{dataError}</p>}
        <div className="stats">
          <div><strong>{orders.length}</strong><span>Pedidos</span></div>
          <div><strong>{eur(orders.filter((o) => o.status !== 'cancelado').reduce((s, o) => s + o.totals.total, 0))}</strong><span>Facturación simulada</span></div>
          <div><strong>{events.length}</strong><span>Eventos</span></div>
          <div><strong>{tickets.length}</strong><span>Incidencias</span></div>
        </div>

        <div className="chips tabs" role="tablist">
          {[['pedidos', 'Pedidos'], ['eventos', 'Eventos'], ['incidencias', 'Incidencias']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={'chip' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'pedidos' && statusError && <p className="alert" role="alert">{statusError}</p>}
        {tab === 'pedidos' && (
          loadingOrders ? <div className="empty"><h3>Cargando pedidos…</h3></div> :
          orders.length === 0 ? <div className="empty"><h3>Aún no hay pedidos</h3><p>Completa una compra para verla aquí.</p></div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Líneas</th><th>Pago</th><th className="r">Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <Fragment key={o.id}>
                      <tr className="clickable" onClick={() => setOpen(open === o.id ? null : o.id)}>
                        <td><strong>{o.id}</strong></td>
                        <td>{fechaHora(o.createdAt)}</td>
                        <td>{o.customer.nombre}<br /><span className="muted">{o.customer.email}</span></td>
                        <td>{o.lines.length}</td>
                        <td>{o.payment ? `${o.payment.result === 'approved' ? 'Aprobado' : 'Rechazado'} (${o.payment.method === 'paypal_simulado' ? 'PayPal' : 'Tarjeta de prueba'})` : '-'}</td>
                        <td className="r">{eur(o.totals.total)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select className={`status status-${o.status}`} value={o.status}
                            onChange={(e) => changeOrderStatus(o.id, e.target.value)} aria-label={`Estado de ${o.id}`}>
                            {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                      </tr>
                      {open === o.id && (
                        <tr className="detail">
                          <td colSpan="7">
                            <ul>
                              {o.lines.map((l) => <li key={l.cartKey ?? l.productId}>{l.qty} × {l.brand} {l.name}{l.variantValue ?? l.finish ? ` (${l.variantValue ?? l.finish})` : ''} - {eur(l.unitPrice * l.qty)}</li>)}
                            </ul>
                            <p className="muted">Entrega: {o.customer.direccion}</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'eventos' && (
          <>
            <div className="toolbar">
              <label className="select-wrap">
                <span>Tipo</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="todos">Todos</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <div className="chips">
                <button className="btn btn-dark btn-sm" onClick={() => downloadEvents(shown, 'json')}>Exportar JSON</button>
                <button className="btn btn-outline btn-sm" onClick={() => downloadEvents(shown, 'csv')}>Exportar CSV</button>
              </div>
            </div>
            {shown.length === 0 ? <div className="empty"><h3>Sin eventos</h3><p>Navega por la tienda para generarlos.</p></div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Evento</th><th>Sesión</th><th>Usuario</th><th>Payload</th></tr></thead>
                  <tbody>
                    {shown.map((e) => (
                      <tr key={e.id}>
                        <td>{fechaHora(e.timestamp)}</td>
                        <td><code>{e.type}</code></td>
                        <td>{e.sessionId}</td>
                        <td>{e.user ?? 'anónimo'}</td>
                        <td><code className="payload">{JSON.stringify(e.payload)}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'incidencias' && (
          <>
          {incidentNotice.text && (
            <p className={`alert${incidentNotice.type === 'ok' ? ' ok' : ''}`} role="status">
              {incidentNotice.text}
            </p>
          )}
          {tickets.length === 0 ? <div className="empty"><h3>Sin incidencias</h3><p>Las solicitudes de soporte aparecerán aquí.</p></div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Código</th><th>Fecha</th><th>Contacto</th><th>Pedido</th><th>Asunto</th><th>Estado</th><th>Agente IA</th></tr></thead>
                <tbody>
                  {tickets.map((t) => (
                    <Fragment key={t.id}>
                      <tr>
                        <td><strong>{t.id}</strong></td><td>{fechaHora(t.createdAt)}</td>
                        <td>{t.name}<br /><span className="muted">{t.email}</span></td>
                        <td>{t.orderId ?? '-'}</td><td>{t.subject}<br /><span className="muted">{t.message}</span></td>
                        <td><span className={`status status-${t.status}`}>{t.status}</span></td>
                        <td>
                          <button
                            className="btn btn-dark btn-sm"
                            disabled={incidentBusy === t.id || t.analysisStatus === 'running' || t.agentAction?.reviewStatus === 'pending_review'}
                            onClick={() => runIncidentAgent(t.id)}
                          >
                            {incidentBusy === t.id || t.analysisStatus === 'running'
                              ? 'Analizando…'
                              : t.agentAction ? 'Analizar de nuevo' : 'Analizar con IA'}
                          </button>
                        </td>
                      </tr>
                      {(t.agentAction || t.analysisError) && (
                        <tr className="detail">
                          <td colSpan="7">
                            {t.analysisError && <p className="alert">Último intento: {t.analysisError}</p>}
                            {t.agentAction && (
                              <div className="agent-proposal">
                                <div className="agent-proposal-head">
                                  <div>
                                    <strong>Propuesta del agente</strong>
                                    <span className={`review-badge review-${t.agentAction.reviewStatus}`}>{t.agentAction.reviewStatus}</span>
                                  </div>
                                  {t.agentAction.confidence != null && <span>Confianza: {Math.round(t.agentAction.confidence * 100)}%</span>}
                                </div>
                                <p>{t.agentAction.proposedAction}</p>
                                <p><strong>Justificación:</strong> {t.agentAction.justification}</p>
                                {t.agentAction.risks && <p><strong>Riesgos:</strong> {t.agentAction.risks}</p>}
                                {t.agentAction.reviewStatus === 'pending_review' && (
                                  <div className="chips">
                                    <button className="btn btn-dark btn-sm" disabled={incidentBusy?.startsWith(`${t.id}:`)} onClick={() => reviewProposal(t.id, 'approved')}>Aprobar</button>
                                    <button className="btn btn-outline btn-sm" disabled={incidentBusy?.startsWith(`${t.id}:`)} onClick={() => reviewProposal(t.id, 'rejected')}>Rechazar</button>
                                  </div>
                                )}
                                {t.agentAction.reviewedBy && <small className="muted">Revisada por {t.agentAction.reviewedBy}{t.agentAction.reviewedAt ? ` · ${fechaHora(t.agentAction.reviewedAt)}` : ''}</small>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
        )}
      </div>
    </section>
  )
}
