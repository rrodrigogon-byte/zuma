import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularPacotesMensais,
  gerarScriptVendaPacotes,
  gerarMensagemAniversariante,
  extrairSocialCrm,
} from './dino-trex-sales-engine.js';

test('1. Cálculo de Pacotes Mensais: 10% (4x), 15% (6x) e 20% (8x) para Nati e Bruno (R$ 100)', () => {
  const calculo = calcularPacotesMensais({
    profissionalNome: 'Nati',
    valorServico: 100.0,
    servicoNome: 'Corte Premium',
  });

  assert.equal(calculo.valorUnitario, 100.0);
  assert.equal(calculo.pacotes.length, 3);

  // 4 sessões: R$ 400 - 10% = R$ 360 (Economia R$ 40)
  const p4 = calculo.pacotes.find((p) => p.sessoes === 4);
  assert.equal(p4.valorCheio, 400.0);
  assert.equal(p4.valorDesconto, 40.0);
  assert.equal(p4.valorFinal, 360.0);
  assert.equal(p4.economiaRealFormatada, 'R$ 40,00');

  // 6 sessões: R$ 600 - 15% = R$ 510 (Economia R$ 90)
  const p6 = calculo.pacotes.find((p) => p.sessoes === 6);
  assert.equal(p6.valorCheio, 600.0);
  assert.equal(p6.valorDesconto, 90.0);
  assert.equal(p6.valorFinal, 510.0);
  assert.equal(p6.economiaRealFormatada, 'R$ 90,00');

  // 8 sessões: R$ 800 - 20% = R$ 640 (Economia R$ 160)
  const p8 = calculo.pacotes.find((p) => p.sessoes === 8);
  assert.equal(p8.valorCheio, 800.0);
  assert.equal(p8.valorDesconto, 160.0);
  assert.equal(p8.valorFinal, 640.0);
  assert.equal(p8.economiaRealFormatada, 'R$ 160,00');
});

test('2. Script de Venda de Pacotes: Apresenta economia calculada e tom humanizado', () => {
  const script = gerarScriptVendaPacotes({
    clienteNome: 'Rodrigo Gonçalves',
    frequenciaDias: 15,
    profissionalNome: 'Nati',
    valorServico: 100.0,
    servicoNome: 'Corte Premium',
  });

  assert.ok(script.includes('Rodrigo'));
  assert.ok(script.includes('15 dias'));
  assert.ok(script.includes('10% OFF'));
  assert.ok(script.includes('R$ 360,00'));
  assert.ok(script.includes('R$ 40,00'));
  assert.ok(script.includes('R$ 90,00'));
  assert.ok(script.includes('R$ 160,00'));
});

test('3. Mensagem de Aniversário: Oferece brinde do bar (chope/café) e giro na roleta', () => {
  const msg = gerarMensagemAniversariante({
    clienteNome: 'Lucas Silveira',
    profissionalFavorito: 'Bruno',
  });

  assert.ok(msg.texto.includes('Lucas'));
  assert.ok(msg.texto.includes('aniversário'));
  assert.ok(msg.texto.includes('Chope Artesanal') || msg.texto.includes('chope'));
  assert.ok(msg.texto.includes('Roleta'));
  assert.ok(msg.brindes.length >= 2);
});

test('4. Social CRM: Extração de Instagram (@handle e url)', () => {
  const res1 = extrairSocialCrm('meu insta é @rodrigo_goncalves pode chamar');
  assert.equal(res1.instagram, '@rodrigo_goncalves');

  const res2 = extrairSocialCrm('segue lá instagram.com/barbeiro_bruno');
  assert.equal(res2.instagram, '@barbeiro_bruno');
});

test('5. Social CRM: Extração de LinkedIn', () => {
  const res = extrairSocialCrm('meu linkedin é https://www.linkedin.com/in/rodrigo-goncalves-ti');
  assert.equal(res.linkedin, 'https://www.linkedin.com/in/rodrigo-goncalves-ti');
});

test('6. Social CRM: Extração de Aniversário por data numérica e textual', () => {
  const res1 = extrairSocialCrm('meu niver é 15/08');
  assert.equal(res1.aniversario, '15/08');

  const res2 = extrairSocialCrm('faço aniversário dia 20 de maio');
  assert.equal(res2.aniversario, '20/05');
});
