import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalogEnrichmentPreview, catalogEnrichmentIdempotencyKey, normalizeCatalogEnrichmentManifest } from './catalog-enrichment.js'

test('normaliza manifesto e reconcilia SKU com produto e arquivo', () => {
  const manifest = normalizeCatalogEnrichmentManifest({
    summary: { manifestHash: 'a'.repeat(64) },
    items: [{
      sku: 'DINO-1',
      name: 'Produto Dino',
      shortDescription: 'Descrição curta verificada.',
      detailedDescription: 'Descrição detalhada verificada com fonte.',
      imageFileName: 'DINO-1.webp',
      imageSha256: 'b'.repeat(64),
      imageMimeType: 'image/webp',
      readyForPreview: true,
    }],
  })
  const products = [{ id: 'product-1', cod: 'DINO-1', descricaoCurta: '', descricao: '', media: [] }]
  const files = [{ name: 'DINO-1.webp', type: 'image/webp', size: 1024 }]
  const preview = buildCatalogEnrichmentPreview({ manifest, products, files })
  assert.deepEqual(preview.summary, {
    totalManifest: 1,
    candidates: 1,
    held: 0,
    executable: 1,
    descriptionUpdates: 1,
    mediaUploads: 1,
    existingMediaSkipped: 0,
    noChange: 0,
    blockers: 0,
  })
  assert.equal(preview.rows[0].product.id, 'product-1')
  assert.equal(preview.rows[0].file.name, 'DINO-1.webp')
})

test('bloqueia candidato sem produto e preserva item retido fora da execução', () => {
  const manifest = normalizeCatalogEnrichmentManifest({ items: [
    { sku: 'AUSENTE', shortDescription: 'Curta', detailedDescription: 'Longa', imageFileName: 'ausente.jpg', imageSha256: 'c'.repeat(64), readyForPreview: true },
    { sku: 'AMBIGUO', readyForPreview: false, holdReason: 'volume ausente' },
  ] })
  const preview = buildCatalogEnrichmentPreview({ manifest, products: [], files: [] })
  assert.equal(preview.summary.candidates, 1)
  assert.equal(preview.summary.held, 1)
  assert.equal(preview.summary.executable, 0)
  assert.equal(preview.summary.blockers, 1)
  assert.ok(preview.rows[0].blockers.includes('produto não encontrado pelo SKU'))
})

test('reexecução não duplica mídia existente e identifica lote sem mudanças', () => {
  const manifest = normalizeCatalogEnrichmentManifest({ items: [{ sku: 'DINO-2', shortDescription: 'Curta atual', detailedDescription: 'Longa atual', imageFileName: 'DINO-2.jpg', imageSha256: 'd'.repeat(64), imageMimeType: 'image/jpeg', readyForPreview: true }] })
  const products = [{ id: 'product-2', cod: 'DINO-2', descricaoCurta: 'Curta atual', descricao: 'Longa atual', media: [{ id: 'media-1' }] }]
  const preview = buildCatalogEnrichmentPreview({ manifest, products, files: [] })
  assert.equal(preview.summary.executable, 1)
  assert.equal(preview.summary.existingMediaSkipped, 1)
  assert.equal(preview.summary.noChange, 1)
  assert.equal(preview.rows[0].uploadImage, false)
  assert.equal(preview.rows[0].updateDescription, false)
})

test('chave idempotente é estável e vinculada ao manifesto, SKU e imagem', () => {
  const input = { manifestHash: 'a'.repeat(64), sku: 'DINO PERF 1', imageSha256: 'b'.repeat(64) }
  const first = catalogEnrichmentIdempotencyKey(input)
  assert.equal(first, catalogEnrichmentIdempotencyKey(input))
  assert.match(first, /^catalog-enrichment-[a-f0-9]{32}-DINO-PERF-1-[a-f0-9]{24}$/)
  assert.notEqual(first, catalogEnrichmentIdempotencyKey({ ...input, imageSha256: 'c'.repeat(64) }))
})
