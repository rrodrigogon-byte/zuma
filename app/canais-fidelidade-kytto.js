import { db, save } from './db.js'

const agora = () => new Date().toISOString()
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const texto = (value, max = 180) => String(value ?? '').trim().slice(0, max)

function store() {
  const state = db()
  state.canaisKytto ||= { empresas: {} }
  state.canaisKytto.empresas ||= {}
  return state.canaisKytto.empresas
}

function empresa(empresaId) {
  const empresas = store()
  empresas[empresaId] ||= {
    canais: {
      pdv: { id: 'pdv', nome: 'PDV Kytto', ativo: true, tipo: 'interno' },
      delivery_proprio: { id: 'delivery_proprio', nome: 'Delivery próprio', ativo: false, tipo: 'delivery' },
      ifood: { id: 'ifood', nome: 'iFood', ativo: false, tipo: 'marketplace', credencialConfigurada: false },
      whatsapp: { id: 'whatsapp', nome: 'WhatsApp', ativo: false, tipo: 'mensageria' },
      loja_online: { id: 'loja_online', nome: 'Loja online', ativo: false, tipo: 'ecommerce' },
    },
    fidelidade: { regra: { pontosPorReal: 1, valorPonto: 0.01, ativa: true }, membros: {} },
    pedidos: {},
  }
  return empresas[empresaId]
}

export function obterCanais(empresaId) {
  const data = empresa(empresaId)
  return Object.values(data.canais).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function salvarCanal(empresaId, payload = {}) {
  const canalId = texto(payload.id || payload.canal, 60).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  if (!canalId) throw new Error('Identificação do canal é obrigatória.')
  const data = empresa(empresaId)
  const atual = data.canais[canalId] || { id: canalId, criadoEm: agora() }
  data.canais[canalId] = {
    ...atual,
    id: canalId,
    nome: texto(payload.nome || atual.nome || canalId, 100),
    tipo: texto(payload.tipo || atual.tipo || 'outro', 60),
    ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : atual.ativo !== false,
    slug: texto(payload.slug || atual.slug, 100),
    observacao: texto(payload.observacao || atual.observacao, 300),
    // Credenciais de provedores são mantidas no cofre externo e nunca no db.json.
    credencialConfigurada: Boolean(payload.credencialConfigurada ?? atual.credencialConfigurada),
    atualizadaEm: agora(),
  }
  save()
  return data.canais[canalId]
}

export function obterFidelidade(empresaId) {
  const data = empresa(empresaId)
  const membros = Object.values(data.fidelidade.membros).sort((a, b) => Number(b.pontos || 0) - Number(a.pontos || 0))
  return { regra: data.fidelidade.regra, membros }
}

export function salvarRegraFidelidade(empresaId, payload = {}) {
  const data = empresa(empresaId)
  data.fidelidade.regra = {
    ...data.fidelidade.regra,
    ativa: payload.ativa !== undefined ? Boolean(payload.ativa) : data.fidelidade.regra.ativa,
    pontosPorReal: Math.max(0, Number(payload.pontosPorReal ?? data.fidelidade.regra.pontosPorReal) || 0),
    valorPonto: Math.max(0, Number(payload.valorPonto ?? data.fidelidade.regra.valorPonto) || 0),
    atualizadaEm: agora(),
  }
  save()
  return data.fidelidade.regra
}

export function cadastrarMembroFidelidade(empresaId, payload = {}) {
  const data = empresa(empresaId)
  const clienteId = texto(payload.clienteId, 90)
  const nome = texto(payload.nome, 120)
  if (!clienteId || !nome) throw new Error('Cliente e nome são obrigatórios para fidelização.')
  const existente = Object.values(data.fidelidade.membros).find((membro) => membro.clienteId === clienteId)
  if (existente) return existente
  const membro = { id: id('fid'), clienteId, nome, telefone: texto(payload.telefone, 30), pontos: 0, nivel: 'bronze', criadoEm: agora(), atualizadoEm: agora() }
  data.fidelidade.membros[membro.id] = membro
  save()
  return membro
}

export function creditarFidelidade(empresaId, clienteId, valor, origem = 'venda') {
  const data = empresa(empresaId)
  if (!data.fidelidade.regra.ativa) return null
  const membro = Object.values(data.fidelidade.membros).find((item) => item.clienteId === clienteId)
  if (!membro) return null
  const pontos = Math.floor(Math.max(0, Number(valor) || 0) * Number(data.fidelidade.regra.pontosPorReal || 0))
  membro.pontos = Number(membro.pontos || 0) + pontos
  membro.nivel = membro.pontos >= 5000 ? 'ouro' : membro.pontos >= 1500 ? 'prata' : 'bronze'
  membro.ultimaOrigem = texto(origem, 40); membro.atualizadaEm = agora()
  save()
  return { membro, pontosCreditados: pontos }
}

export function criarPedidoCanal(empresaId, payload = {}) {
  const data = empresa(empresaId)
  const canal = texto(payload.canal || 'delivery_proprio', 60)
  if (!data.canais[canal]?.ativo) throw new Error('O canal informado não está ativo para esta empresa.')
  const pedido = {
    id: id('ped'), empresaId, canal, status: 'novo', clienteId: texto(payload.clienteId, 90),
    clienteNome: texto(payload.clienteNome, 120), telefone: texto(payload.telefone, 30),
    enderecoEntrega: texto(payload.enderecoEntrega, 240), valor: Math.max(0, Number(payload.valor) || 0),
    itens: Array.isArray(payload.itens) ? payload.itens.slice(0, 100) : [], observacao: texto(payload.observacao, 300),
    criadoEm: agora(), atualizadoEm: agora(),
  }
  data.pedidos[pedido.id] = pedido
  save()
  return pedido
}

export function listarPedidosCanal(empresaId, filtros = {}) {
  const data = empresa(empresaId)
  return Object.values(data.pedidos).filter((pedido) => !filtros.canal || pedido.canal === filtros.canal).filter((pedido) => !filtros.status || pedido.status === filtros.status).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
}

export default { obterCanais, salvarCanal, obterFidelidade, salvarRegraFidelidade, cadastrarMembroFidelidade, creditarFidelidade, criarPedidoCanal, listarPedidosCanal }
