import { useState, useEffect } from 'react'
import { api, fmtR, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const MODALIDADES = ['Tênis', 'Beach Tennis', 'Padel', 'Squash', 'Funcional', 'Outro']
const NIVEIS = ['Iniciante', 'Intermediário', 'Avançado', 'Todos']
const EMPTY_AULA = { titulo: '', professorId: '', modalidade: 'Tênis', data: '', hora: '', nivel: 'Todos', vagas: 8, preco: '' }

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

  const NIVEL_COLOR = { Iniciante: '#5FB335', Intermediário: '#C9A656', Avançado: '#e05c5c', Todos: '#888' }

  if (loading) return <div style={S.page}><p style={{ color: 'var(--muted)' }}>Carregando…</p></div>

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>Aulas</h1>
        <div style={S.actions}>
          <button style={S.btnOutline} onClick={() => setModalProf(true)}>+ Professor</button>
          <button style={S.btn} onClick={() => { setForm(EMPTY_AULA); setModalAula(true) }}>+ Nova Aula</button>
        </div>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            {['Título', 'Professor', 'Modalidade', 'Data/Hora', 'Nível', 'Vagas', 'Preço', ''].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aulas.length === 0 && (
            <tr><td colSpan={8} style={{ ...S.td, color: 'var(--muted)', textAlign: 'center' }}>Nenhuma aula cadastrada.</td></tr>
          )}
          {aulas.map(a => {
            const prof = professores.find(p => p.id === a.professorId)
            return (
              <tr key={a.id}>
                <td style={S.td}><strong>{a.titulo}</strong></td>
                <td style={S.td}>{prof ? prof.nome : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td style={S.td}><span style={S.badge('#5FB335')}>{a.modalidade}</span></td>
                <td style={S.td}>{a.data} {a.hora}</td>
                <td style={S.td}><span style={S.badge(NIVEL_COLOR[a.nivel] || '#888')}>{a.nivel}</span></td>
                <td style={S.td}>{a.vagas}</td>
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
