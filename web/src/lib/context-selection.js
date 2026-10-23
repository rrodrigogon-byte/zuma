export function lojasDaEmpresa(lojas = [], empresaId = '') {
  const id = String(empresaId || '')
  return (Array.isArray(lojas) ? lojas : []).filter((loja) => {
    if (!loja || loja.ativa === false) return false
    if (!id) return true
    return String(loja.empresaId || '') === id || String(loja.commerceEmpresaId || '') === id
  })
}

export function selecionarLojaAutomatica(lojas = [], empresaId = '', atual = null) {
  const disponiveis = lojasDaEmpresa(lojas, empresaId)
  if (atual?.id && disponiveis.some((loja) => String(loja.id) === String(atual.id))) return atual
  return disponiveis.length === 1 ? disponiveis[0] : null
}
