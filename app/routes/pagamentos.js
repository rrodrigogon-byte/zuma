/**
 * ============================================================================
 * ROTAS DE PAGAMENTOS — KYTTO ERP
 * ============================================================================
 * Pagamentos por venda, com estado fiscal-operacional válido e escopo de loja.
 */

import express from 'express';
import { randomUUID } from 'crypto';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();
const FORMAS_CARTAO = ['cartao_credito', 'cartao_debito'];

function valorPositivo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

async function buscarPagamentoDaLoja(pagamentoId, empresaId, lojaId) {
  const resultado = await dbPg.query(
    `SELECT p.*
     FROM pagamentos p
     JOIN vendas v ON v.id = p.venda_id
     WHERE p.id = $1 AND p.empresa_id = $2 AND p.loja_id = $3 AND v.loja_id = $3`,
    [pagamentoId, empresaId, lojaId]
  );
  return resultado.rows[0] || null;
}

/** POST /pagamentos/processar — cria um pagamento parcial ou integral de uma venda da loja. */
router.post('/processar', autenticar, autorizar('admin', 'gerente', 'caixa', 'vendedor'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const { venda_id, forma_pagamento_id, valor, referencia_externa = null, dados_cartao = {} } = req.body;
    const valorNumerico = valorPositivo(valor);
    if (!venda_id || !forma_pagamento_id || valorNumerico === null) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Venda, forma de pagamento e valor positivo são obrigatórios' });
    }

    const venda = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM vendas
       WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
       FOR UPDATE`,
      [venda_id, req.empresaId, req.lojaId]
    );
    if (venda.rows.length === 0) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Venda não encontrada nesta loja' });
    }
    if (venda.rows[0].status !== 'fechada') {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'A venda deve estar fechada antes do pagamento' });
    }

    const forma = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM formas_pagamento WHERE id = $1 AND empresa_id = $2 AND ativa = true`,
      [forma_pagamento_id, req.empresaId]
    );
    if (forma.rows.length === 0) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Forma de pagamento não encontrada ou inativa' });
    }

    const pagamentosAprovados = await dbPg.queryInTransaction(
      client,
      `SELECT COALESCE(SUM(valor), 0) AS total
       FROM pagamentos
       WHERE venda_id = $1 AND status = 'aprovado'
       FOR UPDATE`,
      [venda_id]
    );
    const totalJáPago = Number(pagamentosAprovados.rows[0].total || 0);
    const saldoRestante = Number(venda.rows[0].valor_liquido) - totalJáPago;
    if (valorNumerico > saldoRestante + 0.005) {
      await dbPg.rollback(client);
      return res.status(400).json({
        erro: 'Valor do pagamento excede o saldo da venda',
        saldo_restante: Math.max(saldoRestante, 0),
      });
    }

    const formaSelecionada = forma.rows[0];
    const statusInicial = formaSelecionada.tipo === 'pix' || FORMAS_CARTAO.includes(formaSelecionada.tipo)
      ? 'pendente'
      : 'aprovado';
    const pagamento = await dbPg.queryInTransaction(
      client,
      `INSERT INTO pagamentos
       (empresa_id, loja_id, venda_id, forma_pagamento_id, valor, status, usuario_id, referencia_externa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.empresaId,
        req.lojaId,
        venda_id,
        forma_pagamento_id,
        valorNumerico,
        statusInicial,
        req.usuario.usuario_id,
        referencia_externa,
      ]
    );

    if (FORMAS_CARTAO.includes(formaSelecionada.tipo)) {
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO transacoes_cartao
         (empresa_id, pagamento_id, adquirente, tipo_cartao, ultimos_digitos, bandeira, nsu, autorizacao, parcelas, taxa_percentual)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          req.empresaId,
          pagamento.rows[0].id,
          dados_cartao.adquirente || 'manual',
          formaSelecionada.tipo === 'cartao_credito' ? 'credito' : 'debito',
          dados_cartao.ultimos_digitos || null,
          dados_cartao.bandeira || null,
          dados_cartao.nsu || referencia_externa || null,
          dados_cartao.autorizacao || null,
          Math.max(Number(dados_cartao.parcelas) || 1, 1),
          Number(dados_cartao.taxa_percentual) || null,
        ]
      );
    }

    let pix = null;
    if (formaSelecionada.tipo === 'pix') {
      const txid = `KYT${randomUUID().replace(/-/g, '').slice(0, 28).toUpperCase()}`;
      const resultadoPix = await dbPg.queryInTransaction(
        client,
        `INSERT INTO transacoes_pix
         (empresa_id, pagamento_id, txid, status_pix)
         VALUES ($1, $2, $3, 'criado')
         RETURNING *`,
        [req.empresaId, pagamento.rows[0].id, txid]
      );
      pix = resultadoPix.rows[0];
    }

    await dbPg.commit(client);
    res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      pagamento: pagamento.rows[0],
      pix,
      exige_confirmacao: statusInicial === 'pendente',
      saldo_restante: Number((saldoRestante - (statusInicial === 'aprovado' ? valorNumerico : 0)).toFixed(2)),
      mensagem: statusInicial === 'aprovado' ? 'Pagamento aprovado' : 'Pagamento aguardando confirmação',
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao processar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao processar pagamento' });
  }
});

/** POST /pagamentos/:id/confirmar — confirma uma transação pendente. */
router.post('/:id/confirmar', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const pagamento = await dbPg.queryInTransaction(
      client,
      `SELECT p.*
       FROM pagamentos p
       JOIN vendas v ON v.id = p.venda_id
       WHERE p.id = $1 AND p.empresa_id = $2 AND p.loja_id = $3 AND v.loja_id = $3
       FOR UPDATE`,
      [req.params.id, req.empresaId, req.lojaId]
    );
    if (pagamento.rows.length === 0) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Pagamento não encontrado nesta loja' });
    }
    if (pagamento.rows[0].status !== 'pendente') {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'Somente pagamentos pendentes podem ser confirmados' });
    }

    const atualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE pagamentos SET status = 'aprovado', data_pagamento = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pendente'
       RETURNING *`,
      [req.params.id]
    );
    await dbPg.queryInTransaction(
      client,
      `UPDATE transacoes_pix SET status_pix = 'confirmado', data_confirmacao = CURRENT_TIMESTAMP
       WHERE pagamento_id = $1 AND status_pix = 'criado'`,
      [req.params.id]
    );

    await dbPg.commit(client);
    res.json({ sucesso: true, loja_id: req.lojaId, pagamento: atualizado.rows[0], mensagem: 'Pagamento confirmado' });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao confirmar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao confirmar pagamento' });
  }
});

/** POST /pagamentos/:id/reembolsar — registra o estorno lógico do pagamento aprovado. */
router.post('/:id/reembolsar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const pagamento = await buscarPagamentoDaLoja(req.params.id, req.empresaId, req.lojaId);
    if (!pagamento) return res.status(404).json({ erro: 'Pagamento não encontrado nesta loja' });
    if (pagamento.status !== 'aprovado') {
      return res.status(400).json({ erro: 'Apenas pagamentos aprovados podem ser reembolsados' });
    }

    const motivo = String(req.body.motivo || 'Reembolso sem justificativa informada').trim();
    const atualizado = await dbPg.query(
      `UPDATE pagamentos
       SET status = 'reembolsado',
           observacoes = CONCAT_WS(E'\\n', observacoes, $1)
       WHERE id = $2 AND empresa_id = $3 AND loja_id = $4
       RETURNING *`,
      [`REEMBOLSO: ${motivo}`, req.params.id, req.empresaId, req.lojaId]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, pagamento: atualizado.rows[0], mensagem: 'Pagamento reembolsado' });
  } catch (error) {
    console.error('Erro ao reembolsar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao reembolsar pagamento' });
  }
});

/** GET /pagamentos/venda/:vendaId — lista pagamentos de uma venda da loja ativa. */
router.get('/venda/:venda_id', autenticar, async (req, res) => {
  try {
    const venda = await dbPg.query(
      `SELECT id FROM vendas WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
      [req.params.venda_id, req.empresaId, req.lojaId]
    );
    if (venda.rows.length === 0) return res.status(404).json({ erro: 'Venda não encontrada nesta loja' });

    const resultado = await dbPg.query(
      `SELECT p.*, fp.nome AS forma_nome, fp.tipo AS forma_tipo
       FROM pagamentos p
       JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
       WHERE p.empresa_id = $1 AND p.loja_id = $2 AND p.venda_id = $3
       ORDER BY p.data_pagamento DESC`,
      [req.empresaId, req.lojaId, req.params.venda_id]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, pagamentos: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error);
    res.status(500).json({ erro: 'Erro ao listar pagamentos' });
  }
});

/** GET /pagamentos/relatorio — consolida pagamentos da loja ativa por forma. */
router.get('/relatorio', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { data_inicio = null, data_fim = null } = req.query;
    const resultado = await dbPg.query(
      `SELECT
         fp.nome AS forma_pagamento,
         fp.tipo AS forma_tipo,
         COUNT(p.id)::int AS quantidade,
         COALESCE(SUM(p.valor) FILTER (WHERE p.status = 'aprovado'), 0) AS total_aprovado,
         COUNT(*) FILTER (WHERE p.status = 'pendente')::int AS pendentes,
         COUNT(*) FILTER (WHERE p.status = 'reembolsado')::int AS reembolsados
       FROM pagamentos p
       JOIN formas_pagamento fp ON fp.id = p.forma_pagamento_id
       WHERE p.empresa_id = $1
         AND p.loja_id = $2
         AND ($3::timestamptz IS NULL OR p.data_pagamento >= $3::timestamptz)
         AND ($4::timestamptz IS NULL OR p.data_pagamento <= $4::timestamptz)
       GROUP BY fp.id, fp.nome, fp.tipo
       ORDER BY total_aprovado DESC, fp.nome`,
      [req.empresaId, req.lojaId, data_inicio, data_fim]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, relatorio: resultado.rows });
  } catch (error) {
    console.error('Erro ao gerar relatório de pagamentos:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório de pagamentos' });
  }
});

export default router;
