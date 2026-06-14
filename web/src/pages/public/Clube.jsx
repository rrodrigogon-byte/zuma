import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

/* ─── Paleta ──────────────────────────────────────────────────────────────── */
const C = {
  deep:    '#071A0E',
  forest:  '#0E2E1C',
  green:   '#1B4D2E',
  lime:    '#4CAF50',
  accent:  '#8FD64A',
  gold:    '#C9A656',
  goldL:   '#E8C87A',
  cream:   '#F4F6EF',
  muted:   '#6a8a6a',
  white:   '#ffffff',
  glass:   'rgba(255,255,255,0.06)',
  glassB:  'rgba(255,255,255,0.12)',
  dark:    'rgba(0,0,0,0.4)',
}

/* ─── CSS Global ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes float {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    33%      { transform: translateY(-12px) rotate(1deg); }
    66%      { transform: translateY(-6px) rotate(-1deg); }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .7; transform: scale(0.97); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes gradShift {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  @keyframes rotateSlow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes counterUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cardFlip {
    0%   { transform: perspective(800px) rotateY(0deg); }
    100% { transform: perspective(800px) rotateY(360deg); }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(143,214,74,0.3); }
    50%      { box-shadow: 0 0 50px rgba(143,214,74,0.7), 0 0 80px rgba(143,214,74,0.3); }
  }
  @keyframes scanLine {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  @keyframes borderGlow {
    0%,100% { border-color: rgba(143,214,74,0.3); }
    50%      { border-color: rgba(143,214,74,0.9); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-50px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(50px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes zoomBg {
    from { transform: scale(1.08); }
    to   { transform: scale(1); }
  }
  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .ttc-fade-up    { animation: fadeUp .8s ease both; }
  .ttc-fade-in    { animation: fadeIn .6s ease both; }
  .ttc-scale-in   { animation: scaleIn .6s ease both; }
  .ttc-float      { animation: float 5s ease-in-out infinite; }
  .ttc-pulse      { animation: pulse 2.5s ease-in-out infinite; }

  .ttc-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    transition: all .4s ease;
  }
  .ttc-nav.scrolled {
    background: rgba(7,26,14,0.97);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(143,214,74,0.15);
    box-shadow: 0 4px 30px rgba(0,0,0,0.5);
  }
  .ttc-nav-link {
    position: relative; color: rgba(255,255,255,0.8);
    font-size: 13px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; text-decoration: none;
    padding: 6px 0; transition: color .3s;
  }
  .ttc-nav-link::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px; background: #8FD64A;
    transform: scaleX(0); transform-origin: center;
    transition: transform .3s ease;
  }
  .ttc-nav-link:hover, .ttc-nav-link.active { color: #8FD64A; }
  .ttc-nav-link:hover::after, .ttc-nav-link.active::after { transform: scaleX(1); }

  .ttc-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #8FD64A, #4CAF50);
    color: #071A0E; font-weight: 700; font-size: 14px;
    letter-spacing: .05em; text-transform: uppercase;
    padding: 14px 32px; border-radius: 50px;
    border: none; cursor: pointer; text-decoration: none;
    transition: all .3s ease;
    box-shadow: 0 4px 20px rgba(143,214,74,0.4);
  }
  .ttc-btn-primary:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(143,214,74,0.6);
    background: linear-gradient(135deg, #9FE65A, #5DBF60);
  }
  .ttc-btn-outline {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent;
    color: #fff; font-weight: 600; font-size: 14px;
    letter-spacing: .05em; text-transform: uppercase;
    padding: 13px 32px; border-radius: 50px;
    border: 2px solid rgba(255,255,255,0.4); cursor: pointer; text-decoration: none;
    transition: all .3s ease;
  }
  .ttc-btn-outline:hover {
    border-color: #8FD64A; color: #8FD64A;
    transform: translateY(-2px);
  }
  .ttc-btn-gold {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #C9A656, #E8C87A);
    color: #071A0E; font-weight: 700; font-size: 14px;
    letter-spacing: .05em; text-transform: uppercase;
    padding: 14px 32px; border-radius: 50px;
    border: none; cursor: pointer; text-decoration: none;
    transition: all .3s ease;
    box-shadow: 0 4px 20px rgba(201,166,86,0.4);
  }
  .ttc-btn-gold:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(201,166,86,0.6);
  }

  .ttc-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    backdrop-filter: blur(12px);
    transition: all .4s ease;
  }
  .ttc-card:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(143,214,74,0.3);
    transform: translateY(-6px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
  }

  .ticker-wrap {
    overflow: hidden; width: 100%;
    background: linear-gradient(90deg, #8FD64A, #4CAF50, #C9A656, #8FD64A);
    padding: 10px 0;
  }
  .ticker-inner {
    display: flex; gap: 0;
    animation: ticker 30s linear infinite;
    width: max-content;
  }
  .ticker-item {
    white-space: nowrap; padding: 0 40px;
    font-size: 13px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #071A0E;
  }

  .gallery-item { overflow: hidden; border-radius: 16px; cursor: pointer; }
  .gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .6s ease; display: block; }
  .gallery-item:hover img { transform: scale(1.08); }

  .modal-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fadeIn .3s ease;
  }

  .carteirinha-card {
    background: linear-gradient(135deg, #071A0E 0%, #0E2E1C 50%, #1B4D2E 100%);
    border: 2px solid rgba(143,214,74,0.4);
    border-radius: 24px;
    padding: 32px;
    position: relative;
    overflow: hidden;
    animation: glowPulse 3s ease-in-out infinite;
    max-width: 420px; width: 100%;
  }
  .carteirinha-card::before {
    content: ''; position: absolute; top: -50%; right: -30%;
    width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, rgba(143,214,74,0.12), transparent 70%);
    pointer-events: none;
  }
  .carteirinha-card::after {
    content: ''; position: absolute; inset: 0;
    border-radius: 24px;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(143,214,74,0.02) 2px, rgba(143,214,74,0.02) 4px
    );
    pointer-events: none;
  }
  .qr-container {
    background: #fff;
    border-radius: 12px;
    padding: 12px;
    display: inline-flex;
    animation: glowPulse 2s ease-in-out infinite;
  }
  .qr-scan-line {
    position: absolute; left: 12px; right: 12px; height: 2px;
    background: linear-gradient(90deg, transparent, #8FD64A, transparent);
    animation: scanLine 2s linear infinite;
    border-radius: 2px;
  }

  .visitor-widget {
    display: inline-flex; align-items: center; gap: 12px;
    background: rgba(143,214,74,0.1);
    border: 1px solid rgba(143,214,74,0.3);
    border-radius: 50px;
    padding: 10px 24px;
    backdrop-filter: blur(10px);
    transition: all .3s;
  }
  .visitor-widget:hover {
    background: rgba(143,214,74,0.18);
    border-color: rgba(143,214,74,0.6);
  }

  .estrutura-tab {
    padding: 10px 24px; border-radius: 50px;
    font-size: 13px; font-weight: 600; letter-spacing: .04em;
    cursor: pointer; transition: all .3s; border: 1.5px solid transparent;
    white-space: nowrap;
  }
  .estrutura-tab.active {
    background: linear-gradient(135deg, #8FD64A, #4CAF50);
    color: #071A0E; border-color: transparent;
    box-shadow: 0 4px 16px rgba(143,214,74,0.4);
  }
  .estrutura-tab:not(.active) {
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.1);
  }
  .estrutura-tab:not(.active):hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(143,214,74,0.3);
    color: #8FD64A;
  }

  .plano-card {
    border-radius: 24px; padding: 36px 28px;
    border: 1.5px solid rgba(255,255,255,0.1);
    position: relative; overflow: hidden;
    transition: all .4s ease;
  }
  .plano-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
  }
  .plano-card.destaque {
    border-color: rgba(143,214,74,0.5);
    box-shadow: 0 0 40px rgba(143,214,74,0.15);
  }

  .section-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(143,214,74,0.12);
    border: 1px solid rgba(143,214,74,0.3);
    color: #8FD64A; font-size: 12px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase;
    padding: 6px 18px; border-radius: 50px;
    margin-bottom: 20px;
  }

  .stat-number {
    font-family: 'Playfair Display', serif;
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, #8FD64A, #C9A656);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .divider-gold {
    height: 3px; width: 60px;
    background: linear-gradient(90deg, #C9A656, #8FD64A);
    border-radius: 2px;
    margin: 16px auto;
  }

  @media (max-width: 768px) {
    .ttc-nav-desktop { display: none !important; }
    .ttc-mobile-menu { display: flex !important; }
  }
  @media (min-width: 769px) {
    .ttc-mobile-menu { display: none !important; }
  }

  html { scroll-behavior: smooth; }
  body { overflow-x: hidden; }

  .section-transition {
    opacity: 0; transform: translateY(40px);
    transition: opacity .8s ease, transform .8s ease;
  }
  .section-transition.visible {
    opacity: 1; transform: translateY(0);
  }
`

/* ─── Hooks ──────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start || !target) return
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, start])
  return count
}

/* ─── Dados ──────────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'quem-somos',  label: 'O Clube' },
  { id: 'estrutura',   label: 'Estrutura' },
  { id: 'eventos',     label: 'Eventos' },
  { id: 'carteirinha', label: '🪪 Carteirinha' },
  { id: 'seja-socio',  label: 'Seja Sócio' },
  { id: 'contato',     label: 'Contato' },
]

const STATS = [
  { value: 30,   suffix: '+',  label: 'Anos de história',      icon: '🏛️' },
  { value: 5000, suffix: '+',  label: 'Famílias associadas',    icon: '👨‍👩‍👧‍👦' },
  { value: 6,    suffix: '',   label: 'Modalidades esportivas', icon: '🎾' },
  { value: 4,    suffix: 'ª',  label: 'Edição Agro Open',       icon: '🏆' },
]

const MODALIDADES = [
  { nome: 'Tênis',        icon: '🎾', cor: '#8FD64A', desc: '8 quadras de saibro, academia e torneios nacionais', itens: ['8 quadras saibro', 'Academia profissional', 'Ranking TTC', 'Torneios nacionais'] },
  { nome: 'Natação',      icon: '🏊', cor: '#4FC3F7', desc: 'Piscina olímpica aquecida com treinos para todas as idades', itens: ['Piscina olímpica', 'Água aquecida', 'Escolinha kids', 'Treinos adultos'] },
  { nome: 'Padel',        icon: '🏸', cor: '#FFB74D', desc: 'Quadras de padel com iluminação LED e piso profissional', itens: ['4 quadras padel', 'Iluminação LED', 'Aulas coletivas', 'Torneios mensais'] },
  { nome: 'Futebol',      icon: '⚽', cor: '#EF5350', desc: 'Campo sintético com vestiários e arquibancada coberta', itens: ['Campo sintético', 'Vestiários', 'Arquibancada', 'Escolinha futsal'] },
  { nome: 'Musculação',   icon: '💪', cor: '#AB47BC', desc: 'Academia moderna com equipamentos de última geração', itens: ['400m² equipados', 'Personal trainer', 'Avaliação física', 'Horários flexíveis'] },
  { nome: 'Espaço Social',icon: '🥂', cor: '#C9A656', desc: 'Restaurante, bar, salões para eventos e área gourmet', itens: ['Restaurante', 'Bar & lounge', 'Salão de festas', 'Espaço gourmet'] },
]

const EVENTOS = [
  {
    titulo: '4ª Agro Open de Tênis',
    data: '2026',
    desc: 'O maior torneio de tênis do Centro-Oeste. R$ 250.000+ em premiação, 250+ atletas profissionais e amadores de todo o Brasil.',
    tags: ['14 categorias', 'R$ 250.000+', 'Inscrições abertas'],
    cor: '#8FD64A',
    icon: '🏆',
    destaque: true,
  },
  {
    titulo: 'Campeonato Interno de Tênis',
    data: 'Julho/2026',
    desc: 'Torneio exclusivo para sócios. Todas as categorias com troféus, premiação especial e confraternização após as partidas.',
    tags: ['Sócios', 'Todas as idades', 'Troféus'],
    cor: '#4FC3F7',
    icon: '🎾',
  },
  {
    titulo: 'Copa Família TTC',
    data: 'Agosto/2026',
    desc: 'Torneio de duplas para famílias. Uma tarde de esporte, alegria e integração entre as famílias do clube.',
    tags: ['Duplas', 'Família', 'Diversão'],
    cor: '#FFB74D',
    icon: '👨‍👩‍👧‍👦',
  },
  {
    titulo: 'Grand Prix de Padel',
    data: 'Setembro/2026',
    desc: 'Torneio de padel com transmissão ao vivo. Categorias A, B e C com premiação para os finalistas.',
    tags: ['Padel', 'Ao vivo', 'R$ 5.000'],
    cor: '#AB47BC',
    icon: '🏸',
  },
]

const PLANOS = [
  {
    nome: 'Individual',
    preco: 'R$ 189',
    periodo: '/mês',
    cor: 'linear-gradient(135deg, #1B4D2E, #0E2E1C)',
    itens: ['1 pessoa', 'Acesso às quadras', 'Natação', 'Academia', 'Área social'],
    destaque: false,
  },
  {
    nome: 'Familiar',
    preco: 'R$ 349',
    periodo: '/mês',
    cor: 'linear-gradient(135deg, #1a4a1a, #0d3b0d)',
    destaque: true,
    badge: '⭐ Mais popular',
    itens: ['Até 4 pessoas', 'Todos os benefícios', 'Eventos exclusivos', 'Prioridade inscrição', 'App Sócio'],
  },
  {
    nome: 'VIP',
    preco: 'R$ 699',
    periodo: '/mês',
    cor: 'linear-gradient(135deg, #2a2000, #1a1400)',
    border: '1.5px solid rgba(201,166,86,0.5)',
    itens: ['Família + hóspedes', 'Camarote torneios', 'Personal trainer', 'Nutricionista', 'Eventos premium', 'Transfer incluso'],
    destaque: false,
    vip: true,
  },
]

const FOTOS = Array.from({ length: 12 }, (_, i) => `/ttc/galeria/foto${i + 1}.jpg`)

const GALERIA_TAGS = ['Todos', 'Tênis', 'Eventos', 'Estrutura', 'Social']

/* ─── Componentes ────────────────────────────────────────────────────────── */

function AnimSection({ children, delay = 0, style = {} }) {
  const [ref, visible] = useInView(0.12)
  return (
    <div
      ref={ref}
      className="section-transition"
      style={{
        ...style,
        ...(visible ? { opacity: 1, transform: 'translateY(0)', transitionDelay: `${delay}ms` } : {}),
      }}
    >
      {children}
    </div>
  )
}

/* ── Ticker ── */
function Ticker() {
  const items = ['🏆 4ª Agro Open de Tênis', '💰 R$ 250.000+ em Premiação', '🎾 250+ Atletas Profissionais', '🏛️ 30+ Anos de Tradição', '👨‍👩‍👧‍👦 5.000+ Famílias Associadas', '⭐ O Maior Clube do Centro-Oeste']
  const doubled = [...items, ...items]
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {doubled.map((t, i) => (
          <span key={i} className="ticker-item">{t} &nbsp;&nbsp;•&nbsp;&nbsp;</span>
        ))}
      </div>
    </div>
  )
}

/* ── StickyNav ── */
function StickyNav({ activeSection, onNav }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`ttc-nav${scrolled ? ' scrolled' : ''}`}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #8FD64A, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#071A0E', boxShadow: '0 4px 16px rgba(143,214,74,0.4)' }}>TTC</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '.04em', lineHeight: 1.2 }}>Tênis & Touring</div>
            <div style={{ color: '#8FD64A', fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase' }}>Clube</div>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="ttc-nav-desktop" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {NAV_ITEMS.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`ttc-nav-link${activeSection === item.id ? ' active' : ''}`}
              onClick={e => { e.preventDefault(); onNav(item.id) }}
            >{item.label}</a>
          ))}
        </div>

        {/* CTA + Mobile toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="#seja-socio" className="ttc-btn-primary" style={{ padding: '10px 22px', fontSize: 13 }}>
            Seja Sócio
          </a>
          <button
            className="ttc-mobile-menu"
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: 4 }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: 'rgba(7,26,14,0.98)', borderTop: '1px solid rgba(143,214,74,0.15)', padding: '16px 24px 24px' }}>
          {NAV_ITEMS.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{ display: 'block', color: 'rgba(255,255,255,0.85)', padding: '12px 0', fontSize: 15, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', transition: 'color .2s' }}
              onClick={e => { e.preventDefault(); onNav(item.id); setMenuOpen(false) }}
            >{item.label}</a>
          ))}
        </div>
      )}
    </nav>
  )
}

/* ── Hero ── */
function Hero({ visitantes, onNavCarteirinha }) {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <section style={{ position: 'relative', height: '100vh', minHeight: 680, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* BG */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 70% 40%, rgba(143,214,74,0.15) 0%, transparent 60%),
          radial-gradient(ellipse at 20% 80%, rgba(201,166,86,0.1) 0%, transparent 50%),
          linear-gradient(160deg, #071A0E 0%, #0E2E1C 40%, #071A0E 100%)
        `,
        transform: `translateY(${scrollY * 0.3}px)`,
        animation: 'zoomBg 1.5s ease both',
      }} />

      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: '15%', right: '8%', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(143,214,74,0.12)', animation: 'float 7s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '25%', right: '12%', width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(143,214,74,0.18)', animation: 'float 5s ease-in-out infinite reverse', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', left: '5%', width: 180, height: 180, borderRadius: '50%', border: '1px solid rgba(201,166,86,0.15)', animation: 'float 6s ease-in-out infinite 1s', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, borderRadius: '50%', border: '1px solid rgba(143,214,74,0.04)', transform: 'translate(-50%,-50%)', animation: 'rotateSlow 40s linear infinite', pointerEvents: 'none' }} />

      {/* Tennis ball deco */}
      <div className="ttc-float" style={{ position: 'absolute', top: '18%', right: '18%', fontSize: 64, opacity: .18, pointerEvents: 'none' }}>🎾</div>
      <div className="ttc-float" style={{ position: 'absolute', bottom: '25%', left: '12%', fontSize: 40, opacity: .12, pointerEvents: 'none', animationDelay: '2s' }}>🏆</div>
      <div className="ttc-float" style={{ position: 'absolute', top: '60%', right: '6%', fontSize: 32, opacity: .10, pointerEvents: 'none', animationDelay: '1s' }}>⭐</div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 24px', maxWidth: 900, margin: '0 auto' }}>
        <AnimSection>
          <div className="section-badge" style={{ marginBottom: 24 }}>
            <span>🏛️</span> Fundado em 1994 · Cuiabá, MT
          </div>
        </AnimSection>

        <AnimSection delay={100}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(44px, 7vw, 88px)',
            fontWeight: 900,
            lineHeight: 1.05,
            color: '#fff',
            marginBottom: 8,
            letterSpacing: '-.02em',
          }}>
            Tênis &amp; Touring
          </h1>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(22px, 4vw, 44px)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #8FD64A 30%, #C9A656 70%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 28,
            letterSpacing: '-.01em',
          }}>
            O Melhor Clube do Centro-Oeste
          </h2>
        </AnimSection>

        <AnimSection delay={200}>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 'clamp(16px, 2.5vw, 20px)', lineHeight: 1.7, maxWidth: 640, margin: '0 auto 40px', fontFamily: 'Inter, sans-serif', fontWeight: 300 }}>
            Mais de 30 anos unindo famílias em torno do esporte, lazer e convivência. 
            Casa da 4ª Agro Open de Tênis — <strong style={{ color: '#8FD64A' }}>R$ 250.000+</strong> em premiação.
          </p>
        </AnimSection>

        <AnimSection delay={300}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <a href="#seja-socio" className="ttc-btn-primary" style={{ fontSize: 15, padding: '16px 36px' }}>
              🏅 Torne-se Sócio
            </a>
            <a href="#eventos" className="ttc-btn-outline" style={{ fontSize: 15, padding: '16px 36px' }}>
              🏆 Agro Open 2026
            </a>
            <button onClick={onNavCarteirinha} className="ttc-btn-gold" style={{ fontSize: 15, padding: '16px 36px' }}>
              🪪 Minha Carteirinha
            </button>
          </div>
        </AnimSection>

        {/* Visitor counter */}
        {visitantes !== null && (
          <AnimSection delay={400}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="visitor-widget">
                <span style={{ fontSize: 18 }}>👁️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#8FD64A', fontSize: 22, fontWeight: 800, lineHeight: 1, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
                    {visitantes.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    visitantes
                  </div>
                </div>
              </div>
            </div>
          </AnimSection>
        )}
      </div>

      {/* Scroll indicator */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }} className="ttc-pulse">
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>role para baixo</div>
        <div style={{ width: 24, height: 40, borderRadius: 12, border: '2px solid rgba(255,255,255,0.25)', margin: '0 auto', display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#8FD64A', animation: 'float 1.8s ease-in-out infinite' }} />
        </div>
      </div>
    </section>
  )
}

/* ── Stats ── */
function StatsSection() {
  const [ref, visible] = useInView(0.2)
  const c0 = useCounter(STATS[0].value, 1800, visible)
  const c1 = useCounter(STATS[1].value, 2200, visible)
  const c2 = useCounter(STATS[2].value, 1200, visible)
  const c3 = useCounter(STATS[3].value, 800, visible)
  const counts = [c0, c1, c2, c3]

  return (
    <div ref={ref} style={{ background: 'linear-gradient(90deg, #071A0E, #0E2E1C, #071A0E)', borderTop: '1px solid rgba(143,214,74,0.15)', borderBottom: '1px solid rgba(143,214,74,0.15)', padding: '60px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        {STATS.map((s, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '20px 16px', borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-number">
              {counts[i]}{s.suffix}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 8, fontFamily: 'Inter, sans-serif' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Quem Somos ── */
function QuemSomos() {
  const milestones = [
    { ano: '1994', titulo: 'Fundação', desc: 'Clube fundado com foco no tênis e lazer familiar' },
    { ano: '2005', titulo: 'Expansão', desc: 'Abertura das quadras de padel e piscina olímpica' },
    { ano: '2015', titulo: 'Modernização', desc: 'Reforma geral com academia de última geração' },
    { ano: '2023', titulo: 'Agro Open', desc: '1ª edição do maior torneio de tênis do Centro-Oeste' },
    { ano: '2026', titulo: '4ª Edição', desc: 'R$ 250.000+ em premiação, 250+ atletas profissionais' },
  ]

  return (
    <section id="quem-somos" style={{ background: C.deep, padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div className="section-badge">🏛️ Nossa história</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Tradição que une<br /><span style={{ color: '#8FD64A' }}>gerações</span>
            </h2>
            <div className="divider-gold" />
          </div>
        </AnimSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 60, alignItems: 'start' }}>
          {/* Left: text */}
          <AnimSection>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 17, lineHeight: 1.85, fontFamily: 'Inter, sans-serif', fontWeight: 300, marginBottom: 24 }}>
                O <strong style={{ color: '#8FD64A' }}>Tênis & Touring Clube</strong> é o maior e mais completo clube esportivo do Centro-Oeste brasileiro. Fundado em 1994, é referência em tênis, natação, padel e lazer familiar para milhares de cuiabanos.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.85, fontFamily: 'Inter, sans-serif', fontWeight: 300, marginBottom: 36 }}>
                Nossa missão é oferecer o melhor ambiente para o desenvolvimento esportivo e o convívio saudável entre famílias, com estrutura de alto padrão e eventos de nível nacional.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 36 }}>
                {[
                  { icon: '🏆', text: 'Maior torneio de tênis do Centro-Oeste' },
                  { icon: '👨‍👩‍👧‍👦', text: 'Espaço para toda a família' },
                  { icon: '⭐', text: 'Instrutores certificados' },
                  { icon: '🌱', text: 'Foco no desenvolvimento humano' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <a href="#seja-socio" className="ttc-btn-primary">Associe-se agora →</a>
            </div>
          </AnimSection>

          {/* Right: timeline */}
          <AnimSection delay={150}>
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, #8FD64A, #C9A656, rgba(255,255,255,0.1))' }} />
              {milestones.map((m, i) => (
                <div key={i} style={{ position: 'relative', paddingBottom: i < milestones.length - 1 ? 36 : 0, paddingLeft: 24 }}>
                  <div style={{ position: 'absolute', left: -22, top: 4, width: 14, height: 14, borderRadius: '50%', background: i === milestones.length - 1 ? '#C9A656' : '#8FD64A', border: '2px solid #071A0E', boxShadow: `0 0 10px ${i === milestones.length - 1 ? '#C9A656' : '#8FD64A'}` }} />
                  <div style={{ fontSize: 12, color: '#8FD64A', fontWeight: 700, letterSpacing: '.1em', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>{m.ano}</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>{m.titulo}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </AnimSection>
        </div>
      </div>
    </section>
  )
}

/* ── Estrutura ── */
function Estrutura() {
  const [tab, setTab] = useState(0)
  const mod = MODALIDADES[tab]

  return (
    <section id="estrutura" style={{ background: 'linear-gradient(160deg, #0A1F12, #071A0E)', padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="section-badge">🏗️ Infraestrutura</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Estrutura de <span style={{ color: '#8FD64A' }}>alto padrão</span>
            </h2>
            <div className="divider-gold" />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, fontFamily: 'Inter, sans-serif', marginTop: 20 }}>6 modalidades, infraestrutura completa para toda a família</p>
          </div>
        </AnimSection>

        {/* Tabs */}
        <AnimSection delay={100}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
            {MODALIDADES.map((m, i) => (
              <button key={i} className={`estrutura-tab${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>
                {m.icon} {m.nome}
              </button>
            ))}
          </div>
        </AnimSection>

        {/* Content */}
        <AnimSection>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${mod.cor}33`, borderRadius: 28, padding: 'clamp(28px, 4vw, 52px)', transition: 'all .4s', boxShadow: `0 20px 60px rgba(0,0,0,0.3)` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40, alignItems: 'center' }}>
              {/* Icon + text */}
              <div>
                <div style={{ fontSize: 80, marginBottom: 20, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))' }}>{mod.icon}</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 16 }}>{mod.nome}</h3>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.75, fontFamily: 'Inter, sans-serif', marginBottom: 28 }}>{mod.desc}</p>
                <a href="#seja-socio" className="ttc-btn-primary" style={{ background: `linear-gradient(135deg, ${mod.cor}, ${mod.cor}cc)` }}>
                  Conhecer →
                </a>
              </div>
              {/* Items */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {mod.itens.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(255,255,255,0.05)', borderRadius: 14, border: `1px solid ${mod.cor}22` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: mod.cor, flexShrink: 0, boxShadow: `0 0 8px ${mod.cor}` }} />
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimSection>
      </div>
    </section>
  )
}

/* ── Eventos ── */
function Eventos() {
  return (
    <section id="eventos" style={{ background: C.deep, padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div className="section-badge">📅 Agenda</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Eventos <span style={{ color: '#8FD64A' }}>imperdíveis</span>
            </h2>
            <div className="divider-gold" />
          </div>
        </AnimSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {EVENTOS.map((ev, i) => (
            <AnimSection key={i} delay={i * 80}>
              <div
                style={{
                  background: ev.destaque
                    ? `linear-gradient(135deg, #0E2E1C, #1B4D2E)`
                    : 'rgba(255,255,255,0.04)',
                  border: ev.destaque
                    ? '1.5px solid rgba(143,214,74,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 24, padding: 32, height: '100%',
                  position: 'relative', overflow: 'hidden',
                  transition: 'all .4s',
                  boxShadow: ev.destaque ? '0 20px 60px rgba(143,214,74,0.12)' : 'none',
                  cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = `0 30px 70px rgba(0,0,0,0.4)` }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ev.destaque ? '0 20px 60px rgba(143,214,74,0.12)' : 'none' }}
              >
                {ev.destaque && (
                  <div style={{ position: 'absolute', top: 18, right: 18, background: 'linear-gradient(135deg, #C9A656, #E8C87A)', color: '#071A0E', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', padding: '4px 12px', borderRadius: 50, textTransform: 'uppercase' }}>
                    DESTAQUE
                  </div>
                )}
                <div style={{ fontSize: 44, marginBottom: 16 }}>{ev.icon}</div>
                <div style={{ color: ev.cor, fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>{ev.data}</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 14, lineHeight: 1.3 }}>{ev.titulo}</h3>
                <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 1.7, fontFamily: 'Inter, sans-serif', marginBottom: 20 }}>{ev.desc}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ev.tags.map((tag, j) => (
                    <span key={j} style={{ background: `${ev.cor}1A`, border: `1px solid ${ev.cor}40`, color: ev.cor, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 50, letterSpacing: '.06em' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </AnimSection>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Galeria ── */
function Galeria() {
  const [filter, setFilter] = useState('Todos')
  const [lightbox, setLightbox] = useState(null)

  const visibleFotos = FOTOS.slice(0, 9)

  return (
    <section id="galeria" style={{ background: 'linear-gradient(160deg, #0A1F12, #071A0E)', padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="section-badge">📸 Galeria</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Momentos <span style={{ color: '#8FD64A' }}>inesquecíveis</span>
            </h2>
            <div className="divider-gold" />
          </div>
        </AnimSection>

        <AnimSection delay={100}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
            {GALERIA_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`estrutura-tab${filter === tag ? ' active' : ''}`}
              >{tag}</button>
            ))}
          </div>
        </AnimSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {visibleFotos.map((src, i) => (
            <AnimSection key={i} delay={i * 50}>
              <div
                className="gallery-item"
                onClick={() => setLightbox(src)}
                style={{ height: i % 3 === 1 ? 280 : 220, position: 'relative' }}
              >
                <img src={src} alt={`Foto ${i + 1}`} loading="lazy"
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'rgba(255,255,255,0.05)' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(7,26,14,0.7), transparent)', opacity: 0, transition: 'opacity .3s', borderRadius: 16, display: 'flex', alignItems: 'flex-end', padding: 16 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Ver foto ↗</span>
                </div>
              </div>
            </AnimSection>
          ))}
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div className="modal-overlay" onClick={() => setLightbox(null)}>
            <div style={{ position: 'relative', maxWidth: 900, width: '100%' }} onClick={e => e.stopPropagation()}>
              <img src={lightbox} alt="Foto ampliada" style={{ width: '100%', borderRadius: 20, maxHeight: '80vh', objectFit: 'contain' }} />
              <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: -16, right: -16, width: 40, height: 40, borderRadius: '50%', background: '#8FD64A', border: 'none', cursor: 'pointer', fontSize: 18, color: '#071A0E', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── CarteirinhaDigital ── */
function CarteirinhaDigital() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const cardRef = useRef(null)

  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('sp_token') || localStorage.getItem('sp_site_token') || '')
    : ''

  const buscarCarteirinha = useCallback(async () => {
    if (!token) { setErro('Faça login para acessar sua carteirinha digital.'); return }
    setLoading(true); setErro('')
    try {
      const res = await fetch('/api/auth/carteirinha', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao buscar carteirinha')
      setData(d)
      setShowModal(true)
    } catch (e) {
      setErro(e.message || 'Erro ao buscar carteirinha')
    } finally {
      setLoading(false)
    }
  }, [token])

  const handlePrint = () => {
    if (!cardRef.current) return
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>Carteirinha TTC</title>
      <style>
        body { margin: 0; background: #071A0E; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: Inter, sans-serif; }
        @media print { body { background: #071A0E !important; } }
      </style>
      </head><body>${cardRef.current.outerHTML}</body></html>
    `)
    w.document.close()
    setTimeout(() => { w.print() }, 500)
  }

  const statusColor = {
    ativo: '#8FD64A',
    inadimplente: '#EF5350',
    suspenso: '#FFB74D',
    inativo: '#9E9E9E',
  }

  return (
    <section id="carteirinha" style={{ background: C.deep, padding: '100px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div className="section-badge">🪪 Sócios</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Carteirinha <span style={{ color: '#8FD64A' }}>Digital</span>
            </h2>
            <div className="divider-gold" />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, fontFamily: 'Inter, sans-serif', marginTop: 20, maxWidth: 520, margin: '20px auto 0' }}>
              Acesse sua carteirinha digital com QR Code para identificação no clube, torneios e eventos.
            </p>
          </div>
        </AnimSection>

        <AnimSection delay={100}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            {/* Preview card mockup */}
            <div style={{ perspective: 1000, width: '100%', maxWidth: 420 }}>
              <div style={{
                background: 'linear-gradient(135deg, #071A0E 0%, #0E2E1C 50%, #1B4D2E 100%)',
                border: '1.5px solid rgba(143,214,74,0.3)',
                borderRadius: 24, padding: 32,
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 30px rgba(143,214,74,0.1)',
                animation: 'glowPulse 4s ease-in-out infinite',
              }}>
                {/* BG pattern */}
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(143,214,74,0.08), transparent 50%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -30, left: -30, width: 180, height: 180, borderRadius: '50%', border: '1px solid rgba(201,166,86,0.1)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 2 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#8FD64A', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>Tênis & Touring Clube</div>
                      <div style={{ fontSize: 22, color: '#fff', fontFamily: "'Playfair Display', serif", fontWeight: 700, marginTop: 4 }}>Carteirinha Sócio</div>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8FD64A, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#071A0E', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>TTC</div>
                  </div>

                  {/* Body */}
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    {/* QR placeholder */}
                    <div style={{ width: 88, height: 88, background: 'rgba(255,255,255,0.07)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28 }}>▣</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>QR CODE</div>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>Nome do sócio</div>
                      <div style={{ fontSize: 18, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, marginBottom: 8 }}>João da Silva</div>
                      <div style={{ fontSize: 12, color: '#C9A656', fontFamily: 'Inter, sans-serif', fontWeight: 600, marginBottom: 6 }}>Plano Familiar</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(143,214,74,0.12)', border: '1px solid rgba(143,214,74,0.3)', borderRadius: 50, padding: '3px 12px' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#8FD64A', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: 11, color: '#8FD64A', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>ATIVO</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>Desde 2020 · #TTC0001</div>
                    <div style={{ fontSize: 18 }}>🎾</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center' }}>
              {!token ? (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: 'Inter, sans-serif', marginBottom: 16 }}>
                    Faça login para acessar sua carteirinha digital
                  </p>
                  <Link to="/login" className="ttc-btn-primary">
                    🔐 Fazer Login
                  </Link>
                </div>
              ) : (
                <button onClick={buscarCarteirinha} disabled={loading} className="ttc-btn-primary" style={{ fontSize: 16, padding: '16px 40px' }}>
                  {loading ? '⏳ Carregando...' : '🪪 Ver Minha Carteirinha'}
                </button>
              )}
              {erro && (
                <div style={{ marginTop: 16, padding: '12px 24px', background: 'rgba(239,83,80,0.12)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: 12, color: '#EF5350', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
                  ⚠️ {erro}
                </div>
              )}
            </div>
          </div>
        </AnimSection>
      </div>

      {/* Modal da carteirinha real */}
      {showModal && data && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div style={{ maxWidth: 520, width: '100%', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div ref={cardRef}>
              {data.socio ? (
                <div className="carteirinha-card">
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#8FD64A', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>Tênis & Touring Clube</div>
                        <div style={{ fontSize: 24, color: '#fff', fontFamily: "'Playfair Display', serif", fontWeight: 700, marginTop: 4 }}>Carteirinha Oficial</div>
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #8FD64A, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#071A0E', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>TTC</div>
                    </div>

                    {/* Body */}
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
                      {/* QR Real */}
                      <div className="qr-container" style={{ position: 'relative', flexShrink: 0 }}>
                        <div className="qr-scan-line" />
                        <div
                          dangerouslySetInnerHTML={{ __html: data.qrSvg }}
                          style={{ width: 100, height: 100, display: 'block' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>Sócio</div>
                        <div style={{ fontSize: 20, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 800, marginBottom: 8, lineHeight: 1.2 }}>{data.nome}</div>
                        <div style={{ fontSize: 13, color: '#C9A656', fontFamily: 'Inter, sans-serif', fontWeight: 600, marginBottom: 10 }}>{data.plano}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: `${statusColor[data.status] || '#8FD64A'}15`, border: `1px solid ${statusColor[data.status] || '#8FD64A'}40`, borderRadius: 50, padding: '4px 14px' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[data.status] || '#8FD64A', animation: 'pulse 2s infinite' }} />
                          <span style={{ fontSize: 11, color: statusColor[data.status] || '#8FD64A', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{data.status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif', letterSpacing: '.04em', marginBottom: 2 }}>CÓDIGO DO SÓCIO</div>
                        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.1em' }}>{data.cardCode}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif', letterSpacing: '.04em', marginBottom: 2 }}>MEMBRO DESDE</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                          {data.desde ? new Date(data.desde).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </div>
                      <div style={{ fontSize: 24 }}>🎾</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 56, marginBottom: 20 }}>😕</div>
                  <h3 style={{ color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: 24, marginBottom: 12 }}>Você ainda não é sócio</h3>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif', fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>{data.message}</p>
                  <a href="#seja-socio" className="ttc-btn-primary" onClick={() => setShowModal(false)}>Quero ser sócio →</a>
                </div>
              )}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              {data.socio && (
                <button onClick={handlePrint} className="ttc-btn-primary" style={{ fontSize: 14, padding: '12px 28px' }}>
                  🖨️ Imprimir / Salvar PDF
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="ttc-btn-outline" style={{ fontSize: 14, padding: '12px 28px' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ── Seja Sócio ── */
function SejaSocio() {
  return (
    <section id="seja-socio" style={{ background: `linear-gradient(160deg, ${C.forest} 0%, ${C.deep} 100%)`, padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
      {/* Deco */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(143,214,74,0.06), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,166,86,0.06), transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div className="section-badge">🏅 Associação</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Faça parte do <span style={{ color: '#8FD64A' }}>melhor clube</span><br />do Centro-Oeste
            </h2>
            <div className="divider-gold" />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, fontFamily: 'Inter, sans-serif', marginTop: 24, maxWidth: 540, margin: '24px auto 0' }}>
              Escolha o plano ideal para você e sua família
            </p>
          </div>
        </AnimSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'stretch' }}>
          {PLANOS.map((p, i) => (
            <AnimSection key={i} delay={i * 100}>
              <div
                className={`plano-card${p.destaque ? ' destaque' : ''}`}
                style={{
                  background: p.cor,
                  border: p.border || (p.destaque ? '1.5px solid rgba(143,214,74,0.4)' : '1px solid rgba(255,255,255,0.08)'),
                  height: '100%',
                }}
              >
                {p.badge && (
                  <div style={{ background: 'linear-gradient(135deg, #8FD64A, #4CAF50)', color: '#071A0E', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', padding: '5px 16px', borderRadius: 50, display: 'inline-block', marginBottom: 20, textTransform: 'uppercase' }}>
                    {p.badge}
                  </div>
                )}
                {p.vip && (
                  <div style={{ background: 'linear-gradient(135deg, #C9A656, #E8C87A)', color: '#071A0E', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', padding: '5px 16px', borderRadius: 50, display: 'inline-block', marginBottom: 20, textTransform: 'uppercase' }}>
                    👑 VIP Premium
                  </div>
                )}
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: p.vip ? '#C9A656' : '#fff', marginBottom: 8 }}>{p.nome}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 28 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 42, fontWeight: 900, color: p.vip ? '#E8C87A' : (p.destaque ? '#8FD64A' : '#fff'), lineHeight: 1 }}>{p.preco}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontFamily: 'Inter, sans-serif', marginBottom: 6 }}>{p.periodo}</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, marginBottom: 28 }}>
                  {p.itens.map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: p.vip ? '#C9A656' : '#8FD64A', fontSize: 14, flexShrink: 0 }}>✓</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{item}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`https://wa.me/5565999999999?text=Ol%C3%A1!%20Quero%20ser%20s%C3%B3cio%20do%20TTC%20-%20Plano%20${encodeURIComponent(p.nome)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={p.vip ? 'ttc-btn-gold' : 'ttc-btn-primary'}
                  style={{ width: '100%', justifyContent: 'center', ...(p.vip ? {} : (p.destaque ? {} : { background: 'rgba(255,255,255,0.1)', color: '#fff', boxShadow: 'none' })) }}
                >
                  {p.vip ? '👑 Assinar VIP' : (p.destaque ? '⭐ Escolher Familiar' : 'Escolher Plano')}
                </a>
              </div>
            </AnimSection>
          ))}
        </div>

        <AnimSection delay={300}>
          <div style={{ textAlign: 'center', marginTop: 48, padding: '28px', background: 'rgba(143,214,74,0.06)', borderRadius: 20, border: '1px solid rgba(143,214,74,0.15)', maxWidth: 600, margin: '48px auto 0' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}>
              💬 Dúvidas? Fale com nossa equipe de associação via WhatsApp e encontre o plano perfeito para você.
            </p>
            <a href="https://wa.me/5565999999999" target="_blank" rel="noopener noreferrer" className="ttc-btn-primary" style={{ marginTop: 20, fontSize: 15, padding: '14px 32px' }}>
              📱 Falar no WhatsApp
            </a>
          </div>
        </AnimSection>
      </div>
    </section>
  )
}

/* ── Contato ── */
function Contato() {
  const canais = [
    { icon: '📱', label: 'WhatsApp', valor: '(65) 9 9999-9999', href: 'https://wa.me/5565999999999', cor: '#25D366' },
    { icon: '📞', label: 'Secretaria', valor: '(65) 3333-3333', href: 'tel:+556533333333', cor: '#4FC3F7' },
    { icon: '📧', label: 'E-mail', valor: 'contato@ttcuiaba.com.br', href: 'mailto:contato@ttcuiaba.com.br', cor: '#8FD64A' },
    { icon: '📸', label: 'Instagram', valor: '@ttcuiaba', href: 'https://instagram.com/ttcuiaba', cor: '#E1306C' },
  ]

  return (
    <section id="contato" style={{ background: C.deep, padding: '100px 24px 60px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AnimSection>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div className="section-badge">📍 Localização</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Venha nos <span style={{ color: '#8FD64A' }}>visitar</span>
            </h2>
            <div className="divider-gold" />
          </div>
        </AnimSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48 }}>
          {/* Canais */}
          <AnimSection>
            <div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: '#fff', marginBottom: 28, fontWeight: 700 }}>Fale conosco</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {canais.map((c, i) => (
                  <a
                    key={i}
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.cor}22`, borderRadius: 16, textDecoration: 'none', transition: 'all .3s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${c.cor}12`; e.currentTarget.style.borderColor = `${c.cor}44` }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = `${c.cor}22` }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{c.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, color: c.cor, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>{c.label}</div>
                      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{c.valor}</div>
                    </div>
                  </a>
                ))}
              </div>

              <div style={{ marginTop: 32, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 12, color: '#8FD64A', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>📍 Endereço</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                  Av. Miguel Sutil, 8.000<br />Jardim das Américas, Cuiabá - MT<br />CEP: 78070-000
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
                  🕐 Seg–Sex: 6h–22h · Sáb: 7h–20h · Dom: 8h–18h
                </div>
              </div>
            </div>
          </AnimSection>

          {/* Mapa */}
          <AnimSection delay={150}>
            <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3843.6!2d-56.0!3d-15.6!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCuiab%C3%A1%2C%20MT!5e0!3m2!1spt-BR!2sbr!4v1234567890"
                width="100%" height="100%"
                style={{ border: 0, display: 'block', filter: 'invert(90%) hue-rotate(170deg)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização TTC"
              />
            </div>
          </AnimSection>
        </div>

        {/* Footer */}
        <AnimSection delay={200}>
          <div style={{ marginTop: 80, paddingTop: 40, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tênis & Touring Clube</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>© 2026 · Cuiabá, MT · Todos os direitos reservados</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link to="/" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter, sans-serif', textDecoration: 'none', transition: 'color .2s' }} onMouseEnter={e => e.target.style.color = '#8FD64A'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}>Home</Link>
              <Link to="/inscricoes" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter, sans-serif', textDecoration: 'none', transition: 'color .2s' }} onMouseEnter={e => e.target.style.color = '#8FD64A'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}>Inscrições</Link>
              <Link to="/login" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter, sans-serif', textDecoration: 'none', transition: 'color .2s' }} onMouseEnter={e => e.target.style.color = '#8FD64A'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}>Login</Link>
            </div>
          </div>
        </AnimSection>
      </div>
    </section>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function Clube() {
  const [activeSection, setActiveSection] = useState('')
  const [visitantes, setVisitantes] = useState(null)

  /* Inject CSS */
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'ttc-clube-css'
    style.textContent = GLOBAL_CSS
    document.head.appendChild(style)
    return () => { const el = document.getElementById('ttc-clube-css'); if (el) el.remove() }
  }, [])

  /* Visitor counter ping */
  useEffect(() => {
    fetch('/api/visitantes/ping', { method: 'POST' })
      .then(r => r.json())
      .then(d => setVisitantes(d.total))
      .catch(() => {
        fetch('/api/visitantes').then(r => r.json()).then(d => setVisitantes(d.total)).catch(() => {})
      })
  }, [])

  /* Active section tracking */
  useEffect(() => {
    const ids = NAV_ITEMS.map(n => n.id)
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) })
    }, { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' })
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleNavCarteirinha = useCallback(() => {
    scrollToSection('carteirinha')
  }, [scrollToSection])

  return (
    <div style={{ background: C.deep, minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <StickyNav activeSection={activeSection} onNav={scrollToSection} />
      <Hero visitantes={visitantes} onNavCarteirinha={handleNavCarteirinha} />
      <Ticker />
      <StatsSection />
      <QuemSomos />
      <Estrutura />
      <Eventos />
      <Galeria />
      <CarteirinhaDigital />
      <SejaSocio />
      <Contato />
    </div>
  )
}
