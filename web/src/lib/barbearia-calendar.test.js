import test from 'node:test'
import assert from 'node:assert/strict'
import { hojeAgenda, diasEntre, somarDias, periodoMes, diaDoItem, horaDoItem, filtrarAgenda } from './barbearia-calendar.js'
test('dia operacional usa Cuiabá mesmo após meia-noite UTC', () => {
  assert.equal(hojeAgenda(new Date('2026-10-06T02:30:00Z')), '2026-10-05')
  assert.equal(diaDoItem({ dataHora: '2026-10-06T02:30:00Z' }), '2026-10-05')
  assert.equal(horaDoItem({ dataHora: '2026-10-06T02:30:00Z' }), '22:30')
})
test('períodos validam limite, datas impossíveis, inversão e ano bissexto', () => {
  assert.deepEqual(diasEntre('2026-02-30', '2026-03-01'), [])
  assert.deepEqual(diasEntre('2026-10-09', '2026-10-05'), [])
  assert.deepEqual(diasEntre('', ''), [])
  assert.equal(diasEntre('2026-01-01', '2026-03-03').length, 62)
  assert.equal(diasEntre('2026-01-01', '2026-03-04').length, 0)
  assert.equal(somarDias('2028-02-28', 1), '2028-02-29')
  assert.deepEqual(periodoMes('2026-12-31', 1), { de: '2027-01-01', ate: '2027-01-31' })
})
test('busca ignora acentos e respeita status sem excluir cancelados por padrão', () => {
  const itens = [{ id: 1, servicoNome: 'Hidratação', status: 'agendado' }, { id: 2, servicoNome: 'Hidratação', status: 'cancelado' }]
  assert.equal(filtrarAgenda(itens, { busca: 'hidratacao' }).length, 2)
  assert.deepEqual(filtrarAgenda(itens, { busca: 'HIDRATAÇÃO', status: 'agendado' }).map(i => i.id), [1])
})
