import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Envuelve las páginas privadas: sin sesión, redirige al login
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="auth-loading">Comprobando sesión…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user.role !== 'admin') {
    return <div className="auth-loading">Esta cuenta no tiene permisos de administración.</div>
  }

  return children
}

export default RequireAuth
