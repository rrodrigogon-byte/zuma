import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'

const MEDAL = ['🥇', '🥈', '🥉']
const MEDAL_BG = [
  'linear-gradient(135deg, #C9A656 0%, #f0d080 60%, #C9A656 100%)',
  'linear-gradient(135deg, #9e9e9e 0%, #d4d4d4 60%, #9e9e9e 100%)',
  'linear-gradient(135deg, #cd7f32 0%, #e8a96a 60%, #cd7f32 100%)',
]
const MEDAL_TEXT = ['#0E2E1C', '#0E2E1C', '#fff']
const MEDAL_SHADOW = ['rgba(201,166,86,0.35)', 'rgba(158,158,158,0.25)', 'rgba(205,127,50,0.3)']
const PODIUM_HEIGHT = [220, 180, 155]

// Animação de entrada sequencial
function useEntranceAnimation(count) {
  const [visible, setVisible] = useState([])
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      if (i >= count) { clearInterval(id); return }
      setVisible(prev => [...prev, i])
      i++
    }, 60)
    return () => clearInterval(id)
  }, [count])
  return visible
}

function PodiumCard({ player, idx }) {
  const isFirst = idx === 0
  return (
    <div
      style={{
        flex: `1 1 ${isFirst ? 'calc(33% + 30px)' : '33%'}`,
        maxWidth: isFirst ? 310 : 265,
        minWidth: 175,
        background: '#fff',
        borderRadius: 22,
        padding: isFirst ? '40px 30px' : '28px 22px',
        textAlign: 'center',
        boxShadow: `0 ${isFirst ? 12 : 6}px ${isFirst ? 40 : 24}px ${MEDAL_SHADOW[idx]}`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .2s, box-shadow .2s',
        // Pódio: primeiro mais alto
        marginBottom: isFirst ? 0 : 28,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 ${isFirst ? 20 : 14}px ${isFirst ? 56 : 36}px ${MEDAL_SHADOW[idx]}` }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 ${isFirst ? 12 : 6}px ${isFirst ? 40 : 24}px ${MEDAL_SHADOW[idx]}` }}
    >
      {/* Barra topo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: isFirst ? 10 : 7, background: MEDAL_BG[idx] }} />
      {/* Número do pódio */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: PODIUM_HEIGHT[idx],
        background: `${MEDAL_BG[idx].replace('135deg', '180deg')}`,
        opacity: 0.05, pointerEvents: 'none',
      }} />
      <div style={{ fontSize: isFirst ? '4rem' : '3rem', marginBottom: 8 }}>{MEDAL[idx]}</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: MEDAL_BG[idx], color: MEDAL_TEXT[idx],
        borderRadius: 999, padding: '4px 18px', fontSize: '0.72rem', fontWeight: 800, marginBottom: 12,
      }}>
        {['🥇 Campeão', '🥈 Vice', '🥉 3º Lugar'][idx]}
      </div>
      <div style={{ fontWeight: 900, fontSize: isFirst ? '1.25rem' : '1.05rem', color: '#0E2E1C', marginBottom: 6 }}>
        {player.nome}
      </div>
      <div style={{ fontSize: isFirst ? '2.2rem' : '1.8rem', fontWeight: 900, color: '#5FB335' }}>
        {player.pontos?.toLocaleString('pt-BR') ?? '—'}
        <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 500, marginLeft: 5 }}>pts</span>
      </div>
      {(player.vitorias != null || player.derrotas != null) && (
        <div style={{ marginTop: 10, fontSize: '0.85rem' }}>
          <span style={{ color: '#5FB335', fontWeight: 700 }}>{player.vitorias ?? 0}V</span>
          <span style={{ color: '#ccc', margin: '0 5px' }}>–</span>
          <span style={{ color: '#e05555', fontWeight: 700 }}>{player.derrotas ?? 0}D</span>
        </div>
      )}
      {player.categoria && (
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#7a9a7a', fontWeight: 600 }}>{player.categoria}</div>
      )}
    </div>
  )
}

export default function Ranking() {
  const navigate = useNavigate()
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('all')
  const [torneioFiltro, setTorneioFiltro] = useState('all')

  useEffect(() => {
    api.get('/api/ranking')
      .then(d => { setRanking(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categorias = useMemo(() => {
    const cats = new Set(ranking.map(p => p.categoria).filter(Boolean))
    return ['all', ...cats]
  }, [ranking])

  const torneios = useMemo(() => {
    const ts = new Set(ranking.map(p => p.torneio).filter(Boolean))
    return ['all', ...ts]
  }, [ranking])

  const filtrado = useMemo(() => {
    return ranking.filter(p => {
      const matchBusca = !busca || p.nome?.toLowerCase().includes(busca.toLowerCase())
      const matchCat = catFiltro === 'all' || p.categoria === catFiltro
      const matchTorneio = torneioFiltro === 'all' || p.torneio === torneioFiltro
      return matchBusca && matchCat && matchTorneio
    })
  }, [ranking, busca, catFiltro, torneioFiltro])

  const top3 = ranking.slice(0, 3)
  const isFiltered = busca || catFiltro !== 'all' || torneioFiltro !== 'all'
  const tableRows = filtrado
  const visibleRows = useEntranceAnimation(tableRows.length)

  // KPIs
  const totalAtletas = ranking.length
  const totalCats = new Set(ranking.map(p => p.categoria).filter(Boolean)).size
  const totalTorneios = new Set(ranking.map(p => p.torneio).filter(Boolean)).size

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0E2E1C 0%, #1a4a2e 100%)',
        padding: '40px 24px 68px', color: '#F4F6EF',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', right: '4%', fontSize: '7rem', opacity: 0.06, pointerEvents: 'none' }}>🎾</div>
        <div style={{ position: 'absolute', bottom: '5%', left: '2%', fontSize: '5rem', opacity: 0.05, pointerEvents: 'none' }}>🏆</div>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Link to="/" style={{ color: '#8FD64A', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Início</Link>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 6px', letterSpacing: '-0.02em' }}>
            🏆 Ranking
          </h1>
          <p style={{ color: '#a0c8a0', margin: 0 }}>4ª Agro Open de Tênis · 2026</p>
        </div>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 44" preserveAspectRatio="none">
          <path d="M0,44 C480,4 960,44 1440,14 L1440,44 Z" fill="#F4F6EF" />
        </svg>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 56px' }}>

        {/* KPIs */}
        {!loading && ranking.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
            marginTop: 28, marginBottom: 32,
          }}>
            {[
              { icon: '👥', label: 'Atletas inscritos', value: totalAtletas, color: '#5FB335' },
              { icon: '🎾', label: 'Categorias', value: totalCats || 6, color: '#C9A656' },
              { icon: '🏆', label: 'Torneios realizados', value: totalTorneios || 3, color: '#0E2E1C' },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 18, padding: '22px 18px',
                textAlign: 'center', boxShadow: '0 3px 16px rgba(0,0,0,0.07)',
                border: '1px solid rgba(95,179,53,0.1)',
                transition: 'transform .2s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{kpi.icon}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#7a9a7a', fontWeight: 600, marginTop: 5, letterSpacing: '0.04em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Pódio */}
        {!loading && top3.length > 0 && (
          <div style={{ marginBottom: 52 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0E2E1C', margin: 0 }}>🏅 Pódio</h2>
            </div>
            {/* Plataforma visual */}
            <div style={{ position: 'relative', marginBottom: 0 }}>
              <div style={{
                display: 'flex', gap: 16, justifyContent: 'center',
                alignItems: 'flex-end', flexWrap: 'wrap',
              }}>
                {top3.length >= 2 && <PodiumCard player={top3[1]} idx={1} />}
                {top3.length >= 1 && <PodiumCard player={top3[0]} idx={0} />}
                {top3.length >= 3 && <PodiumCard player={top3[2]} idx={2} />}
              </div>
              {/* Degraus do pódio */}
              <div style={{
                display: 'flex', gap: 4, justifyContent: 'center', marginTop: 16,
                maxWidth: 340, margin: '16px auto 0',
              }}>
                {[160, 200, 140].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: h / 10, borderRadius: '8px 8px 0 0',
                    background: MEDAL_BG[i === 0 ? 1 : i === 1 ? 0 : 2],
                    opacity: 0.4,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Busca e filtros */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20,
          display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: '#999' }}>🔍</span>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar jogador…"
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 12,
                paddingTop: 10, paddingBottom: 10,
                borderRadius: 10, border: '1.5px solid #d0dcc8',
                fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#5FB335'}
              onBlur={e => e.target.style.borderColor = '#d0dcc8'}
            />
          </div>
          {categorias.length > 1 && (
            <select
              value={catFiltro}
              onChange={e => setCatFiltro(e.target.value)}
              style={{
                flex: '0 1 190px', padding: '10px 12px',
                borderRadius: 10, border: '1.5px solid #d0dcc8',
                fontSize: '0.9rem', outline: 'none', color: '#0E2E1C',
                background: '#fff', cursor: 'pointer',
              }}
            >
              <option value="all">Todas as categorias</option>
              {categorias.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {torneios.length > 1 && (
            <select
              value={torneioFiltro}
              onChange={e => setTorneioFiltro(e.target.value)}
              style={{
                flex: '0 1 190px', padding: '10px 12px',
                borderRadius: 10, border: '1.5px solid #d0dcc8',
                fontSize: '0.9rem', outline: 'none', color: '#0E2E1C',
                background: '#fff', cursor: 'pointer',
              }}
            >
              <option value="all">Todos os torneios</option>
              {torneios.filter(t => t !== 'all').map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {isFiltered && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', color: '#5a7a5a' }}>{filtrado.length} resultado{filtrado.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { setBusca(''); setCatFiltro('all'); setTorneioFiltro('all') }}
                style={{
                  background: '#e8f0dc', border: 'none', borderRadius: 8, padding: '5px 12px',
                  fontSize: '0.78rem', color: '#5a7a5a', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Limpar ✕
              </button>
            </div>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#5FB335', fontSize: '2.5rem' }}>🎾</div>
        ) : filtrado.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#999' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔍</div>
            Nenhum jogador encontrado
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px',
              background: 'linear-gradient(135deg,#0E2E1C,#1a4a2e)',
              padding: '14px 20px', color: '#8FD64A',
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
            }}>
              <div style={{ textAlign: 'center' }}>#</div>
              <div>Jogador</div>
              <div style={{ textAlign: 'right' }}>Pontos</div>
              <div style={{ textAlign: 'center' }}>V – D</div>
              <div style={{ textAlign: 'right' }}>Elo</div>
            </div>

            {tableRows.map((p, i) => {
              const pos = p.posicao || i + 1
              const hasMedal = pos <= 3 && !isFiltered
              const isVisible = visibleRows.includes(i)
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 120px 100px 100px',
                  padding: '13px 20px', alignItems: 'center',
                  borderBottom: '1px solid #f0f4e8',
                  background: hasMedal
                    ? (pos === 1 ? 'rgba(201,166,86,0.07)' : pos === 2 ? 'rgba(158,158,158,0.05)' : 'rgba(205,127,50,0.06)')
                    : (i % 2 === 0 ? '#fff' : '#fafcf8'),
                  transition: 'background .1s, opacity .3s, transform .3s',
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateX(0)' : 'translateX(-10px)',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = hasMedal
                      ? (pos === 1 ? 'rgba(201,166,86,0.07)' : pos === 2 ? 'rgba(158,158,158,0.05)' : 'rgba(205,127,50,0.06)')
                      : (i % 2 === 0 ? '#fff' : '#fafcf8')
                  }}
                >
                  <div style={{ textAlign: 'center', fontWeight: 800 }}>
                    {hasMedal
                      ? <span style={{ fontSize: '1.3rem' }}>{MEDAL[pos - 1]}</span>
                      : <span style={{ color: '#999', fontSize: '0.88rem' }}>{pos}</span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0E2E1C', fontSize: '0.95rem' }}>{p.nome}</div>
                    {p.categoria && <div style={{ fontSize: '0.72rem', color: '#7a9a7a', marginTop: 2 }}>{p.categoria}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 900, color: '#5FB335', fontSize: '1.05rem' }}>
                    {p.pontos?.toLocaleString('pt-BR') ?? '—'}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: '#5FB335', fontWeight: 700 }}>{p.vitorias ?? '—'}</span>
                    <span style={{ color: '#ccc', margin: '0 4px' }}>–</span>
                    <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? '—'}</span>
                  </div>
                  <div style={{ textAlign: 'right', color: '#888', fontSize: '0.85rem' }}>
                    {p.elo ?? p.rating ?? '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && ranking.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{ fontSize: '0.78rem', color: '#aaa' }}>
              Atualizado em {new Date().toLocaleDateString('pt-BR')} · {ranking.length} atleta{ranking.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button
            onClick={() => navigate('/inscricao')}
            style={{
              background: 'linear-gradient(135deg,#5FB335,#8FD64A)', color: '#0E2E1C',
              border: 'none', borderRadius: 12, padding: '14px 34px',
              fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem',
              boxShadow: '0 4px 16px rgba(95,179,53,0.3)', transition: 'transform .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}
          >
            🎾 Quero me inscrever
          </button>
        </div>
      </div>
    </div>
  )
}
