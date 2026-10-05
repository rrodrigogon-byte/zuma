// ============================================================================
// ESTILO DE MENSAGEM DA PERSONA — aplicado em código, não só pedido no prompt.
//
// 1) styleModelText: limpa o texto do modelo (markdown, listas, frases de robô)
//    e o deixa em no máximo N mensagens curtas, separadas por linha em branco.
// 2) splitBubbles: no envio, quebra o conteúdo salvo em bolhas do WhatsApp.
//
// O conteúdo salvo no banco continua sendo o texto inteiro: as travas que
// procuram marcadores no último texto do atendente (dica de confirmação,
// pergunta de personalização) seguem funcionando. A divisão é determinística,
// então o reenvio da mesma tarefa produz as mesmas bolhas.
// ============================================================================

export const BANNED_PHRASES = [
  /\bcomo posso (te |lhe )?ajud[aá]-?(lo|la)\b[^.!?]*[.!?]?/gi,
  /\bfico (a|à) (sua )?disposi[cç][aã]o\b[^.!?]*[.!?]?/gi,
  /\bestou (a|à) (sua )?disposi[cç][aã]o\b[^.!?]*[.!?]?/gi,
  /\bagradecemos (o|seu) contato\b[^.!?]*[.!?]?/gi,
  /\bprezad[oa]\s*(\(a\))?\s*(cliente)?\s*,?/gi,
  /\bqualquer d[uú]vida,? (estou|fico) (a|à) disposi[cç][aã]o\b[^.!?]*[.!?]?/gi,
];

function collapse(text) {
  return String(text ?? '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function capitalize(text) {
  return text.replace(/^(\s*[^\p{L}]*)(\p{Ll})/u, (_, pre, letter) => `${pre}${letter.toUpperCase()}`);
}

function joinOptions(items, conj = 'ou') {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;
}

/** "12:00" → "12h", "09:30" → "9h30" (horário falado). */
export function spokenTimes(text) {
  return String(text ?? '').replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!:)/g, (_, h, m) => `${Number(h)}h${m === '00' ? '' : m}`);
}

/** "R$ 45,00" → "R$ 45" (centavos zerados não são falados). */
export function spokenMoney(text) {
  return String(text ?? '').replace(/R\$\s?(\d{1,3}(?:\.\d{3})*),00\b/g, 'R$ $1');
}

/**
 * Enumeração na mesma linha ("1) terça 06/10 às 12h; 2) terça 06/10 às 12h30")
 * vira frase, com o prefixo comum dito uma vez só ("terça 06/10 às 12h ou 12h30").
 */
export function inlineEnumeration(text) {
  return String(text ?? '').replace(/(?:^|\s)1\)\s*([^;]+?)(?:;\s*\d\)\s*[^;]+?)+(?=[.?!]|$)/g, (match) => {
    const items = match.trim().split(/;\s*/).map((part) => part.replace(/^\d\)\s*/, '').trim()).filter(Boolean);
    if (items.length < 2) return match;
    const sep = items[0].lastIndexOf(' às ');
    const prefix = sep > 0 ? items[0].slice(0, sep + 4) : '';
    if (prefix && items.every((item) => item.startsWith(prefix))) {
      return ` ${prefix}${joinOptions(items.map((item) => item.slice(prefix.length)))}`;
    }
    return ` ${joinOptions(items)}`;
  });
}

/** Linhas curtas sem pontuação final, uma embaixo da outra, viram uma frase. */
function bareLinesToSentence(lines) {
  const out = [];
  let bloco = [];
  const flush = () => {
    if (bloco.length >= 2) out.push(`${joinOptions(bloco.map((l) => l.replace(/:\s+/, ' ')), 'e')}.`);
    else out.push(...bloco);
    bloco = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (t && t.length <= 70 && !/[.!?…:]$/.test(t)) { bloco.push(t); continue; }
    flush();
    out.push(line);
  }
  flush();
  return out;
}

/** Remove markdown e converte listas em frase ("10h30, 14h ou 17h"). */
export function stripMarkdown(text) {
  const lines = String(text ?? '').split('\n').map((line) => line.replace(/^\s*#{1,6}\s+(.+?)\s*:?\s*$/, '$1:'));
  const out = [];
  let lista = [];
  const flush = () => {
    if (!lista.length) return;
    const prefix = out.length && out[out.length - 1].trim().endsWith(':') ? out.pop().trim().replace(/:$/, '') : '';
    const frase = joinOptions(lista.map((item) => item.replace(/[.;]+$/, '')));
    out.push(prefix ? `${prefix}: ${frase}.` : `${capitalize(frase)}.`);
    lista = [];
  };
  for (const raw of lines) {
    const item = raw.match(/^\s*(?:[-*•▪◦]|\d{1,2}[.)])\s+(.+)$/);
    if (item) { lista.push(item[1].trim()); continue; }
    flush();
    out.push(raw);
  }
  flush();
  return bareLinesToSentence(out).join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

/** Tira frases de robô. Se sobrar nada, devolve o original. */
export function removeBannedPhrases(text) {
  let value = String(text ?? '');
  for (const pattern of BANNED_PHRASES) value = value.replace(pattern, ' ');
  value = value.replace(/\binfelizmente,?\s*/gi, '');
  value = collapse(value.split('\n').map((line) => capitalize(line.trim())).join('\n'));
  return value || collapse(text);
}

export function sentences(text) {
  const value = collapse(text).replace(/\n+/g, ' ');
  if (!value) return [];
  return value.match(/[^.!?…]+(?:[.!?…]+["')\]]*|$)/g).map((part) => part.trim()).filter(Boolean);
}

/** Quebra uma frase longa em pedaços de até `max`, em vírgula, "ou", "e" ou espaço. */
function splitLongSentence(sentence, max) {
  if (sentence.length <= max) return [sentence];
  const parts = [];
  let rest = sentence;
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    let cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf('; '));
    if (cut < max * 0.4) cut = Math.max(slice.lastIndexOf(' ou '), slice.lastIndexOf(' e '));
    if (cut < max * 0.4) cut = slice.lastIndexOf(' ');
    while (cut > 0 && /R\$$/.test(rest.slice(0, cut))) cut = rest.slice(0, cut - 2).lastIndexOf(' ');
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut + (rest[cut] === ',' || rest[cut] === ';' ? 1 : 0)).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Agrupa frases em bolhas de até `max` caracteres. Bolhas excedentes são
 * juntadas na última (melhor uma bolha mais longa do que uma terceira).
 */
export function packBubbles(text, { max = 120, maxBubbles = 2 } = {}) {
  const pieces = sentences(text).flatMap((s) => splitLongSentence(s, max));
  const bubbles = [];
  for (const piece of pieces) {
    const last = bubbles[bubbles.length - 1];
    if (last && `${last} ${piece}`.length <= max) bubbles[bubbles.length - 1] = `${last} ${piece}`;
    else bubbles.push(piece);
  }
  if (bubbles.length > maxBubbles) {
    const head = bubbles.slice(0, maxBubbles - 1);
    head.push(bubbles.slice(maxBubbles - 1).join(' '));
    return head;
  }
  return bubbles;
}

/**
 * Texto do modelo na voz da persona: sem markdown, sem frase de robô, em até
 * `maxBubbles` mensagens curtas separadas por linha em branco.
 */
export function styleModelText(text, { max = 120, maxBubbles = 2, dropSelfIntro = false } = {}) {
  let limpo = removeBannedPhrases(spokenMoney(spokenTimes(inlineEnumeration(stripMarkdown(text)))));
  if (dropSelfIntro) limpo = removeSelfIntro(limpo);
  return packBubbles(limpo, { max, maxBubbles }).join('\n\n');
}

/**
 * Tira "Sou a assistente virtual da X." quando a apresentação da persona já foi
 * feita pelo sistema. Só é usado quando o cliente NÃO perguntou se é robô:
 * pergunta direta sempre recebe a verdade.
 */
export function removeSelfIntro(text) {
  const value = String(text ?? '').replace(/(^|[.!?]\s+)(?:eu\s+)?sou\s+(?:a|o|uma|um)\s+(?:sua\s+)?(?:assistente|atendente)\s+(?:virtual|digital)\b[^.!?]*[.!?]\s*/gi, '$1');
  return collapse(value) || collapse(text);
}

/**
 * Bolhas de envio a partir do conteúdo salvo: cada parágrafo (separado por
 * linha em branco) vira ao menos uma bolha; parágrafos longos (o resumo exato
 * de uma ação, por exemplo) são quebrados em frases, sem perder texto.
 */
export function splitBubbles(content, { max = 120, hardMax = 4 } = {}) {
  const paragraphs = String(content ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const bubbles = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= max * 1.6 || paragraph.includes('\n')) { bubbles.push(paragraph); continue; }
    bubbles.push(...packBubbles(paragraph, { max: Math.round(max * 1.6), maxBubbles: 3 }));
  }
  if (bubbles.length > hardMax) {
    const head = bubbles.slice(0, hardMax - 1);
    head.push(bubbles.slice(hardMax - 1).join('\n\n'));
    return head;
  }
  return bubbles.length ? bubbles : [String(content ?? '').trim()].filter(Boolean);
}

/** Pausa entre bolhas, proporcional ao tamanho (simula digitação). */
export function bubbleDelayMs(text, env = process.env) {
  const base = Number.parseInt(env.WHATSAPP_AI_BUBBLE_DELAY_MS ?? '1200', 10);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.min(3500, Math.max(base, Math.round(String(text || '').length * 18)));
}

/** Indicadores de estilo de uma resposta (painel e testes). */
export function styleReport(content, { max = 120 } = {}) {
  const bubbles = splitBubbles(content, { max });
  const banned = BANNED_PHRASES.some((pattern) => { pattern.lastIndex = 0; return pattern.test(content); });
  return {
    bubbles: bubbles.length,
    longest: Math.max(0, ...bubbles.map((b) => b.length)),
    markdown: /\*\*|^\s*[-*•]\s|^#{1,6}\s/m.test(String(content || '')),
    banned,
  };
}
