export function lojasDaEmpresa(lojas = [], empresaId = '') {
  const id = String(empresaId || '')
  return (Array.isArray(lojas) ? lojas : []).filter((loja) => loja && loja.ativa !== false && (!id || String(loja.empresaId || '') === id))
}

export function selecionarLojaAutomatica(lojas = [], empresaId = '', atual = null) {
  const disponiveis = lojasDaEmpresa(lojas, empresaId)
  if (atual?.id && disponiveis.some((loja) => String(loja.id) === String(atual.id))) return atual
  return disponiveis.length === 1 ? disponiveis[0] : null
}
