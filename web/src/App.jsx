import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './lib/auth'

// Redireciona atletas logados para o portal e não-atletas para a página pública de perfil
function PerfilRoute() {
  const { user, isAtleta } = useAuth()
  if (user && isAtleta) return <Navigate to="/meu-painel" replace />
  return <Layout><Perfil /></Layout>
}

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

// A rota raiz é institucional apenas para visitantes. Uma sessão operacional
// não pode permanecer na landing, especialmente em mobile: administradores vão
// ao painel completo e colaboradores ao PDV.
function EntradaPrincipal() {
  const auth = useAuth()
  if (auth.user && auth.isOrg) return <Navigate to="/admin" replace />
  if (auth.user && auth.isStaff) return <Navigate to="/pdv" replace />
  return <Layout marketing><Home /></Layout>
}

const Login      = lazy(() => import('./pages/Login'))
const PDV        = lazy(() => import('./pages/PDV'))
const KDS        = lazy(() => import('./pages/KDS'))
const Portaria   = lazy(() => import('./pages/Portaria'))
const GarcomView = lazy(() => import('./pages/GarcomView'))
const LojaAtendimento = lazy(() => import('./pages/admin/LojaAtendimento'))

const Home       = lazy(() => import('./pages/public/Home'))
const Inscricao  = lazy(() => import('./pages/public/Inscricao'))
const Ranking    = lazy(() => import('./pages/public/Ranking'))
const Loja       = lazy(() => import('./pages/public/Loja'))
const Regulamento = lazy(() => import('./pages/public/Regulamento'))
const Bracket     = lazy(() => import('./pages/public/Bracket'))
const AcompanharPedido = lazy(() => import('./pages/public/AcompanharPedido'))
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
const FichasTecnicas = lazy(() => import('./pages/admin/FichasTecnicas'))
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
const RelatoriosOperacionais = lazy(() => import('./pages/admin/RelatoriosOperacionais'))
const Noticias      = lazy(() => import('./pages/admin/Noticias'))
const Sumula        = lazy(() => import('./pages/admin/Sumula'))
const Mensalidades    = lazy(() => import('./pages/admin/Mensalidades'))
const Financeiro      = lazy(() => import('./pages/admin/Financeiro'))
const Quadras         = lazy(() => import('./pages/admin/Quadras'))
const Pontos          = lazy(() => import('./pages/admin/Pontos'))
const AdminRanking    = lazy(() => import('./pages/admin/AdminRanking'))
const AdminLigas      = lazy(() => import('./pages/admin/AdminLigas'))
const Contatos        = lazy(() => import('./pages/admin/Contatos'))
const Lojas           = lazy(() => import('./pages/admin/Lojas'))
const NotasFiscais    = lazy(() => import('./pages/admin/NotasFiscais'))
const PDVOffline      = lazy(() => import('./pages/admin/PDVOffline'))
const Oficina         = lazy(() => import('./pages/admin/Oficina'))
const Agropecuaria    = lazy(() => import('./pages/admin/Agropecuaria'))
const Varejo          = lazy(() => import('./pages/admin/Varejo'))
const Compras         = lazy(() => import('./pages/admin/Compras'))
const ConfiguracaoFiscal = lazy(() => import('./pages/admin/ConfiguracaoFiscal'))
const ClassificacaoFiscal = lazy(() => import('./pages/admin/ClassificacaoFiscal'))
const Clientes = lazy(() => import('./pages/admin/Clientes'))
const ContasReceber = lazy(() => import('./pages/admin/ContasReceber'))
const FechamentoDiario = lazy(() => import('./pages/admin/FechamentoDiario'))
const CadastrosMestres = lazy(() => import('./pages/admin/CadastrosMestres'))
const ERP             = lazy(() => import('./pages/admin/ERP'))
const LojaModa        = lazy(() => import('./pages/admin/LojaModa'))
const BarbeariaERP    = lazy(() => import('./pages/admin/BarbeariaERP'))
const Barbearia       = lazy(() => import('./pages/admin/Barbearia'))
const Supermercado    = lazy(() => import('./pages/admin/Supermercado'))
const Omnichannel     = lazy(() => import('./pages/admin/Omnichannel'))
const CanaisFidelidade = lazy(() => import('./pages/admin/CanaisFidelidade'))
const PDVUnificado    = lazy(() => import('./pages/admin/PDVUnificado'))
const AgendaQuadras   = lazy(() => import('./pages/public/AgendaQuadras'))
const AgendamentoOnline = lazy(() => import('./pages/public/AgendamentoOnline'))
const NoticiasPublic  = lazy(() => import('./pages/public/Noticias'))
const MeuPainel       = lazy(() => import('./pages/atleta/MeuPainel'))
const Clube           = lazy(() => import('./pages/public/Clube'))
const Liga            = lazy(() => import('./pages/public/Liga'))
const PerfilAtleta    = lazy(() => import('./pages/public/PerfilAtleta'))

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
        <Route path="/garcom"         element={<Protected need="staff"><Layout noSidebar><GarcomView /></Layout></Protected>} />
        <Route path="/loja-atendimento"       element={<Protected need="staff"><Layout><LojaAtendimento /></Layout></Protected>} />
        <Route path="/admin/loja-atendimento" element={<Protected need="staff"><Layout><LojaAtendimento /></Layout></Protected>} />

        {/* Admin (admin/organizador) — guarda única via Outlet */}
        <Route element={<ProtectedOutlet need="org" />}>
          <Route path="/admin"              element={<Layout><Dashboard /></Layout>} />
          <Route path="/admin/usuarios"     element={<Layout><Usuarios /></Layout>} />
          <Route path="/admin/torneios"     element={<Layout><Torneios /></Layout>} />
          <Route path="/admin/agenda"       element={<Layout><Agenda /></Layout>} />
          <Route path="/admin/inscricoes"   element={<Layout><Inscricoes /></Layout>} />
          <Route path="/admin/cardapio"     element={<Layout><Cardapio /></Layout>} />
          <Route path="/admin/estoque"      element={<Layout><Estoque /></Layout>} />
          <Route path="/admin/fichas-tecnicas" element={<Layout><FichasTecnicas /></Layout>} />
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
          <Route path="/admin/relatorios-operacionais" element={<Layout><RelatoriosOperacionais /></Layout>} />
          <Route path="/admin/noticias"       element={<Layout><Noticias /></Layout>} />
          <Route path="/admin/sumula"         element={<Layout><Sumula /></Layout>} />
          <Route path="/admin/mensalidades"   element={<Layout><Mensalidades /></Layout>} />
          <Route path="/admin/financeiro"     element={<Layout><Financeiro /></Layout>} />
          <Route path="/admin/quadras"        element={<Layout><Quadras /></Layout>} />
          <Route path="/admin/pontos"         element={<Layout><Pontos /></Layout>} />
          <Route path="/admin/ranking"        element={<Layout><AdminRanking /></Layout>} />
          <Route path="/admin/ligas"          element={<Layout><AdminLigas /></Layout>} />
          <Route path="/admin/contatos"       element={<Layout><Contatos /></Layout>} />
          <Route path="/admin/lojas"          element={<Layout><Lojas /></Layout>} />
          <Route path="/admin/notas"          element={<Layout><NotasFiscais /></Layout>} />
          <Route path="/admin/clientes"       element={<Layout><Clientes /></Layout>} />
          <Route path="/admin/cadastros-mestres" element={<Layout><CadastrosMestres /></Layout>} />
          <Route path="/admin/contas-receber" element={<Layout><ContasReceber /></Layout>} />
          <Route path="/admin/fechamento-diario" element={<Layout><FechamentoDiario /></Layout>} />
          <Route path="/admin/pdv-offline"    element={<Layout><PDVOffline /></Layout>} />
          <Route path="/admin/erp"            element={<Layout><ERP /></Layout>} />
          <Route path="/admin/oficina"         element={<Layout><Oficina /></Layout>} />
          <Route path="/admin/agropecuaria"    element={<Layout><Agropecuaria /></Layout>} />
          <Route path="/admin/varejo"          element={<Layout><Varejo /></Layout>} />
          <Route path="/admin/compras"         element={<Layout><Compras /></Layout>} />
          <Route path="/admin/fiscal/config"   element={<Layout><ConfiguracaoFiscal /></Layout>} />
          <Route path="/admin/fiscal/classificacao" element={<Layout><ClassificacaoFiscal /></Layout>} />
          <Route path="/admin/loja-moda"       element={<Layout><LojaModa /></Layout>} />
          <Route path="/admin/barbearia-erp"   element={<Layout><BarbeariaERP /></Layout>} />
          <Route path="/admin/barbearia"        element={<Layout><Barbearia /></Layout>} />
          <Route path="/admin/supermercado"    element={<Layout><Supermercado /></Layout>} />
          <Route path="/admin/omnichannel"      element={<Layout><CanaisFidelidade /></Layout>} />
          <Route path="/admin/pdv-erp"         element={<PDVUnificado />} />
        </Route>

        {/* Portal do Atleta */}
        <Route path="/meu-painel"  element={<Layout><MeuPainel /></Layout>} />

        {/* Público */}
        <Route path="/"            element={<EntradaPrincipal />} />
        <Route path="/inscricao"  element={<Layout><Inscricao /></Layout>} />
        <Route path="/ranking"    element={<Layout><Ranking /></Layout>} />
        <Route path="/loja"       element={<Layout><Loja /></Layout>} />
        <Route path="/pedido/:codigo" element={<Layout marketing><AcompanharPedido /></Layout>} />
        <Route path="/agendar/:slug" element={<AgendamentoOnline />} />
        <Route path="/regulamento" element={<Layout marketing><Regulamento /></Layout>} />
        <Route path="/bracket"    element={<Layout><Bracket /></Layout>} />
        <Route path="/chaves"     element={<Layout><Bracket /></Layout>} />
        <Route path="/perfil"     element={<PerfilRoute />} />
        <Route path="/contato"    element={<Layout><Contato /></Layout>} />
        <Route path="/noticias"   element={<Layout><NoticiasPublic /></Layout>} />
        <Route path="/quadras"    element={<Layout><AgendaQuadras /></Layout>} />
        <Route path="/clube"      element={<Layout marketing><Clube /></Layout>} />
        <Route path="/liga"          element={<Layout><Liga /></Layout>} />
        <Route path="/liga/:id"      element={<Layout><Liga /></Layout>} />
        <Route path="/atleta/:nome"  element={<Layout><PerfilAtleta /></Layout>} />

        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
