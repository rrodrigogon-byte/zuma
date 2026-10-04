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
//   - áudio é TRANSCRITO e foto é DESCRITA pelo Gemini (core/whatsapp-ai-media.js)
//     e seguem como texto para a mesma fila; se a mídia não vier ou falhar,
//     mantém a resposta fixa pedindo texto (como a Isa);
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
import { chatbotBackendConfig, chatbotBackendMode, fetchInboundMessages, fetchOutboundMessages, isaChatId, sendTextViaChatbotBackend, validInstance, whatsappProviderConfigured, whatsappProviderName } from './whatsapp-provider.js';
import { ingestInboundWhatsappMessage } from './whatsapp-ai-routes.js';
import { inboundMediaToText } from './whatsapp-ai-media.js';
import { latestStaffMessages, pauseForStaff, releaseExpiredStaffPauses, staffTakeoverEnabled } from './whatsapp-staff-takeover.js';

const LOCK_KEY = 'dino_whatsapp_isa_poll';
const AUDIO_MARKERS = new Set(['[ÁUDIO RECEBIDO]', '[AUDIO RECEBIDO]']);
const IMAGE_MARKERS = new Set(['[IMAGEM RECEBIDA]', '[FOTO RECEBIDA]', '[IMAGE]', '[IMAGEM]']);
export const AUDIO_REPLY = 'Recebi seu áudio, mas não consegui ouvir direitinho por aqui. Pode me escrever o que precisa? 🙂';
export const IMAGE_REPLY = 'Recebi sua foto, mas não consegui abrir por aqui. Pode me contar em uma frase o que você quer? 🙂';

function texto(valor, limite = 4000) {
  return String(valor ?? '').replace(/\u0000/g, '').trim().slice(0, limite);
}

export function pollMode() {
  const modo = texto(process.env.WHATSAPP_POLL_MODE, 10).toLowerCase();
  return ['off', 'shadow', 'pilot', 'on'].includes(modo) ? modo : 'on';
}

export function pollEnabled() {
  return whatsappProviderName() === 'chatbot_backend' && whatsappProviderConfigured() && pollMode() !== 'off';
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
  const tipo = String(item.messageType || '').toLowerCase();
  if (['audio', 'ptt', 'voice'].includes(tipo) || AUDIO_MARKERS.has(conteudo)) return { ...comum, ignored: true, reason: 'audio' };
  // Foto sem legenda (ou só com o marcador) precisa ser descrita; com legenda, a legenda já é texto.
  if ((tipo === 'image' || IMAGE_MARKERS.has(conteudo.toUpperCase())) && (!conteudo || IMAGE_MARKERS.has(conteudo.toUpperCase()))) return { ...comum, ignored: true, reason: 'image' };
  if (!conteudo) return { ...comum, ignored: true, reason: 'unsupported_content' };
  return { ...comum, ignored: false, text: conteudo };
}

async function canalDaEmpresa() {
  const empresaId = texto(process.env.CHATBOT_BACKEND_EMPRESA_ID, 60);
  if (!/^[0-9a-f-]{36}$/i.test(empresaId)) return null;
  const instance = chatbotBackendMode() === 'instancias' ? chatbotBackendConfig().instance : null;
  if (chatbotBackendMode() === 'instancias' && !instance) return null;
  const resultado = await db.queryRead(
    `SELECT c.* FROM canais_integracao c
      WHERE c.empresa_id = $1 AND c.provedor = 'whatsapp' AND c.status = 'ativo'
        AND ($2::text IS NULL OR (
          c.configuracao->>'instance' = $2
          AND NOT EXISTS (SELECT 1 FROM canais_integracao outra
            WHERE outra.status = 'ativo' AND outra.provedor = 'whatsapp'
              AND outra.empresa_id <> $1 AND outra.configuracao->>'instance' = $2)
        ))
      ORDER BY c.data_atualizacao DESC NULLS LAST LIMIT 1`,
    [empresaId, instance],
  );
  return resultado.rows[0] || null;
}

/**
 * Uma passada: busca as mensagens recentes e entrega à mesma entrada do webhook.
 * Dependências injetáveis para teste.
 */
async function eventoJaRecebido(canal, externalId) {
  const resultado = await db.queryRead(
    'SELECT 1 FROM eventos_integracao_canais WHERE canal_id = $1 AND evento_externo_id = $2 LIMIT 1',
    [canal.id, externalId],
  );
  return Boolean(resultado.rows[0]);
}

/**
 * Áudio/foto: transcreve ou descreve antes de entregar à fila. Só roda para
 * mensagem nova (evita pagar Gemini a cada consulta de 5 s) e fora do modo shadow.
 */
async function lerMidia(parsed, item, { canal, fetchImpl, jaRecebido, entenderMidia }) {
  if (!['audio', 'image'].includes(parsed.reason)) return parsed;
  if (await jaRecebido(canal, parsed.externalId).catch(() => false)) return { ...parsed, duplicateHint: true };
  const lido = await entenderMidia(item, { fetchImpl, chatId: parsed.phone }).catch(() => ({ ok: false, code: 'MEDIA_ERROR' }));
  if (!lido?.ok || !lido.text) return { ...parsed, mediaCode: lido?.code || 'MEDIA_ERROR' };
  return { ...parsed, ignored: false, reason: undefined, text: lido.text, media: parsed.reason };
}

// Mídias em leitura neste processo: evita transcrever duas vezes enquanto o Gemini responde.
const midiasEmLeitura = new Set();

export async function runIsaPollPass({ fetchImpl, agora = Date.now(), canal: canalInjetado, ingest = ingestInboundWhatsappMessage, enviar = sendTextViaChatbotBackend, comTrava = true, jaRecebido = eventoJaRecebido, entenderMidia = inboundMediaToText, buscarSaidas = fetchOutboundMessages, equipe = { liberar: releaseExpiredStaffPauses, pausar: pauseForStaff } } = {}) {
  if (!pollEnabled()) return { skipped: true, reason: 'poll_disabled' };
  const resumo = { equipeAssumiu: 0, iaRetomada: 0, lidas: 0, novas: 0, duplicadas: 0, ignoradas: 0, audios: 0, fotos: 0, midiasLidas: 0, foraDoPiloto: 0 };
  let canalDaPassada = null;
  // Áudio/foto novos e as mensagens seguintes do MESMO contato ficam para depois da
  // trava: a chamada ao Gemini (segundos) não segura conexão nem advisory lock, e a
  // ordem da conversa daquele contato é preservada.
  const adiadas = [];

  async function entregar(parsed, midiaLiberada) {
    // O hash usa o texto ORIGINAL do evento: a transcrição não muda a identidade da mensagem.
    const resultado = await ingest(canalDaPassada, parsed, { hash: sha(`${parsed.externalId}|${parsed.media ? `[${parsed.media}]` : (parsed.text || '')}`), providerPayload: {} });
    if (resultado?.duplicate) { resumo.duplicadas += 1; return; }
    if (parsed.ignored) resumo.ignoradas += 1; else resumo.novas += 1;
    if (parsed.media) resumo.midiasLidas += 1;
    if (parsed.media === 'audio' || parsed.reason === 'audio') resumo.audios += 1;
    if (parsed.media === 'image' || parsed.reason === 'image') resumo.fotos += 1;
    if (midiaLiberada && parsed.ignored && ['audio', 'image'].includes(parsed.reason)) {
      await enviar({ ...(canalDaPassada.configuracao?.instance ? { instance: canalDaPassada.configuracao.instance } : {}), number: parsed.phone, text: parsed.reason === 'audio' ? AUDIO_REPLY : IMAGE_REPLY }, fetchImpl).catch(() => null);
    }
  }

  const executar = async () => {
    const canal = canalInjetado || await canalDaEmpresa();
    if (!canal) return { skipped: true, reason: 'channel_not_active' };
    const instance = chatbotBackendMode() === 'instancias' ? validInstance(canal.configuracao?.instance || '') : '';
    if (chatbotBackendMode() === 'instancias' && (!instance || instance !== chatbotBackendConfig().instance)) return { skipped: true, reason: 'instance_scope_mismatch' };
    canalDaPassada = canal;
    const resposta = await fetchInboundMessages({ instance, from: agora - maxAgeMs(), limit: 100 }, fetchImpl);
    if (!resposta.ok) return { skipped: true, reason: resposta.authError ? 'backend_auth' : (resposta.error || 'backend_unavailable') };
    const modo = pollMode();
    // Antes de entregar as mensagens do cliente: se a equipe respondeu pelo celular,
    // a conversa já está com ela quando o worker for responder (a IA não atropela a recepção).
    if (staffTakeoverEnabled() && modo !== 'shadow') {
      resumo.iaRetomada += await equipe.liberar(db, { canalId: canal.id }).catch(() => 0);
      const saidas = await buscarSaidas({ instance, from: agora - maxAgeMs(), limit: 100 }, fetchImpl).catch(() => ({ ok: false, messages: [] }));
      if (saidas?.ok) {
        for (const contato of latestStaffMessages(saidas.messages)) {
          const r = await equipe.pausar(canal, contato).catch((error) => {
            console.warn('[WhatsApp] pausa por mensagem da equipe:', String(error?.message || error).slice(0, 200));
            return null;
          });
          if (r?.paused) resumo.equipeAssumiu += 1;
        }
      }
    }
    const piloto = pilotPhones();
    resumo.lidas = resposta.messages.length;
    const contatosAdiados = new Set();
    const ordenadas = [...resposta.messages].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
    for (const item of ordenadas) {
      let parsed = parseBackendMessage(item, { agora });
      if (parsed.skip || !parsed.externalId) { resumo.ignoradas += 1; continue; }
      if (!parsed.ignored && modo === 'pilot' && !piloto.has(parsed.phone)) {
        resumo.foraDoPiloto += 1;
        parsed = { ...parsed, ignored: true, reason: 'pilot_not_listed' };
      }
      const midia = ['audio', 'image'].includes(parsed.reason);
      const midiaLiberada = midia && (modo === 'on' || (modo === 'pilot' && piloto.has(parsed.phone)));
      if (midiaLiberada) {
        if (midiasEmLeitura.has(parsed.externalId) || await jaRecebido(canal, parsed.externalId).catch(() => false)) { resumo.duplicadas += 1; continue; }
        adiadas.push({ parsed, item, midiaLiberada });
        contatosAdiados.add(parsed.phone);
        continue;
      }
      if (contatosAdiados.has(parsed.phone)) { adiadas.push({ parsed, item, midiaLiberada: false }); continue; }
      if (!parsed.ignored && modo === 'shadow') parsed = { ...parsed, ignored: true, reason: 'shadow' };
      await entregar(parsed, false);
    }
    return { skipped: false };
  };

  const fase1 = comTrava
    ? await db.transaction(async (trx) => {
      const trava = await trx.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', [LOCK_KEY]);
      if (!trava.rows[0]?.ok) return { skipped: true, reason: 'lock_held' };
      return executar();
    })
    : await executar();
  if (fase1?.skipped) return fase1;

  // Fase 2, fora da trava: lê as mídias e entrega na ordem original de cada contato.
  for (const { parsed: original, item, midiaLiberada } of adiadas) {
    let parsed = original;
    if (midiaLiberada) {
      midiasEmLeitura.add(parsed.externalId);
      try {
        parsed = await lerMidia(parsed, item, { canal: canalDaPassada, fetchImpl, jaRecebido: async () => false, entenderMidia });
      } finally {
        midiasEmLeitura.delete(original.externalId);
      }
    }
    await entregar(parsed, midiaLiberada);
  }
  return { skipped: false, ...resumo };
}

export function startIsaPollWorker() {
  if (!pollEnabled()) {
    if (whatsappProviderName() === 'chatbot_backend') console.log('[WhatsApp] entrada por consulta desligada: confira CHATBOT_BACKEND_URL/KEY e WHATSAPP_POLL_MODE');
    return null;
  }
  const intervalo = Math.max(3000, Number.parseInt(process.env.WHATSAPP_POLL_INTERVAL_MS || '5000', 10) || 5000);
  let rodando = false;
  const tick = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const resumo = await runIsaPollPass();
      if (resumo?.novas || resumo?.audios || resumo?.fotos || resumo?.equipeAssumiu || resumo?.iaRetomada) console.log(JSON.stringify({ worker: 'whatsapp-isa-poll', ...resumo }));
    } catch (error) {
      console.warn('[WhatsApp] consulta de mensagens:', String(error?.message || error).slice(0, 200));
    } finally {
      rodando = false;
    }
  };
  const timer = setInterval(tick, intervalo);
  timer.unref?.();
  console.log(`[WhatsApp] entrada por consulta ativa a cada ${intervalo} ms, modo ${pollMode()}, backend ${chatbotBackendMode()}`);
  return timer;
}
