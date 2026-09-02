import crypto from 'node:crypto';
import express from 'express';
import { db } from './database.js';
import { parseEvolutionMessage, whatsappAiReady } from './whatsapp-ai.js';
import { campaignOptOutRequested, recordCampaignOptOut, recordCampaignProviderEvent } from './commerce-campaigns.js';
import { recordCartRecoveryOptOut } from './commerce-abandoned-carts.js';
import { recordAppointmentNotificationOptOut } from './barbershop-appointment-notifications.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function validSignature(req, channel) {
  if (channel.algoritmo_assinatura === 'nenhum') return process.env.NODE_ENV !== 'production';
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
            JSON.stringify(req.body || {}), parsed.ignored || !aiReady || optOutRequested ? 'ignorado' : 'recebido', parsed.ignored ? parsed.reason : (optOutRequested ? 'marketing_opt_out' : (!aiReady ? 'ai_not_ready' : null))],
        );
        if (!eventResult.rows[0]) return { duplicate: true };
        if (!parsed.ignored && aiReady && !optOutRequested) {
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
        return { duplicate: false, ignored: parsed.ignored || !aiReady || optOutRequested, reason: parsed.reason || (optOutRequested ? 'marketing_opt_out' : (!aiReady ? 'ai_not_ready' : null)) };
      });

      let campaignMetrics = { updatedCampaigns: [] };
      let marketingOptOut = { optedOut: false };
      let cartRecoveryOptOut = { optedOut: false, carts: 0 };
      let appointmentOptOut = { optedOut: false, customers: 0 };
      try {
        appointmentOptOut = await recordAppointmentNotificationOptOut(channel, parsed);
        cartRecoveryOptOut = await recordCartRecoveryOptOut(channel, parsed);
        marketingOptOut = await recordCampaignOptOut(channel, parsed);
        campaignMetrics = await recordCampaignProviderEvent(channel, req.body || {}, parsed);
      } catch (metricsError) {
        console.warn('[WhatsApp] métrica de campanha pendente de reconciliação:', String(metricsError?.message || metricsError).slice(0, 300));
      }
      return res.status(202).json({ accepted: true, ...result, campaignMetrics, marketingOptOut, cartRecoveryOptOut, appointmentOptOut });
    } catch (error) {
      console.error('[WhatsApp AI] erro no webhook:', String(error?.message || error).slice(0, 500));
      return res.status(500).json({ error: 'falha ao receber evento' });
    }
  });

  return router;
}
