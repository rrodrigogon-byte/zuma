/**
 * ============================================================================
 * ROTAS DE PAGAMENTOS - ERP MODULAR
 * ============================================================================
 * Arquivo: routes/pagamentos.js
 * Descrição: Pagamentos, cartão, Pix, dinheiro, TEF
 * ============================================================================
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

/**
 * POST /pagamentos/processar
 * Processar pagamento de venda
 */
router.post('/processar', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { venda_id, forma_pagamento_id, valor, referencia_externa } = req.body;

    if (!venda_id || !forma_pagamento_id || !valor) {
      return res.status(400).json({ erro: 'Venda, forma de pagamento e valor são obrigatórios' });
    }

    // Validar venda
    const venda = await dbPg.findById('vendas', venda_id, req.empresaId);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    if (venda.status !== 'fechada') {
      return res.status(400).json({ erro: 'Venda deve estar fechada para receber pagamento' });
    }

    // Validar forma de pagamento
    const formaResult = await dbPg.query(
      `SELECT * FROM formas_pagamento WHERE id = $1 AND empresa_id = $2`,
      [forma_pagamento_id, req.empresaId]
    );

    if (formaResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Forma de pagamento não encontrada' });
    }

    const forma = formaResult.rows[0];

    // Validar valor
    if (valor > venda.valor_liquido) {
      return res.status(400).json({ 
        erro: 'Valor do pagamento maior que o total da venda',
        total_venda: venda.valor_liquido
      });
    }

    // Registrar pagamento em transação
    const client = await dbPg.beginTransaction();
    try {
      // Criar registro de pagamento
      const pagtoResult = await dbPg.queryInTransaction(
        client,
        `INSERT INTO pagamentos 
         (empresa_id, venda_id, forma_pagamento_id, valor, status, usuario_id, referencia_externa)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.empresaId, venda_id, forma_pagamento_id, valor, 'processando', req.usuario.usuario_id, referencia_externa || null]
      );

      const pagamento = pagtoResult.rows[0];

      // Se for cartão, registrar transação
      if (['cartao_credito', 'cartao_debito'].includes(forma.tipo)) {
        await dbPg.queryInTransaction(
          client,
          `INSERT INTO transacoes_cartao
           (empresa_id, pagamento_id, adquirente, valor, status, nsu, autorizacao)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.empresaId, pagamento.id, 'stone', valor, 'autorizado', 'NSU-' + Date.now(), 'AUTO-' + Date.now()]
        );
      }

      // Se for Pix, registrar transação
      if (forma.tipo === 'pix') {
        const txid = 'TXD' + Date.now();
        await dbPg.queryInTransaction(
          client,
          `INSERT INTO transacoes_pix
           (empresa_id, pagamento_id, txid, qr_code, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.empresaId, pagamento.id, txid, 'qrcode-' + txid, 'aguardando']
        );
      }

      // Atualizar venda se pagamento cobre total
      if (valor >= venda.valor_liquido) {
        await dbPg.queryInTransaction(
          client,
          `UPDATE vendas SET status = 'paga' WHERE id = $1`,
          [venda_id]
        );
      }

      // Registrar auditoria
      await dbPg.registrarAuditoria({
        empresa_id: req.empresaId,
        usuario_id: req.usuario.usuario_id,
        tabela: 'pagamentos',
        operacao: 'INSERT',
        registro_id: pagamento.id,
        dados_novo: pagamento,
        ip_address: req.ip
      });

      await dbPg.commit(client);

      res.status(201).json({
        sucesso: true,
        pagamento,
        mensagem: 'Pagamento processado com sucesso'
      });
    } catch (error) {
      await dbPg.rollback(client);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao processar pagamento' });
  }
});

/**
 * POST /pagamentos/:id/confirmar
 * Confirmar pagamento (após confirmação de adquirente)
 */
router.post('/:id/confirmar', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const pagamento = await dbPg.findById('pagamentos', req.params.id, req.empresaId);
    if (!pagamento) {
      return res.status(404).json({ erro: 'Pagamento não encontrado' });
    }

    // Atualizar pagamento
    const pagtoAtualizado = await dbPg.update('pagamentos', req.params.id, {
      status: 'confirmado'
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'pagamentos',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: { status: 'confirmado' },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      pagamento: pagtoAtualizado,
      mensagem: 'Pagamento confirmado'
    });
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao confirmar pagamento' });
  }
});

/**
 * POST /pagamentos/:id/reembolsar
 * Reembolsar pagamento
 */
router.post('/:id/reembolsar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { motivo } = req.body;

    const pagamento = await dbPg.findById('pagamentos', req.params.id, req.empresaId);
    if (!pagamento) {
      return res.status(404).json({ erro: 'Pagamento não encontrado' });
    }

    if (pagamento.status !== 'confirmado') {
      return res.status(400).json({ erro: 'Apenas pagamentos confirmados podem ser reembolsados' });
    }

    // Atualizar pagamento
    const pagtoAtualizado = await dbPg.update('pagamentos', req.params.id, {
      status: 'reembolsado',
      motivo_reembolso: motivo || null
    }, req.empresaId);

    // Registrar auditoria
    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'pagamentos',
      operacao: 'UPDATE',
      registro_id: req.params.id,
      dados_novo: { status: 'reembolsado', motivo },
      ip_address: req.ip
    });

    res.json({
      sucesso: true,
      pagamento: pagtoAtualizado,
      mensagem: 'Pagamento reembolsado'
    });
  } catch (error) {
    console.error('Erro ao reembolsar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao reembolsar pagamento' });
  }
});

/**
 * GET /pagamentos/venda/:venda_id
 * Listar pagamentos de uma venda
 */
router.get('/venda/:venda_id', autenticar, async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT p.*, fp.nome as forma_nome, fp.tipo as forma_tipo
       FROM pagamentos p
       JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
       WHERE p.empresa_id = $1 AND p.venda_id = $2
       ORDER BY p.data_pagamento DESC`,
      [req.empresaId, req.venda_id]
    );

    res.json({
      sucesso: true,
      pagamentos: result.rows
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar pagamentos' });
  }
});

/**
 * GET /pagamentos/relatorio
 * Relatório de pagamentos
 */
router.get('/relatorio', autenticar, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;

    let sql = `
      SELECT 
        fp.nome as forma_pagamento,
        COUNT(p.id) as quantidade,
        SUM(p.valor) as total,
        COUNT(CASE WHEN p.status = 'confirmado' THEN 1 END) as confirmados,
        COUNT(CASE WHEN p.status = 'reembolsado' THEN 1 END) as reembolsados
      FROM pagamentos p
      JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
      WHERE p.empresa_id = $1
    `;
    const params = [req.empresaId];
    let paramIndex = 2;

    if (data_inicio) {
      sql += ` AND p.data_pagamento >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      sql += ` AND p.data_pagamento <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    sql += ` GROUP BY fp.nome ORDER BY total DESC`;

    const result = await dbPg.query(sql, params);

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
