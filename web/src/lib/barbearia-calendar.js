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
export function filtrarAgenda(itens, { busca = '', status = '' } = {}) {
  const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return itens.filter(item => (!status || item.status === status) && normalizar([item.clienteNome, item.cliente_nome, item.servicoNome, item.servico_nome, item.profissionalNome, item.profissional_nome, item.codigo].join(' ')).includes(normalizar(busca).trim()))
}
