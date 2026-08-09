/**
 * Testes Unitários — Módulo de Métricas Canônicas
 * Valida getStockStatus, getOpenTabs, getRevenue e cálculos de CMV/margem
 */

import {
  getStockStatus,
  contarEstoquesPorStatus,
  calcularTotalComanda,
  getOpenTabs,
  getRevenue,
  calcularCustoMedioPonderado,
  calcularMargemBruta,
  calcularCMV,
} from './metricas-kytto.js'

const assert = (condicao, mensagem) => {
  if (!condicao) throw new Error(`❌ FALHA: ${mensagem}`)
  console.log(`✅ ${mensagem}`)
}

console.log('\n🧪 TESTES — ESTOQUE\n')

// P0-2: Teste de getStockStatus
assert(
  getStockStatus({ qtd: 100, minimo: 0 }).status === 'OK',
  'Saldo 100 com mínimo 0 = OK'
)

assert(
  getStockStatus({ qtd: 0, minimo: 0 }).status === 'SEM_ESTOQUE',
  'Saldo 0 = SEM_ESTOQUE'
)

assert(
  getStockStatus({ qtd: 5, minimo: 10 }).status === 'BAIXO',
  'Saldo 5 com mínimo 10 = BAIXO'
)

assert(
  getStockStatus({ qtd: 10, minimo: 10 }).status === 'BAIXO',
  'Saldo igual ao mínimo = BAIXO'
)

assert(
  getStockStatus({ qtd: -5, minimo: 0 }).status === 'SEM_ESTOQUE',
  'Saldo negativo = SEM_ESTOQUE'
)

assert(
  getStockStatus({ qtd: 50, minimo: 0 }).status === 'OK',
  'Mínimo 0 não classifica como BAIXO mesmo com saldo baixo'
)

// Teste de agregação
const itens = [
  { id: 1, qtd: 100, minimo: 0, ativo: true },
  { id: 2, qtd: 5, minimo: 10, ativo: true },
  { id: 3, qtd: 0, minimo: 0, ativo: true },
  { id: 4, qtd: 50, minimo: 20, ativo: true },
]

const contagem = contarEstoquesPorStatus(itens)
assert(contagem.ok === 2, `Contagem OK: ${contagem.ok} (esperado 2)`)
assert(contagem.baixo === 1, `Contagem BAIXO: ${contagem.baixo} (esperado 1)`)
assert(contagem.semEstoque === 1, `Contagem SEM_ESTOQUE: ${contagem.semEstoque} (esperado 1)`)

console.log('\n🧪 TESTES — COMANDAS ABERTAS\n')

// P0-3: Teste de getOpenTabs
const comandas = [
  { id: 'cmd-1', status: 'aberta', itens: [{ preco: 50, qtd: 2 }] },
  { id: 'cmd-2', status: 'conta', itens: [{ preco: 30, qtd: 1 }] },
  { id: 'cmd-3', status: 'fechada', fechadaEm: '2026-08-09T10:00:00Z', itens: [{ preco: 100, qtd: 1 }] },
]

const openTabs = getOpenTabs(comandas)
assert(openTabs.quantidade === 2, `Comandas abertas: ${openTabs.quantidade} (esperado 2)`)
assert(openTabs.valorEmAberto === 130, `Valor em aberto: R$ ${openTabs.valorEmAberto} (esperado 130)`)

console.log('\n🧪 TESTES — FATURAMENTO\n')

// P1-6: Teste de getRevenue
const revenue = getRevenue(comandas, '2026-08-01', '2026-08-31')
assert(revenue.quantidade === 1, `Vendas fechadas: ${revenue.quantidade} (esperado 1)`)
assert(revenue.total === 100, `Faturamento: R$ ${revenue.total} (esperado 100)`)

console.log('\n🧪 TESTES — CMV E MARGEM\n')

// P1-4: Teste de custo médio ponderado
const cmp1 = calcularCustoMedioPonderado(100, 10, 50, 12)
assert(Math.abs(cmp1 - 10.67) < 0.01, `CMP após entrada: R$ ${cmp1} (esperado ~10.67)`)

const cmp2 = calcularCustoMedioPonderado(0, 0, 100, 8)
assert(cmp2 === 8, `CMP primeira entrada: R$ ${cmp2} (esperado 8)`)

// Teste de margem bruta
const margem1 = calcularMargemBruta(100, 60)
assert(margem1 === 40, `Margem (P=100, C=60): ${margem1}% (esperado 40%)`)

const margem2 = calcularMargemBruta(100, 0)
assert(margem2 === 100, `Margem (P=100, C=0): ${margem2}% (esperado 100%)`)

const margem3 = calcularMargemBruta(100, 100)
assert(margem3 === 0, `Margem (P=100, C=100): ${margem3}% (esperado 0%)`)

// Teste de CMV
const estoque = {
  'prod-1': { custoMedioPonderado: 10 },
  'prod-2': { custoMedioPonderado: 20 },
}

const vendasComCusto = [
  {
    id: 'cmd-1',
    status: 'fechada',
    itens: [
      { produtoId: 'prod-1', qtd: 5 },
      { produtoId: 'prod-2', qtd: 2 },
    ],
  },
]

const cmv = calcularCMV(vendasComCusto, estoque)
assert(cmv === 90, `CMV (5×10 + 2×20): R$ ${cmv} (esperado 90)`)

console.log('\n✨ TODOS OS TESTES PASSARAM!\n')
