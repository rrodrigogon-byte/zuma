process.env.BARBEARIA_AGENDA_FONTE = 'barbearia';
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePersona, personaIntroduction, personaRobotAnswer, personaRobotQuestion } from './whatsapp-ai-persona.js';
import { createWhatsappAiToolExecutor } from './whatsapp-ai-tools.js';
import { customerContextFor } from './whatsapp-ai.js';
import * as clientesKytto from '../clientes-contas-kytto.js';
import * as barbearia from '../barbearia-erp-kytto.js';

test('T-Rex: identidade humana e acolhedora sem se apresentar como robô ou IA', () => {
  const persona = resolvePersona({ persona: { id: 'trex' } }, {}, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  assert.equal(persona.nome, 'T-Rex');

  const intro = personaIntroduction(persona, 'Barbearia Dino');
  assert.match(intro, /T-Rex/);
  assert.match(intro, /novo por aqui/i);
  assert.match(intro, /apoiar/i);
  assert.doesNotMatch(intro, /assistente virtual|robô|inteligência artificial/i);

  // Pergunta direta: "Você é robô?"
  assert.equal(personaRobotQuestion('você é robô?'), true);
  assert.equal(personaRobotQuestion('é uma IA?'), true);
  const respRobo = personaRobotAnswer(persona, 'Barbearia Dino', 'test-seed');
  assert.match(respRobo, /T-Rex/);
  assert.match(respRobo, /novo por aqui|cheguei faz pouco tempo/i);
  assert.match(respRobo, /equipe/i);
  assert.doesNotMatch(respRobo, /assistente virtual|sou um robô|modelo de linguagem/i);
});

test('T-Rex: consultar_cadastro_cliente e atualizar_cadastro_cliente salvam e recuperam dados', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const phone = '5565988887777';

  const context = {
    empresaId,
    lojaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    canalId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    sessionId: 'b1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    phone,
    customerName: 'Marcos Vinicius',
    capabilities: { captureLeads: true, manageAppointments: true },
  };

  const execute = createWhatsappAiToolExecutor(context);

  // 1. Consulta inicial: ainda sem cadastro completo
  const consulta1 = await execute('consultar_cadastro_cliente', {});
  assert.equal(consulta1.ok, true);
  assert.ok(Array.isArray(consulta1.camposPendentes));

  // 2. Atualização cadastral progressiva informada pelo cliente
  const atualizacao = await execute('atualizar_cadastro_cliente', {
    nome: 'Marcos Vinicius',
    aniversario: '15/08',
    bairro: 'Jardim das Américas',
    cidade: 'Cuiabá',
    estadoCivil: 'casado',
    conjugeNome: 'Juliana',
    conjugeAniversario: '22/10',
    bebida: 'Café expresso',
    corte: 'Degradê navalhado',
    filhoNome: 'Enzo',
    filhoAniversario: '12/04',
  });

  assert.equal(atualizacao.ok, true);
  assert.equal(atualizacao.dadosAtualizados.aniversario, '08-15');
  assert.equal(atualizacao.dadosAtualizados.bairro, 'Jardim das Américas');
  assert.equal(atualizacao.dadosAtualizados.cidade, 'Cuiabá');
  assert.equal(atualizacao.dadosAtualizados.estadoCivil, 'casado');
  assert.equal(atualizacao.dadosAtualizados.conjugeNome, 'Juliana');
  assert.equal(atualizacao.dadosAtualizados.conjugeAniversario, '10-22');
  assert.equal(atualizacao.dadosAtualizados.bebida, 'Café expresso');
  assert.equal(atualizacao.dadosAtualizados.corte, 'Degradê navalhado');
  assert.ok(atualizacao.dadosAtualizados.filhos.includes('Enzo'));

  // 3. Consulta após atualização: campos preenchidos
  const consulta2 = await execute('consultar_cadastro_cliente', {});
  assert.equal(consulta2.ok, true);
  assert.equal(consulta2.cadastrado, true);
  assert.equal(consulta2.aniversario, '08-15');
  assert.equal(consulta2.bairro, 'Jardim das Américas');
  assert.equal(consulta2.cidade, 'Cuiabá');
  assert.equal(consulta2.estadoCivil, 'casado');
  assert.equal(consulta2.conjugeNome, 'Juliana');
  assert.equal(consulta2.conjugeAniversario, '10-22');
  assert.equal(consulta2.camposPendentes.length, 0);

  // 4. Verifica na persistência de clientesKytto
  const persistido = clientesKytto.clientesPersistidos(empresaId).clientes[atualizacao.clienteId];
  assert.ok(persistido);
  assert.equal(persistido.bairro, 'Jardim das Américas');
  assert.equal(persistido.cidade, 'Cuiabá');
  assert.equal(persistido.estadoCivil, 'casado');
  assert.equal(persistido.conjugeNome, 'Juliana');
  assert.equal(persistido.conjugeAniversario, '10-22');
  assert.equal(persistido.preferencias?.bebida, 'Café expresso');
  assert.equal(persistido.preferencias?.corte, 'Degradê navalhado');
  assert.ok(persistido.familia && persistido.familia.some(f => f.relacao === 'esposa' && f.nome === 'Juliana'));
  assert.ok(persistido.familia && persistido.familia.some(f => f.relacao === 'filho' && f.nome === 'Enzo'));

  // 5. customerContextFor reconhece todos os dados do cliente
  const textoContexto = customerContextFor(context);
  assert.match(textoContexto, /Marcos Vinicius/);
  assert.match(textoContexto, /Jardim das Américas/);
  assert.match(textoContexto, /Juliana/);
  assert.match(textoContexto, /Café expresso/);
  assert.match(textoContexto, /Cadastro completo/);
});

test('T-Rex: calcular_pacote_frequencia aceita resposta do cliente com frequencia e calcula desconto', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  // Cadastra plano fixture caso ainda não exista nesta empresa de teste
  let servicoCorte = barbearia.listarServicos(empresaId).find(s => s.nome === 'Corte Dino VIP');
  if (!servicoCorte) servicoCorte = barbearia.criarServico(empresaId, { nome: 'Corte Dino VIP', preco: 100 });
  const planoExistente = barbearia.listarPlanos(empresaId).find(p => p.nome === 'Pacote VIP 4 Cortes');
  if (!planoExistente) {
    barbearia.criarPlano(empresaId, {
      nome: 'Pacote VIP 4 Cortes',
      preco: 360,
      sessoesIncluidas: 4,
      servicosIds: [servicoCorte.id],
    });
  }

  const context = {
    empresaId,
    lojaId: empresaId,
    canalId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    sessionId: 'b1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    phone: '5565999991111',
    customerText: 'Corto de 15 em 15 dias',
    primaryIntentResolved: true,
    capabilities: { manageAppointments: true },
  };

  const execute = createWhatsappAiToolExecutor(context);
  const resultado = await execute('calcular_pacote_frequencia', {
    servico: 'Corte Dino VIP',
    frequenciaTexto: '15 dias',
  });

  assert.equal(resultado.ok, true);
  assert.ok(resultado.pacotes.length > 0);
  const pacote4 = resultado.pacotes.find(p => p.procedimentos === 4);
  assert.ok(pacote4);
  assert.equal(pacote4.desconto, '10%');
  assert.equal(pacote4.economia, 40);
});
