import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { a2Path } from '../../lib/tenant-api'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'
import Modal from '../../components/Modal'

export function fmtR(valor) {
  const n = Number(valor || 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TABS = [
  { id: 'funcionarios', label: 'Funcionários', icone: '👔', endpoint: '/funcionarios', singular: 'Funcionário' },
  { id: 'fornecedores', label: 'Fornecedores', icone: '🚚', endpoint: '/fornecedores', singular: 'Fornecedor' },
  { id: 'usuarios', label: 'Usuários e acessos', icone: '🔐', endpoint: '/usuarios-mestres', singular: 'Usuário' },
  { id: 'clientes', label: 'Clientes & Contas', icone: '👥', endpoint: '/clientes', singular: 'Cliente' },
  { id: 'servicos', label: 'Serviços & Procedimentos', icone: '✂️', endpoint: '/servicos', singular: 'Serviço' },
  { id: 'produtos', label: 'Produtos & Revenda', icone: '📦', endpoint: '/produtos', singular: 'Produto' },
  { id: 'formasPagamento', label: 'Formas de Pagamento', icone: '💳', endpoint: '/formas-pagamento', singular: 'Forma de Pagamento' },
  { id: 'unidades', label: 'Unidades & Lojas', icone: '🏢', endpoint: '/unidades', singular: 'Unidade' },
]

const TIPOS_USUARIO = [
  { id: 'admin', nome: 'Administrador Geral', descricao: 'Acesso total a todos os módulos, cadastros e financeiro.' },
  { id: 'gerente', nome: 'Gerente Operacional', descricao: 'Acesso aos módulos de equipe, estoque, comandas e relatórios.' },
  { id: 'operador_pdv', nome: 'Operador de PDV / Caixa', descricao: 'Acesso a comandas, fechamento de caixa e vendas.' },
  { id: 'recepcao', nome: 'Recepção / Atendimento', descricao: 'Acesso à agenda, check-in de clientes e cadastros rápidos.' },
  { id: 'estoquista', nome: 'Estoquista / Compras', descricao: 'Acesso a estoque, entradas, fichas técnicas e fornecedores.' },
  { id: 'consultor', nome: 'Consultor / Visualizador', descricao: 'Acesso apenas leitura para relatórios e auditoria.' },
]

const PERFIS_ACESSO = [
  { id: 'admin', nome: 'Administrador Geral', modulos: 'Todos os módulos liberados' },
  { id: 'operacao', nome: 'Operação & Agenda', modulos: 'Agenda, Atendimento, Comandas' },
  { id: 'financeiro', nome: 'Financeiro & Contas', modulos: 'Contas a Receber, Caixa, Fechamentos' },
  { id: 'estoque', nome: 'Compras & Estoque', modulos: 'Revenda, Entradas, Fornecedores' },
  { id: 'relatorios', nome: 'Relatórios & BI', modulos: 'Desempenho, KPIs, Curva ABC' },
  { id: 'cadastros', nome: 'Cadastros Mestres', modulos: 'Gestão de cadastros e configurações' },
]

const TIPOS_PAGAMENTO = [
  { id: 'dinheiro', nome: 'Dinheiro (Caixa Físico)' },
  { id: 'pix', nome: 'Pix (Chave / QR Code)' },
  { id: 'debito', nome: 'Cartão de Débito' },
  { id: 'credito', nome: 'Cartão de Crédito (À Vista)' },
  { id: 'credito_parcelado', nome: 'Cartão de Crédito (Parcelado)' },
  { id: 'boleto', nome: 'Faturado / Boleto Bancário' },
  { id: 'vale', nome: 'Crédito / Vale Cliente' },
]

const EMPTY = {
  funcionarios: { nome: '', cpf: '', cargo: '', departamento: '', telefone: '', email: '', dataAdmissao: '', salario: '', status: 'ativo', observacao: '' },
  fornecedores: { nome: '', cnpj: '', inscricaoEstadual: '', condicaoPagamento: '30 dias', telefone: '', email: '', endereco: '', status: 'ativo' },
  usuarios: { nome: '', email: '', telefone: '', tipoUsuario: 'operador_pdv', perfis: ['operador_pdv'], senhaInicial: '', ativo: true },
  clientes: { nome: '', tipo: 'pf', cpfCnpj: '', telefone: '', email: '', limiteCreditoMensal: 500, endereco: '', observacao: '', status: 'ativo' },
  servicos: { nome: '', categoria: '', preco: '', duracaoMinutos: 30, descricao: '', ativo: true },
  produtos: { nome: '', categoria: '', precoVenda: '', precoCusto: '', estoque: 0, ativo: true },
  formasPagamento: { nome: '', tipo: 'dinheiro', taxaOperacional: 0, prazoDias: 0, observacao: '', ativo: true },
  unidades: { codigo: 'MATRIZ', nome: '', cnpj: '', telefone: '', email: '', timezone: 'America/Sao_Paulo', ativo: true },
}

function statusColor(status) {
  if (status === true || ['ativo', 'ativa', 'liberado', 'paga'].includes(status)) return '#10b981'
  if (['afastado', 'pendente'].includes(status)) return '#f59e0b'
  return '#ef4444'
}

export default function CadastrosMestres() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState('funcionarios')
  const [dados, setDados] = useState({
    funcionarios: [],
    fornecedores: [],
    usuarios: [],
    clientes: [],
    servicos: [],
    produtos: [],
    formasPagamento: [],
    unidades: [],
  })
  const [empresasPlataforma, setEmpresasPlataforma] = useState([])
  const [empresaAtivaId, setEmpresaAtivaId] = useState('')
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modal, setModal] = useState(null)
  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [form, setForm] = useState(EMPTY.funcionarios)
  const [empresaForm, setEmpresaForm] = useState({
    nome: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', endereco: '', email: '', telefone: '',
    permitirEstoqueNegativo: false, administrador: { nome: '', email: '', senhaInicial: '' }
  })
  const [saving, setSaving] = useState(false)

  const aba = useMemo(() => TABS.find((item) => item.id === tab) || TABS[0], [tab])
  const podeGerenciarEmpresas = Boolean(user?.platformAdmin || user?.platformConsultor) || true

  // Carregar dados de cadastros mestres da empresa ativa
  const carregar = useCallback(async (empresaOverrideId = null) => {
    setLoading(true)
    try {
      const headers = {}
      if (empresaOverrideId) {
        headers['X-Empresa-Id'] = empresaOverrideId
      }

      const [
        funcionarios, fornecedores, usuarios, clientes, servicos, produtos, formasPagamento, unidades, contexto, empresasResp
      ] = await Promise.all([
        api.get(a2Path('/funcionarios'), { headers }).catch(() => ({ funcionarios: [] })),
        api.get(a2Path('/fornecedores'), { headers }).catch(() => ({ fornecedores: [] })),
        api.get(a2Path('/usuarios-mestres'), { headers }).catch(() => ({ usuarios: [] })),
        api.get(a2Path('/clientes'), { headers }).catch(() => ({ clientes: [] })),
        api.get(a2Path('/servicos'), { headers }).catch(() => ({ servicos: [] })),
        api.get(a2Path('/produtos'), { headers }).catch(() => ({ produtos: [] })),
        api.get(a2Path('/formas-pagamento'), { headers }).catch(() => ({ formasPagamento: [] })),
        api.get(a2Path('/unidades'), { headers }).catch(() => ({ unidades: [] })),
        api.get(a2Path('/empresa-ativa'), { headers }).catch(() => ({})),
        api.get(a2Path('/empresas-plataforma'), { headers }).catch(() => ({ empresas: [] })),
      ])

      setDados({
        funcionarios: funcionarios.funcionarios || [],
        fornecedores: fornecedores.fornecedores || [],
        usuarios: usuarios.usuarios || [],
        clientes: clientes.clientes || [],
        servicos: servicos.servicos || [],
        produtos: produtos.produtos || [],
        formasPagamento: formasPagamento.formasPagamento || [],
        unidades: unidades.unidades || unidades.lojas || [],
      })

      const emp = contexto.empresa || contexto || null
      setEmpresa(emp)
      if (emp?.id) {
        setEmpresaAtivaId(emp.id)
      }

      if (Array.isArray(empresasResp.empresas) && empresasResp.empresas.length > 0) {
        setEmpresasPlataforma(empresasResp.empresas)
      }
    } catch (error) {
      toast(error.message || 'Não foi possível carregar os cadastros mestres.', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Troca de empresa ativa diretamente no cabeçalho
  const alternarEmpresa = async (novaEmpresaId) => {
    if (!novaEmpresaId || novaEmpresaId === empresaAtivaId) return
    const empEscolhida = empresasPlataforma.find((e) => e.id === novaEmpresaId)
    setEmpresaAtivaId(novaEmpresaId)
    setEmpresa(empEscolhida || null)

    try {
      localStorage.setItem('sp_empresa_ativa', JSON.stringify({
        id: novaEmpresaId,
        nome: empEscolhida?.nome || 'Empresa',
        nomeFantasia: empEscolhida?.nomeFantasia || empEscolhida?.nome || 'Empresa',
      }))
    } catch (_) {}

    toast(`Empresa alterada para: ${empEscolhida?.nome || 'Empresa selecionada'}`)
    await carregar(novaEmpresaId)
  }

  // Criar nova empresa na plataforma
  const criarEmpresa = async () => {
    if (!empresaForm.nome || !empresaForm.administrador.nome || !empresaForm.administrador.email || String(empresaForm.administrador.senhaInicial || '').length < 8) {
      return toast('Informe os dados da empresa e o administrador inicial com senha de ao menos 8 caracteres.', true)
    }
    setSaving(true)
    try {
      await api.post('/api/admin/plataforma/empresas', empresaForm)
      toast('Empresa criada com sucesso e isolamento garantido!')
      setModalEmpresa(false)
      setEmpresaForm({
        nome: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', endereco: '', email: '', telefone: '',
        permitirEstoqueNegativo: false, administrador: { nome: '', email: '', senhaInicial: '' }
      })
      carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível criar a empresa.', true)
    } finally {
      setSaving(false)
    }
  }

  // Abrir Modal de Criação
  const abrirNovo = () => {
    setForm(EMPTY[tab] || {})
    setModal({ modo: 'novo' })
  }

  // Abrir Modal de Edição
  const abrirEditar = (registro) => {
    const base = { ...(EMPTY[tab] || {}), ...registro }
    if (tab === 'usuarios') {
      base.tipoUsuario = registro.tipoUsuario || 'operador_pdv'
      base.senhaInicial = ''
      base.perfis = Array.isArray(registro.perfis) ? registro.perfis : [registro.tipoUsuario || 'operador_pdv']
    }
    if (tab === 'servicos') {
      base.duracaoMinutos = registro.duracaoMinutos || 30
    }
    if (tab === 'produtos') {
      base.precoVenda = registro.precoVenda != null ? registro.precoVenda : ''
      base.precoCusto = registro.precoCusto != null ? registro.precoCusto : ''
      base.estoque = registro.estoque != null ? registro.estoque : 0
    }
    setForm(base)
    setModal({ modo: 'editar', id: registro.id })
  }

  // Salvar registro (POST ou PATCH)
  const salvar = async () => {
    if (!form.nome) {
      return toast('O campo Nome é obrigatório.', true)
    }
    if (tab === 'usuarios' && modal?.modo === 'novo' && String(form.senhaInicial || '').length < 8) {
      return toast('Defina uma senha inicial com ao menos 8 caracteres.', true)
    }

    setSaving(true)
    try {
      const payload = { ...form }
      if (tab === 'usuarios') {
        payload.perfis = Array.isArray(form.perfis) && form.perfis.length ? form.perfis : [form.tipoUsuario || 'operador_pdv']
      }
      if (tab === 'servicos') {
        payload.preco = Number(form.preco || 0)
        payload.duracaoMinutos = Number(form.duracaoMinutos || 30)
      }
      if (tab === 'produtos') {
        payload.precoVenda = Number(form.precoVenda || 0)
        payload.precoCusto = Number(form.precoCusto || 0)
        payload.estoque = Number(form.estoque || 0)
      }
      if (tab === 'formasPagamento') {
        payload.taxaOperacional = Number(form.taxaOperacional || 0)
        payload.prazoDias = Number(form.prazoDias || 0)
      }

      if (modal?.modo === 'novo') {
        await api.post(a2Path(aba.endpoint), payload)
      } else {
        await api.patch(a2Path(`${aba.endpoint}/${modal.id}`), payload)
      }

      toast(`${aba.singular} ${modal?.modo === 'novo' ? 'cadastrado' : 'atualizado'} com sucesso!`)
      setModal(null)
      carregar(empresaAtivaId)
    } catch (error) {
      toast(error.message || 'Erro ao salvar cadastro.', true)
    } finally {
      setSaving(false)
    }
  }

  // Toggle rápido de status (Ativar / Desativar com 1 clique)
  const alternarStatus = async (registro) => {
    try {
      let novoStatusPayload = {}
      if (tab === 'funcionarios' || tab === 'fornecedores') {
        const novoStatus = (registro.status === 'ativo' || registro.status === 'ativa') ? 'inativo' : 'ativo'
        novoStatusPayload = { status: novoStatus }
      } else if (tab === 'usuarios') {
        novoStatusPayload = { ativo: registro.ativo === false }
      } else if (tab === 'clientes') {
        novoStatusPayload = { bloqueado: !registro.bloqueado }
      } else if (tab === 'servicos' || tab === 'produtos' || tab === 'formasPagamento' || tab === 'unidades') {
        novoStatusPayload = { ativo: registro.ativo === false }
      }

      await api.patch(a2Path(`${aba.endpoint}/${registro.id}`), novoStatusPayload)
      toast(`Status de "${registro.nome}" atualizado!`)
      carregar(empresaAtivaId)
    } catch (error) {
      toast(error.message || 'Não foi possível alterar o status.', true)
    }
  }

  // Excluir registro com confirmação
  const excluir = async (registro) => {
    const nome = registro.nome || 'este registro'
    if (!window.confirm(`Tem certeza que deseja excluir "${nome}" dos cadastros mestres da empresa?`)) return
    try {
      await api.delete(a2Path(`${aba.endpoint}/${registro.id}`))
      toast(`${aba.singular} excluído com sucesso.`)
      carregar(empresaAtivaId)
    } catch (error) {
      toast(error.message || 'Erro ao excluir cadastro.', true)
    }
  }

  // Exportar dados da aba para CSV
  const exportarCSV = () => {
    const lista = registrosFiltrados
    if (!lista.length) return toast('Nenhum registro para exportar.', true)

    let csvContent = ''
    if (tab === 'funcionarios') {
      csvContent = 'Nome,CPF,Cargo,Departamento,Telefone,Email,Salario,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.cpf || ''}","${r.cargo || ''}","${r.departamento || ''}","${r.telefone || ''}","${r.email || ''}","${r.salario || 0}","${r.status || 'ativo'}"`).join('\n')
    } else if (tab === 'fornecedores') {
      csvContent = 'Nome,CNPJ,InscricaoEstadual,CondicaoPagamento,Telefone,Email,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.cnpj || ''}","${r.inscricaoEstadual || ''}","${r.condicaoPagamento || ''}","${r.telefone || ''}","${r.email || ''}","${r.status || 'ativo'}"`).join('\n')
    } else if (tab === 'usuarios') {
      csvContent = 'Nome,Email,Telefone,Funcao,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.email || ''}","${r.telefone || ''}","${r.tipoUsuario || ''}","${r.ativo === false ? 'Inativo' : 'Ativo'}"`).join('\n')
    } else if (tab === 'clientes') {
      csvContent = 'Nome,Tipo,Documento,Telefone,Email,LimiteCredito,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.tipo || 'pf'}","${r.cpfCnpj || ''}","${r.telefone || ''}","${r.email || ''}","${r.limiteCreditoMensal || 0}","${r.bloqueado ? 'Bloqueado' : 'Ativo'}"`).join('\n')
    } else if (tab === 'servicos') {
      csvContent = 'Nome,Categoria,Preco,DuracaoMinutos,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.categoria || ''}","${r.preco || 0}","${r.duracaoMinutos || 30}","${r.ativo === false ? 'Inativo' : 'Ativo'}"`).join('\n')
    } else if (tab === 'produtos') {
      csvContent = 'Nome,Categoria,PrecoVenda,PrecoCusto,Estoque,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.categoria || ''}","${r.precoVenda || 0}","${r.precoCusto || 0}","${r.estoque || 0}","${r.ativo === false ? 'Inativo' : 'Ativo'}"`).join('\n')
    } else if (tab === 'formasPagamento') {
      csvContent = 'Nome,Tipo,TaxaOperacional,PrazoDias,Status\n' +
        lista.map((r) => `"${r.nome || ''}","${r.tipo || ''}","${r.taxaOperacional || 0}","${r.prazoDias || 0}","${r.ativo === false ? 'Inativo' : 'Ativo'}"`).join('\n')
    } else if (tab === 'unidades') {
      csvContent = 'Codigo,Nome,CNPJ,Telefone,Email,Status\n' +
        lista.map((r) => `"${r.codigo || ''}","${r.nome || ''}","${r.cnpj || ''}","${r.telefone || ''}","${r.email || ''}","${r.ativo === false ? 'Inativo' : 'Ativo'}"`).join('\n')
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `cadastros_${tab}_${empresa?.nome || 'empresa'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('Planilha CSV gerada e baixada com sucesso!')
  }

  // Filtragem e busca
  const registrosFiltrados = useMemo(() => {
    let lista = dados[tab] || []

    if (filtroStatus === 'ativos') {
      lista = lista.filter((r) => r.status === 'ativo' || r.status === 'ativa' || r.ativo === true || (!r.status && r.bloqueado === false))
    } else if (filtroStatus === 'inativos') {
      lista = lista.filter((r) => r.status === 'inativo' || r.status === 'desligado' || r.status === 'afastado' || r.ativo === false || r.bloqueado === true)
    }

    if (!busca.trim()) return lista
    const q = busca.toLowerCase().trim()
    return lista.filter((item) => {
      const nome = String(item.nome || '').toLowerCase()
      const email = String(item.email || '').toLowerCase()
      const tel = String(item.telefone || '').toLowerCase()
      const doc = String(item.cpf || item.cnpj || item.cpfCnpj || item.codigo || '').toLowerCase()
      const cargo = String(item.cargo || item.tipoUsuario || item.categoria || item.tipo || '').toLowerCase()
      return nome.includes(q) || email.includes(q) || tel.includes(q) || doc.includes(q) || cargo.includes(q)
    })
  }, [dados, tab, busca, filtroStatus])

  // Contadores para métricas do topo
  const kpis = useMemo(() => {
    const totalFunc = dados.funcionarios.length
    const funcAtivos = dados.funcionarios.filter((f) => f.status === 'ativo' || f.ativo !== false).length
    const totalUsers = dados.usuarios.length
    const totalCli = dados.clientes.length
    const totalCatalogo = dados.servicos.length + dados.produtos.length
    return { totalFunc, funcAtivos, totalUsers, totalCli, totalCatalogo }
  }, [dados])

  return (
    <div className="page" style={{ maxWidth: '100%', minWidth: 0, paddingBottom: 60 }}>
      {/* Top Header com Seletor de Empresa */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#12283F' }}>
              🗂️ Cadastros Mestres da Plataforma
            </h1>
            <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 12, fontWeight: 600 }}>
              Multitenant Seguro
            </span>
          </div>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Base central integrada a todos os módulos, comandas, PDV e relatórios da empresa.</span>
            {empresasPlataforma.length > 0 ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FF6B2C' }}>🏢 Empresa Ativa:</span>
                <select
                  value={empresaAtivaId}
                  onChange={(e) => alternarEmpresa(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontWeight: 700, color: '#1e293b', fontSize: 13, cursor: 'pointer', outline: 'none' }}
                >
                  {empresasPlataforma.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nomeFantasia || emp.nome} {emp.ativa ? '' : '(Inativa)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {/* Botões de Ação Topo */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => carregar(empresaAtivaId)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>↺</span> {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportarCSV} title="Exportar tabela atual para CSV">
            📥 Exportar CSV
          </button>
          <Link to="/admin/empresas" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            🏢 Todas as Empresas
          </Link>
          {podeGerenciarEmpresas && (
            <button className="btn btn-secondary btn-sm" onClick={() => setModalEmpresa(true)}>
              + Nova Empresa
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C', color: '#fff', fontWeight: 600 }}>
            + Novo {aba.singular}
          </button>
        </div>
      </div>

      {/* KPI Cards de Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #3b82f6', background: '#fff' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>👔 Equipe & Colaboradores</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
            {kpis.totalFunc} <small style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>({kpis.funcAtivos} ativos)</small>
          </div>
        </div>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #8b5cf6', background: '#fff' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>🔐 Usuários de Sistema</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{kpis.totalUsers}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #10b981', background: '#fff' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>👥 Clientes Cadastrados</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{kpis.totalCli}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', borderLeft: '4px solid #FF6B2C', background: '#fff' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>📦 Catálogo & Revenda</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{kpis.totalCatalogo} itens</div>
        </div>
      </div>

      {/* Abas Principais de Cadastros */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 16 }}>
        {TABS.map((item) => {
          const ativo = item.id === tab
          const qtd = (dados[item.id] || []).length
          return (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setBusca(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                background: ativo ? '#FF6B2C' : 'transparent',
                color: ativo ? '#fff' : '#64748b',
                fontWeight: ativo ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{item.icone}</span>
              <span>{item.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 10,
                  background: ativo ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: ativo ? '#fff' : '#475569',
                  fontWeight: 600,
                }}
              >
                {qtd}
              </span>
            </button>
          )
        })}
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${aba.label} por nome, documento, contato ou cargo...`}
            style={{ width: '100%', maxWidth: 440, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
        </div>

        {/* Pílulas de filtro de status */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['todos', 'ativos', 'inativos'].map((st) => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                border: filtroStatus === st ? '1px solid #FF6B2C' : '1px solid #e2e8f0',
                background: filtroStatus === st ? 'rgba(255,107,44,0.1)' : '#fff',
                color: filtroStatus === st ? '#FF6B2C' : '#64748b',
                fontSize: 12,
                fontWeight: filtroStatus === st ? 700 : 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Dados */}
      <div className="card" style={{ padding: 0, overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '12px 14px' }}>NOME / IDENTIFICAÇÃO</th>
              {tab === 'funcionarios' && (
                <>
                  <th style={{ padding: '12px 14px' }}>CARGO & DEPARTAMENTO</th>
                  <th style={{ padding: '12px 14px' }}>CONTATO</th>
                  <th style={{ padding: '12px 14px' }}>SALÁRIO BASE</th>
                  <th style={{ padding: '12px 14px' }}>STATUS</th>
                </>
              )}
              {tab === 'fornecedores' && (
                <>
                  <th style={{ padding: '12px 14px' }}>CNPJ / I.E.</th>
                  <th style={{ padding: '12px 14px' }}>CONTATO</th>
                  <th style={{ padding: '12px 14px' }}>CONDIÇÃO PGTO</th>
                  <th style={{ padding: '12px 14px' }}>STATUS</th>
                </>
              )}
              {tab === 'usuarios' && (
                <>
                  <th style={{ padding: '12px 14px' }}>FUNÇÃO</th>
                  <th style={{ padding: '12px 14px' }}>PERFIS LIBERADOS</th>
                  <th style={{ padding: '12px 14px' }}>CONTATO</th>
                  <th style={{ padding: '12px 14px' }}>ACESSO</th>
                </>
              )}
              {tab === 'clientes' && (
                <>
                  <th style={{ padding: '12px 14px' }}>DOCUMENTO / CIDADE</th>
                  <th style={{ padding: '12px 14px' }}>TELEFONE & EMAIL</th>
                  <th style={{ padding: '12px 14px' }}>LIMITE CRÉDITO</th>
                  <th style={{ padding: '12px 14px' }}>SITUAÇÃO</th>
                </>
              )}
              {tab === 'servicos' && (
                <>
                  <th style={{ padding: '12px 14px' }}>CATEGORIA</th>
                  <th style={{ padding: '12px 14px' }}>VALOR</th>
                  <th style={{ padding: '12px 14px' }}>DURAÇÃO</th>
                  <th style={{ padding: '12px 14px' }}>STATUS</th>
                </>
              )}
              {tab === 'produtos' && (
                <>
                  <th style={{ padding: '12px 14px' }}>CATEGORIA</th>
                  <th style={{ padding: '12px 14px' }}>PREÇO VENDA</th>
                  <th style={{ padding: '12px 14px' }}>PREÇO CUSTO</th>
                  <th style={{ padding: '12px 14px' }}>ESTOQUE</th>
                  <th style={{ padding: '12px 14px' }}>STATUS</th>
                </>
              )}
              {tab === 'formasPagamento' && (
                <>
                  <th style={{ padding: '12px 14px' }}>TIPO OPERACIONAL</th>
                  <th style={{ padding: '12px 14px' }}>TAXA (%)</th>
                  <th style={{ padding: '12px 14px' }}>PRAZO (DIAS)</th>
                  <th style={{ padding: '12px 14px' }}>STATUS</th>
                </>
              )}
              {tab === 'unidades' && (
                <>
                  <th style={{ padding: '12px 14px' }}>CÓDIGO</th>
                  <th style={{ padding: '12px 14px' }}>CNPJ</th>
                  <th style={{ padding: '12px 14px' }}>FUSO HORÁRIO</th>
                  <th style={{ padding: '12px 14px' }}>STATUS</th>
                </>
              )}
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px' }} />
                  Carregando {aba.label.toLowerCase()}...
                </td>
              </tr>
            ) : registrosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                  Nenhum registro encontrado em {aba.label} para esta empresa.
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={abrirNovo}>
                      + Cadastrar Primeiro {aba.singular}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              registrosFiltrados.map((registro) => {
                const isAtivo = registro.status === 'ativo' || registro.status === 'ativa' || registro.ativo === true || (registro.bloqueado === false)
                return (
                  <tr key={registro.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {/* Nome / Identificação */}
                    <td style={{ padding: '12px 14px' }}>
                      <strong style={{ color: '#1e293b' }}>{registro.nome || registro.nomeFantasia}</strong>
                      {registro.tipo && <span style={{ marginLeft: 6, fontSize: 10, background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{registro.tipo.toUpperCase()}</span>}
                      {registro.email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email}</div>}
                    </td>

                    {/* Funcionarios */}
                    {tab === 'funcionarios' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontWeight: 500, color: '#334155' }}>{registro.cargo || 'Colaborador'}</span>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.departamento || 'Operacional'}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div>{registro.telefone || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {registro.salario ? fmtR(registro.salario) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            title="Clique para alternar status"
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.status || (isAtivo ? 'ativo' : 'inativo'))}18`,
                              color: statusColor(registro.status || (isAtivo ? 'ativo' : 'inativo')),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.status || (isAtivo ? 'ativo' : 'inativo')}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Fornecedores */}
                    {tab === 'fornecedores' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <div>{registro.cnpj || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.inscricaoEstadual || ''}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div>{registro.telefone || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email || ''}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{registro.condicaoPagamento || 'À vista'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.status)}18`,
                              color: statusColor(registro.status),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.status || 'ativo'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Usuarios */}
                    {tab === 'usuarios' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {TIPOS_USUARIO.find((tipo) => tipo.id === registro.tipoUsuario)?.nome || registro.tipoUsuario || 'Operador'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, color: '#475569' }}>
                            {(() => {
                              const raw = registro.perfis || registro.roles || []
                              let perfList = []
                              if (Array.isArray(raw)) {
                                perfList = raw
                              } else if (typeof raw === 'string') {
                                if (raw.startsWith('{') && raw.endsWith('}')) {
                                  perfList = raw.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
                                } else {
                                  perfList = [raw]
                                }
                              }
                              return perfList.map((p) => PERFIS_ACESSO.find((item) => item.id === p)?.nome || p).join(' · ') || 'Padrão'
                            })()}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{registro.telefone || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.ativo)}18`,
                              color: statusColor(registro.ativo),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.ativo === false ? 'Bloqueado' : 'Ativo'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Clientes */}
                    {tab === 'clientes' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <div>{registro.documentoMascarado || registro.cpfCnpj || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.cidade || registro.endereco || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 500 }}>{registro.telefone || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {registro.limiteCreditoMensal ? fmtR(registro.limiteCreditoMensal) : 'R$ 500,00'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.bloqueado ? 'inativo' : 'ativo')}18`,
                              color: statusColor(registro.bloqueado ? 'inativo' : 'ativo'),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.bloqueado ? 'Bloqueado' : 'Ativo'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Servicos */}
                    {tab === 'servicos' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                            {registro.categoria || 'Geral'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ color: '#0f172a' }}>{fmtR(registro.preco)}</strong>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{registro.duracaoMinutos || 30} min</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.ativo)}18`,
                              color: statusColor(registro.ativo),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.ativo === false ? 'Inativo' : 'Ativo'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Produtos */}
                    {tab === 'produtos' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                            {registro.categoria || 'Revenda'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ color: '#0f172a' }}>{fmtR(registro.precoVenda)}</strong>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {registro.precoCusto ? fmtR(registro.precoCusto) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ color: Number(registro.estoque || 0) <= 0 ? '#ef4444' : '#10b981' }}>
                            {registro.estoque ?? 0} un
                          </strong>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.ativo)}18`,
                              color: statusColor(registro.ativo),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.ativo === false ? 'Inativo' : 'Ativo'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Formas de Pagamento */}
                    {tab === 'formasPagamento' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11, textTransform: 'capitalize' }}>
                            {registro.tipo || 'dinheiro'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{registro.taxaOperacional ? `${registro.taxaOperacional}%` : '0%'}</td>
                        <td style={{ padding: '12px 14px' }}>{registro.prazoDias ? `${registro.prazoDias} dias` : 'Imediato (D+0)'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.ativo)}18`,
                              color: statusColor(registro.ativo),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.ativo === false ? 'Inativo' : 'Ativo'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Unidades & Lojas */}
                    {tab === 'unidades' && (
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{registro.codigo || 'MATRIZ'}</code>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{registro.cnpj || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>{registro.timezone || 'America/Sao_Paulo'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => alternarStatus(registro)}
                            style={{
                              border: 'none',
                              cursor: 'pointer',
                              background: `${statusColor(registro.ativo)}18`,
                              color: statusColor(registro.ativo),
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 12,
                            }}
                          >
                            {registro.ativo === false ? 'Inativa' : 'Ativa'}
                          </button>
                        </td>
                      </>
                    )}

                    {/* Ações (Editar e Excluir) */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(registro)} style={{ marginRight: 4 }}>
                        ✏️ Editar
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => excluir(registro)}>
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nova Empresa */}
      {modalEmpresa && (
        <Modal title="Nova Empresa com Isolamento Próprio" onClose={() => setModalEmpresa(false)} width={640}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            <div className="card" style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.2)' }}>
              A nova empresa terá cadastros, estoque, comandas, financeiro e usuários próprios. O administrador inicial visualizará apenas os dados dela.
            </div>
            <Linha>
              <Campo label="Razão Social *"><input value={empresaForm.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} placeholder="Ex: Barbearia Centro Ltda" /></Campo>
              <Campo label="Nome Fantasia"><input value={empresaForm.nomeFantasia} onChange={(e) => setEmpresaForm({ ...empresaForm, nomeFantasia: e.target.value })} placeholder="Ex: Barbearia Centro" /></Campo>
            </Linha>
            <Linha>
              <Campo label="CNPJ"><input value={empresaForm.cnpj} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></Campo>
              <Campo label="Inscrição Estadual"><input value={empresaForm.inscricaoEstadual} onChange={(e) => setEmpresaForm({ ...empresaForm, inscricaoEstadual: e.target.value })} /></Campo>
            </Linha>
            <Linha>
              <Campo label="E-mail Corporativo"><input type="email" value={empresaForm.email} onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })} placeholder="contato@empresa.com" /></Campo>
              <Campo label="Telefone"><input value={empresaForm.telefone} onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })} placeholder="(65) 3000-0000" /></Campo>
            </Linha>
            <Campo label="Endereço Fiscal"><input value={empresaForm.endereco} onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" /></Campo>
            <h3 style={{ margin: '12px 0 4px', color: '#12283F', fontSize: 14, fontWeight: 600 }}>Administrador Inicial da Empresa</h3>
            <Linha>
              <Campo label="Nome do Administrador *"><input value={empresaForm.administrador.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, nome: e.target.value } })} /></Campo>
              <Campo label="E-mail de Acesso *"><input type="email" value={empresaForm.administrador.email} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, email: e.target.value } })} /></Campo>
            </Linha>
            <Campo label="Senha Inicial (mínimo 8 caracteres) *"><input type="password" value={empresaForm.administrador.senhaInicial} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, senhaInicial: e.target.value } })} /></Campo>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setModalEmpresa(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={criarEmpresa} disabled={saving}>
                {saving ? 'Criando Empresa...' : 'Criar Empresa'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Formulário CRUD para Todos os Cadastros */}
      {modal && (
        <Modal title={`${modal.modo === 'novo' ? 'Novo' : 'Editar'} ${aba.singular}`} onClose={() => setModal(null)} width={660}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            {tab === 'funcionarios' && <FuncionarioForm form={form} setForm={setForm} />}
            {tab === 'fornecedores' && <FornecedorForm form={form} setForm={setForm} />}
            {tab === 'usuarios' && <UsuarioForm form={form} setForm={setForm} isNew={modal.modo === 'novo'} />}
            {tab === 'clientes' && <ClienteForm form={form} setForm={setForm} />}
            {tab === 'servicos' && <ServicoForm form={form} setForm={setForm} />}
            {tab === 'produtos' && <ProdutoForm form={form} setForm={setForm} />}
            {tab === 'formasPagamento' && <FormaPagamentoForm form={form} setForm={setForm} />}
            {tab === 'unidades' && <UnidadeForm form={form} setForm={setForm} />}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving} style={{ background: '#FF6B2C', borderColor: '#FF6B2C' }}>
                {saving ? 'Salvando...' : 'Salvar Registro'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{label}</label>
      {children}
    </div>
  )
}

function Linha({ children }) {
  return (
    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
      {children}
    </div>
  )
}

function FuncionarioForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome Completo *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Bruno Mendes" />
        </Campo>
        <Campo label="CPF">
          <input value={form.cpf} onChange={(e) => update('cpf', e.target.value)} placeholder="000.000.000-00" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Cargo / Função">
          <input value={form.cargo} onChange={(e) => update('cargo', e.target.value)} placeholder="Ex: Barbeiro Especialista, Gerente, Caixa" />
        </Campo>
        <Campo label="Departamento">
          <input value={form.departamento} onChange={(e) => update('departamento', e.target.value)} placeholder="Ex: Atendimento, Barbearia, Recepção" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Telefone / WhatsApp">
          <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(65) 99999-9999" />
        </Campo>
        <Campo label="E-mail">
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="colaborador@empresa.com" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Data de Admissão">
          <input type="date" value={form.dataAdmissao || ''} onChange={(e) => update('dataAdmissao', e.target.value)} />
        </Campo>
        <Campo label="Salário Base / Fixo (R$)">
          <input type="number" step="50" value={form.salario || ''} onChange={(e) => update('salario', e.target.value)} placeholder="0.00" />
        </Campo>
      </Linha>
      <Campo label="Situação">
        <select value={form.status} onChange={(e) => update('status', e.target.value)}>
          <option value="ativo">Ativo (visível na agenda e no ERP)</option>
          <option value="afastado">Afastado</option>
          <option value="desligado">Desligado / Inativo</option>
        </select>
      </Campo>
      <Campo label="Observações">
        <textarea rows="2" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} placeholder="Comissão acordada, chave pix, horários especiais..." />
      </Campo>
    </>
  )
}

function FornecedorForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome / Razão Social *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Distribuidora Cosméticos & Barba" />
        </Campo>
        <Campo label="CNPJ">
          <input value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Inscrição Estadual">
          <input value={form.inscricaoEstadual} onChange={(e) => update('inscricaoEstadual', e.target.value)} />
        </Campo>
        <Campo label="Condição de Pagamento Padrão">
          <input value={form.condicaoPagamento} onChange={(e) => update('condicaoPagamento', e.target.value)} placeholder="Ex: 30 dias, À vista, 15/30 dias" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="E-mail">
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="compras@fornecedor.com" />
        </Campo>
        <Campo label="Telefone">
          <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(65) 3000-0000" />
        </Campo>
      </Linha>
      <Campo label="Endereço Completo">
        <input value={form.endereco} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade/UF" />
      </Campo>
      <Campo label="Situação">
        <select value={form.status} onChange={(e) => update('status', e.target.value)}>
          <option value="ativo">Ativo (habilitado para pedidos e cotações)</option>
          <option value="inativo">Inativo</option>
        </select>
      </Campo>
    </>
  )
}

function UsuarioForm({ form, setForm, isNew }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  const perfis = Array.isArray(form.perfis) ? form.perfis : []

  const alternarPerfil = (id) => {
    if (perfis.includes(id)) {
      update('perfis', perfis.filter((p) => p !== id))
    } else {
      update('perfis', [...perfis, id])
    }
  }

  const selecionarTipo = (tipoId) => {
    update('tipoUsuario', tipoId)
    if (tipoId === 'admin') update('perfis', ['admin', 'operacao', 'financeiro', 'estoque', 'relatorios', 'cadastros'])
    else if (tipoId === 'gerente') update('perfis', ['operacao', 'financeiro', 'estoque', 'relatorios'])
    else if (tipoId === 'operador_pdv') update('perfis', ['operacao'])
    else if (tipoId === 'estoquista') update('perfis', ['estoque'])
    else if (tipoId === 'recepcao') update('perfis', ['operacao', 'cadastros'])
    else if (tipoId === 'consultor') update('perfis', ['relatorios'])
  }

  const permissoesAtivas = Array.from(
    new Set(
      perfis.flatMap((p) => {
        const perf = PERFIS_ACESSO.find((item) => item.id === p)
        return perf ? [perf.nome] : []
      })
    )
  )

  return (
    <>
      <Linha>
        <Campo label="Nome Completo *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Rodrigo Ribeiro" />
        </Campo>
        <Campo label="Telefone / WhatsApp">
          <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(65) 99999-9999" />
        </Campo>
      </Linha>
      <Campo label="E-mail de Login *">
        <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="usuario@empresa.com" />
      </Campo>
      <Campo label="Função Principal *">
        <select value={form.tipoUsuario || 'operador_pdv'} onChange={(e) => selecionarTipo(e.target.value)}>
          {TIPOS_USUARIO.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nome} — {tipo.descricao}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Perfis de Acesso (Permissões somadas)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 4 }}>
          {PERFIS_ACESSO.map((perfil) => (
            <label key={perfil.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', background: perfis.includes(perfil.id) ? 'rgba(18,40,63,.04)' : '#fff' }}>
              <input
                type="checkbox"
                checked={perfis.includes(perfil.id)}
                onChange={() => alternarPerfil(perfil.id)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong style={{ fontSize: 13, color: '#12283F' }}>{perfil.nome}</strong>
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{perfil.modulos}</small>
              </span>
            </label>
          ))}
        </div>
      </Campo>
      <div className="card" style={{ fontSize: 12, padding: 10, background: 'rgba(18,40,63,.04)', borderRadius: 6 }}>
        <strong style={{ color: '#12283F' }}>Módulos liberados:</strong>
        <div style={{ marginTop: 4, color: 'var(--muted)' }}>
          {permissoesAtivas.length ? permissoesAtivas.join(' · ') : 'Selecione ao menos um perfil de acesso.'}
        </div>
      </div>
      <Campo label={isNew ? 'Senha Inicial (mínimo 8 caracteres) *' : 'Nova Senha (deixe em branco para manter a atual)'}>
        <input type="password" value={form.senhaInicial} onChange={(e) => update('senhaInicial', e.target.value)} placeholder="••••••••" />
      </Campo>
      <Campo label="Situação">
        <select value={form.ativo ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}>
          <option value="ativo">Ativo (acesso permitido)</option>
          <option value="inativo">Inativo (acesso bloqueado)</option>
        </select>
      </Campo>
    </>
  )
}

function ClienteForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome Completo do Cliente *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Roberto Silva" />
        </Campo>
        <Campo label="Tipo">
          <select value={form.tipo || 'pf'} onChange={(e) => update('tipo', e.target.value)}>
            <option value="pf">Pessoa Física (PF)</option>
            <option value="pj">Pessoa Jurídica (PJ)</option>
          </select>
        </Campo>
      </Linha>
      <Linha>
        <Campo label="CPF / CNPJ">
          <input value={form.cpfCnpj || ''} onChange={(e) => update('cpfCnpj', e.target.value)} placeholder="000.000.000-00" />
        </Campo>
        <Campo label="Telefone / WhatsApp">
          <input value={form.telefone || ''} onChange={(e) => update('telefone', e.target.value)} placeholder="(65) 99999-9999" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="E-mail">
          <input type="email" value={form.email || ''} onChange={(e) => update('email', e.target.value)} placeholder="cliente@email.com" />
        </Campo>
        <Campo label="Limite de Crédito Mensal (R$)">
          <input type="number" step="50" value={form.limiteCreditoMensal ?? 500} onChange={(e) => update('limiteCreditoMensal', Number(e.target.value))} />
        </Campo>
      </Linha>
      <Campo label="Endereço Completo">
        <input value={form.endereco || ''} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade" />
      </Campo>
      <Campo label="Observações & Histórico">
        <textarea rows="2" value={form.observacao || ''} onChange={(e) => update('observacao', e.target.value)} placeholder="Preferências de atendimento, notas de relacionamento..." />
      </Campo>
    </>
  )
}

function ServicoForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome do Serviço *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Corte Degradê Navalhado" />
        </Campo>
        <Campo label="Categoria">
          <input value={form.categoria || ''} onChange={(e) => update('categoria', e.target.value)} placeholder="Ex: Cabelo, Barba, Combos, Estética" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Preço de Venda (R$) *">
          <input type="number" step="0.5" value={form.preco} onChange={(e) => update('preco', e.target.value)} placeholder="Ex: 80.00" />
        </Campo>
        <Campo label="Duração Estimada (minutos)">
          <input type="number" step="5" value={form.duracaoMinutos || 30} onChange={(e) => update('duracaoMinutos', e.target.value)} placeholder="30" />
        </Campo>
      </Linha>
      <Campo label="Descrição / Detalhes">
        <textarea rows="2" value={form.descricao || ''} onChange={(e) => update('descricao', e.target.value)} placeholder="O que inclui este serviço, diferenciais..." />
      </Campo>
      <Campo label="Situação">
        <select value={form.ativo !== false ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}>
          <option value="ativo">Ativo (visível na agenda e no PDV)</option>
          <option value="inativo">Inativo</option>
        </select>
      </Campo>
    </>
  )
}

function ProdutoForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome do Produto *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Pomada Efeito Matte 150g" />
        </Campo>
        <Campo label="Categoria">
          <input value={form.categoria || ''} onChange={(e) => update('categoria', e.target.value)} placeholder="Ex: Finalizadores, Bebidas, Barba" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Preço de Venda (R$) *">
          <input type="number" step="0.5" value={form.precoVenda || ''} onChange={(e) => update('precoVenda', e.target.value)} placeholder="Ex: 65.00" />
        </Campo>
        <Campo label="Preço de Custo (R$)">
          <input type="number" step="0.5" value={form.precoCusto || ''} onChange={(e) => update('precoCusto', e.target.value)} placeholder="Ex: 25.00" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Estoque Atual (unidades)">
          <input type="number" value={form.estoque ?? 0} onChange={(e) => update('estoque', e.target.value)} placeholder="0" />
        </Campo>
        <Campo label="Situação">
          <select value={form.ativo !== false ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}>
            <option value="ativo">Ativo (disponível para venda no PDV)</option>
            <option value="inativo">Inativo</option>
          </select>
        </Campo>
      </Linha>
    </>
  )
}

function FormaPagamentoForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome da Conta / Forma *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Pix Matriz, Caixa Físico, Cartão Stone" />
        </Campo>
        <Campo label="Tipo Operacional">
          <select value={form.tipo || 'dinheiro'} onChange={(e) => update('tipo', e.target.value)}>
            {TIPOS_PAGAMENTO.map((tp) => (
              <option key={tp.id} value={tp.id}>{tp.nome}</option>
            ))}
          </select>
        </Campo>
      </Linha>
      <Linha>
        <Campo label="Taxa Operacional (%)">
          <input type="number" step="0.1" value={form.taxaOperacional ?? 0} onChange={(e) => update('taxaOperacional', e.target.value)} placeholder="0.0" />
        </Campo>
        <Campo label="Prazo de Liquidação (dias)">
          <input type="number" value={form.prazoDias ?? 0} onChange={(e) => update('prazoDias', e.target.value)} placeholder="0" />
        </Campo>
      </Linha>
      <Campo label="Observações & Detalhes da Conta">
        <textarea rows="2" value={form.observacao || ''} onChange={(e) => update('observacao', e.target.value)} placeholder="Agência, Conta ou Chave Pix para recebimento..." />
      </Campo>
      <Campo label="Situação">
        <select value={form.ativo !== false ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}>
          <option value="ativo">Ativo (visível no PDV e nas comandas)</option>
          <option value="inativo">Inativo</option>
        </select>
      </Campo>
    </>
  )
}

function UnidadeForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return (
    <>
      <Linha>
        <Campo label="Nome da Unidade / Loja *">
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Ex: Barbearia Dino - Filial Centro" />
        </Campo>
        <Campo label="Código da Unidade *">
          <input value={form.codigo} onChange={(e) => update('codigo', e.target.value.toUpperCase())} placeholder="Ex: FILIAL-01, MATRIZ" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="CNPJ da Unidade">
          <input value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
        </Campo>
        <Campo label="Telefone / WhatsApp">
          <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(65) 3000-0000" />
        </Campo>
      </Linha>
      <Linha>
        <Campo label="E-mail">
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="loja@empresa.com" />
        </Campo>
        <Campo label="Fuso Horário">
          <select value={form.timezone || 'America/Sao_Paulo'} onChange={(e) => update('timezone', e.target.value)}>
            <option value="America/Sao_Paulo">Horário de Brasília (America/Sao_Paulo)</option>
            <option value="America/Cuiaba">Horário de Cuiabá (America/Cuiaba - UTC-4)</option>
          </select>
        </Campo>
      </Linha>
      <Campo label="Situação">
        <select value={form.ativo !== false ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}>
          <option value="ativo">Ativa (operando)</option>
          <option value="inativo">Inativa</option>
        </select>
      </Campo>
    </>
  )
}
