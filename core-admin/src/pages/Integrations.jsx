
import { useState } from "react";
import {
  Store,
  Workflow,
  Database,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Activity,
  Plug,
} from "lucide-react";

const initialIntegrations = [
  {
    id: 1,
    name: "Tienda online",
    description: "Recepción de pedidos y cambios realizados en el ecommerce.",
    type: "Ecommerce",
    icon: Store,
    status: "Conectado",
    lastSync: "Hace 2 minutos",
  },
  {
    id: 2,
    name: "n8n",
    description: "Ejecución de workflows y automatización de procesos.",
    type: "Automatización",
    icon: Workflow,
    status: "Conectado",
    lastSync: "Hace 5 minutos",
  },
  {
    id: 3,
    name: "Base de datos",
    description: "Almacenamiento de pedidos, incidencias y registros.",
    type: "Almacenamiento",
    icon: Database,
    status: "Conectado",
    lastSync: "Hace 1 minuto",
  },
  {
    id: 4,
    name: "Telegram",
    description: "Envío de notificaciones y comunicación de incidencias.",
    type: "Mensajería",
    icon: Send,
    status: "Pendiente",
    lastSync: "Sin actividad reciente",
  },
];

const initialEvents = [
  {
    id: 1,
    name: "Pedido recibido",
    integration: "Tienda online → n8n",
    time: "Hace 10 minutos",
    status: "Correcto",
  },
  {
    id: 2,
    name: "Pedido registrado",
    integration: "n8n → Base de datos",
    time: "Hace 10 minutos",
    status: "Correcto",
  },
  {
    id: 3,
    name: "Registro de ejecución",
    integration: "n8n → Back-office",
    time: "Hace 10 minutos",
    status: "Correcto",
  },
  {
    id: 4,
    name: "Notificación de incidencia",
    integration: "Back-office → Telegram",
    time: "Hace 25 minutos",
    status: "Pendiente",
  },
];

function Integrations() {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [lastTested, setLastTested] = useState(null);

  const testConnection = (id) => {
    const integration = integrations.find((item) => item.id === id);

    setLastTested(integration.name);

    // Simulación visual: todavía no comprueba una conexión real.
  };

  const connectedCount = integrations.filter(
    (item) => item.status === "Conectado"
  ).length;

  return (
    <div className="integrations-page">
      <div className="integrations-summary">
        <div className="integration-summary-card">
          <div className="integration-summary-icon blue">
            <Plug size={20} />
          </div>
          <div>
            <span>Integraciones totales</span>
            <strong>{integrations.length}</strong>
          </div>
        </div>

        <div className="integration-summary-card">
          <div className="integration-summary-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Conectadas</span>
            <strong>{connectedCount}</strong>
          </div>
        </div>

        <div className="integration-summary-card">
          <div className="integration-summary-icon orange">
            <AlertCircle size={20} />
          </div>
          <div>
            <span>Pendientes</span>
            <strong>{integrations.length - connectedCount}</strong>
          </div>
        </div>
      </div>

      <section className="integrations-section">
        <div className="integrations-section-header">
          <div>
            <h2>Servicios conectados</h2>
            <p>Estado general de los sistemas de CoreAdmin.</p>
          </div>
          <span className="simulation-label">Datos de prueba</span>
        </div>

        <div className="integrations-grid">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            const isConnected = integration.status === "Conectado";

            return (
              <div className="integration-card" key={integration.id}>
                <div className="integration-card-top">
                  <div className="integration-service-icon">
                    <Icon size={23} />
                  </div>

                  <span
                    className={`integration-status ${
                      isConnected ? "connected" : "pending"
                    }`}
                  >
                    <span className="status-dot"></span>
                    {integration.status}
                  </span>
                </div>

                <div className="integration-card-info">
                  <span className="integration-type">{integration.type}</span>
                  <h3>{integration.name}</h3>
                  <p>{integration.description}</p>
                </div>

                <div className="integration-card-footer">
                  <div className="integration-last-sync">
                    <Clock size={14} />
                    <span>{integration.lastSync}</span>
                  </div>

                  <button
                    className="test-connection-btn"
                    onClick={() => testConnection(integration.id)}
                  >
                    <RefreshCw size={14} />
                    Probar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {lastTested && (
          <p className="integration-test-message">
            <InfoIcon />
            Prueba visual solicitada para {lastTested}. La conexión real todavía
            no está configurada.
          </p>
        )}
      </section>

      <section className="integrations-section events-section">
        <div className="integrations-section-header">
          <div>
            <h2>Actividad de integración</h2>
            <p>Últimos eventos registrados en el sistema.</p>
          </div>
          <Activity size={20} color="#64748b" />
        </div>

        <div className="table-container">
          <table className="integrations-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Conexión</th>
                <th>Hora</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {initialEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{event.integration}</td>
                  <td>{event.time}</td>
                  <td>
                    <span
                      className={`integration-event-status ${
                        event.status === "Correcto" ? "success" : "waiting"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InfoIcon() {
  return <AlertCircle size={16} />;
}

export default Integrations;
