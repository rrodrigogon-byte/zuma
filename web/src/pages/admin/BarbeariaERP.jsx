import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtDate, fmtDateOnly, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import BarbeariaAgendaBoard, { agendaBoardColumns } from './BarbeariaAgendaBoard'

const TABS = [
  ['Visão geral', 'Resumo da operação'],
  ['Agenda', 'Reservas e horários'],
  ['Atendimento', 'Fila e status'],
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
]

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
  return <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, width: '100%', maxWidth: wide ? 760 : 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 22px 80px rgba(0,0,0,.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
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
  const [tab, setTab] = useState('Visão geral')
  const [dataSelecionada, setDataSelecionada] = useState(hojeLocal)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [profissionalFiltro, setProfissionalFiltro] = useState('')
  const [busca, setBusca] = useState('')
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
  const [fidelidade, setFidelidade] = useState({ regra: {}, membros: [] })
  const [formFidelidade, setFormFidelidade] = useState({ pontosPorReal: 1, valorPonto: 0.01, ativa: true })
  const [clienteFidelidadeId, setClienteFidelidadeId] = useState('')
  const [relatorio, setRelatorio] = useState(null)
  const [comissoes, setComissoes] = useState(null)
  const [integracoes, setIntegracoes] = useState(null)
  const [assistenteResposta, setAssistenteResposta] = useState(null)
  const [assistentePergunta, setAssistentePergunta] = useState('')
  const [consultandoAssistente, setConsultandoAssistente] = useState(false)
  const [produtosRevenda, setProdutosRevenda] = useState([])
  const [vendasRevenda, setVendasRevenda] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [formProf, setFormProf] = useState({ nome: '', telefone: '', email: '', especialidade: 'Barbeiro', tipo: 'parceiro', percentualComissao: 50, percentualComissaoProduto: 30, horarioInicio: '08:00', horarioFim: '18:00', diasTrabalho: [1, 2, 3, 4, 5, 6] })
  const [formServico, setFormServico] = useState({ nome: '', descricao: '', categoria: 'Geral', duracaoMinutos: 30, preco: '', permiteAgendamentoOnline: true })
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '', email: '', observacao: '' })
  const [formAgenda, setFormAgenda] = useState({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: '', servicoId: '', hora: '10:00', observacoes: '' })
  const [formRecebimento, setFormRecebimento] = useState({ meioPagamento: 'pix', valorRecebido: '' })
  const [formConfig, setFormConfig] = useState({})
  const [formFila, setFormFila] = useState({ clienteId: '', clienteNome: '', clienteTelefone: '', servicoId: '', preferenciaProfissionalId: '', previsaoMinutos: 30, observacoes: '' })
  const [formBloqueio, setFormBloqueio] = useState({ titulo: '', motivo: '', inicioHora: '08:00', fimHora: '20:00', profissionalId: '' })
  const [formPlano, setFormPlano] = useState({ nome: '', descricao: '', ciclo: 'mensal', preco: '', sessoesIncluidas: 4, validadeDias: 30, servicosIds: [] })
  const [formAssinatura, setFormAssinatura] = useState({ clienteId: '', clienteNome: '', planoId: '', observacoes: '' })
  const [formProdutoRevenda, setFormProdutoRevenda] = useState({ nome: '', sku: '', categoria: 'Revenda', unidade: 'un', precoVenda: '', custoUnitario: '', estoqueAtual: 0, estoqueMinimo: 0 })
  const [formVendaRevenda, setFormVendaRevenda] = useState({ clienteId: '', clienteNome: '', observacao: '', produtoId: '', quantidade: 1 })
  const [formWhatsApp, setFormWhatsApp] = useState({ telefone: '', mensagem: '' })
  const [itensVendaRevenda, setItensVendaRevenda] = useState([])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const query = new URLSearchParams({ data: dataSelecionada })
      if (statusFiltro) query.set('status', statusFiltro)
      if (profissionalFiltro) query.set('profissionalId', profissionalFiltro)
      const [dashData, agendaData, profData, servData, cliData, configData, filaData, bloqueiosData, planosData, assinaturasData, fidelidadeData, configUnidadeData, relatorioData, comissoesData, produtosData, vendasData, integracoesData] = await Promise.all([
        api.get(`/api/admin/barbearia/dashboard?data=${encodeURIComponent(dataSelecionada)}`),
        api.get(`/api/admin/barbearia/agenda?${query.toString()}`),
        api.get('/api/admin/barbearia/profissionais?incluirInativos=true'),
        api.get('/api/admin/barbearia/servicos?incluirInativos=true'),
        api.get('/api/admin/barbearia/clientes'),
        api.get('/api/admin/barbearia/configuracoes'),
        api.get(`/api/admin/barbearia/fila?data=${encodeURIComponent(dataSelecionada)}`),
        api.get(`/api/admin/barbearia/bloqueios?data=${encodeURIComponent(dataSelecionada)}`),
        api.get('/api/admin/barbearia/planos'),
        api.get('/api/admin/barbearia/assinaturas'),
        api.get('/api/admin/barbearia/fidelidade'),
        api.get('/api/admin/barbearia/configuracoes/unidade-ativa').catch(() => null),
        api.get(`/api/admin/barbearia/relatorios/operacional?data=${encodeURIComponent(dataSelecionada)}`),
        api.get(`/api/admin/barbearia/comissoes?data=${encodeURIComponent(dataSelecionada)}`),
        api.get('/api/admin/barbearia/estoque-revenda'),
        api.get('/api/admin/barbearia/vendas-revenda'),
        api.get('/api/admin/barbearia/integracoes').catch(() => null),
      ])
      setDashboard(dashData)
      setAgendamentos(Array.isArray(agendaData?.agendamentos) ? agendaData.agendamentos : [])
      setProfissionais(Array.isArray(profData?.profissionais) ? profData.profissionais : [])
      setServicos(Array.isArray(servData?.servicos) ? servData.servicos : [])
      setClientes(Array.isArray(cliData?.clientes) ? cliData.clientes : [])
      setConfiguracao(configData?.configuracao || null)
      setFormConfig(configData?.configuracao || {})
      setFila(Array.isArray(filaData?.fila) ? filaData.fila : [])
      setBloqueios(Array.isArray(bloqueiosData?.bloqueios) ? bloqueiosData.bloqueios : [])
      setPlanos(Array.isArray(planosData?.planos) ? planosData.planos : [])
      setAssinaturas(Array.isArray(assinaturasData?.assinaturas) ? assinaturasData.assinaturas : [])
      setFidelidade(fidelidadeData?.fidelidade || { regra: {}, membros: [] })
      setFormFidelidade(fidelidadeData?.fidelidade?.regra || { pontosPorReal: 1, valorPonto: 0.01, ativa: true })
      setConfiguracaoUnidade(configUnidadeData || null)
      setRelatorio(relatorioData || null)
      setComissoes(comissoesData?.comissoes || null)
      setProdutosRevenda(Array.isArray(produtosData?.produtos) ? produtosData.produtos : [])
      setVendasRevenda(Array.isArray(vendasData?.vendas) ? vendasData.vendas : [])
      setIntegracoes(integracoesData || null)
    } catch (error) {
      setErro(error.message || 'Não foi possível carregar o módulo de Barbearia.')
    } finally {
      setLoading(false)
    }
  }, [dataSelecionada, profissionalFiltro, statusFiltro])

  useEffect(() => { carregar() }, [carregar])

  const indicadores = dashboard?.indicadores || {}
  const listaBuscaClientes = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return clientes.filter((cliente) => !termo || [cliente.nome, cliente.telefone, cliente.email].some((item) => String(item || '').toLowerCase().includes(termo)))
  }, [clientes, busca])
  const listaBuscaProfissionais = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return profissionais.filter((profissional) => !termo || [profissional.nome, profissional.especialidade, profissional.email].some((item) => String(item || '').toLowerCase().includes(termo)))
  }, [profissionais, busca])
  const listaBuscaServicos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return servicos.filter((servico) => !termo || [servico.nome, servico.categoria, servico.descricao].some((item) => String(item || '').toLowerCase().includes(termo)))
  }, [servicos, busca])

  async function executar(operacao, sucesso) {
    setSalvando(true)
    try {
      await operacao()
      toast(sucesso, 'success')
      setModal(null)
      await carregar()
    } catch (error) {
      toast(error.message || 'Operação não concluída.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  function abrirNovoAgendamento() {
    setFormAgenda({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: profissionalFiltro || '', servicoId: servicos[0]?.id || '', hora: '10:00', observacoes: '' })
    setModal('agenda')
  }

  function abrirRecebimento(agendamento) {
    setFormRecebimento({ meioPagamento: 'pix', valorRecebido: String(agendamento.valor || '') })
    setModal({ tipo: 'recebimento', agendamento })
  }

  async function mudarStatus(agendamento, novoStatus) {
    const label = STATUS[novoStatus]?.label || novoStatus
    if (novoStatus === 'cancelado' && !window.confirm(`Cancelar o atendimento de ${agendamento.clienteNome || agendamento.cliente_nome || 'cliente'}?`)) return
    await executar(
      () => api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, { status: novoStatus, registrarFinanceiro: false }),
      `Atendimento marcado como ${label.toLowerCase()}.`,
    )
  }

  async function concluirEReceber() {
    const agendamento = modal?.agendamento
    if (!agendamento) return
    const valor = Number(formRecebimento.valorRecebido)
    if (!formRecebimento.meioPagamento || !Number.isFinite(valor) || valor <= 0) {
      toast('Informe valor recebido e meio de pagamento.', 'error')
      return
    }
    await executar(
      () => api.patch(`/api/admin/barbearia/agenda/${agendamento.id}/status`, { status: 'concluido', registrarFinanceiro: true, confirmado: true, meioPagamento: formRecebimento.meioPagamento, valorRecebido: valor }),
      'Atendimento concluído e recebimento registrado no financeiro central.',
    )
  }

  async function salvarAgenda(event) {
    event.preventDefault()
    const cliente = clientes.find((item) => item.id === formAgenda.clienteId)
    const payload = {
      clienteId: formAgenda.clienteId,
      clienteNome: cliente?.nome || formAgenda.clienteNome,
      clienteTelefone: cliente?.telefone || formAgenda.clienteTelefone,
      profissionalId: formAgenda.profissionalId,
      servicoId: formAgenda.servicoId,
      dataHora: new Date(`${dataSelecionada}T${formAgenda.hora}:00`).toISOString(),
      dataAgenda: dataSelecionada,
      observacoes: formAgenda.observacoes,
      origem: 'admin',
    }
    await executar(() => api.post('/api/admin/barbearia/agenda', payload), 'Agendamento criado.')
  }

  async function salvarProfissional(event) {
    event.preventDefault()
    await executar(() => api.post('/api/admin/barbearia/profissionais', formProf), 'Profissional cadastrado.')
  }

  async function alternarProfissional(profissional) {
    const ativo = profissional.ativo === false
    await executar(() => api.patch(`/api/admin/barbearia/profissionais/${profissional.id}`, { ...profissional, ativo }), ativo ? 'Profissional reativado.' : 'Profissional desativado.')
  }

  async function salvarServico(event) {
    event.preventDefault()
    await executar(() => api.post('/api/admin/barbearia/servicos', { ...formServico, preco: Number(formServico.preco), permiteAgendamentoOnline: Boolean(formServico.permiteAgendamentoOnline) }), 'Serviço cadastrado.')
  }

  async function alternarServico(servico) {
    const ativo = servico.ativo === false
    await executar(() => api.patch(`/api/admin/barbearia/servicos/${servico.id}`, { ...servico, ativo }), ativo ? 'Serviço reativado.' : 'Serviço desativado.')
  }

  async function salvarCliente(event) {
    event.preventDefault()
    await executar(() => api.post('/api/admin/barbearia/clientes', formCliente), 'Cliente cadastrado no CRM.')
  }

  async function salvarConfiguracao(event) {
    event.preventDefault()
    await executar(() => api.patch('/api/admin/barbearia/configuracoes', formConfig), 'Configurações atualizadas.')
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

  async function alterarFila(item, status) {
    const mesaOuPosicao = status === 'chamado' ? window.prompt(`Posição ou cadeira para ${item.senha}:`, item.mesaOuPosicao || '') : item.mesaOuPosicao
    if (status === 'chamado' && mesaOuPosicao === null) return
    await executar(() => api.patch(`/api/admin/barbearia/fila/${item.id}/status`, { status, mesaOuPosicao: mesaOuPosicao || '' }), `Fila atualizada para ${status}.`)
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
    await executar(() => api.post('/api/admin/barbearia/fidelidade/membros', { clienteId: cliente.id }), 'Cliente aderiu ao programa de fidelidade.')
  }

  async function creditarFidelidade(membro) {
    const valor = Number(window.prompt(`Valor elegível para pontuação de ${membro.nome} (R$):`, ''))
    if (!Number.isFinite(valor) || valor <= 0) return
    if (!window.confirm(`Confirmar crédito de pontos com base em R$ ${valor.toFixed(2)} para ${membro.nome}?`)) return
    await executar(() => api.post('/api/admin/barbearia/fidelidade/creditar', { clienteId: membro.clienteId, valor, origem: 'barbearia_atendimento', confirmado: true }), 'Pontos creditados.')
  }

  async function salvarProdutoRevenda(event) {
    event.preventDefault()
    await executar(() => api.post('/api/admin/barbearia/estoque-revenda', { ...formProdutoRevenda, precoVenda: Number(formProdutoRevenda.precoVenda), custoUnitario: Number(formProdutoRevenda.custoUnitario || 0), estoqueAtual: Number(formProdutoRevenda.estoqueAtual || 0), estoqueMinimo: Number(formProdutoRevenda.estoqueMinimo || 0) }), 'Produto de revenda cadastrado.')
  }

  async function movimentarProdutoRevenda(produto, tipo) {
    const quantidade = Number(window.prompt(`Quantidade para ${tipo === 'entrada' ? 'entrada' : tipo === 'saida_manual' ? 'saída manual' : 'ajuste'} de ${produto.nome}:`, '1'))
    if (!Number.isInteger(quantidade) || quantidade <= 0) return
    if (!window.confirm(`Confirmar ${tipo === 'entrada' ? 'entrada' : tipo === 'saida_manual' ? 'saída manual' : 'ajuste'} de ${quantidade} ${produto.unidade || 'un'} em ${produto.nome}?`)) return
    await executar(() => api.post(`/api/admin/barbearia/estoque-revenda/${produto.id}/movimentos`, { tipo, quantidade, confirmado: true, observacao: 'Movimento manual no módulo Barbearia.' }), 'Movimento de estoque registrado.')
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

  async function enviarWhatsApp(event) {
    event.preventDefault()
    if (!formWhatsApp.telefone.trim() || !formWhatsApp.mensagem.trim()) return
    if (!window.confirm('Confirmar o envio desta mensagem pelo WhatsApp? O envio será feito agora para o telefone informado.')) return
    await executar(() => api.post('/api/admin/barbearia/whatsapp/enviar', { ...formWhatsApp, confirmado: true }), 'Mensagem enviada pelo WhatsApp.')
    setFormWhatsApp({ telefone: '', mensagem: '' })
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

  async function confirmarVendaRevenda(venda) {
    if (!window.confirm(`Confirmar recebimento manual de ${moeda(venda.total)} para a venda ${venda.id}? Esta ação baixa estoque e registra receita no financeiro.`)) return
    const meioPagamento = window.prompt('Meio de pagamento confirmado (pix, dinheiro, debito, credito ou transferencia):', 'pix')
    if (!meioPagamento) return
    await executar(() => api.post(`/api/admin/barbearia/vendas-revenda/${venda.id}/confirmar-pagamento`, { confirmadoPagamento: true, meioPagamento, valorRecebido: venda.total }), 'Venda confirmada, estoque baixado e receita registrada.')
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
    return <div style={{ display: 'grid', gap: 20 }}>
      <div style={styles.kpiGrid}>
        <Kpi label="Atendimentos hoje" value={indicadores.agendamentosHoje || 0} note={`${indicadores.confirmadosHoje || 0} confirmados`} />
        <Kpi label="Em atendimento" value={indicadores.emAtendimento || 0} note="Fila operacional atual" color="#f59e0b" />
        <Kpi label="Concluídos hoje" value={indicadores.concluidosHoje || 0} note={moeda(indicadores.faturamentoHoje)} color="#14b87a" />
        <Kpi label="Clientes no CRM" value={indicadores.clientesAtivos || 0} note={`${indicadores.profissionaisAtivos || 0} profissionais ativos`} color="#8b5cf6" />
        <Kpi label="Fila ativa" value={indicadores.filaAguardando || 0} note="Aguardando ou chamados" color="#4a9eff" />
        <Kpi label="Bloqueios hoje" value={indicadores.bloqueiosHoje || 0} note={`${indicadores.assinaturasAtivas || 0} assinaturas ativas`} color="#f59e0b" />
        <Kpi label="Revendas pagas" value={indicadores.vendasRevendaHoje || 0} note={moeda(indicadores.receitaRevendaHoje)} color="#14b87a" />
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
      <Card style={{ padding: 20 }}>
        <div style={styles.sectionTitle}><div><h2 style={styles.h2}>Prontidão operacional</h2><p style={styles.sub}>O módulo reutiliza cadastros e livros existentes; nenhuma venda, reserva ou pagamento é simulado.</p></div></div>
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
        <div style={styles.agendaToolbar}><Field label="Data"><input type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} style={inputStyle} /></Field><Field label="Status"><select value={statusFiltro} onChange={(event) => setStatusFiltro(event.target.value)} style={inputStyle}><option value="">Todos os status</option>{Object.entries(STATUS).map(([valor, item]) => <option key={valor} value={valor}>{item.label}</option>)}</select></Field><Field label="Atendente"><select value={profissionalFiltro} onChange={(event) => setProfissionalFiltro(event.target.value)} style={inputStyle}><option value="">Toda a equipe</option>{profissionais.filter((item) => item.ativo !== false).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><div style={styles.agendaMeta}><strong>{atendentesAtivos.length}</strong><span>atendentes ativos</span><small>{unidade ? `${unidade.horarioAbertura}–${unidade.horarioFechamento}` : 'Horário corporativo'} · {agendamentos.length} registros no dia</small></div></div>
      </Card>
      <BarbeariaAgendaBoard data={dataSelecionada} agendamentos={agendamentos} profissionais={atendentesAtivos} bloqueios={bloqueios} onDateChange={(novaData) => { setStatusFiltro(''); setDataSelecionada(novaData) }} onNew={abrirNovoAgendamento} onOpenAppointment={(item) => setModal({ tipo: 'detalheAgenda', agendamento: item })} />
      <div><div style={{ ...styles.sectionTitle, marginBottom: 10 }}><div><h2 style={styles.h2}>Lista detalhada do dia</h2><p style={styles.sub}>Use a lista para visualizar dados completos e executar transições permitidas.</p></div></div>{renderAgendaTabela()}</div>
    </div>
  }

  function renderAtendimento() {
    const colunas = ['agendado', 'confirmado', 'em_atendimento', 'concluido']
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 16 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Quadro de atendimento</h2><p style={styles.sub}>Atualize o status conforme o atendimento acontece. A baixa financeira é uma ação separada.</p></div><div style={{ display: 'flex', gap: 8, alignItems: 'end' }}><Field label="Data"><input type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} style={inputStyle} /></Field><button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>Novo atendimento</button></div></div></Card><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: 12 }}>{colunas.map((status) => <Card key={status} style={{ padding: 14, minHeight: 220 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Badge status={status} /><strong>{agendamentos.filter((item) => item.status === status).length}</strong></div><div style={{ display: 'grid', gap: 9 }}>{agendamentos.filter((item) => item.status === status).map((item) => <div key={item.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: 12 }}><strong>{horario(item.dataHora)} · {item.clienteNome || item.cliente_nome}</strong><div style={styles.sub}>{item.servicoNome || item.servico_nome}</div><div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(TRANSICOES[status] || []).slice(0, 2).map((proximo) => <button key={proximo} type="button" style={styles.small} onClick={() => mudarStatus(item, proximo)}>{STATUS[proximo]?.label}</button>)}{status === 'concluido' && !item.financeiroLancamentoId && <button type="button" style={{ ...styles.small, color: 'var(--accent)' }} onClick={() => abrirRecebimento(item)}>Receber</button>}</div></div>)}</div></Card>)}</div></div>
  }

  function renderClientes() {
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 16 }}><div style={styles.toolbar}><div style={{ flex: 1, minWidth: 230 }}><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" style={inputStyle} /></div><button type="button" style={styles.primary} onClick={() => { setFormCliente({ nome: '', telefone: '', email: '', observacao: '' }); setModal('cliente') }}>+ Novo cliente</button><a href="/admin/clientes" style={styles.secondary}>Gestão completa do CRM</a></div></Card><Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}><thead><tr style={styles.tableHead}>{['Cliente', 'Contato', 'Saldo devedor', 'Última atualização'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{listaBuscaClientes.length === 0 ? <tr><td colSpan={4} style={styles.empty}>Nenhum cliente encontrado no CRM desta empresa.</td></tr> : listaBuscaClientes.map((cliente) => <tr key={cliente.id} style={{ borderTop: '1px solid var(--line)' }}><td style={styles.td}><strong>{cliente.nome}</strong><div style={styles.sub}>{cliente.tipo === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'}</div></td><td style={styles.td}>{cliente.telefone || '—'}<div style={styles.sub}>{cliente.email || '—'}</div></td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(cliente.saldoDevedor)}</td><td style={styles.td}>{cliente.atualizadoEm ? fmtDate(cliente.atualizadoEm) : '—'}</td></tr>)}</tbody></table></Card></div>
  }

  function renderProfissionais() {
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 16 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Equipe da unidade</h2><p style={styles.sub}>Percentuais ficam no cadastro e podem alimentar a apuração, sem gerar repasse automaticamente.</p></div><button type="button" style={styles.primary} onClick={() => { setFormProf({ nome: '', telefone: '', email: '', especialidade: 'Barbeiro', tipo: 'parceiro', percentualComissao: 50, percentualComissaoProduto: 30, horarioInicio: '08:00', horarioFim: '18:00', diasTrabalho: [1, 2, 3, 4, 5, 6] }); setModal('profissional') }}>+ Novo profissional</button></div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar na equipe" style={{ ...inputStyle, marginTop: 14, maxWidth: 420 }} /></Card><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>{listaBuscaProfissionais.length === 0 ? <Card style={styles.empty}>Nenhum profissional cadastrado na empresa ativa.</Card> : listaBuscaProfissionais.map((profissional) => <Card key={profissional.id} style={{ padding: 18, opacity: profissional.ativo === false ? .62 : 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={styles.avatar}>{iniciais(profissional.nome)}</div><div style={{ minWidth: 0 }}><strong style={{ fontSize: 17 }}>{profissional.nome}</strong><div style={styles.sub}>{profissional.especialidade} · {profissional.tipo}</div></div></div><div style={styles.profileGrid}><div><small style={styles.sub}>Comissão serviço</small><strong>{profissional.percentualComissao}%</strong></div><div><small style={styles.sub}>Comissão produto</small><strong>{profissional.percentualComissaoProduto}%</strong></div><div><small style={styles.sub}>Horário</small><strong>{profissional.horarioInicio}–{profissional.horarioFim}</strong></div></div><div style={{ display: 'flex', gap: 5, marginTop: 14 }}>{DIAS.map((dia, indice) => <span key={dia} style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: (profissional.diasTrabalho || []).includes(indice) ? 'var(--accent)' : 'var(--bg)', color: (profissional.diasTrabalho || []).includes(indice) ? '#fff' : 'var(--muted)', fontSize: 10, fontWeight: 800 }}>{dia[0]}</span>)}</div><button type="button" style={{ ...styles.secondary, width: '100%', marginTop: 15 }} onClick={() => alternarProfissional(profissional)}>{profissional.ativo === false ? 'Reativar profissional' : 'Desativar profissional'}</button></Card>)}</div></div>
  }

  function renderServicos() {
    const categorias = [...new Set(listaBuscaServicos.map((servico) => servico.categoria || 'Geral'))]
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 18, background: 'linear-gradient(135deg, color-mix(in srgb, #8b5cf6 10%, var(--card)), var(--card))' }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Catálogo comercial</div><h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>Serviços da barbearia</h2><p style={styles.sub}>Veja preço, duração, categoria, descrição e disponibilidade de cada serviço. O mesmo catálogo alimenta a agenda e os planos.</p></div><button type="button" style={styles.primary} onClick={() => { setFormServico({ nome: '', descricao: '', categoria: 'Geral', duracaoMinutos: 30, preco: '', permiteAgendamentoOnline: true }); setModal('servico') }}>+ Novo serviço</button></div><div style={styles.serviceSummary}>{[['Serviços ativos', listaBuscaServicos.filter((servico) => servico.ativo !== false).length, '#14b87a'], ['Categorias', categorias.length, '#8b5cf6'], ['Agendamento online', listaBuscaServicos.filter((servico) => servico.permiteAgendamentoOnline !== false && servico.ativo !== false).length, '#4a9eff']].map(([label, value, color]) => <div key={label} style={styles.serviceSummaryItem}><strong style={{ color }}>{value}</strong><span>{label}</span></div>)}</div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, categoria ou descrição" style={{ ...inputStyle, marginTop: 16, maxWidth: 520 }} /></Card>
      {listaBuscaServicos.length === 0 ? <Card style={styles.empty}>Nenhum serviço cadastrado na empresa ativa. Cadastre o primeiro para liberar a agenda.</Card> : <div style={styles.serviceGrid}>{listaBuscaServicos.map((servico) => <Card key={servico.id} style={{ padding: 17, opacity: servico.ativo === false ? .58 : 1 }}><div style={styles.serviceCardTop}><div><span style={styles.serviceCategory}>{servico.categoria || 'Geral'}</span><h3 style={{ margin: '8px 0 4px', fontSize: 18 }}>{servico.nome}</h3></div><strong style={{ color: 'var(--accent)', fontSize: 18 }}>{moeda(servico.preco)}</strong></div><p style={{ margin: '10px 0 14px', color: 'var(--muted)', minHeight: 38, fontSize: 13 }}>{servico.descricao || 'Descrição ainda não preenchida.'}</p><div style={styles.serviceFacts}><span><strong>{servico.duracaoMinutos}</strong> min</span><span>{servico.permiteAgendamentoOnline !== false ? 'Online ativo' : 'Online desativado'}</span><Badge status={servico.ativo === false ? 'cancelado' : 'concluido'} /></div><button type="button" style={{ ...styles.secondary, width: '100%', marginTop: 15 }} onClick={() => alternarServico(servico)}>{servico.ativo === false ? 'Reativar serviço' : 'Desativar serviço'}</button></Card>)}</div>}
      <Card style={{ padding: 18 }}><h3 style={{ margin: 0, fontSize: 16 }}>Como o catálogo é utilizado</h3><div style={styles.readinessGrid}><div style={styles.readinessItem}><strong>Agenda</strong><small style={styles.sub}>Duração e preço são usados na reserva e no conflito de horários.</small></div><div style={styles.readinessItem}><strong>Atendimento</strong><small style={styles.sub}>O operador visualiza o serviço no cartão do cliente.</small></div><div style={styles.readinessItem}><strong>Planos</strong><small style={styles.sub}>Os serviços ativos podem ser associados a planos sem cobrança automática.</small></div></div></Card>
    </div>
  }

  function renderComissoes() {
    const porProfissional = comissoes?.porProfissional || []
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 18 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Comissões e rateio</h2><p style={styles.sub}>Apuração indicativa de serviços concluídos e produtos pagos em {fmtDateOnly(dataSelecionada)}. Taxas seguem a configuração do profissional. Não cria lançamento, fechamento ou pagamento de repasse.</p></div><a href="/admin/financeiro" style={styles.secondary}>Ver livro financeiro</a></div></Card><Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}><thead><tr style={styles.tableHead}>{['Profissional', 'Serviços', 'Produtos', 'Bruto serviços', 'Bruto produtos', 'Comissão serviços', 'Comissão produtos', 'Repasse indicativo'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{porProfissional.length === 0 ? <tr><td colSpan={8} style={styles.empty}>Ainda não há atendimentos concluídos ou vendas de produtos atribuídas para apuração.</td></tr> : porProfissional.map((item) => <tr key={item.profissionalId} style={{ borderTop: '1px solid var(--line)' }}><td style={styles.td}><strong>{item.profissionalNome}</strong><div style={styles.sub}>{item.percentualComissao}% serviços · {item.percentualComissaoProduto}% produtos</div></td><td style={styles.td}>{item.atendimentos}</td><td style={styles.td}>{item.vendasProdutos}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(item.brutoServicos)}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(item.brutoProdutos)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#8b5cf6' }}>{moeda(item.comissaoServicos)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#8b5cf6' }}>{moeda(item.comissaoProdutos)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#14b87a' }}>{moeda(item.repasse)}</td></tr>)}</tbody></table></Card>{(comissoes?.vendasSemProfissional || 0) > 0 && <Card style={{ padding: 18 }}><strong>Vendas sem profissional atribuído</strong><div style={styles.sub}>{comissoes.vendasSemProfissional} venda(s), total de {moeda(comissoes.brutoSemProfissional)}. Elas não entram em repasse até uma atribuição operacional explícita.</div></Card>}</div>
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
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Programa de fidelidade</h2><p style={styles.sub}>Pontos vinculados ao CRM da empresa ativa. Crédito exige ação e confirmação manual.</p></div></div><form onSubmit={(event) => { event.preventDefault(); const cliente = clientes.find((item) => item.id === clienteFidelidadeId); if (cliente) aderirFidelidade(cliente) }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}><Field label="Adicionar cliente"><select value={clienteFidelidadeId} onChange={(event) => setClienteFidelidadeId(event.target.value)} style={{ ...inputStyle, minWidth: 260 }}><option value="">Selecionar cliente do CRM</option>{disponiveis.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></Field><button type="submit" style={styles.primary} disabled={!clienteFidelidadeId || salvando}>Aderir ao programa</button></form></Card><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Regra de pontos</h2><p style={styles.sub}>A configuração não altera caixa nem financeiro.</p></div></div><form onSubmit={(event) => { event.preventDefault(); executar(() => api.patch('/api/admin/barbearia/fidelidade/regra', formFidelidade), 'Regra de fidelidade atualizada.') }} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'end' }}><Field label="Pontos por R$ 1,00"><input type="number" min="0" value={formFidelidade.pontosPorReal ?? 0} onChange={(event) => setFormFidelidade((atual) => ({ ...atual, pontosPorReal: event.target.value }))} style={{ ...inputStyle, width: 160 }} /></Field><Field label="Valor estimado do ponto"><input type="number" min="0" step="0.01" value={formFidelidade.valorPonto ?? 0} onChange={(event) => setFormFidelidade((atual) => ({ ...atual, valorPonto: event.target.value }))} style={{ ...inputStyle, width: 160 }} /></Field><label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}><input type="checkbox" checked={formFidelidade.ativa !== false} onChange={(event) => setFormFidelidade((atual) => ({ ...atual, ativa: event.target.checked }))} /> Programa ativo</label><button type="submit" style={styles.primary} disabled={salvando}>Salvar regra</button></form></Card><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Membros</h2><p style={styles.sub}>{fidelidade.membros?.length || 0} clientes aderidos.</p></div></div>{!fidelidade.membros?.length ? <div style={styles.empty}>Nenhum cliente aderiu ao programa.</div> : <div style={{ display: 'grid', gap: 8 }}>{fidelidade.membros.map((membro) => <div key={membro.id} style={styles.listRow}><div><strong>{membro.nome}</strong><div style={styles.sub}>{membro.pontos || 0} pontos · nível {membro.nivel || 'bronze'}</div></div><button type="button" style={styles.small} onClick={() => creditarFidelidade(membro)}>Creditar pontos</button></div>)}</div>}</Card></div>
  }

  function renderEstoqueRevenda() {
    const baixos = produtosRevenda.filter((produto) => produto.statusEstoque !== 'ok')
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 18 }}><div style={styles.sectionTitle}><div><h2 style={styles.h2}>Estoque de revenda</h2><p style={styles.sub}>Catálogo exclusivo da empresa ativa. Não é o estoque de cardápio e não se conecta automaticamente ao Commerce.</p></div><button type="button" style={styles.primary} onClick={() => { setFormProdutoRevenda({ nome: '', sku: '', categoria: 'Revenda', unidade: 'un', precoVenda: '', custoUnitario: '', estoqueAtual: 0, estoqueMinimo: 0 }); setModal('produtoRevenda') }}>+ Novo produto</button></div><div style={styles.kpiGrid}><Kpi label="Produtos ativos" value={produtosRevenda.filter((produto) => produto.ativo !== false).length} /><Kpi label="Abaixo do mínimo" value={baixos.length} color={baixos.length ? '#f59e0b' : '#14b87a'} /><Kpi label="Sem estoque" value={produtosRevenda.filter((produto) => produto.statusEstoque === 'sem_estoque').length} color="#e05c5c" /></div></Card><Card style={{ padding: 18, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={styles.tableHead}>{['Produto', 'Categoria', 'Preço', 'Saldo', 'Mínimo', 'Situação', 'Movimento'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{produtosRevenda.length === 0 ? <tr><td colSpan={7} style={styles.empty}>Nenhum produto de revenda cadastrado.</td></tr> : produtosRevenda.map((produto) => <tr key={produto.id} style={{ borderTop: '1px solid var(--line)', opacity: produto.ativo === false ? .58 : 1 }}><td style={styles.td}><strong>{produto.nome}</strong><div style={styles.sub}>{produto.sku || 'Sem SKU'} · {produto.unidade || 'un'}</div></td><td style={styles.td}>{produto.categoria}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(produto.precoVenda)}</td><td style={{ ...styles.td, fontWeight: 800 }}>{produto.estoqueAtual}</td><td style={styles.td}>{produto.estoqueMinimo}</td><td style={styles.td}><Badge status={produto.statusEstoque === 'ok' ? 'concluido' : produto.statusEstoque === 'baixo' ? 'chamado' : 'cancelado'} /></td><td style={styles.td}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" style={styles.small} onClick={() => movimentarProdutoRevenda(produto, 'entrada')}>Entrada</button><button type="button" style={styles.small} onClick={() => movimentarProdutoRevenda(produto, 'saida_manual')}>Saída manual</button></div></td></tr>)}</tbody></table><p style={{ ...styles.sub, marginBottom: 0 }}>A saída manual não registra venda, pagamento ou receita. Para vender, o fluxo de checkout/PDV deve ser integrado em uma etapa própria.</p></Card></div>
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
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 20, maxWidth: 760 }}><form onSubmit={salvarConfiguracao} style={{ display: 'grid', gap: 18 }}><div><h2 style={styles.h2}>Horários corporativos</h2><p style={styles.sub}>A configuração da empresa serve como padrão para unidades que não possuem uma regra própria.</p></div><div style={styles.formGrid}><Field label="Abertura"><input type="time" value={formConfig.horarioAbertura || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, horarioAbertura: event.target.value }))} style={inputStyle} /></Field><Field label="Fechamento"><input type="time" value={formConfig.horarioFechamento || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, horarioFechamento: event.target.value }))} style={inputStyle} /></Field><Field label="Intervalo entre horários (min)"><input type="number" min="5" value={formConfig.intervaloMinutos ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, intervaloMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Antecedência mínima (min)"><input type="number" min="0" value={formConfig.antecedenciaMinutos ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, antecedenciaMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Janela de reservas (dias)"><input type="number" min="1" value={formConfig.janelaReservaDias ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, janelaReservaDias: event.target.value }))} style={inputStyle} /></Field><Field label="Cancelamento sem penalidade (horas)"><input type="number" min="0" value={formConfig.politicaCancelamentoHoras ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, politicaCancelamentoHoras: event.target.value }))} style={inputStyle} /></Field><Field label="Dias de funcionamento" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setFormConfig((atual) => ({ ...atual, diasFuncionamento: diasSelecionados.includes(indice) ? diasSelecionados.filter((item) => item !== indice) : [...diasSelecionados, indice].sort() }))} style={{ ...styles.small, background: diasSelecionados.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: diasSelecionados.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configuração corporativa'}</button></div></form></Card><Card style={{ padding: 20, maxWidth: 760 }}><form onSubmit={salvarConfiguracaoUnidade} style={{ display: 'grid', gap: 18 }}><div><h2 style={styles.h2}>Calendário da unidade ativa</h2><p style={styles.sub}>{unidade ? `Unidade ${configuracaoUnidade.lojaId}. ${configuracaoUnidade.herdadaDaEmpresa ? 'No momento, ela herda o padrão corporativo.' : 'Esta unidade possui regras próprias.'}` : 'A sessão atual não informou uma unidade no JWT; a configuração específica não está disponível.'}</p></div>{!unidade ? <div style={styles.empty}>Selecione uma unidade na sessão do SetPoint para editar este calendário.</div> : <><div style={styles.formGrid}><Field label="Abertura"><input type="time" value={unidade.horarioAbertura || ''} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, horarioAbertura: event.target.value } }))} style={inputStyle} /></Field><Field label="Fechamento"><input type="time" value={unidade.horarioFechamento || ''} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, horarioFechamento: event.target.value } }))} style={inputStyle} /></Field><Field label="Intervalo entre horários (min)"><input type="number" min="5" value={unidade.intervaloMinutos ?? ''} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, intervaloMinutos: event.target.value } }))} style={inputStyle} /></Field><Field label="Feriados (AAAA-MM-DD, separados por vírgula)" full><input value={(unidade.feriados || []).join(', ')} onChange={(event) => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, feriados: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } }))} style={inputStyle} /></Field><Field label="Dias de funcionamento" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setConfiguracaoUnidade((atual) => ({ ...atual, calendario: { ...atual.calendario, diasFuncionamento: diasUnidade.includes(indice) ? diasUnidade.filter((item) => item !== indice) : [...diasUnidade, indice].sort() } }))} style={{ ...styles.small, background: diasUnidade.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: diasUnidade.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar calendário da unidade'}</button></div></>}</form></Card></div>
  }

  function renderModal() {
    if (modal === 'profissional') return <Modal title="Novo profissional" onClose={() => setModal(null)} wide><form onSubmit={salvarProfissional} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formProf.nome} onChange={(event) => setFormProf((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone"><input value={formProf.telefone} onChange={(event) => setFormProf((atual) => ({ ...atual, telefone: event.target.value }))} style={inputStyle} /></Field><Field label="E-mail"><input type="email" value={formProf.email} onChange={(event) => setFormProf((atual) => ({ ...atual, email: event.target.value }))} style={inputStyle} /></Field><Field label="Especialidade"><input value={formProf.especialidade} onChange={(event) => setFormProf((atual) => ({ ...atual, especialidade: event.target.value }))} style={inputStyle} /></Field><Field label="Tipo"><select value={formProf.tipo} onChange={(event) => setFormProf((atual) => ({ ...atual, tipo: event.target.value }))} style={inputStyle}><option value="parceiro">Parceiro</option><option value="funcionario">Funcionário</option><option value="autonomo">Autônomo</option></select></Field><Field label="Comissão de serviços (%)"><input type="number" min="0" max="100" value={formProf.percentualComissao} onChange={(event) => setFormProf((atual) => ({ ...atual, percentualComissao: event.target.value }))} style={inputStyle} /></Field><Field label="Comissão de produtos (%)"><input type="number" min="0" max="100" value={formProf.percentualComissaoProduto} onChange={(event) => setFormProf((atual) => ({ ...atual, percentualComissaoProduto: event.target.value }))} style={inputStyle} /></Field><Field label="Início"><input type="time" value={formProf.horarioInicio} onChange={(event) => setFormProf((atual) => ({ ...atual, horarioInicio: event.target.value }))} style={inputStyle} /></Field><Field label="Fim"><input type="time" value={formProf.horarioFim} onChange={(event) => setFormProf((atual) => ({ ...atual, horarioFim: event.target.value }))} style={inputStyle} /></Field><Field label="Dias de trabalho" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setFormProf((atual) => ({ ...atual, diasTrabalho: atual.diasTrabalho.includes(indice) ? atual.diasTrabalho.filter((item) => item !== indice) : [...atual.diasTrabalho, indice].sort() }))} style={{ ...styles.small, background: formProf.diasTrabalho.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: formProf.diasTrabalho.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar profissional'}</button></div></form></Modal>
    if (modal === 'servico') return <Modal title="Novo serviço" onClose={() => setModal(null)}><form onSubmit={salvarServico} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formServico.nome} onChange={(event) => setFormServico((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Categoria"><input value={formServico.categoria} onChange={(event) => setFormServico((atual) => ({ ...atual, categoria: event.target.value }))} style={inputStyle} /></Field><Field label="Preço (R$) *"><input required type="number" min="0.01" step="0.01" value={formServico.preco} onChange={(event) => setFormServico((atual) => ({ ...atual, preco: event.target.value }))} style={inputStyle} /></Field><Field label="Duração (minutos)"><input required type="number" min="5" value={formServico.duracaoMinutos} onChange={(event) => setFormServico((atual) => ({ ...atual, duracaoMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Descrição" full><textarea rows={4} value={formServico.descricao} onChange={(event) => setFormServico((atual) => ({ ...atual, descricao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}><input type="checkbox" checked={formServico.permiteAgendamentoOnline !== false} onChange={(event) => setFormServico((atual) => ({ ...atual, permiteAgendamentoOnline: event.target.checked }))} /> Permitir este serviço nos canais de agendamento online</label><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar serviço'}</button></div></form></Modal>
    if (modal === 'cliente') return <Modal title="Novo cliente no CRM" onClose={() => setModal(null)}><form onSubmit={salvarCliente} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formCliente.nome} onChange={(event) => setFormCliente((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone"><input value={formCliente.telefone} onChange={(event) => setFormCliente((atual) => ({ ...atual, telefone: event.target.value }))} style={inputStyle} /></Field><Field label="E-mail"><input type="email" value={formCliente.email} onChange={(event) => setFormCliente((atual) => ({ ...atual, email: event.target.value }))} style={inputStyle} /></Field><Field label="Observação" full><textarea rows={4} value={formCliente.observacao} onChange={(event) => setFormCliente((atual) => ({ ...atual, observacao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar cliente'}</button></div></form></Modal>
    if (modal === 'agenda') return <Modal title={`Novo agendamento · ${fmtDateOnly(dataSelecionada)}`} onClose={() => setModal(null)}><form onSubmit={salvarAgenda} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Cliente cadastrado"><select value={formAgenda.clienteId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Selecionar ou informar abaixo</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.telefone ? ` · ${cliente.telefone}` : ''}</option>)}</select></Field><Field label="Nome do cliente"><input value={formAgenda.clienteNome} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteNome: event.target.value, clienteId: '' }))} placeholder="Para atendimento eventual" style={inputStyle} /></Field><Field label="Profissional"><select value={formAgenda.profissionalId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, profissionalId: event.target.value }))} style={inputStyle}><option value="">Sem profissional definido</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Serviço *"><select required value={formAgenda.servicoId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, servicoId: event.target.value }))} style={inputStyle}><option value="">Selecionar serviço</option>{servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome} · {moeda(servico.preco)} · {servico.duracaoMinutos} min</option>)}</select></Field><Field label="Horário *"><input required type="time" value={formAgenda.hora} onChange={(event) => setFormAgenda((atual) => ({ ...atual, hora: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone eventual"><input value={formAgenda.clienteTelefone} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteTelefone: event.target.value }))} style={inputStyle} /></Field><Field label="Observações" full><textarea rows={4} value={formAgenda.observacoes} onChange={(event) => setFormAgenda((atual) => ({ ...atual, observacoes: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar agendamento'}</button></div></form></Modal>
    if (modal?.tipo === 'recebimento') return <Modal title="Registrar recebimento" onClose={() => setModal(null)}><div style={{ display: 'grid', gap: 16 }}><div style={{ background: 'var(--card)', borderRadius: 10, padding: 14 }}><strong>{modal.agendamento.clienteNome || modal.agendamento.cliente_nome}</strong><div style={styles.sub}>{modal.agendamento.servicoNome || modal.agendamento.servico_nome} · valor previsto {moeda(modal.agendamento.valor)}</div></div><Field label="Meio de pagamento"><select value={formRecebimento.meioPagamento} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, meioPagamento: event.target.value }))} style={inputStyle}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option><option value="transferencia">Transferência</option></select></Field><Field label="Valor recebido (R$)" hint="Esta ação criará uma receita paga no livro financeiro central."><input type="number" min="0.01" step="0.01" value={formRecebimento.valorRecebido} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, valorRecebido: event.target.value }))} style={inputStyle} /></Field><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="button" style={styles.primary} disabled={salvando} onClick={concluirEReceber}>{salvando ? 'Registrando…' : 'Confirmar recebimento'}</button></div></div></Modal>
    if (modal?.tipo === 'detalheAgenda') {
      const agendamento = modal.agendamento
      const proximas = TRANSICOES[agendamento.status] || []
      return <Modal title="Detalhes do atendimento" onClose={() => setModal(null)}><div style={{ display: 'grid', gap: 16 }}><div style={styles.detailHero}><div style={styles.avatar}>{iniciais(agendamento.clienteNome || agendamento.cliente_nome)}</div><div><strong style={{ fontSize: 20 }}>{agendamento.clienteNome || agendamento.cliente_nome || 'Cliente sem nome'}</strong><div style={styles.sub}>{agendamento.clienteTelefone || agendamento.cliente_telefone || 'Sem telefone informado'}</div></div><Badge status={agendamento.status} /></div><div style={styles.detailGrid}><div><small style={styles.sub}>Horário</small><strong>{horario(agendamento.dataHora)} · {agendamento.duracaoMinutos || 0} min</strong></div><div><small style={styles.sub}>Atendente</small><strong>{agendamento.profissionalNome || agendamento.profissional_nome || 'Sem atendente'}</strong></div><div><small style={styles.sub}>Serviço</small><strong>{agendamento.servicoNome || agendamento.servico_nome || 'Não informado'}</strong></div><div><small style={styles.sub}>Valor</small><strong>{moeda(agendamento.valor)}</strong></div></div>{agendamento.observacoes && <div style={styles.notice}><strong>Observações</strong><div style={styles.sub}>{agendamento.observacoes}</div></div>}<div style={styles.modalActions}>{proximas.map((proximo) => <button key={proximo} type="button" style={styles.secondary} onClick={() => { setModal(null); mudarStatus(agendamento, proximo) }}>{STATUS[proximo]?.label}</button>)}{agendamento.status === 'concluido' && !agendamento.financeiroLancamentoId && <button type="button" style={styles.primary} onClick={() => { abrirRecebimento(agendamento) }}>Registrar recebimento</button>}</div></div></Modal>
    }
    if (modal === 'plano') return <Modal title="Novo plano de recorrência" onClose={() => setModal(null)} wide><form onSubmit={salvarPlano} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formPlano.nome} onChange={(event) => setFormPlano((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} placeholder="Plano mensal corte" /></Field><Field label="Preço do ciclo (R$) *"><input required type="number" min="0.01" step="0.01" value={formPlano.preco} onChange={(event) => setFormPlano((atual) => ({ ...atual, preco: event.target.value }))} style={inputStyle} /></Field><Field label="Ciclo"><select value={formPlano.ciclo} onChange={(event) => setFormPlano((atual) => ({ ...atual, ciclo: event.target.value }))} style={inputStyle}><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></Field><Field label="Sessões incluídas"><input required type="number" min="1" max="100" value={formPlano.sessoesIncluidas} onChange={(event) => setFormPlano((atual) => ({ ...atual, sessoesIncluidas: event.target.value }))} style={inputStyle} /></Field><Field label="Validade (dias)"><input required type="number" min="1" value={formPlano.validadeDias} onChange={(event) => setFormPlano((atual) => ({ ...atual, validadeDias: event.target.value }))} style={inputStyle} /></Field><Field label="Serviços cobertos" full><select multiple value={formPlano.servicosIds} onChange={(event) => setFormPlano((atual) => ({ ...atual, servicosIds: Array.from(event.target.selectedOptions).map((option) => option.value) }))} style={{ ...inputStyle, minHeight: 110 }}>{servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}</select><small style={styles.sub}>Use Ctrl/Cmd para selecionar mais de um serviço.</small></Field><Field label="Descrição" full><textarea rows={3} value={formPlano.descricao} onChange={(event) => setFormPlano((atual) => ({ ...atual, descricao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar plano'}</button></div></form></Modal>
    if (modal === 'produtoRevenda') return <Modal title="Novo produto de revenda" onClose={() => setModal(null)} wide><form onSubmit={salvarProdutoRevenda} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formProdutoRevenda.nome} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} placeholder="Pomada modeladora" /></Field><Field label="SKU"><input value={formProdutoRevenda.sku} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, sku: event.target.value }))} style={inputStyle} /></Field><Field label="Categoria"><input value={formProdutoRevenda.categoria} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, categoria: event.target.value }))} style={inputStyle} /></Field><Field label="Unidade"><input value={formProdutoRevenda.unidade} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, unidade: event.target.value }))} style={inputStyle} /></Field><Field label="Preço de venda (R$) *"><input required type="number" min="0.01" step="0.01" value={formProdutoRevenda.precoVenda} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, precoVenda: event.target.value }))} style={inputStyle} /></Field><Field label="Custo unitário (R$)"><input type="number" min="0" step="0.01" value={formProdutoRevenda.custoUnitario} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, custoUnitario: event.target.value }))} style={inputStyle} /></Field><Field label="Estoque inicial"><input type="number" min="0" step="1" value={formProdutoRevenda.estoqueAtual} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, estoqueAtual: event.target.value }))} style={inputStyle} /></Field><Field label="Estoque mínimo"><input type="number" min="0" step="1" value={formProdutoRevenda.estoqueMinimo} onChange={(event) => setFormProdutoRevenda((atual) => ({ ...atual, estoqueMinimo: event.target.value }))} style={inputStyle} /></Field></div><p style={styles.sub}>O estoque inicial gera apenas um movimento de entrada inicial; nenhum financeiro é criado.</p><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Cadastrar produto'}</button></div></form></Modal>
    return null
  }

  function renderIntegracoes() {
    const whatsapp = integracoes?.whatsapp
    const ia = integracoes?.ia
    return <div style={{ display: 'grid', gap: 18 }}>
      <Card style={{ padding: 20, background: 'linear-gradient(135deg, color-mix(in srgb, #25d366 10%, var(--card)), var(--card))' }}><div style={styles.sectionTitle}><div><div style={styles.kicker}>Canais e automação controlada</div><h2 style={{ ...styles.h2, fontSize: 22, marginTop: 5 }}>Integrações da Barbearia</h2><p style={styles.sub}>WhatsApp e IA trabalham como apoio ao operador. Nenhuma mensagem, reserva, pagamento ou alteração é disparada automaticamente.</p></div><button type="button" style={styles.secondary} onClick={carregar}>Atualizar status</button></div><div style={styles.integrationGrid}><div style={styles.integrationCard}><div style={styles.integrationHeading}><div style={{ ...styles.integrationIcon, background: '#25d366' }}>W</div><div><strong>WhatsApp</strong><span style={styles.sub}>{whatsapp?.envioManualDisponivel ? 'Canal configurado no servidor' : 'Canal ainda não configurado'}</span></div><Badge status={whatsapp?.envioManualDisponivel ? 'configurado' : 'pendente_configuracao'} /></div><div style={styles.metricLine}><span>Credencial do provedor</span><strong>{whatsapp?.credencialConfigurada ? 'Configurada' : 'Pendente'}</strong></div><div style={styles.metricLine}><span>Disparo automático</span><strong>Desativado</strong></div><p style={styles.sub}>O envio manual exige telefone, mensagem e confirmação adicional do operador. A credencial nunca é exibida na tela.</p><form onSubmit={enviarWhatsApp} style={{ display: 'grid', gap: 10, marginTop: 14 }}><Field label="Telefone"><input value={formWhatsApp.telefone} onChange={(event) => setFormWhatsApp((atual) => ({ ...atual, telefone: event.target.value }))} placeholder="DDD + número" style={inputStyle} disabled={!whatsapp?.envioManualDisponivel} /></Field><Field label="Mensagem"><textarea rows={4} value={formWhatsApp.mensagem} onChange={(event) => setFormWhatsApp((atual) => ({ ...atual, mensagem: event.target.value }))} placeholder="Escreva uma mensagem operacional…" style={{ ...inputStyle, resize: 'vertical' }} disabled={!whatsapp?.envioManualDisponivel} /></Field><button type="submit" style={{ ...styles.primary, background: '#25d366' }} disabled={!whatsapp?.envioManualDisponivel || salvando}>{whatsapp?.envioManualDisponivel ? 'Enviar manualmente' : 'Configurar provedor para enviar'}</button></form></div><div style={styles.integrationCard}><div style={styles.integrationHeading}><div style={{ ...styles.integrationIcon, background: '#6d5dfc' }}>IA</div><div><strong>Assistente IA operacional</strong><span style={styles.sub}>{ia?.configurada ? `Modelo disponível${ia.modelo ? ` · ${ia.modelo}` : ''}` : 'Modelo ainda não configurado no servidor'}</span></div><Badge status={ia?.configurada ? 'configurado' : 'pendente_configuracao'} /></div><div style={styles.metricLine}><span>Escopo da consulta</span><strong>Agenda, serviços e equipe</strong></div><div style={styles.metricLine}><span>Ações executadas pela IA</span><strong>Nenhuma</strong></div><p style={styles.sub}>A IA pode resumir a operação e sugerir organização. Ela não cria reserva, não altera cadastro e não confirma pagamento.</p><form onSubmit={consultarAssistente} style={{ display: 'grid', gap: 10, marginTop: 14 }}><Field label="Pergunta para o assistente"><textarea rows={4} value={assistentePergunta} onChange={(event) => setAssistentePergunta(event.target.value)} placeholder="Ex.: quais horários estão mais ocupados hoje?" style={{ ...inputStyle, resize: 'vertical' }} /></Field><button type="submit" style={styles.primary} disabled={consultandoAssistente}>{consultandoAssistente ? 'Analisando…' : 'Consultar assistente'}</button></form>{assistenteResposta?.resposta && <div style={styles.aiResponse}><strong>Resposta do assistente</strong><div style={{ whiteSpace: 'pre-wrap', marginTop: 8, lineHeight: 1.55 }}>{assistenteResposta.resposta}</div><small style={styles.sub}>Resposta gerada a partir dos dados operacionais selecionados; confirme qualquer decisão manualmente.</small></div>}{assistenteResposta?.erro && <div style={{ ...styles.notice, borderColor: '#e05c5c' }}><strong>Consulta não disponível</strong><div style={styles.sub}>{assistenteResposta.erro}</div></div>}</div></div></div>
      <Card style={{ padding: 18 }}><h2 style={styles.h2}>Próximas ativações</h2><p style={styles.sub}>Para ativar o WhatsApp, é necessário configurar um provedor compatível no ambiente do servidor. Para ativar a IA, é necessário configurar um provedor/modelo no ambiente do servidor. Nesta etapa não foram incluídas credenciais, webhooks, cron ou polling.</p><div style={styles.readinessGrid}><div style={styles.readinessItem}><strong>Confirmação</strong><span style={{ color: '#14b87a', fontWeight: 800 }}>Manual</span><small style={styles.sub}>Toda comunicação externa depende de ação explícita.</small></div><div style={styles.readinessItem}><strong>Privacidade</strong><span style={{ color: '#14b87a', fontWeight: 800 }}>Protegida</span><small style={styles.sub}>Não enviar documentos pessoais ao assistente.</small></div><div style={styles.readinessItem}><strong>Auditoria</strong><span style={{ color: '#14b87a', fontWeight: 800 }}>Ativa</span><small style={styles.sub}>O backend retorna estados sem expor segredos.</small></div></div></Card>
    </div>
  }

  function renderConteudo() {
    if (tab === 'Visão geral') return renderVisaoGeral()
    if (tab === 'Agenda') return renderAgenda()
    if (tab === 'Atendimento') return renderAtendimento()
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
    return renderConfiguracao()
  }

  return <div style={{ padding: '24px clamp(16px, 3vw, 36px)', maxWidth: 1440, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
      <div><div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ERP operacional · empresa ativa</div><h1 style={{ margin: '7px 0 5px', fontSize: 'clamp(25px, 4vw, 34px)' }}>Barbearia & Salão</h1><p style={{ margin: 0, color: 'var(--muted)', maxWidth: 720 }}>Agenda, atendimento, equipe, clientes e recebimentos em um único fluxo, com isolamento por empresa e unidade.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={styles.secondary} onClick={carregar}>Atualizar</button>{tab === 'Agenda' && <button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>+ Agendamento</button>}</div>
    </header>
    <nav aria-label="Seções da Barbearia" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: 5, marginBottom: 24, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, scrollbarWidth: 'thin' }}>
      {TABS.map(([nome, descricao]) => <button key={nome} type="button" title={descricao} aria-current={tab === nome ? 'page' : undefined} onClick={() => { setTab(nome); setBusca('') }} style={{ flex: '0 0 auto', border: 0, borderRadius: 9, padding: '10px 13px', background: tab === nome ? 'var(--accent)' : 'transparent', color: tab === nome ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === nome ? 800 : 600, whiteSpace: 'nowrap' }}>{nome}</button>)}
    </nav>
    {erro && <Card style={{ padding: 16, marginBottom: 18, borderColor: '#e05c5c' }}><strong>Não foi possível carregar os dados.</strong><div style={{ color: 'var(--muted)', marginTop: 5 }}>{erro}</div></Card>}
    {loading ? <Card style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Carregando dados da empresa ativa…</Card> : renderConteudo()}
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
  toolbar: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' },
  agendaToolbar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' },
  agendaMeta: { display: 'grid', gap: 3, alignContent: 'end', padding: '0 4px 2px', color: 'var(--muted)', fontSize: 12 },
  kicker: { color: 'var(--accent)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' },
  integrationGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 },
  serviceSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 18 },
  serviceSummaryItem: { display: 'grid', gap: 4, padding: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10 },
  serviceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 },
  serviceCardTop: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  serviceCategory: { display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: 'color-mix(in srgb, #8b5cf6 14%, var(--card))', color: '#8b5cf6', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' },
  serviceFacts: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: 'var(--muted)', fontSize: 12 },
  integrationCard: { display: 'grid', gap: 12, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 },
  integrationHeading: { display: 'flex', alignItems: 'center', gap: 10 },
  integrationIcon: { width: 38, height: 38, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 900, flexShrink: 0 },
  detailHero: { display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, background: 'var(--card)', flexWrap: 'wrap' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  aiResponse: { marginTop: 6, padding: 14, background: 'color-mix(in srgb, #6d5dfc 8%, var(--card))', border: '1px solid color-mix(in srgb, #6d5dfc 35%, var(--line))', borderRadius: 10 },
  notice: { padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card2)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 },
  twoColumns: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 },
  listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' },
  metricLine: { display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)', color: 'var(--muted)' },
  readinessGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  readinessItem: { display: 'grid', gap: 7, padding: 14, background: 'var(--bg)', borderRadius: 10 },
  avatar: { width: 46, height: 46, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
}
