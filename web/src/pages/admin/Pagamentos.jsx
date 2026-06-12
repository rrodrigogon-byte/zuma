import { useState, useEffect, useRef, useMemo } from 'react'
import { api, fmtR, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const STATUS_OPTS = ['todos', 'pago', 'pendente', 'cancelado']
const MEIO_OPTS = ['todos', 'pix', 'cartao', 'dinheiro', 'outros']

const statusBadge = (s) => {
  const map = { pago: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-gray' }
  return map[s] || 'badge-gray'
}

function KpiCard({ label, valor, cls }) {
  return (
    <div className={`kpi-card ${cls || ''}`} style={{ flex: 1, minWidth: 140 }}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-valor">{valor}</span>
    </div>
  )
}

function exportCSV(pagamentos) {
  const headers = ['ID', 'Usuário', 'Tipo', 'Meio', 'Valor', 'Data', 'Status']
  const rows = pagamentos.map((p) => [
    p.id,
    p.usuario || '',
    p.tipo || '',
    p.meio || '',
    p.valor ?? 0,
    p.criadoEm ? fmtDate(p.criadoEm) : '',
    p.status,
  ])
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pagamentos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// CSS-only bar chart for last 7 days
function BarChart7({ data }) {
  const [hovered, setHovered] = useState(null)
  if (!data?.length) return <p style={{ color: 'var(--muted)', fontSize: 12 }}>Sem dados.</p>
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
      {data.map((d, i) => {
        const pct = (d.total / max) * 100
        const isHov = hovered === i
        return (
          <div
            key={d.data || i}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHov && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#0E2E1C',
                border: '1px solid var(--green)',
                borderRadius: 6,
                padding: '3px 7px',
                fontSize: 11,
                color: '#fff',
                whiteSpace: 'nowrap',
                zIndex: 10,
                pointerEvents: 'none',
                marginBottom: 3,
              }}>
                {fmtR(d.total)}
              </div>
            )}
            <div
              style={{
                width: '100%',
                height: `${Math.max(pct, 4)}%`,
                background: isHov
                  ? 'linear-gradient(to top, #C9A656, #e8c97a)'
                  : 'linear-gradient(to top, #5FB335, #8FD64A)',
                borderRadius: '3px 3px 0 0',
                minHeight: 4,
                transition: 'background 0.15s',
                cursor: 'default',
              }}
            />
            <span style={{ fontSize: 9, color: 'var(--muted)', transform: 'rotate(-30deg)', whiteSpace: 'nowrap' }}>
              {d.data || ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function startOf(period) {
  const now = new Date()
  if (period === 'hoje') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return d.toISOString()
  }
  if (period === 'semana') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (period === 'mes') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return d.toISOString()
  }
  return null
}

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroMeio, setFiltroMeio] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [confirmando, setConfirmando] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/pagamentos')
      setPagamentos(Array.isArray(data) ? data : (data.pagamentos || []))
    } catch (e) {
      toast('Erro ao carregar pagamentos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtrados = useMemo(() => {
    const cutoff = startOf(filtroPeriodo)
    const q = busca.toLowerCase()
    return pagamentos.filter((p) => {
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false
      if (filtroMeio !== 'todos') {
        const m = (p.meio || '').toLowerCase()
        if (filtroMeio === 'outros') {
          if (['pix', 'cartao', 'dinheiro'].includes(m)) return false
        } else if (m !== filtroMeio) return false
      }
      if (cutoff && p.criadoEm && p.criadoEm < cutoff) return false
      if (q && !((p.usuario || '').toLowerCase().includes(q) || (p.tipo || '').toLowerCase().includes(q) || String(p.id).includes(q))) return false
      return true
    })
  }, [pagamentos, filtroStatus, filtroMeio, filtroPeriodo, busca])

  const totalFiltrado = filtrados.filter((p) => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0)
  const totalRecebido = pagamentos.filter((p) => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0)
  const totalPendente = pagamentos.filter((p) => p.status === 'pendente').reduce((s, p) => s + (p.valor || 0), 0)
  const totalCancelado = pagamentos.filter((p) => p.status === 'cancelado').reduce((s, p) => s + (p.valor || 0), 0)

  // Build last 7 days chart data from all pagamentos pago
  const chart7 = useMemo(() => {
    const days = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ data: key.slice(5), total: 0 })
    }
    pagamentos.forEach((p) => {
      if (p.status !== 'pago' || !p.criadoEm) return
      const key = p.criadoEm.slice(0, 10)
      const idx = days.findIndex((d) => {
        const now2 = new Date()
        const target = new Date(now2)
        target.setDate(target.getDate() - (6 - days.indexOf(d)))
        return target.toISOString().slice(0, 10) === key
      })
      if (idx >= 0) days[idx].total += p.valor || 0
    })
    return days
  }, [pagamentos])

  const handlePatch = async (id, status) => {
    setConfirmando(id)
    try {
      await api.patch(`/api/admin/pagamentos/${id}`, { status })
      toast(`Pagamento marcado como ${status}`)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao atualizar', 'error')
    } finally {
      setConfirmando(null)
    }
  }

  const confirmarManual = (id) => {
    if (!confirm('Confirmar pagamento manualmente?')) return
    handlePatch(id, 'pago')
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Pagamentos</h1>
        <button
          className="btn btn-secondary"
          onClick={() => exportCSV(filtrados)}
          title="Exportar pagamentos visíveis como CSV"
        >
          📥 Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Recebido (total)" valor={fmtR(totalRecebido)} cls="kpi-green" />
        <KpiCard label="Pendente" valor={fmtR(totalPendente)} cls="kpi-yellow" />
        <KpiCard label="Cancelado" valor={fmtR(totalCancelado)} cls="kpi-gray" />
        {filtroPeriodo !== 'todos' && (
          <div className="kpi-card" style={{ flex: 1, minWidth: 140, borderTop: '3px solid #C9A656' }}>
            <span className="kpi-label">Recebido no período</span>
            <span className="kpi-valor" style={{ color: '#C9A656' }}>{fmtR(totalFiltrado)}</span>
          </div>
        )}
      </div>

      {/* Gráfico últimos 7 dias */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#fff' }}>
          Recebido — últimos 7 dias
        </h2>
        <BarChart7 data={chart7} />
      </div>

      {/* Busca */}
      <input
        style={{ width: '100%', padding: '8px 12px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
        placeholder="🔍 Buscar por usuário, tipo ou ID…"
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Período */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['todos', 'Todos'], ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltroPeriodo(val)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid',
                borderColor: filtroPeriodo === val ? 'var(--green)' : '#1e4a2e',
                background: filtroPeriodo === val ? '#5FB33522' : 'transparent',
                color: filtroPeriodo === val ? '#5FB335' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Meio */}
        <select
          value={filtroMeio}
          onChange={(e) => setFiltroMeio(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: filtroMeio !== 'todos' ? '#fff' : 'var(--muted)', fontSize: 13 }}
        >
          <option value="todos">Todos os meios</option>
          <option value="pix">Pix</option>
          <option value="cartao">Cartão</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="outros">Outros</option>
        </select>

        {/* Status */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_OPTS.map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid',
                borderColor: filtroStatus === s ? 'var(--green)' : '#1e4a2e',
                background: filtroStatus === s ? '#5FB33522' : 'transparent',
                color: filtroStatus === s ? '#5FB335' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'todos' && (
                <span style={{ marginLeft: 4, fontSize: 11 }}>
                  ({pagamentos.filter((p) => p.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--muted)', padding: 16 }}>Nenhum pagamento encontrado.</p>
      ) : (
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e4a2e' }}>
                {['#', 'Usuário', 'Tipo', 'Meio', 'Valor', 'Data', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderBottom: '1px solid #1e4a2e11' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a3a2222')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{p.id}</td>
                  <td style={{ padding: '10px 12px', color: '#fff' }}>{p.usuario || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{p.tipo || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)', textTransform: 'capitalize' }}>{p.meio || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{fmtR(p.valor)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{p.criadoEm ? fmtDate(p.criadoEm) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDetalhe(p)}>Ver</button>
                      {p.status === 'pendente' && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={confirmando === p.id}
                          onClick={() => confirmarManual(p.id)}
                        >
                          {confirmando === p.id ? '…' : 'Confirmar'}
                        </button>
                      )}
                      {p.status === 'pago' && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={confirmando === p.id}
                          onClick={() => { if (confirm('Estornar pagamento?')) handlePatch(p.id, 'cancelado') }}
                        >
                          Estornar
                        </button>
                      )}
                      {p.status === 'cancelado' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={confirmando === p.id}
                          onClick={() => confirmarManual(p.id)}
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalhe */}
      {detalhe && (
        <Modal title={`Pagamento #${detalhe.id}`} onClose={() => setDetalhe(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Usuário" value={detalhe.usuario} />
              <Field label="Tipo" value={detalhe.tipo} />
              <Field label="Meio" value={detalhe.meio} />
              <Field label="Valor" value={fmtR(detalhe.valor)} />
              <Field label="Status" value={
                <span className={`badge ${statusBadge(detalhe.status)}`}>{detalhe.status}</span>
              } />
              <Field label="Data" value={detalhe.criadoEm ? fmtDate(detalhe.criadoEm) : '—'} />
              {detalhe.referencia && <Field label="Referência" value={detalhe.referencia} />}
              {detalhe.txid && <Field label="TxID" value={detalhe.txid} />}
            </div>

            {/* QR Pix se disponível */}
            {detalhe.qrCode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>QR Code Pix</span>
                <img
                  src={detalhe.qrCode}
                  alt="QR Code Pix"
                  style={{ width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 4 }}
                />
              </div>
            )}
            {detalhe.pixCopiaECola && (
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Pix Copia e Cola</span>
                <div
                  style={{
                    background: '#0E2E1C',
                    border: '1px solid #1e4a2e',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: '#ddd',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}
                >
                  {detalhe.pixCopiaECola}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, marginTop: 6, padding: '4px 12px' }}
                  onClick={() => { navigator.clipboard?.writeText(detalhe.pixCopiaECola); toast('Copiado!', 'success') }}
                >
                  Copiar
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {detalhe.status === 'pendente' && (
                <button className="btn btn-primary" onClick={() => { confirmarManual(detalhe.id); setDetalhe(null) }}>
                  Confirmar
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#fff' }}>{value || '—'}</div>
    </div>
  )
}
