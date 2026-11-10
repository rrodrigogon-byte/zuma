import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isProdutoBebida,
  calcularComissaoItemProduto,
} from './core/dino-regras-comissoes.js';
import { executeDinoReversal, createDinoReversalMemoryAdapter } from './core/dino-reversal-coordinator.js';

test('isProdutoBebida identifica corretamente todas as bebidas e exclui cosmeticos', () => {
  // Bebidas devem retornar true
  assert.equal(isProdutoBebida({ nome: 'Agua com gás', categoria: 'Bebidas e snacks' }), true);
  assert.equal(isProdutoBebida({ nome: 'Água Mineral sem Gás 500ml', categoria: 'Bebidas & Bar' }), true);
  assert.equal(isProdutoBebida({ nome: 'Cerveja Heineken Long Neck 330ml', categoria: 'Bebidas & Bar' }), true);
  assert.equal(isProdutoBebida({ nome: 'Refrigerante Coca-Cola Lata 350ml', categoria: 'Bebidas & Bar' }), true);
  assert.equal(isProdutoBebida({ nome: 'Café Expresso Gourmet', categoria: 'Bebidas & Bar' }), true);
  assert.equal(isProdutoBebida({ nome: 'Energético Red Bull 250ml', categoria: 'Bebidas & Bar' }), true);
  assert.equal(isProdutoBebida({ nome: 'Dose Whisky / Destilado Especial', categoria: 'Bebidas & Bar' }), true);

  // Cosméticos e produtos de revenda comissionáveis devem retornar false
  assert.equal(isProdutoBebida({ nome: 'Pomada Modeladora Efeito Matte 120g', categoria: 'Revenda' }), false);
  assert.equal(isProdutoBebida({ nome: 'Óleo para Barba Premium Hidratante 30ml', categoria: 'Revenda' }), false);
  assert.equal(isProdutoBebida({ nome: 'Shampoo Masculino Anticaspa Fortalecedor 250ml', categoria: 'Revenda' }), false);
  assert.equal(isProdutoBebida({ nome: 'Balm Alinhador e Modelador de Barba 100g', categoria: 'Revenda' }), false);
});

test('calcularComissaoItemProduto garante 0% de comissao para bebidas e 10% para cosmeticos', () => {
  const itemAgua = {
    nome: 'Agua com gás',
    categoria: 'Bebidas e snacks',
    subtotal: 5.00,
    quantidade: 1,
    precoUnitario: 5.00,
  };
  const prof = { comissaoProdutos: 10 };

  const resAgua = calcularComissaoItemProduto(itemAgua, prof);
  assert.equal(resAgua.isBebida, true);
  assert.equal(resAgua.percentualAplicado, 0);
  assert.equal(resAgua.valorComissao, 0.00);

  const itemPomada = {
    nome: 'Pomada Modeladora Efeito Matte 120g',
    categoria: 'Revenda',
    subtotal: 65.00,
    quantidade: 1,
    precoUnitario: 65.00,
  };
  const resPomada = calcularComissaoItemProduto(itemPomada, prof);
  assert.equal(resPomada.isBebida, false);
  assert.equal(resPomada.percentualAplicado, 10);
  assert.equal(resPomada.valorComissao, 6.50);
});

test('executeDinoReversal permite novo cancelamento se a tentativa anterior ficou manual_required ou incompleta', async () => {
  const EMPRESA = '11111111-1111-4111-8111-111111111111';
  const LOJA = '22222222-2222-4222-8222-222222222222';
  const adapter = createDinoReversalMemoryAdapter();

  // Simula a comanda exatamente no estado da Geofrey Lisgoski em produção
  const sourceMock = {
    id: 'cmdbar-mvvcv362-017',
    empresaId: EMPRESA,
    lojaId: LOJA,
    status: 'aguardando_pagamento', // comanda não cancelada
    estornada: false,
    dinoReversal: {
      actionId: 'act-cancel-cmdbar-mvvcv362-017-mw9960ba',
      status: 'manual_required',
    },
    pagamentos: [{ id: 'pag-1', meio: 'credito', valor: 200 }, { id: 'pag-2', meio: 'credito', valor: 5 }],
  };

  const effects = {
    payment: async () => ({ status: 'completed', reason: 'in_store_counter_payment_reversed' }),
    financial: async () => ({ status: 'completed' }),
    cash: async () => ({ status: 'completed' }),
    inventory: async () => ({ status: 'completed' }),
    loyalty: async () => ({ status: 'completed' }),
    commission: async () => ({ status: 'completed' }),
    audit: async () => ({ status: 'completed' }),
    source: async () => ({ status: 'completed' }),
  };

  // Nova tentativa de cancelamento com uma nova actionId e cancelarFinalizada: true
  const res = await executeDinoReversal(
    { empresaId: EMPRESA, lojaId: LOJA },
    {
      sourceType: 'comanda',
      sourceId: 'cmdbar-mvvcv362-017',
      operador: 'operador-1',
      confirmado: true,
      actionId: 'act-cancel-cmdbar-mvvcv362-017-novo',
      idempotencyKey: 'idemp-novo-123',
      motivo: 'Erro de digitação / valor incorreto',
      cancelarFinalizada: true,
      estornoManual: true,
    },
    { adapter, resolveSource: () => sourceMock, effects }
  );

  assert.equal(res.status, 'completed');
  assert.equal(res.actionId, 'act-cancel-cmdbar-mvvcv362-017-novo');
});
