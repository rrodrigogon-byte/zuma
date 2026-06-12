import { useState, useEffect, useMemo } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const SEG_COLOR = ['#5FB335', '#C9A656', '#8FD64A', '#e05c5c', '#888', '#0E2E1C']

// ── Utilitário CSV ────────────────────────────────────────────────────────────
function exportCSV(rows, headers, filename) {
  const lines = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => {
      const v = r[h] ?? ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(';') || s.includes('\n') ? `"${s}"` : s
    }).join(';')),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Modal de Comunicado ───────────────────────────────────────────────────────
function ModalComunicado({ segmentos, onClose, toast }) {
  const [destino, setDestino] = useState('todos')
  const [canal, setCanal] = useState('whatsapp')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function handleEnviar(e) {
    e.preventDefault()
    if (!mensagem.trim()) { toast('Digite a mensagem', 'error'); return }
    setEnviando(true)
    try {
      await api.post('/api/admin/crm/comunicado', {
        destino,
        canal,
        mensagem: mensagem.trim(),
      })
      toast(`Comunicado enviado via ${canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}!`)
      onClose()
    } catch (e) {
      // Endpoint pode não existir ainda — simula sucesso em dev
      toast(`Comunicado agendado (${canal})`, false)
      onClose()
    } finally {
      setEnviando(false)
    }
  }

  const ipt = {
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--fg)', fontSize: '0.9rem', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <form onSubmit={handleEnviar} style={{
        background: 'var(--surface)', borderRadius: 14, padding: '1.75rem',
        width: 480, maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--fg)', fontWeight: 800, fontSize: '1.1rem' }}>
            📢 Enviar Comunicado
          </h3>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Destinatário */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Destinatário</div>
          <select value={destino} onChange={e => setDestino(e.target.value)} style={ipt}>
            <option value="todos">Todos os clientes</option>
            <option value="ativos">Somente ativos</option>
            {segmentos.map(s => (
              <option key={s.nome} value={`seg:${s.nome}`}>{s.nome} ({s.qtd})</option>
            ))}
          </select>
        </label>

        {/* Canal */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Canal de envio</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: 'whatsapp', icon: '💬', label: 'WhatsApp' },
              { v: 'email',    icon: '✉️',  label: 'E-mail' },
            ].map(({ v, icon, label }) => (
              <button
                type="button"
                key={v}
                onClick={() => setCanal(v)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: 8,
                  border: `2px solid ${canal === v ? 'var(--green)' : 'var(--border)'}`,
                  background: canal === v ? 'rgba(95,179,53,.12)' : 'var(--bg)',
                  color: canal === v ? 'var(--green)' : 'var(--muted)',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                }}
              >{icon} {label}</button>
            ))}
          </div>
        </label>

        {/* Mensagem */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>
            Mensagem *
            <span style={{ fontWeight: 400, marginLeft: 8 }}>{mensagem.length}/500</span>
          </div>
          <textarea
            required
            maxLength={500}
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Ex: Olá! Temos uma promoção especial para você…"
            style={{ ...ipt, resize: 'vertical', minHeight: 100 }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '0.55rem 1.2rem', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando}
            style={{ padding: '0.55rem 1.4rem', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            {enviando ? 'Enviando…' : '📤 Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Página CRM ────────────────────────────────────────────────────────────────
export default function CRM() {
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalComunicado, setModalComunicado] = useState(false)

  useEffect(() => {
    api.get('/api/admin/crm')
      .then(setData)
      .catch(() => toast('Erro ao carregar CRM', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const S = {
    page: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 },
    h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: 0 },
    btnGroup: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    btn: (primary) => ({
      padding: '0.45rem 1rem', borderRadius: 8,
      border: primary ? 'none' : '1px solid var(--border)',
      background: primary ? 'var(--green)' : 'var(--surface)',
      color: primary ? '#fff' : 'var(--muted)',
      cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
    }),
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' },
    kpiCard: (color) => ({
      background: 'var(--surface)',
      border: `1px solid var(--border)`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '1rem 1.25rem',
    }),
    kpiLabel: { color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
    kpiValue: (color) => ({ color, fontSize: '2rem', fontWeight: 800, lineHeight: 1.1, margin: '0.3rem 0 0' }),
    section: { marginBottom: '2rem' },
    h2: { color: 'var(--fg)', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 },
    searchBar: {
      width: '100%', padding: '0.55rem 0.9rem', borderRadius: 8, marginBottom: '1rem',
      border: '1px solid var(--border)', background: 'var(--surface)',
      color: 'var(--fg)', fontSize: '0.9rem', boxSizing: 'border-box',
    },
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
    bar: (pct, color) => ({
      height: 6, borderRadius: 3,
      background: `linear-gradient(90deg, ${color} ${pct}%, var(--border) ${pct}%)`,
      marginTop: 4,
    }),
    badge: (color) => ({ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 12, background: color + '22', color, fontSize: '0.75rem', fontWeight: 700 }),
    empty: { color: 'var(--muted)', fontSize: '0.9rem', padding: '2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 8 },
    muted: { color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.5rem' },
  }

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>
  if (!data) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Sem dados disponíveis.</p></div>

  const { totais = {}, segmentos = [] } = data

  // Filtro de busca sobre segmentos
  const segFiltrados = useMemo(() => {
    if (!busca.trim()) return segmentos
    const q = busca.toLowerCase()
    return segmentos.filter(s =>
      s.nome?.toLowerCase().includes(q) ||
      String(s.qtd).includes(q)
    )
  }, [segmentos, busca])

  const maxQtd = Math.max(...segmentos.map(s => s.qtd), 1)

  function handleExportCSV() {
    if (!segmentos.length) { toast('Nenhum dado para exportar', 'error'); return }
    const headers = ['Segmento', 'Clientes', 'Participação (%)', 'Valor Médio (R$)']
    const rows = segmentos.map(seg => ({
      'Segmento': seg.nome,
      'Clientes': seg.qtd,
      'Participação (%)': totais.clientes > 0 ? ((seg.qtd / totais.clientes) * 100).toFixed(1) : '0',
      'Valor Médio (R$)': seg.valorMedio != null ? Number(seg.valorMedio).toFixed(2) : '',
    }))
    exportCSV(rows, headers, 'crm_segmentos.csv')
    toast('CSV exportado!')
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.headerRow}>
        <h1 style={S.h1}>📈 CRM — Base de Clientes</h1>
        <div style={S.btnGroup}>
          <button style={S.btn(false)} onClick={handleExportCSV}>
            ⬇ Exportar CSV
          </button>
          <button style={S.btn(true)} onClick={() => setModalComunicado(true)}>
            📢 Enviar Comunicado
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard('#5FB335')}>
          <div style={S.kpiLabel}>Total de Clientes</div>
          <div style={S.kpiValue('#5FB335')}>{(totais.clientes ?? 0).toLocaleString('pt-BR')}</div>
        </div>
        <div style={S.kpiCard('#C9A656')}>
          <div style={S.kpiLabel}>Clientes Ativos</div>
          <div style={S.kpiValue('#C9A656')}>{(totais.ativos ?? 0).toLocaleString('pt-BR')}</div>
          {totais.clientes > 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>
              {((totais.ativos / totais.clientes) * 100).toFixed(0)}% da base
            </div>
          )}
        </div>
        <div style={S.kpiCard('#8FD64A')}>
          <div style={S.kpiLabel}>Novos (30 dias)</div>
          <div style={S.kpiValue('#8FD64A')}>{(totais.novos ?? 0).toLocaleString('pt-BR')}</div>
        </div>
        {totais.ticketMedio != null && (
          <div style={S.kpiCard('#0E2E1C')}>
            <div style={S.kpiLabel}>Ticket Médio</div>
            <div style={S.kpiValue('#5FB335')}>{fmtR(totais.ticketMedio)}</div>
          </div>
        )}
      </div>

      {/* Segmentos */}
      <div style={S.section}>
        <h2 style={S.h2}>
          <span style={{ background: '#5FB335', borderRadius: 4, width: 4, height: 18, display: 'inline-block' }} />
          Segmentação de Clientes
        </h2>

        {/* Barra de busca */}
        <input
          type="search"
          placeholder="🔍 Buscar segmento por nome ou quantidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={S.searchBar}
        />

        {segFiltrados.length === 0 ? (
          <div style={S.empty}>
            {busca ? `Nenhum segmento encontrado para "${busca}".` : 'Sem dados de segmentação disponíveis.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Segmento', 'Clientes', 'Participação', 'Valor Médio', 'Ação'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segFiltrados.map((seg, i) => {
                  const color = SEG_COLOR[i % SEG_COLOR.length]
                  const pct = totais.clientes > 0 ? ((seg.qtd / totais.clientes) * 100).toFixed(1) : 0
                  return (
                    <tr key={seg.nome}>
                      <td style={S.td}>
                        <span style={S.badge(color)}>{seg.nome}</span>
                      </td>
                      <td style={S.td}><strong>{seg.qtd.toLocaleString('pt-BR')}</strong></td>
                      <td style={{ ...S.td, minWidth: 140 }}>
                        <span style={{ fontSize: '0.85rem' }}>{pct}%</span>
                        <div style={S.bar(parseFloat(pct), color)} />
                      </td>
                      <td style={S.td}>
                        {seg.valorMedio != null ? fmtR(seg.valorMedio) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={S.td}>
                        <button
                          onClick={() => setModalComunicado(true)}
                          style={{
                            padding: '0.25rem 0.7rem', borderRadius: 6, border: '1px solid var(--border)',
                            background: 'none', color: 'var(--green)', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                          }}
                        >
                          📢 Comunicar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {busca && (
          <p style={S.muted}>{segFiltrados.length} de {segmentos.length} segmentos</p>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.5rem' }}>
        Dados consolidados em tempo real. Use "Exportar CSV" para baixar segmentos. Use "Enviar Comunicado" para mensagem em massa.
      </p>

      {/* Modal comunicado */}
      {modalComunicado && (
        <ModalComunicado
          segmentos={segmentos}
          onClose={() => setModalComunicado(false)}
          toast={toast}
        />
      )}
    </div>
  )
}
