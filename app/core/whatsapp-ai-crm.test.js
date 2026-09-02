import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWhatsappPhone } from './whatsapp-ai-crm.js';
import { WHATSAPP_AI_TOOL_DECLARATIONS } from './whatsapp-ai-tools.js';
import { buildWhatsappAiSystemPrompt } from './whatsapp-ai.js';

test('normaliza telefones brasileiros para o formato Evolution', () => {
  assert.equal(normalizeWhatsappPhone('(65) 99999-9999'), '5565999999999');
  assert.equal(normalizeWhatsappPhone('5565999999999'), '5565999999999');
  assert.equal(normalizeWhatsappPhone('123'), '');
});

test('catálogo do agente cobre CRM, loja, agenda, vendas e marketing consentido', () => {
  const names = new Set(WHATSAPP_AI_TOOL_DECLARATIONS.map(tool => tool.name));
  for (const expected of [
    'captar_cliente',
    'consultar_perfil_cliente',
    'consultar_meus_agendamentos',
    'preparar_agendamento',
    'preparar_remarcacao',
    'preparar_cancelamento',
    'preparar_pedido',
    'listar_promocoes_ativas',
    'atualizar_consentimento_marketing',
    'preparar_promocao_cliente',
    'solicitar_humano',
  ]) assert.equal(names.has(expected), true, `ferramenta ausente: ${expected}`);
});

test('prompt humanizado exige dados reais, confirmação e opt-in para promoções', () => {
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino' });
  assert.match(prompt, /atendente virtual humanizado/i);
  assert.match(prompt, /CONFIRMAR ou CANCELAR/i);
  assert.match(prompt, /marketing exige consentimento/i);
  assert.match(prompt, /nunca invente/i);
  assert.match(prompt, /remarca/i);
});
