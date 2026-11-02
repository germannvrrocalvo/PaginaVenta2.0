
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";


const pageInfo = {
  "/": {
    title: "Dashboard",
    subtitle: "Resumen general del negocio"
  },
  "/pedidos": {
    title: "Pedidos",
    subtitle: "Consulta y gestión de pedidos"
  },
  "/incidencias": {
    title: "Incidencias",
    subtitle: "Gestión y seguimiento de incidencias"
  },
  "/integraciones": {
    title: "Integraciones",
    subtitle: "Monitorización de las conexiones entre sistemas"
  },
  "/agente-ia": {
    title: "Agente IA",
    subtitle: "Supervisión de propuestas y acciones inteligentes"
  },
  "/logs": {
    title: "Logs",
    subtitle: "Historial técnico y trazabilidad"
  }
};

function AdminLayout() {
  const location = useLocation();

  const currentPage = pageInfo[location.pathname] || pageInfo["/"];

  return (
    <div className="admin-container">
      <Sidebar />

      <main className="main-content">
        <Header
          title={currentPage.title}
          subtitle={currentPage.subtitle}
        />

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
