import { useAuth } from '../../lib/auth'
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Beer,
  Boxes,
  Building2,
  Check,
  CircleDot,
  Database,
  Eye,
  Factory,
  Gauge,
  Network,
  ShieldCheck,
  ShoppingBag,
  Scissors,
  Sparkles,
  Store,
  Utensils,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'

const PRODUCT_LINKS = [
  {
    eyebrow: 'Ops & automação',
    name: 'GemOps',
    title: 'A operação que não para no piloto.',
    text: 'Agentes, RPA e dados conectados para tornar o back-office mais simples, rápido e inteligente.',
    href: 'https://gemops-digital-108835006988.us-central1.run.app/app',
    icon: Workflow,
    tone: 'orange',
    outcome: 'Compras, viagens e aprovações em fluxo.',
  },
  {
    eyebrow: 'Indústria & inteligência',
    name: 'LakeX',
    title: 'A planta vista como um sistema vivo.',
    text: 'Gêmeos digitais, observabilidade e IA autônoma para decidir melhor sobre ativos e processos.',
    href: 'https://lakex.com.br',
    icon: Factory,
    tone: 'blue',
    outcome: 'Conectar, observar, decidir e agir.',
  },
  {
    eyebrow: 'Operação & gestão',
    name: 'Setpoint',
    title: 'O centro de comando do negócio.',
    text: 'Gestão multinegócio, vendas e operação em um ambiente feito para o dia a dia acontecer.',
    href: 'https://setpoint.kytto.com.br/admin',
    icon: Gauge,
    tone: 'coral',
    outcome: 'Do dado operacional à execução.',
  },
  {
    eyebrow: 'Pessoas & performance',
    name: 'Nossa Gente AI',
    title: 'Tecnologia que desenvolve quem faz.',
    text: 'Inteligência para metas, performance, talentos e decisões melhores para cada pessoa da operação.',
    href: 'https://ai-nossagente-web-nedqnqyahq-rj.a.run.app/login',
    icon: Users,
    tone: 'sand',
    outcome: 'Pessoas no centro da evolução.',
  },
  {
    eyebrow: 'Jurídico & governança',
    name: 'AIJur',
    title: 'Contexto para o jurídico trabalhar melhor.',
    text: 'Inteligência aplicada a documentos, assuntos, prazos e tarefas, com governança e revisão profissional.',
    href: '/ia/aijur',
    icon: ShieldCheck,
    tone: 'blue',
    outcome: 'IA responsável para profissionais do Direito.',
  },
]

const SECTOR_LINKS = [
  { name: 'Barbearias & salões', icon: Scissors },
  { name: 'Mercados', icon: ShoppingBag },
  { name: 'Lojas & varejo', icon: Store },
  { name: 'Restaurantes', icon: Utensils },
  { name: 'Bares & eventos', icon: Beer },
  { name: 'Operações multinegócio', icon: Building2 },
]

const PILLARS = [
  { value: 'IA em produção', label: 'software que roda no mundo real', icon: Zap },
  { value: 'Dados conectados', label: 'uma visão para cada decisão', icon: Database },
  { value: 'Automação que age', label: 'menos tarefa, mais resultado', icon: Bot },
  { value: 'Pessoas no centro', label: 'tecnologia a serviço da operação', icon: Users },
]

const CAPABILITIES = [
  {
    icon: Bot,
    eyebrow: '01 · Agentes autônomos',
    title: 'IA que executa o próximo passo.',
    text: 'Agentes que trabalham sobre processos reais, com contexto, regras e rastreabilidade — não apenas recomendações soltas.',
  },
  {
    icon: Eye,
    eyebrow: '02 · Visão computacional',
    title: 'O mundo físico também vira dado.',
    text: 'Leitura de imagens, presença, jornada e sinais da operação para transformar eventos em decisões acionáveis.',
  },
  {
    icon: ShieldCheck,
    eyebrow: '03 · Confiança e governança',
    title: 'Inteligência com base verificável.',
    text: 'Dados sob controle, observabilidade e decisões explicáveis para escalar inovação com segurança.',
  },
]

const FLOW = [
  { number: '01', title: 'Conectar', text: 'Unimos sistemas, dados e pessoas.', icon: Network },
  { number: '02', title: 'Observar', text: 'Damos contexto ao que acontece.', icon: Eye },
  { number: '03', title: 'Decidir', text: 'A inteligência aponta o caminho.', icon: Sparkles },
  { number: '04', title: 'Executar', text: 'A operação transforma decisão em resultado.', icon: ArrowRight },
]

function Eyebrow({ children, light = false }) {
  return (
    <div className={`kh-eyebrow${light ? ' kh-eyebrow-light' : ''}`}>
      <span className="kh-eyebrow-line" />
      <span>{children}</span>
    </div>
  )
}

function ArrowLink({ href, children, light = false }) {
  return (
    <a className={`kh-arrow-link${light ? ' kh-arrow-link-light' : ''}`} href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ArrowUpRight size={16} strokeWidth={2.2} />
    </a>
  )
}

function ProductCard({ product }) {
  const Icon = product.icon
  const external = product.href.startsWith('http')
  return (
    <a className={`kh-product-card kh-product-${product.tone}`} href={product.href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      <div className="kh-product-card-top">
        <div className="kh-product-icon"><Icon size={22} strokeWidth={1.8} /></div>
        <ArrowUpRight className="kh-product-arrow" size={19} strokeWidth={2} />
      </div>
      <span className="kh-product-eyebrow">{product.eyebrow}</span>
      <h3>{product.name}</h3>
      <p className="kh-product-title">{product.title}</p>
      <p className="kh-product-text">{product.text}</p>
      <div className="kh-product-outcome"><Check size={15} strokeWidth={2.6} /> {product.outcome}</div>
      <span className="kh-card-link">Explorar solução <ArrowRight size={15} /></span>
    </a>
  )
}

export default function Home() {
  const { user, isOrg, isStaff, isAtleta } = useAuth()
  const painelPath = isOrg ? '/admin' : isStaff ? '/pdv' : isAtleta ? '/meu-painel' : '/login'
  const painelLabel = user ? 'Abrir meu painel' : 'Acessar plataforma'

  return (
    <div className="kytto-home">
      <style>{`
        .kytto-home {
          --kh-navy: #12283F;
          --kh-navy-deep: #0A1929;
          --kh-blue: #1B3A5B;
          --kh-cream: #FFF9F5;
          --kh-sand: #FFF4EC;
          --kh-orange: #FF6B2C;
          --kh-coral: #FF9B72;
          --kh-ink: #1C2530;
          --kh-muted: #66717B;
          --kh-line: #E9DED4;
          color: var(--kh-ink);
          background: var(--kh-cream);
          overflow: hidden;
          font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .kytto-home *, .kytto-home *::before, .kytto-home *::after { box-sizing: border-box; }
        .kytto-home a { color: inherit; }
        .kh-container { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
        .kh-nav-wrap { position: absolute; inset: 0 0 auto; z-index: 20; }
        .kh-nav { display: flex; align-items: center; justify-content: space-between; min-height: 82px; }
        .kh-logo { width: 132px; height: auto; display: block; }
        .kh-nav-links { display: flex; align-items: center; gap: 30px; color: rgba(255,249,245,.72); font-size: 13px; font-weight: 600; }
        .kh-nav-links a { text-decoration: none; transition: color .18s ease; }
        .kh-nav-links a:hover { color: #fff; }
        .kh-nav-cta { display: inline-flex; align-items: center; gap: 8px; padding: 11px 16px; border: 1px solid rgba(255,255,255,.22); border-radius: 999px; color: #fff; text-decoration: none; font-size: 12px; font-weight: 800; transition: background .18s ease, border-color .18s ease, transform .18s ease; }
        .kh-nav-cta:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.5); transform: translateY(-1px); }
        .kh-hero { position: relative; min-height: 760px; display: flex; align-items: center; padding: 136px 0 96px; color: var(--kh-cream); background: var(--kh-navy-deep); }
        .kh-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 78% 18%, rgba(255,107,44,.18), transparent 31%), radial-gradient(circle at 24% 75%, rgba(27,58,91,.65), transparent 42%); pointer-events: none; }
        .kh-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(420px, .95fr); align-items: center; gap: 80px; }
        .kh-eyebrow { display: inline-flex; align-items: center; gap: 10px; color: var(--kh-orange); font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: .17em; line-height: 1.3; text-transform: uppercase; }
        .kh-eyebrow-light { color: var(--kh-coral); }
        .kh-eyebrow-line { width: 30px; height: 2px; border-radius: 2px; background: currentColor; }
        .kh-hero h1 { max-width: 700px; margin: 22px 0 26px; color: #FFF4EC; font-family: 'Outfit', 'Work Sans', sans-serif; font-size: clamp(3.35rem, 6.4vw, 6rem); font-weight: 800; letter-spacing: -.065em; line-height: .96; }
        .kh-hero h1 em { color: var(--kh-orange); font-style: normal; }
        .kh-hero-copy { max-width: 590px; color: rgba(255,244,236,.72); font-size: clamp(1.02rem, 1.6vw, 1.18rem); line-height: 1.7; }
        .kh-hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 38px; }
        .kh-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; padding: 0 22px; border-radius: 10px; font-size: 13px; font-weight: 800; text-decoration: none; transition: transform .18s ease, background .18s ease, border-color .18s ease; }
        .kh-btn:hover { transform: translateY(-2px); }
        .kh-btn-primary { color: #fff; background: var(--kh-orange); box-shadow: 0 12px 28px rgba(255,107,44,.22); }
        .kh-btn-primary:hover { background: #E85C22; }
        .kh-btn-ghost { color: #FFF4EC; border: 1px solid rgba(255,244,236,.24); background: rgba(255,244,236,.04); }
        .kh-btn-ghost:hover { border-color: rgba(255,244,236,.5); background: rgba(255,244,236,.1); }
        .kh-hero-note { display: flex; align-items: center; gap: 9px; margin-top: 25px; color: rgba(255,244,236,.46); font-size: 11px; }
        .kh-hero-note span { width: 7px; height: 7px; border-radius: 50%; background: var(--kh-orange); box-shadow: 0 0 0 5px rgba(255,107,44,.11); }
        .kh-orbit { position: relative; min-height: 470px; }
        .kh-orbit::before, .kh-orbit::after { content: ''; position: absolute; border: 1px solid rgba(255,155,114,.24); border-radius: 50%; transform: rotate(-19deg); }
        .kh-orbit::before { width: 520px; height: 186px; top: 122px; left: -25px; }
        .kh-orbit::after { width: 470px; height: 168px; top: 152px; left: 25px; border-color: rgba(255,255,255,.11); transform: rotate(28deg); }
        .kh-orbit-grid { position: absolute; inset: 26px 0 0; opacity: .14; background-image: linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px); background-size: 38px 38px; mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 80%, transparent); }
        .kh-orbit-core { position: absolute; top: 130px; left: 50%; width: 176px; height: 176px; padding: 22px; transform: translateX(-50%); border: 1px solid rgba(255,155,114,.55); border-radius: 50%; background: radial-gradient(circle at 35% 30%, #FF9B72, #FF6B2C 32%, #9E3D21 78%); box-shadow: 0 0 0 22px rgba(255,107,44,.06), 0 0 80px rgba(255,107,44,.27); display: flex; align-items: center; justify-content: center; text-align: center; }
        .kh-orbit-core::after { content: ''; position: absolute; inset: 13px; border: 1px solid rgba(255,255,255,.32); border-radius: 50%; }
        .kh-orbit-core strong { position: relative; z-index: 1; max-width: 100px; color: #fff; font-family: 'Outfit', sans-serif; font-size: 19px; line-height: 1.05; letter-spacing: -.04em; }
        .kh-orbit-node { position: absolute; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 10px 13px 10px 10px; color: rgba(255,244,236,.85); border: 1px solid rgba(255,255,255,.15); border-radius: 12px; background: rgba(9,24,40,.74); box-shadow: 0 14px 30px rgba(0,0,0,.16); backdrop-filter: blur(8px); font-size: 11px; font-weight: 700; }
        .kh-orbit-node svg { color: var(--kh-orange); }
        .kh-node-1 { top: 32px; left: 0; }
        .kh-node-2 { top: 65px; right: 6px; }
        .kh-node-3 { bottom: 75px; left: 28px; }
        .kh-node-4 { right: 0; bottom: 52px; }
        .kh-orbit-status { position: absolute; right: 66px; bottom: 142px; display: flex; align-items: center; gap: 7px; color: rgba(255,244,236,.5); font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
        .kh-orbit-status b { width: 6px; height: 6px; border-radius: 50%; background: #62D69B; box-shadow: 0 0 0 5px rgba(98,214,155,.12); }
        .kh-signal { position: absolute; bottom: 5px; left: 50%; width: 250px; transform: translateX(-50%); color: rgba(255,244,236,.42); font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em; text-align: center; text-transform: uppercase; }
        .kh-proof { position: relative; z-index: 2; margin-top: -1px; padding: 28px 0; background: var(--kh-orange); }
        .kh-proof-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
        .kh-proof-item { display: flex; align-items: center; gap: 13px; min-height: 48px; padding: 0 28px; border-left: 1px solid rgba(18,40,63,.2); color: var(--kh-navy); }
        .kh-proof-item:first-child { padding-left: 0; border-left: 0; }
        .kh-proof-item svg { flex: 0 0 auto; }
        .kh-proof-value { display: block; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 800; line-height: 1.15; }
        .kh-proof-label { display: block; margin-top: 3px; color: rgba(18,40,63,.64); font-size: 10px; line-height: 1.25; }
        .kh-section { padding: 118px 0; }
        .kh-section-sand { background: var(--kh-sand); }
        .kh-section-white { background: #fff; }
        .kh-section-head { display: flex; align-items: end; justify-content: space-between; gap: 35px; margin-bottom: 48px; }
        .kh-section-head h2 { max-width: 620px; margin: 16px 0 0; color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: clamp(2.3rem, 4.1vw, 4rem); font-weight: 800; letter-spacing: -.055em; line-height: .98; }
        .kh-section-head h2 em { color: var(--kh-orange); font-style: normal; }
        .kh-section-head p { max-width: 380px; margin: 0 0 3px; color: var(--kh-muted); font-size: 14px; line-height: 1.65; }
        .kh-product-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; }
        .kh-product-card { position: relative; display: flex; min-height: 410px; flex-direction: column; padding: 25px; overflow: hidden; border: 1px solid var(--kh-line); border-radius: 20px; background: #fff; text-decoration: none; transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        .kh-product-card::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--kh-orange); opacity: .85; }
        .kh-product-card:hover { border-color: rgba(255,107,44,.55); box-shadow: 0 22px 45px rgba(18,40,63,.1); transform: translateY(-7px); }
        .kh-product-blue::before { background: var(--kh-blue); }
        .kh-product-coral::before { background: var(--kh-coral); }
        .kh-product-sand::before { background: #D7A17D; }
        .kh-product-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 35px; }
        .kh-product-icon { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; color: var(--kh-orange); background: rgba(255,107,44,.1); }
        .kh-product-blue .kh-product-icon { color: var(--kh-blue); background: rgba(27,58,91,.1); }
        .kh-product-coral .kh-product-icon { color: #CE6B4A; background: rgba(255,155,114,.18); }
        .kh-product-sand .kh-product-icon { color: #A86745; background: rgba(215,161,125,.18); }
        .kh-product-arrow { color: #B5ADA7; transition: color .18s ease, transform .18s ease; }
        .kh-product-card:hover .kh-product-arrow { color: var(--kh-orange); transform: translate(2px, -2px); }
        .kh-product-eyebrow { color: var(--kh-orange); font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .08em; line-height: 1.25; text-transform: uppercase; }
        .kh-product-blue .kh-product-eyebrow { color: var(--kh-blue); }
        .kh-product-coral .kh-product-eyebrow { color: #C76F50; }
        .kh-product-sand .kh-product-eyebrow { color: #A86745; }
        .kh-product-card h3 { margin: 9px 0 18px; color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: 25px; font-weight: 800; letter-spacing: -.04em; }
        .kh-product-title { margin-bottom: 11px; color: var(--kh-navy); font-size: 15px; font-weight: 800; line-height: 1.3; }
        .kh-product-text { color: var(--kh-muted); font-size: 13px; line-height: 1.6; }
        .kh-product-outcome { display: flex; align-items: flex-start; gap: 6px; margin-top: auto; padding-top: 23px; color: var(--kh-navy); font-size: 11px; font-weight: 700; line-height: 1.35; }
        .kh-product-outcome svg { flex: 0 0 auto; color: var(--kh-orange); margin-top: 1px; }
        .kh-card-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 22px; color: var(--kh-orange); font-size: 12px; font-weight: 800; }
        .kh-card-link svg { transition: transform .18s ease; }
        .kh-product-card:hover .kh-card-link svg { transform: translateX(3px); }
        .kh-arrow-link { display: inline-flex; align-items: center; gap: 6px; color: var(--kh-orange); font-size: 12px; font-weight: 800; text-decoration: none; }
        .kh-arrow-link:hover { text-decoration: underline; text-underline-offset: 4px; }
        .kh-platform { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 80px; align-items: center; }
        .kh-platform h2 { max-width: 560px; margin: 16px 0 23px; color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: clamp(2.25rem, 4vw, 3.8rem); font-weight: 800; letter-spacing: -.055em; line-height: .98; }
        .kh-platform h2 em { color: var(--kh-orange); font-style: normal; }
        .kh-platform-copy { max-width: 520px; color: var(--kh-muted); font-size: 15px; line-height: 1.7; }
        .kh-platform-list { display: grid; gap: 13px; margin-top: 32px; }
        .kh-platform-list-item { display: flex; align-items: flex-start; gap: 13px; color: var(--kh-navy); font-size: 13px; font-weight: 700; line-height: 1.4; }
        .kh-platform-list-item svg { flex: 0 0 auto; color: var(--kh-orange); margin-top: 1px; }
        .kh-layers { position: relative; padding: 31px; border: 1px solid var(--kh-line); border-radius: 24px; background: var(--kh-cream); }
        .kh-layers::before { content: ''; position: absolute; inset: 18px -18px -18px 18px; z-index: 0; border: 1px solid rgba(255,107,44,.18); border-radius: 24px; }
        .kh-layer-card { position: relative; z-index: 1; display: flex; align-items: center; gap: 19px; min-height: 69px; margin-bottom: 10px; padding: 15px 18px; border: 1px solid rgba(18,40,63,.1); border-radius: 13px; background: #fff; box-shadow: 0 9px 22px rgba(18,40,63,.06); }
        .kh-layer-card:last-child { margin-bottom: 0; }
        .kh-layer-card:first-child { border-color: rgba(255,107,44,.55); background: var(--kh-navy); transform: translateX(22px); }
        .kh-layer-index { display: flex; align-items: center; justify-content: center; width: 35px; height: 35px; flex: 0 0 auto; border-radius: 10px; color: var(--kh-orange); background: rgba(255,107,44,.12); font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; }
        .kh-layer-card:first-child .kh-layer-index { background: rgba(255,107,44,.18); }
        .kh-layer-card strong { display: block; color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 800; }
        .kh-layer-card:first-child strong { color: #fff; }
        .kh-layer-card span { display: block; margin-top: 3px; color: var(--kh-muted); font-size: 11px; line-height: 1.3; }
        .kh-layer-card:first-child span { color: rgba(255,244,236,.6); }
        .kh-layer-dot { width: 8px; height: 8px; margin-left: auto; flex: 0 0 auto; border-radius: 50%; background: var(--kh-orange); box-shadow: 0 0 0 6px rgba(255,107,44,.1); }
        .kh-sector-band { padding: 42px 0; background: var(--kh-sand); border-top: 1px solid var(--kh-line); border-bottom: 1px solid var(--kh-line); }
        .kh-sector-band-head { display: flex; align-items: center; justify-content: space-between; gap: 25px; margin-bottom: 19px; }
        .kh-sector-band-title { color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; letter-spacing: -.03em; }
        .kh-sector-band-link { color: var(--kh-orange); font-size: 12px; font-weight: 800; text-decoration: none; }
        .kh-sector-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 9px; }
        .kh-sector-pill { display: flex; align-items: center; gap: 9px; min-height: 54px; padding: 11px 13px; border: 1px solid var(--kh-line); border-radius: 11px; color: var(--kh-navy); background: rgba(255,255,255,.68); font-size: 11px; font-weight: 750; line-height: 1.25; text-decoration: none; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
        .kh-sector-pill svg { flex: 0 0 auto; color: var(--kh-orange); }
        .kh-sector-pill:hover, .kh-sector-pill:focus-visible { transform: translateY(-3px); border-color: rgba(255,107,44,.55); background: #fff; }
        .kh-capabilities { background: var(--kh-navy); }
        .kh-capabilities .kh-section-head h2 { color: #FFF4EC; }
        .kh-capabilities .kh-section-head p { color: rgba(255,244,236,.6); }
        .kh-cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .kh-cap-card { min-height: 285px; padding: 27px; border: 1px solid rgba(255,255,255,.14); border-radius: 18px; background: rgba(255,255,255,.05); transition: background .2s ease, transform .2s ease; }
        .kh-cap-card:hover { background: rgba(255,255,255,.09); transform: translateY(-5px); }
        .kh-cap-icon { display: inline-flex; align-items: center; justify-content: center; width: 47px; height: 47px; margin-bottom: 30px; border-radius: 13px; color: var(--kh-orange); background: rgba(255,107,44,.14); }
        .kh-cap-card .kh-product-eyebrow { color: var(--kh-coral); }
        .kh-cap-card h3 { max-width: 260px; margin: 11px 0 14px; color: #FFF4EC; font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -.035em; line-height: 1.05; }
        .kh-cap-card p { color: rgba(255,244,236,.6); font-size: 13px; line-height: 1.6; }
        .kh-cap-link { margin-top: 18px; }
        .kh-flow-section { padding-bottom: 120px; background: #fff; }
        .kh-flow-line { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .kh-flow-line::before { content: ''; position: absolute; top: 32px; right: 10%; left: 10%; height: 1px; background: var(--kh-line); }
        .kh-flow-item { position: relative; z-index: 1; padding-right: 20px; }
        .kh-flow-number { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; margin-bottom: 27px; border: 1px solid rgba(255,107,44,.45); border-radius: 50%; color: var(--kh-orange); background: #fff; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 800; }
        .kh-flow-item h3 { margin-bottom: 7px; color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -.03em; }
        .kh-flow-item p { max-width: 180px; color: var(--kh-muted); font-size: 12px; line-height: 1.5; }
        .kh-cta { position: relative; padding: 110px 0; overflow: hidden; background: var(--kh-orange); }
        .kh-cta::after { content: ''; position: absolute; top: -180px; right: -90px; width: 540px; height: 540px; border: 1px solid rgba(18,40,63,.2); border-radius: 50%; box-shadow: 0 0 0 40px rgba(18,40,63,.05), 0 0 0 90px rgba(18,40,63,.035); }
        .kh-cta-inner { position: relative; z-index: 1; display: flex; align-items: end; justify-content: space-between; gap: 40px; }
        .kh-cta h2 { max-width: 650px; margin: 17px 0 0; color: var(--kh-navy); font-family: 'Outfit', sans-serif; font-size: clamp(2.7rem, 5vw, 5rem); font-weight: 800; letter-spacing: -.06em; line-height: .93; }
        .kh-cta p { max-width: 360px; margin-bottom: 3px; color: rgba(18,40,63,.7); font-size: 14px; line-height: 1.6; }
        .kh-cta .kh-btn-primary { color: var(--kh-cream); background: var(--kh-navy); box-shadow: 0 14px 30px rgba(18,40,63,.2); }
        .kh-cta .kh-btn-primary:hover { background: #1B3A5B; }
        .kh-footer { padding: 29px 0 34px; color: rgba(255,244,236,.58); background: var(--kh-navy-deep); }
        .kh-footer-main { display: flex; align-items: center; justify-content: space-between; gap: 25px; }
        .kh-footer-logo { width: 96px; }
        .kh-footer-copy { font-size: 11px; }
        .kh-footer-links { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 17px; font-size: 11px; }
        .kh-footer-links a { color: rgba(255,244,236,.72); text-decoration: none; }
        .kh-footer-links a:hover { color: #fff; }
        .kh-footer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 23px; padding-top: 19px; border-top: 1px solid rgba(255,255,255,.1); color: rgba(255,244,236,.36); font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
        @media (max-width: 1050px) {
          .kh-hero-grid { grid-template-columns: 1fr .83fr; gap: 35px; }
          .kh-orbit { transform: scale(.86); transform-origin: center right; }
          .kh-product-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 780px) {
          .kh-container { width: min(100% - 32px, 620px); }
          .kh-nav { min-height: 72px; }
          .kh-logo { width: 112px; }
          .kh-nav-links { display: none; }
          .kh-nav-cta { padding: 10px 13px; font-size: 11px; }
          .kh-hero { min-height: auto; padding: 123px 0 63px; }
          .kh-hero-grid { grid-template-columns: 1fr; gap: 42px; }
          .kh-hero h1 { font-size: clamp(3rem, 14vw, 4.4rem); }
          .kh-hero-copy { font-size: 14px; }
          .kh-orbit { min-height: 330px; transform: scale(.78); transform-origin: top center; margin-bottom: -62px; }
          .kh-orbit-core { top: 83px; width: 145px; height: 145px; }
          .kh-orbit::before { top: 88px; left: -25px; }
          .kh-orbit::after { top: 111px; left: 26px; }
          .kh-node-1 { top: 16px; left: 0; }
          .kh-node-2 { top: 35px; right: 0; }
          .kh-node-3 { bottom: 37px; left: 5px; }
          .kh-node-4 { right: 0; bottom: 17px; }
          .kh-orbit-status { right: 11px; bottom: 76px; }
          .kh-signal { bottom: -7px; }
          .kh-proof { padding: 22px 0; }
          .kh-proof-grid { grid-template-columns: repeat(2, 1fr); gap: 18px 0; }
          .kh-proof-item, .kh-proof-item:first-child { min-height: 38px; padding: 0 12px; border-left: 1px solid rgba(18,40,63,.2); }
          .kh-proof-item:nth-child(odd) { padding-left: 0; border-left: 0; }
          .kh-proof-item:nth-child(-n+2) { padding-top: 0; }
          .kh-proof-value { font-size: 13px; }
          .kh-section { padding: 78px 0; }
          .kh-section-head { display: block; margin-bottom: 32px; }
          .kh-section-head h2 { font-size: 2.7rem; }
          .kh-section-head p { margin-top: 20px; }
          .kh-product-grid, .kh-cap-grid { grid-template-columns: 1fr; }
          .kh-sector-grid { grid-template-columns: repeat(2, 1fr); }
          .kh-sector-band-head { display: block; }
          .kh-sector-band-link { display: inline-block; margin-top: 10px; }
          .kh-product-card { min-height: 340px; }
          .kh-platform { grid-template-columns: 1fr; gap: 49px; }
          .kh-layers { margin-right: 17px; }
          .kh-cap-card { min-height: 245px; }
          .kh-flow-line { grid-template-columns: repeat(2, 1fr); gap: 35px 18px; }
          .kh-flow-line::before { display: none; }
          .kh-flow-item { padding-right: 0; }
          .kh-flow-number { width: 54px; height: 54px; margin-bottom: 17px; }
          .kh-cta { padding: 77px 0; }
          .kh-cta-inner { display: block; }
          .kh-cta h2 { font-size: 3.1rem; }
          .kh-cta p { margin: 25px 0 25px; }
          .kh-footer-main, .kh-footer-bottom { display: block; }
          .kh-footer-links { justify-content: flex-start; margin-top: 18px; }
          .kh-footer-bottom span + span { display: block; margin-top: 9px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .kytto-home *, .kytto-home *::before, .kytto-home *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
        }
      `}</style>

      <section className="kh-hero">
        <div className="kh-nav-wrap">
          <div className="kh-container kh-nav">
            <a href="#inicio" aria-label="Kytto — início"><img className="kh-logo" src="/brand/kytto-negativo.svg" alt="Kytto" /></a>
            <nav className="kh-nav-links" aria-label="Navegação principal">
              <a href="#plataforma">Plataforma</a>
              <a href="#solucoes">Soluções</a>
              <a href="/ia">IA aplicada</a>
              <a href="/ia/aijur">AIJur</a>
              <a href="#contato">Contato</a>
            </nav>
            <a className="kh-nav-cta" href={painelPath}>{painelLabel} <ArrowUpRight size={14} /></a>
          </div>
        </div>

        <div className="kh-container kh-hero-grid" id="inicio">
          <div>
            <Eyebrow light>Techco de IA aplicada · 2026</Eyebrow>
            <h1>O negócio sobe quando a <em>operação</em> aprende.</h1>
            <p className="kh-hero-copy">A Kytto conecta inteligência artificial, dados e execução para transformar operações reais em negócios mais simples, eficientes e preparados para o próximo nível.</p>
            <div className="kh-hero-actions">
              <a className="kh-btn kh-btn-primary" href="#solucoes">Conhecer soluções <ArrowRight size={17} /></a>
              <a className="kh-btn kh-btn-ghost" href={painelPath}>{painelLabel} <ArrowUpRight size={16} /></a>
            </div>
            <div className="kh-hero-note"><span /> IA no núcleo. Resultado na ponta.</div>
          </div>

          <div className="kh-orbit" aria-label="Ecossistema de soluções Kytto">
            <div className="kh-orbit-grid" />
            <div className="kh-orbit-node kh-node-1"><Factory size={15} /> Indústria</div>
            <div className="kh-orbit-node kh-node-2"><Users size={15} /> Pessoas</div>
            <div className="kh-orbit-node kh-node-3"><Workflow size={15} /> Operações</div>
            <div className="kh-orbit-node kh-node-4"><Boxes size={15} /> Negócios</div>
            <div className="kh-orbit-core"><strong>IA aplicada à operação</strong></div>
            <div className="kh-orbit-status"><b /> sistemas em produção</div>
            <div className="kh-signal">conectar · decidir · executar</div>
          </div>
        </div>
      </section>

      <section className="kh-proof" aria-label="Pilares Kytto">
        <div className="kh-container kh-proof-grid">
          {PILLARS.map(({ value, label, icon: Icon }) => (
            <div className="kh-proof-item" key={value}>
              <Icon size={21} strokeWidth={1.8} />
              <div><span className="kh-proof-value">{value}</span><span className="kh-proof-label">{label}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="kh-section kh-section-sand" id="plataforma">
        <div className="kh-container kh-platform">
          <div>
            <Eyebrow>O essencial em poucos segundos</Eyebrow>
            <h2>Uma plataforma.<br /><em>Várias frentes.</em><br />Um mesmo propósito.</h2>
            <p className="kh-platform-copy">Enquanto o mercado ainda testa pilotos, a Kytto trabalha com IA no centro de processos que precisam funcionar todos os dias. A plataforma combina produtos especialistas, dados conectados e uma camada de inteligência que aprende com a operação.</p>
            <div className="kh-platform-list">
              <div className="kh-platform-list-item"><CircleDot size={17} /> Produtos especialistas para cada contexto do negócio.</div>
              <div className="kh-platform-list-item"><CircleDot size={17} /> Uma camada de IA que conecta as decisões.</div>
              <div className="kh-platform-list-item"><CircleDot size={17} /> Evolução contínua da operação para o resultado.</div>
            </div>
          </div>
          <div className="kh-layers" aria-label="Camadas da plataforma Kytto">
            <div className="kh-layer-card"><div className="kh-layer-index">04</div><div><strong>Produtos em produção</strong><span>Indústria, pessoas, operações e negócios</span></div><div className="kh-layer-dot" /></div>
            <div className="kh-layer-card"><div className="kh-layer-index">03</div><div><strong>Dados & contexto</strong><span>O que acontece, quando acontece e por quê</span></div><div className="kh-layer-dot" /></div>
            <div className="kh-layer-card"><div className="kh-layer-index">02</div><div><strong>Agentes & copilotos</strong><span>Inteligência que sugere, decide e executa</span></div><div className="kh-layer-dot" /></div>
            <div className="kh-layer-card"><div className="kh-layer-index">01</div><div><strong>Infraestrutura confiável</strong><span>Base para escalar com segurança</span></div><div className="kh-layer-dot" /></div>
          </div>
        </div>
      </section>

      <section className="kh-section kh-section-white" id="solucoes">
        <div className="kh-container">
          <div className="kh-section-head">
            <div><Eyebrow>Portas de entrada</Eyebrow><h2>Uma solução para cada desafio.<br /><em>Uma visão para o todo.</em></h2></div>
            <p>Explore os ambientes que já levam a inteligência Kytto para a indústria, as operações, os negócios e as pessoas.</p>
          </div>
          <div className="kh-product-grid">
            {PRODUCT_LINKS.map(product => <ProductCard key={product.name} product={product} />)}
          </div>
        </div>
      </section>

      <section className="kh-sector-band" aria-label="SetPoint por setor">
        <div className="kh-container">
          <div className="kh-sector-band-head"><span className="kh-sector-band-title">SetPoint para a operação que você vive.</span><a className="kh-sector-band-link" href="/solucoes">Ver todos os setores <ArrowUpRight size={14} style={{ verticalAlign: '-3px' }} /></a></div>
          <div className="kh-sector-grid">{SECTOR_LINKS.map(({ name, icon: Icon }) => <a className="kh-sector-pill" href="/solucoes" key={name}><Icon size={17} strokeWidth={1.8} />{name}</a>)}</div>
        </div>
      </section>

      <section className="kh-section kh-capabilities" id="inteligencia">
        <div className="kh-container">
          <div className="kh-section-head">
            <div><Eyebrow light>O diferencial</Eyebrow><h2>IA que <em>age</em>,<br />não só sugere.</h2></div>
            <div><p>Inteligência aplicada só cria valor quando chega ao chão da operação — com contexto, confiança e capacidade de execução.</p><a className="kh-btn kh-btn-ghost kh-cap-link" href="/ia">Explorar o hub de IA <ArrowUpRight size={15} /></a></div>
          </div>
          <div className="kh-cap-grid">
            {CAPABILITIES.map(({ icon: Icon, eyebrow, title, text }) => (
              <article className="kh-cap-card" key={eyebrow}>
                <div className="kh-cap-icon"><Icon size={23} strokeWidth={1.8} /></div>
                <span className="kh-product-eyebrow">{eyebrow}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="kh-section kh-flow-section">
        <div className="kh-container">
          <div className="kh-section-head">
            <div><Eyebrow>Da operação para o resultado</Eyebrow><h2>Menos promessa.<br /><em>Mais movimento.</em></h2></div>
            <p>A Kytto fecha o ciclo entre informação e ação — uma arquitetura para negócios que precisam evoluir sem parar.</p>
          </div>
          <div className="kh-flow-line">
            {FLOW.map(({ number, title, text, icon: Icon }) => (
              <div className="kh-flow-item" key={number}>
                <div className="kh-flow-number"><Icon size={20} strokeWidth={1.8} /></div>
                <h3>{number} · {title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="kh-cta" id="contato">
        <div className="kh-container kh-cta-inner">
          <div><Eyebrow>Próximo passo</Eyebrow><h2>Faça o seu negócio subir.</h2></div>
          <div>
            <p>Conheça a solução que faz sentido para a sua operação hoje — e descubra até onde ela pode chegar amanhã.</p>
            <a className="kh-btn kh-btn-primary" href="#solucoes">Explorar o ecossistema <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <footer className="kh-footer">
        <div className="kh-container">
          <div className="kh-footer-main">
            <div><img className="kh-footer-logo" src="/brand/kytto-negativo.svg" alt="Kytto" /><p className="kh-footer-copy">Sistemas que fazem o negócio subir.</p></div>
            <nav className="kh-footer-links" aria-label="Links de soluções">
              {PRODUCT_LINKS.map(product => { const external = product.href.startsWith('http'); return <a key={product.name} href={product.href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{product.name}</a> })}
              <a href={painelPath}>{painelLabel}</a>
            </nav>
          </div>
          <div className="kh-footer-bottom"><span>© 2026 Kytto · IA aplicada à operação</span><span>Dados, pessoas e execução em movimento.</span></div>
        </div>
      </footer>
    </div>
  )
}
