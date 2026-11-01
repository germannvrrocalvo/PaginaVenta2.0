import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import HelpButton from './components/HelpButton.jsx'
import BackButton from './components/BackButton.jsx'
import CartNotice from './components/CartNotice.jsx'
import Home from './pages/Home.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Producto from './pages/Producto.jsx'
import Carrito from './pages/Carrito.jsx'
import Checkout from './pages/Checkout.jsx'
import Confirmacion from './pages/Confirmacion.jsx'
import Seguimiento from './pages/Seguimiento.jsx'
import Login from './pages/Login.jsx'
import Soporte from './pages/Soporte.jsx'
import Admin from './pages/Admin.jsx'
import Info from './pages/info.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
export default function App() {
  const { pathname } = useLocation()
  const commerceMode = pathname === '/carrito' || pathname === '/checkout' || pathname.startsWith('/pedido/')
  return (
    <>
      <ScrollToTop />
      {!commerceMode && <Header />}
      <main className={commerceMode ? 'commerce-main' : ''}>
        {!commerceMode && <div className={`page-back ${pathname === '/' ? 'on-hero' : ''}`}><div className="container"><BackButton /></div></div>}
        <div key={pathname} className="route-transition">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/catalogo/:categoria" element={<Catalogo />} />
            <Route path="/producto/:slug" element={<Producto />} />
            <Route path="/carrito" element={<Carrito />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/pedido/:id/estado" element={<Seguimiento />} />
            <Route path="/pedido/:id" element={<Confirmacion />} />
            <Route path="/login" element={<Login />} />
            <Route path="/soporte" element={<Soporte />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/info/:slug" element={<Info />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </main>
      {!commerceMode && <Footer />}
      {!commerceMode && <HelpButton />}
      {!commerceMode && <CartNotice />}
    </>
  )
}

