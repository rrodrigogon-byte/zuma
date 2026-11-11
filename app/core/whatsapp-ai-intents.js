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

export function stripMediaPrefix(text) {
  return String(text ?? '')
    .replace(/^\[(?:áudio|audio|mensagem de voz|foto|imagem|documento)(?:\s+transcrit[oa]|\s+enviad[oa])?\]\s*/i, '')
    .trim();
}

function normalize(text) {
  return stripMediaPrefix(text)
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
  if (!raw || raw.length > 140) return null;
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
  // Rejeição explícita de serviço/ação errada ("eu nao quero dermaplaning", "nao dermaplaning", "nao quero isso")
  if (/^(?:eu\s+)?nao\s+(?:quero|vou\s+querer|precisa|pedi)\b/.test(value) || /^nao\s+dermaplaning\b/.test(value)) {
    return 'cancel';
  }
  // Confirmação explícita com complemento ("ok deixa agendado ai se abrir vaga...", "pode deixar agendado", "pode deixar marcado")
  if (!/\b(?:nao|cancela|cancelar|desistir|desisto)\b/.test(value) && /\b(?:deixa\s+(?:agendad[oa]|marcad[oa])|pode\s+(?:deixar\s+)?(?:agendar|agendad[oa]|marcar|marcad[oa]|confirmar|confirmad[oa])|confirma\s+a[ií])\b/.test(value)) {
    return 'confirm';
  }
  const words = value.split(' ');
  if (words.length > 6) return null;
  if (actionType === 'cancelamento' || actionType === 'cancelamento_pedido') {
    if (CANCELLATION_CONFIRM.has(value)) return 'confirm';
    if (value === 'cancelar' || value === 'cancelado') return null;
    // Para cancelamentos, nunca aceitar palavras casuais de conversa (ok, beleza, blz, show, ta bom) como confirmação
    if (CONFIRM_PHRASES.has(value) && !['sim', 'sim confirmar', 'pode confirmar', 'confirmo', 'confirmar'].includes(value)) {
      return null;
    }
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

export const CONFIRMATION_HINT = '👉 Responda *SIM* para confirmar, ou *NÃO* para mudar.';

// Palavras explícitas: valem a qualquer momento enquanto a ação está pendente
// (comportamento anterior). As respostas naturais acima só valem quando a ÚLTIMA
// mensagem do atendente foi o próprio resumo/toque (ver naturalConfirmationAllowed).
const STRICT_CONFIRM = new Set(['confirmar', 'confirmo', 'sim confirmar', 'pode confirmar', 'pode concluir']);
const STRICT_CANCEL = new Set(['cancelar', 'cancela', 'nao confirmar', 'desistir']);

export function strictConfirmIntent(text, { actionType = '' } = {}) {
  const value = normalize(text).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  // Num cancelamento de horário, "cancela" é ambíguo: decide a regra natural (ou o modelo).
  if ((actionType === 'cancelamento' || actionType === 'cancelamento_pedido') && (value === 'cancela' || value === 'cancelar')) return null;
  if (STRICT_CONFIRM.has(value)) return 'confirm';
  if (STRICT_CANCEL.has(value)) return 'cancel';
  return null;
}

/** A última fala do atendente pediu exatamente SIM/NÃO para a ação pendente? */
export function naturalConfirmationAllowed(lastAssistantText) {
  const text = String(lastAssistantText || '');
  if (text.includes(CONFIRMATION_HINT)) return true;
  return /\b(?:responda\s+(?:\*?sim\*?|\*?n[aã]o\*?)|para\s+confirmar|confere\s+(?:a[ií]|pra\s+mim)|posso\s+confirmar|vamos\s+agendar|posso\s+deixar\s+marcado|deseja\s+confirmar|quer\s+confirmar|fechado\?|tudo\s+certo\?)\b/i.test(text);
}

/**
 * Decisão final: palavra explícita sempre; resposta natural só logo após o pedido de confirmação.
 */
export function resolveConfirmation(text, { actionType = '', lastAssistantText = '' } = {}) {
  const strict = strictConfirmIntent(text, { actionType });
  if (strict) return strict;
  if (afterPendingReminder(lastAssistantText) && REMINDER_YES.has(normalize(text).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim())) return 'confirm';
  if (!naturalConfirmationAllowed(lastAssistantText)) return null;
  return confirmIntent(text, { actionType });
}

// Lembrete de confirmação anexado a outra resposta (ver withPendingReminder). Um "sim"
// curto logo depois confirma, desde que a parte de cima NÃO tenha feito outra pergunta;
// "quero" fica de fora (costuma responder a oferta, não ao resumo).
export const PENDING_REMINDER_HINT = 'Para fechar, responda CONFIRMAR; para desistir, DESISTIR.';
const REMINDER_YES = new Set(['sim', 's', 'ss', 'pode', 'pode sim', 'sim pode', 'ok', 'okay', 'beleza', 'blz', 'fechado', 'fechou', 'confirma', 'pode confirmar', 'sim confirma', 'sim pode confirmar', 'pode fechar', 'sim pode fechar']);
export function afterPendingReminder(lastAssistantText) {
  const text = String(lastAssistantText || '');
  const at = text.indexOf(PENDING_REMINDER_HINT);
  if (at < 0) return false;
  const top = text.slice(0, text.lastIndexOf('\n\nAh,', at) >= 0 ? text.lastIndexOf('\n\nAh,', at) : at);
  return !top.includes('?');
}

// ============================================================================
// Prazo da ação pendente e formatação para o WhatsApp
// ============================================================================

/** Minutos que um resumo preparado continua confirmável (antes eram 30 fixos). */
export function actionTtlMinutes() {
  const value = Number.parseInt(process.env.WHATSAPP_AI_ACTION_TTL_MIN || '120', 10);
  return Math.min(24 * 60, Math.max(15, Number.isFinite(value) ? value : 120));
}

/**
 * Resumo de vários serviços em linhas, fácil de ler no celular:
 * "hoje, segunda 05/10 às 17:00 para Rafael: Corte com Dino às 17:00 + Barba às 17:30, total R$ 85,00"
 * → "hoje, segunda 05/10 às 17:00 para Rafael:\n• Corte com Dino às 17:00\n• Barba às 17:30\nTotal: R$ 85,00"
 */
export function formatActionSummary(summary) {
  const text = String(summary ?? '').trim().replace(/\.$/, '');
  if (!text.includes(' + ')) return text;
  const colon = text.indexOf(': ');
  if (colon < 0) return text;
  const head = text.slice(0, colon + 1);
  let body = text.slice(colon + 2);
  let total = '';
  const totalMatch = body.match(/,\s*total\s+(R\$\s*[\d.,]+)\s*$/i);
  if (totalMatch) {
    total = `\nTotal: ${totalMatch[1]}`;
    body = body.slice(0, totalMatch.index);
  }
  return `${head}\n${body.split(' + ').map((item) => `• ${item.trim()}`).join('\n')}${total}`;
}

/**
 * O modelo escreve Markdown (**negrito**, listas com "*", títulos "#"); no WhatsApp isso
 * aparece cru ("**SIM*"). Converte para a formatação do WhatsApp e tira o que sobra.
 */
export function formatForWhatsapp(text) {
  let out = String(text ?? '').replace(/\r\n/g, '\n');
  out = out.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, '*$1*');                 // títulos → negrito
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2');  // [texto](link)
  out = out.replace(/__([^_\n]+?)__/g, '_$1_');                            // __x__ → _x_
  out = out.replace(/\*{2,}/g, '*');                                        // ** → *
  out = out.replace(/(^|\n)\s*[*\-•]\s+/g, '$1• ');                       // marcador no início da linha
  out = out.replace(/[ \t]\*[ \t]{2,}/g, '\n• ');                          // marcador no meio ("  *   10:00")
  // Negrito válido = *texto* colado; qualquer outro asterisco é sobra do Markdown.
  const kept = [];
  out = out.replace(/\*(\S(?:[^*\n]*?\S)?)\*/g, (_, inner) => { kept.push(inner); return `\u0001${kept.length - 1}\u0002`; });
  out = out.replace(/\*/g, '');
  out = out.replace(/\u0001(\d+)\u0002/g, (_, i) => `*${kept[Number(i)]}*`);
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return out.trim();
}
// Nome genérico ("Cliente", "Contato", só números) não é nome de pessoa.
const GENERIC_NAMES = new Set(['cliente', 'clientes', 'contato', 'contact', 'customer', 'client', 'usuario', 'usuário', 'user', 'whatsapp', 'sem nome', 'desconhecido', 'nome', 'teste', 'eu', 'mim', 'eng', 'eng civil', 'engenheiro', 'engenheira', 'adv', 'advogado', 'advogada', 'dr', 'dra', 'doutor', 'doutora', 'lead']);
export function isGenericCustomerName(value) {
  const name = String(value ?? '').normalize('NFC').trim().toLowerCase().replace(/[.\-_~*]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name || name.length < 2) return true;
  if (!/\p{L}/u.test(name)) return true;
  return GENERIC_NAMES.has(name) || /^(?:cliente|contato|lead|user)\b/i.test(name) || /^(?:eng|adv|dr|dra)\b/i.test(name);
}

/**
 * Recusa no começo da frase seguida de outro assunto ("NÃO, era só teste. Quero ver os
 * perfumes"). Não vale quando o resto ajusta a mesma ação (dia, hora, profissional, serviço):
 * "não, prefiro às 15h" ou "não, com o Bruno" continuam com o modelo.
 */
const RECUSA_INICIO = /^(?:(?:eu\s+)?nao|n|negativo|(?:eu\s+)?nao\s+quero|nao\s+precisa|desisto|esquece|deixa|cancela|cancelar)\b[\s,.!;:-]+(.+)$/;
const AJUSTE_DA_ACAO = /\b(?:\d{1,2}\s*(?:h|:|horas?)|as \d|prefiro|outro (?:dia|horario|barbeiro|profissional)|outra (?:hora|data)|troca|muda|mudar|em vez|ao inves|amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo|manha|tarde|noite|com o |com a |dia \d|\d{1,2}\/\d{1,2})/;
export function declineWithNewRequest(text, pendingSummary = '') {
  const value = normalize(text).replace(/\s+/g, ' ').trim();
  const summaryNorm = normalize(pendingSummary);
  // Se a ação pendente era Dermaplaning/Estética e o cliente pede Corte/Barba (ou rejeita Dermaplaning), limpa a ação pendente na hora
  if (summaryNorm.includes('dermaplaning') && /\b(dermaplaning|corte|cortar|cabelo|barba)\b/.test(value) && !/\bconfirm/i.test(value)) {
    return true;
  }
  if (/^(?:eu\s+)?nao\s+quero\b/.test(value) || /^nao\s+dermaplaning\b/.test(value)) {
    return true;
  }
  const match = value.match(RECUSA_INICIO);
  if (!match) return false;
  const resto = match[1].trim();
  if (resto.length < 4) return false;
  return !AJUSTE_DA_ACAO.test(resto);
}
