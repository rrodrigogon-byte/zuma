import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

/* ─── Paleta ──────────────────────────────────────────────────────────────── */
const C = {
  deep:    '#0E2E1C',
  forest:  '#1B4D2E',
  green:   '#5FB335',
  lime:    '#8FD64A',
  gold:    '#C9A656',
  cream:   '#F4F6EF',
  muted:   '#6a8a6a',
  white:   '#ffffff',
  glass:   'rgba(255,255,255,0.08)',
  glassB:  'rgba(255,255,255,0.15)',
}

/* ─── CSS de animações injetado globalmente ───────────────────────────────── */
const GLOBAL_CSS = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-8px); }
}
@keyframes pulse {
  0%,100% { opacity: 1; }
  50%      { opacity: .6; }
}
@keyframes gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes slideRight {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.ttc-fade-up    { animation: fadeUp .7s ease both; }
.ttc-scale-in   { animation: scaleIn .5s ease both; }
.ttc-float      { animation: float 4s ease-in-out infinite; }
.ttc-pulse      { animation: pulse 2s ease-in-out infinite; }

.ttc-nav-link {
  color: rgba(255,255,255,.75);
  text-decoration: none;
  font-size: .82rem;
  font-weight: 600;
  letter-spacing: .04em;
  padding: 6px 14px;
  border-radius: 20px;
  transition: all .2s;
  white-space: nowrap;
}
.ttc-nav-link:hover,
.ttc-nav-link.active {
  color: #fff;
  background: rgba(255,255,255,.14);
}

.ttc-card-hover {
  transition: transform .25s, box-shadow .25s;
  cursor: default;
}
.ttc-card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,.14) !important;
}

.ttc-gallery-item {
  overflow: hidden;
  border-radius: 12px;
  cursor: pointer;
  position: relative;
}
.ttc-gallery-item img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
  transition: transform .5s ease;
}
.ttc-gallery-item:hover img { transform: scale(1.07); }
.ttc-gallery-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(14,46,28,.85) 100%);
  opacity: 0; transition: opacity .3s;
  display: flex; flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
}
.ttc-gallery-item:hover .ttc-gallery-overlay { opacity: 1; }

.ttc-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, ${C.green}, ${C.lime});
  color: ${C.deep};
  padding: 14px 32px; border-radius: 50px;
  font-weight: 800; font-size: .95rem;
  text-decoration: none; border: none; cursor: pointer;
  box-shadow: 0 6px 24px rgba(95,179,53,.4);
  transition: transform .2s, box-shadow .2s;
}
.ttc-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(95,179,53,.55);
}
.ttc-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.1);
  color: #fff;
  padding: 12px 28px; border-radius: 50px;
  font-weight: 700; font-size: .9rem;
  text-decoration: none; border: 1.5px solid rgba(255,255,255,.25); cursor: pointer;
  transition: all .2s;
}
.ttc-btn-ghost:hover {
  background: rgba(255,255,255,.2);
  border-color: rgba(255,255,255,.5);
}

.ttc-section-divider {
  width: 48px; height: 4px;
  background: linear-gradient(90deg, ${C.green}, ${C.lime});
  border-radius: 2px;
  margin: 12px 0 24px;
  transform-origin: left;
  animation: slideRight .6s ease both;
}

.ttc-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(95,179,53,.15);
  color: ${C.green};
  border: 1px solid rgba(95,179,53,.3);
  padding: 4px 12px; border-radius: 20px;
  font-size: .75rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase;
}

.ttc-tab-btn {
  padding: 9px 20px; border-radius: 24px;
  font-weight: 700; font-size: .82rem;
  border: 1.5px solid transparent;
  cursor: pointer; transition: all .2s;
  white-space: nowrap;
}
.ttc-tab-btn.active {
  background: ${C.green};
  color: #fff;
  box-shadow: 0 4px 12px rgba(95,179,53,.3);
}
.ttc-tab-btn:not(.active) {
  background: rgba(255,255,255,.06);
  color: ${C.muted};
  border-color: rgba(255,255,255,.1);
}
.ttc-tab-btn:not(.active):hover {
  background: rgba(255,255,255,.12);
  color: #fff;
}

@media (max-width: 640px) {
  .ttc-hero-actions { flex-direction: column; align-items: stretch; }
  .ttc-hero-actions a { text-align: center; justify-content: center; }
  .ttc-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
  .ttc-features-grid { grid-template-columns: 1fr !important; }
  .ttc-events-grid { grid-template-columns: 1fr !important; }
}
`

/* ─── Hook: intersection observer para animações on-scroll ───────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

/* ─── Hook: contador animado ─────────────────────────────────────────────── */
function useCounter(target, duration = 1400, start = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) return
    let raf, startTime
    const step = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(ease * target))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, start])
  return val
}

/* ─── Sticky Nav ──────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'quem-somos', label: 'O Clube' },
  { id: 'estrutura',  label: 'Estrutura' },
  { id: 'eventos',    label: 'Eventos' },
  { id: 'galeria',    label: 'Galeria' },
  { id: 'seja-socio', label: 'Seja Sócio' },
  { id: 'contato',    label: 'Contato' },
]

function StickyNav({ visible }) {
  const [active, setActive] = useState('quem-somos')

  useEffect(() => {
    const handler = () => {
      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const el = document.getElementById(NAV_ITEMS[i].id)
        if (el && el.getBoundingClientRect().top <= 120) {
          setActive(NAV_ITEMS[i].id)
          break
        }
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(14,46,28,.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,.08)',
      padding: '0 16px',
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform .35s ease',
    }}>
      <div style={{
        maxWidth: 960, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 4,
        overflowX: 'auto', scrollbarWidth: 'none',
        padding: '10px 0',
      }}>
        <div style={{
          fontSize: '.78rem', fontWeight: 800, color: C.lime,
          letterSpacing: '.1em', textTransform: 'uppercase',
          marginRight: 12, flexShrink: 0,
        }}>TTC</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`ttc-nav-link ${active === item.id ? 'active' : ''}`}
            onClick={() => scrollTo(item.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >{item.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <a href="https://wa.me/5565999247052" target="_blank" rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            background: C.green, color: '#fff',
            padding: '6px 16px', borderRadius: 20,
            fontSize: '.78rem', fontWeight: 700,
            textDecoration: 'none',
          }}>💬 Contato</a>
      </div>
    </div>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */
function Hero({ onScrollPast }) {
  const heroRef = useRef(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY
      setScrollY(y)
      if (heroRef.current) {
        const h = heroRef.current.offsetHeight
        onScrollPast(y > h * 0.4)
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [onScrollPast])

  return (
    <div ref={heroRef} style={{
      position: 'relative', height: 'clamp(560px, 90vh, 780px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Imagem parallax */}
      <div style={{
        position: 'absolute', inset: '-10% 0',
        backgroundImage: 'url(/ttc/piscina-toboga.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        transform: `translateY(${scrollY * 0.3}px)`,
        willChange: 'transform',
      }} />

      {/* Overlay gradiente */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(
          160deg,
          rgba(14,46,28,.92) 0%,
          rgba(14,46,28,.75) 40%,
          rgba(27,77,46,.65) 70%,
          rgba(14,46,28,.88) 100%
        )`,
      }} />

      {/* Decoração: círculos flutuantes */}
      <div style={{
        position: 'absolute', top: '12%', right: '8%',
        width: 280, height: 280, borderRadius: '50%',
        border: '1px solid rgba(143,214,74,.12)',
        animation: 'float 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', left: '5%',
        width: 180, height: 180, borderRadius: '50%',
        border: '1px solid rgba(95,179,53,.15)',
        animation: 'float 8s ease-in-out infinite',
        animationDelay: '-3s',
      }} />

      {/* Conteúdo */}
      <div style={{
        position: 'relative', maxWidth: 760, margin: '0 auto',
        textAlign: 'center', padding: '0 24px',
        color: '#fff',
      }}>
        <div className="ttc-fade-up" style={{ animationDelay: '.1s' }}>
          <span className="ttc-badge" style={{ marginBottom: 20 }}>
            🏆 Sede Oficial — 4ª Agro Open de Tênis 2026
          </span>
        </div>

        <h1 className="ttc-fade-up" style={{
          animationDelay: '.2s',
          fontSize: 'clamp(2.4rem, 7vw, 4.2rem)',
          fontWeight: 900, lineHeight: 1.05,
          margin: '0 0 6px',
          letterSpacing: '-.02em',
        }}>
          Tangará<br />
          <span style={{
            background: `linear-gradient(135deg, ${C.lime}, ${C.gold})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Tênis Clube</span>
        </h1>

        <p className="ttc-fade-up" style={{
          animationDelay: '.35s',
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: 'rgba(255,255,255,.8)',
          margin: '16px 0 36px',
          lineHeight: 1.6,
        }}>
          O maior clube de lazer de Tangará da Serra — MT.<br />
          <span style={{ color: C.lime, fontWeight: 700 }}>Esporte, família e comunidade</span> em um só lugar.
        </p>

        <div className="ttc-hero-actions ttc-fade-up" style={{
          animationDelay: '.5s',
          display: 'flex', gap: 14,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <a href="https://wa.me/5565999247052" target="_blank" rel="noopener noreferrer"
            className="ttc-btn-primary">
            💬 Falar pelo WhatsApp
          </a>
          <button className="ttc-btn-ghost"
            onClick={() => document.getElementById('seja-socio')?.scrollIntoView({ behavior: 'smooth' })}>
            🎾 Seja Sócio
          </button>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          color: 'rgba(255,255,255,.4)', fontSize: '.72rem', letterSpacing: '.08em',
          textTransform: 'uppercase',
          animation: 'float 2.5s ease-in-out infinite',
        }}>
          <span>Conheça o clube</span>
          <span style={{ fontSize: 18 }}>↓</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Stats ───────────────────────────────────────────────────────────────── */
const STATS = [
  { value: 30,  suffix: '+', label: 'Anos de história',    icon: '🏛️' },
  { value: 5,   suffix: 'k+', label: 'Famílias associadas', icon: '👨‍👩‍👧‍👦' },
  { value: 6,   suffix: '',  label: 'Modalidades esportivas', icon: '🏅' },
  { value: 4,   suffix: 'ª', label: 'Edição Agro Open',    icon: '🌾' },
]

function StatsSection() {
  const [ref, inView] = useInView(0.3)
  return (
    <div ref={ref} style={{
      background: `linear-gradient(135deg, ${C.deep} 0%, ${C.forest} 100%)`,
      padding: '48px 24px',
    }}>
      <div className="ttc-stats-grid" style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 2,
      }}>
        {STATS.map((s, i) => <StatItem key={i} {...s} start={inView} delay={i * 120} />)}
      </div>
    </div>
  )
}

function StatItem({ value, suffix, label, icon, start, delay }) {
  const count = useCounter(value, 1200, start)
  return (
    <div style={{
      textAlign: 'center', padding: '24px 16px',
      opacity: start ? 1 : 0,
      transform: start ? 'none' : 'translateY(20px)',
      transition: `opacity .6s ${delay}ms, transform .6s ${delay}ms`,
      borderRight: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{icon}</div>
      <div style={{
        fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
        fontWeight: 900, color: '#fff',
        lineHeight: 1, letterSpacing: '-.02em',
      }}>
        <span style={{ color: C.lime }}>{count}</span>
        <span style={{ color: C.gold, fontSize: '.65em' }}>{suffix}</span>
      </div>
      <div style={{
        fontSize: '.78rem', color: 'rgba(255,255,255,.55)',
        fontWeight: 600, marginTop: 6, letterSpacing: '.04em',
        textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  )
}

/* ─── Section wrapper animado ─────────────────────────────────────────────── */
function AnimSection({ id, children, style = {} }) {
  const [ref, inView] = useInView(0.1)
  return (
    <section id={id} ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'none' : 'translateY(28px)',
      transition: 'opacity .7s ease, transform .7s ease',
      marginBottom: 72,
      ...style,
    }}>
      {children}
    </section>
  )
}

function SectionTitle({ label, title, subtitle }) {
  return (
    <div style={{ marginBottom: 36 }}>
      {label && <span className="ttc-badge" style={{ marginBottom: 12 }}>{label}</span>}
      <h2 style={{
        fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
        fontWeight: 900, color: C.deep,
        lineHeight: 1.15, margin: '8px 0 0',
        letterSpacing: '-.01em',
      }}>{title}</h2>
      <div className="ttc-section-divider" />
      {subtitle && <p style={{ color: C.muted, fontSize: '1rem', lineHeight: 1.7, margin: 0 }}>{subtitle}</p>}
    </div>
  )
}

/* ─── Quem Somos ─────────────────────────────────────────────────────────── */
function QuemSomos() {
  return (
    <AnimSection id="quem-somos">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
        {/* Texto */}
        <div>
          <SectionTitle
            label="🏛️ Nossa identidade"
            title="Mais do que um clube. Uma comunidade."
            subtitle=""
          />
          <p style={{ color: '#374151', lineHeight: 1.85, fontSize: '1rem', marginBottom: 20 }}>
            O <strong>Tangará Tênis Clube — TTC</strong> é o maior clube de lazer de Tangará da
            Serra e de toda a região, no coração do Mato Grosso. Reunindo esporte, recreação e
            convívio social em um só lugar, o clube é ponto de encontro de famílias, atletas e
            amigos há mais de três décadas.
          </p>
          <p style={{ color: '#374151', lineHeight: 1.85, fontSize: '1rem', marginBottom: 28 }}>
            Sob o lema <em style={{ color: C.forest, fontStyle: 'normal', fontWeight: 700 }}>"muito mais lazer, diversão e esportes"</em>,
            o TTC oferece qualidade de vida a preço acessível. Crianças aprendem a nadar, jovens
            dominam o tênis e beach tennis, e famílias inteiras transformam o fim de semana em
            momentos inesquecíveis.
          </p>

          {/* Missão / Visão pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '💚', title: 'Missão', text: 'Promover qualidade de vida e integração social através do esporte.' },
              { icon: '🎯', title: 'Visão',  text: 'Ser o maior polo esportivo e de lazer do interior do MT.' },
              { icon: '⭐', title: 'Valores', text: 'Família, inclusão, tradição e excelência esportiva.' },
            ].map((p, i) => (
              <div key={i} className="ttc-card-hover" style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                background: '#fff', borderRadius: 12, padding: '14px 18px',
                border: `1px solid rgba(95,179,53,.12)`,
                boxShadow: '0 2px 8px rgba(0,0,0,.05)',
              }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: 2 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, color: C.deep, fontSize: '.88rem', marginBottom: 2 }}>{p.title}</div>
                  <div style={{ color: C.muted, fontSize: '.85rem', lineHeight: 1.5 }}>{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Imagem com badge decorativo */}
        <div style={{ position: 'relative' }}>
          <div style={{
            borderRadius: 24, overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(14,46,28,.22)',
            aspectRatio: '4/5',
          }}>
            <img
              src="/ttc/area-piscina.jpg"
              alt="Área da piscina semiolímpica do TTC"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 60%, rgba(14,46,28,.7) 100%)',
            }} />
          </div>

          {/* Badge flutuante */}
          <div className="ttc-float" style={{
            position: 'absolute', top: -16, right: -16,
            background: `linear-gradient(135deg, ${C.gold}, #e8c060)`,
            color: C.deep, borderRadius: 16, padding: '14px 18px',
            fontWeight: 900, fontSize: '.8rem', textAlign: 'center',
            boxShadow: '0 8px 24px rgba(201,166,86,.5)',
            lineHeight: 1.4,
          }}>
            <div style={{ fontSize: '1.6rem' }}>🏆</div>
            <div>Sede da</div>
            <div style={{ fontSize: '1.1rem' }}>4ª Agro Open</div>
            <div>2026</div>
          </div>

          {/* Tag historia */}
          <div style={{
            position: 'absolute', bottom: 20, left: 20,
            background: 'rgba(14,46,28,.9)',
            backdropFilter: 'blur(8px)',
            color: '#fff', borderRadius: 12,
            padding: '12px 16px',
          }}>
            <div style={{ fontSize: '.7rem', color: C.lime, fontWeight: 700, letterSpacing: '.08em', marginBottom: 2 }}>FUNDADO HÁ</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>30+ anos</div>
            <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.6)' }}>de história em Tangará da Serra</div>
          </div>
        </div>
      </div>

      {/* Linha do tempo — história */}
      <div id="historia" style={{
        marginTop: 56, background: '#fff',
        borderRadius: 20, padding: '32px 28px',
        border: `1px solid rgba(95,179,53,.1)`,
        boxShadow: '0 4px 20px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: '1.5rem' }}>📖</span>
          <h3 style={{ color: C.deep, fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Nossa História</h3>
          <div style={{ flex: 1, height: 1, background: 'rgba(95,179,53,.15)', marginLeft: 8 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
          {[
            { era: 'Fundação',      icon: '🌱', desc: 'Nasce do desejo de reunir a comunidade de Tangará da Serra em torno do esporte.' },
            { era: 'Crescimento',   icon: '📈', desc: 'Acompanha o boom do agronegócio MT. Novas quadras, piscina e áreas de lazer.' },
            { era: 'Consolidação',  icon: '🏆', desc: 'Torna-se referência regional. Copa Agro nasce e cresce junto com o clube.' },
            { era: 'Hoje',          icon: '🚀', desc: 'Modernização contínua, novas modalidades e sede da 4ª Agro Open 2026.' },
          ].map((t, i) => (
            <div key={i} style={{
              padding: '16px 20px',
              borderRight: i < 3 ? `1px solid rgba(95,179,53,.12)` : 'none',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 16, left: -1,
                width: 8, height: 8, borderRadius: '50%',
                background: C.green, boxShadow: `0 0 0 3px rgba(95,179,53,.2)`,
              }} />
              <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 800, color: C.deep, fontSize: '.88rem', marginBottom: 6 }}>{t.era}</div>
              <div style={{ color: C.muted, fontSize: '.82rem', lineHeight: 1.55 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </AnimSection>
  )
}

/* ─── Estrutura ──────────────────────────────────────────────────────────── */
const MODALIDADES = [
  {
    icon: '🏊',
    title: 'Piscinas & Aquático',
    color: '#2196f3',
    gradient: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
    items: ['Piscina semiolímpica', 'Tobogã para crianças', 'Quiosques para sócios', 'Hidroginástica adultos'],
  },
  {
    icon: '🎾',
    title: 'Tênis',
    color: C.green,
    gradient: `linear-gradient(135deg, ${C.forest} 0%, ${C.green} 100%)`,
    items: ['Quadras de saibro oficiais', 'Todos os níveis', 'Torneios regionais', 'Sede Agro Open 2026'],
  },
  {
    icon: '🏖️',
    title: 'Beach Tennis',
    color: '#ff9800',
    gradient: 'linear-gradient(135deg, #e65100 0%, #ff9800 100%)',
    items: ['Quadras de areia', 'Competições oficiais', 'Torneio de Carnaval', 'Grande crescimento local'],
  },
  {
    icon: '🥋',
    title: 'Karatê',
    color: '#e91e63',
    gradient: 'linear-gradient(135deg, #880e4f 0%, #e91e63 100%)',
    items: ['Crianças e adolescentes', '2× por semana', 'Formação esportiva', 'Disciplina e valores'],
  },
  {
    icon: '🤸',
    title: 'Natação',
    color: '#00bcd4',
    gradient: 'linear-gradient(135deg, #006064 0%, #00bcd4 100%)',
    items: ['Adultos e crianças', '2 aulas semanais', 'Iniciantes e avançados', 'Condicionamento físico'],
  },
  {
    icon: '🍽️',
    title: 'Restaurante & Bar',
    color: C.gold,
    gradient: `linear-gradient(135deg, #7a5c00 0%, ${C.gold} 100%)`,
    items: ['Rodízio de petiscos', 'Bar completo', 'Quiosques privativos', 'Sauna semanal'],
  },
]

function Estrutura() {
  const [active, setActive] = useState(0)
  const mod = MODALIDADES[active]

  return (
    <AnimSection id="estrutura" style={{
      background: `linear-gradient(180deg, ${C.cream} 0%, rgba(95,179,53,.05) 100%)`,
      borderRadius: 28, padding: '48px 32px',
    }}>
      <SectionTitle
        label="🏗️ Infraestrutura"
        title="Uma estrutura completa para toda a família"
        subtitle="Do aquático ao gastronômico — o TTC tem tudo para o seu dia perfeito."
      />

      {/* Tabs de modalidade */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        marginBottom: 32, overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {MODALIDADES.map((m, i) => (
          <button key={i} className={`ttc-tab-btn ${active === i ? 'active' : ''}`}
            onClick={() => setActive(i)}
            style={{ background: active === i ? m.color : undefined }}>
            {m.icon} {m.title}
          </button>
        ))}
      </div>

      {/* Card da modalidade ativa */}
      <div key={active} style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 32, alignItems: 'center',
        animation: 'fadeIn .35s ease',
      }}>
        <div className="ttc-features-grid" style={{
          background: '#fff', borderRadius: 20,
          padding: '32px', display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: `0 8px 32px ${mod.color}22`,
          border: `1.5px solid ${mod.color}33`,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: mod.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: `0 8px 20px ${mod.color}44`,
          }}>{mod.icon}</div>

          <h3 style={{ color: C.deep, fontWeight: 900, fontSize: '1.4rem', margin: 0 }}>{mod.title}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mod.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: `${mod.color}0d`,
                border: `1px solid ${mod.color}22`,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: mod.color, flexShrink: 0,
                }} />
                <span style={{ color: '#374151', fontSize: '.9rem', fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Foto correspondente */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,.14)',
          aspectRatio: '4/3',
        }}>
          <img
            src={active === 0 ? '/ttc/piscina-toboga.jpg' :
                 active === 1 ? '/ttc/galeria/galeria-ten-04.jpg' :
                 active === 2 ? '/ttc/galeria/galeria-bt-01.jpg' :
                 active === 3 ? '/ttc/galeria/galeria-ten-03.jpg' :
                 active === 4 ? '/ttc/galeria/galeria-ten-02.jpg' :
                                '/ttc/area-piscina.jpg'}
            alt={mod.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'all .4s' }}
          />
        </div>
      </div>

      {/* Grade mini de todas modalidades */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 8, marginTop: 28,
      }}>
        {MODALIDADES.map((m, i) => (
          <button key={i} onClick={() => setActive(i)}
            style={{
              background: active === i ? m.color : '#fff',
              border: `1.5px solid ${active === i ? m.color : 'rgba(0,0,0,.07)'}`,
              borderRadius: 12, padding: '12px 8px',
              cursor: 'pointer', textAlign: 'center',
              transition: 'all .2s',
              boxShadow: active === i ? `0 4px 14px ${m.color}44` : 'none',
            }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{m.icon}</div>
            <div style={{
              fontSize: '.72rem', fontWeight: 700,
              color: active === i ? '#fff' : C.muted,
            }}>{m.title}</div>
          </button>
        ))}
      </div>
    </AnimSection>
  )
}

/* ─── Eventos ────────────────────────────────────────────────────────────── */
const EVENTOS = [
  {
    icon: '🌾', title: 'Agro Open de Tênis',
    edition: '4ª Edição', year: '2026',
    date: '07 – 13 SET 2026',
    color: C.green, gradient: `linear-gradient(135deg, ${C.forest}, ${C.green})`,
    desc: 'O maior torneio de tênis do interior do Mato Grosso. Reúne atletas de todo o estado, com apoio do agronegócio regional.',
    tags: ['14 categorias', 'R$ 5.000', 'Inscrições abertas'],
    cta: '/inscricao',
    ctaLabel: '→ Inscrever-se',
  },
  {
    icon: '🍕', title: "Domino's Open",
    edition: 'Tradicional', year: '',
    date: 'Anual',
    color: '#e53935', gradient: 'linear-gradient(135deg, #b71c1c, #e53935)',
    desc: 'Torneio que reúne os principais tenistas do clube e da região em uma competição animada e competitiva.',
    tags: ['Categorias mistas', 'Ranking local', 'Premiações'],
    cta: null, ctaLabel: null,
  },
  {
    icon: '🏖️', title: 'Beach Tennis TTC',
    edition: 'Temporada', year: '2026',
    date: 'Semestral',
    color: '#ff9800', gradient: 'linear-gradient(135deg, #e65100, #ff9800)',
    desc: 'Torneio de beach tennis com premiação e brindes. Modalidade em forte expansão no TTC.',
    tags: ['Quadras de areia', 'Premiação', 'Brindes'],
    cta: null, ctaLabel: null,
  },
  {
    icon: '🎉', title: 'Tênis de Carnaval',
    edition: 'Especial', year: '',
    date: 'Fevereiro',
    color: '#9c27b0', gradient: 'linear-gradient(135deg, #4a148c, #9c27b0)',
    desc: 'Torneio especial de Carnaval com provas de tênis e beach tennis, confraternização e muita animação.',
    tags: ['Tênis + BT', 'Carnaval', 'Diversão'],
    cta: null, ctaLabel: null,
  },
]

function Eventos() {
  const [hover, setHover] = useState(null)
  return (
    <AnimSection id="eventos">
      <SectionTitle
        label="📅 Calendário"
        title="Eventos que movimentam a cidade"
        subtitle="Uma agenda viva que reúne atletas e famílias o ano todo."
      />
      <div className="ttc-events-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
      }}>
        {EVENTOS.map((ev, i) => (
          <div
            key={i}
            className="ttc-card-hover"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              borderRadius: 20, overflow: 'hidden',
              boxShadow: hover === i ? `0 20px 48px ${ev.color}33` : '0 4px 16px rgba(0,0,0,.07)',
              border: `1.5px solid ${hover === i ? ev.color + '44' : 'transparent'}`,
              transition: 'all .3s',
            }}>

            {/* Header colorido */}
            <div style={{
              background: ev.gradient, padding: '20px 22px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{ev.icon}</div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', lineHeight: 1.2 }}>{ev.title}</div>
                {ev.edition && <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.7)', marginTop: 4 }}>{ev.edition} {ev.year}</div>}
              </div>
              <div style={{
                background: 'rgba(255,255,255,.15)',
                borderRadius: 10, padding: '6px 12px',
                fontSize: '.72rem', fontWeight: 700, color: '#fff',
                letterSpacing: '.04em', whiteSpace: 'nowrap',
              }}>{ev.date}</div>
            </div>

            {/* Body */}
            <div style={{ background: '#fff', padding: '18px 22px' }}>
              <p style={{ color: '#374151', fontSize: '.88rem', lineHeight: 1.65, margin: '0 0 14px' }}>{ev.desc}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: ev.cta ? 16 : 0 }}>
                {ev.tags.map((tag, j) => (
                  <span key={j} style={{
                    background: `${ev.color}12`, color: ev.color,
                    border: `1px solid ${ev.color}33`,
                    borderRadius: 20, padding: '3px 10px',
                    fontSize: '.72rem', fontWeight: 700,
                  }}>{tag}</span>
                ))}
              </div>

              {ev.cta && (
                <Link to={ev.cta} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: ev.color, fontWeight: 800, fontSize: '.88rem',
                  textDecoration: 'none',
                  padding: '8px 0',
                }}>{ev.ctaLabel}</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </AnimSection>
  )
}

/* ─── Galeria ─────────────────────────────────────────────────────────────── */
const FOTOS = [
  { src: '/ttc/galeria/galeria-bt-01.jpg', alt: 'Equipe feminina de beach tennis', cat: 'Beach Tennis', span: 'row2' },
  { src: '/ttc/galeria/galeria-bt-02.jpg', alt: 'Atleta com raquete na areia',     cat: 'Beach Tennis', span: '' },
  { src: '/ttc/galeria/galeria-bt-03.jpg', alt: 'Dupla campeã com troféu',          cat: 'Beach Tennis', span: '' },
  { src: '/ttc/galeria/galeria-bt-04.jpg', alt: 'Jogo noturno de beach tennis',    cat: 'Beach Tennis', span: 'col2' },
  { src: '/ttc/galeria/galeria-ten-01.jpg', alt: 'Jovem tenista no saibro',         cat: 'Tênis', span: '' },
  { src: '/ttc/galeria/galeria-ten-02.jpg', alt: 'Criança sacando',                 cat: 'Tênis Kids', span: '' },
  { src: '/ttc/galeria/galeria-ten-03.jpg', alt: 'Turma tênis kids',                cat: 'Tênis Kids', span: 'row2' },
  { src: '/ttc/galeria/galeria-ten-04.jpg', alt: 'Atleta Copa Agro',                cat: 'Copa Agro', span: '' },
  { src: '/ttc/galeria/galeria-ten-05.jpg', alt: 'Tenista à noite',                 cat: 'Tênis', span: '' },
  { src: '/ttc/galeria/galeria-ten-06.jpg', alt: 'Crianças Copa Agro',              cat: 'Copa Agro', span: '' },
  { src: '/ttc/galeria/galeria-ten-07.jpg', alt: 'Campeões Kids Sub-10',            cat: 'Tênis Kids', span: '' },
  { src: '/ttc/galeria/galeria-ten-08.jpg', alt: '2ª Copa Agro — banner',           cat: 'Copa Agro', span: 'col2' },
]
const ALL_CATS = ['Todas', 'Tênis', 'Beach Tennis', 'Tênis Kids', 'Copa Agro']

function Galeria() {
  const [lightbox, setLightbox]     = useState(null)
  const [filtro, setFiltro]         = useState('Todas')
  const [loaded, setLoaded]         = useState({})

  const fotos = filtro === 'Todas' ? FOTOS : FOTOS.filter(f => f.cat === filtro)

  const onLoaded = useCallback((i) => setLoaded(p => ({ ...p, [i]: true })), [])

  return (
    <AnimSection id="galeria">
      <SectionTitle
        label="📸 Galeria"
        title="Momentos reais do TTC"
        subtitle="Beach tennis, tênis, kids, eventos — clique para ampliar."
      />

      {/* Filtros de categoria */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {ALL_CATS.map(cat => (
          <button key={cat} className={`ttc-tab-btn ${filtro === cat ? 'active' : ''}`}
            onClick={() => setFiltro(cat)}>{cat}</button>
        ))}
      </div>

      {/* Grid masonry-like */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gridAutoRows: '180px',
        gap: 8,
      }}>
        {fotos.map((foto, i) => (
          <div
            key={foto.src + filtro}
            className="ttc-gallery-item"
            onClick={() => setLightbox(i)}
            style={{
              gridRow:    foto.span === 'row2' ? 'span 2' : 'span 1',
              gridColumn: foto.span === 'col2' ? 'span 2' : 'span 1',
              animation: `fadeIn .4s ${i * 60}ms both`,
            }}>
            {!loaded[i] && (
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(90deg, #e8f0e8 25%, #d4e8d4 50%, #e8f0e8 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
            )}
            <img src={foto.src} alt={foto.alt} loading="lazy"
              onLoad={() => onLoaded(i)}
              style={{ display: loaded[i] ? 'block' : 'none' }}
            />
            <div className="ttc-gallery-overlay">
              <div style={{ fontSize: '.7rem', color: C.lime, fontWeight: 700, marginBottom: 2 }}>{foto.cat}</div>
              <div style={{ fontSize: '.82rem', color: '#fff', fontWeight: 600 }}>{foto.alt}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <a href="https://www.instagram.com/ttctga/" target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
            color: '#fff', padding: '13px 28px', borderRadius: 50,
            fontWeight: 700, textDecoration: 'none', fontSize: '.92rem',
            boxShadow: '0 6px 20px rgba(130,58,180,.3)',
            transition: 'transform .2s, box-shadow .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(130,58,180,.45)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
        >
          📸 Seguir @ttctga no Instagram
        </a>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.95)',
            backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn .2s ease',
            padding: 16,
          }}>
          {/* Close */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(null) }}
            style={{
              position: 'fixed', top: 20, right: 20,
              background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%',
              width: 44, height: 44, color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>

          {/* Prev */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(i => (i - 1 + fotos.length) % fotos.length) }}
            style={{
              position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%',
              width: 52, height: 52, color: '#fff', fontSize: 26, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
          >‹</button>

          {/* Imagem */}
          <img
            src={fotos[lightbox].src}
            alt={fotos[lightbox].alt}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '88vw', maxHeight: '80vh', objectFit: 'contain',
              borderRadius: 12, boxShadow: '0 0 80px rgba(0,0,0,.8)',
              animation: 'scaleIn .25s ease',
            }}
          />

          {/* Caption */}
          <div style={{
            marginTop: 16, textAlign: 'center',
            color: 'rgba(255,255,255,.7)', fontSize: '.85rem',
          }}>
            <span style={{ color: C.lime, fontWeight: 700 }}>{fotos[lightbox].cat}</span>
            {' — '}{fotos[lightbox].alt}
            <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 12 }}>
              {lightbox + 1} / {fotos.length}
            </span>
          </div>

          {/* Thumbnails strip */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            display: 'flex', gap: 6, justifyContent: 'center',
            padding: '12px 16px',
            background: 'rgba(0,0,0,.6)',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {fotos.map((f, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); setLightbox(i) }}
                style={{
                  width: 48, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                  border: `2px solid ${lightbox === i ? C.lime : 'transparent'}`,
                  opacity: lightbox === i ? 1 : 0.5, cursor: 'pointer',
                  transition: 'all .2s',
                }}>
                <img src={f.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(i => (i + 1) % fotos.length) }}
            style={{
              position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%',
              width: 52, height: 52, color: '#fff', fontSize: 26, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
          >›</button>
        </div>
      )}
    </AnimSection>
  )
}

/* ─── Seja Sócio ─────────────────────────────────────────────────────────── */
const BENEFICIOS = [
  { icon: '🏊', text: 'Acesso ilimitado à piscina e áreas de lazer' },
  { icon: '🏠', text: 'Reserva exclusiva de quiosques' },
  { icon: '🤸', text: 'Aulas de natação para adultos e crianças (2×/sem)' },
  { icon: '🥋', text: 'Karatê para crianças e adolescentes (2×/sem)' },
  { icon: '💧', text: 'Hidroginástica para adultos' },
  { icon: '🎁', text: 'Brinde de boas-vindas exclusivo' },
]

function SejaSocio() {
  return (
    <AnimSection id="seja-socio">
      <div style={{
        background: `linear-gradient(135deg, ${C.deep} 0%, ${C.forest} 50%, #2a6040 100%)`,
        backgroundSize: '200% 200%',
        borderRadius: 28, overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decoração de fundo */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(143,214,74,.08) 0%, transparent 70%)`,
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 320, height: 320, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(201,166,86,.07) 0%, transparent 70%)`,
        }} />

        <div style={{ position: 'relative', padding: '48px 40px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="ttc-badge" style={{ marginBottom: 16, color: C.lime, borderColor: 'rgba(143,214,74,.3)', background: 'rgba(143,214,74,.08)' }}>
              🎾 Faça parte da família TTC
            </span>
            <h2 style={{
              color: '#fff', fontWeight: 900,
              fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
              margin: '8px 0 12px', lineHeight: 1.1,
              letterSpacing: '-.02em',
            }}>
              Seja Sócio do<br />
              <span style={{
                background: `linear-gradient(135deg, ${C.lime}, ${C.gold})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Tangará Tênis Clube</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: '1rem', maxWidth: 520, margin: '0 auto' }}>
              Garanta para sua família o melhor do esporte e lazer em Tangará da Serra — com o menor preço da região.
            </p>
          </div>

          {/* Grid de benefícios */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12, marginBottom: 40,
          }}>
            {BENEFICIOS.map((b, i) => (
              <div key={i} className="ttc-card-hover" style={{
                display: 'flex', gap: 14, alignItems: 'center',
                background: C.glass,
                backdropFilter: 'blur(8px)',
                borderRadius: 14, padding: '14px 18px',
                border: '1px solid rgba(255,255,255,.1)',
              }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{b.icon}</span>
                <span style={{ color: 'rgba(255,255,255,.9)', fontSize: '.88rem', fontWeight: 500, lineHeight: 1.4 }}>{b.text}</span>
              </div>
            ))}
          </div>

          {/* Hashtag + CTA */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              color: C.lime, fontWeight: 900,
              fontSize: '1.15rem', marginBottom: 24,
              letterSpacing: '.02em',
            }}>#VemSerSócio 🎾</div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://wa.me/5565999247052" target="_blank" rel="noopener noreferrer"
                className="ttc-btn-primary" style={{ fontSize: '1rem' }}>
                💬 Falar pelo WhatsApp
              </a>
              <a href="tel:+556593062398" className="ttc-btn-ghost">
                📞 Ligar agora
              </a>
            </div>
          </div>
        </div>
      </div>
    </AnimSection>
  )
}

/* ─── Contato ─────────────────────────────────────────────────────────────── */
const CONTATOS = [
  { icon: '💬', label: 'WhatsApp',  value: '(65) 99924-7052', href: 'https://wa.me/5565999247052', color: '#25d366' },
  { icon: '📞', label: 'Secretaria', value: '(65) 99606-2398', href: 'tel:+5565996062398', color: '#2196f3' },
  { icon: '✉️', label: 'E-mail',     value: 'tangaratc@outlook.com', href: 'mailto:tangaratc@outlook.com', color: C.gold },
  { icon: '📸', label: 'Instagram',  value: '@ttctga', href: 'https://www.instagram.com/ttctga/', color: '#e91e63' },
  { icon: '🌐', label: 'Site',       value: 'tangaratenisclube.com.br', href: 'https://tangaratenisclube.com.br', color: C.green },
]

function Contato() {
  return (
    <AnimSection id="contato">
      <SectionTitle
        label="📍 Localização"
        title="Onde nos encontrar"
        subtitle="Venha nos visitar! Estamos no coração de Tangará da Serra."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 32, alignItems: 'start' }}>
        {/* Contatos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Endereço destaque */}
          <div style={{
            background: `linear-gradient(135deg, ${C.deep}, ${C.forest})`,
            borderRadius: 18, padding: '20px 22px', marginBottom: 4,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.6rem', flexShrink: 0, marginTop: 2 }}>📍</span>
            <div>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: C.lime, letterSpacing: '.08em', marginBottom: 4 }}>ENDEREÇO</div>
              <div style={{ color: '#fff', fontWeight: 700, lineHeight: 1.5, fontSize: '.92rem' }}>
                Rua Benedito Pereira de Oliveira, 1500<br />
                Jardim Tangará · Tangará da Serra/MT<br />
                CEP 78300-000
              </div>
            </div>
          </div>

          {/* Canais */}
          {CONTATOS.map((c, i) => (
            <a key={i} href={c.href} target="_blank" rel="noopener noreferrer"
              className="ttc-card-hover"
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#fff', borderRadius: 14, padding: '13px 18px',
                border: `1px solid rgba(0,0,0,.07)`,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,.05)',
              }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: c.color + '18', border: `1px solid ${c.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', flexShrink: 0,
              }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: '.7rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</div>
                <div style={{ color: C.deep, fontWeight: 700, fontSize: '.9rem' }}>{c.value}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: C.muted, fontSize: '1rem' }}>→</div>
            </a>
          ))}
        </div>

        {/* Mapa */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,.14)',
          border: '1px solid rgba(95,179,53,.15)',
        }}>
          <iframe
            title="Localização TTC"
            src="https://maps.google.com/maps?q=Rua+Benedito+Pereira+de+Oliveira+1500+Tangará+da+Serra+MT&output=embed"
            width="100%" height="400"
            style={{ border: 0, display: 'block' }}
            allowFullScreen="" loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </AnimSection>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function Clube() {
  const [navVisible, setNavVisible] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    // Injeta CSS global
    const id = 'ttc-styles'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = GLOBAL_CSS
      document.head.appendChild(style)
    }
    return () => {}
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: C.cream }}>
      <StickyNav visible={navVisible} />

      <Hero onScrollPast={setNavVisible} />

      <StatsSection />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px 32px' }}>
        <QuemSomos />
        <Estrutura />
        <Eventos />
        <Galeria />
        <SejaSocio />
        <Contato />
      </div>

      {/* Footer do clube */}
      <div style={{
        background: C.deep, color: 'rgba(255,255,255,.55)',
        textAlign: 'center', padding: '24px 16px',
        fontSize: '.82rem',
      }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '.9rem', marginBottom: 6 }}>
          Tangará Tênis Clube — TTC
        </div>
        Rua Benedito Pereira de Oliveira, 1500 · Tangará da Serra/MT · @ttctga
      </div>
    </div>
  )
}
