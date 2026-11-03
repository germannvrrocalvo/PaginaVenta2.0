import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Save, Bot } from "lucide-react";
import { analyzeIncident, listIncidents, updateIncidentStatus } from "../lib/backoffice";

const statusLabel = { abierta: "Abierta", en_curso: "En revisión", resuelta: "Resuelta", cerrada: "Cerrada" };
const priorityLabel = { high: "Alta", medium: "Media", low: "Baja" };
const formatDate = (value) => value
  ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "—";

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [priorityFilter, setPriorityFilter] = useState("Todas");
  const [newStatus, setNewStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const load = async (selectedId = selectedIncident?.id) => {
    const data = await listIncidents();
    setIncidents(data);
    if (selectedId) setSelectedIncident(data.find((item) => item.id === selectedId) || null);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    listIncidents()
      .then((data) => { if (!cancelled) setIncidents(data); })
      .catch((error) => { if (!cancelled) setMessage({ type: "error", text: error.message }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const search = searchTerm.toLowerCase();
    const priority = priorityLabel[incident.priority] || "Media";
    const status = statusLabel[incident.status] || incident.status;
    return [incident.id, incident.orderId, incident.name, incident.email, incident.subject]
      .some((value) => String(value || "").toLowerCase().includes(search))
      && (statusFilter === "Todos" || status === statusFilter)
      && (priorityFilter === "Todas" || priority === priorityFilter);
  }), [incidents, priorityFilter, searchTerm, statusFilter]);

  const openIncident = (incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status);
    setMessage({ type: "", text: "" });
  };

  const saveStatus = async () => {
    setBusy(true);
    setMessage({ type: "", text: "" });
    try {
      await updateIncidentStatus(selectedIncident.id, newStatus);
      await load(selectedIncident.id);
      setMessage({ type: "ok", text: "Estado guardado en la base de datos." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const runAgent = async () => {
    setBusy(true);
    setMessage({ type: "", text: "" });
    try {
      const result = await analyzeIncident(selectedIncident.id);
      await load(selectedIncident.id);
      setMessage({ type: "ok", text: result.status === "already_pending" ? "Ya había una propuesta pendiente de revisión." : "Análisis completado. La propuesta está pendiente de revisión humana." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      await load(selectedIncident.id).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const openCount = incidents.filter((item) => item.status === "abierta").length;
  const reviewingCount = incidents.filter((item) => item.status === "en_curso").length;
  const resolvedCount = incidents.filter((item) => ["resuelta", "cerrada"].includes(item.status)).length;

  return (
    <div className="incidents-page">
      <div className="incidents-summary">
        <div className="incident-summary-card"><span>Total de incidencias</span><strong>{incidents.length}</strong></div>
        <div className="incident-summary-card"><span>Abiertas</span><strong>{openCount}</strong></div>
        <div className="incident-summary-card"><span>En revisión</span><strong>{reviewingCount}</strong></div>
        <div className="incident-summary-card"><span>Resueltas</span><strong>{resolvedCount}</strong></div>
      </div>

      {message.text && <p className={`backoffice-message ${message.type}`}>{message.text}</p>}

      <section className="dashboard-panel incidents-panel">
        <div className="panel-header incidents-header">
          <div><h3>Listado de incidencias</h3><p>Datos reales recibidos desde la tienda</p></div>
          <div className="incidents-controls">
            <div className="incidents-search"><Search size={17} /><input type="text" placeholder="Buscar incidencia..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
            <select className="incidents-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="Todos">Todos los estados</option><option value="Abierta">Abierta</option><option value="En revisión">En revisión</option><option value="Resuelta">Resuelta</option><option value="Cerrada">Cerrada</option></select>
            <select className="incidents-filter" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="Todas">Todas las prioridades</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></select>
          </div>
        </div>

        <div className="table-container">
          <table className="orders-table">
            <thead><tr><th>Incidencia</th><th>Pedido</th><th>Cliente</th><th>Asunto</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>
              {!loading && filteredIncidents.map((incident) => {
                const priority = priorityLabel[incident.priority] || "Media";
                const status = statusLabel[incident.status] || incident.status;
                return <tr key={incident.id}>
                  <td className="order-id">{incident.id}</td><td>{incident.orderId || "—"}</td><td>{incident.name}<br /><small>{incident.email}</small></td><td>{incident.subject}</td>
                  <td><span className={`incident-priority priority-${priority.toLowerCase()}`}>{priority}</span></td>
                  <td><span className={`status-badge ${status === "Resuelta" || status === "Cerrada" ? "status-success" : status === "En revisión" ? "status-info" : "status-warning"}`}>{status}</span></td>
                  <td>{formatDate(incident.createdAt)}</td><td><button className="view-order-btn" onClick={() => openIncident(incident)} title="Ver detalles"><Eye size={16} /></button></td>
                </tr>;
              })}
              {loading && <tr><td colSpan="8" className="orders-empty">Cargando incidencias…</td></tr>}
              {!loading && filteredIncidents.length === 0 && <tr><td colSpan="8" className="orders-empty">No se encontraron incidencias.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedIncident && <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
        <div className="order-modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header"><div><h3>Detalles de la incidencia</h3><p>{selectedIncident.id}</p></div><button className="modal-close" onClick={() => setSelectedIncident(null)}>×</button></div>
          <div className="modal-content">
            <div className="order-detail"><span>Pedido relacionado</span><strong>{selectedIncident.orderId || "—"}</strong></div>
            <div className="order-detail"><span>Cliente</span><strong>{selectedIncident.name} · {selectedIncident.email}</strong></div>
            <div className="order-detail"><span>Fecha de creación</span><strong>{formatDate(selectedIncident.createdAt)}</strong></div>
            <div className="incident-description"><span>Descripción</span><p>{selectedIncident.message}</p></div>
            <div className="agent-run-box"><div><strong>Agente IA</strong><p>n8n analizará el caso y creará una propuesta que deberá revisar una persona.</p></div><button className="save-status-btn" onClick={runAgent} disabled={busy || selectedIncident.analysisStatus === "running" || selectedIncident.agentAction?.reviewStatus === "pending_review"}><Bot size={16} />{busy ? "Procesando…" : selectedIncident.agentAction ? "Analizar de nuevo" : "Analizar con IA"}</button></div>
            {selectedIncident.analysisError && <p className="backoffice-message error">Último intento: {selectedIncident.analysisError}</p>}
            {selectedIncident.agentAction && <div className="incident-agent-result"><strong>Propuesta: {selectedIncident.agentAction.reviewStatus}</strong><p>{selectedIncident.agentAction.proposedAction}</p><small>Confianza: {Math.round((selectedIncident.agentAction.confidence || 0) * 100)}%</small></div>}
            <div className="status-editor"><label htmlFor="incident-status">Cambiar estado de la incidencia</label><select id="incident-status" value={newStatus} onChange={(event) => setNewStatus(event.target.value)}><option value="abierta">Abierta</option><option value="en_curso">En revisión</option><option value="resuelta">Resuelta</option><option value="cerrada">Cerrada</option></select><button className="save-status-btn" onClick={saveStatus} disabled={busy || newStatus === selectedIncident.status}><Save size={16} />Guardar cambios</button></div>
          </div>
        </div>
      </div>}
    </div>
  );
}

export default Incidents;
