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

// Lojas vindas do Commerce (storefronts) chegam sem o vínculo da empresa. Mescla sem
// apagar campos já conhecidos e, quando faltar, vincula à empresa ativa — sem isso a
// loja some do contexto e as telas por unidade pedem "selecione a unidade".
export function mesclarLojasComerciais(existentes = [], novas = [], empresaId = '') {
  const mapa = new Map((Array.isArray(existentes) ? existentes : []).filter((loja) => loja?.id).map((loja) => [loja.id, loja]))
  for (const loja of Array.isArray(novas) ? novas : []) {
    if (!loja?.id) continue
    const anterior = mapa.get(loja.id) || {}
    const mesclada = { ...anterior, ...loja }
    if (!mesclada.empresaId && anterior.empresaId) mesclada.empresaId = anterior.empresaId
    if (!mesclada.commerceEmpresaId && anterior.commerceEmpresaId) mesclada.commerceEmpresaId = anterior.commerceEmpresaId
    if (!mesclada.empresaId && !mesclada.commerceEmpresaId && empresaId) mesclada.commerceEmpresaId = String(empresaId)
    mapa.set(loja.id, mesclada)
  }
  return [...mapa.values()]
}

// Repara entradas já gravadas sem vínculo (versões anteriores do sync do Commerce).
export function repararLojasSemEmpresa(lojas = [], conhecidas = []) {
  const referencia = new Map((Array.isArray(conhecidas) ? conhecidas : []).filter((loja) => loja?.id).map((loja) => [loja.id, loja]))
  return (Array.isArray(lojas) ? lojas : []).map((loja) => {
    if (!loja?.id || loja.empresaId || loja.commerceEmpresaId) return loja
    const conhecida = referencia.get(loja.id)
    return conhecida ? { ...loja, empresaId: conhecida.empresaId, commerceEmpresaId: conhecida.commerceEmpresaId } : loja
  })
}
