/**
 * Controllers do Módulo BAR - Divisão de Conta
 * SetPoint Ultra
 */

import { db } from '../../../core/database.js';
import * as stoneAdapter from '../../../adapters/payment/stone.js';

// ============================================================================
// DIVISÃO DE CONTA
// ============================================================================

/**
 * Criar divisão de conta
 */
export const criarDivisao = async (req, res) => {
  try {
    const { id: comandaId } = req.params;
    const { numero_divisao, nome_cliente } = req.body;
    const tenantId = req.tenantId;

    // Validar comanda
    const comandaResult = await db.query(
      `
      SELECT id FROM comandas
      WHERE id = $1 AND estabelecimento_id = $2
      `,
      [comandaId, tenantId]
    );

    if (comandaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comanda não encontrada' });
    }

    // Criar divisão
    const result = await db.query(
      `
      INSERT INTO divisoes_comanda (
        comanda_id, numero_divisao, nome_cliente
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [comandaId, numero_divisao, nome_cliente || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar divisão:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Listar divisões de uma comanda
 */
export const listarDivisoes = async (req, res) => {
  try {
    const { id: comandaId } = req.params;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT dc.*, 
        (SELECT COUNT(*) FROM itens_divisao WHERE divisao_id = dc.id) as total_itens,
        (SELECT SUM(valor_total) FROM itens_divisao WHERE divisao_id = dc.id) as valor_total
      FROM divisoes_comanda dc
      WHERE dc.comanda_id = $1
      ORDER BY dc.numero_divisao
      `,
      [comandaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar divisões:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Adicionar item à divisão
 */
export const adicionarItemDivisao = async (req, res) => {
  try {
    const { comandaId, divisaoId } = req.params;
    const { item_comanda_id, quantidade } = req.body;
    const tenantId = req.tenantId;

    // Validar item da comanda
    const itemResult = await db.query(
      `
      SELECT ic.*, c.estabelecimento_id
      FROM itens_comanda ic
      JOIN comandas c ON ic.comanda_id = c.id
      WHERE ic.id = $1 AND ic.comanda_id = $2 AND c.estabelecimento_id = $3
      `,
      [item_comanda_id, comandaId, tenantId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const item = itemResult.rows[0];
    const qtd = quantidade || item.quantidade;
    const valorTotal = qtd * item.valor_unitario;

    // Inserir item na divisão
    const result = await db.query(
      `
      INSERT INTO itens_divisao (
        divisao_id, item_comanda_id, quantidade, valor_total
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [divisaoId, item_comanda_id, qtd, valorTotal]
    );

    // Atualizar totais da divisão
    await atualizarTotaisDivisao(divisaoId);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar item à divisão:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Remover item da divisão
 */
export const removerItemDivisao = async (req, res) => {
  try {
    const { comandaId, divisaoId, itemId } = req.params;

    const result = await db.query(
      `
      DELETE FROM itens_divisao
      WHERE id = $1 AND divisao_id = $2
      RETURNING *
      `,
      [itemId, divisaoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    // Atualizar totais da divisão
    await atualizarTotaisDivisao(divisaoId);

    res.json({ mensagem: 'Item removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover item da divisão:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Pagar divisão
 */
export const pagarDivisao = async (req, res) => {
  try {
    const { comandaId, divisaoId } = req.params;
    const {
      tipo_pagamento,
      valor_total,
      valor_desconto = 0,
      valor_acrescimo = 0,
      adquirente,
      cartao,
      cliente,
    } = req.body;
    const tenantId = req.tenantId;

    // Validar divisão
    const divisaoResult = await db.query(
      `
      SELECT * FROM divisoes_comanda
      WHERE id = $1 AND comanda_id = $2
      `,
      [divisaoId, comandaId]
    );

    if (divisaoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Divisão não encontrada' });
    }

    const divisao = divisaoResult.rows[0];
    const valorLiquido = valor_total - valor_desconto + valor_acrescimo;

    // Processar pagamento conforme tipo
    let resultadoPagamento = null;

    if (tipo_pagamento === 'cartao_credito' && adquirente === 'stone') {
      resultadoPagamento = await stoneAdapter.processarCartaoCredito({
        tenantId,
        valor: valorLiquido,
        cartao,
        cliente,
        descricao: `Divisão ${divisao.numero_divisao} - Comanda ${comandaId}`,
        referencia: `DIV-${divisaoId}`,
      });
    } else if (tipo_pagamento === 'cartao_debito' && adquirente === 'stone') {
      resultadoPagamento = await stoneAdapter.processarCartaoDebito({
        tenantId,
        valor: valorLiquido,
        cartao,
        cliente,
        descricao: `Divisão ${divisao.numero_divisao} - Comanda ${comandaId}`,
        referencia: `DIV-${divisaoId}`,
      });
    } else if (tipo_pagamento === 'pix' && adquirente === 'stone') {
      resultadoPagamento = await stoneAdapter.processarPix({
        tenantId,
        valor: valorLiquido,
        cliente,
        descricao: `Divisão ${divisao.numero_divisao} - Comanda ${comandaId}`,
        referencia: `DIV-${divisaoId}`,
      });
    } else if (tipo_pagamento === 'dinheiro') {
      resultadoPagamento = {
        sucesso: true,
        idTransacao: `DINHEIRO-${Date.now()}`,
      };
    } else {
      return res.status(400).json({ error: 'Tipo de pagamento não suportado' });
    }

    if (!resultadoPagamento.sucesso) {
      return res.status(400).json({ error: 'Erro ao processar pagamento' });
    }

    // Gerar número de pagamento
    const numPagResult = await db.query(
      `
      SELECT MAX(numero_pagamento) as max_numero
      FROM pagamentos
      WHERE estabelecimento_id = $1
      `,
      [tenantId]
    );

    const numPagamento = (numPagResult.rows[0].max_numero || 0) + 1;

    // Registrar pagamento
    const pagamentoResult = await db.query(
      `
      INSERT INTO pagamentos (
        estabelecimento_id, comanda_id, divisao_id, numero_pagamento,
        tipo_pagamento, status, valor_total, valor_desconto, valor_acrescimo,
        valor_liquido, adquirente, id_transacao_adquirente, id_autorizacao,
        nsu_adquirente, bandeira_cartao, ultimos_digitos_cartao,
        data_pagamento, data_confirmacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
      `,
      [
        tenantId,
        comandaId,
        divisaoId,
        numPagamento,
        tipo_pagamento,
        'aprovado',
        valor_total,
        valor_desconto,
        valor_acrescimo,
        valorLiquido,
        adquirente || 'dinheiro',
        resultadoPagamento.idTransacao,
        resultadoPagamento.idAutorizacao || null,
        resultadoPagamento.nsu || null,
        resultadoPagamento.bandeira || null,
        resultadoPagamento.ultimosDigitos || null,
      ]
    );

    res.status(201).json({
      pagamento: pagamentoResult.rows[0],
      qrCode: resultadoPagamento.qrCode || null,
      qrCodeUrl: resultadoPagamento.qrCodeUrl || null,
    });
  } catch (error) {
    console.error('Erro ao pagar divisão:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Atualizar totais da divisão
 */
const atualizarTotaisDivisao = async (divisaoId) => {
  const result = await db.query(
    `
    SELECT 
      SUM(valor_total) as total_bruto
    FROM itens_divisao
    WHERE divisao_id = $1
    `,
    [divisaoId]
  );

  const totalBruto = result.rows[0].total_bruto || 0;

  await db.query(
    `
    UPDATE divisoes_comanda
    SET total_bruto = $1,
        total_liquido = $1,
        atualizado_em = NOW()
    WHERE id = $2
    `,
    [totalBruto, divisaoId]
  );
};

export default {
  criarDivisao,
  listarDivisoes,
  adicionarItemDivisao,
  removerItemDivisao,
  pagarDivisao,
};
