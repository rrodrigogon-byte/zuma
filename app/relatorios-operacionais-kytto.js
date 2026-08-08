import { db } from './db.js'
import * as clientesKytto from './clientes-contas-kytto.js'
import { pagamentosPix } from './pagamentos-pix-kytto.js'

const money = (value) => Math.round((Number(value) || 0) * 100) / 100
const isoDay = (value) => String(value || '').slice(0, 10)

function periodoPadrao() {
  const fim = new Date()
  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - 29)
  inicio.setHours(0, 0, 0, 0)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function resolvePeriodo(raw = {}) {
  const fallback = periodoPadrao()
  const inicio = raw.dataInicio && !Number.isNaN(new Date(raw.dataInicio).valueOf()) ? new Date(raw.dataInicio).toISOString() : fallback.inicio
  const fim = raw.dataFim && !Number.isNaN(new Date(raw.dataFim).valueOf()) ? new Date(raw.dataFim).toISOString() : fallback.fim
  return { inicio, fim }
}

function inPeriod(value, periodo) {
  const timestamp = new Date(value).valueOf()
  return Number.isFinite(timestamp) && timestamp >= new Date(periodo.inicio).valueOf() && timestamp <= new Date(periodo.fim).valueOf()
}

export function gerarRelatorioOperacional(empresaId, filtros = {}) {
  const periodo = resolvePeriodo(filtros)
  const state = db()
  const transacoes = pagamentosPix.listarTransacoes(empresaId, periodo)
  const aprovadas = transacoes.filter((item) => item.status === 'aprovado')
  const pendentes = transacoes.filter((item) => item.status === 'pendente')
  const porMetodo = { pix: 0, cartao: 0, mercadopago: 0, outros: 0 }
  for (const transacao of aprovadas) {
    const chave = Object.hasOwn(porMetodo, transacao.metodo) ? transacao.metodo : 'outros'
    porMetodo[chave] += money(transacao.valor)
  }

  const estoque = Object.values(state.estoquePorEmpresa?.[empresaId] || {})
  const cardapio = state.cardapioPorEmpresa?.[empresaId] || []
  const estoqueBaixo = estoque
    .filter((item) => Number(item.quantidade ?? item.saldo ?? 0) <= Number(item.estoqueMinimo ?? item.minimo ?? 0))
    .map((item) => ({ produtoId: item.produtoId || item.id, nome: item.nome || item.produtoNome || 'Produto sem nome', quantidade: Number(item.quantidade ?? item.saldo ?? 0), minimo: Number(item.estoqueMinimo ?? item.minimo ?? 0) }))
  const semEstoque = estoque.filter((item) => Number(item.quantidade ?? item.saldo ?? 0) <= 0).length

  const contas = clientesKytto.listarContasReceber(empresaId)
  const abertas = contas.filter((item) => item.status !== 'paga')
  const atraso = abertas.filter((item) => item.status === 'atrasada')
  const dias = []
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    const dia = date.toISOString().slice(0, 10)
    dias.push({ data: dia, vendas: 0, recebimentos: 0 })
  }
  for (const item of aprovadas) {
    const linha = dias.find((dia) => dia.data === isoDay(item.criadaEm))
    if (linha) linha.vendas += money(item.valor)
  }
  for (const conta of contas.filter((item) => item.status === 'paga' && inPeriod(item.dataPagamento, periodo))) {
    const linha = dias.find((dia) => dia.data === isoDay(conta.dataPagamento))
    if (linha) linha.recebimentos += money(conta.valor)
  }

  return {
    empresaId,
    periodo,
    geradoEm: new Date().toISOString(),
    vendas: {
      transacoes: aprovadas.length,
      aprovadas: money(aprovadas.reduce((sum, item) => sum + money(item.valor), 0)),
      pendentes: money(pendentes.reduce((sum, item) => sum + money(item.valor), 0)),
      porMetodo,
      serieDiaria: dias,
    },
    estoque: {
      itensCatalogo: cardapio.length,
      itensControlados: estoque.length,
      semEstoque,
      baixo: estoqueBaixo,
    },
    financeiro: {
      clientes: clientesKytto.listarClientes(empresaId).length,
      contasAbertas: abertas.length,
      aReceber: money(abertas.reduce((sum, item) => sum + money(item.valor), 0)),
      vencido: money(atraso.reduce((sum, item) => sum + money(item.valor), 0)),
      recebimentosPeriodo: money(contas.filter((item) => item.status === 'paga' && inPeriod(item.dataPagamento, periodo)).reduce((sum, item) => sum + money(item.valor), 0)),
    },
  }
}

export default { gerarRelatorioOperacional }
