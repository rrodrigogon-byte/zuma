/**
 * ============================================================================
 * ROTAS DE CAIXA — KYTTO ERP
 * ============================================================================
 * Abertura, sangria, suprimento, fechamento e relatórios por loja.
 */

import express from 'express';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();

function dinheiroValido(valor, permitirZero = true) {
  const numero = Number(valor);
  return Number.isFinite(numero) && (permitirZero ? numero >= 0 : numero > 0) ? numero : null;
}

async function buscarCaixaDaLoja(caixaId, empresaId, lojaId, client = null) {
  const sql = `SELECT * FROM caixas WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`;
  const resultado = client
    ? await dbPg.queryInTransaction(client, sql, [caixaId, empresaId, lojaId])
    : await dbPg.query(sql, [caixaId, empresaId, lojaId]);
  return resultado.rows[0] || null;
}

/** POST /caixa/abrir — inicia um caixa físico na loja ativa. */
router.post('/abrir', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const { numero_caixa, valor_abertura = 0, observacoes = null } = req.body;
    const numeroCaixa = Number(numero_caixa);
    const valorAbertura = dinheiroValido(valor_abertura);

    if (!Number.isInteger(numeroCaixa) || numeroCaixa <= 0 || valorAbertura === null) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Número do caixa e valor de abertura válido são obrigatórios' });
    }

    const aberto = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM caixas
       WHERE empresa_id = $1 AND loja_id = $2 AND numero_caixa = $3 AND status = 'aberto'
       FOR UPDATE`,
      [req.empresaId, req.lojaId, numeroCaixa]
    );
    if (aberto.rows.length > 0) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'Este caixa já está aberto nesta loja' });
    }

    const resultado = await dbPg.queryInTransaction(
      client,
      `INSERT INTO caixas
       (empresa_id, loja_id, numero_caixa, usuario_operador_id, valor_abertura, status, observacoes)
       VALUES ($1, $2, $3, $4, $5, 'aberto', $6)
       RETURNING *`,
      [req.empresaId, req.lojaId, numeroCaixa, req.usuario.usuario_id, valorAbertura, observacoes]
    );

    await dbPg.commit(client);
    res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      caixa: resultado.rows[0],
      mensagem: 'Caixa aberto com sucesso',
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ erro: 'Erro ao abrir caixa' });
  }
});

async function registrarMovimento(req, res, tipo) {
  const client = await dbPg.beginTransaction();
  try {
    const { caixa_id, valor, descricao = null, motivo = null } = req.body;
    const valorNumerico = dinheiroValido(valor, false);
    if (!caixa_id || valorNumerico === null) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Caixa e valor positivo são obrigatórios' });
    }

    const caixa = await buscarCaixaDaLoja(caixa_id, req.empresaId, req.lojaId, client);
    if (!caixa) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Caixa não encontrado nesta loja' });
    }
    if (caixa.status !== 'aberto') {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'O caixa deve estar aberto para registrar movimentações' });
    }

    const resultado = await dbPg.queryInTransaction(
      client,
      `INSERT INTO movimentacoes_caixa (caixa_id, tipo, valor, descricao, usuario_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [caixa_id, tipo, valorNumerico, descricao || motivo, req.usuario.usuario_id]
    );

    await dbPg.commit(client);
    return res.status(201).json({
      sucesso: true,
      loja_id: req.lojaId,
      movimentacao: resultado.rows[0],
      mensagem: tipo === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado',
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error(`Erro ao registrar ${tipo}:`, error);
    return res.status(500).json({ erro: `Erro ao registrar ${tipo}` });
  }
}

/** POST /caixa/sangria — registra retirada de numerário. */
router.post('/sangria', autenticar, autorizar('admin', 'gerente', 'caixa'), (req, res) =>
  registrarMovimento(req, res, 'sangria')
);

/** POST /caixa/suprimento — registra aporte de numerário. */
router.post('/suprimento', autenticar, autorizar('admin', 'gerente', 'caixa'), (req, res) =>
  registrarMovimento(req, res, 'suprimento')
);

/** POST /caixa/:id/fechar — fecha caixa e registra divergência de conferência. */
router.post('/:id/fechar', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  const client = await dbPg.beginTransaction();
  try {
    const { valor_contado, valor_fechamento, observacoes = null } = req.body;
    const valorContado = dinheiroValido(valor_contado ?? valor_fechamento);
    if (valorContado === null) {
      await dbPg.rollback(client);
      return res.status(400).json({ erro: 'Valor contado é obrigatório e não pode ser negativo' });
    }

    const caixa = await buscarCaixaDaLoja(req.params.id, req.empresaId, req.lojaId, client);
    if (!caixa) {
      await dbPg.rollback(client);
      return res.status(404).json({ erro: 'Caixa não encontrado nesta loja' });
    }
    if (caixa.status !== 'aberto') {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'Caixa já está fechado ou suspenso' });
    }

    const movimentos = await dbPg.queryInTransaction(
      client,
      `SELECT COALESCE(SUM(
         CASE
           WHEN tipo IN ('sangria', 'pagamento') THEN -valor
           ELSE valor
         END
       ), 0) AS total_movimentacoes
       FROM movimentacoes_caixa
       WHERE caixa_id = $1`,
      [caixa.id]
    );
    const totalMovimentacoes = Number(movimentos.rows[0].total_movimentacoes || 0);
    const valorEsperado = Number(caixa.valor_abertura) + totalMovimentacoes;
    const divergencia = valorContado - valorEsperado;

    const atualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE caixas
       SET valor_fechamento = $1,
           data_fechamento = CURRENT_TIMESTAMP,
           status = 'fechado',
           observacoes = COALESCE($2, observacoes)
       WHERE id = $3 AND status = 'aberto'
       RETURNING *`,
      [valorContado, observacoes, caixa.id]
    );
    if (atualizado.rows.length === 0) {
      await dbPg.rollback(client);
      return res.status(409).json({ erro: 'O caixa foi alterado por outra operação' });
    }

    await dbPg.queryInTransaction(
      client,
      `INSERT INTO fechamentos_caixa
       (caixa_id, valor_esperado, valor_contado, divergencia, usuario_responsavel_id, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [caixa.id, valorEsperado, valorContado, divergencia, req.usuario.usuario_id, observacoes]
    );

    await dbPg.commit(client);
    res.json({
      sucesso: true,
      loja_id: req.lojaId,
      caixa: atualizado.rows[0],
      resumo: {
        valor_abertura: Number(caixa.valor_abertura),
        movimentacoes: totalMovimentacoes,
        valor_esperado: valorEsperado,
        valor_contado: valorContado,
        divergencia,
        status_divergencia: Math.abs(divergencia) < 0.01 ? 'OK' : (divergencia > 0 ? 'SOBRA' : 'FALTA'),
      },
      mensagem: 'Caixa fechado',
    });
  } catch (error) {
    await dbPg.rollback(client);
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ erro: 'Erro ao fechar caixa' });
  }
});

/** GET /caixa/aberto — caixas abertos da loja ativa, com movimento acumulado. */
router.get('/aberto', autenticar, async (req, res) => {
  try {
    const { numero_caixa } = req.query;
    const parametros = [req.empresaId, req.lojaId];
    let sql = `
      SELECT c.*,
             COALESCE(SUM(CASE WHEN mc.tipo IN ('sangria', 'pagamento') THEN -mc.valor ELSE mc.valor END), 0) AS movimentacoes,
             c.valor_abertura + COALESCE(SUM(CASE WHEN mc.tipo IN ('sangria', 'pagamento') THEN -mc.valor ELSE mc.valor END), 0) AS valor_esperado
      FROM caixas c
      LEFT JOIN movimentacoes_caixa mc ON mc.caixa_id = c.id
      WHERE c.empresa_id = $1 AND c.loja_id = $2 AND c.status = 'aberto'
    `;
    if (numero_caixa) {
      sql += ' AND c.numero_caixa = $3';
      parametros.push(Number(numero_caixa));
    }
    sql += ' GROUP BY c.id ORDER BY c.data_abertura DESC';

    const resultado = await dbPg.query(sql, parametros);
    res.json({ sucesso: true, loja_id: req.lojaId, caixas: resultado.rows });
  } catch (error) {
    console.error('Erro ao buscar caixas abertos:', error);
    res.status(500).json({ erro: 'Erro ao buscar caixas abertos' });
  }
});

/** GET /caixa/relatorio — consolida fechamentos da loja ativa. */
router.get('/relatorio', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  try {
    const { data_inicio = null, data_fim = null } = req.query;
    const resultado = await dbPg.query(
      `SELECT
         COUNT(c.id)::int AS total_caixas,
         COALESCE(SUM(c.valor_abertura), 0) AS total_abertura,
         COALESCE(SUM(c.valor_fechamento), 0) AS total_fechamento,
         COALESCE(SUM(f.valor_esperado), 0) AS total_esperado,
         COALESCE(SUM(f.divergencia), 0) AS total_divergencias,
         COUNT(*) FILTER (WHERE ABS(COALESCE(f.divergencia, 0)) < 0.01)::int AS caixas_ok,
         COUNT(*) FILTER (WHERE f.divergencia > 0.01)::int AS caixas_sobra,
         COUNT(*) FILTER (WHERE f.divergencia < -0.01)::int AS caixas_falta
       FROM caixas c
       LEFT JOIN LATERAL (
         SELECT * FROM fechamentos_caixa fc
         WHERE fc.caixa_id = c.id
         ORDER BY fc.data_fechamento DESC
         LIMIT 1
       ) f ON true
       WHERE c.empresa_id = $1
         AND c.loja_id = $2
         AND c.status = 'fechado'
         AND ($3::timestamptz IS NULL OR c.data_abertura >= $3::timestamptz)
         AND ($4::timestamptz IS NULL OR c.data_abertura <= $4::timestamptz)`,
      [req.empresaId, req.lojaId, data_inicio, data_fim]
    );

    res.json({ sucesso: true, loja_id: req.lojaId, relatorio: resultado.rows[0] });
  } catch (error) {
    console.error('Erro ao gerar relatório de caixa:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório de caixa' });
  }
});

export default router;
