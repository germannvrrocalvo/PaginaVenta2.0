
import { useState } from "react";
import { Search, Eye, Save, AlertCircle } from "lucide-react";
import { incidentsData } from "../data/mockData";

function Incidents() {
  const [incidents, setIncidents] = useState(incidentsData);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [priorityFilter, setPriorityFilter] = useState("Todas");
  const [newStatus, setNewStatus] = useState("");

  // Filtrar incidencias por texto, estado y prioridad
  const filteredIncidents = incidents.filter((incident) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      incident.id.toLowerCase().includes(search) ||
      incident.orderId.toLowerCase().includes(search) ||
      incident.customer.toLowerCase().includes(search) ||
      incident.type.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "Todos" || incident.status === statusFilter;

    const matchesPriority =
      priorityFilter === "Todas" || incident.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Abrir los detalles de una incidencia
  const openIncident = (incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status);
  };

  // Guardar el nuevo estado
  const saveStatus = () => {
    const updatedIncidents = incidents.map((incident) =>
      incident.id === selectedIncident.id
        ? { ...incident, status: newStatus }
        : incident
    );

    setIncidents(updatedIncidents);

    setSelectedIncident({
      ...selectedIncident,
      status: newStatus
    });
  };

  // Calcular las métricas
  const openCount = incidents.filter(
    (incident) => incident.status === "Abierta"
  ).length;

  const reviewingCount = incidents.filter(
    (incident) => incident.status === "En revisión"
  ).length;

  const resolvedCount = incidents.filter(
    (incident) => incident.status === "Resuelta"
  ).length;

  return (
    <div className="incidents-page">

      {/* RESUMEN DE INCIDENCIAS */}

      <div className="incidents-summary">

        <div className="incident-summary-card">
          <span>Total de incidencias</span>
          <strong>{incidents.length}</strong>
        </div>

        <div className="incident-summary-card">
          <span>Abiertas</span>
          <strong>{openCount}</strong>
        </div>

        <div className="incident-summary-card">
          <span>En revisión</span>
          <strong>{reviewingCount}</strong>
        </div>

        <div className="incident-summary-card">
          <span>Resueltas</span>
          <strong>{resolvedCount}</strong>
        </div>

      </div>

      {/* TABLA DE INCIDENCIAS */}

      <section className="dashboard-panel incidents-panel">

        <div className="panel-header incidents-header">
          <div>
            <h3>Listado de incidencias</h3>
            <p>Consulta y gestiona los problemas registrados</p>
          </div>

          <div className="incidents-controls">

            <div className="incidents-search">
              <Search size={17} />

              <input
                type="text"
                placeholder="Buscar incidencia..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <select
              className="incidents-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="Todos">Todos los estados</option>
              <option value="Abierta">Abierta</option>
              <option value="En revisión">En revisión</option>
              <option value="Resuelta">Resuelta</option>
            </select>

            <select
              className="incidents-filter"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="Todas">Todas las prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>

          </div>
        </div>

        <div className="table-container">
          <table className="orders-table">

            <thead>
              <tr>
                <th>Incidencia</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="order-id">{incident.id}</td>
                    <td>{incident.orderId}</td>
                    <td>{incident.customer}</td>
                    <td>{incident.type}</td>

                    <td>
                      <span
                        className={`incident-priority priority-${incident.priority.toLowerCase()}`}
                      >
                        {incident.priority}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          incident.status === "Resuelta"
                            ? "status-success"
                            : incident.status === "En revisión"
                            ? "status-info"
                            : "status-warning"
                        }`}
                      >
                        {incident.status}
                      </span>
                    </td>

                    <td>{incident.date}</td>

                    <td>
                      <button
                        className="view-order-btn"
                        onClick={() => openIncident(incident)}
                        title="Ver detalles"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="orders-empty">
                    No se encontraron incidencias.
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>

      </section>

      {/* VENTANA DE DETALLES */}

      {selectedIncident && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="order-modal"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="modal-header">
              <div>
                <h3>Detalles de la incidencia</h3>
                <p>{selectedIncident.id}</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedIncident(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">

              <div className="order-detail">
                <span>Pedido relacionado</span>
                <strong>{selectedIncident.orderId}</strong>
              </div>

              <div className="order-detail">
                <span>Cliente</span>
                <strong>{selectedIncident.customer}</strong>
              </div>

              <div className="order-detail">
                <span>Tipo de incidencia</span>
                <strong>{selectedIncident.type}</strong>
              </div>

              <div className="order-detail">
                <span>Fecha de creación</span>
                <strong>{selectedIncident.date}</strong>
              </div>

              <div className="order-detail">
                <span>Prioridad</span>
                <strong>{selectedIncident.priority}</strong>
              </div>

              <div className="incident-description">
                <span>Descripción</span>
                <p>{selectedIncident.description}</p>
              </div>

              <div className="status-editor">
                <label htmlFor="incident-status">
                  Cambiar estado de la incidencia
                </label>

                <select
                  id="incident-status"
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value)}
                >
                  <option value="Abierta">Abierta</option>
                  <option value="En revisión">En revisión</option>
                  <option value="Resuelta">Resuelta</option>
                </select>

                <button
                  className="save-status-btn"
                  onClick={saveStatus}
                  disabled={newStatus === selectedIncident.status}
                >
                  <Save size={16} />
                  Guardar cambios
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Incidents;
