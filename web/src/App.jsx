import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './lib/auth'
import { applyBrand, applyThemeMode, brandFromContext, brandFromHost, brandThemeMode, stalloneEntryFromHost, resolveBrand, storedThemeMode, isClubeBrandContext, isDinoBrandContext, isStalloneBrandContext } from './lib/brand'
import { isTenantScope } from './lib/tenant-scope'
import { destinoInicialDino, ehHostDino, ehHostLojaDino } from './lib/dominios-dino'

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
  // profissional usa só o app do profissional
  if (auth.perfil === 'profissional') return '/barbeiro'
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

function PlatformOnly({ children }) {
  const auth = useAuth()
  if (!auth.user) return <Navigate to="/login?next=/admin/plataforma" replace />
  if (!auth.isPlatformAdmin) return <Navigate to="/admin" replace />
  return children
}

// A rota raiz é a página institucional pública no domínio principal. O host
// dedicado do Commerce renderiza o storefront Core diretamente, sem expor o
// catálogo em kytto.com.br antes de uma publicação explícita por canal.
function EntradaPrincipal() {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const destinoStallone = stalloneEntryFromHost(host)
  if (destinoStallone) return <Navigate to={destinoStallone} replace />
  const destinoDino = destinoInicialDino(host)
  if (destinoDino) return <Navigate to={destinoDino} replace />
  // Domínio próprio da Stallone (stallone.kytto.com.br): abre direto a loja.
  if (brandFromHost(host) === 'stallone') return <Navigate to="/ecommerce/stallone" replace />
  if (host === 'loja.kytto.com.br' || ehHostLojaDino(host)) return <Ecommerce />
  return <Layout marketing><Home /></Layout>
}

function CheckoutEntry() {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const destinoStallone = stalloneEntryFromHost(host, true)
  if (destinoStallone) return <Navigate to={destinoStallone} replace />
  // Domínio próprio da loja: o checkout sem endereço usa o da loja Dino.
  if (destinoInicialDino(host) === '/perfumaria/dino') return <Navigate to="/checkout/dino" replace />
  if (brandFromHost(host) === 'stallone') return <Navigate to="/checkout/stallone" replace />
  return host === 'loja.kytto.com.br' || ehHostLojaDino(host) ? <CommerceCheckout /> : <Layout noSidebar><Checkout /></Layout>
}

const Login      = lazy(() => import('./pages/Login'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AcceptOperationalInvite = lazy(() => import('./pages/AcceptOperationalInvite'))
const PDV        = lazy(() => import('./pages/PDV'))
const KDS        = lazy(() => import('./pages/KDS'))
const Portaria   = lazy(() => import('./pages/Portaria'))
const GarcomView = lazy(() => import('./pages/GarcomView'))
const LojaAtendimento = lazy(() => import('./pages/admin/LojaAtendimento'))
const EcommerceAdmin = lazy(() => import('./pages/admin/EcommerceAdmin'))

const GestaoSalaoAvancada = lazy(() => import('./pages/admin/relatorios/dino/GestaoSalaoAvancada'));
const RelatoriosDinoIndex = lazy(() => import('./pages/admin/relatorios/dino/RelatoriosDinoIndex'))
const RelatorioRetornoProfissional = lazy(() => import('./pages/admin/relatorios/dino/RelatorioRetornoProfissional'))
const RelatorioClientesAtendidos = lazy(() => import('./pages/admin/relatorios/dino/RelatorioClientesAtendidos'))
const RelatorioDesempenhoProfissional = lazy(() => import('./pages/admin/relatorios/dino/RelatorioDesempenhoProfissional'))
const RelatorioServicosGeral = lazy(() => import('./pages/admin/relatorios/dino/RelatorioServicosGeral'))
const RelatorioCaixasFechados = lazy(() => import('./pages/admin/relatorios/dino/RelatorioCaixasFechados'))
const RelatorioDinamico = lazy(() => import('./pages/admin/relatorios/dino/RelatorioDinamico'))

const Home       = lazy(() => import('./pages/public/Home'))
const Inscricao  = lazy(() => import('./pages/public/Inscricao'))
const Ranking    = lazy(() => import('./pages/public/Ranking'))
const Loja       = lazy(() => import('./pages/public/Loja'))
const Checkout   = lazy(() => import('./pages/public/Checkout'))
const CommerceCheckout = lazy(() => import('./pages/public/CommerceCheckout'))
const ProdutoDetalhe = lazy(() => import('./pages/public/ProdutoDetalhe'))
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
const ModificadoresCombos = lazy(() => import('./pages/admin/ModificadoresCombos'))
const Mesas      = lazy(() => import('./pages/admin/Mesas'))
const ReservasFilas = lazy(() => import('./pages/admin/ReservasFilas'))
const KDSConfiguracao = lazy(() => import('./pages/admin/KDSConfiguracao'))
const Socios     = lazy(() => import('./pages/admin/Socios'))
const ClubeAcademia = lazy(() => import('./pages/admin/ClubeAcademia'))
const ClubeDashboard = lazy(() => import('./pages/admin/ClubeDashboard'))
const EmImplantacao = lazy(() => import('./pages/admin/EmImplantacao'))
const Pagamentos = lazy(() => import('./pages/admin/Pagamentos'))
const AdminLoja  = lazy(() => import('./pages/admin/AdminLoja'))
const Aulas      = lazy(() => import('./pages/admin/Aulas'))
const CRM        = lazy(() => import('./pages/admin/CRM'))
const BI         = lazy(() => import('./pages/admin/BI'))
const Auditoria     = lazy(() => import('./pages/admin/Auditoria'))
const Configuracoes = lazy(() => import('./pages/admin/Configuracoes'))
const Cupons        = lazy(() => import('./pages/admin/Cupons'))
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
const PDVOffline      = lazy(() => import('./pages/admin/PDVOffline'))
const Oficina         = lazy(() => import('./pages/admin/Oficina'))
const Agropecuaria    = lazy(() => import('./pages/admin/Agropecuaria'))
const Varejo          = lazy(() => import('./pages/admin/Varejo'))
const EscolhaEmpresa  = lazy(() => import('./pages/admin/EscolhaEmpresa'))
const Suprimentos     = lazy(() => import('./pages/admin/suprimentos/Suprimentos'))
const Fiscal          = lazy(() => import('./pages/admin/fiscal/Fiscal'))
const VarejoUnidade    = lazy(() => import('./pages/admin/varejo/Varejo'))
const Clientes = lazy(() => import('./pages/admin/Clientes'))
const Customer360 = lazy(() => import('./pages/admin/Customer360'))
const FinanceiroEmpresa = lazy(() => import('./pages/admin/dino/FinanceiroEmpresa'))
const FinanceiroAuto = lazy(() => import('./pages/admin/financeiro/FinanceiroAuto'))
const AuditoriaEmpresa = lazy(() => import('./pages/admin/dino/AuditoriaEmpresa'))
const BIBarbearia = lazy(() => import('./pages/admin/dino/BIBarbearia'))
const WhatsappConexao = lazy(() => import('./pages/admin/dino/WhatsappConexao'))
const WhatsappFilaPage = lazy(() => import('./pages/admin/dino/WhatsappFilaPage'))
const WhatsappControlCenter = lazy(() => import('./pages/admin/dino/WhatsappControlCenter'))
const CerebroIA = lazy(() => import('./pages/admin/dino/CerebroIA'))
const ContasReceber = lazy(() => import('./pages/admin/ContasReceber'))
const FechamentoDiario = lazy(() => import('./pages/admin/FechamentoDiario'))
const DinoMetasRoletaPanel = lazy(() => import('./pages/admin/dino/DinoMetasRoletaPanel'))
const CadastrosMestres = lazy(() => import('./pages/admin/CadastrosMestres'))
const AvecMixReport = lazy(() => import('./pages/admin/dino/AvecMixReport'))
const AvecMixImport = lazy(() => import('./pages/admin/dino/AvecMixImport'))
const AdminPlataforma = lazy(() => import('./pages/admin/AdminPlataforma'))
const ConciliacaoFinanceiraPlataforma = lazy(() => import('./pages/admin/financeiro/ConciliacaoFinanceiraPlataforma'))
const ERP             = lazy(() => import('./pages/admin/ERP'))
const LojaModa        = lazy(() => import('./pages/admin/LojaModa'))
const BarbeariaERP    = lazy(() => import('./pages/admin/BarbeariaERP'))
const Barbearia       = lazy(() => import('./pages/admin/Barbearia'))
const Omnichannel     = lazy(() => import('./pages/admin/Omnichannel'))
const CanaisFidelidade = lazy(() => import('./pages/admin/CanaisFidelidade'))
const PDVUnificado    = lazy(() => import('./pages/admin/PDVUnificado'))
const AgendaQuadras   = lazy(() => import('./pages/public/AgendaQuadras'))
const AgendamentoOnline = lazy(() => import('./pages/public/AgendamentoOnline'))
const AvaliarAtendimento = lazy(() => import('./pages/public/AvaliarAtendimento'))
const MinhaConta = lazy(() => import('./pages/public/MinhaConta'))
const ModoBarbeiro = lazy(() => import('./pages/barbeiro/ModoBarbeiro'))
const NoticiasPublic  = lazy(() => import('./pages/public/Noticias'))
const MeuPainel       = lazy(() => import('./pages/atleta/MeuPainel'))
const Clube           = lazy(() => import('./pages/public/Clube'))
const BarbeariaClubeVip = lazy(() => import('./pages/public/BarbeariaClubeVip'))

function ClubeSmartRoute() {
  const [params] = useSearchParams()
  if (params.get('plano') || params.get('prof') || params.get('barbearia') || params.get('slug') === 'dino') {
    return <BarbeariaClubeVip />
  }
  return <Clube />
}
const Liga            = lazy(() => import('./pages/public/Liga'))
const PerfilAtleta    = lazy(() => import('./pages/public/PerfilAtleta'))
const CardapioMesaPublico = lazy(() => import('./pages/public/CardapioMesaPublico'))
const IAHub              = lazy(() => import('./pages/public/IA'))
const AgentesIA          = lazy(() => import('./pages/public/Agentes'))
const CompradoresIA      = lazy(() => import('./pages/public/Compradores'))
const SegurancaAcesso    = lazy(() => import('./pages/public/SegurancaAcesso'))
const DadosIA            = lazy(() => import('./pages/public/Dados'))
const AIJur              = lazy(() => import('./pages/public/AIJur'))
const Solucoes           = lazy(() => import('./pages/public/Solucoes'))
const Ecommerce          = lazy(() => import('./pages/public/Ecommerce'))

function RouteBrandSync() {
  const location = useLocation()
  const { empresaAtiva } = useAuth()
  const hostName = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const tenantBrand = brandFromContext(empresaAtiva)

  useEffect(() => {
    const brand = ehHostDino(hostName) ? 'dino' : (brandFromHost(hostName) || resolveBrand(location.pathname, location.search, tenantBrand))
    applyBrand(brand)
    applyThemeMode(brandThemeMode(brand, location.pathname, storedThemeMode()))
  }, [hostName, location.pathname, location.search, tenantBrand])

  return null
}

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

// Telas cujos módulos antigos eram globais da plataforma: com uma empresa
// ativa, mostram a versão da empresa (ou levam ao módulo equivalente dela).
// `clube`: clubes e academias têm telas próprias (não as da barbearia nem as do evento).
// Compras: Dino segue na revenda da barbearia; demais empresas usam Estoque e compras.
function ComprasPorMarca() {
  const { user, empresaAtiva } = useAuth()
  if (isTenantScope(user, empresaAtiva) && isDinoBrandContext(empresaAtiva)) return <Navigate to="/admin/barbearia-erp?area=catalogo&tab=Estoque+de+revenda" replace />
  // sem empresa ativa não há estoque nem compras (a tela antiga chamava rotas que não existem mais)
  return isTenantScope(user, empresaAtiva) ? <Layout><Suprimentos abaInicial="compras" /></Layout> : <Layout><EscolhaEmpresa modulo="Estoque e compras" /></Layout>
}

function TenantAware({ tenant, legacy, stallone, clube }) {
  const { user, empresaAtiva } = useAuth()
  const hostDino = typeof window !== 'undefined' && ehHostDino(window.location.hostname)
  if (stallone && brandFromContext(empresaAtiva) === 'stallone') return stallone
  if (tenant && hostDino) return tenant
  if (clube && !isDinoBrandContext(empresaAtiva) && !isStalloneBrandContext(empresaAtiva) && isClubeBrandContext(empresaAtiva)) return clube
  return isTenantScope(user, empresaAtiva) ? tenant : legacy
}

export default function App() {
  return (
    <ErrorBoundary>
    <RouteBrandSync />
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Layout noSidebar><Login /></Layout>} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route path="/aceitar-convite" element={<AcceptOperationalInvite />} />
        <Route path="/aceitar-convite-dino" element={<AcceptOperationalInvite />} />

        {/* Operacional (staff) — com aliases /admin/* para URLs amigáveis */}
        <Route path="/pdv"            element={<Protected need="staff"><Layout><PDV /></Layout></Protected>} />
        <Route path="/admin/pdv"      element={<Protected need="staff"><Layout><PDV /></Layout></Protected>} />
        <Route path="/kds"            element={<Protected need="staff"><Layout noSidebar><KDS /></Layout></Protected>} />
        <Route path="/admin/kds"      element={<Protected need="staff"><Layout noSidebar><KDS /></Layout></Protected>} />
        <Route path="/portaria"       element={<Protected need="staff"><Layout noSidebar><Portaria /></Layout></Protected>} />
        <Route path="/admin/portaria" element={<Protected need="staff"><Layout noSidebar><Portaria /></Layout></Protected>} />
        <Route path="/garcom"         element={<Protected need="staff"><Layout noSidebar><GarcomView /></Layout></Protected>} />
        <Route path="/loja-atendimento"       element={<Protected need="staff"><Layout><TenantAware stallone={<EcommerceAdmin defaultTab="orders" />} tenant={<LojaAtendimento />} legacy={<LojaAtendimento />} /></Layout></Protected>} />
        <Route path="/admin/loja-atendimento" element={<Protected need="staff"><Layout><TenantAware stallone={<EcommerceAdmin defaultTab="orders" />} tenant={<LojaAtendimento />} legacy={<LojaAtendimento />} /></Layout></Protected>} />

        {/* Admin (admin/organizador) — guarda única via Outlet */}
        <Route element={<ProtectedOutlet need="org" />}>
          <Route path="/admin"              element={<Layout><TenantAware stallone={<Navigate to="/admin/ecommerce?tab=overview" replace />} clube={<ClubeDashboard />} tenant={<Dashboard />} legacy={<Dashboard />} /></Layout>} />
          <Route path="/admin/avec-relatorio" element={<Layout><AvecMixReport /></Layout>} />
          <Route path="/admin/avec-historico" element={<PlatformOnly><Layout><AvecMixImport /></Layout></PlatformOnly>} />
          <Route path="/admin/plataforma"  element={<PlatformOnly><Layout><AdminPlataforma /></Layout></PlatformOnly>} />
          <Route path="/admin/plataforma/conciliacao-financeira" element={<PlatformOnly><Layout><ConciliacaoFinanceiraPlataforma /></Layout></PlatformOnly>} />
          <Route path="/admin/usuarios"     element={<TenantAware tenant={<Navigate to="/admin/ecommerce?tab=users" replace />} legacy={<Layout><Usuarios /></Layout>} />} />
          <Route path="/admin/torneios"     element={<Layout><Torneios /></Layout>} />
          <Route path="/admin/agenda"       element={<Layout><Agenda /></Layout>} />
          <Route path="/admin/inscricoes"   element={<Layout><Inscricoes /></Layout>} />
          <Route path="/admin/cardapio"     element={<Layout><Cardapio /></Layout>} />
          <Route path="/admin/estoque"      element={<Layout><Estoque /></Layout>} />
          <Route path="/admin/perdas-inventario" element={<TenantAware tenant={<Layout><Suprimentos abaInicial="inventario" /></Layout>} legacy={<Layout><EscolhaEmpresa modulo="Perdas e inventário" /></Layout>} />} />
          <Route path="/admin/fichas-tecnicas" element={<TenantAware tenant={<Layout><Suprimentos abaInicial="fichas" /></Layout>} legacy={<Layout><EscolhaEmpresa modulo="Fichas técnicas" /></Layout>} />} />
          <Route path="/admin/modificadores-combos" element={<Layout><ModificadoresCombos /></Layout>} />
          <Route path="/admin/mesas"        element={<Layout><Mesas /></Layout>} />
          <Route path="/admin/reservas" element={<TenantAware tenant={<Layout><ReservasFilas /></Layout>} legacy={<Layout><EmImplantacao modulo="Reservas e fila de espera" /></Layout>} />} />
          <Route path="/admin/kds"          element={<Layout><KDSConfiguracao /></Layout>} />
          <Route path="/admin/socios"       element={<Layout><Socios /></Layout>} />
          <Route path="/admin/clube"        element={<Navigate to="/admin/clube/recepcao" replace />} />
          <Route path="/admin/clube/:secao" element={<Layout><ClubeAcademia /></Layout>} />
          <Route path="/admin/pagamentos"   element={<Layout><Pagamentos /></Layout>} />
          <Route path="/admin/loja"         element={<Layout><AdminLoja /></Layout>} />
          <Route path="/admin/ecommerce"   element={<Layout><EcommerceAdmin /></Layout>} />
          <Route path="/admin/aulas"        element={<Layout><Aulas /></Layout>} />
          <Route path="/admin/crm"          element={<Layout><CRM /></Layout>} />
          <Route path="/admin/bi"           element={<Layout><TenantAware stallone={<Navigate to="/admin/ecommerce?tab=reports" replace />} clube={<Navigate to="/admin" replace />} tenant={<BIBarbearia />} legacy={<BI />} /></Layout>} />
          <Route path="/admin/auditoria"       element={<Layout><TenantAware tenant={<AuditoriaEmpresa />} legacy={<Auditoria />} /></Layout>} />
          <Route path="/admin/configuracoes"  element={<TenantAware stallone={<Navigate to="/admin/ecommerce?tab=stores" replace />} clube={<Navigate to="/admin/clube/ajustes" replace />} tenant={<Navigate to="/admin/barbearia-erp?area=gestao&tab=Configura%C3%A7%C3%A3o" replace />} legacy={<Layout><Configuracoes /></Layout>} />} />
          <Route path="/admin/cupons"         element={<Layout><Cupons /></Layout>} />
          <Route path="/admin/relatorios"     element={<Layout><RelatoriosDinoIndex /></Layout>} />
          <Route path="/admin/relatorios/dino" element={<Layout><RelatoriosDinoIndex /></Layout>} />
          <Route path="/admin/relatorios/dino/gestao-avancada" element={<Layout><GestaoSalaoAvancada /></Layout>} />

          <Route path="/admin/relatorios/dino/retorno" element={<Layout><RelatorioRetornoProfissional /></Layout>} />
          <Route path="/admin/relatorios/dino/clientes-atendidos" element={<Layout><RelatorioClientesAtendidos /></Layout>} />

          <Route path="/admin/relatorios/dino/desempenho-profissional" element={<Layout><RelatorioDesempenhoProfissional /></Layout>} />
          <Route path="/admin/relatorios/dino/servicos-vendidos" element={<Layout><RelatorioServicosGeral /></Layout>} />
          <Route path="/admin/relatorios/dino/caixas-fechados" element={<Layout><RelatorioCaixasFechados /></Layout>} />
          <Route path="/admin/relatorios/dino/view/:codigo" element={<Layout><RelatorioDinamico /></Layout>} />
          <Route path="/admin/relatorios-operacionais" element={<TenantAware stallone={<Navigate to="/admin/ecommerce?tab=reports" replace />} clube={<Navigate to="/admin" replace />} tenant={<Navigate to="/admin/barbearia-erp?area=gestao&tab=Relat%C3%B3rios" replace />} legacy={<Layout><RelatoriosOperacionais /></Layout>} />} />
          <Route path="/admin/noticias"       element={<Layout><Noticias /></Layout>} />
          <Route path="/admin/sumula"         element={<Layout><Sumula /></Layout>} />
          <Route path="/admin/mensalidades"   element={<Layout><Mensalidades /></Layout>} />
          <Route path="/admin/financeiro"     element={<Layout><TenantAware tenant={<FinanceiroAuto antigo={<FinanceiroEmpresa />} />} legacy={<Financeiro />} /></Layout>} />
          <Route path="/admin/whatsapp-central" element={<Layout><WhatsappControlCenter /></Layout>} />
          <Route path="/admin/whatsapp"       element={<Layout><WhatsappConexao /></Layout>} />
          <Route path="/admin/whatsapp-gestao" element={<Layout><WhatsappConexao /></Layout>} />
          <Route path="/admin/whatsapp-lancamentos" element={<Layout><WhatsappConexao /></Layout>} />
          <Route path="/admin/whatsapp-fila" element={<WhatsappFilaPage />} />
          <Route path="/admin/cerebro-ia"     element={<Layout><CerebroIA /></Layout>} />
          <Route path="/admin/quadras"        element={<Layout><Quadras /></Layout>} />
          <Route path="/admin/pontos"         element={<Layout><Pontos /></Layout>} />
          <Route path="/admin/ranking"        element={<Layout><AdminRanking /></Layout>} />
          <Route path="/admin/ligas"          element={<Layout><AdminLigas /></Layout>} />
          <Route path="/admin/contatos"       element={<Layout><Contatos /></Layout>} />
          <Route path="/admin/lojas"          element={<Layout><Lojas /></Layout>} />
          <Route path="/admin/notas" element={<TenantAware tenant={<Layout><Fiscal abaInicial="documentos" /></Layout>} legacy={<Layout><EmImplantacao modulo="Central fiscal (NF-e e NFC-e)" /></Layout>} />} />
          <Route path="/admin/clientes"       element={<Layout><Clientes /></Layout>} />
          <Route path="/admin/clientes-360"   element={<Layout><Customer360 /></Layout>} />
          <Route path="/admin/clientes-360/:ref" element={<Layout><Customer360 /></Layout>} />
          <Route path="/admin/cadastros-mestres" element={<Layout><CadastrosMestres /></Layout>} />
          <Route path="/admin/contas-receber" element={<Layout><FinanceiroAuto aba="receber" antigo={<ContasReceber />} /></Layout>} />
          <Route path="/admin/contas-pagar" element={<Layout><FinanceiroAuto aba="pagar" antigo={<Navigate to="/admin/financeiro" replace />} /></Layout>} />
          <Route path="/admin/fechamento-diario" element={<Layout><FinanceiroAuto aba="fechamento" antigo={<FechamentoDiario />} /></Layout>} />
          <Route path="/admin/pdv-offline" element={<TenantAware tenant={<Layout><PDVOffline /></Layout>} legacy={<Layout><EmImplantacao modulo="PDV offline" /></Layout>} />} />
          <Route path="/admin/erp"            element={<Layout><ERP /></Layout>} />
          <Route path="/admin/oficina"         element={<Layout><Oficina /></Layout>} />
          <Route path="/admin/agropecuaria"    element={<Layout><Agropecuaria /></Layout>} />
          <Route path="/admin/varejo"          element={<Layout><Varejo /></Layout>} />
          <Route path="/admin/compras"         element={<ComprasPorMarca />} />
          <Route path="/admin/fiscal/config" element={<TenantAware tenant={<Layout><Fiscal abaInicial="situacao" /></Layout>} legacy={<Layout><EmImplantacao modulo="Configuração de NF-e e NFC-e" /></Layout>} />} />
          <Route path="/admin/fiscal/classificacao" element={<TenantAware tenant={<Layout><Fiscal abaInicial="classificacao" /></Layout>} legacy={<Layout><EmImplantacao modulo="Classificação fiscal" /></Layout>} />} />
          <Route path="/admin/loja-moda"       element={<Layout><LojaModa /></Layout>} />
          <Route path="/admin/barbearia-erp"   element={<Layout><BarbeariaERP /></Layout>} />
          <Route path="/admin/barbearia"        element={<Layout><Barbearia /></Layout>} />
          <Route path="/admin/metas-roleta"    element={<Layout><DinoMetasRoletaPanel /></Layout>} />
          <Route path="/admin/supermercado" element={<TenantAware tenant={<Layout><VarejoUnidade /></Layout>} legacy={<Layout><EmImplantacao modulo="Supermercado" /></Layout>} />} />
          <Route path="/admin/omnichannel"      element={<Layout><CanaisFidelidade /></Layout>} />
          <Route path="/admin/pdv-erp"         element={<PDVUnificado />} />
        </Route>

        {/* Portal do Atleta */}
        <Route path="/meu-painel"  element={<Layout><MeuPainel /></Layout>} />

        {/* Público */}
        <Route path="/"            element={<EntradaPrincipal />} />
        <Route path="/ia"          element={<IAHub />} />
        <Route path="/ia/agentes" element={<AgentesIA />} />
        <Route path="/ia/compradores" element={<CompradoresIA />} />
        <Route path="/solucoes/seguranca-acesso" element={<SegurancaAcesso />} />
        <Route path="/ia/dados"   element={<DadosIA />} />
        <Route path="/ia/aijur"   element={<AIJur />} />
          <Route path="/solucoes"   element={<Solucoes />} />
          <Route path="/ecommerce"  element={<Layout marketing><Ecommerce /></Layout>} />
          <Route path="/ecommerce/:storeAlias" element={<Ecommerce />} />
          <Route path="/perfumaria/:storeAlias" element={<Ecommerce />} />
        <Route path="/inscricao"  element={<Layout><Inscricao /></Layout>} />
        <Route path="/ranking"    element={<Layout><Ranking /></Layout>} />
        <Route path="/loja"       element={<Layout><Loja /></Layout>} />
        <Route path="/loja/:slug" element={<Layout><ProdutoDetalhe /></Layout>} />
        <Route path="/checkout"   element={<CheckoutEntry />} />
        <Route path="/checkout/:storeAlias" element={<CommerceCheckout />} />
        <Route path="/ecommerce/checkout" element={<CheckoutEntry />} />
        <Route path="/pedido/:codigo" element={<Layout marketing><AcompanharPedido /></Layout>} />
        <Route path="/pedido/:storeAlias/:codigo" element={<AcompanharPedido />} />
        <Route path="/cardapio/mesa/:token" element={<CardapioMesaPublico />} />
        <Route path="/agendar/:slug" element={<AgendamentoOnline />} />
        <Route path="/avaliar/:slug" element={<AvaliarAtendimento />} />
        <Route path="/minha/:slug" element={<MinhaConta />} />
        <Route path="/barbeiro" element={<ModoBarbeiro />} />
        <Route path="/barbeiro/:slug" element={<ModoBarbeiro />} />
        <Route path="/regulamento" element={<Layout marketing><Regulamento /></Layout>} />
        <Route path="/bracket"    element={<Layout><Bracket /></Layout>} />
        <Route path="/chaves"     element={<Layout><Bracket /></Layout>} />
        <Route path="/perfil"     element={<PerfilRoute />} />
        <Route path="/contato"    element={<Layout><Contato /></Layout>} />
        <Route path="/noticias"   element={<Layout><NoticiasPublic /></Layout>} />
        <Route path="/quadras"    element={<Layout><AgendaQuadras /></Layout>} />
        <Route path="/clube"      element={<Layout marketing><ClubeSmartRoute /></Layout>} />
        <Route path="/clube/:slug" element={<BarbeariaClubeVip />} />
        <Route path="/planos/:slug" element={<BarbeariaClubeVip />} />
        <Route path="/clube-vip"  element={<BarbeariaClubeVip />} />
        <Route path="/liga"          element={<Layout><Liga /></Layout>} />
        <Route path="/liga/:id"      element={<Layout><Liga /></Layout>} />
        <Route path="/atleta/:nome"  element={<Layout><PerfilAtleta /></Layout>} />

        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
