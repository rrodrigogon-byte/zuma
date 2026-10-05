import test from 'node:test';
import assert from 'node:assert/strict';
import { prefersSelfService, canResumeSelfService, recoverableModelFailure } from './whatsapp-self-service.js';
test('pedido do print e preferência por IA são reconhecidos; pedido de humano continua válido', () => {
  for (const text of ['ok, mas nao quero falar com ninguem, resolca!', 'não quero falar com atendente', 'quero continuar com a IA', 'somente pelo whats']) assert.equal(prefersSelfService(text), true, text);
  for (const text of ['quero falar com uma pessoa', 'quero um atendente', 'quanto custa?', 'quero falar com atendente só pelo WhatsApp']) assert.equal(prefersSelfService(text), false, text);
});
test('só falhas recuperáveis sem responsável permitem retomada', () => {
  const session = { status: 'humano', handoff_reason: 'gemini:GEMINI_TOOL_LIMIT' };
  assert.equal(canResumeSelfService(session), true);
  assert.equal(canResumeSelfService({ ...session, assigned_to: 'staff' }), false);
  for (const reason of ['security:output_policy', 'identity_ambiguous', 'whatsapp_delivery_unknown', 'equipe_no_celular', 'gemini:GEMINI_BLOCKED']) assert.equal(canResumeSelfService({ ...session, handoff_reason: reason }), false);
  assert.equal(recoverableModelFailure('GEMINI_HTTP_TEMPORARY'), true);
  assert.equal(recoverableModelFailure('GEMINI_AUTH_ERROR'), false);
});
