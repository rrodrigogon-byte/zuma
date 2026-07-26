/**
 * Controllers do Módulo PDV - Caixa
 * SetPoint Ultra - Gestão de caixas, operadores e turnos
 */

import { db } from '../../../core/database.js';

// ============================================================================
// ABERTURA E FECHAMENTO DE CAIXA
// ============================================================================

/**
 * Abrir caixa
 */
export const abrirCaixa = async (req, res) => {
  try {
    const { numero_caixa, saldo_inicial, operador_id } = req.body;
    const tenantId = req.tenantId;

    // Verificar se caixa já está aberto
    const caixaAberto = await db.query(
      `
      SELECT * FROM caixas
      WHERE estabelecimento_id = $1 AND numero_caixa = $2 AND status = 'aberto'
      `,
      [tenantId, numero_caixa]
    );

    if (caixaAberto.rows.length > 0) {
      return res.status(400).json({ error: 'Caixa já está aberto' });
    }

    // Abrir novo caixa
    const result = await db.query(
      `
      INSERT INTO caixas (
        estabelecimento_id, numero_caixa, operador_id, status,
        saldo_inicial, saldo_atual, data_abertura
      )
      VALUES ($1, $2, $3, 'aberto', $4, $4, NOW())
      RETURNING *
      `,
      [tenantId, numero_caixa, operador_id, saldo_inicial || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Fechar caixa com resumo
 */
export const fecharCaixa = async (req, res) => {
  try {
    const { numero_caixa, saldo_final } = req.body;
    const tenantId = req.tenantId;

    // Obter caixa aberto
    const caixaResult = await db.query(
      `
      SELECT * FROM caixas
      WHERE estabelecimento_id = $1 AND numero_caixa = $2 AND status = 'aberto'
      `,
      [tenantId, numero_caixa]
    );

    if (caixaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caixa não encontrado ou já fechado' });
    }

    const caixa = caixaResult.rows[0];

    // Calcular totais
    const vendas = await db.query(
      `
      SELECT 
        COUNT(*) as total_vendas,
        SUM(valor_total) as total_vendido,
        SUM(CASE WHEN tipo_pagamento = 'dinheiro' THEN valor_total ELSE 0 END) as total_dinheiro,
        SUM(CASE WHEN tipo_pagamento = 'cartao_credito' THEN valor_total ELSE 0 END) as total_cartao_credito,
        SUM(CASE WHEN tipo_pagamento = 'cartao_debito' THEN valor_total ELSE 0 END) as total_cartao_debito,
        SUM(CASE WHEN tipo_pagamento = 'pix' THEN valor_total ELSE 0 END) as total_pix
      FROM vendas
      WHERE caixa_id = $1 AND status IN ('concluida', 'fechada')
      `,
      [caixa.id]
    );

    const totais = vendas.rows[0];
    const diferenca = saldo_final - (caixa.saldo_inicial + (totais.total_dinheiro || 0));

    // Fechar caixa
    const result = await db.query(
      `
      UPDATE caixas
      SET status = 'fechado',
          saldo_final = $1,
          diferenca = $2,
          data_fechamento = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [saldo_final, diferenca, caixa.id]
    );

    res.json({
      caixa: result.rows[0],
      resumo: {
        total_vendas: totais.total_vendas,
        total_vendido: totais.total_vendido,
        total_dinheiro: totais.total_dinheiro,
        total_cartao_credito: totais.total_cartao_credito,
        total_cartao_debito: totais.total_cartao_debito,
        total_pix: totais.total_pix,
        diferenca,
      },
    });
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter caixa aberto
 */
export const obterCaixaAberto = async (req, res) => {
  try {
    const { numero_caixa } = req.query;
    const tenantId = req.tenantId;

    const result = await db.query(
      `
      SELECT c.*, u.nome as operador_nome
      FROM caixas c
      LEFT JOIN usuarios u ON c.operador_id = u.id
      WHERE c.estabelecimento_id = $1 AND c.status = 'aberto'
      ${numero_caixa ? 'AND c.numero_caixa = $2' : ''}
      `,
      numero_caixa ? [tenantId, numero_caixa] : [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter caixa aberto:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// SANGRIA E SUPRIMENTO
// ============================================================================

/**
 * Registrar sangria (retirada de dinheiro)
 */
export const registrarSangria = async (req, res) => {
  try {
    const { caixa_id, valor, motivo } = req.body;
    const tenantId = req.tenantId;

    // Obter caixa
    const caixaResult = await db.query(
      `
      SELECT * FROM caixas WHERE id = $1 AND estabelecimento_id = $2
      `,
      [caixa_id, tenantId]
    );

    if (caixaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caixa não encontrado' });
    }

    const caixa = caixaResult.rows[0];

    // Registrar sangria
    const result = await db.query(
      `
      INSERT INTO movimentacoes_caixa (
        caixa_id, tipo, valor, motivo, data_movimentacao
      )
      VALUES ($1, 'sangria', $2, $3, NOW())
      RETURNING *
      `,
      [caixa_id, valor, motivo]
    );

    // Atualizar saldo do caixa
    await db.query(
      `
      UPDATE caixas
      SET saldo_atual = saldo_atual - $1
      WHERE id = $2
      `,
      [valor, caixa_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao registrar sangria:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Registrar suprimento (adição de dinheiro)
 */
export const registrarSuprimento = async (req, res) => {
  try {
    const { caixa_id, valor, motivo } = req.body;
    const tenantId = req.tenantId;

    // Registrar suprimento
    const result = await db.query(
      `
      INSERT INTO movimentacoes_caixa (
        caixa_id, tipo, valor, motivo, data_movimentacao
      )
      VALUES ($1, 'suprimento', $2, $3, NOW())
      RETURNING *
      `,
      [caixa_id, valor, motivo]
    );

    // Atualizar saldo do caixa
    await db.query(
      `
      UPDATE caixas
      SET saldo_atual = saldo_atual + $1
      WHERE id = $2
      `,
      [valor, caixa_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao registrar suprimento:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  abrirCaixa,
  fecharCaixa,
  obterCaixaAberto,
  registrarSangria,
  registrarSuprimento,
};
