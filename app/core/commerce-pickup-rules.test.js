import test from 'node:test';
import assert from 'node:assert/strict';
import { pickupOnlyItems, requiresPickupOnly } from './commerce-pickup-rules.js';

test('congelados e refrigerados exigem retirada na loja', () => {
  assert.equal(requiresPickupOnly({ categoryName: 'Sem glúten e congelados' }), true);
  assert.equal(requiresPickupOnly({ categoryName: 'CONGELADOS' }), true);
  assert.equal(requiresPickupOnly({ productName: 'Pão de queijo congelado 1kg' }), true);
  assert.equal(requiresPickupOnly({ productName: 'Iogurte proteico refrigerado' }), true);
  assert.equal(requiresPickupOnly({ categoryName: 'Produtos perecíveis' }), true);
});

test('suplementos, perfumaria e categorias comuns continuam com entrega', () => {
  for (const item of [
    { categoryName: 'Whey e proteínas', productName: '100% Whey 900g' },
    { categoryName: 'Creatina', productName: 'Creatina monohidratada 300g' },
    { categoryName: 'Perfumaria', productName: 'Perfume masculino 100ml' },
    { categoryName: '', productName: '' },
    {},
  ]) assert.equal(requiresPickupOnly(item), false, JSON.stringify(item));
});

test('pickupOnlyItems separa apenas os itens que bloqueiam o envio', () => {
  const cart = [
    { categoryName: 'Creatina', productName: 'Creatina 300g' },
    { categoryName: 'Congelados', productName: 'Lasanha fit' },
  ];
  assert.deepEqual(pickupOnlyItems(cart).map(item => item.productName), ['Lasanha fit']);
  assert.deepEqual(pickupOnlyItems(null), []);
});
