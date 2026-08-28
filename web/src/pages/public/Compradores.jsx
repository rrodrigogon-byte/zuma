import { ArrowUpRight, ClipboardCheck, Database, GitBranch, PackageSearch, ShieldCheck, ShoppingCart, Sparkles, Workflow } from 'lucide-react'
import { ArrowButton, CheckList, Kicker, MarketingFooter, MarketingHeader, MarketingShell, OutlineButton } from './MarketingPage'

const capabilities = [
  { icon: PackageSearch, title: 'Sinais de demanda', text: 'O agente organiza vendas, estoque, consumo, calendário e regras de reposição para revelar o que precisa de atenção.' },
  { icon: ShoppingCart, title: 'Compras assistidas', text: 'A inteligência estrutura cotações, listas e alternativas para que a equipe compre melhor, sem transformar recomendação em pedido automático.' },
  { icon: ShieldCheck, title: 'Políticas e alçadas', text: 'Orçamentos, fornecedores, categorias, limites e níveis de aprovação definem até onde cada agente pode atuar.' },
  { icon: Workflow, title: 'Exceções no lugar certo', text: 'Quando há ruptura, preço fora da política ou condição incomum, o fluxo escala para a pessoa responsável com contexto.' },
]

const steps = [
  { icon: Database, number: '01', title: 'Observar', text: 'Conectar os sinais disponíveis e entender o comportamento da operação.' },
  { icon: Sparkles, number: '02', title: 'Interpretar', text: 'Ler necessidade, prioridade, política e contexto antes de sugerir qualquer caminho.' },
  { icon: GitBranch, number: '03', title: 'Recomendar', text: 'Apresentar opções, impactos e justificativas para uma decisão mais rápida.' },
  { icon: ClipboardCheck, number: '04', title: 'Aprovar ou executar', text: 'Encaminhar para aprovação humana ou executar apenas dentro da autonomia configurada.' },
]

export default function Compradores() {
  return <MarketingShell>
    <MarketingHeader />
    <main>
      <section className="km-hero">
        <div className="km-container km-hero-grid">
          <div>
            <Kicker light>IA aplicada · compras inteligentes</Kicker>
            <h1>Compradores que <em>fazem a operação se antecipar.</em></h1>
            <p className="km-hero-lede">A Kytto aplica agentes inteligentes aos fluxos de compras para transformar sinais dispersos em demandas organizadas, recomendações contextualizadas e próximos passos claros.</p>
            <div className="km-actions">
              <ArrowButton href="/contato">Desenhar um fluxo de compras</ArrowButton>
              <OutlineButton href="/ia/agentes" light>Explorar agentes</OutlineButton>
            </div>
          </div>
          <div className="km-hero-note"><strong>Autonomia não é ausência de controle.</strong> O comprador inteligente trabalha com políticas, limites, rastreabilidade e aprovação nos pontos que exigem responsabilidade humana.</div>
        </div>
      </section>

      <section className="km-section">
        <div className="km-container">
          <div className="km-section-head">
            <div><Kicker>De requisição a resultado</Kicker><h2>Menos urgência. <em>Mais contexto.</em></h2></div>
            <p className="km-section-intro">Em lojas, mercados, restaurantes, serviços e PMEs, comprar bem depende de enxergar a necessidade antes que ela vire ruptura, desperdício ou retrabalho.</p>
          </div>
          <div className="km-card-grid">
            {capabilities.map(({ icon: Icon, title, text }, index) => <article className="km-card" key={title}><span className="km-card-number">0{index + 1}</span><div><Icon size={26} color="var(--km-orange)" /><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="km-section km-section-dark">
        <div className="km-container km-split">
          <div><Kicker light>O ciclo do comprador inteligente</Kicker><h2>O agente entende antes de agir.</h2><p className="km-split-copy">A inteligência não dispara uma compra no escuro. Ela percorre o processo, mostra o raciocínio operacional e deixa claro o que pode ser automatizado, o que precisa de aprovação e onde existe uma exceção.</p><OutlineButton href="/ia/dados" light>Ver dados e governança</OutlineButton></div>
          <div className="km-list">{steps.map(({ icon: Icon, number, title, text }) => <div className="km-list-row" key={number}><b>{number}</b><div><strong><Icon size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />{title}</strong><span>{text}</span></div></div>)}</div>
        </div>
      </section>

      <section className="km-section">
        <div className="km-container">
          <div className="km-section-head"><div><Kicker>Autonomia configurável</Kicker><h2>O negócio escolhe o ritmo.</h2></div><p className="km-section-intro">Cada empresa pode começar com apoio à decisão e avançar gradualmente, conforme dados, processos e equipes comprovam que o próximo nível está pronto.</p></div>
          <CheckList items={['Sugestões com justificativa, histórico e contexto da operação.', 'Aprovações e limites para proteger orçamento, política e responsabilidade.', 'Registro das ações, exceções e resultados para melhorar continuamente o fluxo.', 'Integração progressiva com catálogo, estoque, fornecedores e gestão.']} />
          <div className="km-actions"><ArrowButton href="https://setpoint.kytto.com.br/admin">Conhecer o SetPoint</ArrowButton><OutlineButton href="/solucoes">Ver soluções por setor</OutlineButton></div>
        </div>
      </section>

      <section className="km-section km-section-accent">
        <div className="km-container km-accent-inner"><div><Kicker>Compras como vantagem operacional</Kicker><h2>O melhor agente é o que melhora a decisão sem esconder o processo.</h2></div><p>Compradores inteligentes não substituem a governança do negócio. Eles dão velocidade, memória e contexto para que as pessoas responsáveis decidam melhor — e para que a operação aprenda com cada ciclo.</p><a className="km-button km-button-dark" href="/contato">Falar sobre uma aplicação <ArrowUpRight size={16} /></a></div>
      </section>
    </main>
    <MarketingFooter />
  </MarketingShell>
}
