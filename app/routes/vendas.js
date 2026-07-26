/**
 * ============================================================================
 * ROTAS DE VENDAS E PDV - ERP MODULAR
 * ============================================================================
 * Arquivo: routes/vendas.js
 * Descrição: PDV, vendas, comanda, divisão de conta
 * ============================================================================
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

/**
 * POST /vendas/criar
 * Criar nova venda (PDV ou comanda)
 */
router.post('/criar', autenticar, autorizar('admin', 'gerente', 'vendedor', 'garcom', 'caixa'), async (req, res) => {
  try {
    const { tipo_venda, mesa_numero } = req.body;

    if (!tipo_venda) {
      return res.status(400).json({ erro: 'Tipo de venda é obrigatório' });
    }

    const tiposValidos = ['pdv', 'comanda', 'delivery', 'online'];
    if (!tiposValidos.includes(tipo_venda)) {
      return res.status(400).json({ erro: 'Tipo de venda inválido' });
    }

    // Gerar número único de venda
    const dataHora = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const numero_venda = `${tipo_venda.substring(0, 3).toUpperCase()}-${dataHora}`;

    // Criar venda
    const venda = await dbPg.criarVenda({
      empresa_id: req.empresaId,
      numero_venda,
      usuario_vendedor_id: req.usuario.usuario_id,
      tipo_venda,
      valor_bruto: 0,
      valor_liquido: 0
    });

    // Se for comanda, criar registro
    if (tipo_venda === 'comanda') {
      const numeroComanda = Math.floor(Math.random() * 10000);
      const comanda = await dbPg.query(
        `INSERT INTO comandas 
         (empresa_id, numero_comanda, mesa_numero, usuario_garcom_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.empresaId, numeroComanda, mesa_numero || null, req.usuario.usuario_id, 'aberta']
      );

      // Associar venda à comanda
      await dbPg.query(
        `UPDATE vendas SET id = $1 WHERE id = $2`,
        [comanda.rows[0].id, venda.id]
      );

      return res.status(201).json({
        sucesso: true,
        venda: { ...venda, comanda_id: comanda.rows[0].id },
        mensagem: 'Comanda criada'
      });
    }

    res.status(201).json({
      sucesso: true,
      venda,
      mensagem: 'Venda criada'
    });
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ erro: 'Erro ao criar venda' });
  }
});

/**
 * POST /vendas/:id/adicionar-item
 * Adicionar item à venda
 */
router.post('/:id/adicionar-item', autenticar, async (req, res) => {
  try {
    const { produto_id, quantidade } = req.body;

    if (!produto_id || !quantidade) {
      return res.status(400).json({ erro: 'Produto e quantidade são obrigatórios' });
    }

    // Validar venda
    const venda = await dbPg.findById('vendas', req.params.id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'aberta') {
      return res.status(400).json({ erro: 'Venda já foi fechada' });
    }

    // Validar produto
    const produto = await dbPg.findById('produtos', produto_id, req.empresaId);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Validar estoque
    const estoqueResult = await dbPg.query(
      `SELECT SUM(quantidade) as total FROM estoque 
       WHERE empresa_id = $1 AND produto_id = $2`,
      [req.empresaId, produto_id]
    );

    const quantidadeDisponivel = estoqueResult.rows[0]?.total || 0;
    if (quantidadeDisponivel < quantidade) {
      return res.status(400).json({ 
        erro: 'Estoque insuficiente',
        disponivel: quantidadeDisponivel
      });
    }

    // Adicionar item
    const item = await dbPg.adicionarItemVenda({
      venda_id: req.params.id,
      produto_id,
      quantidade,
      valor_unitario: produto.preco_venda
    });

    // Atualizar valor total da venda
    const totaisResult = await dbPg.query(
      `SELECT SUM(valor_total) as total FROM itens_venda WHERE venda_id = $1`,
      [req.params.id]
    );

    const novoTotal = totaisResult.rows[0]?.total || 0;
    await dbPg.update('vendas', req.params.id, {
      valor_bruto: novoTotal,
      valor_liquido: novoTotal
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'itens_venda',
      operacao: 'INSERT',
      registro_id: item.id,
      dados_novo: item,
      ip_address: req.ip
    });

    res.status(201).json({
      sucesso: true,
      item,
      valor_total_venda: novoTotal
    });
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ erro: 'Erro ao adicionar item' });
  }
});

/**
 * DELETE /vendas/:id/remover-item/:item_id
 * Remover item da venda
 */
router.delete('/:id/remover-item/:item_id', autenticar, async (req, res) => {
  try {
    // Validar venda
    const venda = await dbPg.findById('vendas', req.params.id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'aberta') {
      return res.status(400).json({ erro: 'Venda já foi fechada' });
    }

    // Remover item
    await dbPg.deleteRecord('itens_venda', req.params.item_id);

    // Atualizar valor total
    const totaisResult = await dbPg.query(
      `SELECT SUM(valor_total) as total FROM itens_venda WHERE venda_id = $1`,
      [req.params.id]
    );

    const novoTotal = totaisResult.rows[0]?.total || 0;
    await dbPg.update('vendas', req.params.id, {
      valor_bruto: novoTotal,
      valor_liquido: novoTotal
    }, req.empresaId);

    res.json({
      sucesso: true,
      mensagem: 'Item removido',
      valor_total_venda: novoTotal
    });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ erro: 'Erro ao remover item' });
  }
});

/**
 * POST /vendas/:id/fechar
 * Fechar venda
 */
router.post('/:id/fechar', autenticar, async (req, res) => {
  try {
    const { desconto_total, acrescimo_total } = req.body;

    // Validar venda
    const venda = await dbPg.findById('vendas', req.params.id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'aberta') {
      return res.status(400).json({ erro: 'Venda já foi fechada' });
    }

    // Calcular novo total
    const valorBruto = venda.valor_bruto || 0;
    const desconto = desconto_total || 0;
    const acrescimo = acrescimo_total || 0;
    const valorLiquido = valorBruto - desconto + acrescimo;

    // Atualizar venda
    const vendaFechada = await dbPg.update('vendas', req.params.id, {
      status: 'fechada',
      valor_desconto: desconto,
      valor_acrescimo: acrescimo,
      valor_liquido: valorLiquido
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'vendas',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: vendaFechada,
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      venda: vendaFechada,
      mensagem: 'Venda fechada'
    });
  } catch (error) {
    console.error('Erro ao fechar venda:', error);
    res.status(500).json({ erro: 'Erro ao fechar venda' });
  }
});

/**
 * GET /vendas/:id
 * Obter detalhes da venda
 */
router.get('/:id', autenticar, async (req, res) => {
  try {
    const venda = await dbPg.findById('vendas', req.params.id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    // Buscar itens
    const itensResult = await dbPg.query(
      `SELECT iv.*, p.nome, p.codigo_interno FROM itens_venda iv
       JOIN produtos p ON iv.produto_id = p.id
       WHERE iv.venda_id = $1`,
      [req.params.id]
    );

    res.json({
      sucesso: true,
      venda,
      itens: itensResult.rows
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar venda' });
  }
});

/**
 * GET /vendas
 * Listar vendas
 */
router.get('/', autenticar, async (req, res) => {
  try {
    const { status, tipo_venda, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;

    let sql = `SELECT * FROM vendas WHERE empresa_id = $1`;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (tipo_venda) {
      sql += ` AND tipo_venda = $${paramIndex}`;
      params.push(tipo_venda);
      paramIndex++;
    }

    if (data_inicio) {
      sql += ` AND data_venda >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND data_venda <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    sql += ` ORDER BY data_venda DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await dbPg.query(sql, params);
    const total = await dbPg.count('vendas', { status, tipo_venda }, req.empresaId);

    res.json({
      sucesso: true,
      vendas: result.rows,
      paginacao: { total, limit, offset }
    });
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ erro: 'Erro ao listar vendas' });
  }
});

export default router;
