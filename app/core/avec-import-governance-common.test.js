import test from 'node:test';
import assert from 'node:assert/strict';
import { AVEC_IMPORT_VERSION, validateGovernanceInput, buildGovernanceResult, isoInstant, rowResult } from './avec-import-governance-common.js';
const scope = { empresaId: '11111111-1111-4111-8111-111111111111', lojaId: '22222222-2222-4222-8222-222222222222' };
const fixture = () => ({ source: 'avec', contractVersion: AVEC_IMPORT_VERSION, category: 'products', sourceEstablishmentId: 'SYNTHETIC-SOURCE', ...scope, extractedAt: '2026-10-14T12:00:00-04:00', cutoff: '2026-10-14T12:00:00-04:00', rows: [{ sourceId: 'SYNTHETIC-1' }] });
test('escopo explícito, contrato e origem são obrigatórios', () => {
  assert.deepEqual(validateGovernanceInput(fixture(), scope), scope);
  for (const [patch, code] of [[{ lojaId: null }, 'AVEC_SCOPE_MISMATCH'], [{ source: 'other' }, 'AVEC_SOURCE_VERSION_INVALID'], [{ contractVersion: 'wrong' }, 'AVEC_SOURCE_VERSION_INVALID'], [{ sourceEstablishmentId: '' }, 'AVEC_SOURCE_ESTABLISHMENT_REQUIRED'], [{ category: 'other' }, 'AVEC_CATEGORY_INVALID']]) assert.throws(() => validateGovernanceInput({ ...fixture(), ...patch }, scope), { code });
  assert.throws(() => validateGovernanceInput(fixture(), { ...scope, lojaId: null }), { code: 'AVEC_SCOPE_REQUIRED' });
});
test('datas exigem offset, calendário real e rejeitam normalização silenciosa', () => {
  assert.equal(isoInstant('2026-02-30T12:00:00Z'), null);
  assert.equal(isoInstant('2026-10-14T24:00:00Z'), null);
  assert.equal(isoInstant('2026-10-14T12:00:00'), null);
  assert.ok(isoInstant('2024-02-29T12:00:00-04:00'));
  assert.throws(() => validateGovernanceInput({ ...fixture(), cutoff: '2026-02-30T12:00:00Z' }, scope), { code: 'AVEC_INSTANT_REQUIRED' });
});
test('limite de lote e objeto inválido ficam bloqueados', () => {
  for (const rows of [[], [null], Array.from({ length: 501 }, () => ({}))]) assert.throws(() => validateGovernanceInput({ ...fixture(), rows }, scope), { code: 'AVEC_ROWS_INVALID' });
});
test('PII de cliente e credenciais são rejeitadas sem ecoar valores', () => {
  for (const key of ['password', 'token', 'email', 'phone', 'cpf', 'observacoes', 'clientName', 'certificado']) {
    const input = fixture(); input.rows[0][key] = 'SENSITIVE-SYNTHETIC-VALUE';
    assert.throws(() => validateGovernanceInput(input, scope), error => error.code === 'AVEC_SENSITIVE_FIELD_REJECTED' && !error.message.includes('SENSITIVE-SYNTHETIC-VALUE'));
  }
});
test('estrutura válida continua com zero aptos para gravar e hash determinístico', () => {
  const input = fixture(), before = JSON.stringify(input);
  const result = buildGovernanceResult(input, scope, [rowResult(1)]);
  assert.equal(result.summary.readyForMapping, 1); assert.equal(result.summary.readyToApply, 0);
  assert.deepEqual(result.write, { performed: false, enabled: false, endpoint: null });
  assert.equal(result.policy.agendaWindowDays, 60); assert.equal(result.policy.preservePrice, true); assert.equal(result.policy.preserveStock, true);
  assert.equal(result.previewHash, buildGovernanceResult({ ...input, rows: input.rows }, scope, [rowResult(1)]).previewHash);
  assert.notEqual(result.previewHash, buildGovernanceResult({ ...input, cutoff: '2026-10-14T13:00:00-04:00' }, scope, [rowResult(1)]).previewHash);
  assert.equal(JSON.stringify(input), before); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC-1|SYNTHETIC-SOURCE/);
  for (const key of ['apply','execute','writerEnabled']) assert.throws(() => validateGovernanceInput({ ...input, [key]: true }, scope), { code: 'AVEC_APPLY_DISABLED' });
});
