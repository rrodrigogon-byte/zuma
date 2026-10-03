// Intenções determinísticas de confirmação para ações pendentes do atendente.
//
// Só é consultado quando existe uma ação PREPARADA e o cliente JÁ VIU o resumo
// gerado pelo sistema (whatsapp-ai.js garante isso). Por isso aceitamos o jeito
// natural de responder no WhatsApp — "sim", "pode marcar", "fechado", 👍 —
// em vez de exigir a palavra CONFIRMAR.
//
// Regras de segurança:
// - a mensagem inteira precisa ser uma resposta curta (até 6 palavras);
// - pergunta ("?"), negação ou condição ("mas", "se", "só que") nunca confirma:
//   cai para o modelo, que entende a nuance e prepara outra ação se for o caso;
// - "não"/"cancela" curtos cancelam; frases com mais conteúdo ("não, prefiro às 15h")
//   também caem para o modelo.

const EMOJI_CONFIRM = /^(?:👍|👍🏻|👍🏼|👍🏽|👍🏾|👍🏿|✅|✔️|✔|👌|👌🏻|👌🏼|👌🏽|👌🏾|👌🏿|🤝)+$/u;
const EMOJI_CANCEL = /^(?:❌|✖️|👎|👎🏻|👎🏼|👎🏽|👎🏾|👎🏿)+$/u;

const CONFIRM_PHRASES = new Set([
  'confirmar', 'confirmo', 'confirma', 'confirmado', 'confirmada', 'sim confirmar', 'pode confirmar', 'pode concluir',
  'sim', 's', 'ss', 'siim', 'simm', 'sim sim', 'sim pode', 'sim por favor', 'sim pfv', 'sim pf', 'sim obrigado', 'sim obrigada',
  'pode', 'pode sim', 'pode ser', 'pode marcar', 'pode agendar', 'pode reservar', 'pode fazer', 'pode fechar', 'pode mandar', 'pode separar',
  'pode remarcar', 'pode seguir', 'pode prosseguir',
  'isso', 'isso mesmo', 'isso ai', 'exatamente', 'certo', 'certinho', 'correto', 'perfeito', 'otimo', 'show', 'top', 'massa', 'joia',
  'fechado', 'fechou', 'fecha', 'combinado', 'beleza', 'blz', 'bele', 'ok', 'okay', 'okk', 'ok pode', 'ok obrigado', 'ta bom', 'ta otimo', 'ta certo',
  'ta perfeito', 'tudo certo', 'bora', 'vamos', 'manda ver', 'manda bala', 'quero', 'quero sim', 'marca', 'marca ai', 'agenda ai',
  'yes', 'claro', 'claro que sim', 'com certeza', 'positivo', 'afirmativo', 'concordo', 'de acordo', 'aceito', 'valeu pode marcar',
]);

const CANCEL_PHRASES = new Set([
  'cancelar', 'cancela', 'cancelado', 'nao confirmar', 'desistir', 'desisto',
  'nao', 'n', 'nn', 'nao nao', 'nao obrigado', 'nao obrigada', 'nao quero', 'nao precisa', 'melhor nao', 'deixa', 'deixa pra la', 'deixa quieto',
  'esquece', 'pode cancelar', 'cancela ai', 'nao pode', 'agora nao', 'nao vou querer', 'mudei de ideia', 'negativo',
]);

// Palavras que indicam ressalva: nunca confirmar automaticamente.
const CAVEAT = /\b(mas|porem|so que|se|caso|antes|troca|trocar|muda|mudar|outro|outra|ou|quanto|qual|quando|onde|como)\b/;

function normalize(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1$1') // "simmmm" -> "simm"
    .trim();
}

// Quando a ação pendente É um cancelamento de horário, "pode cancelar" significa
// confirmar a ação. "cancelar" sozinho fica ambíguo e volta para nova pergunta.
const CANCELLATION_CONFIRM = new Set(['pode cancelar', 'cancela', 'cancela ai', 'cancela sim', 'pode cancelar sim', 'sim cancela', 'sim pode cancelar', 'cancelado', 'pode desmarcar', 'desmarca', 'desmarca ai']);

/**
 * @param {string} text mensagem do cliente
 * @param {{ actionType?: string }} [options] tipo da ação pendente (ex.: 'cancelamento')
 * @returns {'confirm'|'cancel'|null}
 */
export function confirmIntent(text, { actionType = '' } = {}) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 80) return null;
  const compact = raw.replace(/\s+/g, '');
  if (EMOJI_CONFIRM.test(compact)) return 'confirm';
  if (EMOJI_CANCEL.test(compact)) return 'cancel';
  if (raw.includes('?')) return null;
  const value = normalize(raw)
    .replace(/\p{Extended_Pictographic}|‍|️|[\u{1f3fb}-\u{1f3ff}]/gu, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) return null;
  const words = value.split(' ');
  if (words.length > 6) return null;
  if (actionType === 'cancelamento') {
    if (CANCELLATION_CONFIRM.has(value)) return 'confirm';
    if (value === 'cancelar' || value === 'cancelado') return null;
  }
  if (CANCEL_PHRASES.has(value)) return 'cancel';
  if (/^(nao|n)\b/.test(value)) return null; // "não, prefiro sábado" → modelo
  if (CAVEAT.test(value)) return null;
  if (CONFIRM_PHRASES.has(value)) return 'confirm';
  // "sim, pode marcar obrigado" / "ok fechado" / "beleza pode ser"
  const stripped = value.replace(/\b(obrigado|obrigada|obg|vlw|valeu|por favor|pfv|pf|entao|ai|sim|ok|blz|beleza)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!stripped) return /\b(sim|ok|blz|beleza)\b/.test(value) ? 'confirm' : null;
  if (CONFIRM_PHRASES.has(stripped)) return 'confirm';
  return null;
}

export const CONFIRMATION_HINT = 'Responda SIM para confirmar ou NÃO para desistir.';

// Palavras explícitas: valem a qualquer momento enquanto a ação está pendente
// (comportamento anterior). As respostas naturais acima só valem quando a ÚLTIMA
// mensagem do atendente foi o próprio resumo/toque (ver naturalConfirmationAllowed).
const STRICT_CONFIRM = new Set(['confirmar', 'confirmo', 'sim confirmar', 'pode confirmar', 'pode concluir']);
const STRICT_CANCEL = new Set(['cancelar', 'cancela', 'nao confirmar', 'desistir']);

export function strictConfirmIntent(text, { actionType = '' } = {}) {
  const value = normalize(text).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  // Num cancelamento de horário, "cancela" é ambíguo: decide a regra natural (ou o modelo).
  if (actionType === 'cancelamento' && (value === 'cancela' || value === 'cancelar')) return null;
  if (STRICT_CONFIRM.has(value)) return 'confirm';
  if (STRICT_CANCEL.has(value)) return 'cancel';
  return null;
}

/** A última fala do atendente pediu exatamente SIM/NÃO para a ação pendente? */
export function naturalConfirmationAllowed(lastAssistantText) {
  return String(lastAssistantText || '').includes(CONFIRMATION_HINT);
}

/**
 * Decisão final: palavra explícita sempre; resposta natural só logo após o pedido de confirmação.
 */
export function resolveConfirmation(text, { actionType = '', lastAssistantText = '' } = {}) {
  const strict = strictConfirmIntent(text, { actionType });
  if (strict) return strict;
  if (!naturalConfirmationAllowed(lastAssistantText)) return null;
  return confirmIntent(text, { actionType });
}
