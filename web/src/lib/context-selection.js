// Escolha da unidade (loja) ativa. Uma loja pode chegar do servidor com `empresaId` ou
// `empresa_id`; quem regrava a lista no navegador (e-commerce, Unidades) nem sempre manda os dois.
export function empresaDaLoja(loja) {
  return String(loja?.empresaId || loja?.empresa_id || '')
}

/** A loja é da empresa? Vale o id legado (empresaId/empresa_id) ou o id do Commerce (commerceEmpresaId). */
export function pertenceAEmpresa(loja, empresaId) {
  const id = String(empresaId || '')
  return Boolean(id) && (empresaDaLoja(loja) === id || String(loja?.commerceEmpresaId || '') === id)
}

export function normalizarLojas(lojas = []) {
  return (Array.isArray(lojas) ? lojas : [])
    .filter((loja) => loja && loja.id)
    .map((loja) => (empresaDaLoja(loja) && !loja.empresaId ? { ...loja, empresaId: empresaDaLoja(loja) } : loja))
}

/** Junta duas listas de lojas sem perder campos que só uma delas tem (ex.: empresaId). */
export function mesclarLojas(atuais = [], novas = []) {
  const porId = new Map(normalizarLojas(atuais).map((loja) => [String(loja.id), loja]))
  for (const loja of normalizarLojas(novas)) {
    const anterior = porId.get(String(loja.id)) || {}
    const definidos = Object.fromEntries(Object.entries(loja).filter(([, valor]) => valor !== undefined && valor !== null && valor !== ''))
    // o vínculo com a empresa vem do servidor e não é trocado por quem só repete a loja
    if (anterior.empresaId) definidos.empresaId = anterior.empresaId
    porId.set(String(loja.id), { ...anterior, ...definidos })
  }
  return Array.from(porId.values())
}

/**
 * Lista completa vinda do servidor: substitui (some loja desativada ou sem acesso).
 * Com `empresaId`, substitui só as lojas dessa empresa e mantém as das outras.
 * Aproveita o empresaId antigo só para ids que continuam na lista nova.
 */
export function substituirLojas(atuais = [], novas = [], { empresaId = null } = {}) {
  const antigas = new Map(normalizarLojas(atuais).map((loja) => [String(loja.id), loja]))
  const recebidas = normalizarLojas(novas).map((loja) => {
    const anterior = antigas.get(String(loja.id))
    const vinculo = empresaDaLoja(loja) || empresaDaLoja(anterior) || (empresaId ? String(empresaId) : '')
    return vinculo ? { ...loja, empresaId: vinculo } : loja
  })
  if (!empresaId) return recebidas
  const outras = normalizarLojas(atuais).filter((loja) => empresaDaLoja(loja) && empresaDaLoja(loja) !== String(empresaId))
  const idsNovos = new Set(recebidas.map((loja) => String(loja.id)))
  return [...outras.filter((loja) => !idsNovos.has(String(loja.id))), ...recebidas]
}

export function lojasDaEmpresa(lojas = [], empresaId = '') {
  const id = String(empresaId || '')
  return normalizarLojas(lojas).filter((loja) => loja.ativa !== false && (!id || pertenceAEmpresa(loja, id)))
}

export function selecionarLojaAutomatica(lojas = [], empresaId = '', atual = null) {
  const disponiveis = lojasDaEmpresa(lojas, empresaId)
  if (atual?.id) {
    const mesma = disponiveis.find((loja) => String(loja.id) === String(atual.id))
    if (mesma) return { ...atual, ...mesma }
  }
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
