import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

const formatDate = value => value ? new Date(value).toLocaleString('pt-BR') : 'Sem vencimento'
export function localDateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const permittedRoles = (roles, platformAdmin) => (roles || []).filter(role =>
  !['platform_owner', 'tenant_owner'].includes(role.codigo) || platformAdmin === true)

export default function CommerceUsersPanel({ memberships = [], roles = [], stores = [], currentUserId, platformAdmin = false, storefrontId, empresaId, isDino = false, onRefresh }) {
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState({ nome: '', email: '' })
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [form, setForm] = useState({ usuarioId: '', roleId: '', lojaId: '', ativo: true, expiresAt: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const scope = storefrontId ? `?storefrontId=${encodeURIComponent(storefrontId)}` : ''
  const roleOptions = useMemo(() => permittedRoles(roles, platformAdmin), [roles, platformAdmin])

  useEffect(() => {
    if (!creating || !storefrontId || query.trim().length < 3) { setCandidates([]); return }
    let active = true
    const timer = setTimeout(() => {
      api.get(`/api/admin/commerce/users/candidates?storefrontId=${encodeURIComponent(storefrontId)}&query=${encodeURIComponent(query.trim())}`)
        .then(result => { if (active) setCandidates(Array.isArray(result?.items) ? result.items : []) })
        .catch(() => { if (active) { setCandidates([]); setError('Não foi possível buscar usuários desta empresa.') } })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [creating, query, storefrontId])

  function beginCreate() {
    setEditing(null); setCreating(true); setError(''); setNotice(''); setQuery(''); setCandidates([])
    setForm({ usuarioId: '', roleId: '', lojaId: '', ativo: true, expiresAt: '' })
  }
  function beginEdit(item) {
    setCreating(false); setEditing(item); setError(''); setNotice('')
    setForm({ usuarioId: item.usuario_id, roleId: item.role_id, lojaId: item.loja_id || '', ativo: item.ativo,
      expiresAt: localDateTimeInputValue(item.expires_at) })
  }
  function update(key, value) { setForm(previous => ({ ...previous, [key]: value })) }
  function expiresAtValue() {
    if (!form.expiresAt) return null
    const value = new Date(form.expiresAt)
    if (!Number.isFinite(value.getTime())) throw new Error('Informe uma validade válida.')
    return value.toISOString()
  }
  async function save(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const payload = { roleId: form.roleId, ativo: form.ativo, expiresAt: expiresAtValue() }
      if (editing) await api.patch(`/api/admin/commerce/users/memberships/${editing.id}${scope}`, payload)
      else await api.post(`/api/admin/commerce/users/memberships${scope}`, { ...payload, usuarioId: form.usuarioId, lojaId: form.lojaId || null })
      setCreating(false); setEditing(null); setNotice('Acesso salvo e validado pelo servidor.'); await onRefresh?.()
    } catch (cause) { setError(cause?.message || 'Não foi possível salvar o acesso.') }
    finally { setBusy(false) }
  }
  async function deactivate(item) {
    if (item.usuario_id === currentUserId) { setError('Não desative a própria conta por esta tela.'); return }
    if (!window.confirm('Desativar o acesso? O histórico será preservado e novas requisições serão bloqueadas.')) return
    setError(''); setBusy(true)
    try { await api.patch(`/api/admin/commerce/users/memberships/${item.id}${scope}`, { ativo: false }); setNotice('Acesso desativado.'); await onRefresh?.() }
    catch (cause) { setError(cause?.message || 'Não foi possível desativar o acesso.') }
    finally { setBusy(false) }
  }
  async function sendInvite(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      await api.post('/api/admin/operational-invites', {
        empresaId, nome: invite.nome.trim(), email: invite.email.trim(), role: 'store_admin',
      })
      setInviting(false); setInvite({ nome: '', email: '' })
      setNotice('Convite aceito pelo provedor de e-mail. O titular define a própria senha pelo link pessoal; o acesso ainda não está ativo.')
      await onRefresh?.()
    } catch (cause) {
      setError(cause?.code === 'INVITES_DISABLED' || cause?.code === 'MAIL_NOT_CONFIGURED'
        ? 'Convites ainda não estão habilitados ou o e-mail transacional não está configurado. Nenhuma conta foi criada.'
        : cause?.message || 'O convite não foi confirmado. Não tente reenviar automaticamente.')
    } finally { setBusy(false) }
  }

  return <section className="ecommerce-admin-panel commerce-users-panel" aria-label="Usuários e acessos da empresa">
    <div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Governança</span><h2>Usuários e permissões</h2><p className="commerce-admin-help">Atribua papéis somente à empresa selecionada. Excluir acesso desativa a membership; não apaga identidade ou auditoria.</p></div><div className="ecommerce-row-actions">{isDino && <button type="button" disabled={!empresaId || !storefrontId || busy} onClick={() => { setInviting(true); setCreating(false); setEditing(null); setError(''); setNotice('') }}>Convidar novo operador Dino</button>}<button type="button" className="ecommerce-admin-button primary" disabled={!storefrontId} onClick={beginCreate}>Adicionar acesso existente</button></div></div>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Usuário</th><th>Papel e permissões</th><th>Unidade</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>{memberships.map(item => <tr key={item.id}><td><strong>{item.nome_completo || 'Usuário'}</strong><small>{item.email}</small></td><td>{item.role_nome || item.role_codigo}{roles.find(role => role.id === item.role_id)?.permissoes?.length ? <small>{roles.find(role => role.id === item.role_id).permissoes.join(', ')}</small> : null}</td><td>{item.loja_nome || 'Todas as unidades desta empresa'}</td><td>{formatDate(item.expires_at)}</td><td>{item.ativo && item.expires_at && new Date(item.expires_at).getTime() <= Date.now() ? 'Expirado' : item.ativo ? 'Ativo' : 'Desativado'}</td><td><div className="ecommerce-row-actions"><button type="button" disabled={busy} onClick={() => beginEdit(item)}>Editar</button><button type="button" disabled={busy || !item.ativo || item.usuario_id === currentUserId} onClick={() => deactivate(item)}>Desativar</button></div></td></tr>)}</tbody></table>{!memberships.length && <p className="ecommerce-admin-empty">Sem acessos visíveis nesta empresa ou sem permissão para gerir usuários.</p>}</div>
    {inviting && isDino && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Convidar operador da Dino"><form className="ecommerce-admin-modal commerce-users-editor" onSubmit={sendInvite}><button type="button" className="ecommerce-admin-close" onClick={() => setInviting(false)} aria-label="Fechar">×</button><h2>Convidar novo operador da Dino</h2><p className="commerce-admin-help">Apenas administradores de plataforma podem emitir este convite. Papel operacional em toda a empresa Dino, sem gestão de usuários. O destinatário receberá um link individual de uso único e criará sua própria senha; nenhuma senha é exibida aqui.</p><label>Nome<input required maxLength={180} autoComplete="name" value={invite.nome} onChange={event => setInvite(previous => ({ ...previous, nome: event.target.value }))} /></label><label>E-mail do titular<input type="email" required autoComplete="email" value={invite.email} onChange={event => setInvite(previous => ({ ...previous, email: event.target.value }))} /></label><div className="ecommerce-admin-modal-actions"><button type="button" onClick={() => setInviting(false)}>Cancelar</button><button type="submit" disabled={busy || !empresaId || !storefrontId}>{busy ? 'Enviando…' : 'Enviar convite pessoal'}</button></div></form></div>}
    {(creating || editing) && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label={editing ? 'Editar acesso' : 'Adicionar acesso'}><form className="ecommerce-admin-modal commerce-users-editor" onSubmit={save}><button type="button" className="ecommerce-admin-close" onClick={() => { setCreating(false); setEditing(null) }} aria-label="Fechar">×</button><h2>{editing ? 'Editar acesso' : 'Adicionar usuário existente'}</h2><p className="commerce-admin-help">Novas identidades precisam de convite nominal e senha criada pelo titular. Não compartilhe senhas pelo painel.</p>
      {creating && <><label>Buscar usuário desta empresa<input type="search" minLength={3} value={query} onChange={event => { setQuery(event.target.value); update('usuarioId', '') }} placeholder="Nome ou e-mail (mínimo 3 caracteres)" /></label><label>Usuário existente<select required value={form.usuarioId} onChange={event => update('usuarioId', event.target.value)}><option value="">Selecione um usuário</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.nome_completo || 'Usuário'} · {candidate.email}</option>)}</select></label><label>Unidade<select value={form.lojaId} onChange={event => update('lojaId', event.target.value)}><option value="">Todas as unidades desta empresa</option>{stores.map(store => <option key={store.id} value={store.id}>{store.nome}</option>)}</select></label></>}
      <label>Papel<select required value={form.roleId} onChange={event => update('roleId', event.target.value)}><option value="">Selecione um papel</option>{roleOptions.map(role => <option key={role.id} value={role.id}>{role.nome}</option>)}</select></label><label>Validade do acesso<input type="datetime-local" value={form.expiresAt} onChange={event => update('expiresAt', event.target.value)} /><small>Deixe vazio para não expirar; o servidor bloqueia acessos vencidos.</small></label><label><input type="checkbox" checked={form.ativo} onChange={event => update('ativo', event.target.checked)} /> Acesso ativo</label>
      <div className="ecommerce-admin-modal-actions"><button type="button" onClick={() => { setCreating(false); setEditing(null) }}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary" disabled={busy || (creating && !form.usuarioId)}>{busy ? 'Salvando…' : 'Salvar acesso'}</button></div></form></div>}
  </section>
}
