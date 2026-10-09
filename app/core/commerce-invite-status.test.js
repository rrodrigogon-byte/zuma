import assert from 'node:assert/strict';
import test from 'node:test';
import { listOperationalInvites, operationalInviteHttpError, operationalInviteReadiness } from './commerce-invite-status.js';

const readyEnv = { COMMERCE_CORE_ENABLED: '1', OPERATIONAL_INVITES_ENABLED: '1', EMAIL_FROM: 'Test <test@example.invalid>', RESEND_API_KEY: 'synthetic-secret' };

test('diagnóstico diferencia opt-in e canal de e-mail, sem devolver segredos', () => {
  assert.equal(operationalInviteReadiness({}, false).code, 'INVITES_DISABLED');
  assert.equal(operationalInviteReadiness({ ...readyEnv, OPERATIONAL_INVITES_ENABLED: '0' }, true).code, 'INVITES_DISABLED');
  assert.equal(operationalInviteReadiness(readyEnv, false).code, 'MAIL_NOT_CONFIGURED');
  assert.equal(operationalInviteReadiness({ ...readyEnv, EMAIL_FROM: '  ' }, true).code, 'MAIL_NOT_CONFIGURED');
  assert.deepEqual(operationalInviteReadiness(readyEnv, true), {
    ready: true,
    coreEnabled: true,
    enabled: true,
    mailConfigured: true,
    mailKeyConfigured: true,
    mailFromConfigured: true,
    operationalFromConfigured: false,
    code: null,
  });
  assert.doesNotMatch(JSON.stringify(operationalInviteReadiness(readyEnv, true)), /synthetic-secret|test@example/);
});

test('conflito de e-mail é 409 e não indisponibilidade; erro bruto do sender não vaza', () => {
  const conflict = operationalInviteHttpError({ code: 'OPERATIONAL_EMAIL_RESERVED' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'IDENTITY_ALREADY_EXISTS');
  assert.equal(operationalInviteHttpError({ code: 'MAIL_REJECTED' }).body.code, 'MAIL_REJECTED');
  assert.equal(operationalInviteHttpError({ code: 'MAIL_UNCERTAIN' }).body.code, 'INVITE_DELIVERY_UNCERTAIN');
  const unknown = operationalInviteHttpError(new Error('token-sensitive@example.invalid'));
  assert.equal(unknown.status, 503);
  assert.doesNotMatch(JSON.stringify(unknown), /token-sensitive/);
});

test('histórico é limitado ao tenant e não seleciona token, senha ou hash', async () => {
  const database = { async queryRead(sql, values) {
    assert.deepEqual(values, ['tenant-synthetic']);
    assert.match(sql, /WHERE empresa_id = \$1/);
    assert.match(sql, /LIMIT 100/);
    assert.doesNotMatch(sql, /token|senha|hash|SELECT \*/i);
    return { rows: [{ id: 'invite', status: 'sent' }] };
  } };
  assert.deepEqual(await listOperationalInvites(database, 'tenant-synthetic'), { items: [{ id: 'invite', status: 'sent' }] });
});
