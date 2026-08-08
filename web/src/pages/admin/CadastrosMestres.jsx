import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../lib/auth'
import Modal from '../../components/Modal'

const TABS = [
  { id: 'funcionarios', label: 'Funcionários', icon: '👔', endpoint: '/api/admin/funcionarios' },
  { id: 'fornecedores', label: 'Fornecedores', icon: '🚚', endpoint: '/api/admin/fornecedores' },
  { id: 'usuarios', label: 'Usuários', icon: '🔐', endpoint: '/api/admin/usuarios-mestres' },
]

const EMPTY = {
  funcionarios: { nome: '', cpf: '', email: '', telefone: '', cargo: '', departamento: '', dataAdmissao: '', salario: '', status: 'ativo', observacao: '' },
  fornecedores: { nome: '', cnpj: '', inscricaoEstadual: '', email: '', telefone: '', endereco: '', condicaoPagamento: '30 dias', status: 'ativo', observacao: '' },
  usuarios: { nome: '', email: '', telefone: '', roles: 'operador', senhaInicial: '', ativo: true },
}

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
  const [empresaForm, setEmpresaForm] = useState({ nome: '', nomeFantasia: '', cnpj: '', email: '', telefone: '', administrador: { nome: '', email: '', senhaInicial: '' } })
  const [saving, setSaving] = useState(false)

  const aba = useMemo(() => TABS.find((item) => item.id === tab), [tab])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [funcionarios, fornecedores, usuarios, contexto] = await Promise.all([
        api.get('/api/admin/funcionarios'),
        api.get('/api/admin/fornecedores'),
        api.get('/api/admin/usuarios-mestres'),
        api.get('/api/admin/empresa-ativa'),
      ])
      setDados({
        funcionarios: funcionarios.funcionarios || [],
        fornecedores: fornecedores.fornecedores || [],
        usuarios: usuarios.usuarios || [],
      })
      setEmpresa(contexto.empresa || null)
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
      setEmpresaForm({ nome: '', nomeFantasia: '', cnpj: '', email: '', telefone: '', administrador: { nome: '', email: '', senhaInicial: '' } })
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
      base.roles = Array.isArray(registro.roles) ? registro.roles.join(', ') : (registro.role || 'operador')
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
      if (tab === 'usuarios') payload.roles = String(form.roles || 'operador').split(',').map((role) => role.trim()).filter(Boolean)
      if (modal?.modo === 'novo') await api.post(aba.endpoint, payload)
      else await api.patch(`${aba.endpoint}/${modal.id}`, payload)
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
          {user?.platformAdmin && <button className="btn btn-secondary btn-sm" onClick={() => setModalEmpresa(true)}>🏢 Nova Empresa</button>}
          <button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ Novo {aba?.label?.slice(0, -1)}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((item) => (
          <button key={item.id} className={`btn btn-sm ${tab === item.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(item.id)}>
            {item.icon} {item.label} <span style={{ opacity: .7 }}>({(dados[item.id] || []).length})</span>
          </button>
        ))}
        <a href="/admin/clientes" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>👥 Clientes & Contas</a>
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
                  <td>{(registro.roles || []).join(', ') || 'operador'}</td>
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
              A nova empresa terá cadastros, cardápio, estoque, mesas, financeiro e fiscal próprios. O administrador abaixo visualizará somente os dados dela.
            </div>
            <Linha><Campo label="Razão social *"><input value={empresaForm.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} /></Campo><Campo label="Nome fantasia"><input value={empresaForm.nomeFantasia} onChange={(e) => setEmpresaForm({ ...empresaForm, nomeFantasia: e.target.value })} /></Campo></Linha>
            <Linha><Campo label="CNPJ"><input value={empresaForm.cnpj} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} /></Campo><Campo label="Email corporativo"><input type="email" value={empresaForm.email} onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })} /></Campo></Linha>
            <Campo label="Telefone"><input value={empresaForm.telefone} onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })} /></Campo>
            <h3 style={{ margin: '8px 0 0', color: '#12283F', fontSize: 15 }}>Administrador inicial</h3>
            <Linha><Campo label="Nome *"><input value={empresaForm.administrador.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, nome: e.target.value } })} /></Campo><Campo label="Email *"><input type="email" value={empresaForm.administrador.email} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, email: e.target.value } })} /></Campo></Linha>
            <Campo label="Senha inicial *"><input type="password" value={empresaForm.administrador.senhaInicial} onChange={(e) => setEmpresaForm({ ...empresaForm, administrador: { ...empresaForm.administrador, senhaInicial: e.target.value } })} /></Campo>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}><button className="btn btn-ghost" onClick={() => setModalEmpresa(false)}>Cancelar</button><button className="btn btn-primary" onClick={criarEmpresa} disabled={saving}>{saving ? 'Criando...' : 'Criar empresa isolada'}</button></div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={`${modal.modo === 'novo' ? 'Novo' : 'Editar'} ${aba.label.slice(0, -1)}`} onClose={() => setModal(null)} width={620}>
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
  return <>
    <Linha><Campo label="Nome *"><input value={form.nome} onChange={(e) => update('nome', e.target.value)} /></Campo><Campo label="Telefone"><input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} /></Campo></Linha>
    <Campo label="Email *"><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></Campo>
    <Campo label="Perfis (separados por vírgula)"><input value={form.roles} onChange={(e) => update('roles', e.target.value)} placeholder="operador, gerente" /></Campo>
    <Campo label={isNew ? 'Senha inicial *' : 'Nova senha (opcional)'}><input type="password" value={form.senhaInicial} onChange={(e) => update('senhaInicial', e.target.value)} /></Campo>
    <Campo label="Situação"><select value={form.ativo ? 'ativo' : 'inativo'} onChange={(e) => update('ativo', e.target.value === 'ativo')}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></Campo>
  </>
}
