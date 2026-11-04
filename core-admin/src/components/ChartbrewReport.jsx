import { useState } from 'react'
import { ExternalLink, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'

// Muestra un informe público de solo lectura de Chartbrew dentro de CoreAdmin.
// Lo usan las páginas Logs e Integraciones. Los datos salen de las vistas de
// solo lectura de database/backoffice/dashboard.sql (usuario dashboard_reader).
function ChartbrewReport({ title, description, url, infoCards = [] }) {
  const [frameKey, setFrameKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  function reload() {
    setLoading(true)
    setFrameKey((k) => k + 1)
  }

  return (
    <div className="dashboard">
      <div className="dashboard-welcome cm-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
          <div className="cm-badges">
            <span className="cm-badge live">
              <span className="cm-dot" />
              Datos reales
            </span>
            <span className="cm-badge">Solo lectura</span>
            <span className="cm-badge">Prototipo académico</span>
          </div>
        </div>

        <div className="cm-actions">
          <button type="button" className="cm-btn" onClick={reload}>
            <RefreshCw size={16} />
            Recargar
          </button>
          <button type="button" className="cm-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {expanded ? 'Reducir' : 'Ampliar'}
          </button>
          <a className="cm-btn primary" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} />
            Abrir en pestaña nueva
          </a>
        </div>
      </div>

      <section className={`dashboard-panel cm-frame-panel${expanded ? ' expanded' : ''}`}>
        {loading && (
          <div className="cm-loading">
            <RefreshCw size={22} className="cm-spin" />
            <span>Cargando…</span>
          </div>
        )}
        <iframe
          key={frameKey}
          className="cm-frame"
          src={url}
          title={title}
          loading="lazy"
          onLoad={() => setLoading(false)}
        />
      </section>

      <p className="cm-hint">
        ¿No se ve? Ábrelo con <strong>Abrir en pestaña nueva</strong>.
      </p>

      {infoCards.length > 0 && (
        <div className="cm-info">
          {infoCards.map(({ icon: Icon, title: cardTitle, text }) => (
            <div className="cm-info-card" key={cardTitle}>
              <div className="cm-info-icon">
                <Icon size={18} />
              </div>
              <div>
                <strong>{cardTitle}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ChartbrewReport
