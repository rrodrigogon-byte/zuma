import { afterEach, describe, expect, it } from 'vitest'
import { api } from '../../lib/api'
import { adminProductMediaUrl, loadCommerceAdmin } from './commerce-admin-adapter'

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
