import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api } from '../../lib/api'
import { activePromotionCode, adminProductMediaUrl, escapePromotionExportText, formatPromotionValidity, loadCommerceAdmin, loadCoreReports, localDateTimeToUtcIso, promotionCopyText, promotionPayload, promotionStatus, utcIsoToLocalDateTime, validateProductCommercialInput } from './commerce-admin-adapter'
import CommerceProductMedia, { allowedProductImageSource } from './CommerceProductMedia'
import { catalogHelpFor } from './useCatalogActionTooltip'

const originalGet = api.get
const storefront = { id: '33333333-3333-4333-8333-333333333333', loja_id: '22222222-2222-4222-8222-222222222222', nome: 'Dino' }

afterEach(() => { api.get = originalGet })

describe('admin Commerce: falha parcial do catálogo', () => {
  it('continua a exibir pedidos da vitrine e sinaliza produtos indisponíveis', async () => {
    api.get = async path => {
      if (path.includes('/catalog/products?')) throw Object.assign(new Error('falha SQL'), { status: 500, code: 'INTERNAL_ERROR' })
      if (path.endsWith('/storefront') || path.endsWith('/storefronts')) return { items: [storefront] }
      if (path.includes('/orders')) return { items: [{ id: '55555555-5555-4555-8555-555555555555', public_code: 'KC-SYNTHETIC', status: 'pending_payment', total: '10.00' }] }
      return { items: [] }
    }
    const result = await loadCommerceAdmin({ storefrontId: storefront.id })
    expect(result.mode).toBe('core')
    expect(result.catalogUnavailable).toBe(true)
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'catálogo', status: 500 })]))
    expect(result.products).toEqual([])
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].codigo).toBe('KC-SYNTHETIC')
  })

  it('usa a prévia administrativa para mídias internas e preserva URLs externas', () => {
    const mediaId = '44444444-4444-4444-8444-444444444444'
    expect(adminProductMediaUrl({ id: mediaId, public_url: `/api/storefront/media/${mediaId}` }, storefront.id)).toBe(`/api/admin/commerce/catalog/media/${mediaId}?storefrontId=${storefront.id}`)
    expect(adminProductMediaUrl({ id: mediaId, public_url: 'https://storage.googleapis.com/dino-media/item.webp' }, storefront.id)).toBe('https://storage.googleapis.com/dino-media/item.webp')
    expect(adminProductMediaUrl({ public_url: `/api/storefront/media/${mediaId}` }, storefront.id)).toBe(`/api/admin/commerce/catalog/media/${mediaId}?storefrontId=${storefront.id}`)
    expect(adminProductMediaUrl({ id: '99999999-9999-4999-8999-999999999999', public_url: `/api/storefront/media/${mediaId}` }, storefront.id)).toBe('')
    expect(adminProductMediaUrl({ public_url: `/api/storefront/media/${mediaId}` }, '')).toBe('')
    expect(adminProductMediaUrl({ public_url: `/api/commerce/media/${mediaId}` }, storefront.id)).toBe(`/api/admin/commerce/catalog/media/${mediaId}?storefrontId=${storefront.id}`)
  })

  it('não oculta erro de autenticação como falha opcional de catálogo', async () => {
    api.get = async path => {
      if (path.includes('/catalog/products?')) throw Object.assign(new Error('sessão inválida'), { status: 401 })
      if (path.endsWith('/storefront') || path.endsWith('/storefronts')) return { items: [storefront] }
      return { items: [] }
    }
    await expect(loadCommerceAdmin({ storefrontId: storefront.id })).rejects.toMatchObject({ status: 401 })
  })
})

describe('admin Commerce: feedback do salvamento de produto', () => {
  it('bloqueia concorrência e sinaliza salvamento/upload no botão', () => {
    const source = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/EcommerceAdmin.jsx'), 'utf8')
    expect(source).toContain('if (savingProduct) return')
    expect(source).toContain('setSavingProduct(true)')
    expect(source).toContain('setSavingProduct(false)')
    expect(source).toContain('disabled={mediaUploading || savingProduct}')
    expect(source).toContain('Salvando produto…')
  })

  it('não bloqueia a abertura de Novo item quando apenas a listagem falha', () => {
    const source = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/EcommerceAdmin.jsx'), 'utf8')
    expect(source).toContain("disabled={mode === 'core' && !storefrontId}")
    expect(source).not.toContain('onClick={beginCreate} disabled={catalogUnavailable}')
  })

  it('abre novo item publicado por padrão e recarrega mesmo se o upload de imagem falhar', () => {
    const source = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/EcommerceAdmin.jsx'), 'utf8')
    expect(source).toContain("status: 'active', publicado: true, ativo: true")
    expect(source).toContain('publicado na vitrine')
    expect(source).toContain('O produto já foi persistido pelo workspace')
    expect(source).toContain('await loadData(true, { storefrontId, locationId })')
    expect(source).toContain('Publicado aparece no catálogo e pode ser comprado na loja ativa.')
  })

  it('não deixa a validação nativa bloquear o salvar sem explicar o campo obrigatório', () => {
    const source = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/EcommerceAdmin.jsx'), 'utf8')
    expect(source).toContain('function handleProductInvalid(event)')
    expect(source).toContain('onInvalid={handleProductInvalid}')
    expect(source).toContain('Preencha o campo obrigatório')
    expect(source).toContain('role="alert"')
  })

  it('explica que o preço promocional precisa ser menor ou ficar vazio', () => {
    expect(validateProductCommercialInput({ preco: '1087', precoPromocional: '1087' })).toMatch(/menor que o preço de venda/i)
    expect(validateProductCommercialInput({ preco: '1087', precoPromocional: '' })).toBe('')
  })

  it('rejeita URL completa no slug e aceita o formato amigável', () => {
    expect(validateProductCommercialInput({ preco: '1087', slug: 'https://dino.kytto.com.br/' })).toMatch(/slug/i)
    expect(validateProductCommercialInput({ preco: '1087', slug: 'madagascar-centella-cream' })).toBe('')
  })
})

describe('admin Commerce: seleção obrigatória de vitrine', () => {
  it('escopa os quatro relatórios e não consulta nenhum sem vitrine ativa', async () => {
    const calls = []
    api.get = async path => { calls.push(path); return { items: [] } }
    await expect(loadCoreReports(null)).rejects.toThrow('Selecione uma vitrine ativa')
    expect(calls).toEqual([])
    await loadCoreReports(storefront.id)
    expect(calls).toHaveLength(4)
    expect(calls.every(path => new URL(path, 'https://teste.invalid').searchParams.get('storefrontId') === storefront.id)).toBe(true)
  })

  it('resolve vitrine antes de qualquer GET operacional em sessão de loja e não repete pedidos', async () => {
    const calls = []
    api.get = async path => {
      calls.push(path)
      if (path === '/api/admin/commerce/storefront' || path === '/api/admin/commerce/storefronts') return { items: [{ ...storefront, status: 'active' }] }
      const url = new URL(path, 'https://teste.invalid')
      if (url.searchParams.get('storefrontId') !== storefront.id) throw Object.assign(new Error('storefrontId é obrigatório'), { status: 400, code: 'STOREFRONT_REQUIRED' })
      if (url.pathname.endsWith('/orders')) return { items: [{ id: '55555555-5555-4555-8555-555555555555', public_code: 'KC-TESTE', status: 'paid', total: '10.00' }] }
      if (url.pathname.endsWith('/operations/health')) return { payments: { pending: 1 } }
      return { items: [] }
    }
    const result = await loadCommerceAdmin()
    expect(result.storefrontId).toBe(storefront.id)
    expect(result.orders).toHaveLength(1)
    expect(result.health.payments.pending).toBe(1)
    expect(calls.slice(0, 2)).toEqual(['/api/admin/commerce/storefront', '/api/admin/commerce/storefronts'])
    expect(calls.slice(2).every(path => new URL(path, 'https://teste.invalid').searchParams.get('storefrontId') === storefront.id)).toBe(true)
    expect(calls.filter(path => new URL(path, 'https://teste.invalid').pathname.endsWith('/orders'))).toHaveLength(1)
  })

  it('não usa ID de vitrine não visível, mesmo se salvo na sessão anterior', async () => {
    const paths = []
    const oldId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    api.get = async path => {
      paths.push(path)
      if (path === '/api/admin/commerce/storefront' || path === '/api/admin/commerce/storefronts') return { items: [{ ...storefront, status: 'active' }] }
      if (path.includes(oldId)) throw new Error('escopo indevido')
      return { items: [] }
    }
    const result = await loadCommerceAdmin({ storefrontId: oldId })
    expect(result.storefrontId).toBe(storefront.id)
    expect(paths.some(path => path.includes(oldId))).toBe(false)
  })

  it('sem vitrine ativa retorna estado seguro sem consultar pedidos, pagamentos nem catálogo', async () => {
    const calls = []
    api.get = async path => {
      calls.push(path)
      return { items: [{ ...storefront, status: 'inactive' }] }
    }
    const result = await loadCommerceAdmin()
    expect(result.mode).toBe('core')
    expect(result.storefrontId).toBeNull()
    expect(result.storefronts).toHaveLength(1)
    expect(result.orders).toEqual([])
    expect(calls).toEqual(['/api/admin/commerce/storefront', '/api/admin/commerce/storefronts'])
  })

  it('não troca erro de acesso de descoberta por fallback legado', async () => {
    api.get = async path => {
      if (path === '/api/admin/commerce/storefront') throw Object.assign(new Error('sem permissão'), { status: 403 })
      return { items: [] }
    }
    await expect(loadCommerceAdmin()).rejects.toMatchObject({ status: 403 })
  })
})


describe('Catálogo Commerce: mídia protegida e ajuda de ações', () => {
  const mediaId = '44444444-4444-4444-8444-444444444444'
  const media = { id: mediaId, public_url: `/api/storefront/media/${mediaId}` }

  it('não aponta miniaturas para a URL pública indisponível; usa media e storefront atuais nos dois layouts', () => {
    const workspace = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/CommerceProductManagement.jsx'), 'utf8')
    expect(workspace).toContain('media={product.media?.[0] || { public_url: product.imagem }} storefrontId={storefrontId}')
    expect(workspace).not.toContain('src={product.imagem}')
    expect(adminProductMediaUrl(media, storefront.id)).toBe(`/api/admin/commerce/catalog/media/${mediaId}?storefrontId=${storefront.id}`)
    expect(adminProductMediaUrl(media, '')).toBe('')
    const editor = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/EcommerceAdmin.jsx'), 'utf8')
    expect(editor).toMatch(/function selectStorefront\(storefront\)[\s\S]*?setProducts\(\[\]\)[\s\S]*?setStorefrontId\(storefront\.id\)/)
  })

  it('não mostra URL pública quebrada nem nome textual no lugar de miniatura antes do carregamento', () => {
    const html = renderToStaticMarkup(createElement(CommerceProductMedia, { media, storefrontId: storefront.id, alt: 'Produto sintético', compact: true }))
    expect(html).toContain('commerce-product-image-placeholder')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('/api/storefront/media/')
    expect(html).not.toContain('/api/admin/commerce/catalog/media/')
    const noStorefront = renderToStaticMarkup(createElement(CommerceProductMedia, { media, storefrontId: '', alt: 'Produto sintético', compact: true }))
    expect(noStorefront).toContain('imagem indisponível')
    expect(noStorefront).not.toContain('<img')
    const missing = renderToStaticMarkup(createElement(CommerceProductMedia, { storefrontId: storefront.id, alt: 'Produto sintético', compact: true }))
    expect(missing).toContain('imagem indisponível')
  })

  it('bloqueia tracking externo arbitrário e aceita só armazenamento HTTPS autorizado', () => {
    expect(allowedProductImageSource('https://storage.googleapis.com/dino/item.jpg')).toBe(true)
    expect(allowedProductImageSource('https://bucket.storage.googleapis.com/image.webp')).toBe(true)
    for (const url of ['https://evil.example/track.png', '//storage.googleapis.com/image.png', 'http://storage.googleapis.com/item.jpg', 'https://storage.googleapis.com.evil.example/a.png', 'https://user:pass@storage.googleapis.com/a.png', 'data:image/svg+xml,abc', '/api/storefront/media/44444444-4444-4444-8444-444444444444']) {
      expect(allowedProductImageSource(url)).toBe(false)
    }
  })

  it('busca blob com escopo, cancela ao trocar vitrine e recusa payload não imagem', () => {
    const source = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/CommerceProductMedia.jsx'), 'utf8')
    expect(source).toContain('api.blob(previewUrl, { signal: controller.signal })')
    expect(source).toContain('URL.revokeObjectURL(objectUrl)')
    expect(source).toContain('RASTER_IMAGE.test(blob.type)')
    expect(source).toContain('image.source === sourceKey')
    const backend = readFileSync(resolve(process.cwd(), 'app/core/commerce-routes.js'), 'utf8')
    expect(backend).toMatch(/router\.get\('\/catalog\/media\/:id'[\s\S]*?privateCache: true/)
  })

  it('explica ações destrutivas e modos de visualização sem tornar o tooltip o único nome acessível', () => {
    expect(catalogHelpFor({ dataset: {}, tagName: 'BUTTON', textContent: 'Arquivar' })).toMatch(/preserva o histórico/i)
    expect(catalogHelpFor({ dataset: {}, tagName: 'BUTTON', textContent: '', getAttribute: name => name === 'aria-label' ? 'Exibir em cartões' : '' })).toMatch(/cartões/i)
    expect(catalogHelpFor({ dataset: { catalogHelp: 'Publica apenas na vitrine ativa.' } })).toBe('Publica apenas na vitrine ativa.')
    const workspace = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/CommerceProductManagement.jsx'), 'utf8')
    expect(workspace).toContain('aria-label="Exibir em tabela"')
    expect(workspace).toContain('aria-pressed={layout ===')
    expect(workspace).toContain('data-catalog-help={productStatus(product)')
    const tooltip = readFileSync(resolve(process.cwd(), 'web/src/pages/admin/useCatalogActionTooltip.jsx'), 'utf8')
    expect(tooltip).toContain("shell.addEventListener('focusin', show)")
    expect(tooltip).toContain("shell.addEventListener('pointerover', show)")
    expect(tooltip).toContain('role="tooltip"')
  })
})

describe('Promoções Commerce: datas, resgate e material', () => {
  const start = '2026-10-08T09:30'
  const startIso = new Date(start).toISOString()
  const endIso = new Date('2026-10-09T09:30').toISOString()
  const activeCode = { id: 'code-1', codigo: 'ATIVO80', ativo: true, usos: 2, usoMaximo: 80 }
  const promotion = { nome: 'Semana <especial>', tipo: 'percentage', valor: 15, inicio: startIso, fim: endIso, ativo: true, codigos: [activeCode] }

  it('faz round trip de datetime-local no fuso local sem deslocar minutos', () => {
    const iso = localDateTimeToUtcIso(start)
    expect(iso).toBe(startIso)
    expect(utcIsoToLocalDateTime(iso)).toBe(start)
  })

  it('preserva ausência de término em atualização parcial e envia null apenas quando o campo foi limpo', () => {
    const partialWithoutExpiry = promotionPayload({ nome: 'Sem prazo', inicio: start }, { partial: true })
    expect(partialWithoutExpiry).toEqual({ nome: 'Sem prazo', inicio: startIso })
    expect(promotionPayload({ fim: '' }, { partial: true })).toEqual({ fim: null })
    expect(promotionPayload({ nome: 'Sem prazo', inicio: start, fim: '' })).toMatchObject({ fim: null })
  })

  it('respeita os limites de início e fim e invalida datas impossíveis', () => {
    const before = new Date(startIso).getTime() - 1
    const atStart = new Date(startIso).getTime()
    const beforeEnd = new Date(endIso).getTime() - 1
    const atEnd = new Date(endIso).getTime()
    expect(promotionStatus(promotion, before)).toBe('scheduled')
    expect(promotionStatus(promotion, atStart)).toBe('active')
    expect(promotionStatus(promotion, beforeEnd)).toBe('active')
    expect(promotionStatus(promotion, atEnd)).toBe('expired')
    expect(promotionStatus({ ...promotion, inicio: 'não-é-data' }, atStart)).toBe('inactive')
    expect(promotionStatus({ ...promotion, fim: new Date(new Date(startIso).getTime() - 1).toISOString() }, atStart)).toBe('inactive')
  })

  it('seleciona somente código explicitamente ativo e não esgotado', () => {
    expect(activePromotionCode({ codigos: [{ codigo: 'ESGOTADO', ativo: true, usos: 4, usoMaximo: 4 }, activeCode] })).toBe('ATIVO80')
    expect(activePromotionCode({ codigos: [{ codigo: 'INATIVO', ativo: false, usos: 0, usoMaximo: 80 }] })).toBe('')
    expect(promotionStatus({ ...promotion, codigos: [{ codigo: 'INATIVO', ativo: false }] }, Date.parse(startIso))).toBe('exhausted')
  })

  it('copia código e validade exatos, sem inventar benefício nem divulgar URL inválida', () => {
    const text = promotionCopyText(promotion, { link: 'https://loja.example/promo' })
    expect(text).toContain('Semana <especial>: 15% de desconto.')
    expect(text).toContain('Use o código ATIVO80.')
    expect(text).toContain(`Validade: ${formatPromotionValidity(promotion)}.`)
    expect(text).not.toContain('R$')
    expect(promotionCopyText(promotion, { link: 'javascript:alert(1)' })).not.toContain('javascript:alert')
    expect(promotionCopyText(promotion, { link: 'https://user:pass@loja.example/promo' })).toContain('Consulte as condições na loja.')
  })

  it('escapa texto para exportações HTML sem permitir injeção de marcação', () => {
    expect(escapePromotionExportText(`<img src=x onerror="alert(1)"> & 'x'`)).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;x&#39;')
  })
})
