import { BrainCircuit, Database, Eye, GitBranch, Layers3, ShieldCheck, Sparkles } from 'lucide-react'
import {
  ArrowButton,
  CheckList,
  Kicker,
  MarketingFooter,
  MarketingHeader,
  MarketingShell,
  OutlineButton,
} from './MarketingPage'

const pillars = [
  { icon: BrainCircuit, number: '01', title: 'Inteligência contextual', text: 'Modelos e agentes que entendem o processo, o momento e as regras do negócio antes de agir.' },
  { icon: Database, number: '02', title: 'Dados conectados', text: 'Uma camada de dados que une operação, pessoas, ativos e resultados em uma visão contínua.' },
  { icon: GitBranch, number: '03', title: 'Execução no fluxo', text: 'Tecnologia que sai do piloto e entra no trabalho real, com rastreabilidade e melhoria constante.' },
]

const signals = [
  { icon: Eye, title: 'Ver', text: 'Capturar sinais do mundo físico e digital.' },
  { icon: Layers3, title: 'Entender', text: 'Transformar eventos em contexto acionável.' },
  { icon: Sparkles, title: 'Agir', text: 'Executar o próximo passo com inteligência.' },
  { icon: ShieldCheck, title: 'Governar', text: 'Escalar inovação com confiança.' },
]

export default function IA() {
  return (
    <MarketingShell>
      <MarketingHeader />
      <main>
        <section className="km-hero">
          <div className="km-container km-hero-grid">
            <div>
              <Kicker light>IA aplicada · Kytto</Kicker>
              <h1>Inteligência que <em>entra em campo.</em></h1>
              <p className="km-hero-lede">A Kytto conecta inteligência artificial, dados e operação para transformar decisões em movimento — do back-office à planta, das pessoas ao ponto de venda.</p>
              <div className="km-actions">
                <ArrowButton href="/solucoes">Conhecer as soluções</ArrowButton>
                <OutlineButton href="/ia/agentes" light>Explorar agentes</OutlineButton>
                <OutlineButton href="/ia/compradores" light>Conhecer compradores</OutlineButton>
              </div>
            </div>
            <div className="km-hero-note">
              <strong>Não é IA no slide.</strong>
              É software conectado a processos reais, com contexto, governança e responsabilidade sobre o próximo passo.
            </div>
          </div>
        </section>

        <section className="km-section">
          <div className="km-container">
            <div className="km-section-head">
              <div><Kicker>A tese Kytto</Kicker><h2>Do dado disperso à decisão que acontece.</h2></div>
              <p className="km-section-intro">Toda operação já produz sinais. Nosso trabalho é criar a inteligência que conecta esses sinais, entende o contexto e ajuda o negócio a executar melhor.</p>
            </div>
            <div className="km-card-grid">
              {pillars.map(({ icon: Icon, number, title, text }) => <article className="km-card" key={title}><span className="km-card-number">{number}</span><div><Icon size={24} color="var(--km-orange)" /><h3>{title}</h3><p>{text}</p></div></article>)}
            </div>
          </div>
        </section>

        <section className="km-section km-section-dark">
          <div className="km-container km-split">
            <div><Kicker light>O sistema nervoso da operação</Kicker><h2>Uma arquitetura para ver, entender e agir.</h2><p className="km-split-copy">A inteligência ganha valor quando está perto de quem decide e dentro de quem executa. Por isso, desenhamos soluções que integram agentes, observabilidade, automação e pessoas.</p><OutlineButton href="/ia/dados" light>Conhecer a camada de dados</OutlineButton></div>
            <div className="km-list">
              {signals.map(({ icon: Icon, title, text }, index) => <div className="km-list-row" key={title}><b>0{index + 1}</b><div><strong><Icon size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />{title}</strong><span>{text}</span></div></div>)}
            </div>
          </div>
        </section>

        <section className="km-section">
          <div className="km-container">
            <div className="km-section-head"><div><Kicker>Comece por onde dói</Kicker><h2>IA aplicada a problemas que já existem.</h2></div><p className="km-section-intro">Automatize o repetitivo, dê contexto ao complexo e crie uma operação mais preparada para o próximo ciclo.</p></div>
            <CheckList items={['Processos mais rápidos, sem perder o controle.', 'Indicadores que apontam o próximo passo, não apenas o passado.', 'Experiências melhores para clientes, equipes e gestores.']} />
            <div className="km-actions"><ArrowButton href="/ia/agentes">Ver agentes em ação</ArrowButton><OutlineButton href="/ia/compradores">Ver compradores inteligentes</OutlineButton><OutlineButton href="/contato">Conversar sobre um desafio</OutlineButton></div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </MarketingShell>
  )
}
