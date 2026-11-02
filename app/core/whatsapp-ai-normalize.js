// Normalização do que o modelo manda para as ferramentas da agenda e da loja.
//
// O modelo escreve horário e data do jeito que o cliente falou ("11h", "11h00",
// "às 11", "sexta", "14/10"). A agenda lista horários como "11:00" e datas como
// "2026-10-14". Sem normalizar, "11h" não batia com "11:00" e o atendente dizia que o
// horário "acabou de ser preenchido" logo depois de oferecê-lo (14/10 e 16/10).

const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function plain(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/** "11h", "11h00", "11:00", "11.30", "1130", "às 11 horas", "11:30:00" → "11:00"/"11:30"; inválido → ''. */
export function normalizeAgendaTime(value) {
  let text = plain(value).replace(/^(as|a|para|pras?|umas?)\s+/, '').replace(/\s*(horas?|hrs?|hs)\b/, 'h').replace(/\s+/g, '')
  if (!text) return ''
  let match = text.match(/^(\d{1,2})[:h.](\d{2})(?::\d{2})?$/) || text.match(/^(\d{1,2})h$/) || text.match(/^(\d{1,2})$/)
  if (!match && /^\d{3,4}$/.test(text)) match = [text, text.slice(0, -2), text.slice(-2)]
  if (!match) return ''
  const hour = Number(match[1])
  const minute = match[2] === undefined ? 0 : Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return ''
  return `${pad(hour)}:${pad(minute)}`
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * "2026-10-14", "14/10", "14/10/2026", "14-10", "hoje", "amanhã", "depois de amanhã",
 * "sexta", "sexta-feira", "sábado" → "AAAA-MM-DD" (dia da semana = a próxima ocorrência,
 * contando hoje). `today` é a data local da unidade em "AAAA-MM-DD". Inválido → ''.
 */
export function normalizeAgendaDate(value, today) {
  const text = plain(value).replace(/\s+/g, ' ')
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return ''
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) return validIso(match[1], match[2], match[3])
  match = text.match(/^(?:dia\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
  if (match) {
    const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : Number(today.slice(0, 4))
    let iso = validIso(year, match[2], match[1])
    // Sem ano e a data já passou: é a do ano que vem (ex.: "05/01" dito em dezembro).
    if (iso && !match[3] && iso < today) iso = validIso(year + 1, match[2], match[1])
    return iso
  }
  if (text === 'hoje') return today
  if (text === 'amanha') return addDays(today, 1)
  if (text === 'depois de amanha') return addDays(today, 2)
  const weekday = WEEKDAYS.findIndex((day) => text === day || text === `${day}-feira` || text === `${day} feira` || text === `na ${day}` || text === `na ${day}-feira`)
  if (weekday >= 0) {
    const current = new Date(`${today}T12:00:00Z`).getUTCDay()
    return addDays(today, (weekday - current + 7) % 7)
  }
  return ''
}

function validIso(year, month, day) {
  const y = Number(year); const m = Number(month); const d = Number(day)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return ''
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return ''
  return `${y}-${pad(m)}-${pad(d)}`
}

/** O horário pedido como aparece na lista da agenda ("11h" casa com "11:00"); senão ''. */
export function matchAgendaSlot(value, slots = []) {
  const wanted = normalizeAgendaTime(value)
  if (!wanted) return ''
  return (Array.isArray(slots) ? slots : []).find((slot) => normalizeAgendaTime(slot) === wanted) || ''
}

/**
 * "Corte e barba com Dino" + "Dino" → "Corte e barba com Dino" (sem repetir "com Dino").
 * Serviço sem o nome do profissional → "Corte com Nati".
 */
export function serviceWithProfessional(serviceName, professionalName) {
  const service = String(serviceName ?? '').trim()
  const professional = String(professionalName ?? '').trim()
  if (!professional || plain(professional) === 'qualquer') return service
  const first = plain(professional).split(' ')[0]
  if (first && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(plain(service))) return service
  return `${service} com ${professional}`
}

/** Tira a repetição "com X com X" de um texto já montado (lembretes e resumos antigos). */
export function dedupeWithProfessional(text) {
  return String(text ?? '').replace(/\bcom ([\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*)?) com \1\b/giu, 'com $1')
}

// ── Preços: o atendente só pode citar valor que veio das ferramentas ──────────────
// Em 16/10 ofereceu "Dior Sauvage Elixir por R$ 1.150" sem consultar o catálogo e o
// pedido saiu por R$ 1.800. Esta checagem compara cada R$ da resposta com os números
// devolvidos pelas ferramentas na conversa.

/** "R$ 1.150", "R$1150", "R$ 3.600,00", "R$ 29,9" → centavos (inteiro). */
export function moneyMentions(text) {
  const found = []
  const pattern = /R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g
  let match
  while ((match = pattern.exec(String(text ?? '')))) {
    const reais = Number(match[1].replace(/\./g, ''))
    const centavos = match[2] ? Number(match[2].padEnd(2, '0')) : 0
    if (Number.isFinite(reais)) found.push(reais * 100 + centavos)
  }
  return found
}

/** Todos os valores numéricos (em centavos) que aparecem nos resultados das ferramentas. */
export function toolMoneyValues(toolOutputs) {
  const values = new Set()
  const visit = (value) => {
    if (value === null || value === undefined) return
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      values.add(Math.round(value * 100))
      if (Number.isInteger(value)) values.add(value) // valor já em centavos
      return
    }
    if (typeof value === 'string') {
      for (const cents of moneyMentions(value)) values.add(cents)
      const plainNumber = value.trim().match(/^\d+(?:[.,]\d{1,2})?$/)
      if (plainNumber) values.add(Math.round(Number(value.replace(',', '.')) * 100))
      return
    }
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(toolOutputs)
  return values
}

/** Valores em R$ da resposta que nenhuma ferramenta devolveu (lista vazia = tudo certo). */
export function unbackedPrices(replyText, toolOutputs) {
  const allowed = toolMoneyValues(toolOutputs)
  return moneyMentions(replyText).filter((cents) => !allowed.has(cents))
}

/**
 * Link de pagamento ou de carrinho gerado nesta resposta precisa chegar ao cliente.
 * Se o modelo escreveu "aqui está o link" sem colar o link, ele é anexado no fim.
 */
export function ensureToolLinks(text, toolLinks = []) {
  let out = String(text ?? '').trim()
  for (const url of Array.isArray(toolLinks) ? toolLinks : []) {
    const link = String(url || '').trim()
    if (!/^https:\/\/\S+$/i.test(link) || out.includes(link)) continue
    out = `${out}\n\n${link}`.trim()
  }
  return out
}

// ── Datas: o modelo não pode deduzir o dia da semana ─────────────────────────────
// 16/10 (sexta) ele escreveu "Amanhã, sexta-feira". O prompt não trazia a data de hoje.
const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const AGENDA_TIME_ZONE = 'America/Cuiaba'

function localParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: AGENDA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return { iso: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

function weekdayOf(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

function shortDate(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Bloco de calendário para o prompt: hoje, amanhã e os próximos dias com o dia da semana certo. */
export function agendaCalendarText(now = new Date(), days = 14) {
  const { iso, time } = localParts(now)
  const lista = []
  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(iso, offset)
    const rotulo = offset === 0 ? 'hoje' : offset === 1 ? 'amanhã' : offset === 2 ? 'depois de amanhã' : ''
    lista.push(`${rotulo ? `${rotulo} = ` : ''}${NOMES_DIA[weekdayOf(day)]} ${shortDate(day)} (${day})`)
  }
  return `CALENDÁRIO (fuso de Cuiabá; use exatamente estas datas, nunca deduza o dia da semana): agora é ${NOMES_DIA[weekdayOf(iso)]}, ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}, ${time}. ${lista.join('; ')}. Nas ferramentas, mande a data como AAAA-MM-DD desta lista.`
}

const DIA_REGEX = '(domingo|segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado)'
const MES_REGEX = '(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)'

function sameStyle(original, nome) {
  // Mantém a forma escrita: "sexta" curto continua curto; maiúscula inicial preservada.
  const curto = !/-feira$/i.test(original) && /-feira$/.test(nome) ? nome.replace(/-feira$/, '') : nome
  return /^[A-ZÁ]/.test(original) ? curto.charAt(0).toUpperCase() + curto.slice(1) : curto
}

function isoFromDayMonth(day, month, todayIso) {
  const year = Number(todayIso.slice(0, 4))
  let iso = validIso(year, month, day)
  if (iso && iso < addDays(todayIso, -7)) iso = validIso(year + 1, month, day)
  return iso
}

/**
 * Corrige o dia da semana que não bate com a data na resposta do modelo:
 * "sexta, 17/10" → "sábado, 17/10"; "Amanhã, sexta-feira" (amanhã é sábado) → "Amanhã, sábado".
 * Devolve { text, fixes } — fixes lista o que foi trocado (para registro).
 */
export function fixWeekdayMistakes(text, now = new Date()) {
  const { iso: today } = localParts(now)
  const fixes = []
  let out = String(text ?? '')
  const fix = (match, weekdayWord, iso) => {
    if (!iso) return match
    const certo = NOMES_DIA[weekdayOf(iso)]
    if (plain(weekdayWord).replace(/-feira$/, '') === plain(certo).replace(/-feira$/, '')) return match
    const trocado = sameStyle(weekdayWord, certo)
    fixes.push(`${weekdayWord}→${trocado} (${iso})`)
    return match.replace(weekdayWord, trocado)
  }
  // "sexta, 17/10", "sexta-feira dia 17/10", "sábado (17/10)"
  out = out.replace(new RegExp(`\\b${DIA_REGEX}[\\s,(]+(?:dia\\s+)?(\\d{1,2})/(\\d{1,2})\\b`, 'giu'), (match, dia, d, m) => fix(match, dia, isoFromDayMonth(d, m, today)))
  // "sexta-feira, 17 de outubro"
  out = out.replace(new RegExp(`\\b${DIA_REGEX},?\\s+(?:dia\\s+)?(\\d{1,2})\\s+de\\s+${MES_REGEX}\\b`, 'giu'), (match, dia, d, mes) => fix(match, dia, isoFromDayMonth(d, MESES.findIndex((nome) => plain(nome) === plain(mes)) + 1, today)))
  // "amanhã, sexta" / "hoje (quinta)" / "depois de amanhã, domingo"
  out = out.replace(new RegExp(`\\b(hoje|amanh[ãa]|depois de amanh[ãa])[\\s,(-]+(?:é\\s+|que é\\s+)?${DIA_REGEX}\\b`, 'giu'), (match, rel, dia) => {
    const r = plain(rel)
    const iso = r === 'hoje' ? today : r === 'amanha' ? addDays(today, 1) : addDays(today, 2)
    return fix(match, dia, iso)
  })
  return { text: out, fixes }
}

// ── Nome gravado no sistema ──────────────────────────────────────────────────────
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', "d'"])

/**
 * "rodrigo goncalves" / "RODRIGO GONÇALVES" → "Rodrigo Goncalves" / "Rodrigo Gonçalves".
 * Nome já escrito com maiúsculas e minúsculas (ex.: "Ana McKenzie") fica como está.
 */
export function formatPersonName(value) {
  const name = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!name) return ''
  const misto = name !== name.toLowerCase() && name !== name.toUpperCase()
  if (misto) return name
  return name.toLowerCase().split(' ').map((word, index) => {
    if (index > 0 && PARTICULAS.has(word)) return word
    return word.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join('-')
  }).join(' ')
}

/**
 * Remove anotações internas, parênteses (ex.: "(dino)", "(novo)", "(Club Combo)")
 * e resíduos de data/hora ou vírgulas anexados por extração ("Juarez, amanhã...").
 * Retorna o nome formatado de forma limpa e humana.
 */
export function cleanCustomerDisplayName(rawName, { firstNameOnly = false } = {}) {
  let name = String(rawName ?? '').normalize('NFC').trim()
  if (!name) return ''
  name = name.replace(/\s*\([^)]*\)/g, ' ')
  name = name.split(/[,;\-—]/)[0]
  name = name.replace(/\b(novo|nova|lead\s+whatsapp\s*\d*|cliente\s+balc[aã]o|dino|barbearia)\b/gi, ' ')
  name = name.replace(/\b(hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|\d{1,2}\/\d{1,2}|\d{1,2}h|\d{1,2}:\d{2})\b/gi, ' ')
  name = name.replace(/\s+/g, ' ').trim()
  if (!name) return ''
  if (firstNameOnly) {
    const first = name.split(/\s+/)[0]
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''
  }
  return name.toLowerCase().split(' ').map((word, index) => {
    if (index > 0 && PARTICULAS.has(word)) return word
    return word.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join('-')
  }).join(' ')
}
