import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DinoNpsError,
  getDinoNpsOverview,
  markDinoNpsProcessing,
  queueDinoNpsProcessing,
  recordDinoNpsResponse,
} from './dino-nps-canonical.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const APPOINTMENT = '33333333-3333-4333-8333-333333333333';
const CUSTOMER = '44444444-4444-4444-8444-444444444444';
const ACTION = '55555555-5555-4555-8555-555555555555';
const BASE_DATE = '2026-01-20T12:00:00.000Z';
const CONTEXT = { empresaId: TENANT, lojaId: STORE, actionId: ACTION, idempotencyKey: 'nps-response:deterministic', fingerprint: 'a'.repeat(64) };

function fakeDb({ appointment = {}, responses = [], outbox = [] } = {}) {
  const state = {
    appointment: {
      id: APPOINTMENT, empresa_id: TENANT, loja_id: STORE, status: 'concluido',
      data_agendamento: '2026-01-15T12:00:00.000Z', cliente_id: CUSTOMER,
      cliente_telefone: '11999998888', codigo_confirmacao: 'DINO10', ...appointment,
    },
    responses: [...responses],
    outbox: [...outbox],
    next: 1,
  };
  const db = {
    state,
    async transaction(callback) {
      return callback({ query: async (sql, params = []) => {
        if (sql.includes('FROM agendamentos')) return { rows: [state.appointment] };
        if (sql.includes('FROM dino_nps_responses') && sql.includes('FOR UPDATE')) {
          return { rows: state.responses.filter(row => row.empresa_id === params[0] && row.loja_id === params[1] && row.agendamento_id === params[2]) };
        }
        if (sql.includes('FROM dino_nps_responses')) return { rows: state.responses.filter(row => row.empresa_id === params[0] && row.loja_id === params[1]) };
        if (sql.includes('INSERT INTO dino_nps_responses')) {
          const row = { id: `nps-${state.next++}`, empresa_id: params[0], loja_id: params[1], agendamento_id: params[2], nota: params[3], comentario: params[4], fingerprint: params[5], respondido_em: params[7] };
          if (state.responses.some(item => item.agendamento_id === row.agendamento_id)) Object.assign(new Error('unique'), { code: '23505' });
          state.responses.push(row);
          return { rows: [row] };
        }
        if (sql.includes('FROM dino_effect_outbox')) {
          return { rows: state.outbox.filter(row => row.empresa_id === params[0] && row.loja_id === params[1] && row.efeito === params[2] && row.idempotency_key === params[3]) };
        }
        if (sql.includes('INSERT INTO dino_effect_outbox')) {
          const row = { id: `outbox-${state.next++}`, action_id: params[5], fingerprint: params[3], status: 'pending' };
          state.outbox.push({ ...row, empresa_id: params[0], loja_id: params[1], efeito: 'nps.process', idempotency_key: params[2] });
          return { rows: [row] };
        }
        if (sql.includes('UPDATE dino_effect_outbox')) {
          const row = state.outbox.find(item => item.empresa_id === params[2] && item.loja_id === params[3] && item.idempotency_key === params[4]);
          if (row) row.status = params[0];
          return { rows: row ? [{ ...row }] : [] };
        }
        throw new Error(`SQL não modelado: ${sql}`);
      } });
    },
  };
  return db;
}

function context(overrides = {}) { return { ...CONTEXT, ...overrides }; }

 test('NPS aceita atendimento concluído com nota 0..10 e replay idêntico sem PII', async () => {
  const db = fakeDb();
  const input = { appointmentId: APPOINTMENT, nota: 10, telefone: '11 99999-8888', codigo: 'dino10', respondedAt: BASE_DATE };
  const first = await recordDinoNpsResponse(context(), input, db);
  const replay = await recordDinoNpsResponse(context(), input, db);
  assert.equal(first.replay, false);
  assert.equal(replay.replay, true);
  assert.equal(db.state.responses.length, 1);
  assert.equal('clienteTelefone' in first, false);
  assert.equal('comentario' in first, false);
});

test('NPS rejeita nota inválida, atendimento aberto, janela expirada e loja divergente', async () => {
  await assert.rejects(() => recordDinoNpsResponse(context(), { appointmentId: APPOINTMENT, nota: 11, respondedAt: BASE_DATE }, fakeDb()), e => e.code === 'NPS_SCORE_INVALID');
  await assert.rejects(() => recordDinoNpsResponse(context(), { appointmentId: APPOINTMENT, nota: 8, respondedAt: BASE_DATE }, fakeDb({ appointment: { status: 'agendado' } })), e => e.code === 'APPOINTMENT_NOT_COMPLETED');
  await assert.rejects(() => recordDinoNpsResponse(context(), { appointmentId: APPOINTMENT, nota: 8, respondedAt: '2026-03-01T12:00:00.000Z' }, fakeDb()), e => e.code === 'NPS_WINDOW_EXPIRED');
  await assert.rejects(() => recordDinoNpsResponse(context(), { appointmentId: APPOINTMENT, nota: 8, respondedAt: BASE_DATE }, fakeDb({ appointment: { loja_id: '66666666-6666-4666-8666-666666666666' } })), e => e.code === 'STORE_SCOPE_MISMATCH');
});

test('resposta divergente para o mesmo atendimento retorna 409', async () => {
  const db = fakeDb();
  const input = { appointmentId: APPOINTMENT, nota: 5, respondedAt: BASE_DATE };
  await recordDinoNpsResponse(context(), input, db);
  await assert.rejects(() => recordDinoNpsResponse(context({ fingerprint: 'b'.repeat(64) }), { ...input, nota: 6 }, db), e => e.statusCode === 409 && e.code === 'NPS_RESPONSE_CONFLICT');
});

test('overview calcula promotores, neutros, detratores e NPS apenas da loja', async () => {
  const db = fakeDb({ responses: [
    { empresa_id: TENANT, loja_id: STORE, agendamento_id: APPOINTMENT, nota: 10 },
    { empresa_id: TENANT, loja_id: STORE, agendamento_id: 'x', nota: 8 },
    { empresa_id: TENANT, loja_id: STORE, agendamento_id: 'y', nota: 2 },
    { empresa_id: TENANT, loja_id: 'other', agendamento_id: 'z', nota: 10 },
  ] });
  const result = await getDinoNpsOverview(context(), {}, db);
  assert.deepEqual(result, { empresaId: TENANT, lojaId: STORE, total: 3, promotores: 1, neutros: 1, detratores: 1, nps: 0 });
});

test('fila de processamento NPS é idempotente e marca status sem expor cliente', async () => {
  const db = fakeDb();
  const first = await queueDinoNpsProcessing(context(), { responseId: APPOINTMENT }, db);
  const replay = await queueDinoNpsProcessing(context(), { responseId: APPOINTMENT }, db);
  const marked = await markDinoNpsProcessing(context(), { responseId: APPOINTMENT, status: 'succeeded' }, db);
  assert.equal(first.replay, false);
  assert.equal(replay.replay, true);
  assert.equal(marked.status, 'succeeded');
  assert.equal('clienteTelefone' in marked, false);
});

test('contexto sem loja é bloqueado antes de qualquer leitura', async () => {
  await assert.rejects(() => getDinoNpsOverview({ empresaId: TENANT }, {}, fakeDb()), e => e.code === 'INVALID_SCOPE');
  await assert.rejects(() => recordDinoNpsResponse({ empresaId: TENANT }, { appointmentId: APPOINTMENT, nota: 10 }, fakeDb()), e => e.code === 'INVALID_SCOPE');
});
