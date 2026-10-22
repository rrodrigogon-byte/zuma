import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStrictAgendaSource } from './barbershop-agenda.js';

test('sem mapeamento, usa somente PostgreSQL escopado e não consulta JSON forçado', () => {
  assert.equal(resolveStrictAgendaSource({ mappingValid: false }), 'postgres');
  assert.equal(resolveStrictAgendaSource({ mappingValid: false, forced: 'barbearia', hasLegacyRows: true }), 'indisponivel');
  assert.equal(resolveStrictAgendaSource({ mappingValid: false, forced: 'postgres' }), 'postgres');
});

test('agenda JSON só é selecionada quando há registros da unidade mapeada', () => {
  assert.equal(resolveStrictAgendaSource({ mappingValid: true, hasLegacyRows: true }), 'barbearia');
  assert.equal(resolveStrictAgendaSource({ mappingValid: true, forced: 'barbearia', hasLegacyRows: false }), 'indisponivel');
});

test('atividade ou equipe de outra loja não escolhe JSON para a unidade sem evidência local', () => {
  assert.equal(resolveStrictAgendaSource({ mappingValid: true, hasLegacyRows: false, hasPostgresRows: false }), 'indisponivel');
  assert.equal(resolveStrictAgendaSource({ mappingValid: true, hasLegacyRows: false, hasPostgresRows: true }), 'postgres');
});

test('PostgreSQL com agenda futura é mantido quando não há conflito JSON na mesma unidade', () => {
  assert.equal(resolveStrictAgendaSource({ mappingValid: true, hasPostgresFuture: true }), 'postgres');
});

test('reservas futuras nas duas fontes da mesma unidade resultam em conflito, sem mistura', () => {
  assert.equal(resolveStrictAgendaSource({ mappingValid: true, hasLegacyRows: true, hasLegacyFuture: true, hasPostgresFuture: true }), 'conflito');
});
