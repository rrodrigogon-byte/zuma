import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import EmImplantacao from '../pages/admin/EmImplantacao'
import SemAcesso from '../pages/admin/SemAcesso'
import { aguardandoPermissoes, moduloOculto, permissaoQueFalta } from '../lib/permissoes-rota'
import { moduloEmImplantacao } from '../lib/disponibilidade'
import NotifBell from './NotifBell'
import EmpresaSwitcher from './EmpresaSwitcher'
import CommandPalette from './CommandPalette'
import QuickActionsMenu from './QuickActionsMenu'
import { useAuth } from '../lib/auth'
import { useMenuEmGaveta } from '../lib/modo-menu'

// Largura do menu recolhido (computador). Aberto no hover ele passa por cima do conteúdo.
const MENU_RECOLHIDO = 78

function TopBar({ gaveta = false }) {
  const { user, isStaff, isAtleta } = useAuth()
  const navigate = useNavigate()
  const [paletteAberta, setPaletteAberta] = useState(false)

  // Atalho global Ctrl+K ou Cmd+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteAberta(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!user) return null
  return (
    <>
      <div style={{
        position: 'fixed', top: 0, right: 0, left: gaveta ? 0 : MENU_RECOLHIDO,
        height: 52, background: 'var(--surface, #1e293b)',
        borderBottom: '1px solid var(--line, #334155)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: gaveta ? '0 12px 0 64px' : '0 20px', gap: 12, zIndex: 40,
        transition: 'left .2s ease',
      }} className="topbar">
        {/* Esquerda: Seletor Multi-Empresa & Status Barramento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <EmpresaSwitcher />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: 11, fontWeight: 700, color: '#10b981',
            whiteSpace: 'nowrap'
          }} className="topbar-status-badge">
            <span style={{ fontSize: 9 }}>●</span> Barramento A2 Síncrono
          </div>
        </div>

        {/* Centro: Barra de Busca Spotlight / Command Palette */}
        <button
          type="button"
          onClick={() => setPaletteAberta(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--card, #0f172a)',
            border: '1px solid var(--line, #334155)',
            color: 'var(--muted, #94a3b8)',
            cursor: 'pointer',
            fontSize: 12,
            minWidth: 260,
            maxWidth: 420,
            flex: '1 1 auto',
            justifyContent: 'space-between',
            transition: 'all .15s ease'
          }}
          className="topbar-search-btn"
          title="Abrir busca global do ERP (Ctrl+K)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔍</span>
            <span style={{ color: 'var(--muted, #94a3b8)' }}>Buscar clientes, comandas, relatórios...</span>
          </div>
          <kbd style={{
            fontSize: 10, fontWeight: 700, padding: '2px 5px',
            borderRadius: 4, background: 'var(--surface, #1e293b)',
            border: '1px solid var(--line, #334155)', color: 'var(--muted, #94a3b8)'
          }}>
            Ctrl+K
          </kbd>
        </button>

        {/* Direita: Ações Rápidas, Notificações e Usuário */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {isStaff && <QuickActionsMenu />}
          {isAtleta && (
            <button onClick={() => navigate('/meu-painel')}
              style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid var(--accent)',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              🏠 Meu Painel
            </button>
          )}
          {isStaff && <NotifBell />}
          {/* Avatar/nome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 10px', borderRadius: 8,
            border: '1px solid var(--line, #334155)', background: 'var(--card, #0f172a)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent, #6366f1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {(user.nome || user.user || '?')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream, #f8fafc)', maxWidth: 110,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.nome || user.user}
            </span>
            <span style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      <CommandPalette isOpen={paletteAberta} onClose={() => setPaletteAberta(false)} />
    </>
  )
}
export default function Layout({ children: conteudo, noSidebar = false, marketing = false }) {
  const location = useLocation()
  // módulo ainda não ligado em produção: aviso no lugar de uma tela cheia de erros 404
  const { user, permissoes, modulosOcultos, isPlatformAdmin } = useAuth()
  // módulo escondido nesta instalação (BACKOFFICE_MODULOS_OCULTOS) aparece como "em implantação"
  const emImplantacao = moduloEmImplantacao(location.pathname) || (!isPlatformAdmin && moduloOculto(location.pathname, modulosOcultos)) || null
  // tela do backoffice sem a permissão da pessoa na empresa ativa: aviso no lugar dos erros 403
  const faltando = emImplantacao ? null : permissaoQueFalta(location.pathname, permissoes)
  const children = emImplantacao ? <EmImplantacao modulo={emImplantacao} />
    : faltando ? <SemAcesso permissao={faltando} />
      // não monta a tela antes de saber se a pessoa pode (evita disparar leituras que dariam 403)
      : aguardandoPermissoes(location.pathname, permissoes) ? <div className="page" aria-busy="true" style={{ color: 'var(--muted)' }}>Carregando…</div>
        : conteudo
  // Gaveta: celular, iPad e telas de toque ou estreitas. Senão, menu recolhido que abre no hover.
  const gaveta = useMenuEmGaveta()
  // Celular: sem a barra superior (o sino e o usuário ficam no menu).
  const [celular, setCelular] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setCelular(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Páginas públicas "premium" (Home/Clube/Regulamento) têm header/hero próprios.
  // Sempre renderizam em full-bleed, inclusive para usuários autenticados; a Home
  // oferece um CTA contextual para retornar ao painel sem misturar os layouts.
  if (noSidebar || marketing) return <>{children}</>
  // Tela cheia (ex.: Agenda aberta em nova guia pelo menu): sem menu lateral nem barra superior.
  if (new URLSearchParams(location.search).get('tela') === 'cheia') {
    return <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)' }}>{children}</main>
  }

  const hasTopBar = !!user
  const topBarH = hasTopBar ? 50 : 0

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      {hasTopBar && !celular && <TopBar gaveta={gaveta} />}
      <main className={gaveta ? 'layout-main layout-main-gaveta' : 'layout-main'} style={{
        marginLeft: gaveta ? 0 : MENU_RECOLHIDO,
        marginTop: hasTopBar && !celular ? topBarH : 0,
        // No celular o botão de menu (☰) fica fixo no canto: o conteúdo começa abaixo dele
        // e respeita a área do notch/ilha do iPhone.
        paddingTop: celular ? 'calc(58px + env(safe-area-inset-top))' : 0,
        flex: 1, minWidth: 0, minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        transition: 'margin-left .2s ease',
      }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 960px) { .topbar-status-badge { display: none !important; } }
        @media (max-width: 680px) { .topbar-search-btn { display: none !important; } }
        @media (max-width: 767px) { .topbar { display: none !important; } }
        /* Gaveta com a barra superior (iPad): o ☰ entra na própria barra. */
        @media (min-width: 768px) { .hamburger { top: calc(5px + env(safe-area-inset-top)); } }
      `}</style>
    </div>
  )
}
