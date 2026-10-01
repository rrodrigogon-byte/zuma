// ============================================================================
// ENTRADA DO WHATSAPP IGUAL À DA ISA (NossaGente)
//
// O backend da Isa não chama webhook com as mensagens recebidas: o NossaGente
// consulta GET {BASE}/messages a cada poucos segundos (whatsappApiSyncWorker +
// whatsappApiBridge). Este módulo faz o mesmo para a Dino:
//   - uma passada por vez em todo o cluster (trava do PostgreSQL);
//   - só mensagens do cliente (role=user), recentes (idade máxima), sem grupos;
//   - id do evento igual ao da Isa: api:<chat>:<id ou horário>:<hash do texto>,
//     gravado com ON CONFLICT (nunca responde duas vezes a mesma mensagem);
//   - áudio recebe resposta fixa pedindo texto (como a Isa);
//   - a mensagem entra na MESMA fila da IA (processar_conversa) e passa pelo
//     mesmo SAIR/consentimento do webhook.
//
// Variáveis: WHATSAPP_PROVIDER=chatbot_backend, CHATBOT_BACKEND_URL,
// CHATBOT_BACKEND_KEY, CHATBOT_BACKEND_EMPRESA_ID (empresa dona do número),
// WHATSAPP_POLL_MODE=off|shadow|pilot|on (padrão on), WHATSAPP_POLL_PILOT_PHONES
// (lista no modo pilot), WHATSAPP_POLL_INTERVAL_MS (padrão 5000, mínimo 3000),
// WHATSAPP_MAX_REPLY_AGE_MINUTES (padrão 30).
// ============================================================================

import crypto from 'node:crypto';
import { db } from './database.js';
import { chatbotBackendMode, fetchInboundMessages, isaChatId, sendTextViaChatbotBackend, whatsappProviderConfigured, whatsappProviderName } from './whatsapp-provider.js';
import { ingestInboundWhatsappMessage } from './whatsapp-ai-routes.js';

const LOCK_KEY = 'dino_whatsapp_isa_poll';
const AUDIO_MARKERS = new Set(['[ÁUDIO RECEBIDO]', '[AUDIO RECEBIDO]']);
export const AUDIO_REPLY = 'Recebi seu áudio, mas por aqui eu só consigo ler mensagens de texto. Pode me escrever o que precisa? 🙂';

function texto(valor, limite = 4000) {
  return String(valor ?? '').replace(/\u0000/g, '').trim().slice(0, limite);
}

export function pollMode() {
  const modo = texto(process.env.WHATSAPP_POLL_MODE, 10).toLowerCase();
  return ['off', 'shadow', 'pilot', 'on'].includes(modo) ? modo : 'on';
}

export function pollEnabled() {
  return whatsappProviderName() === 'chatbot_backend' && chatbotBackendMode() === 'isa' && whatsappProviderConfigured() && pollMode() !== 'off';
}

function maxAgeMs() {
  const minutos = Number.parseInt(process.env.WHATSAPP_MAX_REPLY_AGE_MINUTES || '30', 10);
  return Math.min(24 * 60, Math.max(5, Number.isFinite(minutos) ? minutos : 30)) * 60 * 1000;
}

function pilotPhones() {
  return new Set(String(process.env.WHATSAPP_POLL_PILOT_PHONES || '').split(',').map((item) => isaChatId(item)).filter(Boolean));
}

function sha(valor) {
  return crypto.createHash('sha256').update(String(valor ?? '')).digest('hex');
}

/** Converte uma mensagem do histórico do backend no formato interno (o mesmo do webhook). */
export function parseBackendMessage(item = {}, { agora = Date.now() } = {}) {
  const chatId = isaChatId(item.chatId);
  const conteudo = texto(item.content);
  const quando = new Date(item.timestamp).valueOf();
  const base = { event: 'MESSAGES_UPSERT' };
  if (String(item.role || '').toLowerCase() !== 'user') return { ...base, ignored: true, reason: 'from_me' };
  if (!chatId) return { ...base, ignored: true, reason: 'invalid_sender' };
  if (!conteudo && !item.whatsappMessageId) return { ...base, ignored: true, reason: 'unsupported_content' };
  if (!Number.isFinite(quando) && !item.whatsappMessageId) return { ...base, ignored: true, reason: 'missing_message_id' };
  // Id igual ao da Isa (providerEventId): chat + id da mensagem (ou horário) + hash do texto.
  const externalId = `api:${chatId}:${texto(item.whatsappMessageId, 120) || texto(item.timestamp, 40)}:${sha(conteudo).slice(0, 16)}`.slice(0, 200);
  const comum = { ...base, externalId, remoteJid: `${chatId}@s.whatsapp.net`, phone: chatId, name: '', timestamp: Number.isFinite(quando) ? Math.floor(quando / 1000) : null };
  if (Number.isFinite(quando) && agora - quando > maxAgeMs()) return { ...comum, ignored: true, reason: 'too_old', skip: true };
  if (String(item.messageType || '').toLowerCase() === 'audio' || AUDIO_MARKERS.has(conteudo)) return { ...comum, ignored: true, reason: 'audio' };
  if (!conteudo) return { ...comum, ignored: true, reason: 'unsupported_content' };
  return { ...comum, ignored: false, text: conteudo };
}

async function canalDaEmpresa() {
  const empresaId = texto(process.env.CHATBOT_BACKEND_EMPRESA_ID, 60);
  if (!/^[0-9a-f-]{36}$/i.test(empresaId)) return null;
  const resultado = await db.queryRead(
    `SELECT * FROM canais_integracao
      WHERE empresa_id = $1 AND provedor = 'whatsapp' AND status = 'ativo'
      ORDER BY data_atualizacao DESC NULLS LAST LIMIT 1`,
    [empresaId],
  );
  return resultado.rows[0] || null;
}

/**
 * Uma passada: busca as mensagens recentes e entrega à mesma entrada do webhook.
 * Dependências injetáveis para teste.
 */
export async function runIsaPollPass({ fetchImpl, agora = Date.now(), canal: canalInjetado, ingest = ingestInboundWhatsappMessage, enviar = sendTextViaChatbotBackend, comTrava = true } = {}) {
  if (!pollEnabled()) return { skipped: true, reason: 'poll_disabled' };
  const executar = async () => {
    const canal = canalInjetado || await canalDaEmpresa();
    if (!canal) return { skipped: true, reason: 'channel_not_active' };
    const resposta = await fetchInboundMessages({ from: agora - maxAgeMs(), limit: 100 }, fetchImpl);
    if (!resposta.ok) return { skipped: true, reason: resposta.authError ? 'backend_auth' : (resposta.error || 'backend_unavailable') };
    const modo = pollMode();
    const piloto = pilotPhones();
    const resumo = { lidas: resposta.messages.length, novas: 0, duplicadas: 0, ignoradas: 0, audios: 0, foraDoPiloto: 0 };
    const ordenadas = [...resposta.messages].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
    for (const item of ordenadas) {
      let parsed = parseBackendMessage(item, { agora });
      if (parsed.skip || !parsed.externalId) { resumo.ignoradas += 1; continue; }
      if (!parsed.ignored && modo === 'pilot' && !piloto.has(parsed.phone)) {
        resumo.foraDoPiloto += 1;
        parsed = { ...parsed, ignored: true, reason: 'pilot_not_listed' };
      }
      if (!parsed.ignored && modo === 'shadow') parsed = { ...parsed, ignored: true, reason: 'shadow' };
      const resultado = await ingest(canal, parsed, { hash: sha(`${parsed.externalId}|${parsed.text || ''}`), providerPayload: {} });
      if (resultado?.duplicate) { resumo.duplicadas += 1; continue; }
      if (parsed.ignored) resumo.ignoradas += 1; else resumo.novas += 1;
      if (parsed.reason === 'audio' && modo === 'on') {
        resumo.audios += 1;
        await enviar({ number: parsed.phone, text: AUDIO_REPLY }, fetchImpl).catch(() => null);
      }
    }
    return { skipped: false, ...resumo };
  };
  if (!comTrava) return executar();
  return db.transaction(async (trx) => {
    const trava = await trx.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', [LOCK_KEY]);
    if (!trava.rows[0]?.ok) return { skipped: true, reason: 'lock_held' };
    return executar();
  });
}

export function startIsaPollWorker() {
  if (!pollEnabled()) {
    if (whatsappProviderName() === 'chatbot_backend') console.log('[WhatsApp] entrada por consulta (modelo Isa) desligada: confira CHATBOT_BACKEND_URL/KEY e WHATSAPP_POLL_MODE');
    return null;
  }
  const intervalo = Math.max(3000, Number.parseInt(process.env.WHATSAPP_POLL_INTERVAL_MS || '5000', 10) || 5000);
  let rodando = false;
  const tick = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const resumo = await runIsaPollPass();
      if (resumo?.novas || resumo?.audios) console.log(JSON.stringify({ worker: 'whatsapp-isa-poll', ...resumo }));
    } catch (error) {
      console.warn('[WhatsApp] consulta de mensagens:', String(error?.message || error).slice(0, 200));
    } finally {
      rodando = false;
    }
  };
  const timer = setInterval(tick, intervalo);
  timer.unref?.();
  console.log(`[WhatsApp] entrada por consulta (modelo Isa) ativa a cada ${intervalo} ms, modo ${pollMode()}`);
  return timer;
}
