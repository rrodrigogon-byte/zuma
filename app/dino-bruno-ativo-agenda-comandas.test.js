import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { provisionarEquipeDino, PROFISSIONAIS_DINO_OFICIAIS, PROFISSIONAIS_DINO_DESLIGADOS } from './dino-equipe-seed.js';
import * as barbearia from './barbearia-erp-kytto.js';

describe('Blindagem do Barbeiro Bruno Mendes Pedroso na Barbearia Dino', () => {
  const EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  test('1. Bruno Mendes deve constar na equipe oficial ativa e NÃO na lista de desligados', () => {
    const brunoOficial = PROFISSIONAIS_DINO_OFICIAIS.find((p) => p.username === 'bruno' || p.nome.includes('Bruno Mendes'));
    assert.ok(brunoOficial, 'Bruno Mendes deve estar na lista PROFISSIONAIS_DINO_OFICIAIS');
    assert.equal(brunoOficial.role, 'profissional');

    const brunoDesligado = PROFISSIONAIS_DINO_DESLIGADOS.some((d) => d === 'bruno' || d === 'bruno mendes pedroso');
    assert.equal(brunoDesligado, false, 'Bruno Mendes NÃO pode constar na lista de desligados');

    const brunoRafaelDesligado = PROFISSIONAIS_DINO_DESLIGADOS.includes('bruno rafael');
    assert.equal(brunoRafaelDesligado, true, 'Bruno Rafael (ex-barbeiro) deve estar na lista de desligados');
  });

  test('2. Execução do provisionamento deve manter Bruno Mendes 100% ativo e presente na listagem', () => {
    provisionarEquipeDino();
    const profs = barbearia.listarProfissionais(EMPRESA_ID);
    const bruno = profs.find((p) => p.nome.includes('Bruno') && !p.nome.includes('Bruno Rafael'));
    assert.ok(bruno, 'Bruno Mendes deve ser retornado na listagem de profissionais ativos');
    assert.equal(bruno.ativo, true, 'Bruno Mendes deve estar com ativo=true');
    assert.equal(Boolean(bruno.removidoEm), false, 'Bruno Mendes não pode ter removidoEm');
  });

  test('3. Adicionar item de pacote ou serviço para o Bruno na comanda não pode dar erro de profissional inativo', () => {
    const profs = barbearia.listarProfissionais(EMPRESA_ID);
    const bruno = profs.find((p) => p.nome.includes('Bruno') && !p.nome.includes('Bruno Rafael'));
    assert.ok(bruno);

    const comanda = barbearia.criarComandaBarbearia(EMPRESA_ID, {
      clienteNome: 'Cliente Teste Bruno Validação',
      clienteTelefone: '65999990001',
      profissionalId: bruno.id
    });

    // Teste com o ID exato
    const comandaItem1 = barbearia.adicionarItensComandaBarbearia(EMPRESA_ID, comanda.id, [
      {
        tipo: 'pacote',
        nome: 'Procedimento pacote',
        preco: 0,
        quantidade: 2,
        profissionalId: bruno.id
      }
    ]);
    assert.equal(comandaItem1.itens.length, 1);
    assert.equal(comandaItem1.itens[0].profissionalId, bruno.id);

    // Teste com o alias 'Bruno'
    const comandaItem2 = barbearia.adicionarItensComandaBarbearia(EMPRESA_ID, comanda.id, [
      {
        tipo: 'outro',
        nome: 'Procedimento avulso',
        preco: 50,
        quantidade: 1,
        profissionalId: 'Bruno'
      }
    ]);
    assert.equal(comandaItem2.itens.length, 2);
    assert.equal(comandaItem2.itens[1].profissionalId, bruno.id);
  });
});
