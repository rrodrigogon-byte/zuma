import crypto from 'node:crypto';

const SESSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/;
const GROUP_PATTERN = /^[0-9]{5,30}@g\.us$/;
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const MAX_GRAPH_BYTES = 1 * 1024 * 1024;

function clean(value, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

export function validWahaSession(value) {
  const session = clean(value, 120);
  return SESSION_PATTERN.test(session) ? session : '';
}

export function normalizeWahaPhone(value) {
  const phone = clean(value, 30).replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(phone)) throw new Error('Informe o telefone com DDI, somente números.');
  return phone;
}

export function validWahaGroupId(value) {
  const groupId = clean(value, 180);
  return GROUP_PATTERN.test(groupId) ? groupId : '';
}

export function wahaControlConfigured(env = process.env) {
  const baseUrl = clean(env.WAHA_CONTROL_URL, 1000).replace(/\/$/, '');
  const secret = clean(env.WAHA_CONTROL_BRIDGE_SECRET, 500);
  return Boolean(/^https:\/\//i.test(baseUrl) && secret.length >= 20);
}

export function wahaProviderSummary(env = process.env) {
  const baseUrl = clean(env.WAHA_CONTROL_URL, 1000).replace(/\/$/, '');
  return {
    provider: 'waha',
    label: 'WAHA privado (canais internos)',
    baseUrl,
    configured: wahaControlConfigured(env),
    keyConfigured: wahaControlConfigured(env),
  };
}

function config() {
  const baseUrl = clean(process.env.WAHA_CONTROL_URL, 1000).replace(/\/$/, '');
  const secret = clean(process.env.WAHA_CONTROL_BRIDGE_SECRET, 500);
  if (!/^https:\/\//i.test(baseUrl) || secret.length < 20) {
    throw new Error('O controle privado WAHA do Kytto ainda não está configurado.');
  }
  return { baseUrl, secret };
}

function encodedSession(value) {
  const session = validWahaSession(value);
  if (!session) throw new Error('Nome de sessão WAHA inválido.');
  return encodeURIComponent(session);
}

async function request(path, init = {}) {
  const { baseUrl, secret } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Kytto-Waha-Bridge-Secret': secret,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      let message = 'A ponte privada WAHA não respondeu corretamente.';
      try {
        const body = await response.json();
        if (typeof body?.message === 'string' && body.message.trim()) message = body.message.trim();
      } catch {
        // Mantém a mensagem sanitizada.
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao consultar a instância WAHA.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function jsonRequest(path, init = {}) {
  return request(path, init).then((response) => response.json());
}

export async function provisionWahaSession(sessionName) {
  return jsonRequest('/v1/sessions/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: validWahaSession(sessionName) }),
  }).catch(error => {
    if (error.status === 404 || error.status === 409 || error.status === 422) return { status: 'STARTING' };
    throw error;
  });
}

export async function getWahaSessionStatus(sessionName) {
  return jsonRequest(`/v1/sessions/${encodedSession(sessionName)}/status`).catch(error => {
    if (error.status === 404) return { status: 'UNKNOWN' };
    if (error.status === 409 || error.status === 422) return { status: 'STARTING' };
    throw error;
  });
}

export async function getWahaSessionQr(sessionName) {
  let response;
  let attempts = 0;
  while (attempts < 6) {
    attempts++;
    try {
      response = await request(`/v1/sessions/${encodedSession(sessionName)}/qr`);
      break;
    } catch (error) {
      if ((error.status === 404 || error.status === 409 || error.status === 422) && attempts < 6) {
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }
      if (error.status === 404 || error.status === 409 || error.status === 422) return { contentType: 'image/png', dataUrl: '' };
      throw error;
    }
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
  const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
  if (!base64 || !contentType.startsWith('image/')) throw new Error('A instância WAHA não retornou um QR Code válido.');
  return { contentType, dataUrl: `data:${contentType};base64,${base64}` };
}

export async function requestWahaPairingCode(sessionName, phoneNumber) {
  const phone = normalizeWahaPhone(phoneNumber);
  let body;
  let attempts = 0;
  while (attempts < 6) {
    attempts++;
    try {
      body = await jsonRequest(`/v1/sessions/${encodedSession(sessionName)}/pairing-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      break;
    } catch (error) {
      if ((error.status === 404 || error.status === 409 || error.status === 422) && attempts < 6) {
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }
      throw error;
    }
  }
  const code = clean(body?.code, 64);
  if (!code) throw new Error('A ponte WAHA não retornou um código de pareamento.');
  return code;
}

export async function logoutWahaSession(sessionName) {
  return jsonRequest('/v1/sessions/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: validWahaSession(sessionName) }),
  });
}

export async function listWahaGroups(sessionName) {
  const body = await jsonRequest(`/v1/sessions/${encodedSession(sessionName)}/groups`);
  const source = Array.isArray(body) ? body : Array.isArray(body?.groups) ? body.groups : [];
  return source.map((item) => {
    const rawId = item?.id && typeof item.id === 'object' ? (item.id._serialized || item.id.serialized || item.id.id) : item?.id;
    const id = validWahaGroupId(rawId);
    const subject = clean(item?.subject || item?.name || item?.title, 255);
    return id && subject ? { id, subject } : null;
  }).filter(Boolean).slice(0, 100);
}

export function normalizeWahaMediaReference(value) {
  const raw = clean(value, 2000);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!parsed.pathname.startsWith('/api/files/') || parsed.pathname.includes('..')) return '';
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    if (!raw.startsWith('/api/files/') || raw.includes('..')) return '';
    return raw;
  }
}

export async function downloadWahaMedia(sessionName, mediaUrl) {
  const reference = normalizeWahaMediaReference(mediaUrl);
  if (!reference) throw new Error('A referência de mídia WAHA é inválida.');
  const response = await request(`/v1/sessions/${encodedSession(sessionName)}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify({ url: reference }),
  });
  const contentType = (response.headers.get('content-type') || 'application/octet-stream').split(';', 1)[0].toLowerCase();
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_MEDIA_BYTES) throw new Error('A mídia excede o limite permitido.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new Error('A mídia está vazia ou excede o limite permitido.');
  return { contentType, buffer };
}

export async function sendWahaText(sessionName, groupId, text) {
  const session = validWahaSession(sessionName);
  const chatId = validWahaGroupId(groupId);
  const message = clean(text, 4000);
  if (!session || !chatId || !message) throw new Error('Destino WAHA inválido.');
  return jsonRequest(`/v1/sessions/${encodeURIComponent(session)}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, text: message }),
  });
}

export async function sendWahaImage(sessionName, groupId, buffer, contentType = 'image/png', filename = 'grafico.png', caption = '') {
  const session = validWahaSession(sessionName);
  const chatId = validWahaGroupId(groupId);
  const type = clean(contentType, 80).split(';', 1)[0].toLowerCase();
  if (!session || !chatId || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw new Error('Imagem WAHA inválida.');
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_GRAPH_BYTES) throw new Error('Imagem WAHA acima do limite.');
  const safeName = clean(filename, 120).replace(/[^A-Za-z0-9_.-]/g, '_') || 'grafico.png';
  return jsonRequest(`/v1/sessions/${encodeURIComponent(session)}/send-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, contentType: type, filename: safeName, base64: buffer.toString('base64'), caption: clean(caption, 500) }),
  });
}

export function verifyWahaHmac(rawBody, received, secret) {
  const provided = clean(received, 200).replace(/^sha512=/i, '').toLowerCase();
  if (!provided || !secret || !/^[a-f0-9]{128}$/i.test(provided)) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}
