import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './import-legacy-commerce.js';

test('summarize contabiliza catálogo e pedidos legados sem inventar dados', () => {
  const result = summarize({
    loja: [
      { id: 1, nome: 'Produto A', cat: 'Acessórios', estoque: 4, preco: 10 },
      { id: 2, nome: 'Produto B', cat: 'Acessórios', estoque: 2, preco: 20 },
    ],
    pedidosLoja: [
      { id: 10, codigo: 'LJ-10', status: 'pendente', total: 30 },
      { id: 11, codigo: 'LJ-11', status: 'entregue', total: 20 },
    ],
  });
  assert.deepEqual(result, {
    source: 'legacy-json-store',
    products: 2,
    orders: 2,
    categories: 1,
    stockUnits: 6,
    orderValue: 50,
    statuses: { pending_payment: 1, completed: 1 },
  });
});

test('summarize aceita base sem catálogo ou pedidos', () => {
  assert.deepEqual(summarize({}), {
    source: 'legacy-json-store',
    products: 0,
    orders: 0,
    categories: 0,
    stockUnits: 0,
    orderValue: 0,
    statuses: {},
  });
});
