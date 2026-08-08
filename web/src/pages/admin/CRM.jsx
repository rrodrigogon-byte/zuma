import { useState, useEffect, useMemo } from 'react'
import { api, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

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
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Modal de Comunicado ───────────────────────────────────────────────────────
function ModalComunicado({ segmentos, onClose, toast }) {
  const [destino, setDestino] = useState('todos')
  const [canal, setCanal] = useState('email')
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function handleEnviar(e) {
    e.preventDefault()
    if (!mensagem.trim()) { toast('Digite a mensagem', 'error'); return }
    setEnviando(true)
    try {
      const r = await api.post('/api/admin/comunicacao', {
        segmento: destino,
        canal,
        assunto: assunto.trim() || 'Comunicado Kytto Clube',
        mensagem: mensagem.trim(),
      })
      setResultado(r.campanha)
    } catch (e) {
      toast(e.message || 'Erro ao enviar comunicado', 'error')
    } finally {
      setEnviando(false)
    }
  }

  const ipt = {
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--fg)', fontSize: '0.9rem', boxSizing: 'border-box',
  }

  if (resultado) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '2rem', width: 440, maxWidth: '95vw', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ color: 'var(--fg)', fontWeight: 800, marginBottom: 8 }}>Comunicado Registrado!</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 16 }}>
            <strong>{resultado.destinatarios}</strong> destinatário(s) via <strong>{resultado.canal}</strong>.<br />
            Status: <strong>{resultado.status}</strong>
          </p>
          {resultado.amostra?.length > 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 16 }}>
              Amostra: {resultado.amostra.join(', ')}
            </p>
          )}
          {resultado.obs && (
            <p style={{ color: 'var(--muted)', fontSize: '0.78rem', fontStyle: 'italic', marginBottom: 20 }}>{resultado.obs}</p>
          )}
          <button onClick={onClose} style={{ padding: '0.6rem 1.6rem', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <form onSubmit={handleEnviar} style={{ background: 'var(--surface)', borderRadius: 14, padding: '1.75rem', width: 500, maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--fg)', fontWeight: 800, fontSize: '1.1rem' }}>📢 Enviar Comunicado</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Destinatário */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Destinatário</div>
          <select value={destino} onChange={e => setDestino(e.target.value)} style={ipt}>
            <option value="todos">Todos os atletas</option>
            <option value="ativos">Somente ativos (inscrito recente)</option>
            <option value="inativos">Inativos (90+ dias)</option>
            <option value="aniversariantes">Aniversariantes do mês</option>
            {segmentos?.maioresConsumidores?.length > 0 && (
              <option value="top10">Top 10 consumidores</option>
            )}
          </select>
        </label>

        {/* Canal */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Canal de envio</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ v: 'email', icon: '✉️', label: 'E-mail' }, { v: 'whatsapp', icon: '💬', label: 'WhatsApp' }].map(({ v, icon, label }) => (
              <button type="button" key={v} onClick={() => setCanal(v)} style={{
                flex: 1, padding: '0.6rem', borderRadius: 8,
                border: `2px solid ${canal === v ? 'var(--green)' : 'var(--border)'}`,
                background: canal === v ? 'rgba(255,107,44,.12)' : 'var(--bg)',
                color: canal === v ? 'var(--green)' : 'var(--muted)',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
              }}>{icon} {label}</button>
            ))}
          </div>
        </label>

        {/* Assunto */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Assunto (e-mail)</div>
          <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Ex: Oferta especial para sócios" style={ipt} />
        </label>

        {/* Mensagem */}
        <label>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>
            Mensagem * <span style={{ fontWeight: 400 }}>{mensagem.length}/500</span>
          </div>
          <textarea required maxLength={500} value={mensagem} onChange={e => setMensagem(e.target.value)}
            placeholder="Ex: Olá! Temos uma promoção especial para você…"
            style={{ ...ipt, resize: 'vertical', minHeight: 100 }} />
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.55rem 1.2rem', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button type="submit" disabled={enviando} style={{ padding: '0.55rem 1.4rem', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            {enviando ? 'Enviando…' : '📤 Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Sub-tabelas ───────────────────────────────────────────────────────────────
function TabelaMaioresConsumidores({ lista, onComunicar }) {
  const S = {
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
  }
  if (!lista?.length) return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Nenhum dado disponível.</p>
  const max = lista[0]?.total || 1
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead><tr>
          <th style={S.th}>#</th>
          <th style={S.th}>Cliente</th>
          <th style={S.th}>E-mail</th>
          <th style={S.th}>Consumo Total</th>
          <th style={S.th}>Participação</th>
          <th style={S.th}>Ação</th>
        </tr></thead>
        <tbody>
          {lista.map((c, i) => {
            const pct = ((c.total / max) * 100).toFixed(0)
            const cor = i === 0 ? '#FF6B2C' : i < 3 ? '#FF9B72' : '#FF6B2C'
            return (
              <tr key={c.email}>
                <td style={{ ...S.td, fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}>{i + 1}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{c.nome}</td>
                <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{c.email}</td>
                <td style={S.td}>
                  <span style={{ fontWeight: 800, color: cor }}>{fmtR(c.total)}</span>
                  <div style={{ height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${cor} ${pct}%, var(--border) ${pct}%)`, marginTop: 4 }} />
                </td>
                <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{pct}% do líder</td>
                <td style={S.td}>
                  <button onClick={() => onComunicar(c.email)} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>📢</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabelaAniversariantes({ lista }) {
  const S = {
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
  }
  if (!lista?.length) return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Nenhum aniversariante este mês. 🎉</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead><tr>
          <th style={S.th}>Nome</th>
          <th style={S.th}>E-mail</th>
          <th style={S.th}>Data de Nasc.</th>
          <th style={S.th}>Ação</th>
        </tr></thead>
        <tbody>
          {lista.map(a => (
            <tr key={a.email}>
              <td style={{ ...S.td, fontWeight: 700 }}>🎂 {a.nome}</td>
              <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{a.email}</td>
              <td style={S.td}>{a.nasc ? new Date(a.nasc + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td style={S.td}>
                <button style={{ padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                  🎁 Parabenizar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaInativos({ lista, onComunicar }) {
  const [busca, setBusca] = useState('')
  const S = {
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
  }
  const filtrado = useMemo(() => {
    if (!busca.trim()) return lista || []
    const q = busca.toLowerCase()
    return (lista || []).filter(i => i.nome?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q))
  }, [lista, busca])

  if (!lista?.length) return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Nenhum cliente inativo encontrado.</p>
  return (
    <>
      <input type="search" placeholder="🔍 Filtrar por nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)}
        style={{ width: '100%', padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontSize: '0.9rem', marginBottom: 12, boxSizing: 'border-box' }} />
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Nome</th>
            <th style={S.th}>E-mail</th>
            <th style={S.th}>Inativo há</th>
            <th style={S.th}>Risco</th>
            <th style={S.th}>Ação</th>
          </tr></thead>
          <tbody>
            {filtrado.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)' }}>Nenhum resultado.</td></tr>}
            {filtrado.map(i => {
              const dias = i.diasInativo
              const risco = dias == null ? 'Nunca acessou' : dias > 180 ? 'Alto' : dias > 90 ? 'Médio' : 'Baixo'
              const riscoColor = dias == null ? '#e05c5c' : dias > 180 ? '#e05c5c' : dias > 90 ? '#FF6B2C' : '#FF9B72'
              return (
                <tr key={i.email}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{i.nome}</td>
                  <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{i.email}</td>
                  <td style={S.td}>{dias != null ? `${dias} dias` : '—'}</td>
                  <td style={S.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: riscoColor + '22', color: riscoColor }}>{risco}</span>
                  </td>
                  <td style={S.td}>
                    <button onClick={() => onComunicar(i.email)} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>📢 Reativar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>{filtrado.length} de {lista.length} registros</p>
    </>
  )
}

// ── Tab Atletas completa ──────────────────────────────────────────────────────
function TabelaAtletas({ toast }) {
  const [atletas, setAtletas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroRole, setFiltroRole] = useState('todos')

  useEffect(() => {
    api.get('/api/admin/usuarios')
      .then(setAtletas)
      .catch(() => toast('Erro ao carregar atletas', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return atletas.filter(u => {
      const matchQ = !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      const matchR = filtroRole === 'todos' || u.role === filtroRole
      return matchQ && matchR
    })
  }, [atletas, busca, filtroRole])

  function handleCSV() {
    const headers = ['Nome', 'E-mail', 'Perfil', 'Status', 'Último Acesso']
    const rows = lista.map(u => [
      u.nome, u.email, u.role,
      u.ativo !== false ? 'Ativo' : 'Inativo',
      u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString('pt-BR') : '—'
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `atletas_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast('CSV exportado!')
  }

  const ROLE_COLORS = {
    admin: '#e05c5c', organizador: '#FF6B2C', staff: '#FF6B2C', atleta: '#FF9B72'
  }

  // KPIs rápidos
  const kAtivos = atletas.filter(u => u.ativo !== false).length
  const kAtletas = atletas.filter(u => u.role === 'atleta').length
  const kStaff = atletas.filter(u => ['admin','organizador','staff'].includes(u.role)).length

  if (loading) return <p style={{ color: 'var(--muted)', padding: 20 }}>Carregando…</p>

  const S = {
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
  }

  return (
    <>
      {/* Mini KPIs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: atletas.length, color: 'var(--green)' },
          { label: 'Ativos', value: kAtivos, color: '#FF6B2C' },
          { label: 'Atletas', value: kAtletas, color: '#FF9B72' },
          { label: 'Staff/Admin', value: kStaff, color: '#FF6B2C' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderLeft: `4px solid ${k.color}`, borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros + CSV */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" placeholder="🔍 Buscar nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontSize: '0.9rem' }} />
        <select value={filtroRole} onChange={e => setFiltroRole(e.target.value)}
          style={{ padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontSize: '0.9rem' }}>
          <option value="todos">Todos os perfis</option>
          {['admin','organizador','staff','atleta'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={handleCSV} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--green)', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          ⬇ CSV
        </button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{lista.length} de {atletas.length}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' }}>
          <thead><tr>
            {['Nome', 'E-mail', 'Perfil', 'Status', 'Último Acesso'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)' }}>Nenhum resultado.</td></tr>}
            {lista.map(u => {
              const cor = ROLE_COLORS[u.role] || '#888'
              return (
                <tr key={u.id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{u.nome}</td>
                  <td style={{ ...S.td, color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                  <td style={S.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: cor + '22', color: cor }}>{u.role}</span>
                  </td>
                  <td style={S.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: u.ativo !== false ? '#FF6B2C22' : '#e05c5c22', color: u.ativo !== false ? '#FF6B2C' : '#e05c5c' }}>
                      {u.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: 'var(--muted)' }}>
                    {u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>{lista.length} registros</p>
    </>
  )
}

// ── Página CRM principal ──────────────────────────────────────────────────────
export default function CRM() {
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('consumidores')
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
    btn: (primary) => ({
      padding: '0.45rem 1rem', borderRadius: 8,
      border: primary ? 'none' : '1px solid var(--border)',
      background: primary ? 'var(--green)' : 'var(--surface)',
      color: primary ? '#fff' : 'var(--muted)',
      cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
    }),
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: '1.5rem' },
    kpiCard: (color) => ({
      background: 'var(--surface)', border: `1px solid var(--border)`,
      borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '1rem 1.25rem',
    }),
    kpiLabel: { color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
    kpiValue: (color) => ({ color, fontSize: '2rem', fontWeight: 800, lineHeight: 1.1, margin: '0.3rem 0 0' }),
    tabBar: { display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: '1.25rem', flexWrap: 'wrap' },
    tabBtn: (active) => ({
      padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
      background: 'none', color: active ? 'var(--green)' : 'var(--muted)',
      borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
    }),
  }

  function handleExportCSV() {
    if (!data) return
    const segs = data.segmentos || {}
    const lista = segs.maioresConsumidores || []
    if (!lista.length) { toast('Nenhum dado para exportar', 'error'); return }
    exportCSV(
      lista.map(c => ({ Nome: c.nome, Email: c.email, 'Consumo Total (R$)': Number(c.total || 0).toFixed(2) })),
      ['Nome', 'Email', 'Consumo Total (R$)'],
      'crm_maiores_consumidores.csv'
    )
    toast('CSV exportado!')
  }

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>
  if (!data) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Sem dados disponíveis.</p></div>

  // O servidor retorna: { totais: {...}, segmentos: { maioresConsumidores, aniversariantes, inativos } }
  const totais = data.totais || {}
  const segs = data.segmentos || {}

  const TABS = [
    { id: 'consumidores', label: `💰 Maiores Consumidores (${segs.maioresConsumidores?.length || 0})` },
    { id: 'aniversariantes', label: `🎂 Aniversariantes (${segs.aniversariantes?.length || 0})` },
    { id: 'inativos', label: `💤 Inativos (${segs.inativos?.length || 0})` },
    { id: 'atletas', label: `👤 Todos os Atletas` },
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.headerRow}>
        <h1 style={S.h1}>📈 CRM — Base de Clientes</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.btn(false)} onClick={handleExportCSV}>⬇ Exportar CSV</button>
          <button style={S.btn(true)} onClick={() => setModalComunicado(true)}>📢 Enviar Comunicado</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard('#FF6B2C')}>
          <div style={S.kpiLabel}>Total de Atletas</div>
          <div style={S.kpiValue('#FF6B2C')}>{(totais.clientes ?? 0).toLocaleString('pt-BR')}</div>
        </div>
        <div style={S.kpiCard('#FF6B2C')}>
          <div style={S.kpiLabel}>Com Inscrição</div>
          <div style={S.kpiValue('#FF6B2C')}>{(totais.comInscricao ?? 0).toLocaleString('pt-BR')}</div>
          {totais.clientes > 0 && <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>
            {((totais.comInscricao / totais.clientes) * 100).toFixed(0)}% da base
          </div>}
        </div>
        <div style={S.kpiCard('#FF9B72')}>
          <div style={S.kpiLabel}>Com Consumo</div>
          <div style={S.kpiValue('#FF9B72')}>{(totais.comConsumo ?? 0).toLocaleString('pt-BR')}</div>
        </div>
        <div style={S.kpiCard('#e05c5c')}>
          <div style={S.kpiLabel}>Inativos (90d+)</div>
          <div style={S.kpiValue('#e05c5c')}>{(segs.inativos?.length ?? 0).toLocaleString('pt-BR')}</div>
          {totais.clientes > 0 && <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>
            {(((segs.inativos?.length || 0) / totais.clientes) * 100).toFixed(0)}% da base
          </div>}
        </div>
        <div style={S.kpiCard('#12283F')}>
          <div style={S.kpiLabel}>Aniversariantes (mês)</div>
          <div style={S.kpiValue('#FF6B2C')}>{(segs.aniversariantes?.length ?? 0).toLocaleString('pt-BR')}</div>
        </div>
      </div>

      {/* Abas */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {tab === 'consumidores' && (
        <TabelaMaioresConsumidores lista={segs.maioresConsumidores} onComunicar={() => setModalComunicado(true)} />
      )}
      {tab === 'aniversariantes' && (
        <TabelaAniversariantes lista={segs.aniversariantes} />
      )}
      {tab === 'inativos' && (
        <TabelaInativos lista={segs.inativos} onComunicar={() => setModalComunicado(true)} />
      )}
      {tab === 'atletas' && (
        <TabelaAtletas toast={toast} />
      )}

      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '1.5rem' }}>
        Dados consolidados em tempo real. Use "Enviar Comunicado" para disparar campanhas registradas no sistema.
      </p>

      {/* Modal comunicado */}
      {modalComunicado && (
        <ModalComunicado segmentos={segs} onClose={() => setModalComunicado(false)} toast={toast} />
      )}
    </div>
  )
}
