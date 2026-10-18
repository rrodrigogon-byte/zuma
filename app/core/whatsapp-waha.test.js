import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  normalizeWahaMediaReference,
  normalizeWahaPhone,
  validWahaGroupId,
  validWahaSession,
  verifyWahaHmac,
} from './whatsapp-waha.js';

test('WAHA valida sessão e group JID', () => {
  assert.equal(validWahaSession('kytto-gestao-rm'), 'kytto-gestao-rm');
  assert.equal(validWahaSession(''), '');
  assert.equal(validWahaSession('../outro'), '');
  assert.equal(validWahaGroupId('120363012345678901@g.us'), '120363012345678901@g.us');
  assert.equal(validWahaGroupId('5511999999999@s.whatsapp.net'), '');
  assert.equal(validWahaGroupId('120363@g.us/../x'), '');
});

test('WAHA normaliza o telefone do código de pareamento', () => {
  assert.equal(normalizeWahaPhone('(55) 65 99999-0000'), '5565999990000');
  assert.equal(normalizeWahaPhone('5511999999999'), '5511999999999');
  assert.throws(() => normalizeWahaPhone('9999'), /DDI/);
  assert.throws(() => normalizeWahaPhone('telefone'), /DDI/);
});

test('referência de mídia aceita somente caminho /api/files/', () => {
  assert.equal(normalizeWahaMediaReference('https://waha.internal/api/files/session/file.pdf?download=1'), '/api/files/session/file.pdf?download=1');
  assert.equal(normalizeWahaMediaReference('/api/files/session/file.pdf'), '/api/files/session/file.pdf');
  assert.equal(normalizeWahaMediaReference('https://169.254.169.254/latest/meta-data'), '');
  assert.equal(normalizeWahaMediaReference('/api/files/../secrets'), '');
});

test('HMAC WAHA exige SHA-512 correto e rejeita ausência ou alteração', () => {
  const body = Buffer.from('{"event":"message","session":"kytto-gestao-rm"}');
  const secret = 'h'.repeat(32);
  const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');
  assert.equal(verifyWahaHmac(body, signature, secret), true);
  assert.equal(verifyWahaHmac(body, `sha512=${signature}`, secret), true);
  assert.equal(verifyWahaHmac(Buffer.from(`${body} `), signature, secret), false);
  assert.equal(verifyWahaHmac(body, '', secret), false);
});
