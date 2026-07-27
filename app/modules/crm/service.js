/**
 * Módulo CRM Avançado — SetPoint Ultra · P6 do KYTTO ERP
 * Funil de vendas, automações de marketing, régua de relacionamento,
 * segmentação de clientes e campanhas via WhatsApp
 */

import { db } from '../../core/database.js';
import { enviarWhatsApp } from '../../core/whatsapp.js';

// ─────────────────────────────────────────────────────────────────────────────
// FUNIL DE VENDAS
// ─────────────────────────────────────────────────────────────────────────────

export async function listarFunis(tenantId) {
  const pool = db.getPool();
  return pool.query(
    `SELECT f.*, COUNT(e.id) as qtd_etapas
     FROM funis_venda f
     LEFT JOIN etapas_funil e ON e.funil_id = f.id
     WHERE f.empresa_id = $1 GROUP BY f.id ORDER BY f.nome`,
    [tenantId]
  );
}

export async function criarFunil(tenantId, dados) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const funil = await client.query(
      `INSERT INTO funis_venda (empresa_id, nome, descricao) VALUES ($1, $2, $3) RETURNING *`,
      [tenantId, dados.nome, dados.descricao]
    );
    for (let i = 0; i < dados.etapas.length; i++) {
      await client.query(
        `INSERT INTO etapas_funil (funil_id, empresa_id, nome, ordem, cor, probabilidade)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [funil.rows[0].id, tenantId, dados.etapas[i].nome, i + 1,
         dados.etapas[i].cor || '#6366f1', dados.etapas[i].probabilidade || 50]
      );
    }
    await client.query('COMMIT');
    return funil.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function listarOportunidades(tenantId, filtros = {}) {
  const pool = db.getPool();
  let query = `SELECT o.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
                      ef.nome as etapa_nome, ef.cor as etapa_cor, ef.ordem as etapa_ordem,
                      u.nome as responsavel_nome
               FROM oportunidades o
               JOIN clientes c ON c.id = o.cliente_id
               JOIN etapas_funil ef ON ef.id = o.etapa_id
               LEFT JOIN usuarios u ON u.id = o.responsavel_id
               WHERE o.empresa_id = $1`;
  const params = [tenantId];
  if (filtros.funil_id) { params.push(filtros.funil_id); query += ` AND ef.funil_id = $${params.length}`; }
  if (filtros.responsavel_id) { params.push(filtros.responsavel_id); query += ` AND o.responsavel_id = $${params.length}`; }
  if (filtros.status) { params.push(filtros.status); query += ` AND o.status = $${params.length}`; }
  query += ' ORDER BY ef.ordem, o.criado_em DESC';
  return pool.query(query, params);
}

export async function criarOportunidade(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO oportunidades
       (empresa_id, cliente_id, etapa_id, responsavel_id, titulo, valor_estimado,
        data_fechamento_prevista, temperatura, origem, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [tenantId, dados.cliente_id, dados.etapa_id, dados.responsavel_id,
     dados.titulo, dados.valor_estimado, dados.data_fechamento_prevista,
     dados.temperatura || 'morno', dados.origem || 'manual', dados.observacoes]
  );
}

export async function moverOportunidade(tenantId, oportunidadeId, novaEtapaId, motivo) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const opp = await client.query(
      'SELECT * FROM oportunidades WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [oportunidadeId, tenantId]
    );
    if (!opp.rows[0]) throw new Error('Oportunidade não encontrada');

    await client.query(
      `INSERT INTO historico_oportunidade (oportunidade_id, etapa_anterior_id, etapa_nova_id, motivo)
       VALUES ($1, $2, $3, $4)`,
      [oportunidadeId, opp.rows[0].etapa_id, novaEtapaId, motivo]
    );

    const updated = await client.query(
      `UPDATE oportunidades SET etapa_id = $1, atualizado_em = NOW() WHERE id = $2 RETURNING *`,
      [novaEtapaId, oportunidadeId]
    );

    // Verificar automações para a nova etapa
    await executarAutomacoesEtapa(tenantId, novaEtapaId, opp.rows[0], client);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

async function executarAutomacoesEtapa(tenantId, etapaId, oportunidade, client) {
  const autos = await client.query(
    `SELECT * FROM automacoes_crm WHERE empresa_id = $1 AND etapa_gatilho_id = $2 AND ativa = true`,
    [tenantId, etapaId]
  );
  for (const auto of autos.rows) {
    if (auto.tipo_acao === 'whatsapp' && oportunidade.cliente_id) {
      const clienteRes = await client.query('SELECT telefone, nome FROM clientes WHERE id = $1', [oportunidade.cliente_id]);
      if (clienteRes.rows[0]?.telefone) {
        await enviarWhatsApp(clienteRes.rows[0].telefone, auto.mensagem_template.replace('{{nome}}', clienteRes.rows[0].nome));
      }
    }
    if (auto.tipo_acao === 'tarefa') {
      await client.query(
        `INSERT INTO tarefas_crm (empresa_id, oportunidade_id, titulo, responsavel_id, prazo_dias)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, oportunidade.id, auto.tarefa_titulo, oportunidade.responsavel_id, auto.tarefa_prazo_dias || 1]
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENTAÇÃO DE CLIENTES
// ─────────────────────────────────────────────────────────────────────────────

export async function segmentarClientes(tenantId, criterios) {
  const pool = db.getPool();
  let conditions = ['c.empresa_id = $1'];
  const params = [tenantId];

  if (criterios.sem_compra_dias) {
    params.push(criterios.sem_compra_dias);
    conditions.push(`(SELECT MAX(data_venda) FROM vendas WHERE cliente_id = c.id) < NOW() - INTERVAL '${criterios.sem_compra_dias} days'`);
  }
  if (criterios.valor_minimo_total) {
    params.push(criterios.valor_minimo_total);
    conditions.push(`(SELECT COALESCE(SUM(valor_liquido),0) FROM vendas WHERE cliente_id = c.id AND status='finalizada') >= $${params.length}`);
  }
  if (criterios.cidade) {
    params.push(criterios.cidade);
    conditions.push(`c.cidade ILIKE $${params.length}`);
  }
  if (criterios.tag) {
    params.push(`%${criterios.tag}%`);
    conditions.push(`c.tags::text ILIKE $${params.length}`);
  }

  return pool.query(
    `SELECT c.id, c.nome, c.telefone, c.email, c.cidade,
            COALESCE(SUM(v.valor_liquido), 0) as total_compras,
            COUNT(v.id) as qtd_compras,
            MAX(v.data_venda) as ultima_compra
     FROM clientes c
     LEFT JOIN vendas v ON v.cliente_id = c.id AND v.status = 'finalizada'
     WHERE ${conditions.join(' AND ')}
     GROUP BY c.id ORDER BY total_compras DESC`,
    params
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPANHAS DE WHATSAPP
// ─────────────────────────────────────────────────────────────────────────────

export async function criarCampanha(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO campanhas_crm
       (empresa_id, nome, tipo, mensagem, segmento_criterios, data_envio_programado, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'rascunho')
     RETURNING *`,
    [tenantId, dados.nome, dados.tipo || 'whatsapp', dados.mensagem,
     JSON.stringify(dados.segmento_criterios || {}), dados.data_envio_programado]
  );
}

export async function dispararCampanha(tenantId, campanhaId) {
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const campRes = await client.query(
      'SELECT * FROM campanhas_crm WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [campanhaId, tenantId]
    );
    const camp = campRes.rows[0];
    if (!camp) throw new Error('Campanha não encontrada');
    if (camp.status === 'enviada') throw new Error('Campanha já foi enviada');

    const clientes = await segmentarClientes(tenantId, camp.segmento_criterios || {});
    let enviados = 0, falhas = 0;

    for (const cl of clientes.rows) {
      if (!cl.telefone) { falhas++; continue; }
      try {
        const msg = camp.mensagem.replace('{{nome}}', cl.nome.split(' ')[0]);
        await enviarWhatsApp(cl.telefone, msg);
        await client.query(
          `INSERT INTO envios_campanha (campanha_id, cliente_id, status) VALUES ($1, $2, 'enviado')`,
          [campanhaId, cl.id]
        );
        enviados++;
      } catch { falhas++; }
    }

    await client.query(
      `UPDATE campanhas_crm SET status = 'enviada', enviado_em = NOW(),
       qtd_enviados = $1, qtd_falhas = $2 WHERE id = $3`,
      [enviados, falhas, campanhaId]
    );

    await client.query('COMMIT');
    return { enviados, falhas, total: clientes.rows.length };
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉGUA DE RELACIONAMENTO
// ─────────────────────────────────────────────────────────────────────────────

export async function listarReguaRelacionamento(tenantId) {
  const pool = db.getPool();
  return pool.query(
    `SELECT * FROM regua_relacionamento WHERE empresa_id = $1 ORDER BY dias_gatilho`,
    [tenantId]
  );
}

export async function criarRegraRegua(tenantId, dados) {
  const pool = db.getPool();
  return pool.query(
    `INSERT INTO regua_relacionamento
       (empresa_id, nome, tipo_gatilho, dias_gatilho, tipo_acao, mensagem_template, ativa)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING *`,
    [tenantId, dados.nome, dados.tipo_gatilho, dados.dias_gatilho, dados.tipo_acao, dados.mensagem_template]
  );
}

export async function processarReguaRelacionamento(tenantId) {
  const pool = db.getPool();
  const regras = await pool.query(
    `SELECT * FROM regua_relacionamento WHERE empresa_id = $1 AND ativa = true`,
    [tenantId]
  );

  let processados = 0;
  for (const regra of regras.rows) {
    if (regra.tipo_gatilho === 'sem_compra') {
      const clientes = await pool.query(
        `SELECT c.id, c.nome, c.telefone FROM clientes c
         WHERE c.empresa_id = $1
           AND (SELECT MAX(data_venda) FROM vendas WHERE cliente_id = c.id AND status='finalizada')
               = CURRENT_DATE - INTERVAL '${regra.dias_gatilho} days'
           AND NOT EXISTS (
             SELECT 1 FROM envios_regua er
             WHERE er.cliente_id = c.id AND er.regra_id = $2
               AND er.enviado_em >= CURRENT_DATE
           )`,
        [tenantId, regra.id]
      );
      for (const cl of clientes.rows) {
        if (!cl.telefone) continue;
        const msg = regra.mensagem_template.replace('{{nome}}', cl.nome.split(' ')[0]).replace('{{dias}}', regra.dias_gatilho);
        try {
          await enviarWhatsApp(cl.telefone, msg);
          await pool.query(
            `INSERT INTO envios_regua (empresa_id, regra_id, cliente_id) VALUES ($1, $2, $3)`,
            [tenantId, regra.id, cl.id]
          );
          processados++;
        } catch { /* log e continua */ }
      }
    }
  }
  return { processados };
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD CRM
// ─────────────────────────────────────────────────────────────────────────────

export async function dashboardCRM(tenantId) {
  const pool = db.getPool();
  const [pipeline, conversao, campanhas, novosClientes] = await Promise.all([
    pool.query(
      `SELECT ef.nome, ef.cor, ef.ordem,
              COUNT(o.id) as qtd, COALESCE(SUM(o.valor_estimado), 0) as valor_total
       FROM etapas_funil ef
       LEFT JOIN oportunidades o ON o.etapa_id = ef.id AND o.status = 'aberta'
       WHERE ef.empresa_id = $1
       GROUP BY ef.id ORDER BY ef.ordem`,
      [tenantId]
    ),
    pool.query(
      `SELECT
         COUNT(CASE WHEN status = 'ganha' THEN 1 END)::float /
         NULLIF(COUNT(CASE WHEN status IN ('ganha','perdida') THEN 1 END), 0) * 100 as taxa_conversao,
         COALESCE(AVG(CASE WHEN status='ganha' THEN EXTRACT(EPOCH FROM (atualizado_em - criado_em))/86400 END), 0) as ciclo_medio_dias
       FROM oportunidades WHERE empresa_id = $1`,
      [tenantId]
    ),
    pool.query(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status='enviada' THEN 1 END) as enviadas,
              COALESCE(SUM(qtd_enviados), 0) as total_enviados
       FROM campanhas_crm WHERE empresa_id = $1 AND criado_em >= CURRENT_DATE - INTERVAL '30 days'`,
      [tenantId]
    ),
    pool.query(
      `SELECT COUNT(*) as novos FROM clientes
       WHERE empresa_id = $1 AND criado_em >= CURRENT_DATE - INTERVAL '30 days'`,
      [tenantId]
    ),
  ]);

  return {
    pipeline: pipeline.rows,
    conversao: conversao.rows[0],
    campanhas: campanhas.rows[0],
    novos_clientes_30d: novosClientes.rows[0].novos,
  };
}
