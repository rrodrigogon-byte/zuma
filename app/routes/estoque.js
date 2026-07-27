/**
 * ============================================================================
 * ROTAS DE ESTOQUE — KYTTO ERP
 * ============================================================================
 * Saldos e movimentações são isolados por empresa e por loja ativa.
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

function numeroPositivo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/** GET /estoque/produtos — catálogo corporativo com saldo da loja ativa. */
router.get('/produtos', autenticar, async (req, res) => {
  try {
    const { categoria_id, ativo, limit = 100, offset = 0 } = req.query;
    const parametros = [req.empresaId, req.lojaId];
    let indice = 3;
    let sql = `
      SELECT p.*, COALESCE(SUM(e.quantidade), 0) AS quantidade_estoque
      FROM produtos p
      LEFT JOIN estoque e
        ON e.produto_id = p.id
       AND e.empresa_id = $1
       AND e.loja_id = $2
      WHERE p.empresa_id = $1
    `;

    if (ativo !== undefined) {
      sql += ` AND p.ativo = $${indice}`;
      parametros.push(ativo === 'true');
      indice += 1;
    }
    if (categoria_id) {
      sql += ` AND p.categoria_id = $${indice}`;
      parametros.push(categoria_id);
      indice += 1;
    }

    sql += ` GROUP BY p.id ORDER BY p.nome LIMIT $${indice} OFFSET $${indice + 1}`;
    parametros.push(Math.min(Math.max(Number(limit) || 100, 1), 500), Math.max(Number(offset) || 0, 0));

    const resultado = await dbPg.query(sql, parametros);
    const total = await dbPg.query(
      `SELECT COUNT(*)::int AS total FROM produtos
       WHERE empresa_id = $1
         AND ($2::uuid IS NULL OR categoria_id = $2)
         AND ($3::boolean IS NULL OR ativo = $3)`,
      [req.empresaId, categoria_id || null, ativo === undefined ? null : ativo === 'true']
    );

    res.json({
      sucesso: true,
      loja_id: req.lojaId,
      produtos: resultado.rows,
      paginacao: {
        total: total.rows[0].total,
        limit: Math.min(Math.max(Number(limit) || 100, 1), 500),
        offset: Math.max(Number(offset) || 0, 0),
      },
    });
  } catch (error) {
    console.error('Erro ao listar estoque:', error);
    res.status(500).json({ erro: 'Erro ao listar estoque' });
  }
});

/** GET /estoque/produtos/:id — detalhe de produto e lotes da loja ativa. */
router.get('/produtos/:id', autenticar, async (req, res) => {
  try {
    const produto = await dbPg.findById('produtos', req.params.id, req.empresaId);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    const estoque = await dbPg.query(
      `SELECT * FROM estoque
       WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3
       ORDER BY validade NULLS LAST, data_atualizacao ASC`,
      [req.empresaId, req.lojaId, req.params.id]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, produto, estoque: estoque.rows });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

/** POST /estoque/entrada — recebe estoque na loja ativa. */
router.post('/entrada', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const {
      produto_id,
      quantidade,
      lote = null,
      validade = null,
      documento_numero = null,
      fornecedor_id = null,
      custo_unitario = 0,
    } = req.body;
    const quantidadeNumerica = numeroPositivo(quantidade);
    if (!produto_id || !quantidadeNumerica) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Produto e quantidade positiva são obrigatórios' });
    }

    const produto = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM produtos WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [produto_id, req.empresaId]
    );
    if (produto.rows.length === 0) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Produto não encontrado ou inativo' });
    }

    const saldo = await dbPg.queryInTransaction(
      client,
      `SELECT id, quantidade FROM estoque
       WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3
         AND lote IS NOT DISTINCT FROM $4
         AND validade IS NOT DISTINCT FROM $5
       FOR UPDATE`,
      [req.empresaId, req.lojaId, produto_id, lote, validade]
    );

    if (saldo.rows.length > 0) {
      await dbPg.queryInTransaction(
        client,
        `UPDATE estoque
         SET quantidade = quantidade + $1, data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantidadeNumerica, saldo.rows[0].id]
      );
    } else {
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO estoque (empresa_id, loja_id, produto_id, quantidade, lote, validade)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.empresaId, req.lojaId, produto_id, quantidadeNumerica, lote, validade]
      );
    }

    const movimentacao = await dbPg.queryInTransaction(
      client,
      `INSERT INTO movimentacoes_estoque
       (empresa_id, loja_id, produto_id, tipo, quantidade, lote, validade, documento_numero,
        fornecedor_id, usuario_id, custo_unitario)
       VALUES ($1, $2, $3, 'entrada', $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.empresaId,
        req.lojaId,
        produto_id,
        quantidadeNumerica,
        lote,
        validade,
        documento_numero,
        fornecedor_id,
        req.usuario.usuario_id,
        Number(custo_unitario) || 0,
      ]
    );

    await dbPg.commit(client);
    res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      movimentacao: movimentacao.rows[0],
      mensagem: `${quantidadeNumerica} unidades adicionadas ao estoque`,
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao registrar entrada:', error);
    res.status(500).json({ erro: 'Erro ao registrar entrada' });
  }
});

/** POST /estoque/saida — baixa estoque com FIFO exclusivamente na loja ativa. */
router.post('/saida', autenticar, autorizar('admin', 'gerente', 'vendedor', 'caixa'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const { produto_id, quantidade, motivo = null } = req.body;
    const quantidadeNumerica = numeroPositivo(quantidade);
    if (!produto_id || !quantidadeNumerica) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Produto e quantidade positiva são obrigatórios' });
    }

    const produto = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM produtos WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [produto_id, req.empresaId]
    );
    if (produto.rows.length === 0) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Produto não encontrado ou inativo' });
    }

    const saldos = await dbPg.queryInTransaction(
      client,
      `SELECT id, quantidade FROM estoque
       WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3 AND quantidade > 0
       ORDER BY validade NULLS LAST, data_atualizacao ASC
       FOR UPDATE`,
      [req.empresaId, req.lojaId, produto_id]
    );
    const disponivel = saldos.rows.reduce((total, item) => total + Number(item.quantidade), 0);
    if (disponivel < quantidadeNumerica) {
      await dbPg.rollback(client);
      return res.status(400).json({
        erro: 'Estoque insuficiente nesta loja',
        disponivel,
        solicitado: quantidadeNumerica,
      });
    }

    let restante = quantidadeNumerica;
    for (const saldo of saldos.rows) {
      if (restante <= 0) break;
      const retirada = Math.min(Number(saldo.quantidade), restante);
      await dbPg.queryInTransaction(
        client,
        `UPDATE estoque
         SET quantidade = quantidade - $1, data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [retirada, saldo.id]
      );
      restante -= retirada;
    }

    const movimentacao = await dbPg.queryInTransaction(
      client,
      `INSERT INTO movimentacoes_estoque
       (empresa_id, loja_id, produto_id, tipo, quantidade, motivo, usuario_id)
       VALUES ($1, $2, $3, 'saida', $4, $5, $6)
       RETURNING *`,
      [req.empresaId, req.lojaId, produto_id, quantidadeNumerica, motivo, req.usuario.usuario_id]
    );

    await dbPg.commit(client);
    res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      movimentacao: movimentacao.rows[0],
      mensagem: `${quantidadeNumerica} unidades removidas do estoque`,
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao registrar saída:', error);
    res.status(500).json({ erro: 'Erro ao registrar saída' });
  }
});

/** GET /estoque/movimentacoes — lista eventos de estoque da loja ativa. */
router.get('/movimentacoes', autenticar, async (req, res) => {
  try {
    const { tipo, produto_id, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;
    const parametros = [req.empresaId, req.lojaId];
    let indice = 3;
    let sql = `SELECT * FROM movimentacoes_estoque WHERE empresa_id = $1 AND loja_id = $2`;

    if (tipo) { sql += ` AND tipo = $${indice}`; parametros.push(tipo); indice += 1; }
    if (produto_id) { sql += ` AND produto_id = $${indice}`; parametros.push(produto_id); indice += 1; }
    if (data_inicio) { sql += ` AND data_operacao >= $${indice}`; parametros.push(data_inicio); indice += 1; }
    if (data_fim) { sql += ` AND data_operacao <= $${indice}`; parametros.push(data_fim); indice += 1; }

    const limitSeguro = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const offsetSeguro = Math.max(Number(offset) || 0, 0);
    sql += ` ORDER BY data_operacao DESC LIMIT $${indice} OFFSET $${indice + 1}`;
    parametros.push(limitSeguro, offsetSeguro);

    const resultado = await dbPg.query(sql, parametros);

    const filtros = [req.empresaId, req.lojaId];
    let countSql = `SELECT COUNT(*)::int AS total FROM movimentacoes_estoque WHERE empresa_id = $1 AND loja_id = $2`;
    let countIndice = 3;
    if (tipo) { countSql += ` AND tipo = $${countIndice}`; filtros.push(tipo); countIndice += 1; }
    if (produto_id) { countSql += ` AND produto_id = $${countIndice}`; filtros.push(produto_id); countIndice += 1; }
    if (data_inicio) { countSql += ` AND data_operacao >= $${countIndice}`; filtros.push(data_inicio); countIndice += 1; }
    if (data_fim) { countSql += ` AND data_operacao <= $${countIndice}`; filtros.push(data_fim); }
    const total = await dbPg.query(countSql, filtros);

    res.json({
      sucesso: true,
      loja_id: req.lojaId,
      movimentacoes: resultado.rows,
      paginacao: { total: total.rows[0].total, limit: limitSeguro, offset: offsetSeguro },
    });
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    res.status(500).json({ erro: 'Erro ao listar movimentações' });
  }
});

/** GET /estoque/relatorio — posição de estoque e alertas por loja ativa. */
router.get('/relatorio', autenticar, async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `SELECT
        p.id, p.codigo_interno, p.nome, p.preco_custo, p.preco_venda,
        COALESCE(SUM(e.quantidade), 0) AS quantidade_total,
        COALESCE(SUM(e.quantidade), 0) * p.preco_custo AS valor_total,
        CASE
          WHEN COALESCE(SUM(e.quantidade), 0) <= COALESCE(p.estoque_minimo, 0) THEN 'CRITICO'
          WHEN COALESCE(SUM(e.quantidade), 0) <= COALESCE(p.estoque_minimo, 0) * 1.5 THEN 'BAIXO'
          ELSE 'OK'
        END AS status
      FROM produtos p
      LEFT JOIN estoque e
        ON p.id = e.produto_id AND e.empresa_id = $1 AND e.loja_id = $2
      WHERE p.empresa_id = $1 AND p.ativo = true
      GROUP BY p.id, p.codigo_interno, p.nome, p.preco_custo, p.preco_venda, p.estoque_minimo
      ORDER BY status DESC, quantidade_total ASC`,
      [req.empresaId, req.lojaId]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, relatorio: resultado.rows });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

export default router;
