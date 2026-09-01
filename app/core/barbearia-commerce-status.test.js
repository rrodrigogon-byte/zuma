import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBarbeariaCommerceStatus, unavailableBarbeariaCommerceStatus } from './barbearia-commerce-status.js';

function completeSnapshot(overrides = {}) {
  return {
    generatedAt: '2026-09-01T12:00:00.000Z',
    context: { empresaId: 'empresa-dino', lojaId: 'loja-dino' },
    databaseHealthy: true,
    storefronts: [{ id: 'store-dino', codigo: 'DINO', nome: 'Dino Store', canal: 'web', status: 'active', moeda: 'BRL', timezone: 'America/Cuiaba', loja_id: 'loja-dino', loja_nome: 'Dino Centro', produtos_publicados: 2, pedidos: 3 }],
    aliases: [{ storefront_id: 'store-dino', alias: 'dino', brand_key: 'dino', ativo: true }],
    catalog: { total_products: 2, published_products: 2, total_variants: 2, published_variants: 2, variants_without_price: 0 },
    inventory: { locations: 1, skus: 2, available: 9, reserved: 1, committed: 2, low_stock: 1 },
    orders: [{ status: 'pending', total: 1 }, { status: 'delivered', total: 2 }],
    fulfillments: [{ status: 'preparing', total: 1 }, { status: 'delivered', total: 2 }],
    payments: [{ status: 'pending', total: 1 }, { status: 'captured', total: 2 }],
    paymentAccounts: [{ ativo: true, ready: true }],
    shipping: { total_methods: 1, active_methods: 1, pickup_methods: 1 },
    shippingAccounts: [],
    domains: { total: 0, verified: 0, primary_verified: null },
    webhooks: { payment_failed: 0, shipping_failed: 0 },
    ...overrides,
  };
}

test('marca operação completa como pronta e preserva o isolamento de estoque', () => {
  const result = buildBarbeariaCommerceStatus(completeSnapshot());
  assert.equal(result.status, 'operacional');
  assert.equal(result.prontidao.percentual, 100);
  assert.equal(result.prontidao.pronto, true);
  assert.deepEqual(result.prontidao.bloqueadores, []);
  assert.equal(result.estoqueCompartilhado, false);
  assert.equal(result.sincronizacaoAutomatica, false);
  assert.equal(result.fonteVerdade, 'commerce-core-postgresql');
  assert.equal(result.urlPublica, '/ecommerce/dino');
});

test('agrega catálogo, estoque, pedidos, fulfillment e pagamentos sem dados sensíveis', () => {
  const result = buildBarbeariaCommerceStatus(completeSnapshot());
  assert.equal(result.catalogo.publicados, 2);
  assert.equal(result.estoque.disponivel, 9);
  assert.equal(result.pedidos.total, 3);
  assert.equal(result.pedidos.abertos, 1);
  assert.equal(result.fulfillment.emAtencao, 1);
  assert.equal(result.pagamentos.aguardando, 1);
  assert.equal(result.pagamentos.contasProntas, 1);
  assert.equal(result.frete.retiradaAtiva, true);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('token'), false);
});

test('lista pagamento ausente como bloqueador obrigatório', () => {
  const result = buildBarbeariaCommerceStatus(completeSnapshot({ paymentAccounts: [] }));
  assert.equal(result.status, 'configuracao_pendente');
  assert.equal(result.prontidao.pronto, false);
  assert.equal(result.prontidao.bloqueadores.some(item => item.id === 'payment'), true);
  assert.equal(result.prontidao.percentual, 88);
});

test('distingue tenant aguardando provisionamento de falha técnica', () => {
  const pending = buildBarbeariaCommerceStatus(completeSnapshot({ storefronts: [], aliases: [], catalog: {}, inventory: {}, paymentAccounts: [], shipping: {} }));
  assert.equal(pending.status, 'aguardando_provisionamento');
  assert.equal(pending.storefront, null);
  assert.equal(pending.urlPublica, null);

  const unavailable = buildBarbeariaCommerceStatus(completeSnapshot({ databaseHealthy: false }));
  assert.equal(unavailable.status, 'indisponivel');
  assert.equal(unavailable.saude.banco, 'unhealthy');
});

test('fallback de permissão não expõe contexto nem habilita links operacionais', () => {
  const result = unavailableBarbeariaCommerceStatus('sem_permissao');
  assert.equal(result.status, 'sem_permissao');
  assert.equal(result.prontidao.pronto, false);
  assert.equal(result.prontidao.bloqueadores[0].label, 'Acesso de relatórios Commerce não concedido');
  assert.equal(result.contexto, undefined);
  assert.deepEqual(result.links, { admin: '/admin/ecommerce' });
});
