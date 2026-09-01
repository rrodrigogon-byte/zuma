import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { api, fmtR } from '../../lib/api'
import { parseCsv, rowToItem } from '../../lib/catalog-import'

function downloadTemplate() {
  const content = 'sku,produto,categoria,preco_brl,quantidade_total,acao_proposta,pendencia\nEXEMPLO-001,Produto exemplo,Perfumes,199.90,3,publicar,\n'
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'modelo-importacao-commerce.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function CommerceCatalogImport({ mode, storefrontId, locationId, onImported }) {
  const [fileName, setFileName] = useState('')
  const [items, setItems] = useState([])
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

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
    </section>
}
