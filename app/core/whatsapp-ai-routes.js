import { recordAutomationOptOut } from './ai-memory.js';
import crypto from 'node:crypto';
import express from 'express';
import { db } from './database.js';
import { parseEvolutionMessage, whatsappAiReady } from './whatsapp-ai.js';
import { campaignOptOutRequested, recordCampaignOptOut, recordCampaignProviderEvent } from './commerce-campaigns.js';
import { recordCartRecoveryOptOut } from './commerce-abandoned-carts.js';
import { recordAppointmentNotificationOptOut } from './barbershop-appointment-notifications.js';
import { normalizeState } from './whatsapp-provider.js';
import { registrarEventoConexao } from '../whatsapp-conexao-kytto.js';

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

async function webhookRateLimited(channelId) {
  const result = await db.queryRead(
    `SELECT COUNT(*)::int AS total
       FROM eventos_integracao_canais
      WHERE canal_id = $1 AND recebido_em >= CURRENT_TIMESTAMP - INTERVAL '1 minute'`,
    [channelId],
  );
  return Number(result.rows[0]?.total || 0) >= WEBHOOK_EVENTS_PER_MINUTE;
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

export function createWhatsappAiWebhookRouter() {
  const router = express.Router();

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
      if (await webhookRateLimited(channel.id)) return res.status(429).json({ error: 'limite temporário de eventos atingido' });

      const rawEvent = String(req.body?.event || req.body?.type || '').toUpperCase().replaceAll('.', '_');
      if (rawEvent === 'CONNECTION_UPDATE' || rawEvent === 'ONSTATECHANGE' || rawEvent === 'STATUS_INSTANCE') {
        const payloadData = req.body?.data && typeof req.body.data === 'object' ? req.body.data : req.body;
        const state = normalizeState(payloadData);
        registrarEventoConexao(channel.empresa_id, state);
        return res.status(202).json({ accepted: true, connection: state });
      }
      const parsed = parseEvolutionMessage(req.body || {});
      const aiReady = whatsappAiReady();
      const optOutRequested = campaignOptOutRequested(parsed);
      const externalId = parsed.externalId || String(req.get('x-event-id') || '').slice(0, 200);
      if (!externalId) return res.status(202).json({ accepted: true, ignored: true, reason: parsed.reason || 'missing_event_id' });
      const hash = crypto.createHash('sha256').update(rawBody(req)).digest('hex');
      const result = await db.transaction(async trx => {
        const eventResult = await trx.query(
          `INSERT INTO eventos_integracao_canais
            (empresa_id, loja_id, canal_id, evento_externo_id, tipo_evento, assinatura_valida,
             hash_corpo, payload, status_processamento, erro_processamento)
           VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb, $8, $9)
           ON CONFLICT (canal_id, evento_externo_id) DO NOTHING
           RETURNING id`,
          [channel.empresa_id, channel.loja_id, channel.id, externalId, parsed.event || 'evento_desconhecido', hash,
            JSON.stringify(minimalEventPayload(parsed)), parsed.ignored || !aiReady ? 'ignorado' : 'recebido', parsed.ignored ? parsed.reason : (!aiReady ? (optOutRequested ? 'marketing_opt_out' : 'ai_not_ready') : null)],
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
      campaignMetrics = await safely('métrica de campanha', () => recordCampaignProviderEvent(channel, req.body || {}, parsed), campaignMetrics);
      return res.status(202).json({ accepted: true, ...result, campaignMetrics, marketingOptOut, cartRecoveryOptOut, appointmentOptOut });
    } catch (error) {
      console.error('[WhatsApp AI] erro no webhook:', String(error?.message || error).slice(0, 500));
      return res.status(500).json({ error: 'falha ao receber evento' });
    }
  });

  return router;
}
