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
