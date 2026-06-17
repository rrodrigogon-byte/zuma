/**
 * NotasFiscais.jsx — conciliação e gestão das NFC-e do bar.
 * Lista as notas emitidas (status, número, chave, valor), permite cancelar (prazo
 * legal) e reemitir comandas rejeitadas/contingência. Atualiza via SSE + polling.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const STATUS = {
  autorizada:  { label: 'Autorizada',  cor: '#5FB335', bg: 'rgba(95,179,53,.12)' },
  processando: { label: 'Processando', cor: '#3498db', bg: 'rgba(52,152,219,.12)' },
  contingencia:{ label: 'Contingência', cor: '#C9A656', bg: 'rgba(201,166,86,.12)' },
  rejeitada:   { label: 'Rejeitada',   cor: '#e05c5c', bg: 'rgba(224,92,92,.12)' },
  cancelada:   { label: 'Cancelada',   cor: '#8a8a8a', bg: 'rgba(138,138,138,.12)' },
}
const badge = s => STATUS[s] || { label: s, cor: '#8a8a8a', bg: 'rgba(138,138,138,.12)' }

export default function NotasFiscais() {
  const { toast } = useToast()
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [busy, setBusy] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(async (quiet = false) => {
    try {
      const d = await api.get('/api/admin/notas')
      setNotas(Array.isArray(d) ? d : [])
    } catch (e) { if (!quiet) toast(e.message || 'Erro ao carregar notas', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(true), 10000)
    let es
    try { es = new EventSource('/api/events'); es.addEventListener('nfce', () => load(true)) } catch { /* polling */ }
    return () => { clearInterval(pollRef.current); if (es) es.close() }
  }, [load])

  const cancelar = async (n) => {
    const just = window.prompt('Justificativa do cancelamento (mín. 15 caracteres):', 'Cancelamento dentro do prazo legal')
    if (!just || just.trim().length < 15) { if (just != null) toast('Justificativa muito curta', 'error'); return }
    setBusy(n.id)
    try {
      await api.post(`/api/admin/notas/${n.id}/cancelar`, { justificativa: just.trim() })
      await load(true); toast(`Nota ${n.numero} cancelada`)
    } catch (e) { toast(e.message || 'Erro ao cancelar', 'error') }
    finally { setBusy(null) }
  }

  const reemitir = async (n) => {
    setBusy(n.id)
    try {
      const r = await api.post(`/api/admin/comanda/${n.vendaId}/nfce`, {})
      await load(true); toast(`Reemitida: ${r?.nota?.status || 'ok'}`)
    } catch (e) { toast(e.message || 'Erro ao reemitir', 'error') }
    finally { setBusy(null) }
  }

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return notas
    return notas.filter(n => String(n.numero).includes(q) || (n.chaveAcesso || '').includes(q) || (n.cpfConsumidor || '').includes(q) || (n.status || '').includes(q))
  }, [notas, filtro])

  const kpi = useMemo(() => {
    const aut = notas.filter(n => n.status === 'autorizada')
    return { total: notas.length, autorizadas: aut.length, valor: aut.reduce((s, n) => s + (n.valorTotal || 0), 0),
      pendentes: notas.filter(n => ['rejeitada', 'contingencia', 'processando'].includes(n.status)).length }
  }, [notas])

  return (
    <div className="page" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🧾 Notas Fiscais (NFC-e)</h1>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
            {kpi.autorizadas} autorizadas · {fmtR(kpi.valor)}{kpi.pendentes ? ` · ${kpi.pendentes} a resolver` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Buscar nº / chave / CPF…" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ maxWidth: 220 }} />
          <button className="btn" onClick={() => load()}>↺</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : filtradas.length === 0 ? (
        <div className="empty" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          Nenhuma nota emitida ainda. Ative a NFC-e em <strong>Configurações → Fiscal</strong> e feche uma comanda do bar.
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '8px 6px' }}>Nº/Série</th>
                <th style={{ padding: '8px 6px' }}>Emitida</th>
                <th style={{ padding: '8px 6px' }}>Valor</th>
                <th style={{ padding: '8px 6px' }}>CPF</th>
                <th style={{ padding: '8px 6px' }}>Chave de acesso</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(n => {
                const b = badge(n.status)
                return (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{n.numero}/{n.serie}{n.simulado ? ' 🧪' : ''}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--muted)' }}>{fmtDate ? fmtDate(n.criadaEm) : (n.criadaEm || '').slice(0, 16).replace('T', ' ')}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--gold,#C9A656)' }}>{fmtR(n.valorTotal || 0)}</td>
                    <td style={{ padding: '8px 6px' }}>{n.cpfConsumidor || '—'}</td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>{n.chaveAcesso ? n.chaveAcesso.replace(/(.{4})/g, '$1 ').trim() : '—'}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{ background: b.bg, color: b.cor, borderRadius: 20, padding: '2px 10px', fontWeight: 800, fontSize: 11 }}>{b.label}</span>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {n.danfeUrl && <a href={n.danfeUrl} target="_blank" rel="noreferrer" className="btn" style={{ fontSize: 11, marginRight: 4 }}>DANFE</a>}
                      {n.status === 'autorizada' && (
                        <button className="btn" disabled={busy === n.id} onClick={() => cancelar(n)} style={{ fontSize: 11, color: '#e05c5c', borderColor: '#5a2a2a' }}>Cancelar</button>
                      )}
                      {(n.status === 'rejeitada' || n.status === 'contingencia') && (
                        <button className="btn" disabled={busy === n.id} onClick={() => reemitir(n)} style={{ fontSize: 11, color: '#8FD64A' }}>Reemitir</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
