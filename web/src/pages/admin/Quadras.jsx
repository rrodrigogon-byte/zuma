import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const fmtData = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function exportCSV(reservas) {
  const headers = ['ID', 'Quadra', 'Data', 'Início', 'Fim', 'Responsável', 'Status', 'Obs']
  const rows = reservas.map(r => [r.id, r.quadraNome, r.data, r.horaInicio, r.horaFim, r.socioNome, r.status, r.obs || ''])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `reservas_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}
const HORAS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
}).filter(h => h <= '22:00')
const TIPOS = ['Tênis', 'Padel', 'Beach Tennis', 'Squash', 'Poliesportiva', 'Outros']
const CORES = ['#FF6B2C', '#FF6B2C', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#14b8a6']

const S = {
  page:  { padding: '24px 28px', maxWidth: 1100 },
  hdr:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 800, color: 'var(--cream)' },
  btn:   { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 },
  card:  { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' },
  th:    { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.03)' },
  td:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--line)' },
  inp:   { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--cream)', fontSize: 13 },
  lbl:   { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 },
}

function StatusBadge({ status }) {
  const map = { confirmada: ['#d1fae5','#065f46','Confirmada'], cancelada: ['#fee2e2','#991b1b','Cancelada'], pendente: ['#fef3c7','#92400e','Pendente'] }
  const [bg, color, label] = map[status] || map.pendente
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color }}>{label}</span>
}

function Grade({ quadras, reservas, dataRef, onNovaReserva }) {
  const hoje = dataRef || new Date().toISOString().slice(0, 10)
  const resHoje = reservas.filter(r => r.data === hoje && r.status !== 'cancelada')

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${quadras.length}, 1fr)`, minWidth: 600, fontSize: 12 }}>
        {/* header */}
        <div style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.04)' }}>Horário</div>
        {quadras.map(q => (
          <div key={q.id} style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--cream)', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.04)', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: q.cor, marginRight: 5 }} />{q.nome}
          </div>
        ))}
        {/* slots */}
        {HORAS.slice(0, -1).map(h => (
          [<div key={h} style={{ padding: '6px 10px', color: 'var(--muted)', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11 }}>{h}</div>,
          ...quadras.map(q => {
            const hFim = HORAS[HORAS.indexOf(h) + 1]
            const res = resHoje.find(r => r.quadraId == q.id && r.horaInicio <= h && r.horaFim > h)
            return (
              <div key={q.id} onClick={() => !res && onNovaReserva(q, h, hFim)}
                style={{
                  padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,.04)', borderLeft: '1px solid var(--line)',
                  cursor: res ? 'default' : 'pointer', minHeight: 32, fontSize: 11,
                  background: res ? (res.horaInicio === h ? 'rgba(255,107,44,.18)' : 'rgba(255,107,44,.08)') : 'transparent',
                  color: res ? 'var(--green)' : 'transparent',
                  transition: 'background .1s',
                }}
                title={res ? `${res.socioNome} ${res.horaInicio}–${res.horaFim}` : `Reservar ${q.nome} ${h}`}
              >
                {res?.horaInicio === h ? `${res.socioNome.split(' ')[0]}` : ''}
              </div>
            )
          })]
        ))}
      </div>
    </div>
  )
}

export default function Quadras() {
  const { toast } = useToast()
  const [tab, setTab] = useState('grade')
  const [quadras, setQuadras] = useState([])
  const [reservas, setReservas] = useState([])
  const [dataRef, setDataRef] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [modalQuadra, setModalQuadra] = useState(null)
  const [modalReserva, setModalReserva] = useState(null)
  const [fq, setFq] = useState({ nome: '', tipo: 'Tênis', cor: '#FF6B2C', descricao: '' })
  const [fr, setFr] = useState({ quadraId: '', data: '', horaInicio: '', horaFim: '', socioNome: '', obs: '' })
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroQ, setFiltroQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [q, r] = await Promise.all([api.get('/api/admin/quadras'), api.get('/api/admin/reservas')])
      setQuadras(q); setReservas(r)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // KPIs
  const hoje = new Date().toISOString().slice(0, 10)
  const kpis = useMemo(() => {
    const resHoje = reservas.filter(r => r.data === hoje && r.status !== 'cancelada')
    const resSemana = reservas.filter(r => {
      const d = new Date(r.data + 'T12:00:00')
      const ini = new Date(); ini.setDate(ini.getDate() - ini.getDay())
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      return d >= ini && d <= fim && r.status !== 'cancelada'
    })
    const totalSlots = quadras.filter(q => q.ativa !== false).length * HORAS.slice(0,-1).length
    const ocupadosHoje = resHoje.reduce((s, r) => {
      const ini = HORAS.indexOf(r.horaInicio), fim = HORAS.indexOf(r.horaFim)
      return s + (fim - ini > 0 ? fim - ini : 1)
    }, 0)
    return {
      hoje: resHoje.length,
      semana: resSemana.length,
      quadrasAtivas: quadras.filter(q => q.ativa !== false).length,
      taxaOcup: totalSlots > 0 ? Math.round((ocupadosHoje / totalSlots) * 100) : 0,
    }
  }, [reservas, quadras, hoje])

  const reservasFiltradas = useMemo(() => {
    return reservas.filter(r => {
      if (tab === 'grade') return r.data === dataRef
      if (tab === 'reservas') {
        if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false
        if (filtroQ && !r.socioNome?.toLowerCase().includes(filtroQ.toLowerCase()) && !r.quadraNome?.toLowerCase().includes(filtroQ.toLowerCase())) return false
        return r.data === dataRef
      }
      return true
    })
  }, [reservas, tab, dataRef, filtroStatus, filtroQ])

  async function salvarQuadra(e) {
    e.preventDefault()
    try {
      if (modalQuadra?.id) { await api.patch(`/api/admin/quadras/${modalQuadra.id}`, fq); toast('Quadra atualizada') }
      else { await api.post('/api/admin/quadras', fq); toast('Quadra criada') }
      setModalQuadra(null); load()
    } catch (e) { toast(e.message, true) }
  }

  async function excluirQuadra(id) {
    if (!confirm('Excluir quadra e todas as reservas?')) return
    try { await api.delete(`/api/admin/quadras/${id}`); toast('Excluída'); load() }
    catch (e) { toast(e.message, true) }
  }

  async function salvarReserva(e) {
    e.preventDefault()
    try {
      if (modalReserva?.id) {
        await api.patch(`/api/admin/reservas/${modalReserva.id}`, fr)
        toast('Reserva atualizada')
      } else {
        await api.post('/api/reservas', fr)
        toast('Reserva criada')
      }
      setModalReserva(null); load()
    } catch (e) { toast(e.message, true) }
  }

  async function cancelarReserva(id) {
    if (!confirm('Cancelar esta reserva?')) return
    try { await api.patch(`/api/reservas/${id}/cancelar`, {}); toast('Reserva cancelada'); load() }
    catch (e) { toast(e.message, true) }
  }

  function abrirNovaReservaGrade(q, hIni, hFim) {
    setFr({ quadraId: q.id, data: dataRef, horaInicio: hIni, horaFim: hFim, socioNome: '', obs: '' })
    setModalReserva({})
  }

  const TABS = ['grade', 'reservas', 'quadras']

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div style={S.title}>🎾 Quadras & Reservas</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => exportCSV(reservas)}
            style={{ ...S.btn, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)' }}>📥 CSV</button>
          <button onClick={() => { setFq({ nome: '', tipo: 'Tênis', cor: '#FF6B2C', descricao: '' }); setModalQuadra({}) }}
            style={{ ...S.btn, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)' }}>+ Quadra</button>
          <button onClick={() => { setFr({ quadraId: quadras[0]?.id || '', data: dataRef, horaInicio: '08:00', horaFim: '09:00', socioNome: '', obs: '' }); setModalReserva({}) }}
            style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)' }}>+ Reserva</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Reservas hoje', value: kpis.hoje, color: '#FF6B2C', icon:'📅' },
          { label: 'Na semana', value: kpis.semana, color: '#FF6B2C', icon:'📆' },
          { label: 'Quadras ativas', value: kpis.quadrasAtivas, color: '#3b82f6', icon:'🎾' },
          { label: 'Ocupação hoje', value: `${kpis.taxaOcup}%`,
            color: kpis.taxaOcup > 60 ? '#FF6B2C' : kpis.taxaOcup > 30 ? '#FF6B2C' : '#888', icon:'📊',
            sub: kpis.taxaOcup > 60 ? 'Alta ocupação' : kpis.taxaOcup > 30 ? 'Média' : 'Baixa' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight:700 }}>{k.label}</span>
              <span style={{ fontSize:16 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: 'none', color: tab === t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent', textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'grade' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Clique num slot livre para reservar</span>
          </div>
          {loading ? <div style={{ color: 'var(--muted)', padding: 24 }}>Carregando…</div> : (
            quadras.length === 0
              ? <div style={{ color: 'var(--muted)', padding: 32, textAlign: 'center' }}>Nenhuma quadra cadastrada. Adicione uma quadra primeiro.</div>
              : <div style={S.card}><Grade quadras={quadras} reservas={reservas} dataRef={dataRef} onNovaReserva={abrirNovaReservaGrade} /></div>
          )}
        </>
      )}

      {tab === 'reservas' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 }} />
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13 }}>
              <option value="todos">Todos os status</option>
              <option value="confirmada">Confirmadas</option>
              <option value="pendente">Pendentes</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <input placeholder="🔍 Buscar responsável ou quadra…" value={filtroQ} onChange={e => setFiltroQ(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--cream)', fontSize: 13, flex: 1, minWidth: 180 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...S.card, width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Quadra', 'Data', 'Horário', 'Responsável', 'Status', 'Obs', 'Ações'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {reservasFiltradas.length === 0 && (
                  <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhuma reserva</td></tr>
                )}
                {reservasFiltradas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)).map(r => (
                  <tr key={r.id}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{r.quadraNome}</td>
                    <td style={S.td}>{fmtData(r.data)}</td>
                    <td style={S.td}>{r.horaInicio}–{r.horaFim}</td>
                    <td style={S.td}>{r.socioNome}</td>
                    <td style={S.td}><StatusBadge status={r.status} /></td>
                    <td style={{ ...S.td, color: 'var(--muted)', fontSize: 11 }}>{r.obs || '—'}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status !== 'cancelada' && (
                          <button onClick={() => cancelarReserva(r.id)}
                            style={{ ...S.btn, padding: '4px 9px', background: '#fee2e2', color: '#991b1b', fontSize: 11 }}>Cancelar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'quadras' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {quadras.length === 0 && <div style={{ color: 'var(--muted)', padding: 16 }}>Nenhuma quadra cadastrada.</div>}
          {quadras.map(q => (
            <div key={q.id} style={{ ...S.card, padding: 18, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: q.cor, flexShrink: 0 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--cream)' }}>{q.nome}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{q.tipo}</div>
              {q.descricao && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{q.descricao}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: q.ativa !== false ? '#d1fae5' : '#fee2e2',
                  color: q.ativa !== false ? '#065f46' : '#991b1b' }}>
                  {q.ativa !== false ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setFq({ nome: q.nome, tipo: q.tipo, cor: q.cor, descricao: q.descricao, ativa: q.ativa }); setModalQuadra(q) }}
                  style={{ ...S.btn, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cream)', fontSize: 11 }}>Editar</button>
                <button onClick={() => api.patch(`/api/admin/quadras/${q.id}`, { ativa: q.ativa === false }).then(load)}
                  style={{ ...S.btn, padding: '4px 10px', background: '#fef3c7', color: '#92400e', fontSize: 11 }}>
                  {q.ativa === false ? 'Ativar' : 'Desativar'}
                </button>
                <button onClick={() => excluirQuadra(q.id)}
                  style={{ ...S.btn, padding: '4px 10px', background: '#fee2e2', color: '#991b1b', fontSize: 11 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal quadra */}
      {modalQuadra !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={salvarQuadra} style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 18, color: 'var(--cream)' }}>{modalQuadra?.id ? 'Editar Quadra' : 'Nova Quadra'}</h3>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Nome *</span>
              <input required value={fq.nome} onChange={e => setFq(f => ({ ...f, nome: e.target.value }))} style={S.inp} placeholder="Ex: Quadra 1" />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Tipo</span>
              <select value={fq.tipo} onChange={e => setFq(f => ({ ...f, tipo: e.target.value }))} style={S.inp}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Cor de identificação</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CORES.map(c => (
                  <div key={c} onClick={() => setFq(f => ({ ...f, cor: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: fq.cor === c ? '3px solid white' : '3px solid transparent',
                    boxShadow: fq.cor === c ? '0 0 0 2px var(--green)' : 'none',
                  }} />
                ))}
              </div>
            </label>
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={S.lbl}>Descrição</span>
              <input value={fq.descricao} onChange={e => setFq(f => ({ ...f, descricao: e.target.value }))} style={S.inp} placeholder="Saibro, iluminação noturna…" />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalQuadra(null)} style={{ ...S.btn, background: 'none', border: '1px solid var(--line)', color: 'var(--muted)' }}>Cancelar</button>
              <button type="submit" style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal reserva */}
      {modalReserva !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={salvarReserva} style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: 420, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 18, color: 'var(--cream)' }}>Nova Reserva</h3>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Quadra *</span>
              <select required value={fr.quadraId} onChange={e => setFr(f => ({ ...f, quadraId: e.target.value }))} style={S.inp}>
                <option value="">Selecione…</option>
                {quadras.filter(q => q.ativa !== false).map(q => <option key={q.id} value={q.id}>{q.nome} ({q.tipo})</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Data *</span>
              <input required type="date" value={fr.data} onChange={e => setFr(f => ({ ...f, data: e.target.value }))} style={S.inp} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label>
                <span style={S.lbl}>Início *</span>
                <select required value={fr.horaInicio} onChange={e => setFr(f => ({ ...f, horaInicio: e.target.value }))} style={S.inp}>
                  <option value="">—</option>
                  {HORAS.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
              <label>
                <span style={S.lbl}>Fim *</span>
                <select required value={fr.horaFim} onChange={e => setFr(f => ({ ...f, horaFim: e.target.value }))} style={S.inp}>
                  <option value="">—</option>
                  {HORAS.slice(1).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={S.lbl}>Responsável *</span>
              <input required value={fr.socioNome} onChange={e => setFr(f => ({ ...f, socioNome: e.target.value }))} style={S.inp} placeholder="Nome do sócio ou atleta" />
            </label>
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={S.lbl}>Observações</span>
              <input value={fr.obs} onChange={e => setFr(f => ({ ...f, obs: e.target.value }))} style={S.inp} placeholder="Aula, treino, torneio…" />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalReserva(null)} style={{ ...S.btn, background: 'none', border: '1px solid var(--line)', color: 'var(--muted)' }}>Cancelar</button>
              <button type="submit" style={{ ...S.btn, background: 'var(--green)', color: 'var(--deep)' }}>Confirmar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
