export const FUSO_AGENDA = 'America/Cuiaba'
export function hojeAgenda(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora)
  return ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo).value).join('-')
}
export function dataValida(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && !Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) && new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso
}
export function somarDias(iso, dias) {
  if (!dataValida(iso)) return ''
  const data = new Date(`${iso}T12:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}
export function diasEntre(de, ate) {
  if (!dataValida(de) || !dataValida(ate) || ate < de) return []
  const n = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000) + 1
  return n > 62 ? [] : Array.from({ length: n }, (_, i) => somarDias(de, i))
}

export function inicioDaSemana(iso) {
  if (!dataValida(iso)) return hojeAgenda()
  const d = new Date(`${iso}T12:00:00Z`)
  const diaSemana = d.getUTCDay()
  const recuo = diaSemana === 0 ? 6 : diaSemana - 1
  return somarDias(iso, -recuo)
}

export function semanaSegundaSabado(iso) {
  const seg = inicioDaSemana(iso)
  return { de: seg, ate: somarDias(seg, 5) }
}

export function semanaCompleta(iso) {
  const seg = inicioDaSemana(iso)
  return { de: seg, ate: somarDias(seg, 6) }
}

export function periodoMes(iso, deslocamento = 0) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + deslocamento)
  const de = d.toISOString().slice(0, 10)
  d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0)
  return { de, ate: d.toISOString().slice(0, 10) }
}
export function diaDoItem(item) {
  if (dataValida(String(item.dataAgenda || '').slice(0, 10))) return String(item.dataAgenda).slice(0, 10)
  const data = new Date(item.dataHora || '')
  return Number.isNaN(data.valueOf()) ? '' : hojeAgenda(data)
}
export function horaDoItem(item) {
  if (item.horaLocal) return item.horaLocal
  const data = new Date(item.dataHora || '')
  return Number.isNaN(data.valueOf()) ? '' : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_AGENDA })
}
export function diaLegivel(iso) {
  if (!dataValida(iso)) return 'Data inválida'
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export function diaExtenso(iso) {
  if (!dataValida(iso)) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
  const dia = d.getUTCDate()
  const mes = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const ano = d.getUTCFullYear()
  const capital = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
  const capitalMes = mes.charAt(0).toUpperCase() + mes.slice(1)
  return `${capital}, ${dia} de ${capitalMes} de ${ano}`
}

export function mesAnoLegivel(iso) {
  if (!dataValida(iso)) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  const nomeMes = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const ano = d.getUTCFullYear()
  return `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${ano}`
}

export function diaSemanaCurto(iso) {
  if (!dataValida(iso)) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  const abrev = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
  return abrev.replace('.', '').toUpperCase()
}

export function diaNumero(iso) {
  if (!dataValida(iso)) return ''
  return String(iso).slice(8, 10)
}

export function filtrarAgenda(itens, { busca = '', status = '' } = {}) {
  const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return itens.filter(item => {
    if (status && item.status !== status) return false;
    if (!status && (item.status === 'cancelado' || item.status === 'cancelado_falta_confirmacao')) return false;
    return normalizar([item.clienteNome, item.cliente_nome, item.servicoNome, item.servico_nome, item.profissionalNome, item.profissional_nome, item.codigo].join(' ')).includes(normalizar(busca).trim());
  })
}
