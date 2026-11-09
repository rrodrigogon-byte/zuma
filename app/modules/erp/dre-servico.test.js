import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarCategoriaDRE, calcularDreCompleta, calcularDreAnual12Meses } from './dre-servico.js';

test('classificação de categorias contábeis no padrão CPC/DRE', () => {
  // Receitas
  assert.equal(classificarCategoriaDRE('receita', 'Corte de Cabelo e Barba', 'barbearia_atendimento').subgrupo, 'receita_servicos');
  assert.equal(classificarCategoriaDRE('receita', 'Pomada Modeladora', 'barbearia_revenda').subgrupo, 'receita_produtos');
  assert.equal(classificarCategoriaDRE('receita', 'Clube VIP Mensal').subgrupo, 'receita_planos');
  assert.equal(classificarCategoriaDRE('receita', 'Rendimentos de Aplicação').subgrupo, 'receita_financeira');

  // Custos Diretos
  assert.equal(classificarCategoriaDRE('despesa', 'Comissões dos Barbeiros').subgrupo, 'custo_csp');
  assert.equal(classificarCategoriaDRE('despesa', 'Fornecedores / Compras de Mercadorias').subgrupo, 'custo_cmv');
  assert.equal(classificarCategoriaDRE('despesa', 'Insumos de Barbearia').subgrupo, 'custo_cmv');

  // Deduções
  assert.equal(classificarCategoriaDRE('despesa', 'Taxas de Cartão de Crédito').subgrupo, 'deducoes_taxas');
  assert.equal(classificarCategoriaDRE('despesa', 'Estorno de Venda').subgrupo, 'deducoes_devolucoes');
  assert.equal(classificarCategoriaDRE('despesa', 'Impostos Simples Nacional').subgrupo, 'deducoes_tributos');
  assert.equal(classificarCategoriaDRE('despesa', 'ISSQN Retido').subgrupo, 'deducoes_tributos');

  // Despesas Operacionais
  assert.equal(classificarCategoriaDRE('despesa', 'Aluguel do Imóvel').subgrupo, 'despesa_ocupacao');
  assert.equal(classificarCategoriaDRE('despesa', 'Energia Elétrica e Água').subgrupo, 'despesa_ocupacao');
  assert.equal(classificarCategoriaDRE('despesa', 'Tráfego Pago Instagram').subgrupo, 'despesa_marketing');
  assert.equal(classificarCategoriaDRE('despesa', 'Software ERP Kytto').subgrupo, 'despesa_administrativa');
  assert.equal(classificarCategoriaDRE('despesa', 'Salário Recepcionista').subgrupo, 'despesa_pessoal');

  // Financeiro
  assert.equal(classificarCategoriaDRE('despesa', 'Tarifas Bancárias e TED').subgrupo, 'despesa_financeira');
});

test('cálculo da DRE completa com margens, EBITDA e análise vertical', async () => {
  const mockDb = {
    query: async (sql) => {
      if (sql.includes('to_regclass')) return { rows: [{ t: 'fin_lancamentos' }] };
      return {
        rows: [
          { id: '1', tipo: 'receita', categoria: 'Cortes e Barba', valor: 20000, data_competencia: '2026-11-05', vencimento: '2026-11-05', pago_em: '2026-11-05', status: 'pago', origem: 'barbearia_atendimento' },
          { id: '2', tipo: 'receita', categoria: 'Revenda de Cosméticos', valor: 5000, data_competencia: '2026-11-06', vencimento: '2026-11-06', pago_em: '2026-11-06', status: 'pago', origem: 'barbearia_revenda' },
          { id: '3', tipo: 'despesa', categoria: 'Taxas de Cartão', valor: 750, data_competencia: '2026-11-06', vencimento: '2026-11-06', pago_em: '2026-11-06', status: 'pago' },
          { id: '4', tipo: 'despesa', categoria: 'Fornecedores de Produtos', valor: 2000, data_competencia: '2026-11-07', vencimento: '2026-11-07', pago_em: '2026-11-07', status: 'pago', origem: 'nfe_compra' },
          { id: '5', tipo: 'despesa', categoria: 'Comissões de Barbeiros', valor: 8000, data_competencia: '2026-11-08', vencimento: '2026-11-08', pago_em: '2026-11-08', status: 'pago' },
          { id: '6', tipo: 'despesa', categoria: 'Aluguel & Condomínio', valor: 3000, data_competencia: '2026-11-01', vencimento: '2026-11-10', pago_em: '2026-11-10', status: 'pago' },
          { id: '7', tipo: 'despesa', categoria: 'Energia Elétrica e Água', valor: 800, data_competencia: '2026-11-02', vencimento: '2026-11-12', pago_em: '2026-11-12', status: 'pago' },
          { id: '8', tipo: 'despesa', categoria: 'Marketing e Anúncios', valor: 1000, data_competencia: '2026-11-03', vencimento: '2026-11-15', pago_em: '2026-11-15', status: 'pago' },
          { id: '9', tipo: 'despesa', categoria: 'Sistemas e Assinaturas', valor: 450, data_competencia: '2026-11-04', vencimento: '2026-11-16', pago_em: '2026-11-16', status: 'pago' }
        ]
      };
    }
  };

  const dre = await calcularDreCompleta(mockDb, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', { mes: '2026-11', regime: 'competencia' });

  // 1. Receita Bruta = 20.000 + 5.000 = 25.000
  assert.equal(dre.resumo.receitaBruta, 25000);
  // 2. Deduções = 750
  assert.equal(dre.resumo.totalDeducoes, 750);
  // 3. Receita Líquida (ROL) = 24.250
  assert.equal(dre.resumo.receitaLiquida, 24250);
  // 4. Custos Diretos = 2.000 (CMV) + 8.000 (CSP) = 10.000
  assert.equal(dre.resumo.totalCustos, 10000);
  // 5. Lucro Bruto = 24.250 - 10.000 = 14.250
  assert.equal(dre.resumo.lucroBruto, 14250);
  assert.equal(dre.resumo.margemBrutaPct, 57);
  // 6. Despesas Operacionais = 3.000 + 800 + 1.000 + 450 = 5.250
  assert.equal(dre.resumo.totalDespesasOperacionais, 5250);
  // 7. EBITDA = 14.250 - 5.250 = 9.000
  assert.equal(dre.resumo.ebitda, 9000);
  assert.equal(dre.resumo.margemEbitdaPct, 36);
  // 11. Lucro Líquido = 9.000
  assert.equal(dre.resumo.resultadoLiquido, 9000);
  assert.equal(dre.resumo.margemLiquidaPct, 36);

  // Verificação de Análise Vertical (AV) nas linhas principais
  const lReceita = dre.linhas.find(l => l.codigo === '1');
  assert.equal(lReceita.av, 100);
  const lCustos = dre.linhas.find(l => l.codigo === '4');
  assert.equal(lCustos.av, -40); // 10.000 / 25.000 = 40%
  const lEbitda = dre.linhas.find(l => l.codigo === '7');
  assert.equal(lEbitda.av, 36); // 9.000 / 25.000 = 36%
});
