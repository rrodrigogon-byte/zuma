import { ArrowRight, ArrowUpRight, CircleDot } from 'lucide-react'
import './marketing.css'

export const PRODUCT_LINKS = [
  { name: 'GemOps', label: 'Ops & automação', href: 'https://gemops-digital-108835006988.us-central1.run.app/app' },
  { name: 'LakeX', label: 'Indústria & inteligência', href: 'https://lakex.com.br' },
  { name: 'SetPoint', label: 'Operação & gestão', href: 'https://setpoint.kytto.com.br/admin' },
  { name: 'JURAI', label: 'Pessoas & performance', href: 'https://ai-nossagente-web-nedqnqyahq-rj.a.run.app/login' },
  { name: 'Kytto Commerce', label: 'Comércio & operação', href: 'https://loja.kytto.com.br/' },
  { name: 'MedFocus.IA', label: 'Saúde & educação médica', href: 'https://medfocus.ia.br/' },
  { name: 'AIJur', label: 'Jurídico & governança', href: '/ia/aijur' },
  { name: 'Kytto Access', label: 'Terceiros, acesso & portaria', href: '/solucoes/seguranca-acesso' },
]

export function MarketingHeader({ dark = true }) {
  return (
    <header className={`km-header${dark ? ' km-header-dark' : ''}`}>
      <div className="km-container km-header-inner">
        <a href="/" className="km-logo-link" aria-label="Kytto — início">
          <img src="/brand/kytto-negativo.svg" alt="Kytto" className="km-logo" />
        </a>
        <nav className="km-nav" aria-label="Navegação institucional">
          <a href="/ia">IA aplicada</a>
          <a href="/ia/agentes">Agentes</a>
          <a href="/ia/compradores">Compradores</a>
          <a href="/ia/dados">Dados</a>
          <a href="/ia/aijur">AIJur</a>
          <a href="/solucoes">Soluções</a>
        </nav>
        <a className="km-header-cta" href="/login">Acessar portal <ArrowUpRight size={14} /></a>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="km-footer">
      <div className="km-container">
        <div className="km-footer-main">
          <div>
            <a href="/" aria-label="Kytto — início"><img src="/brand/kytto-negativo.svg" alt="Kytto" className="km-footer-logo" /></a>
            <p>Sistemas que fazem o negócio subir.</p>
          </div>
          <div className="km-footer-column">
            <span>Explorar</span>
            <a href="/ia">IA aplicada</a>
            <a href="/ia/agentes">Agentes autônomos</a>
            <a href="/ia/compradores">Compradores inteligentes</a>
            <a href="/solucoes/seguranca-acesso">Terceiros e acesso</a>
            <a href="/ia/dados">Dados e decisões</a>
            <a href="/solucoes">Portfólio Kytto</a>
          </div>
          <div className="km-footer-column">
            <span>Soluções</span>
            {PRODUCT_LINKS.map(product => { const external = product.href.startsWith('http'); return <a key={product.name} href={product.href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{product.name}</a> })}
          </div>
        </div>
        <div className="km-footer-bottom">
          <span>© 2026 Kytto · IA aplicada à operação</span>
          <span>Dados, pessoas e execução em movimento.</span>
        </div>
      </div>
    </footer>
  )
}

export function Kicker({ children, light = false }) {
  return <div className={`km-kicker${light ? ' km-kicker-light' : ''}`}><span />{children}</div>
}

export function ArrowButton({ href, children, dark = false }) {
  return <a className={`km-button${dark ? ' km-button-dark' : ''}`} href={href}>{children}<ArrowRight size={17} /></a>
}

export function OutlineButton({ href, children, light = false }) {
  return <a className={`km-button km-button-outline${light ? ' km-button-outline-light' : ''}`} href={href}>{children}<ArrowUpRight size={16} /></a>
}

export function CheckList({ items }) {
  return <div className="km-check-list">{items.map(item => <div className="km-check-item" key={item}><CircleDot size={16} />{item}</div>)}</div>
}

export function MarketingShell({ children, className = '' }) {
  return <div className={`kytto-marketing ${className}`}>{children}</div>
}
