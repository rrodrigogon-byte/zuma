/**
 * AcompanharPedido.jsx — acompanhamento público do pedido da loja pelo código.
 * Rota: /pedido/:codigo. Faz polling de GET /api/loja/pedido/:codigo e mostra a
 * linha do tempo (Recebido → Em preparação → Pronto → Entregue).
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'

const ETAPAS = [
  { key: 'pendente',   label: 'Recebido',        emoji: '🧾' },
  { key: 'preparando', label: 'Em preparação',   emoji: '👨‍🍳' },
  { key: 'pronto',     label: 'Pronto p/ retirar', emoji: '✅' },
  { key: 'entregue',   label: 'Entregue',        emoji: '📦' },
]
const VERDE = '#5FB335'

export default function AcompanharPedido() {
  const { codigo } = useParams()
  const [pedido, setPedido] = useState(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/api/loja/pedido/${encodeURIComponent(codigo)}`)
      setPedido(d); setErro('')
    } catch (e) {
      setErro(e.message || 'Pedido não encontrado')
    } finally { setLoading(false) }
  }, [codigo])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const idxAtual = pedido ? ETAPAS.findIndex(e => e.key === pedido.status) : -1
  const cancelado = pedido?.status === 'cancelado'

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', fontFamily: "'Segoe UI', sans-serif", padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Link to="/loja" style={{ color: '#1B4D2E', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Voltar à loja</Link>

        <div style={{ background: '#fff', borderRadius: 18, padding: '24px 22px', marginTop: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7a9a7a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Acompanhar pedido</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1B4D2E', letterSpacing: '0.04em', marginTop: 2 }}>{codigo}</div>

          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#7a9a7a' }}>Carregando…</div>
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
                          background: feito ? VERDE : '#eef2e8',
                          color: feito ? '#fff' : '#9ab09a',
                          boxShadow: atual ? `0 0 0 4px ${VERDE}33` : 'none',
                          transition: 'all .2s',
                        }}>{feito ? e.emoji : '○'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: atual ? 800 : 600, color: feito ? '#1B4D2E' : '#9ab09a', fontSize: '0.98rem' }}>
                            {e.label}{atual ? ' • agora' : ''}
                          </div>
                        </div>
                        {feito && <span style={{ color: VERDE, fontWeight: 800 }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Itens */}
              <div style={{ marginTop: 16, background: '#f8faf4', borderRadius: 12, padding: '12px 14px' }}>
                {(pedido.itens || []).map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', padding: '4px 0', color: '#1B4D2E' }}>
                    <span><b>{it.qtd}×</b> {it.nome}{it.tamanho ? ` (${it.tamanho})` : ''}</span>
                    <span style={{ fontWeight: 700, color: VERDE }}>{fmtR(it.subtotal ?? (it.preco || 0) * (it.qtd || 1))}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e3ecda', marginTop: 6, paddingTop: 6, fontWeight: 800, color: '#1B4D2E' }}>
                  <span>Total</span><span style={{ color: '#C9A656' }}>{fmtR(pedido.total || 0)}</span>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#5a7a5a' }}>
                Pagamento: <b>{pedido.pagamento === 'pago' ? 'confirmado ✓' : 'Pix pendente ⏳'}</b>
                {pedido.status === 'pronto' && <div style={{ marginTop: 8, background: '#eaf7e0', border: `1px solid ${VERDE}`, borderRadius: 10, padding: '10px 12px', color: '#1B4D2E', fontWeight: 600 }}>🎾 Seu pedido está pronto! Retire no Tangará Tênis Clube apresentando o código <b>{codigo}</b>.</div>}
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.74rem', color: '#9ab09a' }}>Atualiza automaticamente a cada 10s</div>
      </div>
    </div>
  )
}
