import { canonicalWhatsappPhone, isWhatsappOptOutText, phoneMatchKeySql } from './whatsapp-phone.js';
import { createHash } from 'node:crypto';
import { db } from './database.js';
import { enviarMensagem } from './whatsapp.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTRIBUTION_DAYS = 7;

function fail(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function clean(value, limit = 500) {
  return String(value || '').trim().replace(/\u0000/g, '').slice(0, limit);
}

function uuid(value, field) {
  const normalized = clean(value, 60);
  if (!UUID.test(normalized)) fail(`${field} inválido`, 'VALIDATION_ERROR');
  return normalized;
}

export function normalizeCampaignPhone(value) {
  return canonicalWhatsappPhone(value);
}

export function normalizeCampaignCriteria(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const customerIds = Array.isArray(source.customerIds)
    ? [...new Set(source.customerIds.map(value => clean(value, 60)).filter(value => UUID.test(value)))].slice(0, 500)
    : [];
  const recentDays = Number.parseInt(String(source.createdWithinDays || ''), 10);
  return {
    city: clean(source.city, 100),
    state: clean(source.state, 2).toUpperCase(),
    tag: clean(source.tag, 80),
    createdWithinDays: Number.isFinite(recentDays) ? Math.min(3650, Math.max(1, recentDays)) : null,
    customerIds,
  };
}

function canonicalHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function renderMessage(template, customerName) {
  const firstName = clean(customerName, 200).split(/\s+/)[0] || 'cliente';
  return clean(template, 1600).replace(/\{\{\s*nome\s*\}\}/gi, firstName);
}

async function queryAudience(query, empresaId, criteriaInput) {
  const criteria = normalizeCampaignCriteria(criteriaInput);
  const params = [uuid(empresaId, 'empresaId')];
  const conditions = ['c.empresa_id = $1', 'c.ativo = true'];
  if (criteria.city) {
    params.push(criteria.city);
    conditions.push(`lower(COALESCE(c.cidade, '')) = lower($${params.length})`);
  }
  if (criteria.state) {
    params.push(criteria.state);
    conditions.push(`upper(COALESCE(c.uf, '')) = upper($${params.length})`);
  }
  if (criteria.tag) {
    params.push(criteria.tag);
    conditions.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(c.tags, '[]'::jsonb)) tag WHERE lower(tag) = lower($${params.length}))`);
  }
  if (criteria.createdWithinDays) {
    params.push(criteria.createdWithinDays);
    conditions.push(`c.criado_em >= CURRENT_TIMESTAMP - ($${params.length}::text || ' days')::interval`);
  }
  if (criteria.customerIds.length) {
    params.push(criteria.customerIds);
    conditions.push(`c.id = ANY($${params.length}::uuid[])`);
  }
  const result = await query(
    `SELECT c.id, c.nome, c.telefone, c.email, c.cidade, c.uf, c.tags,
            COALESCE(cons.concedido, false) AS consentimento_marketing,
            cons.atualizado_em AS consentimento_atualizado_em
       FROM clientes c
       LEFT JOIN consentimentos_cliente cons
         ON cons.empresa_id = c.empresa_id AND cons.cliente_id = c.id
        AND cons.canal = 'whatsapp' AND cons.finalidade = 'marketing'
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.nome ASC, c.id ASC
      LIMIT 5000`,
    params,
  );
  const rows = result.rows.map(row => ({ ...row, telefoneNormalizado: normalizeCampaignPhone(row.telefone) }));
  const eligible = rows.filter(row => row.consentimento_marketing && row.telefoneNormalizado);
  const blockedNoConsent = rows.filter(row => !row.consentimento_marketing);
  const blockedNoPhone = rows.filter(row => row.consentimento_marketing && !row.telefoneNormalizado);
  return { criteria, rows, eligible, blockedNoConsent, blockedNoPhone };
}

function previewPayload(campaign, audience) {
  const fingerprint = canonicalHash({
    campaignId: campaign.id,
    empresaId: campaign.empresa_id,
    lojaId: campaign.loja_id,
    name: campaign.nome,
    message: campaign.mensagem,
    criteria: audience.criteria,
    eligible: audience.eligible.map(row => [row.id, row.telefoneNormalizado, row.consentimento_atualizado_em]),
  });
  return {
    campaignId: campaign.id,
    previewHash: fingerprint,
    criteria: audience.criteria,
    summary: {
      candidates: audience.rows.length,
      eligible: audience.eligible.length,
      blocked: audience.blockedNoConsent.length + audience.blockedNoPhone.length,
      blockedNoConsent: audience.blockedNoConsent.length,
      blockedNoPhone: audience.blockedNoPhone.length,
    },
    sample: audience.eligible.slice(0, 10).map(row => ({
      customerId: row.id,
      name: row.nome,
      phone: row.telefoneNormalizado.replace(/^(\d{4})\d+(\d{2})$/, '$1••••••$2'),
    })),
  };
}

async function loadCampaign(query, context, campaignId, { lock = false } = {}) {
  const result = await query(
    `SELECT * FROM campanhas_crm
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3
      ${lock ? 'FOR UPDATE' : ''}`,
    [uuid(campaignId, 'campanhaId'), uuid(context.empresaId, 'empresaId'), uuid(context.lojaId, 'lojaId')],
  );
  if (!result.rows[0]) fail('campanha não encontrada neste tenant e loja', 'NOT_FOUND');
  return result.rows[0];
}

async function auditCampaign(query, context, campaignId, type, metadata = {}) {
  await query(
    `INSERT INTO campanhas_crm_eventos (empresa_id, loja_id, campanha_id, usuario_id, tipo, metadados)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [context.empresaId, context.lojaId, campaignId, context.usuarioId || null, clean(type, 40), JSON.stringify(metadata)],
  );
}

export async function createCampaign(context, payload = {}) {
  const name = clean(payload.name || payload.nome, 200);
  const message = clean(payload.message || payload.mensagem, 1600);
  if (name.length < 3) fail('nome da campanha deve ter ao menos 3 caracteres');
  if (message.length < 10) fail('mensagem da campanha deve ter ao menos 10 caracteres');
  const criteria = normalizeCampaignCriteria(payload.criteria || payload.segmento_criterios);
  const scheduledAt = payload.scheduledAt || payload.data_envio_programado || null;
  const result = await db.transaction(async trx => {
    const inserted = await trx.query(
      `INSERT INTO campanhas_crm
        (empresa_id, loja_id, nome, tipo, mensagem, segmento_criterios, data_envio_programado, status, criado_por)
       VALUES ($1, $2, $3, 'whatsapp', $4, $5::jsonb, $6, 'rascunho', $7) RETURNING *`,
      [uuid(context.empresaId, 'empresaId'), uuid(context.lojaId, 'lojaId'), name, message, JSON.stringify(criteria), scheduledAt, uuid(context.usuarioId, 'usuarioId')],
    );
    await auditCampaign(trx.query.bind(trx), context, inserted.rows[0].id, 'campaign.created', { scheduledAt: scheduledAt || null });
    return inserted.rows[0];
  });
  return result;
}

export async function listCampaigns(context, { limit = 50, offset = 0 } = {}) {
  await attributeCampaignConversions(context);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const [rows, count] = await Promise.all([
    db.query(
      `SELECT id, nome, tipo, status, data_envio_programado, criado_em, atualizado_em,
              qtd_elegiveis, qtd_bloqueados, qtd_enviados, qtd_falhas, qtd_entregues,
              qtd_lidos, qtd_respostas, qtd_conversoes, receita_atribuida
         FROM campanhas_crm
        WHERE empresa_id = $1 AND loja_id = $2
        ORDER BY criado_em DESC LIMIT $3 OFFSET $4`,
      [context.empresaId, context.lojaId, safeLimit, safeOffset],
    ),
    db.query('SELECT COUNT(*)::int AS total FROM campanhas_crm WHERE empresa_id = $1 AND loja_id = $2', [context.empresaId, context.lojaId]),
  ]);
  return { campaigns: rows.rows, total: Number(count.rows[0]?.total || 0), limit: safeLimit, offset: safeOffset };
}

export async function previewCampaign(context, campaignId) {
  const campaign = await loadCampaign(db.query.bind(db), context, campaignId);
  if (!['rascunho', 'confirmada', 'agendada'].includes(campaign.status)) fail('campanha não admite novo preview', 'CONFLICT');
  const audience = await queryAudience(db.query.bind(db), context.empresaId, campaign.segmento_criterios);
  return previewPayload(campaign, audience);
}

export async function confirmCampaign(context, campaignId, payload = {}) {
  if (payload.confirmed !== true) fail('confirmação humana obrigatória', 'CONFIRMATION_REQUIRED');
  const expectedHash = clean(payload.previewHash, 64);
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) fail('previewHash inválido');
  return db.transaction(async trx => {
    const query = trx.query.bind(trx);
    const campaign = await loadCampaign(query, context, campaignId, { lock: true });
    if (campaign.status !== 'rascunho') {
      if (campaign.preview_hash === expectedHash && ['confirmada','agendada','enviando','enviada','parcial'].includes(campaign.status)) {
        const existing = await query('SELECT COUNT(*)::int AS total FROM envios_campanha WHERE campanha_id = $1 AND empresa_id = $2 AND loja_id = $3', [campaign.id, context.empresaId, context.lojaId]);
        return { campaignId: campaign.id, status: campaign.status, queued: Number(existing.rows[0]?.total || 0), previewHash: expectedHash, replayed: true };
      }
      fail('campanha já executada, cancelada ou vinculada a outro preview', 'CONFLICT');
    }
    const audience = await queryAudience(query, context.empresaId, campaign.segmento_criterios);
    const preview = previewPayload(campaign, audience);
    if (preview.previewHash !== expectedHash) fail('preview obsoleto; gere uma nova prévia', 'STALE_PREVIEW');
    if (!audience.eligible.length) fail('nenhum destinatário possui telefone válido e consentimento de marketing', 'VALIDATION_ERROR');
    const channelResult = await query(
      `SELECT * FROM canais_integracao
        WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp' AND status = 'ativo'
        ORDER BY data_atualizacao DESC LIMIT 1 FOR UPDATE`,
      [context.empresaId, context.lojaId],
    );
    const channel = channelResult.rows[0];
    if (!channel) fail('canal WhatsApp ativo não encontrado para esta loja', 'PRECONDITION_FAILED');
    const scheduledAt = campaign.data_envio_programado && new Date(campaign.data_envio_programado) > new Date()
      ? campaign.data_envio_programado
      : null;
    let queued = 0;
    for (const customer of audience.eligible) {
      const rendered = renderMessage(campaign.mensagem, customer.nome);
      const delivery = await query(
        `INSERT INTO envios_campanha
          (campanha_id, empresa_id, loja_id, canal_id, cliente_id, status, telefone_normalizado, mensagem_hash, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7, $8)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE
           SET canal_id = EXCLUDED.canal_id, telefone_normalizado = EXCLUDED.telefone_normalizado,
               mensagem_hash = EXCLUDED.mensagem_hash, atualizado_em = CURRENT_TIMESTAMP
           WHERE envios_campanha.status IN ('pendente','falha','bloqueado','cancelado')
         RETURNING id`,
        [campaign.id, context.empresaId, context.lojaId, channel.id, customer.id, customer.telefoneNormalizado, canonicalHash(rendered), `${campaign.id}:${customer.id}`],
      );
      if (!delivery.rows[0]) continue;
      await query(
        `INSERT INTO tarefas_integracao_canais
          (empresa_id, loja_id, canal_id, tipo, referencia_externa, payload, proxima_tentativa_em)
         VALUES ($1, $2, $3, 'enviar_campanha', $4, $5::jsonb, $6)
         ON CONFLICT (tipo, referencia_externa) WHERE tipo = 'enviar_campanha'
         DO UPDATE SET status = CASE WHEN tarefas_integracao_canais.status IN ('falha','cancelada') THEN 'pendente' ELSE tarefas_integracao_canais.status END,
                       proxima_tentativa_em = EXCLUDED.proxima_tentativa_em,
                       erro = NULL, data_atualizacao = CURRENT_TIMESTAMP`,
        [context.empresaId, context.lojaId, channel.id, `${campaign.id}:${customer.id}`, JSON.stringify({ campaignDeliveryId: delivery.rows[0].id }), scheduledAt],
      );
      queued += 1;
    }
    const status = scheduledAt ? 'agendada' : 'enviando';
    await query(
      `UPDATE campanhas_crm
          SET canal_id = $2, status = $3, qtd_elegiveis = $4, qtd_bloqueados = $5,
              preview_hash = $6, confirmado_por = $7, confirmado_em = CURRENT_TIMESTAMP,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [campaign.id, channel.id, status, audience.eligible.length, preview.summary.blocked, preview.previewHash, context.usuarioId || null],
    );
    await auditCampaign(query, context, campaign.id, 'campaign.confirmed', { previewHash: preview.previewHash, queued, ...preview.summary });
    return { campaignId: campaign.id, status, queued, previewHash: preview.previewHash, summary: preview.summary, replayed: false };
  });
}

export async function cancelCampaign(context, campaignId) {
  return db.transaction(async trx => {
    const query = trx.query.bind(trx);
    const campaign = await loadCampaign(query, context, campaignId, { lock: true });
    if (['enviada', 'parcial', 'cancelada'].includes(campaign.status)) fail('campanha concluída ou já cancelada', 'CONFLICT');
    await query(`UPDATE campanhas_crm SET status = 'cancelada', cancelado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`, [campaign.id]);
    await query(`UPDATE envios_campanha SET status = 'cancelado', atualizado_em = CURRENT_TIMESTAMP WHERE campanha_id = $1 AND status IN ('pendente','falha')`, [campaign.id]);
    await query(`UPDATE tarefas_integracao_canais SET status = 'cancelada', data_atualizacao = CURRENT_TIMESTAMP WHERE tipo = 'enviar_campanha' AND referencia_externa LIKE $1 AND status IN ('pendente','falha')`, [`${campaign.id}:%`]);
    await auditCampaign(query, context, campaign.id, 'campaign.cancelled');
    return { id: campaign.id, status: 'cancelada' };
  });
}

function externalMessageId(data = {}) {
  return clean(data?.key?.id || data?.message?.key?.id || data?.id || data?.messageId, 200);
}

function campaignDeliveryError(message, code, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

export async function processCampaignDeliveryTask(task) {
  const deliveryId = uuid(task?.payload?.campaignDeliveryId, 'campaignDeliveryId');
  const result = await db.query(
    `SELECT ec.*, c.nome AS campanha_nome, c.mensagem, c.status AS campanha_status,
            cl.nome AS cliente_nome, cl.telefone, ci.configuracao, ci.api_base_url
       FROM envios_campanha ec
       JOIN campanhas_crm c ON c.id = ec.campanha_id AND c.empresa_id = ec.empresa_id
       JOIN clientes cl ON cl.id = ec.cliente_id AND cl.empresa_id = ec.empresa_id
       JOIN canais_integracao ci ON ci.id = ec.canal_id AND ci.empresa_id = ec.empresa_id
      WHERE ec.id = $1 AND ec.empresa_id = $2 AND ec.loja_id = $3 AND ci.status = 'ativo'
      LIMIT 1`,
    [deliveryId, task.empresa_id, task.loja_id],
  );
  const delivery = result.rows[0];
  if (!delivery) fail('destinatário de campanha não encontrado', 'NOT_FOUND');
  if (['enviado','entregue','lido','respondido','convertido'].includes(delivery.status)) return { idempotent: true, status: delivery.status };
  if (delivery.status === 'incerto' || (delivery.status === 'processando' && task.delivery_started_at)) {
    await db.query(`UPDATE envios_campanha SET status = 'incerto', erro = 'resultado de envio incerto; revisão humana obrigatória', atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`, [delivery.id]);
    await refreshCampaignMetrics(delivery.campanha_id);
    throw campaignDeliveryError('resultado anterior de campanha incerto', 'CAMPAIGN_DELIVERY_UNKNOWN', false);
  }
  if (delivery.campanha_status === 'cancelada') {
    await db.query(`UPDATE envios_campanha SET status = 'cancelado', atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`, [delivery.id]);
    return { cancelled: true };
  }
  const consent = await db.query(
    `SELECT concedido FROM consentimentos_cliente
      WHERE empresa_id = $1 AND cliente_id = $2 AND canal = 'whatsapp' AND finalidade = 'marketing' LIMIT 1`,
    [delivery.empresa_id, delivery.cliente_id],
  );
  if (!consent.rows[0]?.concedido || !normalizeCampaignPhone(delivery.telefone)) {
    await db.query(`UPDATE envios_campanha SET status = 'bloqueado', erro = 'consentimento ou telefone indisponível', atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`, [delivery.id]);
    await refreshCampaignMetrics(delivery.campanha_id);
    return { blocked: true };
  }
  // Só um processo envia: a tarefa precisa ainda ser deste worker (lease) e o destinatário
  // não pode ter sido pego por outro. Sem isso, dois workers com lease vencido enviavam duas vezes.
  await db.transaction(async trx => {
    const owned = await trx.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'processando' AND lease_token = $2::uuid AND delivery_started_at IS NULL`, [task.id, task.lease_token]);
    if (!owned.rowCount) throw campaignDeliveryError('tarefa de campanha já está com outro processo', 'TASK_LEASE_LOST', false);
    const claimed = await trx.query(`UPDATE envios_campanha SET status = 'processando', tentativas = tentativas + 1, erro = NULL, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('processando','enviado','entregue','lido','respondido','convertido','incerto','cancelado','bloqueado')`, [delivery.id]);
    if (!claimed.rowCount) throw campaignDeliveryError('destinatário de campanha já em envio', 'CAMPAIGN_DELIVERY_UNKNOWN', false);
  });
  let response;
  try {
    response = await enviarMensagem({
      whatsapp_api_url: process.env.EVOLUTION_API_URL || delivery.api_base_url,
      whatsapp_api_key: process.env.EVOLUTION_API_KEY,
      whatsapp_instance: delivery.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
      empresa_id: delivery.empresa_id, loja_id: delivery.loja_id, canal_id: delivery.canal_id,
    }, delivery.telefone, renderMessage(delivery.mensagem, delivery.cliente_nome));
  } catch (error) {
    await db.query(`UPDATE envios_campanha SET status = 'falha', erro = $2, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`, [delivery.id, clean(error?.message || 'falha Evolution', 1000)]);
    await refreshCampaignMetrics(delivery.campanha_id);
    throw new Error('falha ao enviar destinatário da campanha');
  }
  if (!response?.ok) {
    const unknown = response?.uncertain === true;
    await db.transaction(async trx => {
      await trx.query(
        `UPDATE envios_campanha SET status = $2, erro = $3, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`,
        [delivery.id, unknown ? 'incerto' : 'falha', unknown ? 'resultado de envio incerto; revisão humana obrigatória' : clean(response?.data?.message || response?.error || 'falha Evolution', 1000)],
      );
      if (!unknown) await trx.query(`UPDATE tarefas_integracao_canais SET delivery_started_at = NULL WHERE id = $1`, [task.id]);
    });
    await refreshCampaignMetrics(delivery.campanha_id);
    throw campaignDeliveryError(unknown ? 'resultado de campanha incerto' : 'falha ao enviar destinatário da campanha', unknown ? 'CAMPAIGN_DELIVERY_UNKNOWN' : 'CAMPAIGN_SEND_FAILED', !unknown && response?.retryable === true);
  }
  const providerId = externalMessageId(response.data);
  await db.transaction(async trx => {
    await trx.query(
      `UPDATE envios_campanha SET status = 'enviado', evento_externo_id = NULLIF($2, ''), enviado_em = CURRENT_TIMESTAMP,
              erro = NULL, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`,
      [delivery.id, providerId],
    );
    await trx.query(`UPDATE tarefas_integracao_canais SET provider_message_id = $2 WHERE id = $1`, [task.id, providerId || null]);
  });
  await refreshCampaignMetrics(delivery.campanha_id);
  return { sent: true, providerMessageId: providerId || null };
}

export async function refreshCampaignMetrics(campaignId) {
  const result = await db.query(
    `WITH metrics AS (
       SELECT campanha_id,
              COUNT(*) FILTER (WHERE status IN ('enviado','entregue','lido','respondido','convertido'))::int AS sent,
              COUNT(*) FILTER (WHERE status IN ('falha','incerto','bloqueado'))::int AS failed,
              COUNT(*) FILTER (WHERE status IN ('entregue','lido','respondido','convertido'))::int AS delivered,
              COUNT(*) FILTER (WHERE status IN ('lido','respondido','convertido'))::int AS read,
              COUNT(*) FILTER (WHERE status IN ('respondido','convertido'))::int AS responses,
              COUNT(*) FILTER (WHERE status = 'convertido')::int AS conversions,
              COALESCE(SUM(receita_atribuida), 0) AS revenue,
              COUNT(*) FILTER (WHERE status IN ('pendente','processando'))::int AS pending
         FROM envios_campanha WHERE campanha_id = $1 GROUP BY campanha_id
     )
     UPDATE campanhas_crm c
        SET qtd_enviados = m.sent, qtd_falhas = m.failed, qtd_entregues = m.delivered,
            qtd_lidos = m.read, qtd_respostas = m.responses, qtd_conversoes = m.conversions,
            receita_atribuida = m.revenue,
            status = CASE WHEN c.status = 'cancelada' THEN c.status
                          WHEN m.pending > 0 THEN 'enviando'
                          WHEN m.failed > 0 THEN 'parcial'
                          WHEN m.sent > 0 THEN 'enviada'
                          ELSE c.status END,
            enviado_em = CASE WHEN m.pending = 0 AND m.sent > 0 THEN COALESCE(c.enviado_em, CURRENT_TIMESTAMP) ELSE c.enviado_em END,
            atualizado_em = CURRENT_TIMESTAMP
       FROM metrics m WHERE c.id = m.campanha_id RETURNING c.*`,
    [uuid(campaignId, 'campanhaId')],
  );
  return result.rows[0] || null;
}

export async function recordCampaignProviderEvent(channel, payload = {}, parsed = {}) {
  const data = Array.isArray(payload.data) ? payload.data[0] || {} : payload.data || {};
  const providerId = externalMessageId(data);
  const status = clean(data.status || data.update?.status || payload.status, 40).toUpperCase();
  const statusMap = {
    DELIVERY_ACK: ['entregue', 'entregue_em'],
    READ: ['lido', 'lido_em'],
    READ_ACK: ['lido', 'lido_em'],
    PLAYED: ['lido', 'lido_em'],
  };
  const touched = new Set();
  if (providerId && statusMap[status]) {
    const [nextStatus, timestamp] = statusMap[status];
    const updated = await db.query(
      `UPDATE envios_campanha SET status = CASE
                WHEN $3 = 'entregue' AND status IN ('lido','respondido','convertido') THEN status
                WHEN $3 = 'lido' AND status IN ('respondido','convertido') THEN status
                ELSE $3 END,
              ${timestamp} = COALESCE(${timestamp}, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND canal_id = $2 AND evento_externo_id = $4
        RETURNING campanha_id`,
      [channel.empresa_id, channel.id, nextStatus, providerId],
    );
    updated.rows.forEach(row => touched.add(row.campanha_id));
  }
  if (!parsed.ignored && parsed.remoteJid) {
    const phone = normalizeCampaignPhone(parsed.remoteJid);
    if (phone) {
      const updated = await db.query(
        `WITH latest AS (
           SELECT id FROM envios_campanha
            WHERE empresa_id = $1 AND canal_id = $2 AND ${phoneMatchKeySql('telefone_normalizado')} = ${phoneMatchKeySql('$3')}
              AND enviado_em >= CURRENT_TIMESTAMP - INTERVAL '14 days'
              AND status IN ('enviado','entregue','lido')
            ORDER BY enviado_em DESC LIMIT 1
         )
         UPDATE envios_campanha ec SET status = 'respondido', respondido_em = COALESCE(respondido_em, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
          FROM latest WHERE ec.id = latest.id RETURNING ec.campanha_id`,
        [channel.empresa_id, channel.id, phone],
      );
      updated.rows.forEach(row => touched.add(row.campanha_id));
    }
  }
  for (const campaignId of touched) await refreshCampaignMetrics(campaignId);
  return { updatedCampaigns: [...touched] };
}

export async function attributeCampaignConversions(context) {
  const result = await db.query(
    `WITH candidates AS (
       SELECT ec.id AS envio_id, o.id AS order_id, o.total,
              ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY ec.enviado_em DESC) AS rank
         FROM envios_campanha ec
         JOIN clientes cl ON cl.id = ec.cliente_id AND cl.empresa_id = ec.empresa_id
         JOIN commerce_customers cc ON cc.empresa_id = ec.empresa_id
          AND ${phoneMatchKeySql('cc.telefone')} = ${phoneMatchKeySql('ec.telefone_normalizado')}
         JOIN commerce_orders o ON o.empresa_id = cc.empresa_id AND o.customer_id = cc.id
         JOIN commerce_storefronts sf ON sf.empresa_id = o.empresa_id AND sf.id = o.storefront_id AND sf.loja_id = ec.loja_id
        WHERE ec.empresa_id = $1 AND ec.loja_id = $2 AND ec.enviado_em IS NOT NULL
          AND o.criado_em BETWEEN ec.enviado_em AND ec.enviado_em + ($3::text || ' days')::interval
          AND o.status IN ('paid','processing','ready','shipped','ready_for_pickup','delivered','picked_up','completed')
     ), attributed AS (
       SELECT envio_id, MIN(order_id::text)::uuid AS first_order_id, SUM(total) AS revenue, MIN(order_id::text) AS marker
         FROM candidates WHERE rank = 1 GROUP BY envio_id
     )
     UPDATE envios_campanha ec SET status = 'convertido', convertido_em = COALESCE(convertido_em, CURRENT_TIMESTAMP),
            pedido_id = a.first_order_id, receita_atribuida = a.revenue, atualizado_em = CURRENT_TIMESTAMP
       FROM attributed a WHERE ec.id = a.envio_id
       RETURNING ec.campanha_id`,
    [context.empresaId, context.lojaId, ATTRIBUTION_DAYS],
  );
  const campaignIds = [...new Set(result.rows.map(row => row.campanha_id))];
  for (const id of campaignIds) await refreshCampaignMetrics(id);
  return { attributedCampaigns: campaignIds.length };
}

export async function campaignMetrics(context, campaignId) {
  await attributeCampaignConversions(context);
  const campaign = await loadCampaign(db.query.bind(db), context, campaignId);
  const events = await db.query(
    `SELECT tipo, metadados, criado_em FROM campanhas_crm_eventos
      WHERE empresa_id = $1 AND campanha_id = $2 ORDER BY criado_em DESC LIMIT 50`,
    [context.empresaId, campaign.id],
  );
  const eligible = Number(campaign.qtd_elegiveis || 0);
  const sent = Number(campaign.qtd_enviados || 0);
  const delivered = Number(campaign.qtd_entregues || 0);
  const read = Number(campaign.qtd_lidos || 0);
  const responses = Number(campaign.qtd_respostas || 0);
  const conversions = Number(campaign.qtd_conversoes || 0);
  const rate = (value, base) => base > 0 ? Number(((value / base) * 100).toFixed(2)) : 0;
  return {
    campaign,
    rates: {
      send: rate(sent, eligible),
      delivery: rate(delivered, sent),
      read: rate(read, delivered),
      response: rate(responses, delivered),
      conversion: rate(conversions, sent),
    },
    events: events.rows,
    attributionWindowDays: ATTRIBUTION_DAYS,
  };
}

export async function listCampaignAudience(context, { search = '', limit = 100, offset = 0 } = {}) {
  const term = clean(search, 100);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const params = [uuid(context.empresaId, 'empresaId'), term ? `%${term}%` : '', safeLimit, safeOffset];
  const result = await db.query(
    `SELECT c.id, c.nome, c.telefone, c.email, c.cidade, c.uf, c.tags,
            COALESCE(cons.concedido, false) AS consentimento_marketing,
            cons.origem AS consentimento_origem, cons.atualizado_em AS consentimento_atualizado_em,
            COUNT(*) OVER()::int AS total
       FROM clientes c
       LEFT JOIN consentimentos_cliente cons
         ON cons.empresa_id = c.empresa_id AND cons.cliente_id = c.id
        AND cons.canal = 'whatsapp' AND cons.finalidade = 'marketing'
      WHERE c.empresa_id = $1 AND c.ativo = true
        AND ($2 = '' OR c.nome ILIKE $2 OR COALESCE(c.telefone, '') ILIKE $2 OR COALESCE(c.email, '') ILIKE $2)
      ORDER BY c.nome ASC, c.id ASC LIMIT $3 OFFSET $4`,
    params,
  );
  return { customers: result.rows, total: Number(result.rows[0]?.total || 0), limit: safeLimit, offset: safeOffset };
}

export async function updateCampaignConsent(context, customerId, payload = {}) {
  const granted = payload.granted === true;
  const allowedOrigins = new Set(['cliente_solicitou', 'formulario', 'contrato', 'importacao_autorizada', 'revogacao_cliente']);
  const origin = clean(payload.origin, 50);
  const evidenceNote = clean(payload.evidenceNote, 500);
  if (!allowedOrigins.has(origin)) fail('origem do consentimento inválida');
  if (granted && evidenceNote.length < 5) fail('evidência do consentimento é obrigatória para conceder opt-in');
  return db.transaction(async trx => {
    const query = trx.query.bind(trx);
    const customer = await query('SELECT id, nome FROM clientes WHERE id = $1 AND empresa_id = $2 AND ativo = true FOR UPDATE', [uuid(customerId, 'clienteId'), uuid(context.empresaId, 'empresaId')]);
    if (!customer.rows[0]) fail('cliente não encontrado neste tenant', 'NOT_FOUND');
    const result = await query(
      `INSERT INTO consentimentos_cliente
        (empresa_id, cliente_id, canal, finalidade, concedido, origem, evidencia, atualizado_por)
       VALUES ($1, $2, 'whatsapp', 'marketing', $3, $4, $5::jsonb, $6)
       ON CONFLICT (empresa_id, cliente_id, canal, finalidade) DO UPDATE
         SET concedido = EXCLUDED.concedido, origem = EXCLUDED.origem, evidencia = EXCLUDED.evidencia,
             atualizado_por = EXCLUDED.atualizado_por, atualizado_em = CURRENT_TIMESTAMP
       RETURNING cliente_id, canal, finalidade, concedido, origem, atualizado_em`,
      [context.empresaId, customerId, granted, origin, JSON.stringify({ note: evidenceNote, recordedAt: new Date().toISOString() }), context.usuarioId || null],
    );
    await query(
      `INSERT INTO commerce_audit_logs
        (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
       VALUES ($1, $2, $3, 'marketing_consent', $4, $5, $6::jsonb)`,
      [context.empresaId, context.lojaId, context.usuarioId || null, customerId, granted ? 'granted' : 'revoked', JSON.stringify({ canal: 'whatsapp', finalidade: 'marketing', origin })],
    );
    return result.rows[0];
  });
}

export function campaignOptOutRequested(parsed = {}) {
  if (parsed.ignored || !parsed.phone || !parsed.text) return false;
  return isWhatsappOptOutText(parsed.text);
}

export async function recordCampaignOptOut(channel = {}, parsed = {}) {
  if (!campaignOptOutRequested(parsed)) return { optedOut: false };
  const phone = normalizeCampaignPhone(parsed.phone);
  if (!phone || !channel.empresa_id) return { optedOut: false };
  return db.transaction(async trx => {
    const query = trx.query.bind(trx);
    const customer = await query(
      `SELECT id FROM clientes
        WHERE empresa_id = $1 AND ativo = true
          AND ${phoneMatchKeySql('telefone')} = ${phoneMatchKeySql('$2')}
        ORDER BY id ASC FOR UPDATE`,
      [channel.empresa_id, phone],
    );
    if (!customer.rows[0]) return { optedOut: false, reason: 'customer_not_found' };
    // Cadastros duplicados com o mesmo número: o SAIR vale para todos.
    for (const found of customer.rows) {
    await query(
      `INSERT INTO consentimentos_cliente
        (empresa_id, cliente_id, canal, finalidade, concedido, origem, evidencia)
       VALUES ($1, $2, 'whatsapp', 'marketing', false, 'whatsapp_optout', $3::jsonb)
       ON CONFLICT (empresa_id, cliente_id, canal, finalidade) DO UPDATE
         SET concedido = false, origem = EXCLUDED.origem, evidencia = EXCLUDED.evidencia, atualizado_em = CURRENT_TIMESTAMP`,
      [channel.empresa_id, found.id, JSON.stringify({ externalEventId: clean(parsed.externalId, 200), recordedAt: new Date().toISOString() })],
    );
    const delivery = await query(
      `WITH latest AS (
         SELECT id, campanha_id FROM envios_campanha
          WHERE empresa_id = $1 AND canal_id = $2 AND cliente_id = $3
          ORDER BY enviado_em DESC NULLS LAST, criado_em DESC LIMIT 1 FOR UPDATE
       )
       UPDATE envios_campanha ec SET status = CASE WHEN ec.status = 'convertido' THEN ec.status ELSE 'respondido' END,
              respondido_em = COALESCE(ec.respondido_em, CURRENT_TIMESTAMP), atualizado_em = CURRENT_TIMESTAMP
         FROM latest l WHERE ec.id = l.id RETURNING l.campanha_id`,
      [channel.empresa_id, channel.id, found.id],
    );
    await query(
      `INSERT INTO commerce_audit_logs
        (empresa_id, loja_id, usuario_id, entidade, entidade_id, acao, depois)
       VALUES ($1, $2, NULL, 'marketing_consent', $3, 'revoked_by_whatsapp', $4::jsonb)`,
      [channel.empresa_id, channel.loja_id || null, found.id, JSON.stringify({ canal: 'whatsapp', finalidade: 'marketing' })],
    );
    if (delivery.rows[0]?.campanha_id) await refreshCampaignMetrics(delivery.rows[0].campanha_id, query);
    }
    return { optedOut: true, customerId: customer.rows[0].id, customers: customer.rows.length };
  });
}
