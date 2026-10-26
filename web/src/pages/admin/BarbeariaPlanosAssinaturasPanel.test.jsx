import { describe, it, expect } from 'vitest'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import BarbeariaPlanosAssinaturasPanel from './BarbeariaPlanosAssinaturasPanel'

describe('BarbeariaPlanosAssinaturasPanel', () => {
  const mockPlanos = [
    {
      id: 'plano-dino-vip',
      nome: 'Plano VIP Gold — Exclusivo Dino',
      descricao: '4 atendimentos VIP com o Dino',
      preco: 600,
      ciclo: 'mensal',
      sessoesIncluidas: 4,
      ehVip: true,
      tipoProfissional: 'especifico',
      profissionalId: 'prof-dino-1',
      profissionalNome: 'Guilherme Dino',
      precosPorProfissional: {},
    },
    {
      id: 'plano-equipe',
      nome: 'Clube Recorrência Dino',
      descricao: 'Plano com preços diferenciados',
      preco: 250,
      ciclo: 'mensal',
      sessoesIncluidas: 4,
      ehVip: false,
      tipoProfissional: 'todos',
      precosPorProfissional: {
        'prof-dino-1': 600,
        'prof-bruno-2': 250,
      },
    },
  ]

  const mockProfissionais = [
    { id: 'prof-dino-1', nome: 'Guilherme Cunha (Dino)', apelido: 'Dino', ativo: true },
    { id: 'prof-bruno-2', nome: 'Bruno Mendes', apelido: 'Bruno', ativo: true },
  ]

  const mockClientes = [
    { id: 'cli-1', nome: 'Rodrigo Ribeiro', telefone: '66999998888' },
  ]

  const mockAssinaturas = [
    {
      id: 'ass-1',
      clienteId: 'cli-1',
      clienteNome: 'Rodrigo Ribeiro',
      planoId: 'plano-dino-vip',
      profissionalId: 'prof-dino-1',
      profissionalNome: 'Guilherme Cunha (Dino)',
      sessoesContratadas: 4,
      sessoesUsadas: 1,
      status: 'ativa',
      ehVip: true,
      precoContratado: 600,
    },
  ]

  it('1. Renderiza planos com badge VIP e profissional vinculado', () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(
        <BarbeariaPlanosAssinaturasPanel
          planos={mockPlanos}
          assinaturas={mockAssinaturas}
          profissionais={mockProfissionais}
          clientes={mockClientes}
        />
      )
    })

    const text = JSON.stringify(renderer.toJSON())
    expect(text).toContain('Plano VIP Gold — Exclusivo Dino')
    expect(text).toContain('VIP')
    expect(text).toContain('600')
    expect(text).toContain('Guilherme Dino')
    expect(text).toContain('Clube Recorrência Dino')
  })

  it('2. Exibe tabela de preços diferenciados por profissional', () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(
        <BarbeariaPlanosAssinaturasPanel
          planos={mockPlanos}
          assinaturas={mockAssinaturas}
          profissionais={mockProfissionais}
          clientes={mockClientes}
        />
      )
    })

    const text = JSON.stringify(renderer.toJSON())
    expect(text).toContain('Valores por Profissional')
    expect(text).toContain('Guilherme Cunha (Dino)')
    expect(text).toContain('Bruno Mendes')
  })

  it('3. Exibe assinaturas ativas com profissional e badge VIP', () => {
    let renderer
    act(() => {
      renderer = TestRenderer.create(
        <BarbeariaPlanosAssinaturasPanel
          planos={mockPlanos}
          assinaturas={mockAssinaturas}
          profissionais={mockProfissionais}
          clientes={mockClientes}
        />
      )
    })

    const text = JSON.stringify(renderer.toJSON())
    expect(text).toContain('Rodrigo Ribeiro')
    expect(text).toContain('Profissional vinculado')
    expect(text).toContain('Guilherme Cunha (Dino)')
    expect(text).toContain('Link Vínculo')
    expect(text).toContain('Extrato WhatsApp')
  })
})
