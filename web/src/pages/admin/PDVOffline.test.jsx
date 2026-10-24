import { describe, expect, it } from 'vitest'
import { detalheConflito } from './PDVOffline'

describe('PDV offline: detalhe do conflito', () => {
  it('mostra o que o caixa cobrou e o cadastro', () => {
    const t = detalheConflito({ tipo_conflito: 'preco_divergente', dados_cliente: { valor_unitario: 8 }, dados_servidor: { nome: 'Cerveja', preco: 10 } })
    expect(t).toMatch(/Cerveja: caixa cobrou R\$\s?8,00, cadastro R\$\s?10,00/)
  })
  it('dia fechado traz a data e o valor', () => {
    expect(detalheConflito({ tipo_conflito: 'dia_fechado', dados_cliente: { total: 10 }, dados_servidor: { dia_fechado: '2026-10-21' } })).toMatch(/21\/10\/2026/)
  })
  it('venda recusada traz o motivo', () => {
    expect(detalheConflito({ tipo_conflito: 'venda_rejeitada', dados_servidor: { erro: 'Pagamentos não conferem' } })).toBe('Pagamentos não conferem')
  })
})
