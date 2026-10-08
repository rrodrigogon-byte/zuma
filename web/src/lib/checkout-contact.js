const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PUBLIC_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

export function checkoutContactReference(error) {
  const value = String(error?.requestId || '').trim()
  return REQUEST_ID.test(value) ? value.toLowerCase() : ''
}

export function checkoutContactReviewMessage(error) {
  const reference = checkoutContactReference(error)
  return `Precisamos conferir seus contatos com segurança antes de concluir a compra. Revise e-mail e telefone. Se os campos já estiverem corretos, solicite à loja a revisão do cadastro; repetir a tentativa com os mesmos dados não resolve essa conferência. Seu carrinho foi mantido. Nenhum pedido ou pagamento foi iniciado nesta tentativa.${reference ? ` Referência: ${reference}.` : ''}`
}

// Apenas o contato comercial publicado pela própria vitrine. Nunca inclua os dados
// do comprador, carrinho, endereço ou o motivo interno do conflito no link.
export function checkoutContactSupportAction(contact, error) {
  const reference = checkoutContactReference(error)
  const email = String(contact?.email || '').trim()
  if (email.length <= 254 && PUBLIC_EMAIL.test(email)) {
    const subject = encodeURIComponent('Ajuda com checkout da loja')
    const body = encodeURIComponent(`Olá, preciso de ajuda para concluir uma compra. Referência: ${reference || 'não disponível'}. Solicito orientação para conferir meus dados de contato.`)
    return { href: `mailto:${email}?subject=${subject}&body=${body}`, label: 'Escrever para a loja' }
  }
  const phone = String(contact?.phone || '').trim()
  if (/^\+?[0-9]{10,15}$/.test(phone)) return { href: `tel:${phone}`, label: 'Ligar para a loja' }
  return null
}
