import test from 'node:test';
import assert from 'node:assert/strict';
import * as sorteiosServico from '../app/modules/sorteios/servico.js';

test('Sorteios Dino - Notificação de Parabéns via T-Rex com Proteção Anti-Bloqueio Meta', async (t) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  await t.test('1. Gerador KyttoIA produz textos polimórficos distintos para evitar detecção de spam pela Meta', () => {
    const campanha = {
      id: 'srt-camp-test',
      titulo: 'Mega Sorteio de Fim de Ano Dino: Moto 0km',
      premioPrincipal: 'Moto Honda Fan 160 0km',
    };
    const ganhador = {
      clienteNome: 'Rodrigo Gonçalves',
      clienteTelefone: '65999056008',
      numeroSorte: 'Série 01 - Nº 000003',
      sorteadoEm: new Date().toISOString(),
      hashAuditoria: 'e393250461d166f7b573dd2d7f7981b8041e507d2f5b03378ebb8287c0bb6110',
    };

    const mensagens = new Set();
    for (let i = 0; i < 20; i++) {
      const msg = sorteiosServico.gerarTextoNotificacaoGanhadorKyttoIA(campanha, ganhador);
      assert.ok(msg.includes('Rodrigo') || msg.includes('RODRIGO'), 'Deve conter o nome do ganhador');
      assert.ok(msg.includes('Moto Honda Fan 160 0km'), 'Deve conter o prêmio');
      assert.ok(msg.includes('Série 01 - Nº 000003'), 'Deve conter o número da sorte');
      assert.ok(msg.includes('T-Rex'), 'Deve conter a assinatura do T-Rex');
      mensagens.add(msg);
    }

    // Deve haver grande variedade de textos gerados (polimorfismo anti-bloqueio)
    assert.ok(mensagens.size >= 5, `Esperado polimorfismo com pelo menos 5 variações distintas, obtido: ${mensagens.size}`);
  });

  await t.test('2. Disparo de notificação oficial via T-Rex para Rodrigo Gonçalves registra envio e hash auditado', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaId);
    const camp = campanhas.find(c => c.status === 'sorteada') || campanhas[0];
    assert.ok(camp, 'Deve existir uma campanha de sorteio');

    const res = await sorteiosServico.notificarGanhadorViaTrex({
      empresaId,
      campanhaId: camp.id,
      telefoneDestino: '65999056008',
      nomeDestino: 'Rodrigo Gonçalves',
      enviarWhatsapp: false, // simulação auditada no teste unitário
    });

    assert.equal(res.ok, true);
    assert.equal(res.destinatario.nome, 'Rodrigo Gonçalves');
    assert.equal(res.destinatario.telefone, '65999056008');
    assert.ok(res.mensagemGerada.length > 50);
    assert.ok(res.hashAntiSpam);
    assert.ok(res.linkWhatsappWeb.includes('65999056008'));
  });
});
