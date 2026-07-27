/**
 * ============================================================================
 * ROTAS DE VENDAS E PDV — KYTTO ERP
 * ============================================================================
 * Vendas, comandas e itens sempre operam no contexto da loja autenticada.
 */

import express from 'express';
import { randomUUID } from 'crypto';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();
const TIPOS_VENDA = ['pdv', 'comanda', 'delivery', 'online'];

function numeroVenda(tipoVenda) {
  const agora = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${tipoVenda.slice(0, 3).toUpperCase()}-${agora}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function buscarVendaDaLoja(vendaId, empresaId, lojaId) {
  const resultado = await dbPg.query(
    `SELECT * FROM vendas WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
    [vendaId, empresaId, lojaId]
  );
  return resultado.rows[0] || null;
}

/** POST /vendas/criar — abre uma venda na loja ativa. */
router.post('/criar', autenticar, autorizar('admin', 'gerente', 'vendedor', 'garcom', 'caixa'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const { tipo_venda, mesa_numero = null, observacoes = null } = req.body;
    if (!TIPOS_VENDA.includes(tipo_venda)) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Tipo de venda inválido' });
    }

    const vendaResultado = await dbPg.queryInTransaction(
      client,
      `INSERT INTO vendas
       (empresa_id, loja_id, numero_venda, usuario_vendedor_id, tipo_venda, status, valor_bruto, valor_liquido, observacoes)
       VALUES ($1, $2, $3, $4, $5, 'aberta', 0, 0, $6)
       RETURNING *`,
      [
        req.empresaId,
        req.lojaId,
        numeroVenda(tipo_venda),
        req.usuario.usuario_id,
        tipo_venda,
        observacoes,
      ]
    );
    const venda = vendaResultado.rows[0];

    let comanda = null;
    if (tipo_venda === 'comanda') {
      const proximoNumero = await dbPg.queryInTransaction(
        client,
        `SELECT COALESCE(MAX(numero_comanda), 0) + 1 AS numero
         FROM comandas
         WHERE empresa_id = $1 AND loja_id = $2
         FOR UPDATE`,
        [req.empresaId, req.lojaId]
      );
      const comandaResultado = await dbPg.queryInTransaction(
        client,
        `INSERT INTO comandas
         (empresa_id, loja_id, venda_id, numero_comanda, mesa_numero, usuario_garcom_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'aberta')
         RETURNING *`,
        [
          req.empresaId,
          req.lojaId,
          venda.id,
          proximoNumero.rows[0].numero,
          mesa_numero,
          req.usuario.usuario_id,
        ]
      );
      comanda = comandaResultado.rows[0];
    }

    await dbPg.commit(client);
    res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      venda,
      comanda,
      mensagem: tipo_venda === 'comanda' ? 'Comanda criada' : 'Venda criada',
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ erro: 'Erro ao criar venda' });
  }
});

/** POST /vendas/:id/adicionar-item — adiciona item a uma venda aberta da loja. */
router.post('/:id/adicionar-item', autenticar, autorizar('admin', 'gerente', 'vendedor', 'garcom', 'caixa'), async (req, res) => {
  try {
    const { produto_id, quantidade, desconto_item = 0, observacoes = null } = req.body;
    const quantidadeNumerica = Number(quantidade);
    if (!produto_id || !Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      return res.status(400).json({ erro: 'Produto e quantidade positiva são obrigatórios' });
    }

    const venda = await buscarVendaDaLoja(req.params.id, req.empresaId, req.lojaId);
    if (!venda) return res.status(404).json({ erro: 'Venda não encontrada nesta loja' });
    if (venda.status !== 'aberta') return res.status(400).json({ erro: 'Venda já foi fechada ou cancelada' });

    const produto = await dbPg.query(
      `SELECT id, nome, preco_venda FROM produtos
       WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [produto_id, req.empresaId]
    );
    if (produto.rows.length === 0) return res.status(404).json({ erro: 'Produto não encontrado ou inativo' });

    const estoque = await dbPg.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM estoque
       WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3`,
      [req.empresaId, req.lojaId, produto_id]
    );
    if (Number(estoque.rows[0].total) < quantidadeNumerica) {
      return res.status(400).json({
        erro: 'Estoque insuficiente nesta loja',
        disponivel: Number(estoque.rows[0].total),
      });
    }

    const valorUnitario = Number(produto.rows[0].preco_venda);
    const desconto = Math.max(Number(desconto_item) || 0, 0);
    const valorTotal = Math.max((valorUnitario * quantidadeNumerica) - desconto, 0);

    const item = await dbPg.query(
      `INSERT INTO itens_venda
       (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_item, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, produto_id, quantidadeNumerica, valorUnitario, valorTotal, desconto, observacoes]
    );

    const totais = await dbPg.query(
      `SELECT COALESCE(SUM(valor_total), 0) AS total, COALESCE(SUM(desconto_item), 0) AS descontos
       FROM itens_venda WHERE venda_id = $1`,
      [req.params.id]
    );
    const vendaAtualizada = await dbPg.query(
      `UPDATE vendas
       SET valor_bruto = $1, valor_desconto = $2, valor_liquido = $1, data_venda = CURRENT_TIMESTAMP
       WHERE id = $3 AND empresa_id = $4 AND loja_id = $5
       RETURNING *`,
      [totais.rows[0].total, totais.rows[0].descontos, req.params.id, req.empresaId, req.lojaId]
    );

    res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      item: item.rows[0],
      venda: vendaAtualizada.rows[0],
    });
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ erro: 'Erro ao adicionar item' });
  }
});

/** DELETE /vendas/:id/remover-item/:itemId — remove item de venda aberta. */
router.delete('/:id/remover-item/:itemId', autenticar, autorizar('admin', 'gerente', 'vendedor', 'garcom', 'caixa'), async (req, res) => {
  try {
    const venda = await buscarVendaDaLoja(req.params.id, req.empresaId, req.lojaId);
    if (!venda) return res.status(404).json({ erro: 'Venda não encontrada nesta loja' });
    if (venda.status !== 'aberta') return res.status(400).json({ erro: 'Venda já foi fechada ou cancelada' });

    const removido = await dbPg.query(
      `DELETE FROM itens_venda WHERE id = $1 AND venda_id = $2 RETURNING id`,
      [req.params.itemId, req.params.id]
    );
    if (removido.rows.length === 0) return res.status(404).json({ erro: 'Item não encontrado na venda' });

    const totais = await dbPg.query(
      `SELECT COALESCE(SUM(valor_total), 0) AS total, COALESCE(SUM(desconto_item), 0) AS descontos
       FROM itens_venda WHERE venda_id = $1`,
      [req.params.id]
    );
    const atualizada = await dbPg.query(
      `UPDATE vendas SET valor_bruto = $1, valor_desconto = $2, valor_liquido = $1
       WHERE id = $3 AND empresa_id = $4 AND loja_id = $5
       RETURNING *`,
      [totais.rows[0].total, totais.rows[0].descontos, req.params.id, req.empresaId, req.lojaId]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, venda: atualizada.rows[0] });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ erro: 'Erro ao remover item' });
  }
});

/** POST /vendas/:id/fechar — finaliza uma venda e registra descontos/acréscimos. */
router.post('/:id/fechar', autenticar, autorizar('admin', 'gerente', 'vendedor', 'garcom', 'caixa'), async (req, res) => {
  try {
    const venda = await buscarVendaDaLoja(req.params.id, req.empresaId, req.lojaId);
    if (!venda) return res.status(404).json({ erro: 'Venda não encontrada nesta loja' });
    if (venda.status !== 'aberta') return res.status(400).json({ erro: 'Venda já foi fechada ou cancelada' });

    const desconto = Math.max(Number(req.body.desconto_total) || 0, 0);
    const acrescimo = Math.max(Number(req.body.acrescimo_total) || 0, 0);
    const bruto = Number(venda.valor_bruto) || 0;
    const liquido = Math.max(bruto - desconto + acrescimo, 0);

    const resultado = await dbPg.query(
      `UPDATE vendas
       SET status = 'fechada', valor_desconto = $1, valor_acrescimo = $2, valor_liquido = $3
       WHERE id = $4 AND empresa_id = $5 AND loja_id = $6 AND status = 'aberta'
       RETURNING *`,
      [desconto, acrescimo, liquido, req.params.id, req.empresaId, req.lojaId]
    );
    if (resultado.rows.length === 0) return res.status(409).json({ erro: 'A venda já foi modificada por outra operação' });

    res.json({ sucesso: true, loja_id: req.lojaId, venda: resultado.rows[0], mensagem: 'Venda fechada' });
  } catch (error) {
    console.error('Erro ao fechar venda:', error);
    res.status(500).json({ erro: 'Erro ao fechar venda' });
  }
});

/** GET /vendas/:id — detalhe de venda somente da loja selecionada. */
router.get('/:id', autenticar, async (req, res) => {
  try {
    const venda = await buscarVendaDaLoja(req.params.id, req.empresaId, req.lojaId);
    if (!venda) return res.status(404).json({ erro: 'Venda não encontrada nesta loja' });

    const [itens, comanda] = await Promise.all([
      dbPg.query(
        `SELECT iv.*, p.nome, p.codigo_interno
         FROM itens_venda iv
         JOIN produtos p ON p.id = iv.produto_id
         WHERE iv.venda_id = $1`,
        [venda.id]
      ),
      dbPg.query(
        `SELECT * FROM comandas WHERE venda_id = $1 AND empresa_id = $2 AND loja_id = $3`,
        [venda.id, req.empresaId, req.lojaId]
      ),
    ]);

    res.json({ sucesso: true, loja_id: req.lojaId, venda, itens: itens.rows, comanda: comanda.rows[0] || null });
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ erro: 'Erro ao buscar venda' });
  }
});

/** GET /vendas — lista vendas da loja ativa com filtros e paginação. */
router.get('/', autenticar, async (req, res) => {
  try {
    const { status, tipo_venda, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;
    const parametros = [req.empresaId, req.lojaId];
    let indice = 3;
    let sql = `SELECT * FROM vendas WHERE empresa_id = $1 AND loja_id = $2`;

    if (status) { sql += ` AND status = $${indice}`; parametros.push(status); indice += 1; }
    if (tipo_venda) { sql += ` AND tipo_venda = $${indice}`; parametros.push(tipo_venda); indice += 1; }
    if (data_inicio) { sql += ` AND data_venda >= $${indice}`; parametros.push(data_inicio); indice += 1; }
    if (data_fim) { sql += ` AND data_venda <= $${indice}`; parametros.push(data_fim); indice += 1; }

    const limitSeguro = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const offsetSeguro = Math.max(Number(offset) || 0, 0);
    sql += ` ORDER BY data_venda DESC LIMIT $${indice} OFFSET $${indice + 1}`;
    parametros.push(limitSeguro, offsetSeguro);

    const vendas = await dbPg.query(sql, parametros);

    const filtros = [req.empresaId, req.lojaId];
    let countSql = `SELECT COUNT(*)::int AS total FROM vendas WHERE empresa_id = $1 AND loja_id = $2`;
    let countIndice = 3;
    if (status) { countSql += ` AND status = $${countIndice}`; filtros.push(status); countIndice += 1; }
    if (tipo_venda) { countSql += ` AND tipo_venda = $${countIndice}`; filtros.push(tipo_venda); countIndice += 1; }
    if (data_inicio) { countSql += ` AND data_venda >= $${countIndice}`; filtros.push(data_inicio); countIndice += 1; }
    if (data_fim) { countSql += ` AND data_venda <= $${countIndice}`; filtros.push(data_fim); }
    const total = await dbPg.query(countSql, filtros);

    res.json({
      sucesso: true,
      loja_id: req.lojaId,
      vendas: vendas.rows,
      paginacao: { total: total.rows[0].total, limit: limitSeguro, offset: offsetSeguro },
    });
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ erro: 'Erro ao listar vendas' });
  }
});

export default router;
