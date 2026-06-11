function getToken() {
  return localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token') || ''
}

async function request(path, opts = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(opts.headers || {}),
  }
  const res = await fetch(path, { ...opts, headers })
  if (res.status === 401) {
    localStorage.removeItem('sp_token')
    localStorage.removeItem('sp_site_token')
    localStorage.removeItem('sp_user')
    window.location.href = '/login'
    return
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.erro || `Erro ${res.status}`)
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
apiFn.delete = (path)       => request(path, { method: 'DELETE' })

export const api = apiFn

export function fmtR(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function fmtDateOnly(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}
