import { useState, useEffect, useRef, useMemo } from 'react'
import { api, fmtDate, fmtDateOnly } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/Modal'

function exportCSV(usuarios) {
  const headers = ['ID', 'Nome', 'E-mail', 'Perfil', 'Status', 'Último Acesso']
  const rows = usuarios.map(u => [
    u.id, u.nome, u.email, u.role,
    u.ativo !== false ? 'Ativo' : 'Inativo',
    u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString('pt-BR') : '—'
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `usuarios_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function KpiCard({ label, value, color = 'var(--green)', icon }) {
  return (
    <div style={{ background: 'var(--card)', border: `1px solid var(--line)`, borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '14px 18px', minWidth: 130 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

const ROLES = ['admin', 'organizador', 'staff', 'atleta']

const ROLE_COLORS = {
  admin: { bg: '#e05c5c22', color: '#e05c5c', border: '#e05c5c44' },
  organizador: { bg: '#C9A65622', color: '#C9A656', border: '#C9A65644' },
  staff: { bg: '#5FB33522', color: '#5FB335', border: '#5FB33544' },
  atleta: { bg: '#8FD64A22', color: '#8FD64A', border: '#8FD64A44' },
}

const AVATAR_COLORS = ['#e05c5c', '#C9A656', '#5FB335', '#8FD64A', '#4a9abe', '#9b59b6', '#e67e22']

const EMPTY_FORM = { nome: '', email: '', senha: '', role: 'staff' }

function getInitials(nome) {
  if (!nome) return '?'
  const parts = nome.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColor(nome) {
  if (!nome) return AVATAR_COLORS[0]
  let hash = 0
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function genSenha(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!$'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function validateForm(form, isNovo) {
  if (!form.nome || form.nome.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres'
  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'E-mail inválido'
  if (isNovo && !form.senha) return 'Senha obrigatória para novo usuário'
  if (form.senha && form.senha.length < 6) return 'Senha deve ter pelo menos 6 caracteres'
  return null
}

export default function Usuarios() {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroRole, setFiltroRole] = useState('')
  const [modal, setModal] = useState(null) // null | 'novo' | {id, ...fields}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const debounceRef = useRef(null)
  const [buscaInput, setBuscaInput] = useState('')

  const load = () => {
    setLoading(true)
    api
      .get('/api/admin/usuarios')
      .then(setUsuarios)
      .catch(() => toast('Erro ao carregar usuários', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Debounce search
  const handleBuscaChange = (val) => {
    setBuscaInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setBusca(val), 300)
  }

  const openNovo = () => {
    setForm(EMPTY_FORM)
    setShowSenha(false)
    setModal('novo')
  }

  const openEditar = (u) => {
    setForm({ nome: u.nome, email: u.email, senha: '', role: u.role })
    setShowSenha(false)
    setModal(u)
  }

  const closeModal = () => setModal(null)

  const handleSave = async () => {
    const err = validateForm(form, modal === 'novo')
    if (err) return toast(err, 'warn')
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

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return usuarios.filter((u) => {
      const matchQ = !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      const matchR = !filtroRole || u.role === filtroRole
      return matchQ && matchR
    })
  }, [usuarios, busca, filtroRole])

  // KPIs calculados
  const kpis = useMemo(() => {
    const total = usuarios.length
    const ativos = usuarios.filter(u => u.ativo !== false).length
    const byRole = ROLES.reduce((acc, r) => ({ ...acc, [r]: usuarios.filter(u => u.role === r).length }), {})
    const semAcesso = usuarios.filter(u => !u.ultimoAcesso).length
    return { total, ativos, ...byRole, semAcesso }
  }, [usuarios])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Usuários</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => exportCSV(lista)}>⬇ CSV</button>
          <button className="btn btn-primary" onClick={openNovo}>+ Novo Usuário</button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <KpiCard label="Total" value={kpis.total} color="var(--green)" icon="👥" />
          <KpiCard label="Ativos" value={kpis.ativos} color="#5FB335" icon="✅" />
          <KpiCard label="Admin" value={kpis.admin || 0} color="#e05c5c" icon="🔑" />
          <KpiCard label="Organizador" value={kpis.organizador || 0} color="#C9A656" icon="🗂" />
          <KpiCard label="Staff" value={kpis.staff || 0} color="#8FD64A" icon="🎫" />
          <KpiCard label="Atletas" value={kpis.atleta || 0} color="var(--green)" icon="🎾" />
          <KpiCard label="Sem acesso" value={kpis.semAcesso} color="var(--muted)" icon="⚠️" />
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="form-group"
          style={{ flex: '1 1 200px', margin: 0, padding: '8px 12px', background: 'var(--card)', border: '1px solid #1e4a2e', borderRadius: 8, color: '#fff', fontSize: 14 }}
          placeholder="Buscar por nome ou e-mail…"
          value={buscaInput}
          onChange={(e) => handleBuscaChange(e.target.value)}
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
                {['', 'Nome', 'E-mail', 'Perfil', 'Último acesso', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.staff
                const initials = getInitials(u.nome)
                const color = avatarColor(u.nome)
                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid #1e4a2e11' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1a3a2222')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 500 }}>{u.nome}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>
                      {u.ultimoAcesso ? fmtDate(u.ultimoAcesso) : '—'}
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
              <label>Nome <span style={{ color: '#e05c5c' }}>*</span></label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo (mínimo 2 chars)"
              />
            </div>
            <div className="form-group">
              <label>E-mail <span style={{ color: '#e05c5c' }}>*</span></label>
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
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{modal === 'novo' ? 'Senha' : 'Nova Senha'} {modal === 'novo' && <span style={{ color: '#e05c5c' }}>*</span>}</span>
                {modal === 'novo' && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, senha: genSenha() }))}
                    style={{ background: 'none', border: '1px solid #1e4a2e', borderRadius: 6, padding: '2px 8px', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}
                    title="Gerar senha aleatória"
                  >
                    🎲 Gerar
                  </button>
                )}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={form.senha}
                  onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                  placeholder={modal === 'novo' ? 'Mínimo 6 caracteres' : 'Deixe em branco para não alterar'}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: 'var(--muted)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? '🙈' : '👁'}
                </button>
              </div>
              {form.senha && form.senha.length < 6 && (
                <span style={{ fontSize: 11, color: '#e05c5c', marginTop: 4 }}>Mínimo 6 caracteres</span>
              )}
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
