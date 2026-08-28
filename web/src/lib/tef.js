/**
 * tef.js — camada de pagamento via maquininha (TEF) no PDV.
 *
 * O pinpad é FÍSICO e LOCAL: o navegador conversa com um "agente TEF local"
 * (middleware SiTef/PayGo) por HTTP em localhost. A nuvem (KYTTO Clube) só recebe o
 * RESULTADO da captura (NSU/autorização) para baixar a venda.
 *
 * Sem `config.tef.agenteUrl` configurado, a operação é bloqueada. O sistema não
 * aprova transações com NSU/autorização fictícios.
 */

export function tefConfigurado(tef) {
  return !!(tef && String(tef.agenteUrl || '').trim())
}

export const MODALIDADES_TEF = [
  { key: 'debito',            label: 'Débito',           icon: '💳' },
  { key: 'credito_avista',    label: 'Crédito à vista',  icon: '💳' },
  { key: 'credito_parcelado', label: 'Crédito parcelado', icon: '💳' },
]

/**
 * Inicia uma transação no agente TEF local e devolve o comprovante de captura.
 * @param {{valor:number, modalidade?:string, parcelas?:number, tef?:object}} opts
 * @returns {Promise<{aprovado:boolean, simulado:boolean, nsu:string, autorizacao:string,
 *   adquirente:string, bandeira:string, parcelas:number, modalidade:string,
 *   comprovanteCliente:string, comprovanteEstabelecimento:string}>}
 */
export async function pagarTef({ valor, modalidade = 'credito_avista', parcelas = 1, tef = {} }) {
  const url = String(tef.agenteUrl || '').trim()

  // ── Modo real: agente TEF local (browser → localhost) ──
  if (url) {
    const resp = await fetch(url.replace(/\/$/, '') + '/tef/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valor, modalidade, parcelas,
        terminal: tef.terminal, ambiente: tef.ambiente, adquirente: tef.adquirente,
      }),
    })
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}))
      throw new Error(e.mensagem || e.error || 'Falha na comunicação com a maquininha')
    }
    const d = await resp.json()
    if (!d.aprovado) throw new Error(d.mensagem || 'Transação não aprovada pela maquininha')
    return {
      aprovado: true, simulado: false,
      nsu: d.nsu || '', autorizacao: d.autorizacao || '',
      adquirente: d.adquirente || tef.adquirente || '',
      bandeira: d.bandeira || '', parcelas: d.parcelas || parcelas, modalidade,
      comprovanteCliente: d.comprovanteCliente || '',
      comprovanteEstabelecimento: d.comprovanteEstabelecimento || '',
    }
  }

  const error = new Error('TEF não configurado: conecte o agente local da maquininha antes de cobrar')
  error.code = 'TEF_NOT_CONFIGURED'
  throw error
}
