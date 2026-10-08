import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clipboard, Download, Image, Package, Video, X } from 'lucide-react'
import { activePromotionCode, formatPromotionValidity, promotionCopyText, promotionDiscountLabel, promotionStatus, promotionStatusLabel } from './commerce-admin-adapter'
import { buildViralGramPayload, buildViralGramZip, normalizeBrandPalette, preferredVideoMimeType, socialFilename } from './promotion-social-assets'

const SIZES = {
  feed: { width: 1080, height: 1350, label: 'Instagram feed', format: 'feed' },
  story: { width: 1080, height: 1920, label: 'Stories / WhatsApp', format: 'story' },
  square: { width: 1080, height: 1080, label: 'Quadrado', format: 'square' },
}

const FONT_STACK = 'Inter, Arial, sans-serif'
const CODE_FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, width, height, radius) {
  roundRectPath(ctx, x, y, width, height, radius)
  ctx.fill()
}

function splitLongToken(ctx, token, maxWidth) {
  const pieces = []
  let piece = ''
  for (const character of String(token)) {
    const next = piece + character
    if (piece && ctx.measureText(next).width > maxWidth) {
      pieces.push(piece)
      piece = character
    } else {
      piece = next
    }
  }
  if (piece) pieces.push(piece)
  return pieces
}

function wrapText(ctx, text, maxWidth) {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  tokens.forEach(token => {
    const tokenParts = ctx.measureText(token).width > maxWidth ? splitLongToken(ctx, token, maxWidth) : [token]
    tokenParts.forEach(part => {
      const next = line ? `${line} ${part}` : part
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line)
        line = part
      } else {
        line = next
      }
    })
  })
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function fitFontSize(ctx, text, { maxWidth, maxSize, minSize, weight, family = FONT_STACK }) {
  for (let size = maxSize; size >= minSize; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`
    if (wrapText(ctx, text, maxWidth).length <= 3) return size
  }
  return minSize
}

function drawTextBlock(ctx, text, { x, y, maxWidth, maxSize, minSize, weight, lineHeight, color, family = FONT_STACK, align = 'center' }) {
  const size = fitFontSize(ctx, text, { maxWidth, maxSize, minSize, weight, family })
  ctx.font = `${weight} ${size}px ${family}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  const lines = wrapText(ctx, text, maxWidth)
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return { size, lines }
}

function safePromotionLink(value) {
  const raw = String(value || '').trim()
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw) || raw.startsWith('//')) return ''
  try {
    const base = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'https://tenant.invalid/'
    const url = new URL(raw, base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}

function trustedSameOriginAsset(value) {
  const raw = String(value || '').trim()
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw) || typeof window === 'undefined' || !window.location?.origin) return false
  try {
    const url = new URL(raw, window.location.href)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === window.location.origin && !url.username && !url.password
  } catch {
    return false
  }
}

async function waitForFonts() {
  if (typeof document === 'undefined' || !document.fonts?.ready) return
  try { await document.fonts.ready } catch { /* fallback fonts are deterministic enough */ }
}

function loadTrustedLogo(src) {
  if (!trustedSameOriginAsset(src) || typeof window === 'undefined' || typeof window.Image !== 'function') return Promise.resolve(null)
  return new Promise(resolve => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function drawLogoOrBrand(ctx, logo, brandName, panel, scale, palette) {
  const x = panel.x + 54 * scale
  const y = panel.y + 48 * scale
  const slotWidth = Math.min(330 * scale, panel.width * 0.48)
  const slotHeight = 76 * scale
  ctx.fillStyle = palette.background
  fillRoundRect(ctx, x, y, slotWidth, slotHeight, 16 * scale)
  if (logo) {
    const ratio = Math.min((slotWidth - 28 * scale) / logo.naturalWidth, (slotHeight - 20 * scale) / logo.naturalHeight)
    const imageWidth = Math.max(1, logo.naturalWidth * ratio)
    const imageHeight = Math.max(1, logo.naturalHeight * ratio)
    try {
      ctx.drawImage(logo, x + (slotWidth - imageWidth) / 2, y + (slotHeight - imageHeight) / 2, imageWidth, imageHeight)
      return
    } catch { /* a failed logo must not block a usable export */ }
  }
  ctx.fillStyle = palette.accentText
  ctx.font = `800 ${24 * scale}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(brandName || 'Sua loja').slice(0, 48), x + 20 * scale, y + slotHeight / 2)
}

export async function drawPromotionCanvas(promotion = {}, { width, height }, { brandName = '', link = '', logoSrc = '', copyText = '', palette: paletteInput = {}, slide = 1 } = {}) {
  if (typeof document === 'undefined') throw new Error('Canvas disponível somente no navegador.')
  const canvas = document.createElement('canvas')
  canvas.width = Number(width)
  canvas.height = Number(height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não oferece suporte a canvas.')
  await waitForFonts()
  const scale = canvas.width / 1080
  const safe = 42 * scale
  const panel = { x: safe, y: safe, width: canvas.width - safe * 2, height: canvas.height - safe * 2 }
  const safeLink = safePromotionLink(link)
  const copy = copyText || promotionCopyText(promotion, { link: safeLink })
  const code = Array.isArray(promotion.codigos) ? activePromotionCode(promotion) : ''
  const validity = formatPromotionValidity(promotion)
  const discount = promotionDiscountLabel(promotion)
  const logo = await loadTrustedLogo(logoSrc)
  const palette = normalizeBrandPalette(paletteInput)

  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const panelGradient = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y + panel.height)
  panelGradient.addColorStop(0, palette.surface)
  panelGradient.addColorStop(1, palette.surfaceAlt)
  ctx.fillStyle = panelGradient
  fillRoundRect(ctx, panel.x, panel.y, panel.width, panel.height, 32 * scale)

  // Decorative shapes stay inside the dark panel and are drawn independently.
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = palette.accent
  ctx.beginPath()
  ctx.arc(panel.x + panel.width * 0.91, panel.y + panel.height * 0.11, panel.width * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.2
  ctx.fillStyle = palette.surface
  ctx.beginPath()
  ctx.arc(panel.x + panel.width * 0.12, panel.y + panel.height * 0.88, panel.width * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  drawLogoOrBrand(ctx, logo, brandName, panel, scale, palette)
  const contentX = panel.x + 68 * scale
  const contentWidth = panel.width - 136 * scale
  const top = panel.y
  const slideLabel = Number(slide) === 2 ? 'COMO APROVEITAR' : Number(slide) === 3 ? 'NÃO PERCA' : 'OFERTA DA LOJA'
  drawTextBlock(ctx, slideLabel, {
    x: canvas.width / 2, y: top + panel.height * 0.22, maxWidth: contentWidth,
    maxSize: 22 * scale, minSize: 13 * scale, weight: 800, lineHeight: 28 * scale, color: palette.accent,
  })
  const headline = Number(slide) === 2 && code ? `USE ${code}` : Number(slide) === 3 ? `VÁLIDO ATÉ ${validity}` : discount.toUpperCase()
  drawTextBlock(ctx, headline, {
    x: canvas.width / 2, y: top + panel.height * 0.33, maxWidth: contentWidth,
    maxSize: 94 * scale, minSize: 30 * scale, weight: 900, lineHeight: 104 * scale, color: palette.text,
  })
  drawTextBlock(ctx, Number(slide) === 2 ? promotion.nome || 'Promoção' : promotion.nome || 'Promoção', {
    x: canvas.width / 2, y: top + panel.height * 0.51, maxWidth: contentWidth,
    maxSize: 57 * scale, minSize: 20 * scale, weight: 850, lineHeight: 68 * scale, color: palette.text,
  })
  drawTextBlock(ctx, Number(slide) === 2 ? `Economize com o cupom ${code || 'da loja'}` : `Válido: ${validity}`, {
    x: canvas.width / 2, y: top + panel.height * 0.63, maxWidth: contentWidth,
    maxSize: 25 * scale, minSize: 15 * scale, weight: 650, lineHeight: 34 * scale, color: palette.muted,
  })

  if (code) {
    const codeX = contentX
    const codeY = top + panel.height * 0.7
    const codeWidth = contentWidth
    const codeHeight = Math.max(104 * scale, 112 * scale)
    ctx.fillStyle = palette.text
    fillRoundRect(ctx, codeX, codeY, codeWidth, codeHeight, 20 * scale)
    drawTextBlock(ctx, code, {
      x: canvas.width / 2, y: codeY + 68 * scale, maxWidth: codeWidth - 40 * scale,
      maxSize: 42 * scale, minSize: 18 * scale, weight: 900, lineHeight: 44 * scale, color: palette.accentText, family: CODE_FONT_STACK,
    })
  }

  const linkLabel = safeLink ? `Confira em ${safeLink}` : 'Consulte as condições na loja'
  drawTextBlock(ctx, linkLabel, {
    x: canvas.width / 2, y: top + panel.height * 0.87, maxWidth: contentWidth,
    maxSize: 22 * scale, minSize: 14 * scale, weight: 700, lineHeight: 30 * scale, color: palette.muted,
  })
  ctx.fillStyle = palette.muted
  ctx.font = `600 ${15 * scale}px ${FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Oferta sujeita às condições da loja.', canvas.width / 2, panel.y + panel.height - 40 * scale)
  return canvas
}

function focusableElements(container) {
  return Array.from(container?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
}

export default function PromotionsMaterial({ promotion, link, brandName, brandKey, logoSrc, palette, onClose }) {
  const [sizeKey, setSizeKey] = useState('feed')
  const [copied, setCopied] = useState(false)
  const [statusNow, setStatusNow] = useState(() => Date.now())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const dialogRef = useRef(null)
  const closeHandlerRef = useRef(onClose)
  const closeButtonRef = useRef(null)
  closeHandlerRef.current = onClose
  const status = promotionStatus(promotion, statusNow)
  const activeCode = Array.isArray(promotion?.codigos) ? activePromotionCode(promotion) : ''
  const blocked = status !== 'active' || !activeCode
  const safeLink = useMemo(() => safePromotionLink(link), [link])
  const copy = useMemo(() => promotionCopyText(promotion, { link: safeLink }), [promotion, safeLink])
  const size = SIZES[sizeKey]
  const normalizedPalette = useMemo(() => normalizeBrandPalette(palette), [palette])

  useEffect(() => {
    const interval = window.setInterval(() => setStatusNow(Date.now()), 15000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current
    const focusInitial = () => {
      const first = focusableElements(dialog)[0] || dialog
      first.focus()
    }
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHandlerRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const elements = focusableElements(dialog)
      if (!elements.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    focusInitial()
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus()
    }
  }, [])

  function currentStatus() {
    const now = Date.now()
    setStatusNow(now)
    return promotionStatus(promotion, now)
  }

  async function copyText() {
    const liveStatus = currentStatus()
    if (liveStatus !== 'active') {
      setExportError(`A promoção está ${promotionStatusLabel(promotion, Date.now()).toLowerCase()} e não pode ser divulgada.`)
      return
    }
    setExportError('')
    try {
      await navigator.clipboard.writeText(copy)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setExportError('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.')
    }
  }

  async function downloadPng() {
    const liveStatus = currentStatus()
    if (liveStatus !== 'active') {
      setExportError(`A promoção está ${promotionStatusLabel(promotion, Date.now()).toLowerCase()} e não pode ser divulgada.`)
      return
    }
    setExportError('')
    setExporting(true)
    try {
      const canvas = await drawPromotionCanvas(promotion, size, { brandName, link: safeLink, logoSrc, copyText: copy, palette: normalizedPalette })
      const dataUrl = canvas.toDataURL('image/png')
      if (!dataUrl || !dataUrl.startsWith('data:image/png')) throw new Error('PNG indisponível')
      const anchor = document.createElement('a')
      const filename = socialFilename(promotion.nome)
      anchor.download = `promocao-${sizeKey}-${filename}.png`
      anchor.href = dataUrl
      anchor.click()
    } catch {
      setExportError('Não foi possível gerar o PNG. A logo foi ignorada se não era um arquivo confiável; tente novamente ou copie o texto.')
    } finally {
      setExporting(false)
    }
  }

  async function downloadCarousel() {
    const liveStatus = currentStatus()
    if (liveStatus !== 'active') {
      setExportError(`A promoção está ${promotionStatusLabel(promotion, Date.now()).toLowerCase()} e não pode ser divulgada.`)
      return
    }
    setExportError('')
    setExporting(true)
    try {
      const filename = socialFilename(promotion.nome)
      for (let slide = 1; slide <= 3; slide += 1) {
        const canvas = await drawPromotionCanvas(promotion, SIZES.square, { brandName, link: safeLink, logoSrc, copyText: copy, palette: normalizedPalette, slide })
        const dataUrl = canvas.toDataURL('image/png')
        const anchor = document.createElement('a')
        anchor.download = `promocao-carrossel-${slide}-${filename}.png`
        anchor.href = dataUrl
        anchor.click()
        await new Promise(resolve => window.setTimeout(resolve, 120))
      }
    } catch {
      setExportError('Não foi possível gerar o carrossel. Tente novamente; a identidade da loja continua sendo aplicada localmente.')
    } finally {
      setExporting(false)
    }
  }

  async function downloadVideo() {
    const liveStatus = currentStatus()
    if (liveStatus !== 'active') {
      setExportError(`A promoção está ${promotionStatusLabel(promotion, Date.now()).toLowerCase()} e não pode ser divulgada.`)
      return
    }
    setExportError('')
    setExporting(true)
    try {
      if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') throw new Error('video indisponível')
      const source = await drawPromotionCanvas(promotion, SIZES.story, { brandName, link: safeLink, logoSrc, copyText: copy, palette: normalizedPalette })
      const videoCanvas = document.createElement('canvas')
      videoCanvas.width = SIZES.story.width
      videoCanvas.height = SIZES.story.height
      const videoContext = videoCanvas.getContext('2d')
      const stream = videoCanvas.captureStream?.(30)
      const mimeType = preferredVideoMimeType(MediaRecorder)
      if (!videoContext || !stream || !mimeType) throw new Error('video indisponível')
      const chunks = []
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data) }
      const stopped = new Promise((resolve, reject) => {
        recorder.onerror = () => reject(new Error('falha na gravação'))
        recorder.onstop = resolve
      })
      recorder.start()
      const startedAt = performance.now()
      await new Promise(resolve => {
        const paint = now => {
          const progress = Math.min(1, (now - startedAt) / 5000)
          videoContext.clearRect(0, 0, videoCanvas.width, videoCanvas.height)
          videoContext.drawImage(source, 0, 0)
          videoContext.globalAlpha = 0.22
          videoContext.fillStyle = normalizedPalette.accent
          videoContext.beginPath()
          videoContext.arc(videoCanvas.width * (0.18 + progress * 0.64), videoCanvas.height * 0.16, videoCanvas.width * 0.06, 0, Math.PI * 2)
          videoContext.fill()
          videoContext.globalAlpha = 1
          if (progress < 1) requestAnimationFrame(paint)
          else resolve()
        }
        requestAnimationFrame(paint)
      })
      recorder.stop()
      await stopped
      stream.getTracks().forEach(track => track.stop())
      const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunks, { type: mimeType })
      const anchor = document.createElement('a')
      anchor.download = `promocao-story-${socialFilename(promotion.nome)}.${extension}`
      anchor.href = URL.createObjectURL(blob)
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000)
    } catch {
      setExportError('Este navegador não conseguiu gerar o vídeo local. Use o PNG ou o pacote ViralGram; nada foi enviado automaticamente.')
    } finally {
      setExporting(false)
    }
  }

  async function downloadViralGramPackage() {
    const liveStatus = currentStatus()
    if (liveStatus !== 'active') {
      setExportError(`A promoção está ${promotionStatusLabel(promotion, Date.now()).toLowerCase()} e não pode ser divulgada.`)
      return
    }
    setExporting(true)
    try {
      const filename = socialFilename(promotion.nome)
      const specs = [
        { format: 'feed', size: SIZES.feed, filename: `promocao-feed-${filename}.png` },
        { format: 'story', size: SIZES.story, filename: `promocao-story-${filename}.png` },
        { format: 'carousel', size: SIZES.square, filename: `promocao-carrossel-1-${filename}.png`, slide: 1 },
        { format: 'carousel', size: SIZES.square, filename: `promocao-carrossel-2-${filename}.png`, slide: 2 },
        { format: 'carousel', size: SIZES.square, filename: `promocao-carrossel-3-${filename}.png`, slide: 3 },
      ]
      const generatedAssets = []
      for (const spec of specs) {
        const canvas = await drawPromotionCanvas(promotion, spec.size, { brandName, link: safeLink, logoSrc, copyText: copy, palette: normalizedPalette, slide: spec.slide || 1 })
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('PNG indisponível')
        generatedAssets.push({ ...spec, blob })
      }
      const payload = buildViralGramPayload({
        promotion,
        brandName,
        brandKey,
        palette: normalizedPalette,
        link: safeLink,
        caption: copy,
        assets: generatedAssets.map(asset => ({ format: asset.format, width: asset.size.width, height: asset.size.height, filename: asset.filename, mimeType: asset.blob.type })),
      })
      const blob = await buildViralGramZip({ payload, assets: generatedAssets })
      const anchor = document.createElement('a')
      anchor.download = `viralgram-${filename}.zip`
      anchor.href = URL.createObjectURL(blob)
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000)
    } catch {
      setExportError('Não foi possível montar o ZIP ViralGram. Tente novamente; nenhum conteúdo foi enviado ou publicado.')
    } finally {
      setExporting(false)
    }
  }

  return <div className="ecommerce-admin-overlay promotions-material-overlay" role="dialog" aria-modal="true" aria-labelledby="promotions-material-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
    <section className="ecommerce-admin-modal promotions-material-modal" ref={dialogRef} tabIndex={-1}>
      <button ref={closeButtonRef} type="button" className="ecommerce-admin-close" onClick={onClose} aria-label="Fechar"><X size={17} /></button>
      <span className="ecommerce-admin-kicker"><Image size={14} /> Divulgação controlada</span>
      <h2 id="promotions-material-title">Material de divulgação</h2>
      <p className="commerce-admin-help">A identidade da vitrine ativa é aplicada localmente. Você pode baixar peças para Instagram, WhatsApp e ViralGram; nada é publicado ou enviado automaticamente.</p>
      {blocked ? <div className="promotions-material-blocked" role="alert"><strong>Material bloqueado para divulgação</strong><span>{!activeCode ? 'Esta promoção não tem código ativo e disponível para resgate.' : `Esta promoção está ${promotionStatusLabel(promotion, statusNow).toLowerCase()}. Revise status, período e limite antes de divulgar.`}</span></div> : <>
        <div className="promotions-material-brand" aria-label="Identidade aplicada"><span className="promotions-material-brand-swatch" style={{ background: normalizedPalette.surface }} /><span><strong>{brandName || 'Sua loja'}</strong><small>Identidade da empresa ativa · cores validadas</small></span></div>
        <div className="promotions-material-switcher" role="group" aria-label="Formato da peça">{Object.entries(SIZES).map(([key, item]) => <button type="button" key={key} className={sizeKey === key ? 'active' : ''} aria-pressed={sizeKey === key} onClick={() => setSizeKey(key)}>{item.label} · {item.width}×{item.height}</button>)}</div>
        <div className="promotions-material-copy"><label htmlFor="promotion-copy">Cópia curta para legenda</label><textarea id="promotion-copy" rows="6" readOnly value={copy} /><div className="promotions-material-actions"><button type="button" className="ecommerce-admin-button ghost" onClick={copyText}>{copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? 'Copiado' : 'Copiar texto'}</button><button type="button" className="ecommerce-admin-button primary" onClick={downloadPng} disabled={exporting}><Download size={15} /> {exporting ? 'Gerando…' : `Baixar ${size.format === 'story' ? 'PNG' : 'PNG'}`}</button></div></div>
        <div className="promotions-material-format-grid" aria-label="Outras entregas"><button type="button" className="ecommerce-admin-button ghost" onClick={downloadCarousel} disabled={exporting}><Image size={15} /> Carrossel · 3 PNGs</button><button type="button" className="ecommerce-admin-button ghost" onClick={downloadVideo} disabled={exporting}><Video size={15} /> Vídeo · 5 segundos</button><button type="button" className="ecommerce-admin-button ghost" onClick={downloadViralGramPackage} disabled={exporting}><Package size={15} /> Pacote ViralGram</button></div>
      </>}
      {exportError && <p className="promotions-material-error" role="alert">{exportError}</p>}
      <p className="promotions-material-footnote">Código e validade usam somente os dados oficiais desta promoção. Não há preço ou benefício inventado.</p>
    </section>
  </div>
}
