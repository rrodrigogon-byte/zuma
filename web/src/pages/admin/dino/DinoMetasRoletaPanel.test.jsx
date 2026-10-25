import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, it, expect, vi } from 'vitest'
import { DinoMetasGamificacaoModalConfig } from './DinoMetasGamificacaoModalConfig'
import { DinoRoletaModal } from './DinoRoletaModal'

function allText(root) {
  if (!root) return ''
  if (typeof root === 'string') return root
  if (Array.isArray(root)) return root.map(allText).join(' ')
  if (root.children) return allText(root.children)
  return ''
}

describe('Central Dino — Gamificação, Metas & Roleta', () => {
  it('Modal de configuração exibe metas diárias de extras e produtos', () => {
    const configMock = {
      metasDiarias: {
        servicosExtrasAtivo: true,
        servicosExtrasQtd: 6,
        servicosExtrasGiros: 1,
        produtosAtivo: true,
        produtosValor: 100,
        produtosGiros: 1,
      },
      metasSemanais: {
        ativo: true,
        tituloDesafio: 'Desafio Semanal de Vendas',
        produtosValor: 500,
        girosDesafio: 2,
      },
      premiosRoleta: [
        { id: 'p1', nome: 'R$ 50 no Pix', cor: '#10b981', icone: '🎁', ativo: true, peso: 15 },
        { id: 'p2', nome: 'Vale Hambúrguer', cor: '#f59e0b', icone: '🍔', ativo: true, peso: 20 },
      ],
    }

    let renderer
    act(() => {
      renderer = create(
        <DinoMetasGamificacaoModalConfig
          open={true}
          onClose={() => {}}
          configAtual={configMock}
          onSalvar={() => {}}
        />
      )
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Configurar Metas & Prêmios da Roleta')
    expect(texto).toContain('Meta Diária de Serviços Extras')
    expect(texto).toContain('Meta Diária de Venda de Produtos')
  })

  it('Modal da Roleta exibe o nome do profissional e botão de girar', () => {
    const giroMock = {
      id: 'giro-123',
      profissionalNome: 'Lucas Barbeiro',
      motivo: 'Meta Diária: 6 serviços extras realizados',
    }
    const premiosMock = [
      { id: 'p1', nome: 'R$ 50 no Pix', cor: '#10b981', icone: '🎁', ativo: true, peso: 15 },
      { id: 'p2', nome: 'Vale Almoço', cor: '#f59e0b', icone: '🍔', ativo: true, peso: 20 },
    ]

    let renderer
    act(() => {
      renderer = create(
        <DinoRoletaModal
          open={true}
          onClose={() => {}}
          giro={giroMock}
          premios={premiosMock}
        />
      )
    })

    const texto = allText(renderer.toJSON())
    expect(texto).toContain('Giro da Sorte de Lucas Barbeiro')
    expect(texto).toContain('Meta Diária: 6 serviços extras realizados')
    expect(texto).toContain('GIRAR!')
  })
})
