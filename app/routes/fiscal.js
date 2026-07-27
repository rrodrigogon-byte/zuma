import express from 'express'
import crypto from 'crypto'
import * as dbPg from '../db-pg.js'
import { verificarPermissao, verificarTenant } from '../core/auth.js'

const router = express.Router()

// ─── Validações ───────────────────────────────────────────────────────────

function idValido(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function valorMonetario(valor, campo = 'Valor') {
  const num = Number(valor)
  if (!Number.isFinite(num) || num < 0) throw new Error(`${campo} inválido`)
  return Number(num.toFixed(2))
}

const TIPOS_DOCUMENTO = new Set(['nfe', 'sat', 'mfe', 'nfse'])
const REGIMES_TRIBUTARIOS = new Set(['simples_nacional', 'lucro_presumido', 'lucro_real'])
const ESTADOS_FISCAL = new Set(['rascunho', 'autorizado', 'cancelado', 'denegado', 'contingencia'])
const TIPOS_MANIFESTACAO = new Set(['ciencia', 'desconhecimento', 'nao_realizada', 'operacao_realizada'])

// ─── Endpoints ────────────────────────────────────────────────────────────

/**
 * GET /api/fiscal/configuracao/:lojaId
 * Obter configuração fiscal da loja
 */
router.get('/api/fiscal/configuracao/:lojaId', verificarTenant, verificarPermissao(['admin', 'gerente', 'caixa']), async (req, res) => {
  const { lojaId } = req.params
  const { empresa_id: empresaId } = req.usuario
  try {
    if (!idValido(lojaId)) throw new Error('ID da loja inválido')
    const resultado = await dbPg.query(
      `SELECT * FROM configuracao_fiscal_loja WHERE empresa_id = $1 AND loja_id = $2`,
      [empresaId, lojaId]
    )
    if (resultado.rows.length === 0) throw new Error('Configuração fiscal não encontrada')
    res.json(resultado.rows[0])
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * PUT /api/fiscal/configuracao/:lojaId
 * Atualizar configuração fiscal da loja
 */
router.put('/api/fiscal/configuracao/:lojaId', verificarTenant, verificarPermissao(['admin', 'gerente']), async (req, res) => {
  const { lojaId } = req.params
  const { empresa_id: empresaId } = req.usuario
  const { regime_tributario, ambiente_nfe, certificado_a1_id, contingencia_ativa } = req.body
  try {
    if (!idValido(lojaId)) throw new Error('ID da loja inválido')
    if (regime_tributario && !REGIMES_TRIBUTARIOS.has(regime_tributario)) throw new Error('Regime tributário inválido')
    if (ambiente_nfe && !['producao', 'homologacao'].includes(ambiente_nfe)) throw new Error('Ambiente NF-e inválido')

    const client = await dbPg.connect()
    try {
      await dbPg.query('BEGIN', [], client)
      const resultado = await dbPg.queryInTransaction(
        client,
        `UPDATE configuracao_fiscal_loja SET
          regime_tributario = COALESCE($1, regime_tributario),
          ambiente_nfe = COALESCE($2, ambiente_nfe),
          certificado_a1_id = COALESCE($3, certificado_a1_id),
          contingencia_ativa = COALESCE($4, contingencia_ativa)
        WHERE empresa_id = $5 AND loja_id = $6
        RETURNING *`,
        [regime_tributario, ambiente_nfe, certificado_a1_id || null, contingencia_ativa, empresaId, lojaId]
      )
      if (resultado.rows.length === 0) throw new Error('Configuração fiscal não encontrada')
      await dbPg.commit(client)
      res.json(resultado.rows[0])
    } catch (erro) {
      await dbPg.rollback(client)
      throw erro
    }
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * POST /api/fiscal/documento
 * Emitir novo documento fiscal (NF-e, SAT, MFE, NFS-e)
 */
router.post('/api/fiscal/documento', verificarTenant, verificarPermissao(['admin', 'gerente', 'caixa']), async (req, res) => {
  const { empresa_id: empresaId, usuario_id: usuarioId } = req.usuario
  const {
    loja_id: lojaId,
    venda_id: vendaId,
    tipo_documento: tipoDocumento,
    natureza_operacao: naturezaOperacao,
    itens,
    valor_desconto: valorDesconto = 0,
    valor_acrescimo: valorAcrescimo = 0,
    observacoes_complementares: observacoesComplementares,
  } = req.body

  try {
    if (!idValido(lojaId) || !idValido(vendaId)) throw new Error('IDs inválidos')
    if (!TIPOS_DOCUMENTO.has(tipoDocumento)) throw new Error('Tipo de documento inválido')
    if (!Array.isArray(itens) || itens.length === 0) throw new Error('Informe ao menos um item')

    const client = await dbPg.connect()
    try {
      await dbPg.query('BEGIN', [], client)

      // Validar venda
      const vendaResult = await dbPg.queryInTransaction(
        client,
        `SELECT id, total FROM vendas WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
        [vendaId, empresaId, lojaId]
      )
      if (vendaResult.rows.length === 0) throw new Error('Venda não encontrada')

      // Validar configuração fiscal
      const configResult = await dbPg.queryInTransaction(
        client,
        `SELECT * FROM configuracao_fiscal_loja WHERE empresa_id = $1 AND loja_id = $2`,
        [empresaId, lojaId]
      )
      if (configResult.rows.length === 0) throw new Error('Configuração fiscal não encontrada')
      const config = configResult.rows[0]

      // Calcular totais
      let valorOperacao = 0
      let valorIcms = 0
      let valorPis = 0
      let valorCofins = 0
      let valorIpi = 0

      const itensProcessados = []
      for (const item of itens) {
        const quantidade = valorMonetario(item.quantidade, 'Quantidade')
        const valorUnitario = valorMonetario(item.valor_unitario, 'Valor unitário')
        const desconto = valorMonetario(item.valor_desconto || 0, 'Desconto do item')
        const acrescimo = valorMonetario(item.valor_acrescimo || 0, 'Acréscimo do item')
        const icms = valorMonetario(item.valor_icms || 0, 'ICMS')
        const pis = valorMonetario(item.valor_pis || 0, 'PIS')
        const cofins = valorMonetario(item.valor_cofins || 0, 'COFINS')
        const ipi = valorMonetario(item.valor_ipi || 0, 'IPI')

        const valorItem = (quantidade * valorUnitario) - desconto + acrescimo
        valorOperacao += valorItem
        valorIcms += icms
        valorPis += pis
        valorCofins += cofins
        valorIpi += ipi

        itensProcessados.push({
          ...item,
          quantidade,
          valor_unitario: valorUnitario,
          valor_desconto: desconto,
          valor_acrescimo: acrescimo,
          valor_icms: icms,
          valor_pis: pis,
          valor_cofins: cofins,
          valor_ipi: ipi,
          valor_total: valorItem,
        })
      }

      const desconto = valorMonetario(valorDesconto, 'Desconto geral')
      const acrescimo = valorMonetario(valorAcrescimo, 'Acréscimo geral')
      const valorTotal = (valorOperacao - desconto + acrescimo)

      // Obter próximo número do documento
      const proximoNumero = config[`proxima_numero_${tipoDocumento === 'nfe' ? 'nfe' : tipoDocumento === 'sat' ? 'sat' : 'nfe'}`]
      const serie = config[`serie_${tipoDocumento === 'nfe' ? 'nfe' : tipoDocumento === 'sat' ? 'sat' : 'nfe'}`]

      // Criar documento fiscal
      const docResult = await dbPg.queryInTransaction(
        client,
        `INSERT INTO documentos_fiscais (
          empresa_id, loja_id, venda_id, tipo_documento, numero_documento, serie_documento,
          status_fiscal, natureza_operacao, valor_operacao, valor_desconto, valor_acrescimo,
          valor_total, valor_icms, valor_pis, valor_cofins, valor_ipi,
          observacoes_complementares, usuario_id, data_emissao
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          empresaId, lojaId, vendaId, tipoDocumento, proximoNumero, serie,
          'rascunho', naturezaOperacao, valorOperacao, desconto, acrescimo,
          valorTotal, valorIcms, valorPis, valorCofins, valorIpi,
          observacoesComplementares, usuarioId,
        ]
      )
      const documento = docResult.rows[0]

      // Inserir itens do documento
      for (let i = 0; i < itensProcessados.length; i++) {
        const item = itensProcessados[i]
        await dbPg.queryInTransaction(
          client,
          `INSERT INTO documentos_fiscais_itens (
            documento_fiscal_id, numero_item, produto_id, descricao_produto,
            ncm, cest, cfop, quantidade, valor_unitario, valor_desconto,
            valor_acrescimo, valor_total, aliquota_icms, aliquota_pis, aliquota_cofins,
            cst_icms, csosn_icms, valor_icms, valor_pis, valor_cofins
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            documento.id, i + 1, item.produto_id, item.descricao_produto || item.nome,
            item.ncm, item.cest, item.cfop, item.quantidade, item.valor_unitario,
            item.valor_desconto, item.valor_acrescimo, item.valor_total,
            item.aliquota_icms || 0, item.aliquota_pis || 0, item.aliquota_cofins || 0,
            item.cst_icms, item.csosn_icms, item.valor_icms, item.valor_pis, item.valor_cofins,
          ]
        )
      }

      // Registrar transição de estado
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO maquina_estados_fiscal (
          empresa_id, loja_id, documento_fiscal_id, estado_anterior, estado_novo,
          motivo_transicao, usuario_id
        ) VALUES ($1, $2, $3, NULL, $4, $5, $6)`,
        [empresaId, lojaId, documento.id, 'rascunho', 'Documento criado em rascunho', usuarioId]
      )

      // Atualizar próximo número
      await dbPg.queryInTransaction(
        client,
        `UPDATE configuracao_fiscal_loja SET
          proxima_numero_${tipoDocumento === 'nfe' ? 'nfe' : tipoDocumento === 'sat' ? 'sat' : 'nfe'} = $1
        WHERE empresa_id = $2 AND loja_id = $3`,
        [proximoNumero + 1, empresaId, lojaId]
      )

      await dbPg.commit(client)
      res.status(201).json({ documento, itens: itensProcessados })
    } catch (erro) {
      await dbPg.rollback(client)
      throw erro
    }
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * GET /api/fiscal/documento/:documentoId
 * Obter documento fiscal completo
 */
router.get('/api/fiscal/documento/:documentoId', verificarTenant, verificarPermissao(['admin', 'gerente', 'caixa']), async (req, res) => {
  const { documentoId } = req.params
  const { empresa_id: empresaId } = req.usuario
  try {
    if (!idValido(documentoId)) throw new Error('ID do documento inválido')
    const resultado = await dbPg.query(
      `SELECT * FROM documentos_fiscais WHERE id = $1 AND empresa_id = $2`,
      [documentoId, empresaId]
    )
    if (resultado.rows.length === 0) throw new Error('Documento não encontrado')

    const documento = resultado.rows[0]
    const itensResult = await dbPg.query(
      `SELECT * FROM documentos_fiscais_itens WHERE documento_fiscal_id = $1 ORDER BY numero_item`,
      [documentoId]
    )

    res.json({ documento, itens: itensResult.rows })
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * POST /api/fiscal/documento/:documentoId/autorizar
 * Autorizar documento fiscal (simular autorização)
 */
router.post('/api/fiscal/documento/:documentoId/autorizar', verificarTenant, verificarPermissao(['admin', 'gerente']), async (req, res) => {
  const { documentoId } = req.params
  const { empresa_id: empresaId, usuario_id: usuarioId } = req.usuario
  const { chave_acesso: chaveAcesso, protocolo_autorizacao: protocoloAutorizacao } = req.body

  try {
    if (!idValido(documentoId)) throw new Error('ID do documento inválido')

    const client = await dbPg.connect()
    try {
      await dbPg.query('BEGIN', [], client)

      const resultado = await dbPg.queryInTransaction(
        client,
        `UPDATE documentos_fiscais SET
          status_fiscal = 'autorizado',
          chave_acesso = $1,
          protocolo_autorizacao = $2,
          data_autorizacao = CURRENT_TIMESTAMP
        WHERE id = $3 AND empresa_id = $4 AND status_fiscal = 'rascunho'
        RETURNING *`,
        [chaveAcesso, protocoloAutorizacao, documentoId, empresaId]
      )
      if (resultado.rows.length === 0) throw new Error('Documento não encontrado ou não está em rascunho')

      // Registrar transição de estado
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO maquina_estados_fiscal (
          empresa_id, loja_id, documento_fiscal_id, estado_anterior, estado_novo,
          motivo_transicao, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [empresaId, resultado.rows[0].loja_id, documentoId, 'rascunho', 'autorizado', 'Documento autorizado pela Sefaz', usuarioId]
      )

      await dbPg.commit(client)
      res.json(resultado.rows[0])
    } catch (erro) {
      await dbPg.rollback(client)
      throw erro
    }
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * POST /api/fiscal/documento/:documentoId/cancelar
 * Cancelar documento fiscal
 */
router.post('/api/fiscal/documento/:documentoId/cancelar', verificarTenant, verificarPermissao(['admin', 'gerente']), async (req, res) => {
  const { documentoId } = req.params
  const { empresa_id: empresaId, usuario_id: usuarioId } = req.usuario
  const { motivo_cancelamento: motivoCancelamento, protocolo_cancelamento: protocoloCancelamento } = req.body

  try {
    if (!idValido(documentoId)) throw new Error('ID do documento inválido')
    if (!motivoCancelamento) throw new Error('Motivo do cancelamento é obrigatório')

    const client = await dbPg.connect()
    try {
      await dbPg.query('BEGIN', [], client)

      const resultado = await dbPg.queryInTransaction(
        client,
        `UPDATE documentos_fiscais SET
          status_fiscal = 'cancelado',
          motivo_status = $1,
          protocolo_cancelamento = $2,
          data_cancelamento = CURRENT_TIMESTAMP
        WHERE id = $3 AND empresa_id = $4 AND status_fiscal = 'autorizado'
        RETURNING *`,
        [motivoCancelamento, protocoloCancelamento, documentoId, empresaId]
      )
      if (resultado.rows.length === 0) throw new Error('Documento não encontrado ou não está autorizado')

      // Registrar transição de estado
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO maquina_estados_fiscal (
          empresa_id, loja_id, documento_fiscal_id, estado_anterior, estado_novo,
          motivo_transicao, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [empresaId, resultado.rows[0].loja_id, documentoId, 'autorizado', 'cancelado', motivoCancelamento, usuarioId]
      )

      await dbPg.commit(client)
      res.json(resultado.rows[0])
    } catch (erro) {
      await dbPg.rollback(client)
      throw erro
    }
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * POST /api/fiscal/manifestacao
 * Registrar manifestação do destinatário (NF-e)
 */
router.post('/api/fiscal/manifestacao', verificarTenant, verificarPermissao(['admin', 'gerente', 'caixa']), async (req, res) => {
  const { empresa_id: empresaId, usuario_id: usuarioId } = req.usuario
  const { documento_fiscal_id: documentoFiscalId, tipo_manifestacao: tipoManifestacao, justificativa } = req.body

  try {
    if (!idValido(documentoFiscalId)) throw new Error('ID do documento inválido')
    if (!TIPOS_MANIFESTACAO.has(tipoManifestacao)) throw new Error('Tipo de manifestação inválido')

    const resultado = await dbPg.query(
      `INSERT INTO manifestacoes_destinatario (
        empresa_id, documento_fiscal_id, tipo_manifestacao, justificativa,
        sequencia_evento, data_manifestacao, usuario_id
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
      RETURNING *`,
      [empresaId, documentoFiscalId, tipoManifestacao, justificativa || null, 1, usuarioId]
    )

    res.status(201).json(resultado.rows[0])
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * GET /api/fiscal/documentos
 * Listar documentos fiscais com filtros
 */
router.get('/api/fiscal/documentos', verificarTenant, verificarPermissao(['admin', 'gerente', 'caixa']), async (req, res) => {
  const { empresa_id: empresaId } = req.usuario
  const { loja_id: lojaId, tipo_documento: tipoDocumento, status_fiscal: statusFiscal, limite = 100, offset = 0 } = req.query

  try {
    let query = `SELECT * FROM documentos_fiscais WHERE empresa_id = $1`
    const params = [empresaId]
    let paramIndex = 2

    if (lojaId && idValido(lojaId)) {
      query += ` AND loja_id = $${paramIndex}`
      params.push(lojaId)
      paramIndex++
    }

    if (tipoDocumento && TIPOS_DOCUMENTO.has(tipoDocumento)) {
      query += ` AND tipo_documento = $${paramIndex}`
      params.push(tipoDocumento)
      paramIndex++
    }

    if (statusFiscal && ESTADOS_FISCAL.has(statusFiscal)) {
      query += ` AND status_fiscal = $${paramIndex}`
      params.push(statusFiscal)
      paramIndex++
    }

    query += ` ORDER BY data_emissao DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(Math.min(Number(limite), 500), Number(offset))

    const resultado = await dbPg.query(query, params)
    res.json(resultado.rows)
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * POST /api/fiscal/contingencia/iniciar
 * Iniciar contingência fiscal (quando servidor Sefaz indisponível)
 */
router.post('/api/fiscal/contingencia/iniciar', verificarTenant, verificarPermissao(['admin', 'gerente']), async (req, res) => {
  const { empresa_id: empresaId } = req.usuario
  const { loja_id: lojaId, tipo_documento: tipoDocumento, motivo_contingencia: motivoContingencia } = req.body

  try {
    if (!idValido(lojaId)) throw new Error('ID da loja inválido')
    if (!TIPOS_DOCUMENTO.has(tipoDocumento)) throw new Error('Tipo de documento inválido')

    const resultado = await dbPg.query(
      `INSERT INTO contingencia_fiscal (
        empresa_id, loja_id, tipo_documento, motivo_contingencia, data_inicio, status
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'ativa')
      RETURNING *`,
      [empresaId, lojaId, tipoDocumento, motivoContingencia]
    )

    // Atualizar configuração fiscal
    await dbPg.query(
      `UPDATE configuracao_fiscal_loja SET contingencia_ativa = true
      WHERE empresa_id = $1 AND loja_id = $2`,
      [empresaId, lojaId]
    )

    res.status(201).json(resultado.rows[0])
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

/**
 * GET /api/fiscal/contingencia/status
 * Obter status de contingência
 */
router.get('/api/fiscal/contingencia/status', verificarTenant, verificarPermissao(['admin', 'gerente']), async (req, res) => {
  const { empresa_id: empresaId } = req.usuario
  const { loja_id: lojaId } = req.query

  try {
    let query = `SELECT * FROM vw_contingencia_ativa WHERE empresa_id = $1`
    const params = [empresaId]

    if (lojaId && idValido(lojaId)) {
      query += ` AND loja_id = $2`
      params.push(lojaId)
    }

    const resultado = await dbPg.query(query, params)
    res.json(resultado.rows)
  } catch (erro) {
    res.status(400).json({ erro: erro.message })
  }
})

export default router
