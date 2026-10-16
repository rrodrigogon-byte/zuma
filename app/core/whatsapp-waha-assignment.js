import { db } from '../db.js';

const INTERNAL_PROFILES = new Set(['gestao', 'lancamentos']);

/**
 * Lê a atribuição persistida da sessão interna sem chamar obterConexao(), que
 * inicializa defaults no cache global. Não grava, não salva e nunca faz rede.
 */
export function readWahaAssignedSession(empresaId, tipoCanal) {
  const profile = String(tipoCanal || '').toLowerCase();
  if (!INTERNAL_PROFILES.has(profile)) return '';
  const key = `${String(empresaId || '')}:${profile}`;
  const state = db();
  const record = state?.whatsappConexaoKytto?.empresas?.[key];
  return String(record?.transport || '').toLowerCase() === 'waha'
    ? String(record?.instance || '').trim()
    : '';
}
