import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PATROCINADORES = [
  { nome: 'UISA Agroindustrial', icon: '🌾', cor: '#FF6B2C', desc: 'Patrocinador Master' },
  { nome: 'Tangará Tênis Clube', icon: '🎾', cor: '#FF6B2C', desc: 'Sede Oficial' },
  { nome: 'Prefeitura de Tangará da Serra', icon: '🏛️', cor: '#12283F', desc: 'Apoio Institucional' },
]

const INFO_CARDS_DEFAULT = [
  { icon: '📅', label: 'Datas', value: '07 a 13 Set 2026', sub: 'Domingo a Sábado' },
  { icon: '📍', label: 'Local', value: 'Tangará Tênis Clube', sub: 'Tangará da Serra – MT' },
  { icon: '🎾', label: 'Categorias', value: '14 categorias', sub: 'Masc · Fem · Misto · Sênior' },
  { icon: '🏆', label: 'Premiação', value: 'R$ 250.000+', sub: 'Em prêmios + troféus' },
]

const GALLERY = [
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=uBNzwhX%2FTWhx2%2FVnwh4vVJUma6aBOvWTlIp48Bj%2Bt%2FvkVnGub7UFEePk2YdVFY%2FfaMkcnjM%2BYrDRG82yPVNOnL3MpDZIl1BTPBTCA2Nn3mJAV6ZnkFH4SloUF9rWESX5DHm8YgdL1l7eUZOb7Pg%3D&u2=i4Vxk9s4b8RsKjvy&width=2560',
    label: 'Quadras do clube', credit: 'Freerange Stock (CC)',
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=I3RGF3OQ57Ll5ME7nq5hQwJ5iQ0UA3cdKUUTGvjbQqrAB4jpc2nvDJ66KnV9UFTt2sPmosC%2F32KaF%2BY6kLfxAK%2FuxM2yliTsijGuukGgDVz6alyqdKNJeOw5ricawOoM1U1GBdOPR8sG44h9H31TaHEFL99XreeW4GcGRtb4nLRbZAGa4CDfxYG3jwq8UfbAxCbTi295tQ%3D%3D&u2=e%2Be07vRwApkPy8q1&width=2560',
    label: 'Arquibancada cheia', credit: 'Wikimedia Commons (CC)',
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=ljENdPGZnpEtRKXjSkXOigSQQ5NvbW12WD9h6InfPblZ1uteFQQqnUtF480VZ9F1lSvpo4jOajVfLPd2U8P2oEyo6fi1cQ7T6zLQTRUFX%2FNb0TukSu643Xo%2FhBFvIr0%3D&u2=LK5x1okOD%2FoDFx5F&width=2560',
    label: 'Três quadras — visão aérea', credit: 'Freerange Stock (CC)',
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=4%2Fitlj41OePZqbbo7OwSjN5qBt0%2BC7x3Kz9YzjDovrROy7QjmVdC9R3KXR8fgEImVHBeUhf2fkSoZaWXDGj0NU8%2BMIoByfyVBW8LxORCbQMSKQ86H87mmvw5mmjTyCIiRbKx2n%2F248akxFjQHbhglXUCEYdOKHKXV22U0vePo5ac%2FRqyAs6WL0iH1ZfJSAs5Ebtyp0MkAYN8u3IdOTyaQ6FzOALjUSFeKzsq0IS0A5FK3D0%2B&u2=Rv%2ByLUFjVq0F4WWI&width=2560',
    label: 'Cerimônia de premiação', credit: 'Wikimedia Commons (CC)',
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=peqkPREb%2BuY3rYgsJ%2FOjzj8aNTVbYasmeO5CEbM8S0vnJxyrcHwokfBq6U%2Bs9Fshe02vNAV9TEyloo8npIuv%2F8f1fRvt2W1bNMIfdGlJsltRLG9ZNYm3hkAT2c%2F8iJ5dzPIMyqTHG%2BqHL%2Bq0Bs9THoF0uLM6uzpgBRAgzc5cbzzeDU9YlaL6&u2=nSKlpAolM8rZn9ZD&width=2560',
    label: 'Australian Open — Rod Laver Arena', credit: 'Wikimedia Commons (CC)',
  },
  {
    img: 'https://sspark.genspark.ai/cfimages?u1=W77x7JJMqKcTKTBZn8PKfsukk9rECNVzlbR5B8mEUAjWEQXkaqNRowI%2Bwj68FFbxeW2BbsXjvUp0kFBs4VMuxTfXOMG7PY53oZccKe12nHXI5%2BlRy2VLurNC6j5jav0qbA%3D%3D&u2=PrlR%2B0Ivenlvt8ns&width=2560',
    label: 'Torcida nas tribunas', credit: 'Freerange Stock (CC)',
  },
]

const CAMPEOES_DEFAULT = [
  { edicao: '3ª Agro Open', ano: '2024', categoria: 'Masc. PRO', nome: 'Rafael A.', pontos: 2400 },
  { edicao: '3ª Agro Open', ano: '2024', categoria: '1ª Classe', nome: 'Diego M.', pontos: 1800 },
  { edicao: '2ª Agro Open', ano: '2023', categoria: 'Masc. PRO', nome: 'Bruno S.', pontos: 2200 },
  { edicao: '2ª Agro Open', ano: '2023', categoria: '2ª Classe', nome: 'Carlos R.', pontos: 1600 },
]

const ATLETAS_DESTAQUE = [
  { nome: 'Rafael Andrade', ranking: '#1 Ranking', categoria: 'Masc. PRO', cidade: 'Cuiabá – MT', pontos: '2.471 pts', vitoriasDesc: '3V · 1D', emoji: '🥇' },
  { nome: 'Diego Matos', ranking: '#2 Ranking', categoria: '1ª Classe', cidade: 'Tangará da Serra – MT', pontos: '1.920 pts', vitoriasDesc: '2V · 2D', emoji: '🥈' },
  { nome: 'Bruno Souza', ranking: '#3 Ranking', categoria: 'Masc. PRO', cidade: 'Campo Grande – MS', pontos: '1.750 pts', vitoriasDesc: '1V · 3D', emoji: '🥉' },
]

const CAT_COLORS = {
  evento: '#FF6B2C', resultado: '#FF6B2C', inscricao: '#FF9B72',
  geral: '#6b7280', comunicado: '#e05c5c',
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @keyframes pulseBadge {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,44,0.5); }
    50% { box-shadow: 0 0 0 10px rgba(255,107,44,0); }
  }
  @keyframes pulseGold {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,44,0.6); }
    50% { box-shadow: 0 0 0 12px rgba(255,107,44,0); }
  }
  @keyframes shimmerLight {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33% { transform: translateY(-12px) rotate(5deg); }
    66% { transform: translateY(-6px) rotate(-3deg); }
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes heroBadgeIn {
    0% { opacity: 0; transform: translateY(-20px) scale(0.9); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes titleIn {
    0% { opacity: 0; transform: translateY(40px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes rotateSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  .stat-ring {
    animation: rotateSlow 20s linear infinite;
  }
  .hero-title-line1 { animation: titleIn 0.8s ease forwards; animation-delay: 0.2s; opacity: 0; }
  .hero-title-line2 { animation: titleIn 0.8s ease forwards; animation-delay: 0.4s; opacity: 0; }
  .hero-title-line3 { animation: titleIn 0.8s ease forwards; animation-delay: 0.6s; opacity: 0; }
  .hero-badge { animation: heroBadgeIn 0.7s ease forwards; animation-delay: 0.1s; opacity: 0; }
  .hero-ctas { animation: fadeUp 0.8s ease forwards; animation-delay: 0.8s; opacity: 0; }
  .hero-sub { animation: fadeUp 0.6s ease forwards; animation-delay: 0.65s; opacity: 0; }
`

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS / HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function RevealSection({ children, style, delay = 0 }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function useCountdown(targetDate) {
  const calc = () => {
    const diff = new Date(targetDate + 'T00:00:00') - new Date()
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, ended: true }
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      ended: false,
    }
  }
  const [t, setT] = useState(calc)
  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate])
  return t
}

function AnimatedCounter({ target, duration = 1800, prefix = '', suffix = '' }) {
  const [value, setValue] = useState(0)
  const { ref, visible } = useReveal()
  const started = useRef(false)
  useEffect(() => {
    if (!visible || started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, target, duration])
  return <span ref={ref}>{prefix}{value.toLocaleString('pt-BR')}{suffix}</span>
}

function TennisBall({ style }) {
  return (
    <div style={{ position: 'absolute', fontSize: '3rem', opacity: 0.06, userSelect: 'none', pointerEvents: 'none', animation: 'float 8s ease-in-out infinite', ...style }}>
      🎾
    </div>
  )
}

function SectionLabel({ text, color = '#FF6B2C' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ height: 2, width: 36, background: color, borderRadius: 2 }} />
      <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', color, textTransform: 'uppercase' }}>{text}</span>
      <div style={{ height: 2, width: 36, background: color, borderRadius: 2 }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN
// ─────────────────────────────────────────────────────────────────────────────

function CountdownUnit({ val, label }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div style={{
        fontSize: '2rem', fontWeight: 900, color: '#FF6B2C', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 2px 12px rgba(255,107,44,0.4)',
      }}>
        {String(val).padStart(2, '0')}
      </div>
      <div style={{ fontSize: '0.6rem', color: '#FF9B72', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
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
      background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,107,44,0.4)',
      borderRadius: 18, padding: '16px 26px', marginBottom: 32,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ marginRight: 22, borderRight: '1px solid rgba(255,255,255,0.12)', paddingRight: 22 }}>
        <div style={{ fontSize: '0.65rem', color: '#FF9B72', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
          ⚡ Começa em
        </div>
        <div style={{ fontSize: '0.8rem', color: '#FCE2D3', fontWeight: 600 }}>
          {nomeEvento || '4ª Agro Open'}
        </div>
      </div>
      <CountdownUnit val={d} label="dias" />
      <div style={{ color: '#FF6B2C', fontWeight: 900, fontSize: '1.6rem', margin: '0 4px', lineHeight: 1, paddingBottom: 10 }}>:</div>
      <CountdownUnit val={h} label="horas" />
      <div style={{ color: '#FF6B2C', fontWeight: 900, fontSize: '1.6rem', margin: '0 4px', lineHeight: 1, paddingBottom: 10 }}>:</div>
      <CountdownUnit val={m} label="min" />
      <div style={{ color: '#FF6B2C', fontWeight: 900, fontSize: '1.6rem', margin: '0 4px', lineHeight: 1, paddingBottom: 10 }}>:</div>
      <CountdownUnit val={s} label="seg" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE STATS BAR
// ─────────────────────────────────────────────────────────────────────────────

function LiveStatsBar({ totalInscritos, totalCategorias, diasRestantes }) {
  const stats = [
    { icon: '🎾', label: 'Atletas inscritos', value: totalInscritos, animated: true, color: '#FF6B2C' },
    { icon: '🏆', label: 'Categorias', value: totalCategorias || 14, animated: false, color: '#FF6B2C' },
    { icon: '⏳', label: 'Dias para o torneio', value: diasRestantes != null ? diasRestantes : '—', animated: false, color: '#FF9B72' },
  ].filter(s => s.value !== null)

  return (
    <div style={{
      background: '#12283F',
      borderTop: '1px solid rgba(255,107,44,0.12)',
      borderBottom: '1px solid rgba(255,107,44,0.12)',
    }}>
      <div style={{
        maxWidth: 1060, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '18px 28px',
            borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
          }}>
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {s.animated && typeof s.value === 'number' ? <AnimatedCounter target={s.value} /> : s.value}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAGNITUDE SECTION — números épicos do torneio
// ─────────────────────────────────────────────────────────────────────────────

function MagnitudeSection() {
  const stats = [
    { number: 4, suffix: 'ª', label: 'Edição', desc: 'Crescendo a cada ano', color: '#FF6B2C', icon: '🏆' },
    { number: 250, prefix: 'R$', suffix: 'k+', label: 'Em Premiação', desc: 'O maior prize money do Centro-Oeste', color: '#FF9B72', icon: '💰', big: true },
    { number: 250, suffix: '+', label: 'Atletas', desc: 'De todo o Brasil', color: '#FF6B2C', icon: '🎾' },
    { number: 14, suffix: '', label: 'Categorias', desc: 'Para todos os níveis', color: '#FF6B2C', icon: '📋' },
    { number: 7, suffix: ' dias', label: 'De competição', desc: '07 a 13 de setembro', color: '#FF9B72', icon: '📅' },
    { number: 3, suffix: 'ª', label: 'Maior torneio', desc: 'Do Centro-Oeste', color: '#FF6B2C', icon: '🌎' },
  ]

  return (
    <section style={{
      background: 'linear-gradient(160deg, #0D2235 0%, #12283F 50%, #102B43 100%)',
      padding: '80px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative large text background */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 'clamp(8rem, 20vw, 18rem)', fontWeight: 900,
        color: 'rgba(255,255,255,0.018)', letterSpacing: '-0.04em',
        whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
        lineHeight: 1,
      }}>
        AGRO OPEN
      </div>

      <TennisBall style={{ top: '10%', right: '5%', fontSize: '8rem' }} />
      <TennisBall style={{ bottom: '10%', left: '3%', fontSize: '6rem' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel text="Os Números do Maior Torneio" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900, color: '#FFF4EC', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Uma escala sem precedentes<br />
              <span style={{ color: '#FF9B72' }}>no Centro-Oeste</span>
            </h2>
            <p style={{ color: 'rgba(255,244,236,0.7)', fontSize: '1rem', maxWidth: 520, margin: '0 auto' }}>
              A 4ª Agro Open não é apenas um torneio — é o maior evento de tênis já realizado na região Centro-Oeste do Brasil.
            </p>
          </div>
        </RevealSection>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 20,
        }}>
          {stats.map((s, i) => (
            <RevealSection key={i} delay={i * 80}>
              <div style={{
                background: s.big
                  ? 'linear-gradient(135deg, rgba(255,107,44,0.15) 0%, rgba(255,107,44,0.1) 100%)'
                  : 'rgba(255,255,255,0.04)',
                border: s.big ? '1.5px solid rgba(255,107,44,0.35)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                padding: '28px 20px 24px',
                textAlign: 'center',
                transition: 'transform 0.2s, background 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.background = s.big ? 'rgba(255,107,44,0.18)' : 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = s.big ? 'linear-gradient(135deg, rgba(255,107,44,0.15) 0%, rgba(255,107,44,0.1) 100%)' : 'rgba(255,255,255,0.04)' }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{s.icon}</div>
                <div style={{
                  fontSize: s.big ? 'clamp(2rem, 5vw, 2.8rem)' : 'clamp(1.6rem, 4vw, 2.2rem)',
                  fontWeight: 900, color: s.color, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 4px 20px ${s.color}40`,
                }}>
                  {s.prefix && <span style={{ fontSize: '0.55em' }}>{s.prefix} </span>}
                  <AnimatedCounter target={s.number} duration={1600} />
                  <span style={{ fontSize: '0.65em' }}>{s.suffix}</span>
                </div>
                <div style={{ fontWeight: 800, color: '#FFF4EC', fontSize: '0.82rem', marginTop: 8 }}>{s.label}</div>
                <div style={{ color: 'rgba(255,244,236,0.55)', fontSize: '0.7rem', marginTop: 4, lineHeight: 1.4 }}>{s.desc}</div>
                {s.big && (
                  <div style={{
                    position: 'absolute', top: 8, right: 10,
                    fontSize: '0.6rem', fontWeight: 800, color: '#FF6B2C',
                    background: 'rgba(255,107,44,0.15)', borderRadius: 999,
                    padding: '2px 8px', letterSpacing: '0.1em',
                    animation: 'pulseGold 2.5s ease-in-out infinite',
                  }}>
                    RECORD
                  </div>
                )}
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ATLETAS PRO SECTION
// ─────────────────────────────────────────────────────────────────────────────

function AtletasProSection({ ranking }) {
  const topAtletas = (ranking && ranking.length > 0) ? ranking.slice(0, 3).map((r, i) => ({
    nome: r.nome,
    ranking: `#${i + 1} Ranking`,
    categoria: r.categoria || 'PRO',
    cidade: r.cidade || 'Brasil',
    pontos: `${(r.pontos || 0).toLocaleString('pt-BR')} pts`,
    vitoriasDesc: `${r.vitorias ?? 0}V · ${r.derrotas ?? 0}D`,
    emoji: ['🥇', '🥈', '🥉'][i],
  })) : ATLETAS_DESTAQUE

  const medalColors = [
    { from: '#FF6B2C', to: '#f0d080', glow: 'rgba(255,107,44,0.4)', border: '#FF6B2C' },
    { from: '#9e9e9e', to: '#d4d4d4', glow: 'rgba(180,180,180,0.35)', border: '#b0b0b0' },
    { from: '#cd7f32', to: '#e8a96a', glow: 'rgba(205,127,50,0.35)', border: '#cd7f32' },
  ]

  return (
    <section style={{
      background: 'linear-gradient(180deg, #FFF4EC 0%, #FFF9F5 100%)',
      padding: '80px 24px',
    }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <SectionLabel text="Atletas de Elite" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#12283F', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              🏆 Jogadores Profissionais
            </h2>
            <p style={{ color: '#5A6570', fontSize: '1rem', maxWidth: 540, margin: '0 auto' }}>
              Atletas ranqueados nacionalmente competindo por vagas e premiações de alto nível
            </p>
          </div>
        </RevealSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {topAtletas.map((a, i) => {
            const mc = medalColors[i] || medalColors[2]
            return (
              <RevealSection key={i} delay={i * 100}>
                <div style={{
                  background: '#fff',
                  borderRadius: 24,
                  overflow: 'hidden',
                  boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1.5px ${mc.border}30`,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${mc.glow}, 0 0 0 2px ${mc.border}60` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1.5px ${mc.border}30` }}
                >
                  {/* Medal bar top */}
                  <div style={{
                    height: 6,
                    background: `linear-gradient(90deg, ${mc.from}, ${mc.to})`,
                  }} />

                  <div style={{ padding: '28px 28px 24px' }}>
                    {/* Emoji + rank badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <span style={{ fontSize: '3rem', lineHeight: 1 }}>{a.emoji}</span>
                      <div style={{
                        background: `linear-gradient(135deg, ${mc.from}, ${mc.to})`,
                        color: '#12283F', borderRadius: 999,
                        padding: '4px 14px', fontSize: '0.72rem', fontWeight: 900,
                        letterSpacing: '0.06em',
                      }}>
                        {a.ranking}
                      </div>
                    </div>

                    {/* Nome */}
                    <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#12283F', marginBottom: 4 }}>{a.nome}</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FF6B2C', marginBottom: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {a.categoria}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#5A6570', marginBottom: 16 }}>📍 {a.cidade}</div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{
                        flex: 1, background: 'rgba(255,107,44,0.08)', borderRadius: 12,
                        padding: '10px 12px', textAlign: 'center',
                        border: '1px solid rgba(255,107,44,0.15)',
                      }}>
                        <div style={{ fontWeight: 900, color: '#FF6B2C', fontSize: '1rem' }}>{a.pontos}</div>
                        <div style={{ fontSize: '0.62rem', color: '#8a9a8a', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Pontos</div>
                      </div>
                      <div style={{
                        flex: 1, background: 'rgba(255,107,44,0.08)', borderRadius: 12,
                        padding: '10px 12px', textAlign: 'center',
                        border: '1px solid rgba(255,107,44,0.15)',
                      }}>
                        <div style={{ fontWeight: 900, color: '#FF6B2C', fontSize: '1rem' }}>{a.vitoriasDesc}</div>
                        <div style={{ fontSize: '0.62rem', color: '#8a9a8a', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Partidas</div>
                      </div>
                    </div>
                  </div>
                </div>
              </RevealSection>
            )
          })}
        </div>

        <RevealSection delay={300}>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link to="/ranking" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: '#FF6B2C', fontWeight: 800, textDecoration: 'none',
              fontSize: '0.95rem', borderBottom: '2px solid #FF9B72', paddingBottom: 2,
              transition: 'color 0.2s',
            }}>
              Ver ranking completo →
            </Link>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIZE BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

function PrizeBreakdown() {
  const premios = [
    { cat: 'Masc. PRO', primeiro: 'R$ 45.000', segundo: 'R$ 20.000', cor: '#FF6B2C', emoji: '👑' },
    { cat: '1ª Classe', primeiro: 'R$ 28.000', segundo: 'R$ 12.000', cor: '#FF6B2C', emoji: '🏆' },
    { cat: '2ª Classe', primeiro: 'R$ 18.000', segundo: 'R$ 8.000', cor: '#FF9B72', emoji: '🥇' },
    { cat: 'Feminino A', primeiro: 'R$ 22.000', segundo: 'R$ 10.000', cor: '#e06e8a', emoji: '💪' },
    { cat: 'Duplas PRO', primeiro: 'R$ 30.000', segundo: 'R$ 14.000', cor: '#FF6B2C', emoji: '🤝' },
    { cat: 'Sênior 35+', primeiro: 'R$ 15.000', segundo: 'R$ 7.000', cor: '#FF6B2C', emoji: '⭐' },
  ]

  return (
    <section style={{
      background: 'linear-gradient(135deg, #12283F 0%, #183450 50%, #102B43 100%)',
      padding: '80px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* bg text */}
      <div style={{
        position: 'absolute', bottom: -20, right: -20,
        fontSize: '12rem', fontWeight: 900, opacity: 0.03,
        lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
      }}>💰</div>
      <TennisBall style={{ top: '15%', left: '2%', fontSize: '7rem' }} />

      <div style={{ maxWidth: 1060, margin: '0 auto', position: 'relative' }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <SectionLabel text="Premiação Por Categoria" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#FFF4EC', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              💰 Mais de{' '}
              <span style={{
                color: '#FF6B2C',
                textShadow: '0 4px 24px rgba(255,107,44,0.5)',
              }}>
                R$ 250.000
              </span>{' '}
              em Prêmios
            </h2>
            <p style={{ color: 'rgba(255,244,236,0.7)', fontSize: '1rem', maxWidth: 560, margin: '0 auto' }}>
              O maior prize money já oferecido em um torneio de tênis no Centro-Oeste. Compete pelos maiores prêmios da região.
            </p>
          </div>
        </RevealSection>

        {/* Grand prize destaque */}
        <RevealSection>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,107,44,0.18) 0%, rgba(255,107,44,0.08) 100%)',
            border: '2px solid rgba(255,107,44,0.4)',
            borderRadius: 24, padding: '36px 40px', marginBottom: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 24,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(255,107,44,0.15) 0%, transparent 70%)',
            }} />
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#FF9B72', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                🏆 Premiação Total do Torneio
              </div>
              <div style={{ fontSize: 'clamp(2.8rem, 8vw, 4.5rem)', fontWeight: 900, color: '#FF6B2C', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 4px 32px rgba(255,107,44,0.4)' }}>
                R$ 250.000<span style={{ fontSize: '0.4em', verticalAlign: 'super' }}>+</span>
              </div>
              <div style={{ color: 'rgba(255,244,236,0.7)', fontSize: '0.9rem', marginTop: 8 }}>
                Distribuídos em 14 categorias · Maior do Centro-Oeste
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
              <div style={{
                background: 'rgba(255,107,44,0.15)', border: '1px solid rgba(255,107,44,0.3)',
                borderRadius: 12, padding: '10px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FF9B72' }}>4ª</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,244,236,0.6)', fontWeight: 700, textTransform: 'uppercase' }}>Edição</div>
              </div>
              <div style={{
                background: 'rgba(255,107,44,0.15)', border: '1px solid rgba(255,107,44,0.3)',
                borderRadius: 12, padding: '10px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FF6B2C' }}>250+</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,244,236,0.6)', fontWeight: 700, textTransform: 'uppercase' }}>Atletas</div>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* Grid categorias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {premios.map((p, i) => (
            <RevealSection key={i} delay={i * 70}>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18, padding: '22px 24px',
                transition: 'background 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = '' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: '1.8rem' }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 900, color: '#FFF4EC', fontSize: '0.95rem' }}>{p.cat}</div>
                    <div style={{ fontSize: '0.68rem', color: p.cor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categoria</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,244,236,0.5)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>🥇 1º Lugar</div>
                    <div style={{ fontWeight: 900, color: p.cor, fontSize: '1.05rem' }}>{p.primeiro}</div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ flex: 1, paddingLeft: 12 }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,244,236,0.5)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>🥈 2º Lugar</div>
                    <div style={{ fontWeight: 800, color: 'rgba(255,244,236,0.7)', fontSize: '1rem' }}>{p.segundo}</div>
                  </div>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection delay={400}>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <p style={{ color: 'rgba(255,244,236,0.5)', fontSize: '0.78rem' }}>
              * Valores informativos. Premiação final confirmada no regulamento oficial.
            </p>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPEOES
// ─────────────────────────────────────────────────────────────────────────────

function CampeoesSection({ campeoes }) {
  const lista = (campeoes && campeoes.length > 0) ? campeoes : CAMPEOES_DEFAULT
  return (
    <section style={{ background: 'linear-gradient(180deg,#FFF4EC 0%,#FFF9F5 100%)', padding: '64px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <SectionLabel text="Hall da Fama" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#12283F', margin: '0 0 8px' }}>🏆 Últimos Campeões</h2>
            <p style={{ color: '#5A6570', margin: 0 }}>Conheça quem dominou as edições anteriores</p>
          </div>
        </RevealSection>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {lista.slice(0, 8).map((c, i) => (
            <RevealSection key={i} delay={i * 60}>
              <div style={{
                background: '#fff',
                border: i === 0 ? '2px solid #FF6B2C' : '1px solid rgba(0,0,0,0.07)',
                borderRadius: 18, padding: '20px 20px 18px',
                position: 'relative', overflow: 'hidden',
                boxShadow: i === 0 ? '0 6px 28px rgba(255,107,44,.18)' : '0 2px 12px rgba(0,0,0,.06)',
                transition: 'transform .2s, box-shadow .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(255,107,44,.22)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = i === 0 ? '0 6px 28px rgba(255,107,44,.18)' : '0 2px 12px rgba(0,0,0,.06)' }}
              >
                {i === 0 && (
                  <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 10, fontWeight: 800, color: '#FF6B2C', background: 'rgba(255,107,44,.1)', borderRadius: 999, padding: '2px 8px' }}>⭐ Destaque</div>
                )}
                <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🏆</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FF6B2C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{c.categoria}</div>
                <div style={{ fontWeight: 900, fontSize: '1rem', color: '#12283F', marginBottom: 2 }}>{c.nome}</div>
                <div style={{ fontSize: '0.78rem', color: '#5A6570' }}>{c.edicao} · {c.ano}</div>
                {c.pontos && (
                  <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 800, color: '#FF6B2C' }}>
                    {c.pontos.toLocaleString('pt-BR')} pts
                  </div>
                )}
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

function TimelineEvento({ dataInicio, dataFim }) {
  const fases = [
    { icon: '📋', label: 'Inscrições Abertas', desc: 'Garanta sua vaga agora', status: 'active' },
    { icon: '✅', label: 'Encerramento das Inscrições', desc: dataInicio ? `Até ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'Em breve', status: 'upcoming' },
    { icon: '🎲', label: 'Sorteio das Chaves', desc: 'Definição dos grupos', status: 'upcoming' },
    { icon: '🎾', label: 'Início do Torneio', desc: dataInicio ? new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Em breve', status: 'upcoming' },
    { icon: '🏆', label: 'Grande Final', desc: dataFim ? new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : 'Em breve', status: 'upcoming' },
  ]

  return (
    <section style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 48px' }}>
      <RevealSection>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <SectionLabel text="Cronograma" color="#FF6B2C" />
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#12283F', margin: '0 0 8px' }}>📅 Etapas do Torneio</h2>
          <p style={{ color: '#5A6570', margin: 0 }}>Acompanhe todas as etapas da 4ª Agro Open</p>
        </div>
      </RevealSection>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 23, top: 0, bottom: 0, width: 2,
          background: 'linear-gradient(to bottom, #FF6B2C 0%, #FF6B2C 50%, rgba(0,0,0,.08) 100%)',
          borderRadius: 2,
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {fases.map((f, i) => (
            <RevealSection key={i} delay={i * 80}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', paddingBottom: i < fases.length - 1 ? 28 : 0 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: f.status === 'active' ? 'linear-gradient(135deg,#FF6B2C,#FF9B72)' : '#fff',
                  border: f.status === 'active' ? 'none' : '2px solid rgba(0,0,0,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                  boxShadow: f.status === 'active' ? '0 4px 16px rgba(255,107,44,.4)' : '0 2px 8px rgba(0,0,0,.06)',
                  position: 'relative', zIndex: 1,
                }}>
                  {f.status === 'active' ? f.icon : <span style={{ opacity: 0.5 }}>{f.icon}</span>}
                </div>
                <div style={{ paddingTop: 8, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: f.status === 'active' ? '#12283F' : '#5A6570', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.label}
                    {f.status === 'active' && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#FF6B2C',
                        background: 'rgba(255,107,44,.12)', border: '1px solid rgba(255,107,44,.3)',
                        borderRadius: 999, padding: '2px 8px', animation: 'pulseBadge 2s ease-in-out infinite',
                      }}>AGORA</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#8a9a8a', marginTop: 2 }}>{f.desc}</div>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING SKELETON
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// NOTICIAS
// ─────────────────────────────────────────────────────────────────────────────

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
        <span style={{ background: cor + '18', color: cor, border: `1px solid ${cor}33`, borderRadius: 999, padding: '3px 12px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'capitalize' }}>
          {noticia.categoria || 'Geral'}
        </span>
        {dataStr && <span style={{ fontSize: '0.72rem', color: '#5A6570', fontWeight: 600 }}>{dataStr}</span>}
      </div>
      <div style={{ fontWeight: 800, color: '#12283F', fontSize: '0.95rem', lineHeight: 1.35 }}>{noticia.titulo}</div>
      {noticia.resumo && (
        <div style={{ fontSize: '0.8rem', color: '#5A6570', lineHeight: 1.5 }}>
          {noticia.resumo.length > 100 ? noticia.resumo.slice(0, 100) + '…' : noticia.resumo}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP FAB
// ─────────────────────────────────────────────────────────────────────────────

function WhatsAppFAB() {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href="https://wa.me/5565999999999?text=Quero%20me%20inscrever%20no%204ª%20Agro%20Open"
      target="_blank" rel="noopener noreferrer"
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const [ranking, setRanking] = useState([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [noticias, setNoticias] = useState([])
  const [noticiasLoading, setNoticiasLoading] = useState(true)
  const [totalInscritos, setTotalInscritos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [eventoInfo, setEventoInfo] = useState(null)
  const [infoCards, setInfoCards] = useState(INFO_CARDS_DEFAULT)
  const [campeoes, setCampeoes] = useState([])
  const [diasRestantes, setDiasRestantes] = useState(null)
  const [scrollY, setScrollY] = useState(0)

  // Parallax scroll
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Inject CSS
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = GLOBAL_CSS
    document.head.appendChild(style)
    return () => { try { document.head.removeChild(style) } catch (_) {} }
  }, [])

  // API calls
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
    api.get('/api/info').catch(() => null).then(d => {
      if (!d) return
      if (d?.dataInicio) {
        setEventoInfo({ dataInicio: d.dataInicio, dataFim: d.dataFim, nomeEvento: d.nomeEvento || d.evento })
        const diff = new Date(d.dataInicio + 'T00:00:00') - new Date()
        if (diff > 0) setDiasRestantes(Math.ceil(diff / 86400000))
      }
      const local = d.local || d.localEvento || 'Tangará Tênis Clube'
      const cidade = d.cidade || 'Tangará da Serra – MT'
      const datas = d.dataInicio && d.dataFim ? formatarPeriodo(d.dataInicio, d.dataFim) : (d.datas || '07 a 13 Set 2026')
      const premio = d.premiacao || d.premio
      setInfoCards([
        { icon: '📅', label: 'Datas', value: datas, sub: 'Data do torneio' },
        { icon: '📍', label: 'Local', value: local, sub: cidade },
        { icon: '🎾', label: 'Categorias', value: (d.totalCategorias || '14') + ' categorias', sub: 'Masc · Fem · Misto · Sênior' },
        { icon: '🏆', label: 'Premiação', value: premio || 'R$ 250.000+', sub: 'Em prêmios + troféus' },
      ])
    })
    api.get('/api/campeoes').catch(() => null).then(d => {
      if (!d) return
      if (Array.isArray(d) && d.length > 0) {
        setCampeoes(d)
      } else if (d && typeof d === 'object' && !Array.isArray(d)) {
        const arr = Object.entries(d).map(([cat, v]) => ({
          categoria: cat,
          nome: v.nome || v.atleta || '—',
          edicao: v.edicao || v.torneio || '',
          ano: v.ano || '',
          pontos: v.pontos || v.elo || null,
        }))
        if (arr.length > 0) setCampeoes(arr)
      }
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
    { bg: 'linear-gradient(135deg,#FF6B2C,#f0d080,#FF6B2C)', border: '#FF6B2C', text: '#12283F', glow: 'rgba(255,107,44,0.4)' },
    { bg: 'linear-gradient(135deg,#9e9e9e,#d4d4d4,#9e9e9e)', border: '#b0b0b0', text: '#12283F', glow: 'rgba(180,180,180,0.3)' },
    { bg: 'linear-gradient(135deg,#cd7f32,#e8a96a,#cd7f32)', border: '#cd7f32', text: '#fff', glow: 'rgba(205,127,50,0.3)' },
  ]
  const podiumOrder = [1, 0, 2]

  return (
    <div style={{ fontFamily: "'Work Sans', 'Segoe UI', sans-serif", background: '#FFF4EC', minHeight: '100vh' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — ÉPICO
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        background: 'linear-gradient(160deg, #0A1B2B 0%, #0D2235 30%, #12283F 65%, #102B43 100%)',
        color: '#FFF4EC',
        padding: 'clamp(80px, 12vw, 120px) 24px clamp(120px, 18vw, 160px)',
        textAlign: 'center',
        overflow: 'hidden',
        minHeight: 'min(90vh, 760px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Parallax bg balls */}
        <TennisBall style={{ top: '6%', left: '2%', fontSize: '8rem', transform: `translateY(${scrollY * 0.15}px)` }} />
        <TennisBall style={{ top: '12%', right: '2%', fontSize: '11rem', transform: `rotate(20deg) translateY(${scrollY * 0.1}px)` }} />
        <TennisBall style={{ bottom: '12%', left: '10%', fontSize: '5rem', transform: `rotate(-15deg) translateY(${scrollY * -0.08}px)` }} />
        <TennisBall style={{ bottom: '18%', right: '6%', fontSize: '4rem', transform: `translateY(${scrollY * -0.12}px)` }} />
        <TennisBall style={{ top: '42%', left: '36%', fontSize: '14rem', opacity: 0.025, transform: `translateY(${scrollY * 0.05}px)` }} />

        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(700px, 100vw)', height: 'min(700px, 100vw)',
          background: 'radial-gradient(circle, rgba(255,107,44,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 820 }}>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <img
            src="/brand/kytto-negativo.svg"
            alt="Kytto"
            style={{ width: 154, height: 'auto', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.18)' }}
          />
        </div>

        {/* Top badges */}
          <div className="hero-badge" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            <div style={{
              background: 'rgba(255,107,44,0.12)', border: '1.5px solid #FF9B72',
              color: '#FF9B72', borderRadius: '999px', padding: '7px 20px',
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', animation: 'pulseBadge 2s ease-in-out infinite',
            }}>
              ⚡ Inscrições Abertas
            </div>
            <div style={{
              background: 'rgba(255,107,44,0.12)', border: '1.5px solid rgba(255,107,44,0.5)',
              color: '#FF6B2C', borderRadius: '999px', padding: '7px 20px',
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', animation: 'pulseGold 2.5s ease-in-out infinite',
            }}>
              🏆 R$ 250.000+ em Premiação
            </div>
          </div>

          {/* Main title */}
          <h1 style={{ margin: '0 0 4px', lineHeight: 1.02, letterSpacing: '-0.03em' }}>
            <div className="hero-title-line1" style={{
              fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', fontWeight: 800,
              color: '#FF9B72', letterSpacing: '0.25em', textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              🌎 Centro-Oeste · 4ª Edição · 2026
            </div>
            <div className="hero-title-line2" style={{
              fontSize: 'clamp(2.6rem, 8vw, 5.8rem)', fontWeight: 900,
              color: '#FFF4EC',
              textShadow: '0 4px 40px rgba(0,0,0,0.6)',
              lineHeight: 1,
            }}>
              O MAIOR TORNEIO
            </div>
            <div className="hero-title-line3" style={{
              fontSize: 'clamp(2.6rem, 8vw, 5.8rem)', fontWeight: 900,
              background: 'linear-gradient(90deg, #FF6B2C, #FF9B72, #FF6B2C)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradientShift 4s ease infinite',
              lineHeight: 1.05,
            }}>
              DE TÊNIS DO BRASIL
            </div>
          </h1>

          {/* Sub */}
          <p className="hero-sub" style={{
            color: 'rgba(255,244,236,0.8)', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
            margin: '16px 0 28px', letterSpacing: '0.04em', lineHeight: 1.6,
          }}>
            <strong style={{ color: '#FFF4EC' }}>4ª Agro Open de Tênis</strong> · Tangará Tênis Clube · UISA · Tangará da Serra – MT<br />
            <span style={{ color: 'rgba(255,107,44,0.85)', fontSize: '0.9em' }}>
              Atletas profissionais · 14 categorias · 07 a 13 de Setembro de 2026
            </span>
          </p>

          {/* Countdown */}
          {eventoInfo && <CountdownBanner dataInicio={eventoInfo.dataInicio} nomeEvento={eventoInfo.nomeEvento} />}

          {/* CTAs */}
          <div className="hero-ctas" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/inscricao')}
              style={{
                background: 'linear-gradient(135deg, #FF6B2C, #FF9B72)',
                color: '#12283F', border: 'none', borderRadius: 14,
                padding: '18px 44px', fontSize: '1.05rem', fontWeight: 900,
                cursor: 'pointer', boxShadow: '0 8px 28px rgba(255,107,44,0.5)',
                letterSpacing: '0.04em', transition: 'transform .15s, box-shadow .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(255,107,44,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 28px rgba(255,107,44,0.5)' }}
            >
              🎾 Inscreva-se Agora
            </button>
            <button
              onClick={() => navigate('/ranking')}
              style={{
                background: 'transparent', color: '#FFF4EC',
                border: '2px solid rgba(255,107,44,0.45)', borderRadius: 14,
                padding: '18px 44px', fontSize: '1.05rem', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.04em', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,44,0.1)'; e.currentTarget.style.borderColor = '#FF6B2C'; e.currentTarget.style.color = '#FF6B2C' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,107,44,0.45)'; e.currentTarget.style.color = '#FFF4EC' }}
            >
              🏆 Ver Ranking
            </button>
            <button
              onClick={() => navigate('/chaves')}
              style={{
                background: 'transparent', color: '#FF9B72',
                border: '2px solid rgba(255,107,44,0.3)', borderRadius: 14,
                padding: '18px 44px', fontSize: '1.05rem', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.04em', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,44,0.08)'; e.currentTarget.style.borderColor = '#FF9B72' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)' }}
            >
              🎯 Ver Chaves
            </button>
          </div>

          {/* Mini trust badges */}
          <div style={{
            marginTop: 48, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 20,
            paddingTop: 36, borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {[
              { icon: '🌎', label: '#1 Centro-Oeste' },
              { icon: '🎾', label: '250+ Atletas' },
              { icon: '💰', label: 'R$ 250k+ em Prêmios' },
              { icon: '⭐', label: 'Atletas Profissionais' },
              { icon: '📅', label: '4ª Edição Consecutiva' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: '1rem' }}>{b.icon}</span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,244,236,0.7)', fontWeight: 700 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom wave */}
        <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }} viewBox="0 0 1440 70" preserveAspectRatio="none">
          <path d="M0,70 C360,10 1080,65 1440,25 L1440,70 Z" fill="#FFF4EC" />
        </svg>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          LIVE STATS BAR
      ══════════════════════════════════════════════════════════════════════ */}
      {(totalInscritos !== null && totalInscritos > 0) && (
        <LiveStatsBar
          totalInscritos={totalInscritos}
          totalCategorias={categorias.length || null}
          diasRestantes={diasRestantes}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INFO CARDS
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <section style={{ maxWidth: 1040, margin: '0 auto', padding: '60px 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {infoCards.map((c, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 22, padding: '30px 24px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
                border: i === 3 ? '2px solid rgba(255,107,44,0.3)' : '1px solid rgba(255,107,44,0.1)',
                textAlign: 'center', transition: 'transform .2s, box-shadow .2s',
                position: 'relative',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = i === 3 ? '0 12px 36px rgba(255,107,44,0.22)' : '0 10px 32px rgba(255,107,44,0.14)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.07)' }}
              >
                {i === 3 && (
                  <div style={{
                    position: 'absolute', top: -1, left: -1, right: -1, height: 4,
                    background: 'linear-gradient(90deg, #FF6B2C, #f0d080, #FF6B2C)',
                    borderRadius: '22px 22px 0 0',
                  }} />
                )}
                <div style={{ fontSize: '2.6rem', marginBottom: 10 }}>{c.icon}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: i === 3 ? '#FF6B2C' : '#FF6B2C', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                <div style={{
                  fontSize: i === 3 ? 'clamp(1.3rem, 3vw, 1.7rem)' : '1.05rem',
                  fontWeight: 900, color: i === 3 ? '#FF6B2C' : '#12283F', lineHeight: 1.2,
                  textShadow: i === 3 ? '0 2px 12px rgba(255,107,44,0.3)' : 'none',
                }}>
                  {c.value}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#5A6570', marginTop: 5 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          MAGNITUDE — NÚMEROS ÉPICOS
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <MagnitudeSection />
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          ATLETAS PRO
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <AtletasProSection ranking={ranking} />
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          PRIZE BREAKDOWN
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <PrizeBreakdown />
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          TIMELINE
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <TimelineEvento
          dataInicio={eventoInfo?.dataInicio}
          dataFim={eventoInfo?.dataFim}
        />
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          CATEGORIAS
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <section style={{ background: 'linear-gradient(180deg,#FFF9F5 0%,#FFF4EC 100%)', padding: '64px 24px' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <SectionLabel text="Participe" color="#FF6B2C" />
              <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#12283F', margin: '0 0 8px' }}>🎾 Categorias Disponíveis</h2>
              <p style={{ color: '#5A6570', margin: 0 }}>Escolha sua categoria e garanta sua vaga</p>
            </div>

            {categorias.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {categorias.slice(0, 12).map((cat, i) => {
                  const precoFmt = cat.preco ? `R$ ${Number(cat.preco).toFixed(0)}` : 'Sob consulta'
                  const icons = ['🎾','🎾','👩','👥','💑','🏆','🏅','⭐','🎯','🔥','💪','🌟']
                  return (
                    <RevealSection key={cat.id ?? i} delay={i * 40}>
                      <div style={{
                        background: '#fff', borderRadius: 18, padding: '22px 20px',
                        boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
                        border: '1px solid rgba(255,107,44,0.12)',
                        cursor: 'pointer', transition: 'transform .15s, box-shadow .15s, border-color .15s',
                      }}
                        onClick={() => navigate('/inscricao')}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,107,44,0.18)'; e.currentTarget.style.borderColor = '#FF6B2C' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 14px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,107,44,0.12)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                            background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                          }}>{icons[i % icons.length]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: '#12283F', fontSize: '0.9rem', lineHeight: 1.3 }}>{cat.nome}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FF6B2C' }}>{precoFmt}</div>
                              {cat.inscritos > 0 && (
                                <div style={{
                                  fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                  background: cat.vagas && cat.inscritos >= cat.vagas ? '#e0555522' : '#FF6B2C18',
                                  color: cat.vagas && cat.inscritos >= cat.vagas ? '#e05555' : '#3a7a1e',
                                  border: `1px solid ${cat.vagas && cat.inscritos >= cat.vagas ? '#e0555544' : '#FF6B2C40'}`,
                                }}>
                                  {cat.vagas ? `${cat.inscritos}/${cat.vagas} vagas` : `${cat.inscritos} inscrito${cat.inscritos !== 1 ? 's' : ''}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </RevealSection>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎾</div>
                <div style={{ color: '#5A6570', fontSize: '1rem', marginBottom: 8 }}>
                  <strong style={{ color: '#12283F' }}>14 categorias disponíveis</strong>
                </div>
                <div style={{ color: '#5A6570', fontSize: '0.9rem' }}>
                  Masc PRO · 1ª a 5ª Classe · Veteranos · Feminino · Duplas
                </div>
              </div>
            )}

            <RevealSection delay={200}>
              <div style={{ textAlign: 'center', marginTop: 36 }}>
                <button onClick={() => navigate('/inscricao')} style={{
                  background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)', color: '#12283F',
                  border: 'none', borderRadius: 12, padding: '15px 36px',
                  fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255,107,44,0.3)', transition: 'transform .15s, box-shadow .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,107,44,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,107,44,0.3)' }}
                >
                  Inscreva-se agora →
                </button>
              </div>
            </RevealSection>
          </div>
        </section>
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          CAMPEÕES
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <CampeoesSection campeoes={campeoes} />
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          TOP 3 RANKING (podium)
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <SectionLabel text="Ranking Atual" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#12283F', margin: '0 0 8px' }}>🏅 Pódio do Ranking</h2>
            <p style={{ color: '#5A6570', margin: 0 }}>Os melhores classificados do ranking atual</p>
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
                      background: '#fff', borderRadius: 22,
                      padding: pi === 0 ? '36px 28px' : '28px 22px',
                      textAlign: 'center',
                      boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 0 2px ${mc.border}40`,
                      position: 'relative', overflow: 'hidden',
                      marginBottom: pi === 0 ? 0 : 24,
                      transition: 'transform .2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-6px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = ''}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: mc.bg }} />
                      <div style={{ fontSize: pi === 0 ? '3.8rem' : '3rem', marginBottom: 8 }}>{medals[pi]}</div>
                      <div style={{ display: 'inline-block', background: mc.bg, color: mc.text, borderRadius: 999, padding: '3px 16px', fontSize: '0.72rem', fontWeight: 800, marginBottom: 10 }}>
                        {pi + 1}º Lugar
                      </div>
                      <div style={{ fontWeight: 800, fontSize: pi === 0 ? '1.2rem' : '1rem', color: '#12283F', marginBottom: 6 }}>{p.nome}</div>
                      <div style={{ fontSize: pi === 0 ? '2rem' : '1.65rem', fontWeight: 900, color: '#FF6B2C' }}>
                        {p.pontos?.toLocaleString('pt-BR') ?? '—'}
                        <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 500, marginLeft: 4 }}>pts</span>
                      </div>
                      {(p.vitorias != null || p.derrotas != null) && (
                        <div style={{ marginTop: 8, fontSize: '0.82rem' }}>
                          <span style={{ color: '#FF6B2C', fontWeight: 700 }}>{p.vitorias ?? 0}V</span>
                          <span style={{ color: '#ccc', margin: '0 4px' }}>–</span>
                          <span style={{ color: '#e05555', fontWeight: 700 }}>{p.derrotas ?? 0}D</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ textAlign: 'center' }}>
                <Link to="/ranking" style={{ color: '#FF6B2C', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem', borderBottom: '2px solid #FF9B72', paddingBottom: 2 }}>
                  Ver ranking completo →
                </Link>
              </div>
            </>
          )}
        </section>
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          NOTÍCIAS
      ══════════════════════════════════════════════════════════════════════ */}
      {(noticiasLoading || noticias.length > 0) && (
        <RevealSection>
          <section style={{ background: 'linear-gradient(180deg,#FFF4EC 0%,#FFF9F5 100%)', padding: '60px 24px' }}>
            <div style={{ maxWidth: 1040, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <SectionLabel text="Novidades" color="#FF6B2C" />
                <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#12283F', margin: '0 0 8px' }}>📰 Últimas Notícias</h2>
                <p style={{ color: '#5A6570', margin: 0 }}>Fique por dentro de tudo sobre o torneio</p>
              </div>
              {noticiasLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '22px 20px', height: 160 }}>
                      <div style={{ background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)', backgroundSize: '200% 100%', animation: 'shimmerLight 1.5s infinite', borderRadius: 999, height: 20, width: '40%', marginBottom: 10 }} />
                      <div style={{ background: 'linear-gradient(90deg,#e8f0e8 25%,#d4e8d4 50%,#e8f0e8 75%)', backgroundSize: '200% 100%', animation: 'shimmerLight 1.5s infinite', borderRadius: 6, height: 14, width: '85%' }} />
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

      {/* ══════════════════════════════════════════════════════════════════════
          GALERIA
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <section style={{ maxWidth: 1060, margin: '0 auto', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <SectionLabel text="Momentos" color="#FF6B2C" />
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#12283F', margin: '0 0 8px' }}>📸 Galeria</h2>
            <p style={{ color: '#5A6570', margin: 0 }}>Reviva os momentos épicos das edições anteriores</p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
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
                background: '#12283F',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.13)' }}
              >
                <img
                  src={item.img} alt={item.label} loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(7,26,15,.85) 0%, transparent 100%)',
                  padding: '28px 16px 14px',
                }}>
                  <div style={{ color: '#FFF4EC', fontSize: '0.82rem', fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: '#FF9B72', fontSize: '0.66rem', marginTop: 2, opacity: 0.8 }}>{item.credit}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          PATROCINADORES
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <section style={{
          background: 'linear-gradient(135deg,#FF6B2C 0%,#e8c96c 50%,#FF6B2C 100%)',
          padding: '56px 24px',
        }}>
          <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7a5a10', marginBottom: 28 }}>
              Patrocínio & Realização
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {PATROCINADORES.map((p, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.88)', borderRadius: 18,
                  padding: '20px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 180,
                  transition: 'transform .15s, box-shadow .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                >
                  <span style={{ fontSize: '2.2rem' }}>{p.icon}</span>
                  <span style={{ fontWeight: 800, color: p.cor, fontSize: '0.92rem' }}>{p.nome}</span>
                  <span style={{ fontSize: '0.65rem', color: '#7a6a40', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA FINAL — ÉPICO
      ══════════════════════════════════════════════════════════════════════ */}
      <RevealSection>
        <section style={{
          background: 'linear-gradient(160deg, #0A1B2B 0%, #0D2235 30%, #12283F 70%, #102B43 100%)',
          padding: '96px 24px', textAlign: 'center', color: '#FFF4EC',
          position: 'relative', overflow: 'hidden',
        }}>
          <TennisBall style={{ top: '8%', left: '4%', fontSize: '7rem' }} />
          <TennisBall style={{ bottom: '8%', right: '4%', fontSize: '9rem' }} />
          <TennisBall style={{ top: '50%', right: '18%', fontSize: '5rem', transform: 'rotate(30deg)' }} />

          {/* Radial glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(255,107,44,0.07) 0%, transparent 65%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
            {/* Prize callout */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,107,44,0.12)', border: '1.5px solid rgba(255,107,44,0.35)',
              borderRadius: 999, padding: '10px 28px', marginBottom: 28,
              animation: 'pulseGold 2.5s ease-in-out infinite',
            }}>
              <span style={{ fontSize: '1.4rem' }}>💰</span>
              <span style={{ fontWeight: 900, color: '#FF6B2C', fontSize: 'clamp(1rem, 3vw, 1.4rem)', letterSpacing: '-0.01em' }}>
                R$ 250.000+ em Premiação
              </span>
            </div>

            <h2 style={{
              fontSize: 'clamp(2rem, 6vw, 3.6rem)', fontWeight: 900,
              margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.1,
            }}>
              Pronto para disputar<br />
              <span style={{
                background: 'linear-gradient(90deg, #FF6B2C, #FF9B72)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                o maior torneio?
              </span>
            </h2>

            <p style={{ color: 'rgba(255,244,236,0.75)', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', lineHeight: 1.7, margin: '0 0 44px' }}>
              Garanta sua vaga na <strong style={{ color: '#FF9B72' }}>4ª Agro Open de Tênis</strong> —
              o maior torneio de tênis do Centro-Oeste do Brasil.<br />
              <strong style={{ color: '#FF6B2C' }}>Mais de R$ 250.000 em premiação</strong> distribuídos entre 14 categorias.
              Atletas profissionais e amadores de todo o Brasil. Vagas limitadas.
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
              <button
                onClick={() => navigate('/inscricao')}
                style={{
                  background: 'linear-gradient(135deg,#FF6B2C,#FF9B72)', color: '#12283F',
                  border: 'none', borderRadius: 16, padding: '20px 60px',
                  fontSize: '1.15rem', fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 8px 32px rgba(255,107,44,0.45)',
                  letterSpacing: '0.04em', transition: 'transform .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 14px 44px rgba(255,107,44,0.55)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,107,44,0.45)' }}
              >
                🎾 Fazer Minha Inscrição
              </button>
              <button
                onClick={() => navigate('/regulamento')}
                style={{
                  background: 'transparent', color: 'rgba(255,244,236,0.8)',
                  border: '1.5px solid rgba(255,244,236,0.2)', borderRadius: 16,
                  padding: '20px 40px', fontSize: '1rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,244,236,0.4)'; e.currentTarget.style.color = '#FFF4EC' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,244,236,0.2)'; e.currentTarget.style.color = 'rgba(255,244,236,0.8)' }}
              >
                📜 Ver Regulamento
              </button>
            </div>

            {/* Bottom info strip */}
            <div style={{
              display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
              paddingTop: 32, borderTop: '1px solid rgba(244,246,239,0.08)',
            }}>
              {[
                { icon: '📅', label: 'Datas', value: '07–13 Set 2026' },
                { icon: '🏟️', label: 'Local', value: 'Tangará Tênis Clube' },
                { icon: '🌎', label: 'Centro-Oeste', value: '#1 Torneio' },
                { icon: '🏢', label: 'Realização', value: 'UISA' },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: '0.65rem', color: '#FF9B72', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontWeight: 700, color: '#FFF4EC', marginTop: 3, fontSize: '0.88rem' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* WhatsApp FAB */}
      <WhatsAppFAB />
    </div>
  )
}
