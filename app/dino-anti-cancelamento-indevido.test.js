import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmIntent } from './core/whatsapp-ai-intents.js';
import * as barbearia from './barbearia-erp-kytto.js';
import { toolPrepareCancellation } from './core/whatsapp-ai-tools.js';
import * as cobranca from './dino-cobranca-kytto.js';
import { personaAppointmentMessage } from './core/whatsapp-ai-persona.js';

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

test('alterarStatusAgendamento bloqueia cancelamento automatico/sistema na Dino', () => {
  const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const agId = `age-bloq-auto-${Date.now()}`;
  const estado = barbearia.estadoEmpresa(EMPRESA_DINO);
  estado.agendamentos[agId] = {
    id: agId,
    empresaId: EMPRESA_DINO,
    clienteNome: 'Cliente Teste Bloqueio',
    clienteTelefone: '5565999887766',
    dataHora: new Date(Date.now() + 86400000).toISOString(),
    status: 'agendado',
  };

  // Tentativas de cancelamento com origem de sistema/robô/timeout DEVEM falhar
  const origensProibidas = ['sistema', 'confirmacao_automatica', 'expiracao_sinal', 'robo', 'bot_autonomo'];
  for (const origem of origensProibidas) {
    assert.throws(
      () => barbearia.alterarStatusAgendamento(EMPRESA_DINO, agId, 'cancelado', { origem }),
      (err) => {
        assert.equal(err.code, 'CANCELAMENTO_AUTOMATICO_BLOQUEADO');
        return true;
      },
      `Deveria bloquear cancelamento com origem ${origem}`
    );
  }

  // Cancelamento pelo atendente ou cliente deve ser aceito
  const canceladoAtendente = barbearia.alterarStatusAgendamento(EMPRESA_DINO, agId, 'cancelado', {
    origem: 'atendente',
    canceladoPor: 'Carlos Atendente',
    motivoCancelamento: 'Imprevisto na barbearia'
  });
  assert.ok(canceladoAtendente);
  assert.equal(canceladoAtendente.status, 'cancelado');
  assert.equal(canceladoAtendente.canceladoPor, 'Carlos Atendente');
  assert.equal(canceladoAtendente.motivoCancelamento, 'Imprevisto na barbearia');
});

test('expirarSinais NUNCA cancela agendamentos na Dino', async () => {
  const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const agId = `age-sinal-dino-${Date.now()}`;
  const estado = barbearia.estadoEmpresa(EMPRESA_DINO);
  estado.agendamentos[agId] = {
    id: agId,
    empresaId: EMPRESA_DINO,
    clienteNome: 'Rodrigo Ribeiro',
    clienteTelefone: '5565999112233',
    dataHora: new Date(Date.now() + 86400000).toISOString(),
    status: 'agendado',
  };

  const dbRaiz = (await import('./db.js')).db();
  dbRaiz.barbeariaCobranca ||= {};
  dbRaiz.barbeariaCobranca[EMPRESA_DINO] ||= { cobrancas: {}, configuracao: {} };
  dbRaiz.barbeariaCobranca[EMPRESA_DINO].cobrancas[`sinal:${agId}`] = {
    id: `cob-${agId}`,
    tipo: 'sinal',
    referencia: `sinal:${agId}`,
    status: 'pendente',
    expiraEm: new Date(Date.now() - 3600000).toISOString(),
  };

  // Executa expirarSinais
  const liberados = cobranca.expirarSinais({ agora: Date.now() });
  // Verifica que o agendamento de Dino NÃO foi incluído nos liberados/cancelados
  assert.ok(!liberados.some(l => l.agendamento?.id === agId));

  // Verifica que o agendamento permanece intacto como 'agendado'
  const ag = estado.agendamentos[agId];
  assert.equal(ag.status, 'agendado', 'Agendamento na Dino deve continuar agendado mesmo após expirar o sinal');
  assert.match(ag.observacoes || '', /Sinal expirou sem pagamento/);
});

test('personaAppointmentMessage cancelado diferencia cliente vs equipe com clareza total', () => {
  // Cenário 1: Cancelado pela equipe/atendente
  const msgEquipe = personaAppointmentMessage('dino', {
    evento: 'cancelado',
    nome: 'Rodrigo Ribeiro',
    servico: 'Corte com Dino',
    profissional: 'Dino',
    quando: 'ter 10/11 às 6h30',
    loja: 'Barbearia Dino',
    canceladoPor: 'atendente',
    motivo: 'Imprevisto com o profissional',
  });
  assert.match(msgEquipe, /A equipe da Barbearia Dino precisou cancelar o seu agendamento/);
  assert.match(msgEquipe, /Pedimos desculpas pelo imprevisto!/);
  assert.match(msgEquipe, /Motivo: Imprevisto com o profissional/);
  assert.match(msgEquipe, /Quer que eu te ajude a encontrar outro horário/);
  // Não pode parecer que o bot cancelou por conta própria
  assert.doesNotMatch(msgEquipe, /Seu horário na Barbearia Dino foi cancelado\. Quer marcar outro\?/);

  // Cenário 2: Cancelado a pedido do cliente
  const msgCliente = personaAppointmentMessage('dino', {
    evento: 'cancelado',
    nome: 'Rodrigo Ribeiro',
    servico: 'Corte com Dino',
    profissional: 'Dino',
    quando: 'ter 10/11 às 6h30',
    loja: 'Barbearia Dino',
    canceladoPor: 'cliente',
    motivo: 'Solicitado pelo cliente via WhatsApp',
  });
  assert.match(msgCliente, /Confirmamos o cancelamento do seu horário/);
  assert.match(msgCliente, /conforme você solicitou/);
  assert.match(msgCliente, /Se quiser marcar outro dia, só me avisar por aqui!/);
});
