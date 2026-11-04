import { useState } from 'react'
import {
  ExternalLink,
  Database,
  ShieldCheck,
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react'

// Cuadro de mando operativo con datos REALES del back-office.
// Está hecho en Chartbrew, que lee las vistas de solo lectura de
// database/backoffice/dashboard.sql con el usuario dashboard_reader.
// La URL es un enlace público de solo lectura (no da acceso a la BD).
// Se puede cambiar con VITE_DASHBOARD_EMBED_URL sin tocar el código.
const DASHBOARD_URL =
  import.meta.env.VITE_DASHBOARD_EMBED_URL ||
  'https://app.chartbrew.com/report/my-first-dashboard-200XalYo?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2ZXJzaW9uIjoyLCJzdWIiOnsidHlwZSI6IlByb2plY3QiLCJpZCI6IjQzNjM3Iiwic2hhcmVQb2xpY3lJZCI6MjAxfSwiaWF0IjoxNzkzODEwOTIwLCJleHAiOjEwNDMzNzI0NTIwfQ.BcnewrBOzzrf4n7xsfiBE5tUMOG5tB4QpNAAwYRMBh8'

const infoCards = [
  {
    icon: Database,
    title: 'Fuente de datos',
    text: 'BD del back-office (sie-backoffice-db, Neon): pedidos, integración con n8n, incidencias y agente IA.',
  },
  {
    icon: ShieldCheck,
    title: 'Acceso de solo lectura',
    text: 'El cuadro de mando usa el usuario dashboard_reader, que solo puede leer las vistas del esquema dashboard.',
  },
  {
    icon: Clock,
    title: 'Actualización',
    text: 'Las métricas se recalculan a partir de los datos que escribe n8n. Sin cifras introducidas a mano.',
  },
]

function Dashboard() {
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
          <h2>Cuadro de mando operativo</h2>
          <p>Métricas reales del back-office de UCAM Stereo.</p>
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
          <a
            className="cm-btn primary"
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            Abrir en pestaña nueva
          </a>
        </div>
      </div>

      <section className={`dashboard-panel cm-frame-panel${expanded ? ' expanded' : ''}`}>
        {loading && (
          <div className="cm-loading">
            <RefreshCw size={22} className="cm-spin" />
            <span>Cargando el cuadro de mando…</span>
          </div>
        )}
        <iframe
          key={frameKey}
          className="cm-frame"
          src={DASHBOARD_URL}
          title="Cuadro de mando UCAM Stereo"
          loading="lazy"
          onLoad={() => setLoading(false)}
        />
      </section>

      <p className="cm-hint">
        ¿No se ve el cuadro de mando? Ábrelo con <strong>Abrir en pestaña nueva</strong>.
      </p>

      <div className="cm-info">
        {infoCards.map(({ icon: Icon, title, text }) => (
          <div className="cm-info-card" key={title}>
            <div className="cm-info-icon">
              <Icon size={18} />
            </div>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
