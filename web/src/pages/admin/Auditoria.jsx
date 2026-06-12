import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function exportCSV(logs) {
  const headers = ['ID', 'Data/Hora', 'Usuário', 'Ação', 'Dados']
  const rows = logs.map(l => [
    l.id ?? '',
    l.criadoEm ? new Date(l.criadoEm).toLocaleString('pt-BR') : '',
    l.usuario || 'sistema',
    l.acao || '',
    typeof l.dados === 'object' ? JSON.stringify(l.dados) : String(l.dados || ''),
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function JsonPreview({ dados }) {
  const [expanded, setExpanded] = useState(false)
  if (!dados) return <span style={{ color: 'var(--muted)' }}>—</span>

  let str
  try {
    str = typeof dados === 'string' ? dados : JSON.stringify(dados)
  } catch {
    str = String(dados)
  }

  const compact = str.length > 80 ? str.slice(0, 80) + '…' : str

  if (str.length <= 80) {
    return <code style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{str}</code>
  }

  return (
    <div>
      {expanded ? (
        <pre style={{
          fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace',
          background: 'var(--surface2)', padding: '0.4rem 0.6rem', borderRadius: 5,
          maxHeight: 180, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {(() => { try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str } })()}
        </pre>
      ) : (
        <code style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{compact}</code>
      )}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '0.75rem', cursor: 'pointer', padding: '2px 0', marginTop: 2, display: 'block' }}
      >
        {expanded ? '▲ Recolher' : '▼ Expandir'}
      </button>
    </div>
  )
}

const ACAO_COLORS = {
  login: '#5FB335',
  logout: '#888',
  create: '#8FD64A',
  update: '#C9A656',
  delete: '#e05c5c',
  pagamento: '#5FB335',
  erro: '#e05c5c',
}

function acaoColor(acao) {
  if (!acao) return '#888'
  const lower = acao.toLowerCase()
  for (const [key, color] of Object.entries(ACAO_COLORS)) {
    if (lower.includes(key)) return color
  }
  return '#888'
}

export default function Auditoria() {
  const { toast } = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]           = useState('')
  const [limit, setLimit]           = useState(100)
  const [filtroAcao, setFiltroAcao] = useState('todas')

  const load = useCallback(async (lim = limit) => {
    setLoading(true)
    try {
      const data = await api.get(`/api/admin/auditoria?limit=${lim}`)
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      toast('Erro ao carregar auditoria', 'error')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => { load() }, [load])

  // Ações únicas para o filtro
  const acoesUnicas = useMemo(() => {
    const set = new Set(logs.map(l => l.acao).filter(Boolean))
    return [...set].sort()
  }, [logs])

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return logs.filter(log => {
      if (filtroAcao !== 'todas' && log.acao !== filtroAcao) return false
      if (!q) return true
      return (
        (log.acao || '').toLowerCase().includes(q) ||
        (log.usuario || '').toLowerCase().includes(q)
      )
    })
  }, [logs, busca, filtroAcao])

  const S = {
    page: { padding: '1.5rem', maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 },
    h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: 0 },
    toolbar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    searchBox: {
      padding: '0.45rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, color: 'var(--fg)', fontSize: '0.9rem', width: 220,
    },
    select: {
      padding: '0.45rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, color: 'var(--fg)', fontSize: '0.9rem',
    },
    btnSm: (color) => ({
      padding: '0.4rem 0.8rem', background: color || 'var(--surface2)',
      color: color ? '#fff' : 'var(--fg)', border: 'none', borderRadius: 5,
      cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
    }),
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' },
    td: { padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.88rem', verticalAlign: 'top' },
    badge: (color) => ({
      display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 12,
      background: color + '22', color, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
    }),
    muted: { color: 'var(--muted)', fontSize: '0.78rem' },
    count: { color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>Log de Auditoria</h1>
        <div style={S.toolbar}>
          <input
            style={S.searchBox}
            type="search"
            placeholder="Buscar por ação ou usuário…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <select
            style={S.select}
            value={filtroAcao}
            onChange={e => setFiltroAcao(e.target.value)}
          >
            <option value="todas">Todas as ações</option>
            {acoesUnicas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            style={S.select}
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); load(Number(e.target.value)) }}
          >
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={250}>Últimos 250</option>
            <option value={500}>Últimos 500</option>
          </select>
          <button style={S.btnSm('var(--green)')} onClick={() => load()}>↻ Atualizar</button>
          <button style={S.btnSm()} onClick={() => exportCSV(filtered)}>⬇ CSV</button>
        </div>
      </div>

      {busca && (
        <p style={S.count}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "<strong>{busca}</strong>"
          {' '}de {logs.length} registros
        </p>
      )}

      {loading ? (
        <p style={S.muted}>Carregando…</p>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['#', 'Data/Hora', 'Usuário', 'Ação', 'Dados'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                  {busca ? 'Nenhum resultado encontrado.' : 'Nenhum registro de auditoria.'}
                </td>
              </tr>
            )}
            {filtered.map((log, idx) => {
              const color = acaoColor(log.acao)
              return (
                <tr key={log.id ?? idx}>
                  <td style={{ ...S.td, color: 'var(--muted)', width: 50 }}>{log.id ?? idx + 1}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap', width: 160 }}>
                    {fmtDate ? fmtDate(log.criadoEm) : new Date(log.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ ...S.td, width: 140 }}>
                    <strong>{log.usuario || <span style={{ color: 'var(--muted)' }}>sistema</span>}</strong>
                  </td>
                  <td style={{ ...S.td, width: 160 }}>
                    <span style={S.badge(color)}>{log.acao || '—'}</span>
                  </td>
                  <td style={S.td}>
                    <JsonPreview dados={log.dados} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <p style={{ ...S.muted, marginTop: '1rem' }}>
        Exibindo {filtered.length} de {logs.length} registros. Use a busca para filtrar por ação ou usuário.
      </p>
    </div>
  )
}
