import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layers, LogIn, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const destino = location.state?.from || '/'

  if (user) return <Navigate to={destino} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSending(true)
    try {
      await login(email, password)
      navigate(destino, { replace: true })
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="brand-icon">
            <Layers size={23} />
          </div>
          <div>
            <h1>CoreAdmin</h1>
            <span>Back-office UCAM Stereo</span>
          </div>
        </div>

        <p className="login-subtitle">Accede con tu usuario de administración</p>

        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="login-password">Contraseña</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="login-error">
            <AlertCircle size={16} />
            {error}
          </p>
        )}

        <button type="submit" className="login-button" disabled={sending}>
          <LogIn size={17} />
          {sending ? 'Entrando…' : 'Iniciar sesión'}
        </button>

        <p className="login-note">
          Prototipo académico · Sin actividad comercial real
        </p>
      </form>
    </div>
  )
}

export default Login