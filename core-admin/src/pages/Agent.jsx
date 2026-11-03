import { useEffect, useState } from "react";
import { Bot, BrainCircuit, CheckCircle2, Clock, AlertTriangle, Check, X, MessageSquare } from "lucide-react";
import { listIncidents, reviewProposal } from "../lib/backoffice";

const statusLabel = { pending_review: "Pendiente", approved: "Aprobada", rejected: "Rechazada", executed: "Ejecutada" };

function Agent() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    const data = await listIncidents();
    setTickets(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    listIncidents()
      .then((data) => { if (!cancelled) setTickets(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const proposals = tickets
    .filter((ticket) => ticket.agentAction)
    .map((ticket) => ({ ...ticket.agentAction, reference: ticket.id, subject: ticket.subject, orderId: ticket.orderId }));

  const updateProposal = async (proposal, decision) => {
    setBusy(proposal.id);
    setError("");
    try {
      await reviewProposal(proposal.reference, decision);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(null);
    }
  };

  const pending = proposals.filter((proposal) => proposal.reviewStatus === "pending_review").length;
  const approved = proposals.filter((proposal) => ["approved", "executed"].includes(proposal.reviewStatus)).length;

  return (
    <div className="agent-page">
      <section className="agent-welcome">
        <div className="agent-welcome-icon"><Bot size={30} /></div>
        <div><span className="agent-label">ASISTENTE INTELIGENTE</span><h2>Agente IA de CoreAdmin</h2><p>Propuestas reales generadas por n8n a partir de las incidencias de la tienda.</p></div>
        <span className="agent-live-status">Conectado al backend</span>
      </section>

      <section className="agent-summary">
        <div className="agent-summary-card"><div className="agent-summary-icon blue"><BrainCircuit size={21} /></div><div><span>Casos analizados</span><strong>{proposals.length}</strong></div></div>
        <div className="agent-summary-card"><div className="agent-summary-icon orange"><Clock size={21} /></div><div><span>Propuestas pendientes</span><strong>{pending}</strong></div></div>
        <div className="agent-summary-card"><div className="agent-summary-icon green"><CheckCircle2 size={21} /></div><div><span>Propuestas aprobadas</span><strong>{approved}</strong></div></div>
      </section>

      {error && <p className="backoffice-message error">{error}</p>}

      <section className="agent-section">
        <div className="agent-section-heading"><div><h2>Propuestas del agente</h2><p>Revisa las recomendaciones antes de ejecutar cualquier acción.</p></div><span className="agent-count">{pending} pendientes</span></div>
        <div className="agent-proposals">
          {proposals.map((proposal) => {
            const visibleStatus = statusLabel[proposal.reviewStatus] || proposal.reviewStatus;
            return <article className="agent-proposal" key={proposal.id}>
              <div className="proposal-icon"><MessageSquare size={21} /></div>
              <div className="proposal-content">
                <div className="proposal-heading"><h3>{proposal.subject || proposal.caseType || "Incidencia analizada"}</h3><span className="proposal-priority media">{Math.round((proposal.confidence || 0) * 100)}% confianza</span></div>
                <p>{proposal.orderId ? `Pedido relacionado: ${proposal.orderId}` : `Incidencia ${proposal.reference}`}</p>
                <div className="proposal-detail"><strong>Justificación</strong><span>{proposal.justification || "Sin justificación adicional."}</span></div>
                <div className="proposal-action"><strong>Acción propuesta:</strong> {proposal.proposedAction}</div>
                {proposal.risks && <div className="proposal-detail"><strong>Riesgos</strong><span>{proposal.risks}</span></div>}
                <div className="proposal-footer">
                  <span className={`proposal-status ${visibleStatus.toLowerCase()}`}>{visibleStatus}</span>
                  {proposal.reviewStatus === "pending_review" ? <div className="proposal-buttons">
                    <button className="proposal-reject" disabled={busy === proposal.id} onClick={() => updateProposal(proposal, "rejected")}><X size={15} />Rechazar</button>
                    <button className="proposal-approve" disabled={busy === proposal.id} onClick={() => updateProposal(proposal, "approved")}><Check size={15} />Aprobar</button>
                  </div> : <span className="proposal-finished">Decisión registrada{proposal.reviewedBy ? ` por ${proposal.reviewedBy}` : ""}</span>}
                </div>
              </div>
            </article>;
          })}
          {loading && <p className="agent-empty">Cargando propuestas…</p>}
          {!loading && proposals.length === 0 && <p className="agent-empty">Todavía no hay propuestas. Analiza una incidencia desde la sección Incidencias.</p>}
        </div>
      </section>

      <section className="agent-information"><div className="agent-information-icon"><AlertTriangle size={20} /></div><div><strong>Control del administrador</strong><p>El agente solo propone. Aprobar o rechazar registra la decisión y el administrador conserva el control de cualquier acción sensible.</p></div></section>
    </div>
  );
}

export default Agent;
