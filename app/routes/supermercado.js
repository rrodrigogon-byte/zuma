/*
 * ============================================================================
 * ROTAS COMERCIAIS — SUPERMERCADO E OPERAÇÕES MULTILOJA
 * ============================================================================
 * Executa no mesmo contrato do servidor principal: JWT com empresa e loja
 * ativas, RBAC, estoque por unidade e transações ACID para transferências.
 */

import express from 'express';
import crypto from 'crypto';
import * as dbPg from '../db-pg.js';
import { autenticar, autorizar } from './auth.js';

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIPOS_PROMOCAO = new Set(['percentual', 'valor_fixo', 'preco_fixo', 'leve_pague', 'combo']);
const STATUS_PROMOCAO = new Set(['rascunho', 'agendada', 'ativa', 'pausada', 'encerrada', 'cancelada']);
const FORMATOS_ETIQUETA = new Set(['gondola_100x40', 'gondola_60x40', 'prateleira_90x30', 'balanca_40x30', 'outro']);

function idValido(valor) {
  return typeof valor === 'string' && UUID_RE.test(valor);
}

function decimal(valor, { obrigatorio = false, positivo = false, campo = 'Valor' } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) throw new Error(`${campo} é obrigatório`);
    return null;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || (positivo ? numero <= 0 : numero < 0)) {
    throw new Error(`${campo} inválido`);
  }
  return Number(numero.toFixed(4));
}

function limiteSeguro(valor, padrao = 100, maximo = 500) {
  return Math.min(Math.max(Number.parseInt(valor, 10) || padrao, 1), maximo);
}

function calcularPrecoPromocional(precoBase, promocao) {
  const base = Number(precoBase || 0);
  if (!promocao) return base;

  if (promocao.tipo === 'percentual') {
    return Math.max(0, base * (1 - Number(promocao.percentual_desconto || 0) / 100));
  }
  if (promocao.tipo === 'valor_fixo') {
    return Math.max(0, base - Number(promocao.valor_desconto || 0));
  }
  if (promocao.tipo === 'preco_fixo') {
    return Number(promocao.preco_fixo || base);
  }
  return base;
}

function anexarPrecoPromocional(linha) {
  const precoBase = Number(linha.preco_venda_loja ?? linha.preco_venda ?? 0);
  const promocao = linha.promocao_id
    ? {
        id: linha.promocao_id,
        codigo: linha.promocao_codigo,
        nome: linha.promocao_nome,
        tipo: linha.promocao_tipo,
        percentual_desconto: linha.promocao_percentual,
        valor_desconto: linha.promocao_valor,
        preco_fixo: linha.promocao_preco_fixo,
        quantidade_leve: linha.promocao_quantidade_leve,
        quantidade_pague: linha.promocao_quantidade_pague,
      }
    : null;

  return {
    ...linha,
    preco_base: precoBase,
    preco_final: Number(calcularPrecoPromocional(precoBase, promocao).toFixed(2)),
    promocao,
  };
}

function extrairCodigoBalanca(codigo) {
  const limpo = String(codigo || '').replace(/\D/g, '');
  if (!/^2\d{12}$/.test(limpo)) return null;

  // Padrão EAN-13 de balança: 2 + PLU(5) + valor/peso(5) + dígito verificador.
  return {
    codigoOriginal: limpo,
    plu: limpo.slice(1, 6),
    pesoKg: Number(limpo.slice(7, 12)) / 1000,
  };
}

async function registrarAuditoriaTx(client, req, tabela, operacao, registroId, anterior, novo) {
  await dbPg.queryInTransaction(
    client,
    `INSERT INTO auditoria
      (empresa_id, loja_id, usuario_id, tabela, operacao, registro_id,
       dados_anterior, dados_novo, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      req.empresaId,
      req.lojaId,
      req.usuario.usuario_id,
      tabela,
      operacao,
      String(registroId),
      anterior ? JSON.stringify(anterior) : null,
      novo ? JSON.stringify(novo) : null,
      req.ip,
      req.get('user-agent') || null,
    ]
  );
}

async function garantirLojaDaEmpresa(client, empresaId, lojaId, { ativa = true } = {}) {
  if (!idValido(lojaId)) throw new Error('Loja inválida');
  const resultado = await dbPg.queryInTransaction(
    client,
    `SELECT id, nome, ativa FROM lojas
     WHERE id = $1 AND empresa_id = $2${ativa ? ' AND ativa = true' : ''}`,
    [lojaId, empresaId]
  );
  if (resultado.rows.length === 0) throw new Error('Loja não encontrada ou inativa');
  return resultado.rows[0];
}

async function garantirProdutoDaEmpresa(client, empresaId, produtoId) {
  if (!idValido(produtoId)) throw new Error('Produto inválido');
  const resultado = await dbPg.queryInTransaction(
    client,
    `SELECT id, nome, codigo_interno, codigo_barras, plu, preco_venda, preco_custo,
            unidade_medida, ativo, pesavel, controla_lote
     FROM produtos
     WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
    [produtoId, empresaId]
  );
  if (resultado.rows.length === 0) throw new Error('Produto não encontrado ou inativo');
  return resultado.rows[0];
}

async function obterProdutoComercial(empresaId, lojaId, codigo) {
  const codigoBalanca = extrairCodigoBalanca(codigo);
  const codigoBusca = codigoBalanca?.plu || String(codigo || '').trim();
  if (!codigoBusca) return null;

  const resultado = await dbPg.query(
    `SELECT p.id, p.codigo_interno, p.codigo_barras, p.plu, p.codigo_balanca,
            p.nome, p.descricao, p.unidade_medida, p.pesavel, p.permite_fracionamento,
            p.controla_lote, p.departamento, p.preco_venda,
            pl.preco_venda AS preco_venda_loja,
            pl.preco_promocional AS preco_promocional_loja,
            pl.estoque_minimo, pl.estoque_maximo, pl.ponto_reposicao,
            COALESCE((
              SELECT SUM(e.quantidade) FROM estoque e
              WHERE e.empresa_id = $1 AND e.loja_id = $2 AND e.produto_id = p.id
            ), 0) AS saldo_estoque,
            promo.id AS promocao_id, promo.codigo AS promocao_codigo,
            promo.nome AS promocao_nome, promo.tipo AS promocao_tipo,
            promo.percentual_desconto AS promocao_percentual,
            promo.valor_desconto AS promocao_valor,
            promo.preco_fixo AS promocao_preco_fixo,
            promo.quantidade_leve AS promocao_quantidade_leve,
            promo.quantidade_pague AS promocao_quantidade_pague
     FROM produtos p
     LEFT JOIN precos_produto_loja pl
       ON pl.empresa_id = p.empresa_id AND pl.loja_id = $2 AND pl.produto_id = p.id AND pl.ativo = true
     LEFT JOIN LATERAL (
       SELECT pr.*
       FROM promocoes_comerciais pr
       JOIN promocoes_comerciais_itens pri ON pri.promocao_id = pr.id
       WHERE pr.empresa_id = $1
         AND (pr.loja_id IS NULL OR pr.loja_id = $2)
         AND pri.produto_id = p.id
         AND pr.status = 'ativa'
         AND CURRENT_TIMESTAMP BETWEEN pr.data_inicio AND pr.data_fim
       ORDER BY pr.loja_id NULLS LAST, pr.data_inicio DESC
       LIMIT 1
     ) promo ON true
     WHERE p.empresa_id = $1
       AND p.ativo = true
       AND (p.id::text = $3 OR p.codigo_barras = $3 OR p.codigo_interno = $3 OR p.plu = $3 OR p.codigo_balanca = $3)
     LIMIT 1`,
    [empresaId, lojaId, codigoBusca]
  );

  if (resultado.rows.length === 0) return null;
  const produto = anexarPrecoPromocional(resultado.rows[0]);
  if (codigoBalanca && produto.pesavel) {
    produto.leitura_balanca = {
      codigo: codigoBalanca.codigoOriginal,
      plu: codigoBalanca.plu,
      peso_kg: codigoBalanca.pesoKg,
    };
    produto.quantidade_sugerida = codigoBalanca.pesoKg;
    produto.valor_sugerido = Number((produto.preco_final * codigoBalanca.pesoKg).toFixed(2));
  }
  return produto;
}

/** GET /supermercado/produtos — catálogo e saldo da loja ativa. */
router.get('/produtos', autenticar, async (req, res) => {
  try {
    const { busca, departamento, apenas_abaixo_minimo } = req.query;
    const limit = limiteSeguro(req.query.limit);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const params = [req.empresaId, req.lojaId];
    let indice = 3;
    let filtro = 'WHERE p.empresa_id = $1 AND p.ativo = true';

    if (busca) {
      filtro += ` AND (p.nome ILIKE $${indice} OR p.codigo_interno ILIKE $${indice} OR p.codigo_barras = $${indice} OR p.plu = $${indice})`;
      params.push(`%${busca}%`);
      indice += 1;
    }
    if (departamento) {
      filtro += ` AND p.departamento = $${indice}`;
      params.push(departamento);
      indice += 1;
    }
    if (apenas_abaixo_minimo === 'true') {
      filtro += ` AND COALESCE((SELECT SUM(e.quantidade) FROM estoque e WHERE e.empresa_id = $1 AND e.loja_id = $2 AND e.produto_id = p.id), 0) <= COALESCE(pl.estoque_minimo, p.estoque_minimo, 0)`;
    }

    const sql = `
      SELECT p.id, p.codigo_interno, p.codigo_barras, p.plu, p.codigo_balanca,
             p.nome, p.unidade_medida, p.departamento, p.pesavel, p.controla_lote,
             p.preco_venda, p.preco_custo, p.estoque_minimo AS estoque_minimo_corporativo,
             pl.preco_venda AS preco_venda_loja, pl.preco_promocional AS preco_promocional_loja,
             COALESCE(pl.estoque_minimo, p.estoque_minimo, 0) AS estoque_minimo,
             pl.estoque_maximo, pl.ponto_reposicao,
             COALESCE((SELECT SUM(e.quantidade) FROM estoque e WHERE e.empresa_id = $1 AND e.loja_id = $2 AND e.produto_id = p.id), 0) AS saldo_estoque,
             promo.id AS promocao_id, promo.codigo AS promocao_codigo,
             promo.nome AS promocao_nome, promo.tipo AS promocao_tipo,
             promo.percentual_desconto AS promocao_percentual,
             promo.valor_desconto AS promocao_valor, promo.preco_fixo AS promocao_preco_fixo,
             promo.quantidade_leve AS promocao_quantidade_leve,
             promo.quantidade_pague AS promocao_quantidade_pague
      FROM produtos p
      LEFT JOIN precos_produto_loja pl
        ON pl.empresa_id = p.empresa_id AND pl.loja_id = $2 AND pl.produto_id = p.id AND pl.ativo = true
      LEFT JOIN LATERAL (
        SELECT pr.*
        FROM promocoes_comerciais pr
        JOIN promocoes_comerciais_itens pri ON pri.promocao_id = pr.id
        WHERE pr.empresa_id = $1
          AND (pr.loja_id IS NULL OR pr.loja_id = $2)
          AND pri.produto_id = p.id
          AND pr.status = 'ativa'
          AND CURRENT_TIMESTAMP BETWEEN pr.data_inicio AND pr.data_fim
        ORDER BY pr.loja_id NULLS LAST, pr.data_inicio DESC
        LIMIT 1
      ) promo ON true
      ${filtro}
      ORDER BY p.nome
      LIMIT $${indice} OFFSET $${indice + 1}`;

    params.push(limit, offset);
    const resultado = await dbPg.query(sql, params);
    res.json({
      sucesso: true,
      loja_id: req.lojaId,
      produtos: resultado.rows.map(anexarPrecoPromocional),
      paginacao: { limit, offset, retornados: resultado.rows.length },
    });
  } catch (error) {
    console.error('Erro ao listar produtos comerciais:', error);
    res.status(500).json({ erro: 'Erro ao listar produtos comerciais' });
  }
});

/** GET /supermercado/produtos/buscar/:codigo — busca por EAN, SKU, PLU ou balança. */
router.get('/produtos/buscar/:codigo', autenticar, async (req, res) => {
  try {
    const produto = await obterProdutoComercial(req.empresaId, req.lojaId, req.params.codigo);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado nesta empresa' });
    res.json({ sucesso: true, loja_id: req.lojaId, produto });
  } catch (error) {
    console.error('Erro ao buscar produto comercial:', error);
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

/** PUT /supermercado/produtos/:id/configuracao-loja — preço e reposição da unidade ativa. */
router.put('/produtos/:id/configuracao-loja', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    const produtoId = req.params.id;
    const camposPermitidos = ['preco_venda', 'preco_promocional', 'custo_reposicao', 'estoque_minimo', 'estoque_maximo', 'ponto_reposicao', 'ativo', 'data_inicio', 'data_fim'];
    const possuiCampo = camposPermitidos.some((campo) => Object.prototype.hasOwnProperty.call(req.body, campo));
    if (!possuiCampo) return res.status(400).json({ erro: 'Informe ao menos um campo de configuração' });

    client = await dbPg.beginTransaction();
    const produto = await garantirProdutoDaEmpresa(client, req.empresaId, produtoId);
    const anteriorResultado = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM precos_produto_loja WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3 FOR UPDATE`,
      [req.empresaId, req.lojaId, produtoId]
    );
    const anterior = anteriorResultado.rows[0] || null;
    const precoVenda = decimal(req.body.preco_venda ?? anterior?.preco_venda ?? produto.preco_venda, { obrigatorio: true, campo: 'Preço de venda' });
    const precoPromocional = decimal(req.body.preco_promocional ?? anterior?.preco_promocional, { campo: 'Preço promocional' });
    if (precoPromocional !== null && precoPromocional > precoVenda) {
      throw new Error('O preço promocional não pode ser maior que o preço de venda');
    }

    const resultado = await dbPg.queryInTransaction(
      client,
      `INSERT INTO precos_produto_loja
        (empresa_id, loja_id, produto_id, preco_venda, preco_promocional, custo_reposicao,
         estoque_minimo, estoque_maximo, ponto_reposicao, ativo, data_inicio, data_fim)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (loja_id, produto_id)
       DO UPDATE SET
         preco_venda = EXCLUDED.preco_venda,
         preco_promocional = EXCLUDED.preco_promocional,
         custo_reposicao = EXCLUDED.custo_reposicao,
         estoque_minimo = EXCLUDED.estoque_minimo,
         estoque_maximo = EXCLUDED.estoque_maximo,
         ponto_reposicao = EXCLUDED.ponto_reposicao,
         ativo = EXCLUDED.ativo,
         data_inicio = EXCLUDED.data_inicio,
         data_fim = EXCLUDED.data_fim
       RETURNING *`,
      [
        req.empresaId, req.lojaId, produtoId, precoVenda, precoPromocional,
        decimal(req.body.custo_reposicao ?? anterior?.custo_reposicao, { campo: 'Custo de reposição' }),
        decimal(req.body.estoque_minimo ?? anterior?.estoque_minimo, { campo: 'Estoque mínimo' }),
        decimal(req.body.estoque_maximo ?? anterior?.estoque_maximo, { campo: 'Estoque máximo' }),
        decimal(req.body.ponto_reposicao ?? anterior?.ponto_reposicao, { campo: 'Ponto de reposição' }),
        req.body.ativo ?? anterior?.ativo ?? true,
        req.body.data_inicio ?? anterior?.data_inicio ?? null,
        req.body.data_fim ?? anterior?.data_fim ?? null,
      ]
    );

    await registrarAuditoriaTx(client, req, 'precos_produto_loja', anterior ? 'UPDATE' : 'INSERT', resultado.rows[0].id, anterior, resultado.rows[0]);
    await dbPg.commit(client);
    client = null;
    res.json({ sucesso: true, configuracao: resultado.rows[0] });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    console.error('Erro ao configurar produto por loja:', error);
    res.status(400).json({ erro: error.message || 'Erro ao configurar produto por loja' });
  }
});

/** GET /supermercado/lotes — lotes, validade e saldo físico da loja ativa. */
router.get('/lotes', autenticar, async (req, res) => {
  try {
    const dias = req.query.vencendo_em_dias === undefined ? null : Number.parseInt(req.query.vencendo_em_dias, 10);
    const params = [req.empresaId, req.lojaId];
    let sql = `
      SELECT e.id, e.produto_id, p.nome AS produto_nome, p.codigo_interno, p.unidade_medida,
             e.lote, e.validade, e.quantidade, e.localizacao,
             CASE WHEN e.validade IS NULL THEN NULL ELSE (e.validade - CURRENT_DATE) END AS dias_para_vencer,
             CASE
               WHEN e.validade IS NULL THEN 'sem_validade'
               WHEN e.validade < CURRENT_DATE THEN 'vencido'
               WHEN e.validade <= CURRENT_DATE + INTERVAL '7 days' THEN 'critico'
               WHEN e.validade <= CURRENT_DATE + INTERVAL '30 days' THEN 'atencao'
               ELSE 'normal'
             END AS situacao_validade
      FROM estoque e
      JOIN produtos p ON p.id = e.produto_id AND p.empresa_id = e.empresa_id
      WHERE e.empresa_id = $1 AND e.loja_id = $2
        AND e.quantidade > 0
        AND (e.lote IS NOT NULL OR e.validade IS NOT NULL)`;
    if (Number.isFinite(dias) && dias >= 0) {
      params.push(dias);
      sql += ` AND e.validade IS NOT NULL AND e.validade <= CURRENT_DATE + ($${params.length} * INTERVAL '1 day')`;
    }
    if (req.query.produto_id) {
      if (!idValido(req.query.produto_id)) return res.status(400).json({ erro: 'Produto inválido' });
      params.push(req.query.produto_id);
      sql += ` AND e.produto_id = $${params.length}`;
    }
    sql += ' ORDER BY e.validade NULLS LAST, p.nome, e.lote';

    const resultado = await dbPg.query(sql, params);
    res.json({ sucesso: true, loja_id: req.lojaId, lotes: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar lotes:', error);
    res.status(500).json({ erro: 'Erro ao listar lotes e validade' });
  }
});

/** GET /supermercado/promocoes — promoções corporativas ou da loja ativa. */
router.get('/promocoes', autenticar, async (req, res) => {
  try {
    const params = [req.empresaId, req.lojaId];
    let sql = `
      SELECT pr.*, COUNT(pri.id)::int AS total_itens,
             COALESCE(json_agg(json_build_object('produto_id', p.id, 'nome', p.nome, 'codigo', p.codigo_interno))
               FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS itens
      FROM promocoes_comerciais pr
      LEFT JOIN promocoes_comerciais_itens pri ON pri.promocao_id = pr.id
      LEFT JOIN produtos p ON p.id = pri.produto_id
      WHERE pr.empresa_id = $1 AND (pr.loja_id IS NULL OR pr.loja_id = $2)`;
    if (req.query.status) {
      if (!STATUS_PROMOCAO.has(req.query.status)) return res.status(400).json({ erro: 'Status de promoção inválido' });
      params.push(req.query.status);
      sql += ` AND pr.status = $${params.length}`;
    }
    if (req.query.ativas === 'true') {
      sql += ` AND pr.status = 'ativa' AND CURRENT_TIMESTAMP BETWEEN pr.data_inicio AND pr.data_fim`;
    }
    sql += ' GROUP BY pr.id ORDER BY pr.data_inicio DESC LIMIT 200';
    const resultado = await dbPg.query(sql, params);
    res.json({ sucesso: true, loja_id: req.lojaId, promocoes: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar promoções:', error);
    res.status(500).json({ erro: 'Erro ao listar promoções' });
  }
});

/** POST /supermercado/promocoes — cria promoção e respectivos produtos. */
router.post('/promocoes', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    const {
      codigo, nome, descricao = null, tipo, status = 'rascunho', data_inicio, data_fim,
      percentual_desconto = null, valor_desconto = null, preco_fixo = null,
      quantidade_minima = null, quantidade_leve = null, quantidade_pague = null,
      permite_acumulo = false, limite_por_cliente = null, produto_ids,
    } = req.body;

    if (!codigo || !nome || !TIPOS_PROMOCAO.has(tipo) || !STATUS_PROMOCAO.has(status)) {
      return res.status(400).json({ erro: 'Código, nome, tipo e status válidos são obrigatórios' });
    }
    if (!data_inicio || !data_fim || new Date(data_fim) <= new Date(data_inicio)) {
      return res.status(400).json({ erro: 'Período de promoção inválido' });
    }
    if (!Array.isArray(produto_ids) || produto_ids.length === 0 || produto_ids.some((id) => !idValido(id))) {
      return res.status(400).json({ erro: 'Informe pelo menos um produto válido' });
    }
    if (tipo === 'percentual' && !(decimal(percentual_desconto, { obrigatorio: true, positivo: true, campo: 'Percentual de desconto' }) <= 100)) {
      return res.status(400).json({ erro: 'Percentual deve ser menor ou igual a 100' });
    }
    if (tipo === 'valor_fixo') decimal(valor_desconto, { obrigatorio: true, positivo: true, campo: 'Valor do desconto' });
    if (tipo === 'preco_fixo') decimal(preco_fixo, { obrigatorio: true, campo: 'Preço fixo' });
    if (tipo === 'leve_pague') {
      const leve = decimal(quantidade_leve, { obrigatorio: true, positivo: true, campo: 'Quantidade leve' });
      const pague = decimal(quantidade_pague, { obrigatorio: true, positivo: true, campo: 'Quantidade pague' });
      if (leve <= pague) return res.status(400).json({ erro: 'Na regra leve/pague, a quantidade levada deve ser maior que a paga' });
    }

    client = await dbPg.beginTransaction();
    const idsUnicos = [...new Set(produto_ids)];
    const produtos = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM produtos WHERE empresa_id = $1 AND ativo = true AND id = ANY($2::uuid[])`,
      [req.empresaId, idsUnicos]
    );
    if (produtos.rows.length !== idsUnicos.length) throw new Error('Há produtos inexistentes ou inativos na promoção');

    const promocao = await dbPg.queryInTransaction(
      client,
      `INSERT INTO promocoes_comerciais
        (empresa_id, loja_id, codigo, nome, descricao, tipo, status, data_inicio, data_fim,
         percentual_desconto, valor_desconto, preco_fixo, quantidade_minima, quantidade_leve,
         quantidade_pague, permite_acumulo, limite_por_cliente, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        req.empresaId, req.lojaId, String(codigo).trim().toUpperCase(), String(nome).trim(), descricao,
        tipo, status, data_inicio, data_fim,
        decimal(percentual_desconto, { campo: 'Percentual de desconto' }),
        decimal(valor_desconto, { campo: 'Valor do desconto' }),
        decimal(preco_fixo, { campo: 'Preço fixo' }),
        decimal(quantidade_minima, { campo: 'Quantidade mínima' }),
        decimal(quantidade_leve, { campo: 'Quantidade leve' }),
        decimal(quantidade_pague, { campo: 'Quantidade pague' }),
        Boolean(permite_acumulo), decimal(limite_por_cliente, { campo: 'Limite por cliente' }), req.usuario.usuario_id,
      ]
    );
    for (const produtoId of idsUnicos) {
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO promocoes_comerciais_itens (promocao_id, produto_id) VALUES ($1, $2)`,
        [promocao.rows[0].id, produtoId]
      );
    }

    await registrarAuditoriaTx(client, req, 'promocoes_comerciais', 'INSERT', promocao.rows[0].id, null, {
      ...promocao.rows[0], produto_ids: idsUnicos,
    });
    await dbPg.commit(client);
    client = null;
    res.status(201).json({ sucesso: true, promocao: { ...promocao.rows[0], produto_ids: idsUnicos } });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    console.error('Erro ao criar promoção:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar promoção' });
  }
});

/** PATCH /supermercado/promocoes/:id/status — pausa, ativa ou encerra uma promoção. */
router.patch('/promocoes/:id/status', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    if (!idValido(req.params.id) || !STATUS_PROMOCAO.has(req.body.status)) {
      return res.status(400).json({ erro: 'Promoção ou status inválido' });
    }
    client = await dbPg.beginTransaction();
    const anterior = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM promocoes_comerciais
       WHERE id = $1 AND empresa_id = $2 AND (loja_id IS NULL OR loja_id = $3)
       FOR UPDATE`,
      [req.params.id, req.empresaId, req.lojaId]
    );
    if (anterior.rows.length === 0) throw new Error('Promoção não encontrada nesta loja');
    const atualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE promocoes_comerciais SET status = $1 WHERE id = $2 RETURNING *`,
      [req.body.status, req.params.id]
    );
    await registrarAuditoriaTx(client, req, 'promocoes_comerciais', 'UPDATE', req.params.id, anterior.rows[0], atualizado.rows[0]);
    await dbPg.commit(client);
    client = null;
    res.json({ sucesso: true, promocao: atualizado.rows[0] });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    res.status(400).json({ erro: error.message || 'Erro ao atualizar promoção' });
  }
});

/** POST /supermercado/etiquetas — registra e enfileira etiqueta de gôndola no agente local. */
router.post('/etiquetas', autenticar, autorizar('admin', 'gerente', 'caixa'), async (req, res) => {
  let client;
  try {
    const {
      produto_id: produtoId, quantidade = 1, formato = 'gondola_100x40', terminal_id: terminalId = null,
      dispositivo_id: dispositivoId = null, promocao_id: promocaoId = null,
    } = req.body;
    if (!idValido(produtoId) || !FORMATOS_ETIQUETA.has(formato)) {
      return res.status(400).json({ erro: 'Produto ou formato de etiqueta inválido' });
    }
    const quantidadeInteira = Number.parseInt(quantidade, 10);
    if (!Number.isInteger(quantidadeInteira) || quantidadeInteira < 1 || quantidadeInteira > 1000) {
      return res.status(400).json({ erro: 'Quantidade de etiquetas deve estar entre 1 e 1000' });
    }
    if (terminalId && !idValido(terminalId)) return res.status(400).json({ erro: 'Terminal inválido' });
    if (dispositivoId && !idValido(dispositivoId)) return res.status(400).json({ erro: 'Dispositivo inválido' });

    client = await dbPg.beginTransaction();
    const produto = await obterProdutoComercial(req.empresaId, req.lojaId, produtoId);
    if (!produto) throw new Error('Produto não encontrado ou inativo');

    if (terminalId) {
      const terminal = await dbPg.queryInTransaction(
        client,
        `SELECT id FROM terminais_pdv WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND ativo = true`,
        [terminalId, req.empresaId, req.lojaId]
      );
      if (terminal.rows.length === 0) throw new Error('Terminal não encontrado nesta loja');
    }
    if (dispositivoId) {
      const dispositivo = await dbPg.queryInTransaction(
        client,
        `SELECT id FROM dispositivos_perifericos
         WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND ativo = true AND tipo = 'impressora_termica'`,
        [dispositivoId, req.empresaId, req.lojaId]
      );
      if (dispositivo.rows.length === 0) throw new Error('Impressora não encontrada nesta loja');
    }

    const conteudo = {
      produto_id: produto.id,
      nome: produto.nome,
      codigo: produto.codigo_barras || produto.plu || produto.codigo_interno,
      plu: produto.plu,
      unidade: produto.unidade_medida,
      preco: produto.preco_final,
      preco_base: produto.preco_base,
      promocao: produto.promocao,
      formato,
      quantidade: quantidadeInteira,
    };
    const etiqueta = await dbPg.queryInTransaction(
      client,
      `INSERT INTO etiquetas_gondola
       (empresa_id, loja_id, produto_id, promocao_id, terminal_id, dispositivo_id, formato,
        quantidade, preco_exibido, conteudo, status, solicitado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [req.empresaId, req.lojaId, produto.id, promocaoId, terminalId, dispositivoId, formato,
       quantidadeInteira, produto.preco_final, JSON.stringify(conteudo), terminalId ? 'enfileirada' : 'pendente', req.usuario.usuario_id]
    );

    let trabalho = null;
    if (terminalId) {
      trabalho = await dbPg.queryInTransaction(
        client,
        `INSERT INTO fila_impressao_local
         (empresa_id, loja_id, terminal_id, dispositivo_id, tipo_documento, conteudo,
          chave_idempotencia, prioridade)
         VALUES ($1,$2,$3,$4,'etiqueta',$5,$6,7)
         RETURNING *`,
        [req.empresaId, req.lojaId, terminalId, dispositivoId, JSON.stringify({ etiqueta_id: etiqueta.rows[0].id, ...conteudo }), crypto.randomUUID()]
      );
      await dbPg.queryInTransaction(
        client,
        `UPDATE etiquetas_gondola SET fila_impressao_id = $1 WHERE id = $2`,
        [trabalho.rows[0].id, etiqueta.rows[0].id]
      );
    }

    await registrarAuditoriaTx(client, req, 'etiquetas_gondola', 'INSERT', etiqueta.rows[0].id, null, {
      etiqueta_id: etiqueta.rows[0].id,
      produto_id: produto.id,
      terminal_id: terminalId,
      fila_impressao_id: trabalho?.rows[0]?.id || null,
    });
    await dbPg.commit(client);
    client = null;
    res.status(201).json({
      sucesso: true,
      etiqueta: { ...etiqueta.rows[0], fila_impressao_id: trabalho?.rows[0]?.id || null },
      mensagem: terminalId ? 'Etiqueta enfileirada para impressão local' : 'Etiqueta registrada; selecione um terminal para impressão',
    });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    console.error('Erro ao gerar etiqueta:', error);
    res.status(400).json({ erro: error.message || 'Erro ao gerar etiqueta' });
  }
});

/** GET /supermercado/etiquetas — rastreia solicitações e status de impressão da loja. */
router.get('/etiquetas', autenticar, async (req, res) => {
  try {
    const params = [req.empresaId, req.lojaId];
    let sql = `
      SELECT eg.*, p.nome AS produto_nome, p.codigo_interno,
             f.status AS status_impressao, f.erro_ultima_tentativa, f.concluido_em
      FROM etiquetas_gondola eg
      JOIN produtos p ON p.id = eg.produto_id
      LEFT JOIN fila_impressao_local f ON f.id = eg.fila_impressao_id
      WHERE eg.empresa_id = $1 AND eg.loja_id = $2`;
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND eg.status = $${params.length}`;
    }
    sql += ' ORDER BY eg.data_criacao DESC LIMIT 200';
    const resultado = await dbPg.query(sql, params);
    res.json({ sucesso: true, etiquetas: resultado.rows });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar etiquetas' });
  }
});

/** GET /supermercado/transferencias — transferências de origem ou destino da loja ativa. */
router.get('/transferencias', autenticar, async (req, res) => {
  try {
    const params = [req.empresaId, req.lojaId];
    let sql = `
      SELECT t.*, origem.nome AS loja_origem_nome, destino.nome AS loja_destino_nome,
             COUNT(i.id)::int AS total_itens,
             COALESCE(SUM(i.quantidade_solicitada), 0) AS quantidade_solicitada,
             COALESCE(SUM(i.quantidade_enviada), 0) AS quantidade_enviada,
             COALESCE(SUM(i.quantidade_recebida), 0) AS quantidade_recebida
      FROM transferencias_estoque t
      JOIN lojas origem ON origem.id = t.loja_origem_id
      JOIN lojas destino ON destino.id = t.loja_destino_id
      LEFT JOIN itens_transferencia i ON i.transferencia_id = t.id
      WHERE t.empresa_id = $1 AND (t.loja_origem_id = $2 OR t.loja_destino_id = $2)`;
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND t.status = $${params.length}`;
    }
    sql += ' GROUP BY t.id, origem.nome, destino.nome ORDER BY t.data_criacao DESC LIMIT 200';
    const resultado = await dbPg.query(sql, params);
    res.json({ sucesso: true, loja_id: req.lojaId, transferencias: resultado.rows });
  } catch (error) {
    console.error('Erro ao listar transferências:', error);
    res.status(500).json({ erro: 'Erro ao listar transferências' });
  }
});

/** POST /supermercado/transferencias — solicita transferência a partir da loja ativa. */
router.post('/transferencias', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    const { loja_destino_id: lojaDestinoId, itens, observacoes = null } = req.body;
    if (!idValido(lojaDestinoId) || lojaDestinoId === req.lojaId) {
      return res.status(400).json({ erro: 'Selecione uma loja de destino diferente da loja ativa' });
    }
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 500) {
      return res.status(400).json({ erro: 'Informe entre 1 e 500 itens para a transferência' });
    }

    const itensNormalizados = itens.map((item) => ({
      produto_id: item.produto_id,
      lote: item.lote || null,
      validade: item.validade || null,
      quantidade_solicitada: decimal(item.quantidade, { obrigatorio: true, positivo: true, campo: 'Quantidade solicitada' }),
      custo_unitario: decimal(item.custo_unitario ?? 0, { campo: 'Custo unitário' }) || 0,
      observacoes: item.observacoes || null,
    }));
    if (itensNormalizados.some((item) => !idValido(item.produto_id))) {
      return res.status(400).json({ erro: 'Há produtos inválidos na transferência' });
    }

    client = await dbPg.beginTransaction();
    await garantirLojaDaEmpresa(client, req.empresaId, lojaDestinoId);
    const produtoIds = [...new Set(itensNormalizados.map((item) => item.produto_id))];
    const produtos = await dbPg.queryInTransaction(
      client,
      `SELECT id FROM produtos WHERE empresa_id = $1 AND ativo = true AND id = ANY($2::uuid[])`,
      [req.empresaId, produtoIds]
    );
    if (produtos.rows.length !== produtoIds.length) throw new Error('Há produtos inativos ou de outra empresa');

    const numero = `TRF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const transferencia = await dbPg.queryInTransaction(
      client,
      `INSERT INTO transferencias_estoque
        (empresa_id, numero, loja_origem_id, loja_destino_id, status, observacoes, solicitado_por)
       VALUES ($1,$2,$3,$4,'rascunho',$5,$6)
       RETURNING *`,
      [req.empresaId, numero, req.lojaId, lojaDestinoId, observacoes, req.usuario.usuario_id]
    );

    for (const item of itensNormalizados) {
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO itens_transferencia
          (transferencia_id, produto_id, lote, validade, quantidade_solicitada, custo_unitario, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [transferencia.rows[0].id, item.produto_id, item.lote, item.validade,
         item.quantidade_solicitada, item.custo_unitario, item.observacoes]
      );
    }
    await registrarAuditoriaTx(client, req, 'transferencias_estoque', 'INSERT', transferencia.rows[0].id, null, {
      numero,
      loja_origem_id: req.lojaId,
      loja_destino_id: lojaDestinoId,
      itens: itensNormalizados,
    });
    await dbPg.commit(client);
    client = null;
    res.status(201).json({ sucesso: true, transferencia: { ...transferencia.rows[0], itens: itensNormalizados } });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    console.error('Erro ao solicitar transferência:', error);
    res.status(400).json({ erro: error.message || 'Erro ao solicitar transferência' });
  }
});

/** POST /supermercado/transferencias/:id/enviar — separa e debita estoque da origem via FIFO. */
router.post('/transferencias/:id/enviar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'Transferência inválida' });
    client = await dbPg.beginTransaction();
    const resultado = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM transferencias_estoque
       WHERE id = $1 AND empresa_id = $2 AND loja_origem_id = $3 AND status = 'rascunho'
       FOR UPDATE`,
      [req.params.id, req.empresaId, req.lojaId]
    );
    if (resultado.rows.length === 0) throw new Error('Transferência não encontrada, não pertence à origem ativa ou não está em rascunho');
    const transferencia = resultado.rows[0];
    const itens = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM itens_transferencia WHERE transferencia_id = $1 ORDER BY data_criacao FOR UPDATE`,
      [transferencia.id]
    );
    if (itens.rows.length === 0) throw new Error('A transferência não possui itens');

    for (const item of itens.rows) {
      const saldos = await dbPg.queryInTransaction(
        client,
        `SELECT id, lote, validade, quantidade
         FROM estoque
         WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3 AND quantidade > 0
           AND ($4::varchar IS NULL OR lote IS NOT DISTINCT FROM $4)
           AND ($5::date IS NULL OR validade IS NOT DISTINCT FROM $5)
         ORDER BY validade NULLS LAST, data_atualizacao ASC
         FOR UPDATE`,
        [req.empresaId, req.lojaId, item.produto_id, item.lote, item.validade]
      );
      const disponivel = saldos.rows.reduce((total, saldo) => total + Number(saldo.quantidade), 0);
      if (disponivel < Number(item.quantidade_solicitada)) {
        throw new Error(`Estoque insuficiente para o item ${item.produto_id}: disponível ${disponivel}, solicitado ${item.quantidade_solicitada}`);
      }

      let restante = Number(item.quantidade_solicitada);
      for (const saldo of saldos.rows) {
        if (restante <= 0) break;
        const retirada = Math.min(restante, Number(saldo.quantidade));
        await dbPg.queryInTransaction(
          client,
          `UPDATE estoque SET quantidade = quantidade - $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`,
          [retirada, saldo.id]
        );
        await dbPg.queryInTransaction(
          client,
          `INSERT INTO movimentacoes_estoque
            (empresa_id, loja_id, produto_id, tipo, quantidade, lote, validade,
             documento_tipo, documento_numero, usuario_id, custo_unitario, motivo)
           VALUES ($1,$2,$3,'transferencia',$4,$5,$6,'transferencia',$7,$8,$9,$10)`,
          [req.empresaId, req.lojaId, item.produto_id, retirada, saldo.lote, saldo.validade,
           transferencia.numero, req.usuario.usuario_id, item.custo_unitario, `Envio para a loja ${transferencia.loja_destino_id}`]
        );
        restante -= retirada;
      }
      await dbPg.queryInTransaction(
        client,
        `UPDATE itens_transferencia SET quantidade_enviada = quantidade_solicitada WHERE id = $1`,
        [item.id]
      );
    }

    const atualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE transferencias_estoque
       SET status = 'em_transito', separado_por = $1, data_envio = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.usuario.usuario_id, transferencia.id]
    );
    await registrarAuditoriaTx(client, req, 'transferencias_estoque', 'UPDATE', transferencia.id, transferencia, atualizado.rows[0]);
    await dbPg.commit(client);
    client = null;
    res.json({ sucesso: true, transferencia: atualizado.rows[0], mensagem: 'Estoque separado e transferência enviada' });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    console.error('Erro ao enviar transferência:', error);
    res.status(400).json({ erro: error.message || 'Erro ao enviar transferência' });
  }
});

/** POST /supermercado/transferencias/:id/receber — confere e credita o estoque no destino. */
router.post('/transferencias/:id/receber', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'Transferência inválida' });
    client = await dbPg.beginTransaction();
    const resultado = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM transferencias_estoque
       WHERE id = $1 AND empresa_id = $2 AND loja_destino_id = $3
         AND status IN ('em_transito', 'recebida_parcial')
       FOR UPDATE`,
      [req.params.id, req.empresaId, req.lojaId]
    );
    if (resultado.rows.length === 0) throw new Error('Transferência não disponível para recebimento nesta loja');
    const transferencia = resultado.rows[0];
    const itens = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM itens_transferencia WHERE transferencia_id = $1 ORDER BY data_criacao FOR UPDATE`,
      [transferencia.id]
    );
    const recebidoInformado = new Map(
      Array.isArray(req.body.itens)
        ? req.body.itens.map((item) => [item.item_id, item.quantidade_recebida])
        : []
    );

    for (const item of itens.rows) {
      const pendente = Number(item.quantidade_enviada) - Number(item.quantidade_recebida);
      if (pendente <= 0) continue;
      const recebido = recebidoInformado.has(item.id)
        ? decimal(recebidoInformado.get(item.id), { obrigatorio: true, campo: 'Quantidade recebida' })
        : pendente;
      if (recebido > pendente) throw new Error(`Recebimento maior que o enviado para o item ${item.id}`);
      if (recebido === 0) continue;

      const saldo = await dbPg.queryInTransaction(
        client,
        `SELECT id FROM estoque
         WHERE empresa_id = $1 AND loja_id = $2 AND produto_id = $3
           AND lote IS NOT DISTINCT FROM $4 AND validade IS NOT DISTINCT FROM $5
         FOR UPDATE`,
        [req.empresaId, req.lojaId, item.produto_id, item.lote, item.validade]
      );
      if (saldo.rows.length > 0) {
        await dbPg.queryInTransaction(
          client,
          `UPDATE estoque SET quantidade = quantidade + $1, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $2`,
          [recebido, saldo.rows[0].id]
        );
      } else {
        await dbPg.queryInTransaction(
          client,
          `INSERT INTO estoque (empresa_id, loja_id, produto_id, quantidade, lote, validade)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.empresaId, req.lojaId, item.produto_id, recebido, item.lote, item.validade]
        );
      }
      await dbPg.queryInTransaction(
        client,
        `INSERT INTO movimentacoes_estoque
          (empresa_id, loja_id, produto_id, tipo, quantidade, lote, validade,
           documento_tipo, documento_numero, usuario_id, custo_unitario, motivo)
         VALUES ($1,$2,$3,'transferencia',$4,$5,$6,'transferencia',$7,$8,$9,$10)`,
        [req.empresaId, req.lojaId, item.produto_id, recebido, item.lote, item.validade,
         transferencia.numero, req.usuario.usuario_id, item.custo_unitario, `Recebimento da loja ${transferencia.loja_origem_id}`]
      );
      await dbPg.queryInTransaction(
        client,
        `UPDATE itens_transferencia
         SET quantidade_recebida = quantidade_recebida + $1
         WHERE id = $2`,
        [recebido, item.id]
      );
    }

    const pendencias = await dbPg.queryInTransaction(
      client,
      `SELECT COUNT(*)::int AS total
       FROM itens_transferencia
       WHERE transferencia_id = $1 AND quantidade_recebida < quantidade_enviada`,
      [transferencia.id]
    );
    const status = pendencias.rows[0].total === 0 ? 'recebida' : 'recebida_parcial';
    const atualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE transferencias_estoque
       SET status = $1, recebido_por = $2,
           data_recebimento = CASE WHEN $1 = 'recebida' THEN CURRENT_TIMESTAMP ELSE data_recebimento END
       WHERE id = $3
       RETURNING *`,
      [status, req.usuario.usuario_id, transferencia.id]
    );
    await registrarAuditoriaTx(client, req, 'transferencias_estoque', 'UPDATE', transferencia.id, transferencia, atualizado.rows[0]);
    await dbPg.commit(client);
    client = null;
    res.json({ sucesso: true, transferencia: atualizado.rows[0], mensagem: status === 'recebida' ? 'Transferência recebida integralmente' : 'Recebimento parcial registrado' });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    console.error('Erro ao receber transferência:', error);
    res.status(400).json({ erro: error.message || 'Erro ao receber transferência' });
  }
});

/** POST /supermercado/transferencias/:id/cancelar — só cancela rascunhos da origem. */
router.post('/transferencias/:id/cancelar', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  let client;
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'Transferência inválida' });
    client = await dbPg.beginTransaction();
    const anterior = await dbPg.queryInTransaction(
      client,
      `SELECT * FROM transferencias_estoque
       WHERE id = $1 AND empresa_id = $2 AND loja_origem_id = $3 AND status = 'rascunho'
       FOR UPDATE`,
      [req.params.id, req.empresaId, req.lojaId]
    );
    if (anterior.rows.length === 0) throw new Error('Somente rascunhos da loja de origem podem ser cancelados');
    const atualizado = await dbPg.queryInTransaction(
      client,
      `UPDATE transferencias_estoque SET status = 'cancelada' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await registrarAuditoriaTx(client, req, 'transferencias_estoque', 'CANCEL', req.params.id, anterior.rows[0], atualizado.rows[0]);
    await dbPg.commit(client);
    client = null;
    res.json({ sucesso: true, transferencia: atualizado.rows[0] });
  } catch (error) {
    if (client) await dbPg.rollback(client);
    res.status(400).json({ erro: error.message || 'Erro ao cancelar transferência' });
  }
});

// ============================================================================
// NOVOS ENDPOINTS: LOTES, FORNECEDORES E MARGEM
// ============================================================================

/**
 * GET /supermercado/lotes
 * Listar lotes de produtos com filtro por produto, loja e status
 */
router.get('/lotes', autenticar, autorizar('admin', 'gerente', 'vendedor', 'caixa'), async (req, res) => {
  try {
    const { produto_id, status = 'ativo', limite = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM lotes_produto WHERE empresa_id = $1 AND loja_id = $2';
    const params = [req.empresaId, req.lojaId];
    let paramIndex = 3;

    if (produto_id) {
      sql += ` AND produto_id = $${paramIndex++}`;
      params.push(produto_id);
    }
    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY data_validade ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limite, offset);

    const result = await dbPg.query(sql, params);
    res.json({ sucesso: true, lotes: result.rows });
  } catch (error) {
    console.error('Erro ao listar lotes:', error);
    res.status(500).json({ erro: 'Erro ao listar lotes' });
  }
});

/**
 * POST /supermercado/lotes
 * Criar novo lote de produto
 */
router.post('/lotes', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { produto_id, numero_lote, data_fabricacao, data_validade, quantidade_inicial, preco_custo, preco_venda } = req.body;

    if (!produto_id || !numero_lote || !data_validade || !quantidade_inicial) {
      return res.status(400).json({ erro: 'Campos obrigatórios: produto_id, numero_lote, data_validade, quantidade_inicial' });
    }

    const result = await dbPg.query(
      `INSERT INTO lotes_produto
       (empresa_id, loja_id, produto_id, numero_lote, data_fabricacao, data_validade, quantidade_inicial, quantidade_atual, preco_custo, preco_venda)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.empresaId, req.lojaId, produto_id, numero_lote, data_fabricacao || null, data_validade, quantidade_inicial, quantidade_inicial, preco_custo || null, preco_venda || null]
    );

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'lotes_produto',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, lote: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar lote:', error);
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'Lote já existe para este produto' });
    }
    res.status(500).json({ erro: 'Erro ao criar lote' });
  }
});

/**
 * GET /supermercado/fornecedores
 * Listar fornecedores da empresa
 */
router.get('/fornecedores', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { ativo = true, limite = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM fornecedores_produto WHERE empresa_id = $1';
    const params = [req.empresaId];
    let paramIndex = 2;

    if (ativo !== undefined) {
      sql += ` AND ativo = $${paramIndex++}`;
      params.push(ativo === 'true' || ativo === true);
    }

    sql += ` ORDER BY nome ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limite, offset);

    const result = await dbPg.query(sql, params);
    res.json({ sucesso: true, fornecedores: result.rows });
  } catch (error) {
    console.error('Erro ao listar fornecedores:', error);
    res.status(500).json({ erro: 'Erro ao listar fornecedores' });
  }
});

/**
 * POST /supermercado/fornecedores
 * Criar novo fornecedor
 */
router.post('/fornecedores', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { nome, cnpj, email, telefone, contato_nome, contato_telefone, endereco, cidade, estado, cep, prazo_entrega_dias, condicao_pagamento } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'Nome do fornecedor é obrigatório' });
    }

    const result = await dbPg.query(
      `INSERT INTO fornecedores_produto
       (empresa_id, nome, cnpj, email, telefone, contato_nome, contato_telefone, endereco, cidade, estado, cep, prazo_entrega_dias, condicao_pagamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.empresaId, nome, cnpj || null, email || null, telefone || null, contato_nome || null, contato_telefone || null, endereco || null, cidade || null, estado || null, cep || null, prazo_entrega_dias || 7, condicao_pagamento || null]
    );

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'fornecedores_produto',
      operacao: 'INSERT',
      registro_id: result.rows[0].id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(201).json({ sucesso: true, fornecedor: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'CNPJ já cadastrado' });
    }
    res.status(500).json({ erro: 'Erro ao criar fornecedor' });
  }
});

/**
 * GET /supermercado/margem
 * Listar análise de margem por produto
 */
router.get('/margem', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { limite = 50, offset = 0 } = req.query;
    const result = await dbPg.query(
      `SELECT * FROM margem_produto
       WHERE empresa_id = $1 AND loja_id = $2
       ORDER BY margem_percentual DESC
       LIMIT $3 OFFSET $4`,
      [req.empresaId, req.lojaId, limite, offset]
    );

    res.json({ sucesso: true, margens: result.rows });
  } catch (error) {
    console.error('Erro ao listar margens:', error);
    res.status(500).json({ erro: 'Erro ao listar margens' });
  }
});

/**
 * GET /supermercado/margem/resumo
 * Resumo de margens: média, mínima, máxima
 */
router.get('/margem/resumo', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const result = await dbPg.query(
      `SELECT
        COUNT(*) as total_produtos,
        AVG(margem_percentual) as margem_media,
        MIN(margem_percentual) as margem_minima,
        MAX(margem_percentual) as margem_maxima,
        SUM(faturamento_mes) as faturamento_total,
        SUM(lucro_mes) as lucro_total
       FROM margem_produto
       WHERE empresa_id = $1 AND loja_id = $2`,
      [req.empresaId, req.lojaId]
    );

    res.json({ sucesso: true, resumo: result.rows[0] });
  } catch (error) {
    console.error('Erro ao calcular resumo de margens:', error);
    res.status(500).json({ erro: 'Erro ao calcular resumo' });
  }
});

/**
 * PATCH /supermercado/margem/:produto_id
 * Atualizar margem de um produto
 */
router.patch('/margem/:produto_id', autenticar, autorizar('admin', 'gerente'), async (req, res) => {
  try {
    const { preco_custo, preco_venda } = req.body;

    if (!preco_custo || !preco_venda) {
      return res.status(400).json({ erro: 'preco_custo e preco_venda são obrigatórios' });
    }

    const result = await dbPg.query(
      `UPDATE margem_produto SET preco_custo = $1, preco_venda = $2, data_atualizacao = NOW()
       WHERE empresa_id = $3 AND loja_id = $4 AND produto_id = $5
       RETURNING *`,
      [preco_custo, preco_venda, req.empresaId, req.lojaId, req.params.produto_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Margem não encontrada' });
    }

    await dbPg.registrarAuditoria({
      empresa_id: req.empresaId,
      loja_id: req.lojaId,
      usuario_id: req.usuario.usuario_id,
      tabela: 'margem_produto',
      operacao: 'UPDATE',
      registro_id: req.params.produto_id,
      dados_novo: result.rows[0],
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({ sucesso: true, margem: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar margem:', error);
    res.status(500).json({ erro: 'Erro ao atualizar margem' });
  }
});

export default router;
