import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmationDeadlineExpired, confirmationPlan, secondConfirmationWindowOpen } from './dino-confirmation-policy.js';

const now = new Date('2026-08-01T12:00:00.000Z');

test('agenda futura: primeira etapa na véspera, segunda 2h15 antes e prazo de uma hora', () => {
  const start = new Date('2026-08-02T13:00:00.000Z');
  const plan = confirmationPlan(start, now);
  assert.equal(plan.enabled, true);
  assert.equal(plan.firstAt.toISOString(), '2026-08-01T13:00:00.000Z');
  assert.equal(plan.secondAt.toISOString(), '2026-08-02T10:45:00.000Z');
  assert.equal(plan.responseDeadline.toISOString(), '2026-08-02T11:45:00.000Z');
  assert.equal(start.valueOf() - plan.responseDeadline.valueOf(), 75 * 60 * 1000);
});

test('antecedência curta não habilita cancelamento automático', () => {
  assert.equal(confirmationPlan(new Date(now.valueOf() + 3 * 60 * 60 * 1000 + 14 * 60 * 1000), now).enabled, false);
  const boundary = confirmationPlan(new Date(now.valueOf() + 3 * 60 * 60 * 1000 + 15 * 60 * 1000), now);
  assert.equal(boundary.enabled, true);
  assert.equal(boundary.secondAt.valueOf() - boundary.firstAt.valueOf(), 60 * 60 * 1000);
});

test('o segundo aviso só é enviado enquanto restam pelo menos duas horas', () => {
  assert.equal(secondConfirmationWindowOpen(new Date(now.valueOf() + 2 * 60 * 60 * 1000 + 1), now), true);
  assert.equal(secondConfirmationWindowOpen(new Date(now.valueOf() + 2 * 60 * 60 * 1000 - 1), now), false);
});

test('prazo é comparado em instantes absolutos', () => {
  const deadline = new Date('2026-08-01T13:00:00.000Z');
  assert.equal(confirmationDeadlineExpired(deadline, new Date('2026-08-01T12:59:59.999Z')), false);
  assert.equal(confirmationDeadlineExpired(deadline, deadline), true);
  assert.equal(confirmationDeadlineExpired('inválido', now), false);
});
