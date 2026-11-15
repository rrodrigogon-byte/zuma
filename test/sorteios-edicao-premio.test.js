import test from 'node:test';
import assert from 'node:assert/strict';
import * as sorteiosServico from '../app/modules/sorteios/servico.js';

test('Sorteios Dino: Edição de Prêmio e Atualização de Campanha', async (t) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  await t.test('1. Criar ou obter campanha existente', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaId);
    assert.ok(campanhas.length > 0, 'Deve existir ao menos uma campanha de sorteio');
    const camp = campanhas[0];
    assert.ok(camp.id, 'Campanha deve conter ID');
    assert.ok(camp.premioPrincipal, 'Campanha deve conter prêmio principal');
  });

  await t.test('2. Atualizar o prêmio principal da campanha (Edição de Prêmio)', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaId);
    const camp = campanhas[0];
    const premioNovo = 'Moto Honda Fan 160 0km 2027 + Capacete Oficial Dino';

    const atualizada = await sorteiosServico.atualizarCampanha(empresaId, camp.id, {
      premioPrincipal: premioNovo,
      descricao: 'Descrição atualizada pelo gerente via modal de edição de prêmio.',
    });

    assert.equal(atualizada.premioPrincipal, premioNovo, 'O prêmio principal deve ter sido atualizado');
    assert.equal(atualizada.descricao, 'Descrição atualizada pelo gerente via modal de edição de prêmio.');

    // Verificar se a consulta subsequente reflete a alteração
    const conferida = await sorteiosServico.obterCampanha(empresaId, camp.id);
    assert.equal(conferida.premioPrincipal, premioNovo, 'A consulta da campanha deve refletir o novo prêmio');
  });

  await t.test('3. Atualização de regras e prazo do sorteio', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaId);
    const camp = campanhas[0];
    const dataNova = '2026-12-30T20:00:00-04:00';

    const atualizada = await sorteiosServico.atualizarCampanha(empresaId, camp.id, {
      dataSorteio: dataNova,
      regras: {
        valorMinimoBilhete: 60,
        multiplicadorPerfumaria: 3,
        bonusClube: 5,
      }
    });

    assert.equal(atualizada.dataSorteio, dataNova);
    assert.equal(atualizada.regras.valorMinimoBilhete, 60);
    assert.equal(atualizada.regras.multiplicadorPerfumaria, 3);
    assert.equal(atualizada.regras.bonusClube, 5);
  });
});
