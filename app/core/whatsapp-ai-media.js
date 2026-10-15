// ============================================================================
// VOZ E IMAGEM NO ATENDENTE DA DINO
//
// No WhatsApp de barbearia o cliente manda ÁUDIO e FOTO de referência o tempo
// todo. Até aqui o atendente respondia "só leio texto". Este módulo:
//   1. localiza a mídia de uma mensagem recebida, em qualquer formato que o
//      provedor entregar (base64 embutido, URL ou rota de mídia configurável);
//   2. baixa com limite de tamanho e tipo (só áudio e imagem);
//   3. pede ao Gemini (multimodal) a TRANSCRIÇÃO do áudio ou a DESCRIÇÃO da foto
//      no contexto de barbearia/perfumaria;
//   4. devolve um texto marcado ("[áudio transcrito] …") que entra na MESMA fila
//      e nas MESMAS travas do atendimento por texto.
//
// Nada é guardado: a mídia fica só em memória durante a chamada. Se qualquer
// passo falhar, quem chamou mantém o comportamento anterior (pedir texto).
//
// Variáveis:
//   WHATSAPP_AI_MEDIA=off|on              padrão on (precisa de GEMINI_API_KEY)
//   WHATSAPP_AI_MEDIA_MAX_MB              padrão 12 (áudio de ~10 min / foto grande)
//   CHATBOT_BACKEND_MEDIA_PATH            rota de mídia do backend, ex.:
//                                         /messages/{id}/media  ({id}, {chatId}, {instance})
//   GEMINI_MEDIA_MODEL                    padrão = GEMINI_MODEL / gemini-2.5-flash
// ============================================================================

import { config } from '../config.js';
import { chatbotBackendConfig } from './whatsapp-provider.js';
import crypto from 'node:crypto';

const DEFAULT_MAX_MB = 12;
const TIMEOUT_MS = 25000;
const AUDIO_TYPES = /^audio\/(ogg|opus|mpeg|mp3|mp4|m4a|aac|wav|x-wav|webm|amr|3gpp|flac)/i;
const IMAGE_TYPES = /^image\/(jpeg|jpg|png|webp|heic|heif|gif)/i;

export const MEDIA_PREFIX = { audio: '[áudio transcrito]', image: '[foto enviada pelo cliente]' };
export const EXPENSE_PREFIX = '[despesa extraída da foto]';

const clean = (value, max = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export class MediaError extends Error {
  constructor(message, code = 'MEDIA_ERROR') {
    super(message);
    this.name = 'MediaError';
    this.code = code;
  }
}

export function mediaEnabled() {
  const flag = clean(process.env.WHATSAPP_AI_MEDIA, 10).toLowerCase();
  if (['off', 'false', '0', 'nao', 'não'].includes(flag)) return false;
  return Boolean(geminiKey());
}

function geminiKey() {
  return clean(config.integrations?.gemini?.apiKey || process.env.GEMINI_API_KEY || '', 300);
}

function mediaModel() {
  return clean(process.env.GEMINI_MEDIA_MODEL || process.env.GEMINI_MODEL || config.integrations?.gemini?.model || 'gemini-2.5-flash', 80);
}

export function maxMediaBytes() {
  const mb = Number.parseFloat(process.env.WHATSAPP_AI_MEDIA_MAX_MB || String(DEFAULT_MAX_MB));
  return Math.round(Math.min(20, Math.max(1, Number.isFinite(mb) ? mb : DEFAULT_MAX_MB)) * 1024 * 1024);
}

function kindFrom(type = '', mime = '') {
  const t = String(type).toLowerCase();
  const m = String(mime).toLowerCase();
  if (['sticker', 'stickermessage'].includes(t)) return '';
  if (['audio', 'ptt', 'voice', 'audiomessage'].includes(t) || m.startsWith('audio/')) return 'audio';
  if (['image', 'imagemessage', 'photo'].includes(t) || m.startsWith('image/')) return 'image';
  return '';
}

function stripDataUrl(value) {
  const raw = clean(value, 40 * 1024 * 1024);
  const match = raw.match(/^data:([^;,]+)(?:;[^;,]*)*;base64,(.*)$/s);
  return match ? { mimeType: match[1], base64: match[2] } : { mimeType: '', base64: raw };
}

function looksBase64(value) {
  return typeof value === 'string' && value.length >= 16 && /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 2000));
}

/**
 * Descobre a mídia de uma mensagem recebida, sem baixar nada.
 * Aceita o item do backend da Isa/NossaGente ({ messageType, media, mediaUrl, … })
 * e o payload da Evolution ({ message: { audioMessage, imageMessage, base64 } }).
 * @returns {null | { kind: 'audio'|'image', mimeType: string, base64?: string, url?: string, caption?: string, id?: string, seconds?: number }}
 */
export function locateInboundMedia(item = {}) {
  if (!item || typeof item !== 'object') return null;
  const message = item.message && typeof item.message === 'object' ? item.message : {};
  const media = item.media && typeof item.media === 'object' ? item.media : {};
  const audioMsg = message.audioMessage || message.pttMessage || null;
  const imageMsg = message.imageMessage || null;
  const declaredMime = clean(media.mimetype || media.mimeType || item.mimetype || item.mimeType || audioMsg?.mimetype || imageMsg?.mimetype, 100);
  const kind = kindFrom(item.messageType || item.type || media.type || (audioMsg ? 'audio' : imageMsg ? 'image' : ''), declaredMime);
  if (!kind) return null;

  const inlineCandidates = [media.base64, media.data, item.mediaBase64, item.base64, message.base64, item.mediaData];
  const inline = inlineCandidates.find((value) => typeof value === 'string' && (value.startsWith('data:') || looksBase64(value)));
  const url = clean(media.url || media.downloadUrl || item.mediaUrl || item.media_url || item.fileUrl, 2000);
  const parsed = inline ? stripDataUrl(inline) : null;
  const mimeType = clean(parsed?.mimeType || declaredMime || (kind === 'audio' ? 'audio/ogg' : 'image/jpeg'), 100).split(';')[0];
  return {
    kind,
    mimeType,
    base64: parsed?.base64 ? parsed.base64.replace(/\s+/g, '') : undefined,
    // URL criptografada do WhatsApp (.enc em mmg.whatsapp.net) não serve sem a chave de mídia.
    url: /^https?:\/\//i.test(url) && !/\.enc(\?|$)|mmg\.whatsapp\.net/i.test(url) ? url : undefined,
    caption: clean(item.caption || media.caption || imageMsg?.caption || '', 1000) || undefined,
    id: clean(item.whatsappMessageId || item.id || item.key?.id || '', 200) || undefined,
    seconds: Number(audioMsg?.seconds || media.seconds || item.seconds || 0) || undefined,
  };
}

function backendMediaUrl(media, { chatId } = {}) {
  const template = clean(process.env.CHATBOT_BACKEND_MEDIA_PATH, 300);
  if (!template || !media.id) return '';
  const cfg = chatbotBackendConfig();
  if (!cfg.baseUrl) return '';
  const path = template
    .replaceAll('{id}', encodeURIComponent(media.id))
    .replaceAll('{chatId}', encodeURIComponent(clean(chatId, 80)))
    .replaceAll('{instance}', encodeURIComponent(cfg.instance || ''));
  const prefix = path.startsWith('/api/') ? '' : cfg.apiBase;
  return `${cfg.baseUrl}${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

/**
 * Obtém os bytes (em base64) da mídia localizada.
 * Ordem: base64 embutido → URL direta → rota de mídia do backend.
 */
export async function loadMediaBase64(media, { fetchImpl = fetch, chatId } = {}) {
  if (!media) throw new MediaError('Mensagem sem mídia', 'MEDIA_MISSING');
  const limit = maxMediaBytes();
  if (media.base64) {
    const bytes = Math.floor(media.base64.length * 3 / 4);
    if (bytes > limit) throw new MediaError('Mídia acima do limite', 'MEDIA_TOO_LARGE');
    return { base64: media.base64, mimeType: media.mimeType };
  }
  const url = media.url || backendMediaUrl(media, { chatId });
  if (!url) throw new MediaError('Provedor não entregou a mídia', 'MEDIA_UNAVAILABLE');
  const cfg = chatbotBackendConfig();
  // A chave do backend só vai para o próprio backend, nunca para outra origem.
  const headers = cfg.baseUrl && cfg.key && sameOrigin(url, cfg.baseUrl) ? { 'X-API-KEY': cfg.key } : {};
  let response;
  try {
    // Com a chave no cabeçalho, nunca seguir redirecionamento automático: o fetch
    // levaria o X-API-KEY para a outra origem (ex.: URL assinada de bucket).
    response = await fetchImpl(url, { method: 'GET', headers, redirect: headers['X-API-KEY'] ? 'manual' : 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const status = Number(response?.status || 0);
    const location = response?.headers?.get?.('location');
    if (headers['X-API-KEY'] && status >= 300 && status < 400 && location) {
      const next = new URL(location, url).toString();
      response = await fetchImpl(next, { method: 'GET', headers: sameOrigin(next, cfg.baseUrl) ? headers : {}, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    }
  } catch {
    throw new MediaError('Falha ao baixar a mídia', 'MEDIA_DOWNLOAD_FAILED');
  }
  if (!response?.ok) throw new MediaError(`Download de mídia recusado (HTTP ${response?.status})`, 'MEDIA_DOWNLOAD_FAILED');
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > limit) throw new MediaError('Mídia acima do limite', 'MEDIA_TOO_LARGE');
  const contentType = clean(response.headers?.get?.('content-type') || '', 100).split(';')[0];
  // Backend pode responder JSON { base64, mimetype }.
  if (/json/i.test(contentType)) {
    const data = await response.json().catch(() => ({}));
    const inner = stripDataUrl(data.base64 || data.data || data.media?.base64 || '');
    if (!looksBase64(inner.base64)) throw new MediaError('Resposta de mídia sem conteúdo', 'MEDIA_UNAVAILABLE');
    if (Math.floor(inner.base64.length * 3 / 4) > limit) throw new MediaError('Mídia acima do limite', 'MEDIA_TOO_LARGE');
    return { base64: inner.base64.replace(/\s+/g, ''), mimeType: clean(inner.mimeType || data.mimetype || data.mimeType || media.mimeType, 100) };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > limit) throw new MediaError('Mídia acima do limite', 'MEDIA_TOO_LARGE');
  if (!buffer.length) throw new MediaError('Mídia vazia', 'MEDIA_UNAVAILABLE');
  return { base64: buffer.toString('base64'), mimeType: contentType || media.mimeType };
}

const AUDIO_PROMPT = `Você recebe a mensagem de voz de um cliente de uma barbearia e perfumaria no Brasil.
Transcreva fielmente o que foi falado, em português do Brasil, com pontuação natural.
Não responda ao cliente, não resuma e não invente nada. Mantenha nomes, horários, dias e valores exatamente como ditos.
Se trechos estiverem inaudíveis, escreva [inaudível] no lugar. Se não houver fala, responda apenas: [sem fala].
Devolva somente a transcrição.`;

const IMAGE_PROMPT = `Você ajuda o atendente de uma empresa brasileira a entender uma foto enviada no WhatsApp.
Retorne SOMENTE um JSON válido com estas chaves, sem markdown: tipo_imagem, descricao, fornecedor, valor_total, data_documento, categoria, confianca.
tipo_imagem deve ser exatamente "despesa" quando a foto for uma nota fiscal, cupom, recibo ou comprovante de compra; caso contrário use "referencia" ou "outro".
Para uma despesa, extraia somente dados legíveis e necessários: fornecedor, valor total, data no formato AAAA-MM-DD e uma categoria curta. Use valor_total 0, data_documento "" ou campos vazios quando não estiverem legíveis. Não leia nem retorne CPF, CNPJ, chave Pix, código de barras, número de cartão ou outros dados pessoais/sensíveis.
As categorias possíveis são: Pessoal/RH, Manutenção, Utilities (Água/Luz), Material Esportivo, Alimentação/Bebidas, Marketing, Equipamentos, Impostos/Taxas, Serviços Terceiros ou Outros. Se não tiver segurança, use Outros e reduza confianca.
Para uma foto de corte, barba ou cabelo, descreva em até 3 frases objetivas estilo e detalhes úteis ao atendimento. Para produto/perfume, informe somente marca, nome e tipo legíveis. Não identifique pessoas, não comente aparência física, idade, etnia ou atributos sensíveis. Não invente preço nem serviço.
confianca é um número entre 0 e 1 e deve refletir apenas a legibilidade dos dados extraídos.`;

function inferredMime(kind, mimeType) {
  const m = clean(mimeType, 100).toLowerCase().split(';')[0];
  if (kind === 'audio') return AUDIO_TYPES.test(m) ? (m === 'audio/opus' ? 'audio/ogg' : m) : 'audio/ogg';
  return IMAGE_TYPES.test(m) ? m.replace('image/jpg', 'image/jpeg') : 'image/jpeg';
}

/**
 * Pede ao Gemini a transcrição (áudio) ou descrição (imagem).
 * @returns {Promise<{ text: string, model: string }>}
 */
export async function understandMedia({ kind, base64, mimeType, caption }, { fetchImpl = fetch } = {}) {
  const key = geminiKey();
  if (!key) throw new MediaError('Gemini não configurado', 'GEMINI_NOT_CONFIGURED');
  if (!['audio', 'image'].includes(kind)) throw new MediaError('Tipo de mídia não suportado', 'MEDIA_UNSUPPORTED');
  if (!base64) throw new MediaError('Mídia vazia', 'MEDIA_UNAVAILABLE');
  const model = mediaModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const parts = [
    { text: kind === 'audio' ? AUDIO_PROMPT : IMAGE_PROMPT },
    { inline_data: { mime_type: inferredMime(kind, mimeType), data: base64 } },
  ];
  if (kind === 'image' && caption) parts.push({ text: `Legenda escrita pelo cliente: ${clean(caption, 500)}` });
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: {
        temperature: 0,
        maxOutputTokens: 1200,
        ...(kind === 'image' ? { responseMimeType: 'application/json', responseSchema: {
          type: 'OBJECT',
          properties: {
            tipo_imagem: { type: 'STRING', enum: ['despesa', 'referencia', 'outro'] },
            descricao: { type: 'STRING' },
            fornecedor: { type: 'STRING' },
            valor_total: { type: 'NUMBER' },
            data_documento: { type: 'STRING' },
            categoria: { type: 'STRING' },
            confianca: { type: 'NUMBER' },
          },
          required: ['tipo_imagem', 'descricao', 'fornecedor', 'valor_total', 'data_documento', 'categoria', 'confianca'],
        } } : {}),
      } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new MediaError('Falha de conexão com Gemini', 'GEMINI_NETWORK_ERROR');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new MediaError(`Gemini recusou a mídia (HTTP ${response.status})`, response.status === 429 ? 'GEMINI_RATE_LIMIT' : 'GEMINI_HTTP_ERROR');
  if (payload?.promptFeedback?.blockReason) throw new MediaError('Gemini bloqueou a mídia', 'GEMINI_BLOCKED');
  const text = (payload?.candidates?.[0]?.content?.parts || []).map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n').trim();
  if (!text) throw new MediaError('Gemini não devolveu texto', 'GEMINI_EMPTY_RESPONSE');
  if (kind !== 'image') return { text: clean(text, 3500), model };
  const structured = parseImageUnderstanding(text, crypto.createHash('sha256').update(base64).digest('hex'));
  return { text: structured.text, expense: structured.expense, model };
}

function parseImageUnderstanding(raw, mediaHash = '') {
  let parsed = null;
  try { parsed = JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()); } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { text: clean(raw, 3500), expense: null };
  const tipo = clean(parsed.tipo_imagem, 20).toLowerCase();
  const descricao = clean(parsed.descricao, 1200);
  const fornecedor = clean(parsed.fornecedor, 160);
  const dataDocumento = /^\d{4}-\d{2}-\d{2}$/.test(clean(parsed.data_documento, 10)) ? clean(parsed.data_documento, 10) : '';
  const valor = Number(parsed.valor_total);
  const confianca = Math.min(1, Math.max(0, Number(parsed.confianca) || 0));
  const categoria = clean(parsed.categoria, 100) || 'Outros';
  const expense = tipo === 'despesa' ? {
    fornecedor,
    valor: Number.isFinite(valor) && valor > 0 ? Number(valor.toFixed(2)) : 0,
    dataDocumento,
    categoria,
    descricao,
    confianca: Number(confianca.toFixed(3)),
    mediaHash,
  } : null;
  return { text: descricao || (tipo === 'despesa' ? 'documento ou comprovante de compra' : 'imagem recebida'), expense };
}

export function extractExpenseEvidence(text) {
  const line = String(text || '').split('\n').find((item) => item.trim().toLowerCase().startsWith(EXPENSE_PREFIX));
  if (!line) return null;
  try {
    const value = JSON.parse(line.slice(line.indexOf(EXPENSE_PREFIX) + EXPENSE_PREFIX.length).trim());
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const valor = Number(value.valor);
    const dataDocumento = /^\d{4}-\d{2}-\d{2}$/.test(String(value.dataDocumento || '')) ? String(value.dataDocumento) : '';
    const confianca = Math.min(1, Math.max(0, Number(value.confianca) || 0));
    return {
      fornecedor: clean(value.fornecedor, 160),
      valor: Number.isFinite(valor) && valor > 0 ? Number(valor.toFixed(2)) : 0,
      dataDocumento,
      categoria: clean(value.categoria, 100) || 'Outros',
      descricao: clean(value.descricao, 500),
      confianca: Number(confianca.toFixed(3)),
      mediaHash: /^[a-f0-9]{64}$/i.test(String(value.mediaHash || '')) ? String(value.mediaHash).toLowerCase() : '',
    };
  } catch { return null; }
}

/** Converte a leitura da mídia no texto que o atendente recebe. */
export function mediaAsCustomerText(kind, understood, caption) {
  const body = clean(typeof understood === 'object' ? understood.text : understood, 3500);
  if (kind === 'audio') {
    if (!body || /^\[sem fala\]$/i.test(body)) return '';
    return `${MEDIA_PREFIX.audio} ${body}`;
  }
  const legenda = clean(caption, 1000);
  const expense = typeof understood === 'object' ? understood.expense : null;
  const evidence = expense ? `\n${EXPENSE_PREFIX} ${JSON.stringify(expense)}` : '';
  return `${MEDIA_PREFIX.image} ${body}${legenda ? `\nLegenda do cliente: ${legenda}` : ''}${evidence}`;
}

/**
 * Pipeline completo: localiza → baixa → entende → texto para o atendente.
 * Nunca lança: devolve { ok:false, code } para quem chamou manter o fallback.
 */
export async function inboundMediaToText(item, { fetchImpl = fetch, chatId } = {}) {
  if (!mediaEnabled()) return { ok: false, code: 'MEDIA_DISABLED' };
  const media = locateInboundMedia(item);
  if (!media) return { ok: false, code: 'MEDIA_MISSING' };
  try {
    const loaded = await loadMediaBase64(media, { fetchImpl, chatId });
    const understood = await understandMedia({ kind: media.kind, base64: loaded.base64, mimeType: loaded.mimeType || media.mimeType, caption: media.caption }, { fetchImpl });
    const text = mediaAsCustomerText(media.kind, understood, media.caption);
    if (!text) return { ok: false, kind: media.kind, code: 'MEDIA_NO_SPEECH' };
    return { ok: true, kind: media.kind, text, model: understood.model, expense: understood.expense || null };
  } catch (error) {
    return { ok: false, kind: media.kind, code: error?.code || 'MEDIA_ERROR' };
  }
}

export const MEDIA_SYSTEM_GUIDANCE = `Mensagens que começam com "${MEDIA_PREFIX.audio}" vieram de um áudio do cliente transcrito automaticamente: podem ter pequenos erros de transcrição, então confirme nomes, dias e horários antes de preparar qualquer ação. Mensagens que começam com "${MEDIA_PREFIX.image}" descrevem a foto enviada: use para sugerir o serviço adequado do catálogo real (ex.: foto de degradê → serviço de corte com máquina/fade), sem prometer resultado idêntico e sem comentar a aparência da pessoa. Quando houver a linha "${EXPENSE_PREFIX}", os dados são uma extração estruturada da imagem e podem alimentar preparar_despesa somente se valor, data e confiança forem suficientes; a ação sempre pede SIM e cria apenas despesa pendente, nunca pagamento.`;
