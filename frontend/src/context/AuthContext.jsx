import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  clearStoredToken,
  getCurrentUser,
  getStoredToken,
  loginUser,
  logoutUser,
  registerUser,
  storeToken,
} from '../services/auth.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authView, setAuthView] = useState(null)
  const openAccount = useCallback((view = 'login') => setAuthView(view), [])

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return undefined

    let cancelled = false
    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        if (!cancelled) setUser(currentUser)
      })
      .catch((error) => {
        if (error.status === 401) clearStoredToken()
        else console.error('No se pudo verificar la sesión:', error)
      })

    return () => { cancelled = true }
  }, [])

  const saveSession = ({ token, user: currentUser }) => {
    storeToken(token)
    setUser(currentUser)
    setAuthView(null)
    return true
  }

  const login = async (email, password) => {
    if (user) return 'Cierra la sesión actual antes de entrar en otra cuenta.'
    const session = await loginUser({ email, password })
    return saveSession(session)
  }

  const register = async ({ name, email, password, confirm }) => {
    if (user) return 'Ya tienes una sesión iniciada.'
    if (password !== confirm) return 'Las contraseñas no coinciden.'
    const session = await registerUser({ name, email, password })
    return saveSession(session)
  }

  const logout = async () => {
    const token = getStoredToken()
    clearStoredToken()
    setUser(null)
    setAuthView('login')
    if (token) {
      try {
        await logoutUser(token)
      } catch (error) {
        console.error('No se pudo invalidar la sesión en el servidor:', error)
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      authView,
      openAccount,
      closeAccount: () => setAuthView(null),
    }}>
      {children}
    </AuthContext.Provider>
  )
}
