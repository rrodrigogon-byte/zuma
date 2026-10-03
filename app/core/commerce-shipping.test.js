import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCpfCnpj, issueShippingLabel, normalizeCep, normalizeOwnDeliveryConfig, normalizeShippingAddress, publicShippingMethod, quoteAvailableShipping, quoteShipping, reconcileShippingLabel, resolveShippingSelection, shippingAccountReady, updateShippingTracking } from './commerce-shipping.js';
import { shippingProviders } from './shipping-adapters.js';

const originalFetch = global.fetch;
const originalToken = process.env.ME_ACCESS_TOKEN;
const originalWebhook = process.env.ME_WEBHOOK_SECRET;
const originalCorreiosToken = process.env.CORREIOS_API_TOKEN;

function fakePostal(cep, cidade, estado) {
  global.fetch = async url => {
    assert.equal(url, `https://viacep.com.br/ws/${cep}/json/`);
    return new Response(JSON.stringify({ cep, localidade: cidade, uf: estado }), { status: 200 });
  };
}

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.ME_ACCESS_TOKEN;
  else process.env.ME_ACCESS_TOKEN = originalToken;
  if (originalWebhook === undefined) delete process.env.ME_WEBHOOK_SECRET;
  else process.env.ME_WEBHOOK_SECRET = originalWebhook;
  if (originalCorreiosToken === undefined) delete process.env.CORREIOS_API_TOKEN;
  else process.env.CORREIOS_API_TOKEN = originalCorreiosToken;
});

test('normaliza CEP e exige documento em endereço de entrega', () => {
  assert.equal(normalizeCep('01001-000'), '01001000');
  assert.equal(isValidCpfCnpj('12345678909'), true);
  assert.equal(isValidCpfCnpj('11444777000161'), true);
  assert.equal(isValidCpfCnpj('12345678900'), false);
  assert.throws(() => normalizeCep('123'), /8 dígitos/);
  assert.throws(() => normalizeShippingAddress({ destinatario: 'Cliente', cep: '01001000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }), /CPF ou CNPJ/);
  assert.throws(() => normalizeShippingAddress({ destinatario: 'Cliente', documento: '12345678900', cep: '01001000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }), /inválido/);
  const address = normalizeShippingAddress({ destinatario: 'Cliente', email: 'Cliente@EXAMPLE.COM', telefone: '11999999999', documento: '12345678909', cep: '01001-000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'sp' });
  assert.deepEqual(address, { modo: 'entrega', destinatario: 'Cliente', email: 'cliente@example.com', telefone: '11999999999', documento: '12345678909', companyDocument: null, cep: '01001000', logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', referencia: null });
});

test('método público só habilita cotação com conta pronta e não expõe configuração interna', () => {
  const method = { id: '10000000-0000-4000-8000-000000000101', codigo: 'me', nome: 'Transportadora', tipo: 'delivery', configuracao: { provider: 'melhorenvio', shippingAccountId: '10000000-0000-4000-8000-000000000102', origin: { document: 'secret-like' } } };
  assert.equal(publicShippingMethod({ ...method, shipping_account_ready: false }).quoteEnabled, false);
  const publicMethod = publicShippingMethod({ ...method, shipping_account_ready: true });
  assert.equal(publicMethod.quoteEnabled, true);
  assert.equal(publicMethod.configuracao.origin, undefined);
  assert.equal(publicShippingMethod({ ...method, configuracao: { ...method.configuracao, shippingAccountId: undefined, accountId: '10000000-0000-4000-8000-000000000102' }, shipping_account_ready: true }).quoteEnabled, true);
  assert.equal(shippingAccountReady({ id: '10000000-0000-4000-8000-000000000102', provider: 'melhorenvio', ativo: true, secret_ref: 'env:ME_ACCESS_TOKEN', public_config: { origemCep: '01001000', webhookSecretRef: 'env:ME_WEBHOOK_SECRET' } }), false);
  process.env.ME_ACCESS_TOKEN = 'token';
  process.env.ME_WEBHOOK_SECRET = 'secret';
  assert.equal(shippingAccountReady({ id: '10000000-0000-4000-8000-000000000102', provider: 'melhorenvio', ativo: true, secret_ref: 'env:ME_ACCESS_TOKEN', public_config: { origemCep: '01001000', webhookSecretRef: 'env:ME_WEBHOOK_SECRET' } }), true);
});

test('tracking preserva ocorrência e respeita transições válidas do fulfillment', async () => {
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  const statements = [];
  const trx = { query: async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('SELECT f.id, f.status, f.ocorrencias')) return { rows: [{ id: '10000000-0000-4000-8000-000000000107', status: 'ready', ocorrencias: [] }] };
    if (sql.includes('UPDATE commerce_fulfillments')) return { rows: [{ id: '10000000-0000-4000-8000-000000000107', status: 'shipped', tracking_code: 'BR123' }] };
    throw new Error(`query inesperada: ${sql}`);
  } };
  const updated = await updateShippingTracking(trx, { empresaId: '10000000-0000-4000-8000-000000000106' }, '10000000-0000-4000-8000-000000000107', { providerStatus: 'posted', trackingCode: 'BR123', trackingUrl: 'https://rastreio.test/BR123' }, storefrontId);
  assert.equal(updated.status, 'shipped');
  assert.equal(statements[1].sql.includes('status = $4'), true);
  assert.equal(statements.every(statement => statement.params.includes(storefrontId)), true);
});

test('cotação chama o provedor real fora da transação e persiste snapshot idempotente', async () => {
  process.env.ME_ACCESS_TOKEN = 'token';
  process.env.ME_WEBHOOK_SECRET = 'secret';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate');
    const body = JSON.parse(options.body);
    assert.equal(body.from.postal_code, '01001000');
    assert.equal(body.to.postal_code, '20040002');
    return new Response(JSON.stringify([{ id: 1, name: 'PAC', price: 25, delivery_time: 4, company: { name: 'Correios', id: 1 }, packages: [{ width: 10, height: 5, length: 20, weight: 0.5 }] }]), { status: 200 });
  };
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000101', codigo: 'melhorenvio', nome: 'Correios', tipo: 'delivery', configuracao: { provider: 'melhorenvio', shippingAccountId: '10000000-0000-4000-8000-000000000102', origemCep: '01001000' }, storefront_id: '10000000-0000-4000-8000-000000000103', loja_id: '10000000-0000-4000-8000-000000000104', configuracoes: {} }] };
      if (sql.includes('FROM commerce_shipping_accounts')) return { rows: [{ id: '10000000-0000-4000-8000-000000000102', storefront_id: '10000000-0000-4000-8000-000000000103', provider: 'melhorenvio', ambiente: 'sandbox', secret_ref: 'env:ME_ACCESS_TOKEN', public_config: { origemCep: '01001000', webhookSecretRef: 'env:ME_WEBHOOK_SECRET' }, ativo: true }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '10000000-0000-4000-8000-000000000105', sku: 'SKU-1', nome: 'Produto', peso_gramas: 500, largura_cm: 10, altura_cm: 5, comprimento_cm: 20, price: 39.9 }] };
      throw new Error(`query inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: { provider: 'melhorenvio', shippingAccountId: '10000000-0000-4000-8000-000000000102', origemCep: '01001000' } }] };
        if (sql.includes('SELECT id FROM commerce_shipping_accounts')) return { rows: [{ id: '10000000-0000-4000-8000-000000000102' }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) return { rows: [{ id: 'quote-1', expires_at: '2099-01-01T00:00:00.000Z' }] };
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  const result = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, { storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000101', destinationCep: '20040-002', items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 2 }] });
  assert.equal(result.quoteId, 'quote-1');
  assert.equal(result.provider, 'melhorenvio');
  assert.equal(result.items[0].amount, 25);
  assert.equal(queries.some(item => item.sql.includes('INSERT INTO commerce_shipping_quotes')), true);
});


test('conta Correios só fica pronta com token, origem e serviço contratado', () => {
  process.env.CORREIOS_API_TOKEN = 'correios-token';
  const base = { id: '10000000-0000-4000-8000-000000000108', provider: 'correios', ativo: true, secret_ref: 'env:CORREIOS_API_TOKEN', public_config: { origemCep: '01001000' } };
  assert.equal(shippingAccountReady(base), false);
  assert.equal(shippingAccountReady({ ...base, public_config: { origemCep: '01001000', services: ['03220'] } }), true);
  assert.equal(shippingAccountReady({ ...base, public_config: { origemCep: '01001000', services: ['03220'] }, ambiente: 'sandbox' }), true);
});

test('método manual habilita cotação sem conta externa e mantém regras internas fora do contrato público', () => {
  const method = { id: '10000000-0000-4000-8000-000000000109', codigo: 'kytto-regional', nome: 'Entrega regional Kytto', tipo: 'delivery', configuracao: { provider: 'manual', origemCep: '78300000', rules: [{ id: 'private-rule', amount: 99, cities: ['Cidade Interna'] }] } };
  const publicMethod = publicShippingMethod({ ...method, shipping_account_ready: false });
  assert.equal(publicMethod.quoteEnabled, true);
  assert.equal(publicMethod.provider, 'manual');
  assert.equal(publicMethod.configuracao.rules, undefined);
  assert.equal(publicMethod.configuracao.origin, undefined);
});

test('cotação manual usa cidade e persiste quote sem conta logística externa', async () => {
  fakePostal('78365000', 'Nova Olímpia', 'MT');
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000109', codigo: 'kytto-regional', nome: 'Entrega regional Kytto', tipo: 'delivery', configuracao: { provider: 'manual', deliveryType: 'regional_table', origemCep: '78300000', rules: [{ id: 'nova-olimpia', label: 'Nova Olímpia', cities: ['Nova Olímpia'], uf: 'MT', amount: 20, deliveryDays: 1 }] }, storefront_id: '10000000-0000-4000-8000-000000000103', loja_id: '10000000-0000-4000-8000-000000000104', configuracoes: {} }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '10000000-0000-4000-8000-000000000105', sku: 'SKU-1', nome: 'Produto', peso_gramas: 500, largura_cm: 10, altura_cm: 5, comprimento_cm: 20, price: 39.9 }] };
      throw new Error(`query inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: { provider: 'manual', deliveryType: 'regional_table', origemCep: '78300000', rules: [{ id: 'nova-olimpia', label: 'Nova Olímpia', cities: ['Nova Olímpia'], uf: 'MT', amount: 20, deliveryDays: 1 }] } }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) return { rows: [{ id: 'manual-quote-1', expires_at: '2099-01-01T00:00:00.000Z' }] };
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  const result = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, { storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000109', destinationCep: '78365000', destination: { cep: '78365000', cidade: 'Nova Olímpia', estado: 'MT' }, items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }] });
  assert.equal(result.quoteId, 'manual-quote-1');
  assert.equal(result.provider, 'manual');
  assert.equal(result.items[0].amount, 20);
  assert.equal(result.items[0].deliveryDays, 1);
  const insert = queries.find(item => item.sql.includes('INSERT INTO commerce_shipping_quotes'));
  assert.ok(insert);
  assert.equal(insert.params[1], '10000000-0000-4000-8000-000000000103');
  assert.equal(insert.params[2], '10000000-0000-4000-8000-000000000109');
  assert.equal(insert.params[3], null);
});

test('seleção aceita carrinho semanticamente igual com itens reordenados e cidade normalizada', async () => {
  fakePostal('78365000', 'Nova Olímpia', 'MT');
  const variantA = '10000000-0000-4000-8000-000000000105';
  const variantB = '10000000-0000-4000-8000-000000000106';
  let persisted;
  const client = {
    async query(sql, params) {
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000109', codigo: 'regional', nome: 'Regional', tipo: 'delivery', configuracao: { provider: 'manual', deliveryType: 'regional_table', origemCep: '78300000', rules: [{ id: 'regional', label: 'Regional', cities: ['Nova Olímpia'], uf: 'MT', amount: 20, deliveryDays: 1 }] }, storefront_id: '10000000-0000-4000-8000-000000000103', loja_id: '10000000-0000-4000-8000-000000000104', configuracoes: {} }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [
        { id: variantA, sku: 'SKU-A', nome: 'Produto A', peso_gramas: 0, largura_cm: 0, altura_cm: 0, comprimento_cm: 0, price: 10 },
        { id: variantB, sku: 'SKU-B', nome: 'Produto B', peso_gramas: 0, largura_cm: 0, altura_cm: 0, comprimento_cm: 0, price: 5 },
      ] };
      throw new Error(`query inesperada: ${sql} ${params}`);
    },
    async transaction(callback) {
      return callback({ query: async (sql, params) => {
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: { provider: 'manual', deliveryType: 'regional_table', origemCep: '78300000', rules: [{ id: 'regional', label: 'Regional', cities: ['Nova Olímpia'], uf: 'MT', amount: 20, deliveryDays: 1 }] } }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) {
          persisted = { hash: params[8], snapshot: JSON.parse(params[9]), response: JSON.parse(params[10]) };
          return { rows: [{ id: '10000000-0000-4000-8000-000000000199', expires_at: '2099-01-01T00:00:00.000Z' }] };
        }
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  const quote = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000110', lojaId: '10000000-0000-4000-8000-000000000104' }, {
    storefrontId: '10000000-0000-4000-8000-000000000103',
    shippingMethodId: '10000000-0000-4000-8000-000000000109',
    destinationCep: '78365-000',
    destination: { cidade: 'Nova Olímpia', estado: 'mt' },
    items: [{ variantId: variantB, quantity: 1 }, { variantId: variantA, quantity: 1 }, { variantId: variantA, quantity: 1 }],
  });
  assert.deepEqual(persisted.snapshot.lines, [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }]);
  assert.equal(persisted.snapshot.destination.cidade, 'nova olimpia');
  const optionId = persisted.response.providerOptions[0].public.id;
  const trx = { query: async sql => {
    if (sql.includes('FROM commerce_shipping_quotes q')) return { rows: [{ id: quote.quoteId, storefront_id: persisted.snapshot.storefrontId, shipping_method_id: persisted.snapshot.shippingMethodId, request_hash: persisted.hash, request_snapshot: persisted.snapshot, response_snapshot: persisted.response, current_method_config: { provider: 'manual', deliveryType: 'regional_table', origemCep: '78300000', rules: [{ id: 'regional', label: 'Regional', cities: ['Nova Olímpia'], uf: 'MT', amount: 20, deliveryDays: 1 }] }, status: 'quoted', expires_at: '2099-01-01T00:00:00.000Z' }] };
    if (sql.includes('UPDATE commerce_shipping_quotes')) return { rows: [] };
    throw new Error(`query inesperada: ${sql}`);
  } };
  const selected = await resolveShippingSelection(trx, { empresaId: '10000000-0000-4000-8000-000000000110' }, {
    shippingQuoteId: quote.quoteId,
    shippingOptionId: optionId,
    shippingAddress: { destinatario: 'Cliente', documento: '12345678909', cep: '78365000', logradouro: 'Rua A', numero: '1', bairro: 'Centro', cidade: '  NOVA   OLIMPIA ', estado: 'MT' },
  }, { storefrontId: persisted.snapshot.storefrontId, shippingMethodId: persisted.snapshot.shippingMethodId, lines: [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }] });
  assert.equal(selected.amount, 20);
  assert.equal(selected.address.cidade, 'NOVA   OLIMPIA');
});

test('entrega própria calcula motoboy, expressa e frete grátis sem depender de Correios', async () => {
  fakePostal('01001000', 'São Paulo', 'SP');
  let methodConfig = { provider: 'manual', deliveryType: 'motoboy', baseFee: 5, pricePerKm: 2, distanceKm: 3, deliveryDays: 1, rules: [{ id: 'local', label: 'Local', fallback: true, deliveryDays: 1 }] };
  const client = {
    async query(sql) {
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000119', codigo: 'entrega-propria', nome: 'Entrega própria', tipo: 'delivery', configuracao: methodConfig, storefront_id: '10000000-0000-4000-8000-000000000103', loja_id: '10000000-0000-4000-8000-000000000104' }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '10000000-0000-4000-8000-000000000105', sku: 'SKU-1', nome: 'Produto', peso_gramas: 500, largura_cm: 10, altura_cm: 5, comprimento_cm: 20, price: 39.9 }] };
      throw new Error(`query inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ query: async sql => {
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: methodConfig }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) return { rows: [{ id: 'own-quote-1', expires_at: '2099-01-01T00:00:00.000Z' }] };
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  const baseInput = { storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000119', destinationCep: '01001000', destination: { cep: '01001000', cidade: 'São Paulo', estado: 'SP' }, items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 2 }] };
  let result = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, baseInput);
  assert.equal(result.items[0].amount, 11);
  assert.equal(result.items[0].carrier, 'Motoboy local');
  assert.equal(result.items[0].deliveryType, 'motoboy');
  methodConfig = { provider: 'manual', deliveryType: 'express', fixedFee: 19.9, deliveryDays: 1 };
  result = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, baseInput);
  assert.equal(result.items[0].amount, 19.9);
  assert.equal(result.items[0].carrier, 'Kytto Express');
  methodConfig = { provider: 'manual', deliveryType: 'motoboy', baseFee: 12, freeShippingAbove: 70, deliveryDays: 2, rules: [{ id: 'local', label: 'Local', fallback: true, deliveryDays: 2 }] };
  result = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, baseInput);
  assert.equal(result.items[0].amount, 0);
  assert.equal(result.items[0].freeShippingApplied, true);
});

test('mudança de limiar após o cálculo bloqueia quote nova sem INSERT', async () => {
  const original = { provider: 'manual', deliveryType: 'motoboy', baseFee: 8, freeShippingAbove: 1000, deliveryDays: 1, rules: [{ id: 'local', label: 'Local', cepFrom: '78300000', cepTo: '78309999', zone: 1 }] };
  let inserts = 0;
  const client = {
    async query(sql) {
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000109', tipo: 'delivery', configuracao: original, storefront_id: '10000000-0000-4000-8000-000000000103', loja_id: '10000000-0000-4000-8000-000000000104' }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '10000000-0000-4000-8000-000000000105', sku: 'SKU', nome: 'Teste', peso_gramas: null, largura_cm: null, altura_cm: null, comprimento_cm: null, price: 1000 }] };
      throw new Error(`query inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ async query(sql) {
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: { ...original, freeShippingAbove: 1200 } }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) inserts += 1;
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  await assert.rejects(() => quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106' }, {
    storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000109',
    destinationCep: '78300055', destination: { cep: '78300055', cidade: 'Tangará da Serra', estado: 'MT' },
    items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }],
  }), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
  assert.equal(inserts, 0);
});

test('normaliza faixas próprias com zonas e regiões e rejeita configurações ambíguas', () => {
  const config = normalizeOwnDeliveryConfig({ provider: 'manual', deliveryType: 'motoboy', baseFee: 5, pricePerZone: 8, rules: [{ id: 'zona-2', label: 'Zona 2', region: 'Centro-Oeste', ufs: 'MT, GO', cepFrom: '78000-000', cepTo: '78999-999', zone: 2, deliveryDays: 1 }] });
  assert.equal(config.pricePerZone, 8);
  assert.deepEqual(config.rules[0].ufs, ['MT', 'GO']);
  assert.deepEqual(config.rules[0].regions, ['centro-oeste']);
  assert.equal(config.rules[0].cepFrom, '78000000');
  assert.throws(() => normalizeOwnDeliveryConfig({ provider: 'manual', deliveryType: 'regional_table', rules: [] }), error => error.code === 'SHIPPING_METHOD_CONFIG_INVALID');
  assert.throws(() => normalizeOwnDeliveryConfig({ provider: 'manual', deliveryType: 'free_shipping', freeShippingAbove: 0 }), error => error.code === 'SHIPPING_METHOD_CONFIG_INVALID');
  assert.throws(() => normalizeOwnDeliveryConfig({ provider: 'manual', deliveryType: 'regional_table', rules: [{ id: 'invertida', label: 'Inválida', cepFrom: '79000000', cepTo: '78000000' }] }), error => error.code === 'SHIPPING_METHOD_CONFIG_INVALID');
});

test('cotação agregada retorna somente métodos aplicáveis e preserva quoteId por opção', async () => {
  fakePostal('78300055', 'Tangará da Serra', 'MT');
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  const motoboyId = '10000000-0000-4000-8000-000000000119';
  const freeId = '10000000-0000-4000-8000-000000000120';
  let inserts = 0;
  let lastMethodConfig;
  const client = {
    async query(sql, params) {
      if (sql.includes('SELECT id, codigo, nome') && sql.includes('commerce_shipping_methods')) return { rows: [{ id: motoboyId, codigo: 'motoboy', nome: 'Motoboy' }, { id: freeId, codigo: 'gratis', nome: 'Frete grátis' }] };
      if (sql.includes('SELECT sm.id') && sql.includes('commerce_shipping_methods')) {
        const config = params[2] === motoboyId
          ? { provider: 'manual', deliveryType: 'motoboy', baseFee: 5, pricePerZone: 8, rules: [{ id: 'zona-2', label: 'Zona 2', ufs: ['MT'], zone: 2, deliveryDays: 1 }] }
          : { provider: 'manual', deliveryType: 'free_shipping', freeShippingAbove: 100, deliveryDays: 5 };
        lastMethodConfig = config;
        return { rows: [{ id: params[2], codigo: params[2] === motoboyId ? 'motoboy' : 'gratis', nome: 'Entrega', tipo: 'delivery', configuracao: config, storefront_id: storefrontId, loja_id: '10000000-0000-4000-8000-000000000104', configuracoes: {} }] };
      }
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: '10000000-0000-4000-8000-000000000105', sku: 'SKU-1', nome: 'Produto', peso_gramas: 0, largura_cm: 0, altura_cm: 0, comprimento_cm: 0, price: 39.9 }] };
      throw new Error(`query inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ query: async sql => {
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: lastMethodConfig }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) { inserts += 1; return { rows: [{ id: `10000000-0000-4000-8000-${String(inserts).padStart(12, '0')}`, expires_at: '2099-01-01T00:00:00.000Z' }] }; }
        throw new Error(`query transacional inesperada: ${sql}`);
      } });
    },
  };
  const result = await quoteAvailableShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106', lojaId: '10000000-0000-4000-8000-000000000104' }, { storefrontId, destinationCep: '78300055', destination: { cep: '78300055', cidade: 'Tangará da Serra', estado: 'MT' }, items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }] });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amount, 21);
  assert.equal(result.items[0].shippingMethodId, motoboyId);
  assert.match(result.items[0].selectionId, new RegExp(`:${result.items[0].id}$`));
  assert.deepEqual(result.unavailable, [{ shippingMethodId: freeId, code: 'SHIPPING_FREE_SHIPPING_THRESHOLD_NOT_MET' }]);
  assert.equal(inserts, 1);
});

test('tabela sintética de R$42 fora de MT exige UF real do CEP e não anuncia MT', async () => {
  const otherUfs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  assert.equal(otherUfs.length, 26);
  const config = normalizeOwnDeliveryConfig({ deliveryType: 'regional_table', rules: [{ id: 'outside-mt', label: 'Fora de MT (simulação sem transportadora)', ufs: otherUfs, amount: 42, deliveryDays: 10 }] });
  const methodId = '10000000-0000-4000-8000-000000000109';
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  const variantId = '10000000-0000-4000-8000-000000000105';
  let inserts = 0;
  const client = {
    async query(sql) {
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: methodId, tipo: 'delivery', configuracao: config, storefront_id: storefrontId, loja_id: null, configuracoes: {} }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: variantId, sku: 'SKU-SINTETICO', nome: 'Teste', peso_gramas: null, largura_cm: null, altura_cm: null, comprimento_cm: null, price: 10 }] };
      throw new Error(`consulta inesperada: ${sql}`);
    },
    async transaction(callback) {
      return callback({ async query(sql) {
        if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: config }] };
        if (sql.includes('INSERT INTO commerce_shipping_quotes')) { inserts += 1; return { rows: [{ id: '10000000-0000-4000-8000-000000000198', expires_at: '2099-01-01T00:00:00Z' }] }; }
        throw new Error(`consulta transacional inesperada: ${sql}`);
      } });
    },
  };
  const quote = (cep, cidade, estado) => quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106' }, {
    storefrontId, shippingMethodId: methodId, destinationCep: cep, destination: { cep, cidade, estado }, items: [{ variantId, quantity: 1 }],
  });
  fakePostal('18715106', 'Arandu', 'SP');
  await assert.rejects(() => quote('18715106', 'Arandu', 'MT'), error => error.code === 'SHIPPING_CEP_MISMATCH');
  assert.equal(inserts, 0);
  const allowed = await quote('18715106', 'Arandu', 'SP');
  assert.equal(allowed.items[0].amount, 42);
  assert.equal(inserts, 1);
  fakePostal('78300055', 'Tangará da Serra', 'MT');
  await assert.rejects(() => quote('78300055', 'Tangará da Serra', 'MT'), error => error.code === 'SHIPPING_DESTINATION_UNAVAILABLE');
  assert.equal(inserts, 1);
});

test('Dino bloqueia tarifa manual nacional mesmo com regra R$42 ativa por engano, sem DML', async () => {
  fakePostal('18715106', 'Arandu', 'SP');
  let config = normalizeOwnDeliveryConfig({ deliveryType: 'regional_table', rules: [{ id: 'outside-mt', label: 'Fora de MT', ufs: ['SP'], amount: 42, deliveryDays: 10 }] });
  let variantsRead = 0;
  let transactions = 0;
  const client = {
    async query(sql) {
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: '10000000-0000-4000-8000-000000000109', tipo: 'delivery', configuracao: config, storefront_id: '10000000-0000-4000-8000-000000000103', storefront_code: 'dino-web', loja_id: null, configuracoes: {} }] };
      if (sql.includes('FROM commerce_product_variants')) variantsRead += 1;
      throw new Error(`consulta inesperada: ${sql}`);
    },
    async transaction() { transactions += 1; throw new Error('nenhuma cotação pode ser persistida'); },
  };
  await assert.rejects(() => quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106' }, {
    storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000109', destinationCep: '18715106',
    destination: { cep: '18715106', cidade: 'Arandu', estado: 'SP' }, items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }],
  }), error => error.code === 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  assert.equal(variantsRead, 0);
  assert.equal(transactions, 0);
  config = normalizeOwnDeliveryConfig({ deliveryType: 'regional_table', rules: [{ id: 'cep-only', label: 'CEP simulado fora MT', cepFrom: '01001000', cepTo: '01001000', amount: 42, deliveryDays: 10 }] });
  await assert.rejects(() => quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106' }, {
    storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000109', destinationCep: '01001000',
    destination: { cep: '01001000', cidade: 'Tangará da Serra', estado: 'MT' }, destinationCity: 'Tangará da Serra', destinationState: 'MT',
    items: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }],
  }), error => error.code === 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  assert.equal(variantsRead, 0);
  assert.equal(transactions, 0);
});

test('motoboy Dino conserva cotação apenas na faixa local mesmo com provedor postal indisponível', async () => {
  global.fetch = async () => { throw new Error('consulta postal indisponível'); };
  const config = normalizeOwnDeliveryConfig({ deliveryType: 'motoboy', baseFee: 8, pricePerZone: 5, freeShippingAbove: 1000, rules: [{ id: 'local', label: 'Motoboy local', cepFrom: '78300000', cepTo: '78309999', zone: 1, deliveryDays: 1 }] });
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  const methodId = '10000000-0000-4000-8000-000000000109';
  const variantId = '10000000-0000-4000-8000-000000000105';
  let inserts = 0;
  let methodCode = 'dino-motoboy';
  const client = {
    async query(sql) {
      if (sql.includes('FROM commerce_shipping_methods')) return { rows: [{ id: methodId, codigo: methodCode, tipo: 'delivery', configuracao: config, storefront_id: storefrontId, storefront_code: 'dino-web', loja_id: null, configuracoes: {} }] };
      if (sql.includes('FROM commerce_product_variants')) return { rows: [{ id: variantId, sku: 'SKU-TESTE', nome: 'Teste', peso_gramas: null, largura_cm: null, altura_cm: null, comprimento_cm: null, price: 30 }] };
      throw new Error(`consulta inesperada: ${sql}`);
    },
    async transaction(callback) { return callback({ async query(sql) {
      if (sql.includes('SELECT configuracao FROM commerce_shipping_methods')) return { rows: [{ configuracao: config }] };
      if (sql.includes('INSERT INTO commerce_shipping_quotes')) { inserts += 1; return { rows: [{ id: '10000000-0000-4000-8000-000000000199', expires_at: '2099-01-01T00:00:00Z' }] }; }
      throw new Error(`consulta transacional inesperada: ${sql}`);
    } }); },
  };
  const quoteInput = { storefrontId, shippingMethodId: methodId, destinationCep: '78300055', destination: { cidade: 'Tangará da Serra', estado: 'MT' }, items: [{ variantId, quantity: 1 }] };
  const local = await quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106' }, quoteInput);
  assert.equal(local.items[0].amount, 13);
  assert.equal(inserts, 1);
  methodCode = 'dino-regional';
  await assert.rejects(() => quoteShipping(client, { empresaId: '10000000-0000-4000-8000-000000000106' }, quoteInput), error => error.code === 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  assert.equal(inserts, 1);
});

test('falha local pós-side-effect exige reconciliação e nunca duplica emissão da etiqueta', async () => {
  const provider = 'melhorenvio';
  const originalAdapter = shippingProviders.get(provider);
  const empresaId = '10000000-0000-4000-8000-000000000106';
  const fulfillmentId = '10000000-0000-4000-8000-000000000107';
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  process.env.FAKE_LABEL_TOKEN = 'fake-token';
  let emissions = 0;
  let state = { shipping_operation_status: null, shipping_operation_key: null, ocorrencias: [] };
  shippingProviders.register(provider, {
    quote: async () => ({ options: [], providerOptions: [] }),
    createShipment: async ({ idempotencyKey }) => { emissions += 1; return { providerShipmentId: `shipment-${idempotencyKey}`, trackingCode: 'FAKE123' }; },
    track: async () => ({}),
    verifyWebhook: async () => ({}),
  });
  let transactionNumber = 0;
  const transaction = async callback => {
    transactionNumber += 1;
    const thisTransaction = transactionNumber;
    return callback({ query: async (sql, params = []) => {
      if (sql.includes('FROM commerce_fulfillments f')) return { rows: [{
        id: fulfillmentId, empresa_id: empresaId, order_id: '10000000-0000-4000-8000-000000000108', public_code: 'KC-FAKE', order_status: 'paid', shipping_type: 'delivery',
        shipping_operation_status: state.shipping_operation_status, shipping_operation_key: state.shipping_operation_key, provider_shipment_id: null, ocorrencias: state.ocorrencias,
        account_id: '10000000-0000-4000-8000-000000000109', account_provider: provider, account_environment: 'sandbox', account_active: true, secret_ref: 'env:FAKE_LABEL_TOKEN',
        public_config: { origemCep: '01001000', origin: { name: 'Loja', email: 'loja@example.com', phone: '11999999999', document: '12345678909', address: 'Rua A', number: '1', district: 'Centro', city: 'São Paulo', postalCode: '01001000', stateAbbr: 'SP' } },
        selected_option_id: 'fake-service', response_snapshot: { providerOptions: [{ public: { id: 'fake-service', carrier: 'Fake' }, raw: {} }] }, endereco_entrega: { destinatario: 'Cliente', cep: '01001000', logradouro: 'Rua B', numero: '2', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' },
      }] };
      if (sql.includes('FROM commerce_order_items')) return { rows: [{ nome_snapshot: 'Produto', quantidade: 1, preco_unitario: '10.00' }] };
      if (sql.includes("shipping_operation_status = 'processing'")) { state = { ...state, shipping_operation_status: 'processing', shipping_operation_key: params[2] }; return { rows: [] }; }
      if (sql.includes('SELECT id, ocorrencias FROM commerce_fulfillments')) {
        if (thisTransaction === 2) throw new Error('falha simulada ao persistir resposta do provedor');
        return { rows: [{ id: fulfillmentId, ocorrencias: state.ocorrencias }] };
      }
      if (sql.includes('SELECT ocorrencias FROM commerce_fulfillments')) return { rows: [{ ocorrencias: state.ocorrencias }] };
      if (sql.includes("shipping_operation_status = 'failed'")) { state = { ...state, shipping_operation_status: 'failed', ocorrencias: JSON.parse(params[2]) }; return { rows: [{ id: fulfillmentId, ...state }] }; }
      throw new Error(`query inesperada: ${sql}`);
    } });
  };
  try {
    await assert.rejects(
      () => issueShippingLabel(transaction, { empresaId }, fulfillmentId, {}, storefrontId),
      error => error.code === 'SHIPPING_OPERATION_RECONCILIATION_REQUIRED' && error.details.operationKey === `shipping-${fulfillmentId}-create`,
    );
    assert.equal(emissions, 1);
    assert.equal(state.shipping_operation_status, 'failed');
    await assert.rejects(
      () => issueShippingLabel(transaction, { empresaId }, fulfillmentId, {}, storefrontId),
      error => error.code === 'SHIPPING_OPERATION_RECONCILIATION_REQUIRED',
    );
    assert.equal(emissions, 1);
  } finally {
    shippingProviders.adapters.set(provider, originalAdapter);
    delete process.env.FAKE_LABEL_TOKEN;
  }
});

test('reconciliação manual conclui etiqueta incerta uma vez e rejeita identificador divergente', async () => {
  const fulfillmentId = '10000000-0000-4000-8000-000000000107';
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  const operationKey = `shipping-${fulfillmentId}-create`;
  let updates = 0;
  let state = { id: fulfillmentId, storefront_id: '10000000-0000-4000-8000-000000000103', shipping_operation_status: 'failed', shipping_operation_key: operationKey, provider_shipment_id: null, ocorrencias: [] };
  const trx = { query: async (sql, params = []) => {
    if (sql.includes('FROM commerce_fulfillments f')) return { rows: [state] };
    if (sql.includes('UPDATE commerce_fulfillments')) {
      updates += 1;
      state = { ...state, shipping_operation_status: 'succeeded', provider_shipment_id: params[3], tracking_code: params[4], ocorrencias: JSON.parse(params[8]) };
      return { rows: [state] };
    }
    throw new Error(`query inesperada: ${sql}`);
  } };
  const first = await reconcileShippingLabel(trx, { empresaId: '10000000-0000-4000-8000-000000000106' }, fulfillmentId, { operationKey, providerShipmentId: 'provider-shipment-1', trackingCode: 'FAKE123' }, storefrontId);
  assert.equal(first.replay, false);
  assert.equal(first.fulfillment.provider_shipment_id, 'provider-shipment-1');
  assert.equal(first.fulfillment.ocorrencias.at(-1).status, 'shipping_reconciled');
  const replay = await reconcileShippingLabel(trx, { empresaId: '10000000-0000-4000-8000-000000000106' }, fulfillmentId, { operationKey, providerShipmentId: 'provider-shipment-1' }, storefrontId);
  assert.equal(replay.replay, true);
  assert.equal(updates, 1);
  await assert.rejects(
    () => reconcileShippingLabel(trx, { empresaId: '10000000-0000-4000-8000-000000000106' }, fulfillmentId, { operationKey, providerShipmentId: 'provider-shipment-2' }, storefrontId),
    error => error.code === 'SHIPPING_OPERATION_CONFLICT',
  );
  assert.equal(updates, 1);
});

test('checkout recusa quote de método desativado ou diferente antes de qualquer DML', async () => {
  const tenantId = '10000000-0000-4000-8000-000000000106';
  const storefrontId = '10000000-0000-4000-8000-000000000103';
  const shippingMethodId = '10000000-0000-4000-8000-000000000109';
  const quoteId = '10000000-0000-4000-8000-000000000110';
  let queries = 0;
  const trx = { async query(sql, params) {
    queries += 1;
    assert.match(sql, /JOIN commerce_shipping_methods sm/);
    assert.match(sql, /sm\.ativo = true/);
    assert.match(sql, /sm\.id = \$4/);
    assert.match(sql, /FOR UPDATE OF q, sm/);
    assert.deepEqual(params, [tenantId, quoteId, storefrontId, shippingMethodId]);
    return { rows: [] };
  } };
  await assert.rejects(() => resolveShippingSelection(trx, { empresaId: tenantId }, {
    shippingQuoteId: quoteId, shippingOptionId: 'regional:mt',
    shippingAddress: { destinatario: 'Teste', documento: '12345678909', cep: '78300055', logradouro: 'Rua', numero: '1', bairro: 'Centro', cidade: 'Tangará da Serra', estado: 'MT' },
  }, { storefrontId, shippingMethodId, lines: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }] }), error => error.code === 'SHIPPING_QUOTE_EXPIRED');
  assert.equal(queries, 1);
});

test('Dino rejeita quote manual pré-existente para SP sem selecionar opção nem fazer DML', async () => {
  let calls = 0;
  const trx = { async query(sql) {
    calls += 1;
    assert.match(sql, /FROM commerce_shipping_quotes q/);
    return { rows: [{ id: '10000000-0000-4000-8000-000000000110', storefront_code: 'dino-web', provider: 'manual' }] };
  } };
  await assert.rejects(() => resolveShippingSelection(trx, { empresaId: '10000000-0000-4000-8000-000000000106' }, {
    shippingQuoteId: '10000000-0000-4000-8000-000000000110', shippingOptionId: 'regional:outside-mt',
    shippingAddress: { destinatario: 'Fixture', documento: '12345678909', cep: '18715106', logradouro: 'Rua fictícia', numero: '1', bairro: 'Centro', cidade: 'Arandu', estado: 'SP' },
  }, { storefrontId: '10000000-0000-4000-8000-000000000103', shippingMethodId: '10000000-0000-4000-8000-000000000109', lines: [{ variantId: '10000000-0000-4000-8000-000000000105', quantity: 1 }] }), error => error.code === 'SHIPPING_NATIONAL_FULFILLMENT_NOT_READY');
  assert.equal(calls, 1);
});
