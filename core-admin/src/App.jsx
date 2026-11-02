
import { BrowserRouter, Routes, Route } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";

import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Incidents from "./pages/Incidents";
import PlaceholderPage from "./pages/PlaceholderPage";
import Integrations from "./pages/Integrations";
import Agent from "./pages/Agent";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>

          {/* DASHBOARD */}
          <Route
            path="/"
            element={<Dashboard />}
          />

          {/* PEDIDOS */}
          <Route
            path="/pedidos"
            element={<Orders />}
          />

          {/* INCIDENCIAS */}
          <Route
            path="/incidencias"
            element={<Incidents />}
          />

       
       {/* INTEGRACIONES */}
          <Route
            path="/integraciones"
            element={<Integrations />}
/>
            
        

          {/* AGENTE IA */}
        {/* AGENTE IA */}
<Route
  path="/agente-ia"
  element={<Agent />}
/>
          
          {/* LOGS */}
          <Route
            path="/logs"
            element={
              <PlaceholderPage
                title="Logs"
                description="Consulta el historial de ejecuciones y eventos del sistema."
              />
            }
          />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
