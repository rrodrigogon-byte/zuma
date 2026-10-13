import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, LoaderCircle, RefreshCw, ShieldAlert } from 'lucide-react'
import { api } from '../../lib/api'
import {
  diagnosticContext,
  diagnosticContextKey,
  diagnosticContextReady,
  diagnosticGuidance,
  diagnosticHeaders,
  diagnosticPath,
  mappedRateLabel,
  normalizeCatalogDiagnostic,
} from '../../lib/catalog-diagnostic.js'

const EMPTY = { kind: 'idle' }

function statusIcon(status) {
  if (status === 'aligned') return <CheckCircle2 size={15} aria-hidden="true" />
  if (status === 'divergent' || status === 'ambiguous') return <AlertTriangle size={15} aria-hidden="true" />
  if (status === 'notVerified' || status === 'unmapped' || status === 'outOfScope') return <ShieldAlert size={15} aria-hidden="true" />
  return null
}

function DiagnosticUnavailable({ reason, onRetry }) {
  const message = reason === 'context'
    ? 'Selecione uma empresa, unidade e storefront Commerce ativo para consultar o diagnóstico.'
    : reason === 'permission'
      ? 'Seu perfil não possui reports.read. O diagnóstico fica oculto neste contexto.'
      : reason === 'incomplete'
        ? 'A resposta do diagnóstico veio incompleta. Os números não devem ser interpretados como zero.'
        : 'Não foi possível consultar o diagnóstico agora. Os números não devem ser interpretados como zero.'
  return <div className="commerce-catalog-diagnostic-state" role="status">
    <ShieldAlert size={18} aria-hidden="true" />
    <div><strong>{reason === 'permission' ? 'Diagnóstico indisponível' : 'Diagnóstico não verificável'}</strong><span>{message}</span></div>
    {onRetry && reason !== 'permission' && <button type="button" className="ecommerce-admin-button ghost" onClick={onRetry}><RefreshCw size={14} /> Tentar novamente</button>}
  </div>
}

export default function CommerceCatalogDiagnostic({ mode, empresaId, unitId, storefrontId, canReadReports = true, open = false }) {
  const context = useMemo(() => diagnosticContext({ mode, empresaId, unitId, storefrontId, canReadReports }), [mode, empresaId, unitId, storefrontId, canReadReports])
  const contextKey = diagnosticContextKey(context)
  const [state, setState] = useState(EMPTY)
  const controllerRef = useRef(null)
  const requestSequence = useRef(0)
  const mountedRef = useRef(true)
  const previousOpen = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestSequence.current += 1
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    requestSequence.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    setState(EMPTY)
  }, [contextKey])

  const load = useCallback(async () => {
    if (!diagnosticContextReady(context)) {
      setState({ kind: context.mode === 'core' && !context.canReadReports ? 'unavailable' : 'unavailable', reason: context.mode !== 'core' || !context.empresaId || !context.unitId || !context.storefrontId ? 'context' : 'permission' })
      return
    }
    const sequence = ++requestSequence.current
    const snapshot = { ...context }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ kind: 'loading' })
    try {
      const payload = await api.get(diagnosticPath(snapshot.storefrontId), {
        headers: diagnosticHeaders(snapshot),
        signal: controller.signal,
      })
      if (!mountedRef.current || sequence !== requestSequence.current || diagnosticContextKey(snapshot) !== diagnosticContextKey(context)) return
      const normalized = normalizeCatalogDiagnostic(payload)
      setState(normalized)
    } catch (error) {
      if (error?.name === 'AbortError' || !mountedRef.current || sequence !== requestSequence.current) return
      setState({ kind: 'unavailable', reason: error?.status === 403 ? 'permission' : 'error' })
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [context, contextKey])

  useEffect(() => {
    const opened = open && !previousOpen.current
    previousOpen.current = open
    if (opened && state.kind === 'idle') void load()
  }, [open, state.kind, load])

  const normalized = state.kind === 'ready' ? state : null
  return <section className="commerce-catalog-diagnostic" aria-labelledby="commerce-catalog-diagnostic-title">
    <div className="commerce-catalog-diagnostic-heading">
      <div><span className="ecommerce-admin-kicker"><ClipboardCheck size={14} /> Leitura operacional</span><h3 id="commerce-catalog-diagnostic-title">Diagnóstico do catálogo</h3><p className="commerce-admin-help">Consulta somente após abrir este detalhe. Compara vínculos exatos, preço e estoque no escopo atual.</p></div>
      <button type="button" className="ecommerce-admin-button ghost" onClick={load} disabled={state.kind === 'loading' || !diagnosticContextReady(context)} aria-describedby="commerce-catalog-diagnostic-help">{state.kind === 'loading' ? <LoaderCircle className="ecommerce-admin-spin" size={14} /> : <ClipboardCheck size={14} />} {state.kind === 'loading' ? 'Consultando…' : state.kind === 'idle' ? 'Abrir diagnóstico' : 'Atualizar diagnóstico'}</button>
    </div>
    <p id="commerce-catalog-diagnostic-help" className="commerce-admin-help">Não cria produtos, não ajusta estoque e não faz correspondência por nome.</p>
    {state.kind === 'idle' && <p className="commerce-catalog-diagnostic-hint">Abra quando precisar investigar diferenças sem aumentar as leituras globais do catálogo.</p>}
    {state.kind === 'loading' && <div className="commerce-catalog-diagnostic-state" role="status"><LoaderCircle className="ecommerce-admin-spin" size={18} /><span>Consultando o escopo selecionado…</span></div>}
    {state.kind === 'unavailable' && <DiagnosticUnavailable reason={state.reason} onRetry={state.reason !== 'permission' && diagnosticContextReady(context) ? load : null} />}
    {normalized && <>
      <div className="commerce-catalog-diagnostic-summary" aria-label="Resumo do diagnóstico">
        <article><span>Itens de origem</span><strong>{normalized.summary.sourceItems}</strong><small>denominador do escopo</small></article>
        <article><span>Mapeados</span><strong>{normalized.summary.mapped}</strong><small>{mappedRateLabel(normalized.mappedRate)} com denominador válido</small></article>
        <article className={normalized.summary.divergent ? 'attention' : ''}><span>Divergências</span><strong>{normalized.summary.divergent}</strong><small>comparáveis com diferença</small></article>
        <article className={normalized.summary.notVerified || normalized.summary.ambiguous || normalized.summary.unmapped ? 'attention soft' : ''}><span>Não verificáveis</span><strong>{normalized.summary.notVerified + normalized.summary.ambiguous + normalized.summary.unmapped}</strong><small>vínculo ou resposta incompleta</small></article>
      </div>
      <p className="commerce-catalog-diagnostic-guidance">{diagnosticGuidance(normalized.summary)}</p>
      <div className="ecommerce-admin-table-wrap commerce-catalog-diagnostic-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Resultado</th><th>Itens</th><th>Leitura</th></tr></thead><tbody>{normalized.rows.map(row => <tr key={row.key}><td><span className={`commerce-catalog-diagnostic-status ${row.key}`}>{statusIcon(row.key)} {row.label}</span></td><td><strong>{row.count}</strong></td><td><small>{row.detail}</small></td></tr>)}</tbody></table></div>
    </>}
  </section>
}
