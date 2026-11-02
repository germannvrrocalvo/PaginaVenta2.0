
import { useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Check,
  X,
  Search,
  ShoppingCart,
  MessageSquare,
} from "lucide-react";

const initialProposals = [
  {
    id: 1,
    title: "Revisar pedido pendiente",
    description:
      "El pedido UC-2026-01006 todavía aparece con el pago pendiente.",
    reason:
      "El agente ha detectado que el pedido lleva tiempo sin confirmar el pago.",
    action: "Crear una incidencia para revisar el pago.",
    priority: "Alta",
    status: "Pendiente",
    icon: ShoppingCart,
  },
  {
    id: 2,
    title: "Notificar retraso de entrega",
    description:
      "El cliente del pedido UC-2026-01005 ha comunicado que no ha recibido su compra.",
    reason:
      "Existe una incidencia abierta relacionada con un posible retraso.",
    action: "Preparar una notificación para el cliente por Telegram.",
    priority: "Media",
    status: "Pendiente",
    icon: MessageSquare,
  },
];

function Agent() {
  const [proposals, setProposals] = useState(initialProposals);

  const updateProposal = (id, newStatus) => {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === id
          ? { ...proposal, status: newStatus }
          : proposal
      )
    );
  };

  const pending = proposals.filter(
    (proposal) => proposal.status === "Pendiente"
  ).length;

  const approved = proposals.filter(
    (proposal) => proposal.status === "Aprobada"
  ).length;

  return (
    <div className="agent-page">
      <section className="agent-welcome">
        <div className="agent-welcome-icon">
          <Bot size={30} />
        </div>

        <div>
          <span className="agent-label">ASISTENTE INTELIGENTE</span>
          <h2>Agente IA de CoreAdmin</h2>
          <p>
            Supervisión de pedidos, incidencias y propuestas de actuación.
          </p>
        </div>

        <span className="agent-demo-status">Modo demostración</span>
      </section>

      <section className="agent-summary">
        <div className="agent-summary-card">
          <div className="agent-summary-icon blue">
            <BrainCircuit size={21} />
          </div>
          <div>
            <span>Casos analizados</span>
            <strong>12</strong>
          </div>
        </div>

        <div className="agent-summary-card">
          <div className="agent-summary-icon orange">
            <Clock size={21} />
          </div>
          <div>
            <span>Propuestas pendientes</span>
            <strong>{pending}</strong>
          </div>
        </div>

        <div className="agent-summary-card">
          <div className="agent-summary-icon green">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <span>Propuestas aprobadas</span>
            <strong>{approved}</strong>
          </div>
        </div>
      </section>

      <section className="agent-section">
        <div className="agent-section-heading">
          <div>
            <h2>Propuestas del agente</h2>
            <p>
              Revisa las recomendaciones antes de ejecutar cualquier acción.
            </p>
          </div>
          <span className="agent-count">{pending} pendientes</span>
        </div>

        <div className="agent-proposals">
          {proposals.map((proposal) => {
            const Icon = proposal.icon;

            return (
              <article className="agent-proposal" key={proposal.id}>
                <div className="proposal-icon">
                  <Icon size={21} />
                </div>

                <div className="proposal-content">
                  <div className="proposal-heading">
                    <h3>{proposal.title}</h3>
                    <span
                      className={`proposal-priority ${
                        proposal.priority.toLowerCase()
                      }`}
                    >
                      {proposal.priority}
                    </span>
                  </div>

                  <p>{proposal.description}</p>

                  <div className="proposal-detail">
                    <strong>Motivo del análisis</strong>
                    <span>{proposal.reason}</span>
                  </div>

                  <div className="proposal-action">
                    <strong>Acción propuesta:</strong> {proposal.action}
                  </div>

                  <div className="proposal-footer">
                    <span
                      className={`proposal-status ${
                        proposal.status.toLowerCase()
                      }`}
                    >
                      {proposal.status}
                    </span>

                    {proposal.status === "Pendiente" ? (
                      <div className="proposal-buttons">
                        <button
                          className="proposal-reject"
                          onClick={() =>
                            updateProposal(proposal.id, "Rechazada")
                          }
                        >
                          <X size={15} />
                          Rechazar
                        </button>

                        <button
                          className="proposal-approve"
                          onClick={() =>
                            updateProposal(proposal.id, "Aprobada")
                          }
                        >
                          <Check size={15} />
                          Aprobar
                        </button>
                      </div>
                    ) : (
                      <span className="proposal-finished">
                        Decisión registrada
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {proposals.length === 0 && (
            <p className="agent-empty">No hay propuestas disponibles.</p>
          )}
        </div>
      </section>

      <section className="agent-information">
        <div className="agent-information-icon">
          <AlertTriangle size={20} />
        </div>
        <div>
          <strong>Control del administrador</strong>
          <p>
            Las propuestas de esta demostración no ejecutan acciones reales.
            La aprobación y el rechazo solo actualizan su estado en pantalla.
            En la integración final, las acciones sensibles requerirán
            autorización antes de ejecutarse.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Agent;
