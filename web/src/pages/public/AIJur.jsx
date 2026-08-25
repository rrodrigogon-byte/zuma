import { Archive, BrainCircuit, FileCheck2, Gavel, LockKeyhole, Scale } from 'lucide-react'
import { ArrowButton, CheckList, Kicker, MarketingFooter, MarketingHeader, MarketingShell, OutlineButton } from './MarketingPage'

const modules = [
  { icon: FileCheck2, title: 'Documentos e evidências', text: 'Organização, busca e contexto para que a informação jurídica deixe de ficar espalhada.' },
  { icon: Gavel, title: 'Prazos e assuntos', text: 'Acompanhamento de matérias, tarefas e compromissos com mais visibilidade para o time.' },
  { icon: LockKeyhole, title: 'Governança por padrão', text: 'Permissões, auditoria e proteção de dados como parte da experiência, não como remendo.' },
]

export default function AIJur() {
  return <MarketingShell>
    <MarketingHeader />
    <main>
      <section className="km-hero"><div className="km-container km-hero-grid"><div><Kicker light>Kytto · AIJur</Kicker><h1>Inteligência para o jurídico <em>trabalhar com contexto.</em></h1><p className="km-hero-lede">O AIJur organiza informação, processos e responsabilidades para apoiar escritórios e departamentos jurídicos em uma operação mais previsível, segura e preparada para escalar.</p><div className="km-actions"><ArrowButton href="/contato">Conhecer o AIJur</ArrowButton><OutlineButton href="/ia" light>Ver a tese de IA</OutlineButton></div></div><div className="km-hero-note"><strong>Inteligência com responsabilidade.</strong> O AIJur apoia profissionais do Direito; não substitui análise, estratégia ou responsabilidade jurídica humana.</div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>O jurídico como operação</Kicker><h2>Menos tempo procurando. Mais tempo pensando.</h2></div><p className="km-section-intro">Quando clientes, assuntos, documentos, prazos e tarefas conversam entre si, o time ganha uma visão mais clara do trabalho que precisa acontecer.</p></div><div className="km-card-grid">{modules.map(({ icon: Icon, title, text }, index) => <article className="km-card" key={title}><span className="km-card-number">0{index + 1}</span><div><Icon size={26} color="var(--km-orange)" /><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

      <section className="km-section km-section-dark"><div className="km-container km-split"><div><Kicker light>Onde a IA ajuda</Kicker><h2>Do acervo à próxima ação.</h2><p className="km-split-copy">O núcleo de inteligência ajuda a localizar contexto, destacar pendências e apoiar o trabalho do time — sempre com trilha, permissão e revisão profissional.</p><OutlineButton href="/ia/agentes" light>Ver agentes responsáveis</OutlineButton></div><div className="km-list"><div className="km-list-row"><b>01</b><div><strong><Archive size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Organizar</strong><span>Estruture clientes, assuntos, documentos, prazos e tarefas em uma visão única.</span></div></div><div className="km-list-row"><b>02</b><div><strong><BrainCircuit size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Apoiar</strong><span>Encontre sinais e informações relevantes para preparar o próximo trabalho.</span></div></div><div className="km-list-row"><b>03</b><div><strong><Scale size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Rastrear</strong><span>Preserve contexto, acesso e histórico para decisões mais confiáveis.</span></div></div></div></div></section>

      <section className="km-section"><div className="km-container"><div className="km-section-head"><div><Kicker>Próximo passo</Kicker><h2>Uma operação jurídica pronta para a próxima camada de inteligência.</h2></div><p className="km-section-intro">O AIJur é a aplicação da tese Kytto em um domínio onde contexto, confidencialidade e responsabilidade importam em cada detalhe.</p></div><CheckList items={['Multi-tenant e controle de acesso por desenho.', 'Auditoria e proteção de dados no fluxo.', 'IA como apoio verificável ao trabalho de profissionais.']} /><div className="km-actions"><ArrowButton href="/contato">Falar sobre o AIJur</ArrowButton><OutlineButton href="/solucoes">Ver o portfólio Kytto</OutlineButton></div></div></section>
    </main><MarketingFooter />
  </MarketingShell>
}
