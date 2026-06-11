import { Link, useLocation } from 'react-router-dom'

const LABELS = {
  admin: 'Admin',
  torneios: 'Torneios',
  agenda: 'Agenda',
  inscricoes: 'Inscrições',
  usuarios: 'Usuários',
  socios: 'Sócios',
  cardapio: 'Cardápio',
  estoque: 'Estoque',
  mesas: 'Mesas',
  pagamentos: 'Pagamentos',
  loja: 'Loja',
  aulas: 'Aulas',
  crm: 'CRM',
  bi: 'BI',
  auditoria: 'Auditoria',
  configuracoes: 'Configurações',
  cupons: 'Cupons',
  relatorios: 'Relatórios',
}

export default function Breadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)

  if (parts.length < 2) return null

  const crumbs = parts.map((part, idx) => {
    const path = '/' + parts.slice(0, idx + 1).join('/')
    const label = LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1)
    const isLast = idx === parts.length - 1
    return { path, label, isLast }
  })

  return (
    <nav aria-label="breadcrumb" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: 'var(--muted)',
      marginBottom: 20,
    }}>
      {crumbs.map(({ path, label, isLast }, idx) => (
        <span key={path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {idx > 0 && (
            <span style={{ color: 'var(--line)', userSelect: 'none' }}>›</span>
          )}
          {isLast ? (
            <span style={{ color: 'var(--cream)', fontWeight: 500 }}>{label}</span>
          ) : (
            <Link
              to={path}
              style={{
                color: 'var(--muted)',
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--green)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
            >
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
