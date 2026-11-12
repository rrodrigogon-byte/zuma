import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsappAiSystemPrompt } from './core/whatsapp-ai.js';

test('T-Rex Treinamento: Localização, Horários, Tabela de Preços, Serviços e Agendamento Autônomo', () => {
  const prompt = buildWhatsappAiSystemPrompt({
    storeName: 'Barbearia Dino',
    persona: { id: 'trex', nome: 'T-Rex', segmento: 'barbearia', maxBolha: 350, maxBolhasModelo: 2 }
  });

  // 1. Localização e Horário
  assert.match(prompt, /Rua Antônio Hortolani, nº 62-N, Centro, Tangará da Serra - MT/i, 'Deve conter endereço oficial de Tangará da Serra');
  assert.match(prompt, /07h30 às 19h00/i, 'Deve conter horário de atendimento de segunda a sábado');
  assert.match(prompt, /estacionamento em frente/i, 'Deve informar facilidade de estacionamento');

  // 2. Tabela de Preços e Formas de Pagamento
  assert.match(prompt, /Corte Masculino Premium: R\$ 100,00/i, 'Deve conter preço de corte da equipe R$ 100');
  assert.match(prompt, /Barba Premium: R\$ 100,00/i, 'Deve conter preço de barba da equipe R$ 100');
  assert.match(prompt, /Combo Corte \+ Barba: R\$ 200,00/i, 'Deve conter preço de combo R$ 200');
  assert.match(prompt, /Corte com Dino R\$ 300,00/i, 'Deve conter preço com Dino R$ 300');
  assert.match(prompt, /Club Dino/i, 'Deve conter referência aos planos Club Dino');
  assert.match(prompt, /Pix, Cartão de Crédito, Débito e Dinheiro/i, 'Deve conter formas de pagamento');

  // 3. Serviços de Corte e Barba
  assert.match(prompt, /toalha quente relaxante, vapor de ozônio/i, 'Deve detalhar o ritual da barba');
  assert.match(prompt, /Visagismo adaptado ao formato do seu rosto/i, 'Deve detalhar a experiência do corte');
  assert.match(prompt, /Combo Corte \+ Barba \(60 min\)/i, 'Deve conter combo completo');

  // 4. Agendamento Direto Autônomo sem intervenção humana
  assert.match(prompt, /AGENDAMENTOS DIRETOS 100% CONCLUÍDOS SEM INTERVENÇÃO HUMANA/i, 'Deve conter diretriz de agendamento 100% autônomo');
  assert.match(prompt, /sem transferir para atendente humano/i, 'Não deve transferir desnecessariamente para humano');
});
