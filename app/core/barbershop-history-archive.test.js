import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localPostgresFixture } from '../tests/local-postgres-fixture.js';
import { planHistoryArchive, previewHistoryArchive, applyHistoryArchive } from './barbershop-history-archive.js';

const scope = { empresaId: 'empresa-a', lojaId: 'loja-a' };
function source() {
  const row = (id, lojaId = 'loja-a') => ({ id, empresaId: 'empresa-a', lojaId, sourceKey: `avec:${id}`, clienteNome: 'Cliente sintético', valor: 50, dataAgenda: '2026-10-24' });
  return { barbearias: { 'empresa-a': { historicoAtendimentos: { a: row('a'), b: row('b', 'loja-b'), c: row('c', '') }, historicoComandas: { h: row('h') } } }, financeiro: { saldo: 10 } };
}

test('plano exige empresa/loja, recusa IDs divergentes e chaves duplicadas', () => {
  const data = source();
  assert.throws(() => planHistoryArchive(data, {}), /HISTORY_SCOPE_REQUIRED/);
  const plan = planHistoryArchive(data, scope);
  assert.equal(plan.rows.length, 2);
  assert.deepEqual(plan.excluded, { missingStore: 1, otherStore: 1 });
  data.barbearias['empresa-a'].historicoAtendimentos.a.empresaId = 'empresa-b';
  assert.throws(() => planHistoryArchive(data, scope), /HISTORY_RECORD_SCOPE_MISMATCH/);
  const repeated = source(); repeated.barbearias['empresa-a'].historicoAtendimentos.x = { ...repeated.barbearias['empresa-a'].historicoAtendimentos.a, id: 'x' };
  assert.throws(() => planHistoryArchive(repeated, scope), /HISTORY_DUPLICATE_SOURCE_KEY/);
});

test('arquivo PostgreSQL real: prévia sem gravação, replay, isolamento, concorrência e rollback', async (t) => {
  const fixture = await localPostgresFixture(); t.after(() => fixture.close());
  const client = await fixture.connect();
  await client.query(await readFile(new URL('../migrations/103_barbershop_history_archive.sql', import.meta.url), 'utf8'));
  const data = source(), original = JSON.stringify(data), plan = planHistoryArchive(data, scope);
  const count = async () => Number((await client.query('SELECT count(*) FROM kytto_barbershop_history_archive')).rows[0].count);
  const preview = await previewHistoryArchive(client, plan);
  assert.equal(preview.missing, 2); assert.equal(await count(), 0);
  const args = { getSource: () => data, ...scope, confirm: true, expectedSourceHash: plan.sourceHash };
  await assert.rejects(applyHistoryArchive(client, { ...args, expectedSourceHash: 'errado' }), /HISTORY_PREVIEW_REQUIRED/);
  const otherClient = await fixture.connect();
  const results = await Promise.all([applyHistoryArchive(client, args), applyHistoryArchive(otherClient, args)]);
  assert.equal(results.reduce((sum, row) => sum + row.inserted, 0), 2);
  assert.equal(await count(), 2);
  assert.equal((await applyHistoryArchive(client, args)).inserted, 0);
  assert.equal(JSON.stringify(data), original, 'não altera fonte, financeiro ou estoque');
  assert.equal((await previewHistoryArchive(client, planHistoryArchive(data, { ...scope, lojaId: 'loja-b' }))).missing, 1);
  const newer = source(); newer.barbearias['empresa-a'].historicoAtendimentos.a.valor = 60;
  await assert.rejects(applyHistoryArchive(client, { ...args, getSource: () => newer, expectedSourceHash: planHistoryArchive(newer, scope).sourceHash }), /HISTORY_ARCHIVE_CONFLICT/);
  const expanded = source(); expanded.barbearias['empresa-a'].historicoComandas.extra = { ...expanded.barbearias['empresa-a'].historicoComandas.h, id: 'extra', sourceKey: 'avec:extra' };
  let calls = 0;
  await assert.rejects(applyHistoryArchive(client, { ...args, getSource: () => ++calls === 1 ? expanded : data, expectedSourceHash: planHistoryArchive(expanded, scope).sourceHash }), /HISTORY_SOURCE_CHANGED/);
  assert.equal(await count(), 2, 'mudança de fonte desfaz inserções da transação');
  await client.query("UPDATE kytto_barbershop_history_archive SET document=jsonb_set(document,'{valor}','999') WHERE source_id='a'");
  await assert.rejects(previewHistoryArchive(client, plan), /HISTORY_TARGET_CORRUPT/);
});
