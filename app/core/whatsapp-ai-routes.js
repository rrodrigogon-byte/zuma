import { recordAutomationOptOut } from './ai-memory.js';
import crypto from 'node:crypto';
import express from 'express';
import { db } from './database.js';
import { parseEvolutionMessage, parseWahaMessage, whatsappAiReady } from './whatsapp-ai.js';
import { inboundMediaToText, locateInboundMedia } from './whatsapp-ai-media.js';
import { campaignOptOutRequested, recordCampaignOptOut, recordCampaignProviderEvent } from './commerce-campaigns.js';
import { recordCartRecoveryOptOut } from './commerce-abandoned-carts.js';
import { recordAppointmentNotificationOptOut } from './barbershop-appointment-notifications.js';
import { normalizeState } from './whatsapp-provider.js';
import { registrarEventoConexao } from '../whatsapp-conexao-kytto.js';
import { downloadWahaMedia, validWahaGroupId, validWahaSession, verifyWahaHmac } from './whatsapp-waha.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEBHOOK_MAX_BYTES = Math.min(524288, Math.max(16384, Number.parseInt(process.env.WHATSAPP_AI_WEBHOOK_MAX_BYTES || '262144', 10)));
const WEBHOOK_EVENTS_PER_MINUTE = Math.min(1000, Math.max(20, Number.parseInt(process.env.WHATSAPP_AI_WEBHOOK_EVENTS_PER_MINUTE || '120', 10)));

function rawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  return Buffer.from(JSON.stringify(req.body || {}), 'utf8');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function referencedSecret(channel) {
  const reference = String(channel.credencial_referencia || channel.configuracao?.segredo_env || '').replace(/^ENV:/i, '').trim();
  if (!/^[A-Z][A-Z0-9_]{2,149}$/.test(reference)) return null;
  return process.env[reference] || null;
}

function minimalEventPayload(parsed = {}) {
  if (parsed.ignored) return {
    event: parsed.event || 'EVENTO_DESCONHECIDO',
    eventId: parsed.externalId || null,
    ignored: true,
    reason: parsed.reason || 'ignored',
  };
  return {
    event: parsed.event,
    data: {
      key: { id: parsed.externalId, remoteJid: parsed.remoteJid, fromMe: false },
      pushName: parsed.name || '',
      messageTimestamp: parsed.timestamp || null,
      message: { conversation: parsed.text },
    },
  };
}

export async function consumeWhatsappWebhookRateLimit(trx, { channelId, empresaId, lojaId, windowSeconds = 60, limit = WEBHOOK_EVENTS_PER_MINUTE } = {}) {
  if (!trx || typeof trx.query !== 'function' || !channelId || !empresaId || !lojaId) {
    const error = new Error('escopo do canal WhatsApp ausente para rate limit');
    error.code = 'WHATSAPP_RATE_LIMIT_SCOPE_REQUIRED';
    error.statusCode = 503;
    throw error;
  }
  const lockKey = `whatsapp:${empresaId}:${lojaId}:${channelId}`;
  await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  const result = await trx.query(
    `SELECT COUNT(*)::int AS total,
            COALESCE(CEIL(EXTRACT(EPOCH FROM (($2::timestamptz + ($3 * INTERVAL '1 second')) - CURRENT_TIMESTAMP))), $3)::int AS retry_after_seconds
       FROM eventos_integracao_canais
      WHERE empresa_id = $1 AND loja_id = $4 AND canal_id = $5
        AND recebido_em >= CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second')`,
    [empresaId, new Date().toISOString(), Math.max(1, Number(windowSeconds) || 60), lojaId, channelId],
  );
  const total = Number(result.rows[0]?.total || 0);
  const retryAfterSeconds = Math.max(1, Number(result.rows[0]?.retry_after_seconds || windowSeconds || 60));
  return { allowed: total < Math.max(1, Number(limit) || 1), remaining: Math.max(0, Math.max(1, Number(limit) || 1) - total), retryAfterSeconds };
}

function validSignature(req, channel) {
  // Canal sem assinatura só em desenvolvimento/teste declarados; ambiente sem NODE_ENV não abre.
  if (channel.algoritmo_assinatura === 'nenhum') return ['development', 'test'].includes(String(process.env.NODE_ENV || '').trim().toLowerCase());
  const secret = referencedSecret(channel);
  if (!secret) return false;
  const headerName = channel.cabecalho_assinatura || 'x-setpoint-webhook-token';
  const received = req.get(headerName);
  if (!received) return false;
  if (channel.algoritmo_assinatura === 'token_estatico') return safeEqual(received, secret);
  const expected = crypto.createHmac('sha256', secret).update(rawBody(req)).digest('hex');
  return safeEqual(String(received).replace(/^sha256=/i, '').trim(), expected);
}

function referencedEnv(channel, key) {
  const reference = String(channel?.configuracao?.[key] || '').replace(/^ENV:/i, '').trim();
  return /^[A-Z][A-Z0-9_]{2,149}$/.test(reference) ? process.env[reference] || '' : '';
}

function validWahaSignature(req, channel) {
  const secret = referencedEnv(channel, 'segredo_env') || referencedSecret(channel) || '';
  const hmacKey = referencedEnv(channel, 'waha_hmac_env');
  const expectedSession = validWahaSession(channel?.configuracao?.waha_session || channel?.configuracao?.instance);
  const receivedSession = validWahaSession(req.body?.session);
  if (!secret || !hmacKey || !expectedSession || !receivedSession || expectedSession !== receivedSession) return false;
  const token = req.get(channel.cabecalho_assinatura || 'x-waha-webhook-secret');
  const hmacHeader = req.get('x-webhook-hmac');
  return safeEqual(token, secret) && verifyWahaHmac(rawBody(req), hmacHeader, hmacKey);
}

/**
 * Entrada única de mensagem recebida (webhook da Evolution OU consulta periódica
 * do backend da Isa): grava o evento (idempotente por canal + id externo),
 * enfileira a conversa para a IA e aplica o SAIR em todos os módulos.
 */
async function mediaFromWebhook(channel, parsed, body, externalId, { waha = false } = {}) {
  let data = body.payload && typeof body.payload === 'object'
    ? body.payload
    : (body.data && typeof body.data === 'object' ? body.data : body);
  if (Array.isArray(data.messages) && data.messages.length) data = data.messages[0];
  if (!locateInboundMedia(data)) return parsed;
  const jaVisto = await db.queryRead(
    'SELECT 1 FROM eventos_integracao_canais WHERE canal_id = $1 AND evento_externo_id = $2 LIMIT 1',
    [channel.id, externalId],
  ).then((r) => Boolean(r.rows[0])).catch(() => false);
  if (jaVisto) return parsed;
  const lido = await inboundMediaToText(data, {
    chatId: parsed.phone,
    mediaLoader: waha ? (media) => downloadWahaMedia(channel.configuracao?.waha_session || channel.configuracao?.instance, media.url).then(({ buffer, contentType }) => ({ base64: buffer.toString('base64'), mimeType: contentType })) : undefined,
  }).catch(() => ({ ok: false }));
  // Falha ao baixar/transcrever: segue como texto para o atendente pedir que o cliente escreva,
  // em vez de ignorar a mensagem em silêncio.
  const tipoMidia = String(locateInboundMedia(data)?.kind || '').toLowerCase() === 'image' ? 'image' : 'audio';
  // Mesmo texto do polling: o atendente responde com a mensagem fixa pedindo para escrever.
  if (!lido?.ok) return { ...parsed, ignored: false, reason: undefined, text: `[Falha ao baixar ou transcrever ${tipoMidia}]` };
  // Normaliza como o caminho de texto: remetente @lid vira o número real.
  const ts = Number(data.messageTimestamp || body.messageTimestamp || 0) || null;
  return {
    ...parsed,
    ignored: false,
    reason: undefined,
    remoteJid: waha ? parsed.remoteJid : `${parsed.phone}@s.whatsapp.net`,
    name: String(data.pushName || body.pushName || data.notifyName || '').slice(0, 160),
    timestamp: ts,
    text: lido.text,
    media: lido.kind,
  };
}

export async function ingestInboundWhatsappMessage(channel, parsed, { hash, providerPayload = {}, rateLimit = consumeWhatsappWebhookRateLimit } = {}) {
  const aiReady = whatsappAiReady(channel);
  const optOutRequested = campaignOptOutRequested(parsed);
  const externalId = String(parsed.externalId || '').slice(0, 200);
  if (!externalId) return { ignored: true, reason: parsed.reason || 'missing_event_id' };
  const hashCorpo = hash || crypto.createHash('sha256').update(JSON.stringify(providerPayload || {})).digest('hex');
  const result = await db.transaction(async trx => {
    const existing = await trx.query(
      `SELECT hash_corpo FROM eventos_integracao_canais WHERE canal_id = $1 AND evento_externo_id = $2 LIMIT 1 FOR UPDATE`,
      [channel.id, externalId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].hash_corpo && String(existing.rows[0].hash_corpo).toLowerCase() !== String(hashCorpo).toLowerCase()) {
        return { duplicate: true, payloadConflict: true };
      }
      return { duplicate: true };
    }
    const rate = await rateLimit(trx, { channelId: channel.id, empresaId: channel.empresa_id, lojaId: channel.loja_id, eventId: externalId, payloadHash: hashCorpo });
    if (!rate.allowed) return { rateLimited: true, retryAfterSeconds: rate.retryAfterSeconds };
    const eventResult = await trx.query(
      `INSERT INTO eventos_integracao_canais
        (empresa_id, loja_id, canal_id, evento_externo_id, tipo_evento, assinatura_valida,
         hash_corpo, payload, status_processamento, erro_processamento)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb, $8, $9)
       ON CONFLICT (canal_id, evento_externo_id) DO NOTHING
       RETURNING id`,
      [channel.empresa_id, channel.loja_id, channel.id, externalId, parsed.event || 'evento_desconhecido', hashCorpo,
        JSON.stringify(minimalEventPayload({ ...parsed, externalId })), parsed.ignored || !aiReady ? 'ignorado' : 'recebido', parsed.ignored ? parsed.reason : (!aiReady ? (optOutRequested ? 'marketing_opt_out' : 'ai_not_ready') : null)],
    );
    if (!eventResult.rows[0]) return { duplicate: true };
    // SAIR também vai para o atendente: ele confirma ao cliente e grava o bloqueio permanente.
    if (!parsed.ignored && aiReady) {
      await trx.query(
        `INSERT INTO tarefas_integracao_canais
          (empresa_id, loja_id, canal_id, evento_integracao_id, tipo, referencia_externa, payload)
         VALUES ($1, $2, $3, $4, 'processar_conversa', $5, $6::jsonb)`,
        [channel.empresa_id, channel.loja_id, channel.id, eventResult.rows[0].id, parsed.remoteJid, JSON.stringify({ messageId: externalId })],
      );
    }
    await trx.query(
      `UPDATE canais_integracao SET ultimo_evento_em = CURRENT_TIMESTAMP, data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1`,
      [channel.id],
    );
    return { duplicate: false, ignored: parsed.ignored || !aiReady, optOut: optOutRequested, reason: parsed.reason || (optOutRequested ? 'marketing_opt_out' : (!aiReady ? 'ai_not_ready' : null)) };
  });
  if (result.duplicate) return result;

  let campaignMetrics = { updatedCampaigns: [] };
  let marketingOptOut = { optedOut: false };
  let cartRecoveryOptOut = { optedOut: false, carts: 0 };
  let appointmentOptOut = { optedOut: false, customers: 0 };
  // Cada efeito do SAIR roda separado: a falha de um não impede os outros. O bloqueio
  // permanente vai primeiro porque é o único caminho quando o atendente está desligado.
  const safely = async (label, fn, fallback) => {
    try { return await fn(); } catch (sideError) {
      console.warn(`[WhatsApp] ${label} pendente de reconciliação:`, String(sideError?.message || sideError).slice(0, 300));
      return fallback;
    }
  };
  if (optOutRequested) await safely('bloqueio permanente (SAIR)', () => recordAutomationOptOut(db.query.bind(db), channel.empresa_id, parsed.phone || parsed.remoteJid, 'sair_no_whatsapp'), false);
  appointmentOptOut = await safely('SAIR da agenda', () => recordAppointmentNotificationOptOut(channel, parsed), appointmentOptOut);
  cartRecoveryOptOut = await safely('SAIR do carrinho', () => recordCartRecoveryOptOut(channel, parsed), cartRecoveryOptOut);
  marketingOptOut = await safely('SAIR de campanhas', () => recordCampaignOptOut(channel, parsed), marketingOptOut);
  campaignMetrics = await safely('métrica de campanha', () => recordCampaignProviderEvent(channel, providerPayload, parsed), campaignMetrics);
  return { ...result, campaignMetrics, marketingOptOut, cartRecoveryOptOut, appointmentOptOut };
}

export function createWhatsappAiWebhookRouter({ rateLimit = consumeWhatsappWebhookRateLimit } = {}) {
  const router = express.Router();

  router.post('/waha', async (req, res) => {
    try {
      if (rawBody(req).byteLength > WEBHOOK_MAX_BYTES) return res.status(413).json({ error: 'evento excede o limite permitido' });
      const sessionName = validWahaSession(req.body?.session);
      if (!sessionName) return res.status(404).json({ error: 'sessão WAHA não encontrada' });
      const channelResult = await db.queryRead(
        `SELECT * FROM canais_integracao
          WHERE provedor = 'whatsapp' AND status = 'ativo'
            AND tipo_canal IN ('gestao', 'lancamentos')
            AND lower(COALESCE(configuracao->>'waha_session', configuracao->>'instance', '')) = lower($1)
          LIMIT 1`,
        [sessionName],
      );
      const channel = channelResult.rows[0];
      if (!channel || !validWahaGroupId(channel.configuracao?.waha_group_id) || !validWahaSignature(req, channel)) {
        return res.status(401).json({ error: 'webhook WAHA não autorizado' });
      }
      const rawEvent = String(req.body?.event || req.body?.type || '').toLowerCase().replaceAll('.', '_');
      if (rawEvent === 'session_status' || rawEvent === 'status_instance') {
        const state = normalizeState(req.body?.payload || req.body?.data || req.body);
        registrarEventoConexao(channel.empresa_id, state, channel.tipo_canal);
        return res.status(202).json({ accepted: true, connection: state });
      }
      if (rawEvent !== 'message' && rawEvent !== 'message_received' && rawEvent !== 'messages_upsert') {
        return res.status(202).json({ accepted: true, ignored: true, reason: 'unsupported_event' });
      }
      const parsedBase = parseWahaMessage(req.body || {}, { groupId: channel.configuracao?.waha_group_id, sessionName });
      const externalId = parsedBase.externalId || String(req.get('x-webhook-request-id') || '').slice(0, 200);
      let parsed = parsedBase;
      const mediaAllowed = parsed.remoteJid === channel.configuracao?.waha_group_id
        && !['from_me', 'not_group', 'waha_group_not_allowlisted', 'session_mismatch'].includes(parsed.reason);
      if (externalId && mediaAllowed && locateInboundMedia(req.body?.payload || req.body || {})) {
        parsed = await mediaFromWebhook(channel, parsed, req.body || {}, externalId, { waha: true });
      }
      if (!externalId) return res.status(202).json({ accepted: true, ignored: true, reason: parsed.reason || 'missing_event_id' });
      const hash = crypto.createHash('sha256').update(rawBody(req)).digest('hex');
      const resultado = await ingestInboundWhatsappMessage(channel, { ...parsed, externalId }, { hash, providerPayload: req.body || {}, rateLimit });
      if (resultado.payloadConflict) return res.status(409).json({ accepted: false, code: 'WHATSAPP_PAYLOAD_CONFLICT' });
      if (resultado.rateLimited) {
        res.set('Retry-After', String(resultado.retryAfterSeconds));
        return res.status(429).json({ accepted: false, code: 'RATE_LIMIT', error: 'limite temporário de eventos atingido' });
      }
      return res.status(202).json({ accepted: true, ...resultado });
    } catch (error) {
      console.error('[WhatsApp WAHA] erro no webhook:', String(error?.message || error).slice(0, 500));
      return res.status(500).json({ error: 'falha ao receber evento WAHA' });
    }
  });

  router.post('/whatsapp/:publicCode', async (req, res) => {
    try {
      if (!UUID_REGEX.test(String(req.params.publicCode || ''))) return res.status(404).json({ error: 'canal não encontrado' });
      const channelResult = await db.queryRead(
        `SELECT * FROM canais_integracao
          WHERE codigo_publico = $1 AND provedor = 'whatsapp' AND status = 'ativo' LIMIT 1`,
        [req.params.publicCode],
      );
      const channel = channelResult.rows[0];
      if (!channel) return res.status(404).json({ error: 'canal não encontrado ou inativo' });
      if (!validSignature(req, channel)) return res.status(401).json({ error: 'assinatura inválida' });
      if (rawBody(req).byteLength > WEBHOOK_MAX_BYTES) return res.status(413).json({ error: 'evento excede o limite permitido' });
      // Confirmação de entrega/leitura: só atualiza métricas de campanha. Não entra na fila,
      // não gera evento de conversa e não consome o limite de eventos do canal.
      const statusEvent = String(req.body?.event || req.body?.type || '').toUpperCase().replaceAll('.', '_');
      if (statusEvent === 'MESSAGES_UPDATE' || statusEvent === 'MESSAGE_UPDATE') {
        const metrics = await recordCampaignProviderEvent(channel, req.body || {}, { ignored: true }).catch(() => ({ updatedCampaigns: [] }));
        return res.status(202).json({ accepted: true, statusUpdate: true, campaignMetrics: metrics });
      }
      const rawEvent = String(req.body?.event || req.body?.type || '').toUpperCase().replaceAll('.', '_');
      if (rawEvent === 'CONNECTION_UPDATE' || rawEvent === 'ONSTATECHANGE' || rawEvent === 'STATUS_INSTANCE') {
        const payloadData = req.body?.data && typeof req.body.data === 'object' ? req.body.data : req.body;
        const state = normalizeState(payloadData);
        registrarEventoConexao(channel.empresa_id, state, channel.tipo_canal);
        return res.status(202).json({ accepted: true, connection: state });
      }
      let parsed = parseEvolutionMessage(req.body || {});
      const externalId = parsed.externalId || String(req.get('x-event-id') || '').slice(0, 200);
      // Áudio/foto da Evolution (webhook com base64 ligado): transcreve/descreve e segue como texto.
      if (parsed.reason === 'unsupported_content' && parsed.phone && externalId) {
        parsed = await mediaFromWebhook(channel, parsed, req.body || {}, externalId);
      }
      if (!externalId) return res.status(202).json({ accepted: true, ignored: true, reason: parsed.reason || 'missing_event_id' });
      const hash = crypto.createHash('sha256').update(rawBody(req)).digest('hex');
      const resultado = await ingestInboundWhatsappMessage(channel, { ...parsed, externalId }, { hash, providerPayload: req.body || {}, rateLimit });
      if (resultado.payloadConflict) return res.status(409).json({ accepted: false, code: 'WHATSAPP_PAYLOAD_CONFLICT' });
      if (resultado.rateLimited) {
        res.set('Retry-After', String(resultado.retryAfterSeconds));
        return res.status(429).json({ accepted: false, code: 'RATE_LIMIT', error: 'limite temporário de eventos atingido' });
      }
      return res.status(202).json({ accepted: true, ...resultado });
    } catch (error) {
      console.error('[WhatsApp AI] erro no webhook:', String(error?.message || error).slice(0, 500));
      return res.status(500).json({ error: 'falha ao receber evento' });
    }
  });

  return router;
}
