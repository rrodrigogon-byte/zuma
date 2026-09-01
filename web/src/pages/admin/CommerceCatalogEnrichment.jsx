import { useMemo, useState } from 'react'
import { CheckCircle2, FileImage, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { buildCatalogEnrichmentPreview, catalogEnrichmentIdempotencyKey, extractCatalogEnrichmentTar, normalizeCatalogEnrichmentManifest } from '../../lib/catalog-enrichment'
import { uploadCoreProductMedia } from './commerce-admin-adapter'

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256File(file) {
  return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
}

export default function CommerceCatalogEnrichment({ mode, products = [], onImported }) {
  const [manifest, setManifest] = useState(null)
  const [manifestName, setManifestName] = useState('')
  const [imageFiles, setImageFiles] = useState([])
  const [imagePackageName, setImagePackageName] = useState('')
  const [preview, setPreview] = useState(null)
  const [hashErrors, setHashErrors] = useState([])
  const [confirmed, setConfirmed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, sku: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedFileSummary = useMemo(() => ({
    count: imageFiles.length,
    bytes: imageFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
  }), [imageFiles])

  async function selectManifest(event) {
    const file = event.target.files?.[0]
    setManifest(null)
    setManifestName('')
    setPreview(null)
    setHashErrors([])
    setConfirmed(false)
    setResult(null)
    setError('')
    setNotice('')
    if (!file) return
    try {
      const normalized = normalizeCatalogEnrichmentManifest(await file.text())
      if (!normalized.manifestHash) throw new Error('O manifesto não contém hash auditável.')
      if (!normalized.items.length) throw new Error('O manifesto não contém itens.')
      setManifest(normalized)
      setManifestName(file.name)
      setNotice(`${normalized.items.length} itens carregados no manifesto. Gere o preview antes de executar.`)
    } catch (err) {
      setError(err.message || 'Não foi possível ler o manifesto de enriquecimento.')
    }
  }

  function resetSelectionState() {
    setPreview(null)
    setHashErrors([])
    setConfirmed(false)
    setResult(null)
    setError('')
    setNotice('')
  }

  function selectImages(event) {
    setImageFiles(Array.from(event.target.files || []))
    setImagePackageName('')
    resetSelectionState()
  }

  async function selectImagePackage(event) {
    const file = event.target.files?.[0]
    setImageFiles([])
    setImagePackageName('')
    resetSelectionState()
    if (!file) return
    try {
      const extracted = extractCatalogEnrichmentTar(await file.arrayBuffer())
      setImageFiles(extracted.map(item => new File([item.bytes], item.name, { type: item.type })))
      setImagePackageName(file.name)
      setNotice(`${extracted.length} imagem(ns) extraídas localmente de ${file.name}. Gere o preview antes de executar.`)
    } catch (err) {
      setError(err.message || 'Não foi possível ler o pacote TAR de imagens.')
    }
  }

  async function generatePreview() {
    if (!manifest) return setError('Selecione o manifesto JSON aprovado.')
    setChecking(true)
    setError('')
    setNotice('')
    setResult(null)
    setConfirmed(false)
    try {
      const next = buildCatalogEnrichmentPreview({ manifest, products, files: imageFiles })
      const mismatches = []
      for (const row of next.rows.filter(item => item.uploadImage)) {
        const actual = await sha256File(row.file)
        if (!row.imageSha256 || actual !== row.imageSha256) mismatches.push({ sku: row.sku, expected: row.imageSha256, actual })
      }
      setHashErrors(mismatches)
      setPreview(next)
      if (next.summary.blockers || mismatches.length) setError(`Preview bloqueado: ${next.summary.blockers} inconsistência(s) de cadastro/arquivo e ${mismatches.length} divergência(s) SHA-256.`)
      else setNotice(`Preview pronto: ${next.summary.executable} SKU(s) aptos, ${next.summary.mediaUploads} imagem(ns) e ${next.summary.descriptionUpdates} descrição(ões).`)
    } catch (err) {
      setError(err.message || 'Não foi possível gerar o preview.')
    } finally {
      setChecking(false)
    }
  }

  async function executeEnrichment() {
    if (!preview || !confirmed || preview.summary.blockers || hashErrors.length) return
    setExecuting(true)
    setError('')
    setNotice('')
    setResult(null)
    const rows = preview.rows.filter(row => row.executable)
    const completed = []
    const failed = []
    let descriptionUpdates = 0
    let mediaUploads = 0
    let idempotentReplays = 0
    try {
      for (const [index, row] of rows.entries()) {
        setProgress({ current: index + 1, total: rows.length, sku: row.sku })
        try {
          if (row.updateDescription) {
            await api.patch(`/api/admin/commerce/catalog/products/${row.product.id}`, {
              descricaoCurta: row.shortDescription,
              descricao: row.detailedDescription,
            })
            descriptionUpdates += 1
          }
          if (row.uploadImage) {
            const media = await uploadCoreProductMedia(row.product.id, row.file, {
              altText: row.resolvedProductName || row.productName || row.product.nome,
              ordem: 0,
              variantId: row.product.variantId || null,
              idempotencyKey: catalogEnrichmentIdempotencyKey({ manifestHash: preview.manifestHash, sku: row.sku, imageSha256: row.imageSha256 }),
            })
            mediaUploads += media?.idempotentReplay ? 0 : 1
            idempotentReplays += media?.idempotentReplay ? 1 : 0
          }
          completed.push(row.sku)
        } catch (err) {
          failed.push({ sku: row.sku, error: err.message || 'falha não identificada', code: err.code || '', requestId: err.requestId || '' })
        }
      }
      setResult({ total: rows.length, completed: completed.length, failed, descriptionUpdates, mediaUploads, idempotentReplays, manifestHash: preview.manifestHash })
      if (failed.length) setError(`${failed.length} SKU(s) falharam. Corrija a causa e gere novo preview; os concluídos serão ignorados ou reexecutados de forma idempotente.`)
      else setNotice(`Enriquecimento concluído: ${completed.length} SKU(s), ${descriptionUpdates} descrição(ões) e ${mediaUploads} imagem(ns) gravadas.`)
      await onImported?.()
      setConfirmed(false)
    } finally {
      setExecuting(false)
      setProgress({ current: 0, total: 0, sku: '' })
    }
  }

  if (mode !== 'core') return null
  const blocked = !preview || preview.summary.blockers > 0 || hashErrors.length > 0

  return <section className="commerce-catalog-enrichment">
    <div className="commerce-catalog-enrichment-heading">
      <div><span className="ecommerce-admin-kicker"><FileImage size={14} /> Mídias e conteúdo</span><h3>Enriquecimento governado do catálogo</h3><p className="commerce-admin-help">Carregue manifesto e imagens, confira o preview e confirme somente depois. Preço, estoque, publicação e categoria não são alterados.</p></div>
      <span className="commerce-source-badge core"><ShieldCheck size={13} /> Tenant-scoped</span>
    </div>
    <div className="commerce-catalog-enrichment-inputs">
      <label>Manifesto JSON<input type="file" accept="application/json,.json" onChange={selectManifest} disabled={executing} /><small>{manifestName || 'Nenhum manifesto selecionado'}</small></label>
      <label>Imagens individuais<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={selectImages} disabled={executing} /><small>{imagePackageName ? 'Substituídas pelo pacote TAR' : `${selectedFileSummary.count} arquivo(s) · ${(selectedFileSummary.bytes / 1024 / 1024).toFixed(2)} MB`}</small></label>
      <label>Pacote TAR para lote<input type="file" accept="application/x-tar,.tar" onChange={selectImagePackage} disabled={executing} /><small>{imagePackageName || 'Opcional · extração local no navegador'}</small></label>
      <button type="button" className="ecommerce-admin-button ghost" onClick={generatePreview} disabled={!manifest || checking || executing}>{checking ? <><Loader2 className="commerce-spin" size={15} /> Validando…</> : <><Upload size={15} /> Gerar preview</>}</button>
    </div>
    {preview && <>
      <div className="commerce-catalog-enrichment-summary">
        <article><span>Manifesto</span><strong>{preview.summary.totalManifest}</strong><small>itens totais</small></article>
        <article><span>Aptos</span><strong>{preview.summary.executable}</strong><small>neste lote</small></article>
        <article><span>Imagens</span><strong>{preview.summary.mediaUploads}</strong><small>novos uploads</small></article>
        <article><span>Descrições</span><strong>{preview.summary.descriptionUpdates}</strong><small>atualizações</small></article>
        <article><span>Retidos</span><strong>{preview.summary.held}</strong><small>fora da execução</small></article>
        <article className={preview.summary.blockers || hashErrors.length ? 'attention' : ''}><span>Bloqueios</span><strong>{preview.summary.blockers + hashErrors.length}</strong><small>exigem correção</small></article>
      </div>
      <p className="commerce-catalog-enrichment-hash">Fingerprint: <code>{preview.manifestHash}</code></p>
      {(preview.summary.held > 0 || preview.summary.blockers > 0 || hashErrors.length > 0) && <details className="commerce-catalog-enrichment-details"><summary>Ver retenções e bloqueios</summary><div>{preview.rows.filter(row => !row.ready || row.blockers.length).slice(0, 40).map(row => <p key={row.sku}><strong>{row.sku}</strong> — {row.holdReason || row.blockers.join('; ')}</p>)}{hashErrors.map(row => <p key={`hash-${row.sku}`}><strong>{row.sku}</strong> — hash do arquivo divergente</p>)}</div></details>}
      <label className="commerce-catalog-enrichment-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={blocked || executing} /><span>Confirmo a aplicação das descrições e imagens deste fingerprint no tenant e na loja selecionados. O lote não altera preço, estoque ou publicação.</span></label>
      <button type="button" className="ecommerce-admin-button primary commerce-catalog-enrichment-execute" onClick={executeEnrichment} disabled={blocked || !confirmed || executing}>{executing ? <><Loader2 className="commerce-spin" size={15} /> {progress.current}/{progress.total} · {progress.sku}</> : <><CheckCircle2 size={15} /> Executar enriquecimento</>}</button>
    </>}
    {notice && <div className="commerce-import-notice success">{notice}</div>}
    {error && <div className="commerce-import-notice error">{error}</div>}
    {result && <div className="commerce-catalog-enrichment-result"><strong>Resultado do lote</strong><span>{result.completed}/{result.total} SKU(s) concluídos · {result.mediaUploads} mídia(s) nova(s) · {result.descriptionUpdates} descrição(ões) · {result.idempotentReplays} replay(s) idempotente(s)</span>{result.failed.length > 0 && <details><summary>{result.failed.length} falha(s)</summary>{result.failed.map(item => <p key={item.sku}><b>{item.sku}</b> — {item.error}{item.requestId ? ` · request ${item.requestId}` : ''}</p>)}</details>}</div>}
  </section>
}
