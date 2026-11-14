import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularPacotesMensais,
  gerarScriptVendaPacotes,
  gerarMensagemAniversariante,
  extrairSocialCrm,
} from './core/dino-trex-sales-engine.js';

test('1. API Simulador de Pacotes: Retorna cálculos estruturados e script persuasivo', () => {
  const calculo = calcularPacotesMensais({
    profissionalNome: 'Bruno Mendes',
    valorServico: 100.0,
    servicoNome: 'Corte Premium',
  });

  assert.equal(calculo.pacotes.length, 3);
  assert.equal(calculo.pacotes[0].descontoPercentual, 10);
  assert.equal(calculo.pacotes[1].descontoPercentual, 15);
  assert.equal(calculo.pacotes[2].descontoPercentual, 20);

  const script = gerarScriptVendaPacotes({
    clienteNome: 'Cauã',
    frequenciaDias: 15,
    profissionalNome: 'Bruno Mendes',
    valorServico: 100.0,
  });

  assert.ok(script.includes('Cauã'));
  assert.ok(script.includes('Bruno Mendes'));
  assert.ok(script.includes('Pacotes Mensais VIP do Dino'));
});

test('2. API Social CRM: Extração com múltiplos handles e aniversários combinados', () => {
  const texto = 'Fala T-Rex, meu insta é @caua_rafael e meu linkedin https://www.linkedin.com/in/caua-rafael. Faço niver 14/11!';
  const extraido = extrairSocialCrm(texto);

  assert.equal(extraido.instagram, '@caua_rafael');
  assert.equal(extraido.linkedin, 'https://www.linkedin.com/in/caua-rafael');
  assert.equal(extraido.aniversario, '14/11');
});

test('3. API Mensagem Aniversário: Gera mensagem com chope/café cortesia', () => {
  const resultado = gerarMensagemAniversariante({
    clienteNome: 'Rodrigo',
    profissionalFavorito: 'Nati',
  });

  assert.ok(resultado.texto.includes('Rodrigo'));
  assert.ok(resultado.texto.includes('aniversário'));
  assert.ok(resultado.texto.includes('Café Espresso') || resultado.texto.includes('Chope Artesanal'));
  assert.ok(resultado.texto.includes('Nati'));
});
