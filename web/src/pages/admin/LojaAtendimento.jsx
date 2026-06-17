/**
 * LojaAtendimento.jsx — Atendimento da Loja
 * Quadro (kanban) dos pedidos da loja: o cliente lança o pedido em /loja e ele cai
 * aqui para a organização PREPARAR o material → LIBERAR (pronto) → ENTREGAR.
 * Atualização ao vivo via SSE (/api/events, evento 'loja') + polling de fallback.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const COLUNAS = [
  { key: 'pendente',   titulo: 'Aguardando preparo', cor: '#C9A656', acao: { label: '▶ Iniciar preparo', to: 'preparando' } },
  { key: 'preparando', titulo: 'Em preparação',      cor: '#3498db', acao: { label: '✅ Liberar (pronto)', to: 'pronto' } },
  { key: 'pronto',     titulo: 'Pronto p/ retirada',  cor: '#5FB335', acao: { label: '📦 Entregar', to: 'entregue' } },
  { key: 'entregue',   titulo: 'Entregues (hoje)',    cor: '#6a7a6a', acao: null },
]

function tempoAtras(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return `há ${h}h${min % 60 ? ` ${min % 60}min` : ''}`
}

const hojeISO = () => new Date().toISOString().slice(0, 10)

export default function LojaAtendimento() {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)        // id em transição
  const pollRef = useRef(null)

  const load = useCallback(async (quiet = false) => {
    try {
      const data = await api.get('/api/admin/loja/pedidos')
      setPedidos(Array.isArray(data) ? data : [])
    } catch (e) {
      if (!quiet) toast(e.message || 'Erro ao carregar pedidos', 'error')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(true), 8000)
    // SSE: refetch imediato quando um pedido muda no servidor (best-effort)
    let es
    try {
      es = new EventSource('/api/events')
      es.addEventListener('loja', () => load(true))
    } catch { /* sem SSE → segue só com polling */ }
    return () => { clearInterval(pollRef.current); if (es) es.close() }
  }, [load])

  const mudarStatus = async (p, status) => {
    setBusy(p.id)
    try {
      await api.patch(`/api/admin/loja/pedidos/${p.id}`, { status })
      await load(true)
      const labels = { preparando: 'em preparação', pronto: 'liberado', entregue: 'entregue', cancelado: 'cancelado' }
      toast(`Pedido ${p.codigo} ${labels[status] || status}`)
    } catch (e) { toast(e.message || 'Erro ao atualizar', 'error') }
    finally { setBusy(null) }
  }

  // Agrupa por status. "entregue" só mostra os de hoje (evita acúmulo infinito).
  const porStatus = useMemo(() => {
    const g = { pendente: [], preparando: [], pronto: [], entregue: [] }
    for (const p of pedidos) {
      if (p.status === 'entregue') { if ((p.atualizadoEm || '').slice(0, 10) === hojeISO()) g.entregue.push(p) }
      else if (g[p.status]) g[p.status].push(p)
    }
    // mais antigos primeiro nas colunas de trabalho (FIFO); entregues mais recentes primeiro
    g.pendente.sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))
    g.preparando.sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))
    g.pronto.sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))
    g.entregue.sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''))
    return g
  }, [pedidos])

  const ativos = porStatus.pendente.length + porStatus.preparando.length + porStatus.pronto.length

  return (
    <div className="page" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🛍️ Atendimento da Loja</h1>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
            {ativos} pedido{ativos !== 1 ? 's' : ''} em aberto · atualiza ao vivo
          </div>
        </div>
        <button className="btn" onClick={() => load()} style={{ fontSize: 13 }}>↺ Atualizar</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
          {COLUNAS.map(col => {
            const lista = porStatus[col.key] || []
            return (
              <div key={col.key} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 12, minHeight: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${col.cor}` }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: col.cor }}>{col.titulo}</span>
                  <span style={{ background: col.cor, color: '#06120a', borderRadius: 20, padding: '1px 9px', fontWeight: 800, fontSize: 12 }}>{lista.length}</span>
                </div>

                {lista.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '18px 0', opacity: .6 }}>—</div>
                ) : lista.map(p => (
                  <div key={p.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 900, color: 'var(--gold, #C9A656)', fontSize: 15, letterSpacing: '.04em' }}>{p.codigo}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{tempoAtras(p.criadoEm)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{p.cliente?.nome || '—'}</div>
                    {p.cliente?.tel && <div style={{ fontSize: 11, color: 'var(--muted)' }}>📞 {p.cliente.tel}</div>}

                    <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {(p.itens || []).map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span><b style={{ color: 'var(--lime, #8FD64A)' }}>{it.qtd}×</b> {it.nome}{it.tamanho ? ` (${it.tamanho})` : ''}</span>
                          <span style={{ color: 'var(--muted)' }}>{fmtR(it.subtotal ?? (it.preco || 0) * (it.qtd || 1))}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--line)', paddingTop: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: p.pagamento === 'pago' ? '#5FB335' : '#C9A656', fontWeight: 700 }}>
                        {p.pagamento === 'pago' ? '✓ pago' : '⏳ pix pendente'}
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--gold, #C9A656)' }}>{fmtR(p.total || 0)}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {col.acao && (
                        <button
                          onClick={() => mudarStatus(p, col.acao.to)}
                          disabled={busy === p.id}
                          style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', background: col.cor, color: '#06120a', fontWeight: 800, fontSize: 12, cursor: busy === p.id ? 'wait' : 'pointer' }}>
                          {busy === p.id ? '…' : col.acao.label}
                        </button>
                      )}
                      {col.key !== 'entregue' && (
                        <button
                          onClick={() => { if (window.confirm(`Cancelar o pedido ${p.codigo}? O estoque será reposto.`)) mudarStatus(p, 'cancelado') }}
                          disabled={busy === p.id}
                          title="Cancelar pedido"
                          style={{ width: 36, padding: '8px 0', borderRadius: 9, border: '1px solid #5a2a2a', background: 'transparent', color: '#e05c5c', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
