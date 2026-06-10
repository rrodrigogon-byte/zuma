import { useState, useEffect } from 'react'
import { api, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const FORMATOS = ['eliminatoria', 'roundrobin', 'swiss', 'grupos', 'dupla_eliminacao']
const MODALIDADES = ['simples', 'duplas', 'misto']

const statusBadge = (t) => {
  const hoje = new Date().toISOString().slice(0, 10)
  if (t.fim < hoje) return { label: 'Encerrado', cls: 'badge-gray' }
  if (t.inicio <= hoje) return { label: 'Em andamento', cls: 'badge-green' }
  return { label: 'Futuro', cls: 'badge-blue' }
}

const EMPTY = { nome: '', inicio: '', fim: '', local: '', formato: 'eliminatoria', modalidade: 'simples', numPremiados: 3 }

export default function Torneios() {
  const [torneios, setTorneios] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api('/api/admin/torneios')
      setTorneios(data)
    } catch (e) {
      toast('Erro ao carregar torneios', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (t) => { setForm({ ...t }); setEditId(t.id); setOpen(true) }

  const handleSave = async () => {
    if (!form.nome || !form.inicio || !form.fim) {
      toast('Preencha nome, início e fim', 'error'); return
    }
    setSaving(true)
    try {
      if (editId) {
        await api(`/api/admin/torneios/${editId}`, { method: 'PATCH', body: form })
        toast('Torneio atualizado')
      } else {
        await api('/api/admin/torneios', { method: 'POST', body: form })
        toast('Torneio criado')
      }
      setOpen(false)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir torneio?')) return
    try {
      await api(`/api/admin/torneios/${id}`, { method: 'DELETE' })
      toast('Torneio excluído')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao excluir', 'error')
    }
  }

  return (
    <div className="page-torneios">
      <div className="page-header">
        <h1>Torneios</h1>
        <button className="btn-primary" onClick={openCreate}>+ Novo Torneio</button>
      </div>

      {loading ? (
        <p className="loading-msg">Carregando…</p>
      ) : torneios.length === 0 ? (
        <p className="empty-msg">Nenhum torneio cadastrado.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Formato</th>
                <th>Modalidade</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Local</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {torneios.map(t => {
                const { label, cls } = statusBadge(t)
                return (
                  <tr key={t.id}>
                    <td><strong>{t.nome}</strong></td>
                    <td>{t.formato}</td>
                    <td>{t.modalidade}</td>
                    <td>{fmtDateOnly(t.inicio)}</td>
                    <td>{fmtDateOnly(t.fim)}</td>
                    <td>{t.local}</td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                    <td className="actions">
                      <button className="btn-sm btn-outline" onClick={() => openEdit(t)}>Editar</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(t.id)}>Excluir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Editar Torneio' : 'Novo Torneio'}>
        <div className="form-grid">
          <label>
            Nome *
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do torneio" />
          </label>
          <label>
            Início *
            <input type="date" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} />
          </label>
          <label>
            Fim *
            <input type="date" value={form.fim} onChange={e => setForm({ ...form, fim: e.target.value })} />
          </label>
          <label>
            Local
            <input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="Ex: Tangará Tênis Clube" />
          </label>
          <label>
            Formato
            <select value={form.formato} onChange={e => setForm({ ...form, formato: e.target.value })}>
              {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label>
            Modalidade
            <select value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value })}>
              {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>
            Nº Premiados
            <input type="number" min="1" value={form.numPremiados} onChange={e => setForm({ ...form, numPremiados: +e.target.value })} />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
