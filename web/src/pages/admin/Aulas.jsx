import { useState, useEffect, useMemo } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const MODALIDADES = ['Tênis', 'Beach Tennis', 'Padel', 'Squash', 'Funcional', 'Outro']
const NIVEIS = ['Iniciante', 'Intermediário', 'Avançado', 'Todos']
const EMPTY_AULA = { titulo: '', professorId: '', modalidade: 'Tênis', data: '', hora: '', nivel: 'Todos', vagas: 8, preco: '' }

function exportCSV(aulas, professores) {
  const headers = ['ID', 'Título', 'Professor', 'Modalidade', 'Data', 'Hora', 'Nível', 'Vagas', 'Preço']
  const rows = aulas.map(a => {
    const prof = professores.find(p => p.id === a.professorId)
    return [a.id, a.titulo, prof?.nome || '', a.modalidade, a.data, a.hora, a.nivel, a.vagas, a.preco || 0]
  })
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `aulas_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function Aulas() {
  const { toast } = useToast()
  const [aulas, setAulas] = useState([])
  const [professores, setProfessores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAula, setModalAula] = useState(false)
  const [modalProf, setModalProf] = useState(false)
  const [form, setForm] = useState(EMPTY_AULA)
  const [nomeProf, setNomeProf] = useState('')
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroMod, setFiltroMod] = useState('Todas')
  const [filtroNivel, setFiltroNivel] = useState('Todos')

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/admin/aulas/full')
      setAulas(data.aulas || [])
      setProfessores(data.professores || [])
    } catch {
      toast('Erro ao carregar aulas', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function salvarAula() {
    if (!form.titulo.trim()) return toast('Título obrigatório', 'error')
    if (!form.data || !form.hora) return toast('Data e hora obrigatórios', 'error')
    setSaving(true)
    try {
      await api.post('/api/admin/aulas', {
        ...form,
        vagas: parseInt(form.vagas) || 8,
        preco: parseFloat(form.preco) || 0,
        professorId: form.professorId ? parseInt(form.professorId) : null,
      })
      toast('Aula criada')
      setModalAula(false)
      setForm(EMPTY_AULA)
      load()
    } catch {
      toast('Erro ao criar aula', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function salvarProf() {
    if (!nomeProf.trim()) return toast('Nome obrigatório', 'error')
    setSaving(true)
    try {
      await api.post('/api/admin/professores', { nome: nomeProf.trim() })
      toast('Professor cadastrado')
      setModalProf(false)
      setNomeProf('')
      load()
    } catch {
      toast('Erro ao cadastrar professor', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function excluirAula(id, titulo) {
    if (!confirm(`Excluir aula "${titulo}"?`)) return
    try {
      await api.delete(`/api/admin/aulas/${id}`)
      toast('Aula excluída')
      load()
    } catch {
      toast('Erro ao excluir', 'error')
    }
  }

  const S = {
    page: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
    h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: 0 },
    actions: { display: 'flex', gap: 8 },
    btn: { padding: '0.5rem 1rem', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    btnOutline: { padding: '0.5rem 1rem', background: 'var(--surface2)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
    btnSm: (color) => ({ padding: '0.3rem 0.65rem', background: color || 'var(--surface2)', color: color ? '#fff' : 'var(--fg)', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }),
    table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' },
    th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.78rem', padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 600 },
    td: { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.9rem' },
    badge: (color) => ({ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: 12, background: color + '22', color, fontSize: '0.75rem', fontWeight: 700 }),
    field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.85rem' },
    label: { color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600 },
    input: { padding: '0.45rem 0.65rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: '0.9rem' },
    select: { padding: '0.45rem 0.65rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontSize: '0.9rem' },
    section: { marginTop: '2rem' },
    h2: { color: 'var(--fg)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' },
    profList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
    profChip: { padding: '0.3rem 0.8rem', background: 'var(--surface2)', borderRadius: 20, color: 'var(--fg)', fontSize: '0.85rem', border: '1px solid var(--border)' },
  }

  const NIVEL_COLOR = { Iniciante: '#FF6B2C', Intermediário: '#FF6B2C', Avançado: '#e05c5c', Todos: '#888' }

  // KPIs
  const kpis = useMemo(() => {
    const totalVagas = aulas.reduce((s, a) => s + (a.vagas || 0), 0)
    const totalInscritos = aulas.reduce((s, a) => s + (a.inscritos ?? a.alunos?.length ?? 0), 0)
    const receitaPot = aulas.reduce((s, a) => s + (a.preco || 0) * (a.vagas || 0), 0)
    const receitaReal = aulas.reduce((s, a) => s + (a.preco || 0) * (a.inscritos ?? a.alunos?.length ?? 0), 0)
    const ocupacao = totalVagas > 0 ? Math.round((totalInscritos / totalVagas) * 100) : 0
    return { total: aulas.length, professores: professores.length, totalVagas, totalInscritos, receitaPot, receitaReal, ocupacao }
  }, [aulas, professores])

  // Filtros
  const aulasFiltradas = useMemo(() => {
    return aulas.filter(a => {
      if (filtroMod !== 'Todas' && a.modalidade !== filtroMod) return false
      if (filtroNivel !== 'Todos' && a.nivel !== filtroNivel) return false
      if (busca && !a.titulo.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [aulas, filtroMod, filtroNivel, busca])

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>Aulas</h1>
        <div style={S.actions}>
          <button style={S.btnOutline} onClick={() => exportCSV(aulasFiltradas, professores)}>📥 CSV</button>
          <button style={S.btnOutline} onClick={() => setModalProf(true)}>+ Professor</button>
          <button style={S.btn} onClick={() => { setForm(EMPTY_AULA); setModalAula(true) }}>+ Nova Aula</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Aulas', value: kpis.total, color: '#FF6B2C' },
          { label: 'Professores', value: kpis.professores, color: '#FF6B2C' },
          { label: 'Inscritos', value: kpis.totalInscritos, color: '#FF9B72' },
          { label: 'Total Vagas', value: kpis.totalVagas, color: '#3b82f6' },
          { label: 'Ocupação', value: `${kpis.ocupacao}%`, color: kpis.ocupacao >= 80 ? '#e05c5c' : kpis.ocupacao >= 50 ? '#FF6B2C' : '#FF6B2C' },
          { label: 'Receita Realizada', value: fmtR(kpis.receitaReal), color: '#FF6B2C', small: true },
          { label: 'Receita Potencial', value: fmtR(kpis.receitaPot), color: '#FF9B72', small: true },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: k.small ? 15 : 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="🔍 Buscar aula…" value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...S.input, marginBottom: 0, flex: 1, minWidth: 160 }} />
        <select value={filtroMod} onChange={e => setFiltroMod(e.target.value)} style={{ ...S.select, marginBottom: 0 }}>
          <option value="Todas">Todas modalidades</option>
          {MODALIDADES.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} style={{ ...S.select, marginBottom: 0 }}>
          {NIVEIS.map(n => <option key={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{aulasFiltradas.length} de {aulas.length}</span>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            {['Título', 'Professor', 'Modalidade', 'Data/Hora', 'Nível', 'Capacidade', 'Inscritos', 'Preço', ''].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aulasFiltradas.length === 0 && (
            <tr><td colSpan={9} style={{ ...S.td, color: 'var(--muted)', textAlign: 'center' }}>Nenhuma aula encontrada.</td></tr>
          )}
          {aulasFiltradas.map(a => {
            const prof = professores.find(p => p.id === a.professorId)
            const inscritos = a.inscritos ?? (a.alunos?.length ?? 0)
            const vagas = a.vagas || 1
            const pctOcup = Math.min(100, Math.round((inscritos / vagas) * 100))
            const barColor = pctOcup >= 90 ? '#e05c5c' : pctOcup >= 70 ? '#FF6B2C' : '#FF6B2C'
            return (
              <tr key={a.id}>
                <td style={S.td}><strong>{a.titulo}</strong></td>
                <td style={S.td}>{prof ? prof.nome : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td style={S.td}><span style={S.badge('#FF6B2C')}>{a.modalidade}</span></td>
                <td style={S.td}>{a.data} {a.hora}</td>
                <td style={S.td}><span style={S.badge(NIVEL_COLOR[a.nivel] || '#888')}>{a.nivel}</span></td>
                <td style={S.td}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{vagas} vagas</div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', width: 80 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: barColor, width: `${pctOcup}%`, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: barColor, marginTop: 2 }}>{pctOcup}%</div>
                </td>
                <td style={{ ...S.td, fontWeight: 700, color: barColor }}>{inscritos}</td>
                <td style={S.td}>{a.preco > 0 ? fmtR(a.preco) : <span style={{ color: 'var(--muted)' }}>Grátis</span>}</td>
                <td style={S.td}>
                  <button style={S.btnSm('#e05c5c')} onClick={() => excluirAula(a.id, a.titulo)}>Excluir</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={S.section}>
        <h2 style={S.h2}>Professores ({professores.length})</h2>
        <div style={S.profList}>
          {professores.length === 0 && <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Nenhum professor cadastrado.</span>}
          {professores.map(p => (
            <span key={p.id} style={S.profChip}>{p.nome}</span>
          ))}
        </div>
      </div>

      {/* Modal nova aula */}
      <Modal open={modalAula} onClose={() => setModalAula(false)} title="Nova Aula">
        <div>
          <div style={S.field}>
            <label style={S.label}>Título *</label>
            <input style={S.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Tênis para Iniciantes" />
          </div>
          <div style={S.field}>
            <label style={S.label}>Professor</label>
            <select style={S.select} value={form.professorId} onChange={e => setForm(f => ({ ...f, professorId: e.target.value }))}>
              <option value="">— Sem professor —</option>
              {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.field}>
              <label style={S.label}>Modalidade</label>
              <select style={S.select} value={form.modalidade} onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))}>
                {MODALIDADES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Nível</label>
              <select style={S.select} value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}>
                {NIVEIS.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Data *</label>
              <input style={S.input} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Hora *</label>
              <input style={S.input} type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Vagas</label>
              <input style={S.input} type="number" min="1" value={form.vagas} onChange={e => setForm(f => ({ ...f, vagas: e.target.value }))} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Preço (R$)</label>
              <input style={S.input} type="number" step="0.01" min="0" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0 = grátis" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={{ ...S.btnSm(), padding: '0.5rem 1rem' }} onClick={() => setModalAula(false)}>Cancelar</button>
            <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={salvarAula} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar Aula'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal novo professor */}
      <Modal open={modalProf} onClose={() => setModalProf(false)} title="Novo Professor">
        <div>
          <div style={S.field}>
            <label style={S.label}>Nome *</label>
            <input style={S.input} value={nomeProf} onChange={e => setNomeProf(e.target.value)} placeholder="Nome do professor" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={{ ...S.btnSm(), padding: '0.5rem 1rem' }} onClick={() => setModalProf(false)}>Cancelar</button>
            <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={salvarProf} disabled={saving}>
              {saving ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
