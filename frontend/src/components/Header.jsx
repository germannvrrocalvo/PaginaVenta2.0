import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Disc3, Search, User, ShoppingBag, X, Menu } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AccountModal from './AccountModal.jsx'
import CartPopover from './CartPopover.jsx'
import PrototypeBanner from './PrototypeBanner.jsx'

const LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/catalogo', label: 'Catálogo', end: true },
  { to: '/catalogo/vinilos', label: 'Vinilos' },
  { to: '/catalogo/tocadiscos', label: 'Tocadiscos' },
  { to: '/catalogo/altavoces', label: 'Altavoces' },
  { to: '/catalogo/auriculares', label: 'Auriculares' },
]

export default function Header() {
  const { count, cartOpen, toggleCart, closeCart } = useCart()
  const { user, authView, openAccount, closeAccount } = useAuth()
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')

  const submit = (e) => {
    e.preventDefault()
    navigate(`/catalogo?q=${encodeURIComponent(q.trim())}`)
    setSearching(false)
  }

  return (
    <header className={`header ${cartOpen || authView ? 'overlay-open' : ''}`}>
      <PrototypeBanner />
      {!user && (
        <div className="header-promo">
          <span>Regístrate y disfruta de un <strong>10 % de descuento</strong> durante tu primer mes</span>
          <button type="button" onClick={() => openAccount('register')}>Registrarse</button>
        </div>
      )}
      <div className="header-inner">
        <Link to="/" className="logo" aria-label="UCAM Stereo, inicio">
          <span className="logo-mark"><Disc3 size={20} /></span>
          <span className="logo-text">UCAM <em>Stereo</em></span>
        </Link>

        <nav className={"nav" + (menu ? " is-open" : "")} aria-label="Principal">
          {LINKS.map((l) => (
            <NavLink onClick={() => setMenu(false)} key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-icons"><button className="icon-btn menu-toggle" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={20}/></button>
          {searching ? (
            <form className="search-form" onSubmit={submit}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o marca" aria-label="Buscar" />
              <button type="button" className="icon-btn" onClick={() => setSearching(false)} aria-label="Cerrar búsqueda"><X size={18} /></button>
            </form>
          ) : (
            <button className="icon-btn" onClick={() => setSearching(true)} aria-label="Buscar"><Search size={20} /></button>
          )}
          <div className="account-anchor">
            <button onClick={() => { closeCart(); if (authView) closeAccount(); else openAccount() }} className="icon-btn" aria-label={user ? `Mi usuario: ${user.name}` : 'Mi usuario'} aria-expanded={!!authView}>
              <User size={20} />{user && <span className="session-dot" />}
            </button>
            {authView && <AccountModal />}
          </div>
          <div className="cart-anchor">
            <button type="button" onClick={() => { if (authView) closeAccount(); toggleCart() }} className="icon-btn" aria-label={`Carrito, ${count} ${count === 1 ? 'artículo' : 'artículos'}`} aria-expanded={cartOpen}>
              <ShoppingBag size={20} />
              {count > 0 && <span className="cart-badge">{count}</span>}
            </button>
            {cartOpen && <CartPopover />}
          </div>
        </div>
      </div>
    </header>
  )
}
