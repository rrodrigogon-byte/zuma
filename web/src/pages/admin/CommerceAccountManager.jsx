import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import './commerce-account-manager.css'
import PlatformAdministratorManager from './PlatformAdministratorManager'

const ROOT = '/api/admin/platform/accounts'
const roleName = role => role.codigo === 'tenant_owner' ? 'Administrador da empresa' : role.nome
const emptyPerson = { nome: '', email: '', telefone: '', senha: '' }
const dateInput = value => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function CommerceAccountManager({ empresaId, onRefresh }) {
  const [options, setOptions] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [mode, setMode] = useState(null)
  const [person, setPerson] = useState(emptyPerson)
  const [access, setAccess] = useState([])
  const [search, setSearch] = useState('')
  const [sources, setSources] = useState([])
  const [sourceKey, setSourceKey] = useState('')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const requests = useRef(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    const result = await api.get(ROOT)
    setAccounts(Array.isArray(result.items) ? result.items : [])
  }, [])
  useEffect(() => {
    let current = true
    api.get(`${ROOT}/options`).then(async result => {
      if (!current || result.canManage !== true) return
      setOptions(result)
      const list = await api.get(ROOT)
      if (current) setAccounts(list.items || [])
    }).catch(cause => {
      if (current && cause.status !== 403) setError(cause.message || 'Não foi possível carregar a gestão de contas.')
    })
    return () => { current = false; ++requests.current }
  }, [])
  useEffect(() => {
    if (mode !== 'import' || search.trim().length < 3) { setSources([]); return }
    const request = ++requests.current
    const timer = setTimeout(() => {
      api.get(`${ROOT}/sources?query=${encodeURIComponent(search.trim())}`).then(result => {
        if (requests.current === request) setSources(result.items || [])
      }).catch(cause => { if (requests.current === request) setError(cause.message || 'Não foi possível buscar a conta existente.') })
    }, 300)
    return () => { clearTimeout(timer); ++requests.current }
  }, [mode, search])

  function initialAccess() {
    return empresaId && options?.companies?.some(company => company.id === empresaId)
      ? [{ empresaId, lojaId: '', roleCode: 'store_admin', expiresAt: '', ativo: true }]
      : []
  }
  function begin(nextMode) {
    ++requests.current
    setMode(nextMode); setPerson(emptyPerson); setAccess(initialAccess())
    setSearch(''); setSources([]); setSourceKey(''); setSelected(null); setError(''); setNotice('')
  }
  function close() { if (!busy) { ++requests.current; setMode(null); setPerson(emptyPerson); setError('') } }
  function updatePerson(key, value) { setPerson(current => ({ ...current, [key]: value })) }
  function changeAccess(index, key, value) {
    if (key === 'roleCode' && value === 'tenant_owner' && access[index]?.id && access[index]?.lojaId) {
      setError('O perfil de administrador da empresa exige um novo vínculo de empresa inteira. Adicione uma linha e mantenha ou desative o vínculo da unidade.'); return
    }
    setAccess(current => current.map((item, i) => i !== index ? item : { ...item, [key]: value,
      ...(key === 'empresaId' ? { lojaId: '' } : {}), ...(key === 'roleCode' && value === 'tenant_owner' ? { lojaId: '' } : {}) }))
  }
  function addCompany() { setAccess(current => [...current, { empresaId: '', lojaId: '', roleCode: 'store_admin', expiresAt: '', ativo: true }]) }
  async function manageAccount(account) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.get(`${ROOT}/${account.id}`)
      setSelected(result.account); setPerson(emptyPerson); setMode('access')
      setAccess((result.access || []).map(item => ({ ...item, lojaId: item.lojaId || '', expiresAt: dateInput(item.expiresAt) })))
    } catch (cause) { setError(cause.message || 'Não foi possível consultar os vínculos.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function save(event) {
    event.preventDefault()
    if (lock.current) return
    if (!access.length || access.some(item => !item.empresaId)) { setError('Selecione pelo menos uma empresa e complete todas as linhas.'); return }
    const source = sources.find(item => `${item.source}:${item.sourceId}` === sourceKey)
    if (mode === 'import' && !source) { setError('Selecione a conta existente pelo cadastro encontrado.'); return }
    const prepared = access.map(item => ({ empresaId: item.empresaId, lojaId: item.lojaId || null, roleCode: item.roleCode, ativo: item.ativo, expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : null }))
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'customer') {
        await api.post(`${ROOT}/customers`, { nome: person.nome.trim(), email: person.email.trim() || null, telefone: person.telefone.trim() || null, empresas: [...new Set(access.map(item => item.empresaId))] })
        setNotice('Cliente cadastrado nas empresas selecionadas, sem senha e sem acesso ao painel. Os dados de cada empresa continuam separados.')
      } else if (mode === 'import') {
        await api.post(`${ROOT}/import`, { source: source.source, sourceId: source.sourceId, access: prepared })
        setNotice('Conta existente associada por identificação explícita. A senha permanece a da origem e os perfis são independentes por empresa.')
      } else if (mode === 'access') {
        await api.post(`${ROOT}/${selected.id}/access`, { access: prepared })
        setNotice('Vínculos atualizados. Novas requisições já respeitam os perfis, estados e validades informados.')
      } else {
        await api.post(ROOT, { nome: person.nome.trim(), email: person.email.trim(), telefone: person.telefone.trim(), senha: person.senha, access: prepared })
        setNotice('Usuário criado com uma conta de login e acessos nas empresas selecionadas. Nenhum e-mail foi enviado; a criação direta não depende do Resend.')
      }
      setMode(null); setPerson(emptyPerson)
      try { await reload(); await onRefresh?.() } catch { setError('Cadastro salvo, mas a lista não atualizou. Atualize a página sem salvar novamente.') }
    } catch (cause) { setError(cause.message || 'Não foi possível salvar. Nenhum vínculo parcial deve ser criado.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function toggleAccount(account) {
    if (lock.current || !window.confirm(account.ativo ? `Desativar todos os acessos de ${account.nome}? O histórico será preservado.` : `Reativar a conta de ${account.nome}? Os vínculos ativos voltarão a valer.`)) return
    lock.current = true; setBusy(true); setError('')
    try { await api.patch(`${ROOT}/${account.id}`, { ativo: !account.ativo }); setNotice('Estado da conta atualizado.'); await reload(); await onRefresh?.() }
    catch (cause) { setError(cause.message || 'Não foi possível alterar a conta.') }
    finally { lock.current = false; setBusy(false) }
  }

  if (!options) return error ? <p role="alert" className="commerce-users-error">{error}</p> : null
  const panelRoles = (options.roles || []).filter(role => !['customer', 'platform_owner'].includes(role.codigo))
  const source = sources.find(item => `${item.source}:${item.sourceId}` === sourceKey)
  return <div className="commerce-account-manager">
    <header><div><span className="ecommerce-admin-kicker">Administração da plataforma</span><h3>Contas e acessos multiempresa</h3><p>Uma conta de login. Perfis diferentes em cada empresa. Clientes não recebem acesso administrativo automaticamente.</p></div><div className="commerce-account-actions">
      <button type="button" className="ecommerce-admin-button primary" disabled={busy} onClick={() => begin('new')}>Criar usuário</button>
      <button type="button" className="ecommerce-admin-button ghost" disabled={busy} onClick={() => begin('customer')}>Cadastrar cliente</button>
      <button type="button" className="ecommerce-admin-button ghost" disabled={busy} onClick={() => begin('import')}>Associar conta existente</button>
    </div></header>
    {notice && <p role="status" className="commerce-account-notice">{notice}</p>}{error && !mode && <p role="alert" className="commerce-users-error">{error}</p>}
    <PlatformAdministratorManager />
    <details><summary>Contas multiempresa cadastradas ({accounts.length})</summary><p className="commerce-admin-help">Contas anteriores só aparecem aqui depois de uma associação explícita. A lista abaixo não combina cadastros por e-mail.</p>
      <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td>{account.nome}</td><td>{account.email}</td><td>{account.ativo ? 'Ativa' : 'Desativada'}</td><td><div className="ecommerce-row-actions"><button type="button" disabled={busy || !account.ativo} onClick={() => manageAccount(account)}>Gerenciar empresas</button><button type="button" disabled={busy} onClick={() => toggleAccount(account)}>{account.ativo ? 'Desativar conta' : 'Reativar conta'}</button></div></td></tr>)}</tbody></table></div>
      {!accounts.length && <p className="commerce-admin-help">Nenhuma conta multiempresa cadastrada.</p>}
    </details>
    {mode && <div className="ecommerce-admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastro e acessos multiempresa"><form className="ecommerce-admin-modal commerce-account-modal" onSubmit={save}>
      <button type="button" className="ecommerce-admin-close" disabled={busy} onClick={close} aria-label="Fechar">×</button>
      <span className="ecommerce-admin-kicker">Conta e empresas</span><h2>{mode === 'customer' ? 'Cadastrar cliente' : mode === 'import' ? 'Associar conta existente' : mode === 'access' ? `Acessos de ${selected?.nome}` : 'Criar usuário'}</h2>
      <p className="commerce-admin-help">{mode === 'customer' ? 'Cadastro comercial sem login, senha ou permissões administrativas. Cada empresa recebe seu próprio cadastro.' : 'Escolha explicitamente as empresas e o perfil de acesso em cada uma. Administrador empresarial não recebe administração da plataforma.'}</p>
      {error && <p role="alert" className="commerce-users-error">{error}</p>}
      {mode === 'import' ? <><label>Buscar conta existente<input type="search" value={search} disabled={busy} onChange={event => { setSearch(event.target.value); setSourceKey(''); setError('') }} placeholder="Nome ou e-mail (mínimo 3 caracteres)" /></label><label>Cadastro de origem<select required value={sourceKey} disabled={busy} onChange={event => setSourceKey(event.target.value)}><option value="">Selecione a identidade pelo cadastro</option>{sources.map(item => <option key={`${item.source}:${item.sourceId}`} value={`${item.source}:${item.sourceId}`}>{item.nome} · {item.email} · {item.empresaNome}</option>)}</select></label>{source && <p className="commerce-admin-help">A senha atual será preservada. A associação é pelo ID escolhido; identidades ambíguas não serão combinadas.</p>}</> : mode !== 'access' && <div className="commerce-account-person">
        <label>Nome completo<input required maxLength={255} value={person.nome} disabled={busy} autoComplete="name" onChange={event => updatePerson('nome', event.target.value)} /></label>
        <label>E-mail{mode === 'customer' ? ' (opcional)' : ''}<input type="email" required={mode !== 'customer'} maxLength={320} value={person.email} disabled={busy} autoComplete="email" onChange={event => updatePerson('email', event.target.value)} /></label>
        <label>Telefone (opcional)<input type="tel" maxLength={30} value={person.telefone} disabled={busy} autoComplete="tel" onChange={event => updatePerson('telefone', event.target.value)} /></label>
        {mode === 'new' && <label>Senha inicial<input type="password" required minLength={12} maxLength={72} value={person.senha} disabled={busy} autoComplete="new-password" onChange={event => updatePerson('senha', event.target.value)} /><small>Ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo. Não será exibida após salvar nem enviada por e-mail.</small></label>}
      </div>}
      <div className="commerce-account-access-heading"><h3>{mode === 'customer' ? 'Empresas do cliente' : 'Acessos por empresa'}</h3><button type="button" disabled={busy || access.length >= 20} onClick={addCompany}>Adicionar empresa</button></div>
      {!access.length && <p>Adicione pelo menos uma empresa.</p>}
      {access.map((item, index) => <fieldset key={index} className="commerce-account-access"><legend>Empresa {index + 1}</legend><label>Empresa<select required disabled={busy || Boolean(item.id)} value={item.empresaId} onChange={event => changeAccess(index, 'empresaId', event.target.value)}><option value="">Selecione uma empresa</option>{options.companies.map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}</select></label>
        {mode !== 'customer' && <><label>Perfil<select required disabled={busy} value={item.roleCode} onChange={event => changeAccess(index, 'roleCode', event.target.value)}>{panelRoles.map(role => <option key={role.codigo} value={role.codigo}>{roleName(role)}</option>)}</select></label><label>Unidade<select disabled={busy || item.roleCode === 'tenant_owner' || Boolean(item.id)} value={item.lojaId || ''} onChange={event => changeAccess(index, 'lojaId', event.target.value)}><option value="">Empresa inteira</option>{options.stores.filter(store => store.empresaId === item.empresaId).map(store => <option key={store.id} value={store.id}>{store.nome}</option>)}</select></label><label>Validade (opcional)<input type="datetime-local" disabled={busy} value={item.expiresAt || ''} onChange={event => changeAccess(index, 'expiresAt', event.target.value)} /></label><label className="commerce-account-checkbox"><input type="checkbox" checked={item.ativo} disabled={busy} onChange={event => changeAccess(index, 'ativo', event.target.checked)} /> Acesso ativo</label></>}
        {!item.id && <button type="button" className="commerce-account-remove" disabled={busy} onClick={() => setAccess(current => current.filter((_, i) => i !== index))}>Remover linha</button>}
      </fieldset>)}
      <p className="commerce-admin-help">{mode === 'access' ? 'Para revogar um vínculo, desmarque Acesso ativo. Os demais vínculos e o histórico serão preservados.' : mode === 'new' ? 'Criação direta: não envia convite. Quem prefere definir a própria senha por link pode continuar usando o convite nominal da empresa.' : 'Nenhuma alteração afeta outras identidades com o mesmo e-mail.'}</p>
      <div className="ecommerce-admin-modal-actions"><button type="button" className="ecommerce-admin-button ghost" disabled={busy} onClick={close}>Cancelar</button><button type="submit" className="ecommerce-admin-button primary" disabled={busy || !access.length}>{busy ? 'Salvando…' : mode === 'customer' ? 'Cadastrar cliente' : 'Salvar conta e acessos'}</button></div>
    </form></div>}
  </div>
}
