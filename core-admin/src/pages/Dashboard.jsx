import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import {
  ShoppingCart,
  Euro,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Info
} from "lucide-react";

import StatCard from "../components/StatCard";

import {
  dashboardStats,
  ordersChartData,
  recentOrders,
  recentActivity
} from "../data/mockData";

const statIcons = [
  ShoppingCart,
  Euro,
  AlertCircle,
  RefreshCw
];

function Dashboard() {
  const activityIcons = {
    success: CheckCircle2,
    warning: AlertCircle,
    info: Info,
    order: ShoppingCart
  };

  return (
    <div className="dashboard">

      {/* BIENVENIDA */}

      <div className="dashboard-welcome">
        <div>
          <h2>Bienvenido a CoreAdmin</h2>
          <p>
            Aquí tienes un resumen de la actividad del negocio.
          </p>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS */}

      <div className="stats-grid">
        {dashboardStats.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            color={stat.color}
            icon={statIcons[index] || Info}
          />
        ))}
      </div>

      {/* GRÁFICO Y ACTIVIDAD RECIENTE */}

      <div className="dashboard-grid">

        {/* GRÁFICO DE PEDIDOS */}

        <section className="dashboard-panel chart-panel">
          <div className="panel-header">
            <div>
              <h3>Evolución de pedidos</h3>
              <p>Pedidos registrados durante la última semana</p>
            </div>

            <span className="panel-period">
              Últimos 7 días
            </span>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ordersChartData}>
                <defs>
                  <linearGradient
                    id="ordersGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#2563EB"
                      stopOpacity={0.25}
                    />

                    <stop
                      offset="100%"
                      stopColor="#2563EB"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E8ECF2"
                />

                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8490A3", fontSize: 12 }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8490A3", fontSize: 12 }}
                />

                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="orders"
                  name="Pedidos"
                  stroke="#2563EB"
                  strokeWidth={3}
                  fill="url(#ordersGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ACTIVIDAD RECIENTE */}

        <section className="dashboard-panel activity-panel">
          <div className="panel-header">
            <div>
              <h3>Actividad reciente</h3>
              <p>Últimos eventos del sistema</p>
            </div>
          </div>

          <div className="activity-list">
            {recentActivity.map((activity) => {
              const Icon = activityIcons[activity.type] || Info;

              return (
                <div
                  className="activity-item"
                  key={`${activity.title}-${activity.time}`}
                >
                  <div className={`activity-icon ${activity.type}`}>
                    <Icon size={17} />
                  </div>

                  <div className="activity-info">
                    <strong>{activity.title}</strong>
                    <span>{activity.description}</span>
                    <small>{activity.time}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* TABLA DE PEDIDOS RECIENTES */}

      <section className="dashboard-panel orders-panel">

        <div className="panel-header">
          <div>
            <h3>Pedidos recientes</h3>
            <p>Últimos pedidos registrados en el sistema</p>
          </div>

          <span className="panel-period">
            Últimos pedidos
          </span>
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
              </tr>
            </thead>

            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="order-id">
                    {order.id}
                  </td>

                  <td>
                    {order.customer}
                  </td>

                  <td>
                    {order.date || "—"}
                  </td>

                  <td className="order-amount">
                    {order.amount || order.total || "—"}
                  </td>

                  <td>
                    <span
                      className={`status-badge ${
                        order.status === "Enviado"
                          ? "status-success"
                          : order.status === "Pagado"
                          ? "status-info"
                          : order.status === "Con incidencia"
                          ? "status-danger"
                          : "status-warning"
                      }`}
                    >
                      {order.status}
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

export default Dashboard;