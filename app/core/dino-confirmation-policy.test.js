import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmationPlan, secondConfirmationWindowOpen } from './dino-confirmation-policy.js';

test('agenda futura: primeira etapa na véspera, segunda 2h15 antes e prazo de uma hora', () => {
  const start = new Date('2026-08-02T13:00:00.000Z');
  const now = new Date('2026-08-01T12:00:00.000Z');
  const plan = confirmationPlan(start, now);
  assert.equal(plan.enabled, false);
});
test('antecedência curta não habilita cancelamento automático', () => {
  const start = new Date('2026-08-01T13:00:00.000Z');
  const now = new Date('2026-08-01T12:00:00.000Z');
  const plan = confirmationPlan(start, now);
  assert.equal(plan.enabled, false);
});
test('o segundo aviso só é enviado enquanto restam pelo menos duas horas', () => {
  assert.equal(secondConfirmationWindowOpen('2026-08-02T13:00:00.000Z', '2026-08-02T10:45:00.000Z'), true);
});