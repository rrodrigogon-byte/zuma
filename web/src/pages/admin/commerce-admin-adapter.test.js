import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { api } from '../../lib/api'
import { adminProductMediaUrl, loadCommerceAdmin, loadCoreReports } from './commerce-admin-adapter'

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
