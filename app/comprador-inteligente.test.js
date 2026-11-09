import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executarMotorCalculo,
  gerarCotacoesComparativas,
  responderCopilotComprador,
  configPadraoAutonomia
} from './comprador-inteligente-kytto.js';

test('Comprador Inteligente: motor de calculo preditivo ROP, EOQ e Ruptura', () => {
  const produtos = [
    { id: 'p1', nome: 'Pomada Matte 120g', estoqueAtual: 2, estoqueMinimo: 6, custoUnitario: 20, precoVenda: 50, categoria: 'revenda' },
    { id: 'p2', nome: 'Cerveja Long Neck', estoqueAtual: 48, estoqueMinimo: 24, custoUnitario: 4.8, precoVenda: 10, categoria: 'bebidas' },
    { id: 'p3', nome: 'Shaving Gel 500ml', estoqueAtual: 0, estoqueMinimo: 4, custoUnitario: 18, precoVenda: 45, categoria: 'insumo' }
  ];

  const vendasMap = new Map([
    ['p1', { quantidade: 30, receita: 1500 }],
    ['p2', { quantidade: 60, receita: 600 }],
    ['p3', { quantidade: 12, receita: 540 }]
  ]);

  const fornecedores = [
    { id: 'forn-alfa', nome: 'Distribuidora Alfa', prazoEntregaDias: 4 }
  ];

  const res = executarMotorCalculo(produtos, vendasMap, fornecedores);

  assert.equal(res.totalSkus, 3);
  assert(res.healthScore > 0 && res.healthScore <= 100);
  assert(res.recomendacoes.length >= 2, 'P1 e P3 devem gerar recomendacao de compra');

  const p3Analise = res.analises.find(a => a.produtoId === 'p3');
  assert.equal(p3Analise.statusRuptura, 'critico');
  assert(p3Analise.quantidadeSugerida > 0);
  assert(p3Analise.justificativaIA.includes('Ruptura iminente'));
});

test('Comprador Inteligente: cotacoes comparativas multi-fornecedor', () => {
  const cotacoes = gerarCotacoesComparativas();
  assert(cotacoes.length >= 3);
  for (const c of cotacoes) {
    assert(c.categoria);
    assert(c.cotacoes.length >= 2);
    const vencedor = c.cotacoes.find(cot => cot.selo === 'melhor_custo_beneficio');
    assert(vencedor, 'Deve ter fornecedor vencedor');
  }
});

test('Comprador Inteligente: Copilot AI responde perguntas sobre compras e ruptura', () => {
  const diagnostico = {
    healthScore: 85,
    kpis: { criticos: 1, atencao: 1, totalInvestimentoSugerido: 450, capitalImobilizadoExcesso: 120, economiaProjetadaCotacao: 65 },
    recomendacoes: [
      { nome: 'Shaving Gel', estoqueAtual: 0, diasCobertura: 0, quantidadeSugerida: 12, fornecedorNome: 'Distribuidora Alfa', statusRuptura: 'critico', custoTotalSugerido: 216 }
    ]
  };

  const respRuptura = responderCopilotComprador('quais itens com risco critico de ruptura?', diagnostico);
  assert(respRuptura.resposta.includes('risco crítico'));
  assert(respRuptura.resposta.includes('Shaving Gel'));

  const respCapital = responderCopilotComprador('onde temos capital parado?', diagnostico);
  assert(respCapital.resposta.includes('imobilizados'));
});

test('Comprador Inteligente: config padrao de autonomia', () => {
  const cfg = configPadraoAutonomia();
  assert.equal(cfg.nivel, 'assistido');
  assert(cfg.tetoSemanal > 0);
  assert.equal(cfg.fornecedoresAutorizados.length, 4);
});
