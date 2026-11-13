import test from 'node:test'
import assert from 'node:assert/strict'
import { hojeAgenda, diasEntre, somarDias, periodoMes, diaDoItem, horaDoItem, filtrarAgenda, inicioDaSemana, semanaSegundaSabado, semanaCompleta, mesAnoLegivel, diaSemanaCurto, diaNumero, diaExtenso, isStatusCancelado, isItemCancelado } from './barbearia-calendar.js'

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

test('busca ignora acentos e exclui cancelados da agenda por padrão', () => {
  const itens = [
    { id: 1, servicoNome: 'Hidratação', status: 'agendado' },
    { id: 2, servicoNome: 'Hidratação', status: 'cancelado' },
    { id: 3, servicoNome: 'Corte', status: 'cancelado_falta_confirmacao' },
    { id: 4, servicoNome: 'Barba', status: 'nao_compareceu' },
    { id: 5, servicoNome: 'Corte degradê', status: 'confirmado' },
  ]
  assert.equal(filtrarAgenda(itens, { busca: 'hidratacao' }).length, 1)
  assert.deepEqual(filtrarAgenda(itens, { busca: 'HIDRATAÇÃO', status: 'agendado' }).map(i => i.id), [1])
  // Cancelados são excluídos por padrão na agenda
  assert.deepEqual(filtrarAgenda(itens).map(i => i.id), [1, 5])
  // Se explicitamente solicitado ver cancelados por status
  assert.deepEqual(filtrarAgenda(itens, { status: 'cancelado' }).map(i => i.id), [2])
  // Se incluirCancelados for true
  assert.equal(filtrarAgenda(itens, { incluirCancelados: true }).length, 5)
})

test('identificação canônica de status cancelado e item cancelado', () => {
  assert.equal(isStatusCancelado('cancelado'), true)
  assert.equal(isStatusCancelado('CANCELADO'), true)
  assert.equal(isStatusCancelado('cancelada'), true)
  assert.equal(isStatusCancelado('cancelado_falta_confirmacao'), true)
  assert.equal(isStatusCancelado('nao_compareceu'), true)
  assert.equal(isStatusCancelado('agendado'), false)
  assert.equal(isStatusCancelado('confirmado'), false)
  assert.equal(isStatusCancelado('em_atendimento'), false)
  assert.equal(isStatusCancelado('concluido'), false)

  assert.equal(isItemCancelado({ status: 'cancelado' }), true)
  assert.equal(isItemCancelado({ status: 'agendado', cancelado: true }), true)
  assert.equal(isItemCancelado({ status: 'confirmado' }), false)
})

test('helpers de semana comercial (Segunda a Sábado) e Google Agenda', () => {
  assert.equal(inicioDaSemana('2026-10-26'), '2026-10-26') // Segunda
  assert.equal(inicioDaSemana('2026-10-28'), '2026-10-26') // Quarta
  assert.equal(inicioDaSemana('2026-10-31'), '2026-10-26') // Sábado
  assert.equal(inicioDaSemana('2026-11-01'), '2026-10-26') // Domingo
  assert.deepEqual(semanaSegundaSabado('2026-10-28'), { de: '2026-10-26', ate: '2026-10-31' })
  assert.deepEqual(semanaCompleta('2026-10-28'), { de: '2026-10-26', ate: '2026-11-01' })
  assert.equal(mesAnoLegivel('2026-10-28'), 'Outubro de 2026')
  assert.equal(diaSemanaCurto('2026-10-26'), 'SEG')
  assert.equal(diaNumero('2026-10-26'), '26')
  assert.equal(diaExtenso('2026-10-27'), 'Terça-feira, 27 de Outubro de 2026')
})
