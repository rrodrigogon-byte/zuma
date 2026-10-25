function empresaAtiva() {
  if (typeof localStorage === 'undefined') return ''
  try {
    const ativa = JSON.parse(localStorage.getItem('sp_empresa_ativa') || 'null')?.id
    if (ativa) return ativa
    const acessiveis = JSON.parse(localStorage.getItem('sp_empresas_acessiveis') || 'null')
    if (Array.isArray(acessiveis) && acessiveis[0]?.id) return acessiveis[0].id
    const user = JSON.parse(localStorage.getItem('sp_user') || 'null')
    return user?.empresaId || ''
  } catch {
    return ''
  }
}

export function a2Path(caminho, legado = null) {
  const path = String(caminho || '')
  const normalizado = path.startsWith('/') ? path : `/${path}`
  return empresaAtiva() ? `/api/admin/a2${normalizado}` : (legado || `/api/admin${normalizado}`)
}
