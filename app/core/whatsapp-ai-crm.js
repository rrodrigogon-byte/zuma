import crypto from 'node:crypto';
import { db } from './database.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^55[1-9][0-9]{10}$/;

function clean(value, limit = 500) {
  return String(value ?? '').trim().replace(/\u0000/g, '').replace(/\s+/g, ' ').slice(0, limit);
}

function uuid(value, field) {
  const normalized = clean(value, 60);
  if (!UUID_REGEX.test(normalized)) {
    const error = new Error(`${field} inválido`);
    error.code = 'INVALID_ID';
    throw error;
  }
  return normalized;
}

export function normalizeWhatsappPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits : (digits.length === 10 || digits.length === 11 ? `55${digits}` : digits);
  return PHONE_REGEX.test(normalized) ? normalized : '';
}

function phoneSql(column) {
  return `CASE WHEN regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g') LIKE '55%'
                THEN regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g')
                ELSE '55' || regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g') END`;
}

function tenant(context = {}) {
  return { empresaId: uuid(context.empresaId, 'empresaId'), lojaId: uuid(context.lojaId, 'lojaId') };
}

function firstName(value) {
  return clean(value, 160).split(/\s+/)[0] || 'cliente';
}

async function logInteraction(query, context, customerId, subject, content, metadata = {}) {
  await query(
    `INSERT INTO interacoes_cliente
      (empresa_id, loja_id, cliente_id, tipo, origem, assunto, conteudo, metadados)
     VALUES ($1, $2, $3, 'whatsapp', 'whatsapp', $4, $5, $6::jsonb)`,
    [context.empresaId, context.lojaId, customerId, clean(subject, 200), clean(content, 2000), JSON.stringify(metadata)],
  );
}

export async function ensureWhatsappLead(context = {}, input = {}) {
  const scope = tenant(context);
  const phone = normalizeWhatsappPhone(input.phone || context.phone);
  if (!phone) return null;
  const name = clean(input.name || context.customerName, 160);
  const text = clean(input.text, 2000);
  return db.transaction(async trx => {
    const query = trx.query.bind(trx);
    const existing = await query(
      `SELECT id, empresa_id, nome, telefone, email, cidade, uf, tags, ativo
         FROM clientes
        WHERE empresa_id = $1 AND ativo = true AND ${phoneSql('telefone')} = $2
        ORDER BY criado_em ASC, id ASC LIMIT 1 FOR UPDATE`,
      [scope.empresaId, phone],
    );
    let customer = existing.rows[0] || null;
    if (!customer) {
      const inserted = await query(
        `INSERT INTO clientes (empresa_id, nome, telefone, tags, ativo)
         VALUES ($1, $2, $3, $4::jsonb, true)
         RETURNING id, empresa_id, nome, telefone, email, cidade, uf, tags, ativo`,
        [scope.empresaId, name || `Lead WhatsApp ${phone.slice(-4)}`, phone, JSON.stringify(['whatsapp-lead', 'dino'])],
      );
      customer = inserted.rows[0];
    } else if (name && (!customer.nome || /^lead whatsapp/i.test(customer.nome) || /^cliente balc[aã]o/i.test(customer.nome))) {
      const updated = await query(
        `UPDATE clientes SET nome = $3, telefone = COALESCE(NULLIF(telefone, ''), $4)
          WHERE id = $1 AND empresa_id = $2 RETURNING id, empresa_id, nome, telefone, email, cidade, uf, tags, ativo`,
        [customer.id, scope.empresaId, name, phone],
      );
      customer = updated.rows[0] || customer;
    }

    await query(
      `INSERT INTO consentimentos_cliente
        (empresa_id, cliente_id, canal, finalidade, concedido, origem, evidencia)
       VALUES ($1, $2, 'whatsapp', 'atendimento', true, 'whatsapp_inbound', $3::jsonb)
       ON CONFLICT (empresa_id, cliente_id, canal, finalidade) DO UPDATE
         SET concedido = true, origem = EXCLUDED.origem, evidencia = EXCLUDED.evidencia, atualizado_em = CURRENT_TIMESTAMP`,
      [scope.empresaId, customer.id, JSON.stringify({ source: 'whatsapp', phone, recordedAt: new Date().toISOString() })],
    );
    if (text) await logInteraction(query, scope, customer.id, 'Atendimento WhatsApp', text, { source: 'whatsapp_inbound' });
    return { ...customer, firstName: firstName(customer.nome), marketingConsent: await marketingConsent(query, scope.empresaId, customer.id) };
  });
}

async function marketingConsent(query, empresaId, customerId) {
  const result = await query(
    `SELECT concedido FROM consentimentos_cliente
      WHERE empresa_id = $1 AND cliente_id = $2 AND canal = 'whatsapp' AND finalidade = 'marketing'
      LIMIT 1`,
    [empresaId, customerId],
  );
  return result.rows[0]?.concedido === true;
}

export async function getWhatsappLeadProfile(context = {}) {
  const scope = tenant(context);
  const phone = normalizeWhatsappPhone(context.phone);
  if (!phone) return null;
  const result = await db.queryRead(
    `SELECT c.id, c.nome, c.telefone, c.email, c.cidade, c.uf, c.tags,
            COALESCE(cons.concedido, false) AS marketing_consent,
            (SELECT COUNT(*)::int FROM interacoes_cliente i WHERE i.empresa_id = c.empresa_id AND i.cliente_id = c.id) AS interactions,
            (SELECT COUNT(*)::int FROM agendamentos a
              WHERE a.empresa_id = c.empresa_id AND (a.loja_id = $2 OR a.loja_id IS NULL)
                AND ${phoneSql('a.cliente_telefone')} = ${phoneSql('c.telefone')}
                AND a.status NOT IN ('cancelado', 'concluido', 'nao_compareceu')) AS upcoming_appointments
       FROM clientes c
       LEFT JOIN consentimentos_cliente cons
         ON cons.empresa_id = c.empresa_id AND cons.cliente_id = c.id
        AND cons.canal = 'whatsapp' AND cons.finalidade = 'marketing'
      WHERE c.empresa_id = $1 AND c.ativo = true AND ${phoneSql('c.telefone')} = $3
      ORDER BY c.criado_em ASC, c.id ASC LIMIT 1`,
    [scope.empresaId, scope.lojaId, phone],
  );
  const row = result.rows[0];
  return row ? {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    cidade: row.cidade,
    uf: row.uf,
    tags: row.tags || [],
    marketingConsent: row.marketing_consent === true,
    interactions: Number(row.interactions || 0),
    upcomingAppointments: Number(row.upcoming_appointments || 0),
  } : null;
}

export async function updateWhatsappMarketingConsent(context = {}, { granted = false, evidence = '' } = {}) {
  const scope = tenant(context);
  const phone = normalizeWhatsappPhone(context.phone);
  if (!phone) return { updated: false, reason: 'phone_unavailable' };
  const result = await db.transaction(async trx => {
    const query = trx.query.bind(trx);
    const customer = await query(
      `SELECT id, nome FROM clientes WHERE empresa_id = $1 AND ativo = true AND ${phoneSql('telefone')} = $2 ORDER BY criado_em ASC, id ASC LIMIT 1 FOR UPDATE`,
      [scope.empresaId, phone],
    );
    if (!customer.rows[0]) return { updated: false, reason: 'customer_not_found' };
    const customerId = customer.rows[0].id;
    await query(
      `INSERT INTO consentimentos_cliente
        (empresa_id, cliente_id, canal, finalidade, concedido, origem, evidencia)
       VALUES ($1, $2, 'whatsapp', 'marketing', $3, $4, $5::jsonb)
       ON CONFLICT (empresa_id, cliente_id, canal, finalidade) DO UPDATE
         SET concedido = EXCLUDED.concedido, origem = EXCLUDED.origem, evidencia = EXCLUDED.evidencia, atualizado_em = CURRENT_TIMESTAMP`,
      [scope.empresaId, customerId, Boolean(granted), granted ? 'cliente_solicitou' : 'whatsapp_optout', JSON.stringify({ note: clean(evidence || (granted ? 'Cliente solicitou receber promoções no WhatsApp.' : 'Cliente revogou promoções no WhatsApp.'), 500), recordedAt: new Date().toISOString() })],
    );
    await logInteraction(query, scope, customerId, granted ? 'Consentimento de marketing' : 'Revogação de marketing', granted ? 'Cliente autorizou receber promoções no WhatsApp.' : 'Cliente não deseja receber promoções no WhatsApp.', { granted, channel: 'whatsapp' });
    return { updated: true, customerId, granted: Boolean(granted), customerName: customer.rows[0].nome };
  });
  return result;
}

export async function listWhatsappCustomerAppointments(context = {}, { includePast = false, limit = 8 } = {}) {
  const scope = tenant(context);
  const phone = normalizeWhatsappPhone(context.phone);
  if (!phone) return [];
  const result = await db.queryRead(
    `SELECT a.id, a.data_agendamento, a.status, a.duracao_minutos, a.valor, a.observacoes,
            s.id AS servico_id, s.nome AS servico_nome,
            u.id AS profissional_id, u.nome_completo AS profissional_nome
       FROM agendamentos a
       LEFT JOIN servicos s ON s.id = a.servico_id AND s.empresa_id = a.empresa_id
       LEFT JOIN usuarios u ON u.id = a.usuario_profissional_id AND u.empresa_id = a.empresa_id
      WHERE a.empresa_id = $1 AND (a.loja_id = $2 OR a.loja_id IS NULL)
        AND ${phoneSql('a.cliente_telefone')} = $3
        AND a.status NOT IN ('cancelado', 'nao_compareceu')
        ${includePast ? '' : 'AND a.data_agendamento >= CURRENT_TIMESTAMP'}
      ORDER BY a.data_agendamento ASC LIMIT $4`,
    [scope.empresaId, scope.lojaId, phone, Math.min(20, Math.max(1, Number(limit) || 8))],
  );
  return result.rows.map(row => ({
    id: row.id,
    dataHora: row.data_agendamento,
    status: row.status,
    duracaoMinutos: Number(row.duracao_minutos || 30),
    valor: Number(row.valor || 0),
    observacoes: row.observacoes || '',
    servico: { id: row.servico_id, nome: row.servico_nome || 'Serviço' },
    profissional: { id: row.profissional_id, nome: row.profissional_nome || 'Profissional da equipe' },
  }));
}

export async function customerAppointmentForUpdate(trx, context = {}, appointmentId) {
  const scope = tenant(context);
  const phone = normalizeWhatsappPhone(context.phone);
  const result = await trx.query(
    `SELECT a.id, a.empresa_id, a.loja_id, a.servico_id, a.usuario_profissional_id,
            a.cliente_nome, a.cliente_telefone, a.data_agendamento, a.duracao_minutos, a.valor, a.status,
            s.nome AS servico_nome, u.nome_completo AS profissional_nome
       FROM agendamentos a
       LEFT JOIN servicos s ON s.id = a.servico_id AND s.empresa_id = a.empresa_id
       LEFT JOIN usuarios u ON u.id = a.usuario_profissional_id AND u.empresa_id = a.empresa_id
      WHERE a.id = $1 AND a.empresa_id = $2 AND (a.loja_id = $3 OR a.loja_id IS NULL)
        AND ${phoneSql('a.cliente_telefone')} = $4
      LIMIT 1 FOR UPDATE`,
    [clean(appointmentId, 80), scope.empresaId, scope.lojaId, phone],
  );
  return result.rows[0] || null;
}

export async function rescheduleWhatsappAppointment(trx, context = {}, input = {}) {
  const appointment = await customerAppointmentForUpdate(trx, context, input.appointmentId);
  if (!appointment) throw new Error('agendamento não encontrado para este contato e unidade');
  if (['cancelado', 'concluido', 'nao_compareceu'].includes(String(appointment.status))) throw new Error('este agendamento não pode ser remarcado');
  const date = clean(input.date, 10);
  const time = clean(input.time, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('data ou horário inválido');
  const startsAt = `${date}T${time}:00`;
  const duration = Math.max(15, Number(appointment.duracao_minutos || 30));
  const scope = tenant(context);
  const conflict = await trx.query(
    `SELECT 1 FROM agendamentos
      WHERE empresa_id = $1 AND (loja_id = $2 OR loja_id IS NULL) AND usuario_profissional_id = $3
        AND id <> $4 AND status NOT IN ('cancelado', 'nao_compareceu')
        AND data_agendamento < $5::timestamp + ($6::text || ' minutes')::interval
        AND data_agendamento + (COALESCE(duracao_minutos, 30)::text || ' minutes')::interval > $5::timestamp
      UNION ALL
     SELECT 1 FROM agendamentos_bloqueios
      WHERE empresa_id = $1 AND (loja_id = $2 OR loja_id IS NULL) AND usuario_profissional_id = $3 AND ativo = true
        AND data_inicio < $5::timestamp + ($6::text || ' minutes')::interval AND data_fim > $5::timestamp
      LIMIT 1`,
    [scope.empresaId, scope.lojaId, appointment.usuario_profissional_id, appointment.id, startsAt, duration],
  );
  if (conflict.rows[0]) throw new Error('o novo horário ficou indisponível');
  const updated = await trx.query(
    `UPDATE agendamentos
        SET data_agendamento = $2::timestamp, data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND empresa_id = $3
      RETURNING id, data_agendamento, status, servico_id, usuario_profissional_id, duracao_minutos, valor`,
    [appointment.id, startsAt, scope.empresaId],
  );
  const row = updated.rows[0];
  return { id: row.id, dataHora: row.data_agendamento, status: row.status, servico: appointment.servico_nome || 'Serviço', profissional: appointment.profissional_nome || 'Profissional da equipe', duracaoMinutos: Number(row.duracao_minutos || duration), valor: Number(row.valor || 0) };
}

export async function cancelWhatsappAppointment(trx, context = {}, appointmentId) {
  const appointment = await customerAppointmentForUpdate(trx, context, appointmentId);
  if (!appointment) throw new Error('agendamento não encontrado para este contato e unidade');
  if (['cancelado', 'concluido', 'nao_compareceu'].includes(String(appointment.status))) throw new Error('este agendamento já não está ativo');
  const result = await trx.query(
    `UPDATE agendamentos SET status = 'cancelado', data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1 AND empresa_id = $2 RETURNING id, data_agendamento, status`,
    [appointment.id, appointment.empresa_id],
  );
  return { id: result.rows[0].id, dataHora: result.rows[0].data_agendamento, status: result.rows[0].status, servico: appointment.servico_nome || 'Serviço', profissional: appointment.profissional_nome || 'Profissional da equipe' };
}

export async function listActiveWhatsappPromotions(context = {}, { limit = 8 } = {}) {
  const scope = tenant(context);
  const result = await db.queryRead(
    `SELECT p.id, p.nome, p.tipo, p.valor, p.inicio, p.fim,
            COALESCE(jsonb_agg(jsonb_build_object('codigo', c.codigo, 'usoMaximo', c.uso_maximo, 'usos', c.usos)) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS codigos
       FROM commerce_promotions p
       LEFT JOIN commerce_promotion_codes c ON c.empresa_id = p.empresa_id AND c.promotion_id = p.id AND c.ativo = true
      WHERE p.empresa_id = $1 AND p.ativo = true AND p.inicio <= CURRENT_TIMESTAMP
        AND (p.fim IS NULL OR p.fim > CURRENT_TIMESTAMP)
        AND (p.limite_uso IS NULL OR p.usos < p.limite_uso)
      GROUP BY p.id ORDER BY p.inicio DESC, p.nome ASC LIMIT $2`,
    [scope.empresaId, Math.min(20, Math.max(1, Number(limit) || 8))],
  );
  return result.rows.map(row => ({ id: row.id, nome: row.nome, tipo: row.tipo, valor: Number(row.valor || 0), inicio: row.inicio, fim: row.fim, codigos: Array.isArray(row.codigos) ? row.codigos.filter(code => code?.codigo) : [] }));
}

export async function marketingConsentFor(context = {}) {
  const profile = await getWhatsappLeadProfile(context);
  return profile?.marketingConsent === true;
}


export async function queueWhatsappPromotion(trx, context = {}, input = {}) {
  const scope = tenant(context);
  const phone = normalizeWhatsappPhone(context.phone);
  if (!phone) throw new Error('telefone do contato indisponível');
  const customerResult = await trx.query(
    `SELECT c.id, c.nome, c.telefone
       FROM clientes c
      WHERE c.empresa_id = $1 AND c.ativo = true AND ${phoneSql('c.telefone')} = $2
      ORDER BY c.criado_em ASC, c.id ASC LIMIT 1 FOR UPDATE`,
    [scope.empresaId, phone],
  );
  const customer = customerResult.rows[0];
  if (!customer) throw new Error('cliente ainda não foi captado neste tenant');
  const consent = await trx.query(
    `SELECT concedido FROM consentimentos_cliente
      WHERE empresa_id = $1 AND cliente_id = $2 AND canal = 'whatsapp' AND finalidade = 'marketing' LIMIT 1`,
    [scope.empresaId, customer.id],
  );
  if (consent.rows[0]?.concedido !== true) throw new Error('o cliente precisa autorizar promoções antes do envio');
  const channelResult = await trx.query(
    `SELECT id FROM canais_integracao
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3 AND provedor = 'whatsapp' AND status = 'ativo' LIMIT 1 FOR UPDATE`,
    [context.canalId, scope.empresaId, scope.lojaId],
  );
  const channel = channelResult.rows[0];
  if (!channel) throw new Error('canal WhatsApp ativo não encontrado para esta unidade');
  const promotionId = clean(input.promotionId, 80);
  const promotionName = clean(input.promotionName || 'Oferta especial', 200);
  const message = clean(input.message, 1600);
  if (!promotionId || !message) throw new Error('oferta ou mensagem inválida');
  const promotionResult = await trx.query(
    `SELECT id, nome, tipo, valor
       FROM commerce_promotions
      WHERE id = $1 AND empresa_id = $2 AND ativo = true AND inicio <= CURRENT_TIMESTAMP
        AND (fim IS NULL OR fim > CURRENT_TIMESTAMP)
        AND (limite_uso IS NULL OR usos < limite_uso) LIMIT 1 FOR UPDATE`,
    [promotionId, scope.empresaId],
  );
  const activePromotion = promotionResult.rows[0];
  if (!activePromotion) throw new Error('a promoção expirou ou não está mais ativa');
  const campaign = await trx.query(
    `INSERT INTO campanhas_crm
      (empresa_id, loja_id, canal_id, nome, tipo, mensagem, segmento_criterios, status,
       qtd_elegiveis, confirmado_em, enviado_em)
     VALUES ($1, $2, $3, $4, 'whatsapp', $5, $6::jsonb, 'enviando', 1, CURRENT_TIMESTAMP, NULL)
     RETURNING id`,
    [scope.empresaId, scope.lojaId, channel.id, `Oferta IA · ${activePromotion.nome}`, message, JSON.stringify({ source: 'whatsapp_ai', promotionId: activePromotion.id, customerIds: [customer.id] })],
  );
  const campaignId = campaign.rows[0].id;
  const renderedHash = crypto.createHash('sha256').update(message).digest('hex');
  const delivery = await trx.query(
    `INSERT INTO envios_campanha
      (campanha_id, empresa_id, loja_id, canal_id, cliente_id, status, telefone_normalizado, mensagem_hash, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7, $8)
     ON CONFLICT (idempotency_key) DO UPDATE SET atualizado_em = CURRENT_TIMESTAMP
     RETURNING id`,
    [campaignId, scope.empresaId, scope.lojaId, channel.id, customer.id, phone, renderedHash, `${campaignId}:${customer.id}`],
  );
  await trx.query(
    `INSERT INTO tarefas_integracao_canais
      (empresa_id, loja_id, canal_id, tipo, referencia_externa, payload)
     VALUES ($1, $2, $3, 'enviar_campanha', $4, $5::jsonb)
     ON CONFLICT (tipo, referencia_externa) WHERE tipo = 'enviar_campanha' DO NOTHING`,
    [scope.empresaId, scope.lojaId, channel.id, `${campaignId}:${customer.id}`, JSON.stringify({ campaignDeliveryId: delivery.rows[0]?.id })],
  );
  await logInteraction(trx.query.bind(trx), scope, customer.id, 'Oferta enviada pelo atendimento IA', promotionName, { source: 'whatsapp_ai', promotionId, campaignId });
  return { campaignId, customerId: customer.id, status: 'enfileirada', promotionId: activePromotion.id, promotionName: activePromotion.nome };
}
