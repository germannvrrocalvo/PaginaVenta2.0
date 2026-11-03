import { Bell, Search, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function initials(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || 'AD'
}

function Header({ title, subtitle }) {
  const { user, logout } = useAuth()

  return (
    <header className="header">
      <div className="header-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="header-actions">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Buscar..." />
        </div>

        <button className="notification-button">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        <div className="header-profile">
          <div className="profile-avatar">{initials(user?.nombre)}</div>

          <div className="profile-details">
            <strong>{user?.nombre}</strong>
            <span>{user?.email}</span>
          </div>

          <button className="logout-button" onClick={logout} title="Cerrar sesión">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header