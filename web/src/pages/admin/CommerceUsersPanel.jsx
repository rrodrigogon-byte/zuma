import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export function inviteErrorMessage(cause) {
  const messages = {
    INVITES_DISABLED: 'Convites desativados no servidor. Configure OPERATIONAL_INVITES_ENABLED=1 no Render. Nenhuma conta foi criada.',
    MAIL_NOT_CONFIGURED: 'O envio de e-mail não está configurado. Configure RESEND_API_KEY e EMAIL_FROM com um remetente verificado no Render. Nenhuma conta foi criada.',
    MAIL_REJECTED: 'O Resend recusou o e-mail. Verifique a chave e o domínio do remetente EMAIL_FROM antes de tentar novamente.',
    INVITE_DELIVERY_UNCERTAIN: 'O envio não foi confirmado. Confira os registros no Resend antes de enviar outro convite; não há acesso ativo.',
    IDENTITY_ALREADY_EXISTS: 'E-mail já cadastrado ou com convite pendente. Consulte o histórico de convites e o diretório de usuários. Adicionar acesso existente só aceita usuários Commerce desta empresa; não vincula contas do painel legado.',
    PERMISSION_DENIED: 'Somente administradores da plataforma podem convidar operadores da Dino.',
  }
  return messages[cause?.code] || cause?.message || 'Não foi possível confirmar o convite. Confira o provedor antes de tentar novamente.'
}

export function inviteStatusLabel(item) {
  if (['pending_email', 'sent'].includes(item.status) && new Date(item.expires_at).getTime() <= Date.now()) return 'Expirado — sem acesso'
  return {
    pending_email: 'Envio pendente — sem acesso',
    sent: 'Aceito pelo provedor — aguardando o titular',
    used: 'Aceito pelo titular',
    revoked: 'Revogado — sem acesso',
  }[item.status] || item.status
}

export default function CommerceUsersPanel({ memberships = [], roles = [], stores = [], currentUserId, platformAdmin = false, storefrontId, empresaId, isDino = false, onRefresh }) {
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState({ nome: '', email: '' })
  const [inviteState, setInviteState] = useState(null)
  const [inviteStateError, setInviteStateError] = useState('')
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({ usuarioId: '', roleId: '', lojaId: '', ativo: true, expiresAt: '' })
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const inviteRequestId = useRef(0)
  const scopeKey = `${isDino}:${empresaId || ''}:${storefrontId || ''}`
  const currentScope = useRef(scopeKey)
  currentScope.current = scopeKey
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const scope = storefrontId ? `?storefrontId=${encodeURIComponent(storefrontId)}` : ''
  const roleOptions = useMemo(() => permittedRoles(roles, platformAdmin), [roles, platformAdmin])
  const invitePath = `/api/admin/operational-invites?empresaId=${encodeURIComponent(empresaId || '')}`
  const inviteUnavailable = inviteState?.ready === false ? inviteErrorMessage({ code: inviteState.code }) : inviteStateError
  const modalOpen = inviting || creating || Boolean(editing)

  const refreshInvites = useCallback(async () => {
    if (!isDino || !empresaId || currentScope.current !== scopeKey) return
    const requestId = ++inviteRequestId.current
    const isCurrent = () => currentScope.current === scopeKey && requestId === inviteRequestId.current
    try {
      const result = await api.get(invitePath)
      if (isCurrent()) { setInviteState(result); setInviteStateError('') }
    } catch (cause) { if (isCurrent()) setInviteStateError(inviteErrorMessage(cause)) }
  }, [isDino, empresaId, invitePath, scopeKey])

  useEffect(() => {
    setInviteState(null); setInviteStateError('')
    setInviting(false); setCreating(false); setEditing(null)
    refreshInvites()
    return () => { ++inviteRequestId.current }
  }, [refreshInvites])

  useEffect(() => {
    if (!creating || !storefrontId || query.trim().length < 3) { setCandidates([]); setSearching(false); return }
    let active = true
    setSearching(true); setCandidates([])
    const timer = setTimeout(() => {
      api.get(`/api/admin/commerce/users/candidates?storefrontId=${encodeURIComponent(storefrontId)}&query=${encodeURIComponent(query.trim())}`)
        .then(result => { if (active) setCandidates(Array.isArray(result?.items) ? result.items : []) })
        .catch(() => { if (active) { setCandidates([]); setError('Não foi possível buscar usuários Commerce desta empresa.') } })
        .finally(() => { if (active) setSearching(false) })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [creating, query, storefrontId])

  function closeInvite() { if (!busy) { setInviting(false); setInvite({ nome: '', email: '' }); setError('') } }
  function beginInvite() {
    setInviting(true); setCreating(false); setEditing(null)
    setInvite({ nome: '', email: '' }); setError(''); setNotice('')
    refreshInvites()
  }
  function beginCreate() {
    setInviting(false); setEditing(null); setCreating(true); setError(''); setNotice(''); setQuery(''); setCandidates([])
    setForm({ usuarioId: '', roleId: '', lojaId: '', ativo: true, expiresAt: '' })
  }
  function beginEdit(item) {
    setInviting(false); setCreating(false); setEditing(item); setError(''); setNotice('')
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
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true; setError(''); setBusy(true)
    try {
      const payload = { roleId: form.roleId, ativo: form.ativo, expiresAt: expiresAtValue() }
      if (editing) await api.patch(`/api/admin/commerce/users/memberships/${editing.id}${scope}`, payload)
      else await api.post(`/api/admin/commerce/users/memberships${scope}`, { ...payload, usuarioId: form.usuarioId, lojaId: form.lojaId || null })
      setCreating(false); setEditing(null); setNotice('Acesso salvo e validado pelo servidor.')
      try { await onRefresh?.() } catch { setError('O acesso foi salvo, mas a lista não atualizou. Atualize a página, sem salvar novamente.') }
    } catch (cause) { setError(cause?.message || 'Não foi possível salvar o acesso.') }
    finally { submitting.current = false; setBusy(false) }
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
    event.preventDefault()
    if (submitting.current) return
    if (inviteUnavailable || !inviteState?.ready) { setError(inviteUnavailable || 'Aguarde a verificação do canal de e-mail.'); return }
    submitting.current = true; setError(''); setBusy(true)
    ++inviteRequestId.current
    try {
      const result = await api.post('/api/admin/operational-invites', {
        empresaId, nome: invite.nome.trim(), email: invite.email.trim(), role: 'store_admin',
      })
      if (result?.ok !== true || result?.status !== 'sent') throw Object.assign(new Error('Envio não confirmado.'), { code: 'INVITE_DELIVERY_UNCERTAIN' })
      if (currentScope.current !== scopeKey) return
      setInviting(false); setInvite({ nome: '', email: '' })
      setNotice('Convite aceito pelo provedor de e-mail. Isso não confirma chegada à caixa de entrada: confira spam. O vínculo com a Dino será criado somente quando o titular aceitar o link e definir sua senha, em até 24 horas.')
      await refreshInvites()
      try { await onRefresh?.() } catch { setError('Convite enviado, mas a lista não atualizou. Atualize a página; não reenvie o convite.') }
    } catch (cause) { if (currentScope.current === scopeKey) { setError(inviteErrorMessage(cause)); await refreshInvites() } }
    finally { submitting.current = false; setBusy(false) }
  }

  return <section className="ecommerce-admin-panel commerce-users-panel" aria-label="Usuários e acessos da empresa">
    <div className="ecommerce-admin-panel-heading"><div><span className="ecommerce-admin-kicker">Governança</span><h2>Usuários e permissões</h2><p className="commerce-admin-help">Atribua papéis somente à empresa selecionada. Excluir acesso desativa a membership; não apaga identidade ou auditoria.</p></div><div className="ecommerce-row-actions">{isDino && <button type="button" disabled={!empresaId || !storefrontId || busy} onClick={beginInvite}>Convidar novo operador Dino</button>}<button type="button" className="ecommerce-admin-button primary" disabled={!storefrontId || busy} onClick={beginCreate}>Adicionar acesso existente</button></div></div>
    {notice && <p role="status">{notice}</p>}{error && !modalOpen && <p role="alert">{error}</p>}
    {isDino && <div className="commerce-invite-history">
      <h3>Convites da Dino</h3>
      <p className="commerce-admin-help">O convite não ativa o acesso imediatamente. O titular recebe um link pessoal, define sua senha e então é vinculado à empresa. Contas do painel legado não são associadas automaticamente.</p>
      {inviteUnavailable ? <p role={modalOpen ? 'status' : 'alert'}>{inviteUnavailable}</p> : <p role="status">{inviteState?.ready ? 'Canal configurado para envio via Resend. A entrega depende da aceitação do provedor e da caixa do destinatário.' : 'Verificando canal de convites…'}</p>}
      <button type="button" disabled={busy} onClick={refreshInvites}>Atualizar convites</button>
      {inviteState?.items?.length > 0 ? <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Titular</th><th>E-mail</th><th>Validade</th><th>Estado do convite</th></tr></thead><tbody>{inviteState.items.map(item => <tr key={item.id}><td>{item.nome}</td><td>{item.email}</td><td>{formatDate(item.expires_at)}</td><td>{inviteStatusLabel(item)}</td></tr>)}</tbody></table></div> : inviteState && <p>Nenhum convite registrado nesta empresa.</p>}
    </div>}
    <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Usuário</th><th>Papel e permissões</th><th>Unidade</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>{memberships.map(item => <tr key={item.id}><td><strong>{item.nome_completo || 'Usuário'}</strong><small>{item.email}</small></td><td>{item.role_nome || item.role_codigo}{roles.find(role => role.id === item.role_id)?.permissoes?.length ? <small>{roles.find(role => role.id === item.role_id).permissoes.join(', ')}</small> : null}</td><td>{item.loja_nome || 'Todas as unidades desta empresa'}</td><td>{formatDate(item.expires_at)}</td><td>{item.ativo && item.expires_at && new Date(item.expires_at).getTime() <= Date.now() ? 'Expirado' : item.ativo ? 'Ativo' : 'Desativado'}</td><td><div className="ecommerce-row-actions"><button type="button" disabled={busy} onClick={() => beginEdit(item)}>Editar</button><button type="button" disabled={busy || !item.ativo || item.usuario_id === currentUserId} onClick={() => deactivate(item)}>Desativar</button></div></td></tr>)}</tbody></table>{!memberships.length && <p className="ecommerce-admin-empty">Sem acessos visíveis nesta empresa ou sem permissão para gerir usuários.</p>}</div>
    {inviting && isDino && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Convidar operador da Dino"><form className="ecommerce-admin-modal commerce-users-editor" onSubmit={sendInvite}><button type="button" className="ecommerce-admin-close" disabled={busy} onClick={closeInvite} aria-label="Fechar">×</button><h2>Convidar novo operador da Dino</h2><p className="commerce-admin-help">Apenas administradores de plataforma podem emitir este convite. Papel operacional em toda a empresa Dino, sem gestão de usuários. O destinatário receberá um link individual de uso único e criará sua própria senha; nenhuma senha é exibida aqui. O acesso só é criado após o aceite.</p>
      {(error || inviteUnavailable) && <p role="alert" className="commerce-users-error">{error || inviteUnavailable}</p>}
      <label>Nome<input required maxLength={180} autoComplete="name" disabled={busy} value={invite.nome} onChange={event => setInvite(previous => ({ ...previous, nome: event.target.value }))} /></label><label>E-mail do titular<input type="email" required autoComplete="email" disabled={busy} value={invite.email} onChange={event => setInvite(previous => ({ ...previous, email: event.target.value }))} /></label><div className="ecommerce-admin-modal-actions"><button type="button" disabled={busy} onClick={closeInvite}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary" disabled={busy || !empresaId || !storefrontId || !inviteState?.ready || Boolean(inviteStateError)}>{busy ? 'Enviando…' : 'Enviar convite pessoal'}</button></div></form></div>}
    {(creating || editing) && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label={editing ? 'Editar acesso' : 'Adicionar acesso'}><form className="ecommerce-admin-modal commerce-users-editor" onSubmit={save}><button type="button" className="ecommerce-admin-close" disabled={busy} onClick={() => { setCreating(false); setEditing(null); setError('') }} aria-label="Fechar">×</button><h2>{editing ? 'Editar acesso' : 'Adicionar usuário Commerce existente'}</h2><p className="commerce-admin-help">Este formulário só lista identidades Commerce já pertencentes à empresa selecionada; contas do painel legado não aparecem. Para um novo operador Dino, use o convite nominal e aguarde o titular criar sua senha. Não compartilhe senhas pelo painel.</p>
      {error && <p role="alert" className="commerce-users-error">{error}</p>}
      {creating && <><label>Buscar usuário Commerce desta empresa<input type="search" minLength={3} disabled={busy} value={query} onChange={event => { setQuery(event.target.value); update('usuarioId', ''); setError('') }} placeholder="Nome ou e-mail (mínimo 3 caracteres)" /></label>{searching && <p role="status">Buscando usuários…</p>}{!searching && query.trim().length >= 3 && !candidates.length && !error && <p role="status">Nenhum usuário Commerce encontrado nesta empresa. Uma conta criada no painel legado não pode ser vinculada por esta busca.</p>}<label>Usuário existente<select required disabled={busy || searching} value={form.usuarioId} onChange={event => update('usuarioId', event.target.value)}><option value="">Selecione um usuário</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.nome || candidate.nome_completo || 'Usuário'} · {candidate.email}</option>)}</select></label><label>Unidade<select disabled={busy} value={form.lojaId} onChange={event => update('lojaId', event.target.value)}><option value="">Todas as unidades desta empresa</option>{stores.map(store => <option key={store.id} value={store.id}>{store.nome}</option>)}</select></label></>}
      <label>Papel<select required disabled={busy} value={form.roleId} onChange={event => update('roleId', event.target.value)}><option value="">Selecione um papel</option>{roleOptions.map(role => <option key={role.id} value={role.id}>{role.nome}</option>)}</select></label><label>Validade do acesso<input type="datetime-local" disabled={busy} value={form.expiresAt} onChange={event => update('expiresAt', event.target.value)} /><small>Deixe vazio para não expirar; o servidor bloqueia acessos vencidos.</small></label><label><input type="checkbox" disabled={busy} checked={form.ativo} onChange={event => update('ativo', event.target.checked)} /> Acesso ativo</label>
      <div className="ecommerce-admin-modal-actions"><button type="button" disabled={busy} onClick={() => { setCreating(false); setEditing(null); setError('') }}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary" disabled={busy || (creating && !form.usuarioId)}>{busy ? 'Salvando…' : 'Salvar acesso'}</button></div></form></div>}
  </section>
}
