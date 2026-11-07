import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsappAiSystemPrompt, agendaContextFor } from './core/whatsapp-ai.js';
import { resolvePersona, sanitizePersonaInput } from './core/whatsapp-ai-persona.js';
import { obterConexao } from './whatsapp-conexao-kytto.js';

test('1. T-Rex (Barbearia Dino): prompt altamente especializado e sem dados de terceiros', () => {
  const dinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const persona = resolvePersona({}, {}, dinoId);
  assert.equal(persona.id, 'trex');
  assert.equal(persona.nome, 'T-Rex');

  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Barbearia Dino',
    persona,
    segment: 'barbearia',
    capabilities: { manageAppointments: true, operateStore: true }
  });

  // Validações da Barbearia Dino
  assert.ok(prompt.includes('T-Rex'), 'Deve conter identidade do T-Rex');
  assert.ok(prompt.includes('Bruno'), 'Deve conter o barbeiro Bruno');
  assert.ok(prompt.includes('Nati'), 'Deve conter a barbeira Nati');
  assert.ok(prompt.includes('Dino'), 'Deve conter menção ao Mestre Dino');
  assert.ok(prompt.includes('600'), 'Deve conter regra de atendimento noturno VIP R$ 600');
  assert.ok(prompt.includes('preparar_agendamento'), 'Deve orientar preparo de agendamento');

  // Isolamento estrito: NADA de Stallone nem Agro Open
  assert.ok(!prompt.includes('Stallone'), 'NÃO deve vazar nome da Stallone');
  assert.ok(!prompt.includes('Turbo'), 'NÃO deve conter o mascote Turbo');
  assert.ok(!prompt.includes('suplementos alimentares'), 'NÃO deve conter segmento de suplementos');
  assert.ok(!prompt.includes('beach tennis'), 'NÃO deve conter torneios de beach tennis');
});

test('2. Stallone Nutre Sport (Turbo): prompt 100% esportivo/suplementos sem corte de cabelo', () => {
  const stalloneId = '31f70c83-9172-40c2-945f-9e793b5048be';
  const persona = resolvePersona({}, {}, stalloneId);
  assert.equal(persona.id, 'stallone');
  assert.equal(persona.nome, 'Turbo');

  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Stallone Nutre Sport',
    persona,
    segment: 'suplementos',
    capabilities: { manageAppointments: false, operateStore: true }
  });

  // Validações da Stallone
  assert.ok(prompt.includes('Stallone'), 'Deve conter nome da Stallone');
  assert.ok(prompt.includes('Turbo'), 'Deve conter nome do assistente Turbo');
  assert.ok(prompt.includes('suplementos'), 'Deve conter foco em suplementos');
  assert.ok(prompt.includes('buscar_produtos'), 'Deve conter busca de produtos');

  // Isolamento estrito: NADA de Barbearia Dino, barbeiros ou cortes
  assert.ok(!prompt.includes('Barbearia Dino'), 'NÃO deve vazar Barbearia Dino');
  assert.ok(!prompt.includes('Mestre Dino'), 'NÃO deve citar Mestre Dino');
  assert.ok(!prompt.includes('Bruno e Nati são barbeiros'), 'NÃO deve conter regras de barbeiros');
  assert.ok(!prompt.includes('T-Rex da Barbearia'), 'NÃO deve se apresentar como T-Rex');
});

test('3. AGRO OPEN TTC: prompt focado em torneios e esportes sem barbearia nem medicamentos', () => {
  const agroId = '2e041110-db20-4fd1-8278-12bd3dead008';
  const persona = resolvePersona({}, {}, agroId);
  assert.equal(persona.id, 'agro_open');

  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'AGRO OPEN TTC',
    persona,
    segment: 'esporte',
    capabilities: { manageAppointments: false, operateStore: false }
  });

  // Validações da Agro Open
  assert.ok(prompt.includes('AGRO OPEN TTC'), 'Deve conter nome da Agro Open');
  assert.ok(prompt.includes('beach tennis') || prompt.includes('tênis'), 'Deve conter foco esportivo');

  // Isolamento estrito
  assert.ok(!prompt.includes('Barbearia Dino'), 'NÃO deve conter Barbearia Dino');
  assert.ok(!prompt.includes('Stallone'), 'NÃO deve conter Stallone');
  assert.ok(!prompt.includes('T-Rex'), 'NÃO deve conter T-Rex');
});

test('4. Isolamento de instâncias WhatsApp por tenant e tipo de canal', () => {
  const dinoId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const stalloneId = '31f70c83-9172-40c2-945f-9e793b5048be';
  const agroId = '2e041110-db20-4fd1-8278-12bd3dead008';

  // Dino
  const wppDinoCliente = obterConexao(dinoId, 'cliente');
  const wppDinoGestao = obterConexao(dinoId, 'gestao');
  const wppDinoLanc = obterConexao(dinoId, 'lancamentos');
  assert.equal(wppDinoCliente.instance, 'dino');
  assert.equal(wppDinoGestao.instance, 'barbearia-dino-gestao');
  assert.equal(wppDinoLanc.instance, 'barbearia-dino-lancamentos');

  // Stallone
  const wppStalloneCliente = obterConexao(stalloneId, 'cliente');
  const wppStalloneGestao = obterConexao(stalloneId, 'gestao');
  const wppStalloneLanc = obterConexao(stalloneId, 'lancamentos');
  assert.equal(wppStalloneCliente.instance, 'stallone-1');
  assert.equal(wppStalloneGestao.instance, 'stallone-gestao');
  assert.equal(wppStalloneLanc.instance, 'stallone-lancamentos');

  // Agro Open
  const wppAgroCliente = obterConexao(agroId, 'cliente');
  const wppAgroGestao = obterConexao(agroId, 'gestao');
  const wppAgroLanc = obterConexao(agroId, 'lancamentos');
  assert.equal(wppAgroCliente.instance, 'agro-open');
  assert.equal(wppAgroGestao.instance, 'agro-open-gestao');
  assert.equal(wppAgroLanc.instance, 'agro-open-lancamentos');
});

test('5. agendaContextFor não executa para lojas de suplementos ou sem agendamento', async () => {
  const resSuplementos = await agendaContextFor({
    segment: 'suplementos',
    capabilities: { manageAppointments: false }
  });
  assert.equal(resSuplementos.text, '');
  assert.equal(resSuplementos.results.length, 0);

  const resEsportes = await agendaContextFor({
    segment: 'esporte',
    capabilities: { manageAppointments: false }
  });
  assert.equal(resEsportes.text, '');
  assert.equal(resEsportes.results.length, 0);
});
