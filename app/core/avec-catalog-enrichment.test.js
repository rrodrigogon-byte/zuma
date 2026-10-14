import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeAvecCatalogEnrichment,
  previewAvecCatalogEnrichment,
  AVEC_ENRICHMENT_MODE,
} from './avec-catalog-enrichment.js';

const SCOPE = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  usuarioId: '33333333-3333-4333-8333-333333333333',
};
const IDS = {
  storefrontId: '44444444-4444-4444-8444-444444444444',
  locationId: '55555555-5555-4555-8555-555555555555',
  productId: '66666666-6666-4666-8666-666666666666',
  variantId: '77777777-7777-4777-8777-777777777777',
  channelId: '88888888-8888-4888-8888-888888888888',
  priceListId: '99999999-9999-4999-8999-999999999999',
  priceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const baseItem = {
  sourceId: 'AVEC-001', sku: 'DINO-001', unidade: 'UN', custo: '12,34',
  ean: '7891234567895', ncm: '33049990',
};
const baseInput = (items = [baseItem], extra = {}) => ({
  source: 'avec', storefrontId: IDS.storefrontId, locationId: IDS.locationId, items, ...extra,
});
const context = { ...SCOPE, capabilities: ['reports.read', 'catalog.write'] };

function mappedRow(overrides = {}) {
  return {
    variant_id: IDS.variantId,
    product_id: IDS.productId,
    sku: 'DINO-001',
    barcode: '7890000000000',
    unit: 'UN',
    ncm: '33049910',
    source_id: 'AVEC-001',
    link_loja_id: SCOPE.lojaId,
    variant_count: 1,
    channel_count: 1,
    price_list_count: 1,
    has_outside_channel: false,
    channel_id: IDS.channelId,
    price_list_id: IDS.priceListId,
    current_price_count: 1,
    current_price_ids: [IDS.priceId],
    cost_cents: 1000,
    ...overrides,
  };
}

function classifyQuery(sql) {
  if (sql.includes('FROM commerce_memberships')) return 'permissions';
  if (sql.includes('FROM commerce_legacy_imports') && sql.includes('FOR UPDATE')) return 'lockLedger';
  if (sql.includes('SELECT id, empresa_id, loja_id, status')) return 'storefront';
  if (sql.includes('SELECT id, empresa_id, loja_id, ativo')) return 'location';
  if (sql.includes('loja_count')) return 'scopeCounts';
  if (sql.includes('WITH variant_shape')) return 'candidates';
  if (sql.includes('GROUP BY barcode')) return 'barcode';
  if (sql.includes('SELECT pg_advisory_xact_lock')) return 'advisory';
  if (sql.includes('SELECT request_hash')) return 'idemRead';
  if (sql.includes('INSERT INTO commerce_idempotency_keys')) return 'idemInsert';
  if (sql.includes('UPDATE commerce_idempotency_keys')) return 'idemUpdate';
  if (sql.includes('INSERT INTO commerce_audit_logs')) return 'audit';
  if (sql.includes('UPDATE commerce_variant_prices')) return 'cost';
  if (sql.includes('UPDATE commerce_product_variants')) return 'barcodeUpdate';
  if (sql.includes('UPDATE commerce_products')) return 'ncm';
  if (sql.includes('FROM commerce_products')) return 'lockProduct';
  if (sql.includes('FROM commerce_product_variants')) return 'lockVariant';
  if (sql.includes('FROM commerce_product_channels')) return 'lockChannel';
  if (sql.includes('FROM commerce_variant_prices')) return 'lockPrice';
  return 'unexpected';
}

function makeReader({ rows = [mappedRow()], barcodeRows = [], permissions = ['reports.read', 'catalog.write'] } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values });
      switch (classifyQuery(sql)) {
        case 'permissions': return { rows: permissions.map(codigo => ({ codigo })) };
        case 'storefront': return { rows: [{ id: IDS.storefrontId, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId, status: 'active' }] };
        case 'location': return { rows: [{ id: IDS.locationId, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId, ativo: true }] };
        case 'scopeCounts': return { rows: [{ loja_count: 1, usuario_count: values[4] === SCOPE.usuarioId ? 1 : 0, storefront_count: 1, location_count: 1 }] };
        case 'candidates': return { rows };
        case 'barcode': return { rows: barcodeRows };
        default: throw new Error(`query de leitura inesperada: ${sql}`);
      }
    },
  };
}

function makeTransaction({ rows = [mappedRow()], barcodeRows = [], existingResponse = null, failOn = null, permissions = ['reports.read', 'catalog.write'] } = {}) {
  const calls = [];
  const state = { idem: existingResponse ? { request_hash: null, response_body: existingResponse } : null, committed: false, writes: [] };
  const trx = {
    query: async (sql, values = []) => {
      calls.push({ sql, values });
      const kind = classifyQuery(sql);
      if (failOn === kind) throw new Error(`forced ${kind} failure`);
      if (kind === 'permissions') return { rows: permissions.map(codigo => ({ codigo })) };
      if (kind === 'storefront') return { rows: [{ id: IDS.storefrontId, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId, status: 'active' }] };
      if (kind === 'location') return { rows: [{ id: IDS.locationId, empresa_id: SCOPE.empresaId, loja_id: SCOPE.lojaId, ativo: true }] };
      if (kind === 'scopeCounts') return { rows: [{ loja_count: 1, usuario_count: values[4] === SCOPE.usuarioId ? 1 : 0, storefront_count: 1, location_count: 1 }] };
      if (kind === 'candidates') return { rows };
      if (kind === 'barcode') return { rows: barcodeRows };
      if (kind === 'idemRead') {
        if (!state.idem) return { rows: [] };
        return { rows: [{ request_hash: state.idem.request_hash, response_body: state.idem.response_body }] };
      }
      if (kind === 'idemInsert') { state.writes.push('idemInsert'); state.idem = { request_hash: values[3], response_body: null }; return { rowCount: 1, rows: [] }; }
      if (kind === 'idemUpdate') { state.writes.push('idemUpdate'); state.idem.response_body = JSON.parse(values[4]); return { rowCount: 1, rows: [] }; }
      if (kind === 'cost' || kind === 'barcodeUpdate' || kind === 'ncm' || kind === 'audit') { state.writes.push(kind); return { rowCount: 1, rows: [{ id: IDS.priceId }] }; }
      if (kind.startsWith('lock') || kind === 'advisory') return { rows: [] };
      throw new Error(`query inesperada: ${sql}`);
    },
  };
  const transaction = async callback => {
    try {
      const result = await callback(trx);
      state.committed = true;
      return result;
    } catch (error) {
      state.writes.length = 0;
      throw error;
    }
  };
  return { calls, state, transaction };
}

test('preview é local, sem rota e sem DML; exige capabilities e preserva baseline hash', async () => {
  const reader = makeReader();
  const result = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: reader });
  assert.equal(result.mode, AVEC_ENRICHMENT_MODE);
  assert.equal(result.pipeline.active, false);
  assert.equal(result.write.performed, false);
  assert.match(result.write.note, /não publicado\/não executado/);
  assert.equal(result.summary.proposable, 1);
  assert.ok(/^[0-9a-f]{64}$/.test(result.previewHash));
  assert.equal(reader.calls.some(call => /\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(call.sql)), false);
});

test('falha fechada sem usuário/capability e ignora flag cliente aprovado', async () => {
  const reader = makeReader();
  await assert.rejects(
    () => previewAvecCatalogEnrichment({ empresaId: SCOPE.empresaId, lojaId: SCOPE.lojaId, capabilities: ['reports.read'] }, baseInput(), { readClient: reader }),
    error => error.code === 'INVALID_ID',
  );
  await assert.rejects(
    () => previewAvecCatalogEnrichment({ ...context, capabilities: ['reports.read'] }, baseInput([{ ...baseItem, aprovado: true }]), { readClient: reader }),
    error => error.code === 'AVEC_UNKNOWN_ITEM_KEY',
  );
  assert.ok(reader.calls.every(call => classifyQuery(call.sql) === 'permissions'));
});

test('rejeita custo zero, sourceId ausente, SKU ausente e não aceita resolução por nome', async () => {
  const reader = makeReader();
  await assert.rejects(() => previewAvecCatalogEnrichment(context, baseInput([{ ...baseItem, custo: '0,00' }]), { readClient: reader }), error => error.code === 'AVEC_COST_ZERO_BLOCKED');
  await assert.rejects(() => previewAvecCatalogEnrichment(context, baseInput([{ sku: 'DINO-001', unidade: 'UN', custo: 1 }]), { readClient: reader }), error => error.code === 'AVEC_SOURCE_ID_REQUIRED');
  await assert.rejects(() => previewAvecCatalogEnrichment(context, baseInput([{ sourceId: 'AVEC-001', unidade: 'UN', custo: 1 }]), { readClient: reader }), error => error.code === 'AVEC_SKU_REQUIRED');
  const noName = await previewAvecCatalogEnrichment(context, baseInput([{ sourceId: 'AVEC-NAME', nome: 'Mesmo nome', unidade: 'UN', custo: 1, sku: 'DINO-404' }]), { readClient: makeReader({ rows: [] }) });
  assert.equal(noName.items[0].status, 'conflict');
  assert.ok(noName.items[0].reasons.includes('UNMAPPED_SOURCE_ID'));
});

test('rejeita sourceId duplicado, EAN inválido e usuário fora da unidade antes de qualquer leitura de catálogo', async () => {
  const reader = makeReader();
  await assert.rejects(
    () => previewAvecCatalogEnrichment(context, baseInput([
      { ...baseItem, sourceId: 'DUP-1' },
      { ...baseItem, sourceId: 'DUP-1', sku: 'DINO-002' },
    ]), { readClient: reader }),
    error => error.code === 'AVEC_ITEM_INVALID',
  );
  await assert.rejects(
    () => previewAvecCatalogEnrichment(context, baseInput([{ ...baseItem, ean: 'bad-ean' }]), { readClient: reader }),
    error => error.code === 'AVEC_ITEM_INVALID',
  );
  const outside = { ...context, usuarioId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const outsideReader = makeReader();
  await assert.rejects(
    () => previewAvecCatalogEnrichment(outside, baseInput(), { readClient: outsideReader }),
    error => error.code === 'AVEC_SCOPE_MISMATCH',
  );
});

test('lote mixed ou mapeamento ambíguo fica bloqueado antes de qualquer DML', async () => {
  const ambiguous = makeTransaction({ rows: [mappedRow(), mappedRow({ variant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })] });
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: makeReader({ rows: ambiguous.calls ? [] : [] }) }).catch(() => null);
  void preview;
  await assert.rejects(
    () => executeAvecCatalogEnrichment(context, { ...baseInput([{ ...baseItem, sourceId: 'AVEC-001' }]), confirmExecution: true, previewHash: 'a'.repeat(64), idempotencyKey: 'mixed-1' }, { transaction: ambiguous.transaction }),
    error => ['AVEC_STALE_BASELINE', 'AVEC_BATCH_BLOCKED'].includes(error.code),
  );
  assert.equal(ambiguous.state.committed, false);
  assert.deepEqual(ambiguous.state.writes, []);
});

test('execute escreve somente custo, barcode, NCM e auditoria no mesmo trx', async () => {
  const reader = makeReader();
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: reader });
  const tx = makeTransaction();
  const result = await executeAvecCatalogEnrichment(context, {
    ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'exec-1',
  }, { transaction: tx.transaction });
  assert.equal(result.performed, true);
  assert.deepEqual(tx.state.writes, ['idemInsert', 'cost', 'barcodeUpdate', 'ncm', 'audit', 'idemUpdate']);
  const dml = tx.calls.filter(call => /\b(INSERT|UPDATE)\b/i.test(call.sql)).map(call => call.sql).join('\n');
  assert.match(dml, /UPDATE commerce_variant_prices/);
  assert.match(dml, /UPDATE commerce_product_variants/);
  assert.match(dml, /UPDATE commerce_products/);
  assert.doesNotMatch(dml, /preco\s*=|preco_promocional|vigencia_\w+\s*=|inventor|reserv|publicado|slug|descricao|comissao|taxa|gateway/i);
  assert.equal(tx.state.committed, true);
});

test('previewHash stale, erro de DML e mixed batch fazem rollback sem efeitos residuais', async () => {
  const tx = makeTransaction({ failOn: 'cost' });
  await assert.rejects(
    () => executeAvecCatalogEnrichment(context, { ...baseInput(), confirmExecution: true, previewHash: 'b'.repeat(64), idempotencyKey: 'stale-1' }, { transaction: tx.transaction }),
    error => error.code === 'AVEC_STALE_BASELINE',
  );
  assert.deepEqual(tx.state.writes, []);
  const txFailure = makeTransaction({ failOn: 'cost' });
  const reader = makeReader();
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: reader });
  await assert.rejects(
    () => executeAvecCatalogEnrichment(context, { ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'rollback-1' }, { transaction: txFailure.transaction }),
    /forced cost failure/,
  );
  assert.equal(txFailure.state.committed, false);
  assert.deepEqual(txFailure.state.writes, []);
});

test('retry exato retorna resultado idempotente; mesma chave com outro request é conflito', async () => {
  const reader = makeReader();
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: reader });
  const tx = makeTransaction();
  const input = { ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'retry-1' };
  const first = await executeAvecCatalogEnrichment(context, input, { transaction: tx.transaction });
  const writesAfterFirst = [...tx.state.writes];
  const second = await executeAvecCatalogEnrichment(context, input, { transaction: tx.transaction });
  assert.equal(second.idempotentReplay, true);
  assert.deepEqual(tx.state.writes, writesAfterFirst);
  await assert.rejects(
    () => executeAvecCatalogEnrichment(context, { ...input, items: [{ ...baseItem, custo: '99,99' }] }, { transaction: tx.transaction }),
    error => error.code === 'IDEMPOTENCY_CONFLICT',
  );
  assert.equal(first.summary.updated, 1);
});

test('barcode já usado por outra variante é fail-closed mesmo que o ledger esteja correto', async () => {
  const reader = makeReader({ rows: [mappedRow()], barcodeRows: [{ barcode: baseItem.ean, ids: [IDS.variantId, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] }] });
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: reader });
  assert.equal(preview.items[0].status, 'conflict');
  assert.ok(preview.items[0].reasons.includes('BARCODE_SHARED_CONFLICT'));
});

test('escopo de idempotência cabe no VARCHAR(120) histórico sem truncar IDs', async () => {
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: makeReader() });
  const tx = makeTransaction();
  await executeAvecCatalogEnrichment(context, {
    ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'varchar-120',
  }, { transaction: tx.transaction });
  const scopes = tx.calls.filter(call => ['idemRead', 'idemInsert', 'idemUpdate'].includes(classifyQuery(call.sql))).map(call => call.values[1]);
  assert.equal(new Set(scopes).size, 1);
  assert.ok(scopes.every(scope => scope.length <= 120 && /^avec\.catalog\.enrichment\.v1:[a-f0-9]{64}$/.test(scope)));
});

test('troca de linha/lista/canal de preço com mesmo custo invalida baseline antes de DML', async () => {
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: makeReader() });
  for (const changed of [
    { current_price_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] },
    { price_list_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    { channel_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
  ]) {
    const tx = makeTransaction({ rows: [mappedRow(changed)] });
    await assert.rejects(() => executeAvecCatalogEnrichment(context, {
      ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'same-cost-stale',
    }, { transaction: tx.transaction }), error => error.code === 'AVEC_STALE_BASELINE');
    assert.deepEqual(tx.state.writes, []);
    assert.equal(tx.state.committed, false);
  }
});

test('capabilities e callback fabricados nunca substituem permissions da membership no banco', async () => {
  const reader = makeReader({ permissions: [] });
  await assert.rejects(() => previewAvecCatalogEnrichment(context, baseInput(), {
    readClient: reader, authorizeCapabilities: async () => true,
  }), error => error.code === 'PERMISSION_DENIED');
  const tx = makeTransaction({ permissions: ['reports.read'] });
  await assert.rejects(() => executeAvecCatalogEnrichment(context, {
    ...baseInput(), confirmExecution: true, previewHash: 'a'.repeat(64), idempotencyKey: 'fake-authority',
  }, { transaction: tx.transaction, authorizeCapabilities: async () => true }), error => error.code === 'PERMISSION_DENIED');
  assert.deepEqual(tx.state.writes, []);
  assert.ok(tx.calls.every(call => classifyQuery(call.sql) === 'permissions'));
});

test('GTIN com checksum errado e NCM zero são bloqueados antes de qualquer escrita', async () => {
  for (const [changed, code] of [[{ ean: '7891234567890' }, 'AVEC_EAN_INVALID'], [{ ncm: '00000000' }, 'AVEC_NCM_INVALID']]) {
    const reader = makeReader();
    await assert.rejects(() => previewAvecCatalogEnrichment(context, baseInput([{ ...baseItem, ...changed }]), { readClient: reader }), error => error.code === code);
    assert.ok(reader.calls.every(call => classifyQuery(call.sql) === 'permissions'));
  }
});

test('auditoria contém apenas diff real e IDs suficientes para compensação restrita', async () => {
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: makeReader() });
  const tx = makeTransaction();
  await executeAvecCatalogEnrichment(context, { ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'audit-snapshot' }, { transaction: tx.transaction });
  const audit = tx.calls.find(call => classifyQuery(call.sql) === 'audit');
  const before = JSON.parse(audit.values[4]); const after = JSON.parse(audit.values[5]);
  assert.deepEqual(before.fields, { costCents: 1000, barcode: '7890000000000', ncm: '33049910' });
  assert.deepEqual(after.fields, { costCents: 1234, barcode: baseItem.ean, ncm: baseItem.ncm });
  assert.equal(before.priceId, IDS.priceId); assert.equal(before.variantId, IDS.variantId);
  assert.equal(before.channelId, IDS.channelId); assert.equal(before.sourceId, baseItem.sourceId);
  assert.notDeepEqual(before, after);
  assert.ok(tx.calls.some(call => classifyQuery(call.sql) === 'lockLedger'));
  const cost = tx.calls.find(call => classifyQuery(call.sql) === 'cost');
  assert.match(cost.sql, /vigencia_inicio <= CURRENT_TIMESTAMP/);
});

test('23505 de writer não cooperante vira conflito governado e reverte o lote', async () => {
  const preview = await previewAvecCatalogEnrichment(context, baseInput(), { readClient: makeReader() });
  const tx = makeTransaction();
  const transaction = callback => tx.transaction(trx => callback({ query: async (sql, values) => {
    if (classifyQuery(sql) === 'barcodeUpdate') { const error = new Error('synthetic conflict'); error.code = '23505'; throw error; }
    return trx.query(sql, values);
  }}));
  await assert.rejects(() => executeAvecCatalogEnrichment(context, {
    ...baseInput(), confirmExecution: true, previewHash: preview.previewHash, idempotencyKey: 'barcode-unique-conflict',
  }, { transaction }), error => error.code === 'AVEC_BARCODE_CONFLICT');
  assert.deepEqual(tx.state.writes, []);
});
