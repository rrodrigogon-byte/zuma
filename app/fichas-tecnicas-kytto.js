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
  const store = estado.fichasTecnicasKytto.empresas[id]

  if (Object.keys(store.fichas).length === 0) {
    const f1 = {
      id: 'ficha-corte-degrade',
      empresaId: String(empresaId),
      produtoFinalId: 'serv-corte-masculino',
      nomeServico: 'Corte Degradê / Cabelo Masculino',
      categoria: 'Cabelo',
      precoServico: 50.00,
      rendimento: 1,
      observacao: 'Consumo padrão por atendimento de corte.',
      itens: [
        { produtoId: 'gola-higienica', nomeInsumo: 'Gola Higiênica Descartável', qtd: 1, custoUnitario: 0.35, custoTotal: 0.35 },
        { produtoId: 'pomada-matte', nomeInsumo: 'Pomada Matte Modeladora (5g)', qtd: 0.05, custoUnitario: 24.00, custoTotal: 1.20 },
        { produtoId: 'toalha-descartavel', nomeInsumo: 'Toalha Descartável Algodão', qtd: 1, custoUnitario: 0.40, custoTotal: 0.40 },
        { produtoId: 'locao-finalizadora', nomeInsumo: 'Loção Capilar Finalizadora (2ml)', qtd: 0.02, custoUnitario: 25.00, custoTotal: 0.50 }
      ],
      custoTotalInsumos: 2.45,
      margemContribuicao: 95.10,
      baixaAutomatica: true,
      criadoEm: new Date(Date.now() - 15 * 86400000).toISOString()
    };
    const f2 = {
      id: 'ficha-barboterapia',
      empresaId: String(empresaId),
      produtoFinalId: 'serv-barba-completa',
      nomeServico: 'Barba Completa / Barboterapia',
      categoria: 'Barba',
      precoServico: 45.00,
      rendimento: 1,
      observacao: 'Toalha quente com óleos essenciais e hidratação.',
      itens: [
        { produtoId: 'lamina-barbear', nomeInsumo: 'Lâmina de Barbear Descartável', qtd: 1, custoUnitario: 0.80, custoTotal: 0.80 },
        { produtoId: 'shaving-gel', nomeInsumo: 'Shaving Gel de Precisão (15ml)', qtd: 0.015, custoUnitario: 30.00, custoTotal: 1.50 },
        { produtoId: 'oleo-barba', nomeInsumo: 'Óleo Hidratante de Barba (3ml)', qtd: 0.003, custoUnitario: 60.00, custoTotal: 1.80 },
        { produtoId: 'balm-pos-barba', nomeInsumo: 'Balm Pós-Barba Refrescante (5ml)', qtd: 0.005, custoUnitario: 34.00, custoTotal: 1.70 }
      ],
      custoTotalInsumos: 5.80,
      margemContribuicao: 87.11,
      baixaAutomatica: true,
      criadoEm: new Date(Date.now() - 12 * 86400000).toISOString()
    };
    const f3 = {
      id: 'ficha-combo-cabelo-barba',
      empresaId: String(empresaId),
      produtoFinalId: 'serv-combo-cabelo-barba',
      nomeServico: 'Combo Cabelo + Barba Executivo',
      categoria: 'Combos',
      precoServico: 85.00,
      rendimento: 1,
      observacao: 'Kit completo de lâmina, shaving, toalhas e pomada.',
      itens: [
        { produtoId: 'lamina-barbear', nomeInsumo: 'Lâmina de Barbear Descartável', qtd: 1, custoUnitario: 0.80, custoTotal: 0.80 },
        { produtoId: 'shaving-gel', nomeInsumo: 'Shaving Gel de Precisão', qtd: 0.015, custoUnitario: 30.00, custoTotal: 1.50 },
        { produtoId: 'gola-higienica', nomeInsumo: 'Gola Higiênica Descartável', qtd: 1, custoUnitario: 0.35, custoTotal: 0.35 },
        { produtoId: 'pomada-matte', nomeInsumo: 'Pomada Matte Modeladora', qtd: 0.05, custoUnitario: 24.00, custoTotal: 1.20 },
        { produtoId: 'oleo-barba', nomeInsumo: 'Óleo Hidratante de Barba', qtd: 0.003, custoUnitario: 60.00, custoTotal: 1.80 }
      ],
      custoTotalInsumos: 5.65,
      margemContribuicao: 93.35,
      baixaAutomatica: true,
      criadoEm: new Date(Date.now() - 10 * 86400000).toISOString()
    };
    const f4 = {
      id: 'ficha-camuflagem-cabelo',
      empresaId: String(empresaId),
      produtoFinalId: 'serv-camuflagem',
      nomeServico: 'Camuflagem de Fios Brancos',
      categoria: 'Química',
      precoServico: 70.00,
      rendimento: 1,
      observacao: 'Aplicação rápida sem amônia.',
      itens: [
        { produtoId: 'tintura-castanho', nomeInsumo: 'Coloração Profissional (tubo 1/2)', qtd: 0.5, custoUnitario: 17.00, custoTotal: 8.50 },
        { produtoId: 'oxidante-revelador', nomeInsumo: 'Oxidante 10 Vol (30ml)', qtd: 0.03, custoUnitario: 20.00, custoTotal: 2.20 },
        { produtoId: 'luva-nitrilica', nomeInsumo: 'Par de Luvas de Nitrilo Descartáveis', qtd: 1, custoUnitario: 0.90, custoTotal: 0.90 }
      ],
      custoTotalInsumos: 11.60,
      margemContribuicao: 83.43,
      baixaAutomatica: true,
      criadoEm: new Date(Date.now() - 8 * 86400000).toISOString()
    };
    const f5 = {
      id: 'ficha-selagem-organica',
      empresaId: String(empresaId),
      produtoFinalId: 'serv-selagem',
      nomeServico: 'Selagem Térmica Orgânica',
      categoria: 'Tratamentos',
      precoServico: 150.00,
      rendimento: 1,
      observacao: 'Alinhamento com ácido hialurônico e queratina.',
      itens: [
        { produtoId: 'ativo-alisante', nomeInsumo: 'Ativo Alisante Orgânico (50ml)', qtd: 0.05, custoUnitario: 360.00, custoTotal: 18.00 },
        { produtoId: 'shampoo-antirresiduos', nomeInsumo: 'Shampoo Anti-resíduos (20ml)', qtd: 0.02, custoUnitario: 175.00, custoTotal: 3.50 },
        { produtoId: 'mascara-reconstrutora', nomeInsumo: 'Máscara Reconstrutora (25g)', qtd: 0.025, custoUnitario: 200.00, custoTotal: 5.00 }
      ],
      custoTotalInsumos: 26.50,
      margemContribuicao: 82.33,
      baixaAutomatica: true,
      criadoEm: new Date(Date.now() - 5 * 86400000).toISOString()
    };
    store.fichas[f1.id] = f1;
    store.fichas[f2.id] = f2;
    store.fichas[f3.id] = f3;
    store.fichas[f4.id] = f4;
    store.fichas[f5.id] = f5;
  }

  return store;
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
