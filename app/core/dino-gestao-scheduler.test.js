import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterHoraMinutoCuiaba,
  obterStatusAgendadorDino,
  verificarGatilhosHorario,
  executarPautaDiaria,
  executarFechamentoNoturno
} from './dino-gestao-scheduler.js';

test('dino-gestao-scheduler: cálculo de fuso horário Cuiabá/MT', () => {
  const agora = new Date();
  const horario = obterHoraMinutoCuiaba(agora);
  assert.ok(typeof horario.hora === 'number');
  assert.ok(typeof horario.minuto === 'number');
  assert.ok(/^\d{2}:\d{2}$/.test(horario.texto));
});

test('dino-gestao-scheduler: status operacional retorna dados consistentes', () => {
  const status = obterStatusAgendadorDino();
  assert.equal(status.ativo, true);
  assert.ok(Array.isArray(status.destinatariosOficiais));
  assert.ok(status.destinatariosOficiais.length >= 2);
  assert.ok(status.janelaPautaMatinal.includes('08:30'));
  assert.ok(status.janelaFechamentoNoturno.includes('20:00'));
});

test('dino-gestao-scheduler: disparo controlado de pauta diária (mocked/safe)', async () => {
  const resultado = await executarPautaDiaria({ forcar: true, targetPhones: ['5514997462929'] });
  assert.equal(resultado.executado, true);
  assert.ok(resultado.resultado.totalDisparados >= 1);
  assert.ok(resultado.resultado.ok === true);
});

test('dino-gestao-scheduler: disparo controlado de fechamento noturno (mocked/safe)', async () => {
  const resultado = await executarFechamentoNoturno({ forcar: true, targetPhones: ['5514997462929'] });
  assert.equal(resultado.executado, true);
  assert.ok(Array.isArray(resultado.resultado.envios));
  assert.ok(resultado.resultado.envios.length >= 1);
});

test('dino-gestao-scheduler: idempotência impede disparo duplo no mesmo dia sem flag forcar', async () => {
  const tentativaDuplicada = await executarPautaDiaria({ forcar: false });
  assert.equal(tentativaDuplicada.executado, false);
  assert.ok(tentativaDuplicada.motivo.includes('já foi enviada'));
});

test('dino-gestao-scheduler: verificação de gatilhos com horário simulado fora de janela', async () => {
  // Simula 14h30 (fora de janela)
  const dataFora = new Date('2026-11-15T18:30:00Z'); // 18:30 UTC = 14:30 Cuiabá
  const check = await verificarGatilhosHorario(dataFora);
  assert.ok(check.horarioCuiaba);
  assert.equal(check.acoesExecutadas.length, 0);
});
