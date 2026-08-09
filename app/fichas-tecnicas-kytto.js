// ============================================================================
// FICHAS TÉCNICAS KYTTO
// Produtos compostos com baixa automática, auditável e isolada por empresa.
// ============================================================================

import { db } from './db.js'

const agora = () => new Date().toISOString()
const numeroPositivo = (valor, campo) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`${campo} deve ser maior que zero.`)
  return numero
}

function storeEmpresa(empresaId) {
  const estado = db()
  estado.fichasTecnicasKytto ||= { empresas: {} }
  estado.fichasTecnicasKytto.empresas ||= {}
  const id = String(empresaId)
  estado.fichasTecnicasKytto.empresas[id] ||= { fichas: {}, sequencia: 0 }
  return estado.fichasTecnicasKytto.empresas[id]
}

function novoId(empresaId) {
  const store = storeEmpresa(empresaId)
  store.sequencia = Number(store.sequencia || 0) + 1
  return `ft-${Date.now().toString(36)}-${String(store.sequencia).padStart(4, '0')}`
}

function serializar(ficha) {
  return {
    ...ficha,
    itens: (ficha.itens || []).map(item => ({ ...item })),
  }
}

export function listarFichasTecnicas(empresaId) {
  return Object.values(storeEmpresa(empresaId).fichas)
    .filter(ficha => ficha.ativa !== false)
    .sort((a, b) => String(a.nomeProduto || '').localeCompare(String(b.nomeProduto || ''), 'pt-BR'))
    .map(serializar)
}

export function obterFichaPorProduto(empresaId, produtoFinalId) {
  const ficha = Object.values(storeEmpresa(empresaId).fichas)
    .find(item => item.ativa !== false && String(item.produtoFinalId) === String(produtoFinalId))
  return ficha ? serializar(ficha) : null
}

export function salvarFichaTecnica(empresaId, dados = {}, existenteId = null) {
  const produtoFinalId = String(dados.produtoFinalId || '').trim()
  const nomeProduto = String(dados.nomeProduto || '').trim().slice(0, 180)
  if (!produtoFinalId || !nomeProduto) throw new Error('Produto final e nome são obrigatórios.')

  const itens = (Array.isArray(dados.itens) ? dados.itens : [])
    .map((item) => ({
      produtoId: String(item?.produtoId || '').trim(),
      nome: String(item?.nome || '').trim().slice(0, 180),
      qtd: numeroPositivo(item?.qtd, 'Quantidade de insumo'),
      unidade: String(item?.unidade || 'UN').trim().slice(0, 20) || 'UN',
    }))
  if (!itens.length) throw new Error('Inclua pelo menos um insumo na ficha técnica.')
  if (itens.some(item => !item.produtoId || item.produtoId === produtoFinalId)) throw new Error('Cada insumo deve ser válido e diferente do produto final.')
  const ids = itens.map(item => item.produtoId)
  if (new Set(ids).size !== ids.length) throw new Error('Não repita o mesmo insumo na ficha técnica.')

  const store = storeEmpresa(empresaId)
  const existente = existenteId ? store.fichas[String(existenteId)] : null
  if (existenteId && !existente) throw new Error('Ficha técnica não encontrada.')
  const duplicada = Object.values(store.fichas).find(item => item.id !== existenteId && item.ativa !== false && String(item.produtoFinalId) === produtoFinalId)
  if (duplicada) throw new Error('Já existe uma ficha técnica ativa para este produto final.')

  const ficha = {
    id: existente?.id || novoId(empresaId),
    empresaId: String(empresaId),
    produtoFinalId,
    nomeProduto,
    rendimento: numeroPositivo(dados.rendimento ?? existente?.rendimento ?? 1, 'Rendimento'),
    baixarProdutoFinal: dados.baixarProdutoFinal === true,
    itens,
    ativa: dados.ativa !== false,
    observacao: String(dados.observacao || '').trim().slice(0, 600),
    criadoEm: existente?.criadoEm || agora(),
    atualizadoEm: agora(),
  }
  store.fichas[ficha.id] = ficha
  return serializar(ficha)
}

export function removerFichaTecnica(empresaId, fichaId) {
  const ficha = storeEmpresa(empresaId).fichas[String(fichaId)]
  if (!ficha) return false
  ficha.ativa = false
  ficha.atualizadoEm = agora()
  return true
}

export function custoFichaTecnica(empresaId, produtoFinalId, estoque = {}) {
  const ficha = obterFichaPorProduto(empresaId, produtoFinalId)
  if (!ficha) return null
  const custoInsumos = ficha.itens.reduce((total, item) => {
    const saldo = estoque[item.produtoId] || {}
    const custo = Number(saldo.custoMedioPonderado ?? saldo.custo ?? 0)
    return total + (custo * Number(item.qtd || 0))
  }, 0)
  return {
    fichaId: ficha.id,
    custoPorRendimento: Number((custoInsumos / Number(ficha.rendimento || 1)).toFixed(4)),
    custoInsumos: Number(custoInsumos.toFixed(4)),
  }
}

/**
 * Valida e efetiva a baixa de insumos. Deve ser chamada durante o lançamento
 * da comanda, no mesmo ciclo de persistência do estoque principal.
 */
export function baixarInsumosFichaTecnica(empresaId, produtoFinalId, quantidadeFinal, estoque = {}, { permitirEstoqueNegativo = false, comandaId = '', usuario = 'sistema' } = {}) {
  const ficha = obterFichaPorProduto(empresaId, produtoFinalId)
  if (!ficha) return { ficha: null, movimentacoes: [] }
  const quantidade = numeroPositivo(quantidadeFinal, 'Quantidade do produto final')
  const necessidades = ficha.itens.map((item) => ({
    ...item,
    quantidadeBaixa: Number((Number(item.qtd) * quantidade / Number(ficha.rendimento || 1)).toFixed(4)),
  }))

  for (const necessidade of necessidades) {
    const saldo = estoque[necessidade.produtoId]
    if (!saldo || saldo.ativo === false) throw new Error(`Insumo da ficha técnica não encontrado: ${necessidade.nome || necessidade.produtoId}.`)
    if (saldo.controlaEstoque === true && !permitirEstoqueNegativo && Number(saldo.qtd || 0) < necessidade.quantidadeBaixa) {
      throw new Error(`Estoque insuficiente do insumo ${necessidade.nome || saldo.nome}: disponível ${saldo.qtd || 0}, necessário ${necessidade.quantidadeBaixa}.`)
    }
  }

  const timestamp = agora()
  const movimentacoes = []
  for (const necessidade of necessidades) {
    const saldo = estoque[necessidade.produtoId]
    if (saldo.controlaEstoque !== true) continue
    const saldoAnterior = Number(saldo.qtd || 0)
    saldo.qtd = Number((saldoAnterior - necessidade.quantidadeBaixa).toFixed(4))
    saldo.historico ||= []
    saldo.historico.push({
      tipo: 'saida_ficha_tecnica',
      qtd: necessidade.quantidadeBaixa,
      saldoAnterior,
      saldoFinal: saldo.qtd,
      produtoFinalId: String(produtoFinalId),
      fichaTecnicaId: ficha.id,
      comandaId: String(comandaId || ''),
      usuario,
      ts: timestamp,
    })
    saldo.historico = saldo.historico.slice(-100)
    saldo.atualizadoEm = timestamp
    movimentacoes.push({ produtoId: necessidade.produtoId, nome: necessidade.nome || saldo.nome, qtd: necessidade.quantidadeBaixa, saldoFinal: saldo.qtd })
  }
  return { ficha, movimentacoes }
}

export default {
  listarFichasTecnicas,
  obterFichaPorProduto,
  salvarFichaTecnica,
  removerFichaTecnica,
  custoFichaTecnica,
  baixarInsumosFichaTecnica,
}
