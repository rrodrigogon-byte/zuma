import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isProdutoBebida,
  calcularComissaoItemProduto,
  obterPercentualComissaoServico,
  obterPercentualComissaoProduto,
} from './core/dino-regras-comissoes.js';
import { calcularComissoesEstado } from './barbearia-erp-kytto.js';
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

test('obterPercentualComissaoServico respeita percentualComissao=40 da Nati, 50 do Bruno/Dino e subtotal===0', () => {
  const profNati = { id: 'prof-mv1bx3sc-011', nome: 'Nati', percentualComissao: 40, percentualComissaoProduto: 10 };
  const profBruno = { id: 'prof-mtj69hhx-002', nome: 'Bruno Mendes Pedroso', percentualComissao: 50, percentualComissaoProduto: 10 };
  const profDino = { id: 'prof-mtj67o7r-001', nome: 'Dino', percentualComissao: 50, percentualComissaoProduto: 10 };

  assert.equal(obterPercentualComissaoServico(profNati, null, profNati.id), 40);
  assert.equal(obterPercentualComissaoServico(profBruno, null, profBruno.id), 50);
  assert.equal(obterPercentualComissaoServico(profDino, null, profDino.id), 50);
  assert.equal(obterPercentualComissaoServico(null, null, '__sem_profissional__'), 0);

  // Produto com subtotal === 0 (cortesia/pacote) não deve usar precoUnitario
  const prodZero = calcularComissaoItemProduto({ nome: 'Pomada', precoUnitario: 90, quantidade: 1, subtotal: 0 }, profBruno);
  assert.equal(prodZero.subtotal, 0);
  assert.equal(prodZero.valorComissao, 0);
  assert.equal(obterPercentualComissaoProduto(profNati, { nome: 'Cerveja Heineken', categoria: 'Bebidas & Bar' }, profNati.id), 0);
  assert.equal(obterPercentualComissaoProduto(profDino, { nome: 'Defrisante', categoria: 'Revenda' }, profDino.id), 10);
});

test('calcularComissoesEstado considera dataAtendimento (ex.: 02/11 lancado em 07/11) e respeita subtotal===0 e Nati 40%', () => {
  const estado = {
    profissionais: {
      'prof-mtj69hhx-002': { id: 'prof-mtj69hhx-002', nome: 'Bruno Mendes Pedroso', percentualComissao: 50, percentualComissaoProduto: 10, ativo: true },
      'prof-mv1bx3sc-011': { id: 'prof-mv1bx3sc-011', nome: 'Nati', percentualComissao: 40, percentualComissaoProduto: 10, ativo: true },
    },
    comandas: {
      'cmd-02-11': {
        id: 'cmd-02-11',
        empresaId: 'emp-1',
        status: 'paga',
        dataAtendimento: '2026-11-02',
        fechadaEm: '2026-11-07T19:11:41.567Z',
        profissionalId: 'prof-mtj69hhx-002',
        desconto: 0,
        itens: [
          { tipo: 'servico', nome: 'BARBA PREMIUM', precoUnitario: 100, quantidade: 1, subtotal: 0, profissionalId: 'prof-mtj69hhx-002' },
          { tipo: 'pacote', nome: 'Pacote 4 Procedimentos', precoUnitario: 300, quantidade: 1, subtotal: 300, profissionalId: 'prof-mtj69hhx-002' },
          { tipo: 'servico', nome: 'Selagem', precoUnitario: 800, quantidade: 1, subtotal: 800, profissionalId: 'prof-mtj69hhx-002' },
        ],
        pagamentos: [{ meio: 'pix', valor: 1100 }],
      },
      'cmd-03-11-nati': {
        id: 'cmd-03-11-nati',
        empresaId: 'emp-1',
        status: 'paga',
        dataAtendimento: '2026-11-03',
        fechadaEm: '2026-11-03T12:00:00.000Z',
        profissionalId: 'prof-mv1bx3sc-011',
        desconto: 0,
        itens: [
          { tipo: 'servico', nome: 'Procedimentos Nati', precoUnitario: 1090, quantidade: 1, subtotal: 1090, profissionalId: 'prof-mv1bx3sc-011' },
          { tipo: 'produto', nome: 'Cerveja Heineken Long Neck 330ml', categoria: 'Bebidas & Bar', precoUnitario: 12, quantidade: 1, subtotal: 12, profissionalId: 'prof-mv1bx3sc-011' },
        ],
        pagamentos: [{ meio: 'credito', valor: 1102 }],
      },
    },
    agendamentos: {},
    vendasRevenda: {},
    configuracao: { taxasPagamento: {} },
  };

  const res02 = calcularComissoesEstado(estado, 'emp-1', { data: '2026-11-02' });
  const bruno02 = res02.porProfissional.find((p) => p.profissionalId === 'prof-mtj69hhx-002');
  assert.equal(bruno02.brutoServicos, 1100);
  assert.equal(bruno02.comissaoServicos, 550);

  const res03 = calcularComissoesEstado(estado, 'emp-1', { data: '2026-11-03' });
  const nati03 = res03.porProfissional.find((p) => p.profissionalId === 'prof-mv1bx3sc-011');
  assert.equal(nati03.percentualComissao, 40);
  assert.equal(nati03.brutoServicos, 1090);
  assert.equal(nati03.comissaoServicos, 436);
  assert.equal(nati03.comissaoProdutos, 0);
  assert.equal(nati03.repasse, 436);
});
