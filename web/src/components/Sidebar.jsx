import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'

const NAV_OP = [
  { to: '/pdv',      icon: '🛒', label: 'PDV' },
  { to: '/kds',      icon: '👨‍🍳', label: 'Cozinha' },
  { to: '/portaria', icon: '🎫', label: 'Portaria' },
]

const NAV_ADMIN = [
  { to: '/admin',             icon: '📊', label: 'Dashboard', end: true },
  { to: '/admin/torneios',    icon: '🎾', label: 'Torneios' },
  { to: '/admin/agenda',      icon: '📅', label: 'Agenda' },
  { to: '/admin/inscricoes',  icon: '📋', label: 'Inscrições' },
  { to: '/admin/usuarios',    icon: '👥', label: 'Usuários' },
  { to: '/admin/socios',      icon: '🏆', label: 'Sócios' },
  { to: '/admin/cardapio',    icon: '🍽️', label: 'Cardápio' },
  { to: '/admin/estoque',     icon: '📦', label: 'Estoque' },
  { to: '/admin/mesas',       icon: '🪑', label: 'Mesas' },
  { to: '/admin/pagamentos',  icon: '💳', label: 'Pagamentos' },
  { to: '/admin/loja',        icon: '🛍️', label: 'Loja' },
  { to: '/admin/aulas',       icon: '🎓', label: 'Aulas' },
  { to: '/admin/crm',         icon: '📈', label: 'CRM' },
  { to: '/admin/bi',          icon: '📉', label: 'BI' },
  { to: '/admin/auditoria',      icon: '🔍', label: 'Auditoria' },
  { to: '/admin/configuracoes', icon: '⚙️', label: 'Configurações' },
  { to: '/admin/cupons',        icon: '🎟️', label: 'Cupons' },
  { to: '/admin/relatorios',    icon: '📄', label: 'Relatórios' },
  { to: '/admin/noticias',      icon: '📰', label: 'Notícias' },
  { to: '/admin/sumula',        icon: '🎾', label: 'Súmula' },
  { to: '/admin/mensalidades',  icon: '💳', label: 'Mensalidades' },
  { to: '/admin/financeiro',    icon: '💰', label: 'Financeiro' },
  { to: '/admin/quadras',       icon: '🏟️', label: 'Quadras' },
  { to: '/admin/pontos',        icon: '⭐', label: 'Pontos' },
]

const NAV_PUBLIC = [
  { to: '/',            icon: '🏠', label: 'Home', end: true },
  { to: '/inscricao',   icon: '✍️', label: 'Inscrição' },
  { to: '/ranking',     icon: '🏅', label: 'Ranking' },
  { to: '/regulamento', icon: '📜', label: 'Regulamento' },
  { to: '/bracket',     icon: '🎯', label: 'Chaves' },
  { to: '/loja',        icon: '🛍️', label: 'Loja' },
  { to: '/contato',     icon: '📞', label: 'Contato' },
  { to: '/noticias',    icon: '📰', label: 'Notícias' },
  { to: '/quadras',     icon: '🏟️', label: 'Quadras' },
]

const linkStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  color: 'var(--muted)', transition: 'all .1s',
}
const activeStyle = {
  ...linkStyle,
  background: 'rgba(95,179,53,.12)', color: 'var(--green)',
  borderLeft: '3px solid var(--green)',
}

function NavItem({ to, icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => isActive ? activeStyle : linkStyle}
      onClick={onClick}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </NavLink>
  )
}

function Section({ label, items, onNavClick }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: 'var(--muted)',
        padding: '8px 16px 4px', textTransform: 'uppercase', letterSpacing: '.8px',
      }}>{label}</div>
      {items.map(n => <NavItem key={n.to} {...n} onClick={onNavClick} />)}
    </div>
  )
}

export default function Sidebar() {
  const { user, logout, isAdmin, isStaff, isAtleta } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Close sidebar on nav (mobile)
  const handleNavClick = () => {
    if (isMobile) setOpen(false)
  }

  const sidebarStyle = {
    width: 220,
    background: 'var(--surface)',
    borderRight: '1px solid var(--line)',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflowY: 'auto',
    transition: 'transform .25s ease',
    ...(isMobile && !open ? { transform: 'translateX(-100%)' } : { transform: 'translateX(0)' }),
  }

  return (
    <>
      {/* Hamburger button — mobile only */}
      {isMobile && (
        <button
          className="hamburger"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
      )}

      {/* Overlay */}
      <div
        className={`sidebar-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
      />

      <nav style={sidebarStyle}>
        {/* Logo + close button (mobile) */}
        <div style={{
          padding: '18px 16px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 28 }}>🎾</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--green)' }}>SetPoint</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>4ª Agro Open</div>
          </div>
          {isMobile && (
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 20, cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
              }}
              aria-label="Fechar menu"
            >
              ✕
            </button>
          )}
        </div>

        {isStaff && <Section label="Operações" items={NAV_OP} onNavClick={handleNavClick} />}
        {isAdmin  && <Section label="Admin"     items={NAV_ADMIN} onNavClick={handleNavClick} />}
        <Section label="Site Público" items={NAV_PUBLIC} onNavClick={handleNavClick} />

        {/* Bottom user area */}
        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          {user ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>
                  {user.nome || user.user}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase' }}>
                  {user.role}
                </div>
              </div>
              {isAtleta && (
                <NavLink
                  to="/perfil"
                  style={({ isActive }) => ({
                    display: 'block',
                    textAlign: 'center',
                    padding: '7px 10px',
                    marginBottom: 8,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    background: isActive ? 'rgba(95,179,53,.18)' : 'rgba(95,179,53,.08)',
                    color: 'var(--green)',
                    border: '1px solid rgba(95,179,53,.2)',
                    transition: 'background 0.15s',
                  })}
                  onClick={handleNavClick}
                >
                  👤 Meu Perfil
                </NavLink>
              )}
              <button
                className="btn btn-ghost btn-sm btn-block"
                onClick={() => { logout(); navigate('/login') }}
              >
                Sair
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm btn-block" onClick={handleNavClick}>
              Entrar
            </NavLink>
          )}
        </div>
      </nav>
    </>
  )
}
