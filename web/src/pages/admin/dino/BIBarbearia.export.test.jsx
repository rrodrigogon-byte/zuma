import { describe, expect, it } from 'vitest'
import { buildBiCsvRows } from './BIBarbearia'

const bi = {
  periodo: { timeZone: 'America/Cuiaba' },
  resumo: { faturamentoBruto: 780, ticketMedioBruto: 130, transacoes: 6 },
  resultado: { resultado: 220 },
  fontesReceita: [{ nome: 'E-commerce confirmado', quantidade: 2, receita: 300, origem: 'commerce' }],
  serieDiaria: [{ dia: '2026-10-01', servicos: 100, revenda: 80, ecommerce: 300, historicoAvec: 300, total: 780 }],
  pagamentos: [{ metodo: 'pix', valor: 400, participacao: 51.3 }],
  financeiro: { despesasPorCategoria: [{ categoria: 'Aluguel', valor: 200 }] },
  agenda: { total: 8, concluidos: 6, cancelados: 1, faltas: 1 },
  profissionais: [{ nome: 'Nome privado', atendimentos: 3, receita: 180, comissaoEstimada: 72 }],
  servicos: [{ nome: 'Corte', quantidade: 3, receita: 180, custo: 0, margem: null }],
  revenda: [{ nome: 'Pomada', quantidade: 2, receita: 80, custo: 40, margem: 50 }],
  lojaOnline: { topProdutos: [{ nome: 'Kit', quantidade: 2, receita: 300, custo: 160, margem: 46.7 }] },
  clientes: { ativos: 4, recorrentes: 2, novosCadastros: 1 },
  perfilClientes: { faixasEtarias: [{ nome: '25–34', quantidade: 2 }], tipos: [{ nome: 'PF', quantidade: 4 }], origensCadastro: [{ nome: 'Indicação', quantidade: 2 }] },
}

describe('buildBiCsvRows', () => {
  it('exporta a seção financeira com composição e sem dados de cliente', () => {
    const rows = buildBiCsvRows(bi, 'financeiro', { empresa: 'Barbearia Dino', unidade: 'DINO-MATRIZ', periodo: '01/10 a 01/10' })
    expect(rows.some((row) => row.bloco === 'Fonte de receita' && row.indicador === 'E-commerce confirmado')).toBe(true)
    expect(rows.some((row) => row.bloco === 'Meio de pagamento' && row.indicador === 'Pix')).toBe(true)
    expect(JSON.stringify(rows)).not.toContain('Nome privado')
  })

  it('pseudonimiza a exportação operacional, sem nome de profissional', () => {
    const rows = buildBiCsvRows(bi, 'operacao')
    expect(rows.some((row) => row.indicador === 'Profissional 1' && row.valor === 180)).toBe(true)
    expect(JSON.stringify(rows)).not.toContain('Nome privado')
  })

  it('mantém os valores Commerce confirmados separados na série diária', () => {
    const rows = buildBiCsvRows(bi, 'visao')
    const daily = rows.find((row) => row.bloco === 'Série diária')
    expect(daily).toMatchObject({ ecommerce_confirmado: 300, historico_avec: 300, valor: 780 })
  })
})
