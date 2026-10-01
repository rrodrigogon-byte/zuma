// Identidade de telefone para WhatsApp. O WhatsApp entrega alguns celulares brasileiros
// sem o nono dígito (JID com 12 dígitos: 55 + DDD + 8). Comparar só o texto fazia um
// "SAIR" vindo de 556599990000 não achar o cliente salvo como 65 99999-0000.
// A chave de comparação é 55 + DDD + últimos 8 dígitos, igual para as duas formas.

function digitsOf(value) {
  return String(value ?? '').split('@')[0].replace(/\D/g, '').replace(/^0+/, '');
}

// Forma canônica para gravar: 55 + DDD + número; celular de 8 dígitos ganha o 9.
export function canonicalWhatsappPhone(value) {
  let digits = digitsOf(value);
  if (!(digits.startsWith('55') && digits.length >= 12)) digits = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55[1-9][0-9]\d{8,9}$/.test(digits)) return '';
  if (digits.length === 12 && /[6-9]/.test(digits[4])) digits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
  return digits;
}

export function phoneMatchKey(value) {
  const canonical = canonicalWhatsappPhone(value);
  return canonical ? `${canonical.slice(0, 4)}${canonical.slice(-8)}` : '';
}

// Mesma chave calculada no PostgreSQL a partir de uma coluna ou parâmetro de texto.
export function phoneMatchKeySql(expression) {
  const d = `regexp_replace(regexp_replace(COALESCE((${expression})::text, ''), '\\D', '', 'g'), '^0+', '')`;
  const n = `(CASE WHEN ${d} LIKE '55%' AND length(${d}) >= 12 THEN ${d} ELSE '55' || ${d} END)`;
  return `(CASE WHEN length(${n}) IN (12, 13) THEN substr(${n}, 1, 4) || right(${n}, 8) ELSE ${n} END)`;
}

// Forma canônica (com o nono dígito) calculada no PostgreSQL.
export function canonicalPhoneSql(expression) {
  const d = `regexp_replace(regexp_replace(COALESCE((${expression})::text, ''), '\\D', '', 'g'), '^0+', '')`;
  const n = `(CASE WHEN ${d} LIKE '55%' AND length(${d}) >= 12 THEN ${d} WHEN length(${d}) IN (10, 11) THEN '55' || ${d} ELSE ${d} END)`;
  return `(CASE WHEN length(${n}) = 12 AND substr(${n}, 5, 1) ~ '[6-9]' THEN substr(${n}, 1, 4) || '9' || substr(${n}, 5) ELSE ${n} END)`;
}

const OPT_OUT_PHRASES = new Set([
  'sair', 'pare', 'parar', 'stop', 'descadastrar', 'cancelar marketing',
  'nao quero receber', 'nao quero mais receber', 'nao quero mensagens', 'nao quero mais mensagens',
  'remover meu numero', 'remova meu numero', 'me tira da lista', 'me tire da lista',
  'sair da lista', 'quero sair da lista', 'descadastre', 'descadastrar meu numero', 'cancelar inscricao',
  'pare de mandar', 'pare de mandar mensagem', 'pare de mandar mensagens', 'para de mandar mensagem', 'para de mandar mensagens',
  'nao me mande mais mensagens', 'nao mande mais mensagens', 'nao quero promocoes', 'nao quero mais promocoes',
]);

export function normalizeOptOutText(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Lista única de pedidos de descadastro, usada pelo webhook, campanhas, carrinhos, agenda e IA.
export function isWhatsappOptOutText(text) {
  return OPT_OUT_PHRASES.has(normalizeOptOutText(text));
}

// Pedido expresso para receber promoções, dito pelo próprio cliente na mensagem atual.
// A IA não pode conceder consentimento de marketing sem uma destas frases.
// Precisa pedir para RECEBER promoção/oferta/novidade: "vi a promoção, pode agendar?",
// "tem desconto no pix?" ou "quero o cupom" não são consentimento de marketing.
const OPT_IN_SUBJECT = '(promocoes|promocao|promos|ofertas|novidades|descontos|marketing|campanhas)';
const OPT_IN_PATTERNS = [
  new RegExp(`\\b(quero|queria|gostaria de|pode|podem|aceito|autorizo|topo)( sim)? (receber|me mandar|mandar|me enviar|enviar|me avisar|avisar)\\b.*\\b${OPT_IN_SUBJECT}`),
  new RegExp(`\\b(me )?(manda|mande|envia|envie|avisa|avise|me mandem|me enviem)\\b.*\\b${OPT_IN_SUBJECT}`),
  new RegExp(`\\b(quero|aceito|autorizo) (entrar na|participar da) lista\\b`),
];
export function isWhatsappOptInText(text) {
  const value = normalizeOptOutText(text);
  if (!value || isWhatsappOptOutText(text) || /\bnao\b/.test(value)) return false;
  return OPT_IN_PATTERNS.some(pattern => pattern.test(value));
}
