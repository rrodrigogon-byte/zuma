import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

const ROLES = ['admin', 'organizador', 'staff', 'atleta']

const ROLE_COLORS = {
  admin: { bg: '#e05c5c22', color: '#e05c5c', border: '#e05c5c44' },
  organizador: { bg: '#C9A65622', color: '#C9A656', border: '#C9A65644' },
  staff: { bg: '#5FB33522', color: '#5FB335', border: '#5FB33544' },
  atleta: { bg: '#8FD64A22', color: '#8FD64A', border: '#8FD64A44' },
}

const EMPTY_FORM = { nome: '', email: '', senha: '', role: 'staff' }

export default function Usuarios() {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroRole, setFiltroRole] = useState('')
  const [modal, setModal] = useState(null) // null | 'novo' | {id, ...fields}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get('/api/admin/usuarios')
      .then(setUsuarios)
      .catch(() => toast('Erro ao carregar usuários', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openNovo = () => {
    setForm(EMPTY_FORM)
    setModal('novo')
  }

  const openEditar = (u) => {
    setForm({ nome: u.nome, email: u.email, senha: '', role: u.role })
    setModal(u)
  }

  const closeModal = () => setModal(null)

  const handleSave = async () => {
    if (!form.nome || !form.email) return toast('Nome e e-mail obrigatórios', 'warn')
    if (modal === 'novo' && !form.senha) return toast('Senha obrigatória para novo usuário', 'warn')
    setSaving(true)
    try {
      if (modal === 'novo') {
        await api.post('/api/admin/usuarios', form)
        toast('Usuário criado', 'success')
      } else {
        const payload = { nome: form.nome, email: form.email, role: form.role }
        if (form.senha) payload.senha = form.senha
        await api.patch(`/api/admin/usuarios/${modal.id}`, payload)
        toast('Usuário atualizado', 'success')
      }
      closeModal()
      load()
    } catch (e) {
      toast(e?.message || 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleAtivo = async (u) => {
    try {
      await api.patch(`/api/admin/usuarios/${u.id}`, { ativo: !u.ativo })
      load()
    } catch {
      toast('Erro ao alterar status', 'error')
    }
  }

  const handleDelete = async (u) => {
    if (!confirm(`Excluir usuário "${u.nome}"?`)) return
    try {
      await api.delete(`/api/admin/usuarios/${u.id}`)
      toast('Usuário excluído', 'success')
      load()
    } catch {
      toast('Erro ao excluir', 'error')
    }
  }

  const lista = usuarios.filter((u) => {
    const q = busca.toLowerCase()
    const matchQ = !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    const matchR = !filtroRole || u.role === filtroRole
    return matchQ && matchR
  })

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Usuários</h1>
        <button className="btn btn-primary" onClick={openNovo}>+ Novo Usuário</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="form-group"
          style={{ flex: '1 1 200px', margin: 0, padding: '8px 12px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 14 }}
          placeholder="Buscar por nome ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: filtroRole ? '#fff' : 'var(--muted)', fontSize: 14 }}
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value)}
        >
          <option value="">Todos os perfis</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        {loading ? (
          <p style={{ color: 'var(--muted)', padding: 16 }}>Carregando…</p>
        ) : lista.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: 16 }}>Nenhum usuário encontrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e4a2e' }}>
                {['Nome', 'E-mail', 'Perfil', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.staff
                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid #1e4a2e11' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1a3a2222')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 500 }}>{u.nome}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => toggleAtivo(u)}
                        style={{
                          background: u.ativo !== false ? '#5FB33522' : '#e05c5c22',
                          color: u.ativo !== false ? '#5FB335' : '#e05c5c',
                          border: `1px solid ${u.ativo !== false ? '#5FB33544' : '#e05c5c44'}`,
                          borderRadius: 12,
                          padding: '3px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {u.ativo !== false ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditar(u)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal === 'novo' ? 'Novo Usuário' : 'Editar Usuário'}
          onClose={closeModal}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label>Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="form-group">
              <label>Perfil</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{modal === 'novo' ? 'Senha' : 'Nova Senha (deixe em branco para não alterar)'}</label>
              <input
                type="password"
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                placeholder={modal === 'novo' ? 'Senha obrigatória' : 'Opcional'}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
