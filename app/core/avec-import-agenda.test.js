import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAvecAgenda } from './avec-import-agenda.js';

const SCOPE = Object.freeze({
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
});
const OTHER_LOJA = '33333333-3333-4333-8333-333333333333';
const CUTOFF = '2026-10-14T00:00:00-04:00';
const END_OF_WINDOW = '2026-12-13T00:00:00-04:00';

function row(overrides = {}) {
  return {
    sourceAppointmentId: 'avec-appt-001',
    sourceClientId: 'avec-client-001',
    sourceProfessionalId: 'avec-prof-001',
    sourceServiceId: 'avec-service-001',
    lojaId: SCOPE.lojaId,
    startAt: '2026-10-15T09:00:00-04:00',
    durationMinutes: 60,
    timezone: 'America/Cuiaba',
    status: 'scheduled',
    individualEventVerified: true,
    ...overrides,
  };
}

function analyze(rows, input = {}) {
  return analyzeAvecAgenda({ rows, cutoff: CUTOFF, ...input }, SCOPE);
}

function statuses(results) {
  return results.map(result => result.status);
}

function reasons(result) {
  return new Set(result.reasons);
}

test('retorna agenda válida como ready_for_mapping sem proposta nem payload de destino', () => {
  const result = analyze([row()]);
  assert.deepEqual(result, [{ line: 1, status: 'ready_for_mapping', reasons: [] }]);
  assert.equal(Object.prototype.hasOwnProperty.call(result[0], 'payload'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result[0], 'proposal'), false);
});

test('aceita endAt explícito, duração coerente e intervalo no limite de 480 minutos', () => {
  const result = analyze([row({
    sourceAppointmentId: 'avec-appt-480',
    startAt: '2026-10-15T09:00:00-04:00',
    endAt: '2026-10-15T17:00:00-04:00',
    durationMinutes: 480,
  })]);
  assert.equal(result[0].status, 'ready_for_mapping');
});

test('bloqueia ausência de endAt e durationMinutes e duration zero ou fracionária', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-absent', durationMinutes: undefined }),
    row({ sourceAppointmentId: 'avec-appt-zero', durationMinutes: 0 }),
    row({ sourceAppointmentId: 'avec-appt-fraction', durationMinutes: 1.5 }),
  ]);
  assert.ok(reasons(result[0]).has('END_OR_DURATION_REQUIRED'));
  assert.ok(reasons(result[1]).has('DURATION_INVALID'));
  assert.ok(reasons(result[2]).has('DURATION_INVALID'));
  assert.deepEqual(statuses(result), ['blocked', 'blocked', 'blocked']);
});

test('bloqueia endAt inválido, intervalo não positivo, excesso e incoerência com duração', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-end-invalid', endAt: '2026-10-15T10:00:00' }),
    row({ sourceAppointmentId: 'avec-appt-end-before', endAt: '2026-10-15T08:00:00-04:00' }),
    row({ sourceAppointmentId: 'avec-appt-too-long', endAt: '2026-10-16T09:01:00-04:00' }),
    row({ sourceAppointmentId: 'avec-appt-mismatch', endAt: '2026-10-15T11:30:00-04:00', durationMinutes: 60 }),
  ]);
  assert.ok(reasons(result[0]).has('END_AT_INVALID'));
  assert.ok(reasons(result[1]).has('INTERVAL_NOT_POSITIVE'));
  assert.ok(reasons(result[2]).has('INTERVAL_TOO_LONG'));
  assert.ok(reasons(result[3]).has('END_DURATION_MISMATCH'));
  assert.deepEqual(statuses(result), ['blocked', 'blocked', 'blocked', 'blocked']);
});

test('exige offset Cuiabá correto, timezone declarada e verificação individual', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-offset', startAt: '2026-10-15T09:00:00+00:00' }),
    row({ sourceAppointmentId: 'avec-appt-zone', timezone: 'UTC' }),
    row({ sourceAppointmentId: 'avec-appt-unverified', individualEventVerified: false }),
  ]);
  assert.ok(reasons(result[0]).has('TIMEZONE_OFFSET_INVALID'));
  assert.ok(reasons(result[1]).has('TIMEZONE_INVALID'));
  assert.ok(reasons(result[2]).has('INDIVIDUAL_EVENT_UNVERIFIED'));
});

test('ignora passado e exatamente o limite superior da janela half-open de 60 dias', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-past', startAt: '2026-10-13T23:59:00-04:00' }),
    row({ sourceAppointmentId: 'avec-appt-boundary', startAt: END_OF_WINDOW }),
    row({ sourceAppointmentId: 'avec-appt-inside', startAt: '2026-12-12T23:59:00-04:00' }),
  ]);
  assert.deepEqual(statuses(result), ['ignored', 'ignored', 'ready_for_mapping']);
  assert.ok(reasons(result[0]).has('OUTSIDE_AGENDA_WINDOW'));
  assert.ok(reasons(result[1]).has('OUTSIDE_AGENDA_WINDOW'));
});

test('ignora cancelados e no_show sem convertê-los ou criar ação', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-canceled', status: 'canceled' }),
    row({ sourceAppointmentId: 'avec-appt-no-show', status: 'no_show' }),
  ]);
  assert.deepEqual(statuses(result), ['ignored', 'ignored']);
  assert.ok(reasons(result[0]).has('STATUS_CANCELED_IGNORED'));
  assert.ok(reasons(result[1]).has('STATUS_NO_SHOW_IGNORED'));
  assert.equal(result.some(item => item.status === 'readyApply'), false);
});

test('bloqueia IDs ausentes, ordinal/page e status desconhecido sem ecoar valores', () => {
  const sensitiveValue = 'Cliente PII 65999999999';
  const result = analyze([
    row({ sourceAppointmentId: undefined, sourceClientId: '1', sourceProfessionalId: 'page-2', customerName: sensitiveValue }),
    row({ sourceAppointmentId: 'avec-appt-status', status: 'booked' }),
  ]);
  assert.deepEqual(statuses(result), ['blocked', 'blocked']);
  assert.ok(reasons(result[0]).has('SOURCE_APPOINTMENT_ID_INVALID'));
  assert.ok(reasons(result[0]).has('SOURCE_CLIENT_ID_INVALID'));
  assert.ok(reasons(result[0]).has('SOURCE_PROFESSIONAL_ID_INVALID'));
  assert.ok(reasons(result[1]).has('STATUS_INVALID'));
  assert.equal(JSON.stringify(result).includes(sensitiveValue), false);
  assert.deepEqual(Object.keys(result[0]).sort(), ['line', 'reasons', 'status']);
});

test('bloqueia contradição de unidade e aceita somente escopo explícito confiável', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-other-store', lojaId: OTHER_LOJA }),
    row({ sourceAppointmentId: 'avec-appt-no-store', lojaId: undefined }),
  ]);
  assert.ok(reasons(result[0]).has('ROW_SCOPE_MISMATCH'));
  assert.ok(reasons(result[1]).has('ROW_LOJA_ID_INVALID'));
  const invalidScope = analyzeAvecAgenda({ rows: [row()], cutoff: CUTOFF }, { empresaId: 'not-uuid', lojaId: SCOPE.lojaId });
  assert.equal(invalidScope[0].status, 'blocked');
  assert.ok(reasons(invalidScope[0]).has('SCOPE_INVALID'));
});

test('detecta ID original repetido apenas entre linhas ativas dentro da prévia', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-duplicate', startAt: '2026-10-15T09:00:00-04:00' }),
    row({ sourceAppointmentId: 'avec-appt-duplicate', startAt: '2026-10-16T09:00:00-04:00', sourceClientId: 'avec-client-002' }),
    row({ sourceAppointmentId: 'avec-appt-duplicate', status: 'canceled', startAt: '2026-10-17T09:00:00-04:00' }),
  ]);
  assert.ok(reasons(result[0]).has('DUPLICATE_SOURCE_APPOINTMENT_ID'));
  assert.ok(reasons(result[1]).has('DUPLICATE_SOURCE_APPOINTMENT_ID'));
  assert.equal(result[2].status, 'ignored');
});

test('detecta sobreposição de profissional e cliente somente no mesmo escopo', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-prof-a', startAt: '2026-10-15T09:00:00-04:00', durationMinutes: 60 }),
    row({ sourceAppointmentId: 'avec-appt-prof-b', sourceClientId: 'avec-client-002', startAt: '2026-10-15T09:30:00-04:00', durationMinutes: 30 }),
    row({ sourceAppointmentId: 'avec-appt-client-c', sourceProfessionalId: 'avec-prof-002', startAt: '2026-10-15T09:15:00-04:00', durationMinutes: 30 }),
    row({ sourceAppointmentId: 'avec-appt-different-store', lojaId: OTHER_LOJA, startAt: '2026-10-15T09:00:00-04:00' }),
  ]);
  assert.ok(reasons(result[0]).has('SOURCE_PROFESSIONAL_OVERLAP'));
  assert.ok(reasons(result[1]).has('SOURCE_PROFESSIONAL_OVERLAP'));
  assert.ok(reasons(result[0]).has('SOURCE_CLIENT_OVERLAP'));
  assert.ok(reasons(result[2]).has('SOURCE_CLIENT_OVERLAP'));
  assert.equal(result[3].status, 'blocked');
});

test('não compara intervalos adjacentes e não colide IDs quando cliente/profissional diferem', () => {
  const result = analyze([
    row({ sourceAppointmentId: 'avec-appt-adjacent-a', startAt: '2026-10-15T09:00:00-04:00', durationMinutes: 30 }),
    row({ sourceAppointmentId: 'avec-appt-adjacent-b', startAt: '2026-10-15T09:30:00-04:00', durationMinutes: 30, sourceClientId: 'avec-client-002', sourceProfessionalId: 'avec-prof-002' }),
  ]);
  assert.deepEqual(statuses(result), ['ready_for_mapping', 'ready_for_mapping']);
});

test('mantém o analisador somente leitura e o resultado sem nomes, PII, valores ou mapeamentos', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = () => { fetchCalled = true; throw new Error('network must not be used'); };
  try {
    const input = Object.freeze({ rows: Object.freeze([Object.freeze(row({ customerName: 'Nome privado', value: 999, mappedClientId: 'destino' }))]), cutoff: CUTOFF });
    const result = analyzeAvecAgenda(input, SCOPE);
    assert.equal(fetchCalled, false);
    assert.deepEqual(result, [{ line: 1, status: 'ready_for_mapping', reasons: [] }]);
    assert.equal(JSON.stringify(result).includes('Nome privado'), false);
    assert.equal(JSON.stringify(result).includes('999'), false);
    assert.equal(JSON.stringify(result).includes('destino'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('usa cutoff explícito e não depende da data atual', () => {
  const result = analyze([row({ startAt: '2026-10-14T00:00:00-04:00' })]);
  assert.equal(result[0].status, 'ready_for_mapping');
});
test('cancelado ou falta é ignorado sem dados de criação, mas nunca fora do escopo', () => {
  const minimal = [{ lojaId: SCOPE.lojaId, status: 'canceled' }, { lojaId: SCOPE.lojaId, status: 'no_show' }];
  assert.deepEqual(statuses(analyze(minimal)), ['ignored', 'ignored']);
  assert.equal(analyze([{ lojaId: OTHER_LOJA, status: 'canceled' }])[0].status, 'blocked');
});
test('ID numérico original só é aceito com verificação declarada; rótulos de página nunca são IDs', () => {
  const numeric = { sourceAppointmentId: '129301', sourceClientId: '209601', sourceProfessionalId: '391', sourceServiceId: '181' };
  assert.equal(analyze([row(numeric)])[0].status, 'blocked');
  assert.equal(analyze([row({ ...numeric, originalIdsVerified: true })])[0].status, 'ready_for_mapping');
  assert.equal(analyze([row({ ...numeric, originalIdsVerified: true, sourceAppointmentId: 'pagina-2' })])[0].status, 'blocked');
});
