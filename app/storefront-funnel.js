// ============================================================================
// FUNIL DA LOJA ONLINE — visitas, carrinho e checkout por empresa e por dia.
// Guarda só contagens diárias e o hash da sessão (para não contar a mesma
// pessoa duas vezes no dia). Nenhum dado pessoal, IP ou user-agent é salvo.
// ============================================================================

import crypto from 'node:crypto';
import { db, save } from './db.js';

export const FUNNEL_EVENTS = ['visit', 'cart', 'checkout'];
const MAX_SESSIONS_PER_DAY = 20000;
const RETENTION_DAYS = 400;
const TIME_ZONE = 'America/Cuiaba';

function dayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return parts; // YYYY-MM-DD
}

function store(empresaId) {
  const state = db();
  state.storefrontFunnelKytto ||= { empresas: {} };
  state.storefrontFunnelKytto.empresas ||= {};
  const key = String(empresaId);
  state.storefrontFunnelKytto.empresas[key] ||= { dias: {} };
  return state.storefrontFunnelKytto.empresas[key];
}

function sessionHash(empresaId, sessionKey) {
  return crypto.createHash('sha256').update(`${empresaId}:${sessionKey}`).digest('hex').slice(0, 20);
}

function prune(bucket, today) {
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - RETENTION_DAYS);
  const cutoff = limit.toISOString().slice(0, 10);
  for (const day of Object.keys(bucket.dias)) {
    if (day < cutoff) delete bucket.dias[day];
    // os hashes de sessão só evitam contar a mesma pessoa duas vezes NO DIA:
    // dos dias passados ficam só as contagens
    else if (day < today && bucket.dias[day]?.sessoes) delete bucket.dias[day].sessoes;
  }
}

// Uma visita não justifica reescrever o banco inteiro na hora: o funil é gravado
// junto da próxima gravação de qualquer outra coisa ou, no máximo, em 60 s.
const ATRASO_GRAVACAO_MS = 60_000;
let gravacaoAgendada = null;
function gravarDepois() {
  if (gravacaoAgendada) return;
  gravacaoAgendada = setTimeout(() => {
    gravacaoAgendada = null;
    try { save(); } catch (error) { console.error('[funil] falha ao gravar:', error?.message || error); }
  }, ATRASO_GRAVACAO_MS);
  gravacaoAgendada.unref?.();
}

/**
 * Registra um evento do funil. Idempotente por sessão/evento/dia.
 * Retorna { recorded: boolean, reason? }.
 */
export function recordStorefrontEvent(empresaId, { event, sessionKey, at = new Date(), persist = true } = {}) {
  if (!empresaId) return { recorded: false, reason: 'missing_tenant' };
  if (!FUNNEL_EVENTS.includes(event)) return { recorded: false, reason: 'invalid_event' };
  const session = String(sessionKey || '').trim();
  if (!/^[A-Za-z0-9_.:-]{8,180}$/.test(session)) return { recorded: false, reason: 'invalid_session' };
  const today = dayKey(at instanceof Date ? at : new Date(at));
  const bucket = store(empresaId);
  bucket.dias[today] ||= { visit: 0, cart: 0, checkout: 0, sessoes: { visit: [], cart: [], checkout: [] } };
  const day = bucket.dias[today];
  day.sessoes ||= { visit: [], cart: [], checkout: [] };
  const hash = sessionHash(empresaId, session);
  const seen = day.sessoes[event] || (day.sessoes[event] = []);
  if (seen.includes(hash)) return { recorded: false, reason: 'duplicate' };
  if (seen.length >= MAX_SESSIONS_PER_DAY) return { recorded: false, reason: 'daily_cap' };
  seen.push(hash);
  day[event] = Number(day[event] || 0) + 1;
  prune(bucket, today);
  if (persist === 'agora') save();
  else if (persist) gravarDepois();
  return { recorded: true };
}

/** Soma o funil entre duas datas (Date). */
export function funnelSummary(empresaId, fromDate, toDate) {
  const bucket = store(empresaId);
  const from = dayKey(fromDate);
  const to = dayKey(new Date(toDate.getTime() - 1));
  const totals = { visit: 0, cart: 0, checkout: 0, days: 0 };
  for (const [day, values] of Object.entries(bucket.dias)) {
    if (day < from || day > to) continue;
    totals.visit += Number(values.visit || 0);
    totals.cart += Number(values.cart || 0);
    totals.checkout += Number(values.checkout || 0);
    totals.days += 1;
  }
  return totals;
}

export { dayKey as funnelDayKey };
