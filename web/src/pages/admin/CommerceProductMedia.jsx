import React, { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { api } from '../../lib/api'
import { adminProductMediaUrl } from './commerce-admin-adapter'

const RASTER_IMAGE = /^image\/(?:jpeg|png|webp|gif|avif|bmp)$/i

export function allowedProductImageSource(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && (parsed.hostname === 'storage.googleapis.com' || parsed.hostname.endsWith('.storage.googleapis.com'))
  } catch { return false }
}

/** Previews are scoped through the authenticated admin endpoint, never the public storefront. */
export default function CommerceProductMedia({ media, storefrontId, alt = 'Imagem do produto', className = '', compact = false }) {
  const previewUrl = !storefrontId && media?.id ? '' : adminProductMediaUrl(media, storefrontId)
  const sourceKey = `${storefrontId}:${previewUrl}`
  const rootRef = useRef(null)
  const objectUrlRef = useRef('')
  const [visibleKey, setVisibleKey] = useState('')
  const [image, setImage] = useState({ source: '', url: '', failed: false })

  useEffect(() => {
    setVisibleKey('')
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisibleKey(sourceKey)
      return undefined
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisibleKey(sourceKey)
        observer.disconnect()
      }
    }, { rootMargin: '180px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [sourceKey])

  useEffect(() => {
    let active = true
    let objectUrl = ''
    const controller = new AbortController()
    setImage({ source: sourceKey, url: '', failed: false })
    if (!previewUrl || visibleKey !== sourceKey) return () => { active = false; controller.abort() }
    if (!previewUrl.startsWith('/api/admin/commerce/catalog/media/')) {
      // O servidor só admite storage.googleapis.com por padrão; não embutir links
      // externos arbitrários (inclusive quando vindos de cadastro legado).
      const safeUrl = allowedProductImageSource(previewUrl) ? previewUrl : ''
      setImage({ source: sourceKey, url: safeUrl, failed: !safeUrl })
      return () => { active = false }
    }
    api.blob(previewUrl, { signal: controller.signal }).then(blob => {
      if (!RASTER_IMAGE.test(blob.type)) throw new Error('Tipo de imagem não suportado')
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      objectUrlRef.current = objectUrl
      setImage({ source: sourceKey, url: objectUrl, failed: false })
    }).catch(() => { if (active) setImage({ source: sourceKey, url: '', failed: true }) })
    return () => {
      active = false
      controller.abort()
      if (objectUrl && objectUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrlRef.current = ''
      }
    }
  }, [sourceKey, previewUrl, visibleKey])

  const current = image.source === sourceKey ? image : { url: '', failed: false }
  const unavailable = !previewUrl || current.failed
  return <div ref={rootRef} className={`commerce-product-image-frame ${className}`.trim()}>
    {current.url && !current.failed
      ? <img src={current.url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => {
          if (objectUrlRef.current && objectUrlRef.current === current.url) {
            URL.revokeObjectURL(current.url)
            objectUrlRef.current = ''
          }
          setImage({ source: sourceKey, url: '', failed: true })
        }} />
      : <div className="commerce-product-image-placeholder" role={unavailable ? 'img' : 'status'} aria-label={unavailable ? `${alt} — imagem indisponível` : `Carregando imagem de ${alt}`}>
          <ImageOff size={compact ? 19 : 24} aria-hidden="true" />
          {!compact && <span>{unavailable ? 'Imagem indisponível' : 'Carregando imagem…'}</span>}
        </div>}
  </div>
}
