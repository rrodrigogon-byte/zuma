import { createContext, useContext, useState } from 'react'
import { encerrarPushDoAparelho } from './push-equipe'

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
  const [empresaAtiva, setEmpresaAtiva] = useState(() => readStorage('sp_empresa_ativa'))
  const [empresasAcessiveis, setEmpresasAcessiveis] = useState(() => readStorage('sp_empresas_acessiveis', []))
  const [lojaAtiva, setLojaAtiva] = useState(() => readStorage('sp_loja_ativa'))
  const [lojasAcessiveis, setLojasAcessiveis] = useState(() => readStorage('sp_lojas_acessiveis', []))

  const login = (token, userData, site = false, sessao = {}) => {
    localStorage.setItem(site ? 'sp_site_token' : 'sp_token', token)
    localStorage.setItem('sp_user', JSON.stringify(userData))

    const empresas = Array.isArray(sessao.empresas_acessiveis) ? sessao.empresas_acessiveis : []
    const empresa = sessao.empresa || sessao.empresa_ativa || null
    const lojas = Array.isArray(sessao.lojas_acessiveis) ? sessao.lojas_acessiveis : []
    const loja = sessao.loja || sessao.loja_ativa || null
    if (empresas.length > 0) {
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(empresas))
      setEmpresasAcessiveis(empresas)
    } else {
      localStorage.removeItem('sp_empresas_acessiveis')
      localStorage.removeItem('sp_empresa_ativa')
      setEmpresasAcessiveis([])
      setEmpresaAtiva(null)
    }
    if (empresa) {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresa))
      setEmpresaAtiva(empresa)
    }
    if (lojas.length > 0) {
      localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(lojas))
      setLojasAcessiveis(lojas)
    } else {
      localStorage.removeItem('sp_lojas_acessiveis')
      localStorage.removeItem('sp_loja_ativa')
      setLojasAcessiveis([])
      setLojaAtiva(null)
    }
    if (loja) {
      localStorage.setItem('sp_loja_ativa', JSON.stringify(loja))
      setLojaAtiva(loja)
    }
    setUser(userData)
  }

  const trocarEmpresa = (empresaId) => {
    const proxima = empresasAcessiveis.find((empresa) => empresa.id === empresaId)
    if (!proxima) return false
    localStorage.setItem('sp_empresa_ativa', JSON.stringify(proxima))
    localStorage.removeItem('sp_loja_ativa')
    setEmpresaAtiva(proxima)
    setLojaAtiva(null)
    return true
  }

  const trocarLoja = (lojaId) => {
    if (!lojaId) {
      localStorage.removeItem('sp_loja_ativa')
      setLojaAtiva(null)
      return true
    }
    const proxima = lojasAcessiveis.find((loja) => loja.id === lojaId && loja.ativa !== false && (!empresaAtiva?.id || loja.empresaId === empresaAtiva.id))
    if (!proxima) return false
    localStorage.setItem('sp_loja_ativa', JSON.stringify(proxima))
    setLojaAtiva(proxima)
    return true
  }

  const atualizarContextoLojas = ({ empresa, empresas_acessiveis: empresas, loja, lojas_acessiveis: lojas }) => {
    if (Array.isArray(empresas)) {
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(empresas))
      setEmpresasAcessiveis(empresas)
    }
    if (empresa) {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresa))
      setEmpresaAtiva(empresa)
    }
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
    // App do barbeiro: desliga os avisos deste aparelho e apaga a agenda guardada para
    // uso sem internet. Lê a sessão antes de apagá-la (o cancelamento precisa dela).
    try {
      const empresa = JSON.parse(localStorage.getItem('sp_empresa_ativa') || 'null')
      const loja = JSON.parse(localStorage.getItem('sp_loja_ativa') || 'null')
      encerrarPushDoAparelho({ token: localStorage.getItem('sp_token') || '', empresaId: empresa?.id || '', lojaId: loja?.id || '' })
    } catch { /* sessão ilegível: segue o logout */ }
    try { navigator.serviceWorker?.controller?.postMessage({ tipo: 'limpar-dados' }) } catch { /* sem service worker */ }
    localStorage.removeItem('sp_token')
    localStorage.removeItem('sp_site_token')
    localStorage.removeItem('sp_user')
    localStorage.removeItem('sp_empresa_ativa')
    localStorage.removeItem('sp_empresas_acessiveis')
    localStorage.removeItem('sp_loja_ativa')
    localStorage.removeItem('sp_lojas_acessiveis')
    setUser(null)
    setEmpresaAtiva(null)
    setEmpresasAcessiveis([])
    setLojaAtiva(null)
    setLojasAcessiveis([])
  }

  const role = String(user?.role || '').trim().toLowerCase()
  const perfis = Array.isArray(user?.perfis) ? user.perfis.map((perfil) => String(perfil || '').trim().toLowerCase()) : []
  const roles = Array.isArray(user?.roles) ? user.roles.map((perfil) => String(perfil || '').trim().toLowerCase()) : []
  // Administrador de empresa e administrador da plataforma são papéis distintos.
  // Somente a flag explícita concedida pelo backend libera gestão global de tenants.
  const isPlatformAdmin = user?.platformAdmin === true
  const isAdmin = isPlatformAdmin || ['admin', 'administrador', 'super_admin'].includes(role)
  const isOrg = isAdmin || ['organizador', 'gerente', 'gerente_operacional'].includes(role)
  const isStaff = isOrg || ['staff', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'operador', 'operador_pdv', 'cozinha'].includes(role)
  const isAtleta = role === 'atleta'

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      empresaAtiva,
      empresasAcessiveis,
      trocarEmpresa,
      lojaAtiva,
      lojasAcessiveis,
      trocarLoja,
      atualizarContextoLojas,
      isAdmin,
      isPlatformAdmin,
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
