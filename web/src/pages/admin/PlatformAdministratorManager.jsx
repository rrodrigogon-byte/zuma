import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'

const ROOT = '/api/admin/platform/administrators'

function messageFor(error, fallback) {
  return error?.message || fallback
}

export function administratorStatusLabel(item, now = Date.now()) {
  if (item?.ativo !== true) return 'Desativado'
  if (item?.expiresAt) {
    const expires = new Date(item.expiresAt).getTime()
    if (Number.isFinite(expires) && expires <= now) return 'Expirado'
    return 'Ativo · com validade'
  }
  return 'Ativo · sem vencimento'
}

function expirationLabel(value) {
  if (!value) return 'Sem vencimento'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'Validade não reconhecida'
}

export function administratorSearchPath(query) {
  return `${ROOT}?query=${encodeURIComponent(String(query || '').trim())}`
}

export default function PlatformAdministratorManager({ platformAdmin } = {}) {
  const auth = useAuth() || {}
  const canManage = typeof platformAdmin === 'boolean' ? platformAdmin : auth.isPlatformAdmin === true
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [selected, setSelected] = useState(null)
  const [confirmGlobal, setConfirmGlobal] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const actionLock = useRef(false)
  const listRequest = useRef(0)
  const searchRequest = useRef(0)

  const clearSelection = useCallback(() => {
    setCandidates([])
    setSelected(null)
    setConfirmGlobal(false)
  }, [])

  const loadItems = useCallback(async () => {
    const request = ++listRequest.current
    setLoadingItems(true)
    try {
      const result = await api.get(ROOT)
      if (listRequest.current !== request) return
      setItems(Array.isArray(result?.items) ? result.items : [])
    } catch (cause) {
      if (listRequest.current !== request) return
      setItems([])
      clearSelection()
      setError(messageFor(cause, 'Não foi possível carregar os administradores globais.'))
    } finally {
      if (listRequest.current === request) setLoadingItems(false)
    }
  }, [clearSelection])

  useEffect(() => {
    if (!canManage) return undefined
    setItems([])
    setError('')
    setNotice('')
    clearSelection()
    setQuery('')
    setHasSearched(false)
    loadItems()
    return () => {
      ++listRequest.current
      ++searchRequest.current
    }
  }, [canManage, clearSelection, loadItems])

  function changeQuery(value) {
    ++searchRequest.current
    setQuery(value)
    clearSelection()
    setHasSearched(false)
    setSearching(false)
    setError('')
    setNotice('')
  }

  async function searchCandidates(event) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 3) {
      clearSelection()
      setHasSearched(false)
      setError('Informe pelo menos 3 caracteres para buscar uma identidade existente.')
      return
    }
    const request = ++searchRequest.current
    clearSelection()
    setHasSearched(true)
    setSearching(true)
    setError('')
    setNotice('')
    try {
      const result = await api.get(administratorSearchPath(term))
      if (searchRequest.current !== request) return
      setCandidates(Array.isArray(result?.candidates) ? result.candidates : [])
    } catch (cause) {
      if (searchRequest.current !== request) return
      clearSelection()
      setHasSearched(false)
      setError(messageFor(cause, 'Não foi possível buscar identidades existentes.'))
    } finally {
      if (searchRequest.current === request) setSearching(false)
    }
  }

  function chooseCandidate(candidate) {
    if (busy) return
    setSelected(candidate)
    setConfirmGlobal(false)
    setError('')
    setNotice('')
  }

  async function grant() {
    if (actionLock.current || busy || !selected || !confirmGlobal) return
    actionLock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.post(ROOT, {
        sourceUserId: selected.sourceUserId,
        confirmGlobal: true,
        expiresAt: null,
      })
      if (result?.ok !== true) throw new Error('A concessão global não foi confirmada pelo servidor.')
      clearSelection()
      setQuery('')
      setHasSearched(false)
      setNotice(result.idempotent
        ? 'Esta identidade já possuía a administração global. Nenhuma conta ou senha foi criada.'
        : 'Administrador global concedido à identidade existente. O cadastro e a senha originais foram preservados.')
      await loadItems()
    } catch (cause) {
      clearSelection()
      setError(messageFor(cause, 'Não foi possível conceder a administração global.'))
    } finally {
      actionLock.current = false
      setBusy(false)
    }
  }

  function askRevoke(account) {
    if (busy) return
    setRevokeTarget(account)
    setError('')
    setNotice('')
  }

  function cancelRevoke() {
    if (!busy) setRevokeTarget(null)
  }

  async function revoke(account) {
    if (actionLock.current || busy || !account?.accountId) return
    actionLock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.post(`${ROOT}/${encodeURIComponent(String(account.accountId))}/revoke`, { confirmRevoke: true })
      if (result?.ok !== true) throw new Error('A revogação global não foi confirmada pelo servidor.')
      setRevokeTarget(null)
      setNotice('Administração global revogada. A identidade e os acessos empresariais foram preservados.')
      await loadItems()
    } catch (cause) {
      setRevokeTarget(null)
      setError(messageFor(cause, 'Não foi possível revogar a administração global.'))
    } finally {
      actionLock.current = false
      setBusy(false)
    }
  }

  if (!canManage) return null

  return <section className="commerce-platform-admin-panel commerce-subpanel" aria-labelledby="commerce-platform-admin-heading">
    <div className="ecommerce-admin-panel-heading">
      <div>
        <span className="ecommerce-admin-kicker">Administração global</span>
        <h3 id="commerce-platform-admin-heading">Administradores da plataforma</h3>
        <p className="commerce-admin-help">Conceda o alcance global somente a uma identidade SQL existente. Este fluxo não cria usuários, não cria senha e não combina cadastros pelo e-mail.</p>
      </div>
    </div>
    <p className="commerce-admin-help"><strong>Atenção:</strong> Todas empresas e unidades atuais e futuras, sem vencimento; senha e cadastro existentes preservados.</p>

    {notice && <p role="status" className="commerce-account-notice">{notice}</p>}
    {error && <p role="alert" className="commerce-users-error">{error}</p>}

    <form className="commerce-inline-form" onSubmit={searchCandidates}>
      <label>E-mail ou nome da identidade existente
        <input
          type="search"
          value={query}
          disabled={busy || searching}
          minLength={3}
          maxLength={120}
          autoComplete="off"
          onChange={event => changeQuery(event.target.value)}
          placeholder="Mínimo de 3 caracteres"
          aria-describedby="commerce-platform-admin-search-help"
        />
      </label>
      <button type="submit" className="ecommerce-admin-button ghost" disabled={busy || searching || query.trim().length < 3}>
        {searching ? 'Buscando…' : 'Buscar identidade'}
      </button>
    </form>
    <p id="commerce-platform-admin-search-help" className="commerce-admin-help">A busca é explícita e só consulta quando você confirma o botão. Selecione uma identidade encontrada antes de qualquer concessão.</p>

    {searching && <p role="status" className="commerce-admin-help">Buscando identidades existentes…</p>}
    {!searching && hasSearched && !candidates.length && <p role="status" className="commerce-admin-help">Nenhuma identidade existente disponível para esta busca.</p>}
    {!!candidates.length && <div className="commerce-credit-list" aria-label="Identidades encontradas">
      {candidates.map(candidate => {
        const candidateKey = String(candidate.sourceUserId)
        const isSelected = selected?.sourceUserId === candidate.sourceUserId
        return <article className="commerce-credit-card" key={candidateKey}>
          <div>
            <strong>{candidate.nome || 'Identidade existente'}</strong>
            <span>{candidate.email} · {candidate.empresaNome}</span>
          </div>
          <button type="button" className={`ecommerce-admin-button ${isSelected ? 'primary' : 'ghost'}`} aria-pressed={isSelected} disabled={busy} onClick={() => chooseCandidate(candidate)}>
            {isSelected ? 'Identidade selecionada' : 'Selecionar identidade'}
          </button>
        </article>
      })}
    </div>}

    {selected && <article className="commerce-credit-card" aria-label="Confirmação de administrador global">
      <div>
        <strong>Identidade selecionada: {selected.nome || 'Identidade existente'}</strong>
        <span>{selected.email} · origem: {selected.empresaNome}</span>
        <small className="commerce-admin-help">Todas empresas e unidades atuais e futuras, sem vencimento; senha e cadastro existentes preservados.</small>
      </div>
      <div className="ecommerce-row-actions">
        <label className="commerce-checkbox">
          <input type="checkbox" checked={confirmGlobal} disabled={busy} onChange={event => setConfirmGlobal(event.target.checked)} />
          Confirmo a concessão global
        </label>
        <button type="button" className="ecommerce-admin-button primary" disabled={busy || !confirmGlobal} onClick={grant}>
          {busy ? 'Concedendo…' : 'Conceder administrador global'}
        </button>
      </div>
    </article>}

    <div className="ecommerce-admin-panel-heading" style={{ marginTop: 22 }}>
      <div>
        <h3>Concessões atuais</h3>
        <p className="commerce-admin-help">Revogar remove somente a administração global. A identidade existente e seus vínculos empresariais não são apagados.</p>
      </div>
    </div>
    {loadingItems && <p role="status" className="commerce-admin-help">Carregando concessões…</p>}
    <div className="ecommerce-admin-table-wrap">
      <table className="ecommerce-admin-table">
        <thead><tr><th>Identidade</th><th>Status</th><th>Validade</th><th>Ações</th></tr></thead>
        <tbody>
          {items.map(item => {
            const accountKey = String(item.accountId)
            const isRevokeTarget = revokeTarget?.accountId === item.accountId
            return <tr key={accountKey}>
              <td><strong>{item.nome || 'Identidade existente'}</strong><small>{item.email}</small></td>
              <td>{administratorStatusLabel(item)}</td>
              <td>{expirationLabel(item.expiresAt)}</td>
              <td>
                {isRevokeTarget ? <div className="ecommerce-row-actions">
                  <button type="button" className="ecommerce-admin-button primary" disabled={busy} onClick={() => revoke(item)}>Confirmar revogação</button>
                  <button type="button" className="ecommerce-admin-button ghost" disabled={busy} onClick={cancelRevoke}>Cancelar</button>
                </div> : <button type="button" className="ecommerce-admin-button ghost" disabled={busy || item.ativo !== true} onClick={() => askRevoke(item)}>Revogar</button>}
              </td>
            </tr>
          })}
        </tbody>
      </table>
      {!loadingItems && !items.length && <p className="ecommerce-admin-empty">Nenhuma concessão global registrada.</p>}
    </div>
  </section>
}
