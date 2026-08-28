/**
 * ============================================================================
 * MÓDULO FLUXO DE PAGAMENTO - CONTAS A RECEBER/PAGAR E RECONCILIAÇÃO
 * ============================================================================
 * Arquivo: modules/financeiro/controllers/fluxo-pagamento.js
 * Descrição: Gerenciar contas a receber, contas a pagar e reconciliação
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar conta a receber
 */
export async function criarContaReceber(req, res) {
  try {
    const {
      empresa_id,
      cliente_id,
      venda_id,
      valor,
      data_vencimento,
      forma_pagamento,
      observacoes
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO contas_receber (
        empresa_id, cliente_id, venda_id, valor, data_vencimento,
        forma_pagamento, status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        empresa_id,
        cliente_id,
        venda_id,
        valor,
        data_vencimento,
        forma_pagamento,
        'pendente',
        observacoes
      ]
    );

    res.json({
      sucesso: true,
      conta: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Receber pagamento
 */
export async function receberPagamento(req, res) {
  try {
    const {
      conta_id,
      valor_recebido,
      data_pagamento,
      forma_pagamento,
      numero_documento
    } = req.body;

    // Buscar conta
    const contaResult = await dbPg.query(
      `SELECT * FROM contas_receber WHERE id = $1`,
      [conta_id]
    );

    if (contaResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Conta não encontrada' });
    }

    const conta = contaResult.rows[0];

    // Determinar status
    let status = 'paga';
    let juros = 0;
    let desconto = 0;

    if (valor_recebido < conta.valor) {
      status = 'parcialmente_paga';
      desconto = conta.valor - valor_recebido;
    } else if (valor_recebido > conta.valor) {
      juros = valor_recebido - conta.valor;
    }

    // Atualizar conta
    const updateResult = await dbPg.query(
      `UPDATE contas_receber SET
        status = $1,
        data_pagamento = $2,
        valor_recebido = $3,
        juros = $4,
        desconto = $5,
        forma_pagamento_realizada = $6,
        numero_documento = $7
       WHERE id = $8
       RETURNING *`,
      [status, data_pagamento, valor_recebido, juros, desconto, forma_pagamento, numero_documento, conta_id]
    );

    // Registrar movimento de caixa
    await dbPg.query(
      `INSERT INTO movimentacoes_caixa (
        empresa_id, tipo, descricao, valor, data_movimento, referencia_id
      )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        conta.empresa_id,
        'entrada',
        `Recebimento de ${conta.cliente_id}`,
        valor_recebido,
        data_pagamento,
        conta_id
      ]
    );

    res.json({
      sucesso: true,
      conta: updateResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Criar conta a pagar
 */
export async function criarContaPagar(req, res) {
  try {
    const {
      empresa_id,
      fornecedor_id,
      compra_id,
      valor,
      data_vencimento,
      forma_pagamento,
      observacoes
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO contas_pagar (
        empresa_id, fornecedor_id, compra_id, valor, data_vencimento,
        forma_pagamento, status, observacoes, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        empresa_id,
        fornecedor_id,
        compra_id,
        valor,
        data_vencimento,
        forma_pagamento,
        'pendente',
        observacoes
      ]
    );

    res.json({
      sucesso: true,
      conta: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Pagar conta
 */
export async function pagarConta(req, res) {
  try {
    const {
      conta_id,
      valor_pago,
      data_pagamento,
      forma_pagamento,
      numero_documento
    } = req.body;

    // Buscar conta
    const contaResult = await dbPg.query(
      `SELECT * FROM contas_pagar WHERE id = $1`,
      [conta_id]
    );

    if (contaResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Conta não encontrada' });
    }

    const conta = contaResult.rows[0];

    // Determinar status
    let status = 'paga';
    let juros = 0;
    let desconto = 0;

    if (valor_pago < conta.valor) {
      status = 'parcialmente_paga';
      desconto = conta.valor - valor_pago;
    } else if (valor_pago > conta.valor) {
      juros = valor_pago - conta.valor;
    }

    // Atualizar conta
    const updateResult = await dbPg.query(
      `UPDATE contas_pagar SET
        status = $1,
        data_pagamento = $2,
        valor_pago = $3,
        juros = $4,
        desconto = $5,
        forma_pagamento_realizada = $6,
        numero_documento = $7
       WHERE id = $8
       RETURNING *`,
      [status, data_pagamento, valor_pago, juros, desconto, forma_pagamento, numero_documento, conta_id]
    );

    // Registrar movimento de caixa
    await dbPg.query(
      `INSERT INTO movimentacoes_caixa (
        empresa_id, tipo, descricao, valor, data_movimento, referencia_id
      )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        conta.empresa_id,
        'saida',
        `Pagamento para ${conta.fornecedor_id}`,
        valor_pago,
        data_pagamento,
        conta_id
      ]
    );

    res.json({
      sucesso: true,
      conta: updateResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar contas a receber
 */
export async function listarContasReceber(req, res) {
  try {
    const { empresa_id } = req.params;
    const { status, cliente_id, data_inicio, data_fim } = req.query;

    let query = `SELECT cr.*, c.nome as cliente_nome
                 FROM contas_receber cr
                 JOIN clientes c ON cr.cliente_id = c.id
                 WHERE cr.empresa_id = $1`;
    const params = [empresa_id];

    if (status) {
      query += ` AND cr.status = $${params.length + 1}`;
      params.push(status);
    }

    if (cliente_id) {
      query += ` AND cr.cliente_id = $${params.length + 1}`;
      params.push(cliente_id);
    }

    if (data_inicio) {
      query += ` AND cr.data_vencimento >= $${params.length + 1}`;
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ` AND cr.data_vencimento <= $${params.length + 1}`;
      params.push(data_fim);
    }

    query += ` ORDER BY cr.data_vencimento ASC`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      contas: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar contas a pagar
 */
export async function listarContasPagar(req, res) {
  try {
    const { empresa_id } = req.params;
    const { status, fornecedor_id, data_inicio, data_fim } = req.query;

    let query = `SELECT cp.*, f.nome as fornecedor_nome
                 FROM contas_pagar cp
                 JOIN fornecedores f ON cp.fornecedor_id = f.id
                 WHERE cp.empresa_id = $1`;
    const params = [empresa_id];

    if (status) {
      query += ` AND cp.status = $${params.length + 1}`;
      params.push(status);
    }

    if (fornecedor_id) {
      query += ` AND cp.fornecedor_id = $${params.length + 1}`;
      params.push(fornecedor_id);
    }

    if (data_inicio) {
      query += ` AND cp.data_vencimento >= $${params.length + 1}`;
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ` AND cp.data_vencimento <= $${params.length + 1}`;
      params.push(data_fim);
    }

    query += ` ORDER BY cp.data_vencimento ASC`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      contas: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter fluxo de caixa
 */
export async function obterFluxoCaixa(req, res) {
  try {
    const { empresa_id } = req.params;
    const { data_inicio, data_fim } = req.query;

    const result = await dbPg.query(
      `SELECT
        DATE(data_movimento) as data,
        tipo,
        COUNT(*) as total_movimentacoes,
        SUM(valor) as valor_total
       FROM movimentacoes_caixa
       WHERE empresa_id = $1
       AND data_movimento >= $2
       AND data_movimento <= $3
       GROUP BY DATE(data_movimento), tipo
       ORDER BY DATE(data_movimento) DESC`,
      [empresa_id, data_inicio, data_fim]
    );

    res.json({
      sucesso: true,
      fluxo: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Reconciliar pagamentos
 */
export async function reconciliarPagamentos(req, res) {
  try {
    const { empresa_id, data_inicio, data_fim } = req.body;

    // Contas a receber reconciliadas
    const recebimentosResult = await dbPg.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paga' THEN valor_recebido ELSE 0 END) as valor_recebido,
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as valor_pendente
       FROM contas_receber
       WHERE empresa_id = $1
       AND data_vencimento >= $2
       AND data_vencimento <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    // Contas a pagar reconciliadas
    const pagamentosResult = await dbPg.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paga' THEN valor_pago ELSE 0 END) as valor_pago,
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as valor_pendente
       FROM contas_pagar
       WHERE empresa_id = $1
       AND data_vencimento >= $2
       AND data_vencimento <= $3`,
      [empresa_id, data_inicio, data_fim]
    );

    res.json({
      sucesso: true,
      recebimentos: recebimentosResult.rows[0],
      pagamentos: pagamentosResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  criarContaReceber,
  receberPagamento,
  criarContaPagar,
  pagarConta,
  listarContasReceber,
  listarContasPagar,
  obterFluxoCaixa,
  reconciliarPagamentos
};
