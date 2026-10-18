import { createContext, useContext, useState } from 'react'
import { encerrarPushDoAparelho } from './push-equipe'
import { selecionarLojaAutomatica } from './context-selection'

const AuthContext = createContext(null)

function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback
  } catch {
    return fallback
  }
}

function readLojaAtivaInicial() {
  const empresa = readStorage('sp_empresa_ativa')
  const lojas = readStorage('sp_lojas_acessiveis', [])
  const atual = readStorage('sp_loja_ativa')
  const selecionada = empresa?.id ? selecionarLojaAutomatica(lojas, empresa.id, atual) : null
  try {
    if (selecionada?.id && selecionada.id !== atual?.id) localStorage.setItem('sp_loja_ativa', JSON.stringify(selecionada))
    if (!selecionada && atual?.id) localStorage.removeItem('sp_loja_ativa')
  } catch { /* armazenamento pode estar indisponível durante a hidratação */ }
  return selecionada
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStorage('sp_user'))
  const [empresaAtiva, setEmpresaAtiva] = useState(() => readStorage('sp_empresa_ativa'))
  const [empresasAcessiveis, setEmpresasAcessiveis] = useState(() => readStorage('sp_empresas_acessiveis', []))
  const [lojaAtiva, setLojaAtiva] = useState(readLojaAtivaInicial)
  const [lojasAcessiveis, setLojasAcessiveis] = useState(() => readStorage('sp_lojas_acessiveis', []))

  const desligarPushContextoAtual = () => {
    try {
      const token = localStorage.getItem('sp_token') || ''
      // Não espera a rede para trocar a tela; a função cancela o registro
      // contextual no servidor e sempre remove a assinatura local.
      encerrarPushDoAparelho({ token, empresaId: empresaAtiva?.id || '', lojaId: lojaAtiva?.id || '' })
      navigator.serviceWorker?.controller?.postMessage({ tipo: 'limpar-dados' })
    } catch { /* troca de contexto não pode bloquear a navegação */ }
  }

  const login = (token, userData, site = false, sessao = {}) => {
    const identidadeAnterior = String(user?.id || user?.email || '')
    const identidadeNova = String(userData?.id || userData?.email || '')
    const empresaNova = sessao.empresa || sessao.empresa_ativa || null
    const lojaNova = sessao.loja || sessao.loja_ativa || null
    if (identidadeAnterior && (identidadeAnterior !== identidadeNova || empresaAtiva?.id !== empresaNova?.id || lojaAtiva?.id !== lojaNova?.id)) desligarPushContextoAtual()
    localStorage.setItem(site ? 'sp_site_token' : 'sp_token', token)
    localStorage.setItem('sp_user', JSON.stringify(userData))
    const empresas = Array.isArray(sessao.empresas_acessiveis) ? sessao.empresas_acessiveis : []
    const empresa = empresaNova
    const lojas = Array.isArray(sessao.lojas_acessiveis) ? sessao.lojas_acessiveis : []
    const loja = selecionarLojaAutomatica(lojas, empresa?.id, lojaNova)
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
    } else if (lojas.length > 0) {
      localStorage.removeItem('sp_loja_ativa')
      setLojaAtiva(null)
    }
    setUser(userData)
  }

  const trocarEmpresa = (empresaId) => {
    const proxima = empresasAcessiveis.find((empresa) => empresa.id === empresaId)
    if (!proxima) return false
    if (empresaAtiva?.id !== proxima.id || lojaAtiva?.id) desligarPushContextoAtual()
    const proximaLoja = selecionarLojaAutomatica(lojasAcessiveis, proxima.id)
    localStorage.setItem('sp_empresa_ativa', JSON.stringify(proxima))
    if (proximaLoja) localStorage.setItem('sp_loja_ativa', JSON.stringify(proximaLoja))
    else localStorage.removeItem('sp_loja_ativa')
    setEmpresaAtiva(proxima)
    setLojaAtiva(proximaLoja)
    return true
  }

  const trocarLoja = (lojaId) => {
    if (!lojaId) {
      if (lojaAtiva?.id) desligarPushContextoAtual()
      localStorage.removeItem('sp_loja_ativa')
      setLojaAtiva(null)
      return true
    }
    const proxima = lojasAcessiveis.find((loja) => loja.id === lojaId && loja.ativa !== false && (!empresaAtiva?.id || loja.empresaId === empresaAtiva.id))
    if (!proxima) return false
    if (lojaAtiva?.id !== proxima.id) desligarPushContextoAtual()
    localStorage.setItem('sp_loja_ativa', JSON.stringify(proxima))
    setLojaAtiva(proxima)
    return true
  }

  const atualizarContextoLojas = ({ empresa, empresas_acessiveis: empresas, loja, lojas_acessiveis: lojas }) => {
    if (Array.isArray(empresas)) {
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(empresas))
      setEmpresasAcessiveis(empresas)
    }
    const empresaAtualizada = empresa || empresaAtiva
    if (empresa) {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresa))
      setEmpresaAtiva(empresa)
    }
    if (Array.isArray(lojas)) {
      localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(lojas))
      setLojasAcessiveis(lojas)
      const selecionada = selecionarLojaAutomatica(lojas, empresaAtualizada?.id, loja || lojaAtiva)
      if (selecionada) {
        localStorage.setItem('sp_loja_ativa', JSON.stringify(selecionada))
        setLojaAtiva(selecionada)
      } else if (!loja) {
        localStorage.removeItem('sp_loja_ativa')
        setLojaAtiva(null)
      }
    } else if (loja) {
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
