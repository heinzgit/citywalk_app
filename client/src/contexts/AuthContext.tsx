import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, removeToken } from '../api'

interface User {
  id: string
  username: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    api.get<{ user: User }>('/api/auth/me')
      .then(data => setUser(data.user))
      .catch(() => removeToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const data = await api.post<{ token: string; user: User }>('/api/auth/login', { username, password })
    setToken(data.token)
    setUser(data.user)
  }

  async function register(username: string, password: string) {
    const data = await api.post<{ token: string; user: User }>('/api/auth/register', { username, password })
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    removeToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token: getToken(), loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
