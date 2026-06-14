import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

// Patrocinadores fixos do evento
const PATROCINADORES = [
  { nome: 'UISA Agroindustrial', icon: '🌾', cor: '#5FB335' },
  { nome: 'Tangará Tênis Clube', icon: '🎾', cor: '#C9A656' },
  { nome: 'Prefeitura de Tangará da Serra', icon: '🏛️', cor: '#0E2E1C' },
]

// Galeria com fotos licenciadas (CC / domínio público)
const GALLERY = [
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=uBNzwhX%2FTWhx2%2FVnwh4vVJUma6aBOvWTlIp48Bj%2Bt%2FvkVnGub7UFEePk2YdVFY%2FfaMkcnjM%2BYrDRG82yPVNOnL3MpDZIl1BTPBTCA2Nn3mJAV6ZnkFH4SloUF9rWESX5DHm8YgdL1l7eUZOb7Pg%3D&u2=i4Vxk9s4b8RsKjvy&width=2560',
    label: 'Quadras do clube', credit: 'Freerange Stock (CC)'
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=I3RGF3OQ57Ll5ME7nq5hQwJ5iQ0UA3cdKUUTGvjbQqrAB4jpc2nvDJ66KnV9UFTt2sPmosC%2F32KaF%2BY6kLfxAK%2FuxM2yliTsijGuukGgDVz6alyqdKNJeOw5ricawOoM1U1GBdOPR8sG44h9H31TaHEFL99XreeW4GcGRtb4nLRbZAGa4CDfxYG3jwq8UfbAxCbTi295tQ%3D%3D&u2=e%2Be07vRwApkPy8q1&width=2560',
    label: 'Arquibancada cheia', credit: 'Wikimedia Commons (CC)'
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=ljENdPGZnpEtRKXjSkXOigSQQ5NvbW12WD9h6InfPblZ1uteFQQqnUtF480VZ9F1lSvpo4jOajVfLPd2U8P2oEyo6fi1cQ7T6zLQTRUFX%2FNb0TukSu643Xo%2FhBFvIr0%3D&u2=LK5x1okOD%2FoDFx5F&width=2560',
    label: 'Três quadras — visão aérea', credit: 'Freerange Stock (CC)'
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=4%2Fitlj41OePZqbbo7OwSjN5qBt0%2BC7x3Kz9YzjDovrROy7QjmVdC9R3KXR8fgEImVHBeUhf2fkSoZaWXDGj0NU8%2BMIoByfyVBW8LxORCbQMSKQ86H87mmvw5mmjTyCIiRbKx2n%2F248akxFjQHbhglXUCEYdOKHKXV22U0vePo5ac%2FRqyAs6WL0iH1ZfJSAs5Ebtyp0MkAYN8u3IdOTyaQ6FzOALjUSFeKzsq0IS0A5FK3D0%2B&u2=Rv%2ByLUFjVq0F4WWI&width=2560',
    label: 'Cerimônia de premiação', credit: 'Wikimedia Commons (CC)'
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=peqkPREb%2BuY3rYgsJ%2FOjzj8aNTVbYasmeO5CEbM8S0vnJxyrcHwokfBq6U%2Bs9Fshe02vNAV9TEyloo8npIuv%2F8f1fRvt2W1bNMIfdGlJsltRLG9ZNYm3hkAT2c%2F8iJ5dzPIMyqTHG%2BqHL%2Bq0Bs9THoF0uLM6uzpgBRAgzc5cbzzeDU9YlaL6&u2=nSKlpAolM8rZn9ZD&width=2560',
    label: 'Australian Open — Rod Laver Arena', credit: 'Wikimedia Commons (CC)'
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=W77x7JJMqKcTKTBZn8PKfsukk9rECNVzlbR5B8mEUAjWEQXkaqNRowI%2Bwj68FFbxeW2BbsXjvUp0kFBs4VMuxTfXOMG7PY53oZccKe12nHXI5%2BlRy2VLurNC6j5jav0qbA%3D%3D&u2=PrlR%2B0Ivenlvt8ns&width=2560',
    label: 'Torcida nas tribunas', credit: 'Freerange Stock (CC)'
  },
]

// INFO_CARDS dinâmicos — fallback para valores fixos se /api/info não retornar
const INFO_CARDS_DEFAULT = [
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

// ── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(targetDate) {
  const calc = () => {
    const diff = new Date(targetDate + 'T00:00:00') - new Date()
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, ended: true }
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return { d, h, m, s, ended: false }
  }
  const [t, setT] = useState(calc)
  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate])
  return t
}

function CountdownUnit({ val, label }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{
        fontSize: '1.8rem', fontWeight: 900, color: '#C9A656', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {String(val).padStart(2, '0')}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#8FD64A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function CountdownBanner({ dataInicio, nomeEvento }) {
  const { d, h, m, s, ended } = useCountdown(dataInicio)
  if (!dataInicio || ended) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(201,166,86,0.35)',
      borderRadius: 16, padding: '14px 22px', marginBottom: 28,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ marginRight: 20, borderRight: '1px solid rgba(255,255,255,0.15)', paddingRight: 20 }}>
        <div style={{ fontSize: '0.7rem', color: '#8FD64A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
          Começa em
        </div>
        <div style={{ fontSize: '0.78rem', color: '#c8e0b8', fontWeight: 500 }}>
          {nomeEvento || 'Agro Open'}
        </div>
      </div>
      <CountdownUnit val={d} label="dias" />
      <div style={{ color: '#C9A656', fontWeight: 900, fontSize: '1.4rem', margin: '0 4px', lineHeight: 1, paddingBottom: 8 }}>:</div>
      <CountdownUnit val={h} label="horas" />
      <div style={{ color: '#C9A656', fontWeight: 900, fontSize: '1.4rem', margin: '0 4px', lineHeight: 1, paddingBottom: 8 }}>:</div>
      <CountdownUnit val={m} label="min" />
      <div style={{ color: '#C9A656', fontWeight: 900, fontSize: '1.4rem', margin: '0 4px', lineHeight: 1, paddingBottom: 8 }}>:</div>
      <CountdownUnit val={s} label="seg" />
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

// ── Live Stats Bar ────────────────────────────────────────────────────────────

function LiveStatsBar({ totalInscritos, totalCategorias, diasRestantes }) {
  const stats = [
    { icon: '🎾', label: 'Atletas inscritos', value: totalInscritos, animated: true, color: '#5FB335' },
    { icon: '🏆', label: 'Categorias', value: totalCategorias || 14, animated: false, color: '#C9A656' },
    { icon: '⏳', label: 'Dias para o torneio', value: diasRestantes != null ? diasRestantes : '—', animated: false, color: '#8FD64A' },
    { icon: '🌎', label: 'Cidades participantes', value: null, animated: false, color: '#5FB335' },
  ]

  return (
    <div style={{
      background: '#0E2E1C',
      borderTop: '1px solid rgba(143,214,74,0.15)',
      borderBottom: '1px solid rgba(143,214,74,0.15)',
      padding: '0',
    }}>
      <div style={{
        maxWidth: 1060, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}>
        {stats.filter(s => s.value !== null).map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '20px 28px',
            borderRight: i < stats.filter(x => x.value !== null).length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none',
          }}>
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {s.animated && typeof s.value === 'number'
                  ? <AnimatedCounter target={s.value} />
                  : s.value}
              </div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Campeões / Últimas edições ────────────────────────────────────────────────

const CAMPEOES_DEFAULT = [
  { edicao: '3ª Agro Open', ano: '2024', categoria: 'Masc. PRO', nome: 'Rafael A.', pontos: 2400 },
  { edicao: '3ª Agro Open', ano: '2024', categoria: '1ª Classe', nome: 'Diego M.', pontos: 1800 },
  { edicao: '2ª Agro Open', ano: '2023', categoria: 'Masc. PRO', nome: 'Bruno S.', pontos: 2200 },
  { edicao: '2ª Agro Open', ano: '2023', categoria: '2ª Classe', nome: 'Carlos R.', pontos: 1600 },
]

function CampeoesSection({ campeoes }) {
  const lista = (campeoes && campeoes.length > 0) ? campeoes : CAMPEOES_DEFAULT
  return (
    <section style={{ background: 'linear-gradient(180deg,#e8f0dc 0%,#f0f4e8 100%)', padding: '64px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ height: 2, width: 40, background: '#C9A656', borderRadius: 2 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.15em', color: '#C9A656', textTransform: 'uppercase' }}>Hall da Fama</span>
            <div style={{ height: 2, width: 40, background: '#C9A656', borderRadius: 2 }} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>🏆 Últimos Campeões</h2>
          <p style={{ color: '#5a7a5a', margin: 0 }}>Conheça quem dominou as edições anteriores</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {lista.slice(0, 8).map((c, i) => (
            <div key={i} style={{
              background: '#fff',
              border: i === 0 ? '2px solid #C9A656' : '1px solid rgba(0,0,0,0.07)',
              borderRadius: 18,
              padding: '20px 20px 18px',
              position: 'relative', overflow: 'hidden',
              boxShadow: i === 0 ? '0 6px 28px rgba(201,166,86,.18)' : '0 2px 12px rgba(0,0,0,.06)',
              transition: 'transform .2s, box-shadow .2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(201,166,86,.22)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = i === 0 ? '0 6px 28px rgba(201,166,86,.18)' : '0 2px 12px rgba(0,0,0,.06)' }}
            >
              {i === 0 && (
                <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, fontWeight: 800, color: '#C9A656', background: 'rgba(201,166,86,.1)', borderRadius: 999, padding: '2px 8px' }}>⭐ Destaque</div>
              )}
              <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🏆</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5FB335', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                {c.categoria}
              </div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0E2E1C', marginBottom: 2 }}>{c.nome}</div>
              <div style={{ fontSize: '0.78rem', color: '#7a9a7a' }}>
                {c.edicao} · {c.ano}
              </div>
              {c.pontos && (
                <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 800, color: '#C9A656' }}>
                  {c.pontos.toLocaleString('pt-BR')} pts
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Timeline do evento ────────────────────────────────────────────────────────

function TimelineEvento({ dataInicio, dataFim }) {
  const fases = [
    { icon: '📋', label: 'Inscrições Abertas', desc: 'Garanta sua vaga', status: 'active' },
    { icon: '✅', label: 'Encerramento das Inscrições', desc: dataInicio ? `Até ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'Em breve', status: 'upcoming' },
    { icon: '🎲', label: 'Sorteio das Chaves', desc: 'Definição dos grupos', status: 'upcoming' },
    { icon: '🎾', label: 'Início do Torneio', desc: dataInicio ? new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Em breve', status: 'upcoming' },
    { icon: '🏆', label: 'Grande Final', desc: dataFim ? new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : 'Em breve', status: 'upcoming' },
  ]

  return (
    <section style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>📅 Cronograma</h2>
        <p style={{ color: '#5a7a5a', margin: 0 }}>Acompanhe todas as etapas do torneio</p>
      </div>
      <div style={{ position: 'relative' }}>
        {/* linha vertical */}
        <div style={{
          position: 'absolute', left: 23, top: 0, bottom: 0, width: 2,
          background: 'linear-gradient(to bottom, #5FB335 0%, #C9A656 50%, rgba(0,0,0,.08) 100%)',
          borderRadius: 2,
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {fases.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', paddingBottom: i < fases.length - 1 ? 28 : 0 }}>
              {/* dot */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: f.status === 'active' ? 'linear-gradient(135deg,#5FB335,#8FD64A)' : '#fff',
                border: f.status === 'active' ? 'none' : '2px solid rgba(0,0,0,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                boxShadow: f.status === 'active' ? '0 4px 16px rgba(95,179,53,.4)' : '0 2px 8px rgba(0,0,0,.06)',
                position: 'relative', zIndex: 1,
              }}>
                {f.status === 'active' ? f.icon : <span style={{ opacity: 0.5 }}>{f.icon}</span>}
              </div>
              {/* conteúdo */}
              <div style={{ paddingTop: 8, flex: 1 }}>
                <div style={{
                  fontWeight: 800, fontSize: '0.95rem',
                  color: f.status === 'active' ? '#0E2E1C' : '#5a7a5a',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {f.label}
                  {f.status === 'active' && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: '#5FB335',
                      background: 'rgba(95,179,53,.12)', border: '1px solid rgba(95,179,53,.3)',
                      borderRadius: 999, padding: '2px 8px', animation: 'pulseBadge 2s ease-in-out infinite',
                    }}>
                      AGORA
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#8a9a8a', marginTop: 2 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
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
  const [ranking, setRanking] = useState([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [noticias, setNoticias] = useState([])
  const [noticiasLoading, setNoticiasLoading] = useState(true)
  const [totalInscritos, setTotalInscritos] = useState(null)
  const [categorias, setCategorias]         = useState([])
  const [eventoInfo, setEventoInfo]         = useState(null)
  const [infoCards, setInfoCards]           = useState(INFO_CARDS_DEFAULT)
  const [campeoes, setCampeoes]             = useState([])
  const [diasRestantes, setDiasRestantes]   = useState(null)

  useEffect(() => {
    api.get('/api/ranking').catch(() => []).then(d => {
      setRanking(Array.isArray(d) ? d.slice(0, 3) : [])
      setRankingLoading(false)
    })
    api.get('/api/noticias?publicado=1').catch(() => []).then(d => {
      setNoticias(Array.isArray(d) ? d.slice(0, 3) : d?.noticias?.slice(0, 3) ?? [])
      setNoticiasLoading(false)
    })
    api.get('/api/inscricoes-count').catch(() => null).then(d => {
      const count = d?.total ?? d?.count ?? null
      setTotalInscritos(typeof count === 'number' ? count : null)
    })
    api.get('/api/categorias').catch(() => []).then(d => {
      if (Array.isArray(d) && d.length > 0) setCategorias(d)
    })
    // Info do evento — gera INFO_CARDS dinâmicos a partir da API
    api.get('/api/info').catch(() => null).then(d => {
      if (!d) return
      if (d?.dataInicio) {
        setEventoInfo({ dataInicio: d.dataInicio, dataFim: d.dataFim, nomeEvento: d.nomeEvento || d.evento })
        // Calcular dias restantes
        const diff = new Date(d.dataInicio + 'T00:00:00') - new Date()
        if (diff > 0) setDiasRestantes(Math.ceil(diff / 86400000))
      }
      // Atualizar cards com dados reais
      const local = d.local || d.localEvento || 'Tangará Tênis Clube'
      const cidade = d.cidade || 'Tangará da Serra – MT'
      const datas = d.dataInicio && d.dataFim
        ? formatarPeriodo(d.dataInicio, d.dataFim)
        : (d.datas || '07 a 13 Set 2026')
      const premio = d.premiacao || d.premio || 'R$ 5.000'
      setInfoCards([
        { icon: '📅', label: 'Datas', value: datas, sub: 'Data do torneio' },
        { icon: '📍', label: 'Local', value: local, sub: cidade },
        { icon: '🎾', label: 'Categorias', value: (d.totalCategorias || '14') + ' categorias', sub: 'Masc · Fem · Misto · Sênior' },
        { icon: '🏆', label: 'Premiação', value: premio, sub: 'Em prêmios + troféus' },
      ])
    })
    // Campeões de edições anteriores
    api.get('/api/campeoes').catch(() => []).then(d => {
      if (Array.isArray(d) && d.length > 0) setCampeoes(d)
    })
  }, [])

  function formatarPeriodo(inicio, fim) {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const di = new Date(inicio + 'T12:00:00'), df = new Date(fim + 'T12:00:00')
    if (di.getMonth() === df.getMonth())
      return di.getDate() + ' a ' + df.getDate() + ' ' + meses[di.getMonth()] + ' ' + di.getFullYear()
    return di.getDate() + ' ' + meses[di.getMonth()] + ' – ' + df.getDate() + ' ' + meses[df.getMonth()] + ' ' + df.getFullYear()
  }

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

        <p style={{ color: '#a0c8a0', fontSize: '1.05rem', margin: '12px 0 24px', letterSpacing: '0.04em' }}>
          🏟️ Tangará Tênis Clube · UISA · Tangará da Serra – MT
        </p>

        {/* Countdown até o evento */}
        {eventoInfo && <CountdownBanner dataInicio={eventoInfo.dataInicio} nomeEvento={eventoInfo.nomeEvento} />}

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

      {/* ── LIVE STATS BAR ── */}
      {(totalInscritos !== null && totalInscritos > 0) && (
        <LiveStatsBar
          totalInscritos={totalInscritos}
          totalCategorias={categorias.length || null}
          diasRestantes={diasRestantes}
        />
      )}

      {/* ── INFO CARDS ── */}
      <RevealSection>
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 20 }}>
            {infoCards.map((c, i) => (
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

      {/* ── TIMELINE ── */}
      <RevealSection>
        <TimelineEvento
          dataInicio={eventoInfo?.dataInicio}
          dataFim={eventoInfo?.dataFim}
        />
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

      {/* ── CAMPEÕES ── */}
      <RevealSection>
        <CampeoesSection campeoes={campeoes} />
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

      {/* ── GALERIA com fotos reais ── */}
      <RevealSection>
        <section style={{ maxWidth: 1060, margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0E2E1C', margin: '0 0 8px' }}>📸 Galeria</h2>
            <p style={{ color: '#5a7a5a', margin: 0 }}>Momentos das edições anteriores</p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'auto auto',
            gap: 12,
          }}>
            {GALLERY.map((item, i) => (
              <div key={i} style={{
                borderRadius: 18, overflow: 'hidden',
                position: 'relative', cursor: 'pointer',
                height: i === 0 ? 280 : 200,
                gridColumn: i === 0 ? 'span 2' : 'span 1',
                boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
                transition: 'transform .25s, box-shadow .25s',
                background: '#0E2E1C',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.13)' }}
              >
                <img
                  src={item.img}
                  alt={item.label}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity .3s' }}
                  onError={e => { e.target.style.display='none' }}
                />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(7,26,15,.85) 0%, transparent 100%)',
                  padding: '28px 16px 14px',
                }}>
                  <div style={{ color: '#F4F6EF', fontSize: '0.82rem', fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: '#8FD64A', fontSize: '0.66rem', marginTop: 2, opacity: 0.8 }}>{item.credit}</div>
                </div>
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
