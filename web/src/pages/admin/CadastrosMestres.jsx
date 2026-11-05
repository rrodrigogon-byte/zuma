import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, fmtR } from '../../lib/api'
import { a2Path } from '../../lib/tenant-api'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'
import Modal from '../../components/Modal'
import { Link } from 'react-router-dom'

const TABS = [
  { id: 'funcionarios', label: 'Funcionários & Equipe', icon: '👔', endpoint: '/funcionarios' },
  { id: 'fornecedores', label: 'Fornecedores', icon: '🚚', endpoint: '/fornecedores' },
  { id: 'usuarios', label: 'Usuários & Acessos', icon: '🔐', endpoint: '/usuarios-mestres' },
  { id: 'clientes', label: 'Clientes & Contas', icon: '👥', endpoint: '/clientes' },
  { id: 'servicos', label: 'Serviços & Preços', icon: '✂️', endpoint: '/servicos' },
  { id: 'produtos', label: 'Produtos & Revenda', icon: '📦', endpoint: '/produtos' },
]

const SINGULARES = {
  funcionarios: 'Funcionário',
  fornecedores: 'Fornecedor',
  usuarios: 'Usuário',
  clientes: 'Cliente',
  servicos: 'Serviço',
  produtos: 'Produto',
}

const EMPTY = {
  funcionarios: { nome: '', cpf: '', email: '', telefone: '', cargo: '', departamento: '', dataAdmissao: '', salario: '', status: 'ativo', observacao: '' },
  fornecedores: { nome: '', cnpj: '', inscricaoEstadual: '', email: '', telefone: '', endereco: '', condicaoPagamento: '30 dias', status: 'ativo', observacao: '' },
  usuarios: { nome: '', email: '', telefone: '', tipoUsuario: 'operador_pdv', perfis: ['operador_pdv'], senhaInicial: '', ativo: true },
  clientes: { nome: '', tipo: 'pf', cpfCnpj: '', email: '', telefone: '', endereco: '', limiteCreditoMensal: 500, diasVencimento: 30, observacao: '' },
  servicos: { nome: '', categoria: 'Cabelo', preco: '', duracaoMinutos: 30, descricao: '', ativo: true },
  produtos: { nome: '', categoria: 'Geral', precoVenda: '', precoCusto: '', estoque: 0, lojaId: '', ativo: true },
}

const TIPOS_USUARIO = [
  { id: 'administrador', nome: 'Administrador', descricao: 'Gestão completa da empresa', perfilPadrao: 'administrador' },
  { id: 'gerente', nome: 'Gerente', descricao: 'Gestão operacional e financeira', perfilPadrao: 'gerente_operacional' },
  { id: 'barbeiro', nome: 'Barbeiro / Especialista', descricao: 'Agenda, atendimentos e comandas', perfilPadrao: 'operador_pdv' },
  { id: 'operador_pdv', nome: 'Operador de PDV', descricao: 'Vendas, comandas e caixa', perfilPadrao: 'operador_pdv' },
  { id: 'caixa', nome: 'Caixa', descricao: 'Recebimentos e fechamento', perfilPadrao: 'caixa' },
  { id: 'estoque', nome: 'Gerente de Estoque', descricao: 'Inventário e compras', perfilPadrao: 'gerente_estoque' },
  { id: 'consultor', nome: 'Consultor', descricao: 'Consultas e relatórios', perfilPadrao: 'consultor' },
]

const PERFIS_ACESSO = [
  { id: 'administrador', nome: 'Administrador', modulos: 'Todos os módulos, parâmetros e segurança' },
  { id: 'gerente_operacional', nome: 'Gerente Operacional', modulos: 'Operação, financeiro, agenda e equipe' },
  { id: 'operador_pdv', nome: 'Operador de PDV', modulos: 'PDV, comandas, pagamentos e clientes' },
  { id: 'caixa', nome: 'Caixa', modulos: 'Pagamentos, recebimentos e fechamento de caixa' },
  { id: 'gerente_estoque', nome: 'Gerente de Estoque', modulos: 'Estoque, fornecedores e movimentações' },
  { id: 'garcom', nome: 'Atendimento / Recepção', modulos: 'Agenda, recepção e comandas' },
  { id: 'consultor', nome: 'Consultor', modulos: 'Dashboards e relatórios apenas para leitura' },
]

function statusColor(status) {
  if (['ativo', true, 'baixo'].includes(status)) return '#2ecc71'
  if (['afastado', 'medio'].includes(status)) return '#FFB703'
  return '#e74c3c'
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
  })
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
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

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [funcionarios, fornecedores, usuarios, clientes, servicos, produtos, contexto] = await Promise.all([
        api.get(a2Path('/funcionarios')).catch(() => ({ funcionarios: [] })),
        api.get(a2Path('/fornecedores')).catch(() => ({ fornecedores: [] })),
        api.get(a2Path('/usuarios-mestres')).catch(() => ({ usuarios: [] })),
        api.get(a2Path('/clientes')).catch(() => ({ clientes: [] })),
        api.get(a2Path('/servicos')).catch(() => ({ servicos: [] })),
        api.get(a2Path('/produtos')).catch(() => ({ produtos: [] })),
        api.get(a2Path('/empresa-ativa')).catch(() => ({})),
      ])
      setDados({
        funcionarios: funcionarios.funcionarios || [],
        fornecedores: fornecedores.fornecedores || [],
        usuarios: usuarios.usuarios || [],
        clientes: clientes.clientes || [],
        servicos: servicos.servicos || [],
        produtos: produtos.produtos || [],
      })
      setEmpresa(contexto.empresa || contexto || null)
    } catch (error) {
      toast(error.message || 'Não foi possível carregar os cadastros mestres.', true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const criarEmpresa = async () => {
    if (!empresaForm.nome || !empresaForm.administrador.nome || !empresaForm.administrador.email || String(empresaForm.administrador.senhaInicial || '').length < 8) {
      return toast('Informe os dados da empresa e o administrador inicial com senha de ao menos 8 caracteres.', true)
    }
    setSaving(true)
    try {
      await api.post('/api/admin/plataforma/empresas', empresaForm)
      toast('Empresa criada com isolamento próprio. Faça novo login para selecioná-la na sessão.')
      setModalEmpresa(false)
      setEmpresaForm({ nome: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', endereco: '', email: '', telefone: '', permitirEstoqueNegativo: false, administrador: { nome: '', email: '', senhaInicial: '' } })
      carregar()
    } catch (error) {
      toast(error.message || 'Não foi possível criar a empresa.', true)
    } finally {
      setSaving(false)
    }
  }

  const abrirNovo = () => {
    setForm(EMPTY[tab] || {})
    setModal({ modo: 'novo' })
  }

  const abrirEditar = (registro) => {
    const base = { ...(EMPTY[tab] || {}), ...registro }
    if (tab === 'usuarios') {
      base.tipoUsuario = registro.tipoUsuario || 'operador_pdv'
      base.senhaInicial = ''
    }
    if (tab === 'servicos') {
      base.preco = registro.preco != null ? registro.preco : ''
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
        payload.perfis = Array.isArray(form.perfis) ? form.perfis : []
        if (!payload.perfis.length) return toast('Selecione ao menos um perfil de acesso.', true)
        delete payload.roles
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

      if (modal?.modo === 'novo') {
        await api.post(a2Path(aba.endpoint), payload)
      } else {
        await api.patch(a2Path(`${aba.endpoint}/${modal.id}`), payload)
      }

      toast(`${SINGULARES[tab]} ${modal?.modo === 'novo' ? 'cadastrado' : 'atualizado'} com sucesso!`)
      setModal(null)
      carregar()
    } catch (error) {
      toast(error.message || 'Erro ao salvar cadastro.', true)
    } finally {
      setSaving(false)
    }
  }

  const excluir = async (registro) => {
    const nome = registro.nome || 'este registro'
    if (!window.confirm(`Tem certeza que deseja excluir "${nome}" dos cadastros da empresa ativa?`)) return
    try {
      await api.delete(a2Path(`${aba.endpoint}/${registro.id}`))
      toast(`${SINGULARES[tab]} excluído com sucesso.`)
      carregar()
    } catch (error) {
      toast(error.message || 'Erro ao excluir cadastro.', true)
    }
  }

  // Filtragem de registros pela busca
  const registrosFiltrados = useMemo(() => {
    const lista = dados[tab] || []
    if (!busca.trim()) return lista
    const q = busca.toLowerCase().trim()
    return lista.filter((item) => {
      const nome = String(item.nome || '').toLowerCase()
      const email = String(item.email || '').toLowerCase()
      const tel = String(item.telefone || '').toLowerCase()
      const doc = String(item.cpf || item.cnpj || item.cpfCnpj || '').toLowerCase()
      const cargo = String(item.cargo || item.tipoUsuario || item.categoria || '').toLowerCase()
      return nome.includes(q) || email.includes(q) || tel.includes(q) || doc.includes(q) || cargo.includes(q)
    })
  }, [dados, tab, busca])

  return (
    <div className="page" style={{ maxWidth: '100%', minWidth: 0 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#12283F' }}>
            🗂️ Cadastros Mestres
          </h1>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            Dados centrais e unificados compartilhados por todos os módulos da empresa ativa.
            {empresa?.nomeFantasia ? (
              <strong style={{ color: '#FF6B2C', marginLeft: 8, background: 'rgba(255,107,44,.08)', padding: '3px 8px', borderRadius: 6 }}>
                Empresa: {empresa.nomeFantasia}
              </strong>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>↺</span> {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <Link to="/admin/empresas" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            🏢 Todas as Empresas
          </Link>
          {podeGerenciarEmpresas && (
            <button className="btn btn-secondary btn-sm" onClick={() => setModalEmpresa(true)}>
              🏢 Nova Empresa
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={abrirNovo} style={{ background: '#FF6B2C', borderColor: '#FF6B2C', color: '#fff', fontWeight: 600 }}>
            + Novo {SINGULARES[tab]}
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="card" style={{ marginBottom: 16, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        {TABS.map((item) => {
          const qtd = (dados[item.id] || []).length
          const isActive = tab === item.id
          return (
            <button
              key={item.id}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setTab(item.id); setBusca('') }}
              style={{
                borderRadius: 8,
                padding: '6px 14px',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#12283F' : 'transparent',
                color: isActive ? '#fff' : 'var(--text)',
                borderColor: isActive ? '#12283F' : 'transparent',
                transition: 'all .15s ease'
              }}
            >
              {item.icon} {item.label}
              <span style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 11,
                background: isActive ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.06)',
                color: isActive ? '#fff' : 'var(--muted)',
                fontWeight: 600
              }}>
                {qtd}
              </span>
            </button>
          )
        })}
      </div>

      {/* Multi-Tenant Isolation Warning Banner */}
      <div className="card" style={{
        marginBottom: 16,
        padding: '10px 14px',
        border: '1px solid rgba(255,107,44,.25)',
        background: 'rgba(255,107,44,.05)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🛡️</span>
          <div>
            <strong style={{ color: '#FF6B2C', fontSize: 13 }}>Isolamento por empresa ativo.</strong>
            <span style={{ color: '#475569', fontSize: 12, marginLeft: 6 }}>
              Os registros abaixo pertencem exclusivamente à empresa <strong>{empresa?.nomeFantasia || 'ativa'}</strong> e alimentam os módulos de Operação, Agenda, Comandas, PDV e Financeiro.
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Total exibido: <strong>{registrosFiltrados.length}</strong> de {(dados[tab] || []).length}
        </div>
      </div>

      {/* Search and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', maxWidth: 450 }}>
          <input
            type="text"
            className="input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`🔍 Buscar ${SINGULARES[tab].toLowerCase()} por nome, contato, documento...`}
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>
        {busca && (
          <button className="btn btn-ghost btn-sm" onClick={() => setBusca('')} style={{ fontSize: 12 }}>
            ✕ Limpar busca
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="table-wrap" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              {tab === 'funcionarios' && (
                <>
                  <th>Colaborador</th>
                  <th>Cargo / Departamento</th>
                  <th>Contato</th>
                  <th>Salário</th>
                  <th>Status</th>
                </>
              )}
              {tab === 'fornecedores' && (
                <>
                  <th>Fornecedor</th>
                  <th>CNPJ / IE</th>
                  <th>Contato</th>
                  <th>Condição Pagto</th>
                  <th>Status</th>
                </>
              )}
              {tab === 'usuarios' && (
                <>
                  <th>Usuário</th>
                  <th>Função / Tipo</th>
                  <th>Perfis de Acesso</th>
                  <th>Contato</th>
                  <th>Status</th>
                </>
              )}
              {tab === 'clientes' && (
                <>
                  <th>Cliente</th>
                  <th>Documento / Cidade</th>
                  <th>Contato (Whats / Tel)</th>
                  <th>Limite Crédito</th>
                  <th>Score / Status</th>
                </>
              )}
              {tab === 'servicos' && (
                <>
                  <th>Serviço</th>
                  <th>Categoria</th>
                  <th>Preço de Venda</th>
                  <th>Duração</th>
                  <th>Status</th>
                </>
              )}
              {tab === 'produtos' && (
                <>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço Venda</th>
                  <th>Custo</th>
                  <th>Estoque</th>
                  <th>Status</th>
                </>
              )}
              <th style={{ width: 140, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="7" style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>⏳</div>
                  Carregando cadastros mestres da empresa ativa...
                </td>
              </tr>
            )}
            {!loading && registrosFiltrados.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
                  <strong>Nenhum registro encontrado nesta empresa.</strong>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {busca ? 'Nenhum resultado corresponde à sua busca.' : `Clique no botão "+ Novo ${SINGULARES[tab]}" para incluir o primeiro registro.`}
                  </div>
                </td>
              </tr>
            )}
            {!loading && registrosFiltrados.map((registro) => (
              <tr key={registro.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {tab === 'funcionarios' && (
                  <>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{registro.nome}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.cpf || 'CPF não informado'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: '#334155' }}>{registro.cargo || 'Colaborador'}</span>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.departamento || 'Geral'}</div>
                    </td>
                    <td>
                      <div>{registro.telefone || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email || ''}</div>
                    </td>
                    <td>
                      {registro.salario ? fmtR(registro.salario) : '—'}
                    </td>
                    <td>
                      <span className="badge" style={{ color: statusColor(registro.status), background: `${statusColor(registro.status)}18`, fontWeight: 600 }}>
                        {registro.status || 'ativo'}
                      </span>
                    </td>
                  </>
                )}

                {tab === 'fornecedores' && (
                  <>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{registro.nome}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.endereco || 'Endereço não informado'}</div>
                    </td>
                    <td>
                      <div>{registro.cnpj || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.inscricaoEstadual || ''}</div>
                    </td>
                    <td>
                      <div>{registro.telefone || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email || ''}</div>
                    </td>
                    <td>{registro.condicaoPagamento || 'À vista'}</td>
                    <td>
                      <span className="badge" style={{ color: statusColor(registro.status), background: `${statusColor(registro.status)}18`, fontWeight: 600 }}>
                        {registro.status || 'ativo'}
                      </span>
                    </td>
                  </>
                )}

                {tab === 'usuarios' && (
                  <>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{registro.nome}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {TIPOS_USUARIO.find((tipo) => tipo.id === registro.tipoUsuario)?.nome || registro.tipoUsuario || 'Operador de PDV'}
                      </span>
                    </td>
                    <td>
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
                    <td>{registro.telefone || '—'}</td>
                    <td>
                      <span className="badge" style={{ color: statusColor(registro.ativo), background: `${statusColor(registro.ativo)}18`, fontWeight: 600 }}>
                        {registro.ativo === false ? 'inativo' : 'ativo'}
                      </span>
                    </td>
                  </>
                )}

                {tab === 'clientes' && (
                  <>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{registro.nome}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</div>
                    </td>
                    <td>
                      <div>{registro.documentoMascarado || registro.cpfCnpj || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.cidade || registro.endereco || '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{registro.telefone || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email || ''}</div>
                    </td>
                    <td>
                      {registro.limiteCreditoMensal ? fmtR(registro.limiteCreditoMensal) : 'R$ 500,00'}
                    </td>
                    <td>
                      <span className="badge" style={{ color: statusColor(registro.bloqueado ? 'inativo' : 'ativo'), background: `${statusColor(registro.bloqueado ? 'inativo' : 'ativo')}18`, fontWeight: 600 }}>
                        {registro.bloqueado ? 'bloqueado' : 'ativo'}
                      </span>
                    </td>
                  </>
                )}

                {tab === 'servicos' && (
                  <>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{registro.nome}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.descricao || 'Sem descrição'}</div>
                    </td>
                    <td>
                      <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                        {registro.categoria || 'Geral'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{fmtR(registro.preco)}</strong>
                    </td>
                    <td>
                      {registro.duracaoMinutos || 30} min
                    </td>
                    <td>
                      <span className="badge" style={{ color: statusColor(registro.ativo), background: `${statusColor(registro.ativo)}18`, fontWeight: 600 }}>
                        {registro.ativo === false ? 'inativo' : 'ativo'}
                      </span>
                    </td>
                  </>
                )}

                {tab === 'produtos' && (
                  <>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{registro.nome}</strong>
                    </td>
                    <td>
                      <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                        {registro.categoria || 'Revenda'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{fmtR(registro.precoVenda)}</strong>
                    </td>
                    <td>
                      {registro.precoCusto ? fmtR(registro.precoCusto) : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: (registro.estoque || 0) <= 0 ? '#e74c3c' : '#2ecc71' }}>
                        {registro.estoque ?? 0} un
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ color: statusColor(registro.ativo), background: `${statusColor(registro.ativo)}18`, fontWeight: 600 }}>
                        {registro.ativo === false ? 'inativo' : 'ativo'}
                      </span>
                    </td>
                  </>
                )}

                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(registro)} style={{ marginRight: 4 }}>
                    ✏️ Editar
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#e74c3c' }} onClick={() => excluir(registro)}>
                    🗑️ Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nova Empresa */}
      {modalEmpresa && (
        <Modal title="Nova Empresa com Isolamento Próprio" onClose={() => setModalEmpresa(false)} width={640}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            <div className="card" style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.2)' }}>
              A nova empresa terá cadastros, cardápio, estoque, comandas, financeiro e usuários próprios. O administrador inicial visualizará apenas os dados dela.
            </div>
            <Linha>
              <Campo label="Razão Social *"><input value={empresaForm.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} placeholder="Ex: Barbearia Centro Ltda" /></Campo>
              <Campo label="Nome Fantasia"><input value={empresaForm.nomeFantasia} onChange={(e) => setEmpresaForm({ ...empresaForm, nomeFantasia: e.target.value })} placeholder="Ex: Barbearia Centro" /></Campo>
            </Linha>
            <Linha>
              <Campo label="CNPJ"><input inputMode="numeric" value={empresaForm.cnpj} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></Campo>
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
                {saving ? 'Criando...' : 'Criar Empresa Isolada'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Form CRUD */}
      {modal && (
        <Modal title={`${modal.modo === 'novo' ? 'Novo' : 'Editar'} ${SINGULARES[tab]}`} onClose={() => setModal(null)} width={640}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            {tab === 'funcionarios' && <FuncionarioForm form={form} setForm={setForm} />}
            {tab === 'fornecedores' && <FornecedorForm form={form} setForm={setForm} />}
            {tab === 'usuarios' && <UsuarioForm form={form} setForm={setForm} isNew={modal.modo === 'novo'} />}
            {tab === 'clientes' && <ClienteForm form={form} setForm={setForm} />}
            {tab === 'servicos' && <ServicoForm form={form} setForm={setForm} />}
            {tab === 'produtos' && <ProdutoForm form={form} setForm={setForm} />}

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
        <Campo label="Telefone de Contato">
          <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(65) 3000-0000" />
        </Campo>
      </Linha>
      <Campo label="Endereço Completo">
        <input value={form.endereco} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade/UF" />
      </Campo>
      <Campo label="Status">
        <select value={form.status} onChange={(e) => update('status', e.target.value)}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </Campo>
      <Campo label="Itens / Produtos Fornecidos">
        <textarea rows="2" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} placeholder="Pomadas, lâminas descartáveis, pós-barba, bebidas..." />
      </Campo>
    </>
  )
}

function UsuarioForm({ form, setForm, isNew }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  const perfis = Array.isArray(form.perfis) ? form.perfis : []

  const selecionarTipo = (tipoUsuario) => {
    const tipo = TIPOS_USUARIO.find((item) => item.id === tipoUsuario)
    setForm({ ...form, tipoUsuario, perfis: tipo?.perfilPadrao ? [tipo.perfilPadrao] : perfis })
  }

  const alternarPerfil = (perfilId) => {
    const proximos = perfis.includes(perfilId) ? perfis.filter((item) => item !== perfilId) : [...perfis, perfilId]
    update('perfis', proximos)
  }

  const permissoesAtivas = PERFIS_ACESSO.filter((perfil) => perfis.includes(perfil.id)).map((perfil) => perfil.modulos)

  return (
    <>
      <div className="card" style={{ fontSize: 12, background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.2)', padding: 10 }}>
        As credenciais e perfis concedidos vinculam-se exclusivamente à empresa ativa.
      </div>
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
