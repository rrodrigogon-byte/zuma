import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './db.js';
import * as unificacao from './barbearia-cliente-unificacao.js';

test('Unificação e gestão avançada de clientes da barbearia', async (t) => {
  const empId = `test-unificacao-${Date.now()}`;
  const root = db();
  root.barbearias ||= {};
  root.barbearias[empId] = {
    agendamentos: {
      'age-1': { id: 'age-1', clienteId: 'cli-sec-1', clienteNome: 'Pablo Secundario', clienteTelefone: '5565996946939', valor: 60 },
    },
    comandas: {
      'cmd-1': { id: 'cmd-1', clienteId: 'cli-sec-1', clienteNome: 'Pablo Secundario', clienteTelefone: '5565996946939', total: 60 },
    },
    assinaturas: {
      'ass-1': { id: 'ass-1', clienteId: 'cli-sec-1', planoId: 'plano-club', clienteNome: 'Pablo Secundario' },
    },
    historicoAtendimentos: {
      'hist-1': { id: 'hist-1', clienteId: 'cli-sec-1', servicoNome: 'Barba Club', valor: 0 },
    },
  };
  root.clientesKytto ||= { empresas: {} };
  root.clientesKytto.empresas[empId] = {
    clientes: {
      'cli-master': { id: 'cli-master', nome: 'Pablo Selle', telefone: '65996946939', status: 'ativo' },
      'cli-sec-1': { id: 'cli-sec-1', nome: 'Pablo Selle (Secundario)', telefone: '5565996946939', email: 'pablo@exemplo.com', status: 'ativo' },
    },
  };

  await t.test('normalizarTelefoneBR remove DDI 55 de telefones brasileiros', () => {
    assert.equal(unificacao.normalizarTelefoneBR('5565996946939'), '65996946939');
    assert.equal(unificacao.normalizarTelefoneBR('+55 (65) 99694-6939'), '65996946939');
    assert.equal(unificacao.normalizarTelefoneBR('65996946939'), '65996946939');
  });

  await t.test('listarDuplicados identifica clientes com o mesmo telefone', () => {
    const dupes = unificacao.listarDuplicados(empId);
    assert.equal(dupes.length, 1);
    assert.equal(dupes[0].telefone, '65996946939');
    assert.equal(dupes[0].total, 2);
  });

  await t.test('unificarClientes migra comandas, agendamentos, assinaturas e marca secundário', () => {
    const res = unificacao.unificarClientes(empId, 'cli-master', ['cli-sec-1']);
    assert.equal(res.ok, true);
    assert.equal(res.unificados, 1);
    assert.equal(res.principal.email, 'pablo@exemplo.com');

    // Verifica se os agendamentos e comandas apontam para o master
    assert.equal(root.barbearias[empId].agendamentos['age-1'].clienteId, 'cli-master');
    assert.equal(root.barbearias[empId].comandas['cmd-1'].clienteId, 'cli-master');
    assert.equal(root.barbearias[empId].assinaturas['ass-1'].clienteId, 'cli-master');
    assert.equal(root.barbearias[empId].historicoAtendimentos['hist-1'].clienteId, 'cli-master');

    // Verifica status do secundário
    const sec = root.clientesKytto.empresas[empId].clientes['cli-sec-1'];
    assert.equal(sec.status, 'mesclado');
    assert.equal(sec.mescladoPara, 'cli-master');
  });

  await t.test('excluirClienteBarbearia inativa o cliente logicamente', () => {
    const del = unificacao.excluirClienteBarbearia(empId, 'cli-master', { motivo: 'Teste exclusão' });
    assert.equal(del.ok, true);
    assert.equal(root.clientesKytto.empresas[empId].clientes['cli-master'].status, 'deletado');
  });
});
