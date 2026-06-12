import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const CATEGORIAS = [
  { value: 'aviso',     label: 'Aviso',     color: '#C9A656' },
  { value: 'resultado', label: 'Resultado', color: '#5FB335' },
  { value: 'novidade',  label: 'Novidade',  color: '#8FD64A' },
]

const EMPTY = { titulo: '', resumo: '', conteudo: '', categoria: 'aviso', publicado: false }

function catInfo(cat) {
  return CATEGORIAS.find(c => c.value === cat) || { label: cat, color: '#888' }
}

function Badge({ categoria }) {
  const { label, color } = catInfo(categoria)
  return (
    <span style={{
      display: 'inline-block', padding: '0.18rem 0.55rem',
      borderRadius: 12, background: color + '22', color, fontSize: '0.72rem', fontWeight: 700,
    }}>{label}</span>
  )
}

function StatusBadge({ publicado }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.18rem 0.55rem',
      borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
      background: publicado ? 'rgba(95,179,53,.15)' : 'rgba(136,136,136,.15)',
      color: publicado ? '#5FB335' : '#888',
    }}>{publicado ? 'Publicado' : 'Rascunho'}</span>
  )
}

const S = {
  page: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 },
  h1: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.4rem', margin: 0 },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  filterBtn: (active) => ({
    padding: '0.35rem 0.9rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
    border: '1px solid var(--line)', cursor: 'pointer',
    background: active ? 'var(--green)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--muted)',
    transition: 'all .15s',
  }),
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' },
  th: { background: 'var(--surface2)', color: 'var(--muted)', fontSize: '0.75rem', padding: '0.6rem 0.85rem', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' },
  td: { padding: '0.7rem 0.85rem', borderBottom: '1px solid var(--line)', color: 'var(--fg)', fontSize: '0.9rem', verticalAlign: 'middle' },
  actions: { display: 'flex', gap: 8 },
  empty: { textAlign: 'center', color: 'var(--muted)', padding: '3rem', fontSize: '0.95rem' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' },
  input: { padding: '0.5rem 0.75rem', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)', fontSize: '0.9rem' },
  textarea: { padding: '0.5rem 0.75rem', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg)', fontSize: '0.9rem', resize: 'vertical', minHeight: 90 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  toggle: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', fontWeight: 600, color: 'var(--fg)', cursor: 'pointer', userSelect: 'none' },
  previewBox: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '1.2rem', marginTop: 8 },
  previewTitle: { color: 'var(--fg)', fontWeight: 700, fontSize: '1.2rem', marginBottom: 6 },
  previewResumo: { color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 10 },
  previewContent: { color: 'var(--fg)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 },
}

export default function Noticias() {
  const { toast } = useToast()
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(null)   // null | 'criar' | 'editar' | 'preview'
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [previewTarget, setPreviewTarget] = useState(null)

  function load() {
    api.get('/api/admin/noticias')
      .then(setNoticias)
      .catch(() => toast('Erro ao carregar notícias', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openCriar() { setForm(EMPTY); setEditId(null); setModal('criar') }
  function openEditar(n) { setForm({ titulo: n.titulo, resumo: n.resumo, conteudo: n.conteudo, categoria: n.categoria, publicado: n.publicado }); setEditId(n.id); setModal('editar') }
  function openPreview(n) { setPreviewTarget(n); setModal('preview') }

  async function salvar() {
    if (!form.titulo.trim()) { toast('Título obrigatório', 'error'); return }
    setSaving(true)
    try {
      if (editId) {
        await api.patch(`/api/admin/noticias/${editId}`, form)
        toast('Notícia atualizada')
      } else {
        await api.post('/api/admin/noticias', form)
        toast('Notícia criada')
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta notícia?')) return
    try {
      await api.delete(`/api/admin/noticias/${id}`)
      toast('Excluída')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  async function togglePublicado(n) {
    try {
      await api.patch(`/api/admin/noticias/${n.id}`, { publicado: !n.publicado })
      toast(n.publicado ? 'Movido para rascunho' : 'Publicado!')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const [busca, setBusca] = useState('')

  const filtradas = noticias.filter(n => {
    if (filtro === 'publicados') return n.publicado
    if (filtro === 'rascunhos') return !n.publicado
    return true
  }).filter(n => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (n.titulo || '').toLowerCase().includes(q) || (n.resumo || '').toLowerCase().includes(q)
  })

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>📰 Notícias</h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={S.filters}>
            {['todos', 'publicados', 'rascunhos'].map(f => (
              <button key={f} style={S.filterBtn(filtro === f)} onClick={() => setFiltro(f)}>
                {{ todos: 'Todos', publicados: 'Publicados', rascunhos: 'Rascunhos' }[f]}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCriar}>+ Nova Notícia</button>
        </div>
      </div>

      <input
        style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
        placeholder="🔍 Buscar por título ou resumo…"
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Título</th>
              <th style={S.th}>Categoria</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Data</th>
              <th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={5} style={S.empty}>Nenhuma notícia encontrada.</td></tr>
            ) : filtradas.map(n => (
              <tr key={n.id}>
                <td style={S.td}>
                  <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{n.titulo}</div>
                  {n.resumo && <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 2 }}>{n.resumo.slice(0, 80)}{n.resumo.length > 80 ? '…' : ''}</div>}
                </td>
                <td style={S.td}><Badge categoria={n.categoria} /></td>
                <td style={S.td}>
                  <span style={{ cursor: 'pointer' }} onClick={() => togglePublicado(n)} title="Clique para alternar">
                    <StatusBadge publicado={n.publicado} />
                  </span>
                </td>
                <td style={S.td} className="tabnum">{fmtDate(n.criadoEm)}</td>
                <td style={S.td}>
                  <div style={S.actions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openPreview(n)}>👁</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditar(n)}>✏️</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#e05c5c' }} onClick={() => excluir(n.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal criar/editar */}
      {(modal === 'criar' || modal === 'editar') && (
        <Modal onClose={() => setModal(null)} title={modal === 'criar' ? 'Nova Notícia' : 'Editar Notícia'}>
          <div style={S.form}>
            <label style={S.label}>
              Título *
              <input style={S.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título da notícia" />
            </label>
            <label style={S.label}>
              Resumo (2–3 linhas)
              <textarea style={{ ...S.textarea, minHeight: 60 }} value={form.resumo} onChange={e => setForm(f => ({ ...f, resumo: e.target.value }))} placeholder="Breve resumo exibido na listagem" />
            </label>
            <label style={S.label}>
              Conteúdo
              <textarea style={{ ...S.textarea, minHeight: 160 }} value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Texto completo da notícia…" />
            </label>
            <div style={S.row}>
              <label style={{ ...S.label, flex: 1 }}>
                Categoria
                <select style={S.input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label style={S.toggle}>
                <input type="checkbox" checked={form.publicado} onChange={e => setForm(f => ({ ...f, publicado: e.target.checked }))} />
                Publicar imediatamente
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => openPreview({ ...form, id: editId })}>Pré-visualizar</button>
              <button className="btn btn-primary btn-sm" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal preview */}
      {modal === 'preview' && previewTarget && (
        <Modal onClose={() => setModal(null)} title="Pré-visualização">
          <div style={S.previewBox}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge categoria={previewTarget.categoria} />
              <StatusBadge publicado={previewTarget.publicado} />
            </div>
            <div style={S.previewTitle}>{previewTarget.titulo || '(sem título)'}</div>
            {previewTarget.resumo && <div style={S.previewResumo}>{previewTarget.resumo}</div>}
            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '10px 0' }} />
            <div style={S.previewContent}>{previewTarget.conteudo || '(sem conteúdo)'}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
