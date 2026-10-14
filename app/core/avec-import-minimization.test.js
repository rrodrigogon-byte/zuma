import test from 'node:test';
import assert from 'node:assert/strict';
import { assertMinimizedPayload } from './avec-import-governance-common.js';
test('aliases comuns de contato, segredo, certificados e protótipo são rejeitados sem conteúdo', () => {
  for (const key of ['nome_cliente', 'cliente_nome', 'customerName', 'celular', 'private_key', 'access_token', 'JWT_SECRET', 'DB_PASS', 'credentials', 'certificados', 'certificates', 'card_number', 'bank_account', '__proto__', 'constructor']) {
    const value = JSON.parse(JSON.stringify({ rows: [{ evidence: { [key]: 'PRIVATE-SYNTHETIC-NOT-FOR-OUTPUT' } }] }));
    assert.throws(() => assertMinimizedPayload(value), error => error.code === 'AVEC_SENSITIVE_FIELD_REJECTED' && !error.message.includes('PRIVATE-SYNTHETIC'));
  }
});
