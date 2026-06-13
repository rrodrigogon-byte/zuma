import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

// Categorias e patrocinadores fixos do evento (configurações do torneio)
const PATROCINADORES = [
  { nome: 'UISA Agroindustrial', icon: '🌾', cor: '#5FB335' },
  { nome: 'Tangará Tênis Clube', icon: '🎾', cor: '#C9A656' },
  { nome: 'Prefeitura de Tangará da Serra', icon: '🏛️', cor: '#0E2E1C' },
]

const INFO_CARDS = [
  { icon: '📅', label: 'Datas', value: '07 a 13 Set 2026', sub: 'Domingo a Sábado' },
  { icon: '📍', label: 'Local', value: 'Tangará Tênis Clube', sub: 'Tangará da Serra – MT' },
  { icon: '🎾', label: 'Categorias', value: '14 categorias', sub: 'Masc · Fem · Misto · Sênior' },
  { icon: '🏆', label: 'Premiação', value: 'R$ 5.000', sub: 'Em prêmios + troféus' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function TennisBall({ style }) {
  return (
    <div style={{ position: 'absolute', fontSize: '3rem', opacity: 0.07, userSelect: 'none', pointerEvents: 'none', ...style }}>
      🎾
    </div>
  )
}

function useCountdown(target) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    const calc = () => setDiff(Math.max(0, new Date(target) - Date.now()))
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [target])
  const total = Math.floor(diff / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { days, hours, minutes, seconds }
}

function CountdownUnit({ value, label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
      borderRadius: 16, padding: '18px 24px', minWidth: 80,
      border: '1px solid rgba(143,214,74,0.25)',
    }}>
      <span style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 900, color: '#8FD64A', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </span>
      <span style={{ fontSize: '0.7rem', color: '#a0c8a0', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
        {label}
      </span>
    </div>
  )
}

// ── Scroll reveal hook ────────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

function RevealSection({ children, style }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target, duration = 1800 }) {
  const [value, setValue] = useState(0)
  const { ref, visible } = useReveal()
  const started = useRef(false)

  useEffect(() => {
    if (!visible || started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // easeOut
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, target, duration])

  return <span ref={ref}>{value}</span>
}

// ── Ranking skeleton ─────────────────────────────────────────────────────────

function RankingSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {[{ w: 240, h: 260 }, { w: 200, h: 220 }, { w: 200, h: 200 }].map((s, i) => (
        <div key={i} style={{
          width: s.w, height: s.h, borderRadius: 20,
          background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmerLight 1.5s infinite',
        }} />
      ))}
    </div>
  )
}

// ── Notícias section ──────────────────────────────────────────────────────────

const CAT_COLORS = {
  evento: '#5FB335', resultado: '#C9A656', inscricao: '#8FD64A',
  geral: '#6b7280', comunicado: '#e05c5c',
}

function NoticiaCard({ noticia }) {
  const cat = (noticia.categoria || 'geral').toLowerCase()
  const cor = CAT_COLORS[cat] || '#6b7280'
  const dataStr = noticia.data_publicacao
    ? new Date(noticia.data_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : ''

  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: '22px 20px',
      boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
      border: `1px solid ${cor}25`,
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'transform .2s, box-shadow .2s', cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${cor}22` }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 14px rgba(0,0,0,0.06)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          background: cor + '18', color: cor,
          border: `1px solid ${cor}33`, borderRadius: 999,
          padding: '3px 12px', fontSize: '0.7rem', fontWeight: 800,
          textTransform: 'capitalize',
        }}>
          {noticia.categoria || 'Geral'}
        </span>
        {dataStr && (
          <span style={{ fontSize: '0.72rem', color: '#7a9a7a', fontWeight: 600 }}>{dataStr}</span>
        )}
      </div>
      <div style={{ fontWeight: 800, color: '#0E2E1C', fontSize: '0.95rem', lineHeight: 1.35 }}>
        {noticia.titulo}
      </div>
      {noticia.resumo && (
        <div style={{ fontSize: '0.8rem', color: '#5a7a5a', lineHeight: 1.5 }}>
          {noticia.resumo.length > 100 ? noticia.resumo.slice(0, 100) + '…' : noticia.resumo}
        </div>
      )}
    </div>
  )
}

// ── WhatsApp FAB ──────────────────────────────────────────────────────────────

function WhatsAppFAB() {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href="https://wa.me/5565999999999?text=Quero%20me%20inscrever%20no%204ª%20Agro%20Open"
      target="_blank"
      rel="noopener noreferrer"
      title="Fale conosco no WhatsApp"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        width: 58, height: 58, borderRadius: '50%',
        background: hovered ? '#128C7E' : '#25D366',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: hovered ? '0 8px 28px rgba(37,211,102,0.55)' : '0 4px 18px rgba(37,211,102,0.4)',
        transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        fontSize: 28, textDecoration: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      💬
    </a>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { days, hours, minutes, seconds } = useCountdown('2026-09-07T08:00:00')
  const [ranking, setRanking] = useState([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [noticias, setNoticias] = useState([])
  const [noticiasLoading, setNoticiasLoading] = useState(true)
  const [totalInscritos, setTotalInscritos] = useState(null)    // null = ainda carregando
  const [categorias, setCategorias] = useState([])              // da API real

  useEffect(() => {
    // Ranking público
    api.get('/api/ranking').catch(() => []).then(d => {
      setRanking(Array.isArray(d) ? d.slice(0, 3) : [])
      setRankingLoading(false)
    })
    // Notícias publicadas
    api.get('/api/noticias?publicado=1').catch(() => []).then(d => {
      setNoticias(Array.isArray(d) ? d.slice(0, 3) : d?.noticias?.slice(0, 3) ?? [])
      setNoticiasLoading(false)
    })
    // Contagem real de inscrições aprovadas/pagas (endpoint público de inscrições)
    api.get('/api/inscricoes-count').catch(() => null).then(d => {
      const count = d?.total ?? d?.count ?? null
      setTotalInscritos(typeof count === 'number' ? count : null)
    })
    // Categorias da API (para mostrar vagas reais)
    api.get('/api/categorias').catch(() => []).then(d => {
      if (Array.isArray(d) && d.length > 0) setCategorias(d)
    })
  }, [])

  const medals = ['🥇', '🥈', '🥉']
  const medalColors = [
    { bg: 'linear-gradient(135deg,#C9A656,#f0d080,#C9A656)', border: '#C9A656', text: '#0E2E1C', h: 200 },
    { bg: 'linear-gradient(135deg,#9e9e9e,#d4d4d4,#9e9e9e)', border: '#b0b0b0', text: '#0E2E1C', h: 160 },
    { bg: 'linear-gradient(135deg,#cd7f32,#e8a96a,#cd7f32)', border: '#cd7f32', text: '#fff', h: 140 },
  ]
  const podiumOrder = [1, 0, 2]

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: '#F4F6EF', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative',
        background: 'linear-gradient(160deg, #071a0f 0%, #0E2E1C 40%, #1a4a2e 70%, #0a2014 100%)',
        color: '#F4F6EF', padding: '80px 24px 120px',
        textAlign: 'center', overflow: 'hidden',
      }}>
        <TennisBall style={{ top: '8%', left: '2%', fontSize: '7rem' }} />
        <TennisBall style={{ top: '15%', right: '3%', fontSize: '9rem', transform: 'rotate(20deg)' }} />
        <TennisBall style={{ bottom: '8%', left: '12%', fontSize: '5rem', transform: 'rotate(-15deg)' }} />
        <TennisBall style={{ bottom: '20%', right: '8%', fontSize: '4rem' }} />
        <TennisBall style={{ top: '45%', left: '38%', fontSize: '12rem', opacity: 0.03 }} />

        <div style={{
          display: 'inline-block',
          background: 'rgba(143,214,74,0.15)', border: '1.5px solid #8FD64A',
          color: '#8FD64A', borderRadius: '999px', padding: '7px 22px',
          fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase', marginBottom: 28,
          animation: 'pulseBadge 2s ease-in-out infinite',
        }}>
          ⚡ Inscrições Abertas
        </div>

        <h1 style={{
          fontSize: 'clamp(2.2rem, 7vw, 5rem)', fontWeight: 900, margin: '0 0 6px',
          lineHeight: 1.05, letterSpacing: '-0.02em',
          textShadow: '0 4px 30px rgba(0,0,0,0.5)',
        }}>
          4ª AGRO OPEN<br />
          <span style={{ color: '#8FD64A' }}>DE TÊNIS</span>
        </h1>

        <p style={{ color: '#a0c8a0', fontSize: '1.05rem', margin: '12px 0 32px', letterSpacing: '0.04em' }}>
          🏟️ Tangará Tênis Clube · UISA · Tangará da Serra – MT
        </p>

        {/* Contador de inscritos — só exibe se totalInscritos > 0 */}
        {totalInscritos !== null && totalInscritos > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(95,179,53,0.12)', border: '1px solid rgba(95,179,53,0.3)',
            borderRadius: 12, padding: '10px 20px', marginBottom: 28,
          }}>
            <span style={{ fontSize: '1.5rem' }}>🎾</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 900, color: '#8FD64A', lineHeight: 1 }}>
                <AnimatedCounter target={totalInscritos} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a0c8a0', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                atletas inscritos
              </div>
            </div>
          </div>
        )}

        {/* Countdown */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: '#8FD64A', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            Começa em
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <CountdownUnit value={days} label="Dias" />
            <CountdownUnit value={hours} label="Horas" />
            <CountdownUnit value={minutes} label="Min" />
            <CountdownUnit value={seconds} label="Seg" />
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/inscricao')}
            style={{
              background: 'linear-gradient(135deg, #5FB335, #8FD64A)',
              color: '#0E2E1C', border: 'none', borderRadius: 14,
              padding: '16px 38px', fontSize: '1rem', fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 6px 24px rgba(95,179,53,0.45)',
              letterSpacing: '0.04em', transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(95,179,53,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(95,179,53,0.45)' }}
          >
            🎾 Inscreva-se Agora
          </button>
          <button
            onClick={() => navigate('/ranking')}
            style={{
              background: 'transparent', color: '#F4F6EF',
              border: '2px solid rgba(244,246,239,0.35)', borderRadius: 14,
              padding: '16px 38px', fontSize: '1rem', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.04em', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#8FD64A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(244,246,239,0.35)' }}
          >
            🎯 Ver Chaves
          </button>
        </div>

        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 70" preserveAspectRatio="none">
          <path d="M0,70 C360,10 1080,65 1440,25 L1440,70 Z" fill="#F4F6EF" />
        </svg>
      </section>

      {/* ── INFO CARDS ── */}
      <RevealSection>
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 20 }}>
            {INFO_CARDS.map((c, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 20, padding: '28px 22px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                border: '1px solid rgba(95,179,53,0.1)',
                textAlign: 'center', transition: 'transform .2s, box-shadow .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(95,179,53,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)' }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>{c.icon}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5FB335', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                <div style={{
                  fontSize: i === 3 ? '1.6rem' : '1.05rem',
                  fontWeight: 900, color: i === 3 ? '#C9A656' : '#0E2E1C', lineHeight: 1.2,
                }}>{c.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#7a9a7a', marginTop: 4 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* ── CATEGORIAS — exibe se API retornar dados; caso contrário mostra CTA simples ── */}
      <RevealSection>
        <section style={{ background: 'linear-gradient(180deg,#f0f4e8 0%,#e8f0dc 100%)', padding: '60px 24px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>🎾 Categorias</h2>
              <p style={{ color: '#5a7a5a', margin: 0 }}>Escolha sua categoria e garanta sua vaga</p>
            </div>

            {categorias.length > 0 ? (
              /* Grid de categorias com dados reais da API */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {categorias.slice(0, 12).map((cat, i) => {
                  const precoFmt = cat.preco ? `R$ ${Number(cat.preco).toFixed(0)}` : 'Sob consulta'
                  const icons = ['🎾','🎾','👩','👥','💑','🏆','🏅','⭐','🎯','🔥','💪','🌟']
                  return (
                    <div key={cat.id ?? i} style={{
                      background: '#fff', borderRadius: 18, padding: '22px 20px',
                      boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
                      border: '1px solid rgba(95,179,53,0.12)',
                      cursor: 'pointer', transition: 'transform .15s, box-shadow .15s, border-color .15s',
                    }}
                      onClick={() => navigate('/inscricao')}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(95,179,53,0.18)'; e.currentTarget.style.borderColor = '#5FB335' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 14px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(95,179,53,0.12)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                          background: 'linear-gradient(135deg,#5FB335,#8FD64A)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                        }}>{icons[i % icons.length]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: '#0E2E1C', fontSize: '0.9rem', lineHeight: 1.3 }}>{cat.nome}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#5FB335' }}>{precoFmt}</div>
                            {cat.inscritos > 0 && (
                              <div style={{
                                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                                borderRadius: 20,
                                background: cat.vagas && cat.inscritos >= cat.vagas ? '#e0555522' : '#5FB33518',
                                color: cat.vagas && cat.inscritos >= cat.vagas ? '#e05555' : '#3a7a1e',
                                border: `1px solid ${cat.vagas && cat.inscritos >= cat.vagas ? '#e0555544' : '#5FB33540'}`,
                              }}>
                                {cat.vagas
                                  ? `${cat.inscritos}/${cat.vagas} vagas`
                                  : `${cat.inscritos} inscrito${cat.inscritos !== 1 ? 's' : ''}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Fallback elegante quando a API não retornou categorias */
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎾</div>
                <div style={{ color: '#5a7a5a', fontSize: '1rem', marginBottom: 8 }}>
                  <strong style={{ color: '#0E2E1C' }}>14 categorias disponíveis</strong>
                </div>
                <div style={{ color: '#7a9a7a', fontSize: '0.9rem' }}>
                  Masc PRO · 1ª a 5ª Classe · Veteranos · Feminino · Duplas
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button onClick={() => navigate('/inscricao')} style={{
                background: 'linear-gradient(135deg,#5FB335,#8FD64A)', color: '#0E2E1C',
                border: 'none', borderRadius: 12, padding: '14px 32px',
                fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(95,179,53,0.3)', transition: 'transform .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
              >
                Inscreva-se agora →
              </button>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── TOP 3 RANKING ── */}
      <RevealSection>
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>🏆 Top Jogadores</h2>
            <p style={{ color: '#5a7a5a', margin: 0 }}>Os melhores classificados do ranking atual</p>
          </div>
          {rankingLoading ? (
            <RankingSkeleton />
          ) : ranking.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📊</div>
              <div style={{ color: '#888', fontSize: '1rem' }}>Ranking ainda não disponível</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 32 }}>
                {podiumOrder.filter(pi => pi < ranking.length).map(pi => {
                  const p = ranking[pi]
                  const mc = medalColors[pi]
                  return (
                    <div key={pi} style={{
                      flex: `1 1 ${pi === 0 ? '260px' : '220px'}`,
                      maxWidth: pi === 0 ? 300 : 250, minWidth: 180,
                      background: '#fff', borderRadius: 20,
                      padding: pi === 0 ? '36px 28px' : '28px 22px',
                      textAlign: 'center',
                      boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 0 2px ${mc.border}40`,
                      position: 'relative', overflow: 'hidden',
                      marginBottom: pi === 0 ? 0 : 20,
                      transition: 'transform .2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = ''}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: mc.bg }} />
                      <div style={{ fontSize: pi === 0 ? '3.8rem' : '3rem', marginBottom: 8 }}>{medals[pi]}</div>
                      <div style={{
                        display: 'inline-block', background: mc.bg, color: mc.text,
                        borderRadius: 999, padding: '3px 16px', fontSize: '0.72rem', fontWeight: 800, marginBottom: 10,
                      }}>
                        {pi + 1}º Lugar
                      </div>
                      <div style={{ fontWeight: 800, fontSize: pi === 0 ? '1.2rem' : '1rem', color: '#0E2E1C', marginBottom: 6 }}>{p.nome}</div>
                      <div style={{ fontSize: pi === 0 ? '2rem' : '1.65rem', fontWeight: 900, color: '#5FB335' }}>
                        {p.pontos?.toLocaleString('pt-BR') ?? '—'}
                        <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 500, marginLeft: 4 }}>pts</span>
                      </div>
                      {(p.vitorias != null || p.derrotas != null) && (
                        <div style={{ marginTop: 8, fontSize: '0.82rem' }}>
                          <span style={{ color: '#5FB335', fontWeight: 700 }}>{p.vitorias ?? 0}V</span>
                          <span style={{ color: '#ccc', margin: '0 4px' }}>–</span>
                          <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? 0}D</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ textAlign: 'center' }}>
                <Link to="/ranking" style={{ color: '#5FB335', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem', borderBottom: '2px solid #8FD64A', paddingBottom: 2 }}>
                  Ver ranking completo →
                </Link>
              </div>
            </>
          )}
        </section>
      </RevealSection>

      {/* ── NOTÍCIAS ── */}
      {(noticiasLoading || noticias.length > 0) && (
        <RevealSection>
          <section style={{ background: 'linear-gradient(180deg,#f8faf4 0%,#f0f4e8 100%)', padding: '60px 24px' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>📰 Últimas Notícias</h2>
                <p style={{ color: '#5a7a5a', margin: 0 }}>Fique por dentro de tudo sobre o torneio</p>
              </div>
              {noticiasLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      background: '#fff', borderRadius: 18, padding: '22px 20px', height: 160,
                      display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                      <div style={{ background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)', backgroundSize: '200% 100%', animation: 'shimmerLight 1.5s infinite', borderRadius: 999, height: 20, width: '40%' }} />
                      <div style={{ background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)', backgroundSize: '200% 100%', animation: 'shimmerLight 1.5s infinite', borderRadius: 6, height: 14, width: '85%' }} />
                      <div style={{ background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)', backgroundSize: '200% 100%', animation: 'shimmerLight 1.5s infinite', borderRadius: 6, height: 12, width: '70%' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {noticias.map((n, i) => <NoticiaCard key={n.id ?? i} noticia={n} />)}
                </div>
              )}
            </div>
          </section>
        </RevealSection>
      )}

      {/* ── PATROCINADORES ── */}
      <RevealSection>
        <section style={{
          background: 'linear-gradient(135deg,#C9A656 0%,#e8c96c 50%,#C9A656 100%)',
          padding: '48px 24px',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7a5a10', marginBottom: 24 }}>
              Patrocínio & Realização
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {PATROCINADORES.map((p, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.85)', borderRadius: 16,
                  padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  transition: 'transform .15s, box-shadow .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                >
                  <span style={{ fontSize: '2rem' }}>{p.icon}</span>
                  <span style={{ fontWeight: 800, color: p.cor, fontSize: '0.95rem' }}>{p.nome}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── GALERIA ── */}
      <RevealSection>
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>📸 Galeria</h2>
            <p style={{ color: '#5a7a5a', margin: 0 }}>Momentos das edições anteriores</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { grad: 'linear-gradient(135deg,#0E2E1C,#1a4a2e)', label: 'Abertura do torneio' },
              { grad: 'linear-gradient(135deg,#1a4a2e,#5FB335)', label: 'Partidas das quartas' },
              { grad: 'linear-gradient(135deg,#5FB335,#8FD64A)', label: 'Semifinais masculino' },
              { grad: 'linear-gradient(135deg,#C9A656,#f0d080)', label: 'Premiação feminino' },
              { grad: 'linear-gradient(135deg,#0a2014,#0E2E1C)', label: 'Grande final 2025' },
              { grad: 'linear-gradient(135deg,#8FD64A,#C9A656)', label: 'Cerimônia de encerramento' },
            ].map((item, i) => (
              <div key={i} style={{
                background: item.grad, borderRadius: 18, height: 200,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12, cursor: 'pointer',
                overflow: 'hidden', position: 'relative',
                transition: 'transform .25s, box-shadow .25s',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
              >
                <span style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>🎾</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em', textAlign: 'center', padding: '0 16px' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* ── CTA FINAL ── */}
      <RevealSection>
        <section style={{
          background: 'linear-gradient(135deg,#071a0f 0%,#0E2E1C 50%,#1a4a2e 100%)',
          padding: '80px 24px', textAlign: 'center', color: '#F4F6EF',
          position: 'relative', overflow: 'hidden',
        }}>
          <TennisBall style={{ top: '8%', left: '4%', fontSize: '6rem' }} />
          <TennisBall style={{ bottom: '8%', right: '4%', fontSize: '8rem' }} />
          <TennisBall style={{ top: '50%', right: '20%', fontSize: '5rem', transform: 'rotate(30deg)' }} />

          <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏆</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Pronto para competir?
            </h2>
            <p style={{ color: '#a0c8a0', fontSize: '1.1rem', lineHeight: 1.7, margin: '0 0 40px' }}>
              Garanta sua vaga na <strong style={{ color: '#8FD64A' }}>4ª Agro Open de Tênis</strong>.<br />
              Mais de <strong style={{ color: '#C9A656' }}>R$ 5.000 em prêmios</strong> distribuídos entre as categorias.<br />
              Vagas limitadas — não perca!
            </p>
            <button
              onClick={() => navigate('/inscricao')}
              style={{
                background: 'linear-gradient(135deg,#5FB335,#8FD64A)', color: '#0E2E1C',
                border: 'none', borderRadius: 16, padding: '20px 56px',
                fontSize: '1.15rem', fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(95,179,53,0.45)',
                letterSpacing: '0.04em', transition: 'transform .15s, box-shadow .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(95,179,53,0.55)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(95,179,53,0.45)' }}
            >
              🎾 Fazer Minha Inscrição
            </button>

            <div style={{
              display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
              marginTop: 52, paddingTop: 32, borderTop: '1px solid rgba(244,246,239,0.1)',
            }}>
              {[
                { icon: '📅', label: 'Datas', value: '07–13 Set 2026' },
                { icon: '🏟️', label: 'Local', value: 'Tangará Tênis Clube' },
                { icon: '🏢', label: 'Realização', value: 'UISA' },
                { icon: '📜', label: 'Regulamento', value: <Link to="/regulamento" style={{ color: '#8FD64A', textDecoration: 'none' }}>Ver regras</Link> },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: '0.7rem', color: '#8FD64A', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontWeight: 700, color: '#F4F6EF', marginTop: 3, fontSize: '0.9rem' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── WhatsApp FAB ── */}
      <WhatsAppFAB />

      <style>{`
        @keyframes pulseBadge {
          0%, 100% { box-shadow: 0 0 0 0 rgba(143,214,74,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(143,214,74,0); }
        }
        @keyframes shimmerLight {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
