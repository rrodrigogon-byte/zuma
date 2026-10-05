const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function prefersSelfService(text) {
  const value = normalize(text);
  if (/\b(?:quero|prefiro|preciso) (?:sim |agora )?(?:falar com|um|uma) (?:o |a |um |uma )?(?:atendente|humano|pessoa)\b/.test(value)
      && !/\bnao (?:quero|prefiro|preciso)\b/.test(value)) return false;
  return /\bnao (?:quero|preciso|gostaria de) (?:falar|conversar) com (?:ninguem|alguem|(?:um |uma |o |a )?(?:atendente|humano|pessoa))\b/.test(value)
    || /\b(?:somente|so|apenas) (?:pelo |por |no |com (?:o |a )?)?(?:whats(?:app)?|bot|assistente|ia)\b/.test(value)
    || /\b(?:continuar|seguir|retomar|voltar) (?:com (?:a |o )?(?:ia|bot|assistente)|(?:ao |o )?atendimento automatico)\b/.test(value);
}

// Falhas técnicas reversíveis, sem entrega incerta, risco de identidade ou
// bloqueio de segurança. Retomada exige pedido explícito e ninguém responsável.
export const RECOVERABLE_HANDOFF_REASONS = [
  'gemini:GEMINI_TOOL_LIMIT', 'gemini:GEMINI_INCOMPLETE_RESPONSE',
  'gemini:GEMINI_EMPTY_RESPONSE', 'gemini:GEMINI_NETWORK_ERROR',
  'gemini:GEMINI_HTTP_TEMPORARY', 'gemini:GEMINI_RATE_LIMIT',
  'gemini_circuit_open', 'cliente_confuso', 'pedido_do_cliente', 'duvida_sem_resposta',
];

export function canResumeSelfService(session = {}) {
  return session.status === 'humano' && !session.assigned_to
    && RECOVERABLE_HANDOFF_REASONS.includes(session.handoff_reason || session.estado?.handoffReason);
}

export function recoverableModelFailure(code) {
  return RECOVERABLE_HANDOFF_REASONS.includes(`gemini:${code}`);
}
