import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscount, createIdempotencyKey, findCoupon, normalizeItems, simulateCheckout } from './checkout-core.js';

const catalog = [
  { id: 1, nome: 'Kit Kytto', preco: 100, estoque: 5, ativo: true },
  { id: 2, nome: 'Boné Kytto', preco: 40, estoque: 2, ativo: true },
];

const coupons = [
  { id: 10, codigo: 'KY TTO10', tipo: 'pct', valor: 10, uso: 'loja', ativo: true, usos: 0, maxUsos: null },
  { id: 11, codigo: 'TODOS', tipo: 'fixo', valor: 20, uso: 'todos', ativo: true, usos: 0, maxUsos: null },
];

test('normaliza itens e consolida variações repetidas', () => {
  const result = normalizeItems([{ produtoId: 1, qtd: 1 }, { produtoId: 1, qtd: 2 }], catalog);
  assert.equal(result.length, 1);
  assert.equal(result[0].qtd, 3);
  assert.equal(result[0].subtotal, 300);
});

test('rejeita estoque agregado insuficiente', () => {
  assert.throws(() => normalizeItems([{ produtoId: 2, qtd: 2 }, { produtoId: 2, qtd: 1 }], catalog), /estoque insuficiente/);
});

test('aceita cupom específico de loja e calcula percentual', () => {
  const coupon = findCoupon(coupons, 'KY TTO10', 'loja');
  assert.equal(calculateDiscount(coupon, 100), 10);
});

test('simula retirada grátis e total confiável no servidor', () => {
  const result = simulateCheckout({ catalog, coupons, items: [{ produtoId: 1, qtd: 1 }], shippingMethod: 'pickup' });
  assert.equal(result.subtotal, 100);
  assert.equal(result.desconto, 0);
  assert.equal(result.frete, 0);
  assert.equal(result.totalFinal, 100);
  assert.equal(result.metodoEntrega.id, 'pickup');
});

test('simula entrega somente com endereço completo', () => {
  const previous = process.env.CHECKOUT_DELIVERY_ENABLED;
  process.env.CHECKOUT_DELIVERY_ENABLED = '1';
  try {
    assert.throws(() => simulateCheckout({ catalog, items: [{ produtoId: 1, qtd: 1 }], shippingMethod: 'delivery-local', address: {} }), /CEP válido/);
    const result = simulateCheckout({ catalog, items: [{ produtoId: 1, qtd: 1 }], shippingMethod: 'delivery-local', address: { cep: '78000000', rua: 'Rua A', numero: '10', cidade: 'Cuiabá', uf: 'MT' } });
    assert.equal(result.enderecoEntrega.cep, '78000000');
  } finally {
    if (previous === undefined) delete process.env.CHECKOUT_DELIVERY_ENABLED;
    else process.env.CHECKOUT_DELIVERY_ENABLED = previous;
  }
});

test('mantém uma chave de idempotência válida e estável', () => {
  const key = createIdempotencyKey('checkout-client-123456');
  assert.equal(key, 'checkout-client-123456');
  assert.ok(createIdempotencyKey('').startsWith('web_'));
});
