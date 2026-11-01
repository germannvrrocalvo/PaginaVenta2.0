const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const TOKEN_KEY = 'ucam_auth_token'

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}/auth${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || 'No se pudo completar la solicitud.')
  }
  return response.status === 204 ? null : response.json()
}

export const getStoredToken = () => sessionStorage.getItem(TOKEN_KEY)
export const storeToken = (token) => sessionStorage.setItem(TOKEN_KEY, token)
export const clearStoredToken = () => sessionStorage.removeItem(TOKEN_KEY)

export const registerUser = (credentials) => request('/register', {
  method: 'POST',
  body: JSON.stringify(credentials),
})

export const loginUser = (credentials) => request('/login', {
  method: 'POST',
  body: JSON.stringify(credentials),
})

export const getCurrentUser = (token) => request('/me', { token })

export const logoutUser = (token) => request('/logout', {
  method: 'POST',
  token,
})
