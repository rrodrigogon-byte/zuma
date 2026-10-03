import { afterEach, describe, expect, it } from 'vitest'
import { api } from '../../lib/api'
import { loadCommerceAdmin } from './commerce-admin-adapter'

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

  it('não oculta erro de autenticação como falha opcional de catálogo', async () => {
    api.get = async path => {
      if (path.includes('/catalog/products?')) throw Object.assign(new Error('sessão inválida'), { status: 401 })
      if (path.endsWith('/storefront') || path.endsWith('/storefronts')) return { items: [storefront] }
      return { items: [] }
    }
    await expect(loadCommerceAdmin({ storefrontId: storefront.id })).rejects.toMatchObject({ status: 401 })
  })
})
