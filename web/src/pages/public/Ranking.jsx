import { useState, useEffect, useMemo } from 'react'
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

function PodiumCard({ player, idx }) {
  const size = idx === 0 ? { card: 'calc(33% + 20px)', pad: '36px 28px', nameSize: '1.2rem', pts: '2rem' } : { card: '33%', pad: '28px 20px', nameSize: '1.05rem', pts: '1.7rem' }
  return (
    <div style={{
      flex: `1 1 ${size.card}`,
      maxWidth: idx === 0 ? 300 : 260,
      minWidth: 180,
      background: '#fff',
      borderRadius: '20px',
      padding: size.pad,
      textAlign: 'center',
      boxShadow: `0 6px 28px ${MEDAL_SHADOW[idx]}`,
      position: 'relative',
      overflow: 'hidden',
      alignSelf: idx === 0 ? 'flex-start' : 'flex-end',
      transition: 'transform .2s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: MEDAL_BG[idx] }} />
      <div style={{ fontSize: idx === 0 ? '3.5rem' : '2.8rem', marginBottom: '8px' }}>{MEDAL[idx]}</div>
      <div style={{
        display: 'inline-block',
        background: MEDAL_BG[idx],
        color: MEDAL_TEXT[idx],
        borderRadius: '999px',
        padding: '2px 14px',
        fontSize: '0.75rem',
        fontWeight: 700,
        marginBottom: '10px',
      }}>
        #{player.posicao || idx + 1}º Lugar
      </div>
      <div style={{ fontWeight: 800, fontSize: size.nameSize, color: '#0E2E1C', marginBottom: '6px' }}>
        {player.nome}
      </div>
      <div style={{ fontSize: size.pts, fontWeight: 900, color: '#5FB335' }}>
        {player.pontos?.toLocaleString('pt-BR') ?? '—'}
        <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 500, marginLeft: 4 }}>pts</span>
      </div>
      {(player.vitorias != null || player.derrotas != null) && (
        <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
          <span style={{ color: '#5FB335', fontWeight: 700 }}>{player.vitorias ?? 0}V</span>
          <span style={{ color: '#ccc', margin: '0 4px' }}>–</span>
          <span style={{ color: '#e05555', fontWeight: 700 }}>{player.derrotas ?? 0}D</span>
        </div>
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

  useEffect(() => {
    api.get('/api/ranking')
      .then(d => { setRanking(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categorias = useMemo(() => {
    const cats = new Set(ranking.map(p => p.categoria).filter(Boolean))
    return ['all', ...cats]
  }, [ranking])

  const filtrado = useMemo(() => {
    return ranking.filter(p => {
      const matchBusca = !busca || p.nome?.toLowerCase().includes(busca.toLowerCase())
      const matchCat = catFiltro === 'all' || p.categoria === catFiltro
      return matchBusca && matchCat
    })
  }, [ranking, busca, catFiltro])

  const top3 = ranking.slice(0, 3)
  const resto = filtrado.slice(filtrado === ranking ? 3 : 0)

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6EF', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0E2E1C 0%, #1a4a2e 100%)',
        padding: '40px 24px 56px',
        color: '#F4F6EF',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', right: '4%', fontSize: '6rem', opacity: 0.07, pointerEvents: 'none' }}>🎾</div>
        <div style={{ position: 'absolute', bottom: '5%', left: '2%', fontSize: '5rem', opacity: 0.06, pointerEvents: 'none' }}>🏆</div>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Link to="/" style={{ color: '#8FD64A', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>← Início</Link>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, margin: '12px 0 6px', letterSpacing: '-0.02em' }}>
            🏆 Ranking
          </h1>
          <p style={{ color: '#a0c8a0', margin: 0 }}>4ª Agro Open de Tênis · 2026</p>
        </div>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 40" preserveAspectRatio="none">
          <path d="M0,40 C480,0 960,40 1440,10 L1440,40 Z" fill="#F4F6EF" />
        </svg>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 48px' }}>

        {/* Pódio */}
        {!loading && top3.length > 0 && (
          <div style={{ marginTop: '24px', marginBottom: '48px' }}>
            <div style={{
              display: 'flex', gap: '16px', justifyContent: 'center',
              alignItems: 'flex-end', flexWrap: 'wrap',
            }}>
              {top3.length >= 2 && <PodiumCard player={top3[1]} idx={1} />}
              {top3.length >= 1 && <PodiumCard player={top3[0]} idx={0} />}
              {top3.length >= 3 && <PodiumCard player={top3[2]} idx={2} />}
            </div>
          </div>
        )}

        {/* Busca e filtro */}
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px',
          display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: '#999' }}>🔍</span>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar jogador…"
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 12,
                paddingTop: 10, paddingBottom: 10,
                borderRadius: '10px', border: '1.5px solid #d0dcc8',
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
                flex: '0 1 200px', padding: '10px 12px',
                borderRadius: '10px', border: '1.5px solid #d0dcc8',
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
          {(busca || catFiltro !== 'all') && (
            <div style={{ fontSize: '0.85rem', color: '#5a7a5a' }}>
              {filtrado.length} jogador{filtrado.length !== 1 ? 'es' : ''}
            </div>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#5FB335', fontSize: '2rem' }}>🎾</div>
        ) : filtrado.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔍</div>
            Nenhum jogador encontrado
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {/* thead */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 120px 100px 100px',
              background: 'linear-gradient(135deg, #0E2E1C, #1a4a2e)',
              padding: '14px 20px',
              color: '#8FD64A',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              <div style={{ textAlign: 'center' }}>#</div>
              <div>Jogador</div>
              <div style={{ textAlign: 'right' }}>Pontos</div>
              <div style={{ textAlign: 'center' }}>V – D</div>
              <div style={{ textAlign: 'right' }}>Elo</div>
            </div>

            {filtrado.map((p, i) => {
              const pos = p.posicao || i + 1
              const hasMedal = pos <= 3 && !busca && catFiltro === 'all'
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 120px 100px 100px',
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: '1px solid #f0f4e8',
                  background: hasMedal ? (i === 0 ? 'rgba(201,166,86,0.06)' : i === 1 ? 'rgba(158,158,158,0.04)' : 'rgba(205,127,50,0.05)') : (i % 2 === 0 ? '#fff' : '#fafcf8'),
                  transition: 'background .1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fae8'}
                  onMouseLeave={e => e.currentTarget.style.background = hasMedal ? (i === 0 ? 'rgba(201,166,86,0.06)' : i === 1 ? 'rgba(158,158,158,0.04)' : 'rgba(205,127,50,0.05)') : (i % 2 === 0 ? '#fff' : '#fafcf8')}
                >
                  <div style={{ textAlign: 'center', fontWeight: 800 }}>
                    {hasMedal ? MEDAL[pos - 1] : (
                      <span style={{ color: '#999', fontSize: '0.9rem' }}>{pos}</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0E2E1C' }}>{p.nome}</div>
                    {p.categoria && (
                      <div style={{ fontSize: '0.75rem', color: '#5a7a5a', marginTop: '2px' }}>{p.categoria}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: '#5FB335', fontSize: '1.05rem' }}>
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
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <div style={{ fontSize: '0.8rem', color: '#999' }}>
              Atualizado em {new Date().toLocaleDateString('pt-BR')} · {ranking.length} atletas
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <button
            onClick={() => navigate('/inscricao')}
            style={{
              background: 'linear-gradient(135deg, #5FB335, #8FD64A)',
              color: '#0E2E1C',
              border: 'none', borderRadius: '12px', padding: '14px 32px',
              fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem',
              boxShadow: '0 4px 16px rgba(95,179,53,0.3)',
            }}
          >
            🎾 Quero me inscrever
          </button>
        </div>
      </div>
    </div>
  )
}
