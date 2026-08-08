import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import NotifBell from './NotifBell'
import { useAuth } from '../lib/auth'

function TopBar() {
  const { user, isStaff, isAtleta, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, left: 220,
      height: 50, background: 'var(--surface)',
      borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 20px', gap: 10, zIndex: 40,
    }} className="topbar">
      {/* Atleta: botão painel */}
      {isAtleta && (
        <button onClick={() => navigate('/meu-painel')}
          style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(255,107,44,.3)',
            background: 'rgba(255,107,44,.08)', color: 'var(--green)',
            cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          🏠 Meu Painel
        </button>
      )}

      {/* Bell de notificações (staff/admin) */}
      {isStaff && <NotifBell />}

      {/* Avatar/nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 10px', borderRadius: 8,
        border: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%',
          background: 'var(--green)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>
          {(user.nome || user.user || '?')[0].toUpperCase()}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream)', maxWidth: 120,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.nome || user.user}
        </span>
        <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>
          {user.role}
        </span>
      </div>
    </div>
  )
}

export default function Layout({ children, noSidebar = false, marketing = false }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { user } = useAuth()

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Páginas públicas "premium" (Home/Clube/Regulamento) têm header/hero próprios.
  // Para visitante anônimo, renderiza full-bleed (sem a barra admin de 220px, que
  // espremia o layout). Usuário logado mantém a Sidebar para voltar ao painel.
  if (noSidebar || (marketing && !user)) return <>{children}</>

  const hasTopBar = !!user
  const topBarH = hasTopBar ? 50 : 0

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      {hasTopBar && !isMobile && <TopBar />}
      <main style={{
        marginLeft: isMobile ? 0 : 220,
        marginTop: hasTopBar && !isMobile ? topBarH : 0,
        flex: 1, minHeight: '100vh',
      }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 767px) { .topbar { display: none !important; } }
      `}</style>
    </div>
  )
}
