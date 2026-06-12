import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './lib/auth'

// Decide o destino do redirect da guarda: sem login → /login; logado mas sem
// permissão → home do papel (staff→/pdv, atleta→/). null = autorizado.
function gateRedirect(need, auth) {
  if (!auth.user) return '/login'
  if (need === 'org'   && !auth.isOrg)   return auth.isStaff ? '/pdv' : '/'
  if (need === 'staff' && !auth.isStaff) return '/'
  return null
}

// Guarda de rota única (need='staff' para PDV/Cozinha/Portaria, 'org' para o painel).
function Protected({ need, children }) {
  const dest = gateRedirect(need, useAuth())
  return dest ? <Navigate to={dest} replace /> : children
}

// Variante para grupo de rotas (rota-pai sem path → renderiza <Outlet/> se autorizado).
function ProtectedOutlet({ need }) {
  const dest = gateRedirect(need, useAuth())
  return dest ? <Navigate to={dest} replace /> : <Outlet />
}

const Login     = lazy(() => import('./pages/Login'))
const PDV       = lazy(() => import('./pages/PDV'))
const KDS       = lazy(() => import('./pages/KDS'))
const Portaria  = lazy(() => import('./pages/Portaria'))

const Home       = lazy(() => import('./pages/public/Home'))
const Inscricao  = lazy(() => import('./pages/public/Inscricao'))
const Ranking    = lazy(() => import('./pages/public/Ranking'))
const Loja       = lazy(() => import('./pages/public/Loja'))
const Regulamento = lazy(() => import('./pages/public/Regulamento'))
const Bracket     = lazy(() => import('./pages/public/Bracket'))
const Perfil      = lazy(() => import('./pages/public/Perfil'))
const Contato     = lazy(() => import('./pages/public/Contato'))

const NotFound   = lazy(() => import('./pages/NotFound'))

const Dashboard  = lazy(() => import('./pages/admin/Dashboard'))
const Usuarios   = lazy(() => import('./pages/admin/Usuarios'))
const Torneios   = lazy(() => import('./pages/admin/Torneios'))
const Agenda     = lazy(() => import('./pages/admin/Agenda'))
const Inscricoes = lazy(() => import('./pages/admin/Inscricoes'))
const Cardapio   = lazy(() => import('./pages/admin/Cardapio'))
const Estoque    = lazy(() => import('./pages/admin/Estoque'))
const Mesas      = lazy(() => import('./pages/admin/Mesas'))
const Socios     = lazy(() => import('./pages/admin/Socios'))
const Pagamentos = lazy(() => import('./pages/admin/Pagamentos'))
const AdminLoja  = lazy(() => import('./pages/admin/AdminLoja'))
const Aulas      = lazy(() => import('./pages/admin/Aulas'))
const CRM        = lazy(() => import('./pages/admin/CRM'))
const BI         = lazy(() => import('./pages/admin/BI'))
const Auditoria     = lazy(() => import('./pages/admin/Auditoria'))
const Configuracoes = lazy(() => import('./pages/admin/Configuracoes'))
const Cupons        = lazy(() => import('./pages/admin/Cupons'))
const Relatorios    = lazy(() => import('./pages/admin/Relatorios'))
const Noticias      = lazy(() => import('./pages/admin/Noticias'))
const Sumula        = lazy(() => import('./pages/admin/Sumula'))
const Mensalidades    = lazy(() => import('./pages/admin/Mensalidades'))
const Financeiro      = lazy(() => import('./pages/admin/Financeiro'))
const Quadras         = lazy(() => import('./pages/admin/Quadras'))
const Pontos          = lazy(() => import('./pages/admin/Pontos'))
const Contatos        = lazy(() => import('./pages/admin/Contatos'))
const AgendaQuadras   = lazy(() => import('./pages/public/AgendaQuadras'))
const NoticiasPublic  = lazy(() => import('./pages/public/Noticias'))

function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 16,
    }}>
      <div className="spinner" />
      <span style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando…</span>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Layout noSidebar><Login /></Layout>} />

        {/* Operacional (staff) — com aliases /admin/* para URLs amigáveis */}
        <Route path="/pdv"            element={<Protected need="staff"><Layout><PDV /></Layout></Protected>} />
        <Route path="/admin/pdv"      element={<Protected need="staff"><Layout><PDV /></Layout></Protected>} />
        <Route path="/kds"            element={<Protected need="staff"><Layout noSidebar><KDS /></Layout></Protected>} />
        <Route path="/admin/kds"      element={<Protected need="staff"><Layout noSidebar><KDS /></Layout></Protected>} />
        <Route path="/portaria"       element={<Protected need="staff"><Layout noSidebar><Portaria /></Layout></Protected>} />
        <Route path="/admin/portaria" element={<Protected need="staff"><Layout noSidebar><Portaria /></Layout></Protected>} />

        {/* Admin (admin/organizador) — guarda única via Outlet */}
        <Route element={<ProtectedOutlet need="org" />}>
          <Route path="/admin"              element={<Layout><Dashboard /></Layout>} />
          <Route path="/admin/usuarios"     element={<Layout><Usuarios /></Layout>} />
          <Route path="/admin/torneios"     element={<Layout><Torneios /></Layout>} />
          <Route path="/admin/agenda"       element={<Layout><Agenda /></Layout>} />
          <Route path="/admin/inscricoes"   element={<Layout><Inscricoes /></Layout>} />
          <Route path="/admin/cardapio"     element={<Layout><Cardapio /></Layout>} />
          <Route path="/admin/estoque"      element={<Layout><Estoque /></Layout>} />
          <Route path="/admin/mesas"        element={<Layout><Mesas /></Layout>} />
          <Route path="/admin/socios"       element={<Layout><Socios /></Layout>} />
          <Route path="/admin/pagamentos"   element={<Layout><Pagamentos /></Layout>} />
          <Route path="/admin/loja"         element={<Layout><AdminLoja /></Layout>} />
          <Route path="/admin/aulas"        element={<Layout><Aulas /></Layout>} />
          <Route path="/admin/crm"          element={<Layout><CRM /></Layout>} />
          <Route path="/admin/bi"           element={<Layout><BI /></Layout>} />
          <Route path="/admin/auditoria"       element={<Layout><Auditoria /></Layout>} />
          <Route path="/admin/configuracoes"  element={<Layout><Configuracoes /></Layout>} />
          <Route path="/admin/cupons"         element={<Layout><Cupons /></Layout>} />
          <Route path="/admin/relatorios"     element={<Layout><Relatorios /></Layout>} />
          <Route path="/admin/noticias"       element={<Layout><Noticias /></Layout>} />
          <Route path="/admin/sumula"         element={<Layout><Sumula /></Layout>} />
          <Route path="/admin/mensalidades"   element={<Layout><Mensalidades /></Layout>} />
          <Route path="/admin/financeiro"     element={<Layout><Financeiro /></Layout>} />
          <Route path="/admin/quadras"        element={<Layout><Quadras /></Layout>} />
          <Route path="/admin/pontos"         element={<Layout><Pontos /></Layout>} />
          <Route path="/admin/contatos"       element={<Layout><Contatos /></Layout>} />
        </Route>

        {/* Público */}
        <Route path="/"            element={<Layout><Home /></Layout>} />
        <Route path="/inscricao"  element={<Layout><Inscricao /></Layout>} />
        <Route path="/ranking"    element={<Layout><Ranking /></Layout>} />
        <Route path="/loja"       element={<Layout><Loja /></Layout>} />
        <Route path="/regulamento" element={<Layout><Regulamento /></Layout>} />
        <Route path="/bracket"    element={<Layout><Bracket /></Layout>} />
        <Route path="/perfil"     element={<Layout><Perfil /></Layout>} />
        <Route path="/contato"    element={<Layout><Contato /></Layout>} />
        <Route path="/noticias"   element={<Layout><NoticiasPublic /></Layout>} />
        <Route path="/quadras"    element={<Layout><AgendaQuadras /></Layout>} />

        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
