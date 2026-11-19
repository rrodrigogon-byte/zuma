import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { customerContextFor } from './core/whatsapp-ai.js';
import { createWhatsappAiToolExecutor } from './core/whatsapp-ai-tools.js';
import * as barbearia from './barbearia-erp-kytto.js';
import * as captacao from './dino-captacao-kytto.js';
import * as clientesKytto from './clientes-contas-kytto.js';

test('T-Rex Inteligência de Dados: identifica profissional focal no histórico recente da conversa', () => {
  const toolContext = {
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: randomUUID(),
    canalId: randomUUID(),
    sessionId: randomUUID(),
    phone: '5565999338153',
    customerText: '17:30h',
    recentUserText: 'quero agendar com a Nati para semana que vem',
    lastAssistantText: 'Tenho com a Nati às 17h30 ou 17h45'
  };

  const contextStr = customerContextFor(toolContext);
  assert.ok(contextStr.includes('PROFISSIONAL FOCAL FIXADO NESTA CONVERSA: Nati'), 'Deve fixar Nati como profissional focal');
  assert.ok(contextStr.includes('NUNCA passe professionalId: \'qualquer\''), 'Deve proibir alocação com qualquer');
});

test('T-Rex Inteligência de Dados: injeta hábitos operacionais e diretriz fast-track', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const phone = '5565988887777';

  // Cadastrar cliente de teste
  const cli = clientesKytto.criarCliente(empresaId, {
    nome: 'Carlos Eduardo Silva',
    telefone: phone,
    preferencias: { corte: 'Degradê na régua e Barboterapia', bebida: 'Café expresso' }
  });

  const toolContext = {
    empresaId,
    lojaId: randomUUID(),
    canalId: randomUUID(),
    sessionId: randomUUID(),
    phone,
    customerText: 'opa, tem horário hoje?',
    recentUserText: '',
    lastAssistantText: ''
  };

  const contextStr = customerContextFor(toolContext);
  assert.ok(contextStr.includes('Carlos Eduardo Silva'), 'Deve identificar o nome do cliente');
  assert.ok(contextStr.includes('DIRETRIZ DE ATENDIMENTO ULTRA-RÁPIDO (FAST-TRACK)'), 'Deve conter diretriz fast-track');
  assert.ok(contextStr.includes('Degradê na régua e Barboterapia'), 'Deve mapear o serviço de costume do cliente');
});

test('T-Rex Inteligência de Dados: toolNextSlots infere profissional focal se args.professionalId for qualquer', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const toolContext = {
    empresaId,
    lojaId: randomUUID(),
    canalId: randomUUID(),
    sessionId: randomUUID(),
    phone: '5565999338153',
    customerText: '17:30h',
    recentUserText: 'quero marcar com o Bruno',
    lastAssistantText: 'Vou ver os horários'
  };

  const executor = createWhatsappAiToolExecutor(toolContext);
  const res = await executor('sugerir_proximos_horarios', {
    serviceId: 'corte',
    professionalId: 'qualquer',
    fromDate: '2026-11-20'
  });

  assert.ok(res.proximosHorarios, 'Deve retornar proximosHorarios');
  assert.ok(res.proximosHorarios.length > 0, 'Deve encontrar horários para Bruno');
  const todosDoBruno = res.proximosHorarios.every(s => !s.professional || s.professional.toLowerCase().includes('bruno'));
  assert.ok(todosDoBruno, 'Os slots devem priorizar o profissional Bruno detectado na conversa');
});
