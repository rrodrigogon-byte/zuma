import { ArrowUpRight, Beer, BriefcaseBusiness, Building2, CheckCircle2, CircleDollarSign, Scissors, ShoppingBag, Store, Utensils } from 'lucide-react'
import { ArrowButton, Kicker, MarketingFooter, MarketingHeader, MarketingShell, OutlineButton, PRODUCT_LINKS } from './MarketingPage'

const sectors = [
  { icon: Scissors, name: 'Barbearias & salões', text: 'Agenda, clientes, serviços, profissionais, comissões e recorrência em um fluxo simples.' },
  { icon: ShoppingBag, name: 'Mercados', text: 'Produtos, estoque, validade, compras, vendas e visão de margem para cada loja.' },
  { icon: Store, name: 'Lojas & varejo', text: 'PDV, clientes, catálogo, operação de loja e relacionamento em um só lugar.' },
  { icon: Utensils, name: 'Restaurantes', text: 'Cardápio, mesas, comandas, ficha técnica, cozinha e delivery conectados.' },
  { icon: Beer, name: 'Bares & eventos', text: 'Atendimento, estoque, experiências e operação em tempo real para cada ocasião.' },
  { icon: Building2, name: 'Operações multinegócio', text: 'Contextos diferentes, uma camada de gestão para crescer com controle.' },
  { icon: BriefcaseBusiness, name: 'Escritórios jurídicos', text: 'Inteligência, documentos, prazos e governança com o AIJur.' },
  { icon: CircleDollarSign, name: 'Centros de serviço', text: 'Processos, pessoas e indicadores alinhados ao resultado do dia a dia.' },
]

export default function Solucoes() {
  return <MarketingShell>
    <MarketingHeader />
    <main>
      <section className="km-hero"><div className="km-container km-hero-grid"><div><Kicker light>Portfólio Kytto</Kicker><h1>Uma plataforma. <em>Muitos negócios.</em></h1><p className="km-hero-lede">A mesma inteligência que organiza uma barbearia pode dar clareza a um mercado, acelerar um restaurante e conectar uma operação multinegócio.</p><div className="km-actions"><ArrowButton href="https://setpoint.kytto.com.br/admin">Abrir SetPoint</ArrowButton><OutlineButton href="/ia" light>Conhecer a IA Kytto</OutlineButton></div></div><div className="km-hero-note"><strong>Feito para a operação real.</strong> Produtos e setores diferentes compartilham uma mesma necessidade: saber o que está acontecendo e agir melhor a cada dia.</div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>SetPoint multissetorial</Kicker><h2>O contexto muda. A inteligência acompanha.</h2></div><p className="km-section-intro">Escolha o setor. A plataforma se adapta ao seu fluxo de trabalho, às suas pessoas e aos indicadores que realmente importam.</p></div><div className="km-sector-grid">{sectors.map(({ icon: Icon, name, text }) => <article className="km-sector" key={name}><Icon className="km-sector-icon" size={26} strokeWidth={1.6} /><div><strong>{name}</strong><span>{text}</span></div></article>)}</div></div></section>

      <section className="km-section km-section-dark"><div className="km-container km-split"><div><Kicker light>O ecossistema</Kicker><h2>As soluções conversam para o negócio avançar.</h2><p className="km-split-copy">A Kytto reúne software operacional, IA aplicada e dados conectados. Cada solução tem uma função clara — juntas, criam uma visão mais completa do negócio.</p><OutlineButton href="/ia" light>Ver como a IA conecta tudo</OutlineButton></div><div className="km-list">{PRODUCT_LINKS.map((product, index) => <div className="km-list-row" key={product.name}><b>0{index + 1}</b><div><strong>{product.name}</strong><span>{product.label}. <a href={product.href} target="_blank" rel="noreferrer" style={{ color: 'var(--km-acid)', textDecoration: 'none' }}>Acessar solução <ArrowUpRight size={13} style={{ verticalAlign: '-2px' }} /></a></span></div></div>)}<div className="km-list-row"><b>05</b><div><strong>AIJur</strong><span>Inteligência jurídica aplicada. <a href="/ia/aijur" style={{ color: 'var(--km-acid)', textDecoration: 'none' }}>Conhecer o produto <ArrowUpRight size={13} style={{ verticalAlign: '-2px' }} /></a></span></div></div></div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>Uma base para crescer</Kicker><h2>Comece com uma frente. Conecte o resto no tempo certo.</h2></div><p className="km-section-intro">A evolução não precisa esperar um grande projeto. A Kytto entra pelo desafio mais urgente e cria espaço para a próxima camada.</p></div><div className="km-card-grid"><article className="km-card"><CheckCircle2 size={25} color="var(--km-orange)" /><h3>Operação</h3><p>Organize o trabalho que acontece todos os dias com o SetPoint.</p></article><article className="km-card"><CheckCircle2 size={25} color="var(--km-orange)" /><h3>Inteligência</h3><p>Automatize e dê contexto com agentes e dados conectados.</p></article><article className="km-card"><CheckCircle2 size={25} color="var(--km-orange)" /><h3>Escala</h3><p>Integre equipes, unidades e decisões em uma visão de negócio.</p></article></div><div className="km-actions"><ArrowButton href="/contato">Falar com a Kytto</ArrowButton><OutlineButton href="/ia/aijur">Explorar AIJur</OutlineButton></div></div></section>
    </main><MarketingFooter />
  </MarketingShell>
}
