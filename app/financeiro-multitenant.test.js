import test from 'node:test';
import assert from 'node:assert/strict';
import * as fin from './financeiro-central-kytto.js';

test('Módulo Financeiro Central Kytto - Multi-tenant & DRE', async (t) => {
  const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const LOJA_DINO = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';

  await t.test('1. resumoFinanceiro deve calcular saldo, receitas e despesas da empresa', () => {
    const resumo = fin.resumoFinanceiro(EMPRESA_DINO, { lojaId: LOJA_DINO });
    assert.ok(resumo, 'Resumo deve existir');
    assert.strictEqual(typeof resumo.saldo, 'number');
    assert.strictEqual(typeof resumo.totalReceitas, 'number');
    assert.strictEqual(typeof resumo.totalDespesas, 'number');
  });

  await t.test('2. fluxoFinanceiro deve retornar 12 meses estruturados', () => {
    const fluxo = fin.fluxoFinanceiro(EMPRESA_DINO, 12, new Date(), { lojaId: LOJA_DINO });
    assert.ok(Array.isArray(fluxo), 'Fluxo deve ser array');
    assert.strictEqual(fluxo.length, 12, 'Deve ter 12 meses');
    assert.ok(fluxo[0].mes, 'Mes deve estar preenchido');
  });

  await t.test('3. dreGerencial deve calcular estrutura DRE completa', () => {
    const dre = fin.dreGerencial(EMPRESA_DINO, { mes: '2026-11', lojaId: LOJA_DINO });
    assert.ok(dre, 'DRE deve existir');
    assert.strictEqual(dre.empresaId, EMPRESA_DINO);
    assert.strictEqual(dre.mes, '2026-11');
    assert.strictEqual(typeof dre.receitaBruta, 'number');
    assert.strictEqual(typeof dre.receitaLiquida, 'number');
    assert.strictEqual(typeof dre.margemContribuicao, 'number');
    assert.strictEqual(typeof dre.ebitda, 'number');
    assert.strictEqual(typeof dre.resultadoLiquido, 'number');
    assert.ok(dre.detalhesReceita, 'Deve conter detalhesReceita');
    assert.ok(dre.detalhesCustos, 'Deve conter detalhesCustos');
  });

  await t.test('4. registrarLancamento deve persistir contas a pagar da empresa', () => {
    const lanc = fin.registrarLancamento(EMPRESA_DINO, {
      lojaId: LOJA_DINO,
      tipo: 'despesa',
      categoria: 'Aluguel & Ocupação',
      descricao: 'Aluguel Unidade Central Novembro',
      valor: 3500.00,
      vencimento: '2026-11-20',
      meioPagamento: 'pix',
      origem: 'manual',
      status: 'pendente'
    });
    assert.ok(lanc, 'Lancamento deve ser criado');
    assert.ok(lanc.id, 'Deve ter ID');
    assert.strictEqual(lanc.valor, 3500.00);
    assert.strictEqual(lanc.tipo, 'despesa');
  });
});
