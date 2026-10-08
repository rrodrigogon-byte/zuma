const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const DEFAULT_PROMOTION_PALETTE = Object.freeze({
  background: '#F5EDE0',
  surface: '#102D29',
  surfaceAlt: '#1C493C',
  accent: '#C8F169',
  text: '#FFF8ED',
  muted: '#C9D9CE',
})

function validColor(value, fallback) {
  return HEX_COLOR.test(String(value || '')) ? String(value).toUpperCase() : fallback
}

function contrastColor(hex) {
  const raw = String(hex).replace('#', '')
  const channels = [0, 2, 4].map(index => Number.parseInt(raw.slice(index, index + 2), 16) / 255)
  const linear = channels.map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  const luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
  return luminance > 0.48 ? '#17312C' : '#FFF8ED'
}

export function normalizeBrandPalette(colors = {}) {
  const source = colors && typeof colors === 'object' ? colors : {}
  const palette = {
    background: validColor(source.background || source.bg || source.canvas, DEFAULT_PROMOTION_PALETTE.background),
    surface: validColor(source.surface || source.primary || source.brand, DEFAULT_PROMOTION_PALETTE.surface),
    surfaceAlt: validColor(source.surfaceAlt || source.secondary || source.brandSecondary, DEFAULT_PROMOTION_PALETTE.surfaceAlt),
    accent: validColor(source.accent || source.highlight || source.brandAccent, DEFAULT_PROMOTION_PALETTE.accent),
    text: validColor(source.text || source.foreground, DEFAULT_PROMOTION_PALETTE.text),
    muted: validColor(source.muted || source.textMuted, DEFAULT_PROMOTION_PALETTE.muted),
  }
  return { ...palette, accentText: validColor(source.accentText, contrastColor(palette.accent)) }
}

export function socialFilename(value, fallback = 'oferta') {
  return String(value || fallback).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || fallback
}

function safeAssetFilename(value) {
  const raw = String(value || 'asset').split('/')
  const name = raw.pop() || 'asset'
  const extensionIndex = name.lastIndexOf('.')
  if (extensionIndex <= 0) return socialFilename(name, 'asset')
  const base = socialFilename(name.slice(0, extensionIndex), 'asset')
  const extension = name.slice(extensionIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin'
  return `${base}.${extension}`
}

export function buildViralGramPayload({ promotion = {}, brandName = '', brandKey = '', palette = {}, link = '', caption = '', assets = [] } = {}) {
  const normalizedAssets = Array.isArray(assets)
    ? assets.filter(asset => asset && typeof asset === 'object').map(asset => ({
      format: String(asset.format || 'image').slice(0, 30),
      width: Number(asset.width) || 0,
      height: Number(asset.height) || 0,
      filename: socialFilename(asset.filename || `${promotion.nome || 'oferta'}-${asset.format || 'asset'}`),
      mimeType: String(asset.mimeType || 'image/png').slice(0, 80),
    }))
    : []
  return {
    schema: 'kytto.viralgram.promotion.v1',
    generatedAt: new Date().toISOString(),
    source: 'dino-commerce',
    brand: {
      key: String(brandKey || '').slice(0, 80),
      name: String(brandName || 'Sua loja').slice(0, 120),
      palette: normalizeBrandPalette(palette),
    },
    promotion: {
      id: promotion.id || null,
      name: String(promotion.nome || 'Oferta').slice(0, 200),
      discount: String(promotionDiscount(promotion)).slice(0, 100),
      code: String(activeCode(promotion)).slice(0, 100),
      validity: String(promotionValidity(promotion)).slice(0, 240),
    },
    caption: String(caption || '').slice(0, 4000),
    link: String(link || '').slice(0, 600),
    assets: normalizedAssets,
    workflow: {
      target: 'instagram',
      formats: normalizedAssets.map(asset => asset.format),
      publication: 'manual_approval_required',
      integration: 'viralgram_import_package',
    },
  }
}

function textBytes(value) {
  return new TextEncoder().encode(String(value || ''))
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u16(value) {
  return Uint8Array.from([value & 0xFF, (value >>> 8) & 0xFF])
}

function u32(value) {
  return Uint8Array.from([value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF])
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function zipEntry(name, content) {
  const filename = textBytes(name)
  const data = content instanceof Uint8Array ? content : new Uint8Array(content)
  const checksum = crc32(data)
  const localHeader = concatBytes(
    u32(0x04034B50), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(checksum), u32(data.length), u32(data.length), u16(filename.length), u16(0), filename,
  )
  return { filename, data, checksum, localHeader }
}

export async function buildViralGramZip({ payload, assets = [] } = {}) {
  const entries = [zipEntry('viralgram-manifest.json', textBytes(JSON.stringify(payload || {}, null, 2)))]
  for (const asset of Array.isArray(assets) ? assets : []) {
    if (!asset?.blob || !asset?.filename) continue
    entries.push(zipEntry(safeAssetFilename(asset.filename), new Uint8Array(await asset.blob.arrayBuffer())))
  }

  let offset = 0
  const centralEntries = []
  const localEntries = []
  for (const entry of entries) {
    localEntries.push(entry.localHeader, entry.data)
    centralEntries.push(concatBytes(
      u32(0x02014B50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(entry.checksum), u32(entry.data.length), u32(entry.data.length), u16(entry.filename.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), entry.filename,
    ))
    offset += entry.localHeader.length + entry.data.length
  }
  const centralDirectory = concatBytes(...centralEntries)
  const endRecord = concatBytes(
    u32(0x06054B50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralDirectory.length), u32(offset), u16(0),
  )
  return new Blob([...localEntries, centralDirectory, endRecord], { type: 'application/zip' })
}

function activeCode(promotion) {
  if (!Array.isArray(promotion?.codigos)) return promotion?.codigo || ''
  return promotion.codigos.find(code => code?.ativo === true && (code.usoMaximo == null || Number(code.usos || 0) < Number(code.usoMaximo)))?.codigo || ''
}

function promotionDiscount(promotion) {
  if (promotion?.tipo === 'percentage') return `${Number(promotion.valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% de desconto`
  return `${Number(promotion?.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`
}

function promotionValidity(promotion) {
  const format = value => {
    if (!value) return ''
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : 'data inválida'
  }
  const start = format(promotion?.inicio)
  return promotion?.fim ? `${start || 'Início não informado'} até ${format(promotion.fim)}` : `${start ? `A partir de ${start} · ` : ''}sem prazo`
}

export function preferredVideoMimeType(mediaRecorder = typeof window !== 'undefined' ? window.MediaRecorder : null) {
  if (!mediaRecorder?.isTypeSupported) return ''
  return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(type => mediaRecorder.isTypeSupported(type)) || ''
}
