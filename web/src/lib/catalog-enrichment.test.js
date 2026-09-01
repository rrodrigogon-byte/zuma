import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalogEnrichmentPreview, catalogEnrichmentIdempotencyKey, extractCatalogEnrichmentTar, normalizeCatalogEnrichmentManifest } from './catalog-enrichment.js'

function buildTar(entries) {
  const blocks = []
  for (const entry of entries) {
    const content = Buffer.from(entry.content)
    const header = Buffer.alloc(512)
    header.write(entry.name, 0, 100, 'utf8')
    header.write('0000644\0', 100, 8, 'ascii')
    header.write('0000000\0', 108, 8, 'ascii')
    header.write('0000000\0', 116, 8, 'ascii')
    header.write(`${content.length.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii')
    header.write('00000000000\0', 136, 12, 'ascii')
    header.fill(0x20, 148, 156)
    header.write('0', 156, 1, 'ascii')
    header.write('ustar\0', 257, 6, 'ascii')
    blocks.push(header, content, Buffer.alloc((512 - (content.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return Buffer.concat(blocks)
}

test('extrai imagens suportadas de pacote TAR e ignora arquivos auxiliares', () => {
  const tar = buildTar([
    { name: 'production-images/DINO-1.webp', content: Buffer.from('524946460000000057454250', 'hex') },
    { name: 'DINO-2.png', content: Buffer.from('89504e470d0a1a0a', 'hex') },
    { name: 'README.txt', content: 'ignorar' },
  ])
  const files = extractCatalogEnrichmentTar(tar)
  assert.deepEqual(files.map(file => [file.name, file.type, file.bytes.length]), [
    ['DINO-1.webp', 'image/webp', 12],
    ['DINO-2.png', 'image/png', 8],
  ])
})

test('rejeita nomes de imagem duplicados no pacote TAR', () => {
  const tar = buildTar([
    { name: 'a/DINO-1.webp', content: 'primeiro' },
    { name: 'b/DINO-1.webp', content: 'segundo' },
  ])
  assert.throws(() => extractCatalogEnrichmentTar(tar), /nome duplicado/)
})

test('rejeita pacote TAR truncado', () => {
  const tar = buildTar([{ name: 'DINO-1.webp', content: Buffer.alloc(700) }])
  assert.throws(() => extractCatalogEnrichmentTar(tar.subarray(0, 800)), /truncado ou corrompido/)
})

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
