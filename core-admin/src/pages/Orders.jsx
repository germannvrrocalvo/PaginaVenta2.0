import { useEffect, useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import { listOrders } from "../lib/backoffice";

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(new Date(value))
  : "—";

const formatMoney = (value, currency = "EUR") => new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency,
}).format(Number(value || 0));

const statusClass = (status) => {
  if (status === "entregado") return "status-success";
  if (status === "cancelado" || status === "con_incidencia") return "status-danger";
  if (["pagado", "pendiente_preparacion", "enviado"].includes(status)) return "status-info";
  return "status-warning";
};

const formatAddress = (address = {}) => [
  address.address,
  address.postalCode,
  address.city,
  address.province,
  address.country,
].filter(Boolean).join(", ") || "—";

function Orders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listOrders()
      .then((data) => { if (!cancelled) setOrders(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const statuses = useMemo(() => Array.from(
    new Map(orders.map((order) => [order.rawStatus, order.status])).entries()
  ), [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch = [order.id, order.customer, order.email, order.paymentReference]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const matchesStatus = statusFilter === "Todos" || order.rawStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }), [orders, searchTerm, statusFilter]);

  const deliveredOrders = orders.filter((order) => order.rawStatus === "entregado").length;
  const activeOrders = orders.filter((order) => !["entregado", "cancelado"].includes(order.rawStatus)).length;

  return (
    <div className="orders-page">
      <div className="orders-summary">
        <div className="summary-card"><span>Total de pedidos</span><strong>{orders.length}</strong></div>
        <div className="summary-card"><span>Entregados</span><strong>{deliveredOrders}</strong></div>
        <div className="summary-card"><span>En curso</span><strong>{activeOrders}</strong></div>
      </div>

      {error && <p className="backoffice-message error">No se pudieron cargar los pedidos: {error}</p>}

      <section className="dashboard-panel orders-table-panel">
        <div className="panel-header orders-table-header">
          <div><h3>Listado de pedidos</h3><p>Datos reales sincronizados desde la tienda</p></div>
          <div className="orders-controls">
            <div className="orders-search">
              <Search size={17} />
              <input type="text" placeholder="Buscar pedido o cliente..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </div>
            <select className="orders-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="Todos">Todos los estados</option>
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="orders-table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Pago</th><th>Acciones</th></tr></thead>
            <tbody>
              {!loading && filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="order-id">{order.id}</td>
                  <td>{order.customer}<br /><small>{order.email}</small></td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td className="order-amount">{formatMoney(order.total, order.currency)}</td>
                  <td><span className={`status-badge ${statusClass(order.rawStatus)}`}>{order.status}</span></td>
                  <td>{order.payment}</td>
                  <td><button className="view-order-btn" onClick={() => setSelectedOrder(order)} title="Ver detalles"><Eye size={16} /></button></td>
                </tr>
              ))}
              {loading && <tr><td colSpan="7" className="orders-empty">Cargando pedidos reales…</td></tr>}
              {!loading && !error && filteredOrders.length === 0 && <tr><td colSpan="7" className="orders-empty">No se encontraron pedidos.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h3>Detalles del pedido</h3><p>{selectedOrder.id}</p></div>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div className="modal-content">
              <div className="order-detail"><span>Cliente</span><strong>{selectedOrder.customer}</strong></div>
              <div className="order-detail"><span>Email</span><strong>{selectedOrder.email || "—"}</strong></div>
              <div className="order-detail"><span>Teléfono</span><strong>{selectedOrder.phone || "—"}</strong></div>
              <div className="order-detail"><span>Fecha</span><strong>{formatDate(selectedOrder.createdAt)}</strong></div>
              <div className="order-detail"><span>Estado</span><strong>{selectedOrder.status}</strong></div>
              <div className="order-detail"><span>Pago</span><strong>{selectedOrder.payment}{selectedOrder.paymentMethod ? ` · ${selectedOrder.paymentMethod}` : ""}</strong></div>
              <div className="order-detail"><span>Referencia de pago</span><strong>{selectedOrder.paymentReference || "—"}</strong></div>
              <div className="order-detail"><span>Dirección de envío</span><strong>{formatAddress(selectedOrder.shippingAddress)}</strong></div>

              <div className="order-products">
                <h4>Productos</h4>
                {selectedOrder.products.length > 0 ? selectedOrder.products.map((product) => (
                  <div className="order-product" key={product.id}>
                    <div>
                      <strong>{product.name}</strong>
                      <span>{[product.brand, product.variantValue].filter(Boolean).join(" · ")}</span>
                      <span>Cantidad: {product.quantity}</span>
                    </div>
                    <strong>{formatMoney(product.lineTotal, selectedOrder.currency)}</strong>
                  </div>
                )) : <p>No hay líneas registradas para este pedido.</p>}
              </div>

              <div className="order-detail"><span>Subtotal</span><strong>{formatMoney(selectedOrder.subtotal, selectedOrder.currency)}</strong></div>
              {selectedOrder.discount > 0 && <div className="order-detail"><span>Descuento</span><strong>−{formatMoney(selectedOrder.discount, selectedOrder.currency)}</strong></div>}
              <div className="order-detail"><span>Envío</span><strong>{formatMoney(selectedOrder.shipping, selectedOrder.currency)}</strong></div>
              <div className="order-detail"><span>IVA ({selectedOrder.taxRate} %)</span><strong>{formatMoney(selectedOrder.tax, selectedOrder.currency)}</strong></div>
              <div className="order-total"><span>Total del pedido</span><strong>{formatMoney(selectedOrder.total, selectedOrder.currency)}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;
