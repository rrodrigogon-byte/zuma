import { NavLink, useNavigate } from 'react-router-dom'
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
  { to: '/admin/auditoria',   icon: '🔍', label: 'Auditoria' },
]

const NAV_PUBLIC = [
  { to: '/',           icon: '🏠', label: 'Home', end: true },
  { to: '/inscricao',  icon: '✍️', label: 'Inscrição' },
  { to: '/ranking',    icon: '🏅', label: 'Ranking' },
  { to: '/loja',       icon: '🛍️', label: 'Loja' },
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

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => isActive ? activeStyle : linkStyle}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </NavLink>
  )
}

function Section({ label, items }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: 'var(--muted)',
        padding: '8px 16px 4px', textTransform: 'uppercase', letterSpacing: '.8px',
      }}>{label}</div>
      {items.map(n => <NavItem key={n.to} {...n} />)}
    </div>
  )
}

export default function Sidebar() {
  const { user, logout, isAdmin, isStaff } = useAuth()
  const navigate = useNavigate()

  return (
    <nav style={{
      width: 220, background: 'var(--surface)', borderRight: '1px solid var(--line)',
      height: '100vh', position: 'fixed', top: 0, left: 0,
      display: 'flex', flexDirection: 'column', zIndex: 50, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 28 }}>🎾</span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--green)' }}>SetPoint</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>4ª Agro Open</div>
        </div>
      </div>

      {isStaff && <Section label="Operações" items={NAV_OP} />}
      {isAdmin  && <Section label="Admin"     items={NAV_ADMIN} />}
      <Section label="Site Público" items={NAV_PUBLIC} />

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
            <button
              className="btn btn-ghost btn-sm btn-block"
              onClick={() => { logout(); navigate('/login') }}
            >
              Sair
            </button>
          </>
        ) : (
          <NavLink to="/login" className="btn btn-primary btn-sm btn-block">
            Entrar
          </NavLink>
        )}
      </div>
    </nav>
  )
}
