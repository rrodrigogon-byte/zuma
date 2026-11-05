import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmIntent } from './core/whatsapp-ai-intents.js';
import * as barbearia from './barbearia-erp-kytto.js';
import { toolPrepareCancellation } from './core/whatsapp-ai-tools.js';

test('confirmIntent rejeita palavras casuais como confirmação de cancelamento', () => {
  // Palavras casuais de conversa NUNCA devem confirmar cancelamento de horário
  assert.equal(confirmIntent('ok', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('beleza', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('blz', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('show', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('ta bom', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('bora', { actionType: 'cancelamento' }), null);
  assert.equal(confirmIntent('vamos', { actionType: 'cancelamento' }), null);

  // Somente confirmações explícitas de cancelamento devem ser aceitas
  assert.equal(confirmIntent('pode cancelar', { actionType: 'cancelamento' }), 'confirm');
  assert.equal(confirmIntent('cancela sim', { actionType: 'cancelamento' }), 'confirm');
  assert.equal(confirmIntent('sim', { actionType: 'cancelamento' }), 'confirm');
  assert.equal(confirmIntent('confirmar', { actionType: 'cancelamento' }), 'confirm');
});

test('cancelarPorFaltaConfirmacao bloqueia cancelamento automatico na Dino', () => {
  const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  
  const servicos = barbearia.listarServicos(EMPRESA_DINO);
  const servico = servicos[0] || barbearia.criarServico(EMPRESA_DINO, { nome: "Corte Teste Anti Canc", preco: 60, duracaoMinutos: 40 });
  const profissional = barbearia.criarProfissional(EMPRESA_DINO, {
    nome: `Dino Teste Anti Canc ${Date.now()}`,
    servicosIds: [servico.id],
    atendimento24x7: true
  });

  // Gera data futura única
  const dataLivre = new Date(Date.now() + (100 + Math.floor(Math.random() * 50)) * 24 * 3600 * 1000);
  dataLivre.setHours(14, Math.floor(Math.random() * 4) * 15, 0, 0);

  const criado = barbearia.criarAgendamento(EMPRESA_DINO, {
    clienteNome: 'Cliente Teste Anti Cancelamento',
    clienteTelefone: `556599999${Math.floor(1000 + Math.random() * 9000)}`,
    dataHora: dataLivre.toISOString(),
    servicoId: servico.id,
    profissionalId: profissional.id,
  });

  assert.ok(criado.id);
  
  // Tentar cancelar por falta de confirmacao deve retornar null
  const cancelado = barbearia.cancelarPorFaltaConfirmacao(EMPRESA_DINO, criado.id, {
    agora: new Date(dataLivre.valueOf() - 30 * 60 * 1000)
  });

  assert.equal(cancelado, null, 'Dino nunca deve cancelar agendamento automaticamente por falta de confirmacao');
  
  // Verifica que o agendamento permanece agendado
  const agenda = barbearia.listarAgendamentos(EMPRESA_DINO).find(a => a.id === criado.id);
  assert.equal(agenda.status, 'agendado');
});

test('toolPrepareCancellation bloqueia cancelamento se cliente nao pediu explicitamente', async () => {
  const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  
  // Cenário 1: cliente pergunta se tem outro horário
  const contextoSemPedido = {
    empresaId: EMPRESA_DINO,
    phone: '5565999998888',
    customerText: 'hoje não vai dar, tem amanhã à tarde?'
  };

  await assert.rejects(
    () => toolPrepareCancellation(contextoSemPedido, {}),
    (err) => {
      assert.equal(err.code, 'CANCELLATION_NOT_EXPLICITLY_REQUESTED');
      return true;
    }
  );

  // Cenário 2: cliente recusa sugestão de produto ou pacote
  const contextoRecusaProduto = {
    empresaId: EMPRESA_DINO,
    phone: '5565999998888',
    customerText: 'não quero pomada nem pacote, obrigado'
  };

  await assert.rejects(
    () => toolPrepareCancellation(contextoRecusaProduto, {}),
    (err) => {
      assert.equal(err.code, 'CANCELLATION_NOT_EXPLICITLY_REQUESTED');
      return true;
    }
  );
});
