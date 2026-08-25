import { BarChart3, Database, LockKeyhole, Radar, ScanSearch, Scale } from 'lucide-react'
import { ArrowButton, CheckList, Kicker, MarketingFooter, MarketingHeader, MarketingShell, OutlineButton } from './MarketingPage'

const capabilities = [
  { icon: Database, title: 'Dados no contexto', text: 'Integre fontes diferentes e dê significado comum ao que acontece em cada área da operação.' },
  { icon: Radar, title: 'Observabilidade contínua', text: 'Acompanhe sinais, desvios e gargalos antes que eles virem custo ou perda de experiência.' },
  { icon: Scale, title: 'Governança por desenho', text: 'Controle acesso, origem, qualidade e uso dos dados desde o primeiro fluxo.' },
]

export default function Dados() {
  return <MarketingShell>
    <MarketingHeader />
    <main>
      <section className="km-hero"><div className="km-container km-hero-grid"><div><Kicker light>IA aplicada · dados</Kicker><h1>Decidir melhor começa por <em>enxergar inteiro.</em></h1><p className="km-hero-lede">A Kytto transforma dados espalhados em uma camada de contexto para a operação — com indicadores vivos, sinais relevantes e decisões que podem ser explicadas.</p><div className="km-actions"><ArrowButton href="/contato">Mapear meus dados</ArrowButton><OutlineButton href="/ia/agentes" light>Conhecer agentes</OutlineButton></div></div><div className="km-hero-note"><strong>Um painel não basta.</strong> A inteligência começa quando o dado chega no momento certo, para a pessoa certa, com o próximo passo visível.</div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>A camada que conecta</Kicker><h2>Indicador é o começo. Contexto é o que muda a decisão.</h2></div><p className="km-section-intro">Dados confiáveis não servem apenas para explicar o que passou. Eles ajudam a priorizar, simular e agir enquanto o trabalho acontece.</p></div><div className="km-card-grid">{capabilities.map(({ icon: Icon, title, text }, index) => <article className="km-card" key={title}><span className="km-card-number">0{index + 1}</span><div><Icon size={26} color="var(--km-orange)" /><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

      <section className="km-section km-section-dark"><div className="km-container km-split"><div><Kicker light>Da fonte ao impacto</Kicker><h2>Uma linha de visão para cada decisão.</h2><p className="km-split-copy">A arquitetura Kytto organiza a jornada do dado para que equipes técnicas, lideranças e operação trabalhem sobre a mesma realidade.</p><OutlineButton href="/solucoes" light>Ver soluções conectadas</OutlineButton></div><div className="km-list"><div className="km-list-row"><b>01</b><div><strong><ScanSearch size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Capturar</strong><span>Eventos, transações, documentos, imagens e interações entram no mesmo mapa.</span></div></div><div className="km-list-row"><b>02</b><div><strong><BarChart3 size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Interpretar</strong><span>Modelos, regras e indicadores dão sentido aos sinais da operação.</span></div></div><div className="km-list-row"><b>03</b><div><strong><LockKeyhole size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Confiar</strong><span>Permissões, origem e rastreabilidade tornam a inteligência segura para escalar.</span></div></div></div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>Resultado para o negócio</Kicker><h2>Menos opinião isolada. Mais decisão compartilhada.</h2></div><p className="km-section-intro">Conecte os pontos entre o que a empresa mede, o que a equipe percebe e o que precisa acontecer agora.</p></div><CheckList items={['Uma linguagem comum entre estratégia e operação.', 'Alertas e prioridades baseados em sinais reais.', 'Histórico e governança para aprender sem repetir o erro.']} /><div className="km-actions"><ArrowButton href="/ia">Voltar à visão de IA</ArrowButton><OutlineButton href="/contato">Conversar com especialistas</OutlineButton></div></div></section>
    </main><MarketingFooter />
  </MarketingShell>
}
