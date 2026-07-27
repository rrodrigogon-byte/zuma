/**
 * Módulo Multi-Loja — SetPoint Ultra · P5 do KYTTO ERP
 * Gerencia múltiplas unidades/filiais, transferências de estoque,
 * DRE por loja e permissões granulares por unidade
 */

import { db } from '../../core/database.js';

// ─────────────────────────────────────────────────────────────────────────────
// GESTÃO DE LOJAS / FILIAIS
// ─────────────────────────────────────────────────────────────────────────────

export async function listarLojas(tenantId) {
  const pool = db.getPool();
  return pool.query(
    `SELECT l.*,
            COUNT(DISTINCT u.id) as qtd_usuarios,
            COUNT(DISTINCT c.id) as qtd_caixas,
            COALESCE(SUM(v.valor_liquido) FILTER (WHERE v.data_venda >= CURRENT_DATE - INTERVAL '30 days' AND v.status = 'finalizada'), 0) as faturamento_30d
     FROM lojas l
     LEFT JOIN usuarios u ON u.loja_id = l.id
     LEFT JOIN caixas c ON c.loja_id = l.id
     LEFT JOIN vendas v ON v.loja_id = l.id
     WHERE l.empresa_id = $1
     GROUP BY l.id
     ORDER BY l.nome`,
    [tenantId]
  );
}

export async function criarLoja(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO lojas
       (empresa_id, nome, cnpj, inscricao_estadual, endereco_logradouro, endereco_numero,
        endereco_bairro, endereco_cidade, uf, cep, telefone, email, serie_nfce,
        csc, csc_id, ativa)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
     RETURNING *`,
    [tenantId, dados.nome, dados.cnpj, dados.inscricao_estadual,
     dados.endereco_logradouro, dados.endereco_numero, dados.endereco_bairro,
     dados.endereco_cidade, dados.uf, dados.cep, dados.telefone, dados.email,
     dados.serie_nfce || 1, dados.csc, dados.csc_id]
  );
}

export async function atualizarLoja(tenantId, lojaId, dados) {
  const pool = db.getPool();
  const campos = Object.keys(dados).filter(k => !['id','empresa_id'].includes(k));
  const sets   = campos.map((c, i) => `${c} = $${i + 3}`).join(', ');
  return pool.query(
    `UPDATE lojas SET ${sets} WHERE id = $1 AND empresa_id = $2 RETURNING *`,
    [lojaId, tenantId, ...campos.map(c => dados[c])]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFERÊNCIA DE ESTOQUE ENTRE LOJAS
// ─────────────────────────────────────────────────────────────────────────────

export async function criarTransferencia(tenantId, dados) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const numRes = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INT)), 0) + 1 AS n
       FROM transferencias_estoque WHERE empresa_id = $1`,
      [tenantId]
    );
    const numero = `TRF${new Date().getFullYear()}${String(numRes.rows[0].n).padStart(6,'0')}`;

    const transf = await client.query(
      `INSERT INTO transferencias_estoque
         (empresa_id, numero, loja_origem_id, loja_destino_id, usuario_id, status, observacoes)
       VALUES ($1, $2, $3, $4, $5, 'pendente', $6)
       RETURNING *`,
      [tenantId, numero, dados.loja_origem_id, dados.loja_destino_id, dados.usuario_id, dados.observacoes]
    );

    for (const item of dados.itens) {
      // Verificar estoque disponível na origem
      const estoqueRes = await client.query(
        `SELECT quantidade FROM estoque
         WHERE empresa_id = $1 AND produto_id = $2 AND loja_id = $3`,
        [tenantId, item.produto_id, dados.loja_origem_id]
      );
      const qtdDisp = Number(estoqueRes.rows[0]?.quantidade || 0);
      if (qtdDisp < item.quantidade) {
        throw new Error(`Estoque insuficiente para produto ${item.produto_id}: disponível ${qtdDisp}, solicitado ${item.quantidade}`);
      }

      await client.query(
        `INSERT INTO itens_transferencia (transferencia_id, produto_id, quantidade, custo_unitario)
         VALUES ($1, $2, $3, $4)`,
        [transf.rows[0].id, item.produto_id, item.quantidade, item.custo_unitario || 0]
      );
    }

    await client.query('COMMIT');
    return transf.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmarTransferencia(tenantId, transferenciaId, usuarioId) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transfRes = await client.query(
      `SELECT t.*, array_agg(json_build_object('produto_id', it.produto_id, 'quantidade', it.quantidade)) as itens
       FROM transferencias_estoque t
       JOIN itens_transferencia it ON it.transferencia_id = t.id
       WHERE t.id = $1 AND t.empresa_id = $2 AND t.status = 'pendente'
       GROUP BY t.id FOR UPDATE`,
      [transferenciaId, tenantId]
    );
    const transf = transfRes.rows[0];
    if (!transf) throw new Error('Transferência não encontrada ou já processada');

    for (const item of transf.itens) {
      // Debitar da origem
      await client.query(
        `UPDATE estoque SET quantidade = quantidade - $1
         WHERE empresa_id = $2 AND produto_id = $3 AND loja_id = $4`,
        [item.quantidade, tenantId, item.produto_id, transf.loja_origem_id]
      );
      // Creditar no destino (upsert)
      await client.query(
        `INSERT INTO estoque (empresa_id, produto_id, loja_id, quantidade)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (empresa_id, produto_id, loja_id)
         DO UPDATE SET quantidade = estoque.quantidade + EXCLUDED.quantidade`,
        [tenantId, item.produto_id, transf.loja_destino_id, item.quantidade]
      );
    }

    await client.query(
      `UPDATE transferencias_estoque SET status = 'concluida', concluida_em = NOW(), confirmado_por = $1
       WHERE id = $2`,
      [usuarioId, transferenciaId]
    );

    await client.query('COMMIT');
    return { sucesso: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listarTransferencias(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT t.*, lo.nome as loja_origem_nome, ld.nome as loja_destino_nome,
                      COUNT(it.id) as qtd_itens
               FROM transferencias_estoque t
               JOIN lojas lo ON lo.id = t.loja_origem_id
               JOIN lojas ld ON ld.id = t.loja_destino_id
               LEFT JOIN itens_transferencia it ON it.transferencia_id = t.id
               WHERE t.empresa_id = $1`;
  const params = [tenantId];
  if (filtros.status) { params.push(filtros.status); query += ` AND t.status = $${params.length}`; }
  if (filtros.loja_id) { params.push(filtros.loja_id); query += ` AND (t.loja_origem_id = $${params.length} OR t.loja_destino_id = $${params.length})`; }
  query += ' GROUP BY t.id, lo.nome, ld.nome ORDER BY t.criado_em DESC LIMIT 100';
  return pool.query(query, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRE POR LOJA
// ─────────────────────────────────────────────────────────────────────────────

export async function drePorLoja(tenantId, mes, ano) {
  const pool = db.getPool();
  const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim    = new Date(ano, mes, 0).toISOString().substring(0,10);

  const lojas = await pool.query(
    'SELECT id, nome FROM lojas WHERE empresa_id = $1 AND ativa = true ORDER BY nome',
    [tenantId]
  );

  const dre = [];
  for (const loja of lojas.rows) {
    const vendas = await pool.query(
      `SELECT
         COALESCE(SUM(v.valor_bruto), 0) as receita_bruta,
         COALESCE(SUM(v.valor_desconto), 0) as descontos,
         COALESCE(SUM(v.valor_liquido), 0) as receita_liquida,
         COUNT(v.id) as qtd_vendas,
         COUNT(DISTINCT DATE(v.data_venda)) as dias_com_venda
       FROM vendas v
       WHERE v.empresa_id = $1 AND v.loja_id = $2
         AND v.data_venda BETWEEN $3 AND $4 AND v.status = 'finalizada'`,
      [tenantId, loja.id, dataInicio, dataFim]
    );

    const cmv = await pool.query(
      `SELECT COALESCE(SUM(iv.quantidade * p.custo_medio), 0) as cmv
       FROM itens_venda iv
       JOIN vendas v ON v.id = iv.venda_id
       JOIN produtos p ON p.id = iv.produto_id
       WHERE v.empresa_id = $1 AND v.loja_id = $2
         AND v.data_venda BETWEEN $3 AND $4 AND v.status = 'finalizada'`,
      [tenantId, loja.id, dataInicio, dataFim]
    );

    const despesas = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) as total
       FROM movimentacoes_caixa
       WHERE empresa_id = $1 AND loja_id = $2 AND tipo = 'sangria'
         AND criado_em BETWEEN $3 AND $4`,
      [tenantId, loja.id, dataInicio, dataFim]
    );

    const rl  = Number(vendas.rows[0].receita_liquida);
    const cmvV = Number(cmv.rows[0].cmv);
    const lucBruto = rl - cmvV;
    const margBruta = rl > 0 ? (lucBruto / rl * 100) : 0;

    dre.push({
      loja_id: loja.id,
      loja_nome: loja.nome,
      receita_bruta: Number(vendas.rows[0].receita_bruta),
      descontos: Number(vendas.rows[0].descontos),
      receita_liquida: rl,
      cmv: cmvV,
      lucro_bruto: lucBruto,
      margem_bruta: margBruta.toFixed(1),
      qtd_vendas: Number(vendas.rows[0].qtd_vendas),
      ticket_medio: vendas.rows[0].qtd_vendas > 0 ? rl / vendas.rows[0].qtd_vendas : 0,
    });
  }

  return { mes, ano, lojas: dre };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSÕES POR UNIDADE
// ─────────────────────────────────────────────────────────────────────────────

export async function definirPermissoesUsuarioLoja(tenantId, usuarioId, lojaId, permissoes) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO usuario_loja_permissoes (empresa_id, usuario_id, loja_id, permissoes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, usuario_id, loja_id)
     DO UPDATE SET permissoes = EXCLUDED.permissoes, atualizado_em = NOW()
     RETURNING *`,
    [tenantId, usuarioId, lojaId, JSON.stringify(permissoes)]
  );
}

export async function listarUsuariosPorLoja(tenantId, lojaId) {
  const pool = db.getPool();
  return pool.query(
    `SELECT u.id, u.nome, u.email, u.perfil,
            COALESCE(ulp.permissoes, '[]'::jsonb) as permissoes_loja
     FROM usuarios u
     LEFT JOIN usuario_loja_permissoes ulp ON ulp.usuario_id = u.id AND ulp.loja_id = $2
     WHERE u.empresa_id = $1 AND (u.loja_id = $2 OR ulp.loja_id = $2)
     ORDER BY u.nome`,
    [tenantId, lojaId]
  );
}
