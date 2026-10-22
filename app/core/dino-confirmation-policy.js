const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function confirmationPlan(appointmentAt, now = new Date()) {
  const startMs = new Date(appointmentAt).valueOf();
  const nowMs = new Date(now).valueOf();
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return { enabled: false, reason: 'schedule_invalid' };
  const leadMs = startMs - nowMs;
  // Aviso de 2ª etapa é enviado 2 h antes: dá 1 h para resposta e ainda 1 h
  // para a equipe reaproveitar o horário. Com menos de 3 h, não há janela segura
  // para as duas etapas; o agendamento fica fora do cancelamento automático.
  if (leadMs < 3 * HOUR_MS + 15 * 60 * 1000) return { enabled: false, reason: 'notice_too_short' };
  const secondAtMs = startMs - 2 * HOUR_MS - 15 * 60 * 1000;
  const firstAtMs = Math.max(nowMs, startMs - DAY_MS);
  if (secondAtMs - firstAtMs < HOUR_MS) return { enabled: false, reason: 'confirmation_stages_too_close' };
  return {
    enabled: true,
    firstAt: new Date(firstAtMs),
    secondAt: new Date(secondAtMs),
    responseDeadline: new Date(secondAtMs + HOUR_MS),
    appointmentAt: new Date(startMs),
  };
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
