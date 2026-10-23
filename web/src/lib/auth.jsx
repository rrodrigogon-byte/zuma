import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { encerrarPushDoAparelho } from './push-equipe'
import { mesclarLojas, normalizarLojas, pertenceAEmpresa, repararLojasSemEmpresa, selecionarLojaAutomatica, substituirLojas } from './context-selection'
import { DINO_COMPANY, DINO_STORE, isDinoDedicatedHost } from './dino-scope'
import { isDinoBrandContext } from './brand'

const AuthContext = createContext(null)

function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback
  } catch {
    return fallback
  }
}

function readEmpresaAtivaInicial() {
  const atual = readStorage('sp_empresa_ativa')
  if (!isDinoDedicatedHost()) return atual
  const empresas = empresasComFallbackDino(readStorage('sp_empresas_acessiveis', []))
  const dino = Array.isArray(empresas) ? empresas.find((empresa) => isDinoBrandContext(empresa)) : null
  const empresaAtiva = dino || DINO_COMPANY
  try { localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresaAtiva)) } catch { /* armazenamento opcional */ }
  return empresaAtiva
}

function readEmpresasAcessiveisInicial() {
  return empresasComFallbackDino(readStorage('sp_empresas_acessiveis', []))
}

function empresasComFallbackDino(empresas) {
  const lista = Array.isArray(empresas) ? empresas : []
  if (!isDinoDedicatedHost() || lista.some((empresa) => isDinoBrandContext(empresa))) return lista
  return [...lista, DINO_COMPANY]
}

function lojasComFallbackDino(lojas) {
  // Entradas antigas da loja Dino gravadas sem vínculo de empresa são reparadas aqui.
  const lista = repararLojasSemEmpresa(Array.isArray(lojas) ? lojas : [], [DINO_STORE])
  if (!isDinoDedicatedHost() || lista.some((loja) => String(loja?.id || '') === DINO_STORE.id)) return lista
  return [...lista, DINO_STORE]
}

function selecionarLojaDoContexto(lojas, empresa, atual = null) {
  const selecionada = selecionarLojaAutomatica(lojas, empresa?.id, atual)
  if (selecionada || !isDinoDedicatedHost() || !isDinoBrandContext(empresa)) return selecionada
  return lojas.find((loja) => String(loja?.id || '') === DINO_STORE.id) || null
}

function readLojaAtivaInicial() {
  const empresa = readEmpresaAtivaInicial()
  const lojasArmazenadas = normalizarLojas(readStorage('sp_lojas_acessiveis', []))
  const lojas = lojasComFallbackDino(lojasArmazenadas)
  const atual = readStorage('sp_loja_ativa')
  const selecionada = empresa?.id ? selecionarLojaDoContexto(lojas, empresa, atual) : null
  try {
    if (isDinoDedicatedHost() && lojas.length > 0) localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(lojas))
    if (selecionada?.id && selecionada.id !== atual?.id) localStorage.setItem('sp_loja_ativa', JSON.stringify(selecionada))
    if (!selecionada && atual?.id) localStorage.removeItem('sp_loja_ativa')
  } catch { /* armazenamento pode estar indisponível durante a hidratação */ }
  return selecionada
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStorage('sp_user'))
  const [empresaAtiva, setEmpresaAtiva] = useState(readEmpresaAtivaInicial)
  const [empresasAcessiveis, setEmpresasAcessiveis] = useState(readEmpresasAcessiveisInicial)
  const [lojaAtiva, setLojaAtiva] = useState(readLojaAtivaInicial)
  const [lojasAcessiveis, setLojasAcessiveis] = useState(() => {
    return lojasComFallbackDino(normalizarLojas(readStorage('sp_lojas_acessiveis', [])))
  })
  const lojasAcessiveisRef = useRef(lojasAcessiveis)
  useEffect(() => { lojasAcessiveisRef.current = lojasAcessiveis }, [lojasAcessiveis])

  // Ao abrir o painel, relê empresas e unidades do servidor. Repara listas antigas gravadas
  // no navegador sem o vínculo da unidade com a empresa (o que deixava o Financeiro sem unidade).
  const contextoAtualizado = useRef(false)
  useEffect(() => {
    if (!user || contextoAtualizado.current || typeof fetch !== 'function') return
    const token = (() => { try { return localStorage.getItem('sp_token') || '' } catch { return '' } })()
    if (!token) return
    contextoAtualizado.current = true
    fetch('/api/admin/commerce-session', { headers: { Authorization: `Bearer ${token}` } })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((sessao) => {
        if (!sessao || !Array.isArray(sessao.lojas_acessiveis) || sessao.lojas_acessiveis.length === 0) return
        const empresas = Array.isArray(sessao.empresas_acessiveis) && sessao.empresas_acessiveis.length ? sessao.empresas_acessiveis : undefined
        atualizarContextoLojasRef.current?.({ lojas_acessiveis: sessao.lojas_acessiveis, empresas_acessiveis: empresas, substituir: true })
      })
      .catch(() => { /* sem rede ou sem Commerce: mantém o contexto salvo */ })
  }, [user])

  // Permissões da pessoa na empresa ativa (menu e telas do backoffice escondem o que ela não
  // acessa). undefined = carregando; null = não se aplica (ou falhou): nada é escondido e a API
  // decide; lista = o que a pessoa pode.
  const consultaPermissoes = (u, empresa) => Boolean(u && u.platformAdmin !== true && empresa?.id && typeof fetch === 'function')
  const [permissoes, setPermissoes] = useState(() => (consultaPermissoes(user, empresaAtiva) ? undefined : null))
  useEffect(() => {
    const token = (() => { try { return localStorage.getItem('sp_token') || '' } catch { return '' } })()
    if (!consultaPermissoes(user, empresaAtiva) || !token) { setPermissoes(null); return undefined }
    setPermissoes(undefined)
    let vivo = true
    fetch('/api/admin/minhas-permissoes', { headers: { Authorization: `Bearer ${token}`, 'X-Empresa-Id': empresaAtiva.id } })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => { if (vivo) setPermissoes(dados?.aplicavel === true && Array.isArray(dados.permissoes) ? dados.permissoes : null) })
      .catch(() => { if (vivo) setPermissoes(null) /* sem rede: não esconde nada */ })
    return () => { vivo = false }
  }, [user, empresaAtiva?.id])

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
    const empresasRecebidas = Array.isArray(sessao.empresas_acessiveis) ? sessao.empresas_acessiveis : []
    const empresas = empresasComFallbackDino(empresasRecebidas)
    const empresa = isDinoDedicatedHost()
      ? (empresas.find((item) => isDinoBrandContext(item)) || DINO_COMPANY)
      : empresaNova
    const lojasRecebidas = normalizarLojas(Array.isArray(sessao.lojas_acessiveis) ? sessao.lojas_acessiveis : [])
    const lojas = lojasComFallbackDino(lojasRecebidas)
    const loja = selecionarLojaDoContexto(lojas, empresa, lojaNova)
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
    const proximaLoja = selecionarLojaDoContexto(lojasAcessiveis, proxima)
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
    const proxima = lojasAcessiveis.find((loja) => loja.id === lojaId && loja.ativa !== false && (
      !empresaAtiva?.id
      || pertenceAEmpresa(loja, empresaAtiva.id)
      || (isDinoDedicatedHost() && isDinoBrandContext(empresaAtiva) && loja.id === DINO_STORE.id)
    ))
    if (!proxima) return false
    if (lojaAtiva?.id !== proxima.id) desligarPushContextoAtual()
    localStorage.setItem('sp_loja_ativa', JSON.stringify(proxima))
    setLojaAtiva(proxima)
    return true
  }

  // `substituir`: true = a lista é a completa da sessão; '<empresaId>' = completa só dessa empresa;
  // ausente = complemento parcial (ex.: lojas das vitrines do e-commerce), que só acrescenta.
  const atualizarContextoLojas = ({ empresa, empresas_acessiveis: empresas, loja, lojas_acessiveis: lojas, substituir = false }) => {
    const empresasAtualizadas = Array.isArray(empresas) ? empresasComFallbackDino(empresas) : null
    const empresaRecebida = empresa || empresaAtiva
    const empresaAtualizada = isDinoDedicatedHost()
      ? (empresasAtualizadas?.find((item) => isDinoBrandContext(item)) || (isDinoBrandContext(empresaRecebida) ? empresaRecebida : DINO_COMPANY))
      : empresaRecebida
    if (empresasAtualizadas) {
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify(empresasAtualizadas))
      setEmpresasAcessiveis(empresasAtualizadas)
    }
    if (empresa || isDinoDedicatedHost()) {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresaAtualizada))
      setEmpresaAtiva(empresaAtualizada)
    }
    if (Array.isArray(lojas)) {
      // mescla em vez de substituir: quem chama pode mandar lojas sem empresaId (ex.: vitrines)
      const mescladas = substituir
        ? substituirLojas(lojasAcessiveisRef.current, lojas, { empresaId: substituir === true ? null : substituir })
        : mesclarLojas(lojasAcessiveisRef.current, lojas)
      const lojasAtualizadas = lojasComFallbackDino(mescladas)
      localStorage.setItem('sp_lojas_acessiveis', JSON.stringify(lojasAtualizadas))
      setLojasAcessiveis(lojasAtualizadas)
      const selecionada = selecionarLojaDoContexto(lojasAtualizadas, empresaAtualizada, loja || lojaAtiva)
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

  const atualizarContextoLojasRef = useRef(null)
  atualizarContextoLojasRef.current = atualizarContextoLojas

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
    contextoAtualizado.current = false
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
      permissoes,
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
