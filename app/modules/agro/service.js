/**
 * Módulo Agro — SetPoint Ultra · P1 do KYTTO ERP
 * Balança rodoviária, romaneio de carga, pesagem de grãos,
 * nota de produtor rural, controle de talhões e safras
 */

import { db } from '../../core/database.js';

// ─────────────────────────────────────────────────────────────────────────────
// SAFRAS E TALHÕES
// ─────────────────────────────────────────────────────────────────────────────

export async function criarSafra(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO safras
       (empresa_id, nome, cultura, ano_inicio, ano_fim, area_ha, status, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, 'ativa', $7)
     RETURNING *`,
    [tenantId, dados.nome, dados.cultura, dados.ano_inicio, dados.ano_fim,
     dados.area_ha, dados.observacoes]
  );
}

export async function listarSafras(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT s.*, COUNT(t.id) as qtd_talhoes,
                      COALESCE(SUM(t.area_ha), 0) as area_total_ha
               FROM safras s
               LEFT JOIN talhoes t ON t.safra_id = s.id AND t.empresa_id = s.empresa_id
               WHERE s.empresa_id = $1`;
  const params = [tenantId];
  if (filtros.status) { params.push(filtros.status); query += ` AND s.status = $${params.length}`; }
  query += ' GROUP BY s.id ORDER BY s.ano_inicio DESC';
  return pool.query(query, params);
}

export async function criarTalhao(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO talhoes
       (empresa_id, safra_id, nome, cultura, area_ha, variedade, data_plantio,
        data_colheita_prevista, status, coordenadas_geojson)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'plantado', $9)
     RETURNING *`,
    [tenantId, dados.safra_id, dados.nome, dados.cultura, dados.area_ha,
     dados.variedade, dados.data_plantio, dados.data_colheita_prevista,
     dados.coordenadas_geojson ? JSON.stringify(dados.coordenadas_geojson) : null]
  );
}

export async function registrarColheita(tenantId, talhaoId, dados) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const colheita = await client.query(
      `INSERT INTO colheitas
         (empresa_id, talhao_id, data_colheita, peso_bruto_kg, umidade_percentual,
          impureza_percentual, peso_liquido_kg, produtividade_sc_ha, silo_destino, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenantId, talhaoId, dados.data_colheita, dados.peso_bruto_kg,
       dados.umidade_percentual || 0, dados.impureza_percentual || 0,
       dados.peso_liquido_kg, dados.produtividade_sc_ha, dados.silo_destino, dados.observacoes]
    );

    await client.query(
      `UPDATE talhoes SET status = 'colhido', data_colheita_real = $1 WHERE id = $2`,
      [dados.data_colheita, talhaoId]
    );

    await client.query('COMMIT');
    return colheita.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANÇA RODOVIÁRIA
// ─────────────────────────────────────────────────────────────────────────────

export async function abrirTicketBalanca(tenantId, dados) {
  const pool = db.getPool();
  const numRes = await pool.query(
    `SELECT COALESCE(MAX(numero_ticket), 0) + 1 AS proximo
     FROM tickets_balanca WHERE empresa_id = $1`,
    [tenantId]
  );
  const numero = numRes.rows[0].proximo;

  return pool.query(
    `INSERT INTO tickets_balanca
       (empresa_id, numero_ticket, placa_veiculo, motorista, transportadora_id,
        fornecedor_id, produto_id, safra_id, talhao_id, tipo_operacao,
        peso_entrada_kg, data_entrada, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 'aguardando_saida')
     RETURNING *`,
    [tenantId, numero, dados.placa_veiculo, dados.motorista,
     dados.transportadora_id, dados.fornecedor_id, dados.produto_id,
     dados.safra_id, dados.talhao_id, dados.tipo_operacao || 'entrada',
     dados.peso_entrada_kg]
  );
}

export async function registrarPesagemSaida(tenantId, ticketId, pesoBrutoKg, umidade = 0, impureza = 0) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ticketRes = await client.query(
      'SELECT * FROM tickets_balanca WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [ticketId, tenantId]
    );
    const ticket = ticketRes.rows[0];
    if (!ticket) throw new Error('Ticket não encontrado');

    const pesoTara     = Number(ticket.peso_entrada_kg);
    const pesoBruto    = Number(pesoBrutoKg);
    const pesoLiquido  = Math.abs(pesoBruto - pesoTara);
    const fatorUmidade = Math.max(0, (umidade - 13) / 100); // Desconto umidade (base 13%)
    const fatorImp     = impureza / 100;
    const pesoDescontado = pesoLiquido * (1 - fatorUmidade - fatorImp);
    const sacas66kg    = pesoDescontado / 60; // Soja: 60kg/sc; Milho: 60kg/sc

    const updated = await client.query(
      `UPDATE tickets_balanca SET
         peso_saida_kg = $1,
         peso_liquido_kg = $2,
         peso_descontado_kg = $3,
         umidade_percentual = $4,
         impureza_percentual = $5,
         sacas = $6,
         data_saida = NOW(),
         status = 'finalizado'
       WHERE id = $7
       RETURNING *`,
      [pesoBruto, pesoLiquido, pesoDescontado, umidade, impureza, sacas66kg, ticketId]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listarTicketsBalanca(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT tb.*, p.nome as produto_nome, f.razao_social as fornecedor_nome
               FROM tickets_balanca tb
               LEFT JOIN produtos p ON p.id = tb.produto_id
               LEFT JOIN fornecedores f ON f.id = tb.fornecedor_id
               WHERE tb.empresa_id = $1`;
  const params = [tenantId];

  if (filtros.status) { params.push(filtros.status); query += ` AND tb.status = $${params.length}`; }
  if (filtros.data_inicio) { params.push(filtros.data_inicio); query += ` AND tb.data_entrada >= $${params.length}`; }
  if (filtros.data_fim) { params.push(filtros.data_fim); query += ` AND tb.data_entrada <= $${params.length}`; }
  if (filtros.placa) { params.push(`%${filtros.placa}%`); query += ` AND tb.placa_veiculo ILIKE $${params.length}`; }

  query += ' ORDER BY tb.data_entrada DESC LIMIT 100';
  return pool.query(query, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROMANEIO DE CARGA
// ─────────────────────────────────────────────────────────────────────────────

export async function criarRomaneio(tenantId, dados) {
  const pool = db.getPool();
  const numRes = await pool.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero, '[^0-9]', '', 'g') AS INT)), 0) + 1 AS proximo
     FROM romaneios WHERE empresa_id = $1`,
    [tenantId]
  );
  const numero = `ROM${new Date().getFullYear()}${String(numRes.rows[0].proximo).padStart(6, '0')}`;

  return pool.query(
    `INSERT INTO romaneios
       (empresa_id, numero, tipo, data_emissao, fornecedor_id, transportadora_id,
        placa_veiculo, motorista, produto_id, safra_id, peso_bruto_kg,
        peso_tara_kg, peso_liquido_kg, umidade_percentual, impureza_percentual,
        sacas, valor_unitario, valor_total, status, observacoes)
     VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'emitido', $18)
     RETURNING *`,
    [tenantId, numero, dados.tipo || 'compra',
     dados.fornecedor_id, dados.transportadora_id,
     dados.placa_veiculo, dados.motorista,
     dados.produto_id, dados.safra_id,
     dados.peso_bruto_kg, dados.peso_tara_kg,
     dados.peso_liquido_kg, dados.umidade_percentual || 0,
     dados.impureza_percentual || 0, dados.sacas,
     dados.valor_unitario, dados.valor_total, dados.observacoes]
  );
}

export async function listarRomaneios(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT r.*, p.nome as produto_nome, f.razao_social as fornecedor_nome
               FROM romaneios r
               LEFT JOIN produtos p ON p.id = r.produto_id
               LEFT JOIN fornecedores f ON f.id = r.fornecedor_id
               WHERE r.empresa_id = $1`;
  const params = [tenantId];
  if (filtros.status) { params.push(filtros.status); query += ` AND r.status = $${params.length}`; }
  if (filtros.data_inicio) { params.push(filtros.data_inicio); query += ` AND r.data_emissao >= $${params.length}`; }
  if (filtros.data_fim) { params.push(filtros.data_fim); query += ` AND r.data_emissao <= $${params.length}`; }
  query += ' ORDER BY r.data_emissao DESC LIMIT 100';
  return pool.query(query, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTA FISCAL DO PRODUTOR RURAL
// ─────────────────────────────────────────────────────────────────────────────

export async function emitirNotaProdutor(tenantId, dados) {
  const pool = db.getPool();
  const numRes = await pool.query(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS proximo
     FROM notas_produtor WHERE empresa_id = $1`,
    [tenantId]
  );
  const numero = numRes.rows[0].proximo;

  return pool.query(
    `INSERT INTO notas_produtor
       (empresa_id, numero, serie, data_emissao, produtor_id, produto_id,
        safra_id, quantidade_kg, sacas, valor_unitario, valor_total,
        base_calculo_funrural, aliquota_funrural, valor_funrural,
        base_calculo_senar, aliquota_senar, valor_senar,
        valor_liquido, status, observacoes)
     VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'emitida', $18)
     RETURNING *`,
    [tenantId, numero, dados.serie || 1,
     dados.produtor_id, dados.produto_id, dados.safra_id,
     dados.quantidade_kg, dados.sacas,
     dados.valor_unitario, dados.valor_total,
     dados.valor_total, // base FUNRURAL = valor total
     dados.aliquota_funrural || 1.5,
     dados.valor_total * (dados.aliquota_funrural || 1.5) / 100,
     dados.valor_total, // base SENAR
     dados.aliquota_senar || 0.2,
     dados.valor_total * (dados.aliquota_senar || 0.2) / 100,
     dados.valor_total * (1 - (dados.aliquota_funrural || 1.5) / 100 - (dados.aliquota_senar || 0.2) / 100),
     dados.observacoes]
  );
}

export async function listarNotasProdutor(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT np.*, p.nome as produto_nome,
                      prod.razao_social as produtor_nome
               FROM notas_produtor np
               LEFT JOIN produtos p ON p.id = np.produto_id
               LEFT JOIN fornecedores prod ON prod.id = np.produtor_id
               WHERE np.empresa_id = $1`;
  const params = [tenantId];
  if (filtros.status) { params.push(filtros.status); query += ` AND np.status = $${params.length}`; }
  if (filtros.data_inicio) { params.push(filtros.data_inicio); query += ` AND np.data_emissao >= $${params.length}`; }
  query += ' ORDER BY np.data_emissao DESC LIMIT 100';
  return pool.query(query, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLE DE SILOS E ARMAZENAGEM
// ─────────────────────────────────────────────────────────────────────────────

export async function listarSilos(tenantId) {
  const pool = db.getPool();
  return pool.query(
    `SELECT s.*,
            COALESCE(SUM(e.quantidade_kg), 0) as ocupacao_kg,
            ROUND(COALESCE(SUM(e.quantidade_kg), 0) / NULLIF(s.capacidade_kg, 0) * 100, 1) as ocupacao_percentual
     FROM silos s
     LEFT JOIN estoque_silo e ON e.silo_id = s.id AND e.empresa_id = s.empresa_id
     WHERE s.empresa_id = $1
     GROUP BY s.id
     ORDER BY s.nome`,
    [tenantId]
  );
}

export async function movimentarSilo(tenantId, siloId, tipo, quantidadeKg, produtoId, observacoes) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sinal = tipo === 'entrada' ? 1 : -1;
    await client.query(
      `INSERT INTO estoque_silo (empresa_id, silo_id, produto_id, quantidade_kg)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (empresa_id, silo_id, produto_id)
       DO UPDATE SET quantidade_kg = estoque_silo.quantidade_kg + EXCLUDED.quantidade_kg`,
      [tenantId, siloId, produtoId, sinal * quantidadeKg]
    );

    await client.query(
      `INSERT INTO movimentacoes_silo
         (empresa_id, silo_id, produto_id, tipo, quantidade_kg, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, siloId, produtoId, tipo, quantidadeKg, observacoes]
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

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD AGRO
// ─────────────────────────────────────────────────────────────────────────────

export async function dashboardAgro(tenantId) {
  const pool = db.getPool();
  const [safras, tickets, romaneios, silos] = await Promise.all([
    pool.query(
      `SELECT cultura, COUNT(*) as qtd_talhoes,
              SUM(area_ha) as area_total,
              SUM(CASE WHEN status = 'colhido' THEN area_ha ELSE 0 END) as area_colhida
       FROM talhoes WHERE empresa_id = $1 GROUP BY cultura`,
      [tenantId]
    ),
    pool.query(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status='aguardando_saida' THEN 1 END) as aguardando,
              COALESCE(SUM(CASE WHEN status='finalizado' THEN peso_liquido_kg END), 0) as peso_total_kg,
              COALESCE(SUM(CASE WHEN status='finalizado' THEN sacas END), 0) as sacas_total
       FROM tickets_balanca WHERE empresa_id = $1 AND data_entrada >= CURRENT_DATE - INTERVAL '30 days'`,
      [tenantId]
    ),
    pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(valor_total), 0) as valor_total
       FROM romaneios WHERE empresa_id = $1 AND data_emissao >= CURRENT_DATE - INTERVAL '30 days'`,
      [tenantId]
    ),
    pool.query(
      `SELECT s.nome, s.capacidade_kg,
              COALESCE(SUM(e.quantidade_kg), 0) as ocupacao_kg
       FROM silos s
       LEFT JOIN estoque_silo e ON e.silo_id = s.id AND e.empresa_id = s.empresa_id
       WHERE s.empresa_id = $1 GROUP BY s.id ORDER BY s.nome`,
      [tenantId]
    ),
  ]);

  return {
    talhoes_por_cultura: safras.rows,
    balanca_30_dias: tickets.rows[0],
    romaneios_30_dias: romaneios.rows[0],
    silos: silos.rows,
  };
}
