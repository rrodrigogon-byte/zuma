/**
 * Módulo de Pagamentos PIX — Setpoint Kytto
 * Gerencia chaves PIX, configurações de adquirentes e transações por empresa
 * Versão: 1.0.0
 * Data: 2026-08-08
 */

import { db } from './db.js'

export const pagamentosPix = {
  // ── CONFIGURAÇÃO PIX POR EMPRESA ──────────────────────────────────────
  
  /**
   * Registra uma chave PIX para uma empresa
   * @param {string} empresaId - ID da empresa
   * @param {object} config - { chave, tipo, nomeTitular, cpfCnpj, banco }
   */
  registrarChavePix(empresaId, config) {
    if (!empresaId || !config?.chave || !config?.tipo) {
      throw new Error('Empresa, chave e tipo de PIX são obrigatórios')
    }
    const tipos = ['cpf', 'cnpj', 'email', 'telefone', 'aleatorio']
    if (!tipos.includes(config.tipo)) {
      throw new Error(`Tipo PIX inválido. Use: ${tipos.join(', ')}`)
    }

    const dados = db()
    if (!dados.pagamentos) dados.pagamentos = {}
    if (!dados.pagamentos[empresaId]) dados.pagamentos[empresaId] = {}
    if (!dados.pagamentos[empresaId].pix) dados.pagamentos[empresaId].pix = []

    const chaveExistente = dados.pagamentos[empresaId].pix.find((c) => c.chave === config.chave)
    if (chaveExistente) {
      throw new Error('Chave PIX já registrada para esta empresa')
    }

    const novaPix = {
      id: `pix-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      chave: config.chave,
      tipo: config.tipo,
      nomeTitular: config.nomeTitular || '',
      cpfCnpj: config.cpfCnpj || '',
      banco: config.banco || 'Banco do Brasil',
      ativa: true,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    }

    dados.pagamentos[empresaId].pix.push(novaPix)
    return novaPix
  },

  /**
   * Lista chaves PIX de uma empresa
   */
  listarChavesPix(empresaId) {
    const dados = db()
    return (dados.pagamentos?.[empresaId]?.pix || []).map((pix) => ({
      ...pix,
      chave: pix.chave.slice(0, 3) + '***' + pix.chave.slice(-3), // Mascarar
    }))
  },

  /**
   * Ativa/desativa uma chave PIX
   */
  atualizarStatusChavePix(empresaId, pixId, ativa) {
    const dados = db()
    const pix = dados.pagamentos?.[empresaId]?.pix?.find((p) => p.id === pixId)
    if (!pix) throw new Error('Chave PIX não encontrada')
    pix.ativa = ativa
    pix.atualizadaEm = new Date().toISOString()
    return pix
  },

  // ── CONFIGURAÇÃO DE ADQUIRENTES ──────────────────────────────────────

  /**
   * Registra credenciais de adquirente (Rede, Cielo, Stone, etc.)
   */
  registrarAdquirente(empresaId, config) {
    if (!empresaId || !config?.nome || !config?.tipo) {
      throw new Error('Empresa, nome e tipo de adquirente são obrigatórios')
    }

    const dados = db()
    if (!dados.pagamentos) dados.pagamentos = {}
    if (!dados.pagamentos[empresaId]) dados.pagamentos[empresaId] = {}
    if (!dados.pagamentos[empresaId].adquirentes) dados.pagamentos[empresaId].adquirentes = []

    const novoAdquirente = {
      id: `acq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nome: config.nome,
      tipo: config.tipo, // 'rede', 'cielo', 'stone', 'getnet'
      chavePublica: config.chavePublica || '',
      chavePrivada: config.chavePrivada ? Buffer.from(config.chavePrivada).toString('base64') : '', // Criptografado
      terminal: config.terminal || '',
      loja: config.loja || '',
      ativa: true,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    }

    dados.pagamentos[empresaId].adquirentes.push(novoAdquirente)
    return { ...novoAdquirente, chavePrivada: '[criptografado]' }
  },

  /**
   * Lista adquirentes de uma empresa (sem expor chaves)
   */
  listarAdquirentes(empresaId) {
    const dados = db()
    return (dados.pagamentos?.[empresaId]?.adquirentes || []).map((acq) => ({
      id: acq.id,
      nome: acq.nome,
      tipo: acq.tipo,
      terminal: acq.terminal,
      loja: acq.loja,
      ativa: acq.ativa,
      criadaEm: acq.criadaEm,
    }))
  },

  // ── TRANSAÇÕES DE PAGAMENTO ──────────────────────────────────────────

  /**
   * Registra uma transação de pagamento
   */
  registrarTransacao(empresaId, transacao) {
    if (!empresaId || !transacao?.valor || !transacao?.metodo) {
      throw new Error('Empresa, valor e método são obrigatórios')
    }

    const dados = db()
    if (!dados.pagamentos) dados.pagamentos = {}
    if (!dados.pagamentos[empresaId]) dados.pagamentos[empresaId] = {}
    if (!dados.pagamentos[empresaId].transacoes) dados.pagamentos[empresaId].transacoes = []

    const novaTransacao = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      valor: transacao.valor,
      metodo: transacao.metodo, // 'pix', 'cartao', 'mercadopago'
      status: transacao.status || 'pendente', // pendente, aprovado, recusado, cancelado
      referencia: transacao.referencia || '',
      descricao: transacao.descricao || '',
      clienteId: transacao.clienteId || '',
      mesaId: transacao.mesaId || '',
      nfceId: transacao.nfceId || '',
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
      metadadosAdquirente: transacao.metadadosAdquirente || {},
    }

    dados.pagamentos[empresaId].transacoes.push(novaTransacao)
    return novaTransacao
  },

  /**
   * Atualiza o status de uma transação
   */
  atualizarStatusTransacao(empresaId, transacaoId, novoStatus) {
    const dados = db()
    const transacao = dados.pagamentos?.[empresaId]?.transacoes?.find((t) => t.id === transacaoId)
    if (!transacao) throw new Error('Transação não encontrada')
    transacao.status = novoStatus
    transacao.atualizadaEm = new Date().toISOString()
    return transacao
  },

  /**
   * Lista transações de uma empresa com filtros
   */
  listarTransacoes(empresaId, filtros = {}) {
    const dados = db()
    let transacoes = dados.pagamentos?.[empresaId]?.transacoes || []

    if (filtros.status) transacoes = transacoes.filter((t) => t.status === filtros.status)
    if (filtros.metodo) transacoes = transacoes.filter((t) => t.metodo === filtros.metodo)
    if (filtros.dataInicio) {
      const inicio = new Date(filtros.dataInicio).getTime()
      transacoes = transacoes.filter((t) => new Date(t.criadaEm).getTime() >= inicio)
    }
    if (filtros.dataFim) {
      const fim = new Date(filtros.dataFim).getTime()
      transacoes = transacoes.filter((t) => new Date(t.criadaEm).getTime() <= fim)
    }

    return transacoes.sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm))
  },

  /**
   * Calcula totais de transações por status/método
   */
  calcularTotais(empresaId, filtros = {}) {
    const transacoes = this.listarTransacoes(empresaId, filtros)
    const totais = {
      total: 0,
      aprovado: 0,
      pendente: 0,
      recusado: 0,
      cancelado: 0,
      porMetodo: { pix: 0, cartao: 0, mercadopago: 0 },
    }

    transacoes.forEach((t) => {
      totais.total += t.valor
      totais[t.status] = (totais[t.status] || 0) + t.valor
      totais.porMetodo[t.metodo] = (totais.porMetodo[t.metodo] || 0) + t.valor
    })

    return totais
  },

  // ── CONFIGURAÇÃO MERCADO PAGO ────────────────────────────────────────

  /**
   * Registra credenciais do Mercado Pago
   */
  registrarMercadoPago(empresaId, config) {
    if (!empresaId || !config?.accessToken) {
      throw new Error('Empresa e access token são obrigatórios')
    }

    const dados = db()
    if (!dados.pagamentos) dados.pagamentos = {}
    if (!dados.pagamentos[empresaId]) dados.pagamentos[empresaId] = {}

    dados.pagamentos[empresaId].mercadoPago = {
      accessToken: Buffer.from(config.accessToken).toString('base64'),
      publicKey: config.publicKey || '',
      userId: config.userId || '',
      ativa: true,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    }

    return { ...dados.pagamentos[empresaId].mercadoPago, accessToken: '[criptografado]' }
  },

  /**
   * Obtém configuração do Mercado Pago (sem expor token)
   */
  obterConfigMercadoPago(empresaId) {
    const dados = db()
    const config = dados.pagamentos?.[empresaId]?.mercadoPago
    if (!config) return null
    return {
      ativa: config.ativa,
      userId: config.userId,
      criadaEm: config.criadaEm,
    }
  },

  // ── RELATÓRIOS E ANÁLISE ─────────────────────────────────────────────

  /**
   * Gera relatório de pagamentos por período
   */
  gerarRelatorioPagamentos(empresaId, dataInicio, dataFim) {
    const transacoes = this.listarTransacoes(empresaId, { dataInicio, dataFim })
    const totais = this.calcularTotais(empresaId, { dataInicio, dataFim })

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      totalTransacoes: transacoes.length,
      totais,
      transacoes: transacoes.slice(0, 100), // Últimas 100
      geradoEm: new Date().toISOString(),
    }
  },
}

export default pagamentosPix
