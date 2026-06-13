import { useState, useEffect, useMemo } from 'react'
import { api } from '../../lib/api'

/* ─── Cores ─────────────────────────────────────────────────────────────── */
const C = {
  green: '#5FB335', darkGreen: '#0E2E1C', lightGreen: '#8FD64A',
  gold: '#C9A656', bg: '#F4F6EF', white: '#fff',
  muted: '#7a9a7a', border: '#e8f0dc', danger: '#e05555',
}
const POINTS_TABLE = [
  { fase: 'Campeão',       pts: 1000, key: 'champion' },
  { fase: 'Finalista',     pts: 600,  key: 'finalist' },
  { fase: 'Semifinal',     pts: 360,  key: 'semi' },
  { fase: 'Quartas',       pts: 180,  key: 'quarter' },
  { fase: 'Oitavas (R16)', pts: 90,   key: 'r16' },
  { fase: 'R32',           pts: 45,   key: 'r32' },
  { fase: 'R64',           pts: 20,   key: 'r64' },
  { fase: 'Participação',  pts: 5,    key: 'participation' },
]

/* ─── Mini Donut ────────────────────────────────────────────────────────── */
function Donut({ pct = 0, size = 40 }) {
  const r = 14, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 70 ? C.green : pct >= 40 ? C.gold : C.danger
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e8e8e8" strokeWidth="4.5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4.5"
        strokeDasharray={circ} strokeDashoffset={circ - dash}
        strokeLinecap="round" transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  )
}

/* ─── Badge de posição ──────────────────────────────────────────────────── */
function PosBadge({ pos }) {
  if (pos === 1) return <span style={{ fontSize: '1.3rem' }}>🥇</span>
  if (pos === 2) return <span style={{ fontSize: '1.3rem' }}>🥈</span>
  if (pos === 3) return <span style={{ fontSize: '1.3rem' }}>🥉</span>
  return <span style={{ color: '#aaa', fontWeight: 700, fontSize: '0.9rem' }}>{pos}</span>
}

/* ─── Modal de edição manual de atleta ──────────────────────────────────── */
function EditModal({ atleta, onSave, onClose }) {
  const [form, setForm] = useState({ ...atleta })
  if (!atleta) return null
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 20, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg,' + C.darkGreen + ',#1a4a2e)', padding: '22px 24px', color: C.white }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>✏️ Editar Atleta</div>
          <div style={{ fontSize: '0.82rem', color: '#a0c8a0' }}>{atleta.nome} · {atleta.categoria}</div>
        </div>
        <div style={{ padding: '22px 24px' }}>
          {[
            { k: 'pontos',    label: 'Pontos',    type: 'number' },
            { k: 'vitorias',  label: 'Vitórias',  type: 'number' },
            { k: 'derrotas',  label: 'Derrotas',  type: 'number' },
            { k: 'torneios',  label: 'Torneios',  type: 'number' },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type}
                value={form[f.k] ?? 0}
                onChange={e => set(f.k, Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.green}
                onBlur={e => e.target.style.borderColor = '#d0dcc8'}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600, color: '#666' }}>Cancelar</button>
            <button onClick={() => onSave(form)} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,' + C.green + ',' + C.lightGreen + ')', color: C.darkGreen, fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
              ✓ Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Modal de adicionar atleta manualmente ─────────────────────────────── */
function AddModal({ categorias, onSave, onClose }) {
  const [form, setForm] = useState({ nome: '', categoria: categorias[0] || '', pontos: 0, vitorias: 0, derrotas: 0, torneios: 0 })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 20, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg,' + C.darkGreen + ',#1a4a2e)', padding: '22px 24px', color: C.white }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>➕ Adicionar Atleta ao Ranking</div>
          <div style={{ fontSize: '0.82rem', color: '#a0c8a0', marginTop: 4 }}>Inserção manual de pontuação</div>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>Nome completo</label>
            <input
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Nome do atleta"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = C.green}
              onBlur={e => e.target.style.borderColor = '#d0dcc8'}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 4 }}>Categoria</label>
            {categorias.length > 0 ? (
              <select
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', background: C.white }}
              >
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                placeholder="Ex: Masc · 1ª Classe"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.green}
                onBlur={e => e.target.style.borderColor = '#d0dcc8'}
              />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { k: 'pontos', label: 'Pontos' },
              { k: 'torneios', label: 'Torneios' },
              { k: 'vitorias', label: 'Vitórias' },
              { k: 'derrotas', label: 'Derrotas' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: C.darkGreen, display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input
                  type="number"
                  value={form[f.k]}
                  onChange={e => set(f.k, Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600, color: '#666' }}>Cancelar</button>
            <button
              onClick={() => form.nome.trim() && onSave(form)}
              disabled={!form.nome.trim()}
              style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: form.nome.trim() ? 'linear-gradient(135deg,' + C.green + ',' + C.lightGreen + ')' : '#e0e0e0', color: form.nome.trim() ? C.darkGreen : '#aaa', fontWeight: 800, cursor: form.nome.trim() ? 'pointer' : 'not-allowed', fontSize: '0.95rem' }}
            >
              ➕ Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function AdminRanking() {
  const [ranking, setRanking]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [busca, setBusca]         = useState('')
  const [catFiltro, setCatFiltro] = useState('all')
  const [tab, setTab]             = useState('ranking')   // 'ranking' | 'pontuacao' | 'campeoes'
  const [editAtleta, setEditAtleta]   = useState(null)
  const [showAdd, setShowAdd]         = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState(null)
  const [campeoes, setCampeoes]       = useState([])

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/api/ranking'),
      api.get('/api/admin/campeoes').catch(() => []),
    ]).then(([r, c]) => {
      setRanking(Array.isArray(r) ? r : [])
      setCampeoes(Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const categorias = useMemo(() => {
    const s = new Set(ranking.map(p => p.categoria).filter(Boolean))
    return [...s].sort()
  }, [ranking])

  const filtrado = useMemo(() => {
    return ranking.filter(p => {
      const matchB = !busca || p.nome?.toLowerCase().includes(busca.toLowerCase())
      const matchC = catFiltro === 'all' || p.categoria === catFiltro
      return matchB && matchC
    })
  }, [ranking, busca, catFiltro])

  // KPIs
  const totalAtletas  = ranking.length
  const totalCats     = categorias.length
  const totalTorneios = Math.max(...ranking.map(p => p.torneios || 0), 0)
  const melhorAtleta  = ranking[0]

  /* Salvar edição de atleta via PATCH */
  const handleSaveEdit = async (form) => {
    setSaving(true)
    try {
      await api.patch('/api/admin/ranking/atleta', form)
      showMsg('Atleta atualizado com sucesso!')
      setEditAtleta(null)
      load()
    } catch {
      showMsg('Erro ao salvar. Tente novamente.', 'err')
    } finally { setSaving(false) }
  }

  /* Adicionar atleta manualmente */
  const handleAddAtleta = async (form) => {
    setSaving(true)
    try {
      await api.post('/api/admin/ranking/atleta', form)
      showMsg('Atleta adicionado ao ranking!')
      setShowAdd(false)
      load()
    } catch {
      showMsg('Erro ao adicionar atleta.', 'err')
    } finally { setSaving(false) }
  }

  /* Remover atleta */
  const handleRemover = async (p) => {
    if (!window.confirm('Remover ' + p.nome + ' do ranking?')) return
    setSaving(true)
    try {
      await api.delete('/api/admin/ranking/atleta', { nome: p.nome, categoria: p.categoria })
      showMsg('Atleta removido.')
      load()
    } catch {
      showMsg('Erro ao remover atleta.', 'err')
    } finally { setSaving(false) }
  }

  /* Reset geral */
  const handleReset = async () => {
    setSaving(true)
    try {
      await api.post('/api/admin/reset-ranking', {})
      showMsg('Ranking zerado com sucesso.')
      setConfirmReset(false)
      load()
    } catch {
      showMsg('Erro ao resetar ranking.', 'err')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', sans-serif", paddingBottom: 60 }}>

      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: msg.type === 'ok' ? C.green : C.danger,
          color: C.white, padding: '12px 22px', borderRadius: 12,
          fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 4px 16px rgba(0,0,0,.18)',
          animation: 'fadeIn .2s',
        }}>
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,' + C.darkGreen + ',#1a4a2e)', padding: '28px 28px 22px', color: C.white }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>🏆 Gestão de Ranking</h1>
              <p style={{ margin: '4px 0 0', color: '#a0c8a0', fontSize: '0.85rem' }}>Ranking público de torneios · 4ª Agro Open de Tênis</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/ranking" target="_blank" rel="noreferrer" style={{
                background: 'rgba(255,255,255,.12)', color: C.white, padding: '9px 16px',
                borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
                border: '1px solid rgba(255,255,255,.2)',
              }}>
                👁 Ver público →
              </a>
              <button onClick={() => setShowAdd(true)} style={{
                background: C.lightGreen, color: C.darkGreen, border: 'none',
                borderRadius: 10, padding: '9px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem',
              }}>
                ➕ Adicionar atleta
              </button>
              <button onClick={() => setConfirmReset(true)} style={{
                background: 'rgba(224,85,85,.25)', color: '#ffaaaa',
                border: '1px solid rgba(224,85,85,.3)', borderRadius: 10,
                padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
              }}>
                🗑 Zerar ranking
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
            {[
              { key: 'ranking',    label: '📋 Ranking' },
              { key: 'pontuacao',  label: '⭐ Tabela de Pontos' },
              { key: 'campeoes',   label: '🏅 Campeões' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: tab === t.key ? C.lightGreen : 'rgba(255,255,255,.12)',
                color: tab === t.key ? C.darkGreen : C.white,
                border: 'none', borderRadius: 20, padding: '7px 18px',
                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                transition: 'all .15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>

        {/* KPIs */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { icon: '👥', label: 'Atletas',         value: totalAtletas,  color: C.green },
              { icon: '🎾', label: 'Categorias',      value: totalCats,     color: C.gold },
              { icon: '🏆', label: 'Edições',         value: totalTorneios, color: C.darkGreen },
              { icon: '⭐', label: 'Líder',           value: melhorAtleta?.nome || '—', color: '#5b6af0', small: true },
            ].map((k, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 16, padding: '18px 16px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid ' + C.border }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontWeight: 900, fontSize: k.small ? '0.9rem' : '1.7rem', color: k.color, lineHeight: 1, wordBreak: 'break-word' }}>{k.value}</div>
                <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: RANKING ─────────────────────────────────────────────── */}
        {tab === 'ranking' && (
          <>
            {/* Filtros */}
            <div style={{ background: C.white, borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar atleta…"
                  style={{ width: '100%', paddingLeft: 34, paddingRight: 10, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {categorias.length > 0 && (
                <select
                  value={catFiltro}
                  onChange={e => setCatFiltro(e.target.value)}
                  style={{ flex: '0 1 200px', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.85rem', outline: 'none', color: C.darkGreen, background: C.white, cursor: 'pointer' }}
                >
                  <option value="all">Todas as categorias</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <span style={{ fontSize: '0.8rem', color: C.muted, marginLeft: 'auto' }}>{filtrado.length} atleta{filtrado.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Tabela admin */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.green, fontSize: '2rem' }}>⏳</div>
            ) : filtrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>🔍</div>
                {ranking.length === 0
                  ? <div><div style={{ fontWeight: 700, color: C.darkGreen, marginBottom: 6 }}>Ranking vazio</div><div style={{ fontSize: '0.85rem' }}>Finalize chaves ou adicione atletas manualmente.</div></div>
                  : 'Nenhum atleta encontrado com esses filtros.'
                }
              </div>
            ) : (
              <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.07)' }}>
                {/* Header tabela */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr 80px 100px 90px 80px 70px 90px',
                  background: 'linear-gradient(135deg,' + C.darkGreen + ',#1a4a2e)',
                  padding: '13px 18px', color: C.lightGreen,
                  fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  <div style={{ textAlign: 'center' }}>#</div>
                  <div>Atleta</div>
                  <div style={{ textAlign: 'right' }}>Pontos</div>
                  <div style={{ textAlign: 'center' }}>Aprovt.</div>
                  <div style={{ textAlign: 'center' }}>V – D</div>
                  <div style={{ textAlign: 'center' }}>Torn.</div>
                  <div style={{ textAlign: 'center' }}>Média</div>
                  <div style={{ textAlign: 'center' }}>Ações</div>
                </div>

                {filtrado.map((p, i) => {
                  const pos = ranking.indexOf(p) + 1 || i + 1
                  return (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '52px 1fr 80px 100px 90px 80px 70px 90px',
                      padding: '11px 18px', alignItems: 'center',
                      borderBottom: '1px solid ' + C.border,
                      background: i % 2 === 0 ? C.white : '#fafcf8',
                      transition: 'background .1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : '#fafcf8'}
                    >
                      <div style={{ textAlign: 'center' }}><PosBadge pos={pos} /></div>
                      <div>
                        <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.9rem' }}>{p.nome}</div>
                        {p.categoria && <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 1 }}>{p.categoria}</div>}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 900, color: C.green, fontSize: '0.95rem' }}>
                        {(p.pontos || 0).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Donut pct={p.aproveitamento ?? 0} size={38} />
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                        <span style={{ color: C.green, fontWeight: 700 }}>{p.vitorias ?? 0}</span>
                        <span style={{ color: '#ddd', margin: '0 3px' }}>–</span>
                        <span style={{ color: C.danger, fontWeight: 700 }}>{p.derrotas ?? 0}</span>
                      </div>
                      <div style={{ textAlign: 'center', color: C.muted, fontWeight: 700, fontSize: '0.85rem' }}>
                        {p.torneios ?? 0}
                      </div>
                      <div style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>
                        {p.torneios > 0 ? Math.round(p.pontos / p.torneios) : '—'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          onClick={() => setEditAtleta(p)}
                          title="Editar"
                          style={{ background: '#f0f4e8', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.9rem' }}
                        >✏️</button>
                        <button
                          onClick={() => handleRemover(p)}
                          title="Remover"
                          style={{ background: 'rgba(224,85,85,.1)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.9rem' }}
                        >🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── TAB: TABELA DE PONTUAÇÃO ─────────────────────────────────── */}
        {tab === 'pontuacao' && (
          <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.07)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + C.border }}>
              <h3 style={{ margin: 0, fontWeight: 900, color: C.darkGreen, fontSize: '1rem' }}>⭐ Tabela de pontuação por fase</h3>
              <p style={{ margin: '4px 0 0', color: C.muted, fontSize: '0.82rem' }}>Pontos atribuídos automaticamente ao finalizar cada chave de torneio.</p>
            </div>
            {POINTS_TABLE.map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '16px 22px', alignItems: 'center',
                borderBottom: '1px solid ' + C.border,
                background: i === 0 ? 'rgba(201,166,86,.06)' : C.white,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.4rem' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎾'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.9rem' }}>{row.fase}</div>
                    <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 2 }}>Chave: <code>{row.key}</code></div>
                  </div>
                </div>
                <div style={{
                  fontWeight: 900, fontSize: '1.3rem',
                  color: i === 0 ? C.gold : i <= 2 ? C.green : C.muted,
                }}>
                  {row.pts.toLocaleString('pt-BR')}
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, color: C.muted, marginLeft: 4 }}>pts</span>
                </div>
              </div>
            ))}
            <div style={{ padding: '16px 22px', background: '#f8fdf5' }}>
              <div style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.6 }}>
                <strong style={{ color: C.darkGreen }}>Como funciona:</strong> Ao finalizar uma chave em{' '}
                <a href="/admin/torneios" style={{ color: C.green }}>Torneios</a>, o sistema chama{' '}
                <code>applyChaveToRanking()</code> automaticamente e atribui os pontos acima com base na fase
                mais avançada que cada atleta alcançou.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: CAMPEÕES ────────────────────────────────────────────── */}
        {tab === 'campeoes' && (
          <div>
            {campeoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏆</div>
                <div style={{ fontWeight: 700, color: C.darkGreen, marginBottom: 6 }}>Nenhum campeão registrado ainda</div>
                <div style={{ fontSize: '0.85rem' }}>Os campeões aparecem aqui quando as chaves são finalizadas.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {campeoes.map((c, i) => (
                  <div key={i} style={{
                    background: C.white, borderRadius: 18, overflow: 'hidden',
                    boxShadow: '0 3px 16px rgba(0,0,0,.08)',
                  }}>
                    <div style={{ background: 'linear-gradient(135deg,#C9A656,#f0d080)', padding: '18px', textAlign: 'center' }}>
                      <div style={{ fontSize: '2.5rem' }}>🥇</div>
                    </div>
                    <div style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1rem', marginBottom: 4 }}>{c.nome || c.campeao}</div>
                      <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 8 }}>{c.categoria}</div>
                      {c.edicao && <div style={{ fontSize: '0.72rem', background: C.bg, borderRadius: 20, padding: '3px 12px', display: 'inline-block', color: C.darkGreen, fontWeight: 600 }}>{c.edicao}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal de reset */}
        {confirmReset && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmReset(false)}>
            <div style={{ background: C.white, borderRadius: 20, maxWidth: 380, width: '100%', padding: '28px 28px', boxShadow: '0 20px 60px rgba(0,0,0,.25)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 900, color: C.darkGreen, fontSize: '1.1rem', marginBottom: 8 }}>Zerar ranking público?</div>
              <div style={{ color: C.muted, fontSize: '0.85rem', marginBottom: 24 }}>
                Esta ação <strong>não pode ser desfeita</strong>. Todos os pontos, vitórias e derrotas serão perdidos.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #d0dcc8', background: C.white, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button onClick={handleReset} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: C.danger, color: C.white, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', fontSize: '0.9rem' }}>
                  {saving ? '⏳ Zerando…' : '🗑 Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      {editAtleta && <EditModal atleta={editAtleta} onSave={handleSaveEdit} onClose={() => setEditAtleta(null)} />}
      {showAdd && <AddModal categorias={categorias} onSave={handleAddAtleta} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
