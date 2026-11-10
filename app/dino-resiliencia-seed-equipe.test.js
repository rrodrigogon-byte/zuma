import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionarEquipeDino, PROFISSIONAIS_DINO_OFICIAIS, PROFISSIONAIS_DINO_DESLIGADOS, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

test('Resiliência de Equipe e Preservação de Horários da Barbearia Dino', async (t) => {
  await t.test('1. Equipe oficial ativa deve conter apenas profissionais em atividade', () => {
    const usernames = PROFISSIONAIS_DINO_OFICIAIS.map(p => p.username);
    assert.ok(usernames.includes('dino'), 'Dino deve estar na equipe');
    assert.ok(usernames.includes('natani'), 'Nati deve estar na equipe');
    assert.ok(usernames.includes('ster'), 'Ster deve estar na equipe');
    assert.ok(usernames.includes('jhenyffer'), 'Jhenyffer deve estar na equipe');

    // Desligados NÃO devem constar como ativos
    assert.ok(!usernames.includes('bruno'), 'Bruno não deve estar no seed de ativos');
    assert.ok(!usernames.includes('david'), 'David não deve estar no seed de ativos');
    assert.ok(!usernames.includes('amanda'), 'Amanda não deve estar no seed de ativos');
    assert.ok(!usernames.includes('joao'), 'João não deve estar no seed de ativos');
  });

  await t.test('2. Dino deve estar configurado como atendimento 24x7 por padrão', () => {
    const dino = PROFISSIONAIS_DINO_OFICIAIS.find(p => p.username === 'dino');
    assert.equal(dino.atendimento24x7, true);
    assert.equal(dino.horarioInicioPadrao, '00:00');
    assert.equal(dino.horarioFimPadrao, '23:59');
  });

  await t.test('3. Execução do provisionamento deve manter ex-funcionários inativos', () => {
    const res = provisionarEquipeDino();
    assert.ok(res.ok);

    const listaAtivos = barbeariaErpKytto.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: false });
    const nomesAtivos = listaAtivos.map(p => p.nome.toLowerCase());

    assert.ok(!nomesAtivos.some(n => n.includes('bruno mendes')), 'Bruno não deve constar na lista de ativos');
    assert.ok(!nomesAtivos.some(n => n.includes('david kauã')), 'David não deve constar na lista de ativos');
    assert.ok(!nomesAtivos.some(n => n.includes('amanda gabrielly')), 'Amanda não deve constar na lista de ativos');
  });
});
