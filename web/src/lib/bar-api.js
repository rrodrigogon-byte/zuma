// Contrato comum das telas de bar, PDV, garçom e KDS.
// Durante a transição, o evento sem empresa continua no backend legado; uma sessão
// com empresa ativa usa exclusivamente o escopo `/api/admin/bar`.
function empresaAtiva() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return JSON.parse(localStorage.getItem('sp_empresa_ativa') || 'null')?.id || ''
  } catch {
    return ''
  }
}

export function barPath(caminho) {
  const path = String(caminho || '')
  const normalizado = path.startsWith('/') ? path : `/${path}`
  return empresaAtiva() ? `/api/admin/bar${normalizado}` : `/api${normalizado}`
}

export function barAdminPath(caminho) {
  const path = String(caminho || '')
  const normalizado = path.startsWith('/') ? path : `/${path}`
  return empresaAtiva() ? `/api/admin/bar${normalizado}` : `/api/admin${normalizado}`
}
