import { Bot, Check, ChevronRight, ClipboardCheck, MessageSquareText, Workflow } from 'lucide-react'
import { ArrowButton, CheckList, Kicker, MarketingFooter, MarketingHeader, MarketingShell, OutlineButton } from './MarketingPage'

const useCases = [
  { icon: MessageSquareText, title: 'Copilotos de decisão', text: 'Respostas com contexto de negócio, histórico e regras — para que cada pessoa avance mais rápido.' },
  { icon: Workflow, title: 'Fluxos que se movem', text: 'Agentes que abrem tarefas, organizam exceções, atualizam sistemas e pedem aprovação quando necessário.' },
  { icon: ClipboardCheck, title: 'Controle no detalhe', text: 'Trilhas de auditoria, limites de autonomia e revisão humana para os momentos que exigem julgamento.' },
]

const steps = ['Observar o processo e suas exceções.', 'Entender a intenção e as regras de negócio.', 'Propor ou executar a próxima ação.', 'Aprender com o resultado, sem perder rastreabilidade.']

export default function Agentes() {
  return <MarketingShell>
    <MarketingHeader />
    <main>
      <section className="km-hero">
        <div className="km-container km-hero-grid">
          <div><Kicker light>IA aplicada · agentes</Kicker><h1>Agentes que <em>fazem avançar.</em></h1><p className="km-hero-lede">Automação não é tirar pessoas do processo. É devolver tempo para que elas decidam melhor, enquanto a inteligência cuida do próximo passo repetitivo.</p><div className="km-actions"><ArrowButton href="/contato">Desenhar um agente</ArrowButton><OutlineButton href="/ia" light>Voltar à IA aplicada</OutlineButton></div></div>
          <div className="km-hero-note"><strong>Autonomia com contexto.</strong> Cada agente nasce com uma função clara, uma fronteira de atuação e uma trilha para que o negócio saiba o que aconteceu.</div>
        </div>
      </section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>Além do chatbot</Kicker><h2>Agentes trabalham dentro do seu fluxo.</h2></div><p className="km-section-intro">Da primeira pergunta à última aprovação, a Kytto conecta inteligência a sistemas, pessoas e regras existentes.</p></div><div className="km-card-grid">{useCases.map(({ icon: Icon, title, text }, index) => <article className="km-card" key={title}><span className="km-card-number">0{index + 1}</span><div><Icon size={26} color="var(--km-orange)" /><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

      <section className="km-section km-section-dark"><div className="km-container km-split"><div><Kicker light>Como funciona</Kicker><h2>O agente não improvisa. Ele aprende o caminho.</h2><p className="km-split-copy">A inteligência trabalha com dados e instruções verificáveis, começa pequena e ganha autonomia conforme o processo prova que está pronto.</p><OutlineButton href="/ia/dados" light>Ver dados e governança</OutlineButton></div><div className="km-list">{steps.map((step, index) => <div className="km-list-row" key={step}><b>0{index + 1}</b><div><strong>{step}</strong><span>{index === 0 ? 'Mapeamento de entradas, sistemas e pontos de decisão.' : index === 1 ? 'Contexto, políticas e objetivos tornam a resposta útil.' : index === 2 ? 'Ação com aprovação humana ou autonomia controlada.' : 'Métricas, feedback e melhoria contínua do fluxo.'}</span></div></div>)}</div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>O que fica</Kicker><h2>Mais fluxo. Menos fricção.</h2></div><p className="km-section-intro">Agentes bem desenhados não escondem a complexidade: tornam o trabalho mais legível, previsível e escalável.</p></div><CheckList items={['Menos tarefas manuais e mais foco no que exige decisão.', 'Escalonamento automático de exceções para as pessoas certas.', 'Métricas que mostram tempo economizado e qualidade do processo.']} /><div className="km-actions"><ArrowButton href="/solucoes">Ver aplicações por setor</ArrowButton><OutlineButton href="/contato">Falar com a Kytto</OutlineButton></div></div></section>
    </main><MarketingFooter />
  </MarketingShell>
}
