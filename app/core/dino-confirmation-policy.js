const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function confirmationPlan(appointmentAt, now = new Date()) {
  // CONFIRMAÇÕES NATIVAS DESATIVADAS PARA USAR O CRON DA BARBEARIA
  // A confirmação nativa ficava enviando no ato da criação se criada no mesmo dia e
  // enchia o cliente. O cron já gerencia de forma inteligente (uma vez só, de manhã)
  return { enabled: false, reason: 'suppressed_by_cron_trigger' };
}

export function secondConfirmationWindowOpen(appointmentAt, now = new Date()) {
  const startMs = new Date(appointmentAt).valueOf();
  const nowMs = new Date(now).valueOf();
  return Number.isFinite(startMs) && Number.isFinite(nowMs) && startMs - nowMs >= 2 * HOUR_MS;
}

export function confirmationDeadlineExpired(deadline, now = new Date()) {
  const deadlineMs = new Date(deadline).valueOf();
  const nowMs = new Date(now).valueOf();
  return Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && nowMs >= deadlineMs;
}
