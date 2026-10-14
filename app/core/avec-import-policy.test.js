import test from 'node:test';
import assert from 'node:assert/strict';
import { minimizedGovernanceTree, knownGovernanceSchema } from '../../shared/avec-import-policy.js';
import { validateGovernanceInput } from './avec-import-governance-common.js';
const scope = { empresaId: '11111111-1111-4111-8111-111111111111', lojaId: '22222222-2222-4222-8222-222222222222' };
const fixture = () => ({ source: 'avec', contractVersion: 'avec-dino-governance-v1', category: 'products', sourceEstablishmentId: 'SYNTHETIC', ...scope, extractedAt: '2026-10-14T12:00:00-04:00', cutoff: '2026-10-14T12:00:00-04:00', rows: [{ sourceId: 'SYNTHETIC-1' }] });
test('aliases de segredo apontados pela revisão são bloqueados na política compartilhada', () => {
  for (const key of ['apiKey', 'api_key', 'client_secret', 'secretValue', 'secret_value', 'secretRef', 'customToken', 'private_key']) {
    const input = fixture(); input.rows[0][key] = 'DO-NOT-SEND-SYNTHETIC';
    assert.equal(minimizedGovernanceTree(input), false);
    assert.throws(() => validateGovernanceInput(input, scope), { code: 'AVEC_SENSITIVE_FIELD_REJECTED' });
  }
});
test('allowlist rejeita desconhecidos no envelope, nas linhas e nos objetos fiscais', () => {
  assert.equal(knownGovernanceSchema(fixture()), true);
  for (const input of [{ ...fixture(), unfamiliar: 'x' }, { ...fixture(), rows: [{ sourceId: 'SYNTHETIC-1', evidence: 'unknown' }] }]) {
    assert.equal(knownGovernanceSchema(input), false); assert.throws(() => validateGovernanceInput(input, scope), { code: 'AVEC_FIELD_NOT_ALLOWED' });
  }
  const fiscal = { ...fixture(), category: 'fiscal', rows: [{ address: { uf: 'MT', unfamiliar: 'x' } }] };
  assert.equal(knownGovernanceSchema(fiscal), false);
});
