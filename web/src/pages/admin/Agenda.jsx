import { useState, useEffect, useMemo } from 'react'
import { api, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

function KpiCard({ label, value, color, sub, icon }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
      padding: '14px 18px', borderLeft: `4px solid ${color || 'var(--green)'}`, flex: 1, minWidth: 130,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{label}</div>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--green)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const EMPTY_JOGO = { data: '', hora: '', quadra: '', categoria: '', confronto: '', fase: '', torneioId: '' }
const EMPTY_RESULTADO = { placar1: '', placar2: '' }

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function groupByDate(jogos) {
  return jogos.reduce((acc, j) => {
    const key = j.data || 'sem-data'
    if (!acc[key]) acc[key] = []
    acc[key].push(j)
    return acc
  }, {})
}

function getQuadras(jogos) {
  const set = new Set(jogos.map(j => j.quadra).filter(Boolean))
  return [...set].sort()
}

/* Gera os 7 dias da semana a partir de uma data âncora */
function getWeekDays(anchor) {
  const days = []
  const d = new Date(anchor)
  // Volta para domingo
  d.setDate(d.getDate() - d.getDay())
  for (let i = 0; i < 7; i++) {
    const copy = new Date(d)
    copy.setDate(d.getDate() + i)
    days.push(copy.toISOString().slice(0, 10))
  }
  return days
}

/* ─── StatusBadge do jogo ─── */
function JogoBadge({ jogo }) {
  if (jogo.vencedor) return <span className="jogo-badge jogo-badge--done">Concluído</span>
  return null
}

/* ─── Cartão de jogo reutilizável ─── */
function JogoCard({ jogo, torneioNome, onEditPlacar, compact }) {
  return (
    <div className={`agenda-card ${jogo.vencedor ? 'agenda-card--done' : ''} ${compact ? 'agenda-card--compact' : ''}`}>
      <div className="agenda-card-header">
        <span className="agenda-hora">{jogo.hora || '—'}</span>
        {!compact && <span className="agenda-quadra">Quadra {jogo.quadra || '?'}</span>}
        <JogoBadge jogo={jogo} />
      </div>
      <div className="agenda-confronto">{jogo.confronto}</div>
      {jogo.vencedor && (
        <div className="agenda-placar">
          {jogo.placar1 != null ? `${jogo.placar1} × ${jogo.placar2}` : ''}{' '}
          <span className="agenda-vencedor">✓ {jogo.vencedor}</span>
        </div>
      )}
      <div className="agenda-meta">
        {jogo.categoria && <span className="tag">{jogo.categoria}</span>}
        {jogo.fase && <span className="tag">{jogo.fase}</span>}
        {torneioNome && <span className="tag tag-torneio">{torneioNome}</span>}
      </div>
      <button
        className="btn-sm btn-outline agenda-card-edit"
        onClick={() => onEditPlacar(jogo)}
      >
        {jogo.vencedor ? 'Corrigir' : 'Resultado'}
      </button>
    </div>
  )
}

/* ─── Vista Semanal ─── */
function VistaSemanal({ jogos, torneioNome, onEditPlacar, anchor, onPrevWeek, onNextWeek }) {
  const days = useMemo(() => getWeekDays(anchor), [anchor])
  const quadras = useMemo(() => getQuadras(jogos), [jogos])
  const byDate = useMemo(() => groupByDate(jogos), [jogos])

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="semana-wrap">
      <div className="semana-nav">
        <button className="btn-sm btn-outline" onClick={onPrevWeek}>← Semana anterior</button>
        <span className="semana-label">
          {fmtDateOnly(days[0])} – {fmtDateOnly(days[6])}
        </span>
        <button className="btn-sm btn-outline" onClick={onNextWeek}>Próxima semana →</button>
      </div>

      <div className="semana-grid-scroll">
        <table className="semana-grid">
          <thead>
            <tr>
              <th className="semana-quadra-col">Quadra</th>
              {days.map(d => {
                const dt = new Date(d + 'T12:00:00')
                return (
                  <th key={d} className={`semana-dia-col ${d === hoje ? 'semana-dia-col--hoje' : ''}`}>
                    <span className="semana-dia-nome">{DIAS_SEMANA[dt.getDay()]}</span>
                    <span className="semana-dia-num">{dt.getDate()}/{dt.getMonth() + 1}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {quadras.length === 0 ? (
              <tr>
                <td colSpan={8} className="semana-empty">Nenhum jogo nesta semana.</td>
              </tr>
            ) : (
              quadras.map(q => (
                <tr key={q}>
                  <td className="semana-quadra-label">Q{q}</td>
                  {days.map(d => {
                    const jogosCell = (byDate[d] || []).filter(j => j.quadra === q)
                    return (
                      <td key={d} className={`semana-cell ${d === hoje ? 'semana-cell--hoje' : ''}`}>
                        {jogosCell.map(j => (
                          <JogoCard
                            key={j.id}
                            jogo={j}
                            torneioNome={torneioNome(j.torneioId)}
                            onEditPlacar={onEditPlacar}
                            compact
                          />
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Jogos sem quadra */}
      {jogos.filter(j => !j.quadra && days.includes(j.data)).length > 0 && (
        <div className="semana-sem-quadra">
          <h4>Sem quadra definida</h4>
          <div className="agenda-cards">
            {jogos.filter(j => !j.quadra && days.includes(j.data)).map(j => (
              <JogoCard
                key={j.id}
                jogo={j}
                torneioNome={torneioNome(j.torneioId)}
                onEditPlacar={onEditPlacar}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Vista Lista ─── */
function VistaLista({ jogos, torneioNome, onEditPlacar }) {
  const grouped = useMemo(
    () => groupByDate([...jogos].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))),
    [jogos]
  )
  const dates = Object.keys(grouped).sort()

  if (dates.length === 0) return <p className="empty-msg">Nenhum jogo agendado.</p>

  return (
    <div className="agenda-grupos">
      {dates.map(date => (
        <div key={date} className="agenda-dia">
          <h2 className="agenda-dia-titulo">
            {date === 'sem-data' ? 'Data não definida' : fmtDate(date)}
            <span className="agenda-dia-count">{grouped[date].length} jogo{grouped[date].length !== 1 ? 's' : ''}</span>
          </h2>
          <div className="agenda-cards">
            {grouped[date].map(j => (
              <JogoCard
                key={j.id}
                jogo={j}
                torneioNome={torneioNome(j.torneioId)}
                onEditPlacar={onEditPlacar}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Main ─── */
export default function Agenda() {
  const [jogos, setJogos] = useState([])
  const [torneios, setTorneios] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista]       = useState('lista') // 'lista' | 'semana'
  const [anchor, setAnchor]     = useState(new Date().toISOString().slice(0, 10))
  const [busca, setBusca]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos') // 'todos'|'pendentes'|'concluidos'

  // Modal novo jogo
  const [openNovo, setOpenNovo] = useState(false)
  const [form, setForm] = useState(EMPTY_JOGO)
  const [saving, setSaving] = useState(false)

  // Modal resultado
  const [jogoEditando, setJogoEditando] = useState(null)
  const [resultado, setResultado] = useState(EMPTY_RESULTADO)
  const [savingRes, setSavingRes] = useState(false)

  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [ag, tor] = await Promise.all([
        api('/api/admin/agenda'),
        api('/api/admin/torneios'),
      ])
      setJogos(Array.isArray(ag) ? ag : [])
      setTorneios(Array.isArray(tor) ? tor : [])
    } catch (e) {
      toast('Erro ao carregar agenda', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSaveNovo = async () => {
    if (!form.data || !form.hora || !form.quadra || !form.confronto) {
      toast('Preencha data, hora, quadra e confronto', 'error'); return
    }
    setSaving(true)
    try {
      await api('/api/admin/agenda', { method: 'POST', body: form })
      toast('Jogo agendado')
      setOpenNovo(false)
      setForm(EMPTY_JOGO)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteJogo = async (id) => {
    if (!confirm('Remover jogo da agenda?')) return
    try {
      await api(`/api/admin/agenda/${id}`, { method: 'DELETE' })
      toast('Jogo removido')
      load()
    } catch (e) {
      toast(e.message || 'Erro ao remover', 'error')
    }
  }

  const openResultado = (jogo) => {
    setJogoEditando(jogo)
    setResultado({ placar1: jogo.placar1 ?? '', placar2: jogo.placar2 ?? '' })
  }

  const handleSaveResultado = async () => {
    if (resultado.placar1 === '' || resultado.placar2 === '') {
      toast('Preencha os dois placares', 'error'); return
    }
    const p1 = Number(resultado.placar1)
    const p2 = Number(resultado.placar2)
    if (p1 === p2) { toast('Placar não pode ser empate em tênis', 'error'); return }

    // Deriva vencedor a partir do confronto (nome1 vs nome2)
    const partes = (jogoEditando.confronto || '').split(/\s+vs\s+/i)
    const vencedor = p1 > p2 ? (partes[0] || 'P1') : (partes[1] || 'P2')

    setSavingRes(true)
    try {
      await api(`/api/admin/agenda/${jogoEditando.id}`, {
        method: 'PATCH',
        body: { placar1: p1, placar2: p2, vencedor },
      })
      toast('Resultado salvo')
      setJogoEditando(null)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar resultado', 'error')
    } finally {
      setSavingRes(false)
    }
  }

  const torneioNome = (id) => torneios.find(t => String(t.id) === String(id))?.nome || ''

  const prevWeek = () => {
    const d = new Date(anchor); d.setDate(d.getDate() - 7)
    setAnchor(d.toISOString().slice(0, 10))
  }
  const nextWeek = () => {
    const d = new Date(anchor); d.setDate(d.getDate() + 7)
    setAnchor(d.toISOString().slice(0, 10))
  }

  // Stats rápidas
  const stats = useMemo(() => {
    const concluidos = jogos.filter(j => j.vencedor).length
    const total = jogos.length
    return {
      total,
      concluidos,
      pendentes: jogos.filter(j => !j.vencedor).length,
      taxaConclusao: total > 0 ? Math.round((concluidos / total) * 100) : 0,
      hoje: jogos.filter(j => j.data === new Date().toISOString().slice(0, 10)).length,
    }
  }, [jogos])

  // Export CSV
  function exportCSV() {
    const headers = ['ID', 'Data', 'Hora', 'Quadra', 'Confronto', 'Categoria', 'Vencedor', 'Placar']
    const rows = jogosFiltrados.map(j => [
      j.id, j.data, j.hora, j.quadra || '',
      j.confronto || '', j.categoria || '',
      j.vencedor || '', j.placar ? `${j.placar1}-${j.placar2}` : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `agenda_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // Filtro de jogos
  const jogosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return jogos.filter(j => {
      if (filtroStatus === 'pendentes' && j.vencedor) return false
      if (filtroStatus === 'concluidos' && !j.vencedor) return false
      if (q && !`${j.confronto} ${j.quadra} ${j.categoria}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [jogos, busca, filtroStatus])

  return (
    <div className="page-agenda">
      <div className="page-header">
        <h1>Agenda</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ CSV</button>
          <button className="btn-primary" onClick={() => { setForm(EMPTY_JOGO); setOpenNovo(true) }}>+ Novo Jogo</button>
        </div>
      </div>

      {/* Busca e filtros */}
      {!loading && jogos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <input
            className="input" placeholder="🔍 Buscar confronto, quadra ou categoria…"
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          {[['todos','Todos'],['pendentes','Pendentes'],['concluidos','Concluídos']].map(([v,l]) => (
            <button key={v} className={`btn btn-sm ${filtroStatus === v ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFiltroStatus(v)}>{l}
            </button>
          ))}
          {(busca || filtroStatus !== 'todos') && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltroStatus('todos') }}>✕ Limpar</button>
          )}
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
            {jogosFiltrados.length} de {jogos.length}
          </span>
        </div>
      )}

      {/* Stats — KpiCards borderLeft */}
      {!loading && jogos.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <KpiCard label="Total" value={stats.total} color="#5FB335" icon="📋" sub="partidas cadastradas" />
          <KpiCard label="Concluídos" value={stats.concluidos} color="#8FD64A" icon="✅" sub="com resultado" />
          <KpiCard label="Pendentes" value={stats.pendentes} color="#C9A656" icon="⏳" sub="aguardando resultado" />
          <KpiCard label="Taxa Conclusão" value={`${stats.taxaConclusao}%`} color="#5FB335" icon="📊" sub={`${stats.hoje} jogos hoje`} />
        </div>
      )}

      {/* Toggle vista */}
      {!loading && jogos.length > 0 && (
        <div className="vista-toggle">
          <button
            className={`vista-btn ${vista === 'lista' ? 'vista-btn--active' : ''}`}
            onClick={() => setVista('lista')}
          >
            Lista
          </button>
          <button
            className={`vista-btn ${vista === 'semana' ? 'vista-btn--active' : ''}`}
            onClick={() => setVista('semana')}
          >
            Semana
          </button>
        </div>
      )}

      {loading ? (
        <p className="loading-msg">Carregando…</p>
      ) : vista === 'semana' ? (
        <VistaSemanal
          jogos={jogos}
          torneioNome={torneioNome}
          onEditPlacar={openResultado}
          anchor={anchor}
          onPrevWeek={prevWeek}
          onNextWeek={nextWeek}
        />
      ) : (
        <VistaLista
          jogos={jogosFiltrados}
          torneioNome={torneioNome}
          onEditPlacar={openResultado}
        />
      )}

      {/* Modal novo jogo */}
      <Modal open={openNovo} onClose={() => setOpenNovo(false)} title="Novo Jogo">
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
          <button className="btn-outline" onClick={() => setOpenNovo(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSaveNovo} disabled={saving}>
            {saving ? 'Salvando…' : 'Agendar'}
          </button>
        </div>
      </Modal>

      {/* Modal resultado */}
      <Modal
        open={!!jogoEditando}
        onClose={() => setJogoEditando(null)}
        title="Registrar Resultado"
      >
        {jogoEditando && (
          <>
            <p className="resultado-confronto">{jogoEditando.confronto}</p>
            {jogoEditando.data && (
              <p className="resultado-meta">
                {fmtDate(jogoEditando.data)} · {jogoEditando.hora} · Quadra {jogoEditando.quadra || '?'}
              </p>
            )}
            <div className="resultado-placares">
              <div className="resultado-lado">
                <label className="resultado-nome">
                  {(jogoEditando.confronto || '').split(/\s+vs\s+/i)[0] || 'Jogador 1'}
                </label>
                <input
                  type="number" min="0" max="99"
                  className="resultado-input"
                  value={resultado.placar1}
                  onChange={e => setResultado({ ...resultado, placar1: e.target.value })}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <span className="resultado-sep">×</span>
              <div className="resultado-lado">
                <label className="resultado-nome">
                  {(jogoEditando.confronto || '').split(/\s+vs\s+/i)[1] || 'Jogador 2'}
                </label>
                <input
                  type="number" min="0" max="99"
                  className="resultado-input"
                  value={resultado.placar2}
                  onChange={e => setResultado({ ...resultado, placar2: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            {resultado.placar1 !== '' && resultado.placar2 !== '' && resultado.placar1 !== resultado.placar2 && (
              <p className="resultado-preview">
                Vencedor: <strong>
                  {Number(resultado.placar1) > Number(resultado.placar2)
                    ? (jogoEditando.confronto || '').split(/\s+vs\s+/i)[0]
                    : (jogoEditando.confronto || '').split(/\s+vs\s+/i)[1]}
                </strong>
              </p>
            )}
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setJogoEditando(null)}>Cancelar</button>
              <button
                className="btn-danger btn-sm"
                onClick={() => { handleDeleteJogo(jogoEditando.id); setJogoEditando(null) }}
                style={{ marginRight: 'auto' }}
              >
                Remover jogo
              </button>
              <button className="btn-primary" onClick={handleSaveResultado} disabled={savingRes}>
                {savingRes ? 'Salvando…' : 'Salvar Resultado'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <style>{`
        /* Stats */
        .agenda-stats { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .stat-pill {
          padding: .3rem .75rem; border-radius: 20px; font-size: .78rem; font-weight: 600;
          background: #f3f4f6; color: #374151;
        }
        .stat-pill--done { background: #dcfce7; color: #16a34a; }
        .stat-pill--pend { background: #fef3c7; color: #d97706; }

        /* Toggle vista */
        .vista-toggle { display: flex; gap: .25rem; margin-bottom: 1.25rem; background: #f3f4f6; border-radius: 8px; padding: .25rem; width: fit-content; }
        .vista-btn { padding: .35rem .9rem; border-radius: 6px; border: none; background: transparent; font-size: .85rem; font-weight: 600; cursor: pointer; color: #6b7280; transition: all .15s; }
        .vista-btn--active { background: #fff; color: #0E2E1C; box-shadow: 0 1px 3px rgba(0,0,0,.12); }

        /* Cards */
        .agenda-card {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px;
          padding: .75rem; display: flex; flex-direction: column; gap: .35rem;
          transition: box-shadow .15s;
        }
        .agenda-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
        .agenda-card--done { border-color: #d1fae5; background: #fafffe; }
        .agenda-card--compact { padding: .5rem; font-size: .8rem; }

        .agenda-card-header { display: flex; align-items: center; gap: .5rem; }
        .agenda-hora { font-weight: 700; font-size: .88rem; color: #0E2E1C; }
        .agenda-quadra { color: #6b7280; font-size: .78rem; margin-left: auto; }
        .agenda-confronto { font-weight: 600; font-size: .9rem; }
        .agenda-placar { font-size: .82rem; color: #374151; }
        .agenda-vencedor { color: #16a34a; font-weight: 700; }
        .agenda-meta { display: flex; flex-wrap: wrap; gap: .3rem; }
        .agenda-card-edit { align-self: flex-start; margin-top: .15rem; }

        .jogo-badge { font-size: .68rem; padding: .15rem .4rem; border-radius: 4px; font-weight: 700; }
        .jogo-badge--done { background: #dcfce7; color: #16a34a; }

        /* Dias */
        .agenda-dia-titulo { font-size: 1rem; font-weight: 700; color: #0E2E1C; margin-bottom: .75rem; display: flex; align-items: center; gap: .5rem; }
        .agenda-dia-count { font-size: .75rem; font-weight: 500; color: #9ca3af; background: #f3f4f6; border-radius: 20px; padding: .1rem .5rem; }
        .agenda-dia { margin-bottom: 2rem; }
        .agenda-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: .75rem; }

        /* Semana */
        .semana-wrap { }
        .semana-nav { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .semana-label { font-size: .85rem; font-weight: 600; color: #374151; }
        .semana-grid-scroll { overflow-x: auto; }
        .semana-grid { width: 100%; border-collapse: collapse; min-width: 700px; }
        .semana-grid th, .semana-grid td { border: 1px solid #e5e7eb; padding: .35rem; vertical-align: top; }
        .semana-grid thead th { background: #f9fafb; text-align: center; }
        .semana-quadra-col { width: 60px; text-align: center !important; }
        .semana-dia-col { min-width: 120px; }
        .semana-dia-col--hoje { background: #f0fdf4 !important; }
        .semana-dia-nome { display: block; font-size: .72rem; font-weight: 700; text-transform: uppercase; color: #9ca3af; }
        .semana-dia-num { display: block; font-size: .9rem; font-weight: 700; color: #0E2E1C; }
        .semana-cell { vertical-align: top; min-height: 60px; }
        .semana-cell--hoje { background: #fafffe; }
        .semana-cell .agenda-card { margin-bottom: .25rem; }
        .semana-quadra-label { text-align: center; font-weight: 700; font-size: .82rem; color: #374151; background: #f9fafb; }
        .semana-empty { padding: 2rem; text-align: center; color: #9ca3af; font-size: .85rem; }
        .semana-sem-quadra { margin-top: 1.5rem; }
        .semana-sem-quadra h4 { font-size: .85rem; font-weight: 700; color: #9ca3af; margin-bottom: .75rem; }

        /* Resultado modal */
        .resultado-confronto { font-size: 1.05rem; font-weight: 700; text-align: center; margin-bottom: .25rem; }
        .resultado-meta { font-size: .78rem; color: #6b7280; text-align: center; margin-bottom: 1.25rem; }
        .resultado-placares { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 1rem; }
        .resultado-lado { display: flex; flex-direction: column; align-items: center; gap: .4rem; }
        .resultado-nome { font-size: .78rem; font-weight: 600; color: #374151; text-align: center; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .resultado-input {
          width: 72px; height: 60px; font-size: 2rem; font-weight: 800; text-align: center;
          border: 2px solid #d1d5db; border-radius: 10px; color: #0E2E1C;
        }
        .resultado-input:focus { border-color: #5FB335; outline: none; }
        .resultado-sep { font-size: 1.5rem; font-weight: 700; color: #9ca3af; }
        .resultado-preview { text-align: center; font-size: .88rem; color: #6b7280; margin-bottom: .5rem; }
        .resultado-preview strong { color: #16a34a; }

        /* Tags */
        .tag { background: #e5e7eb; border-radius: 4px; padding: .1rem .4rem; font-size: .72rem; color: #374151; }
        .tag-torneio { background: #dbeafe; color: #1d4ed8; }
      `}</style>
    </div>
  )
}
