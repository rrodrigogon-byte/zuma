export function formatWhatsappPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!/^55\d{10,11}$/.test(digits)) return ''
  const local = digits.slice(4)
  const first = local.length === 9 ? 5 : 4
  return `+55 (${digits.slice(2, 4)}) ${local.slice(0, first)}-${local.slice(first)}`
}

export function linePresentation(connection) {
  if (!connection) return { value: '—', source: 'Aguardando consulta ao backend', verified: false }
  const live = connection.state === 'open'
  const confirmed = live && formatWhatsappPhone(connection.phoneNumber)
  if (confirmed) return { value: confirmed, source: 'Identificado pelo backend nesta sessão', verified: true, copy: connection.phoneNumber }
  if (live && connection.phoneMasked) {
    return { value: connection.phoneMasked, source: 'Identificado pelo backend · acesso parcial', verified: true }
  }
  const reference = formatWhatsappPhone(connection.phoneReference)
  if (reference) return {
    value: reference,
    source: live ? 'Referência manual · número da sessão não confirmado' : 'Referência manual · nenhuma sessão confirmada',
    verified: false,
  }
  return { value: 'Número não informado', source: live ? 'Sessão aberta; confira o número no aparelho' : 'Conecte uma linha para identificar o número', verified: false }
}

export function statusRefreshInterval(state) {
  return state === 'qr' || state === 'connecting' ? 5_000 : 30_000
}
