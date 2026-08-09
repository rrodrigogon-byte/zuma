import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback
  } catch {
    return fallback
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStorage('sp_user'))
  const [lojaAtiva, setLojaAtiva] = useState(() => readStorage('sp_loja_ativa'))
  const [lojasAcessiveis, setLojasAcessiveis] = useState(() => readStorage('sp_lojas_acessiveis', []))

  const login = (token, userData, site = false, sessao = {}) => {
    localStorage.setItem(site ? 'sp_site_token' : 'sp_token', token)
    localStorage.setItem('sp_user', JSON.stringify(userData))

    const lojas = Array.isArray(sessao.lojas_acessiveis) ? sessao.lojas_acessiveis : []
    const loja = sessao.loja || sessao.loja_ativa || null
    if (lojas.length > 0) {
      localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(lojas))
      setLojasAcessiveis(lojas)
    }
    if (loja) {
      localStorage.setItem('sp_loja_ativa', JSON.stringify(loja))
      setLojaAtiva(loja)
    }
    setUser(userData)
  }

  const trocarLoja = (lojaId) => {
    const proxima = lojasAcessiveis.find((loja) => loja.id === lojaId && loja.ativa !== false)
    if (!proxima) return false
    localStorage.setItem('sp_loja_ativa', JSON.stringify(proxima))
    setLojaAtiva(proxima)
    return true
  }

  const atualizarContextoLojas = ({ loja, lojas_acessiveis: lojas }) => {
    if (Array.isArray(lojas)) {
      localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(lojas))
      setLojasAcessiveis(lojas)
    }
    if (loja) {
      localStorage.setItem('sp_loja_ativa', JSON.stringify(loja))
      setLojaAtiva(loja)
    }
  }

  const logout = () => {
    localStorage.removeItem('sp_token')
    localStorage.removeItem('sp_site_token')
    localStorage.removeItem('sp_user')
    localStorage.removeItem('sp_loja_ativa')
    localStorage.removeItem('sp_lojas_acessiveis')
    setUser(null)
    setLojaAtiva(null)
    setLojasAcessiveis([])
  }

  const role = user?.role?.toLowerCase?.()
  const isAdmin = role === 'admin'
  const isOrg = ['admin', 'organizador', 'gerente'].includes(role)
  const isStaff = ['admin', 'organizador', 'staff', 'gerente', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'operador'].includes(role)
  const isAtleta = role === 'atleta'

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      lojaAtiva,
      lojasAcessiveis,
      trocarLoja,
      atualizarContextoLojas,
      isAdmin,
      isOrg,
      isStaff,
      isAtleta,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
