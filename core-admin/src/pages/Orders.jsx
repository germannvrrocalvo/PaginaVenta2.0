
import { useState } from "react";
import { Search, Eye, Save } from "lucide-react";
import { ordersData } from "../data/mockData";

function Orders() {
  const [orders, setOrders] = useState(ordersData);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [newStatus, setNewStatus] = useState("");

  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      order.id.toLowerCase().includes(search) ||
      order.customer.toLowerCase().includes(search) ||
      order.email.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "Todos" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openOrder = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
  };

  const saveStatus = () => {
    const updatedOrders = orders.map((order) =>
      order.id === selectedOrder.id
        ? { ...order, status: newStatus }
        : order
    );

    setOrders(updatedOrders);

    setSelectedOrder({
      ...selectedOrder,
      status: newStatus
    });
  };

  const completedOrders = orders.filter(
    (order) => order.status === "Completado"
  ).length;

  const pendingOrders = orders.filter(
    (order) => order.status === "Pendiente"
  ).length;

  return (
    <div className="orders-page">

      <div className="orders-summary">
        <div className="summary-card">
          <span>Total de pedidos</span>
          <strong>{orders.length}</strong>
        </div>

        <div className="summary-card">
          <span>Completados</span>
          <strong>{completedOrders}</strong>
        </div>

        <div className="summary-card">
          <span>Pendientes</span>
          <strong>{pendingOrders}</strong>
        </div>
      </div>

      <section className="dashboard-panel orders-table-panel">

        <div className="panel-header orders-table-header">
          <div>
            <h3>Listado de pedidos</h3>
            <p>Consulta y gestiona los pedidos registrados</p>
          </div>

          <div className="orders-controls">
            <div className="orders-search">
              <Search size={17} />

              <input
                type="text"
                placeholder="Buscar pedido o cliente..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <select
              className="orders-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="Todos">Todos los estados</option>
              <option value="Completado">Completado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En preparación">En preparación</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Importe</th>
                <th>Estado</th>
                <th>Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="order-id">{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.date}</td>
                    <td className="order-amount">
                      {order.total.toLocaleString("es-ES")} €
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          order.status === "Completado"
                            ? "status-success"
                            : order.status === "Cancelado"
                            ? "status-danger"
                            : order.status === "En preparación"
                            ? "status-info"
                            : "status-warning"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td>{order.payment}</td>
                    <td>
                      <button
                        className="view-order-btn"
                        onClick={() => openOrder(order)}
                        title="Ver detalles"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="orders-empty">
                    No se encontraron pedidos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="order-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Detalles del pedido</h3>
                <p>{selectedOrder.id}</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="order-detail">
                <span>Cliente</span>
                <strong>{selectedOrder.customer}</strong>
              </div>

              <div className="order-detail">
                <span>Email</span>
                <strong>{selectedOrder.email}</strong>
              </div>

              <div className="order-detail">
                <span>Fecha</span>
                <strong>{selectedOrder.date}</strong>
              </div>

              <div className="order-detail">
                <span>Estado del pago</span>
                <strong>{selectedOrder.payment}</strong>
              </div>

              <div className="order-products">
                <h4>Productos</h4>

                {selectedOrder.products.map((product, index) => (
                  <div
                    className="order-product"
                    key={`${product.name}-${index}`}
                  >
                    <div>
                      <strong>{product.name}</strong>
                      <span>Cantidad: {product.quantity}</span>
                    </div>

                    <strong>
                      {(product.price * product.quantity).toLocaleString("es-ES")} €
                    </strong>
                  </div>
                ))}
              </div>

              <div className="order-total">
                <span>Total del pedido</span>
                <strong>
                  {selectedOrder.total.toLocaleString("es-ES")} €
                </strong>
              </div>

              <div className="status-editor">
                <label htmlFor="order-status">Cambiar estado del pedido</label>

                <select
                  id="order-status"
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value)}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En preparación">En preparación</option>
                  <option value="Completado">Completado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>

                <button
                  className="save-status-btn"
                  onClick={saveStatus}
                  disabled={newStatus === selectedOrder.status}
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

export default Orders;
