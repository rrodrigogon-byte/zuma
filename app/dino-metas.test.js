import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'metas-')), 'db.json');
const metas = await import('./dino-metas.js');

test('metas: salvar, limpar e validar por empresa', () => {
  assert.deepEqual(metas.obterMetas('e1'), { receita: null, resultado: null, atendimentos: null, ticketMedio: null, novosClientes: null });
  metas.salvarMetas('e1', { receita: '30000', atendimentos: 400, ticketMedio: '75,5' }, 'gestor');
  assert.equal(metas.obterMetas('e1').receita, 30000);
  assert.equal(metas.obterMetas('e1').ticketMedio, 75.5);
  assert.equal(metas.obterMetas('e2').receita, null, 'outra empresa sem metas');
  metas.salvarMetas('e1', { atendimentos: '' });
  assert.equal(metas.obterMetas('e1').atendimentos, null);
  assert.throws(() => metas.salvarMetas('e1', { receita: -1 }), /inválida/);
});

test('progresso projeta pelo ritmo e trata média sem projetar', () => {
  const items = metas.progressoMetas({ receita: 30000, atendimentos: 300, ticketMedio: 80 }, { receita: 12000, atendimentos: 80, ticketMedio: 82 }, { day: 10, daysInMonth: 30 });
  const receita = items.find((item) => item.id === 'receita');
  assert.equal(receita.projecao, 36000);
  assert.equal(receita.status, 'no_ritmo');
  assert.equal(receita.progress, 40);
  assert.equal(items.find((item) => item.id === 'atendimentos').status, 'abaixo');
  const ticket = items.find((item) => item.id === 'ticketMedio');
  assert.equal(ticket.status, 'atingida');
  assert.equal(ticket.projecao, 82);
  assert.equal(items.length, 3, 'só metas configuradas');
});

test('janela do mês começa à meia-noite de Cuiabá', () => {
  const win = metas.monthWindow(new Date('2026-09-25T23:00:00Z'));
  assert.equal(win.fromDate.toISOString(), '2026-09-01T04:00:00.000Z');
  assert.equal(win.day, 25);
  assert.equal(win.daysInMonth, 30);
  assert.equal(metas.monthWindow(new Date('2026-10-01T02:00:00Z')).label, '09/2026', 'ainda 30/09 em Cuiabá');
});
