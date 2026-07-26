/**
 * ============================================================================
 * MÓDULO CAIXA - CONTROLLER DE CAIXA DIÁRIO
 * ============================================================================
 * Arquivo: app/modules/caixa/controllers/caixa-diario.js
 * Descrição: Abertura, fechamento, sangria, suprimento e auditoria completa
 * Versão: 2.0 (Kytto ERP)
 * ============================================================================
 */

import * as dbPg from '../../../db-pg.js';

/**
 * ============================================================================
 * ABERTURA DE CAIXA
 * ============================================================================
 */

/**
 * POST /caixa-diario/abrir
 * Abrir um novo caixa para o dia
 * 
 * Body:
 *   - numero_caixa: INT (número do caixa, ex: 1, 2, 3)
 *   - valor_abertura: DECIMAL (saldo inicial, padrão 0)
 *   - observacoes: TEXT (opcional)
 * 
 * Response: { caixa, mensagem }
 */
export const abrirCaixa = async (req, res) => {
  try {
    const { numero_caixa, valor_abertura = 0, observacoes } = req.body;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações
    if (!numero_caixa) {
      return res.status(400).json({ erro: 'Número do caixa é obrigatório' });
    }

    if (valor_abertura < 0) {
      return res.status(400).json({ erro: 'Valor de abertura não pode ser negativo' });
    }

    // Verificar se já existe caixa aberto hoje
    const caixaAberto = await dbPg.query(
      `SELECT * FROM caixas 
       WHERE empresa_id = $1 AND numero_caixa = $2 AND status = 'aberto' 
       AND DATE(data_abertura) = CURRENT_DATE`,
      [empresaId, numero_caixa]
    );

    if (caixaAberto.rows.length > 0) {
      return res.status(400).json({ 
        erro: 'Já existe um caixa aberto para este número hoje',
        caixa_existente: caixaAberto.rows[0]
      });
    }

    // Criar novo caixa
    const result = await dbPg.query(
      `INSERT INTO caixas 
       (empresa_id, numero_caixa, usuario_operador_id, valor_abertura, status, observacoes)
       VALUES ($1, $2, $3, $4, 'aberto', $5)
       RETURNING *`,
      [empresaId, numero_caixa, usuarioId, valor_abertura, observacoes || null]
    );

    const caixa = result.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'caixas',
      operacao: 'INSERT',
      registro_id: caixa.id,
      dados_novo: {
        numero_caixa,
        valor_abertura,
        status: 'aberto'
      },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      caixa,
      mensagem: `Caixa #${numero_caixa} aberto com sucesso`
    });
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ erro: 'Erro ao abrir caixa', detalhes: error.message });
  }
};

/**
 * GET /caixa-diario/aberto
 * Obter caixa aberto do dia
 * 
 * Query:
 *   - numero_caixa: INT (opcional, filtrar por número)
 * 
 * Response: [ { caixa com dados de operador } ]
 */
export const obterCaixaAberto = async (req, res) => {
  try {
    const { numero_caixa } = req.query;
    const empresaId = req.tenantId || req.empresaId;

    let sql = `
      SELECT c.*, u.nome_completo as operador_nome, u.email as operador_email
      FROM caixas c
      LEFT JOIN usuarios u ON c.usuario_operador_id = u.id
      WHERE c.empresa_id = $1 AND c.status = 'aberto' AND DATE(c.data_abertura) = CURRENT_DATE
    `;
    const params = [empresaId];

    if (numero_caixa) {
      sql += ` AND c.numero_caixa = $2`;
      params.push(numero_caixa);
    }

    sql += ` ORDER BY c.data_abertura DESC`;

    const result = await dbPg.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter caixa aberto:', error);
    res.status(500).json({ erro: 'Erro ao obter caixa aberto', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * SANGRIA E SUPRIMENTO
 * ============================================================================
 */

/**
 * POST /caixa-diario/sangria
 * Registrar sangria (retirada de dinheiro)
 * 
 * Body:
 *   - caixa_id: UUID (ID do caixa)
 *   - valor: DECIMAL (valor a retirar)
 *   - descricao: TEXT (motivo da sangria)
 * 
 * Response: { movimentacao, mensagem }
 */
export const registrarSangria = async (req, res) => {
  try {
    const { caixa_id, valor, descricao } = req.body;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações
    if (!caixa_id || !valor) {
      return res.status(400).json({ erro: 'Caixa e valor são obrigatórios' });
    }

    if (valor <= 0) {
      return res.status(400).json({ erro: 'Valor de sangria deve ser positivo' });
    }

    // Verificar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa deve estar aberto para registrar sangria' });
    }

    // Registrar movimentação
    const movResult = await dbPg.query(
      `INSERT INTO movimentacoes_caixa 
       (caixa_id, tipo, valor, descricao, usuario_id)
       VALUES ($1, 'sangria', $2, $3, $4)
       RETURNING *`,
      [caixa_id, valor, descricao || null, usuarioId]
    );

    const movimentacao = movResult.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'movimentacoes_caixa',
      operacao: 'INSERT',
      registro_id: movimentacao.id,
      dados_novo: {
        tipo: 'sangria',
        valor,
        descricao
      },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      movimentacao,
      mensagem: `Sangria de R$ ${valor.toFixed(2)} registrada`
    });
  } catch (error) {
    console.error('Erro ao registrar sangria:', error);
    res.status(500).json({ erro: 'Erro ao registrar sangria', detalhes: error.message });
  }
};

/**
 * POST /caixa-diario/suprimento
 * Registrar suprimento (adição de dinheiro)
 * 
 * Body:
 *   - caixa_id: UUID (ID do caixa)
 *   - valor: DECIMAL (valor a adicionar)
 *   - descricao: TEXT (motivo do suprimento)
 * 
 * Response: { movimentacao, mensagem }
 */
export const registrarSuprimento = async (req, res) => {
  try {
    const { caixa_id, valor, descricao } = req.body;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações
    if (!caixa_id || !valor) {
      return res.status(400).json({ erro: 'Caixa e valor são obrigatórios' });
    }

    if (valor <= 0) {
      return res.status(400).json({ erro: 'Valor de suprimento deve ser positivo' });
    }

    // Verificar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa deve estar aberto para registrar suprimento' });
    }

    // Registrar movimentação
    const movResult = await dbPg.query(
      `INSERT INTO movimentacoes_caixa 
       (caixa_id, tipo, valor, descricao, usuario_id)
       VALUES ($1, 'suprimento', $2, $3, $4)
       RETURNING *`,
      [caixa_id, valor, descricao || null, usuarioId]
    );

    const movimentacao = movResult.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tabela: 'movimentacoes_caixa',
      operacao: 'INSERT',
      registro_id: movimentacao.id,
      dados_novo: {
        tipo: 'suprimento',
        valor,
        descricao
      },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      movimentacao,
      mensagem: `Suprimento de R$ ${valor.toFixed(2)} registrado`
    });
  } catch (error) {
    console.error('Erro ao registrar suprimento:', error);
    res.status(500).json({ erro: 'Erro ao registrar suprimento', detalhes: error.message });
  }
};

/**
 * ============================================================================
 * FECHAMENTO DE CAIXA
 * ============================================================================
 */

/**
 * POST /caixa-diario/fechar
 * Fechar caixa com resumo completo
 * 
 * Body:
 *   - caixa_id: UUID (ID do caixa)
 *   - valor_contado: DECIMAL (valor físico contado)
 *   - observacoes: TEXT (opcional)
 * 
 * Response: { caixa, fechamento, resumo, mensagem }
 */
export const fecharCaixa = async (req, res) => {
  try {
    const { caixa_id, valor_contado, observacoes } = req.body;
    const empresaId = req.tenantId || req.empresaId;
    const usuarioId = req.user?.id || req.usuario?.usuario_id;

    // Validações
    if (!caixa_id || valor_contado === undefined) {
      return res.status(400).json({ erro: 'Caixa e valor contado são obrigatórios' });
    }

    if (valor_contado < 0) {
      return res.status(400).json({ erro: 'Valor contado não pode ser negativo' });
    }

    // Verificar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa já foi fechado' });
    }

    // Calcular movimentações do caixa
    const movResult = await dbPg.query(
      `SELECT 
         SUM(CASE WHEN tipo = 'sangria' THEN -valor ELSE valor END) as total_movimentacoes,
         SUM(CASE WHEN tipo = 'sangria' THEN valor ELSE 0 END) as total_sangria,
         SUM(CASE WHEN tipo = 'suprimento' THEN valor ELSE 0 END) as total_suprimento
       FROM movimentacoes_caixa
       WHERE caixa_id = $1`,
      [caixa_id]
    );

    const movimentacoes = movResult.rows[0];
    const totalMovimentacoes = movimentacoes.total_movimentacoes || 0;
    const totalSangria = movimentacoes.total_sangria || 0;
    const totalSuprimento = movimentacoes.total_suprimento || 0;

    // Calcular valor esperado
    const valorEsperado = parseFloat(caixa.valor_abertura || 0) + totalMovimentacoes;
    const divergencia = valor_contado - valorEsperado;

    // Usar transação para garantir integridade
    const client = await dbPg.beginTransaction();

    try {
      // Atualizar status do caixa
      await dbPg.queryInTransaction(
        client,
        `UPDATE caixas 
         SET status = 'fechado', valor_fechamento = $1, data_fechamento = NOW()
         WHERE id = $2`,
        [valor_contado, caixa_id]
      );

      // Criar registro de fechamento
      const fechamentoResult = await dbPg.queryInTransaction(
        client,
        `INSERT INTO fechamentos_caixa 
         (caixa_id, valor_esperado, valor_contado, divergencia, usuario_responsavel_id, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [caixa_id, valorEsperado, valor_contado, divergencia, usuarioId, observacoes || null]
      );

      const fechamento = fechamentoResult.rows[0];

      // Commit da transação
      await dbPg.commit(client);

      // Registrar auditoria
      await dbPg.registrarAuditoria({
        empresa_id: empresaId,
        usuario_id: usuarioId,
        tabela: 'caixas',
        operacao: 'UPDATE',
        registro_id: caixa_id,
        dados_novo: {
          status: 'fechado',
          valor_fechamento: valor_contado,
          divergencia
        },
        ip_address: req.ip
      });

      // Buscar dados atualizados do caixa
      const caixaFechado = await dbPg.findById('caixas', caixa_id, empresaId);

      // Calcular totais por forma de pagamento (se houver vendas)
      const pagamentosResult = await dbPg.query(
        `SELECT 
           fp.nome as forma_pagamento,
           COUNT(p.id) as quantidade,
           SUM(p.valor) as total
         FROM pagamentos p
         JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
         WHERE p.empresa_id = $1 AND DATE(p.data_pagamento) = CURRENT_DATE
         GROUP BY fp.nome
         ORDER BY SUM(p.valor) DESC`,
        [empresaId]
      );

      const resumo = {
        valor_abertura: parseFloat(caixa.valor_abertura || 0),
        total_sangria: totalSangria,
        total_suprimento: totalSuprimento,
        total_movimentacoes: totalMovimentacoes,
        valor_esperado: valorEsperado,
        valor_contado,
        divergencia,
        status_divergencia: Math.abs(divergencia) < 0.01 ? 'OK' : (divergencia > 0 ? 'SOBRA' : 'FALTA'),
        formas_pagamento: pagamentosResult.rows
      };

      res.json({
        sucesso: true,
        caixa: caixaFechado,
        fechamento,
        resumo,
        mensagem: 'Caixa fechado com sucesso'
      });
    } catch (error) {
      await dbPg.rollback(client);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ erro: 'Erro ao fechar caixa', detalhes: error.message });
  }
};

/**
 * GET /caixa-diario/:caixa_id/movimentacoes
 * Obter todas as movimentações de um caixa
 * 
 * Response: [ { movimentacao com dados do usuário } ]
 */
export const obterMovimentacoes = async (req, res) => {
  try {
    const { caixa_id } = req.params;
    const empresaId = req.tenantId || req.empresaId;

    // Verificar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    const result = await dbPg.query(
      `SELECT 
         mc.*,
         u.nome_completo as usuario_nome
       FROM movimentacoes_caixa mc
       LEFT JOIN usuarios u ON mc.usuario_id = u.id
       WHERE mc.caixa_id = $1
       ORDER BY mc.data_operacao DESC`,
      [caixa_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao obter movimentações:', error);
    res.status(500).json({ erro: 'Erro ao obter movimentações', detalhes: error.message });
  }
};

/**
 * GET /caixa-diario/relatorio/diario
 * Obter relatório diário de caixas
 * 
 * Query:
 *   - data: DATE (opcional, padrão hoje)
 *   - numero_caixa: INT (opcional)
 * 
 * Response: { caixas, totais }
 */
export const relatoriosDiario = async (req, res) => {
  try {
    const { data = new Date().toISOString().split('T')[0], numero_caixa } = req.query;
    const empresaId = req.tenantId || req.empresaId;

    let sql = `
      SELECT 
        c.*,
        u.nome_completo as operador_nome,
        COUNT(mc.id) as total_movimentacoes,
        SUM(CASE WHEN mc.tipo = 'sangria' THEN mc.valor ELSE 0 END) as total_sangria,
        SUM(CASE WHEN mc.tipo = 'suprimento' THEN mc.valor ELSE 0 END) as total_suprimento,
        fc.divergencia,
        fc.data_fechamento
      FROM caixas c
      LEFT JOIN usuarios u ON c.usuario_operador_id = u.id
      LEFT JOIN movimentacoes_caixa mc ON c.id = mc.caixa_id
      LEFT JOIN fechamentos_caixa fc ON c.id = fc.caixa_id
      WHERE c.empresa_id = $1 AND DATE(c.data_abertura) = $2
    `;
    const params = [empresaId, data];

    if (numero_caixa) {
      sql += ` AND c.numero_caixa = $3`;
      params.push(numero_caixa);
    }

    sql += ` GROUP BY c.id, u.id, fc.id ORDER BY c.numero_caixa ASC`;

    const result = await dbPg.query(sql, params);

    // Calcular totais gerais
    const totaisGerais = result.rows.reduce((acc, caixa) => ({
      total_caixas: acc.total_caixas + 1,
      total_sangria: acc.total_sangria + (parseFloat(caixa.total_sangria) || 0),
      total_suprimento: acc.total_suprimento + (parseFloat(caixa.total_suprimento) || 0),
      total_divergencia: acc.total_divergencia + (parseFloat(caixa.divergencia) || 0)
    }), { total_caixas: 0, total_sangria: 0, total_suprimento: 0, total_divergencia: 0 });

    res.json({
      data,
      caixas: result.rows,
      totais: totaisGerais
    });
  } catch (error) {
    console.error('Erro ao gerar relatório diário:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório diário', detalhes: error.message });
  }
};

export default {
  abrirCaixa,
  obterCaixaAberto,
  registrarSangria,
  registrarSuprimento,
  fecharCaixa,
  obterMovimentacoes,
  relatoriosDiario
};
