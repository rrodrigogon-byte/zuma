// WhatsApp via Evolution API (compatível com Z-API como fallback)
// Variáveis de ambiente: WPP_BASE_URL, WPP_APIKEY, WPP_INSTANCE

const BASE  = process.env.WPP_BASE_URL  || ''
const KEY   = process.env.WPP_APIKEY    || ''
const INST  = process.env.WPP_INSTANCE  || 'setpoint'

function ativo() { return !!(BASE && KEY) }

async function enviar(telefone, mensagem) {
  if (!ativo()) {
    console.log(`[WPP-SIM] ${telefone}: ${mensagem.slice(0,80)}…`)
    return { ok: true, simulado: true }
  }
  const numero = telefone.replace(/\D/g, '')
  const url = `${BASE}/message/sendText/${INST}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: JSON.stringify({ number: `55${numero}`, text: mensagem }),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

// Templates de mensagem
export const wpp = {
  ativo,
  enviar,

  async inscricaoConfirmada(tel, nome, categorias, total) {
    const cats = Array.isArray(categorias) ? categorias.join(', ') : categorias
    return enviar(tel,
      `🎾 *SetPoint — 4ª Agro Open*\n\nOlá, *${nome}*! ✅\n\nSua inscrição foi *confirmada* nas categorias:\n${cats}\n\n💰 Total pago: *R$ ${Number(total).toFixed(2).replace('.',',')}*\n\nBoa sorte no torneio! 🏆`)
  },

  async mensalidadeVencendo(tel, nome, valor, vencimento) {
    return enviar(tel,
      `💳 *SetPoint — Clube*\n\nOlá, *${nome}*!\n\nSua mensalidade de *R$ ${Number(valor).toFixed(2).replace('.',',')}* vence em *${vencimento}*.\n\nEvite o bloqueio realizando o pagamento antes do vencimento. 🙏`)
  },

  async mensalidadePaga(tel, nome, valor) {
    return enviar(tel,
      `✅ *SetPoint — Clube*\n\nOlá, *${nome}*!\n\nRecebemos seu pagamento de *R$ ${Number(valor).toFixed(2).replace('.',',')}*.\n\nObrigado! Acesso liberado. 🎾`)
  },

  async reservaConfirmada(tel, nome, quadra, data, hora) {
    return enviar(tel,
      `📅 *SetPoint — Reserva de Quadra*\n\nOlá, *${nome}*!\n\nSua reserva foi *confirmada*:\n🎾 Quadra: *${quadra}*\n📆 Data: *${data}*\n⏰ Horário: *${hora}*\n\nAté lá! 🏆`)
  },

  async reservaCancelada(tel, nome, quadra, data, hora) {
    return enviar(tel,
      `❌ *SetPoint — Reserva Cancelada*\n\nOlá, *${nome}*.\n\nSua reserva foi cancelada:\n🎾 Quadra: *${quadra}*\n📆 Data: *${data}*\n⏰ Horário: *${hora}*\n\nDúvidas? Entre em contato com o clube.`)
  },

  async lojaPedidoPronto(tel, nome, codigo) {
    return enviar(tel,
      `🛍️ *SetPoint — Loja Agro Open*\n\nOlá, *${nome}*! ✅\n\nSeu pedido *${codigo}* está *pronto para retirada* no Tangará Tênis Clube.\n\nApresente este código na loja. Até já! 🎾`)
  },

  async pontosCreditados(tel, nome, pontos, saldo) {
    return enviar(tel,
      `⭐ *SetPoint — Fidelidade*\n\nOlá, *${nome}*!\n\nVocê ganhou *+${pontos} pontos*.\nSeu saldo atual: *${saldo} pontos* 🏆\n\nAcumule pontos e troque por benefícios no clube!`)
  },
}
