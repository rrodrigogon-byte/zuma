import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtDate, fmtDateOnly, fmtR } from '../../lib/api'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'
import { isDinoBrandContext } from '../../lib/brand'
import BarbeariaAgendaBoard, { agendaBoardColumns } from './BarbeariaAgendaBoard'
import BarbeariaAgendaPeriodo from './BarbeariaAgendaPeriodo'
import BarbeariaOperacaoPanel from './BarbeariaOperacaoPanel'
import DinoBusinessDashboard from './DinoBusinessDashboard'
import DinoCampaignsPanel from './DinoCampaignsPanel'
import { CanaisPanel, ClubeSaudePanel, CobrancasPanel, IndicacoesPanel, ListaEsperaPanel, NpsPanel, OcupacaoMetasPanel, ReceitaIaPanel, ResumoDiarioPanel, RetornosPanel, UnidadesPanel, ValesPanel } from './dino/CaptacaoPanels'

const TABS = [
  ['Visão geral', 'Resumo da operação'],
  ['Agenda', 'Reservas e horários'],
  ['Atendimento', 'Fila e status'],
  ['Caixa e fechamento', 'Abertura, movimentos e encerramento'],
  ['Clientes', 'CRM da unidade'],
  ['Profissionais', 'Equipe e repasse'],
  ['Serviços', 'Catálogo de serviços'],
  ['Comissões', 'Apuração indicativa'],
  ['Fila e bloqueios', 'Espera e indisponibilidades'],
  ['Planos e assinaturas', 'Pacotes sem cobrança automática'],
  ['Fidelidade', 'Pontos do CRM'],
  ['Estoque de revenda', 'Produtos e movimentos manuais'],
  ['Vendas de revenda', 'Venda, pagamento e baixa auditáveis'],
  ['Relatórios', 'Indicadores operacionais'],
  ['Integrações', 'WhatsApp e assistente IA'],
  ['Configuração', 'Horários e políticas'],
  ['Retorno previsto', 'Quem está para voltar e quem atrasou'],
  ['Lista de espera', 'Pedidos de horário e avisos de vaga'],
  ['Indicações', 'Indique um amigo com recompensa'],
  ['Saúde do clube', 'Uso, margem e candidatos ao clube'],
  ['Ocupação e metas', 'Ocupação da agenda e metas por barbeiro'],
  ['Avaliações (NPS)', 'Notas e indicadores no próprio sistema'],
  ['Origem dos clientes', 'Agendamentos e clientes novos por canal'],
  ['Cobranças e cashback', 'Sinal, mensalidade do clube e cashback'],
  ['Receita da IA', 'Receita atribuída à IA e à captação'],
  ['Resumo diário', 'Fechamento do dia no WhatsApp do dono'],
  ['Vale-presente', 'Venda, consulta e saldo dos vales'],
  ['Unidades', 'Comparativo entre unidades'],
]

const AREAS = [
  { id: 'operacao', label: 'Operação', short: 'Hoje, agenda, atendimento e caixa', tabs: ['Visão geral', 'Agenda', 'Atendimento', 'Caixa e fechamento', 'Fila e bloqueios'] },
  { id: 'relacionamento', label: 'Relacionamento', short: 'Clientes, retorno e indicação', tabs: ['Clientes', 'Retorno previsto', 'Lista de espera', 'Indicações', 'Avaliações (NPS)', 'Origem dos clientes', 'Fidelidade'] },
  { id: 'catalogo', label: 'Catálogo e equipe', short: 'Serviços, planos e revenda', tabs: ['Profissionais', 'Serviços', 'Planos e assinaturas', 'Saúde do clube', 'Estoque de revenda', 'Vendas de revenda'] },
  { id: 'gestao', label: 'Gestão', short: 'Comissões, metas e regras', tabs: ['Comissões', 'Ocupação e metas', 'Cobranças e cashback', 'Vale-presente', 'Receita da IA', 'Resumo diário', 'Unidades', 'Relatórios', 'Configuração'] },
  { id: 'integracoes', label: 'Integrações', short: 'WhatsApp e IA controlados', tabs: ['Integrações'] },
]

const TAB_AREA = Object.fromEntries(AREAS.flatMap((area) => area.tabs.map((tab) => [tab, area.id])))
const TAB_DESCRICAO = Object.fromEntries(TABS)

const STATUS = {
  agendado: { label: 'Agendado', color: '#4a9eff' },
  confirmado: { label: 'Confirmado', color: '#8b5cf6' },
  em_atendimento: { label: 'Em atendimento', color: '#f59e0b' },
  concluido: { label: 'Concluído', color: '#14b87a' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
  nao_compareceu: { label: 'Não compareceu', color: '#888' },
  aguardando: { label: 'Aguardando', color: '#4a9eff' },
  chamado: { label: 'Chamado', color: '#f59e0b' },
  atendido: { label: 'Atendido', color: '#14b87a' },
  ausente: { label: 'Ausente', color: '#888' },
  configurado: { label: 'Configurado', color: '#14b87a' },
  pendente_configuracao: { label: 'Configuração pendente', color: '#f59e0b' },
  pendente_ativacao: { label: 'Pendente de ativação', color: '#f59e0b' },
  pausada: { label: 'Pausada', color: '#888' },
  expirada: { label: 'Expirada', color: '#e05c5c' },
  aberta: { label: 'Aberta', color: '#4a9eff' },
  aguardando_pagamento: { label: 'Aguardando pagamento', color: '#f59e0b' },
  parcialmente_paga: { label: 'Parcialmente paga', color: '#f59e0b' },
  em_conta: { label: 'Em conta', color: '#8b5cf6' },
  paga: { label: 'Paga', color: '#14b87a' },
  cancelada: { label: 'Cancelada', color: '#e05c5c' },
  operacional: { label: 'Operacional', color: '#14b87a' },
  configuracao_pendente: { label: 'Configuração pendente', color: '#f59e0b' },
  aguardando_provisionamento: { label: 'Aguardando provisionamento', color: '#4a9eff' },
  sem_membership: { label: 'Tenant sem vínculo', color: '#f59e0b' },
  sem_permissao: { label: 'Sem permissão Commerce', color: '#f59e0b' },
  temporariamente_indisponivel: { label: 'Temporariamente indisponível', color: '#e05c5c' },
  indisponivel: { label: 'Indisponível', color: '#e05c5c' },
  desativado: { label: 'Desativado', color: '#888' },
}

const TRANSICOES = {
  agendado: ['confirmado', 'em_atendimento', 'cancelado', 'nao_compareceu'],
  confirmado: ['em_atendimento', 'cancelado', 'nao_compareceu'],
  em_atendimento: ['concluido', 'cancelado', 'nao_compareceu'],
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function hojeLocal() {
  const agora = new Date()
  const offset = agora.getTimezoneOffset() * 60000
  return new Date(agora.valueOf() - offset).toISOString().slice(0, 10)
}

function moeda(value) {
  return fmtR(Number(value || 0))
}

function avisoPesquisa(estado) {
  if (Number(estado?.queued) > 0) return { texto: 'Pesquisa Dino programada para WhatsApp; o envio ainda não foi confirmado.', tipo: 'success' }
  if (estado?.skipped === false) return { texto: 'Pesquisa já estava na fila; o envio ainda não foi confirmado.', tipo: 'success' }
  const motivo = {
    already_reviewed: 'este atendimento já foi avaliado',
    service_consent_required: 'falta consentimento de atendimento por WhatsApp',
    customer_not_registered: 'falta cliente cadastrado no atendimento',
    customer_not_found: 'cliente vinculado não foi encontrado',
    phone_unavailable: 'telefone do cliente indisponível',
    appointment_phone_mismatch: 'o telefone do cadastro difere do telefone da reserva',
    review_outside_window: 'data do atendimento fora do prazo da pesquisa (até 30 dias)',
    whatsapp_channel_inactive: 'o canal WhatsApp da unidade não está ativo',
    review_link_unavailable: 'link público de pesquisa não está configurado para esta empresa',
    commerce_scope_unavailable: 'empresa ou unidade sem escopo válido',
    tenant_scope_mismatch: 'empresa do atendimento não confere',
    store_scope_mismatch: 'a unidade do agendamento não confere',
    queue_unavailable: 'fila temporariamente indisponível',
  }[estado?.reason] || 'confira o estado da fila e a configuração do canal'
  return { texto: `Pesquisa não programada: ${motivo}. Não presuma que a mensagem foi enviada.`, tipo: 'error' }
}

function horario(value) {
  if (!value) return '—'
  const data = new Date(value)
  return Number.isNaN(data.valueOf()) ? String(value) : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' })
}

function iniciais(nome) {
  return String(nome || '?').split(/\s+/).slice(0, 2).map((item) => item[0]).join('').toUpperCase()
}

function Badge({ status }) {
  const item = STATUS[status] || { label: status || 'Sem status', color: '#888' }
  return <span style={{ background: `${item.color}20`, color: item.color, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.label}</span>
}

function Card({ children, style = {} }) {
  return <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, ...style }}>{children}</div>
}

function Kpi({ label, value, note, color = 'var(--accent)' }) {
  return <Card style={{ padding: 18, minHeight: 112 }}>
    <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    <div style={{ marginTop: 10, fontSize: 28, lineHeight: 1, fontWeight: 800, color }}>{value}</div>
    {note && <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 12 }}>{note}</div>}
  </Card>
}

function Modal({ title, children, onClose, wide = false }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="barbearia-modal-title" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, width: '100%', maxWidth: wide ? 760 : 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 22px 80px rgba(0,0,0,.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <h2 id="barbearia-modal-title" style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" style={styles.iconButton}>×</button>
      </div>
      {children}
    </div>
  </div>
}

function Field({ label, children, full = false, hint }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : undefined }}>
    <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>{label}</span>
    {children}
    {hint && <small style={{ color: 'var(--muted)', fontSize: 11 }}>{hint}</small>}
  </label>
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit' }

export default function BarbeariaERP() {
  const { toast } = useToast()
  const { user, empresaAtiva, lojaAtiva, lojasAcessiveis } = useAuth()
  const isDinoBrand = isDinoBrandContext(empresaAtiva, user?.empresaAtiva, user?.empresa, user?.tenant)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const requestedArea = searchParams.get('area')
  const validRequestedTab = TABS.some(([name]) => name === requestedTab) ? requestedTab : null
  const validRequestedArea = AREAS.find((area) => area.id === requestedArea) || null
  const tab = validRequestedTab || validRequestedArea?.tabs[0] || 'Visão geral'

  function navegarParaTab(nome) {
    setBusca('')
    const area = TAB_AREA[nome] || 'operacao'
    if (searchParams.get('area') === area && searchParams.get('tab') === nome) return
    setSearchParams({ area, tab: nome }, { replace: true })
  }
  const [dataSelecionada, setDataSelecionada] = useState(hojeLocal)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [profissionalFiltro, setProfissionalFiltro] = useState('')
  const [agendaModo, setAgendaModo] = useState('timeline')
  const [busca, setBusca] = useState('')
  const [buscaGlobal, setBuscaGlobal] = useState('')
  const [filtroClientes, setFiltroClientes] = useState('todos')
  const [dashboard, setDashboard] = useState(null)
  const [agendamentos, setAgendamentos] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [clientes, setClientes] = useState([])
  const [configuracao, setConfiguracao] = useState(null)
  const [configuracaoUnidade, setConfiguracaoUnidade] = useState(null)
  const [fila, setFila] = useState([])
  const [bloqueios, setBloqueios] = useState([])
  const [planos, setPlanos] = useState([])
  const [assinaturas, setAssinaturas] = useState([])
  const [fidelidade, setFidelidade] = useState({ regra: {}, membros: [], movimentos: [] })
  const [formFidelidade, setFormFidelidade] = useState({ pontosPorReal: 1, valorPonto: 0.01, ativa: true })
  const [clienteFidelidadeId, setClienteFidelidadeId] = useState('')
  const [formCreditoFidelidade, setFormCreditoFidelidade] = useState({ valor: '' })
  const [relatorio, setRelatorio] = useState(null)
  const [comissoes, setComissoes] = useState(null)
  const [integracoes, setIntegracoes] = useState(null)
  const whatsappAi = integracoes?.whatsapp?.ai || integracoes?.ia?.whatsapp || {}
  const [notificacoesAgenda, setNotificacoesAgenda] = useState({ queued: 0, sent: 0, failed: 0, canceled: 0 })
  const [assistenteResposta, setAssistenteResposta] = useState(null)
  const [assistentePergunta, setAssistentePergunta] = useState('')
  const [consultandoAssistente, setConsultandoAssistente] = useState(false)
  const [produtosRevenda, setProdutosRevenda] = useState([])
  const [vendasRevenda, setVendasRevenda] = useState([])
  const [comandas, setComandas] = useState([])
  const [documentosFiscais, setDocumentosFiscais] = useState([])
  const [resumoComandas, setResumoComandas] = useState(null)
  const [operacao, setOperacao] = useState(null)
  const [relacionamento, setRelacionamento] = useState(null)
  const [formComanda, setFormComanda] = useState({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: '', agendamentoId: '', itemTipo: 'servico', itemId: '', quantidade: 1, gorjeta: '', desconto: '', descontoMotivo: '', observacoes: '' })
  const [formPagamentoComanda, setFormPagamentoComanda] = useState({ meioPagamento: 'pix', valor: '', clienteId: '', caixaId: '' })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [formProf, setFormProf] = useState({ nome: '', telefone: '', email: '', especialidade: 'Barbeiro', tipo: 'parceiro', percentualComissao: 50, percentualComissaoProduto: 30, horarioInicio: '08:00', horarioFim: '18:00', diasTrabalho: [1, 2, 3, 4, 5, 6] })
  const [formServico, setFormServico] = useState({ nome: '', descricao: '', categoria: 'Geral', duracaoMinutos: 30, preco: '', permiteAgendamentoOnline: true, consumoInterno: [] })
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '', email: '', limiteCreditoMensal: 0, diasVencimento: 30, observacao: '' })
  const [formAgenda, setFormAgenda] = useState({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: '', servicoId: '', data: hojeLocal(), hora: '10:00', observacoes: '' })
  const [formRecebimento, setFormRecebimento] = useState({ meioPagamento: 'pix', usarCashback: '', valeCodigo: '', valeValor: '' })
  const [saldoCashbackCliente, setSaldoCashbackCliente] = useState(null)
  const [conferindoSinal, setConferindoSinal] = useState(false)
  const [formConfig, setFormConfig] = useState({})
  const [formFila, setFormFila] = useState({ clienteId: '', clienteNome: '', clienteTelefone: '', servicoId: '', preferenciaProfissionalId: '', previsaoMinutos: 30, observacoes: '' })
  const [formFilaChamada, setFormFilaChamada] = useState({ mesaOuPosicao: '' })
  const [formBloqueio, setFormBloqueio] = useState({ titulo: '', motivo: '', inicioHora: '08:00', fimHora: '20:00', profissionalId: '' })
  const [formPlano, setFormPlano] = useState({ nome: '', descricao: '', ciclo: 'mensal', preco: '', sessoesIncluidas: 4, validadeDias: 30, servicosIds: [] })
  const [formAssinatura, setFormAssinatura] = useState({ clienteId: '', clienteNome: '', planoId: '', observacoes: '' })
  const [formProdutoRevenda, setFormProdutoRevenda] = useState({ nome: '', sku: '', categoria: 'Revenda', unidade: 'un', precoVenda: '', custoUnitario: '', estoqueAtual: 0, estoqueMinimo: 0 })
  const [formMovimentoRevenda, setFormMovimentoRevenda] = useState({ quantidade: 1, observacao: 'Movimento manual no módulo Barbearia.' })
  const [formVendaRevenda, setFormVendaRevenda] = useState({ clienteId: '', clienteNome: '', profissionalId: '', observacao: '', produtoId: '', quantidade: 1 })
  const [formPagamentoVendaRevenda, setFormPagamentoVendaRevenda] = useState({ meioPagamento: 'pix' })
  const [formWhatsApp, setFormWhatsApp] = useState({ clienteId: '', finalidade: 'atendimento', telefone: '', mensagem: '', consentimentoConfirmado: false })
  const [formWhatsappAi, setFormWhatsappAi] = useState({ instance: 'dino', displayName: 'Atendimento WhatsApp', humanized: true, captureLeads: true, operateStore: true, manageAppointments: true, sendPromotions: false, reminders: true, humanHandoff: true })
  const [formWhatsappAiPolicy, setFormWhatsappAiPolicy] = useState({ personalizationEnabled: false, opportunitiesEnabled: false, cooldownDays: 30, privacyNotice: '' })
  const [formPersona, setFormPersona] = useState({ ativo: true, nome: 'T-Rex', mensagensCurtas: true, figurinhas: true, revelarIa: 'quando_perguntado' })
  const [whatsappAiSessions, setWhatsappAiSessions] = useState([])
  const [itensVendaRevenda, setItensVendaRevenda] = useState([])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const query = new URLSearchParams({ data: dataSelecionada })
      if (statusFiltro) query.set('status', statusFiltro)
      if (profissionalFiltro) query.set('profissionalId', profissionalFiltro)
      const payload = await api.get(`/api/admin/barbearia/overview?${query.toString()}`)
      const aiSessions = await api.get('/api/admin/commerce/whatsapp-ai/sessions?limit=20').catch(() => ({ items: [] }))
      setWhatsappAiSessions(Array.isArray(aiSessions?.items) ? aiSessions.items : [])
      setDashboard(payload?.dashboard || {})
      setAgendamentos(Array.isArray(payload?.agendamentos) ? payload.agendamentos : [])
      setProfissionais(Array.isArray(payload?.profissionais) ? payload.profissionais : [])
      setServicos(Array.isArray(payload?.servicos) ? payload.servicos : [])
      setClientes(Array.isArray(payload?.clientes) ? payload.clientes : [])
      setConfiguracao(payload?.configuracao || null)
      setFormConfig(payload?.configuracao || {})
      setFila(Array.isArray(payload?.fila) ? payload.fila : [])
      setBloqueios(Array.isArray(payload?.bloqueios) ? payload.bloqueios : [])
      setPlanos(Array.isArray(payload?.planos) ? payload.planos : [])
      setAssinaturas(Array.isArray(payload?.assinaturas) ? payload.assinaturas : [])
      setFidelidade(payload?.fidelidade || { regra: {}, membros: [] })
      setFormFidelidade(payload?.fidelidade?.regra || { pontosPorReal: 1, valorPonto: 0.01, ativa: true })
      setConfiguracaoUnidade(payload?.configuracaoUnidade || null)
      setRelatorio(payload?.relatorio || null)
      setComissoes(payload?.comissoes || null)
      setProdutosRevenda(Array.isArray(payload?.produtos) ? payload.produtos : [])
      setVendasRevenda(Array.isArray(payload?.vendas) ? payload.vendas : [])
      setComandas(Array.isArray(payload?.comandas) ? payload.comandas : [])
      setDocumentosFiscais(Array.isArray(payload?.documentosFiscais) ? payload.documentosFiscais : [])
      setResumoComandas(payload?.resumoComandas || null)
      setOperacao(payload?.operacao || null)
      setRelacionamento(payload?.relacionamento || null)
      setIntegracoes(payload?.integracoes || null)
      setNotificacoesAgenda(payload?.notificacoesAgenda || { queued: 0, sent: 0, failed: 0, canceled: 0 })
      const whatsappAi = payload?.integracoes?.whatsapp?.ai
      if (whatsappAi?.channel) setFormWhatsappAi((atual) => ({ ...atual, instance: whatsappAi.channel.instance || atual.instance, displayName: whatsappAi.channel.nome || atual.displayName, ...(whatsappAi.channel.capabilities || {}) }))
      if (whatsappAi?.channel?.persona) setFormPersona({
        ativo: whatsappAi.channel.persona.ativa === true || whatsappAi.channel.persona.origem === 'nenhuma',
        nome: whatsappAi.channel.persona.nome || 'T-Rex',
        mensagensCurtas: whatsappAi.channel.persona.mensagensCurtas !== false,
        figurinhas: whatsappAi.channel.persona.figurinhas !== false,
        revelarIa: whatsappAi.channel.persona.revelarIa || 'quando_perguntado',
      })
      if (whatsappAi?.policy) setFormWhatsappAiPolicy({
        personalizationEnabled: whatsappAi.policy.personalizationEnabled === true,
        opportunitiesEnabled: whatsappAi.policy.opportunitiesEnabled === true,
        cooldownDays: Number(whatsappAi.policy.cooldownDays || 30),
        privacyNotice: whatsappAi.policy.privacyNotice || '',
      })
    } catch (error) {
      setDashboard(null)
      setErro(error.message || 'Não foi possível carregar o módulo de Barbearia.')
    } finally {
      setLoading(false)
    }
  }, [dataSelecionada, profissionalFiltro, statusFiltro])

  useEffect(() => { carregar() }, [carregar])

  const indicadores = dashboard?.indicadores || {}
  const areaAtual = AREAS.find((area) => area.id === TAB_AREA[tab]) || AREAS[0]
  // Nome da unidade (código + nome) em vez do identificador técnico.
  const nomeLojaAtiva = lojaAtiva && (!configuracaoUnidade?.lojaId || lojaAtiva.id === configuracaoUnidade.lojaId)
    ? `${lojaAtiva.codigo ? `${lojaAtiva.codigo} — ` : ''}${lojaAtiva.nome || lojaAtiva.nome_fantasia || ''}`.trim()
    : ''
  const unidadeLabel = nomeLojaAtiva || (configuracaoUnidade?.lojaId ? 'Unidade da sessão' : 'Unidade definida pela sessão')
  const relacionamentoPorCliente = useMemo(() => Object.fromEntries((relacionamento?.porCliente || []).map((item) => [item.clienteId, item])), [relacionamento])
  const listaBuscaClientes = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const membros = new Set((fidelidade?.membros || []).map((item) => item.clienteId))
    return clientes.filter((cliente) => {
      const resumo = relacionamentoPorCliente[cliente.id] || {}
      const consentimentos = cliente.consentimentos || {}
      const temConsentimento = ['whatsapp', 'email'].some((canal) => ['atendimento', 'marketing'].some((finalidade) => consentimentos[canal]?.[finalidade]?.concedido === true))
      const temVisita = Number(resumo.visitas || 0) > 0
      const passaFiltro = filtroClientes === 'todos' || (filtroClientes === 'ativos' && temVisita) || (filtroClientes === 'fidelidade' && membros.has(cliente.id)) || (filtroClientes === 'consentimento' && temConsentimento) || (filtroClientes === 'inativos' && !temVisita)
      const passaBusca = !termo || [cliente.nome, cliente.telefone, cliente.email].some((item) => String(item || '').toLowerCase().includes(termo))
      return passaFiltro && passaBusca
    })
  }, [clientes, busca, filtroClientes, fidelidade, relacionamentoPorCliente])
  const listaBuscaProfissionais = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return profissionais.filter((profissional) => !termo || [profissional.nome, profissional.especialidade, profissional.email].some((item) => String(item || '').toLowerCase().includes(termo)))
  }, [profissionais, busca])
  const listaBuscaServicos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return servicos.filter((servico) => !termo || [servico.nome, servico.categoria, servico.descricao].some((item) => String(item || '').toLowerCase().includes(termo)))
  }, [servicos, busca])
  const resultadosBuscaGlobal = useMemo(() => {
    const termo = buscaGlobal.trim().toLowerCase()
    if (!termo) return []
    const candidatos = [
      ...clientes.map((item) => ({ id: `cliente-${item.id}`, tipo: 'Cliente', nome: item.nome, meta: item.telefone || item.email || 'CRM', tab: 'Clientes', item })),
      ...profissionais.map((item) => ({ id: `profissional-${item.id}`, tipo: 'Atendente', nome: item.nome, meta: item.especialidade || 'Equipe', tab: 'Profissionais', item })),
      ...servicos.map((item) => ({ id: `servico-${item.id}`, tipo: 'Serviço', nome: item.nome, meta: `${item.categoria || 'Geral'} · ${moeda(item.preco)}`, tab: 'Serviços', item })),
      ...produtosRevenda.map((item) => ({ id: `produto-${item.id}`, tipo: 'Revenda', nome: item.nome, meta: `${item.sku || 'Sem SKU'} · estoque ${item.estoqueAtual ?? 0}`, tab: 'Estoque de revenda', item })),
      ...agendamentos.map((item) => ({ id: `agenda-${item.id}`, tipo: 'Agenda', nome: item.clienteNome || item.cliente_nome || 'Cliente sem nome', meta: `${horario(item.dataHora)} · ${item.servicoNome || item.servico_nome || 'Serviço'}`, tab: 'Agenda', item })),
    ]
    return candidatos.filter((item) => [item.nome, item.meta, item.tipo].some((valor) => String(valor || '').toLowerCase().includes(termo))).slice(0, 8)
  }, [agendamentos, buscaGlobal, clientes, profissionais, produtosRevenda, servicos])

  function abrirResultadoBusca(resultado) {
    setBuscaGlobal('')
    if (resultado.tipo === 'Agenda') {
      setModal({ tipo: 'detalheAgenda', agendamento: resultado.item })
      return
    }
    navegarParaTab(resultado.tab)
    setBusca(resultado.nome)
  }

  async function executar(operacao, sucesso, { mostrarPesquisa = false } = {}) {
    setSalvando(true)
    try {
      const resposta = await operacao()
      toast(sucesso, 'success')
      if (mostrarPesquisa) { const aviso = avisoPesquisa(resposta?.avaliacao); toast(aviso.texto, aviso.tipo) }
      setModal(null)
      await carregar()
    } catch (error) {
      toast(error.message || 'Operação não concluída.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  function abrirCaixaOperacao(dados) {
    return executar(() => api.post('/api/admin/barbearia/operacao/caixas', dados), 'Caixa aberto para a unidade ativa.')
  }

  function movimentarCaixaOperacao(caixa, dados) {
    return executar(() => api.post(`/api/admin/barbearia/operacao/caixas/${caixa.id}/movimentos`, dados), 'Movimentação registrada no caixa.')
  }

  function fecharCaixaOperacao(caixa, dados) {
    return executar(() => api.post(`/api/admin/barbearia/operacao/caixas/${caixa.id}/fechamento`, dados), 'Caixa fechado com resumo de conferência.')
  }

  function fecharDiaOperacao(data) {
    if (!window.confirm(`Confirmar fechamento financeiro do dia ${fmtDateOnly(data)}? Esta ação consolida o livro financeiro e não cria pagamentos.`)) return
    return executar(() => api.post('/api/admin/barbearia/operacao/fechar-dia', { data, confirmado: true }), 'Fechamento financeiro diário concluído.')
  }

  function abrirNovoAgendamento() {
    setFormAgenda({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: profissionalFiltro || '', servicoId: servicos[0]?.id || '', data: dataSelecionada, hora: '10:00', observacoes: '' })
    setModal('agenda')
  }

  // Clique num horário livre (Agenda por período): abre o agendamento já preenchido.
  function abrirAgendamentoNoHorario({ data, hora, profissionalId, servicoId }) {
    setFormAgenda({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: profissionalId || '', servicoId: servicoId || servicos[0]?.id || '', data, hora, observacoes: '' })
    setModal('agenda')
  }

  function abrirEdicaoAgendamento(agendamento) {
    setFormAgenda({
      clienteId: agendamento.clienteId || '',
      clienteNome: agendamento.clienteId ? '' : (agendamento.clienteNome || agendamento.cliente_nome || ''),
      clienteTelefone: agendamento.clienteTelefone || agendamento.cliente_telefone || '',
      profissionalId: agendamento.profissionalId || '',
      servicoId: agendamento.servicoId || '',
      data: String(agendamento.dataAgenda || agendamento.dataHora || dataSelecionada).slice(0, 10),
      hora: horario(agendamento.dataHora),
      observacoes: agendamento.observacoes || '',
    })
    setModal({ tipo: 'editarAgenda', agendamento })
  }

  function abrirCliente(cliente) {
    setModal({ tipo: 'detalheCliente', cliente })
  }

  function abrirEdicaoCliente(cliente) {
    setFormCliente({ nome: cliente.nome || '', telefone: cliente.telefone || '', email: cliente.email || '', limiteCreditoMensal: Number(cliente.limiteCreditoMensal || 0), diasVencimento: Number(cliente.diasVencimento || 30), observacao: cliente.observacao || '' })
    setModal({ tipo: 'editarCliente', cliente })
  }

  function agendarParaCliente(cliente) {
    setFormAgenda({ clienteId: cliente.id, clienteNome: '', clienteTelefone: cliente.telefone || '', profissionalId: profissionalFiltro || '', servicoId: servicos.find((item) => item.ativo !== false)?.id || '', data: dataSelecionada, hora: '10:00', observacoes: '' })
    navegarParaTab('Agenda')
    setModal('agenda')
  }

  // Vindo da ficha Customer 360: abre a agenda já com o cliente selecionado.
  const agendarClienteParam = searchParams.get('agendarCliente')
  useEffect(() => {
    if (!agendarClienteParam || !clientes.length) return
    const cliente = clientes.find((item) => item.id === agendarClienteParam)
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('agendarCliente'); return next }, { replace: true })
    if (cliente) agendarParaCliente(cliente)
  }, [agendarClienteParam, clientes]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirRecebimento(agendamento) {
    setFormRecebimento({ meioPagamento: 'pix', usarCashback: '', valeCodigo: '', valeValor: '' })
    setSaldoCashbackCliente(null)
    setModal({ tipo: 'recebimento', agendamento })
    // Sinal já pago entra como receita na hora do pagamento: o recebimento do dia é só o restante.
    setConferindoSinal(true)
    api.get(`/api/admin/barbearia/agenda/${agendamento.id}/sinal`).then((resposta) => {
      const sinal = resposta?.sinal
      if (sinal?.status === 'paga') {
        setSaldoCashbackCliente((atual) => ({ ...(atual || {}), sinalPago: sinal.valor }))
      }
    }).catch(() => {}).finally(() => setConferindoSinal(false))
    const telefone = agendamento.clienteTelefone || agendamento.cliente_telefone
    if (telefone) api.post('/api/admin/barbearia/cashback/consulta', { telefone }).then((resposta) => setSaldoCashbackCliente((atual) => ({ ...(atual || {}), ...resposta.cashback }))).catch(() => {})
  }

  function abrirNovaComanda(agendamento = null) {
    const cliente = agendamento?.clienteId ? clientes.find((item) => item.id === agendamento.clienteId) : null
    setFormComanda({
      clienteId: agendamento?.clienteId || '',
      clienteNome: cliente ? '' : (agendamento?.clienteNome || ''),
      clienteTelefone: cliente?.telefone || agendamento?.clienteTelefone || '',
      profissionalId: agendamento?.profissionalId || profissionalFiltro || '',
      agendamentoId: agendamento?.id || '',
      itemTipo: 'servico',
      itemId: agendamento?.servicoId || servicos.find((item) => item.ativo !== false)?.id || '',
      quantidade: 1,
      gorjeta: '',
      desconto: '',
      descontoMotivo: '',
      observacoes: agendamento?.observacoes || '',
    })
    setModal('novaComanda')
  }

  async function atualizarComandaNaTela(operacao, sucesso) {
    setSalvando(true)
    try {
      const resposta = await operacao()
      const comanda = resposta?.comanda || resposta
      toast(sucesso, 'success')
      setModal(comanda?.id ? { tipo: 'comanda', comanda } : null)
      await carregar()
    } catch (error) {
      toast(error.message || 'Comanda não atualizada.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function abrirComanda(comanda) {
    try {
      const resposta = await api.get(`/api/admin/barbearia/comandas/${comanda.id}`)
      const atual = resposta?.comanda || resposta
      setFormPagamentoComanda({ meioPagamento: 'pix', valor: String(atual?.saldoPendente || atual?.total || ''), clienteId: atual?.clienteId || '', caixaId: '' })
      setFormComanda((formAtual) => ({ ...formAtual, clienteId: atual?.clienteId || '', clienteNome: atual?.clienteNome || '', clienteTelefone: atual?.clienteTelefone || '', profissionalId: atual?.profissionalId || '', agendamentoId: atual?.agendamentoId || '', gorjeta: String(atual?.gorjeta || ''), desconto: String(atual?.desconto || ''), descontoMotivo: atual?.descontoMotivo || '', observacoes: atual?.observacoes || '', itemId: '', quantidade: 1 }))
      setModal({ tipo: 'comanda', comanda: atual })
    } catch (error) {
      toast(error.message || 'Não foi possível carregar a comanda.', 'error')
    }
  }

  async function criarComanda(event) {
    event.preventDefault()
    const cliente = clientes.find((item) => item.id === formComanda.clienteId)
    const item = formComanda.itemTipo === 'servico'
      ? servicos.find((itemServico) => itemServico.id === formComanda.itemId)
      : produtosRevenda.find((itemProduto) => itemProduto.id === formComanda.itemId)
    if (!item) {
      toast('Selecione ao menos um serviço ou produto.', 'error')
      return
    }
    const payload = {
      clienteId: formComanda.clienteId,
      clienteNome: cliente?.nome || formComanda.clienteNome,
      clienteTelefone: cliente?.telefone || formComanda.clienteTelefone,
      profissionalId: formComanda.profissionalId,
      agendamentoId: formComanda.agendamentoId,
      gorjeta: Number(formComanda.gorjeta || 0),
      desconto: Number(formComanda.desconto || 0),
      descontoMotivo: formComanda.descontoMotivo,
      observacoes: formComanda.observacoes,
      itens: [{ tipo: formComanda.itemTipo, [formComanda.itemTipo === 'servico' ? 'servicoId' : 'produtoId']: formComanda.itemId, quantidade: Number(formComanda.quantidade || 1), profissionalId: formComanda.profissionalId }],
    }
    await atualizarComandaNaTela(() => api.post('/api/admin/barbearia/comandas', payload), 'Comanda aberta.')
  }

  async function adicionarItemComanda(event) {
    event.preventDefault()
    const comanda = modal?.comanda
    if (!comanda || !formComanda.itemId) return
    const item = formComanda.itemTipo === 'servico'
      ? servicos.find((itemServico) => itemServico.id === formComanda.itemId)
      : produtosRevenda.find((itemProduto) => itemProduto.id === formComanda.itemId)
    if (!item) return
    await atualizarComandaNaTela(() => api.post(`/api/admin/barbearia/comandas/${comanda.id}/itens`, { itens: [{ tipo: formComanda.itemTipo, [formComanda.itemTipo === 'servico' ? 'servicoId' : 'produtoId']: formComanda.itemId, quantidade: Number(formComanda.quantidade || 1), profissionalId: formComanda.profissionalId || comanda.profissionalId }] }), 'Item adicionado à comanda.')
    setFormComanda((atual) => ({ ...atual, itemId: '', quantidade: 1 }))
  }

  async function salvarDetalhesComanda(event) {
    event.preventDefault()
    const comanda = modal?.comanda
    if (!comanda) return
    await atualizarComandaNaTela(() => api.patch(`/api/admin/barbearia/comandas/${comanda.id}`, { gorjeta: Number(formComanda.gorjeta || 0), desconto: Number(formComanda.desconto || 0), descontoMotivo: formComanda.descontoMotivo, observacoes: formComanda.observacoes }), 'Comanda atualizada.')
  }

  async function aguardarPagamentoComanda() {
    const comanda = modal?.comanda
    if (!comanda) return
    await atualizarComandaNaTela(() => api.post(`/api/admin/barbearia/comandas/${comanda.id}/aguardar-pagamento`, {}), 'Comanda encaminhada para pagamento.')
  }

  async function cancelarComanda() {
    const comanda = modal?.comanda
    if (!comanda || !window.confirm(`Cancelar a comanda de ${comanda.clienteNome || 'cliente eventual'}?`)) return
    await atualizarComandaNaTela(() => api.post(`/api/admin/barbearia/comandas/${comanda.id}/cancelar`, { motivo: 'Cancelamento manual confirmado pelo operador.' }), 'Comanda cancelada.')
  }

  async function pagarComanda() {
    const comanda = modal?.comanda
    const valor = Number(formPagamentoComanda.valor || comanda?.saldoPendente || 0)
    if (!comanda || !Number.isFinite(valor) || valor <= 0) {
      toast('Informe um valor positivo para o recebimento.', 'error')
      return
    }
    if (formPagamentoComanda.meioPagamento === 'conta' && !formPagamentoComanda.clienteId && !comanda.clienteId) {
      toast('Selecione um cliente cadastrado para lançar em conta.', 'error')
      return
    }
    if (!window.confirm(`Confirmar recebimento de ${moeda(valor)} nesta comanda? A confirmação poderá registrar financeiro e baixar produtos.`)) return
    const chaveIdempotencia = `barbearia-comanda:${comanda.id}:${formPagamentoComanda.meioPagamento}:${valor.toFixed(2)}`
    await atualizarComandaNaTela(() => api.post(`/api/admin/barbearia/comandas/${comanda.id}/pagamentos`, { confirmado: true, clienteId: formPagamentoComanda.clienteId || comanda.clienteId, pagamentos: [{ meio: formPagamentoComanda.meioPagamento, valor, caixaId: formPagamentoComanda.caixaId || undefined }], chaveIdempotencia }), 'Recebimento confirmado.')
  }

  async function mudarStatus(agendamento, novoStatus) {
    const label = STATUS[novoStatus]?.label || novoStatus
    if (novoStatus === 'cancelado' && !window.confirm(`Cancelar o atendimento de ${agendamento.clienteNome || agendamento.cliente_nome || 'cliente'}?`)) return
    await executar(
      () => api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, { status: novoStatus, registrarFinanceiro: false }),
      `Atendimento marcado como ${label.toLowerCase()}.`,
      { mostrarPesquisa: novoStatus === 'concluido' },
    )
  }

  function valorDevidoRecebimento(agendamento) {
    const total = Number(agendamento?.valor || 0)
    const devido = total - Number(saldoCashbackCliente?.sinalPago || 0) - Number(formRecebimento.usarCashback || 0) - (formRecebimento.valeCodigo ? Number(formRecebimento.valeValor || 0) : 0)
    return Math.round(Math.max(0, devido) * 100) / 100
  }

  async function concluirEReceber() {
    const agendamento = modal?.agendamento
    if (!agendamento) return
    // O valor do dia é calculado (e conferido no servidor): serviço − sinal pago − cashback usado.
    const valor = valorDevidoRecebimento(agendamento)
    if (!formRecebimento.meioPagamento || !Number.isFinite(valor) || valor < 0 || Number(agendamento.valor) <= 0) {
      toast('Verifique o preço do serviço e informe o meio de pagamento.', 'error')
      return
    }
    const usarCashback = Number(formRecebimento.usarCashback || 0)
    if (usarCashback < 0 || (usarCashback > 0 && usarCashback > Number(saldoCashbackCliente?.saldo || 0))) {
      toast('O cashback usado não pode passar do saldo do cliente.', 'error')
      return
    }
    await executar(
      () => api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, { status: 'concluido', registrarFinanceiro: true, confirmado: true, meioPagamento: formRecebimento.meioPagamento, valorRecebido: valor, ...(usarCashback > 0 ? { usarCashback } : {}), ...(formRecebimento.valeCodigo && Number(formRecebimento.valeValor) > 0 ? { usarVale: { codigo: formRecebimento.valeCodigo, valor: Number(formRecebimento.valeValor) } } : {}) }),
      'Atendimento concluído e recebimento registrado no financeiro central.',
      { mostrarPesquisa: true },
    )
  }

  async function salvarAgenda(event) {
    event.preventDefault()
    const cliente = clientes.find((item) => item.id === formAgenda.clienteId)
    const dataAgenda = formAgenda.data || dataSelecionada
    const payload = {
      clienteId: formAgenda.clienteId,
      clienteNome: cliente?.nome || formAgenda.clienteNome,
      clienteTelefone: cliente?.telefone || formAgenda.clienteTelefone,
      profissionalId: formAgenda.profissionalId,
      servicoId: formAgenda.servicoId,
      dataHora: new Date(`${dataAgenda}T${formAgenda.hora}:00`).toISOString(),
      dataAgenda,
      observacoes: formAgenda.observacoes,
      origem: 'admin',
    }
    const editando = modal?.tipo === 'editarAgenda'
    if (editando && !window.confirm(`Confirmar a remarcação para ${fmtDateOnly(dataAgenda)} às ${formAgenda.hora}?`)) return
    await executar(() => editando ? api.patch(`/api/admin/barbearia/agenda/${modal.agendamento.id}`, payload) : api.post('/api/admin/barbearia/agenda', payload), editando ? 'Agendamento remarcado.' : 'Agendamento criado.')
    if (editando && dataAgenda !== dataSelecionada) setDataSelecionada(dataAgenda)
  }

  function novoFormProfissional(profissional = {}) {
    return {
      nome: profissional.nome || '',
      telefone: profissional.telefone || '',
      email: profissional.email || '',
      especialidade: profissional.especialidade || 'Barbeiro',
      tipo: profissional.tipo || 'parceiro',
      percentualComissao: profissional.percentualComissao ?? 50,
      percentualComissaoProduto: profissional.percentualComissaoProduto ?? 30,
      descontaTaxaMaquininha: profissional.descontaTaxaMaquininha !== false,
      horarioInicio: profissional.horarioInicio || '08:00',
      horarioFim: profissional.horarioFim || '18:00',
      diasTrabalho: Array.isArray(profissional.diasTrabalho) ? [...profissional.diasTrabalho] : [1, 2, 3, 4, 5, 6],
      ativo: profissional.ativo !== false,
      fotoUrl: profissional.fotoUrl || '',
    }
  }

  function abrirNovoProfissional() {
    setFormProf(novoFormProfissional())
    setModal({ tipo: 'profissional', profissionalId: null })
  }

  function editarProfissional(profissional) {
    setFormProf(novoFormProfissional(profissional))
    setModal({ tipo: 'profissional', profissionalId: profissional.id })
  }

  async function salvarProfissional(event) {
    event.preventDefault()
    const profissionalId = modal?.tipo === 'profissional' ? modal.profissionalId : null
    const payload = {
      ...formProf,
      percentualComissao: Number(formProf.percentualComissao),
      percentualComissaoProduto: Number(formProf.percentualComissaoProduto),
      diasTrabalho: Array.isArray(formProf.diasTrabalho) ? formProf.diasTrabalho : [],
    }
    await executar(
      () => profissionalId ? api.patch(`/api/admin/barbearia/profissionais/${profissionalId}`, payload) : api.post('/api/admin/barbearia/profissionais', payload),
      profissionalId ? 'Profissional atualizado.' : 'Profissional cadastrado.',
    )
  }

  async function alternarProfissional(profissional) {
    const ativo = profissional.ativo === false
    await executar(() => api.patch(`/api/admin/barbearia/profissionais/${profissional.id}`, { ativo }), ativo ? 'Profissional reativado.' : 'Profissional desativado.')
  }

  async function excluirProfissional(profissional) {
    if (!window.confirm(`Excluir ${profissional.nome}? O cadastro será arquivado para preservar agenda, comandas e comissões históricas.`)) return
    await executar(() => api.delete(`/api/admin/barbearia/profissionais/${profissional.id}`), 'Profissional excluído e arquivado.')
  }

  async function salvarServico(event) {
    event.preventDefault()
    const consumoInterno = (formServico.consumoInterno || []).filter((item) => item.produtoId).map((item) => ({ produtoId: item.produtoId, quantidade: Number(item.quantidade) || 1 }))
    await executar(() => api.post('/api/admin/barbearia/servicos', { ...formServico, preco: Number(formServico.preco), permiteAgendamentoOnline: Boolean(formServico.permiteAgendamentoOnline), consumoInterno }), 'Serviço cadastrado.')
  }

  async function alternarProfissionalDoServico(servico, profissionalId) {
    const atuais = new Set(servico.profissionaisIds || [])
    if (atuais.has(profissionalId)) atuais.delete(profissionalId)
    else atuais.add(profissionalId)
    await executar(() => api.patch(`/api/admin/barbearia/servicos/${servico.id}`, { ...servico, profissionaisIds: [...atuais] }), atuais.size ? 'Profissionais do serviço atualizados.' : 'Serviço liberado para todos os profissionais.')
  }

  async function alternarServico(servico) {
    const ativo = servico.ativo === false
    await executar(() => api.patch(`/api/admin/barbearia/servicos/${servico.id}`, { ...servico, ativo }), ativo ? 'Serviço reativado.' : 'Serviço desativado.')
  }

  async function salvarCliente(event) {
    event.preventDefault()
    const payload = { ...formCliente, limiteCreditoMensal: Number(formCliente.limiteCreditoMensal || 0), diasVencimento: Number(formCliente.diasVencimento || 30) }
    const editando = modal?.tipo === 'editarCliente'
    await executar(() => editando ? api.patch(`/api/admin/barbearia/clientes/${modal.cliente.id}`, payload) : api.post('/api/admin/barbearia/clientes', payload), editando ? 'Cliente e política de crédito atualizados.' : 'Cliente cadastrado no CRM.')
  }

  async function salvarConfiguracao(event) {
    event.preventDefault()
    await executar(() => api.patch('/api/admin/barbearia/configuracoes', formConfig), 'Configurações atualizadas.')
  }

  function atualizarTaxaPagamento(meio, campo, valor) {
    setFormConfig((atual) => ({ ...atual, taxasPagamento: { ...(atual.taxasPagamento || {}), [meio]: { ...(atual.taxasPagamento?.[meio] || {}), [campo]: valor } } }))
  }

  async function prepararFiscalComanda(comanda) {
    if (!comanda || !window.confirm(`Preparar rascunho fiscal da comanda ${comanda.id}? Esta ação não emite nem transmite documento.`)) return
    await executar(() => api.post(`/api/admin/barbearia/comandas/${comanda.id}/fiscal/rascunho`, { confirmado: true, chaveIdempotencia: `barbearia:fiscal:${comanda.id}` }), 'Rascunho fiscal preparado; emissão externa continua pendente.')
  }

  async function salvarConfiguracaoUnidade(event) {
    event.preventDefault()
    if (!configuracaoUnidade?.calendario) return
    if (!window.confirm('Confirmar a atualização do calendário da unidade ativa?')) return
    await executar(() => api.patch('/api/admin/barbearia/configuracoes/unidade-ativa', configuracaoUnidade.calendario), 'Calendário da unidade atualizado.')
  }

  async function salvarFila(event) {
    event.preventDefault()
    const cliente = clientes.find((item) => item.id === formFila.clienteId)
    const payload = { ...formFila, clienteNome: cliente?.nome || formFila.clienteNome, clienteTelefone: cliente?.telefone || formFila.clienteTelefone, previsaoMinutos: Number(formFila.previsaoMinutos) }
    await executar(() => api.post('/api/admin/barbearia/fila', payload), 'Cliente adicionado à fila.')
  }

  function alterarFila(item, status) {
    if (status === 'chamado') {
      setFormFilaChamada({ mesaOuPosicao: item.mesaOuPosicao || '' })
      setModal({ tipo: 'filaChamada', item })
      return
    }
    return executar(() => api.patch(`/api/admin/barbearia/fila/${item.id}/status`, { status, mesaOuPosicao: item.mesaOuPosicao || '' }), `Fila atualizada para ${status}.`)
  }

  async function concluirChamadaFila(event) {
    event.preventDefault()
    const item = modal?.item
    const mesaOuPosicao = formFilaChamada.mesaOuPosicao.trim()
    if (!item || !mesaOuPosicao) return
    await executar(() => api.patch(`/api/admin/barbearia/fila/${item.id}/status`, { status: 'chamado', mesaOuPosicao }), 'Cliente chamado e posição registrada.')
  }

  async function salvarBloqueio(event) {
    event.preventDefault()
    const inicio = new Date(`${dataSelecionada}T${formBloqueio.inicioHora}:00`).toISOString()
    const fim = new Date(`${dataSelecionada}T${formBloqueio.fimHora}:00`).toISOString()
    await executar(() => api.post('/api/admin/barbearia/bloqueios', { titulo: formBloqueio.titulo, motivo: formBloqueio.motivo, inicio, fim, profissionalId: formBloqueio.profissionalId }), 'Bloqueio criado.')
  }

  async function desativarBloqueio(bloqueio) {
    if (!window.confirm(`Desativar o bloqueio “${bloqueio.titulo}”?`)) return
    await executar(() => api.delete(`/api/admin/barbearia/bloqueios/${bloqueio.id}`), 'Bloqueio desativado.')
  }

  async function salvarPlano(event) {
    event.preventDefault()
    await executar(() => api.post('/api/admin/barbearia/planos', { ...formPlano, preco: Number(formPlano.preco), sessoesIncluidas: Number(formPlano.sessoesIncluidas), validadeDias: Number(formPlano.validadeDias) }), 'Plano criado.')
  }

  async function salvarAssinatura(event) {
    event.preventDefault()
    const cliente = clientes.find((item) => item.id === formAssinatura.clienteId)
    await executar(() => api.post('/api/admin/barbearia/assinaturas', { ...formAssinatura, clienteNome: cliente?.nome || formAssinatura.clienteNome }), 'Assinatura criada como pendente de ativação.')
  }

  async function ativarAssinatura(assinatura) {
    if (!window.confirm('Ativar esta assinatura sem cobrança automática? Confirme apenas se a contratação foi validada fora deste fluxo.')) return
    await executar(() => api.patch(`/api/admin/barbearia/assinaturas/${assinatura.id}/status`, { status: 'ativa', confirmadoSemCobranca: true, pagamentoConfirmado: false }), 'Assinatura ativada sem cobrança automática.')
  }

  async function aderirFidelidade(cliente) {
    if (!window.confirm(`Confirmar adesão de ${cliente.nome} ao programa de fidelidade?`)) return
    await executar(() => api.post('/api/admin/barbearia/fidelidade/membros', { clienteId: cliente.id }), 'Cliente aderiu ao programa de fidelidade.')
  }

  async function salvarRegraFidelidade(event) {
    event.preventDefault()
    if (!window.confirm('Confirmar a alteração da regra de pontos para a empresa ativa?')) return
    await executar(() => api.patch('/api/admin/barbearia/fidelidade/regra', formFidelidade), 'Regra de fidelidade atualizada.')
  }

  function abrirCreditoFidelidade(membro) {
    setFormCreditoFidelidade({ valor: '' })
    setModal({ tipo: 'creditoFidelidade', membro })
  }

  async function creditarFidelidade(event) {
    event.preventDefault()
    const membro = modal?.membro
    const valor = Number(formCreditoFidelidade.valor)
    if (!membro || !Number.isFinite(valor) || valor <= 0) return
    if (!window.confirm(`Confirmar crédito de pontos com base em R$ ${valor.toFixed(2)} para ${membro.nome}?`)) return
    await executar(() => api.post('/api/admin/barbearia/fidelidade/creditar', { clienteId: membro.clienteId, valor, origem: 'barbearia_atendimento', confirmado: true }), 'Pontos creditados.')
  }

  async function atualizarConsentimento(cliente, canal, finalidade, concedido) {
    const estado = concedido ? 'conceder' : 'revogar'
    if (!window.confirm(`Confirmar ${estado} do consentimento de ${cliente.nome} para ${finalidade} por ${canal}?`)) return
    await executar(() => api.patch(`/api/admin/barbearia/clientes/${cliente.id}/consentimentos`, { canal, finalidade, concedido, confirmado: true, origem: 'painel_barbearia' }), 'Consentimento atualizado e auditado.')
  }

  async function salvarProdutoRevenda(event) {
    event.preventDefault()
    await executar(() => api.post('/api/admin/barbearia/estoque-revenda', { ...formProdutoRevenda, precoVenda: Number(formProdutoRevenda.precoVenda), custoUnitario: Number(formProdutoRevenda.custoUnitario || 0), estoqueAtual: Number(formProdutoRevenda.estoqueAtual || 0), estoqueMinimo: Number(formProdutoRevenda.estoqueMinimo || 0) }), 'Produto de revenda cadastrado.')
  }

  function movimentarProdutoRevenda(produto, tipo) {
    setFormMovimentoRevenda({ quantidade: 1, observacao: 'Movimento manual no módulo Barbearia.' })
    setModal({ tipo: 'movimentoRevenda', produto, movimentoTipo: tipo })
  }

  async function concluirMovimentoRevenda(event) {
    event.preventDefault()
    const produto = modal?.produto
    const tipo = modal?.movimentoTipo
    const quantidade = Number(formMovimentoRevenda.quantidade)
    const movimentoLabel = tipo === 'entrada' ? 'entrada' : tipo === 'saida_manual' ? 'saída manual' : 'ajuste'
    if (!produto || !tipo || !Number.isInteger(quantidade) || quantidade <= 0) return
    if (!window.confirm(`Confirmar ${movimentoLabel} de ${quantidade} ${produto.unidade || 'un'} em ${produto.nome}?`)) return
    await executar(() => api.post(`/api/admin/barbearia/estoque-revenda/${produto.id}/movimentos`, { tipo, quantidade, confirmado: true, observacao: formMovimentoRevenda.observacao.trim() || 'Movimento manual no módulo Barbearia.' }), 'Movimento de estoque registrado.')
  }

  function adicionarItemVendaRevenda(event) {
    event.preventDefault()
    const produto = produtosRevenda.find((item) => item.id === formVendaRevenda.produtoId)
    const quantidade = Number(formVendaRevenda.quantidade)
    if (!produto || !Number.isInteger(quantidade) || quantidade <= 0) return
    setItensVendaRevenda((itens) => {
      const existente = itens.find((item) => item.produtoId === produto.id)
      if (existente) return itens.map((item) => item.produtoId === produto.id ? { ...item, quantidade: item.quantidade + quantidade } : item)
      return [...itens, { produtoId: produto.id, nome: produto.nome, unidade: produto.unidade, precoUnitario: produto.precoVenda, quantidade }]
    })
    setFormVendaRevenda((atual) => ({ ...atual, produtoId: '', quantidade: 1 }))
  }

  async function salvarVendaRevenda(event) {
    event.preventDefault()
    if (itensVendaRevenda.length === 0) return
    await executar(() => api.post('/api/admin/barbearia/vendas-revenda', { clienteId: formVendaRevenda.clienteId, clienteNome: formVendaRevenda.clienteNome, profissionalId: formVendaRevenda.profissionalId, observacao: formVendaRevenda.observacao, itens: itensVendaRevenda.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })) }), 'Venda de revenda criada como pendente.')
    setItensVendaRevenda([])
    setFormVendaRevenda({ clienteId: '', clienteNome: '', profissionalId: '', observacao: '', produtoId: '', quantidade: 1 })
  }

  async function configurarWhatsappAi(status) {
    if (status === 'ativo' && !window.confirm('Confirmar a ativação do atendente IA no WhatsApp desta unidade? Mensagens recebidas passarão a ser processadas pelo Gemini e poderão preparar ações sujeitas a confirmação do cliente.')) return
    await executar(() => api.post('/api/admin/commerce/whatsapp-ai/channel', {
      instance: formWhatsappAi.instance,
      displayName: formWhatsappAi.displayName,
      status,
      confirmed: status === 'ativo',
      webhookSecretEnv: 'WHATSAPP_AI_WEBHOOK_SECRET',
      webhookHeader: 'x-setpoint-webhook-token',
      capabilities: {
        humanized: formWhatsappAi.humanized === true,
        captureLeads: formWhatsappAi.captureLeads === true,
        operateStore: formWhatsappAi.operateStore === true,
        manageAppointments: formWhatsappAi.manageAppointments === true,
        sendPromotions: formWhatsappAi.sendPromotions === true,
        reminders: formWhatsappAi.reminders === true,
        humanHandoff: formWhatsappAi.humanHandoff !== false,
      },
    }), status === 'ativo' ? 'Atendente WhatsApp ativado.' : 'Configuração do canal salva.')
  }

  async function salvarPoliticaWhatsappAi() {
    if (!whatsappAi?.channel) {
      toast('Salve primeiro o canal WhatsApp em rascunho.', 'error')
      return
    }
    if (formWhatsappAiPolicy.opportunitiesEnabled && !formWhatsappAiPolicy.personalizationEnabled) {
      toast('Oportunidades exigem personalização habilitada.', 'error')
      return
    }
    const resumo = formWhatsappAiPolicy.opportunitiesEnabled
      ? 'Confirmar política com personalização e oportunidades? Isso não ativa o canal nem envia mensagens, mas permitirá esses recursos quando o atendente for ativado separadamente.'
      : 'Confirmar a política de atendimento desta unidade? Isso não ativa o canal nem envia mensagens.'
    if (!window.confirm(resumo)) return
    await executar(() => api.patch('/api/admin/commerce/whatsapp-ai/policy', {
      personalizationEnabled: formWhatsappAiPolicy.personalizationEnabled,
      opportunitiesEnabled: formWhatsappAiPolicy.opportunitiesEnabled,
      cooldownDays: Number(formWhatsappAiPolicy.cooldownDays || 30),
      privacyNotice: formWhatsappAiPolicy.privacyNotice.trim(),
      confirmed: true,
    }), 'Política do atendente atualizada e auditada.')
  }

  async function salvarPersonaWhatsappAi() {
    if (!whatsappAi?.channel) {
      toast('Salve primeiro o canal WhatsApp em rascunho.', 'error')
      return
    }
    const nome = formPersona.nome.trim()
    if (!nome) {
      toast('Informe o nome do atendente.', 'error')
      return
    }
    if (/^dino$/i.test(nome)) {
      toast('O atendente não pode se chamar Dino: é o nome do barbeiro master.', 'error')
      return
    }
    const resumo = formPersona.ativo
      ? `Confirmar o atendente "${nome}"? Muda só o jeito de falar (mensagens curtas, figurinhas). Agenda, confirmações e travas continuam iguais.`
      : 'Desligar a persona e voltar ao texto padrão do atendente?'
    if (!window.confirm(resumo)) return
    await executar(() => api.patch('/api/admin/commerce/whatsapp-ai/persona', {
      id: 'trex',
      ativo: formPersona.ativo,
      nome,
      mensagensCurtas: formPersona.mensagensCurtas,
      figurinhas: formPersona.figurinhas,
      revelarIa: formPersona.revelarIa,
      confirmed: true,
    }), formPersona.ativo ? `Atendente ${nome} salvo e auditado.` : 'Persona desligada.')
  }

  async function sincronizarWhatsappAi() {
    if (!window.confirm('Confirmar a sincronização do webhook no provedor de WhatsApp? Essa ação altera a configuração externa da instância informada.')) return
    await executar(async () => {
      const resultado = await api.post('/api/admin/commerce/whatsapp-ai/channel/sync-webhook', { confirmed: true })
      if (resultado?.manual && resultado.instructions) window.alert(resultado.instructions)
      return resultado
    }, 'Webhook do WhatsApp sincronizado.')
  }

  async function testarGeminiWhatsappAi() {
    if (!window.confirm('Executar um diagnóstico curto do Gemini? O teste consome uma chamada mínima e não envia mensagem nem executa ferramentas.')) return
    await executar(() => api.post('/api/admin/commerce/whatsapp-ai/diagnostics/gemini', { confirmed: true }), 'Gemini respondeu ao diagnóstico com sucesso.')
  }

  async function assumirSessaoWhatsappAi(sessionId) {
    if (!window.confirm('Assumir esta conversa na fila humana? A automação continuará pausada.')) return
    await executar(() => api.post(`/api/admin/commerce/whatsapp-ai/sessions/${sessionId}/claim`, {}), 'Conversa atribuída ao operador.')
  }

  async function liberarSessaoWhatsappAi(sessionId, pausaDaEquipe) {
    if (!window.confirm(pausaDaEquipe ? 'A equipe terminou esta conversa no celular? A IA volta a responder este cliente agora.' : 'Retomar o atendimento automático desta conversa após concluir o handoff humano?')) return
    await executar(() => api.post(`/api/admin/commerce/whatsapp-ai/sessions/${sessionId}/release`, {}), 'Atendimento automático retomado.')
  }

  async function encerrarSessaoWhatsappAi(sessionId) {
    if (!window.confirm('Encerrar esta conversa humana? A ação pendente será descartada e a automação não enviará resposta nesta sessão.')) return
    await executar(() => api.post(`/api/admin/commerce/whatsapp-ai/sessions/${sessionId}/close`, {}), 'Conversa humana encerrada.')
  }

  async function enviarWhatsApp(event) {
    event.preventDefault()
    const cliente = clientes.find((item) => item.id === formWhatsApp.clienteId)
    const telefone = formWhatsApp.telefone.trim() || cliente?.telefone || ''
    const consentiu = cliente?.consentimentos?.whatsapp?.[formWhatsApp.finalidade]?.concedido === true
    if (!telefone || !formWhatsApp.mensagem.trim()) return
    if (cliente && !consentiu) {
      toast('O cliente ainda não possui consentimento para esta finalidade.', 'error')
      return
    }
    if (!cliente && !formWhatsApp.consentimentoConfirmado) {
      toast('Confirme a autorização do destinatário antes de enviar.', 'error')
      return
    }
    if (!window.confirm('Confirmar o envio desta mensagem pelo WhatsApp? O envio será feito agora para o destinatário autorizado.')) return
    await executar(() => api.post('/api/admin/barbearia/whatsapp/enviar', { ...formWhatsApp, telefone, confirmado: true }), 'Mensagem enviada pelo WhatsApp.')
    setFormWhatsApp({ clienteId: '', finalidade: 'atendimento', telefone: '', mensagem: '', consentimentoConfirmado: false })
  }

  async function consultarAssistente(event) {
    event.preventDefault()
    if (!assistentePergunta.trim()) return
    setConsultandoAssistente(true)
    try {
      const resposta = await api.post('/api/admin/barbearia/ia/assistente', { pergunta: assistentePergunta, data: dataSelecionada })
      setAssistenteResposta(resposta)
    } catch (error) {
      setAssistenteResposta({ erro: error.message || 'Não foi possível consultar o assistente IA.' })
    } finally {
      setConsultandoAssistente(false)
    }
  }

  function confirmarVendaRevenda(venda) {
    setFormPagamentoVendaRevenda({ meioPagamento: 'pix' })
    setModal({ tipo: 'pagamentoVendaRevenda', venda })
  }

  async function concluirPagamentoVendaRevenda(event) {
    event.preventDefault()
    const venda = modal?.venda
    if (!venda || !formPagamentoVendaRevenda.meioPagamento) return
    if (!window.confirm(`Confirmar recebimento manual de ${moeda(venda.total)} para a venda ${venda.id}? Esta ação baixa estoque e registra receita no financeiro.`)) return
    await executar(() => api.post(`/api/admin/barbearia/vendas-revenda/${venda.id}/confirmar-pagamento`, { confirmadoPagamento: true, meioPagamento: formPagamentoVendaRevenda.meioPagamento, valorRecebido: venda.total }), 'Venda confirmada, estoque baixado e receita registrada.')
  }

  function renderAgendaTabela(itens = agendamentos) {
    return <Card style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
        <thead><tr style={styles.tableHead}>
          {['Horário', 'Cliente', 'Profissional', 'Serviço', 'Valor', 'Status', 'Ações'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}
        </tr></thead>
        <tbody>
          {itens.length === 0 ? <tr><td colSpan={7} style={styles.empty}>Nenhum atendimento encontrado para os filtros selecionados.</td></tr> : itens.map((item) => {
            const proximas = TRANSICOES[item.status] || []
            return <tr key={item.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ ...styles.td, fontWeight: 800, whiteSpace: 'nowrap' }}>{horario(item.dataHora)}</td>
              <td style={styles.td}><strong>{item.clienteNome || item.cliente_nome || 'Cliente não informado'}</strong><div style={styles.sub}>{item.clienteTelefone || item.cliente_telefone || '—'}</div></td>
              <td style={styles.td}>{item.profissionalNome || item.profissional_nome || 'Qualquer profissional'}</td>
              <td style={styles.td}>{item.servicoNome || item.servico_nome || '—'}<div style={styles.sub}>{item.duracaoMinutos || item.duracao_minutos || 0} min</div></td>
              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>{moeda(item.valor)}</td>
              <td style={styles.td}><Badge status={item.status} /></td>
              <td style={{ ...styles.td, minWidth: 170 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {proximas.slice(0, 2).map((proximo) => <button key={proximo} type="button" style={styles.small} onClick={() => mudarStatus(item, proximo)}>{STATUS[proximo]?.label}</button>)}
                  {item.status === 'concluido' && !item.financeiroLancamentoId && <button type="button" style={{ ...styles.small, color: 'var(--accent)' }} onClick={() => abrirRecebimento(item)}>Registrar recebimento</button>}
                </div>
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </Card>
  }

  function renderVisaoGeral() {
    const proximos = dashboard?.proximosAgendamentos || []
    const atividadeRecente = [
      ...agendamentos.map((item) => ({ id: `agenda-${item.id}`, titulo: `Atendimento · ${item.clienteNome || item.cliente_nome || 'Cliente'}`, nota: `${item.servicoNome || item.servico_nome || 'Serviço'} · ${STATUS[item.status]?.label || item.status || 'Sem status'}`, ts: item.atualizadoEm || item.criadoEm || item.dataHora, status: item.status })),
      ...comandas.map((item) => ({ id: `comanda-${item.id}`, titulo: `Comanda ${item.id}`, nota: `${item.clienteNome || 'Cliente eventual'} · ${moeda(item.total)} · ${STATUS[item.status]?.label || item.status || 'Sem status'}`, ts: item.atualizadoEm || item.criadoEm, status: item.status })),
      ...vendasRevenda.map((item) => ({ id: `venda-${item.id}`, titulo: `Revenda · ${item.id}`, nota: `${item.clienteNome || 'Venda balcão'} · ${moeda(item.total)} · ${STATUS[item.status === 'pago' ? 'paga' : item.status]?.label || item.status || 'Sem status'}`, ts: item.atualizadoEm || item.criadoEm, status: item.status === 'pago' ? 'paga' : item.status })),
    ].filter((item) => item.ts).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 6)
    const rankingAtendentes = [...(comissoes?.porProfissional || [])].sort((a, b) => (Number(b.brutoServicos || 0) + Number(b.brutoProdutos || 0)) - (Number(a.brutoServicos || 0) + Number(a.brutoProdutos || 0))).slice(0, 5)
    return <div style={{ display: 'grid', gap: 20 }}>
      {isDinoBrand && <DinoBusinessDashboard onOpenTab={navegarParaTab} />}
      <Card style={styles.todayHero}>
        <div style={styles.todayHeroTop}>
          <div><div style={styles.kicker}>Ritual de abertura</div><h2 style={{ ...styles.h2, fontSize: 23, marginTop: 5 }}>Hoje na unidade</h2><p style={{ ...styles.sub, maxWidth: 700 }}>Comece pela agenda, acompanhe quem está aguardando e resolva as pendências antes do primeiro atendimento.</p></div>
          <div style={styles.todayStatus}><span>Data operacional</span><strong>{fmtDateOnly(dataSelecionada)}</strong><input aria-label="Escolher data operacional" type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} style={styles.compactDate} /><small>{dashboard?.caixa?.aberto ? 'Caixa aberto' : 'Caixa ainda não aberto'}</small></div>
        </div>
        <div style={styles.quickActions} aria-label="Atalhos da operação"><button type="button" style={styles.primary} onClick={() => navegarParaTab('Agenda')}>Abrir agenda</button><button type="button" style={styles.secondary} onClick={() => navegarParaTab('Atendimento')}>Abrir atendimento</button><button type="button" style={styles.secondary} onClick={() => navegarParaTab('Caixa e fechamento')}>Abrir caixa</button><button type="button" style={styles.secondary} onClick={() => navegarParaTab('Fila e bloqueios')}>Ver fila e bloqueios</button><button type="button" style={styles.secondary} onClick={() => { setFormCliente({ nome: '', telefone: '', email: '', observacao: '' }); setModal('cliente') }}>Cadastrar cliente</button></div>
      </Card>
      <div style={styles.kpiGrid}>
        <Kpi label="Atendimentos hoje" value={indicadores.agendamentosHoje || 0} note={`${indicadores.confirmadosHoje || 0} confirmados`} />
        <Kpi label="Em atendimento" value={indicadores.emAtendimento || 0} note="Fila operacional atual" color="#f59e0b" />
        <Kpi label="Concluídos hoje" value={indicadores.concluidosHoje || 0} note={moeda(indicadores.faturamentoHoje)} color="#14b87a" />
        <Kpi label="Clientes no CRM" value={indicadores.clientesAtivos || 0} note={`${indicadores.profissionaisAtivos || 0} profissionais ativos`} color="#8b5cf6" />
        <Kpi label="Fila ativa" value={indicadores.filaAguardando || 0} note="Aguardando ou chamados" color="#4a9eff" />
        <Kpi label="Bloqueios hoje" value={indicadores.bloqueiosHoje || 0} note={`${indicadores.assinaturasAtivas || 0} assinaturas ativas`} color="#f59e0b" />
        <Kpi label="Revendas pagas" value={indicadores.vendasRevendaHoje || 0} note={moeda(indicadores.receitaRevendaHoje)} color="#14b87a" />
        <Kpi label="Comandas em aberto" value={resumoComandas?.abertas || 0} note={`${resumoComandas?.aguardandoPagamento || 0} aguardando pagamento`} color="#f59e0b" />
      </div>
      <div style={styles.twoColumns}>
        <Card style={{ padding: 20 }}>
          <div style={styles.sectionTitle}><div><h2 style={styles.h2}>Próximos atendimentos</h2><p style={styles.sub}>Agenda persistida da empresa ativa.</p></div><button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>Novo agendamento</button></div>
          {proximos.length === 0 ? <div style={styles.empty}>A agenda está livre para os próximos horários. Nenhuma reserva foi criada automaticamente.</div> : <div style={{ display: 'grid', gap: 10 }}>{proximos.map((item) => <div key={item.id} style={styles.listRow}><div><strong>{horario(item.dataHora)} · {item.clienteNome || item.cliente_nome}</strong><div style={styles.sub}>{item.servicoNome || item.servico_nome} · {item.profissionalNome || item.profissional_nome || 'sem profissional'}</div></div><Badge status={item.status} /></div>)}</div>}
        </Card>
        <Card style={{ padding: 20 }}>
          <div style={styles.sectionTitle}><div><h2 style={styles.h2}>Financeiro e caixa</h2><p style={styles.sub}>Resumo em leitura do ERP central.</p></div></div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={styles.metricLine}><span>Receitas pagas no mês</span><strong>{moeda(dashboard?.financeiro?.recMes)}</strong></div>
            <div style={styles.metricLine}><span>A receber</span><strong>{moeda(dashboard?.financeiro?.aReceber)}</strong></div>
            <div style={styles.metricLine}><span>Saldo acumulado</span><strong>{moeda(dashboard?.financeiro?.saldo)}</strong></div>
            <div style={styles.metricLine}><span>Caixa do dia</span><strong>{dashboard?.caixa?.aberto ? 'Aberto' : 'Não aberto'}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            <a href="/admin/financeiro" style={styles.secondary}>Abrir financeiro</a><a href="/admin/caixa" style={styles.secondary}>Abrir caixa</a><a href="/admin/crm" style={styles.secondary}>Abrir CRM</a><a href="/admin/estoque" style={styles.secondary}>Abrir estoque</a>
          </div>
        </Card>
      </div>
      <div style={styles.twoColumns}>
        <Card style={{ padding: 20 }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Recepção</div><h2 style={{ ...styles.h2, marginTop: 4 }}>Fila e capacidade agora</h2><p style={styles.sub}>Acompanhe a espera da unidade sem sair da visão principal.</p></div><button type="button" style={styles.secondary} onClick={() => navegarParaTab('Fila e bloqueios')}>Gerenciar fila</button></div>{(dashboard?.filaEspera || []).length === 0 ? <div style={styles.inlineEmpty}><strong>Fila vazia</strong><span>Nenhum cliente aguardando ou chamado para a data selecionada.</span></div> : <div style={{ display: 'grid', gap: 8 }}>{dashboard.filaEspera.slice(0, 5).map((item) => <div key={item.id} style={styles.queueRow}><div><strong>{item.senha} · {item.clienteNome || 'Cliente eventual'}</strong><small>{item.previsaoMinutos || 0} min de previsão</small></div><Badge status={item.status === 'aguardando' ? 'agendado' : 'em_atendimento'} /></div>)}</div>}</Card>
        <Card style={{ padding: 20 }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Controle</div><h2 style={{ ...styles.h2, marginTop: 4 }}>Pendências do dia</h2><p style={styles.sub}>Ações recomendadas com base nos dados carregados.</p></div></div><div style={{ display: 'grid', gap: 8 }}>{[[indicadores.profissionaisAtivos ? 'Equipe cadastrada' : 'Cadastrar equipe', indicadores.profissionaisAtivos ? `${indicadores.profissionaisAtivos} atendente(s) ativo(s)` : 'A agenda precisa de atendentes', 'Profissionais', indicadores.profissionaisAtivos ? 'ok' : 'attention'], [indicadores.servicosAtivos ? 'Catálogo disponível' : 'Cadastrar serviços', indicadores.servicosAtivos ? `${indicadores.servicosAtivos} serviço(s) ativo(s)` : 'Defina preço e duração para agendar', 'Serviços', indicadores.servicosAtivos ? 'ok' : 'attention'], [dashboard?.caixa?.aberto ? 'Caixa aberto' : 'Conferir caixa', dashboard?.caixa?.aberto ? 'Operação financeira em andamento' : 'Abra o caixa antes do primeiro recebimento', 'Caixa e fechamento', dashboard?.caixa?.aberto ? 'ok' : 'attention']].map(([titulo, nota, destino, estado]) => <button type="button" key={titulo} onClick={() => navegarParaTab(destino === 'Gestão' ? 'Configuração' : destino)} style={{ ...styles.actionRow, ...(estado === 'attention' ? styles.actionRowAttention : {}) }}><span><strong>{titulo}</strong><small>{nota}</small></span><span aria-hidden="true">›</span></button>)}</div></Card>
      </div>
      <div style={styles.twoColumns}>
        <Card style={{ padding: 20 }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Ritmo da unidade</div><h2 style={styles.h2}>Atividade recente</h2><p style={styles.sub}>Eventos persistidos no overview, sem simulação ou atualização automática.</p></div><button type="button" style={styles.secondary} onClick={carregar}>Atualizar</button></div>{atividadeRecente.length === 0 ? <div style={styles.inlineEmpty}><strong>Nenhuma atividade recente</strong><span>Agendamentos, comandas e revendas aparecerão aqui quando existirem na unidade.</span></div> : <div style={{ display: 'grid', gap: 8 }}>{atividadeRecente.map((item) => <div key={item.id} style={styles.feedRow}><div><strong>{item.titulo}</strong><small>{item.nota}</small></div><div style={{ textAlign: 'right' }}><Badge status={item.status} /><small>{fmtDate(item.ts)}</small></div></div>)}</div>}</Card>
        <Card style={{ padding: 20 }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Desempenho</div><h2 style={styles.h2}>Top atendentes</h2><p style={styles.sub}>Ranking indicativo por bruto apurado no recorte selecionado.</p></div><button type="button" style={styles.secondary} onClick={() => navegarParaTab('Comissões')}>Ver comissões</button></div>{rankingAtendentes.length === 0 ? <div style={styles.inlineEmpty}><strong>Sem apuração ainda</strong><span>Conclua atendimentos ou confirme vendas para formar o ranking real.</span></div> : <div style={{ display: 'grid', gap: 8 }}>{rankingAtendentes.map((item, indice) => <div key={item.profissionalId} style={styles.feedRow}><div><strong>{indice + 1}. {item.profissionalNome}</strong><small>{item.atendimentos || 0} atendimento(s) · {item.vendasProdutos || 0} revenda(s)</small></div><strong>{moeda(Number(item.brutoServicos || 0) + Number(item.brutoProdutos || 0))}</strong></div>)}</div>}</Card>
      </div>
      <Card style={{ padding: 20 }}>
        <div style={styles.sectionTitle}><div><div style={styles.kicker}>Próximas ações</div><h2 style={{ ...styles.h2, marginTop: 4 }}>Prontidão operacional</h2><p style={styles.sub}>O módulo reutiliza cadastros e livros existentes; nenhuma venda, reserva ou pagamento é simulado.</p></div><span style={styles.contextPill}>{indicadores.profissionaisAtivos && indicadores.servicosAtivos ? 'Base pronta' : 'Completar cadastros'}</span></div>
        <div style={styles.readinessGrid}>
          {[['Profissionais', indicadores.profissionaisAtivos, 'Cadastre a equipe e percentuais de comissão.'], ['Serviços', indicadores.servicosAtivos, 'Defina duração e preço para a agenda.'], ['Clientes', indicadores.clientesAtivos, 'Clientes são persistidos no CRM por empresa.'], ['Financeiro', dashboard?.financeiro ? 'Conectado' : 'Indisponível', 'Recebimentos exigem confirmação explícita.']].map(([titulo, valor, nota]) => <div key={titulo} style={styles.readinessItem}><strong>{titulo}</strong><span style={{ color: 'var(--accent)', fontWeight: 800 }}>{valor || 0}</span><small style={styles.sub}>{nota}</small></div>)}
        </div>
      </Card>
    </div>
  }

  function renderAgenda() {
    const unidade = configuracaoUnidade?.calendario
    const atendentesAtivos = profissionais.filter((item) => item.ativo !== false)
    return <div style={{ display: 'grid', gap: 18 }}>
      <Card style={{ padding: 18, background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--card))' }}>
        <div style={styles.sectionTitle}><div><div style={styles.kicker}>Agenda operacional</div><h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>Dia da barbearia e dos atendentes</h2><p style={styles.sub}>Acompanhe horários, duração, serviço, cliente e status em uma única visão. A unidade da sessão é aplicada automaticamente.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={styles.secondary} onClick={carregar}>Atualizar agenda</button><button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>+ Agendar atendimento</button></div></div>
        <div style={styles.agendaToolbar}><Field label="Data"><input type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} style={inputStyle} /></Field><Field label="Status"><select value={statusFiltro} onChange={(event) => setStatusFiltro(event.target.value)} style={inputStyle}><option value="">Todos os status</option>{Object.entries(STATUS).map(([valor, item]) => <option key={valor} value={valor}>{item.label}</option>)}</select></Field><Field label="Atendente"><select value={profissionalFiltro} onChange={(event) => setProfissionalFiltro(event.target.value)} style={inputStyle}><option value="">Toda a equipe</option>{profissionais.filter((item) => item.ativo !== false).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><div style={styles.agendaMeta}><strong>{atendentesAtivos.length}</strong><span>atendentes ativos</span><small>{unidade ? `${unidade.horarioAbertura}–${unidade.horarioFechamento}` : 'Horário corporativo'} · {agendamentos.length} registros no dia</small></div><div style={styles.viewToggle} role="group" aria-label="Modo de agenda"><span>Visualização</span><div><button type="button" onClick={() => setAgendaModo('timeline')} aria-pressed={agendaModo === 'timeline'} style={{ ...styles.viewToggleButton, ...(agendaModo === 'timeline' ? styles.viewToggleButtonActive : {}) }}>Linha do tempo</button><button type="button" onClick={() => setAgendaModo('lista')} aria-pressed={agendaModo === 'lista'} style={{ ...styles.viewToggleButton, ...(agendaModo === 'lista' ? styles.viewToggleButtonActive : {}) }}>Lista</button></div></div></div>
      </Card>
      <Card style={styles.agendaSummary}>
        {[['Atendimentos', agendamentos.length, 'Agenda do dia', 'var(--accent)'], ['Confirmados', agendamentos.filter((item) => item.status === 'confirmado').length, 'Prontos para receber', '#8b5cf6'], ['Em atendimento', agendamentos.filter((item) => item.status === 'em_atendimento').length, 'Em execução agora', '#f59e0b'], ['Avisos na fila', Number(notificacoesAgenda.queued || 0), `${Number(notificacoesAgenda.sent || 0)} enviados · opt-in obrigatório`, '#2563eb'], ['Bloqueios', bloqueios.length, 'Horários indisponíveis', '#e05c5c'], ['Equipe', atendentesAtivos.length, 'Atendentes ativos', '#14b87a']].map(([label, value, note, color]) => <div key={label} style={styles.agendaSummaryItem}><strong style={{ color }}>{value}</strong><span>{label}</span><small>{note}</small></div>)}
      </Card>
      <BarbeariaAgendaPeriodo profissionais={profissionais} servicos={servicos} profissionalId={profissionalFiltro} onProfissionalChange={setProfissionalFiltro} onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })} onPickSlot={abrirAgendamentoNoHorario} refreshKey={agendamentos.length} />
      {agendaModo === 'timeline' ? <BarbeariaAgendaBoard data={dataSelecionada} configuracao={unidade || configuracao || {}} agendamentos={agendamentos} profissionais={profissionalFiltro ? atendentesAtivos.filter((item) => item.id === profissionalFiltro) : atendentesAtivos} bloqueios={bloqueios} onDateChange={(novaData) => { setStatusFiltro(''); setDataSelecionada(novaData) }} onNew={abrirNovoAgendamento} onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })} /> : <div><div style={{ ...styles.sectionTitle, marginBottom: 10 }}><div><h2 style={styles.h2}>Lista detalhada do dia</h2><p style={styles.sub}>Use a lista para visualizar dados completos e executar transições permitidas.</p></div></div>{renderAgendaTabela()}</div>}
    </div>
  }

  function renderAtendimento() {
    const colunas = ['agendado', 'confirmado', 'em_atendimento', 'concluido']
    const comandasAbertas = comandas.filter((item) => !['paga', 'cancelada'].includes(item.status))
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 16 }}>
        <div style={styles.toolbar}>
          <div><h2 style={styles.h2}>Quadro de atendimento</h2><p style={styles.sub}>Atualize o status, abra a comanda e conclua o recebimento no mesmo fluxo operacional.</p></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}><Field label="Data"><input type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} style={inputStyle} /></Field><button type="button" style={styles.secondary} onClick={() => abrirNovaComanda()}>Abrir comanda avulsa</button><button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>Novo atendimento</button></div>
        </div>
      </Card>
      <Card style={{ padding: 16 }}>
        <div style={styles.sectionTitle}><div><div style={styles.kicker}>Cobrança no atendimento</div><h2 style={styles.h2}>Comandas da unidade</h2><p style={styles.sub}>Serviços e produtos podem entrar na mesma comanda; pagamento, caixa e baixa de estoque só acontecem após confirmação explícita.</p></div><div style={styles.comandaSummary}><strong>{comandasAbertas.length}</strong><span>em aberto</span></div></div>
        {comandasAbertas.length === 0 ? <div style={styles.inlineEmpty}><strong>Nenhuma comanda em aberto</strong><span>Abra uma comanda avulsa ou a partir de um atendimento.</span></div> : <div style={styles.comandaGrid}>{comandasAbertas.map((comanda) => <button key={comanda.id} type="button" style={styles.comandaCard} onClick={() => abrirComanda(comanda)}><span><strong>{comanda.clienteNome || 'Cliente eventual'}</strong><small>{comanda.itens?.length || 0} item(ns) · {comanda.agendamentoId ? 'vinculada à agenda' : 'avulsa'}</small></span><span><strong>{moeda(comanda.total)}</strong><Badge status={comanda.status} /></span></button>)}</div>}
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(235px, 100%), 1fr))', gap: 12 }}>{colunas.map((status) => <Card key={status} style={{ padding: 14, minHeight: 220 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Badge status={status} /><strong>{agendamentos.filter((item) => item.status === status).length}</strong></div><div style={{ display: 'grid', gap: 9 }}>{agendamentos.filter((item) => item.status === status).map((item) => { const comandaDoAtendimento = comandas.find((comanda) => comanda.agendamentoId === item.id && comanda.status !== 'cancelada'); return <div key={item.id} role="button" tabIndex={0} onClick={() => setModal({ tipo: 'detalheAgenda', agendamento: item })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setModal({ tipo: 'detalheAgenda', agendamento: item }) }} style={{ ...styles.attendanceCard, borderLeftColor: STATUS[status]?.color || 'var(--accent)' }}><strong>{horario(item.dataHora)} · {item.clienteNome || item.cliente_nome || 'Cliente sem nome'}</strong><div style={styles.sub}>{item.servicoNome || item.servico_nome || 'Serviço não informado'} · {item.profissionalNome || item.profissional_nome || 'Sem atendente'}</div><div style={styles.attendanceMeta}><span>{item.clienteTelefone || item.cliente_telefone || 'Sem telefone'}</span><span>{item.duracaoMinutos || item.duracao_minutos || 0} min</span></div><div onClick={(event) => event.stopPropagation()} style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(TRANSICOES[status] || []).slice(0, 2).map((proximo) => <button key={proximo} type="button" style={styles.small} onClick={() => mudarStatus(item, proximo)}>{STATUS[proximo]?.label}</button>)}{status === 'concluido' && !item.financeiroLancamentoId && <button type="button" style={{ ...styles.small, color: 'var(--accent)' }} onClick={() => abrirRecebimento(item)}>Receber legado</button>}<button type="button" style={{ ...styles.small, color: 'var(--accent)' }} onClick={() => comandaDoAtendimento ? abrirComanda(comandaDoAtendimento) : abrirNovaComanda(item)}>{comandaDoAtendimento ? 'Abrir comanda' : 'Criar comanda'}</button></div></div> })}</div></Card>)}</div>
    </div>
  }

  function renderOperacao() {
    return <BarbeariaOperacaoPanel data={dataSelecionada} operacao={operacao || {}} onOpenCaixa={abrirCaixaOperacao} onMove={movimentarCaixaOperacao} onClose={fecharCaixaOperacao} onCloseDay={fecharDiaOperacao} salvando={salvando} />
  }

  function renderClientes() {
    const indicadoresRelacionamento = relacionamento?.indicadores || {}
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 16 }}>
        <div style={styles.sectionTitle}>
          <div><div style={styles.kicker}>CRM 360°</div><h2 style={styles.h2}>Relacionamento da unidade</h2><p style={styles.sub}>{isDinoBrand ? 'Visitas, receita, contas e consentimentos conectados à central governada de campanhas WhatsApp.' : 'Uma leitura consolidada de visitas, receita, contas e permissões de contato. O painel não envia mensagens nem cria campanhas.'}</p></div>
          <div style={styles.tableActions}><button type="button" style={styles.primary} onClick={() => { setFormCliente({ nome: '', telefone: '', email: '', limiteCreditoMensal: 0, diasVencimento: 30, observacao: '' }); setModal('cliente') }}>+ Novo cliente</button><button type="button" style={styles.secondary} onClick={() => navigate('/admin/clientes-360')}>Clientes 360</button></div>
        </div>
        <div style={styles.kpiGrid}>
          <Kpi label="Clientes ativos" value={indicadoresRelacionamento.clientesAtivos || clientes.length} note="Empresa ativa" />
          <Kpi label="Com visita" value={indicadoresRelacionamento.clientesComVisita || 0} note="Atendimento concluído" color="#8b5cf6" />
          <Kpi label="Membros fidelidade" value={indicadoresRelacionamento.membrosFidelidade || 0} note="Adesão registrada" color="#f59e0b" />
          <Kpi label="Receita recebida" value={moeda(indicadoresRelacionamento.receitaRecebida || 0)} note="Comandas e revenda pagas" color="#14b87a" />
        </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginTop: 16 }}><label style={{ flex: '1 1 280px', minWidth: 0 }}><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Buscar cliente</span><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, telefone ou e-mail" style={inputStyle} /></label><label style={{ flex: '0 1 230px', minWidth: 190 }}><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Segmento operacional</span><select value={filtroClientes} onChange={(event) => setFiltroClientes(event.target.value)} style={inputStyle}><option value="todos">Todos os clientes</option><option value="ativos">Com visita registrada</option><option value="fidelidade">Membros de fidelidade</option><option value="consentimento">Com consentimento</option><option value="inativos">Sem visita registrada</option></select></label></div>

      </Card>
      {isDinoBrand && <DinoCampaignsPanel />}
      <Card style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead><tr style={styles.tableHead}>{['Cliente', 'Contato', 'Visitas', 'Receita', 'A receber', 'Consentimentos', 'Última atividade'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead>
          <tbody>
            {listaBuscaClientes.length === 0 ? <tr><td colSpan={7} style={styles.empty}>Nenhum cliente encontrado no CRM desta empresa.</td></tr> : listaBuscaClientes.map((cliente) => {
              const resumo = relacionamentoPorCliente[cliente.id] || {}
              const consentimentos = cliente.consentimentos || {}
              const concedidos = ['whatsapp', 'email'].flatMap((canal) => ['atendimento', 'marketing'].map((finalidade) => consentimentos[canal]?.[finalidade]?.concedido === true)).filter(Boolean).length
              return <tr key={cliente.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={styles.td}><button type="button" onClick={() => navigate(`/admin/clientes-360/${encodeURIComponent(`dino:${cliente.id}`)}`)} style={{ padding: 0, border: 0, background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 800, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--line)' }} title="Abrir Customer 360">{cliente.nome}</button><div style={styles.sub}>{cliente.tipo === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'}</div></td>
                <td style={styles.td}>{cliente.telefone || '—'}<div style={styles.sub}>{cliente.email || '—'}</div></td>
                <td style={{ ...styles.td, fontWeight: 800 }}>{resumo.visitas || 0}<div style={styles.sub}>{resumo.agendamentos || 0} agendamento(s)</div></td>
                <td style={{ ...styles.td, fontWeight: 800 }}>{moeda(resumo.receitaRecebida || 0)}</td>
                <td style={{ ...styles.td, fontWeight: 800, color: Number(resumo.aReceber || cliente.saldoDevedor || 0) > 0 ? '#f59e0b' : 'inherit' }}>{moeda(resumo.aReceber ?? cliente.saldoDevedor ?? 0)}</td>
                <td style={styles.td}><strong>{concedidos}/4</strong><div style={styles.sub}>{concedidos ? 'Permissões ativas' : 'Nenhuma permissão'}</div></td>
                <td style={styles.td}>{resumo.ultimaAtividadeEm ? fmtDate(resumo.ultimaAtividadeEm) : 'Sem atividade'}<div style={styles.tableActions}><button type="button" style={styles.small} onClick={() => navigate(`/admin/clientes-360/${encodeURIComponent(`dino:${cliente.id}`)}`)}>Ficha 360</button><button type="button" style={styles.small} onClick={() => abrirCliente(cliente)}>Editar</button><button type="button" style={{ ...styles.small, color: 'var(--accent)' }} onClick={() => agendarParaCliente(cliente)}>Agendar</button></div></td>
              </tr>
            })}
          </tbody>
        </table>
      </Card>
    </div>
  }

  function renderProfissionais() {
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 16 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Equipe da unidade</h2><p style={styles.sub}>Percentuais ficam no cadastro e podem alimentar a apuração, sem gerar repasse automaticamente.</p></div><button type="button" style={styles.primary} onClick={abrirNovoProfissional}>+ Novo profissional</button></div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar na equipe" style={{ ...inputStyle, marginTop: 14, maxWidth: 420 }} /></Card><Card style={styles.teamSummary}>{[['Ativos', profissionais.filter((item) => item.ativo !== false).length, 'Disponíveis para agenda', '#14b87a'], ['Atendimentos hoje', agendamentos.length, 'Carga da unidade', 'var(--accent)'], ['Comissão média', profissionais.length ? `${Math.round(profissionais.reduce((soma, item) => soma + Number(item.percentualComissao || 0), 0) / profissionais.length)}%` : '—', 'Serviços concluídos', '#8b5cf6'], ['Sem jornada', profissionais.filter((item) => !item.horarioInicio || !item.horarioFim).length, 'Revisar disponibilidade', '#f59e0b']].map(([label, value, note, color]) => <div key={label} style={styles.teamSummaryItem}><strong style={{ color }}>{value}</strong><span>{label}</span><small>{note}</small></div>)}</Card><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14 }}>{listaBuscaProfissionais.length === 0 ? <Card style={styles.empty}>Nenhum profissional cadastrado na empresa ativa.</Card> : listaBuscaProfissionais.map((profissional) => <Card key={profissional.id} style={{ padding: 18, opacity: profissional.ativo === false ? .62 : 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ ...styles.avatar, overflow: 'hidden', padding: 0 }}>{profissional.fotoUrl ? <img src={profissional.fotoUrl} alt={`Foto de ${profissional.nome}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciais(profissional.nome)}</div><div style={{ minWidth: 0, flex: 1 }}><strong style={{ fontSize: 17, overflowWrap: 'anywhere' }}>{profissional.nome}</strong><div style={styles.sub}>{profissional.especialidade} · {profissional.tipo}</div></div></div><div style={styles.profileGrid}><div><small style={styles.sub}>Comissão serviço</small><strong>{profissional.percentualComissao}%</strong></div><div><small style={styles.sub}>Comissão produto</small><strong>{profissional.percentualComissaoProduto}%</strong></div><div><small style={styles.sub}>Horário</small><strong>{profissional.horarioInicio}–{profissional.horarioFim}</strong></div></div><div style={{ display: 'flex', gap: 5, marginTop: 14 }}>{DIAS.map((dia, indice) => <span key={dia} style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: (profissional.diasTrabalho || []).includes(indice) ? 'var(--accent)' : 'var(--bg)', color: (profissional.diasTrabalho || []).includes(indice) ? '#fff' : 'var(--muted)', fontSize: 10, fontWeight: 800 }}>{dia[0]}</span>)}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 15 }}><button type="button" style={{ ...styles.secondary, flex: '1 1 150px' }} onClick={() => editarProfissional(profissional)}>Editar</button><button type="button" style={{ ...styles.secondary, flex: '1 1 170px' }} onClick={() => alternarProfissional(profissional)}>{profissional.ativo === false ? 'Reativar' : 'Desativar'}</button><button type="button" style={{ ...styles.small, flex: '0 1 auto', color: '#e05c5c', borderColor: 'color-mix(in srgb, #e05c5c 45%, var(--line))' }} onClick={() => excluirProfissional(profissional)}>Excluir</button></div></Card>)}</div></div>
  }

  function renderServicos() {
    const categorias = [...new Set(listaBuscaServicos.map((servico) => servico.categoria || 'Geral'))]
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 18, background: 'linear-gradient(135deg, color-mix(in srgb, #8b5cf6 10%, var(--card)), var(--card))' }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Catálogo comercial</div><h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>Serviços da barbearia</h2><p style={styles.sub}>Veja preço, duração, categoria, descrição e disponibilidade de cada serviço. O mesmo catálogo alimenta a agenda e os planos.</p></div><button type="button" style={styles.primary} onClick={() => { setFormServico({ nome: '', descricao: '', categoria: 'Geral', duracaoMinutos: 30, preco: '', permiteAgendamentoOnline: true, consumoInterno: [] }); setModal('servico') }}>+ Novo serviço</button></div><div style={styles.serviceSummary}>{[['Serviços ativos', listaBuscaServicos.filter((servico) => servico.ativo !== false).length, '#14b87a'], ['Categorias', categorias.length, '#8b5cf6'], ['Agendamento online', listaBuscaServicos.filter((servico) => servico.permiteAgendamentoOnline !== false && servico.ativo !== false).length, '#4a9eff']].map(([label, value, color]) => <div key={label} style={styles.serviceSummaryItem}><strong style={{ color }}>{value}</strong><span>{label}</span></div>)}</div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, categoria ou descrição" style={{ ...inputStyle, marginTop: 16, maxWidth: 520 }} /></Card>
      {listaBuscaServicos.length === 0 ? <Card style={styles.empty}>Nenhum serviço cadastrado na empresa ativa. Cadastre o primeiro para liberar a agenda.</Card> : <div style={styles.serviceGrid}>{listaBuscaServicos.map((servico) => <Card key={servico.id} style={{ padding: 17, opacity: servico.ativo === false ? .58 : 1 }}><div style={styles.serviceCardTop}><div><span style={styles.serviceCategory}>{servico.categoria || 'Geral'}</span><h3 style={{ margin: '8px 0 4px', fontSize: 18 }}>{servico.nome}</h3></div><strong style={{ color: 'var(--accent)', fontSize: 18 }}>{moeda(servico.preco)}</strong></div><p style={{ margin: '10px 0 14px', color: 'var(--muted)', minHeight: 38, fontSize: 13 }}>{servico.descricao || 'Descrição ainda não preenchida.'}</p><div style={styles.serviceFacts}><span><strong>{servico.duracaoMinutos}</strong> min</span><span>{servico.permiteAgendamentoOnline !== false ? 'Online ativo' : 'Online desativado'}</span><span>{servico.consumoInterno?.length ? `${servico.consumoInterno.length} insumo(s) por atendimento` : 'Sem consumo interno'}</span><Badge status={servico.ativo === false ? 'cancelado' : 'concluido'} /></div><div style={{ marginTop: 12 }}><div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Quem faz este serviço {servico.profissionaisIds?.length ? '' : '· todos os profissionais'}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{profissionais.filter((profissional) => profissional.ativo !== false).map((profissional) => { const marcado = (servico.profissionaisIds || []).includes(profissional.id); return <button key={profissional.id} type="button" aria-pressed={marcado} onClick={() => alternarProfissionalDoServico(servico, profissional.id)} style={{ ...styles.small, borderColor: marcado ? 'var(--accent)' : undefined, color: marcado ? 'var(--accent)' : undefined, fontWeight: marcado ? 700 : 500 }}>{marcado ? '✓ ' : ''}{profissional.nome}</button> })}</div></div><button type="button" style={{ ...styles.secondary, width: '100%', marginTop: 15 }} onClick={() => alternarServico(servico)}>{servico.ativo === false ? 'Reativar serviço' : 'Desativar serviço'}</button></Card>)}</div>}
      <Card style={{ padding: 18 }}><h3 style={{ margin: 0, fontSize: 16 }}>Como o catálogo é utilizado</h3><div style={styles.readinessGrid}><div style={styles.readinessItem}><strong>Agenda</strong><small style={styles.sub}>Duração e preço são usados na reserva e no conflito de horários.</small></div><div style={styles.readinessItem}><strong>Atendimento</strong><small style={styles.sub}>O operador visualiza o serviço no cartão do cliente.</small></div><div style={styles.readinessItem}><strong>Planos</strong><small style={styles.sub}>Os serviços ativos podem ser associados a planos sem cobrança automática.</small></div></div></Card>
    </div>
  }

  function renderComissoes() {
    const porProfissional = comissoes?.porProfissional || []
    const meiosTaxa = [['pix', 'PIX'], ['debito', 'Débito'], ['credito', 'Crédito'], ['cartao', 'Cartão genérico'], ['transferencia', 'Transferência'], ['tef', 'TEF'], ['carteira', 'Carteira']]
    const taxasTotal = porProfissional.reduce((soma, item) => soma + Number(item.taxas || 0), 0)
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 18 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Comissões e rateio</h2><p style={styles.sub}>Apuração indicativa de serviços concluídos e produtos pagos em {fmtDateOnly(dataSelecionada)}. Nenhuma taxa é presumida: sem cadastro comprovado, o repasse usa o bruto e a taxa permanece indisponível.</p></div><a href="/admin/financeiro" style={styles.secondary}>Ver livro financeiro</a></div></Card>
      <div style={styles.kpiGrid}><Kpi label="Bruto apurado" value={moeda(porProfissional.reduce((soma, item) => soma + Number(item.bruto || 0), 0))} note="Serviços e produtos pagos" /><Kpi label="Taxas comprovadas" value={comissoes?.taxasConfiguradas ? moeda(taxasTotal) : '—'} note={comissoes?.taxasConfiguradas ? 'Somente regras cadastradas com fonte' : 'Indisponível: nenhuma taxa real cadastrada'} color="#f59e0b" /><Kpi label="Repasse indicativo" value={moeda(porProfissional.reduce((soma, item) => soma + Number(item.repasse || 0), 0))} note="Não é pagamento" color="#14b87a" /><Kpi label="Vendas sem profissional" value={comissoes?.vendasSemProfissional || 0} note={moeda(comissoes?.brutoSemProfissional)} color="#e05c5c" /></div>
      {comissoes?.meiosSemTaxaConfigurada?.length > 0 && <div style={styles.notice}><strong>Taxa não aplicada</strong><div style={styles.sub}>Sem regra comprovada para: {comissoes.meiosSemTaxaConfigurada.join(', ')}. O sistema não inventou desconto e calculou a comissão sobre o bruto.</div></div>}
      <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h3 style={{ margin: 0 }}>Taxas reais por meio</h3><p style={styles.sub}>Cadastre somente percentuais e valores fixos do contrato/extrato da adquirente. Zerar ambos remove a regra.</p></div></div><form onSubmit={salvarConfiguracao} style={{ display: 'grid', gap: 10 }}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}><thead><tr style={styles.tableHead}>{['Meio', '%', 'Fixa (R$)', 'Fonte obrigatória'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{meiosTaxa.map(([meio, label]) => { const regra = formConfig?.taxasPagamento?.[meio] || {}; return <tr key={meio} style={{ borderTop: '1px solid var(--line)' }}><td style={styles.td}><strong>{label}</strong></td><td style={styles.td}><input aria-label={`Taxa percentual ${label}`} type="number" min="0" max="100" step="0.0001" value={regra.percentual ?? ''} onChange={(event) => atualizarTaxaPagamento(meio, 'percentual', event.target.value)} style={{ ...inputStyle, minWidth: 110 }} /></td><td style={styles.td}><input aria-label={`Taxa fixa ${label}`} type="number" min="0" step="0.01" value={regra.fixa ?? ''} onChange={(event) => atualizarTaxaPagamento(meio, 'fixa', event.target.value)} style={{ ...inputStyle, minWidth: 110 }} /></td><td style={styles.td}><input aria-label={`Fonte da taxa ${label}`} value={regra.fonte ?? ''} onChange={(event) => atualizarTaxaPagamento(meio, 'fonte', event.target.value)} placeholder="Contrato, extrato ou adquirente" style={{ ...inputStyle, minWidth: 240 }} /></td></tr> })}</tbody></table></div><div style={styles.modalActions}><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar taxas comprovadas'}</button></div></form></Card>
      <Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}><thead><tr style={styles.tableHead}>{['Profissional', 'Serviços', 'Produtos', 'Bruto serviços', 'Bruto produtos', 'Comissão serviços', 'Comissão produtos', 'Repasse indicativo'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{porProfissional.length === 0 ? <tr><td colSpan={8} style={styles.empty}>Ainda não há atendimentos concluídos ou vendas de produtos atribuídas para apuração.</td></tr> : porProfissional.map((item) => <tr key={item.profissionalId} style={{ borderTop: '1px solid var(--line)' }}><td style={styles.td}><strong>{item.profissionalNome}</strong><div style={styles.sub}>{item.percentualComissao}% serviços · {item.percentualComissaoProduto}% produtos</div></td><td style={styles.td}>{item.atendimentos}</td><td style={styles.td}>{item.vendasProdutos}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(item.brutoServicos)}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(item.brutoProdutos)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#8b5cf6' }}>{moeda(item.comissaoServicos)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#8b5cf6' }}>{moeda(item.comissaoProdutos)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#14b87a' }}>{moeda(item.repasse)}</td></tr>)}</tbody></table></Card>
      {(comissoes?.vendasSemProfissional || 0) > 0 && <Card style={{ padding: 18 }}><strong>Vendas sem profissional atribuído</strong><div style={styles.sub}>{comissoes.vendasSemProfissional} venda(s), total de {moeda(comissoes.brutoSemProfissional)}. Elas não entram em repasse até uma atribuição operacional explícita.</div></Card>}
    </div>
  }

  function renderFilaBloqueios() {
    const filaAtiva = fila.filter((item) => item.status === 'aguardando' || item.status === 'chamado')
    return <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.twoColumns}>
        <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Fila de espera</h2><p style={styles.sub}>Senha por empresa e dia operacional; nenhum aviso externo é enviado automaticamente.</p></div><strong style={{ color: 'var(--accent)' }}>{filaAtiva.length} ativos</strong></div><form onSubmit={salvarFila} style={{ display: 'grid', gap: 14 }}><div style={styles.formGrid}><Field label="Cliente cadastrado"><select value={formFila.clienteId} onChange={(event) => setFormFila((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Selecionar cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></Field><Field label="Nome eventual"><input value={formFila.clienteNome} onChange={(event) => setFormFila((atual) => ({ ...atual, clienteNome: event.target.value, clienteId: '' }))} style={inputStyle} placeholder="Se não estiver no CRM" /></Field><Field label="Serviço"><select value={formFila.servicoId} onChange={(event) => setFormFila((atual) => ({ ...atual, servicoId: event.target.value }))} style={inputStyle}><option value="">Qualquer serviço</option>{servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}</select></Field><Field label="Preferência de profissional"><select value={formFila.preferenciaProfissionalId} onChange={(event) => setFormFila((atual) => ({ ...atual, preferenciaProfissionalId: event.target.value }))} style={inputStyle}><option value="">Qualquer profissional</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Previsão (min.)"><input type="number" min="0" max="720" value={formFila.previsaoMinutos} onChange={(event) => setFormFila((atual) => ({ ...atual, previsaoMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone eventual"><input value={formFila.clienteTelefone} onChange={(event) => setFormFila((atual) => ({ ...atual, clienteTelefone: event.target.value }))} style={inputStyle} /></Field></div><button type="submit" style={styles.primary} disabled={salvando}>Adicionar à fila</button></form></Card>
        <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Bloqueios da agenda</h2><p style={styles.sub}>Indisponibilidade global ou por profissional para {fmtDateOnly(dataSelecionada)}.</p></div><strong style={{ color: '#f59e0b' }}>{bloqueios.length} ativos</strong></div><form onSubmit={salvarBloqueio} style={{ display: 'grid', gap: 14 }}><div style={styles.formGrid}><Field label="Título"><input required value={formBloqueio.titulo} onChange={(event) => setFormBloqueio((atual) => ({ ...atual, titulo: event.target.value }))} style={inputStyle} placeholder="Almoço, manutenção…" /></Field><Field label="Profissional"><select value={formBloqueio.profissionalId} onChange={(event) => setFormBloqueio((atual) => ({ ...atual, profissionalId: event.target.value }))} style={inputStyle}><option value="">Toda a unidade</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Início"><input type="time" required value={formBloqueio.inicioHora} onChange={(event) => setFormBloqueio((atual) => ({ ...atual, inicioHora: event.target.value }))} style={inputStyle} /></Field><Field label="Fim"><input type="time" required value={formBloqueio.fimHora} onChange={(event) => setFormBloqueio((atual) => ({ ...atual, fimHora: event.target.value }))} style={inputStyle} /></Field><Field label="Motivo" full><input value={formBloqueio.motivo} onChange={(event) => setFormBloqueio((atual) => ({ ...atual, motivo: event.target.value }))} style={inputStyle} /></Field></div><button type="submit" style={styles.primary} disabled={salvando}>Criar bloqueio</button></form></Card>
      </div>
      <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Fila ativa de {fmtDateOnly(dataSelecionada)}</h2><p style={styles.sub}>Chamar, marcar como atendido, ausente ou cancelar são ações manuais.</p></div></div>{fila.length === 0 ? <div style={styles.empty}>Nenhuma senha registrada para esta data.</div> : <div style={{ display: 'grid', gap: 8 }}>{fila.map((item) => <div key={item.id} style={styles.listRow}><div><strong>{item.senha} · {item.clienteNome || 'Cliente eventual'}</strong><div style={styles.sub}>{item.servicoId ? servicos.find((servico) => servico.id === item.servicoId)?.nome || 'Serviço' : 'Qualquer serviço'} · previsão {item.previsaoMinutos} min{item.mesaOuPosicao ? ` · ${item.mesaOuPosicao}` : ''}</div></div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><Badge status={item.status === 'aguardando' ? 'agendado' : item.status === 'chamado' ? 'em_atendimento' : item.status} /><>{item.status === 'aguardando' && <button type="button" style={styles.small} onClick={() => alterarFila(item, 'chamado')}>Chamar</button>}{item.status === 'chamado' && <button type="button" style={styles.small} onClick={() => alterarFila(item, 'atendido')}>Atendido</button>}{['aguardando', 'chamado'].includes(item.status) && <button type="button" style={styles.small} onClick={() => alterarFila(item, 'cancelado')}>Cancelar</button>}</></div></div>)}</div>}</Card>
      <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Bloqueios ativos</h2><p style={styles.sub}>A agenda recusa novos horários que sobreponham estes intervalos.</p></div></div>{bloqueios.length === 0 ? <div style={styles.empty}>Nenhum bloqueio para esta data.</div> : <div style={{ display: 'grid', gap: 8 }}>{bloqueios.map((item) => <div key={item.id} style={styles.listRow}><div><strong>{item.titulo}</strong><div style={styles.sub}>{horario(item.inicio)}–{horario(item.fim)} · {item.profissionalId ? profissionais.find((profissional) => profissional.id === item.profissionalId)?.nome || 'Profissional' : 'Toda a unidade'}{item.motivo ? ` · ${item.motivo}` : ''}</div></div><button type="button" style={styles.small} onClick={() => desativarBloqueio(item)}>Desativar</button></div>)}</div>}</Card>
    </div>
  }

  function renderPlanosAssinaturas() {
    return <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.twoColumns}>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}>
            <div><h2 style={styles.h2}>Planos de recorrência</h2><p style={styles.sub}>Definições comerciais sem cobrança automática.</p></div>
            <button type="button" style={styles.primary} onClick={() => { setFormPlano({ nome: '', descricao: '', ciclo: 'mensal', preco: '', sessoesIncluidas: 4, validadeDias: 30, servicosIds: [] }); setModal('plano') }}>+ Novo plano</button>
          </div>
          {planos.length === 0 ? <div style={styles.empty}>Nenhum plano cadastrado.</div> : <div style={{ display: 'grid', gap: 8 }}>{planos.map((plano) => <div key={plano.id} style={styles.listRow}><div><strong>{plano.nome}</strong><div style={styles.sub}>{plano.sessoesIncluidas} sessões · ciclo {plano.ciclo} · validade {plano.validadeDias} dias</div></div><strong>{moeda(plano.preco)}</strong></div>)}</div>}
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={styles.sectionTitle}><div><h2 style={styles.h2}>Nova assinatura</h2><p style={styles.sub}>Fica pendente de ativação até uma confirmação operacional externa.</p></div></div>
          <form onSubmit={salvarAssinatura} style={{ display: 'grid', gap: 14 }}>
            <Field label="Cliente cadastrado"><select required value={formAssinatura.clienteId} onChange={(event) => setFormAssinatura((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Selecionar cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></Field>
            <Field label="Plano"><select required value={formAssinatura.planoId} onChange={(event) => setFormAssinatura((atual) => ({ ...atual, planoId: event.target.value }))} style={inputStyle}><option value="">Selecionar plano</option>{planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome} · {moeda(plano.preco)}</option>)}</select></Field>
            <Field label="Observações" full><textarea rows={3} value={formAssinatura.observacoes} onChange={(event) => setFormAssinatura((atual) => ({ ...atual, observacoes: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
            <button type="submit" style={styles.primary} disabled={salvando || planos.length === 0}>Criar assinatura pendente</button>
          </form>
        </Card>
      </div>
      <Card style={{ padding: 18 }}>
        <div style={styles.sectionTitle}><div><h2 style={styles.h2}>Assinaturas da empresa</h2><p style={styles.sub}>Status operacional; não representa pagamento aprovado.</p></div></div>
        {assinaturas.length === 0 ? <div style={styles.empty}>Nenhuma assinatura cadastrada.</div> : <div style={{ display: 'grid', gap: 8 }}>{assinaturas.map((assinatura) => <div key={assinatura.id} style={styles.listRow}><div><strong>{assinatura.clienteNome || 'Cliente'}</strong><div style={styles.sub}>{planos.find((plano) => plano.id === assinatura.planoId)?.nome || 'Plano'} · {assinatura.sessoesUsadas}/{assinatura.sessoesContratadas} sessões usadas</div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge status={assinatura.status === 'ativa' ? 'concluido' : assinatura.status} />{assinatura.status === 'pendente_ativacao' && <button type="button" style={styles.small} onClick={() => ativarAssinatura(assinatura)}>Ativar sem cobrança</button>}</div></div>)}</div>}
      </Card>
    </div>
  }

  function renderFidelidade() {
    const membrosIds = new Set((fidelidade.membros || []).map((membro) => membro.clienteId))
    const disponiveis = clientes.filter((cliente) => !membrosIds.has(cliente.id))
    const pontosTotais = (fidelidade.membros || []).reduce((total, membro) => total + Number(membro.pontos || 0), 0)
    const movimentosRecentes = (fidelidade.movimentos || []).slice(0, 8)
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={styles.sectionTitle}><div><div style={styles.kicker}>Retenção</div><h2 style={styles.h2}>Programa de fidelidade</h2><p style={styles.sub}>Pontos vinculados ao CRM da empresa ativa. O crédito automático ocorre somente após uma comanda integralmente paga; ajustes manuais exigem confirmação.</p></div><Badge status={fidelidade.regra?.ativa === false ? 'cancelado' : 'concluido'} /></div>
        <div style={styles.kpiGrid}><Kpi label="Membros" value={fidelidade.membros?.length || 0} note="Clientes aderidos" color="#8b5cf6" /><Kpi label="Pontos em carteira" value={pontosTotais} note="Saldo disponível" color="#f59e0b" /><Kpi label="Créditos registrados" value={fidelidade.movimentos?.length || 0} note="Ledger da empresa" color="#14b87a" /><Kpi label="Ponto estimado" value={moeda(fidelidade.regra?.valorPonto || 0)} note="Não é dinheiro disponível" /></div>
        <form onSubmit={(event) => { event.preventDefault(); const cliente = clientes.find((item) => item.id === clienteFidelidadeId); if (cliente) aderirFidelidade(cliente) }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginTop: 16 }}><Field label="Adicionar cliente"><select value={clienteFidelidadeId} onChange={(event) => setClienteFidelidadeId(event.target.value)} style={{ ...inputStyle, minWidth: 260 }}><option value="">Selecionar cliente do CRM</option>{disponiveis.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></Field><button type="submit" style={styles.primary} disabled={!clienteFidelidadeId || salvando}>Aderir ao programa</button></form>
      </Card>
      <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Regra de pontos</h2><p style={styles.sub}>A configuração não altera caixa nem financeiro e vale para novos créditos.</p></div></div><form onSubmit={salvarRegraFidelidade} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'end' }}><Field label="Pontos por R$ 1,00"><input type="number" min="0" value={formFidelidade.pontosPorReal ?? 0} onChange={(event) => setFormFidelidade((atual) => ({ ...atual, pontosPorReal: event.target.value }))} style={{ ...inputStyle, width: 160 }} /></Field><Field label="Valor estimado do ponto"><input type="number" min="0" step="0.01" value={formFidelidade.valorPonto ?? 0} onChange={(event) => setFormFidelidade((atual) => ({ ...atual, valorPonto: event.target.value }))} style={{ ...inputStyle, width: 160 }} /></Field><label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}><input type="checkbox" checked={formFidelidade.ativa !== false} onChange={(event) => setFormFidelidade((atual) => ({ ...atual, ativa: event.target.checked }))} /> Programa ativo</label><button type="submit" style={styles.primary} disabled={salvando}>Salvar regra</button></form></Card>
      <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Membros</h2><p style={styles.sub}>{fidelidade.membros?.length || 0} clientes aderidos.</p></div></div>{!fidelidade.membros?.length ? <div style={styles.empty}>Nenhum cliente aderiu ao programa.</div> : <div style={{ display: 'grid', gap: 8 }}>{fidelidade.membros.map((membro) => <div key={membro.id} style={styles.listRow}><div><strong>{membro.nome}</strong><div style={styles.sub}>{membro.pontos || 0} pontos · nível {membro.nivel || 'bronze'} · {membro.pontosAcumulados || membro.pontos || 0} acumulados</div></div><button type="button" style={styles.small} onClick={() => abrirCreditoFidelidade(membro)}>Ajuste manual</button></div>)}</div>}</Card>
      <Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Últimos créditos</h2><p style={styles.sub}>Trilha operacional; repetições com a mesma chave não duplicam pontos.</p></div></div>{!movimentosRecentes.length ? <div style={styles.empty}>Nenhum crédito registrado. Pagamentos elegíveis aparecerão aqui quando houver membro aderido.</div> : <div style={{ display: 'grid', gap: 8 }}>{movimentosRecentes.map((movimento) => <div key={movimento.id} style={styles.listRow}><div><strong>{clientes.find((cliente) => cliente.id === movimento.clienteId)?.nome || 'Cliente'}</strong><div style={styles.sub}>{movimento.origem || 'venda'} · {movimento.criadoEm ? fmtDate(movimento.criadoEm) : '—'}</div></div><strong style={{ color: '#14b87a' }}>+{movimento.pontos} pts</strong></div>)}</div>}</Card>
    </div>
  }

  function renderEstoqueRevenda() {
    const baixos = produtosRevenda.filter((produto) => produto.statusEstoque !== 'ok')
    const termo = busca.trim().toLowerCase()
    const produtosVisiveis = produtosRevenda.filter((produto) => !termo || [produto.nome, produto.sku, produto.categoria].some((item) => String(item || '').toLowerCase().includes(termo)))
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Revenda independente</div><h2 style={styles.h2}>Estoque de revenda</h2><p style={styles.sub}>Catálogo exclusivo da empresa ativa. Não é o estoque de cardápio e não se conecta automaticamente ao Commerce.</p></div><button type="button" style={styles.primary} onClick={() => { setFormProdutoRevenda({ nome: '', sku: '', categoria: 'Revenda', unidade: 'un', precoVenda: '', custoUnitario: '', estoqueAtual: 0, estoqueMinimo: 0 }); setModal('produtoRevenda') }}>+ Novo produto</button></div><div style={styles.kpiGrid}><Kpi label="Produtos ativos" value={produtosRevenda.filter((produto) => produto.ativo !== false).length} /><Kpi label="Abaixo do mínimo" value={baixos.length} color={baixos.length ? '#f59e0b' : '#14b87a'} /><Kpi label="Sem estoque" value={produtosRevenda.filter((produto) => produto.statusEstoque === 'sem_estoque').length} color="#e05c5c" /></div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar produto por nome, SKU ou categoria" style={{ ...inputStyle, marginTop: 16, maxWidth: 520 }} /></Card>{baixos.length > 0 && <Card style={styles.attentionPanel}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Atenção de estoque</h2><p style={styles.sub}>Estes produtos estão abaixo do mínimo ou sem saldo. A tela não cria compras automaticamente.</p></div><button type="button" style={styles.secondary} onClick={() => setBusca('')}>Mostrar todos</button></div><div style={styles.alertList}>{baixos.slice(0, 6).map((produto) => <div key={produto.id} style={styles.alertRow}><span><strong>{produto.nome}</strong><small>{produto.estoqueAtual} disponíveis · mínimo {produto.estoqueMinimo}</small></span><Badge status={produto.statusEstoque === 'baixo' ? 'chamado' : 'cancelado'} /></div>)}</div></Card>}<Card style={{ padding: 18, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={styles.tableHead}>{['Produto', 'Categoria', 'Preço', 'Saldo', 'Mínimo', 'Situação', 'Movimento'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{produtosVisiveis.length === 0 ? <tr><td colSpan={7} style={styles.empty}>{produtosRevenda.length === 0 ? 'Nenhum produto de revenda cadastrado.' : 'Nenhum produto corresponde à busca.'}</td></tr> : produtosVisiveis.map((produto) => <tr key={produto.id} style={{ borderTop: '1px solid var(--line)', opacity: produto.ativo === false ? .58 : 1 }}><td style={styles.td}><strong>{produto.nome}</strong><div style={styles.sub}>{produto.sku || 'Sem SKU'} · {produto.unidade || 'un'}</div></td><td style={styles.td}>{produto.categoria}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(produto.precoVenda)}</td><td style={{ ...styles.td, fontWeight: 800 }}>{produto.estoqueAtual}</td><td style={styles.td}>{produto.estoqueMinimo}</td><td style={styles.td}><Badge status={produto.statusEstoque === 'ok' ? 'concluido' : produto.statusEstoque === 'baixo' ? 'chamado' : 'cancelado'} /></td><td style={styles.td}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" style={styles.small} onClick={() => movimentarProdutoRevenda(produto, 'entrada')}>Entrada</button><button type="button" style={styles.small} onClick={() => movimentarProdutoRevenda(produto, 'saida_manual')}>Saída manual</button></div></td></tr>)}</tbody></table><p style={{ ...styles.sub, marginBottom: 0 }}>A saída manual não registra venda, pagamento ou receita. Para vender, use a aba <strong>Vendas de revenda</strong>, que separa pedido pendente de confirmação financeira.</p></Card></div>
  }

  function renderVendasRevenda() {
    const total = itensVendaRevenda.reduce((soma, item) => soma + Number(item.precoUnitario || 0) * Number(item.quantidade || 0), 0)
    const vendasOrdenadas = [...vendasRevenda].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    return <div style={{ display: 'grid', gap: 16 }}><div style={styles.twoColumns}><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Nova venda de revenda</h2><p style={styles.sub}>Crie o pedido pendente e confirme o recebimento somente depois de o pagamento ser verificado.</p></div></div><form onSubmit={adicionarItemVendaRevenda} style={{ display: 'grid', gap: 14 }}><Field label="Produto disponível"><select required value={formVendaRevenda.produtoId} onChange={(event) => setFormVendaRevenda((atual) => ({ ...atual, produtoId: event.target.value }))} style={inputStyle}><option value="">Selecionar produto</option>{produtosRevenda.filter((produto) => produto.ativo !== false && Number(produto.estoqueAtual || 0) > 0).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {produto.estoqueAtual} disponíveis · {moeda(produto.precoVenda)}</option>)}</select></Field><Field label="Quantidade"><input required type="number" min="1" step="1" value={formVendaRevenda.quantidade} onChange={(event) => setFormVendaRevenda((atual) => ({ ...atual, quantidade: event.target.value }))} style={inputStyle} /></Field><button type="submit" style={styles.secondary} disabled={produtosRevenda.filter((produto) => produto.ativo !== false && Number(produto.estoqueAtual || 0) > 0).length === 0}>Adicionar item</button></form>{itensVendaRevenda.length === 0 ? <div style={styles.empty}>Nenhum item adicionado à venda.</div> : <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>{itensVendaRevenda.map((item) => <div key={item.produtoId} style={styles.listRow}><div><strong>{item.nome}</strong><div style={styles.sub}>{item.quantidade} {item.unidade || 'un'} · {moeda(item.precoUnitario)} cada</div></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><strong>{moeda(Number(item.precoUnitario || 0) * Number(item.quantidade || 0))}</strong><button type="button" style={styles.small} onClick={() => setItensVendaRevenda((itens) => itens.filter((linha) => linha.produtoId !== item.produtoId))}>Remover</button></div></div>)}</div>}<form onSubmit={salvarVendaRevenda} style={{ display: 'grid', gap: 14, marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}><div style={styles.formGrid}><Field label="Cliente cadastrado"><select value={formVendaRevenda.clienteId} onChange={(event) => setFormVendaRevenda((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Venda balcão</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></Field><Field label="Nome eventual"><input value={formVendaRevenda.clienteNome} onChange={(event) => setFormVendaRevenda((atual) => ({ ...atual, clienteNome: event.target.value, clienteId: '' }))} style={inputStyle} /></Field><Field label="Profissional responsável"><select value={formVendaRevenda.profissionalId} onChange={(event) => setFormVendaRevenda((atual) => ({ ...atual, profissionalId: event.target.value }))} style={inputStyle}><option value="">Sem repasse atribuído</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Observação" full><textarea rows={2} value={formVendaRevenda.observacao} onChange={(event) => setFormVendaRevenda((atual) => ({ ...atual, observacao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><strong>Total: {moeda(total)}</strong><button type="submit" style={styles.primary} disabled={salvando || itensVendaRevenda.length === 0}>Salvar venda pendente</button></div></form></Card><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Controles da operação</h2><p style={styles.sub}>A venda é separada do PDV global porque o estoque legado do Bar ainda não é tenant-aware.</p></div></div><div style={{ display: 'grid', gap: 12 }}><div style={styles.notice}><strong>Pedido pendente</strong><div style={styles.sub}>Não baixa estoque e não cria receita.</div></div><div style={styles.notice}><strong>Pagamento confirmado</strong><div style={styles.sub}>Baixa estoque da revenda, gera histórico e registra uma receita idempotente em <code>barbearia_revenda</code>.</div></div><div style={styles.notice}><strong>Sem cobrança simulada</strong><div style={styles.sub}>A tela pede confirmação manual e o meio de pagamento; não chama gateway externo nesta etapa.</div></div></div></Card></div><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Vendas registradas</h2><p style={styles.sub}>Pedidos desta empresa; a confirmação de pendentes é uma mutação operacional explícita.</p></div></div>{vendasOrdenadas.length === 0 ? <div style={styles.empty}>Nenhuma venda de revenda registrada.</div> : <div style={{ display: 'grid', gap: 8 }}>{vendasOrdenadas.map((venda) => <div key={venda.id} style={styles.listRow}><div><strong>{venda.id} · {venda.clienteNome || 'Venda balcão'}</strong><div style={styles.sub}>{venda.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(' · ')} · {moeda(venda.total)}</div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}><Badge status={venda.status === 'pago' ? 'concluido' : venda.status} />{venda.status === 'aguardando_pagamento' && <button type="button" style={styles.small} onClick={() => confirmarVendaRevenda(venda)}>Confirmar recebimento</button>}{venda.status === 'pago' && <span style={styles.sub}>Estoque e financeiro registrados</span>}</div></div>)}</div>}</Card></div>
  }

  function renderRelatorios() {
    const porStatus = Object.entries(relatorio?.porStatus || {})
    return <div style={{ display: 'grid', gap: 16 }}><div style={styles.kpiGrid}><Kpi label="Atendimentos no dia" value={relatorio?.totalAgendamentos || 0} note={fmtDateOnly(dataSelecionada)} /><Kpi label="Concluídos" value={relatorio?.porStatus?.concluido || 0} color="#14b87a" /><Kpi label="Cancelados" value={relatorio?.porStatus?.cancelado || 0} color="#e05c5c" /><Kpi label="Não compareceu" value={relatorio?.porStatus?.nao_compareceu || 0} color="#888" /></div><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Distribuição por status</h2><p style={styles.sub}>Dados derivados da agenda da empresa ativa; selecione outra data acima para atualizar.</p></div></div>{porStatus.length === 0 ? <div style={styles.empty}>Sem atendimentos para a data selecionada.</div> : <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{porStatus.map(([status, quantidade]) => <div key={status} style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}><Badge status={status} /><strong style={{ marginLeft: 10 }}>{quantidade}</strong></div>)}</div>}</Card><Card style={{ padding: 18, overflowX: 'auto' }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Desempenho por profissional</h2><p style={styles.sub}>Faturamento é apuração operacional e não cria repasse.</p></div></div><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}><thead><tr style={styles.tableHead}>{['Profissional', 'Atendimentos', 'Concluídos', 'Faturamento'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{(relatorio?.porProfissional || []).length === 0 ? <tr><td colSpan={4} style={styles.empty}>Nenhum profissional cadastrado.</td></tr> : relatorio.porProfissional.map((item) => <tr key={item.profissionalId} style={{ borderTop: '1px solid var(--line)' }}><td style={styles.td}><strong>{item.profissionalNome}</strong></td><td style={styles.td}>{item.atendimentos}</td><td style={styles.td}>{item.concluidos}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(item.faturamento)}</td></tr>)}</tbody></table></Card></div>
  }

  function renderConfiguracao() {
    const diasSelecionados = formConfig.diasFuncionamento || []
    const unidade = configuracaoUnidade?.calendario
    const diasUnidade = unidade?.diasFuncionamento || []
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 20, maxWidth: 760 }}><form onSubmit={salvarConfiguracao} style={{ display: 'grid', gap: 18 }}><div><h2 style={styles.h2}>Agendamento público Dino</h2><p style={styles.sub}>Defina a identidade exibida no link compartilhável. A publicação pode ser desativada sem apagar agenda, serviços ou profissionais.</p></div><div style={styles.formGrid}><Field label="Slug público"><input value={formConfig.slugPublico || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, slugPublico: event.target.value }))} style={inputStyle} placeholder="dino" pattern="[a-zA-Z0-9-]+" /></Field><Field label="Nome público"><input value={formConfig.nomePublico || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, nomePublico: event.target.value }))} style={inputStyle} placeholder="Dino Barbearia & Perfumaria" maxLength={160} /></Field><Field label="WhatsApp público"><input value={formConfig.whatsappPublico || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, whatsappPublico: event.target.value }))} style={inputStyle} placeholder="(65) 99999-9999" maxLength={30} /></Field><Field label="Endereço público" full><input value={formConfig.enderecoPublico || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, enderecoPublico: event.target.value }))} style={inputStyle} maxLength={240} /></Field><Field label="Publicação" full><label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg)' }}><input type="checkbox" checked={formConfig.agendamentoPublicoAtivo !== false} onChange={(event) => setFormConfig((atual) => ({ ...atual, agendamentoPublicoAtivo: event.target.checked }))} style={{ width: 18, height: 18 }} /><span>Agendamento público ativo</span></label></Field></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><a href={`/agendar/${formConfig.slugPublico || 'dino'}`} target="_blank" rel="noopener noreferrer" style={{ ...styles.secondary, textDecoration: 'none' }}>Abrir link público</a><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar identidade pública'}</button></div></form></Card><Card style={{ padding: 20, maxWidth: 760 }}><form onSubmit={salvarConfiguracao} style={{ display: 'grid', gap: 18 }}><div><h2 style={styles.h2}>Horários corporativos</h2><p style={styles.sub}>A configuração da empresa serve como padrão para unidades que não possuem uma regra própria.</p></div><div style={styles.formGrid}><Field label="Abertura"><input type="time" value={formConfig.horarioAbertura || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, horarioAbertura: event.target.value }))} style={inputStyle} /></Field><Field label="Fechamento"><input type="time" value={formConfig.horarioFechamento || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, horarioFechamento: event.target.value }))} style={inputStyle} /></Field><Field label="Intervalo entre horários (min)"><input type="number" min="5" value={formConfig.intervaloMinutos ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, intervaloMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Antecedência mínima (min)"><input type="number" min="0" value={formConfig.antecedenciaMinutos ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, antecedenciaMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Janela de reservas (dias)"><input type="number" min="1" value={formConfig.janelaReservaDias ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, janelaReservaDias: event.target.value }))} style={inputStyle} /></Field><Field label="Cancelamento sem penalidade (horas)"><input type="number" min="0" value={formConfig.politicaCancelamentoHoras ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, politicaCancelamentoHoras: event.target.value }))} style={inputStyle} /></Field><Field label="Dias de funcionamento" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setFormConfig((atual) => ({ ...atual, diasFuncionamento: diasSelecionados.includes(indice) ? diasSelecionados.filter((item) => item !== indice) : [...diasSelecionados, indice].sort() }))} style={{ ...styles.small, background: diasSelecionados.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: diasSelecionados.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configuração corporativa'}</button></div></form></Card><Card style={{ padding: 20, maxWidth: 760 }}><form onSubmit={salvarConfiguracaoUnidade} style={{ display: 'grid', gap: 18 }}><div><h2 style={styles.h2}>Calendário da unidade ativa</h2><p style={styles.sub}>{unidade ? `${unidadeLabel}. ${configuracaoUnidade.herdadaDaEmpresa ? 'No momento, ela herda o padrão corporativo.' : 'Esta unidade possui regras próprias.'}` : 'A sessão atual não informou uma unidade no JWT; a configuração específica não está disponível.'}</p></div>{!unidade ? <div style={styles.empty}>Selecione uma unidade na sessão do SetPoint para editar este calendário.</div> : <><div style={styles.formGrid}><Field label="Abertura"><input type="time" value={unidade.horarioAbertura || ''} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, horarioAbertura: event.target.value } }))} style={inputStyle} /></Field><Field label="Fechamento"><input type="time" value={unidade.horarioFechamento || ''} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, horarioFechamento: event.target.value } }))} style={inputStyle} /></Field><Field label="Intervalo entre horários (min)"><input type="number" min="5" value={unidade.intervaloMinutos ?? ''} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, intervaloMinutos: event.target.value } }))} style={inputStyle} /></Field><Field label="Feriados (AAAA-MM-DD, separados por vírgula)" full><input value={(unidade.feriados || []).join(', ')} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, feriados: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } }))} style={inputStyle} /></Field><Field label="Dias de funcionamento" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, diasFuncionamento: diasUnidade.includes(indice) ? diasUnidade.filter((item) => item !== indice) : [...diasUnidade, indice].sort() } }))} style={{ ...styles.small, background: diasUnidade.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: diasUnidade.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar calendário da unidade'}</button></div></>}</form></Card></div>
  }

  function renderModal() {
    if (modal?.tipo === 'filaChamada') {
      const item = modal.item
      return <Modal title={`Chamar ${item.senha}`} onClose={() => setModal(null)}><form onSubmit={concluirChamadaFila} style={{ display: 'grid', gap: 16 }}><div style={styles.notice}><strong>{item.clienteNome || 'Cliente eventual'}</strong><div style={styles.sub}>Registre a cadeira, posição ou estação antes de atualizar o status da fila.</div></div><Field label="Cadeira ou posição *" full hint="Exemplos: Cadeira 2, Estação A, Sala 1"><input required autoFocus value={formFilaChamada.mesaOuPosicao} onChange={(event) => setFormFilaChamada({ mesaOuPosicao: event.target.value })} style={inputStyle} placeholder="Cadeira 2" /></Field><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando || !formFilaChamada.mesaOuPosicao.trim()}>{salvando ? 'Atualizando…' : 'Confirmar chamada'}</button></div></form></Modal>
    }
    if (modal?.tipo === 'movimentoRevenda') {
      const produto = modal.produto
      const movimentoLabel = modal.movimentoTipo === 'entrada' ? 'Entrada' : modal.movimentoTipo === 'saida_manual' ? 'Saída manual' : 'Ajuste'
      return <Modal title={`${movimentoLabel} de estoque`} onClose={() => setModal(null)}><form onSubmit={concluirMovimentoRevenda} style={{ display: 'grid', gap: 16 }}><div style={styles.notice}><strong>{produto.nome}</strong><div style={styles.sub}>Saldo atual: {produto.estoqueAtual} {produto.unidade || 'un'}. A saída manual não registra venda, pagamento ou receita.</div></div><Field label="Quantidade *"><input required autoFocus type="number" min="1" step="1" value={formMovimentoRevenda.quantidade} onChange={(event) => setFormMovimentoRevenda((atual) => ({ ...atual, quantidade: event.target.value }))} style={inputStyle} /></Field><Field label="Observação" full><textarea rows={3} value={formMovimentoRevenda.observacao} onChange={(event) => setFormMovimentoRevenda((atual) => ({ ...atual, observacao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando || !Number.isInteger(Number(formMovimentoRevenda.quantidade)) || Number(formMovimentoRevenda.quantidade) <= 0}>{salvando ? 'Registrando…' : `Confirmar ${movimentoLabel.toLowerCase()}`}</button></div></form></Modal>
    }
    if (modal?.tipo === 'profissional') return <Modal title={modal.profissionalId ? 'Editar profissional' : 'Novo profissional'} onClose={() => setModal(null)} wide><form onSubmit={salvarProfissional} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formProf.nome} onChange={(event) => setFormProf((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone"><input value={formProf.telefone} onChange={(event) => setFormProf((atual) => ({ ...atual, telefone: event.target.value }))} style={inputStyle} /></Field><Field label="E-mail do login (Modo barbeiro)"><input type="email" value={formProf.email} onChange={(event) => setFormProf((atual) => ({ ...atual, email: event.target.value }))} style={inputStyle} placeholder="o mesmo e-mail que o profissional usa para entrar" /></Field><Field label="Especialidade"><input value={formProf.especialidade} onChange={(event) => setFormProf((atual) => ({ ...atual, especialidade: event.target.value }))} style={inputStyle} /></Field><Field label="Tipo"><select value={formProf.tipo} onChange={(event) => setFormProf((atual) => ({ ...atual, tipo: event.target.value }))} style={inputStyle}><option value="parceiro">Parceiro</option><option value="funcionario">Funcionário</option><option value="autonomo">Autônomo</option></select></Field><Field label="Comissão de serviços (%)"><input type="number" min="0" max="100" value={formProf.percentualComissao} onChange={(event) => setFormProf((atual) => ({ ...atual, percentualComissao: event.target.value }))} style={inputStyle} /></Field><Field label="Comissão de produtos (%)"><input type="number" min="0" max="100" value={formProf.percentualComissaoProduto} onChange={(event) => setFormProf((atual) => ({ ...atual, percentualComissaoProduto: event.target.value }))} style={inputStyle} /></Field><Field label="Taxa da maquininha"><label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42, color: 'var(--fg)' }}><input type="checkbox" checked={formProf.descontaTaxaMaquininha !== false} onChange={(event) => setFormProf((atual) => ({ ...atual, descontaTaxaMaquininha: event.target.checked }))} style={{ width: 18, height: 18 }} /> Descontar no cálculo</label></Field><Field label="Início"><input type="time" value={formProf.horarioInicio} onChange={(event) => setFormProf((atual) => ({ ...atual, horarioInicio: event.target.value }))} style={inputStyle} /></Field><Field label="Fim"><input type="time" value={formProf.horarioFim} onChange={(event) => setFormProf((atual) => ({ ...atual, horarioFim: event.target.value }))} style={inputStyle} /></Field><Field label="Foto ou avatar (URL)" full><input type="url" value={formProf.fotoUrl} onChange={(event) => setFormProf((atual) => ({ ...atual, fotoUrl: event.target.value }))} style={inputStyle} placeholder="https://…" /></Field><Field label="Dias de trabalho" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setFormProf((atual) => ({ ...atual, diasTrabalho: atual.diasTrabalho.includes(indice) ? atual.diasTrabalho.filter((item) => item !== indice) : [...atual.diasTrabalho, indice].sort() }))} style={{ ...styles.small, background: formProf.diasTrabalho.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: formProf.diasTrabalho.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar profissional'}</button></div></form></Modal>
    if (modal === 'servico') return <Modal title="Novo serviço" onClose={() => setModal(null)}><form onSubmit={salvarServico} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formServico.nome} onChange={(event) => setFormServico((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Categoria"><input value={formServico.categoria} onChange={(event) => setFormServico((atual) => ({ ...atual, categoria: event.target.value }))} style={inputStyle} /></Field><Field label="Preço (R$) *"><input required type="number" min="0.01" step="0.01" value={formServico.preco} onChange={(event) => setFormServico((atual) => ({ ...atual, preco: event.target.value }))} style={inputStyle} /></Field><Field label="Duração (minutos)"><input required type="number" min="5" value={formServico.duracaoMinutos} onChange={(event) => setFormServico((atual) => ({ ...atual, duracaoMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Descrição" full><textarea rows={4} value={formServico.descricao} onChange={(event) => setFormServico((atual) => ({ ...atual, descricao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formServico.permiteAgendamentoOnline !== false} onChange={(event) => setFormServico((atual) => ({ ...atual, permiteAgendamentoOnline: event.target.checked }))} /> Permitir este serviço nos canais de agendamento online</label><div style={styles.notice}><strong>Ficha técnica e consumo interno</strong><div style={styles.sub}>Ao faturar integralmente uma comanda, o estoque de revenda baixa os insumos configurados. Essa baixa não cria venda, pagamento ou vínculo com o Commerce.</div>{(formServico.consumoInterno || []).map((insumo, indice) => <div key={`${insumo.produtoId || 'novo'}-${indice}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px auto', gap: 8, alignItems: 'end', marginTop: 10 }}><select aria-label={`Produto de consumo ${indice + 1}`} value={insumo.produtoId} onChange={(event) => setFormServico((atual) => ({ ...atual, consumoInterno: atual.consumoInterno.map((item, index) => index === indice ? { ...item, produtoId: event.target.value } : item) }))} style={inputStyle}><option value="">Selecionar produto</option>{produtosRevenda.filter((produto) => produto.ativo !== false).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {produto.unidade || 'un'}</option>)}</select><input aria-label={`Quantidade de consumo ${indice + 1}`} type="number" min="1" step="1" value={insumo.quantidade} onChange={(event) => setFormServico((atual) => ({ ...atual, consumoInterno: atual.consumoInterno.map((item, index) => index === indice ? { ...item, quantidade: event.target.value } : item) }))} style={inputStyle} /><button type="button" style={styles.small} onClick={() => setFormServico((atual) => ({ ...atual, consumoInterno: atual.consumoInterno.filter((_, index) => index !== indice) }))}>Remover</button></div>)}<button type="button" style={{ ...styles.secondary, marginTop: 10 }} onClick={() => setFormServico((atual) => ({ ...atual, consumoInterno: [...(atual.consumoInterno || []), { produtoId: '', quantidade: 1 }] }))} disabled={produtosRevenda.filter((produto) => produto.ativo !== false).length === 0}>+ Adicionar insumo</button></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar serviço'}</button></div></form></Modal>
    if (modal === 'cliente' || modal?.tipo === 'editarCliente') return <Modal title={modal?.tipo === 'editarCliente' ? 'Editar cliente e crédito' : 'Novo cliente no CRM'} onClose={() => setModal(null)}><form onSubmit={salvarCliente} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formCliente.nome} onChange={(event) => setFormCliente((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone"><input value={formCliente.telefone} onChange={(event) => setFormCliente((atual) => ({ ...atual, telefone: event.target.value }))} style={inputStyle} /></Field><Field label="E-mail"><input type="email" value={formCliente.email} onChange={(event) => setFormCliente((atual) => ({ ...atual, email: event.target.value }))} style={inputStyle} /></Field><Field label="Limite para pagar na conta (R$)" hint="Zero mantém o crediário bloqueado."><input type="number" min="0" step="0.01" value={formCliente.limiteCreditoMensal} onChange={(event) => setFormCliente((atual) => ({ ...atual, limiteCreditoMensal: event.target.value }))} style={inputStyle} /></Field><Field label="Vencimento após a compra (dias)"><input type="number" min="1" max="90" step="1" value={formCliente.diasVencimento} onChange={(event) => setFormCliente((atual) => ({ ...atual, diasVencimento: event.target.value }))} style={inputStyle} /></Field><Field label="Observação" full><textarea rows={4} value={formCliente.observacao} onChange={(event) => setFormCliente((atual) => ({ ...atual, observacao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : (modal?.tipo === 'editarCliente' ? 'Salvar cliente e crédito' : 'Salvar cliente')}</button></div></form></Modal>
    if (modal === 'agenda' || modal?.tipo === 'editarAgenda') return <Modal title={modal?.tipo === 'editarAgenda' ? 'Remarcar atendimento' : `Novo agendamento · ${fmtDateOnly(dataSelecionada)}`} onClose={() => setModal(null)}><form onSubmit={salvarAgenda} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Cliente cadastrado"><select value={formAgenda.clienteId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Selecionar ou informar abaixo</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.telefone ? ` · ${cliente.telefone}` : ''}</option>)}</select></Field><Field label="Nome do cliente"><input value={formAgenda.clienteNome} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteNome: event.target.value, clienteId: '' }))} placeholder="Para atendimento eventual" style={inputStyle} /></Field><Field label="Profissional"><select value={formAgenda.profissionalId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, profissionalId: event.target.value }))} style={inputStyle}><option value="">Sem profissional definido</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Serviço *"><select required value={formAgenda.servicoId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, servicoId: event.target.value }))} style={inputStyle}><option value="">Selecionar serviço</option>{servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome} · {moeda(servico.preco)} · {servico.duracaoMinutos} min</option>)}</select></Field><Field label="Data *"><input required type="date" value={formAgenda.data || dataSelecionada} onChange={(event) => setFormAgenda((atual) => ({ ...atual, data: event.target.value }))} style={inputStyle} /></Field><Field label="Horário *"><input required type="time" value={formAgenda.hora} onChange={(event) => setFormAgenda((atual) => ({ ...atual, hora: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone eventual"><input value={formAgenda.clienteTelefone} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteTelefone: event.target.value }))} style={inputStyle} /></Field><Field label="Observações" full><textarea rows={4} value={formAgenda.observacoes} onChange={(event) => setFormAgenda((atual) => ({ ...atual, observacoes: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : (modal?.tipo === 'editarAgenda' ? 'Confirmar remarcação' : 'Confirmar agendamento')}</button></div></form></Modal>
    if (modal === 'novaComanda') return <Modal title="Abrir comanda de atendimento" onClose={() => setModal(null)} wide><form onSubmit={criarComanda} style={{ display: 'grid', gap: 16 }}><div style={styles.notice}><strong>Fluxo seguro</strong><div style={styles.sub}>A abertura não recebe pagamento nem baixa estoque. O recebimento será uma ação separada após conferir a comanda.</div></div><div style={styles.formGrid}><Field label="Cliente cadastrado"><select value={formComanda.clienteId} onChange={(event) => setFormComanda((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Venda balcão / eventual</option>{clientes.filter((cliente) => cliente.padrao !== true).map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.telefone ? ` · ${cliente.telefone}` : ''}</option>)}</select></Field><Field label="Nome eventual"><input value={formComanda.clienteNome} onChange={(event) => setFormComanda((atual) => ({ ...atual, clienteNome: event.target.value, clienteId: '' }))} placeholder="Cliente sem cadastro" style={inputStyle} /></Field><Field label="Profissional responsável"><select value={formComanda.profissionalId} onChange={(event) => setFormComanda((atual) => ({ ...atual, profissionalId: event.target.value }))} style={inputStyle}><option value="">Sem profissional atribuído</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Tipo do primeiro item"><select value={formComanda.itemTipo} onChange={(event) => setFormComanda((atual) => ({ ...atual, itemTipo: event.target.value, itemId: '' }))} style={inputStyle}><option value="servico">Serviço</option><option value="produto">Produto de revenda</option></select></Field><Field label={formComanda.itemTipo === 'servico' ? 'Serviço *' : 'Produto *'}><select required value={formComanda.itemId} onChange={(event) => setFormComanda((atual) => ({ ...atual, itemId: event.target.value }))} style={inputStyle}><option value="">Selecionar</option>{formComanda.itemTipo === 'servico' ? servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome} · {moeda(servico.preco)}</option>) : produtosRevenda.filter((item) => item.ativo !== false && Number(item.estoqueAtual || 0) > 0).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {produto.estoqueAtual} disponíveis · {moeda(produto.precoVenda)}</option>)}</select></Field><Field label="Quantidade"><input type="number" min="1" step="1" value={formComanda.quantidade} onChange={(event) => setFormComanda((atual) => ({ ...atual, quantidade: event.target.value }))} style={inputStyle} /></Field><Field label="Gorjeta (R$)"><input type="number" min="0" step="0.01" value={formComanda.gorjeta} onChange={(event) => setFormComanda((atual) => ({ ...atual, gorjeta: event.target.value }))} style={inputStyle} /></Field><Field label="Desconto (R$)"><input type="number" min="0" step="0.01" value={formComanda.desconto} onChange={(event) => setFormComanda((atual) => ({ ...atual, desconto: event.target.value }))} style={inputStyle} /></Field><Field label="Observações" full><textarea rows={3} value={formComanda.observacoes} onChange={(event) => setFormComanda((atual) => ({ ...atual, observacoes: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Abrindo…' : 'Abrir comanda'}</button></div></form></Modal>
    if (modal?.tipo === 'comanda') {
      const comanda = modal.comanda
      const subtotal = Number(comanda.subtotal ?? (comanda.itens || []).reduce((soma, item) => soma + Number(item.subtotal ?? Number(item.precoUnitario || 0) * Number(item.quantidade || item.qtd || 1)), 0))
      const totalPago = Number(comanda.totalPago || 0)
      const saldoPendente = Number(comanda.saldoPendente ?? Math.max(0, Number(comanda.total || 0) - totalPago))
      const podeEditar = ['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status)
      const clienteCredito = clientes.find((cliente) => cliente.id === (formPagamentoComanda.clienteId || comanda.clienteId))
      const limiteCredito = Number(clienteCredito?.limiteCreditoMensal || 0)
      const saldoDevedor = Number(clienteCredito?.saldoDevedor || 0)
      const creditoDisponivel = Math.max(0, limiteCredito - saldoDevedor)
      const valorConta = Number(formPagamentoComanda.valor || saldoPendente || 0)
      const contaPermitida = formPagamentoComanda.meioPagamento !== 'conta' || Boolean(clienteCredito && !clienteCredito.padrao && limiteCredito > 0 && valorConta <= creditoDisponivel + 0.005)
      const documentoFiscal = documentosFiscais.find((documento) => documento.origemTipo === 'comanda' && documento.origemId === comanda.id)
      return <Modal title={`Comanda ${comanda.id}`} onClose={() => setModal(null)} wide><div style={{ display: 'grid', gap: 16 }}><div style={styles.detailHero}><div style={styles.avatar}>{iniciais(comanda.clienteNome || 'Cliente')}</div><div style={{ flex: 1 }}><strong style={{ fontSize: 20 }}>{comanda.clienteNome || 'Cliente eventual'}</strong><div style={styles.sub}>{comanda.profissionalNome || 'Sem profissional atribuído'} · {comanda.agendamentoId ? 'vinculada à agenda' : 'comanda avulsa'}</div></div><Badge status={comanda.status} /></div><div style={styles.comandaMetrics}><div><small>Subtotal</small><strong>{moeda(subtotal)}</strong></div><div><small>Desconto</small><strong>{moeda(comanda.desconto || 0)}</strong></div><div><small>Gorjeta</small><strong>{moeda(comanda.gorjeta || 0)}</strong></div><div><small>Pago</small><strong>{moeda(totalPago)}</strong></div><div><small>Saldo</small><strong style={{ color: saldoPendente > 0 ? '#f59e0b' : '#14b87a' }}>{moeda(saldoPendente)}</strong></div></div><Card style={{ padding: 14 }}><div style={styles.sectionTitle}><div><h3 style={{ margin: 0 }}>Itens da comanda</h3><p style={styles.sub}>Serviços não baixam estoque; produtos usam exclusivamente o estoque de revenda da Barbearia.</p></div><strong>{moeda(comanda.total || 0)}</strong></div>{!comanda.itens?.length ? <div style={styles.inlineEmpty}>Nenhum item adicionado.</div> : <div style={{ display: 'grid', gap: 8 }}>{comanda.itens.map((item, indice) => <div key={item.id || `${item.tipo}-${indice}`} style={styles.comandaItemRow}><div><strong>{item.nome}</strong><small>{item.tipo === 'produto' ? 'Produto de revenda' : 'Serviço'} · {item.quantidade || item.qtd || 1} × {moeda(item.precoUnitario || item.preco || 0)}</small></div><strong>{moeda(item.subtotal ?? Number(item.precoUnitario || item.preco || 0) * Number(item.quantidade || item.qtd || 1))}</strong></div>)}</div>}{podeEditar && <form onSubmit={adicionarItemComanda} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, .6fr) minmax(180px, 1.4fr) 90px auto', gap: 8, alignItems: 'end', marginTop: 14 }}><Field label="Tipo"><select value={formComanda.itemTipo} onChange={(event) => setFormComanda((atual) => ({ ...atual, itemTipo: event.target.value, itemId: '' }))} style={inputStyle}><option value="servico">Serviço</option><option value="produto">Produto</option></select></Field><Field label="Item"><select required value={formComanda.itemId} onChange={(event) => setFormComanda((atual) => ({ ...atual, itemId: event.target.value }))} style={inputStyle}><option value="">Selecionar item</option>{formComanda.itemTipo === 'servico' ? servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome} · {moeda(servico.preco)}</option>) : produtosRevenda.filter((item) => item.ativo !== false && Number(item.estoqueAtual || 0) > 0).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · {produto.estoqueAtual} disponíveis</option>)}</select></Field><Field label="Qtd."><input type="number" min="1" value={formComanda.quantidade} onChange={(event) => setFormComanda((atual) => ({ ...atual, quantidade: event.target.value }))} style={inputStyle} /></Field><button type="submit" style={styles.secondary} disabled={salvando}>Adicionar</button></form>}</Card>{podeEditar && <form onSubmit={salvarDetalhesComanda} style={{ display: 'grid', gap: 12 }}><div style={styles.formGrid}><Field label="Gorjeta (R$)"><input type="number" min="0" step="0.01" value={formComanda.gorjeta} onChange={(event) => setFormComanda((atual) => ({ ...atual, gorjeta: event.target.value }))} style={inputStyle} /></Field><Field label="Desconto (R$)"><input type="number" min="0" step="0.01" value={formComanda.desconto} onChange={(event) => setFormComanda((atual) => ({ ...atual, desconto: event.target.value }))} style={inputStyle} /></Field><Field label="Motivo do desconto"><input value={formComanda.descontoMotivo} onChange={(event) => setFormComanda((atual) => ({ ...atual, descontoMotivo: event.target.value }))} style={inputStyle} /></Field><Field label="Observações" full><textarea rows={2} value={formComanda.observacoes} onChange={(event) => setFormComanda((atual) => ({ ...atual, observacoes: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="submit" style={styles.secondary} disabled={salvando}>Salvar ajustes</button>{comanda.status === 'aberta' && <button type="button" style={styles.primary} disabled={salvando || !comanda.itens?.length} onClick={aguardarPagamentoComanda}>Enviar para pagamento</button>}{['aberta', 'aguardando_pagamento', 'parcialmente_paga'].includes(comanda.status) && <button type="button" style={{ ...styles.secondary, color: '#e05c5c' }} disabled={salvando} onClick={cancelarComanda}>Cancelar comanda</button>}</div></form>}{!['paga', 'cancelada', 'em_conta'].includes(comanda.status) && saldoPendente > 0 && <Card style={styles.paymentPanel}><div style={styles.sectionTitle}><div><h3 style={{ margin: 0 }}>Receber comanda</h3><p style={styles.sub}>A confirmação registra o financeiro idempotente e baixa produtos uma única vez.</p></div></div><div style={styles.formGrid}><Field label="Meio de pagamento"><select value={formPagamentoComanda.meioPagamento} onChange={(event) => setFormPagamentoComanda((atual) => ({ ...atual, meioPagamento: event.target.value }))} style={inputStyle}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option><option value="transferencia">Transferência</option><option value="conta">Conta do cliente</option></select></Field><Field label="Valor recebido (R$)"><input type="number" min="0.01" max={saldoPendente} step="0.01" value={formPagamentoComanda.valor} onChange={(event) => setFormPagamentoComanda((atual) => ({ ...atual, valor: event.target.value }))} style={inputStyle} /></Field><Field label="Cliente para conta" hint={formPagamentoComanda.meioPagamento === 'conta' ? 'O servidor valida limite, saldo e vencimento antes de faturar.' : undefined}><select value={formPagamentoComanda.clienteId} onChange={(event) => setFormPagamentoComanda((atual) => ({ ...atual, clienteId: event.target.value }))} style={inputStyle}><option value="">Usar cliente da comanda</option>{clientes.filter((cliente) => cliente.padrao !== true).map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></Field>{formPagamentoComanda.meioPagamento === 'conta' && <div style={{ ...styles.notice, gridColumn: '1 / -1' }}><strong>{clienteCredito ? `Crédito disponível: ${moeda(creditoDisponivel)}` : 'Selecione um cliente cadastrado'}</strong><div style={styles.sub}>{clienteCredito ? `Limite ${moeda(limiteCredito)} · saldo ${moeda(saldoDevedor)} · vencimento em ${clienteCredito.diasVencimento || 30} dia(s).` : 'Conta do cliente não é permitida para atendimento eventual.'}</div>{clienteCredito && !contaPermitida && <div style={{ color: '#e05c5c', fontSize: 12, fontWeight: 700, marginTop: 6 }}>{limiteCredito <= 0 ? 'Crediário bloqueado: configure um limite positivo no perfil do cliente.' : `Valor acima do disponível em ${moeda(Math.max(0, valorConta - creditoDisponivel))}.`}</div>}</div>}{formPagamentoComanda.meioPagamento === 'dinheiro' && <Field label="Caixa aberto"><select value={formPagamentoComanda.caixaId} onChange={(event) => setFormPagamentoComanda((atual) => ({ ...atual, caixaId: event.target.value }))} style={inputStyle}><option value="">Caixa aberto da unidade (automático)</option>{(operacao?.caixas || dashboard?.caixa?.caixas || []).filter((caixa) => caixa.status === 'aberto').map((caixa) => <option key={caixa.id} value={caixa.id}>Caixa {caixa.numeroCaixa} · aberto</option>)}</select></Field>}</div><div style={styles.modalActions}><button type="button" style={styles.primary} disabled={salvando || !contaPermitida} onClick={pagarComanda}>Confirmar recebimento</button></div></Card>}{['paga', 'em_conta'].includes(comanda.status) && <div style={styles.notice}><strong>{documentoFiscal ? 'Rascunho fiscal preparado' : 'Ponte fiscal disponível'}</strong><div style={styles.sub}>{documentoFiscal ? `Status: ${documentoFiscal.status}. Nenhum número fiscal foi emitido.` : 'Prepare um rascunho auditável para integração futura. Esta ação não emite, transmite nem numera documento fiscal.'}</div>{!documentoFiscal && <button type="button" style={{ ...styles.secondary, marginTop: 10 }} disabled={salvando} onClick={() => prepararFiscalComanda(comanda)}>Preparar rascunho fiscal</button>}</div>}{comanda.status === 'em_conta' && <div style={styles.notice}><strong>Comanda lançada em conta</strong><div style={styles.sub}>A conta a receber foi registrada; a baixa futura deve ocorrer pelo fluxo de contas/CRM, sem simular pagamento nesta tela.</div></div>}{comanda.pagamentos?.length > 0 && <div><h3 style={{ margin: '2px 0 8px' }}>Pagamentos registrados</h3><div style={{ display: 'grid', gap: 6 }}>{comanda.pagamentos.map((pagamento) => <div key={pagamento.id} style={styles.comandaItemRow}><span>{pagamento.meio} · {fmtDate(pagamento.registradoEm)}</span><strong>{moeda(pagamento.valor)}</strong></div>)}</div></div>}{comanda.observacoes && <div style={styles.notice}><strong>Observações</strong><div style={styles.sub}>{comanda.observacoes}</div></div>}</div></Modal>
    }
    if (modal?.tipo === 'detalheCliente') return <Modal title="Perfil operacional do cliente" onClose={() => setModal(null)}><div style={{ display: 'grid', gap: 16 }}><div style={styles.detailHero}><div style={styles.avatar}>{iniciais(modal.cliente.nome)}</div><div><strong style={{ fontSize: 20 }}>{modal.cliente.nome}</strong><div style={styles.sub}>{modal.cliente.tipo === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'} · cadastro do CRM</div></div></div><div style={styles.detailGrid}><div><small style={styles.sub}>Telefone</small><strong>{modal.cliente.telefone || 'Não informado'}</strong></div><div><small style={styles.sub}>E-mail</small><strong>{modal.cliente.email || 'Não informado'}</strong></div><div><small style={styles.sub}>Saldo devedor</small><strong>{moeda(modal.cliente.saldoDevedor)}</strong></div><div><small style={styles.sub}>Limite na conta</small><strong>{moeda(modal.cliente.limiteCreditoMensal)}</strong></div><div><small style={styles.sub}>Crédito disponível</small><strong>{moeda(Math.max(0, Number(modal.cliente.limiteCreditoMensal || 0) - Number(modal.cliente.saldoDevedor || 0)))}</strong></div><div><small style={styles.sub}>Vencimento</small><strong>{modal.cliente.diasVencimento || 30} dia(s)</strong></div><div><small style={styles.sub}>Atualizado em</small><strong>{modal.cliente.atualizadoEm ? fmtDate(modal.cliente.atualizadoEm) : 'Sem registro'}</strong></div></div>{modal.cliente.observacao && <div style={styles.notice}><strong>Observação</strong><div style={styles.sub}>{modal.cliente.observacao}</div></div>}<Card style={{ padding: 14 }}><div style={styles.sectionTitle}><div><h3 style={{ margin: 0 }}>Consentimentos</h3><p style={styles.sub}>Cada alteração é confirmada pelo operador e registrada com canal, finalidade e responsável.</p></div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 10 }}>{[['whatsapp', 'atendimento', 'WhatsApp · atendimento'], ['whatsapp', 'marketing', 'WhatsApp · marketing'], ['email', 'atendimento', 'E-mail · atendimento'], ['email', 'marketing', 'E-mail · marketing']].map(([canal, finalidade, label]) => { const ativo = modal.cliente.consentimentos?.[canal]?.[finalidade]?.concedido === true; return <div key={`${canal}-${finalidade}`} style={styles.notice}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{label}</strong><span style={{ color: ativo ? '#14b87a' : 'var(--muted)', fontWeight: 800, fontSize: 12 }}>{ativo ? 'Concedido' : 'Não concedido'}</span></div><button type="button" style={styles.small} onClick={() => atualizarConsentimento(modal.cliente, canal, finalidade, !ativo)}>{ativo ? 'Revogar' : 'Conceder'}</button></div> })}</div></Card><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => abrirEdicaoCliente(modal.cliente)}>Editar cliente e crédito</button><button type="button" style={styles.secondary} onClick={() => { setModal(null); agendarParaCliente(modal.cliente) }}>Agendar atendimento</button><button type="button" style={styles.primary} onClick={() => { setModal(null); navegarParaTab('Fidelidade') }}>Ver fidelidade</button><button type="button" style={styles.primary} onClick={() => { const ref = `dino:${modal.cliente.id}`; setModal(null); navigate(`/admin/clientes-360/${encodeURIComponent(ref)}`) }}>Abrir Customer 360</button></div></div></Modal>
    if (modal?.tipo === 'creditoFidelidade') return <Modal title={`Ajuste de pontos · ${modal.membro?.nome || 'Membro'}`} onClose={() => setModal(null)}><form onSubmit={creditarFidelidade} style={{ display: 'grid', gap: 16 }}><div style={styles.notice}><strong>Ajuste manual auditável</strong><div style={styles.sub}>Use somente para corrigir ou reconhecer uma operação validada. O ajuste não cria receita, pagamento ou desconto.</div></div><Field label="Valor elegível para pontos (R$)"><input required type="number" min="0.01" step="0.01" value={formCreditoFidelidade.valor} onChange={(event) => setFormCreditoFidelidade({ valor: event.target.value })} style={inputStyle} autoFocus /></Field><div style={styles.sub}>Regra atual: {fidelidade.regra?.pontosPorReal || 0} ponto(s) por R$ 1,00. O sistema calcula os pontos no servidor.</div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Registrando…' : 'Confirmar ajuste'}</button></div></form></Modal>
    if (modal?.tipo === 'pagamentoVendaRevenda') return <Modal title={`Confirmar recebimento · ${modal.venda?.id || 'Venda'}`} onClose={() => setModal(null)}><form onSubmit={concluirPagamentoVendaRevenda} style={{ display: 'grid', gap: 16 }}><div style={styles.notice}><strong>{modal.venda?.clienteNome || 'Venda balcão'}</strong><div style={styles.sub}>{modal.venda?.itens?.map((item) => `${item.quantidade}× ${item.nome}`).join(' · ') || 'Itens da venda'} · total {moeda(modal.venda?.total || 0)}</div></div><Field label="Meio de pagamento"><select required value={formPagamentoVendaRevenda.meioPagamento} onChange={(event) => setFormPagamentoVendaRevenda({ meioPagamento: event.target.value })} style={inputStyle}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option><option value="transferencia">Transferência</option></select></Field><div style={styles.notice}><strong>O que será efetivado</strong><div style={styles.sub}>A confirmação baixa o estoque tenant-aware e registra a receita idempotente. Nenhum gateway externo será acionado por esta tela.</div></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Confirmando…' : 'Confirmar recebimento'}</button></div></form></Modal>
    if (modal?.tipo === 'recebimento') return <Modal title="Registrar recebimento" onClose={() => setModal(null)}><div style={{ display: 'grid', gap: 16 }}>
<div style={{ background: 'var(--card)', borderRadius: 10, padding: 14 }}><strong>{modal.agendamento.clienteNome || modal.agendamento.cliente_nome}</strong><div style={styles.sub}>{modal.agendamento.servicoNome || modal.agendamento.servico_nome} · valor previsto {moeda(modal.agendamento.valor)}</div></div><Field label="Meio de pagamento"><select value={formRecebimento.meioPagamento} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, meioPagamento: event.target.value }))} style={inputStyle}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option><option value="transferencia">Transferência</option></select></Field>{saldoCashbackCliente?.sinalPago > 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sinal de {moeda(saldoCashbackCliente.sinalPago)} já pago e lançado no financeiro: entra como desconto abaixo.</div>}{saldoCashbackCliente?.saldo > 0 && <Field label={`Usar cashback (saldo ${moeda(saldoCashbackCliente.saldo)})`} hint="O valor usado sai do saldo do cliente e fica registrado na auditoria."><input type="number" min="0" step="0.01" max={saldoCashbackCliente.saldo} value={formRecebimento.usarCashback} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, usarCashback: event.target.value }))} style={inputStyle} /></Field>}<Field label="Vale-presente (opcional)" hint="Código do vale e quanto dele usar neste atendimento; o saldo é conferido no servidor."><div style={{ display: 'flex', gap: 8 }}><input placeholder="ABCDE-FGHJK" value={formRecebimento.valeCodigo} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, valeCodigo: event.target.value.toUpperCase() }))} style={{ ...inputStyle, flex: 2 }} /><input type="number" min="0" step="0.01" placeholder="Valor" value={formRecebimento.valeValor} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, valeValor: event.target.value }))} style={{ ...inputStyle, flex: 1 }} /></div></Field><Field label="Valor a receber agora (R$)" hint="Valor do serviço menos sinal pago, cashback e vale usados. Para desconto ou ajuste, use a comanda com aprovação e auditoria."><input type="number" value={valorDevidoRecebimento(modal.agendamento).toFixed(2)} readOnly aria-readonly="true" style={inputStyle} /></Field><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="button" style={styles.primary} disabled={salvando || conferindoSinal} onClick={concluirEReceber}>{salvando ? 'Registrando…' : conferindoSinal ? 'Conferindo sinal…' : 'Confirmar recebimento'}</button></div></div></Modal>
    if (modal?.tipo === 'detalheAgenda') {
      const agendamento = modal.agendamento
      const proximas = TRANSICOES[agendamento.status] || []
      return <Modal title="Detalhes do atendimento" onClose={() => setModal(null)}><div style={{ display: 'grid', gap: 16 }}><div style={styles.detailHero}><div style={styles.avatar}>{iniciais(agendamento.clienteNome || agendamento.cliente_nome)}</div><div><strong style={{ fontSize: 20 }}>{agendamento.clienteNome || agendamento.cliente_nome || 'Cliente sem nome'}</strong><div style={styles.sub}>{agendamento.clienteTelefone || agendamento.cliente_telefone || 'Sem telefone informado'}</div></div><Badge status={agendamento.status} /></div><div style={styles.detailGrid}><div><small style={styles.sub}>Horário</small><strong>{horario(agendamento.dataHora)} · {agendamento.duracaoMinutos || 0} min</strong></div><div><small style={styles.sub}>Atendente</small><strong>{agendamento.profissionalNome || agendamento.profissional_nome || 'Sem atendente'}</strong></div><div><small style={styles.sub}>Serviço</small><strong>{agendamento.servicoNome || agendamento.servico_nome || 'Não informado'}</strong></div><div><small style={styles.sub}>Valor</small><strong>{moeda(agendamento.valor)}</strong></div></div>{agendamento.observacoes && <div style={styles.notice}><strong>Observações</strong><div style={styles.sub}>{agendamento.observacoes}</div></div>}<div style={styles.modalActions}>{!['concluido', 'cancelado', 'nao_compareceu'].includes(agendamento.status) && <button type="button" style={styles.primary} onClick={() => abrirEdicaoAgendamento(agendamento)}>Remarcar</button>}{proximas.map((proximo) => <button key={proximo} type="button" style={styles.secondary} onClick={() => { setModal(null); mudarStatus(agendamento, proximo) }}>{STATUS[proximo]?.label}</button>)}{agendamento.status === 'concluido' && !agendamento.financeiroLancamentoId && <button type="button" style={styles.primary} onClick={() => { abrirRecebimento(agendamento) }}>Registrar recebimento</button>}<button type="button" style={styles.secondary} onClick={() => { setModal(null); const comanda = comandas.find((item) => item.agendamentoId === agendamento.id && item.status !== 'cancelada'); comanda ? abrirComanda(comanda) : abrirNovaComanda(agendamento) }}>{comandas.some((item) => item.agendamentoId === agendamento.id && item.status !== 'cancelada') ? 'Abrir comanda' : 'Criar comanda'}</button></div></div></Modal>
    }
    if (modal === 'plano') return <Modal title="Novo plano de recorrência" onClose={() => setModal(null)} wide><form onSubmit={salvarPlano} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formPlano.nome} onChange={(event) => setFormPlano((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} placeholder="Plano mensal corte" /></Field><Field label="Preço do ciclo (R$) *"><input required type="number" min="0.01" step="0.01" value={formPlano.preco} onChange={(event) => setFormPlano((atual) => ({ ...atual, preco: event.target.value }))} style={inputStyle} /></Field><Field label="Ciclo"><select value={formPlano.ciclo} onChange={(event) => setFormPlano((atual) => ({ ...atual, ciclo: event.target.value }))} style={inputStyle}><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></Field><Field label="Sessões incluídas"><input required type="number" min="1" max="100" value={formPlano.sessoesIncluidas} onChange={(event) => setFormPlano((atual) => ({ ...atual, sessoesIncluidas: event.target.value }))} style={inputStyle} /></Field><Field label="Validade (dias)"><input required type="number" min="1" value={formPlano.validadeDias} onChange={(event) => setFormPlano((atual) => ({ ...atual, validadeDias: event.target.value }))} style={inputStyle} /></Field><Field label="Serviços cobertos" full><select multiple value={formPlano.servicosIds} onChange={(event) => setFormPlano((atual) => ({ ...atual, servicosIds: Array.from(event.target.selectedOptions).map((option) => option.value) }))} style={{ ...inputStyle, minHeight: 110 }}>{servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}</select><small style={styles.sub}>Use Ctrl/Cmd para selecionar mais de um serviço.</small></Field><Field label="Descrição" full><textarea rows={3} value={formPlano.descricao} onChange={(event) => setFormPlano((atual) => ({ ...atual, descricao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar plano'}</button></div></form></Modal>
    if (modal === 'produtoRevenda') return <Modal title="Novo produto de revenda" onClose={() => setModal(null)} wide><form onSubmit={salvarProdutoRevenda} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formProdutoRevenda.nome} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} placeholder="Pomada modeladora" /></Field><Field label="SKU"><input value={formProdutoRevenda.sku} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, sku: event.target.value }))} style={inputStyle} /></Field><Field label="Categoria"><input value={formProdutoRevenda.categoria} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, categoria: event.target.value }))} style={inputStyle} /></Field><Field label="Unidade"><input value={formProdutoRevenda.unidade} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, unidade: event.target.value }))} style={inputStyle} /></Field><Field label="Preço de venda (R$) *"><input required type="number" min="0.01" step="0.01" value={formProdutoRevenda.precoVenda} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, precoVenda: event.target.value }))} style={inputStyle} /></Field><Field label="Custo unitário (R$)"><input type="number" min="0" step="0.01" value={formProdutoRevenda.custoUnitario} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, custoUnitario: event.target.value }))} style={inputStyle} /></Field><Field label="Estoque inicial"><input type="number" min="0" step="1" value={formProdutoRevenda.estoqueAtual} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, estoqueAtual: event.target.value }))} style={inputStyle} /></Field><Field label="Estoque mínimo"><input type="number" min="0" step="1" value={formProdutoRevenda.estoqueMinimo} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, estoqueMinimo: event.target.value }))} style={inputStyle} /></Field></div><p style={styles.sub}>O estoque inicial gera apenas um movimento de entrada inicial; nenhum financeiro é criado.</p><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Cadastrar produto'}</button></div></form></Modal>
    return null
  }

  function renderIntegracoes() {
    const whatsapp = integracoes?.whatsapp
    const ia = integracoes?.ia
    const commerce = integracoes?.commerce || {}
    const whatsappMessagingOk = Boolean(whatsappAi.messagingConfigured ?? whatsappAi.evolutionConfigured)
    const whatsappAiReady = Boolean(whatsappAi.featureEnabled && whatsappAi.gemini?.configured && whatsappMessagingOk)
    const whatsappAiActive = whatsappAi.channel?.status === 'ativo'
    const whatsappAiCircuitOpen = whatsappAi.channel?.aiCircuitOpen === true
    const whatsappAiQueue = Number(whatsappAi.tasks?.pendente || 0) + Number(whatsappAi.tasks?.processando || 0)
    const whatsappAiFailed = Number(whatsappAi.tasks?.falha || 0)
    const whatsappAiDeadLetter = Number(whatsappAi.tasks?.deadLetter || 0)
    const whatsappAiUnknown = Number(whatsappAi.deliveries?.unknown || 0)
    const iaDisponivel = Boolean(ia?.analiseOperacionalDisponivel)
    const prontidaoCommerce = Number(commerce?.prontidao?.percentual || 0)
    const commerceDisponivel = !['desativado', 'indisponivel', 'temporariamente_indisponivel', 'sem_membership', 'sem_permissao'].includes(commerce?.status)
    return <div style={{ display: 'grid', gap: 18 }}>
      <Card style={{ padding: 20, background: 'linear-gradient(135deg, color-mix(in srgb, #25d366 10%, var(--card)), var(--card))' }}>
        <div style={styles.sectionTitle}>
          <div>
            <div style={styles.kicker}>Canais e automação controlada</div>
            <h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>Integrações da Barbearia</h2>
            <p style={styles.sub}>WhatsApp e IA operam com consentimento, limites e handoff. O canal permanece inerte enquanto não estiver explicitamente configurado e ativo.</p>
          </div>
          <button type="button" style={styles.secondary} onClick={carregar}>Atualizar status</button>
        </div>
        <div style={styles.integrationGrid}>
          <div style={styles.integrationCard}>
            <div style={styles.integrationHeading}>
              <div style={{ ...styles.integrationIcon, background: '#25d366' }}>W</div>
              <div><strong>WhatsApp</strong><span style={styles.sub}>{whatsapp?.envioManualDisponivel ? 'Canal configurado no servidor' : 'Canal ainda não configurado'}</span></div>
              <Badge status={whatsapp?.envioManualDisponivel ? 'configurado' : 'pendente_configuracao'} />
            </div>
            <div style={styles.metricLine}><span>Credencial do provedor</span><strong>{whatsapp?.credencialConfigurada ? 'Configurada' : 'Pendente'}</strong></div>
            <div style={styles.metricLine}><span>Disparo automático</span><strong>Desativado</strong></div>
            <p style={styles.sub}>O envio manual exige telefone, mensagem e confirmação adicional do operador. A credencial nunca é exibida na tela.</p>
            <form onSubmit={enviarWhatsApp} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <Field label="Cliente com consentimento"><select value={formWhatsApp.clienteId} onChange={(event) => { const cliente = clientes.find((item) => item.id === event.target.value); setFormWhatsApp((atual) => ({ ...atual, clienteId: event.target.value, telefone: cliente?.telefone || atual.telefone, consentimentoConfirmado: false })) }} style={inputStyle} disabled={!whatsapp?.envioManualDisponivel}><option value="">Contato avulso (exige autorização abaixo)</option>{clientes.filter((cliente) => cliente.padrao !== true).map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.telefone ? ` · ${cliente.telefone}` : ''}</option>)}</select></Field>
              <Field label="Finalidade"><select value={formWhatsApp.finalidade} onChange={(event) => setFormWhatsApp((atual) => ({ ...atual, finalidade: event.target.value }))} style={inputStyle} disabled={!whatsapp?.envioManualDisponivel}><option value="atendimento">Atendimento</option><option value="marketing">Marketing</option></select></Field>
              <Field label="Telefone"><input value={formWhatsApp.telefone} onChange={(event) => setFormWhatsApp((atual) => ({ ...atual, telefone: event.target.value }))} placeholder="DDD + número" style={inputStyle} disabled={!whatsapp?.envioManualDisponivel || Boolean(formWhatsApp.clienteId)} /></Field>
              <Field label="Mensagem"><textarea rows={4} value={formWhatsApp.mensagem} onChange={(event) => setFormWhatsApp((atual) => ({ ...atual, mensagem: event.target.value }))} placeholder="Escreva uma mensagem operacional…" style={{ ...inputStyle, resize: 'vertical' }} disabled={!whatsapp?.envioManualDisponivel} /></Field>
              {!formWhatsApp.clienteId && <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formWhatsApp.consentimentoConfirmado} onChange={(event) => setFormWhatsApp((atual) => ({ ...atual, consentimentoConfirmado: event.target.checked }))} disabled={!whatsapp?.envioManualDisponivel} /> Confirmo que o destinatário autorizou este contato.</label>}
              <button type="submit" style={{ ...styles.primary, background: '#25d366' }} disabled={!whatsapp?.envioManualDisponivel || salvando}>{whatsapp?.envioManualDisponivel ? 'Enviar manualmente' : 'Configurar provedor para enviar'}</button>
            </form>
          </div>
          <div style={styles.integrationCard}>
            <div style={styles.integrationHeading}>
              <div style={{ ...styles.integrationIcon, background: '#6d5dfc' }}>IA</div>
              <div><strong>Assistente IA operacional</strong><span style={styles.sub}>{ia?.configurada ? `Provedor disponível${ia.modelo ? ` · ${ia.modelo}` : ''}` : iaDisponivel ? `Modo local tenant-aware · ${ia?.modelo || 'regras-dino-local'}` : 'Assistente indisponível'}</span></div>
              <Badge status={iaDisponivel ? 'configurado' : 'pendente_configuracao'} />
            </div>
            <div style={styles.metricLine}><span>Escopo da consulta</span><strong>Clientes, agenda, serviços, loja, vendas e promoções</strong></div>
            <div style={styles.metricLine}><span>Ações críticas</span><strong>Somente após CONFIRMAR</strong></div>
            <p style={styles.sub}>A IA capta o cliente, consulta dados reais, vende produtos de revenda, agenda serviços, remarca, cancela e encaminha para a equipe. Nenhuma ação crítica é concluída sem confirmação explícita.</p>
            <form onSubmit={consultarAssistente} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <Field label="Pergunta para o assistente"><textarea rows={4} value={assistentePergunta} onChange={(event) => setAssistentePergunta(event.target.value)} placeholder="Ex.: quais horários estão mais ocupados hoje?" style={{ ...inputStyle, resize: 'vertical' }} /></Field>
              <button type="submit" style={styles.primary} disabled={consultandoAssistente}>{consultandoAssistente ? 'Analisando…' : 'Consultar assistente'}</button>
            </form>
            {assistenteResposta?.resposta && <div style={styles.aiResponse}><strong>Resposta do assistente</strong><div style={{ whiteSpace: 'pre-wrap', marginTop: 8, lineHeight: 1.55 }}>{assistenteResposta.resposta}</div><small style={styles.sub}>Resposta gerada a partir dos dados operacionais selecionados; confirme qualquer decisão manualmente.</small></div>}
            {assistenteResposta?.erro && <div style={{ ...styles.notice, borderColor: '#e05c5c' }}><strong>Consulta não disponível</strong><div style={styles.sub}>{assistenteResposta.erro}</div></div>}
          </div>
          <div style={{ ...styles.integrationCard, gridColumn: '1 / -1' }}>
            <div style={styles.integrationHeading}>
              <div style={{ ...styles.integrationIcon, background: '#111827' }}>AI</div>
              <div style={{ flex: 1 }}><strong>{formWhatsappAi.displayName || 'Atendente humanizado da unidade'}</strong><span style={styles.sub}>WhatsApp conectado à loja, agenda, clientes, vendas e operação da unidade</span></div>
              <Badge status={whatsappAiActive ? 'configurado' : 'pendente_configuracao'} />
            </div>
            <div style={styles.readinessGrid}>
              <div style={styles.readinessItem}><strong>Feature flag</strong><span style={{ fontWeight: 800, color: whatsappAi.featureEnabled ? '#14b87a' : '#f59e0b' }}>{whatsappAi.featureEnabled ? 'Ativa' : 'Desativada'}</span><small style={styles.sub}>Ativação separada do deploy</small></div>
              <div style={styles.readinessItem}><strong>Gemini</strong><span style={{ fontWeight: 800, color: whatsappAi.gemini?.configured ? '#14b87a' : '#f59e0b' }}>{whatsappAi.gemini?.configured ? whatsappAi.gemini.model : 'Pendente'}</span><small style={styles.sub}>{whatsappAiCircuitOpen ? 'Circuito aberto · handoff obrigatório' : `${Number(whatsappAi.provider24h?.total || 0)} execução(ões) em 24h`}</small></div>
              <div style={styles.readinessItem}><strong>{whatsappAi.messagingProvider?.label || 'Provedor WhatsApp'}</strong><span style={{ fontWeight: 800, color: whatsappMessagingOk ? '#14b87a' : '#f59e0b' }}>{whatsappMessagingOk ? 'Configurado' : 'Pendente'}</span><small style={styles.sub}><Link to="/admin/whatsapp">Conexão do número (QR) →</Link></small></div>
              <div style={styles.readinessItem}><strong>Canal</strong><span style={{ fontWeight: 800 }}>{whatsappAi.channel?.status || 'Não criado'}</span><small style={styles.sub}>{whatsappAi.channel?.lastEventAt ? `Último evento ${fmtDate(whatsappAi.channel.lastEventAt)}` : 'Sem eventos recebidos'}</small></div>
              <div style={styles.readinessItem}><strong>Fila humana</strong><span style={{ fontWeight: 800 }}>{Number(whatsappAi.sessions?.humano || 0)}</span><small style={styles.sub}>{Number(whatsappAi.humanQueue?.unassigned || 0)} sem responsável</small></div>
              <div style={styles.readinessItem}><strong>Fila técnica</strong><span style={{ fontWeight: 800 }}>{whatsappAiQueue}</span><small style={styles.sub}>{whatsappAiFailed} aguardando retry · {whatsappAiDeadLetter} dead-letter</small></div>
              <div style={styles.readinessItem}><strong>Entregas 24h</strong><span style={{ fontWeight: 800 }}>{Number(whatsappAi.deliveries?.sent || 0)} enviadas</span><small style={styles.sub}>{whatsappAiUnknown} incerta(s) · nunca reenviadas automaticamente</small></div>
              <div style={styles.readinessItem}><strong>Latência Gemini</strong><span style={{ fontWeight: 800 }}>{Number(whatsappAi.provider24h?.avgLatencyMs || 0)} ms</span><small style={styles.sub}>{Number(whatsappAi.provider24h?.failed || 0)} falha(s) · {Number(whatsappAi.provider24h?.toolCalls || 0)} ferramenta(s)</small></div>
              <div style={styles.readinessItem}><strong>Worker</strong><span style={{ fontWeight: 800 }}>{whatsappAi.worker?.lastHeartbeatAt ? 'Observável' : 'Sem ciclos'}</span><small style={styles.sub}>{whatsappAi.worker?.lastHeartbeatAt ? `Último ciclo ${fmtDate(whatsappAi.worker.lastHeartbeatAt)}` : 'Inerte enquanto provedores estiverem pendentes'}</small></div>
            </div>
            {whatsappAi.unavailable && <div style={{ ...styles.notice, borderColor: '#f59e0b', marginTop: 12 }}><strong>Status indisponível</strong><div style={styles.sub}>{whatsappAi.error || 'A migration da IA ainda não foi aplicada.'}</div></div>}
            <form onSubmit={(event) => event.preventDefault()} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10, marginTop: 14 }}>
              <Field label="Instância do WhatsApp"><input value={formWhatsappAi.instance} onChange={(event) => setFormWhatsappAi((atual) => ({ ...atual, instance: event.target.value }))} placeholder="dino" style={inputStyle} /></Field>
              <Field label="Nome do atendimento"><input value={formWhatsappAi.displayName} onChange={(event) => setFormWhatsappAi((atual) => ({ ...atual, displayName: event.target.value }))} placeholder="Atendimento da unidade" style={inputStyle} /></Field>
            </form>
            <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'color-mix(in srgb, var(--card) 88%, var(--accent))' }}>
              <strong>Capacidades da operação</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 10, marginTop: 10 }}>
                {[
                  ['humanized', 'Tom humanizado', 'Conversa natural e transparente'],
                  ['captureLeads', 'Captação de clientes', 'Registra lead e interações no CRM'],
                  ['operateStore', 'Loja e vendas', 'Consulta catálogo, estoque e prepara pedidos'],
                  ['manageAppointments', 'Agenda', 'Consulta, agenda, remarca e cancela'],
                  ['sendPromotions', 'Promoções', 'Exige opt-in e confirmação antes do envio'],
                  ['reminders', 'Lembretes', 'Usa a fila governada de notificações'],
                  ['humanHandoff', 'Handoff humano', 'Entrega a conversa para a equipe'],
                ].map(([key, label, description]) => <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', cursor: 'pointer' }}><input type="checkbox" checked={formWhatsappAi[key] !== false} onChange={(event) => setFormWhatsappAi((atual) => ({ ...atual, [key]: event.target.checked }))} /><span><strong>{label}</strong><small style={{ ...styles.sub, display: 'block', marginTop: 3 }}>{description}</small></span></label>)}
              </div>
              <small style={{ ...styles.sub, display: 'block', marginTop: 10 }}>Promoções começam desativadas. Mesmo ativadas, o cliente precisa autorizar marketing e responder CONFIRMAR para cada envio preparado.</small>
            </div>
            <div style={{ ...styles.notice, marginTop: 12, display: 'grid', gap: 10 }}>
              <div style={styles.sectionTitle}><div><strong>Política de perfil e oportunidades</strong><div style={styles.sub}>Inativa por padrão; consentimento de personalização é separado de marketing e revogável pelo cliente.</div></div><Badge status={whatsappAi.policy?.opportunitiesEnabled ? 'configurado' : 'rascunho'} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formWhatsappAiPolicy.personalizationEnabled} onChange={(event) => setFormWhatsappAiPolicy((atual) => ({ ...atual, personalizationEnabled: event.target.checked, opportunitiesEnabled: event.target.checked ? atual.opportunitiesEnabled : false }))} /> Usar perfil somente após consentimento específico</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formWhatsappAiPolicy.opportunitiesEnabled} onChange={(event) => setFormWhatsappAiPolicy((atual) => ({ ...atual, opportunitiesEnabled: event.target.checked }))} disabled={!formWhatsappAiPolicy.personalizationEnabled} /> Permitir uma oportunidade relevante por conversa, com marketing autorizado</label>
                <Field label="Cooldown após recusa (dias)"><input type="number" min="7" max="90" value={formWhatsappAiPolicy.cooldownDays} onChange={(event) => setFormWhatsappAiPolicy((atual) => ({ ...atual, cooldownDays: event.target.value }))} style={inputStyle} /></Field>
                <Field label="Aviso de privacidade opcional"><textarea rows={3} value={formWhatsappAiPolicy.privacyNotice} onChange={(event) => setFormWhatsappAiPolicy((atual) => ({ ...atual, privacyNotice: event.target.value }))} placeholder="Vazio usa o aviso seguro padrão da unidade" style={{ ...inputStyle, resize: 'vertical' }} /></Field>
              </div>
              <div style={styles.readinessGrid}>
                <div style={styles.readinessItem}><strong>Perfil 24h</strong><span style={{ fontWeight: 800 }}>{Number(whatsappAi.policy24h?.profile_resolved || 0)}</span><small style={styles.sub}>{Number(whatsappAi.policy24h?.profile_ambiguous || 0)} ambiguidade(s) bloqueada(s)</small></div>
                <div style={styles.readinessItem}><strong>Oportunidades 24h</strong><span style={{ fontWeight: 800 }}>{Number(whatsappAi.policy24h?.opportunity_offered || 0)}</span><small style={styles.sub}>{Number(whatsappAi.policy24h?.opportunity_blocked || 0)} bloqueada(s) pelo gate</small></div>
                <div style={styles.readinessItem}><strong>Segurança 24h</strong><span style={{ fontWeight: 800 }}>{Number(whatsappAi.policy24h?.output_blocked || 0)}</span><small style={styles.sub}>{Number(whatsappAi.policy24h?.injection_suspected || 0)} injeção(ões) suspeita(s)</small></div>
              </div>
              <button type="button" style={styles.secondary} disabled={salvando || !whatsappAi.channel} onClick={salvarPoliticaWhatsappAi}>Salvar política sem ativar o canal</button>
            </div>
            <div style={{ ...styles.notice, marginTop: 12, display: 'grid', gap: 12 }}>
              <div style={styles.sectionTitle}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <img src="/trex/avatar-256.webp" alt="Avatar do atendente T-Rex" width="56" height="56" style={{ borderRadius: '50%', border: '2px solid var(--line)', flexShrink: 0 }} />
                  <div><strong>Persona do atendente</strong><div style={styles.sub}>Nome, jeito de falar e figurinhas no WhatsApp. Não muda o que a IA pode fazer: agenda, confirmação por SIM, consentimentos e handoff seguem iguais.</div></div>
                </div>
                <Badge status={whatsappAi.channel?.persona?.ativa ? 'configurado' : 'rascunho'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10 }}>
                <Field label="Nome do atendente"><input value={formPersona.nome} maxLength={40} onChange={(event) => setFormPersona((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field>
                <Field label="Quando diz que é assistente">
                  <select value={formPersona.revelarIa} onChange={(event) => setFormPersona((atual) => ({ ...atual, revelarIa: event.target.value }))} style={inputStyle}>
                    <option value="quando_perguntado">Só se o cliente perguntar (nunca nega)</option>
                    <option value="na_apresentacao">Já na apresentação</option>
                  </select>
                </Field>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formPersona.ativo} onChange={(event) => setFormPersona((atual) => ({ ...atual, ativo: event.target.checked }))} /> Usar a persona neste canal</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formPersona.mensagensCurtas} onChange={(event) => setFormPersona((atual) => ({ ...atual, mensagensCurtas: event.target.checked }))} /> Mensagens curtas em bolhas (alvo de 120 caracteres; resumos e links preservados)</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formPersona.figurinhas} onChange={(event) => setFormPersona((atual) => ({ ...atual, figurinhas: event.target.checked }))} /> Figurinhas do mascote (no máximo 1 por dia por cliente)</label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {(whatsappAi.channel?.persona?.figurinhasDisponiveis || ['oi', 'agendado', 'um-instante', 'corte-na-regua', 'perfume-novo', 'valeu', 'promocao', 'foi-mal', 'ate-amanha']).map((nome) => <img key={nome} src={`/trex/figurinhas/${nome}.webp`} alt={`Figurinha ${nome}`} title={nome} width="56" height="56" loading="lazy" style={{ opacity: formPersona.figurinhas ? 1 : 0.35 }} />)}
              </div>
              <small style={styles.sub}>{whatsappAi.channel?.persona?.figurinhasNoProvedor ? 'O provedor de WhatsApp aceita figurinhas.' : 'O provedor de WhatsApp ainda não aceita figurinhas (falta CHATBOT_BACKEND_STICKER_PATH): o texto sai normal e a figurinha é pulada.'}{whatsappAi.channel?.persona?.origem === 'ambiente' ? ' A persona está ligada pela variável WHATSAPP_AI_PERSONA; salve aqui para fixar no canal.' : ''}</small>
              <button type="button" style={styles.secondary} disabled={salvando || !whatsappAi.channel} onClick={salvarPersonaWhatsappAi}>Salvar persona</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" style={styles.secondary} disabled={salvando || !whatsappAi.gemini?.configured} onClick={testarGeminiWhatsappAi}>Testar Gemini</button>
              {!whatsappAi.channel && <button type="button" style={styles.secondary} disabled={salvando || !formWhatsappAi.instance.trim()} onClick={() => configurarWhatsappAi('rascunho')}>Salvar canal em rascunho</button>}
              {!whatsappAiActive && <button type="button" style={styles.primary} disabled={salvando || !whatsappAiReady || whatsappAiCircuitOpen || !formWhatsappAi.instance.trim()} onClick={() => configurarWhatsappAi('ativo')}>Ativar atendente IA</button>}
              {whatsappAiActive && <button type="button" style={styles.secondary} disabled={salvando || !formWhatsappAi.instance.trim()} onClick={() => configurarWhatsappAi('ativo')}>Salvar configuração do canal</button>}
              {whatsappAiActive && <button type="button" style={styles.secondary} disabled={salvando} onClick={() => configurarWhatsappAi('pausado')}>Pausar atendente</button>}
              <button type="button" style={styles.secondary} disabled={salvando || !whatsappAiActive || !whatsappAiReady} onClick={sincronizarWhatsappAi}>Sincronizar webhook</button>
            </div>
            {whatsappAiCircuitOpen && <div style={{ ...styles.notice, borderColor: '#e05c5c', marginTop: 12 }}><strong>Circuit breaker aberto</strong><div style={styles.sub}>Novas conversas serão encaminhadas à equipe até {whatsappAi.channel?.aiCircuitOpenUntil ? fmtDate(whatsappAi.channel.aiCircuitOpenUntil) : 'a recuperação do provedor'}.</div></div>}
            {(whatsappAiDeadLetter > 0 || whatsappAiUnknown > 0) && <div style={{ ...styles.notice, borderColor: '#f59e0b', marginTop: 12 }}><strong>Revisão humana necessária</strong><div style={styles.sub}>{whatsappAiDeadLetter} tarefa(s) em dead-letter e {whatsappAiUnknown} entrega(s) com resultado incerto. O sistema não repete essas mensagens automaticamente.</div></div>}
            <p style={{ ...styles.sub, marginTop: 12 }}>O atendimento é reativo, tenant-aware e informa que usa um assistente virtual. Captação, agenda e loja usam somente os dados reais da unidade selecionada. Pedidos, agendamentos, remarcações, cancelamentos e promoções só são concluídos após o cliente responder CONFIRMAR; pagamentos externos não são ativados. Handoff interrompe respostas automáticas até a equipe retomar a sessão.</p>
            {whatsappAiSessions.filter((item) => item.status === 'humano').length > 0 && <div style={{ marginTop: 14 }}>
              <div style={styles.sectionTitle}><div><strong>Fila de atendimento humano</strong><div style={styles.sub}>Telefones mascarados; conteúdo da conversa não é exibido neste painel. Quando a equipe responde pelo celular, a IA pausa sozinha naquela conversa e volta no horário indicado.</div></div><Badge status="pendente" /></div>
              <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                {whatsappAiSessions.filter((item) => item.status === 'humano').map((item) => <div key={item.id} style={{ ...styles.notice, display: 'grid', gap: 8 }}>
                  <div style={styles.metricLine}><span><strong>{item.nome || 'Contato'}</strong> · {item.telefone || 'telefone protegido'}</span><strong>Prioridade {Number(item.priority || 0)}</strong></div>
                  <div style={styles.sub}>Motivo: {item.handoff_label || item.handoff_reason || 'revisão humana'} · {item.staff_pause_until ? `IA volta sozinha às ${new Date(item.staff_pause_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' })}` : `aguardando desde ${item.handoff_requested_at ? fmtDate(item.handoff_requested_at) : fmtDate(item.ultima_interacao_em)}`}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!item.assigned && <button type="button" style={styles.secondary} disabled={salvando} onClick={() => assumirSessaoWhatsappAi(item.id)}>Assumir conversa</button>}
                    {item.assigned && <span style={{ ...styles.sub, alignSelf: 'center' }}>Atribuída {item.assigned_at ? fmtDate(item.assigned_at) : ''}</span>}
                    <button type="button" style={styles.secondary} disabled={salvando} onClick={() => liberarSessaoWhatsappAi(item.id, item.staff_pause_until)}>{item.staff_pause_until ? 'Devolver à IA agora' : 'Retomar automação'}</button>
                    <button type="button" style={styles.secondary} disabled={salvando} onClick={() => encerrarSessaoWhatsappAi(item.id)}>Encerrar</button>
                  </div>
                </div>)}
              </div>
            </div>}
          </div>
        </div>
        <div style={{ ...styles.notice, marginTop: 14, display: 'grid', gap: 14 }}>
          <div style={styles.integrationHeading}>
            <div style={{ ...styles.integrationIcon, background: 'var(--accent)' }}>C</div>
            <div style={{ flex: 1 }}><strong>{commerce?.storefront?.nome || 'Commerce Dino'}</strong><span style={styles.sub}>{commerce?.storefront ? `${commerce.storefront.lojaNome || 'Loja da sessão'} · ${commerce.storefront.status}` : 'Canal digital da empresa ativa'}</span></div>
            <Badge status={commerce?.status || 'temporariamente_indisponivel'} />
            <button type="button" style={styles.iconButton} onClick={carregar} disabled={loading} aria-label="Atualizar status do Commerce" title="Atualizar status do Commerce">↻</button>
          </div>
          <small style={styles.sub}>Status somente leitura atualizado {commerce?.geradoEm ? fmtDate(commerce.geradoEm) : 'agora'}.</small>
          <div aria-label={`Prontidão do Commerce: ${prontidaoCommerce}%`} style={{ display: 'grid', gap: 6 }}>
            <div style={styles.metricLine}><span>Prontidão comercial</span><strong>{prontidaoCommerce}%</strong></div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, Math.max(0, prontidaoCommerce))}%`, height: '100%', background: commerce?.prontidao?.pronto ? '#14b87a' : 'var(--accent)', transition: 'width .2s ease' }} /></div>
          </div>
          <div style={styles.readinessGrid}>
            <div style={styles.readinessItem}><strong>Catálogo publicado</strong><span style={{ color: 'var(--fg)', fontWeight: 800 }}>{commerce?.catalogo?.publicados || 0} produto(s)</span><small style={styles.sub}>{commerce?.catalogo?.variantesPublicadas || 0} variante(s) · {commerce?.catalogo?.semPreco || 0} sem preço</small></div>
            <div style={styles.readinessItem}><strong>Estoque digital</strong><span style={{ color: 'var(--fg)', fontWeight: 800 }}>{commerce?.estoque?.disponivel || 0} disponível(is)</span><small style={styles.sub}>{commerce?.estoque?.reservado || 0} reservado(s) · {commerce?.estoque?.estoqueBaixo || 0} em atenção</small></div>
            <div style={styles.readinessItem}><strong>Pedidos</strong><span style={{ color: 'var(--fg)', fontWeight: 800 }}>{commerce?.pedidos?.abertos || 0} aberto(s)</span><small style={styles.sub}>{commerce?.pedidos?.total || 0} no histórico do tenant</small></div>
            <div style={styles.readinessItem}><strong>Fulfillment</strong><span style={{ color: commerce?.fulfillment?.emAtencao ? '#f59e0b' : '#14b87a', fontWeight: 800 }}>{commerce?.fulfillment?.emAtencao || 0} em atenção</span><small style={styles.sub}>Separação, retirada, entrega e tracking</small></div>
            <div style={styles.readinessItem}><strong>Pagamentos</strong><span style={{ color: commerce?.pagamentos?.contasProntas ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{commerce?.pagamentos?.contasProntas || 0} conta(s) pronta(s)</span><small style={styles.sub}>{commerce?.pagamentos?.aguardando || 0} pagamento(s) aguardando</small></div>
            <div style={styles.readinessItem}><strong>Entrega e retirada</strong><span style={{ color: commerce?.frete?.metodosAtivos ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{commerce?.frete?.metodosAtivos || 0} método(s) ativo(s)</span><small style={styles.sub}>{commerce?.frete?.retiradaAtiva ? 'Retirada ativa' : `${commerce?.frete?.contasProntas || 0} conta(s) logística(s) pronta(s)`}</small></div>
            <div style={styles.readinessItem}><strong>Endereço público</strong><span style={{ color: commerce?.urlPublica ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{commerce?.alias?.alias || commerce?.dominios?.principal || 'Pendente'}</span><small style={styles.sub}>{commerce?.dominios?.verificados || 0} domínio(s) verificado(s)</small></div>
            <div style={styles.readinessItem}><strong>Saúde do canal</strong><span style={{ color: commerce?.saude?.banco === 'healthy' && !commerce?.saude?.webhooksComFalha ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{commerce?.saude?.banco === 'healthy' ? 'Core acessível' : 'Core indisponível'}</span><small style={styles.sub}>{commerce?.saude?.webhooksComFalha || 0} webhook(s) com falha</small></div>
          </div>
          <div style={styles.metricLine}><span>Fonte de verdade digital</span><strong>Commerce Core PostgreSQL</strong></div>
          <div style={styles.metricLine}><span>Estoque da revenda presencial compartilhado</span><strong>Não</strong></div>
          {commerce?.prontidao?.bloqueadores?.length > 0 && <div style={{ ...styles.notice, borderColor: '#f59e0b' }}><strong>Para ativar o canal</strong><div style={{ ...styles.sub, marginTop: 6 }}>{commerce.prontidao.bloqueadores.map((item) => item.label).join(' · ')}</div></div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={styles.primary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.admin || '/admin/ecommerce')}>Abrir Commerce</button>
            <button type="button" style={styles.secondary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.catalogo || '/admin/ecommerce?tab=catalog')}>Catálogo</button>
            <button type="button" style={styles.secondary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.estoque || '/admin/ecommerce?tab=inventory')}>Estoque</button>
            <button type="button" style={styles.secondary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.pedidos || '/admin/ecommerce?tab=orders')}>Pedidos</button>
            <button type="button" style={styles.secondary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.pagamentos || '/admin/ecommerce?tab=payments')}>Pagamentos</button>
            <button type="button" style={styles.secondary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.frete || '/admin/ecommerce?tab=shipping')}>Entrega</button>
            <button type="button" style={styles.secondary} disabled={!commerceDisponivel} onClick={() => navigate(commerce?.links?.dominios || '/admin/ecommerce?tab=domains')}>Domínios</button>
            {commerce?.urlPublica && <a href={commerce.urlPublica} target="_blank" rel="noreferrer" style={{ ...styles.secondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Abrir vitrine</a>}
          </div>
          <p style={styles.sub}>A operação presencial continua na Barbearia ERP. O canal digital usa catálogo, preço, estoque, pedido e fulfillment próprios do Commerce; nenhuma sincronização automática ou baixa dupla é executada.</p>
        </div>
      </Card>
      <Card style={{ padding: 18 }}>
        <h2 style={styles.h2}>Ativações governadas</h2>
        <p style={styles.sub}>O WhatsApp depende de provedor e credenciais reais no ambiente do servidor. O assistente já opera em modo local somente leitura; um modelo externo é opcional. O Commerce informa os bloqueadores reais de catálogo, estoque, entrega e pagamento sem criar dados ou credenciais.</p>
        <div style={styles.readinessGrid}>
          <div style={styles.readinessItem}><strong>WhatsApp</strong><span style={{ color: whatsapp?.envioManualDisponivel ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{whatsapp?.envioManualDisponivel ? 'Envio manual ativo' : 'Provedor pendente'}</span><small style={styles.sub}>Toda comunicação externa depende de consentimento e confirmação.</small></div>
          <div style={styles.readinessItem}><strong>Assistente</strong><span style={{ color: iaDisponivel ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{ia?.configurada ? 'Provedor externo ativo' : iaDisponivel ? 'Modo local ativo' : 'Indisponível'}</span><small style={styles.sub}>Somente leitura; nenhuma reserva, cobrança ou alteração automática.</small></div>
          <div style={styles.readinessItem}><strong>Commerce</strong><span style={{ color: commerce?.prontidao?.pronto ? '#14b87a' : '#f59e0b', fontWeight: 800 }}>{commerce?.prontidao?.pronto ? 'Pronto para operar' : `${prontidaoCommerce}% configurado`}</span><small style={styles.sub}>{commerce?.prontidao?.bloqueadores?.length || 0} bloqueador(es) obrigatório(s).</small></div>
          <div style={styles.readinessItem}><strong>Auditoria e privacidade</strong><span style={{ color: '#14b87a', fontWeight: 800 }}>Ativas</span><small style={styles.sub}>Segredos não são exibidos e as ações críticas permanecem confirmadas.</small></div>
        </div>
      </Card>
    </div>
  }

  function renderConteudo() {
    if (tab === 'Visão geral') return renderVisaoGeral()
    if (tab === 'Agenda') return renderAgenda()
    if (tab === 'Atendimento') return renderAtendimento()
    if (tab === 'Caixa e fechamento') return renderOperacao()
    if (tab === 'Clientes') return renderClientes()
    if (tab === 'Profissionais') return renderProfissionais()
    if (tab === 'Serviços') return renderServicos()
    if (tab === 'Comissões') return renderComissoes()
    if (tab === 'Fila e bloqueios') return renderFilaBloqueios()
    if (tab === 'Planos e assinaturas') return renderPlanosAssinaturas()
    if (tab === 'Fidelidade') return renderFidelidade()
    if (tab === 'Estoque de revenda') return renderEstoqueRevenda()
    if (tab === 'Vendas de revenda') return renderVendasRevenda()
    if (tab === 'Relatórios') return renderRelatorios()
    if (tab === 'Integrações') return renderIntegracoes()
    if (tab === 'Retorno previsto') return <RetornosPanel />
    if (tab === 'Lista de espera') return <ListaEsperaPanel />
    if (tab === 'Indicações') return <IndicacoesPanel clientes={clientes} />
    if (tab === 'Saúde do clube') return <ClubeSaudePanel />
    if (tab === 'Ocupação e metas') return <OcupacaoMetasPanel />
    if (tab === 'Avaliações (NPS)') return <NpsPanel key={`${empresaAtiva?.id || ''}:${lojaAtiva?.id || ''}`} />
    if (tab === 'Origem dos clientes') return <CanaisPanel />
    if (tab === 'Cobranças e cashback') return <CobrancasPanel />
    if (tab === 'Receita da IA') return <ReceitaIaPanel />
    if (tab === 'Resumo diário') return <ResumoDiarioPanel />
    if (tab === 'Vale-presente') return <ValesPanel />
    if (tab === 'Unidades') return <UnidadesPanel lojas={lojasAcessiveis || []} />
    return renderConfiguracao()
  }

  return <div style={{ padding: '24px clamp(16px, 3vw, 36px)', maxWidth: 1440, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
      <div><div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Dino · ERP operacional · empresa ativa</div><h1 style={{ margin: '7px 0 5px', fontSize: 'clamp(25px, 4vw, 34px)', fontFamily: 'var(--font-display)' }}>{configuracao?.nomePublico || 'Dino'} · Barbearia & Salão</h1><p style={{ margin: 0, color: 'var(--muted)', maxWidth: 720 }}>A operação da unidade em um fluxo único: agenda, atendimento, relacionamento, catálogo e gestão.</p></div><div style={styles.headerActions}><div style={styles.globalSearch}><input aria-label="Buscar na Barbearia" aria-expanded={Boolean(buscaGlobal.trim())} aria-controls="barbearia-global-search-results" value={buscaGlobal} onChange={(event) => setBuscaGlobal(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setBuscaGlobal(''); if (event.key === 'Enter' && resultadosBuscaGlobal[0]) abrirResultadoBusca(resultadosBuscaGlobal[0]) }} placeholder="Buscar cliente, serviço ou agenda…" style={{ ...inputStyle, paddingRight: 40 }} /><span aria-hidden="true" style={styles.searchIcon}>⌕</span>{buscaGlobal.trim() && <div id="barbearia-global-search-results" role="listbox" aria-label="Resultados da busca" style={styles.globalSearchResults}>{resultadosBuscaGlobal.length === 0 ? <div style={styles.globalSearchEmpty}>Nenhum registro encontrado no overview carregado.</div> : resultadosBuscaGlobal.map((resultado) => <button key={resultado.id} type="button" role="option" style={styles.globalSearchItem} onClick={() => abrirResultadoBusca(resultado)}><span><strong>{resultado.nome}</strong><small>{resultado.tipo} · {resultado.meta}</small></span><span aria-hidden="true">›</span></button>)}</div>}</div><button type="button" style={styles.secondary} onClick={carregar}>Atualizar</button><button type="button" style={styles.primary} onClick={() => navegarParaTab('Atendimento')}>Atender agora</button><Link to={`/barbeiro/${encodeURIComponent(formConfig.slugPublico || "dino")}`} style={{ ...styles.secondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} title="Agenda do dia de cada profissional no celular (instalável)">App do barbeiro</Link>{tab === 'Agenda' && <button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>+ Agendamento</button>}</div>
    </header>
    <div style={styles.contextBar} aria-label="Contexto operacional"><div style={styles.contextBarItem}><span>Área ativa</span><strong>{areaAtual.label}</strong></div><div style={styles.contextBarItem}><span>Unidade</span><strong>{unidadeLabel}</strong></div><div style={styles.contextBarItem}><span>Data operacional</span><strong>{fmtDateOnly(dataSelecionada)}</strong></div><div style={styles.contextBarItem}><span>Estado</span><strong>{loading ? 'Atualizando…' : erro ? 'Revisar dados' : 'Dados sincronizados'}</strong></div></div>
    <nav aria-label="Áreas da Barbearia" style={styles.areaNav}>
      {AREAS.map((area) => <button key={area.id} type="button" aria-current={area.id === areaAtual.id ? 'page' : undefined} onClick={() => navegarParaTab(area.tabs[0])} style={{ ...styles.areaNavItem, ...(area.id === areaAtual.id ? styles.areaNavItemActive : {}) }}><strong>{area.label}</strong><small>{area.short}</small></button>)}
    </nav>
    <nav aria-label={`Seções de ${areaAtual.label}`} style={styles.tabNav}>
      {areaAtual.tabs.map((nome) => <button key={nome} type="button" title={TAB_DESCRICAO[nome]} aria-current={tab === nome ? 'page' : undefined} onClick={() => navegarParaTab(nome)} style={{ ...styles.tabNavItem, ...(tab === nome ? styles.tabNavItemActive : {}) }}>{nome}</button>)}
    </nav>
    {erro && <Card style={{ padding: 16, marginBottom: 18, borderColor: '#e05c5c' }}><strong role="status" aria-live="polite">Atenção no carregamento</strong><div style={{ color: 'var(--muted)', marginTop: 5 }}>{erro}</div></Card>}
    {loading ? <Card style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }} role="status" aria-live="polite" aria-busy="true">Carregando dados da empresa ativa…</Card> : renderConteudo()}
    {renderModal()}
  </div>
}

const styles = {
  primary: { border: 0, borderRadius: 9, padding: '10px 14px', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  secondary: { border: '1px solid var(--line)', borderRadius: 9, padding: '10px 14px', background: 'transparent', color: 'var(--fg)', fontWeight: 700, cursor: 'pointer' },
  small: { border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', background: 'var(--card2)', color: 'var(--fg)', fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  iconButton: { width: 32, height: 32, border: '1px solid var(--line)', borderRadius: 8, background: 'transparent', color: 'var(--fg)', fontSize: 21, lineHeight: 1, cursor: 'pointer' },
  tableHead: { background: 'var(--card2)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' },
  th: { padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { padding: '13px 14px', verticalAlign: 'top' },
  sub: { color: 'var(--muted)', fontSize: 12, marginTop: 4 },
  empty: { padding: 42, textAlign: 'center', color: 'var(--muted)' },
  h2: { margin: 0, fontSize: 18 },
  sectionTitle: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' },
  headerActions: { display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  globalSearch: { position: 'relative', width: 'min(360px, 100%)', minWidth: 220 },
  searchIcon: { position: 'absolute', right: 12, top: 9, color: 'var(--muted)', fontSize: 20, lineHeight: 1, pointerEvents: 'none' },
  globalSearchResults: { position: 'absolute', zIndex: 40, top: 'calc(100% + 6px)', left: 0, right: 0, display: 'grid', gap: 4, padding: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 11, boxShadow: '0 16px 32px rgba(0,0,0,.18)' },
  globalSearchItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', padding: '9px 10px', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--fg)', textAlign: 'left', font: 'inherit', cursor: 'pointer' },
  globalSearchEmpty: { padding: '10px 9px', color: 'var(--muted)', fontSize: 12 },
  toolbar: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' },
  agendaToolbar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12, alignItems: 'end' },
  agendaMeta: { display: 'grid', gap: 3, alignContent: 'end', padding: '0 4px 2px', color: 'var(--muted)', fontSize: 12 },
  viewToggle: { display: 'grid', gap: 5, alignContent: 'end', color: 'var(--muted)', fontSize: 11, fontWeight: 800 },
  viewToggleButton: { border: '1px solid var(--line)', padding: '8px 10px', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', font: 'inherit', fontSize: 12 },
  viewToggleButtonActive: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  agendaSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 1, padding: 1, background: 'var(--line)', overflow: 'hidden' },
  agendaSummaryItem: { display: 'grid', gap: 3, padding: '13px 14px', background: 'var(--card)' },
  teamSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 1, padding: 1, background: 'var(--line)', overflow: 'hidden' },
  teamSummaryItem: { display: 'grid', gap: 3, padding: '13px 14px', background: 'var(--card)' },
  kicker: { color: 'var(--accent)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' },
  integrationGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 },
  serviceSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 10, marginTop: 18 },
  serviceSummaryItem: { display: 'grid', gap: 4, padding: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10 },
  serviceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 },
  serviceCardTop: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  serviceCategory: { display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: 'color-mix(in srgb, #8b5cf6 14%, var(--card))', color: '#8b5cf6', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' },
  serviceFacts: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: 'var(--muted)', fontSize: 12 },
  integrationCard: { display: 'grid', gap: 12, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 },
  integrationHeading: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  integrationIcon: { width: 38, height: 38, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 900, flexShrink: 0 },
  detailHero: { display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, background: 'var(--card)', flexWrap: 'wrap' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 12 },
  aiResponse: { marginTop: 6, padding: 14, background: 'color-mix(in srgb, #6d5dfc 8%, var(--card))', border: '1px solid color-mix(in srgb, #6d5dfc 35%, var(--line))', borderRadius: 10 },
  notice: { padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card2)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: 14 },
  comandaSummary: { display: 'grid', gap: 3, minWidth: 96, padding: '10px 13px', borderRadius: 10, background: 'var(--card2)', textAlign: 'center' },
  comandaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 9 },
  comandaCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--fg)', textAlign: 'left', font: 'inherit', cursor: 'pointer' },
  comandaMetrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100px, 100%), 1fr))', gap: 1, padding: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' },
  comandaItemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)' },
  paymentPanel: { padding: 16, borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--line))', background: 'color-mix(in srgb, var(--accent) 6%, var(--card))' },
  twoColumns: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 16 },
  listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' },
  feedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' },
  metricLine: { display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)', color: 'var(--muted)' },
  tableActions: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 },
  inlineEmpty: { display: 'grid', gap: 4, padding: 16, borderRadius: 10, background: 'var(--bg)', color: 'var(--muted)' },
  queueRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' },
  actionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--fg)', textAlign: 'left', font: 'inherit', cursor: 'pointer' },
  actionRowAttention: { borderColor: 'color-mix(in srgb, #f59e0b 45%, var(--line))', background: 'color-mix(in srgb, #f59e0b 7%, var(--bg))' },
  attentionPanel: { padding: 18, borderColor: 'color-mix(in srgb, #f59e0b 38%, var(--line))', background: 'color-mix(in srgb, #f59e0b 5%, var(--card))' },
  alertList: { display: 'grid', gap: 7 },
  alertRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid color-mix(in srgb, #f59e0b 18%, var(--line))' },
  readinessGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 },
  readinessItem: { display: 'grid', gap: 7, padding: 14, background: 'var(--bg)', borderRadius: 10 },
  attendanceCard: { display: 'grid', gap: 4, width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid var(--line)', borderLeft: '4px solid', borderRadius: 10, background: 'var(--bg)', color: 'var(--fg)', textAlign: 'left', font: 'inherit', cursor: 'pointer', transition: 'transform 160ms ease-out, box-shadow 160ms ease-out' },
  attendanceMeta: { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 11 },
  avatar: { width: 46, height: 46, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 8, marginTop: 18 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 14 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  contextBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 1, padding: 1, marginBottom: 12, background: 'var(--line)', borderRadius: 12, overflow: 'hidden' },
  contextBarItem: { display: 'grid', gap: 4, padding: '11px 13px', background: 'var(--card)' },
  areaNav: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 8, marginBottom: 10 },
  areaNavItem: { display: 'grid', gap: 3, textAlign: 'left', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 13px', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', font: 'inherit', transition: 'transform 160ms ease-out, border-color 160ms ease-out, background 160ms ease-out' },
  areaNavItemActive: { background: 'color-mix(in srgb, var(--accent) 10%, var(--card))', borderColor: 'var(--accent)', color: 'var(--fg)' },
  tabNav: { display: 'flex', gap: 6, overflowX: 'auto', padding: 4, marginBottom: 22, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, scrollbarWidth: 'thin' },
  tabNavItem: { flex: '0 0 auto', border: 0, borderRadius: 8, padding: '8px 11px', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap' },
  tabNavItemActive: { background: 'var(--accent)', color: '#fff', fontWeight: 800 },
  todayHero: { padding: 22, background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, var(--card)), var(--card))', borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--line))', boxShadow: '0 12px 30px rgba(18, 39, 63, .07)' },
  todayHeroTop: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' },
  todayStatus: { display: 'grid', gap: 5, minWidth: 150, padding: 13, borderRadius: 11, background: 'color-mix(in srgb, var(--card) 84%, transparent)', border: '1px solid var(--line)' },
  compactDate: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--fg)', padding: '7px 8px', font: 'inherit' },
  quickActions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '1px solid color-mix(in srgb, var(--accent) 22%, var(--line))' },
  contextPill: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 12%, var(--card))', color: 'var(--accent)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' },
}

