import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { api, fmtR } from '../../lib/api'
import { avecPreviewPayload, avecRowToItem, avecScopeMatches, isAbortError, parseAvecCsv, validAvecPreview } from '../../lib/avec-catalog-preview'
import { parseCsv, rowToItem } from '../../lib/catalog-import'
import AvecImportGovernancePreview from './AvecImportGovernancePreview'

function downloadTemplate() {
  const content = 'sku,produto,categoria,preco_brl,quantidade_total,acao_proposta,pendencia\nEXEMPLO-001,Produto exemplo,Perfumes,199.90,3,publicar,\n'
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'modelo-importacao-commerce.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function downloadAvecTemplate() {
  const content = 'id_origem,sku,ean,ncm,custo,unidade,nome\nAVEC-EXEMPLO-001,EXEMPLO-001,0012345678905,,,UN,Produto exemplo\n'
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'modelo-previa-avec.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function avecCostLabel(item) {
  if (!item.custoInformado) return 'Não informado'
  if (item.custoCents == null) return 'Inválido'
  return fmtR(Number(item.custoCents) / 100)
}

function avecStatusLabel(status) {
  return { proposable: 'Proponível', conflict: 'Conflito', ambiguous: 'Ambíguo', absent: 'Ausente' }[status] || status
}

export default function CommerceCatalogImport({ mode, empresaId, unitId, storefrontId, locationId, onImported }) {
  const [fileName, setFileName] = useState('')
  const [items, setItems] = useState([])
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [avecFileName, setAvecFileName] = useState('')
  const [avecItems, setAvecItems] = useState([])
  const [avecPreview, setAvecPreview] = useState(null)
  const [avecError, setAvecError] = useState('')
  const [avecLoading, setAvecLoading] = useState(false)
  const [avecPage, setAvecPage] = useState(1)
  const avecAbortRef = useRef(null)
  const avecRequestIdRef = useRef(0)
  const scopeKey = JSON.stringify([mode, empresaId, unitId, storefrontId, locationId])
  const scopeRef = useRef(scopeKey)
  scopeRef.current = scopeKey

  useEffect(() => () => { avecAbortRef.current?.abort() }, [])
  useEffect(() => {
    avecAbortRef.current?.abort()
    avecRequestIdRef.current += 1
    setAvecPreview(null)
    setAvecPage(1)
    setAvecError('')
    setAvecLoading(false)
    setAvecItems([])
    setAvecFileName('')
  }, [scopeKey])

  const localSummary = useMemo(() => ({
    total: items.length,
    publish: items.filter(item => ['publicar', 'publish'].includes(String(item.acao).toLowerCase()) && Number(item.preco) > 0 && Number(item.estoque) > 0).length,
    draft: items.length - items.filter(item => ['publicar', 'publish'].includes(String(item.acao).toLowerCase()) && Number(item.preco) > 0 && Number(item.estoque) > 0).length,
    units: items.reduce((sum, item) => sum + Math.max(0, Number(item.estoque || 0)), 0),
  }), [items])

  async function selectFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setPreview(null); setResult(null); setConfirmed(false)
    try {
      const parsed = parseCsv(await file.text()).map(rowToItem)
      setItems(parsed)
      setFileName(file.name)
    } catch (err) {
      setItems([])
      setFileName('')
      setError(err.message || 'Não foi possível ler o CSV.')
    } finally {
      event.target.value = ''
    }
  }

  function payload(extra = {}) {
    return { storefrontId, locationId, sourceLabel: fileName || 'importação administrativa', items, ...extra }
  }

  async function requestPreview() {
    if (!storefrontId || !locationId) return setError('Selecione uma loja com local de estoque antes de importar.')
    if (!items.length) return setError('Selecione um CSV válido antes de gerar o preview.')
    setLoading(true); setError(''); setPreview(null); setResult(null); setConfirmed(false)
    try {
      setPreview(await api.post('/api/admin/commerce/catalog/import/preview', payload()))
    } catch (err) { setError(err.message || 'Não foi possível gerar o preview.') }
    finally { setLoading(false) }
  }

  async function executeImport() {
    if (!preview || !confirmed) return
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await api.post('/api/admin/commerce/catalog/import/execute', payload({
        confirmImport: true,
        previewHash: preview.previewHash,
        idempotencyKey: `catalog-${preview.previewHash.slice(0, 48)}`,
      }))
      setResult(response)
      setConfirmed(false)
      await onImported?.()
    } catch (err) { setError(err.message || 'Não foi possível executar a importação.') }
    finally { setLoading(false) }
  }

  async function selectAvecFile(event) {
    const file = event.target.files?.[0]
    const target = event.target
    avecAbortRef.current?.abort()
    const selectionId = ++avecRequestIdRef.current
    const selectionScope = scopeKey
    setAvecLoading(false)
    setAvecFileName('')
    setAvecItems([])
    setAvecPreview(null)
    setAvecPage(1)
    setAvecError('')
    if (!file) return
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('CSV AVEC acima do limite de 2 MB.')
      const records = parseAvecCsv(await file.text()).map(avecRowToItem)
      if (selectionId !== avecRequestIdRef.current || scopeRef.current !== selectionScope) return
      setAvecFileName(file.name)
      setAvecItems(records)
    } catch (err) {
      if (selectionId !== avecRequestIdRef.current || scopeRef.current !== selectionScope) return
      setAvecError(err.message || 'Não foi possível ler o CSV AVEC.')
    } finally {
      target.value = ''
    }
  }

  async function requestAvecPreview() {
    if (!empresaId || !unitId || !storefrontId || !locationId) return setAvecError('Selecione a empresa, a loja e o local de estoque antes da prévia AVEC.')
    if (!avecItems.length) return setAvecError('Selecione um CSV AVEC válido antes de gerar a prévia.')
    avecAbortRef.current?.abort()
    const controller = new AbortController()
    avecAbortRef.current = controller
    const requestId = ++avecRequestIdRef.current
    const requestedScope = { empresaId, lojaId: unitId, storefrontId, locationId }
    setAvecLoading(true)
    setAvecError('')
    setAvecPreview(null)
    try {
      const response = await api.post('/api/admin/commerce/catalog/avec/preview', {
        storefrontId,
        locationId,
        ...avecPreviewPayload(avecFileName, avecItems),
      }, { signal: controller.signal })
      if (requestId !== avecRequestIdRef.current || controller.signal.aborted || scopeRef.current !== scopeKey) return
      if (!avecScopeMatches(response, requestedScope)) {
        throw new Error('A resposta da prévia AVEC saiu do escopo solicitado; descarte aplicado.')
      }
      if (!validAvecPreview(response) || response.summary.total !== avecItems.length) throw new Error('Resposta AVEC incompleta ou inválida; nenhuma prévia foi aceita.')
      setAvecPreview(response)
    } catch (err) {
      if (isAbortError(err) || requestId !== avecRequestIdRef.current) return
      setAvecError(err.message || 'Não foi possível gerar a prévia AVEC.')
    } finally {
      if (requestId === avecRequestIdRef.current) setAvecLoading(false)
    }
  }

  if (mode !== 'core') return null
  return <section className="commerce-catalog-import" aria-labelledby="catalog-import-title">
    <div className="ecommerce-admin-panel-heading">
      <div>
        <span className="ecommerce-admin-kicker"><FileSpreadsheet size={14} /> Importação governada</span>
        <h3 id="catalog-import-title">Pré-visualizar catálogo e estoque</h3>
        <p className="commerce-admin-help">O CSV é lido no navegador. Nenhuma gravação ocorre antes do preview e da confirmação explícita.</p>
      </div>
      <div className="ecommerce-admin-header-actions">
        <button type="button" className="ecommerce-admin-button ghost" onClick={downloadTemplate}>Baixar modelo</button>
        <label className="ecommerce-admin-button ghost" style={{ cursor: 'pointer' }}><Upload size={15} /> Selecionar CSV<input type="file" accept=".csv,text/csv" onChange={selectFile} hidden /></label>
        <button type="button" className="ecommerce-admin-button primary" onClick={requestPreview} disabled={loading || !items.length || !storefrontId || !locationId}>{loading ? <Loader2 size={15} className="ecommerce-admin-spin" /> : <FileSpreadsheet size={15} />} Gerar preview</button>
      </div>
    </div>

    {fileName && <div className="commerce-import-summary"><span><b>{fileName}</b></span><span><b>{localSummary.total}</b> itens</span><span><b>{localSummary.publish}</b> publicáveis</span><span><b>{localSummary.draft}</b> rascunhos</span><span><b>{localSummary.units}</b> unidades informadas</span></div>}
    {error && <div className="ecommerce-admin-alert error"><AlertTriangle size={16} /> {error}</div>}

    {preview && <div className="commerce-import-preview">
      <div className="commerce-import-summary"><span><b>{preview.summary.create}</b> criar</span><span><b>{preview.summary.update}</b> atualizar</span><span><b>{preview.summary.unchanged}</b> sem mudanças</span><span><b>{preview.summary.publish}</b> publicar</span><span><b>{preview.summary.draft}</b> rascunhos</span><span><b>{preview.summary.stockUnits}</b> unidades publicáveis</span></div>
      <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>SKU</th><th>Produto</th><th>Preço</th><th>Estoque alvo</th><th>Ação</th><th>Operação</th></tr></thead><tbody>{preview.items.slice(0, 25).map(item => <tr key={item.sku}><td><code>{item.sku}</code></td><td><strong>{item.name}</strong><small>{item.category}</small></td><td>{item.price == null ? 'Pendente' : fmtR(item.price)}</td><td>{item.targetStock == null ? 'Pendente' : item.targetStock}</td><td><span className={`commerce-source-badge ${item.action === 'publish' ? 'core' : 'legacy'}`}>{item.action === 'publish' ? 'Publicar' : 'Rascunho'}</span></td><td>{item.operation}{item.changes?.length ? ` · ${item.changes.join(', ')}` : ''}</td></tr>)}</tbody></table></div>
      {preview.items.length > 25 && <small className="commerce-admin-help">Mostrando 25 de {preview.items.length} itens. O resumo considera o lote completo.</small>}
      <label className="commerce-checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirmo a aplicação de {preview.summary.create} criações, {preview.summary.update} atualizações e estoque alvo no tenant e loja ativos.</label>
      <button type="button" className="ecommerce-admin-button primary" onClick={executeImport} disabled={loading || !confirmed}>{loading ? <Loader2 size={15} className="ecommerce-admin-spin" /> : <CheckCircle2 size={15} />} Executar importação confirmada</button>
    </div>}

    {result && <div className="ecommerce-admin-alert success"><CheckCircle2 size={16} /> Importação concluída: {result.summary.created} criados, {result.summary.updated} atualizados, {result.summary.published} publicados e {result.summary.drafts} rascunhos. Hash {result.datasetHash.slice(0, 12)}.</div>}

    <section className="commerce-avec-preview" aria-labelledby="avec-preview-title">
      <div className="ecommerce-admin-panel-heading">
        <div>
          <span className="ecommerce-admin-kicker"><FileSpreadsheet size={14} /> Prévia sob demanda</span>
          <h3 id="avec-preview-title">Enriquecer catálogo com AVEC</h3>
          <p className="commerce-admin-help">Consulta somente leitura por origem exata, SKU ou EAN. Custo, EAN e NCM são apenas propostas: nenhum writer ou ajuste de estoque é executado.</p>
        </div>
        <div className="ecommerce-admin-header-actions">
          <button type="button" className="ecommerce-admin-button ghost" onClick={downloadAvecTemplate}>Baixar modelo AVEC</button>
          <label className="ecommerce-admin-button ghost" style={{ cursor: 'pointer' }}><Upload size={15} /> Selecionar CSV AVEC<input type="file" accept=".csv,text/csv" onChange={selectAvecFile} hidden /></label>
          <button type="button" className="ecommerce-admin-button primary" onClick={requestAvecPreview} disabled={avecLoading || !avecItems.length || !empresaId || !unitId || !storefrontId || !locationId}>{avecLoading ? <Loader2 size={15} className="ecommerce-admin-spin" /> : <FileSpreadsheet size={15} />} Gerar prévia AVEC</button>
        </div>
      </div>
      {avecFileName && <div className="commerce-import-summary"><span><b>{avecFileName}</b></span><span><b>{avecItems.length}</b> itens carregados</span><span>limite <b>500</b></span></div>}
      {avecError && <div className="ecommerce-admin-alert error"><AlertTriangle size={16} /> {avecError}</div>}
      {avecPreview && <div className="commerce-import-preview">
        <div className="commerce-import-summary"><span><b>{avecPreview.summary.total}</b> total</span><span><b>{avecPreview.summary.proposable}</b> proponíveis</span><span><b>{avecPreview.summary.conflict}</b> conflitos</span><span><b>{avecPreview.summary.ambiguous}</b> ambíguos</span><span><b>{avecPreview.summary.absent}</b> ausentes</span><span><b>{avecPreview.summary.costMissing}</b> sem custo</span><span><b>{avecPreview.summary.costZero}</b> custo zero</span></div>
        <p className="commerce-admin-help">Fingerprint <code>{avecPreview.datasetHash}</code> · <strong>prévia somente</strong>: nenhum INSERT, UPDATE ou movimento de estoque.</p>
        <div className="ecommerce-admin-table-wrap"><table className="ecommerce-admin-table"><thead><tr><th>Origem / SKU</th><th>EAN atual → proposto</th><th>NCM atual → proposto</th><th>Custo atual → proposto</th><th>Unidade</th><th>Status</th><th>Motivos</th></tr></thead><tbody>{avecPreview.items.slice((avecPage - 1) * 25, avecPage * 25).map(item => <tr key={`${item.line}-${item.sourceId || item.sku || item.ean || 'item'}`}><td><strong>{item.sourceId || '—'}</strong><small>{item.sku || 'SKU não informado'}</small></td><td><code>{typeof item.proposal?.current?.barcode === 'string' ? item.proposal.current.barcode : 'Não verificado'} → {item.ean || '—'}</code></td><td><code>{typeof item.proposal?.current?.ncm === 'string' ? item.proposal.current.ncm : 'Não verificado'} → {item.ncm || '—'}</code></td><td>{Number.isSafeInteger(item.proposal?.current?.costCents) && item.proposal.current.costCents >= 0 ? fmtR(item.proposal.current.costCents / 100) : 'Não verificado'} → {avecCostLabel(item)}</td><td>{item.unidade || '—'}</td><td><span className={`commerce-source-badge ${item.status === 'proposable' ? 'core' : ''}`}>{avecStatusLabel(item.status)}</span></td><td>{item.reasons.join(', ') || '—'}</td></tr>)}</tbody></table></div>
        {avecPreview.items.length > 25 && <nav aria-label="Paginação da prévia AVEC" className="ecommerce-admin-header-actions"><button type="button" onClick={() => setAvecPage(page => page - 1)} disabled={avecPage <= 1}>Anterior</button><span>Página {avecPage} de {Math.ceil(avecPreview.items.length / 25)} · {avecPreview.items.length} itens no lote completo</span><button type="button" onClick={() => setAvecPage(page => page + 1)} disabled={avecPage >= Math.ceil(avecPreview.items.length / 25)}>Próxima</button></nav>}
      </div>}
    </section>
    <AvecImportGovernancePreview empresaId={empresaId} unitId={unitId} storefrontId={storefrontId} locationId={locationId} />
  </section>
}
