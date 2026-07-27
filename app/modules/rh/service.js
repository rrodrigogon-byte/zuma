/**
 * Módulo RH e Comissões — SetPoint Ultra · P9 do KYTTO ERP
 * Folha simplificada, metas, ranking de vendedores, comissões automáticas
 */

import { db } from '../../core/database.js';

// ─────────────────────────────────────────────────────────────────────────────
// COLABORADORES
// ─────────────────────────────────────────────────────────────────────────────

export async function listarColaboradores(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT c.*, d.nome as departamento_nome,
                      COALESCE(SUM(com.valor_comissao) FILTER (WHERE DATE_TRUNC('month', com.criado_em) = DATE_TRUNC('month', NOW())), 0) as comissao_mes
               FROM colaboradores c
               LEFT JOIN departamentos d ON d.id = c.departamento_id
               LEFT JOIN comissoes com ON com.colaborador_id = c.id
               WHERE c.empresa_id = $1`;
  const params = [tenantId];
  if (filtros.departamento_id) { params.push(filtros.departamento_id); query += ` AND c.departamento_id = $${params.length}`; }
  if (filtros.ativo !== undefined) { params.push(filtros.ativo); query += ` AND c.ativo = $${params.length}`; }
  query += ' GROUP BY c.id, d.nome ORDER BY c.nome';
  return pool.query(query, params);
}

export async function criarColaborador(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO colaboradores
       (empresa_id, nome, cpf, rg, data_nascimento, data_admissao, cargo, departamento_id,
        salario_base, tipo_comissao, percentual_comissao, meta_mensal, email, telefone, ativo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
     RETURNING *`,
    [tenantId, dados.nome, dados.cpf, dados.rg, dados.data_nascimento, dados.data_admissao,
     dados.cargo, dados.departamento_id, dados.salario_base, dados.tipo_comissao || 'percentual',
     dados.percentual_comissao || 0, dados.meta_mensal || 0, dados.email, dados.telefone]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMISSÕES AUTOMÁTICAS
// ─────────────────────────────────────────────────────────────────────────────

export async function calcularComissoesMes(tenantId, mes, ano) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const dataFim    = new Date(ano, mes, 0).toISOString().substring(0,10);

    const colaboradores = await client.query(
      `SELECT * FROM colaboradores WHERE empresa_id = $1 AND ativo = true AND percentual_comissao > 0`,
      [tenantId]
    );

    const resultado = [];
    for (const col of colaboradores.rows) {
      // Buscar vendas do colaborador no período
      const vendas = await client.query(
        `SELECT COALESCE(SUM(valor_liquido), 0) as total_vendas, COUNT(*) as qtd_vendas
         FROM vendas
         WHERE empresa_id = $1 AND vendedor_id = $2
           AND data_venda BETWEEN $3 AND $4 AND status = 'finalizada'`,
        [tenantId, col.id, dataInicio, dataFim]
      );

      const totalVendas = Number(vendas.rows[0].total_vendas);
      let valorComissao = 0;

      if (col.tipo_comissao === 'percentual') {
        valorComissao = totalVendas * (Number(col.percentual_comissao) / 100);
      } else if (col.tipo_comissao === 'meta') {
        // Comissão escalonada por meta
        const pctMeta = col.meta_mensal > 0 ? (totalVendas / Number(col.meta_mensal)) * 100 : 0;
        if (pctMeta >= 100) valorComissao = totalVendas * (Number(col.percentual_comissao) / 100);
        else if (pctMeta >= 80) valorComissao = totalVendas * (Number(col.percentual_comissao) * 0.7 / 100);
        else if (pctMeta >= 60) valorComissao = totalVendas * (Number(col.percentual_comissao) * 0.5 / 100);
      }

      if (valorComissao > 0) {
        // Verificar se já existe comissão para este período
        const existente = await client.query(
          `SELECT id FROM comissoes WHERE empresa_id=$1 AND colaborador_id=$2 AND mes=$3 AND ano=$4`,
          [tenantId, col.id, mes, ano]
        );
        if (existente.rows.length === 0) {
          await client.query(
            `INSERT INTO comissoes (empresa_id, colaborador_id, mes, ano, total_vendas, valor_comissao, status)
             VALUES ($1,$2,$3,$4,$5,$6,'pendente')`,
            [tenantId, col.id, mes, ano, totalVendas, valorComissao]
          );
        } else {
          await client.query(
            `UPDATE comissoes SET total_vendas=$1, valor_comissao=$2 WHERE id=$3`,
            [totalVendas, valorComissao, existente.rows[0].id]
          );
        }
      }

      resultado.push({
        colaborador_id: col.id,
        nome: col.nome,
        total_vendas: totalVendas,
        qtd_vendas: Number(vendas.rows[0].qtd_vendas),
        meta_mensal: Number(col.meta_mensal),
        pct_meta: col.meta_mensal > 0 ? ((totalVendas / Number(col.meta_mensal)) * 100).toFixed(1) : null,
        valor_comissao: valorComissao,
      });
    }

    await client.query('COMMIT');
    return resultado.sort((a,b) => b.total_vendas - a.total_vendas);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING DE VENDEDORES
// ─────────────────────────────────────────────────────────────────────────────

export async function rankingVendedores(tenantId, mes, ano) {
  const pool = db.getPool();
  const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim    = new Date(ano, mes, 0).toISOString().substring(0,10);

  return pool.query(
    `SELECT c.id, c.nome, c.cargo, c.meta_mensal, c.percentual_comissao,
            COALESCE(SUM(v.valor_liquido), 0) as total_vendas,
            COUNT(v.id) as qtd_vendas,
            COALESCE(AVG(v.valor_liquido), 0) as ticket_medio,
            COALESCE(SUM(v.valor_liquido), 0) / NULLIF(c.meta_mensal, 0) * 100 as pct_meta,
            COALESCE(SUM(v.valor_liquido), 0) * COALESCE(c.percentual_comissao, 0) / 100 as comissao_estimada,
            RANK() OVER (ORDER BY COALESCE(SUM(v.valor_liquido), 0) DESC) as posicao
     FROM colaboradores c
     LEFT JOIN vendas v ON v.vendedor_id = c.id AND v.data_venda BETWEEN $2 AND $3 AND v.status = 'finalizada'
     WHERE c.empresa_id = $1 AND c.ativo = true
     GROUP BY c.id ORDER BY total_vendas DESC`,
    [tenantId, dataInicio, dataFim]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLHA SIMPLIFICADA
// ─────────────────────────────────────────────────────────────────────────────

export async function calcularFolha(tenantId, mes, ano) {
  const pool = db.getPool();
  const colaboradores = await pool.query(
    `SELECT c.*, com.valor_comissao
     FROM colaboradores c
     LEFT JOIN comissoes com ON com.colaborador_id = c.id AND com.mes = $2 AND com.ano = $3
     WHERE c.empresa_id = $1 AND c.ativo = true`,
    [tenantId, mes, ano]
  );

  const folha = [];
  for (const col of colaboradores.rows) {
    const salario      = Number(col.salario_base);
    const comissao     = Number(col.valor_comissao || 0);
    const bruto        = salario + comissao;

    // INSS (tabela 2026)
    let inss = 0;
    if (bruto <= 1518.00) inss = bruto * 0.075;
    else if (bruto <= 2793.88) inss = bruto * 0.09;
    else if (bruto <= 4190.83) inss = bruto * 0.12;
    else if (bruto <= 8157.41) inss = bruto * 0.14;
    else inss = 8157.41 * 0.14;

    // IRRF (tabela 2026)
    const baseIRRF = bruto - inss;
    let irrf = 0;
    if (baseIRRF > 4664.68) irrf = baseIRRF * 0.275 - 869.36;
    else if (baseIRRF > 3751.05) irrf = baseIRRF * 0.225 - 636.13;
    else if (baseIRRF > 2826.65) irrf = baseIRRF * 0.15 - 354.80;
    else if (baseIRRF > 2259.20) irrf = baseIRRF * 0.075 - 169.44;
    irrf = Math.max(0, irrf);

    const fgts   = bruto * 0.08;
    const liquido = bruto - inss - irrf;

    folha.push({
      colaborador_id: col.id,
      nome: col.nome,
      cargo: col.cargo,
      salario_base: salario,
      comissao,
      bruto,
      inss: Number(inss.toFixed(2)),
      irrf: Number(irrf.toFixed(2)),
      fgts: Number(fgts.toFixed(2)),
      liquido: Number(liquido.toFixed(2)),
    });
  }

  return {
    mes, ano,
    colaboradores: folha,
    totais: {
      bruto: folha.reduce((s,c) => s + c.bruto, 0),
      inss:  folha.reduce((s,c) => s + c.inss, 0),
      irrf:  folha.reduce((s,c) => s + c.irrf, 0),
      fgts:  folha.reduce((s,c) => s + c.fgts, 0),
      liquido: folha.reduce((s,c) => s + c.liquido, 0),
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// METAS
// ─────────────────────────────────────────────────────────────────────────────

export async function definirMetas(tenantId, metas) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const meta of metas) {
      await client.query(
        `INSERT INTO metas_vendedor (empresa_id, colaborador_id, mes, ano, meta_valor, meta_qtd)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (empresa_id, colaborador_id, mes, ano)
         DO UPDATE SET meta_valor = EXCLUDED.meta_valor, meta_qtd = EXCLUDED.meta_qtd`,
        [tenantId, meta.colaborador_id, meta.mes, meta.ano, meta.meta_valor, meta.meta_qtd]
      );
    }
    await client.query('COMMIT');
    return { sucesso: true, total: metas.length };
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
