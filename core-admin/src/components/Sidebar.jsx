
import {
  LayoutDashboard,
  ShoppingCart,
  AlertCircle,
  RefreshCw,
  Bot,
  ClipboardList,
  Layers
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Pedidos", icon: ShoppingCart, path: "/pedidos" },
  { name: "Incidencias", icon: AlertCircle, path: "/incidencias" },
  { name: "Integraciones", icon: RefreshCw, path: "/integraciones" },
  { name: "Agente IA", icon: Bot, path: "/agente-ia" },
  { name: "Logs", icon: ClipboardList, path: "/logs" }
];

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="sidebar-brand">
        <div className="brand-icon">
          <Layers size={23} />
        </div>

        <div>
          <h2>CoreAdmin</h2>
          <span>Management System</span>
        </div>
      </div>

      <div className="sidebar-section">
        <span className="section-label">MENÚ PRINCIPAL</span>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  isActive
                    ? "sidebar-link active"
                    : "sidebar-link"
                }
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="user-avatar">AD</div>

        <div className="user-info">
          <strong>Administrador</strong>
          <span>Panel de gestión</span>
        </div>
      </div>

    </aside>
  );
}

export default Sidebar;
