import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../lib/api'

/* ─── Constantes visuais ─────────────────────────────────────────────────── */
const C = {
  green: '#5FB335', darkGreen: '#0E2E1C', lightGreen: '#8FD64A',
  gold: '#C9A656', silver: '#9e9e9e', bronze: '#cd7f32',
  bg: '#F4F6EF', white: '#fff',
  muted: '#7a9a7a', border: '#e8f0dc',
}
const MEDAL       = ['🥇','🥈','🥉']
const MEDAL_BG    = [
  'linear-gradient(135deg,#C9A656 0%,#f0d080 60%,#C9A656 100%)',
  'linear-gradient(135deg,#9e9e9e 0%,#d4d4d4 60%,#9e9e9e 100%)',
  'linear-gradient(135deg,#cd7f32 0%,#e8a96a 60%,#cd7f32 100%)',
]
const MEDAL_TEXT  = ['#0E2E1C','#0E2E1C','#fff']
const MEDAL_SHADOW= ['rgba(201,166,86,.35)','rgba(158,158,158,.25)','rgba(205,127,50,.3)']

/* ─── Animação sequencial de entrada ────────────────────────────────────── */
function useEntranceAnimation(count) {
  const [visible, setVisible] = useState([])
  useEffect(() => {
    setVisible([])
    let i = 0
    const id = setInterval(() => {
      if (i >= count) { clearInterval(id); return }
      setVisible(prev => [...prev, i]); i++
    }, 45)
    return () => clearInterval(id)
  }, [count])
  return visible
}

/* ─── Sparkline SVG puro ────────────────────────────────────────────────── */
function Sparkline({ data = [], color = C.green, width = 80, height = 32 }) {
  if (data.length < 2) return <span style={{ color: C.muted, fontSize: 11 }}>—</span>
  const mn = Math.min(...data), mx = Math.max(...data)
  const range = mx - mn || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - mn) / range) * (height - 4) - 2
    return x + ',' + y
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]}
        r="3" fill={color} />
    </svg>
  )
}

/* ─── Mini Gráfico de Aproveitamento (Donut) ────────────────────────────── */
function DonutAprv({ pct = 0, size = 44 }) {
  const r = 16, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 70 ? C.green : pct >= 40 ? C.gold : '#e05555'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#eee" strokeWidth="5" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ - dash}
        strokeLinecap="round" transform="rotate(-90 20 20)" />
      <text x="20" y="25" textAnchor="middle" fontSize="9" fontWeight="800" fill={color}>
        {pct}%
      </text>
    </svg>
  )
}

/* ─── Card do pódio ─────────────────────────────────────────────────────── */
function PodiumCard({ player, idx, onClick }) {
  const isFirst = idx === 0
  return (
    <div
      onClick={() => onClick && onClick(player)}
      style={{
        flex: '1 1 ' + (isFirst ? 'calc(33% + 30px)' : '33%'),
        maxWidth: isFirst ? 310 : 265, minWidth: 175,
        background: C.white, borderRadius: 22,
        padding: isFirst ? '40px 30px' : '28px 22px',
        textAlign: 'center',
        boxShadow: '0 ' + (isFirst ? 12 : 6) + 'px ' + (isFirst ? 40 : 24) + 'px ' + MEDAL_SHADOW[idx],
        position: 'relative', overflow: 'hidden',
        transition: 'transform .2s, box-shadow .2s',
        marginBottom: isFirst ? 0 : 28,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 ' + (isFirst ? 20 : 14) + 'px ' + (isFirst ? 56 : 36) + 'px ' + MEDAL_SHADOW[idx] }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 ' + (isFirst ? 12 : 6) + 'px ' + (isFirst ? 40 : 24) + 'px ' + MEDAL_SHADOW[idx] }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: isFirst ? 10 : 7, background: MEDAL_BG[idx] }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, background: MEDAL_BG[idx].replace('135deg','180deg'), opacity: 0.05, pointerEvents: 'none' }} />
      <div style={{ fontSize: isFirst ? '4rem' : '3rem', marginBottom: 8 }}>{MEDAL[idx]}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: MEDAL_BG[idx], color: MEDAL_TEXT[idx], borderRadius: 999, padding: '4px 18px', fontSize: '0.72rem', fontWeight: 800, marginBottom: 12 }}>
        {['🥇 Campeão','🥈 Vice','🥉 3º Lugar'][idx]}
      </div>
      <div style={{ fontWeight: 900, fontSize: isFirst ? '1.25rem' : '1.05rem', color: C.darkGreen, marginBottom: 6 }}>{player.nome}</div>
      <div style={{ fontSize: isFirst ? '2.2rem' : '1.8rem', fontWeight: 900, color: C.green }}>
        {(player.pontos || 0).toLocaleString('pt-BR')}
        <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 500, marginLeft: 5 }}>pts</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 12, fontSize: '0.85rem' }}>
        <span style={{ color: C.green, fontWeight: 700 }}>{player.vitorias ?? 0}V</span>
        <span style={{ color: '#ccc' }}>–</span>
        <span style={{ color: '#e05555', fontWeight: 700 }}>{player.derrotas ?? 0}D</span>
      </div>
      {player.aproveitamento != null && (
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: C.muted, fontWeight: 600 }}>
          {player.aproveitamento}% aproveitamento
        </div>
      )}
      {player.torneios > 0 && (
        <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#aaa' }}>
          {player.torneios} torneio{player.torneios !== 1 ? 's' : ''}
        </div>
      )}
      {player.categoria && (
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: C.muted, fontWeight: 600, background: '#f0fae8', borderRadius: 20, padding: '2px 10px', display: 'inline-block' }}>{player.categoria}</div>
      )}
      {onClick && <div style={{ marginTop: 12, fontSize: '0.72rem', color: C.green, opacity: 0.7 }}>Ver perfil →</div>}
    </div>
  )
}

/* ─── Modal de perfil do atleta ─────────────────────────────────────────── */
function AtletaModal({ atleta, todos, onClose }) {
  if (!atleta) return null

  // Posição no ranking geral
  const posGeral = todos.findIndex(p => p.nome === atleta.nome && p.categoria === atleta.categoria) + 1

  // Simular evolução de pontos (distribuição uniforme pelos torneios)
  const torneios = atleta.torneios || 0
  const ptsPorTorneio = torneios > 0 ? Math.round(atleta.pontos / torneios) : 0
  const evolucao = Array.from({ length: torneios }, (_, i) => ptsPorTorneio * (i + 1))

  const aprvColor = atleta.aproveitamento >= 70 ? C.green : atleta.aproveitamento >= 40 ? C.gold : '#e05555'
  const totalJogos = (atleta.vitorias || 0) + (atleta.derrotas || 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,46,28,.55)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: C.white, borderRadius: 24, maxWidth: 480, width: '100%', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.22)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,' + C.darkGreen + ',' + '#1a4a2e' + ')', padding: '28px 28px 20px', color: C.white, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', color: C.white, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>
            {posGeral === 1 ? '🥇' : posGeral === 2 ? '🥈' : posGeral === 3 ? '🥉' : '🎾'}
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.4rem', marginBottom: 4 }}>{atleta.nome}</div>
          {atleta.categoria && (
            <div style={{ background: 'rgba(143,214,74,.2)', borderRadius: 20, padding: '3px 14px', display: 'inline-block', fontSize: '0.78rem', color: C.lightGreen, fontWeight: 700 }}>
              {atleta.categoria}
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { icon: '🏆', label: 'Posição', value: posGeral > 0 ? '#' + posGeral : '—', color: posGeral === 1 ? C.gold : C.darkGreen },
              { icon: '⭐', label: 'Pontos', value: (atleta.pontos || 0).toLocaleString('pt-BR'), color: C.green },
              { icon: '🎾', label: 'Torneios', value: atleta.torneios || 0, color: C.gold },
            ].map((s, i) => (
              <div key={i} style={{ background: '#f8fdf5', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem' }}>{s.icon}</div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: s.color, lineHeight: 1.1, marginTop: 4 }}>{s.value}</div>
                <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Aproveitamento */}
          <div style={{ background: '#f8fdf5', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: C.darkGreen }}>Aproveitamento</span>
              <span style={{ fontWeight: 900, color: aprvColor, fontSize: '1rem' }}>{atleta.aproveitamento ?? 0}%</span>
            </div>
            <div style={{ background: '#e0e0e0', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ width: (atleta.aproveitamento || 0) + '%', height: '100%', background: aprvColor, borderRadius: 999, transition: 'width .8s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem' }}>
              <span style={{ color: C.green, fontWeight: 700 }}>{atleta.vitorias ?? 0} vitórias</span>
              <span style={{ color: '#999' }}>{totalJogos} jogos</span>
              <span style={{ color: '#e05555', fontWeight: 700 }}>{atleta.derrotas ?? 0} derrotas</span>
            </div>
          </div>

          {/* Evolução de pontos */}
          {evolucao.length >= 2 && (
            <div style={{ background: '#f8fdf5', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: C.darkGreen, marginBottom: 10 }}>Evolução de pontos</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
                <Sparkline data={evolucao} width={380} height={48} color={C.green} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: C.muted }}>
                <span>Torneio 1</span>
                <span>Torneio {torneios}</span>
              </div>
            </div>
          )}

          {/* Médias */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f8fdf5', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600 }}>Média pts/torneio</div>
              <div style={{ fontWeight: 900, color: C.green, fontSize: '1.1rem', marginTop: 4 }}>
                {torneios > 0 ? (atleta.pontos / torneios).toFixed(0) : '—'}
              </div>
            </div>
            <div style={{ background: '#f8fdf5', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600 }}>Média jogos/torneio</div>
              <div style={{ fontWeight: 900, color: C.gold, fontSize: '1.1rem', marginTop: 4 }}>
                {torneios > 0 ? (totalJogos / torneios).toFixed(1) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Seção de pódio por categoria ─────────────────────────────────────── */
function PodiumSection({ titulo, lista, onAtletaClick }) {
  const top3 = lista.slice(0, 3)
  if (top3.length === 0) return null
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.darkGreen, whiteSpace: 'nowrap' }}>
          🏅 {titulo}
        </h3>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {top3.length >= 2 && <PodiumCard player={top3[1]} idx={1} onClick={onAtletaClick} />}
        {top3.length >= 1 && <PodiumCard player={top3[0]} idx={0} onClick={onAtletaClick} />}
        {top3.length >= 3 && <PodiumCard player={top3[2]} idx={2} onClick={onAtletaClick} />}
      </div>
    </div>
  )
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function Ranking() {
  const navigate = useNavigate()
  const [ranking, setRanking]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState('')
  const [catFiltro, setCatFiltro]     = useState('all')
  const [viewMode, setViewMode]       = useState('geral')   // 'geral' | 'categoria' | 'tabela'
  const [atletaSel, setAtletaSel]     = useState(null)
  const [sortCol, setSortCol]         = useState('pontos')
  const [sortDir, setSortDir]         = useState('desc')
  const tableRef = useRef(null)

  useEffect(() => {
    api.get('/api/ranking')
      .then(d => { setRanking(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categorias = useMemo(() => {
    const cats = new Set(ranking.map(p => p.categoria).filter(Boolean))
    return [...cats].sort()
  }, [ranking])

  // Filtrado para busca + categoria
  const filtrado = useMemo(() => {
    let arr = ranking.filter(p => {
      const matchBusca = !busca || p.nome?.toLowerCase().includes(busca.toLowerCase())
      const matchCat   = catFiltro === 'all' || p.categoria === catFiltro
      return matchBusca && matchCat
    })
    // Ordenação
    arr = [...arr].sort((a, b) => {
      let va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0
      if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [ranking, busca, catFiltro, sortCol, sortDir])

  // Ranking por categoria
  const rankingPorCat = useMemo(() => {
    const map = {}
    categorias.forEach(cat => {
      map[cat] = ranking
        .filter(p => p.categoria === cat)
        .sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias)
    })
    return map
  }, [ranking, categorias])

  const top3Geral  = ranking.slice(0, 3)
  const isFiltered = busca || catFiltro !== 'all'
  const visibleRows = useEntranceAnimation(filtrado.length)

  const totalAtletas  = ranking.length
  const totalCats     = categorias.length
  const totalTorneios = Math.max(...ranking.map(p => p.torneios || 0), 0)
  const totalJogos    = ranking.reduce((s, p) => s + (p.vitorias || 0) + (p.derrotas || 0), 0)

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortBtn = ({ col, label }) => (
    <span
      onClick={() => handleSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {label}
      {sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : <span style={{ opacity: 0.3 }}> ↕</span>}
    </span>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg,' + C.darkGreen + ' 0%,#1a4a2e 100%)',
        padding: '40px 24px 72px', color: C.bg,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', right: '4%', fontSize: '7rem', opacity: 0.06, pointerEvents: 'none' }}>🎾</div>
        <div style={{ position: 'absolute', bottom: '5%', left: '2%', fontSize: '5rem', opacity: 0.05, pointerEvents: 'none' }}>🏆</div>
        <div style={{ maxWidth: 1040, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Link to="/" style={{ color: C.lightGreen, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Início</Link>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, margin: '14px 0 6px', letterSpacing: '-0.02em' }}>
            🏆 Ranking
          </h1>
          <p style={{ color: '#a0c8a0', margin: 0 }}>4ª Agro Open de Tênis · 2026</p>

          {/* Tabs de visão */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
            {[
              { key: 'geral',     label: '🏆 Geral' },
              { key: 'categoria', label: '🎾 Por Categoria' },
              { key: 'tabela',    label: '📊 Tabela Completa' },
            ].map(t => (
              <button key={t.key} onClick={() => setViewMode(t.key)} style={{
                background: viewMode === t.key ? C.lightGreen : 'rgba(255,255,255,.12)',
                color: viewMode === t.key ? C.darkGreen : C.bg,
                border: 'none', borderRadius: 20, padding: '8px 20px',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                transition: 'all .2s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 44" preserveAspectRatio="none">
          <path d="M0,44 C480,4 960,44 1440,14 L1440,44 Z" fill={C.bg} />
        </svg>
      </div>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        {!loading && ranking.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 28, marginBottom: 32 }}>
            {[
              { icon: '👥', label: 'Atletas',           value: totalAtletas,            color: C.green },
              { icon: '🎾', label: 'Categorias',        value: totalCats || '—',        color: C.gold },
              { icon: '🏆', label: 'Edições realizadas', value: totalTorneios || '—',   color: C.darkGreen },
              { icon: '⚔️', label: 'Jogos disputados',  value: totalJogos,              color: '#5b6af0' },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: C.white, borderRadius: 18, padding: '20px 14px',
                textAlign: 'center', boxShadow: '0 3px 16px rgba(0,0,0,.07)',
                border: '1px solid rgba(95,179,53,.1)', transition: 'transform .2s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
              >
                <div style={{ fontSize: '1.7rem', marginBottom: 4 }}>{kpi.icon}</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600, marginTop: 4, letterSpacing: '0.04em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: C.green, fontSize: '2.5rem' }}>🎾</div>
        )}

        {!loading && ranking.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: '#aaa' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: C.darkGreen, marginBottom: 8 }}>Ranking ainda não publicado</div>
            <div style={{ color: C.muted, fontSize: '0.9rem' }}>Os pontos serão calculados automaticamente ao término dos torneios.</div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW: GERAL
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && ranking.length > 0 && viewMode === 'geral' && (
          <>
            {/* Pódio geral */}
            {top3Geral.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: C.darkGreen, margin: 0 }}>🏅 Pódio Geral</h2>
                  <p style={{ margin: '6px 0 0', color: C.muted, fontSize: '0.85rem' }}>Clique em um atleta para ver o perfil completo</p>
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {top3Geral.length >= 2 && <PodiumCard player={top3Geral[1]} idx={1} onClick={setAtletaSel} />}
                  {top3Geral.length >= 1 && <PodiumCard player={top3Geral[0]} idx={0} onClick={setAtletaSel} />}
                  {top3Geral.length >= 3 && <PodiumCard player={top3Geral[2]} idx={2} onClick={setAtletaSel} />}
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 16, maxWidth: 340, margin: '16px auto 0' }}>
                  {[160, 200, 140].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: h / 10, borderRadius: '8px 8px 0 0', background: MEDAL_BG[i === 0 ? 1 : i === 1 ? 0 : 2], opacity: 0.4 }} />
                  ))}
                </div>
              </div>
            )}

            {/* Top 10 rápido */}
            {ranking.length > 3 && (
              <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.06)', marginBottom: 32 }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: C.darkGreen, fontSize: '0.95rem' }}>📋 Continuação do Ranking</span>
                  <button onClick={() => setViewMode('tabela')} style={{ background: C.bg, border: 'none', borderRadius: 10, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, color: C.green, cursor: 'pointer' }}>
                    Ver completo →
                  </button>
                </div>
                {ranking.slice(3).map((p, i) => {
                  const pos = i + 4
                  return (
                    <div key={i}
                      onClick={() => setAtletaSel(p)}
                      style={{
                        display: 'grid', gridTemplateColumns: '52px 1fr 90px 80px 80px 70px',
                        padding: '11px 20px', alignItems: 'center',
                        borderBottom: '1px solid ' + C.border,
                        background: i % 2 === 0 ? C.white : '#fafcf8',
                        cursor: 'pointer', transition: 'background .1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : '#fafcf8'}
                    >
                      <div style={{ textAlign: 'center', fontWeight: 800, color: '#bbb', fontSize: '0.9rem' }}>{pos}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.92rem' }}>{p.nome}</div>
                        {p.categoria && <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 1 }}>{p.categoria}</div>}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 900, color: C.green, fontSize: '1rem' }}>
                        {(p.pontos || 0).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                        <span style={{ color: C.green, fontWeight: 700 }}>{p.vitorias ?? 0}</span>
                        <span style={{ color: '#ccc', margin: '0 3px' }}>–</span>
                        <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? 0}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <DonutAprv pct={p.aproveitamento ?? 0} size={36} />
                      </div>
                      <div style={{ textAlign: 'right', color: C.muted, fontSize: '0.82rem' }}>
                        {p.torneios ?? 0} torneio{p.torneios !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW: POR CATEGORIA
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && ranking.length > 0 && viewMode === 'categoria' && (
          <>
            {/* Seletor de categoria */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28, justifyContent: 'center' }}>
              <button
                onClick={() => setCatFiltro('all')}
                style={{
                  background: catFiltro === 'all' ? C.darkGreen : C.white,
                  color: catFiltro === 'all' ? C.white : C.darkGreen,
                  border: '2px solid ' + (catFiltro === 'all' ? C.darkGreen : C.border),
                  borderRadius: 20, padding: '8px 18px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Todas
              </button>
              {categorias.map(cat => (
                <button key={cat} onClick={() => setCatFiltro(cat)} style={{
                  background: catFiltro === cat ? C.green : C.white,
                  color: catFiltro === cat ? C.white : C.darkGreen,
                  border: '2px solid ' + (catFiltro === cat ? C.green : C.border),
                  borderRadius: 20, padding: '8px 18px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                  transition: 'all .15s',
                }}>
                  {cat}
                  <span style={{ marginLeft: 6, background: 'rgba(0,0,0,.1)', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem' }}>
                    {(rankingPorCat[cat] || []).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Pódios */}
            {(catFiltro === 'all' ? categorias : [catFiltro]).map(cat => (
              <PodiumSection
                key={cat}
                titulo={cat}
                lista={rankingPorCat[cat] || []}
                onAtletaClick={setAtletaSel}
              />
            ))}

            {/* Tabela da categoria selecionada */}
            {catFiltro !== 'all' && (rankingPorCat[catFiltro] || []).length > 3 && (
              <div style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.06)', marginTop: 8 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + C.border }}>
                  <span style={{ fontWeight: 800, color: C.darkGreen, fontSize: '0.9rem' }}>Demais atletas — {catFiltro}</span>
                </div>
                {(rankingPorCat[catFiltro] || []).slice(3).map((p, i) => (
                  <div key={i}
                    onClick={() => setAtletaSel(p)}
                    style={{
                      display: 'grid', gridTemplateColumns: '48px 1fr 90px 80px 64px',
                      padding: '10px 18px', alignItems: 'center',
                      borderBottom: '1px solid ' + C.border,
                      background: i % 2 === 0 ? C.white : '#fafcf8',
                      cursor: 'pointer', transition: 'background .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.white : '#fafcf8'}
                  >
                    <div style={{ textAlign: 'center', color: '#bbb', fontWeight: 800 }}>{i + 4}</div>
                    <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.9rem' }}>{p.nome}</div>
                    <div style={{ textAlign: 'right', fontWeight: 900, color: C.green }}>{(p.pontos || 0).toLocaleString('pt-BR')}</div>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                      <span style={{ color: C.green, fontWeight: 700 }}>{p.vitorias ?? 0}</span>
                      <span style={{ color: '#ccc', margin: '0 3px' }}>–</span>
                      <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? 0}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: C.muted }}>{p.aproveitamento ?? 0}%</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW: TABELA COMPLETA
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && ranking.length > 0 && viewMode === 'tabela' && (
          <>
            {/* Filtros */}
            <div style={{
              background: C.white, borderRadius: 18, padding: '18px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 18,
              display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <div style={{ flex: '1 1 220px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: '#999' }}>🔍</span>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar jogador…"
                  style={{ width: '100%', paddingLeft: 38, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.green}
                  onBlur={e => e.target.style.borderColor = '#d0dcc8'}
                />
              </div>
              {categorias.length > 0 && (
                <select
                  value={catFiltro}
                  onChange={e => setCatFiltro(e.target.value)}
                  style={{ flex: '0 1 200px', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d0dcc8', fontSize: '0.9rem', outline: 'none', color: C.darkGreen, background: C.white, cursor: 'pointer' }}
                >
                  <option value="all">Todas as categorias</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {isFiltered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.82rem', color: '#5a7a5a' }}>{filtrado.length} resultado{filtrado.length !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => { setBusca(''); setCatFiltro('all') }}
                    style={{ background: C.bg, border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', color: '#5a7a5a', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Limpar ✕
                  </button>
                </div>
              )}
            </div>

            {/* Tabela */}
            <div ref={tableRef} style={{ background: C.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.06)' }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '52px 1fr 110px 90px 80px 80px 80px',
                background: 'linear-gradient(135deg,' + C.darkGreen + ',#1a4a2e)',
                padding: '14px 20px', color: C.lightGreen,
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <div style={{ textAlign: 'center' }}>#</div>
                <div><SortBtn col="nome" label="Jogador" /></div>
                <div style={{ textAlign: 'right' }}><SortBtn col="pontos" label="Pontos" /></div>
                <div style={{ textAlign: 'center' }}><SortBtn col="aproveitamento" label="Aprv." /></div>
                <div style={{ textAlign: 'center' }}>V – D</div>
                <div style={{ textAlign: 'center' }}><SortBtn col="torneios" label="Torn." /></div>
                <div style={{ textAlign: 'center' }}>Perfil</div>
              </div>

              {filtrado.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                  Nenhum jogador encontrado
                </div>
              ) : filtrado.map((p, i) => {
                const pos = !isFiltered ? (p.pos || i + 1) : (ranking.findIndex(r => r.nome === p.nome && r.categoria === p.categoria) + 1)
                const hasMedal = pos <= 3 && !isFiltered
                const isVis    = visibleRows.includes(i)
                return (
                  <div key={i}
                    onClick={() => setAtletaSel(p)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '52px 1fr 110px 90px 80px 80px 80px',
                      padding: '12px 20px', alignItems: 'center',
                      borderBottom: '1px solid ' + C.border,
                      background: hasMedal
                        ? (pos === 1 ? 'rgba(201,166,86,.07)' : pos === 2 ? 'rgba(158,158,158,.05)' : 'rgba(205,127,50,.06)')
                        : (i % 2 === 0 ? C.white : '#fafcf8'),
                      transition: 'background .1s, opacity .3s, transform .3s',
                      opacity: isVis ? 1 : 0,
                      transform: isVis ? 'translateX(0)' : 'translateX(-10px)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = hasMedal
                        ? (pos === 1 ? 'rgba(201,166,86,.07)' : pos === 2 ? 'rgba(158,158,158,.05)' : 'rgba(205,127,50,.06)')
                        : (i % 2 === 0 ? C.white : '#fafcf8')
                    }}
                  >
                    <div style={{ textAlign: 'center', fontWeight: 800 }}>
                      {hasMedal
                        ? <span style={{ fontSize: '1.2rem' }}>{MEDAL[pos - 1]}</span>
                        : <span style={{ color: '#bbb', fontSize: '0.88rem' }}>{pos}</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.darkGreen, fontSize: '0.93rem' }}>{p.nome}</div>
                      {p.categoria && <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 1 }}>{p.categoria}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 900, color: C.green, fontSize: '1rem' }}>
                      {(p.pontos || 0).toLocaleString('pt-BR')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <DonutAprv pct={p.aproveitamento ?? 0} size={38} />
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.83rem' }}>
                      <span style={{ color: C.green, fontWeight: 700 }}>{p.vitorias ?? 0}</span>
                      <span style={{ color: '#ddd', margin: '0 3px' }}>–</span>
                      <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? 0}</span>
                    </div>
                    <div style={{ textAlign: 'center', color: C.muted, fontSize: '0.82rem', fontWeight: 600 }}>
                      {p.torneios ?? 0}
                    </div>
                    <div style={{ textAlign: 'center', color: C.green, fontSize: '0.78rem' }}>
                      Ver →
                    </div>
                  </div>
                )
              })}
            </div>

            {ranking.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: '#bbb' }}>
                Atualizado em {new Date().toLocaleDateString('pt-BR')} · {ranking.length} atleta{ranking.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}

        {/* ── CTA inscrição ─────────────────────────────────────────────── */}
        {!loading && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button
              onClick={() => navigate('/inscricao')}
              style={{
                background: 'linear-gradient(135deg,' + C.green + ',' + C.lightGreen + ')',
                color: C.darkGreen, border: 'none', borderRadius: 14,
                padding: '15px 38px', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem',
                boxShadow: '0 4px 18px rgba(95,179,53,.3)', transition: 'transform .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              🎾 Quero me inscrever
            </button>
          </div>
        )}
      </div>

      {/* ── Modal de perfil ───────────────────────────────────────────────── */}
      <AtletaModal
        atleta={atletaSel}
        todos={ranking}
        onClose={() => setAtletaSel(null)}
      />
    </div>
  )
}
