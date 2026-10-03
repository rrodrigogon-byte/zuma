export function checkoutContactReviewMessage(error) {
  const reference = String(error?.requestId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  return `Confira e-mail e telefone. Se os dados estiverem corretos, fale com a loja antes de tentar novamente. Nenhum pagamento foi iniciado.${reference ? ` Referência: ${reference}.` : ''}`
}
