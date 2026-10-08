import { describe, expect, it } from 'vitest'
import { buildViralGramPayload, buildViralGramZip, DEFAULT_PROMOTION_PALETTE, normalizeBrandPalette, preferredVideoMimeType, socialFilename } from './promotion-social-assets'

describe('promotion social assets', () => {
  it('normaliza a identidade da vitrine e mantém fallback seguro', () => {
    expect(normalizeBrandPalette({ primary: '#123456', accent: '#ffffff', textMuted: '#abcdef' })).toMatchObject({
      surface: '#123456',
      accent: '#FFFFFF',
      muted: '#ABCDEF',
    })
    expect(normalizeBrandPalette({}).background).toBe(DEFAULT_PROMOTION_PALETTE.background)
    expect(normalizeBrandPalette({ primary: 'red' }).surface).toBe(DEFAULT_PROMOTION_PALETTE.surface)
  })

  it('gera nomes de arquivos estáveis e sem caracteres de caminho', () => {
    expect(socialFilename('Promoção de Verão / 50%')).toBe('promocao-de-verao-50')
    expect(socialFilename('', 'fallback')).toBe('fallback')
  })

  it('monta pacote importável no ViralGram sem enviar conteúdo', () => {
    const payload = buildViralGramPayload({
      brandName: 'Barbearia Dino',
      brandKey: 'dino',
      palette: { primary: '#123456' },
      promotion: { id: 'p-1', nome: 'Semana especial', tipo: 'percentage', valor: 20, codigo: 'DINO20', inicio: '2026-10-08T10:00:00Z' },
      caption: 'Legenda oficial',
      assets: [{ format: 'feed', width: 1080, height: 1350, filename: 'oferta.png' }],
    })
    expect(payload.schema).toBe('kytto.viralgram.promotion.v1')
    expect(payload.source).toBe('dino-commerce')
    expect(payload.brand.palette.surface).toBe('#123456')
    expect(payload.promotion.code).toBe('DINO20')
    expect(payload.workflow.publication).toBe('manual_approval_required')
    expect(payload.assets).toHaveLength(1)
  })

  it('escolhe somente mime types que o navegador declara suportar', () => {
    expect(preferredVideoMimeType({ isTypeSupported: type => type === 'video/webm' })).toBe('video/webm')
    expect(preferredVideoMimeType({ isTypeSupported: () => false })).toBe('')
  })

  it('empacota o manifesto e os ativos reais em um ZIP compatível', async () => {
    const payload = { schema: 'kytto.viralgram.promotion.v1', assets: [{ filename: 'oferta-feed.png' }] }
    const blob = await buildViralGramZip({ payload, assets: [{ filename: 'oferta-feed.png', blob: new Blob(['png-bytes'], { type: 'image/png' }) }] })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const text = new TextDecoder().decode(bytes)
    expect(blob.type).toBe('application/zip')
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4B)
    expect(text).toContain('viralgram-manifest.json')
    expect(text).toContain('oferta-feed.png')
    expect(text).toContain('png-bytes')
  })
})
