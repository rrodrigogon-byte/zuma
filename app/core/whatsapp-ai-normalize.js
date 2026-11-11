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
  if (!value) return ''
  let str = plain(value)
  const isPmHint = /\b(da tarde|a tarde|de tarde|da noite|a noite|de noite)\b/i.test(str)
  // Remove menções explícitas de data no formato DD/MM, DD/MM/AAAA ou AAAA-MM-DD (ex: "12/11 as 17h")
  str = str.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
  str = str.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
  // Remove menções de dia e preposições que acompanham o horário (ex: "hoje as 18h45 hr", "amanhã às 16:15")
  str = str.replace(/\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/gi, ' ')
  str = str.replace(/\b(dia\s+\d{1,2}(?:\/\d{1,2})?)\b/gi, ' ')
  str = str.replace(/\b(as|a|para|pras?|umas?|de|pelas?|por volta d[ae]s?|por volta de)\b/gi, ' ')
  str = str.replace(/\b(da tarde|a tarde|de tarde|da noite|a noite|de noite|da manha|da madrugada)\b/gi, ' ')
  // Converte "14 e meia" / "14h e meia" / "2 e meia" -> "14:30" / "2:30"
  str = str.replace(/\b(\d{1,2})\s*h?\s+e\s+meia\b/gi, '$1:30')
  // Converte "14 e 15" / "quero as 14 e 15" / "14h e 45" -> "14:15" / "14:45"
  str = str.replace(/\b(\d{1,2})\s*h?\s+e\s+(\d{1,2})\b/gi, '$1:$2')
  str = str.replace(/\s*(horas?|hrs?|hs?|minutos?|mins?|m)\b/gi, ' ')
  str = str.replace(/[?!;()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!str) return ''
  const adjustPm = (h) => (isPmHint && h >= 1 && h <= 11 ? h + 12 : h)
  // Casa 18:45, 18h45, 18.45, 18,45, 18-45 ou 18 45
  let match = str.match(/\b(\d{1,2})\s*[:h.,\-\s]\s*(\d{2})(?::\d{2})?\b/)
  if (match) {
    const hour = adjustPm(Number(match[1]))
    const minute = Number(match[2])
    if (Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${pad(hour)}:${pad(minute)}`
    }
    return ''
  }
  // Casa 4 dígitos juntos como "1845"
  match = str.match(/\b(\d{2})(\d{2})\b/)
  if (match) {
    const hour = adjustPm(Number(match[1]))
    const minute = Number(match[2])
    if (Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${pad(hour)}:${pad(minute)}`
    }
  }
  // Casa hora cheia (ex: "18h", "18")
  match = str.match(/\b(\d{1,2})\s*h?\b/)
  if (match) {
    const hour = adjustPm(Number(match[1]))
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      return `${pad(hour)}:00`
    }
  }
  return ''
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
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return ''
  let text = plain(value).replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  let match = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (match) return validIso(match[1], match[2], match[3])
  match = text.match(/\b(?:dia\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (match) {
    const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : Number(today.slice(0, 4))
    let iso = validIso(year, match[2], match[1])
    // Sem ano e a data já passou: é a do ano que vem (ex.: "05/01" dito em dezembro).
    if (iso && !match[3] && iso < today) iso = validIso(year + 1, match[2], match[1])
    return iso
  }
  const semPrep = text.replace(/^(?:para\s+|pra\s+|pro\s+|na\s+|no\s+|em\s+|de\s+|nesta\s+|neste\s+|proxima\s+|proximo\s+)+/, '').trim()
  if (semPrep === 'hoje' || text === 'hoje') return today
  if (semPrep === 'amanha' || text === 'amanha') return addDays(today, 1)
  if (semPrep === 'depois de amanha' || text === 'depois de amanha') return addDays(today, 2)
  const weekday = WEEKDAYS.findIndex((day) =>
    semPrep === day || semPrep === `${day}-feira` || semPrep === `${day} feira` ||
    text === day || text === `${day}-feira` || text === `${day} feira` || text === `na ${day}` || text === `na ${day}-feira` ||
    semPrep.startsWith(`${day} `) || semPrep.startsWith(`${day}-feira`)
  )
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
  const list = Array.isArray(slots) ? slots : []
  const direct = list.find((slot) => normalizeAgendaTime(slot) === wanted)
  if (direct) return direct
  // Se o cliente disse "2:15" ou "3h" sem "da tarde" e a agenda tem "14:15" / "15:00"
  const [hStr, mStr] = wanted.split(':')
  const h = Number(hStr)
  if (h >= 1 && h <= 6) {
    const pmWanted = `${pad(h + 12)}:${mStr}`
    const pmMatch = list.find((slot) => normalizeAgendaTime(slot) === pmWanted)
    if (pmMatch) return pmMatch
  }
  return ''
}

/**
 * "Corte e barba com Dino" + "Dino" → "Corte e barba com Dino" (sem repetir "com Dino").
 * Serviço sem o nome do profissional → "Corte com Nati".
 */
export function serviceWithProfessional(serviceName, professionalName) {
  const service = String(serviceName ?? '').trim()
  const professional = String(professionalName ?? '').trim()
  if (!professional || plain(professional) === 'qualquer') return service
  // Se o servico traz "(BRUNO OU NATI)" entre parenteses e o cliente escolheu um barbeiro unico (ex: Bruno),
  // remove o parentese ambiguo e explicita o barbeiro escolhido ("CORTE PREMIUM com Bruno")
  if (/\([^)]*\bou\b[^)]*\)/i.test(service) && !/\bou\b/i.test(professional)) {
    const limpo = service.replace(/\s*\([^)]*\bou\b[^)]*\)/gi, '').replace(/\s+/g, ' ').trim()
    const firstLimpo = plain(professional).split(' ')[0]
    if (firstLimpo && new RegExp(`\\b${firstLimpo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(plain(limpo))) return limpo
    return `${limpo} com ${professional}`
  }
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
  // Trata prefixos legados de importação como "Cliente Avec — Evertom Kloppel" ou "Cliente Avec - ..."
  if (/^cliente\s+avec\s*[-—]/i.test(name)) {
    const aposTraco = name.replace(/^cliente\s+avec\s*[-—]\s*/i, '').trim()
    if (aposTraco && !/^(?:cel|tel|fone|\d)/i.test(aposTraco)) {
      name = aposTraco
    } else {
      name = ''
    }
  }
  name = name.replace(/\b(cliente\s+avec|avec)\b/gi, ' ')
  name = name.replace(/\s*\([^)]*\)/g, ' ')
  name = name.split(/[,;\-—]/)[0]
  name = name.replace(/\b(novo|nova|lead\s+whatsapp\s*\d*|lead\b|cliente\s+balc[aã]o|dino|barbearia|eng\b|eng\.\b|civil\b|engenheiro\b|engenheira\b|adv\b|advogado\b|advogada\b)\b/gi, ' ')
  name = name.replace(/\b(hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|\d{1,2}\/\d{1,2}|\d{1,2}h|\d{1,2}:\d{2})\b/gi, ' ')
  name = name.replace(/\s+/g, ' ').trim()
  if (!name || /^(cliente|amigo|usuario|lead|contato)$/i.test(name)) return ''
  if (firstNameOnly) {
    const first = name.split(/\s+/)[0]
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''
  }
  return name.toLowerCase().split(' ').map((word, index) => {
    if (index > 0 && PARTICULAS.has(word)) return word
    return word.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join('-')
  }).join(' ')
}
