const fs = require('fs');

let aiCode = fs.readFileSync('app/core/whatsapp-ai.js', 'utf8');

// Are they already there?
if (!aiCode.includes('export function composeReplyWithNewAction')) {
  // We need to add them!
  const appendCode = `
import { actionTtlMinutes, CONFIRMATION_HINT, PENDING_REMINDER_HINT, formatActionSummary } from './whatsapp-ai-intents.js';

const RESTATES_ACTION = /^(perfeito|combinado|fechado|ótimo|certo|ok)[!\.]*(?:\s*(?:seu (agendamento|horário|pedido)|a (remarcação|reserva|agenda)))?(?:\s*(?:está|foi)\s*(?:preparado|iniciado|reservado))?/i;

export function pendingActionPrompt(pending, persona = null) {
  const summary = formatActionSummary(pending.summary || '');
  const verb = pending.type === 'pedido' ? 'concluir' : pending.type === 'cancelamento' ? 'cancelar o agendamento' : 'confirmar';
  return \`Confere aí: \${summary}\n👉 Responda SIM para \${verb}, ou NÃO para mudar.\`;
}

export function composeReplyWithNewAction(modelText, pending, persona = null) {
  const text = String(modelText || '').trim();
  const lead = !text || RESTATES_ACTION.test(text) ? 'Perfeito! Confere pra mim:' : text;
  return \`\${lead}\n\n\${pendingActionPrompt(pending, persona)}\`.trim();
}

export function withPendingReminder(replyText, pending, now = Date.now()) {
  const text = String(replyText || '').trim();
  if (!pending?.actionId || pending.mostrado !== true) return text;
  const preparedAt = new Date(pending.preparadoEm || 0).valueOf();
  if (preparedAt && now - preparedAt > actionTtlMinutes() * 60000) return text;
  if (text.includes(CONFIRMATION_HINT) || text.includes(PENDING_REMINDER_HINT)) return text;
  const tipo = pending.type === 'pedido' ? 'seu pedido' : pending.type === 'cancelamento' ? 'o cancelamento' : pending.type === 'remarcacao' ? 'a remarcação' : 'seu agendamento';
  return \`\${text}\n\nAh, \${tipo} ainda está esperando sua confirmação: \${formatActionSummary(String(pending.summary || '').substring(0, 600).trim())}\n\${PENDING_REMINDER_HINT}\`.trim();
}
`;
  aiCode += appendCode;
  fs.writeFileSync('app/core/whatsapp-ai.js', aiCode, 'utf8');
}
