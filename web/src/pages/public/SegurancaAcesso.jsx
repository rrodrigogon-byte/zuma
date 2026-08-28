import { AlertTriangle, ArrowUpRight, Camera, ClipboardCheck, FileCheck2, Fingerprint, GitBranch, MapPinned, ShieldCheck, UsersRound } from 'lucide-react'
import { ArrowButton, CheckList, Kicker, MarketingFooter, MarketingHeader, MarketingShell, OutlineButton } from './MarketingPage'

const pillars = [
  { icon: UsersRound, title: 'Gestão de terceiros', text: 'Empresas, contratos, colaboradores, subcontratadas, funções, riscos, veículos, gestores e fiscais em uma operação rastreável.' },
  { icon: ShieldCheck, title: 'Controle de acesso', text: 'Pessoas, visitantes, dispositivos, rotas, perfis, grupos, eventos, históricos, matriz de segurança e auditoria administrativa.' },
  { icon: Fingerprint, title: 'Facial e portaria', text: 'Cadastro facial, totens, pré-cadastro, autoatendimento, gestão de visitas, terminal multiportaria e liberações governadas.' },
  { icon: Camera, title: 'Visão computacional conectável', text: 'A camada pode receber câmeras e outros dispositivos homologados quando houver integração, permissões e operação validadas para o ambiente.' },
]

const flow = [
  { number: '01', icon: MapPinned, title: 'Contextualizar', text: 'Relacionar pessoa, empresa, contrato, acesso, portaria, dispositivo e janela de validade.' },
  { number: '02', icon: FileCheck2, title: 'Verificar', text: 'Conferir documentos, requisitos, riscos, identidades, políticas e evidências antes da decisão.' },
  { number: '03', icon: ClipboardCheck, title: 'Aprovar', text: 'Aplicar alçadas, perfis e revisão humana para liberar o próximo passo com responsabilidade.' },
  { number: '04', icon: GitBranch, title: 'Auditar', text: 'Registrar evento, exceção, decisão e histórico para revisão, melhoria e prestação de contas.' },
]

export default function SegurancaAcesso() {
  return <MarketingShell>
    <MarketingHeader />
    <main>
      <section className="km-hero">
        <div className="km-container km-hero-grid">
          <div>
            <Kicker light>Segurança operacional · Kytto</Kicker>
            <h1>Terceiros e acessos sob <em>contexto.</em></h1>
            <p className="km-hero-lede">A Kytto conecta gestão de terceiros, controle de acesso, facial, portaria e automações com IA para transformar cadastro, conformidade e operação física em decisões mais claras e rastreáveis.</p>
            <div className="km-actions"><ArrowButton href="/contato">Desenhar uma operação segura</ArrowButton><OutlineButton href="/ia/agentes" light>Conhecer agentes governados</OutlineButton></div>
          </div>
          <div className="km-hero-note"><strong>Inteligência com responsabilidade.</strong> A IA ajuda a ler sinais, organizar evidências e priorizar exceções. A decisão física continua sujeita a política, permissão, integração e alçada configuradas.</div>
        </div>
      </section>

      <section className="km-section">
        <div className="km-container">
          <div className="km-section-head"><div><Kicker>Uma camada para cada contexto</Kicker><h2>Da empresa terceira ao portão.</h2></div><p className="km-section-intro">A operação de segurança não começa na catraca. Ela começa antes, com identidade, documentação, função, risco, autorização e uma trilha que faça sentido.</p></div>
          <div className="km-card-grid">{pillars.map(({ icon: Icon, title, text }, index) => <article className="km-card" key={title}><span className="km-card-number">0{index + 1}</span><div><Icon size={26} color="var(--km-orange)" /><h3>{title}</h3><p>{text}</p></div></article>)}</div>
        </div>
      </section>

      <section className="km-section km-section-dark">
        <div className="km-container km-split"><div><Kicker light>O fluxo inteligente</Kicker><h2>Antes de liberar, a operação entende.</h2><p className="km-split-copy">A inteligência organiza o contexto para que equipes de RH, segurança, portaria, facilities e gestores enxerguem o que mudou, o que está pendente e qual decisão precisa acontecer.</p><OutlineButton href="/ia/dados" light>Ver dados e governança</OutlineButton></div><div className="km-list">{flow.map(({ number, icon: Icon, title, text }) => <div className="km-list-row" key={number}><b>{number}</b><div><strong><Icon size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />{title}</strong><span>{text}</span></div></div>)}</div></div>
      </section>

      <section className="km-section">
        <div className="km-container">
          <div className="km-section-head"><div><Kicker>Onde a IA entra</Kicker><h2>Automação para reduzir dúvida, não para esconder decisão.</h2></div><p className="km-section-intro">Os agentes podem apoiar leitura de evidências, classificação, priorização, alertas, validações e encaminhamento de exceções conforme os módulos, permissões e integrações disponíveis.</p></div>
          <CheckList items={['Homologação, documentos, funções, riscos, ASOs, treinamentos, medições e inspeções em um fluxo de terceiros.', 'Pessoas, visitantes, cartões, veículos, perfis, grupos, dispositivos, rotas e eventos em uma visão integrada.', 'Aprendizado facial e curadoria assistida com revisão antes de treinar ou promover uma decisão.', 'Fila humana, exceções, auditoria e revisão para os casos que não devem ser automatizados.']} />
          <div className="km-actions"><ArrowButton href="/ia/compradores">Explorar compradores inteligentes</ArrowButton><OutlineButton href="/solucoes">Ver todo o portfólio</OutlineButton></div>
        </div>
      </section>

      <section className="km-section km-section-accent">
        <div className="km-container km-accent-inner"><div><Kicker>Visão computacional</Kicker><h2>Câmeras entram quando o contexto está pronto.</h2></div><p>Integrações de câmeras, vídeo ou leitura de placas precisam de dispositivos homologados, fornecedor, permissões, segurança e operação validada. A Kytto conecta o que está pronto — sem transformar uma possibilidade em promessa.</p><a className="km-button km-button-dark" href="/contato">Avaliar uma integração <ArrowUpRight size={16} /></a></div>
      </section>

      <section className="km-section">
        <div className="km-container"><div className="km-section-head"><div><Kicker>Governança por desenho</Kicker><h2>Segurança que deixa rastro.</h2></div><p className="km-section-intro">Revogação lógica e auditável, decisões fail-closed, consentimento LGPD, minimização de dados, snapshot de emergência e sincronização externa em dry-run formam a base para evoluir com confiança.</p></div><div className="km-actions"><ArrowButton href="/contato">Conversar sobre o seu cenário</ArrowButton><OutlineButton href="/ia">Conhecer a arquitetura de IA</OutlineButton></div><p className="km-disclaimer"><AlertTriangle size={16} /> Recursos físicos, câmeras, reconhecimento facial, integrações e automações dependem de configuração, homologação, permissões e disponibilidade do ambiente.</p></div>
      </section>
    </main>
    <MarketingFooter />
  </MarketingShell>
}
