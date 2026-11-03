import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  // Si hay token guardado, comprobamos que sigue siendo válido
  useEffect(() => {
    if (!getToken()) return
    api('/backoffice/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  // Si cualquier petición devuelve 401, cerramos sesión
  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('coreadmin:logout', onLogout)
    return () => window.removeEventListener('coreadmin:logout', onLogout)
  }, [])

  const login = async (email, password) => {
    const data = await api('/backoffice/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await api('/backoffice/auth/logout', { method: 'POST' })
    } catch {
      // aunque falle, cerramos sesión en el navegador
    }
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
