const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function readTarText(bytes) {
  return new TextDecoder().decode(bytes).replace(/\0.*$/s, '').trim()
}

function parseTarOctal(bytes) {
  const value = readTarText(bytes).replace(/\s/g, '')
  if (!value) return 0
  if (!/^[0-7]+$/.test(value)) throw new Error('Pacote TAR contém tamanho inválido.')
  return Number.parseInt(value, 8)
}

export function extractCatalogEnrichmentTar(payload) {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload)
  const files = []
  const seen = new Set()
  let offset = 0
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const name = readTarText(header.subarray(0, 100))
    const prefix = readTarText(header.subarray(345, 500))
    const fullName = prefix ? `${prefix}/${name}` : name
    const fileName = fullName.split('/').filter(Boolean).pop() || ''
    const size = parseTarOctal(header.subarray(124, 136))
    const type = String.fromCharCode(header[156] || 48)
    const dataOffset = offset + 512
    const nextOffset = dataOffset + Math.ceil(size / 512) * 512
    if (nextOffset > bytes.length) throw new Error('Pacote TAR truncado ou corrompido.')
    if ((type === '0' || type === '\0') && fileName) {
      const extension = fileName.toLowerCase().split('.').pop()
      const mimeType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[extension]
      if (mimeType) {
        if (size <= 0 || size > MAX_IMAGE_BYTES) throw new Error(`${fileName}: arquivo vazio ou maior que 8 MB.`)
        const normalizedName = fileName.toLowerCase()
        if (seen.has(normalizedName)) throw new Error(`${fileName}: nome duplicado no pacote TAR.`)
        seen.add(normalizedName)
        files.push({ name: fileName, type: mimeType, bytes: bytes.slice(dataOffset, dataOffset + size) })
      }
    }
    offset = nextOffset
  }
  if (!files.length) throw new Error('O pacote TAR não contém imagens suportadas.')
  return files
}

export function normalizeCatalogEnrichmentManifest(payload) {
  const source = typeof payload === 'string' ? JSON.parse(payload) : payload
  const items = Array.isArray(source) ? source : Array.isArray(source?.items) ? source.items : []
  return {
    manifestHash: String(source?.summary?.manifestHash || source?.manifestHash || '').trim(),
    items: items.map(item => ({
      sku: String(item?.sku || '').trim(),
      productName: String(item?.name || item?.productName || '').trim(),
      resolvedProductName: String(item?.resolvedProductName || '').trim(),
      shortDescription: String(item?.shortDescription || '').trim(),
      detailedDescription: String(item?.detailedDescription || '').trim(),
      imageFileName: String(item?.imageFileName || '').trim(),
      imageSha256: String(item?.imageSha256 || '').trim().toLowerCase(),
      imageMimeType: String(item?.imageMimeType || '').trim().toLowerCase(),
      sourceType: String(item?.imageSourceType || '').trim(),
      sourceUrl: String(item?.imagePageUrl || item?.primarySourceUrl || '').trim(),
      ready: item?.readyForPreview === true || item?.ready === true,
      holdReason: String(item?.holdReason || '').trim(),
    })).filter(item => item.sku),
  }
}

export function buildCatalogEnrichmentPreview({ manifest, products = [], files = [] }) {
  const productBySku = new Map(products.map(product => [String(product?.cod || '').trim().toUpperCase(), product]))
  const fileByName = new Map(Array.from(files).map(file => [String(file?.name || '').trim().toLowerCase(), file]))
  const rows = manifest.items.map(item => {
    const product = productBySku.get(item.sku.toUpperCase()) || null
    const file = item.imageFileName ? fileByName.get(item.imageFileName.toLowerCase()) || null : null
    const media = Array.isArray(product?.media) ? product.media : []
    const descriptionChanged = Boolean(product) && (String(product.descricaoCurta || product.descricao_curta || '').trim() !== item.shortDescription || String(product.descricao || '').trim() !== item.detailedDescription)
    const fileType = String(file?.type || item.imageMimeType || '').toLowerCase()
    const fileValid = Boolean(file) && SUPPORTED_IMAGE_TYPES.has(fileType) && Number(file.size || 0) > 0 && Number(file.size || 0) <= MAX_IMAGE_BYTES
    const blockers = []
    if (item.ready && !product) blockers.push('produto não encontrado pelo SKU')
    if (item.ready && !item.shortDescription) blockers.push('descrição curta ausente')
    if (item.ready && !item.detailedDescription) blockers.push('descrição detalhada ausente')
    if (item.ready && media.length === 0 && !file) blockers.push('arquivo de imagem ausente')
    if (item.ready && media.length === 0 && file && !fileValid) blockers.push('arquivo vazio, maior que 8 MB ou com MIME não suportado')
    return {
      ...item,
      product,
      file,
      fileValid,
      currentMediaCount: media.length,
      descriptionChanged,
      uploadImage: item.ready && Boolean(product) && media.length === 0 && fileValid,
      updateDescription: item.ready && Boolean(product) && descriptionChanged && Boolean(item.shortDescription && item.detailedDescription),
      blockers,
      executable: item.ready && blockers.length === 0,
    }
  })
  const candidates = rows.filter(row => row.ready)
  const held = rows.filter(row => !row.ready)
  const executable = candidates.filter(row => row.executable)
  return {
    manifestHash: manifest.manifestHash,
    rows,
    summary: {
      totalManifest: rows.length,
      candidates: candidates.length,
      held: held.length,
      executable: executable.length,
      descriptionUpdates: executable.filter(row => row.updateDescription).length,
      mediaUploads: executable.filter(row => row.uploadImage).length,
      existingMediaSkipped: executable.filter(row => row.currentMediaCount > 0).length,
      noChange: executable.filter(row => !row.updateDescription && !row.uploadImage).length,
      blockers: candidates.filter(row => row.blockers.length > 0).length,
    },
  }
}

export function catalogEnrichmentIdempotencyKey({ manifestHash, sku, imageSha256 }) {
  const hash = String(manifestHash || '').replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 32)
  const image = String(imageSha256 || '').replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 24)
  const safeSku = String(sku || '').trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '-').slice(0, 80)
  if (!hash || !image || !safeSku) throw new Error('manifesto, SKU e hash da imagem são obrigatórios para idempotência')
  return `catalog-enrichment-${hash}-${safeSku}-${image}`
}

export { MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES }
