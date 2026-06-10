import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, fmtR } from '../../lib/api'

const CATEGORIAS = [
  { nome: 'Simples Masculino A', icon: '🎾' },
  { nome: 'Simples Masculino B', icon: '🎾' },
  { nome: 'Simples Feminino', icon: '🎾' },
  { nome: 'Duplas Masculinas', icon: '👥' },
  { nome: 'Duplas Mistas', icon: '💑' },
  { nome: 'Masters +40', icon: '🏆' },
]

function TennisBall({ style }) {
  return (
    <div style={{
      position: 'absolute',
      fontSize: '3rem',
      opacity: 0.08,
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}>🎾</div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [ranking, setRanking] = useState([])
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/info').catch(() => null),
      api.get('/api/ranking').catch(() => []),
    ]).then(([infoData, rankData]) => {
      if (infoData) setInfo(infoData)
      setRanking(Array.isArray(rankData) ? rankData.slice(0, 3) : [])
      setLoading(false)
    })
  }, [])

  const medals = ['🥇', '🥈', '🥉']
  const medalColors = [
    { bg: 'linear-gradient(135deg, #C9A656 0%, #f0d080 50%, #C9A656 100%)', border: '#C9A656', text: '#0E2E1C' },
    { bg: 'linear-gradient(135deg, #9e9e9e 0%, #d4d4d4 50%, #9e9e9e 100%)', border: '#b0b0b0', text: '#0E2E1C' },
    { bg: 'linear-gradient(135deg, #cd7f32 0%, #e8a96a 50%, #cd7f32 100%)', border: '#cd7f32', text: '#fff' },
  ]

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: '#F4F6EF', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative',
        background: 'linear-gradient(160deg, #0E2E1C 0%, #1a4a2e 50%, #0a2014 100%)',
        color: '#F4F6EF',
        padding: '80px 24px 100px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Decorative balls */}
        <TennisBall style={{ top: '10%', left: '3%', fontSize: '6rem' }} />
        <TennisBall style={{ top: '20%', right: '4%', fontSize: '8rem', transform: 'rotate(20deg)' }} />
        <TennisBall style={{ bottom: '5%', left: '15%', fontSize: '5rem', transform: 'rotate(-15deg)' }} />
        <TennisBall style={{ bottom: '15%', right: '10%', fontSize: '4rem' }} />
        <TennisBall style={{ top: '50%', left: '40%', fontSize: '10rem', opacity: 0.04 }} />

        {/* Badge evento */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(143,214,74,0.15)',
          border: '1px solid #8FD64A',
          color: '#8FD64A',
          borderRadius: '999px',
          padding: '6px 20px',
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '24px',
        }}>
          ⚡ Inscrições Abertas
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 4.5rem)',
          fontWeight: 900,
          margin: '0 0 8px',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          textShadow: '0 2px 20px rgba(0,0,0,0.4)',
        }}>
          4ª AGRO OPEN<br />
          <span style={{ color: '#8FD64A' }}>DE TÊNIS</span>
        </h1>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(201,166,86,0.15)',
          border: '1px solid rgba(201,166,86,0.4)',
          borderRadius: '12px',
          padding: '10px 24px',
          margin: '20px 0 8px',
        }}>
          <span style={{ fontSize: '1.4rem' }}>📅</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#C9A656' }}>
            07 a 13 de Setembro de 2026
          </span>
        </div>

        <p style={{ fontSize: '1rem', color: '#a0c8a0', margin: '8px 0 36px', letterSpacing: '0.05em' }}>
          🏟️ Tangará Tênis Clube — UISA
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/inscricao')}
            style={{
              background: 'linear-gradient(135deg, #5FB335, #8FD64A)',
              color: '#0E2E1C',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 36px',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(95,179,53,0.4)',
              transition: 'transform .15s, box-shadow .15s',
              letterSpacing: '0.04em',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(95,179,53,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(95,179,53,0.4)' }}
          >
            🎾 Inscreva-se Agora
          </button>
          <button
            onClick={() => navigate('/ranking')}
            style={{
              background: 'transparent',
              color: '#F4F6EF',
              border: '2px solid rgba(244,246,239,0.4)',
              borderRadius: '12px',
              padding: '16px 36px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'border-color .15s, background .15s',
              letterSpacing: '0.04em',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#8FD64A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(244,246,239,0.4)' }}
          >
            🏆 Ver Ranking
          </button>
        </div>

        {/* Wave divider */}
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d="M0,60 C360,0 1080,60 1440,20 L1440,60 Z" fill="#F4F6EF" />
        </svg>
      </section>

      {/* ── TOP 3 RANKING ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0E2E1C', margin: '0 0 8px' }}>
            🏆 Top Jogadores
          </h2>
          <p style={{ color: '#5a7a5a', margin: 0 }}>Os melhores classificados do torneio</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#5FB335', padding: '32px', fontSize: '1.5rem' }}>🎾</div>
        ) : ranking.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '32px' }}>Ranking ainda não disponível</div>
        ) : (
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {ranking.map((p, i) => {
              const mc = medalColors[i]
              return (
                <div key={i} style={{
                  background: '#fff',
                  borderRadius: '20px',
                  padding: '32px 28px',
                  textAlign: 'center',
                  boxShadow: `0 4px 24px rgba(0,0,0,0.08), 0 0 0 2px ${mc.border}30`,
                  flex: '1 1 220px',
                  maxWidth: '260px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform .2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                >
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
                    background: mc.bg,
                  }} />
                  <div style={{ fontSize: '3rem', marginBottom: '8px' }}>{medals[i]}</div>
                  <div style={{
                    display: 'inline-block',
                    background: mc.bg,
                    color: mc.text,
                    borderRadius: '999px',
                    padding: '2px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    marginBottom: '12px',
                  }}>#{p.posicao || i + 1}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0E2E1C', marginBottom: '4px' }}>
                    {p.nome}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#5FB335' }}>
                    {p.pontos?.toLocaleString('pt-BR') ?? '—'} <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500 }}>pts</span>
                  </div>
                  {(p.vitorias != null || p.derrotas != null) && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
                      <span style={{ color: '#5FB335', fontWeight: 700 }}>{p.vitorias ?? 0}V</span>
                      {' '}–{' '}
                      <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? 0}D</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link to="/ranking" style={{
            color: '#5FB335', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem',
            borderBottom: '2px solid #8FD64A', paddingBottom: '2px',
          }}>
            Ver ranking completo →
          </Link>
        </div>
      </section>

      {/* ── CATEGORIAS ── */}
      <section style={{
        background: 'linear-gradient(180deg, #f0f4e8 0%, #e8f0dc 100%)',
        padding: '56px 24px',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0E2E1C', margin: '0 0 8px' }}>
              🎾 Categorias
            </h2>
            <p style={{ color: '#5a7a5a', margin: 0 }}>Escolha sua categoria e inscreva-se</p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px',
          }}>
            {CATEGORIAS.map((cat, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: '1px solid rgba(95,179,53,0.15)',
                cursor: 'pointer',
                transition: 'transform .15s, box-shadow .15s, border-color .15s',
              }}
                onClick={() => navigate('/inscricao')}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(95,179,53,0.15)'; e.currentTarget.style.borderColor = '#5FB335' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(95,179,53,0.15)' }}
              >
                <div style={{
                  width: 44, height: 44,
                  background: 'linear-gradient(135deg, #5FB335, #8FD64A)',
                  borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', flexShrink: 0,
                }}>
                  {cat.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0E2E1C', fontSize: '0.95rem' }}>{cat.nome}</div>
                  <div style={{ fontSize: '0.78rem', color: '#5FB335', fontWeight: 600, marginTop: '2px' }}>Inscrições abertas</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0E2E1C 0%, #1a4a2e 60%, #0E2E1C 100%)',
        padding: '72px 24px',
        textAlign: 'center',
        color: '#F4F6EF',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <TennisBall style={{ top: '10%', left: '5%', fontSize: '5rem' }} />
        <TennisBall style={{ bottom: '10%', right: '5%', fontSize: '7rem' }} />

        <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.8rem)', fontWeight: 900, margin: '0 0 12px', position: 'relative' }}>
          Pronto para competir?
        </h2>
        <p style={{ color: '#a0c8a0', fontSize: '1.1rem', margin: '0 0 36px', position: 'relative' }}>
          Garanta sua vaga na 4ª Agro Open de Tênis.<br />
          Vagas limitadas por categoria.
        </p>
        <button
          onClick={() => navigate('/inscricao')}
          style={{
            background: 'linear-gradient(135deg, #5FB335, #8FD64A)',
            color: '#0E2E1C',
            border: 'none',
            borderRadius: '14px',
            padding: '18px 48px',
            fontSize: '1.1rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(95,179,53,0.4)',
            letterSpacing: '0.04em',
            position: 'relative',
            transition: 'transform .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = ''}
        >
          🎾 Fazer Inscrição
        </button>

        {/* Info bar */}
        <div style={{
          display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap',
          marginTop: '48px', paddingTop: '32px',
          borderTop: '1px solid rgba(244,246,239,0.1)',
        }}>
          {[
            { icon: '📅', label: 'Datas', value: '07–13 Set 2026' },
            { icon: '🏟️', label: 'Local', value: 'Tangará Tênis Clube' },
            { icon: '🏢', label: 'Realização', value: 'UISA' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{item.icon}</div>
              <div style={{ fontSize: '0.75rem', color: '#8FD64A', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ fontWeight: 600, color: '#F4F6EF', marginTop: '2px' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
