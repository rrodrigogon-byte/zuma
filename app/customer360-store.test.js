import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c360-')), 'db.json');
process.env.DB_PATH = tmp;
const { db } = await import('./db.js');
const store = await import('./customer360-store.js');

function seed() {
  const state = db();
  state.clientesKytto = { empresas: { e1: { clientes: {
    c1: { id: 'c1', empresaId: 'e1', nome: 'João Silva', telefone: '(65) 99336-0000', email: 'joao@x.com', cpfCnpj: '123', endereco: 'Rua A', observacao: 'gosta de café', consentimentos: { whatsapp: { marketing: { concedido: true } } }, consentimentoHistorico: [] },
    c2: { id: 'c2', empresaId: 'e1', nome: 'Maria', telefone: '65 98888-1111' },
  }, contasReceber: {}, alertas: {}, fechamentoDiario: {} } } };
  state.barbearias = { e1: {
    agendamentos: { a1: { id: 'a1', clienteId: 'c1', clienteNome: 'João Silva', clienteTelefone: '65993360000', valor: 45 }, a2: { id: 'a2', clienteId: '', clienteNome: 'João avulso', clienteTelefone: '(65) 99336-0000' }, a3: { id: 'a3', clienteId: 'c2', clienteNome: 'Maria' } },
    comandas: { k1: { id: 'k1', clienteId: 'c1', clienteNome: 'João Silva', total: 75 } },
  } };
  state.canaisKytto = { empresas: { e1: { fidelidade: { membros: { f1: { id: 'f1', clienteId: 'c1', nome: 'João Silva', telefone: '65993360000', pontos: 10 } } } } } };
  state.customer360Kytto = { empresas: {} };
}

test('vínculo e separação são exclusivos por par e persistem por empresa', () => {
  seed();
  store.linkRecords('e1', { a: 'dino:c2', b: 'loja:x', operador: 'Ana' });
  assert.deepEqual(store.identityRules('e1').links, [{ a: 'dino:c2', b: 'loja:x' }]);
  store.separateRecords('e1', { a: 'loja:x', b: 'dino:c2', operador: 'Ana' });
  assert.deepEqual(store.identityRules('e1'), { links: [], separations: [{ a: 'loja:x', b: 'dino:c2' }] });
  assert.deepEqual(store.identityRules('outra'), { links: [], separations: [] });
  assert.throws(() => store.linkRecords('e1', { a: 'dino:c1', b: 'dino:c1' }), /diferentes/);
});

test('notas: leitura por qualquer ref da pessoa, remoção só pelo autor ou admin', () => {
  seed();
  const nota = store.addNote('e1', { refs: ['dino:c1', 'loja:y'], texto: 'Prefere horário da manhã', autor: 'Ana (staff)' });
  assert.equal(store.listNotes('e1', ['loja:y'])[0].id, nota.id);
  assert.equal(store.listNotes('e1', ['dino:c2']).length, 0);
  assert.throws(() => store.addNote('e1', { refs: ['dino:c1'], texto: ' ' }), /Escreva/);
  assert.throws(() => store.removeNote('e1', { refs: ['dino:c1'], noteId: nota.id, autor: 'Outro (staff)', isAdmin: false }), /autor/);
  store.removeNote('e1', { refs: ['dino:c1'], noteId: nota.id, autor: 'Outro (admin)', isAdmin: true });
  assert.equal(store.listNotes('e1', ['dino:c1']).length, 0);
});

test('etiquetas normalizadas, sem duplicar entre refs da mesma pessoa', () => {
  seed();
  assert.deepEqual(store.normalizeTags(' VIP, barba ,vip,,'), ['vip', 'barba']);
  store.setTags('e1', { refs: ['dino:c1', 'loja:y'], canonicalRef: 'dino:c1', tags: ['VIP', 'Barba'] });
  store.setTags('e1', { refs: ['dino:c1', 'loja:y'], canonicalRef: 'dino:c1', tags: ['barba', 'perfume'] });
  assert.deepEqual(store.listTags('e1', ['loja:y', 'dino:c1']), ['barba', 'perfume']);
  assert.deepEqual(store.allTags('e1'), [{ tag: 'barba', total: 1 }, { tag: 'perfume', total: 1 }]);
});

test('anonimização remove dados pessoais só do titular e preserva valores', () => {
  seed();
  store.addNote('e1', { refs: ['dino:c1'], texto: 'nota sobre o João', autor: 'Ana' });
  store.setTags('e1', { refs: ['dino:c1'], canonicalRef: 'dino:c1', tags: ['vip'] });
  const counts = store.anonymizeLocalCustomer('e1', { clientIds: ['c1'], phones: ['65993360000'], refs: ['dino:c1'], operador: 'Rodrigo (admin)' });
  assert.deepEqual(counts, { clientes: 1, agendamentos: 2, comandas: 1, vendas: 0, filas: 0, planos: 0, fidelidade: 1, notas: 1, etiquetas: 1 });
  const c1 = db().clientesKytto.empresas.e1.clientes.c1;
  assert.equal(c1.nome, 'Titular anonimizado');
  assert.equal(c1.cpfCnpj + c1.email + c1.telefone + c1.endereco + c1.observacao, '');
  assert.equal(c1.consentimentos.whatsapp.marketing.concedido, false);
  assert.ok(c1.anonimizadoEm);
  const agenda = db().barbearias.e1.agendamentos;
  assert.equal(agenda.a1.clienteNome, 'Titular anonimizado');
  assert.equal(agenda.a1.valor, 45, 'valores ficam');
  assert.equal(agenda.a2.clienteTelefone, '', 'agendamento avulso pelo telefone também');
  assert.equal(agenda.a3.clienteNome, 'Maria', 'outra cliente intacta');
  assert.equal(db().clientesKytto.empresas.e1.clientes.c2.nome, 'Maria');
  assert.equal(db().barbearias.e1.comandas.k1.total, 75);
  assert.equal(db().canaisKytto.empresas.e1.fidelidade.membros.f1.nome, 'Titular anonimizado');
  assert.equal(db().canaisKytto.empresas.e1.fidelidade.membros.f1.pontos, 10);
  assert.equal(store.listNotes('e1', ['dino:c1']).length, 0);
  assert.deepEqual(store.listTags('e1', ['dino:c1']), []);
});

test('histórico local encontra só as entradas do titular', () => {
  seed();
  db().auditoria = [
    { ts: '2026-09-25T10:00:00Z', user: 'Ana (staff)', acao: 'VIEW CUSTOMER360', detalhe: 'ref=dino:c1' },
    { ts: '2026-09-25T10:01:00Z', user: 'Ana (staff)', acao: 'VIEW CUSTOMER360', detalhe: 'ref=dino:c2' },
    { ts: '2026-09-25T10:02:00Z', user: 'Rodrigo (admin)', acao: 'REVEAL CUSTOMER360', detalhe: 'ref=dino:c1; campo=telefone; motivo=retorno' },
    { ts: '2026-09-25T10:03:00Z', user: 'x', acao: 'POST /api/admin/x', detalhe: 'ref=dino:c1' },
  ];
  const history = store.localAccessHistory(['dino:c1']);
  assert.deepEqual(history.map((item) => item.acao), ['reveal', 'view']);
  assert.equal(history[0].detalhe, 'campo=telefone; motivo=retorno');
});
