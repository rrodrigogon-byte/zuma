function empresaAtiva() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return JSON.parse(localStorage.getItem('sp_empresa_ativa') || 'null')?.id || ''
  } catch {
    return ''
  }
}

export function a2Path(caminho, legado = null) {
  const path = String(caminho || '')
  const normalizado = path.startsWith('/') ? path : `/${path}`
  return empresaAtiva() ? `/api/admin/a2${normalizado}` : (legado || `/api/admin${normalizado}`)
}
