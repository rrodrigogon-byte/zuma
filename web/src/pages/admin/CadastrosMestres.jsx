import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { a2Path } from '../../lib/tenant-api'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'
import Modal from '../../components/Modal'
import { Link } from 'react-router-dom'

const TABS = [
  { id: 'funcionarios', label: 'Funcionários', icon: '👔', endpoint: '/funcionarios' },
  { id: 'fornecedores', label: 'Fornecedores', icon: '🚚', endpoint: '/fornecedores' },
  { id: 'usuarios', label: 'Usuários', icon: '🔐', endpoint: '/usuarios-mestres' },
]
const SINGULARES = { funcionarios: 'Funcionário', fornecedores: 'Fornecedor', usuarios: 'Usuário' }

const EMPTY = {
  funcionarios: { nome: '', cpf: '', email: '', telefone: '', cargo: '', departamento: '', dataAdmissao: '', salario: '', status: 'ativo', observacao: '' },
  fornecedores: { nome: '', cnpj: '', inscricaoEstadual: '', email: '', telefone: '', endereco: '', condicaoPagamento: '30 dias', status: 'ativo', observacao: '' },
  usuarios: { nome: '', email: '', telefone: '', tipoUsuario: 'operador_pdv', perfis: ['operador_pdv'], senhaInicial: '', ativo: true },
}

const TIPOS_USUARIO = [
  { id: 'administrador', nome: 'Administrador', descricao: 'Gestão completa da empresa', perfilPadrao: 'administrador' },
  { id: 'gerente', nome: 'Gerente', descricao: 'Gestão operacional e financeira', perfilPadrao: 'gerente_operacional' },
  { id: 'operador_pdv', nome: 'Operador de PDV', descricao: 'Vendas e atendimento', perfilPadrao: 'operador_pdv' },
  { id: 'caixa', nome: 'Caixa', descricao: 'Recebimentos e fechamento', perfilPadrao: 'caixa' },
  { id: 'estoque', nome: 'Gerente de Estoque', descricao: 'Inventário e movimentações', perfilPadrao: 'gerente_estoque' },
  { id: 'garcom', nome: 'Garçom', descricao: 'Mesas e comandas', perfilPadrao: 'garcom' },
  { id: 'cozinha', nome: 'Cozinha / KDS', descricao: 'Preparo de pedidos', perfilPadrao: 'cozinha' },
  { id: 'consultor', nome: 'Consultor', descricao: 'Consultas e relatórios', perfilPadrao: 'consultor' },
]

const PERFIS_ACESSO = [
  { id: 'administrador', nome: 'Administrador', modulos: 'Todos os módulos e configurações' },
  { id: 'gerente_operacional', nome: 'Gerente Operacional', modulos: 'Operação, financeiro e relatórios' },
  { id: 'operador_pdv', nome: 'Operador de PDV', modulos: 'PDV, pagamentos e clientes' },
  { id: 'caixa', nome: 'Caixa', modulos: 'Pagamentos, recebimentos e fechamento' },
  { id: 'gerente_estoque', nome: 'Gerente de Estoque', modulos: 'Estoque, cardápio e relatórios' },
  { id: 'garcom', nome: 'Garçom', modulos: 'Mesas, comandas e cardápio' },
  { id: 'cozinha', nome: 'Cozinha / KDS', modulos: 'Cozinha e acompanhamento de preparo' },
  { id: 'consultor', nome: 'Consultor', modulos: 'Dashboard e relatórios em leitura' },
]

function statusColor(status) {
  if (['ativo', true].includes(status)) return '#2ecc71'
  if (status === 'afastado') return '#FFB703'
  return '#e74c3c'
}

export default function CadastrosMestres() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState('funcionarios')
  const [dados, setDados] = useState({ funcionarios: [], fornecedores: [], usuarios: [] })
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [form, setForm] = useState(EMPTY.funcionarios)
  const [empresaForm, setEmpresaForm] = useState({ nome: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', endereco: '', email: '', telefone: '', permitirEstoqueNegativo: false, administrador: { nome: '', email: '', senhaInicial: '' } })
  const [saving, setSaving] = useState(false)

  const aba = useMemo(() => TABS.find((item) => item.id === tab), [tab])
  const podeGerenciarEmpresas = Boolean(user?.platformAdmin || user?.platformConsultor)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [funcionarios, fornecedores, usuarios, contexto] = await Promise.all([
        api.get(a2Path('/funcionarios')),
        api.get(a2Path('/fornecedores')),
        api.get(a2Path('/usuarios-mestres')),
        api.get(a2Path('/empresa-ativa')),
      ])
      setDados({
        funcionarios: funcionarios.funcionarios || [],
        fornecedores: fornecedores.fornecedores || [],
        usuarios: usuarios.usuarios || [],
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
    } catch (error) {
      toast(error.message || 'Não foi possível criar a empresa.', true)
    } finally {
      setSaving(false)
    }
  }

  const abrirNovo = () => {
    setForm(EMPTY[tab])
    setModal({ modo: 'novo' })
  }

  const abrirEditar = (registro) => {
    const base = { ...EMPTY[tab], ...registro }
    if (tab === 'usuarios') {
      base.tipoUsuario = registro.tipoUsuario || 'operador_pdv'
      base.perfis = Array.isArray(registro.perfis) ? registro.perfis : (Array.isArray(registro.roles) ? registro.roles : [registro.role || 'operador_pdv'])
      base.senhaInicial = ''
    }
    setForm(base)
    setModal({ modo: 'editar', id: registro.id })
  }

  const salvar = async () => {
    if (!form.nome || (tab !== 'funcionarios' && !form.email && tab === 'usuarios')) {
      return toast('Preencha os campos obrigatórios.', true)
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
      if (modal?.modo === 'novo') await api.post(a2Path(aba.endpoint), payload)
      else await api.patch(a2Path(`${aba.endpoint}/${modal.id}`), payload)
      toast(`${tab.slice(0, -1)} ${modal?.modo === 'novo' ? 'cadastrado' : 'atualizado'} com sucesso.`)
      setModal(null)
      carregar()
    } catch (error) {
      toast(error.message || 'Erro ao salvar cadastro.', true)
    } finally {
      setSaving(false)
    }
  }

  const registros = dados[tab] || []

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🗂️ Cadastros Mestres</h1>
          <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            Dados compartilhados pelos módulos da empresa ativa.
            {empresa?.nomeFantasia ? <strong style={{ color: '#FF6B2C', marginLeft: 6 }}>Empresa: {empresa.nomeFantasia}</strong> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={carregar}>↺ Atualizar</button>
          {podeGerenciarEmpresas && <button className="btn btn-secondary btn-sm" onClick={() => setModalEmpresa(true)}>🏢 Nova Empresa</button>}
          <button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ Novo {SINGULARES[tab]}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((item) => (
          <button key={item.id} className={`btn btn-sm ${tab === item.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(item.id)}>
            {item.icon} {item.label} <span style={{ opacity: .7 }}>({(dados[item.id] || []).length})</span>
          </button>
        ))}
        <a href="/admin/clientes" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>👥 Clientes & Contas</a>
        <Link to="/admin/usuarios" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} title="Quem entra no sistema e o que pode fazer">🔐 Usuários e acessos</Link>
      </div>

      <div className="card" style={{ marginBottom: 18, border: '1px solid rgba(255,107,44,.22)', background: 'rgba(255,107,44,.04)' }}>
        <strong style={{ color: '#FF6B2C', fontSize: 13 }}>Isolamento por empresa ativo.</strong>
        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>Os registros abaixo são filtrados pela empresa selecionada na sessão e não são expostos a outras empresas.</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {tab === 'funcionarios' && <><th>Nome</th><th>Cargo / Departamento</th><th>Contato</th><th>Status</th></>}
              {tab === 'fornecedores' && <><th>Fornecedor</th><th>CNPJ / IE</th><th>Contato</th><th>Condição</th><th>Status</th></>}
              {tab === 'usuarios' && <><th>Usuário</th><th>Perfis</th><th>Contato</th><th>Status</th></>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center' }}>Carregando cadastros...</td></tr>}
            {!loading && registros.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Nenhum registro cadastrado nesta empresa.</td></tr>}
            {!loading && registros.map((registro) => (
              <tr key={registro.id}>
                {tab === 'funcionarios' && <>
                  <td><strong>{registro.nome}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.cpf || 'CPF não informado'}</div></td>
                  <td>{registro.cargo || '—'}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.departamento || 'Sem departamento'}</div></td>
                  <td>{registro.telefone || '—'}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email || ''}</div></td>
                  <td><span className="badge" style={{ color: statusColor(registro.status), background: `${statusColor(registro.status)}18` }}>{registro.status}</span></td>
                </>}
                {tab === 'fornecedores' && <>
                  <td><strong>{registro.nome}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.endereco || 'Endereço não informado'}</div></td>
                  <td>{registro.cnpj || '—'}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.inscricaoEstadual || ''}</div></td>
                  <td>{registro.telefone || '—'}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email || ''}</div></td>
                  <td>{registro.condicaoPagamento || '—'}</td>
                  <td><span className="badge" style={{ color: statusColor(registro.status), background: `${statusColor(registro.status)}18` }}>{registro.status}</span></td>
                </>}
                {tab === 'usuarios' && <>
                  <td><strong>{registro.nome}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{registro.email}</div></td>
                  <td><strong>{registro.tipoUsuario ? (TIPOS_USUARIO.find((tipo) => tipo.id === registro.tipoUsuario)?.nome || registro.tipoUsuario) : 'Operador de PDV'}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{(registro.perfis || registro.roles || []).map((perfil) => PERFIS_ACESSO.find((item) => item.id === perfil)?.nome || perfil).join(' · ') || 'Sem perfil'}</div></td>
                  <td>{registro.telefone || '—'}</td>
                  <td><span className="badge" style={{ color: statusColor(registro.ativo), background: `${statusColor(registro.ativo)}18` }}>{registro.ativo === false ? 'inativo' : 'ativo'}</span></td>
                </>}
                <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(registro)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalEmpresa && (
        <Modal title="Nova empresa isolada" onClose={() => setModalEmpresa(false)} width={620}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            <div className="card" style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,107,44,.06)' }}>
              A nova empresa terá cadastros, cardápio, estoque, mesas, financeiro, fiscal e pagamentos próprios. O administrador inicial visualizará apenas os dados dela; PIX, adquirentes e TEF permanecerão desativados até a homologação do provedor.
            </div>
            <Linha><Campo label="Razão social *"><input value={empresaForm.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} /></Campo><Campo label="Nome fantasia"><input value={empresaForm.nomeFantasia} onChange={(e) => setEmpresaForm({ ...empresaForm, nomeFantasia: e.target.value })} /></Campo></Linha>
            <Linha><Campo label="CNPJ"><input inputMode="numeric" value={empresaForm.cnpj} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} /></Campo><Campo label="Inscrição estadual"><input value={empresaForm.inscricaoEstadual} onChange={(e) => setEmpresaForm({ ...empresaForm, inscricaoEstadual: e.target.value })} /></Campo></Linha>
            <Linha><Campo label="Email corporativo"><input type="email" value={empresaForm.email} onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })} /></Campo><Campo label="Telefone"><input value={empresaForm.telefone} onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })} /></Campo></Linha>
            <Campo label="Endereço fiscal"><input value={empresaForm.endereco} onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })} /></Campo>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={empresaForm.permitirEstoqueNegativo} onChange={(e) => setEmpresaForm({ ...empresaForm, permitirEstoqueNegativo: e.target.checked })} />Permitir estoque negativo nesta empresa</label>
            <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 15 }}>Administrador inicial</h3>
            <Linha><Campo label="Nome *"><input value={empresaForm.administrador.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, nome: e.target.value } })} /></Campo><Campo label="Email *"><input type="email" value={empresaForm.administrador.email} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, email: e.target.value } })} /></Campo></Linha>
            <Campo label="Senha inicial *"><input type="password" value={empresaForm.administrador.senhaInicial} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, senhaInicial: e.target.value } })} /></Campo>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}><button className="btn btn-ghost" onClick={() => setModalEmpresa(false)}>Cancelar</button><button className="btn btn-primary" onClick={criarEmpresa} disabled={saving}>{saving ? 'Criando...' : 'Criar empresa isolada'}</button></div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={`${modal.modo === 'novo' ? 'Novo' : 'Editar'} ${SINGULARES[tab]}`} onClose={() => setModal(null)} width={620}>
          <div style={{ display: 'grid', gap: 12, paddingBottom: 16 }}>
            {tab === 'funcionarios' && <FuncionarioForm form={form} setForm={setForm} />}
            {tab === 'fornecedores' && <FornecedorForm form={form} setForm={setForm} />}
            {tab === 'usuarios' && <UsuarioForm form={form} setForm={setForm} isNew={modal.modo === 'novo'} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Cadastro'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Campo({ label, children }) { return <div className="form-group"><label>{label}</label>{children}</div> }
function Linha({ children }) { return <div className="form-row">{children}</div> }

function FuncionarioForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return <>
    <Linha><Campo label="Nome *"><input value={form.nome} onChange={(e) => update('nome', e.target.value)} /></Campo><Campo label="CPF"><input value={form.cpf} onChange={(e) => update('cpf', e.target.value)} /></Campo></Linha>
    <Linha><Campo label="Cargo"><input value={form.cargo} onChange={(e) => update('cargo', e.target.value)} /></Campo><Campo label="Departamento"><input value={form.departamento} onChange={(e) => update('departamento', e.target.value)} /></Campo></Linha>
    <Linha><Campo label="Email"><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></Campo><Campo label="Telefone"><input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} /></Campo></Linha>
    <Linha><Campo label="Data de admissão"><input type="date" value={form.dataAdmissao} onChange={(e) => update('dataAdmissao', e.target.value)} /></Campo><Campo label="Salário (R$)"><input type="number" min="0" step="0.01" value={form.salario} onChange={(e) => update('salario', e.target.value)} /></Campo></Linha>
    <Campo label="Status"><select value={form.status} onChange={(e) => update('status', e.target.value)}><option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="desligado">Desligado</option></select></Campo>
    <Campo label="Observação"><textarea rows="2" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} /></Campo>
  </>
}

function FornecedorForm({ form, setForm }) {
  const update = (key, value) => setForm({ ...form, [key]: value })
  return <>
    <Linha><Campo label="Nome / Razão social *"><input value={form.nome} onChange={(e) => update('nome', e.target.value)} /></Campo><Campo label="CNPJ"><input value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} /></Campo></Linha>
    <Linha><Campo label="Inscrição estadual"><input value={form.inscricaoEstadual} onChange={(e) => update('inscricaoEstadual', e.target.value)} /></Campo><Campo label="Condição de pagamento"><input value={form.condicaoPagamento} onChange={(e) => update('condicaoPagamento', e.target.value)} /></Campo></Linha>
    <Linha><Campo label="Email"><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></Campo><Campo label="Telefone"><input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} /></Campo></Linha>
    <Campo label="Endereço"><input value={form.endereco} onChange={(e) => update('endereco', e.target.value)} /></Campo>
    <Campo label="Status"><select value={form.status} onChange={(e) => update('status', e.target.value)}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></Campo>
    <Campo label="Observação"><textarea rows="2" value={form.observacao} onChange={(e) => update('observacao', e.target.value)} /></Campo>
  </>
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
  return <>
    <div className="card" style={{ fontSize: 12, background: 'rgba(255,107,44,.06)', border: '1px solid rgba(255,107,44,.2)' }}>
      Selecione o tipo e um ou mais perfis. As permissões são somadas e sempre valem apenas para a empresa ativa.
    </div>
    <Linha><Campo label="Nome *"><input value={form.nome} onChange={(e) => update('nome', e.target.value)} /></Campo><Campo label="Telefone"><input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} /></Campo></Linha>
    <Campo label="Email *"><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></Campo>
    <Campo label="Tipo de usuário *"><select value={form.tipoUsuario || 'operador_pdv'} onChange={(e) => selecionarTipo(e.target.value)}>{TIPOS_USUARIO.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nome} — {tipo.descricao}</option>)}</select></Campo>
    <Campo label="Perfis de acesso *"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>{PERFIS_ACESSO.map((perfil) => <label key={perfil.id} style={{ display: 'flex', gap: 8, padding: 10, border: `1px solid ${perfis.includes(perfil.id) ? '#FF6B2C' : 'var(--border, #e6e6e6)'}`, borderRadius: 8, background: perfis.includes(perfil.id) ? 'rgba(255,107,44,.08)' : '#fff', cursor: 'pointer' }}><input type="checkbox" checked={perfis.includes(perfil.id)} onChange={() => alternarPerfil(perfil.id)} style={{ marginTop: 2 }} /><span><strong style={{ fontSize: 13 }}>{perfil.nome}</strong><small style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>{perfil.modulos}</small></span></label>)}</div></Campo>
    <div className="card" style={{ fontSize: 12, padding: 12, background: 'rgba(18,40,63,.04)' }}><strong style={{ color: '#12283F' }}>Permissões resultantes:</strong><div style={{ marginTop: 4, color: 'var(--muted)' }}>{permissoesAtivas.length ? permissoesAtivas.join(' · ') : 'Selecione ao menos um perfil de acesso.'}</div></div>
    <Campo label={isNew ? 'Senha inicial *' : 'Nova senha (opcional)'}><input type="password" value={form.senhaInicial} onChange={(e) => update('senhaInicial', e.target.value)} /></Campo>
    <Campo label="Situação"><select value={form.ativo ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></Campo>
  </>
}
