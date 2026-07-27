/*
 * Fila offline do PDV
 * --------------------------------------------------------------------------
 * Esta camada registra somente eventos de venda explicitamente suportados pelo
 * contrato de sincronização. Ela não intercepta genericamente POST/DELETE:
 * operações de caixa, TEF e fiscal possuem regras próprias e não podem ser
 * repetidas automaticamente pelo navegador.
 */

const DB_NAME = 'kytto-pdv-offline'
const DB_VERSION = 1
const STORE_EVENTOS = 'eventos'
const STORE_META = 'meta'
const AGENTE_PADRAO = 'http://127.0.0.1:9357'

function uuid() {
  return crypto.randomUUID()
}

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const requisicao = indexedDB.open(DB_NAME, DB_VERSION)
    requisicao.onupgradeneeded = () => {
      const db = requisicao.result
      if (!db.objectStoreNames.contains(STORE_EVENTOS)) {
        const eventos = db.createObjectStore(STORE_EVENTOS, { keyPath: 'id' })
        eventos.createIndex('por_status', 'status', { unique: false })
        eventos.createIndex('por_criado_em', 'criado_em', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'chave' })
    }
    requisicao.onsuccess = () => resolve(requisicao.result)
    requisicao.onerror = () => reject(requisicao.error || new Error('Não foi possível abrir a fila offline'))
  })
}

async function transacao(loja, modo, callback) {
  const db = await abrirBanco()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(loja, modo)
    const store = tx.objectStore(loja)
    let retorno
    try { retorno = callback(store, tx) } catch (erro) { reject(erro); return }
    tx.oncomplete = () => resolve(retorno)
    tx.onerror = () => reject(tx.error || new Error('Erro de persistência offline'))
    tx.onabort = () => reject(tx.error || new Error('Transação offline cancelada'))
  })
}

function requisicaoIdb(requisicao) {
  return new Promise((resolve, reject) => {
    requisicao.onsuccess = () => resolve(requisicao.result)
    requisicao.onerror = () => reject(requisicao.error || new Error('Erro no IndexedDB'))
  })
}

function validarVenda(venda) {
  if (!venda || !Array.isArray(venda.itens) || venda.itens.length === 0) throw new Error('Uma venda offline precisa ter pelo menos um item')
  if (!Array.isArray(venda.pagamentos) || venda.pagamentos.length === 0) throw new Error('Uma venda offline precisa ter pelo menos um pagamento')
  if (!venda.usuario_vendedor_id) throw new Error('Informe o operador que realizou a venda')

  const totalItens = venda.itens.reduce((soma, item) => soma + Number(item.quantidade || 0) * Number(item.valor_unitario || 0) - Number(item.desconto_item || 0), 0)
  const acrescimo = Number(venda.valor_acrescimo || 0)
  const totalEsperado = Number((totalItens + acrescimo).toFixed(2))
  const totalPagamentos = venda.pagamentos
    .filter((pagamento) => (pagamento.status || 'aprovado') === 'aprovado')
    .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0)

  if (!Number.isFinite(totalEsperado) || totalEsperado <= 0) throw new Error('Total da venda offline inválido')
  if (Math.abs(totalPagamentos - totalEsperado) > 0.01) throw new Error('Os pagamentos precisam conferir com o total da venda')

  for (const pagamento of venda.pagamentos) {
    const tipoOriginal = String(pagamento.tipo || '').toLowerCase()
    const tipo = ({ tef: 'cartao_credito', cartao: 'cartao_credito', carteira: 'vale' })[tipoOriginal] || tipoOriginal
    if (tipo === 'pix') throw new Error('Pix exige confirmação online e não pode ser finalizado em modo offline')
    if (['cartao_credito', 'cartao_debito'].includes(tipo) && !pagamento.referencia_externa) {
      throw new Error('Pagamento em cartão offline exige NSU ou referência autorizada pelo TEF local')
    }
  }
  return { totalEsperado }
}

export async function enfileirarVendaOffline(venda) {
  validarVenda(venda)
  const evento = {
    id: uuid(),
    sequencia: await proximaSequencia(),
    tipo: 'venda_offline',
    payload: {
      ...venda,
      id_externo: venda.id_externo || uuid(),
      ocorreu_em: venda.ocorreu_em || new Date().toISOString(),
    },
    criado_em: new Date().toISOString(),
    status: 'pendente',
    tentativas: 0,
  }
  await transacao(STORE_EVENTOS, 'readwrite', (store) => store.add(evento))
  return evento
}

export async function proximaSequencia() {
  const reservar = async () => {
    const db = await abrirBanco()
    const tx = db.transaction(STORE_META, 'readwrite')
    const store = tx.objectStore(STORE_META)
    const atual = await requisicaoIdb(store.get('sequencia'))
    const proxima = Number(atual?.valor || 0) + 1
    store.put({ chave: 'sequencia', valor: proxima })
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error || new Error('Erro ao reservar sequência offline'))
      tx.onabort = () => reject(tx.error || new Error('Reserva de sequência cancelada'))
    })
    return proxima
  }

  // Locks do navegador evitam que duas abas recebam a mesma sequência. Em
  // navegadores sem suporte, a transação IndexedDB ainda mantém consistência
  // dentro de uma única aba de operação.
  if (navigator.locks?.request) return navigator.locks.request('kytto-pdv-sequencia', reservar)
  return reservar()
}

export async function listarEventosOffline({ limite = 100, status = null } = {}) {
  const db = await abrirBanco()
  const tx = db.transaction(STORE_EVENTOS, 'readonly')
  const store = tx.objectStore(STORE_EVENTOS)
  const itens = await requisicaoIdb(store.getAll())
  return itens
    .filter((item) => !status || item.status === status)
    .sort((a, b) => a.sequencia - b.sequencia)
    .slice(0, limite)
}

export async function resumoFilaOffline() {
  const eventos = await listarEventosOffline({ limite: 10000 })
  return eventos.reduce((resumo, evento) => {
    resumo.total += 1
    resumo[evento.status] = (resumo[evento.status] || 0) + 1
    return resumo
  }, { total: 0, pendente: 0, entregue_ao_agente: 0, falha: 0 })
}

export async function removerEventosOffline(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return
  await transacao(STORE_EVENTOS, 'readwrite', (store) => ids.forEach((id) => store.delete(id)))
}

export async function atualizarEventoOffline(id, alteracoes) {
  const db = await abrirBanco()
  const tx = db.transaction(STORE_EVENTOS, 'readwrite')
  const store = tx.objectStore(STORE_EVENTOS)
  const atual = await requisicaoIdb(store.get(id))
  if (atual) store.put({ ...atual, ...alteracoes })
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(atual ? { ...atual, ...alteracoes } : null)
    tx.onerror = () => reject(tx.error || new Error('Erro ao atualizar evento offline'))
  })
}

export function urlAgenteLocal() {
  try {
    const configuracao = JSON.parse(localStorage.getItem('sp_config_tef') || '{}')
    return configuracao.agenteUrl || AGENTE_PADRAO
  } catch {
    return AGENTE_PADRAO
  }
}

/**
 * Encaminha um cupom estruturado ao agente local. A operação é limitada ao
 * loopback configurado pelo operador; a chamada não contém credenciais do ERP.
 */
export async function imprimirViaAgenteLocal({ conteudo, dispositivo_id = null, agenteUrl = urlAgenteLocal() } = {}) {
  if (!conteudo || typeof conteudo !== 'object') throw new Error('Conteúdo de impressão inválido')
  const controlador = new AbortController()
  const timeout = setTimeout(() => controlador.abort(), 7000)
  try {
    const resposta = await fetch(`${agenteUrl.replace(/\/$/, '')}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo, dispositivo_id }),
      signal: controlador.signal,
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.erro || `Agente local respondeu ${resposta.status}`)
    return dados
  } catch (erro) {
    if (erro.name === 'AbortError') throw new Error('O agente local não respondeu a tempo')
    throw erro
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Transfere uma cópia durável dos eventos para o agente local. O agente grava
 * o lote em disco antes de responder; por isso o navegador só pode remover a
 * cópia após receber os IDs aceitos.
 */
export async function entregarFilaAoAgente({ limite = 50, agenteUrl = urlAgenteLocal() } = {}) {
  const eventos = await listarEventosOffline({ limite })
  const pendentes = eventos.filter((evento) => evento.status === 'pendente' || evento.status === 'falha')
  if (pendentes.length === 0) return { entregue: 0, pendentes: 0 }

  try {
    const resposta = await fetch(`${agenteUrl.replace(/\/$/, '')}/offline/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventos: pendentes }),
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.erro || `Agente local respondeu ${resposta.status}`)
    const aceitos = new Set(dados.eventos_aceitos || [])
    for (const evento of pendentes) {
      if (aceitos.has(evento.id)) await atualizarEventoOffline(evento.id, { status: 'entregue_ao_agente', entregue_em: new Date().toISOString(), tentativas: evento.tentativas + 1 })
    }
    // Após o agente confirmar o armazenamento durável, a cópia de origem não
    // é necessária. A remoção evita reenviar a mesma venda em nova sessão.
    await removerEventosOffline([...aceitos])
    return { entregue: aceitos.size, pendentes: pendentes.length }
  } catch (erro) {
    for (const evento of pendentes) await atualizarEventoOffline(evento.id, { status: 'falha', ultimo_erro: erro.message, tentativas: evento.tentativas + 1 })
    throw erro
  }
}

export async function exportarFilaOffline() {
  const eventos = await listarEventosOffline({ limite: 10000 })
  return new Blob([JSON.stringify({ versao: 1, exportado_em: new Date().toISOString(), eventos }, null, 2)], { type: 'application/json' })
}

export function baixarFilaOffline() {
  return exportarFilaOffline().then((blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kytto-pdv-offline-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  })
}
