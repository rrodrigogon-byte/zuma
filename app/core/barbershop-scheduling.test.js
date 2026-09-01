import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { createScheduledAppointment, listSchedulingAvailability, listSchedulingProfessionals, SchedulingError } from './barbershop-scheduling.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const PROF = '33333333-3333-4333-8333-333333333333';
const SERVICO = '44444444-4444-4444-8444-444444444444';

test('listSchedulingProfessionals fixa empresa e loja na consulta', async () => {
  const original = db.queryRead;
  let values;
  db.queryRead = async (_sql, params) => {
    values = params;
    return { rows: [{ id: PROF, nome_completo: 'Barbeiro Dino', telefone: '65999999999' }] };
  };
  try {
    const result = await listSchedulingProfessionals({ empresaId: EMPRESA, lojaId: LOJA });
    assert.deepEqual(values, [EMPRESA, LOJA]);
    assert.deepEqual(result, [{ id: PROF, nome: 'Barbeiro Dino', telefone: '65999999999' }]);
  } finally { db.queryRead = original; }
});

test('listSchedulingAvailability retorna somente horários futuros não ocupados', async () => {
  const original = db.queryRead;
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  db.queryRead = async sql => {
    if (sql.includes('FROM servicos')) return { rows: [{ id: SERVICO, nome: 'Corte', duracao_minutos: 30, preco: 50 }] };
    if (sql.includes('FROM usuarios')) return { rows: [{ id: PROF, nome_completo: 'Barbeiro Dino' }] };
    return { rows: [{ inicio: `${future}T08:00:00`, fim: `${future}T08:30:00` }] };
  };
  try {
    const result = await listSchedulingAvailability({ empresaId: EMPRESA, lojaId: LOJA }, { professionalId: PROF, serviceId: SERVICO, date: future });
    assert.equal(result.service.nome, 'Corte');
    assert.equal(result.professional.nome, 'Barbeiro Dino');
    assert.equal(result.slots.includes('08:00'), false);
    assert.equal(result.slots.includes('08:30'), true);
  } finally { db.queryRead = original; }
});

test('createScheduledAppointment usa lock tenant-scoped e grava somente após validar conflito', async () => {
  const calls = [];
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const trx = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT s.id AS servico_id')) return { rows: [{ servico_id: SERVICO, servico_nome: 'Corte', duracao_minutos: 30, preco: 50, profissional_id: PROF, profissional_nome: 'Barbeiro Dino' }] };
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [{}] };
      if (sql.includes('FROM agendamentos') && sql.includes('UNION ALL')) return { rows: [] };
      if (sql.includes('INSERT INTO agendamentos')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', data_agendamento: `${future}T10:00:00`, status: 'agendado' }] };
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  const result = await createScheduledAppointment(trx, { empresaId: EMPRESA, lojaId: LOJA }, { serviceId: SERVICO, professionalId: PROF, date: future, time: '10:00', customerName: 'Cliente Teste', customerPhone: '65999999999' });
  assert.equal(result.status, 'agendado');
  assert.equal(calls[0].params[2], EMPRESA);
  assert.equal(calls[0].params[3], LOJA);
  assert.match(calls[1].params[0], new RegExp(`${EMPRESA}:${LOJA}:${PROF}`));
  assert.equal(calls.at(-1).params[0], EMPRESA);
  assert.equal(calls.at(-1).params[1], LOJA);
});

test('createScheduledAppointment rejeita conflito sem inserir', async () => {
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let inserted = false;
  const trx = {
    async query(sql) {
      if (sql.includes('SELECT s.id AS servico_id')) return { rows: [{ servico_nome: 'Corte', duracao_minutos: 30, preco: 50, profissional_nome: 'Barbeiro Dino' }] };
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [{}] };
      if (sql.includes('FROM agendamentos') && sql.includes('UNION ALL')) return { rows: [{ '?column?': 1 }] };
      if (sql.includes('INSERT INTO agendamentos')) inserted = true;
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => createScheduledAppointment(trx, { empresaId: EMPRESA, lojaId: LOJA }, { serviceId: SERVICO, professionalId: PROF, date: future, time: '10:00', customerName: 'Cliente Teste', customerPhone: '65999999999' }),
    error => error instanceof SchedulingError && error.code === 'SLOT_UNAVAILABLE',
  );
  assert.equal(inserted, false);
});
