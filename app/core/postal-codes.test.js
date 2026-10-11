import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostalCodeLookup, POSTAL_PROVIDERS, ufForCep } from './postal-codes.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Respostas reais observadas em 11/10/2026 para o CEP geral de Tangará da Serra.
function tangaraFetch(url) {
  if (url.includes('viacep')) return json({ erro: 'true' });
  if (url.includes('opencep')) return json({ cep: '78300-000', logradouro: '', bairro: '', localidade: 'Tangará da Serra', uf: 'MT', ibge: '5107958' });
  if (url.includes('brasilapi')) return json({ cep: '78300000', state: 'MT', city: 'Tangará da Serra', neighborhood: null, street: null, ibge: { city: '5107958' } });
  if (url.includes('awesomeapi')) return json({ cep: '78300000', state: 'MT', city: 'Tangará da Serra', address: '', district: '' });
  throw new Error(`url inesperada ${url}`);
}

function memoryStore() {
  const rows = new Map();
  return { rows, async get(cep) { return rows.get(cep) || null; }, async set(address) { rows.set(address.cep, { address, updatedAt: new Date().toISOString() }); } };
}

test('faixas oficiais: cada CEP pertence a uma UF', () => {
  assert.equal(ufForCep('78300000'), 'MT');
  assert.equal(ufForCep('01310100'), 'SP');
  assert.equal(ufForCep('69900000'), 'AC');
  assert.equal(ufForCep('69300000'), 'RR');
  assert.equal(ufForCep('70040010'), 'DF');
  assert.equal(ufForCep('74000000'), 'GO');
  assert.equal(ufForCep('00000000'), null);
  assert.equal(ufForCep('123'), null);
});

test('CEP que o ViaCEP não conhece é encontrado nas outras fontes', async () => {
  const store = memoryStore();
  const lookup = createPostalCodeLookup({ fetchImpl: async url => tangaraFetch(url), store });
  const address = await lookup('78300000');
  assert.equal(address.cidade, 'Tangará da Serra');
  assert.equal(address.estado, 'MT');
  assert.notEqual(address.fonte, 'viacep');
  assert.equal(store.rows.has('78300000'), true, 'CEP confirmado fica no cache permanente');
});

test('com todas as fontes fora do ar, o CEP já confirmado continua respondendo', async () => {
  const store = memoryStore();
  await store.set({ cep: '78306028', logradouro: 'Avenida Brasil', bairro: 'Jardim Rio Preto', cidade: 'Tangará da Serra', estado: 'MT', ibge: '5107958', fonte: 'viacep' });
  store.rows.get('78306028').updatedAt = '2020-01-01T00:00:00Z';
  const lookup = createPostalCodeLookup({ fetchImpl: async () => { throw new Error('fora do ar'); }, store });
  const address = await lookup('78306028');
  assert.equal(address.cidade, 'Tangará da Serra');
  assert.equal(address.fonte, 'cache');
});

test('cache recente responde sem consultar as fontes', async () => {
  const store = memoryStore();
  await store.set({ cep: '01310100', cidade: 'São Paulo', estado: 'SP', fonte: 'viacep' });
  let calls = 0;
  const lookup = createPostalCodeLookup({ fetchImpl: async () => { calls += 1; throw new Error('não deveria consultar'); }, store });
  assert.equal((await lookup('01310100')).cidade, 'São Paulo');
  assert.equal(calls, 0);
});

test('só afirma "CEP não encontrado" quando todas as fontes desconhecem o CEP', async () => {
  const notFound = async url => {
    if (url.includes('viacep')) return json({ erro: 'true' });
    if (url.includes('opencep')) return json({ error: true }, 404);
    if (url.includes('brasilapi')) return json({ type: 'service_error', message: 'Todos os serviços de CEP retornaram erro.' }, 404);
    return json({ code: 'not_found' }, 404);
  };
  await assert.rejects(createPostalCodeLookup({ fetchImpl: notFound })('78395000'), error => error.code === 'SHIPPING_CEP_NOT_FOUND');
  await assert.rejects(createPostalCodeLookup({ fetchImpl: notFound })('00000000'), error => error.code === 'SHIPPING_CEP_NOT_FOUND');
  const partial = async url => (url.includes('viacep') ? json({ erro: 'true' }) : Promise.reject(new Error('fora do ar')));
  await assert.rejects(createPostalCodeLookup({ fetchImpl: partial })('78300000'), error => error.code === 'SHIPPING_CEP_PROVIDER_ERROR');
  await assert.rejects(createPostalCodeLookup({ fetchImpl: async () => { throw new Error('rede'); } })('78300000'), error => error.code === 'SHIPPING_CEP_PROVIDER_ERROR');
});

test('resposta com UF fora da faixa oficial do CEP é descartada', async () => {
  const wrongUf = async url => (url.includes('viacep') ? json({ localidade: 'São Paulo', uf: 'SP' }) : json({ erro: true }, 404));
  await assert.rejects(createPostalCodeLookup({ fetchImpl: wrongUf, providers: POSTAL_PROVIDERS.slice(0, 1) })('78300000'), error => error.code === 'SHIPPING_CEP_PROVIDER_ERROR');
});

test('falha do cache não impede a consulta', async () => {
  const brokenStore = { async get() { throw new Error('banco indisponível'); }, async set() { throw new Error('banco indisponível'); } };
  const address = await createPostalCodeLookup({ fetchImpl: async url => tangaraFetch(url), store: brokenStore })('78300000');
  assert.equal(address.estado, 'MT');
});
