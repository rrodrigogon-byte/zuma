import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const EMPTY = { data: '', hora: '', quadra: '', categoria: '', confronto: '', fase: '', torneioId: '' }

function groupByDate(jogos) {
  return jogos.reduce((acc, j) => {
    const key = j.data
    if (!acc[key]) acc[key] = []
    acc[key].push(j)
    return acc
  }, {})
}

export default function Agenda() {
  const [jogos, setJogos] = useState([])
  const [torneios, setTorneios] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [ag, tor] = await Promise.all([
        api('/api/admin/agenda'),
        api('/api/admin/torneios'),
      ])
      setJogos(ag)
      setTorneios(tor)
    } catch (e) {
      toast('Erro ao carregar agenda', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.data || !form.hora || !form.quadra || !form.confronto) {
      toast('Preencha data, hora, quadra e confronto', 'error'); return
    }
    setSaving(true)
    try {
      await api('/api/admin/agenda', { method: 'POST', body: form })
      toast('Jogo agendado')
      setOpen(false)
      setForm(EMPTY)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remover jogo da agenda?')) return
    try {
      await api(`/api/admin/agenda/${id}`, { method: 'DELETE' })
      toast('Jogo removido')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao remover', 'error')
    }
  }

  const grouped = groupByDate([...jogos].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)))
  const dates = Object.keys(grouped).sort()

  const torneioNome = (id) => torneios.find(t => String(t.id) === String(id))?.nome || '—'

  return (
    <div className="page-agenda">
      <div className="page-header">
        <h1>Agenda</h1>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setOpen(true) }}>+ Novo Jogo</button>
      </div>

      {loading ? (
        <p className="loading-msg">Carregando…</p>
      ) : dates.length === 0 ? (
        <p className="empty-msg">Nenhum jogo agendado.</p>
      ) : (
        <div className="agenda-grupos">
          {dates.map(date => (
            <div key={date} className="agenda-dia">
              <h2 className="agenda-dia-titulo">{fmtDate(date)}</h2>
              <div className="agenda-cards">
                {grouped[date].map(j => (
                  <div key={j.id} className="agenda-card">
                    <div className="agenda-card-header">
                      <span className="agenda-hora">{j.hora}</span>
                      <span className="agenda-quadra">Quadra {j.quadra}</span>
                      <button className="btn-icon btn-danger" title="Remover" onClick={() => handleDelete(j.id)}>✕</button>
                    </div>
                    <div className="agenda-confronto">{j.confronto}</div>
                    <div className="agenda-meta">
                      {j.categoria && <span className="tag">{j.categoria}</span>}
                      {j.fase && <span className="tag">{j.fase}</span>}
                      {j.torneioId && <span className="tag tag-torneio">{torneioNome(j.torneioId)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo Jogo">
        <div className="form-grid">
          <label>
            Data *
            <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
          </label>
          <label>
            Hora *
            <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
          </label>
          <label>
            Quadra *
            <input value={form.quadra} onChange={e => setForm({ ...form, quadra: e.target.value })} placeholder="Ex: 1, 2, Central" />
          </label>
          <label>
            Confronto *
            <input value={form.confronto} onChange={e => setForm({ ...form, confronto: e.target.value })} placeholder="Ex: João Silva vs Pedro Lima" />
          </label>
          <label>
            Categoria
            <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: A, B, Masculino 45+" />
          </label>
          <label>
            Fase
            <input value={form.fase} onChange={e => setForm({ ...form, fase: e.target.value })} placeholder="Ex: Quartas, Semifinal, Final" />
          </label>
          <label>
            Torneio
            <select value={form.torneioId} onChange={e => setForm({ ...form, torneioId: e.target.value })}>
              <option value="">— selecione —</option>
              {torneios.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Agendar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
