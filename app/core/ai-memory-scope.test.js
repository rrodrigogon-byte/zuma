import assert from 'node:assert/strict';
import test from 'node:test';
import { customerMemory, forgetCustomer, searchCustomerMemory, setFactStatus } from './ai-memory.js';
import { db } from './database.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const FACT = '44444444-4444-4444-8444-444444444444';
const PHONE = '5565999990001';

function restore(entries) {
  for (const [key, value] of entries) db[key] = value;
}

test('leitura e busca de memória filtram resumos e fatos pela loja ativa', async () => {
  const previous = [['queryRead', db.queryRead]];
  const calls = [];
  db.queryRead = async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; };
  try {
    await customerMemory(COMPANY, PHONE, { lojaId: STORE });
    await searchCustomerMemory(COMPANY, PHONE, 'preferência', { lojaId: STORE });
    assert.equal(calls.length, 3);
    assert.match(calls[0].sql, /s\.loja_id = \$3/);
    assert.match(calls[1].sql, /s\.loja_id = \$3/);
    assert.match(calls[2].sql, /loja_id = \$4/);
    assert.deepEqual([calls[0].params[2], calls[1].params[2], calls[2].params[3]], [STORE, STORE, STORE]);
    assert.equal(calls[1].params[3], 10, 'o limite de resumos permanece independente da loja');
  } finally { restore(previous); }
});

test('edição de fato exige fonte vinculada a resumo da loja ativa', async () => {
  const previous = [['query', db.query]];
  let call;
  db.query = async (sql, params) => {
    call = { sql, params };
    return { rows: [{ id: FACT, chave: 'preferencia', valor: 'Produto', categoria: 'outro', confianca: 0.9, status: 'ativo' }] };
  };
  try {
    const fact = await setFactStatus(COMPANY, FACT, 'contestado', 'teste', STORE);
    assert.equal(fact.id, FACT);
    assert.match(call.sql, /EXISTS \(/);
    assert.match(call.sql, /s\.loja_id = \$5/);
    assert.equal(call.params[4], STORE);
  } finally { restore(previous); }
});

test('esquecimento iniciado na loja só remove conteúdo, fila e sessões daquela loja', async () => {
  const previous = [['transaction', db.transaction]];
  const calls = [];
  db.transaction = async (run) => run({ query: async (sql, params) => {
    calls.push({ sql, params });
    return { rowCount: 1 };
  } });
  try {
    const result = await forgetCustomer(COMPANY, PHONE, { lojaId: STORE });
    assert.equal(result.escopo, 'loja');
    assert.equal(calls.length, 5);
    for (const call of calls) assert.ok(call.params.includes(STORE), call.sql);
    assert.match(calls[0].sql, /s\.loja_id = \$3/);
    assert.match(calls[1].sql, /s\.loja_id = \$3/);
    assert.match(calls[2].sql, /loja_id = \$3/);
    assert.match(calls[3].sql, /loja_id = \$2/);
    assert.match(calls[4].sql, /loja_id = \$2/);
  } finally { restore(previous); }
});
