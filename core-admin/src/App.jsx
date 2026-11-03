import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import AdminLayout from './layouts/AdminLayout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Incidents from './pages/Incidents'
import Integrations from './pages/Integrations'
import Agent from './pages/Agent'
import PlaceholderPage from './pages/PlaceholderPage'
import RequireAuth from './components/RequireAuth'

// Sin API de autenticación, el panel no exige login.
// Cuando haya backend: envolver <AdminLayout /> en <RequireAuth> (components/RequireAuth.jsx).
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pantalla de entrada (lista para conectar a un sistema de autenticación) */}
          <Route path="/login" element={<Login />} />

          {/* Panel */}
          <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route path="/incidencias" element={<Incidents />} />
            <Route path="/integraciones" element={<Integrations />} />
            <Route path="/agente-ia" element={<Agent />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
