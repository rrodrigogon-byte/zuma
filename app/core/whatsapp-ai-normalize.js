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


export const AGENDA_PUBLICA_DINO_BASE = 'https://kytto.com.br/agendar/dino'

/**
 * Retorna o link direto da agenda pública online (geral ou exclusiva do profissional).
 */
export function obterLinkAgendaDino({ professionalIdOrName = '', date = '', serviceIdOrName = '' } = {}) {
  const p = String(professionalIdOrName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  let slugProf = ''
  if (p && p !== 'qualquer' && !p.includes(' ou ')) {
    if (/\b(dino|guilherme|prof-mtj67o7r-001)\b/.test(p)) slugProf = 'dino'
    else if (/\b(bruno|mendes|prof-mtj69hhx-002)\b/.test(p)) slugProf = 'bruno'
    else if (/\b(nati|natani|naty|dobler|prof-mv1bx3sc-011)\b/.test(p)) slugProf = 'nati'
    else if (/\b(ester|steffany|prof-mv1a1o0o-010)\b/.test(p)) slugProf = 'ester'
  }
  const base = slugProf ? `${AGENDA_PUBLICA_DINO_BASE}/${slugProf}` : AGENDA_PUBLICA_DINO_BASE
  const params = []
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date || '').trim())) {
    params.push(`data=${encodeURIComponent(String(date).trim())}`)
  }
  if (serviceIdOrName && String(serviceIdOrName).trim().length <= 40) {
    params.push(`servico=${encodeURIComponent(String(serviceIdOrName).trim())}`)
  }
  return params.length ? `${base}?${params.join('&')}` : base
}

/**
 * Detecta se a mensagem do cliente pede o app, aplicativo, ou algo/link para agendamento online.
 */
export function detectAppOrSelfBookingRequest(userText) {
  const raw = String(userText || '').trim();
  if (!raw || raw.length > 160) return null;
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Não intercepta se for cancelamento, confirmação simples, reclamação ou pedido de humano
  if (/\b(cancelar|desmarcar|remarcar|humano|atendente|pessoa|confirmar|confirmo|sim|nao|não)\b/.test(norm)) {
    return null;
  }

  const pedeApp = /\b(app|aplicativo|apk)\b/.test(norm) && !/\b(whatsapp|zap)\b/.test(norm.replace(/\b(app\s+do\s+whatsapp|app\s+whatsapp)\b/g, ''));
  const pedeLinkOuSite = /\b(link|site|pagina|página|linkzinho)\b/.test(norm) && /\b(agendar|agendamento|agenda|marcar|corte|barba|horario|horário|vaga)\b/.test(norm);
  const pedeAlgoAgendamento = /\balgo\s+(para|pra|de)\s+agendamento\b/.test(norm) || /\balgo\s+(para|pra)\s+agendar\b/.test(norm);
  const pedeAgendamentoOnline = /\b(agendar|agendamento|marcar)\b.*\b(online|sozinho|direto|pelo site|pelo app|pelo link)\b/.test(norm)
    || /\b(tem|passa|manda|qual|onde)\b.*\b(link|site|app|aplicativo)\b/.test(norm)
    || /\b(como\s+(faco|faço|posso)\s+(pra|para)\s+agendar\s+(online|pelo\s+(app|link|site)))\b/.test(norm);

  if (!pedeApp && !pedeLinkOuSite && !pedeAlgoAgendamento && !pedeAgendamentoOnline) {
    return null;
  }

  let professional = null;
  let slug = '';
  if (/\b(bruno|mendes)\b/.test(norm)) {
    professional = 'Bruno';
    slug = 'bruno';
  } else if (/\b(nati|natani|naty|dobler|natalia|natali|nathalia)\b/.test(norm)) {
    professional = 'Nati';
    slug = 'nati';
  } else if (/\bdino\b/.test(norm) && !/barbearia dino|t-rex da dino|trex da dino/.test(norm)) {
    professional = 'Dino';
    slug = 'dino';
  }

  const link = slug ? `${AGENDA_PUBLICA_DINO_BASE}/${slug}` : AGENDA_PUBLICA_DINO_BASE;
  return {
    isRequest: true,
    professional,
    link,
  };
}

/**
 * Gera a resposta padrão educada e direta enviando o link do app e pedindo o profissional.
 */
export function buildAppAndBookingPromptReply({ professional = null, link = AGENDA_PUBLICA_DINO_BASE } = {}) {
  if (professional) {
    return `Você pode acessar nosso app e agendar direto com o(a) ${professional} pelo link:\n${link} 💈\n\nQual dia e horário você prefere? Se preferir, pode me dizer por aqui mesmo que já consulto a agenda e deixo marcado pra você na hora!`;
  }
  return `Você pode acessar nosso app do cliente e agendamento online pelo link:\n${link} 💈\n\nCom qual profissional você gostaria de agendar seu atendimento (Dino, Bruno ou Nati)? Me conta por aqui que também já posso ver os melhores horários e deixar marcado pra você agora mesmo!`;
}

/**
 * Garante que respostas sobre horários/agendamento tragam a opção do link direto da agenda
 * para o próprio cliente visualizar os horários do profissional e agendar sozinho se preferir.
 */
export function withSelfBookingAgendaOption(replyText, { userText = '', toolResults = [], isBarbershop = true, hasPendingAction = false } = {}) {
  const base = String(replyText || '').trim()
  if (!base || !isBarbershop || hasPendingAction) return base

  const appReq = detectAppOrSelfBookingRequest(userText)
  if (appReq?.isRequest) {
    const link = appReq.link || AGENDA_PUBLICA_DINO_BASE
    let textoFinal = base
    if (!/https?:\/\/[^\s]*\/agendar\//i.test(textoFinal)) {
      textoFinal = `${textoFinal}\n📱 App do cliente e agendamento online: ${link}`
    }
    const cleanWithoutUrls = textoFinal.replace(/https?:\/\/\S+/gi, '')
    if (!appReq.professional && !/\b(dino|bruno|nati)\b/i.test(cleanWithoutUrls)) {
      textoFinal = `${textoFinal}\n💈 Com qual profissional você prefere agendar seu atendimento (Dino, Bruno ou Nati)?`
    }
    return textoFinal
  }

  if (/https?:\/\/[^\s]*\/agendar\//i.test(base)) return base
  if (/c[oó]digo.*confirmad|agendamento confirmado|cancelamento confirmado|remarca[cç][aã]o confirmada|responda\s+\*?sim\*?/i.test(base)) {
    return base
  }

  const combined = `${userText} ${base}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const temToolAgenda = Array.isArray(toolResults) && toolResults.some((r) => r && (Array.isArray(r.horariosDisponiveis) || Array.isArray(r.opcoes) || r.linkAgenda))
  const falaDeAgenda = temToolAgenda || /\b(agendar|agenda|horario|horarios|vaga|vagas|corte|cortar|barba|disponibilidade|marcar|manha|tarde|noite|amanha|hoje)\b/.test(combined)
  if (!falaDeAgenda) return base

  const mencoes = []
  if (/\b(bruno|mendes)\b/.test(combined)) mencoes.push({ nome: 'do Bruno', slug: 'bruno' })
  if (/\b(nati|natani|naty|natalia|natali|nathalia)\b/.test(combined)) mencoes.push({ nome: 'da Nati', slug: 'nati' })
  if (/\b(dino|guilherme)\b/.test(combined) && !/barbearia dino|trex da dino|t-rex da dino/.test(combined)) {
    mencoes.push({ nome: 'do Dino', slug: 'dino' })
  }
  if (/\b(ester|steffany)\b/.test(combined)) mencoes.push({ nome: 'da Ester', slug: 'ester' })

  const unico = mencoes.length === 1 ? mencoes[0] : null
  const link = unico ? `${AGENDA_PUBLICA_DINO_BASE}/${unico.slug}` : AGENDA_PUBLICA_DINO_BASE
  const rotulo = unico ? `ver a agenda ${unico.nome} e agendar direto` : 'ver a agenda completa e agendar direto'

  let textoFinal = base
  if (!textoFinal.includes('?')) {
    textoFinal = `${textoFinal} Qual dia e horário fica melhor pra você?`
  }
  return `${textoFinal}\n📅 Se preferir ${rotulo}: ${link}`
}

/**
 * Detecta de forma determinística (em < 1ms) quando o cliente escolheu um horário que
 * acabou de ser oferecido pelo T-Rex (ex.: "Quero as 14 e 15", "14:15", "pode ser às 14h30").
 */
export function extractFastScheduleChoice(userText, lastAssistantText, { now = new Date() } = {}) {
  const rawUser = String(userText || '').trim()
  const rawAssistant = String(lastAssistantText || '').trim()
  if (!rawUser || !rawAssistant || rawUser.length > 80 || rawUser.includes('?')) return null
  if (/\b(cancelar|desmarcar|remarcar|nao|não|outro dia|outra data)\b/i.test(rawUser)) return null

  let slot = normalizeAgendaTime(rawUser)
  const userClean = rawUser.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  if (!slot) {
    const offeredMatches = [...rawAssistant.matchAll(/\b([01]?\d|2[0-3])(?:h(\d{2})?|:(\d{2}))\b/gi)]
      .map((m) => `${String(m[1]).padStart(2, '0')}:${m[2] || m[3] || '00'}`)
    const uniqueOffered = [...new Set(offeredMatches)]
    if (uniqueOffered.length >= 1 && /\b(o primeiro|a primeira|primeira opcao|esse primeiro)\b/.test(userClean)) {
      slot = uniqueOffered[0]
    } else if (uniqueOffered.length === 1 && /^(sim|isso|isso mesmo|pode|pode ser|pode agendar|pode marcar|fechado|fechou|quero|ok|combinado|bora|sim agendar)$/.test(userClean.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim())) {
      slot = uniqueOffered[0]
    }
  }
  if (!slot) return null

  const [hh, mm] = slot.split(':')
  const hNum = Number(hh)
  const slotPatterns = [
    slot,
    `${hNum}:${mm}`,
    `${hNum}h${mm}`,
    `${hh}h${mm}`,
    mm === '00' ? `${hNum}h` : `${hNum}h${mm}`,
    mm === '00' ? `${hh}h` : `${hh}h${mm}`,
  ]
  const assistantLower = rawAssistant.toLowerCase()
  let offeredInAssistant = slotPatterns.some((pat) => {
    const idx = assistantLower.indexOf(pat.toLowerCase())
    if (idx < 0) return false
    const after = assistantLower.slice(idx + pat.length, idx + pat.length + 2)
    return !/^\d/.test(after)
  })
  // Fallback para horário PM quando o cliente diz "5:45", "6:00", "5:30", "3:00" e o assistente ofereceu horário da tarde/noite
  if (!offeredInAssistant && hNum >= 1 && hNum <= 6) {
    const pmHNum = hNum + 12;
    const pmSlot = `${pad(pmHNum)}:${mm}`;
    const pmSlotPatterns = [
      pmSlot,
      `${pmHNum}:${mm}`,
      `${pmHNum}h${mm}`,
      mm === '00' ? `${pmHNum}h` : `${pmHNum}h${mm}`,
    ];
    const matchedPm = pmSlotPatterns.some((pat) => {
      const idx = assistantLower.indexOf(pat.toLowerCase());
      if (idx < 0) return false;
      const after = assistantLower.slice(idx + pat.length, idx + pat.length + 2);
      return !/^\d/.test(after);
    });
    if (matchedPm) {
      slot = pmSlot;
      offeredInAssistant = true;
    }
  }
  if (!offeredInAssistant) return null

  const combined = `${rawAssistant} ${rawUser}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  let servico = 'Corte'
  const extraServiceIds = []
  if (/\bcorte\s+e\s+barba\b|\bbarba\s+e\s+corte\b|\bcabelo\s+e\s+barba\b|\bcombo\b/.test(combined)) servico = 'Corte e barba'
  else if (/\b(desondulacao|selagem|progressiva|relaxamento)\b/.test(combined)) {
    if (/\b(corte|cabelo)\b/.test(combined)) {
      servico = 'Corte'
      extraServiceIds.push('Desondulação (Selagem)')
    } else {
      servico = 'Desondulação (Selagem)'
    }
  } else if (/\blimpeza\s+de\s+pele\b/.test(combined)) servico = 'Limpeza de Pele'
  else if (/\bdetox\s+de\s+barba\b/.test(combined)) servico = 'Detox de barba'
  else if (/\bdetox\b/.test(combined)) servico = 'Detox Capilar'
  else if (/\bdermaplaning\b/.test(combined)) servico = 'Dermaplaning'
  else if (/\bbanho\s+de\s+gelo\b/.test(combined)) servico = 'Banho de Gelo'
  else if (/\b(coloracao|tonalizacao|tintura)\b/.test(combined)) servico = 'Coloração Tonalização'
  else if (/\bbarba\b/.test(combined) && !/\bcorte\b/.test(combined)) servico = 'Barba'
  else if (/\bsobrancelha\b/.test(combined)) servico = 'Sobrancelha'

  if (/\bsobrancelha\b/.test(combined) && servico !== 'Sobrancelha' && !extraServiceIds.includes('Design de Sobrancelha')) {
    extraServiceIds.push('Design de Sobrancelha')
  }

  let profissional = 'qualquer'
  const userNorm = rawUser.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\bbruno\b/.test(userNorm)) profissional = 'Bruno'
  else if (/\bnati|natani|naty\b/.test(userNorm)) profissional = 'Nati'
  else if (/\bdino\b/.test(userNorm)) profissional = 'Dino'
  else {
    const profsInAss = []
    if (/\bbruno\b/.test(combined)) profsInAss.push('Bruno')
    if (/\b(nati|natani|naty|natalia|natali|nathalia)\b/.test(combined)) profsInAss.push('Nati')
    if (/\bdino\b/.test(combined) && !/barbearia dino|t-rex da dino|trex da dino/.test(combined)) profsInAss.push('Dino')
    if (profsInAss.length === 1) profissional = profsInAss[0]
  }

  let data = ''
  const isoMatch = rawAssistant.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  const brMatch = rawAssistant.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/)
  const baseDate = new Date(now.valueOf() - 4 * 3600 * 1000)
  const year = baseDate.getUTCFullYear()
  if (isoMatch) {
    data = isoMatch[1]
  } else if (brMatch) {
    const d = String(brMatch[1]).padStart(2, '0')
    const m = String(brMatch[2]).padStart(2, '0')
    const y = brMatch[3] || String(year)
    data = `${y}-${m}-${d}`
  } else if (/\bamanha\b/.test(combined)) {
    const am = new Date(baseDate.valueOf() + 86400000)
    data = am.toISOString().slice(0, 10)
  } else if (/\bhoje\b/.test(combined)) {
    data = baseDate.toISOString().slice(0, 10)
  }
  if (!data) return null

  return { servico, profissional, data, horario: slot, ...(extraServiceIds.length ? { extraServiceIds } : {}) }
}

/**
 * Fast-path determinístico (< 1ms) para Perguntas Frequentes (FAQ) da Dino Barbearia:
 * preços, serviços, localização, horários de atendimento, profissionais e duração.
 */
export function detectDinoQuickFaq(userText, { storeName = 'Dino Barbearia' } = {}) {
  const t = String(userText || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!t || t.length > 120 || t.length < 3) return null;
  if (/\b(cancelar|desmarcar|remarcar|confirmo|confirmado|sim|nao|sair|obrigado|valeu)\b/.test(t)) return null;
  if (/\b(segunda|terca|quarta|quinta|sexta|sabado|domingo|hoje|amanha|\d{1,2}\/\d{1,2})\b/.test(t) && /\b\d{1,2}(?:h|:)\d{0,2}\b/.test(t)) return null;

  // 1. Duração dos Serviços
  if (/\b(quanto tempo|qual a duracao|tempo de atendimento|demora muito)\b/i.test(t) && /\b(demora|gasta|leva|atendimento|servico|corte|barba|cabelo|combo|fazer|procedimento)\b/i.test(t)) {
    return {
      kind: 'faq_duracao',
      text: `Aqui na ${storeName}, a duração média dos nossos atendimentos é:\n\n• *Corte de Cabelo*: cerca de 45 minutos\n• *Barba Tradicional (com toalha quente)*: cerca de 30 a 40 minutos\n• *Combo Corte + Barba*: cerca de 1 hora a 1h15\n• *Limpeza de Pele / Sobrancelha*: cerca de 20 a 30 minutos\n\nQual serviço você gostaria de realizar? Posso ver os horários mais próximos pra você! 💈`,
    };
  }

  // 2. Preços e Valores
  if (/\b(quanto custa|qual o valor|qual o preco|tabela de precos?|tabela de valores|quais os precos|quais os valores)\b/i.test(t)) {
    if (/\b(corte|cabelo)\b/i.test(t) && !/\bbarba\b/i.test(t)) {
      return {
        kind: 'faq_preco_corte',
        text: `O *Corte Masculino* com nossa equipe de especialistas (Bruno ou Nati) custa *R$ 90,00* (cerca de 45 min). Já o corte VIP com o Mestre Dino custa *R$ 300,00* diurno.\n\n💈 Você pode conferir os horários livres e agendar direto pelo link:\nhttps://kytto.com.br/agendar/dino\n\nQual dia e horário fica melhor pra você?`,
      };
    }
    if (/\bbarba\b/i.test(t) && !/\b(corte|cabelo)\b/i.test(t)) {
      return {
        kind: 'faq_preco_barba',
        text: `A *Barba Completa* na ${storeName} (com toalha quente, produtos premium e navalha) sai por *R$ 60,00 a R$ 80,00* com nossa equipe.\n\n💈 Você pode agendar direto pelo link:\nhttps://kytto.com.br/agendar/dino\n\nQual horário prefere?`,
      };
    }
    if (/\b(combo|corte e barba|barba e corte|cabelo e barba)\b/i.test(t)) {
      return {
        kind: 'faq_preco_combo',
        text: `Nosso *Combo Corte + Barba* sai a partir de *R$ 140,00 a R$ 160,00* com a equipe (cerca de 1 hora de atendimento completo).\n\n💈 Agende online aqui:\nhttps://kytto.com.br/agendar/dino\n\nMe fala o dia que prefere que já vejo as opções!`,
      };
    }
    return {
      kind: 'faq_precos_geral',
      text: `Nossos principais serviços na ${storeName} são:\n\n• *Corte Masculino (Bruno ou Nati)*: R$ 90,00 (~45 min)\n• *Barba Tradicional*: a partir de R$ 60,00 (~35 min)\n• *Combo Corte + Barba*: a partir de R$ 140,00 (~1h)\n• *Sobrancelha*: R$ 35,00\n• *Corte VIP com Dino*: R$ 300,00\n\n💈 Você pode ver a tabela completa e agendar online:\nhttps://kytto.com.br/agendar/dino\n\nQuer agendar para hoje ou prefere outro dia?`,
    };
  }

  // 3. Endereço e Localização
  if (/\b(onde fica|qual o endereco|qual a localizacao|qual o local|onde voces ficam|onde e a barbearia|ponto de referencia|tem estacionamento)\b/i.test(t)) {
    return {
      kind: 'faq_endereco',
      text: `A ${storeName} fica em Cuiabá - MT! 📍\nContamos com ambiente climatizado, estrutura premium e estacionamento para sua conveniência.\n\n💈 Você pode agendar seu horário com antecedência pelo app:\nhttps://kytto.com.br/agendar/dino\n\nPosso te ajudar a marcar um horário?`,
    };
  }

  // 4. Horário de Funcionamento
  if (/\b(horario de funcionamento|horario de atendimento|que horas abre|que horas fecha|abrem domingo|abre no domingo|funcionam domingo|atendem hoje|que horas voces atendem)\b/i.test(t)) {
    return {
      kind: 'faq_horario',
      text: `Nosso horário de funcionamento na ${storeName} é de *segunda a sábado, das 08h às 19h* (domingos e feriados fechado). 💈\n\nVocê pode consultar os horários livres e marcar a qualquer hora pelo app:\nhttps://kytto.com.br/agendar/dino\n\nQual dia você gostaria de vir?`,
    };
  }

  // 5. Profissionais / Barbeiros
  if (/\b(quem sao os barbeiros|quais os profissionais|quem corta ai|quais sao os profissionais|quem atende ai)\b/i.test(t)) {
    return {
      kind: 'faq_profissionais',
      text: `Nossa equipe de mestres na ${storeName} conta com:\n\n• *Bruno (Bruno Mendes)* — Link direto: https://kytto.com.br/agendar/dino/bruno\n• *Nati (Natani Dobler)* — Link direto: https://kytto.com.br/agendar/dino/nati\n• *Dino (Mestre Dino)* — Link direto: https://kytto.com.br/agendar/dino\n\nCom qual deles você prefere agendar seu corte ou barba?`,
    };
  }

  // 5.1 Pergunta direta "E se for só cabelo??" ou "Só cabelo"
  if (/^(?:e\s+se\s+for\s+|se\s+for\s+)?(?:s[oó]|apenas|somente)\s+(?:o\s+)?(?:cabelo|corte)[?.\s]*$/i.test(t)) {
    return {
      kind: 'faq_preco_corte',
      text: `O *Corte Masculino* com nossa equipe (Bruno ou Nati) custa *R$ 90,00* (cerca de 45 min). Já com o Mestre Dino sai por *R$ 300,00* diurno.\n\n💈 Você pode agendar direto pelo link:\nhttps://kytto.com.br/agendar/dino\n\nQual dia e horário você prefere?`,
    };
  }

  // 6. Pacotes e Assinaturas (Agendamento pelo link e validade)
  if (/\b(pacote|plano|assinatura|assinante|clube)\b/i.test(t) && /\b(link|agendamento|agendar|como faco|normalmente|validade|vencimento|ate quando|funciona|posso agendar)\b/i.test(t)) {
    return {
      kind: 'faq_pacote_agendamento',
      text: `Sim! Se você já tem pacote ou assinatura ativa na ${storeName}, pode agendar tanto por aqui comigo quanto pelo link oficial:\nhttps://kytto.com.br/agendar/dino\n\nO sistema reconhece seu pacote automaticamente pelo número de telefone cadastrado e debita a sessão direto do seu plano (sem nenhum pagamento adicional no agendamento)! 💈\n\nQuer agendar seu retorno agora ou prefere usar o link?`,
    };
  }

  // 7. Mesa de Sinuca, Lazer e Bebidas (Chopp, Café, Cerveja)
  if (/\b(sinuca|mesa de sinuca|jogo|bilhar|bebida|bebidas|cerveja|chopp|cafe|cafezinho|refrigerante)\b/i.test(t)) {
    return {
      kind: 'faq_sinuca_bebidas',
      text: `Sim! Aqui na ${storeName} temos uma estrutura completa de entretenimento e conforto pra você: ambiente 100% climatizado, mesa de sinuca para relaxar antes ou depois do corte, café expresso cortesia e bebidas geladas para você curtir a experiência completa! 🎱☕💈\n\nBora garantir seu horário? Qual dia fica melhor pra você vir?`,
    };
  }

  // 8. Visagismo e Consultoria de Estilo
  if (/\bvisagismo\b/i.test(t) || (/\b(corte|estilo)\b/i.test(t) && /\b(formato de rosto|combinar com meu rosto|tipo de rosto)\b/i.test(t))) {
    return {
      kind: 'faq_visagismo',
      text: `Com certeza! Aqui na ${storeName} nossa equipe é especialista em *visagismo masculino*: avaliamos as linhas do seu rosto, formato de mandíbula, formato craniano e textura do cabelo/barba para desenhar o corte e a barba que melhor valorizam seu perfil e autoridade! ✂️💈\n\nVocê pode agendar direto no link:\nhttps://kytto.com.br/agendar/dino\n\nOu me fala o dia que prefere vir que já reservo pra você!`,
    };
  }

  // 9. Quem pode atender hoje / Atendimento no dia
  if (/\b(quem pode me atender hoje|tem quem atenda hoje|quem ta atendendo hoje|quem atende hoje|disponibilidade hoje|barbeiro hoje)\b/i.test(t)) {
    return {
      kind: 'faq_quem_atende_hoje',
      text: `Hoje temos nossa equipe de mestres a todo vapor na ${storeName}: *Bruno*, *Nati* e *Mestre Dino*! 💈\n\nPara conferir as vagas em tempo real e agendar na hora, acesse:\nhttps://kytto.com.br/agendar/dino\n\nOu me diga qual horário fica melhor pra você que já vejo as opções agora mesmo!`,
    };
  }

  // 10. Contato do Responsável / Parcerias / Gestão
  if (/\b(numero do responsavel|falar com o responsavel|contato do responsavel|gerente|gerencia|dono|parceria|comercial|proprietario)\b/i.test(t)) {
    return {
      kind: 'faq_contato_responsavel',
      text: `Com certeza! Você está no canal oficial de atendimento da ${storeName}. Caso deseje tratar de parcerias, fornecedores ou falar diretamente com a gestão do Mestre Dino, me envie um resumo do assunto por aqui que encaminho para nossa diretoria retornar para você! 💈`,
    };
  }

  return null;
}
