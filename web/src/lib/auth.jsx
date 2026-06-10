import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sp_user') || 'null') } catch { return null }
  })

  const login = (token, userData, site = false) => {
    localStorage.setItem(site ? 'sp_site_token' : 'sp_token', token)
    localStorage.setItem('sp_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('sp_token')
    localStorage.removeItem('sp_site_token')
    localStorage.removeItem('sp_user')
    setUser(null)
  }

  const isAdmin  = user?.role === 'admin'
  const isOrg    = ['admin','organizador'].includes(user?.role)
  const isStaff  = ['admin','organizador','staff'].includes(user?.role)
  const isAtleta = user?.role === 'atleta'

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isOrg, isStaff, isAtleta }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
