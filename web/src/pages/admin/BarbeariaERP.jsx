import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtDate, fmtDateOnly, fmtR } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const TABS = [
  ['Visão geral', 'Resumo da operação'],
  ['Agenda', 'Reservas e horários'],
  ['Atendimento', 'Fila e status'],
  ['Clientes', 'CRM da unidade'],
  ['Profissionais', 'Equipe e repasse'],
  ['Serviços', 'Catálogo de serviços'],
  ['Comissões', 'Apuração indicativa'],
  ['Configuração', 'Horários e políticas'],
]

const STATUS = {
  agendado: { label: 'Agendado', color: '#4a9eff' },
  confirmado: { label: 'Confirmado', color: '#8b5cf6' },
  em_atendimento: { label: 'Em atendimento', color: '#f59e0b' },
  concluido: { label: 'Concluído', color: '#14b87a' },
  cancelado: { label: 'Cancelado', color: '#e05c5c' },
  nao_compareceu: { label: 'Não compareceu', color: '#888' },
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
  return Number.isNaN(data.valueOf()) ? String(value) : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [formProf, setFormProf] = useState({ nome: '', telefone: '', email: '', especialidade: 'Barbeiro', tipo: 'parceiro', percentualComissao: 50, percentualComissaoProduto: 30, horarioInicio: '08:00', horarioFim: '18:00', diasTrabalho: [1, 2, 3, 4, 5, 6] })
  const [formServico, setFormServico] = useState({ nome: '', descricao: '', categoria: 'Geral', duracaoMinutos: 30, preco: '' })
  const [formCliente, setFormCliente] = useState({ nome: '', telefone: '', email: '', observacao: '' })
  const [formAgenda, setFormAgenda] = useState({ clienteId: '', clienteNome: '', clienteTelefone: '', profissionalId: '', servicoId: '', hora: '10:00', observacoes: '' })
  const [formRecebimento, setFormRecebimento] = useState({ meioPagamento: 'pix', valorRecebido: '' })
  const [formConfig, setFormConfig] = useState({})

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const query = new URLSearchParams({ data: dataSelecionada })
      if (statusFiltro) query.set('status', statusFiltro)
      if (profissionalFiltro) query.set('profissionalId', profissionalFiltro)
      const [dashData, agendaData, profData, servData, cliData, configData] = await Promise.all([
        api.get(`/api/admin/barbearia/dashboard?data=${encodeURIComponent(dataSelecionada)}`),
        api.get(`/api/admin/barbearia/agenda?${query.toString()}`),
        api.get('/api/admin/barbearia/profissionais'),
        api.get('/api/admin/barbearia/servicos'),
        api.get('/api/admin/barbearia/clientes'),
        api.get('/api/admin/barbearia/configuracoes'),
      ])
      setDashboard(dashData)
      setAgendamentos(Array.isArray(agendaData?.agendamentos) ? agendaData.agendamentos : [])
      setProfissionais(Array.isArray(profData?.profissionais) ? profData.profissionais : [])
      setServicos(Array.isArray(servData?.servicos) ? servData.servicos : [])
      setClientes(Array.isArray(cliData?.clientes) ? cliData.clientes : [])
      setConfiguracao(configData?.configuracao || null)
      setFormConfig(configData?.configuracao || {})
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
    await executar(() => api.post('/api/admin/barbearia/servicos', { ...formServico, preco: Number(formServico.preco) }), 'Serviço cadastrado.')
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
    return <div style={{ display: 'grid', gap: 16 }}>
      <Card style={{ padding: 16 }}><div style={styles.toolbar}><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><Field label="Data"><input type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} style={inputStyle} /></Field><Field label="Status"><select value={statusFiltro} onChange={(event) => setStatusFiltro(event.target.value)} style={inputStyle}><option value="">Todos os status</option>{Object.entries(STATUS).map(([valor, item]) => <option key={valor} value={valor}>{item.label}</option>)}</select></Field><Field label="Profissional"><select value={profissionalFiltro} onChange={(event) => setProfissionalFiltro(event.target.value)} style={inputStyle}><option value="">Toda a equipe</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div><button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>+ Agendar atendimento</button></div></Card>
      {renderAgendaTabela()}
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
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 16 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Catálogo de serviços</h2><p style={styles.sub}>A duração alimenta a validação de conflitos na agenda.</p></div><button type="button" style={styles.primary} onClick={() => { setFormServico({ nome: '', descricao: '', categoria: 'Geral', duracaoMinutos: 30, preco: '' }); setModal('servico') }}>+ Novo serviço</button></div><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar serviço ou categoria" style={{ ...inputStyle, marginTop: 14, maxWidth: 420 }} /></Card><Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}><thead><tr style={styles.tableHead}>{['Serviço', 'Categoria', 'Duração', 'Preço', 'Agendamento online', 'Ação'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{listaBuscaServicos.length === 0 ? <tr><td colSpan={6} style={styles.empty}>Nenhum serviço cadastrado na empresa ativa.</td></tr> : listaBuscaServicos.map((servico) => <tr key={servico.id} style={{ borderTop: '1px solid var(--line)', opacity: servico.ativo === false ? .58 : 1 }}><td style={styles.td}><strong>{servico.nome}</strong><div style={styles.sub}>{servico.descricao || 'Sem descrição'}</div></td><td style={styles.td}>{servico.categoria}</td><td style={styles.td}>{servico.duracaoMinutos} min</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(servico.preco)}</td><td style={styles.td}>{servico.permiteAgendamentoOnline ? 'Sim' : 'Não'}</td><td style={styles.td}><button type="button" style={styles.small} onClick={() => alternarServico(servico)}>{servico.ativo === false ? 'Reativar' : 'Desativar'}</button></td></tr>)}</tbody></table></Card></div>
  }

  function renderComissoes() {
    const concluidos = agendamentos.filter((item) => item.status === 'concluido')
    const porProfissional = profissionais.map((profissional) => {
      const itens = concluidos.filter((item) => item.profissionalId === profissional.id)
      const bruto = itens.reduce((soma, item) => soma + Number(item.valorRecebido || item.valor || 0), 0)
      return { ...profissional, atendimentos: itens.length, bruto, comissao: bruto * Number(profissional.percentualComissao || 0) / 100, sala: bruto * (100 - Number(profissional.percentualComissao || 0)) / 100 }
    }).filter((item) => item.atendimentos > 0 || item.ativo !== false)
    return <div style={{ display: 'grid', gap: 16 }}><Card style={{ padding: 18 }}><div style={styles.toolbar}><div><h2 style={styles.h2}>Comissões e rateio</h2><p style={styles.sub}>Apuração indicativa com base nos atendimentos concluídos em {fmtDateOnly(dataSelecionada)}. Não cria lançamento nem repasse.</p></div><a href="/admin/financeiro" style={styles.secondary}>Ver livro financeiro</a></div></Card><Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}><thead><tr style={styles.tableHead}>{['Profissional', 'Atendimentos', 'Bruto', 'Comissão', 'Parcela salão'].map((coluna) => <th key={coluna} style={styles.th}>{coluna}</th>)}</tr></thead><tbody>{porProfissional.length === 0 ? <tr><td colSpan={5} style={styles.empty}>Ainda não há atendimentos concluídos para apuração.</td></tr> : porProfissional.map((item) => <tr key={item.id} style={{ borderTop: '1px solid var(--line)' }}><td style={styles.td}><strong>{item.nome}</strong><div style={styles.sub}>{item.percentualComissao}% configurado</div></td><td style={styles.td}>{item.atendimentos}</td><td style={{ ...styles.td, fontWeight: 800 }}>{moeda(item.bruto)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#8b5cf6' }}>{moeda(item.comissao)}</td><td style={{ ...styles.td, fontWeight: 800, color: '#14b87a' }}>{moeda(item.sala)}</td></tr>)}</tbody></table></Card></div>
  }

  function renderConfiguracao() {
    const diasSelecionados = formConfig.diasFuncionamento || []
    return <Card style={{ padding: 20, maxWidth: 760 }}><form onSubmit={salvarConfiguracao} style={{ display: 'grid', gap: 18 }}><div><h2 style={styles.h2}>Horários e políticas</h2><p style={styles.sub}>As regras ficam isoladas na empresa ativa e orientam a operação administrativa.</p></div><div style={styles.formGrid}><Field label="Abertura"><input type="time" value={formConfig.horarioAbertura || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, horarioAbertura: event.target.value }))} style={inputStyle} /></Field><Field label="Fechamento"><input type="time" value={formConfig.horarioFechamento || ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, horarioFechamento: event.target.value }))} style={inputStyle} /></Field><Field label="Intervalo entre horários (min)"><input type="number" min="5" value={formConfig.intervaloMinutos ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, intervaloMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Antecedência mínima (min)"><input type="number" min="0" value={formConfig.antecedenciaMinutos ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, antecedenciaMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Janela de reservas (dias)"><input type="number" min="1" value={formConfig.janelaReservaDias ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, janelaReservaDias: event.target.value }))} style={inputStyle} /></Field><Field label="Cancelamento sem penalidade (horas)"><input type="number" min="0" value={formConfig.politicaCancelamentoHoras ?? ''} onChange={(event) => setFormConfig((atual) => ({ ...atual, politicaCancelamentoHoras: event.target.value }))} style={inputStyle} /></Field><Field label="Dias de funcionamento" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setFormConfig((atual) => ({ ...atual, diasFuncionamento: diasSelecionados.includes(indice) ? diasSelecionados.filter((item) => item !== indice) : [...diasSelecionados, indice].sort() }))} style={{ ...styles.small, background: diasSelecionados.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: diasSelecionados.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configurações'}</button></div></form></Card>
  }

  function renderModal() {
    if (modal === 'profissional') return <Modal title="Novo profissional" onClose={() => setModal(null)} wide><form onSubmit={salvarProfissional} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formProf.nome} onChange={(event) => setFormProf((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone"><input value={formProf.telefone} onChange={(event) => setFormProf((atual) => ({ ...atual, telefone: event.target.value }))} style={inputStyle} /></Field><Field label="E-mail"><input type="email" value={formProf.email} onChange={(event) => setFormProf((atual) => ({ ...atual, email: event.target.value }))} style={inputStyle} /></Field><Field label="Especialidade"><input value={formProf.especialidade} onChange={(event) => setFormProf((atual) => ({ ...atual, especialidade: event.target.value }))} style={inputStyle} /></Field><Field label="Tipo"><select value={formProf.tipo} onChange={(event) => setFormProf((atual) => ({ ...atual, tipo: event.target.value }))} style={inputStyle}><option value="parceiro">Parceiro</option><option value="funcionario">Funcionário</option><option value="autonomo">Autônomo</option></select></Field><Field label="Comissão de serviços (%)"><input type="number" min="0" max="100" value={formProf.percentualComissao} onChange={(event) => setFormProf((atual) => ({ ...atual, percentualComissao: event.target.value }))} style={inputStyle} /></Field><Field label="Comissão de produtos (%)"><input type="number" min="0" max="100" value={formProf.percentualComissaoProduto} onChange={(event) => setFormProf((atual) => ({ ...atual, percentualComissaoProduto: event.target.value }))} style={inputStyle} /></Field><Field label="Início"><input type="time" value={formProf.horarioInicio} onChange={(event) => setFormProf((atual) => ({ ...atual, horarioInicio: event.target.value }))} style={inputStyle} /></Field><Field label="Fim"><input type="time" value={formProf.horarioFim} onChange={(event) => setFormProf((atual) => ({ ...atual, horarioFim: event.target.value }))} style={inputStyle} /></Field><Field label="Dias de trabalho" full><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{DIAS.map((dia, indice) => <button type="button" key={dia} onClick={() => setFormProf((atual) => ({ ...atual, diasTrabalho: atual.diasTrabalho.includes(indice) ? atual.diasTrabalho.filter((item) => item !== indice) : [...atual.diasTrabalho, indice].sort() }))} style={{ ...styles.small, background: formProf.diasTrabalho.includes(indice) ? 'var(--accent)' : 'var(--card2)', color: formProf.diasTrabalho.includes(indice) ? '#fff' : 'var(--fg)' }}>{dia}</button>)}</div></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar profissional'}</button></div></form></Modal>
    if (modal === 'servico') return <Modal title="Novo serviço" onClose={() => setModal(null)}><form onSubmit={salvarServico} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formServico.nome} onChange={(event) => setFormServico((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Categoria"><input value={formServico.categoria} onChange={(event) => setFormServico((atual) => ({ ...atual, categoria: event.target.value }))} style={inputStyle} /></Field><Field label="Preço (R$) *"><input required type="number" min="0.01" step="0.01" value={formServico.preco} onChange={(event) => setFormServico((atual) => ({ ...atual, preco: event.target.value }))} style={inputStyle} /></Field><Field label="Duração (minutos)"><input required type="number" min="5" value={formServico.duracaoMinutos} onChange={(event) => setFormServico((atual) => ({ ...atual, duracaoMinutos: event.target.value }))} style={inputStyle} /></Field><Field label="Descrição" full><textarea rows={4} value={formServico.descricao} onChange={(event) => setFormServico((atual) => ({ ...atual, descricao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar serviço'}</button></div></form></Modal>
    if (modal === 'cliente') return <Modal title="Novo cliente no CRM" onClose={() => setModal(null)}><form onSubmit={salvarCliente} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Nome *" full><input required value={formCliente.nome} onChange={(event) => setFormCliente((atual) => ({ ...atual, nome: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone"><input value={formCliente.telefone} onChange={(event) => setFormCliente((atual) => ({ ...atual, telefone: event.target.value }))} style={inputStyle} /></Field><Field label="E-mail"><input type="email" value={formCliente.email} onChange={(event) => setFormCliente((atual) => ({ ...atual, email: event.target.value }))} style={inputStyle} /></Field><Field label="Observação" full><textarea rows={4} value={formCliente.observacao} onChange={(event) => setFormCliente((atual) => ({ ...atual, observacao: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar cliente'}</button></div></form></Modal>
    if (modal === 'agenda') return <Modal title={`Novo agendamento · ${fmtDateOnly(dataSelecionada)}`} onClose={() => setModal(null)}><form onSubmit={salvarAgenda} style={{ display: 'grid', gap: 16 }}><div style={styles.formGrid}><Field label="Cliente cadastrado"><select value={formAgenda.clienteId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteId: event.target.value, clienteNome: '' }))} style={inputStyle}><option value="">Selecionar ou informar abaixo</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.telefone ? ` · ${cliente.telefone}` : ''}</option>)}</select></Field><Field label="Nome do cliente"><input value={formAgenda.clienteNome} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteNome: event.target.value, clienteId: '' }))} placeholder="Para atendimento eventual" style={inputStyle} /></Field><Field label="Profissional"><select value={formAgenda.profissionalId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, profissionalId: event.target.value }))} style={inputStyle}><option value="">Sem profissional definido</option>{profissionais.filter((item) => item.ativo !== false).map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></Field><Field label="Serviço *"><select required value={formAgenda.servicoId} onChange={(event) => setFormAgenda((atual) => ({ ...atual, servicoId: event.target.value }))} style={inputStyle}><option value="">Selecionar serviço</option>{servicos.filter((item) => item.ativo !== false).map((servico) => <option key={servico.id} value={servico.id}>{servico.nome} · {moeda(servico.preco)} · {servico.duracaoMinutos} min</option>)}</select></Field><Field label="Horário *"><input required type="time" value={formAgenda.hora} onChange={(event) => setFormAgenda((atual) => ({ ...atual, hora: event.target.value }))} style={inputStyle} /></Field><Field label="Telefone eventual"><input value={formAgenda.clienteTelefone} onChange={(event) => setFormAgenda((atual) => ({ ...atual, clienteTelefone: event.target.value }))} style={inputStyle} /></Field><Field label="Observações" full><textarea rows={4} value={formAgenda.observacoes} onChange={(event) => setFormAgenda((atual) => ({ ...atual, observacoes: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="submit" style={styles.primary} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar agendamento'}</button></div></form></Modal>
    if (modal?.tipo === 'recebimento') return <Modal title="Registrar recebimento" onClose={() => setModal(null)}><div style={{ display: 'grid', gap: 16 }}><div style={{ background: 'var(--card)', borderRadius: 10, padding: 14 }}><strong>{modal.agendamento.clienteNome || modal.agendamento.cliente_nome}</strong><div style={styles.sub}>{modal.agendamento.servicoNome || modal.agendamento.servico_nome} · valor previsto {moeda(modal.agendamento.valor)}</div></div><Field label="Meio de pagamento"><select value={formRecebimento.meioPagamento} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, meioPagamento: event.target.value }))} style={inputStyle}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Cartão de débito</option><option value="credito">Cartão de crédito</option><option value="transferencia">Transferência</option></select></Field><Field label="Valor recebido (R$)" hint="Esta ação criará uma receita paga no livro financeiro central."><input type="number" min="0.01" step="0.01" value={formRecebimento.valorRecebido} onChange={(event) => setFormRecebimento((atual) => ({ ...atual, valorRecebido: event.target.value }))} style={inputStyle} /></Field><div style={styles.modalActions}><button type="button" style={styles.secondary} onClick={() => setModal(null)}>Cancelar</button><button type="button" style={styles.primary} disabled={salvando} onClick={concluirEReceber}>{salvando ? 'Registrando…' : 'Confirmar recebimento'}</button></div></div></Modal>
    return null
  }

  function renderConteudo() {
    if (tab === 'Visão geral') return renderVisaoGeral()
    if (tab === 'Agenda') return renderAgenda()
    if (tab === 'Atendimento') return renderAtendimento()
    if (tab === 'Clientes') return renderClientes()
    if (tab === 'Profissionais') return renderProfissionais()
    if (tab === 'Serviços') return renderServicos()
    if (tab === 'Comissões') return renderComissoes()
    return renderConfiguracao()
  }

  return <div style={{ padding: '24px clamp(16px, 3vw, 36px)', maxWidth: 1440, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
      <div><div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ERP operacional · empresa ativa</div><h1 style={{ margin: '7px 0 5px', fontSize: 'clamp(25px, 4vw, 34px)' }}>Barbearia & Salão</h1><p style={{ margin: 0, color: 'var(--muted)', maxWidth: 720 }}>Agenda, atendimento, equipe, clientes e recebimentos em um único fluxo, com isolamento por empresa e unidade.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={styles.secondary} onClick={carregar}>Atualizar</button>{tab === 'Agenda' && <button type="button" style={styles.primary} onClick={abrirNovoAgendamento}>+ Agendamento</button>}</div>
    </header>
    <nav aria-label="Seções da Barbearia" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 5, marginBottom: 24, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 }}>
      {TABS.map(([nome, descricao]) => <button key={nome} type="button" title={descricao} onClick={() => { setTab(nome); setBusca('') }} style={{ border: 0, borderRadius: 9, padding: '10px 13px', background: tab === nome ? 'var(--accent)' : 'transparent', color: tab === nome ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: tab === nome ? 800 : 600 }}>{nome}</button>)}
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
