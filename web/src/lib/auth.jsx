import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { encerrarPushDoAparelho } from './push-equipe'
import { esquecerRazaoAtivo } from './razao-estado'
import { empresaDaLoja, mesclarLojas, normalizarLojas, pertenceAEmpresa, repararLojasSemEmpresa, selecionarLojaAutomatica, substituirLojas } from './context-selection'
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
  const user = readStorage('sp_user')
  const base = empresasComFallbackDino(readStorage('sp_empresas_acessiveis', []))
  return filtrarEmpresasPorUsuario(base, user)
}

function filtrarEmpresasPorUsuario(empresas, user) {
  const lista = Array.isArray(empresas) ? empresas : []
  if (!user) return lista

  const ident = String(user.email || user.username || user.login || '').trim().toLowerCase()
  const isPlatformAdmin = user.platformAdmin === true && (
    ident.includes('rodrigo.goncalves') || ident.includes('rrodrigogon') || ident === 'admin'
  )
  if (isPlatformAdmin) return lista

  const isSilvester = ident.includes('silvest') || ident.includes('stallone')
  if (isSilvester) {
    const stalloneOnly = lista.filter((e) => {
      const nome = String(e.nome || e.razaoSocial || '').toLowerCase()
      const id = String(e.id || '').toLowerCase()
      return nome.includes('stallone') || nome.includes('agro open') ||
             id === '31f70c83-9172-40c2-945f-9e793b5048be' || id === 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e' ||
             id === '2e041110-db20-4fd1-8278-12bd3dead008'
    })
    return stalloneOnly.length > 0 ? stalloneOnly : [
      { id: '31f70c83-9172-40c2-945f-9e793b5048be', nome: 'Stallone Nutre Sport', cnpj: '56.099.531/0001-38', brandKey: 'stallone', tipoNegocio: 'loja', ativa: true },
      { id: '2e041110-db20-4fd1-8278-12bd3dead008', nome: 'AGRO OPEN TTC', cnpj: '43.084.070/0001-88', brandKey: 'agroopen', tipoNegocio: 'bar', ativa: true }
    ]
  }

  const isDino = ident.includes('dino') || ident.includes('guicunha') ||
    ['bruno', 'natani', 'nati', 'ester', 'david', 'joao', 'amanda', 'jhenyffer'].includes(String(user.username || '').toLowerCase())
  if (isDino) {
    const dinoOnly = lista.filter((e) => {
      const nome = String(e.nome || e.razaoSocial || '').toLowerCase()
      const id = String(e.id || '').toLowerCase()
      return nome.includes('dino') || id === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || id === 'emp-kytto-001'
    })
    return dinoOnly.length > 0 ? dinoOnly : [DINO_COMPANY]
  }

  if (user.empresaId) {
    const doUsuario = lista.filter((e) => String(e.id || '').toLowerCase() === String(user.empresaId).toLowerCase())
    if (doUsuario.length > 0) return doUsuario
  }

  return lista
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

// Última unidade escolhida em cada empresa: ao voltar para a empresa, ela volta junto.
function lembrarLoja(empresaId, loja) {
  if (!empresaId) return
  try {
    const mapa = readStorage('sp_loja_por_empresa', {}) || {}
    if (loja?.id) mapa[empresaId] = loja.id; else delete mapa[empresaId]
    localStorage.setItem('sp_loja_por_empresa', JSON.stringify(mapa))
  } catch { /* armazenamento indisponível: só não lembra */ }
}
const lojaLembrada = (empresaId) => { try { return (readStorage('sp_loja_por_empresa', {}) || {})[empresaId] || null } catch { return null } }

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
  // A lista vale para a empresa e a unidade em que foi pedida (as telas mandam as mesmas no
  // cabeçalho); trocou o contexto, volta a "carregando" já no mesmo render.
  const consultaPermissoes = (u, empresa) => Boolean(u && u.platformAdmin !== true && empresa?.id && typeof fetch === 'function')
  const chaveDoContexto = `${empresaAtiva?.id || ''}:${lojaAtiva?.id || ''}`
  const [consultaFeita, setConsultaFeita] = useState({ chave: null, lista: null, ocultos: [] })
  useEffect(() => {
    const token = (() => { try { return localStorage.getItem('sp_token') || '' } catch { return '' } })()
    if (!consultaPermissoes(user, empresaAtiva) || !token) { setConsultaFeita({ chave: chaveDoContexto, lista: null, ocultos: [] }); return undefined }
    let vivo = true
    const fim = (lista, ocultos = []) => { if (vivo) setConsultaFeita({ chave: chaveDoContexto, lista, ocultos }) }
    // rede travada não pode prender as telas em "Carregando…": sem resposta em 8 s, nada é escondido
    const controle = typeof AbortController === 'function' ? new AbortController() : null
    const limite = setTimeout(() => { controle?.abort(); fim(null) }, 8000)
    fetch('/api/admin/minhas-permissoes', { signal: controle?.signal, headers: { Authorization: `Bearer ${token}`, 'X-Empresa-Id': empresaAtiva.id, ...(lojaAtiva?.id ? { 'X-Loja-Id': lojaAtiva.id } : {}) } })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => fim(dados?.aplicavel === true && Array.isArray(dados.permissoes) ? dados.permissoes : null, Array.isArray(dados?.modulosOcultos) ? dados.modulosOcultos : []))
      .catch(() => fim(null) /* sem rede: não esconde nada */)
      .finally(() => clearTimeout(limite))
    return () => { vivo = false; clearTimeout(limite); controle?.abort() }
  }, [user, chaveDoContexto])
  const permissoes = !consultaPermissoes(user, empresaAtiva) ? null : consultaFeita.chave === chaveDoContexto ? consultaFeita.lista : undefined
  const modulosOcultos = consultaPermissoes(user, empresaAtiva) && consultaFeita.chave === chaveDoContexto ? consultaFeita.ocultos : []

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
    // a unidade escolhida da última vez nesta empresa volta; no host da Dino vale a unidade Dino
    const lembrada = lojaLembrada(proxima.id)
    const proximaLoja = selecionarLojaDoContexto(lojasAcessiveis, proxima, lembrada ? { id: lembrada } : null)
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
      lembrarLoja(empresaAtiva?.id, null)
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
    lembrarLoja(empresaAtiva?.id || empresaDaLoja(proxima), proxima)
    localStorage.setItem('sp_loja_ativa', JSON.stringify(proxima))
    setLojaAtiva(proxima)
    return true
  }

  // `substituir`: true = a lista é a completa da sessão; '<empresaId>' = completa só dessa empresa;
  // ausente = complemento parcial (ex.: lojas das vitrines do e-commerce), que só acrescenta.
  const atualizarContextoLojas = ({ empresa, empresas_acessiveis: empresas, loja, lojas_acessiveis: lojas, substituir = false }) => {
    const empresasAtualizadas = Array.isArray(empresas) ? filtrarEmpresasPorUsuario(empresasComFallbackDino(empresas), user) : null
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
    esquecerRazaoAtivo()
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
    localStorage.removeItem('sp_loja_por_empresa')
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
  const userIdent = String(user?.email || user?.username || user?.login || '').trim().toLowerCase()
  const isPlatformAdmin = user?.platformAdmin === true && (
    userIdent.includes('rodrigo.goncalves') || userIdent.includes('rrodrigogon') || userIdent === 'admin'
  )
  const isAdmin = isPlatformAdmin || ['admin', 'administrador', 'super_admin'].includes(role)
  // Perfis de toda empresa: admin (tudo), operador (operação do dia, sem comissões nem números da
  // empresa) e profissional (só o app do profissional). O servidor é quem garante; aqui só a interface.
  const perfil = perfilDaSessao(user)
  const isOrg = isAdmin || ['organizador', 'gerente', 'gerente_operacional', 'operador'].includes(role)
  const isStaff = isOrg || ['staff', 'vendedor', 'garcom', 'barbeiro', 'caixa', 'operador_pdv', 'cozinha'].includes(role)
  const isAtleta = role === 'atleta'

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      empresaAtiva,
      empresasAcessiveis: filtrarEmpresasPorUsuario(empresasAcessiveis, user),
      trocarEmpresa,
      lojaAtiva,
      lojasAcessiveis,
      trocarLoja,
      atualizarContextoLojas,
      permissoes,
      modulosOcultos,
      isAdmin,
      isPlatformAdmin,
      isOrg,
      isStaff,
      isAtleta,
      perfil,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

/** 'admin' | 'operador' | 'profissional' | null (perfil antigo ou especializado, segue a regra de antes). */
export function perfilDaSessao(user) {
  if (!user) return null
  if (user.platformAdmin === true) return 'admin'
  const role = String(user.role || '').trim().toLowerCase()
  if (['admin', 'administrador', 'super_admin', 'organizador', 'gerente', 'gerente_operacional'].includes(role)) return 'admin'
  if (role === 'operador') return 'operador'
  if (role === 'profissional') return 'profissional'
  return null
}

export function useAuth() {
  return useContext(AuthContext)
}
