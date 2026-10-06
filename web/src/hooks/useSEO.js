/**
 * useSEO — injeção dinâmica de meta tags por página/rota
 * Atualiza <title>, canonical, og:*, twitter:* e JSON-LD no <head>
 * sem depender de SSR.
 *
 * Uso:
 *   useSEO({
 *     title: 'Dino Perfumaria | Perfumes em Tangará da Serra',
 *     description: '...',
 *     canonical: 'https://dino.kytto.com.br/loja',
 *     image: 'https://...',
 *     jsonLd: { ... }
 *   })
 */
import { useEffect } from 'react'

const DEFAULT_SITE = 'Kytto'

function setMeta(name, content, prop = false) {
  if (!content) return
  const attr = prop ? 'property' : 'name'
  let el = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  if (!href) return
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setJsonLd(id, data) {
  if (!data) {
    // Remove se já existia
    const old = document.getElementById(id)
    if (old) old.remove()
    return
  }
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function useSEO({ title, description, canonical, image, type = 'website', jsonLd, jsonLdId = 'ld-json-page' } = {}) {
  useEffect(() => {
    // Title
    if (title) document.title = title

    // Description
    if (description) {
      setMeta('description', description)
      setMeta('og:description', description, true)
      setMeta('twitter:description', description)
    }

    // Canonical
    if (canonical) {
      setCanonical(canonical)
      setMeta('og:url', canonical, true)
    }

    // OG Title / Twitter
    if (title) {
      setMeta('og:title', title, true)
      setMeta('twitter:title', title)
    }

    // OG Type
    if (type) setMeta('og:type', type, true)

    // Image
    if (image) {
      setMeta('og:image', image, true)
      setMeta('twitter:image', image)
    }

    // JSON-LD
    setJsonLd(jsonLdId, jsonLd || null)
  }, [title, description, canonical, image, type, jsonLd, jsonLdId])
}

/**
 * Gera JSON-LD de ItemList para a página de catálogo/loja
 */
export function buildItemListJsonLd(produtos, baseUrl) {
  if (!produtos || !produtos.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Catálogo de Produtos',
    url: baseUrl,
    numberOfItems: produtos.length,
    itemListElement: produtos.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.nome,
        description: p.desc || p.descricao || '',
        image: p.imagem || undefined,
        offers: {
          '@type': 'Offer',
          price: String(p.preco || 0),
          priceCurrency: 'BRL',
          availability: (p.estoque == null || p.estoque > 0)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      },
    })),
  }
}

/**
 * Gera JSON-LD de Product para uma página de produto individual
 */
export function buildProductJsonLd(produto, url) {
  if (!produto) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produto.nome,
    description: produto.desc || produto.descricao || '',
    image: produto.imagem ? [produto.imagem] : undefined,
    url,
    brand: produto.marca ? { '@type': 'Brand', name: produto.marca } : undefined,
    offers: {
      '@type': 'Offer',
      price: String(produto.preco || 0),
      priceCurrency: 'BRL',
      availability: (produto.estoque == null || produto.estoque > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Barbearia Dino',
      },
    },
  }
}
