/**
 * AcompanharPedido.jsx — acompanhamento público do pedido da loja pelo código.
 * Rota: /pedido/:codigo. Faz polling de GET /api/loja/pedido/:codigo e mostra a
 * linha do tempo (Recebido → Em preparação → Pronto → Entregue).
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'
import { normalizeStorefrontAlias, storefrontApiBase, storefrontRoute } from '../../lib/storefront'

const ETAPAS = [
  { key: 'pendente',   label: 'Recebido',        emoji: '🧾' },
  { key: 'preparando', label: 'Em preparação',   emoji: '👨‍🍳' },
  { key: 'pronto',     label: 'Pronto p/ retirar', emoji: '✅' },
  { key: 'entregue',   label: 'Entregue',        emoji: '📦' },
]
const CORE_STATUS = { pending_payment: 'pendente', payment_failed: 'pendente', fraud_review: 'pendente', paid: 'preparando', processing: 'preparando', ready: 'pronto', ready_for_pickup: 'pronto', shipped: 'entregue', out_for_delivery: 'entregue', delivered: 'entregue', picked_up: 'entregue', completed: 'entregue', cancelled: 'cancelado', refunded: 'cancelado', partially_refunded: 'cancelado', returned: 'cancelado' }
const CORE_STATUS_LABEL = { pending_payment: 'Aguardando pagamento', payment_failed: 'Pagamento recusado', paid: 'Pagamento confirmado', processing: 'Em preparação', ready: 'Pronto para envio', shipped: 'Enviado', delivered: 'Entregue', completed: 'Concluído', cancelled: 'Cancelado' }
const FULFILLMENT_LABEL = { pending: 'Aguardando preparação', preparing: 'Em separação', ready: 'Pronto para envio', shipped: 'Enviado', out_for_delivery: 'Em rota de entrega', delivered: 'Entregue', picked_up: 'Retirado', failed: 'Falha na entrega', cancelled: 'Entrega cancelada' }
function fmtDate(value) { if (!value) return 'Atualização'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR') }
function shippingPromise(option) {
  const total = option?.deliveryRange?.max ?? option?.deliveryDays;
  if (option?.preparationDays !== null && option?.preparationDays !== undefined && option?.providerDeliveryDays !== null && option?.providerDeliveryDays !== undefined && total !== null && total !== undefined) return `${option.carrier || 'Transportadora'} · ${option.preparationDays} dias úteis de preparação e postagem + ${option.providerDeliveryDays} dias úteis de transporte · total estimado: ${total} dias úteis`;
  return `${option?.carrier || 'Transportadora'}${option?.deliveryRange?.max ? ` · até ${option.deliveryRange.max} dias úteis` : ''}`;
}

function normalizeCoreOrder(order) {
  return {
    ...order,
    codigo: order.public_code,
    coreStatus: order.status || null,
    status: CORE_STATUS[order.status] || 'pendente',
    pagamento: order.status === 'paid' || order.status === 'completed' ? 'pago' : 'pix-pendente',
    itens: (order.items || []).map(item => ({ nome: item.nome, qtd: item.quantidade, preco: item.preco, subtotal: item.subtotal })),
    fulfillments: Array.isArray(order.fulfillments) ? order.fulfillments : [],
    timeline: Array.isArray(order.timeline) ? order.timeline : [],
    shippingOption: order.shippingOption || order.shipping_option || null,
    isCore: true,
  }
}

export default function AcompanharPedido() {
  const { codigo, storeAlias: routeAlias = '' } = useParams()
  const storeAlias = normalizeStorefrontAlias(routeAlias)
  const storefrontApi = storefrontApiBase(storeAlias)
  const storeRoute = storefrontRoute(storeAlias, 'store')
  const accent = storeAlias === 'dino' ? '#6E7CE0' : '#FF6B2C'
  const [pedido, setPedido] = useState(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      try {
        const core = await api.get(`${storefrontApi}/orders/${encodeURIComponent(codigo)}`)
        setPedido(normalizeCoreOrder(core))
      } catch (coreError) {
        if (storeAlias || coreError.status !== 404) throw coreError
        const legacy = await api.get(`/api/loja/pedido/${encodeURIComponent(codigo)}`)
        setPedido(legacy)
      }
      setErro('')
    } catch (e) {
      setErro(e.message || 'Pedido não encontrado')
    } finally { setLoading(false) }
  }, [codigo, storefrontApi, storeAlias])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const idxAtual = pedido ? ETAPAS.findIndex(e => e.key === pedido.status) : -1
  const cancelado = pedido?.status === 'cancelado'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: "'Segoe UI', sans-serif", padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Link to={storeRoute} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Voltar à loja</Link>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '24px 22px', marginTop: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5A6570', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Acompanhar pedido</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#12283F', letterSpacing: '0.04em', marginTop: 2 }}>{codigo}</div>

          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#5A6570' }}>Carregando…</div>
          ) : erro ? (
            <div style={{ marginTop: 18, background: '#fff4f4', border: '1px solid #e0b0b0', borderRadius: 12, padding: '16px', color: '#a33', fontSize: '0.9rem' }}>
              {erro}. Confira o código do pedido.
            </div>
          ) : (
            <>
              {/* Status atual / timeline */}
              {cancelado ? (
                <div style={{ marginTop: 18, background: '#fff4f4', border: '1px solid #e0b0b0', borderRadius: 12, padding: '16px', color: '#a33', fontWeight: 700 }}>
                  ❌ Pedido cancelado
                </div>
              ) : (
                <div style={{ marginTop: 22, marginBottom: 8 }}>
                  {ETAPAS.map((e, i) => {
                    const feito = i <= idxAtual
                    const atual = i === idxAtual
                    return (
                      <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0' }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                          background: feito ? accent : '#FFF9F5',
                          color: feito ? '#fff' : '#8AA9C0',
                          boxShadow: atual ? `0 0 0 4px ${accent}33` : 'none',
                          transition: 'all .2s',
                        }}>{feito ? e.emoji : '○'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: atual ? 800 : 600, color: feito ? '#12283F' : '#8AA9C0', fontSize: '0.98rem' }}>
                            {e.label}{atual ? ' • agora' : ''}
                          </div>
                        </div>
                        {feito && <span style={{ color: accent, fontWeight: 800 }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pós-venda e rastreio */}
              {(pedido.isCore || pedido.fulfillments?.length || pedido.timeline?.length) && <section style={{ marginTop: 18, border: '1px solid #F0DED2', borderRadius: 14, padding: '16px', background: '#FFFCFA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}><div><div style={{ color: accent, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pós-venda</div><h2 style={{ margin: '3px 0 0', color: '#12283F', fontSize: '1.05rem' }}>Entrega e acompanhamento</h2></div><span style={{ color: '#12283F', background: '#FFF0E8', borderRadius: 999, padding: '6px 10px', fontSize: '0.72rem', fontWeight: 800 }}>{CORE_STATUS_LABEL[pedido.coreStatus || ''] || pedido.coreStatus || pedido.status}</span></div>
                {pedido.shippingOption?.deliveryDays !== null && pedido.shippingOption?.deliveryDays !== undefined && <div style={{ marginTop: 12, background: '#FFF4EC', borderRadius: 10, padding: '10px 12px' }}><small style={{ color: '#5A6570', display: 'block' }}>Prazo total estimado</small><strong style={{ display: 'block', color: '#12283F', fontSize: '0.82rem', lineHeight: 1.45 }}>{shippingPromise(pedido.shippingOption)}</strong></div>}{pedido.fulfillments?.[0] ? <div style={{ marginTop: 14, display: 'grid', gap: 10 }}><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ color: accent, fontSize: '1.2rem' }}>▣</span><div><strong style={{ display: 'block', color: '#12283F' }}>{FULFILLMENT_LABEL[pedido.fulfillments[0].status] || pedido.fulfillments[0].status}</strong><small style={{ color: '#5A6570' }}>{pedido.fulfillments[0].carrier || 'Logística da loja'}</small></div></div>{pedido.fulfillments[0].trackingCode && <div style={{ background: '#FFF4EC', borderRadius: 10, padding: '10px 12px' }}><small style={{ color: '#5A6570', display: 'block' }}>Código de rastreio</small><strong style={{ color: '#12283F', letterSpacing: '0.05em' }}>{pedido.fulfillments[0].trackingCode}</strong></div>}{pedido.fulfillments[0].trackingUrl && <a href={pedido.fulfillments[0].trackingUrl} target="_blank" rel="noreferrer" style={{ color: accent, fontWeight: 800, fontSize: '0.84rem' }}>Acompanhar na transportadora →</a>}{Array.isArray(pedido.fulfillments[0].ocorrencias) && pedido.fulfillments[0].ocorrencias.slice(0, 5).map((event, index) => <div key={`${event.at || index}-${index}`} style={{ borderTop: '1px solid #F0DED2', paddingTop: 8 }}><small style={{ color: '#8AA9C0', display: 'block' }}>{fmtDate(event.at || event.data)}</small><span style={{ color: '#12283F', fontSize: '0.82rem' }}>{event.description || event.descricao || event.status || event.mensagem || 'Movimentação registrada'}</span></div>)}</div> : <div style={{ marginTop: 12, color: '#5A6570', fontSize: '0.82rem' }}>Após a confirmação do pagamento, a loja separará o pedido e publicará o código de rastreio nesta área.</div>}
                {pedido.timeline?.length > 0 && <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>{pedido.timeline.slice(-6).map((event, index) => <div key={`${event.at || index}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 0.8fr) 1fr', gap: 8, borderTop: '1px solid #F0DED2', paddingTop: 8 }}><small style={{ color: '#8AA9C0' }}>{fmtDate(event.at)}</small><span style={{ color: '#12283F', fontWeight: 700, fontSize: '0.82rem' }}>{CORE_STATUS_LABEL[event.toStatus] || event.toStatus || 'Atualização do pedido'}</span></div>)}</div>}
              </section>}

              {/* Itens */}
              <div style={{ marginTop: 16, background: '#FFF9F5', borderRadius: 12, padding: '12px 14px' }}>
                {(pedido.itens || []).map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', padding: '4px 0', color: '#12283F' }}>
                    <span><b>{it.qtd}×</b> {it.nome}{it.tamanho ? ` (${it.tamanho})` : ''}</span>
                    <span style={{ fontWeight: 700, color: accent }}>{fmtR(it.subtotal ?? (it.preco || 0) * (it.qtd || 1))}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FFF9F5', marginTop: 6, paddingTop: 6, fontWeight: 800, color: '#12283F' }}>
                  <span>Total</span><span style={{ color: '#FF6B2C' }}>{fmtR(pedido.total || 0)}</span>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#5A6570' }}>
                Pagamento: <b>{pedido.pagamento === 'pago' ? 'confirmado ✓' : 'Pix pendente ⏳'}</b>
                {pedido.status === 'pronto' && <div style={{ marginTop: 8, background: '#FFF9F5', border: `1px solid ${accent}`, borderRadius: 10, padding: '10px 12px', color: '#12283F', fontWeight: 600 }}>{pedido.entrega?.mode === 'entrega' ? 'Seu pedido está pronto para entrega.' : 'Seu pedido está pronto! Retire no local apresentando o código'} <b>{codigo}</b>.</div>}
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.74rem', color: '#8AA9C0' }}>Atualiza automaticamente a cada 10s</div>
      </div>
    </div>
  )
}
