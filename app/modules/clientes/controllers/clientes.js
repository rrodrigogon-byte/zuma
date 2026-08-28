/**
 * ============================================================================
 * MÓDULO CLIENTES - LIMITES DE CRÉDITO E SCORING
 * ============================================================================
 * Arquivo: modules/clientes/controllers/clientes.js
 * Descrição: Gerenciar clientes, limites de crédito e scoring de risco
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * Criar cliente
 */
export async function criarCliente(req, res) {
  try {
    const {
      empresa_id,
      tipo, // 'pf' ou 'pj'
      nome,
      cpf_cnpj,
      email,
      telefone,
      endereco,
      limite_credito = 0,
      dias_pagamento = 30
    } = req.body;

    const result = await dbPg.query(
      `INSERT INTO clientes (
        empresa_id, tipo, nome, cpf_cnpj, email, telefone, endereco,
        limite_credito, dias_pagamento, status, data_criacao
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        empresa_id,
        tipo,
        nome,
        cpf_cnpj,
        email,
        telefone,
        endereco,
        limite_credito,
        dias_pagamento,
        'ativo'
      ]
    );

    // Criar registro de scoring
    const cliente_id = result.rows[0].id;
    await dbPg.query(
      `INSERT INTO scoring_cliente (cliente_id, score, risco)
       VALUES ($1, $2, $3)`,
      [cliente_id, 100, 'baixo']
    );

    res.json({
      sucesso: true,
      cliente: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Atualizar cliente
 */
export async function atualizarCliente(req, res) {
  try {
    const { cliente_id } = req.params;
    const { nome, email, telefone, endereco, limite_credito, dias_pagamento } = req.body;

    const result = await dbPg.query(
      `UPDATE clientes SET
        nome = COALESCE($1, nome),
        email = COALESCE($2, email),
        telefone = COALESCE($3, telefone),
        endereco = COALESCE($4, endereco),
        limite_credito = COALESCE($5, limite_credito),
        dias_pagamento = COALESCE($6, dias_pagamento)
       WHERE id = $7
       RETURNING *`,
      [nome, email, telefone, endereco, limite_credito, dias_pagamento, cliente_id]
    );

    res.json({
      sucesso: true,
      cliente: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter saldo devedor do cliente
 */
export async function obterSaldoDevedor(req, res) {
  try {
    const { cliente_id } = req.params;

    const result = await dbPg.query(
      `SELECT
        c.id,
        c.nome,
        c.limite_credito,
        COALESCE(SUM(CASE WHEN cr.status = 'pendente' THEN cr.valor ELSE 0 END), 0) as saldo_devedor,
        c.limite_credito - COALESCE(SUM(CASE WHEN cr.status = 'pendente' THEN cr.valor ELSE 0 END), 0) as limite_disponivel
       FROM clientes c
       LEFT JOIN contas_receber cr ON c.id = cr.cliente_id
       WHERE c.id = $1
       GROUP BY c.id, c.nome, c.limite_credito`,
      [cliente_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
    }

    res.json({
      sucesso: true,
      saldo: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Verificar se cliente pode comprar a crédito
 */
export async function verificarCreditoDisponivel(req, res) {
  try {
    const { cliente_id, valor_compra } = req.body;

    const saldoResult = await dbPg.query(
      `SELECT
        c.limite_credito,
        COALESCE(SUM(CASE WHEN cr.status = 'pendente' THEN cr.valor ELSE 0 END), 0) as saldo_devedor
       FROM clientes c
       LEFT JOIN contas_receber cr ON c.id = cr.cliente_id
       WHERE c.id = $1
       GROUP BY c.limite_credito`,
      [cliente_id]
    );

    if (saldoResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
    }

    const { limite_credito, saldo_devedor } = saldoResult.rows[0];
    const limite_disponivel = limite_credito - saldo_devedor;
    const pode_comprar = limite_disponivel >= valor_compra;

    res.json({
      sucesso: true,
      pode_comprar,
      limite_credito,
      saldo_devedor,
      limite_disponivel,
      valor_compra
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Calcular score de crédito
 */
export async function calcularScoreCredito(req, res) {
  try {
    const { cliente_id } = req.params;

    // Buscar histórico de pagamentos
    const historicoResult = await dbPg.query(
      `SELECT
        COUNT(*) as total_pagamentos,
        COUNT(CASE WHEN status = 'paga' THEN 1 END) as pagamentos_no_prazo,
        COUNT(CASE WHEN status = 'atrasada' THEN 1 END) as pagamentos_atrasados,
        AVG(CASE WHEN dias_atraso > 0 THEN dias_atraso ELSE 0 END) as media_dias_atraso
       FROM contas_receber
       WHERE cliente_id = $1`,
      [cliente_id]
    );

    const historico = historicoResult.rows[0];

    // Calcular score (0-100)
    let score = 100;

    // Penalidade por pagamentos atrasados
    if (historico.total_pagamentos > 0) {
      const taxa_atraso = (historico.pagamentos_atrasados / historico.total_pagamentos) * 100;
      score -= taxa_atraso * 0.5;
    }

    // Penalidade por dias de atraso
    if (historico.media_dias_atraso > 0) {
      score -= Math.min(historico.media_dias_atraso, 30);
    }

    score = Math.max(0, Math.min(100, score));

    // Determinar risco
    let risco = 'baixo';
    if (score < 50) risco = 'alto';
    else if (score < 70) risco = 'médio';

    // Atualizar scoring
    await dbPg.query(
      `UPDATE scoring_cliente SET score = $1, risco = $2, data_atualizacao = NOW()
       WHERE cliente_id = $3`,
      [score, risco, cliente_id]
    );

    res.json({
      sucesso: true,
      score,
      risco,
      historico
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Listar clientes
 */
export async function listarClientes(req, res) {
  try {
    const { empresa_id } = req.params;
    const { status } = req.query;

    let query = `SELECT c.*, s.score, s.risco
                 FROM clientes c
                 LEFT JOIN scoring_cliente s ON c.id = s.cliente_id
                 WHERE c.empresa_id = $1`;
    const params = [empresa_id];

    if (status) {
      query += ` AND c.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY c.nome`;

    const result = await dbPg.query(query, params);

    res.json({
      sucesso: true,
      clientes: result.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Obter cliente com histórico
 */
export async function obterClienteComHistorico(req, res) {
  try {
    const { cliente_id } = req.params;

    const clienteResult = await dbPg.query(
      `SELECT c.*, s.score, s.risco FROM clientes c
       LEFT JOIN scoring_cliente s ON c.id = s.cliente_id
       WHERE c.id = $1`,
      [cliente_id]
    );

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
    }

    const historicoResult = await dbPg.query(
      `SELECT * FROM contas_receber WHERE cliente_id = $1 ORDER BY data_vencimento DESC LIMIT 10`,
      [cliente_id]
    );

    res.json({
      sucesso: true,
      cliente: clienteResult.rows[0],
      historico: historicoResult.rows
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

/**
 * Suspender cliente
 */
export async function suspenderCliente(req, res) {
  try {
    const { cliente_id, motivo } = req.body;

    const result = await dbPg.query(
      `UPDATE clientes SET status = 'suspenso', motivo_suspensao = $1, data_suspensao = NOW()
       WHERE id = $2
       RETURNING *`,
      [motivo, cliente_id]
    );

    res.json({
      sucesso: true,
      cliente: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
}

export default {
  criarCliente,
  atualizarCliente,
  obterSaldoDevedor,
  verificarCreditoDisponivel,
  calcularScoreCredito,
  listarClientes,
  obterClienteComHistorico,
  suspenderCliente
};
