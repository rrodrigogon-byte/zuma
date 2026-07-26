/**
 * ============================================================================
 * ROTAS DE ESTOQUE - ERP MODULAR
 * ============================================================================
 * Arquivo: routes/estoque.js
 * Descrição: Gerenciamento de estoque, movimentações, inventário
 * ============================================================================
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

/**
 * GET /estoque/produtos
 * Listar produtos com estoque
 */
router.get('/produtos', autenticar, async (req, res) => {
  try {
    const { categoria_id, ativo, limit = 100, offset = 0 } = req.query;

    const filtros = {};
    if (ativo !== undefined) filtros.ativo = ativo === 'true';
    if (categoria_id) filtros.categoria_id = categoria_id;

    const produtos = await dbPg.findAll('produtos', filtros, req.empresaId, limit, offset);
    const total = await dbPg.count('produtos', filtros, req.empresaId);

    res.json({
      sucesso: true,
      produtos,
      paginacao: { total, limit, offset }
    });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ erro: 'Erro ao listar produtos' });
  }
});

/**
 * GET /estoque/produtos/:id
 * Obter detalhes do produto com estoque
 */
router.get('/produtos/:id', autenticar, async (req, res) => {
  try {
    const produto = await dbPg.findById('produtos', req.params.id, req.empresaId);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Buscar estoque
    const estoqueResult = await dbPg.query(
      `SELECT * FROM estoque WHERE empresa_id = $1 AND produto_id = $2`,
      [req.empresaId, req.params.id]
    );

    res.json({
      sucesso: true,
      produto,
      estoque: estoqueResult.rows
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

/**
 * POST /estoque/entrada
 * Registrar entrada de estoque (compra)
 */
router.post('/entrada', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { produto_id, quantidade, lote, validade, documento_numero, fornecedor_id, custo_unitario } = req.body;

    if (!produto_id || !quantidade) {
      return res.status(400).json({ erro: 'Produto e quantidade são obrigatórios' });
    }

    // Validar produto
    const produto = await dbPg.findById('produtos', produto_id, req.empresaId);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Registrar movimentação em transação
    const client = await dbPg.beginTransaction();
    try {
      // Buscar ou criar registro de estoque
      const estoqueResult = await dbPg.queryInTransaction(
        client,
        `SELECT id, quantidade FROM estoque 
         WHERE empresa_id = $1 AND produto_id = $2 AND lote = $3 AND validade = $4`,
        [req.empresaId, produto_id, lote || null, validade || null]
      );

      if (estoqueResult.rows.length > 0) {
        // Atualizar estoque existente
        await dbPg.queryInTransaction(
          client,
          `UPDATE estoque SET quantidade = quantidade + $1 
           WHERE id = $2`,
          [quantidade, estoqueResult.rows[0].id]
        );
      } else {
        // Criar novo registro de estoque
        await dbPg.queryInTransaction(
          client,
          `INSERT INTO estoque (empresa_id, produto_id, quantidade, lote, validade)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.empresaId, produto_id, quantidade, lote || null, validade || null]
        );
      }

      // Registrar movimentação
      const movResult = await dbPg.queryInTransaction(
        client,
        `INSERT INTO movimentacoes_estoque 
         (empresa_id, produto_id, tipo, quantidade, lote, validade, documento_numero, 
          fornecedor_id, usuario_id, custo_unitario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          req.empresaId, produto_id, 'entrada', quantidade, lote || null, validade || null,
          documento_numero || null, fornecedor_id || null, req.usuario.usuario_id, custo_unitario || 0
        ]
      );

      // Registrar auditoria
      await dbPg.registrarAuditoria({
        empresa_id: req.empresaId,
        usuario_id: req.usuario.usuario_id,
        tabela: 'movimentacoes_estoque',
        operacao: 'INSERT',
        registro_id: movResult.rows[0].id,
        dados_novo: movResult.rows[0],
        ip_address: req.ip
      });

      await dbPg.commit(client);

      res.status(201).json({
        sucesso: true,
        movimentacao: movResult.rows[0],
        mensagem: `${quantidade} unidades adicionadas ao estoque`
      });
    } catch (error) {
      await dbPg.rollback(client);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    res.status(500).json({ erro: 'Erro ao registrar entrada' });
  }
});

/**
 * POST /estoque/saida
 * Registrar saída de estoque (venda, ajuste)
 */
router.post('/saida', autenticar, autorizar('admin', 'gerente', 'vendedor', 'caixa'), async (req, res) => {
  try {
    const { produto_id, quantidade, motivo, lote } = req.body;

    if (!produto_id || !quantidade) {
      return res.status(400).json({ erro: 'Produto e quantidade são obrigatórios' });
    }

    // Validar produto
    const produto = await dbPg.findById('produtos', produto_id, req.empresaId);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Buscar estoque disponível
    const estoqueResult = await dbPg.query(
      `SELECT SUM(quantidade) as total FROM estoque 
       WHERE empresa_id = $1 AND produto_id = $2`,
      [req.empresaId, produto_id]
    );

    const quantidadeDisponivel = estoqueResult.rows[0]?.total || 0;
    if (quantidadeDisponivel < quantidade) {
      return res.status(400).json({ 
        erro: 'Estoque insuficiente',
        disponivel: quantidadeDisponivel,
        solicitado: quantidade
      });
    }

    // Registrar movimentação em transação
    const client = await dbPg.beginTransaction();
    try {
      // Buscar estoque com FIFO (mais antigo primeiro)
      const estoquesFIFO = await dbPg.queryInTransaction(
        client,
        `SELECT id, quantidade FROM estoque 
         WHERE empresa_id = $1 AND produto_id = $2 AND quantidade > 0
         ORDER BY data_atualizacao ASC
         FOR UPDATE`,
        [req.empresaId, produto_id]
      );

      let quantidadeRestante = quantidade;
      for (const est of estoquesFIFO.rows) {
        if (quantidadeRestante <= 0) break;

        const quantidadeRetirada = Math.min(est.quantidade, quantidadeRestante);
        await dbPg.queryInTransaction(
          client,
          `UPDATE estoque SET quantidade = quantidade - $1 WHERE id = $2`,
          [quantidadeRetirada, est.id]
        );

        quantidadeRestante -= quantidadeRetirada;
      }

      // Registrar movimentação
      const movResult = await dbPg.queryInTransaction(
        client,
        `INSERT INTO movimentacoes_estoque 
         (empresa_id, produto_id, tipo, quantidade, motivo, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.empresaId, produto_id, 'saida', quantidade, motivo || null, req.usuario.usuario_id]
      );

      // Registrar auditoria
      await dbPg.registrarAuditoria({
        empresa_id: req.empresaId,
        usuario_id: req.usuario.usuario_id,
        tabela: 'movimentacoes_estoque',
        operacao: 'INSERT',
        registro_id: movResult.rows[0].id,
        dados_novo: movResult.rows[0],
        ip_address: req.ip
      });

      await dbPg.commit(client);

      res.status(201).json({
        sucesso: true,
        movimentacao: movResult.rows[0],
        mensagem: `${quantidade} unidades removidas do estoque`
      });
    } catch (error) {
      await dbPg.rollback(client);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    res.status(500).json({ erro: 'Erro ao registrar saída' });
  }
});

/**
 * GET /estoque/movimentacoes
 * Listar movimentações de estoque
 */
router.get('/movimentacoes', autenticar, async (req, res) => {
  try {
    const { tipo, produto_id, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;

    let sql = `SELECT * FROM movimentacoes_estoque WHERE empresa_id = $1`;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (tipo) {
      sql += ` AND tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    if (produto_id) {
      sql += ` AND produto_id = $${paramIndex}`;
      params.push(produto_id);
      paramIndex++;
    }

    if (data_inicio) {
      sql += ` AND data_operacao >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND data_operacao <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    sql += ` ORDER BY data_operacao DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await dbPg.query(sql, params);

    // Contar total
    let countSql = `SELECT COUNT(*) as total FROM movimentacoes_estoque WHERE empresa_id = $1`;
    const countParams = [req.empresaId];
    if (tipo) countSql += ` AND tipo = $2`;
    if (produto_id) countSql += ` AND produto_id = $${tipo ? 3 : 2}`;

    const countResult = await dbPg.query(countSql, countParams);

    res.json({
      sucesso: true,
      movimentacoes: result.rows,
      paginacao: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    res.status(500).json({ erro: 'Erro ao listar movimentações' });
  }
});

/**
 * GET /estoque/relatorio
 * Relatório de estoque
 */
router.get('/relatorio', autenticar, async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT 
        p.id, p.codigo_interno, p.nome, p.preco_custo, p.preco_venda,
        COALESCE(SUM(e.quantidade), 0) as quantidade_total,
        COALESCE(SUM(e.quantidade), 0) * p.preco_custo as valor_total,
        CASE 
          WHEN COALESCE(SUM(e.quantidade), 0) <= p.estoque_minimo THEN 'CRÍTICO'
          WHEN COALESCE(SUM(e.quantidade), 0) <= p.estoque_minimo * 1.5 THEN 'BAIXO'
          ELSE 'OK'
        END as status
      FROM produtos p
      LEFT JOIN estoque e ON p.id = e.produto_id AND e.empresa_id = $1
      WHERE p.empresa_id = $1 AND p.ativo = true
      GROUP BY p.id, p.codigo_interno, p.nome, p.preco_custo, p.preco_venda, p.estoque_minimo
      ORDER BY status DESC, quantidade_total ASC`,
      [req.empresaId]
    );

    res.json({
      sucesso: true,
      relatorio: result.rows
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

export default router;
