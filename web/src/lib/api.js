import { deveEnfileirarOffline, enfileirarOperacao, prepararOperacao, sincronizarFila } from './offline-queue'

function getToken() {
  return localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token') || ''
}

function getLojaAtivaId() {
  try {
    const loja = JSON.parse(localStorage.getItem('sp_loja_ativa') || 'null')
    return loja?.id || ''
  } catch {
    return ''
  }
}

async function request(path, opts = {}) {
  const preparado = prepararOperacao(path, opts)
  const token = getToken()
  const lojaId = getLojaAtivaId()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(lojaId ? { 'X-Loja-Id': lojaId } : {}),
    ...(preparado.headers || {}),
  }
  let res
  try {
    if (!navigator.onLine && deveEnfileirarOffline(path, preparado)) return enfileirarOperacao(path, { ...preparado, headers })
    res = await fetch(path, { ...preparado, headers })
  } catch (erro) {
    if (deveEnfileirarOffline(path, preparado)) return enfileirarOperacao(path, { ...preparado, headers })
    throw erro
  }
  if (res.status === 401) {
    localStorage.removeItem('sp_token')
    localStorage.removeItem('sp_site_token')
    localStorage.removeItem('sp_user')
    localStorage.removeItem('sp_loja_ativa')
    localStorage.removeItem('sp_lojas_acessiveis')
    window.location.href = '/login'
    return
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || data.erro || `Erro ${res.status}`)
    error.status = res.status
    error.code = data.code || ''
    throw error
  }
  return data
}

// api() pode ser chamada diretamente como função (api(url, opts))
// OU via métodos (api.get, api.post, ...)
function apiFn(path, opts = {}) {
  // Se opts.body é string, já veio serializado
  const finalOpts = opts.body && typeof opts.body === 'string'
    ? opts
    : opts.body
      ? { ...opts, body: JSON.stringify(opts.body) }
      : opts
  return request(path, finalOpts)
}

apiFn.get    = (path)       => request(path)
apiFn.post   = (path, body) => request(path, { method: 'POST',   body: JSON.stringify(body) })
apiFn.patch  = (path, body) => request(path, { method: 'PATCH',  body: JSON.stringify(body) })
apiFn.put    = (path, body) => request(path, { method: 'PUT',    body: JSON.stringify(body) })
apiFn.delete = (path, body) => request(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) })
apiFn.sincronizarFilaOffline = () => sincronizarFila((path, opts) => {
  const token = getToken(); const lojaId = getLojaAtivaId()
  return fetch(path, { ...opts, headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(lojaId ? { 'X-Loja-Id':lojaId } : {}), ...(opts.headers || {}), 'X-Offline-Replay':'1' } })
})

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { apiFn.sincronizarFilaOffline().catch(() => {}) })
}

export const api = apiFn

// Formatação pt-BR (ponto de milhar, vírgula decimal)
const _brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const _int = new Intl.NumberFormat('pt-BR')

// Moeda: R$ 117.750,00
export function fmtR(v) {
  return _brl.format(Number(v || 0))
}

// Número com separador de milhar. casas = nº de casas decimais (opcional)
export function fmtNum(v, casas) {
  const n = Number(v || 0)
  if (casas != null) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  }
  return _int.format(n)
}

// Quantidade com unidade de medida: 2.050 un
export function fmtQtd(v, unidade = 'un') {
  return `${fmtNum(v)} ${unidade}`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function fmtDateOnly(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}
