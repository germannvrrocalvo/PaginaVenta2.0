// Cliente HTTP de CoreAdmin. En desarrollo usa el proxy de Vite;
// en producción, VITE_API_URL apunta a la API desplegada.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const TOKEN_KEY = 'coreadmin_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // sin almacenamiento disponible: la sesión dura lo que la pestaña
  }
}

export class ApiError extends Error {
  constructor(status, message, errores) {
    super(message)
    this.status = status
    this.errores = errores
  }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const token = getToken()
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return null

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  // Sesión caducada: avisamos a la app para que vuelva al login
  if (response.status === 401 && auth) {
    setToken(null)
    window.dispatchEvent(new Event('coreadmin:logout'))
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.error || `Error ${response.status}`, data?.errores)
  }
  return data
}