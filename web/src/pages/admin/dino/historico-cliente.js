// Abre o histórico completo do cliente (ficha 360) em nova guia.

/** Referência da ficha: cadastro do cliente; sem cadastro, o telefone (com DDD). */
export function refHistoricoCliente(item = {}) {
  const id = String(item.clienteId || item.cliente_id || item.id_cliente || '').trim()
  if (id) return `dino:${id}`
  const digitos = String(item.clienteTelefone || item.cliente_telefone || item.telefone || '').replace(/\D/g, '')
  return digitos.length >= 10 ? `tel:${digitos}` : ''
}

export const urlHistoricoCliente = (ref) => `/admin/clientes-360/${encodeURIComponent(ref)}`

/** Abre em nova guia; devolve false quando não há como identificar o cliente. */
export function abrirHistoricoEmNovaGuia(item, abrir = (url) => window.open(url, '_blank', 'noopener,noreferrer')) {
  const ref = refHistoricoCliente(item)
  if (!ref) return false
  abrir(urlHistoricoCliente(ref))
  return true
}
