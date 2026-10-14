import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/push-equipe', () => ({ situacaoPush: vi.fn(async () => ({ ok: true, ativo: false, motivo: 'permissao_pendente' })), ativarPush: vi.fn(), desativarPush: vi.fn(), testarPush: vi.fn() }))
import { Avisos } from './ModoBarbeiro'
describe('Avisos push do Modo Barbeiro', () => {
  it('orienta autorização no gesto', async () => {
    let renderer
    await act(async () => { renderer = TestRenderer.create(<Avisos gestao={false} />); await Promise.resolve() })
    const html = renderer.toJSON()
    const texto = JSON.stringify(html)
    expect(texto).toContain('Ligar avisos')
    expect(texto).toContain('Toque em')
  })
})
