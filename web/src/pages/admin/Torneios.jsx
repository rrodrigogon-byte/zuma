import { useState, useEffect, useMemo } from 'react'
import { api, fmtDate, fmtDateOnly } from '../../lib/api'

function exportCSV(torneios) {
  const headers = ['ID', 'Nome', 'Formato', 'Modalidade', 'Início', 'Fim', 'Local', 'Status']
  const hoje = new Date().toISOString().slice(0, 10)
  const rows = torneios.map(t => [
    t.id, t.nome, t.formato, t.modalidade,
    t.inicio, t.fim, t.local || '',
    t.fim < hoje ? 'Encerrado' : t.inicio <= hoje ? 'Em andamento' : 'Futuro',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `torneios_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}
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

/* ─── BracketMini ─── */
function BracketMini({ rodadas }) {
  if (!rodadas || rodadas.length === 0) return <p className="empty-msg" style={{ fontSize: '.82rem' }}>Sem jogos no bracket.</p>

  const primeira = rodadas[0]?.jogos || []
  const total = rodadas.flatMap(r => r.jogos || [])
  const done = total.filter(j => j.vencedor).length

  return (
    <div className="bracket-mini">
      <div className="bracket-mini-progresso">
        <div className="progresso-bar">
          <div className="progresso-fill" style={{ width: total.length ? `${Math.round((done / total.length) * 100)}%` : '0%' }} />
        </div>
        <span className="progresso-label">{done}/{total.length} jogos</span>
      </div>
      <div className="bracket-mini-lista">
        {rodadas.map((r, ri) => (
          <div key={ri} className="bracket-mini-round">
            <div className="bracket-mini-round-nome">{r.nome}</div>
            {(r.jogos || []).map((j, ji) => (
              <div key={ji} className={`bracket-mini-jogo ${j.vencedor ? 'done' : ''}`}>
                <span className={j.vencedor === j.p1 ? 'winner' : ''}>{j.p1 || '—'}</span>
                {j.placar1 != null && <em>{j.placar1}×{j.placar2}</em>}
                <span className="vs">vs</span>
                <span className={j.vencedor === j.p2 ? 'winner' : ''}>{j.p2 || '—'}</span>
                {!j.vencedor && (j.data || j.quadra) && (
                  <small className="jogo-meta">{j.data && fmtDateOnly(j.data)}{j.quadra && ` · Q${j.quadra}`}</small>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── PlacarEditor (linha inline) ─── */
function PlacarEditor({ jogo, onSave }) {
  const [editing, setEditing] = useState(false)
  const [p1, setP1] = useState(jogo.placar1 ?? '')
  const [p2, setP2] = useState(jogo.placar2 ?? '')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    try {
      await api(`/api/admin/agenda/${jogo.id}`, {
        method: 'PATCH',
        body: { placar1: Number(p1), placar2: Number(p2), vencedor: Number(p1) >= Number(p2) ? jogo.p1 : jogo.p2 },
      })
      toast('Placar salvo')
      setEditing(false)
      onSave()
    } catch (e) {
      toast(e.message || 'Erro ao salvar placar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="placar-row">
        <span className="placar-display">
          {jogo.placar1 != null ? `${jogo.placar1} × ${jogo.placar2}` : '— × —'}
          {jogo.vencedor && <span className="placar-vencedor"> ✓ {jogo.vencedor}</span>}
        </span>
        <button className="btn-sm btn-outline" onClick={() => setEditing(true)}>Editar</button>
      </div>
    )
  }

  return (
    <div className="placar-editor">
      <input
        type="number" min="0" value={p1}
        onChange={e => setP1(e.target.value)}
        className="placar-input" placeholder="P1"
      />
      <span className="placar-sep">×</span>
      <input
        type="number" min="0" value={p2}
        onChange={e => setP2(e.target.value)}
        className="placar-input" placeholder="P2"
      />
      <button className="btn-sm btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? '…' : 'OK'}
      </button>
      <button className="btn-sm btn-outline" onClick={() => setEditing(false)}>✕</button>
    </div>
  )
}

/* ─── TorneioDetalhe (painel lateral) ─── */
function TorneioDetalhe({ torneio, onClose, onRefresh }) {
  const [inscritos, setInscritos] = useState([])
  const [bracket, setBracket] = useState(null)
  const [jogos, setJogos] = useState([])
  const [loadingBracket, setLoadingBracket] = useState(false)
  const [sorteando, setSorteando] = useState(false)
  const { toast } = useToast()

  const loadBracket = async () => {
    setLoadingBracket(true)
    try {
      const data = await api(`/api/admin/torneios/${torneio.id}/bracket`)
      setBracket(data)
    } catch (e) {
      setBracket(null)
    } finally {
      setLoadingBracket(false)
    }
  }

  useEffect(() => {
    if (!torneio) return
    // Carrega inscritos e bracket em paralelo
    api(`/api/admin/inscricoes?torneioId=${torneio.id}`)
      .then(data => {
        const list = Array.isArray(data) ? data : data.inscricoes || []
        setInscritos(list.filter(i => i.status === 'confirmado' || i.status === 'pago'))
      })
      .catch(() => setInscritos([]))

    api(`/api/admin/agenda?torneioId=${torneio.id}`)
      .then(data => setJogos(Array.isArray(data) ? data : []))
      .catch(() => setJogos([]))

    loadBracket()
  }, [torneio?.id])

  const handleSortear = async () => {
    if (inscritos.length < 2) {
      toast('São necessários pelo menos 2 inscritos confirmados', 'error'); return
    }
    if (!confirm(`Sortear chave com ${inscritos.length} atletas?`)) return
    setSorteando(true)
    try {
      await api(`/api/admin/torneios/${torneio.id}/sortear`, {
        method: 'POST',
        body: {
          categoria: torneio.nome,
          participantes: inscritos.map(i => i.nome || i.atleta),
        },
      })
      toast('Chave sorteada!')
      await loadBracket()
    } catch (e) {
      toast(e.message || 'Erro ao sortear', 'error')
    } finally {
      setSorteando(false)
    }
  }

  const rodadas = bracket?.rodadas || []
  const totalJogos = rodadas.flatMap(r => r.jogos || [])
  const doneJogos = totalJogos.filter(j => j.vencedor).length
  const pctDone = totalJogos.length ? Math.round((doneJogos / totalJogos.length) * 100) : 0

  return (
    <div className="torneio-detalhe">
      <div className="detalhe-header">
        <div>
          <h2>{torneio.nome}</h2>
          <p className="detalhe-sub">{torneio.formato} · {torneio.modalidade} · {torneio.local || '—'}</p>
        </div>
        <button className="btn-icon" onClick={onClose} title="Fechar">✕</button>
      </div>

      {/* Badge progresso */}
      {totalJogos.length > 0 && (
        <div className="detalhe-progresso">
          <div className="progresso-bar wide">
            <div className="progresso-fill" style={{ width: `${pctDone}%` }} />
          </div>
          <span className="progresso-label">{pctDone}% concluído ({doneJogos}/{totalJogos.length})</span>
        </div>
      )}

      {/* Sortear */}
      <div className="detalhe-section">
        <div className="section-title-row">
          <h3>Bracket / Chave</h3>
          <button
            className="btn-sm btn-primary"
            onClick={handleSortear}
            disabled={sorteando}
          >
            {sorteando ? 'Sorteando…' : `Sortear chave (${inscritos.length} inscritos)`}
          </button>
        </div>

        {loadingBracket ? (
          <p className="loading-msg" style={{ fontSize: '.82rem' }}>Carregando…</p>
        ) : (
          <BracketMini rodadas={rodadas} />
        )}
      </div>

      {/* Jogos com placar */}
      {jogos.length > 0 && (
        <div className="detalhe-section">
          <h3>Jogos da Agenda</h3>
          <div className="jogos-placar-lista">
            {[...jogos]
              .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
              .map(j => (
                <div key={j.id} className="jogo-placar-row">
                  <div className="jogo-placar-info">
                    <span className="jogo-data">{j.data ? fmtDateOnly(j.data) : '—'} {j.hora}</span>
                    <span className="jogo-confronto">{j.confronto}</span>
                    {j.quadra && <span className="jogo-quadra-tag">Q{j.quadra}</span>}
                    {j.fase && <span className="tag">{j.fase}</span>}
                  </div>
                  <PlacarEditor jogo={j} onSave={() => {
                    api(`/api/admin/agenda?torneioId=${torneio.id}`)
                      .then(data => setJogos(Array.isArray(data) ? data : []))
                      .catch(() => {})
                  }} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main ─── */
export default function Torneios() {
  const [torneios, setTorneios] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedTorneio, setSelectedTorneio] = useState(null)
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos') // 'todos'|'futuro'|'andamento'|'encerrado'
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
  const openEdit = (t, e) => {
    e.stopPropagation()
    setForm({ ...t }); setEditId(t.id); setOpen(true)
  }

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

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Excluir torneio?')) return
    try {
      await api(`/api/admin/torneios/${id}`, { method: 'DELETE' })
      toast('Torneio excluído')
      if (selectedTorneio?.id === id) setSelectedTorneio(null)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao excluir', 'error')
    }
  }

  const handleRowClick = (t) => {
    setSelectedTorneio(prev => prev?.id === t.id ? null : t)
  }

  const torneiosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    const hoje = new Date().toISOString().slice(0, 10)
    return torneios.filter(t => {
      if (q && !t.nome.toLowerCase().includes(q) && !t.local?.toLowerCase().includes(q)) return false
      if (filtroStatus === 'futuro'     && !(t.inicio > hoje)) return false
      if (filtroStatus === 'andamento'  && !(t.inicio <= hoje && t.fim >= hoje)) return false
      if (filtroStatus === 'encerrado'  && !(t.fim < hoje)) return false
      return true
    })
  }, [torneios, busca, filtroStatus])

  return (
    <div className="page-torneios">
      <div className="page-header">
        <h1>Torneios</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(torneiosFiltrados)}>⬇ CSV</button>
          <button className="btn-primary" onClick={openCreate}>+ Novo Torneio</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input
          className="input" placeholder="🔍 Buscar torneio ou local…"
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        {[['todos','Todos'],['futuro','Futuros'],['andamento','Em andamento'],['encerrado','Encerrados']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${filtroStatus === v ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroStatus(v)}>
            {l}
          </button>
        ))}
        {(busca || filtroStatus !== 'todos') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltroStatus('todos') }}>✕ Limpar</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
          {torneiosFiltrados.length} de {torneios.length}
        </span>
      </div>

      <div className={`torneios-layout ${selectedTorneio ? 'torneios-layout--split' : ''}`}>
        {/* Lista */}
        <div className="torneios-lista">
          {loading ? (
            <p className="loading-msg">Carregando…</p>
          ) : torneiosFiltrados.length === 0 ? (
            <p className="empty-msg">{torneios.length === 0 ? 'Nenhum torneio cadastrado.' : 'Nenhum resultado para os filtros aplicados.'}</p>
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
                  {torneiosFiltrados.map(t => {
                    const { label, cls } = statusBadge(t)
                    const isSelected = selectedTorneio?.id === t.id
                    return (
                      <tr
                        key={t.id}
                        className={`torneio-row ${isSelected ? 'torneio-row--selected' : ''}`}
                        onClick={() => handleRowClick(t)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td><strong>{t.nome}</strong></td>
                        <td>{t.formato}</td>
                        <td>{t.modalidade}</td>
                        <td>{fmtDateOnly(t.inicio)}</td>
                        <td>{fmtDateOnly(t.fim)}</td>
                        <td>{t.local}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td className="actions" onClick={e => e.stopPropagation()}>
                          <button className="btn-sm btn-outline" onClick={(e) => openEdit(t, e)}>Editar</button>
                          <button className="btn-sm btn-danger" onClick={(e) => handleDelete(t.id, e)}>Excluir</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detalhe lateral */}
        {selectedTorneio && (
          <div className="torneios-detalhe-panel">
            <TorneioDetalhe
              torneio={selectedTorneio}
              onClose={() => setSelectedTorneio(null)}
              onRefresh={load}
            />
          </div>
        )}
      </div>

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

      <style>{`
        .torneios-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
        .torneios-layout--split .torneios-lista { flex: 1; min-width: 0; overflow-x: auto; }
        .torneios-detalhe-panel {
          width: 420px; flex-shrink: 0;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
          overflow: hidden; position: sticky; top: 1rem;
          max-height: calc(100vh - 5rem); overflow-y: auto;
        }

        .torneio-row:hover { background: #f9fafb; }
        .torneio-row--selected { background: #f0fdf4 !important; }

        /* Detalhe */
        .torneio-detalhe { padding: 1.25rem; }
        .detalhe-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .detalhe-header h2 { font-size: 1.05rem; font-weight: 700; color: #0E2E1C; margin: 0 0 .2rem; }
        .detalhe-sub { font-size: .78rem; color: #6b7280; margin: 0; }

        .detalhe-progresso { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
        .progresso-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progresso-bar.wide { flex: 1; }
        .progresso-fill { height: 100%; background: #5FB335; border-radius: 4px; transition: width .3s; }
        .progresso-label { font-size: .75rem; color: #6b7280; white-space: nowrap; }

        .detalhe-section { margin-bottom: 1.5rem; border-top: 1px solid #f3f4f6; padding-top: 1rem; }
        .detalhe-section h3 { font-size: .88rem; font-weight: 700; color: #374151; margin: 0 0 .75rem; }
        .section-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
        .section-title-row h3 { margin: 0; }

        /* Bracket mini */
        .bracket-mini { }
        .bracket-mini-progresso { display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem; }
        .bracket-mini-progresso .progresso-bar { flex: 1; }
        .bracket-mini-round { margin-bottom: 1rem; }
        .bracket-mini-round-nome { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #9ca3af; margin-bottom: .35rem; }
        .bracket-mini-jogo {
          display: flex; align-items: center; flex-wrap: wrap; gap: .3rem .4rem;
          font-size: .8rem; padding: .35rem .5rem; background: #f9fafb; border-radius: 6px;
          margin-bottom: .25rem;
        }
        .bracket-mini-jogo.done { background: #f0fdf4; }
        .bracket-mini-jogo .winner { font-weight: 700; color: #16a34a; }
        .bracket-mini-jogo .vs { color: #9ca3af; font-size: .72rem; }
        .bracket-mini-jogo em { font-style: normal; font-weight: 700; font-size: .78rem; color: #374151; }
        .bracket-mini-jogo .jogo-meta { color: #9ca3af; font-size: .72rem; margin-left: auto; }

        /* Jogos placar */
        .jogos-placar-lista { display: flex; flex-direction: column; gap: .5rem; }
        .jogo-placar-row {
          background: #f9fafb; border-radius: 8px; padding: .6rem .75rem;
          display: flex; flex-direction: column; gap: .35rem;
        }
        .jogo-placar-info { display: flex; align-items: center; flex-wrap: wrap; gap: .4rem; font-size: .82rem; }
        .jogo-data { color: #6b7280; font-size: .75rem; }
        .jogo-confronto { font-weight: 600; }
        .jogo-quadra-tag { background: #e5e7eb; border-radius: 4px; padding: .1rem .35rem; font-size: .72rem; color: #6b7280; }

        /* Placar editor */
        .placar-row { display: flex; align-items: center; gap: .5rem; }
        .placar-display { font-size: .82rem; color: #374151; flex: 1; }
        .placar-vencedor { font-size: .75rem; color: #16a34a; font-weight: 600; }
        .placar-editor { display: flex; align-items: center; gap: .4rem; }
        .placar-input { width: 48px; padding: .25rem .4rem; border: 1.5px solid #d1d5db; border-radius: 6px; font-size: .85rem; text-align: center; }
        .placar-sep { font-weight: 700; color: #374151; }

        @media (max-width: 900px) {
          .torneios-layout--split { flex-direction: column; }
          .torneios-detalhe-panel { width: 100%; position: static; max-height: none; }
        }
      `}</style>
    </div>
  )
}
