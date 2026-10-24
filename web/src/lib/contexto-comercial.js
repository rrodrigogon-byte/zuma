import { lojasDaEmpresa } from './context-selection.js'

// O contexto empresa/unidade guardado no navegador só é recebido no login. Versões
// anteriores do sync do E-commerce regravavam lojas sem empresaId, e as telas por
// unidade (WhatsApp, Desempenho etc.) deixavam de listar a unidade da empresa ativa.
// O servidor continua sendo a fonte da verdade: esta rotina relê as memberships
// autorizadas e corrige o vínculo sem exigir novo login.

const INTERVALO_MINIMO_MS = 60_000
let emAndamento = null
let ultimaSincronizacao = 0

// Mescla as lojas do servidor sobre as conhecidas: o servidor prevalece no vínculo
// com a empresa; lojas que só existem no navegador (ex.: vindas de um storefront)
// são preservadas como estão.
export function mesclarLojasDoServidor(existentes = [], doServidor = []) {
  const mapa = new Map((Array.isArray(existentes) ? existentes : []).filter((loja) => loja?.id).map((loja) => [String(loja.id), loja]))
  for (const loja of Array.isArray(doServidor) ? doServidor : []) {
    if (!loja?.id) continue
    const anterior = mapa.get(String(loja.id)) || {}
    mapa.set(String(loja.id), { ...anterior, ...loja, empresaId: loja.empresaId || anterior.empresaId, commerceEmpresaId: anterior.commerceEmpresaId || loja.commerceEmpresaId })
  }
  return [...mapa.values()]
}

export function empresaSemUnidade(lojas = [], empresaId = '') {
  return Boolean(empresaId) && lojasDaEmpresa(lojas, empresaId).length === 0
}

export function sincronizarContextoComercial({ lojasAcessiveis = [], atualizarContextoLojas, forcar = false, cliente } = {}) {
  // O cliente HTTP é injetado (api do painel) para manter este módulo testável em Node.
  if (typeof atualizarContextoLojas !== 'function' || typeof cliente?.get !== 'function') return Promise.resolve(null)
  if (emAndamento) return emAndamento
  if (!forcar && Date.now() - ultimaSincronizacao < INTERVALO_MINIMO_MS) return Promise.resolve(null)
  emAndamento = Promise.resolve()
    .then(() => cliente.get('/api/admin/commerce-session'))
    .then((sessao) => {
      ultimaSincronizacao = Date.now()
      const lojas = Array.isArray(sessao?.lojas_acessiveis) ? sessao.lojas_acessiveis : []
      if (!lojas.length) return sessao || null
      const empresas = Array.isArray(sessao?.empresas_acessiveis) && sessao.empresas_acessiveis.length ? sessao.empresas_acessiveis : undefined
      atualizarContextoLojas({ ...(empresas ? { empresas_acessiveis: empresas } : {}), lojas_acessiveis: mesclarLojasDoServidor(lojasAcessiveis, lojas) })
      return sessao
    })
    .catch(() => null)
    .finally(() => { emAndamento = null })
  return emAndamento
}

export function reiniciarSincronizacaoContexto() {
  emAndamento = null
  ultimaSincronizacao = 0
}
