import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
export default function Login() {
 const { user, openAccount } = useAuth()
 useEffect(() => { openAccount() }, [openAccount])
 return <section className="section"><div className="container narrow panel"><h1 className="h-lg">{user ? 'Tu cuenta' : 'Bienvenido a UCAM Stereo'}</h1><p>Consulta tus pedidos y disfruta de tu música.</p><button className="btn btn-accent" onClick={() => openAccount()}>{user ? 'Abrir mi cuenta' : 'Iniciar sesión o registrarse'}</button></div></section>
}
