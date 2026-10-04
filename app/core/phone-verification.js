// Confirmação de número de WhatsApp por código de 6 dígitos.
// Usada no crediário da vitrine (quem compra na conta precisa provar que o número é dele)
// e no lembrete de carrinho (o consentimento passa a valer para um número confirmado).
// O código nunca é guardado nem registrado em log: só o hash. O comprovante devolvido é
// assinado (HMAC) e vale 30 minutos para aquela empresa e aquele número.
import crypto from 'node:crypto';
import { db } from './database.js';
import { CommerceError } from './commerce-error.js';
import { canonicalWhatsappPhone, phoneMatchKey } from './whatsapp-phone.js';
import { enviarMensagem } from './whatsapp.js';
import { whatsappProviderConfigured } from './whatsapp-provider.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_TTL_SECONDS = 10 * 60;
const TOKEN_TTL_SECONDS = 30 * 60;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 3;
const RESEND_SECONDS = 60;

function signingKey() {
  const key = process.env.PHONE_VERIFICATION_SECRET || process.env.JWT_SECRET || '';
  if (!key) throw new CommerceError('verificação por código indisponível', 'PHONE_VERIFICATION_UNAVAILABLE');
  return key;
}
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const codeHash = (empresaId, key, code) => crypto.createHmac('sha256', signingKey()).update(`${empresaId}|${key}|${code}`).digest('hex');

function scope(empresaId, phone) {
  if (!UUID.test(String(empresaId || ''))) throw new CommerceError('empresa inválida', 'INVALID_ID');
  const canonical = canonicalWhatsappPhone(phone);
  if (!canonical) throw new CommerceError('informe um WhatsApp válido com DDD', 'INVALID_PHONE');
  return { empresaId: String(empresaId), canonical, key: phoneMatchKey(canonical) };
}

export function phoneVerificationAvailable() {
  return whatsappProviderConfigured() && Boolean(process.env.PHONE_VERIFICATION_SECRET || process.env.JWT_SECRET);
}

// Envia um código novo. Limites: 1 a cada 60 s e 3 por hora para o mesmo número.
export async function startPhoneVerification({ empresaId, lojaId, phone, storeName = 'a loja', ip = '', database = db, send = null, now = new Date() } = {}) {
  const s = scope(empresaId, phone);
  if (!send && !whatsappProviderConfigured()) throw new CommerceError('envio por WhatsApp não está configurado nesta loja', 'PHONE_VERIFICATION_UNAVAILABLE');
  const recent = await database.query(
    `SELECT criado_em FROM commerce_phone_verifications
      WHERE empresa_id = $1 AND telefone_chave = $2 AND criado_em > $3::timestamptz - INTERVAL '1 hour'
      ORDER BY criado_em DESC`,
    [s.empresaId, s.key, now.toISOString()],
  );
  if (recent.rows.length >= MAX_CODES_PER_HOUR) throw new CommerceError('muitos códigos pedidos para este número; tente de novo mais tarde', 'PHONE_VERIFICATION_RATE_LIMIT');
  if (recent.rows[0] && now - new Date(recent.rows[0].criado_em) < RESEND_SECONDS * 1000) throw new CommerceError('aguarde um minuto para pedir outro código', 'PHONE_VERIFICATION_RATE_LIMIT');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const inserted = await database.query(
    `INSERT INTO commerce_phone_verifications (empresa_id, telefone_chave, codigo_hash, expira_em, ip_hash)
     VALUES ($1, $2, $3, $4::timestamptz + ($5::text || ' seconds')::interval, $6)
     RETURNING id`,
    [s.empresaId, s.key, codeHash(s.empresaId, s.key, code), now.toISOString(), String(CODE_TTL_SECONDS), ip ? sha(ip) : null],
  );
  const text = `Seu código de confirmação de ${String(storeName).slice(0, 60)} é ${code}. Ele vale por 10 minutos. Não compartilhe com ninguém.`;
  let sent;
  if (send) sent = await send(s.canonical, text);
  else {
    const channel = lojaId ? (await database.query(
      `SELECT id, api_base_url, configuracao FROM canais_integracao WHERE empresa_id = $1 AND loja_id = $2 AND provedor = 'whatsapp' AND status = 'ativo' LIMIT 1`,
      [s.empresaId, lojaId],
    )).rows[0] : null;
    sent = await enviarMensagem({
      whatsapp_api_url: process.env.EVOLUTION_API_URL || channel?.api_base_url,
      whatsapp_api_key: process.env.EVOLUTION_API_KEY,
      whatsapp_instance: channel?.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
      empresa_id: s.empresaId, loja_id: lojaId, canal_id: channel?.id,
    }, s.canonical, text);
  }
  if (!sent?.ok) {
    // Envio que falhou não conta no limite do cliente.
    if (inserted?.rows?.[0]?.id) await database.query(`DELETE FROM commerce_phone_verifications WHERE id = $1`, [inserted.rows[0].id]).catch(() => null);
    throw new CommerceError('não foi possível enviar o código agora; tente de novo em instantes', 'PHONE_VERIFICATION_SEND_FAILED');
  }
  return { sent: true, expiresInSeconds: CODE_TTL_SECONDS, phoneEnding: s.canonical.slice(-4) };
}

// Confere o código. Até 5 tentativas por código; acerto devolve o comprovante assinado.
export async function confirmPhoneVerification({ empresaId, phone, code, database = db, now = new Date() } = {}) {
  const s = scope(empresaId, phone);
  const typed = String(code || '').replace(/\D/g, '');
  if (typed.length !== 6) throw new CommerceError('digite os 6 números do código', 'PHONE_VERIFICATION_INVALID');
  const row = (await database.query(
    `SELECT id, codigo_hash, tentativas, expira_em, verificado_em FROM commerce_phone_verifications
      WHERE empresa_id = $1 AND telefone_chave = $2 ORDER BY criado_em DESC LIMIT 1`,
    [s.empresaId, s.key],
  )).rows[0];
  if (!row || row.verificado_em || new Date(row.expira_em) <= now) throw new CommerceError('código expirado; peça um novo', 'PHONE_VERIFICATION_EXPIRED');
  if (Number(row.tentativas) >= MAX_ATTEMPTS) throw new CommerceError('tentativas esgotadas; peça um novo código', 'PHONE_VERIFICATION_LOCKED');
  // A tentativa é gasta antes de comparar e de forma atômica: pedidos em paralelo não
  // ganham mais de 5 chances por código.
  const claimed = (await database.query(
    `UPDATE commerce_phone_verifications SET tentativas = tentativas + 1
      WHERE id = $1 AND tentativas < $2 AND verificado_em IS NULL
      RETURNING codigo_hash, tentativas`,
    [row.id, MAX_ATTEMPTS],
  )).rows[0];
  if (!claimed) throw new CommerceError('tentativas esgotadas; peça um novo código', 'PHONE_VERIFICATION_LOCKED');
  const expected = Buffer.from(String(claimed.codigo_hash));
  const received = Buffer.from(codeHash(s.empresaId, s.key, typed));
  const ok = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  if (!ok) throw new CommerceError('código incorreto', 'PHONE_VERIFICATION_INVALID', { remaining: Math.max(0, MAX_ATTEMPTS - Number(claimed.tentativas)) });
  const marked = (await database.query(
    `UPDATE commerce_phone_verifications SET verificado_em = $2::timestamptz WHERE id = $1 AND verificado_em IS NULL RETURNING id`,
    [row.id, now.toISOString()],
  )).rows[0];
  if (!marked) throw new CommerceError('código expirado; peça um novo', 'PHONE_VERIFICATION_EXPIRED');
  return { verified: true, token: issuePhoneToken(s.empresaId, s.canonical, now), expiresInSeconds: TOKEN_TTL_SECONDS };
}

function issuePhoneToken(empresaId, canonical, now = new Date()) {
  const exp = Math.floor(now.getTime() / 1000) + TOKEN_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ e: empresaId, k: canonical, x: exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', signingKey()).update(`phone-token|${body}`).digest('base64url');
  return `${body}.${sig}`;
}

// Diz se o comprovante vale para esta empresa e este número (em qualquer formato, mas
// o mesmo número: um fixo e um celular com os mesmos 8 finais não se confundem).
export function verifyPhoneToken(token, empresaId, phone, now = new Date()) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return false;
    const expected = crypto.createHmac('sha256', signingKey()).update(`phone-token|${body}`).digest('base64url');
    if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const canonical = canonicalWhatsappPhone(phone);
    return Boolean(canonical) && data.e === String(empresaId) && data.k === canonical && Number(data.x) * 1000 > now.getTime();
  } catch {
    return false;
  }
}
