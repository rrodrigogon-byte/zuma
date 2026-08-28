import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, save } from './db.js';
import { mail } from './email.js';

const TTL_MS = 20 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;

const normalizarEmail = (value) => String(value || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();

function ensureStore() {
  const state = db();
  state.passwordResets = Array.isArray(state.passwordResets) ? state.passwordResets : [];
  return state.passwordResets;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function findStoredUserById(userId) {
  const stores = db()?.cadastrosMestresKytto?.usuarios || {};
  for (const [empresaId, users] of Object.entries(stores)) {
    const user = Object.values(users || {}).find((candidate) => String(candidate.id) === String(userId));
    if (user) return { user, empresaId };
  }
  return null;
}

function activeResetFor(token) {
  const tokenHash = hashToken(token);
  const now = Date.now();
  return ensureStore().find((item) => (
    item.tokenHash === tokenHash && !item.usedAt && new Date(item.expiresAt).getTime() > now
  ));
}

export function passwordPolicy(password) {
  const value = String(password || '');
  if (value.length < MIN_PASSWORD_LENGTH) return `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    return 'A senha deve conter letras maiúsculas, minúsculas e números.';
  }
  return null;
}

export function validatePasswordResetToken(token) {
  const item = activeResetFor(token);
  return item ? { ok: true, expiresAt: item.expiresAt } : { ok: false };
}

export async function issuePasswordReset(user, { ip = '' } = {}) {
  if (!user?.id || !user?.email) return { sent: false };
  const store = ensureStore();
  const createdAt = Date.now();
  for (const item of store) {
    if (String(item.userId) === String(user.id) && !item.usedAt) item.usedAt = new Date(createdAt).toISOString();
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(createdAt + TTL_MS).toISOString();
  store.push({
    id: `reset-${createdAt.toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    userId: user.id,
    tokenHash: hashToken(token),
    createdAt: new Date(createdAt).toISOString(),
    expiresAt,
    usedAt: null,
    requestedIp: String(ip || '').slice(0, 120),
  });
  save();
  const baseUrl = String(process.env.PUBLIC_APP_URL || 'https://setpoint.kytto.com.br').replace(/\/+$/, '');
  const resetUrl = `${baseUrl}/redefinir-senha#token=${encodeURIComponent(token)}`;
  try {
    await mail.redefinicaoSenha(user.email, user.nome || 'cliente', resetUrl, expiresAt);
  } catch (error) {
    console.error('[AUTH] falha ao enviar recuperação:', error?.message || error);
  }
  return { sent: true, token, resetUrl, expiresAt };
}

export function consumePasswordReset(token, password) {
  const policyError = passwordPolicy(password);
  if (policyError) return { ok: false, code: 'WEAK_PASSWORD', message: policyError };
  const item = activeResetFor(token);
  if (!item) return { ok: false, code: 'INVALID_TOKEN', message: 'Link inválido ou expirado.' };
  const located = findStoredUserById(item.userId);
  if (!located?.user) return { ok: false, code: 'INVALID_TOKEN', message: 'Link inválido ou expirado.' };

  const changedAt = nowIso();
  item.usedAt = changedAt;
  located.user.senhaHash = bcrypt.hashSync(String(password), 12);
  located.user.senha = undefined;
  located.user.senhaResetObrigatorio = false;
  located.user.passwordChangedAt = changedAt;
  located.user.atualizadoEm = changedAt;
  for (const other of ensureStore()) {
    if (String(other.userId) === String(located.user.id) && other !== item && !other.usedAt) other.usedAt = changedAt;
  }
  save();
  return { ok: true, user: located.user, empresaId: located.empresaId };
}

export { normalizarEmail };
