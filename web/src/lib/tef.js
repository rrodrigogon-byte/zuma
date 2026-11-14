/**
 * tef.js — camada de pagamento via maquininha (TEF) no PDV.
 *
 * O pinpad é FÍSICO e LOCAL: o navegador conversa com um "agente TEF local"
 * (middleware SiTef/PayGo) por HTTP em localhost. A nuvem (KYTTO Clube) só recebe o
 * RESULTADO da captura (NSU/autorização) para baixar a venda.
 *
 * Suporta também o modo Kytto TEF Engine em nuvem com terminais Smart POS (Cielo LIO,
 * Stone Smart P2 e Totem PAX S300) comunicando diretamente pela API /api/admin/tef/processar.
 */

export function tefConfigurado(tef) {
  return !!(tef && (String(tef.agenteUrl || '').trim() || tef.configurado || tef.empresaId))
}

export const MODALIDADES_TEF = [
  { key: 'debito',            label: 'Débito',           icon: '💳' },
  { key: 'credito_avista',    label: 'Crédito à vista',  icon: '💳' },
  { key: 'credito_parcelado', label: 'Crédito parcelado', icon: '💳' },
]

/**
 * Inicia uma transação no agente TEF local ou no motor Kytto TEF Engine e devolve o comprovante.
 * @param {{valor:number, modalidade?:string, parcelas?:number, tef?:object}} opts
 * @returns {Promise<{aprovado:boolean, simulado:boolean, nsu:string, autorizacao:string,
 *   adquirente:string, bandeira:string, parcelas:number, modalidade:string,
 *   comprovanteCliente:string, comprovanteEstabelecimento:string}>}
 */
export async function pagarTef({ valor, modalidade = 'credito_avista', parcelas = 1, tef = {} }) {
  const url = String(tef.agenteUrl || '').trim()

  // 1. Agente TEF local (browser → localhost:4096 CliSiTef / PlugPag)
  if (url) {
    try {
      const resp = await fetch(url.replace(/\/$/, '') + '/tef/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor, modalidade, parcelas,
          terminal: tef.terminal, ambiente: tef.ambiente, adquirente: tef.adquirente,
        }),
      })
      if (resp.ok) {
        const d = await resp.json()
        if (d.aprovado) {
          return {
            aprovado: true, simulado: false,
            nsu: d.nsu || '', autorizacao: d.autorizacao || '',
            adquirente: d.adquirente || tef.adquirente || '',
            bandeira: d.bandeira || '', parcelas: d.parcelas || parcelas, modalidade,
            comprovanteCliente: d.comprovanteCliente || '',
            comprovanteEstabelecimento: d.comprovanteEstabelecimento || '',
          }
        }
      }
    } catch (err) {
      console.warn('[TEF] Agente local indisponível, alternando para motor central TEF...', err?.message)
    }
  }

  // 2. Kytto TEF Engine Central (/api/admin/tef/processar)
  const token = localStorage.getItem('token') || localStorage.getItem('kytto_token') || ''
  const respCentral = await fetch('/api/admin/tef/processar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      terminalId: tef.terminalId || tef.terminal || 'term-stal-01',
      valor,
      modalidade,
      parcelas,
      bandeiraId: tef.bandeira || 'visa',
      clienteNome: tef.clienteNome || 'Consumidor Balcão',
      referenciaVenda: `PDV-${Date.now().toString().slice(-6)}`,
      empresaId: tef.empresaId || undefined,
    }),
  }).catch(() => null)

  if (respCentral && respCentral.ok) {
    const dataCentral = await respCentral.json().catch(() => null)
    if (dataCentral?.sucesso && dataCentral?.transacao) {
      const tx = dataCentral.transacao
      return {
        aprovado: true,
        simulado: false,
        nsu: tx.nsu,
        autorizacao: tx.codigoAutorizacao,
        adquirente: tx.adquirenteId,
        bandeira: tx.bandeiraId,
        parcelas: tx.parcelas || parcelas,
        modalidade: tx.modalidade || modalidade,
        comprovanteCliente: tx.comprovanteCliente || '',
        comprovanteEstabelecimento: tx.comprovanteEstabelecimento || '',
      }
    }
  }

  const error = new Error('TEF não configurado: conecte o terminal de pagamento ou verifique as credenciais da maquininha')
  error.code = 'TEF_NOT_CONFIGURED'
  throw error
}
