import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DinoCarteiraClientesPanel from './DinoCarteiraClientesPanel'
import { api } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

function allText(root) {
  if (!root) return ''
  if (typeof root === 'string') return root
  if (Array.isArray(root)) return root.map(allText).join(' ')
  if (root.children) return allText(root.children)
  return ''
}

describe('Central Dino — Carteira de Clientes por Profissional', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza o painel com barbeiros, KPIs e lista de clientes', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/resumo')) {
        return Promise.resolve({
          ok: true,
          totalGeralClientes: 2,
          carteiras: [
            {
              profissionalId: 'prof-dino',
              profissionalNome: 'Guilherme Cunha',
              profissionalApelido: 'Dino',
              totalClientes: 1,
              emDia: 1,
              idealRetorno: 0,
              atrasados: 0,
              sumidos: 0,
              faturamentoTotal: 450,
            },
            {
              profissionalId: 'prof-nat',
              profissionalNome: 'Natani Dobler',
              profissionalApelido: 'Nat',
              totalClientes: 1,
              emDia: 0,
              idealRetorno: 1,
              atrasados: 0,
              sumidos: 0,
              faturamentoTotal: 300,
            },
          ],
        })
      }
      return Promise.resolve({
        ok: true,
        total: 2,
        profissionais: [
          { id: 'prof-dino', nome: 'Guilherme Cunha', apelido: 'Dino' },
          { id: 'prof-nat', nome: 'Natani Dobler', apelido: 'Nat' },
        ],
        clientes: [
          {
            clienteId: 'c1',
            nome: 'Carlos Silva',
            telefone: '65999991111',
            barbeiroId: 'prof-dino',
            barbeiroNome: 'Guilherme Cunha',
            barbeiroApelido: 'Dino',
            barbeiroFonte: 'manual',
            ultimaVisita: '2026-10-20',
            diasSemRetorno: 6,
            statusRetorno: 'em_dia',
            servicoFavorito: 'Corte Degradê',
            totalAtendimentosComBarbeiro: 5,
            totalGastoComBarbeiro: 300,
          },
          {
            clienteId: 'c2',
            nome: 'Rafael Souza',
            telefone: '65999992222',
            barbeiroId: 'prof-nat',
            barbeiroNome: 'Natani Dobler',
            barbeiroApelido: 'Nat',
            barbeiroFonte: 'inferido',
            ultimaVisita: '2026-10-01',
            diasSemRetorno: 25,
            statusRetorno: 'ideal_retorno',
            servicoFavorito: 'Barba Terapia',
            totalAtendimentosComBarbeiro: 3,
            totalGastoComBarbeiro: 180,
          },
        ],
      })
    })

    let renderer
    await act(async () => {
      renderer = create(<DinoCarteiraClientesPanel onNovoCliente={vi.fn()} />)
    })

    const text = allText(renderer.toJSON())
    expect(text).toContain('Carteira de Clientes por Profissional')
    expect(text).toContain('Dino')
    expect(text).toContain('Nat')
    expect(text).toContain('Carlos Silva')
    expect(text).toContain('Rafael Souza')
    expect(text).toContain('WhatsApp')
  })
})
