import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../../lib/api', async (importOriginal) => ({ ...(await importOriginal()), api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
import { HistoricoAvecExtrato } from './RepassesPanel'

const textoDe = (renderer) => JSON.stringify(renderer.toJSON())

describe('HistoricoAvecExtrato — Club do Avec', () => {
  it('mostra os atendimentos Club e a diferença entre o pago e o calculado por atendimento', () => {
    const historico = {
      atendimentos: 9, comValor: 4, bruto: 400, percentual: 50, comissao: 200, nomesAvec: ['Bruno Mendes pedroso'], linhas: [],
      pagamentos: { total: 240, comissoes: 230, antecipacoes: 10, itens: [] },
      club: { atendimentos: 4, porServico: [{ servico: 'Barba Club', quantidade: 2 }, { servico: 'Corte Club', quantidade: 1 }] },
      conferencia: { calculado: 200, pago: 240, diferenca: 40, porAtendimentoClub: 10, observacao: 'Pago no Avec menos a comissão calculada.' },
    }
    let renderer
    act(() => { renderer = create(<HistoricoAvecExtrato historico={historico} />) })
    const texto = textoDe(renderer)
    expect(texto).toContain('Atendimentos Club')
    expect(texto).toContain('Barba Club 2')
    expect(texto).toContain('Pago − calculado')
    expect(texto).toContain('por atendimento Club (pote do Avec)')
    expect(texto).toMatch(/10,00/)
  })

  it('sem pagamento do Avec no período, não mostra a diferença', () => {
    const historico = { atendimentos: 0, comValor: 0, bruto: 0, percentual: 50, comissao: 0, linhas: [], pagamentos: { total: 0, comissoes: 0, antecipacoes: 0, itens: [] }, club: { atendimentos: 0, porServico: [] }, conferencia: { calculado: 0, pago: 0, diferenca: null, porAtendimentoClub: null, observacao: 'Sem comissão ou antecipação do Avec lançada no período para comparar.' } }
    let renderer
    act(() => { renderer = create(<HistoricoAvecExtrato historico={historico} />) })
    expect(textoDe(renderer)).not.toContain('Pago − calculado')
  })
})
