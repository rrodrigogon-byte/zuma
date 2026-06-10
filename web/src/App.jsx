import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'

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
const Auditoria  = lazy(() => import('./pages/admin/Auditoria'))

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
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Layout noSidebar><Login /></Layout>} />

        {/* Operacional */}
        <Route path="/pdv"      element={<Layout><PDV /></Layout>} />
        <Route path="/kds"      element={<Layout noSidebar><KDS /></Layout>} />
        <Route path="/portaria" element={<Layout noSidebar><Portaria /></Layout>} />

        {/* Admin */}
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
        <Route path="/admin/auditoria"    element={<Layout><Auditoria /></Layout>} />

        {/* Público */}
        <Route path="/"            element={<Layout><Home /></Layout>} />
        <Route path="/inscricao"  element={<Layout><Inscricao /></Layout>} />
        <Route path="/ranking"    element={<Layout><Ranking /></Layout>} />
        <Route path="/loja"       element={<Layout><Loja /></Layout>} />
        <Route path="/regulamento" element={<Layout><Regulamento /></Layout>} />
        <Route path="/bracket"    element={<Layout><Bracket /></Layout>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
