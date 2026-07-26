/**
 * ============================================================================
 * ROTAS DE CAIXA - ERP MODULAR
 * ============================================================================
 * Arquivo: routes/caixa.js
 * Descrição: Abertura, fechamento, sangria, suprimento
 * ============================================================================
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

/**
 * POST /caixa/abrir
 * Abrir caixa
 */
router.post('/abrir', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { valor_inicial = 0, observacoes } = req.body;

    // Verificar se já existe caixa aberto
    const caixaAberto = await dbPg.query(
      `SELECT * FROM caixas WHERE empresa_id = $1 AND status = 'aberto' AND DATE(data_abertura) = CURRENT_DATE`,
      [req.empresaId]
    );

    if (caixaAberto.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe um caixa aberto hoje' });
    }

    // Criar caixa
    const caixaResult = await dbPg.query(
      `INSERT INTO caixas 
       (empresa_id, usuario_id, valor_inicial, status, observacoes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.empresaId, req.usuario.usuario_id, valor_inicial, 'aberto', observacoes || null]
    );

    const caixa = caixaResult.rows[0];

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'caixas',
      operacao: 'INSERT',
      registro_id: caixa.id,
      dados_novo: { valor_inicial, status: 'aberto' },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      caixa,
      mensagem: 'Caixa aberto com sucesso'
    });
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ erro: 'Erro ao abrir caixa' });
  }
});

/**
 * POST /caixa/sangria
 * Registrar sangria (retirada de dinheiro)
 */
router.post('/sangria', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { caixa_id, valor, motivo } = req.body;

    if (!caixa_id || !valor) {
      return res.status(400).json({ erro: 'Caixa e valor são obrigatórios' });
    }

    // Validar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, req.empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa deve estar aberto' });
    }

    // Registrar movimentação
    const movResult = await dbPg.query(
      `INSERT INTO movimentacoes_caixa
       (empresa_id, caixa_id, tipo, valor, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.empresaId, caixa_id, 'sangria', valor, motivo || null, req.usuario.usuario_id]
    );

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'movimentacoes_caixa',
      operacao: 'INSERT',
      registro_id: movResult.rows[0].id,
      dados_novo: { tipo: 'sangria', valor, motivo },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      movimentacao: movResult.rows[0],
      mensagem: 'Sangria registrada'
    });
  } catch (error) {
    console.error('Erro ao registrar sangria:', error);
    res.status(500).json({ erro: 'Erro ao registrar sangria' });
  }
});

/**
 * POST /caixa/suprimento
 * Registrar suprimento (adição de dinheiro)
 */
router.post('/suprimento', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { caixa_id, valor, motivo } = req.body;

    if (!caixa_id || !valor) {
      return res.status(400).json({ erro: 'Caixa e valor são obrigatórios' });
    }

    // Validar caixa
    const caixa = await dbPg.findById('caixas', caixa_id, req.empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa deve estar aberto' });
    }

    // Registrar movimentação
    const movResult = await dbPg.query(
      `INSERT INTO movimentacoes_caixa
       (empresa_id, caixa_id, tipo, valor, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.empresaId, caixa_id, 'suprimento', valor, motivo || null, req.usuario.usuario_id]
    );

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'movimentacoes_caixa',
      operacao: 'INSERT',
      registro_id: movResult.rows[0].id,
      dados_novo: { tipo: 'suprimento', valor, motivo },
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      movimentacao: movResult.rows[0],
      mensagem: 'Suprimento registrado'
    });
  } catch (error) {
    console.error('Erro ao registrar suprimento:', error);
    res.status(500).json({ erro: 'Erro ao registrar suprimento' });
  }
});

/**
 * POST /caixa/:id/fechar
 * Fechar caixa com resumo
 */
router.post('/:id/fechar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { valor_final, observacoes } = req.body;

    if (valor_final === undefined) {
      return res.status(400).json({ erro: 'Valor final é obrigatório' });
    }

    // Validar caixa
    const caixa = await dbPg.findById('caixas', req.params.id, req.empresaId);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    if (caixa.status !== 'aberto') {
      return res.status(400).json({ erro: 'Caixa já foi fechado' });
    }

    // Buscar movimentações do caixa
    const movResult = await dbPg.query(
      `SELECT SUM(CASE WHEN tipo = 'sangria' THEN -valor ELSE valor END) as total_movimentacoes
       FROM movimentacoes_caixa
       WHERE empresa_id = $1 AND caixa_id = $2`,
      [req.empresaId, req.params.id]
    );

    const totalMovimentacoes = movResult.rows[0]?.total_movimentacoes || 0;
    const valorEsperado = caixa.valor_inicial + totalMovimentacoes;
    const diferenca = valor_final - valorEsperado;

    // Atualizar caixa
    const caixaFechado = await dbPg.update('caixas', req.params.id, {
      valor_final,
      diferenca,
      status: 'fechado',
      observacoes_fechamento: observacoes || null
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'caixas',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: { status: 'fechado', valor_final, diferenca },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      caixa: caixaFechado,
      resumo: {
        valor_inicial: caixa.valor_inicial,
        valor_esperado: valorEsperado,
        valor_final,
        diferenca,
        status_diferenca: Math.abs(diferenca) < 0.01 ? 'OK' : (diferenca > 0 ? 'SOBRA' : 'FALTA')
      },
      mensagem: 'Caixa fechado'
    });
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ erro: 'Erro ao fechar caixa' });
  }
});

/**
 * GET /caixa/aberto
 * Obter caixa aberto do dia
 */
router.get('/aberto', autenticar, async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT * FROM caixas 
       WHERE empresa_id = $1 AND status = 'aberto' AND DATE(data_abertura) = CURRENT_DATE`,
      [req.empresaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhum caixa aberto' });
    }

    const caixa = result.rows[0];

    // Buscar movimentações
    const movResult = await dbPg.query(
      `SELECT * FROM movimentacoes_caixa 
       WHERE empresa_id = $1 AND caixa_id = $2
       ORDER BY data_operacao DESC`,
      [req.empresaId, caixa.id]
    );

    res.json({
      sucesso: true,
      caixa,
      movimentacoes: movResult.rows
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar caixa' });
  }
});

/**
 * GET /caixa/relatorio
 * Relatório de caixas
 */
router.get('/relatorio', autenticar, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;

    let sql = `
      SELECT 
        COUNT(id) as total_caixas,
        SUM(valor_inicial) as total_inicial,
        SUM(valor_final) as total_final,
        COUNT(CASE WHEN diferenca = 0 THEN 1 END) as caixas_ok,
        COUNT(CASE WHEN diferenca > 0 THEN 1 END) as caixas_sobra,
        COUNT(CASE WHEN diferenca < 0 THEN 1 END) as caixas_falta,
        SUM(ABS(diferenca)) as total_divergencias
      FROM caixas
      WHERE empresa_id = $1 AND status = 'fechado'
    `;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (data_inicio) {
      sql += ` AND data_abertura >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND data_abertura <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    const result = await dbPg.query(sql, params);

    res.json({
      sucesso: true,
      relatorio: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

export default router;
