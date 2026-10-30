// Regressão da conversa real de 27-28/10/2026 (Rodrigo x T-Rex da Barbearia Dino).
// Cada teste trava um erro que o cliente viu no WhatsApp. Se algum voltar a falhar,
// o T-Rex voltou a errar daquele jeito.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchAgendaName, nearestAlternatives, precoNoHorario, earliestSlots } from './whatsapp-ai-tools.js';
import { buildWhatsappAiSystemPrompt, presenceConfirmIntent } from './whatsapp-ai.js';
import { personaSystemBlock, resolvePersona } from './whatsapp-ai-persona.js';
import { canResumeSelfService, OUTPUT_STYLE_VIOLATIONS } from './whatsapp-self-service.js';
import { registrarEnvioDaPlataforma, foiEnviadoPelaPlataforma } from './whatsapp.js';
import { SYSTEM_MAX_CHARS, unfinishedToolReply } from './gemini-client.js';
import { agendaCalendarText } from './whatsapp-ai-normalize.js';
import { confirmationPlan } from './dino-confirmation-policy.js';

const SERVICOS = [
  { id: 'srv-corte-dino', nome: 'Corte com Dino', preco: 300 },
  { id: 'srv-barba-dino', nome: 'Barba com o Dino', preco: 300 },
  { id: 'srv-combo-dino', nome: 'Corte e barba com Dino', preco: 300 },
  { id: 'srv-corte', nome: 'Corte Masculino', preco: 45 },
  { id: 'srv-barba', nome: 'Barba Tradicional', preco: 30 },
  { id: 'srv-hidra', nome: 'Hidratação', preco: 40 },
];
const PROFISSIONAIS = [{ id: 'prf-dino', nome: 'Dino' }, { id: 'prf-bruno', nome: 'Bruno' }, { id: 'prf-nathy', nome: 'Nathy' }];

test('12:39 "Não encontrei o serviço Corte e Barba": o nome dito pelo cliente acha o serviço certo', () => {
  for (const pedido of ['Corte e Barba', 'corte e barba com Dino', 'barba e cabelo', 'cortar o cabelo e fazer a barba com o dino', 'Corte e barba com Dino']) {
    assert.equal(matchAgendaName(pedido, SERVICOS).item?.id, 'srv-combo-dino', pedido);
  }
  assert.equal(matchAgendaName('hidratacao', SERVICOS).item?.id, 'srv-hidra');
  assert.equal(matchAgendaName('dino', PROFISSIONAIS).item?.id, 'prf-dino');
});

test('nome ambíguo não chuta: devolve as opções para o cliente escolher', () => {
  const r = matchAgendaName('barba', SERVICOS);
  assert.equal(r.item, null);
  assert.ok(r.candidatos.length >= 2);
});

test('11:36 / 13:33 horário indisponível: o sistema devolve 3 opções perto do pedido, com valor', async () => {
  const slotsPorDia = { '2026-10-27': ['08:00', '09:00', '18:00', '18:45', '19:30', '20:30'], '2026-10-28': ['16:00', '17:00', '19:00'] };
  const fetchDay = async (data) => ({ slots: slotsPorDia[data] || [], service: SERVICOS[2], professional: PROFISSIONAIS[0] });
  const opcoes = await nearestAlternatives({}, { date: '2026-10-27', time: '20:00', fetchDay, today: '2026-10-27', now: '13:33' });
  assert.equal(opcoes.length, 3);
  assert.deepEqual(opcoes.map((o) => o.time), ['18:45', '19:30', '20:30']);
  assert.ok(opcoes.every((o) => o.valor === 'R$ 600,00'));
  assert.ok(opcoes.every((o) => o.quando.includes('27/10')));
});

test('dia sem 3 vagas completa com os dias seguintes, sem horário que já passou', async () => {
  const fetchDay = async (data) => ({ slots: data === '2026-10-28' ? ['09:00', '16:30', '17:00', '19:00'] : ['10:00', '14:00'], service: SERVICOS[2], professional: PROFISSIONAIS[0] });
  const opcoes = await nearestAlternatives({}, { date: '2026-10-28', time: '17:00', fetchDay, today: '2026-10-28', now: '16:45' });
  assert.deepEqual(opcoes.map((o) => `${o.date} ${o.time}`), ['2026-10-28 17:00', '2026-10-28 19:00', '2026-10-29 14:00']);
});

test('13:34 "18h00 por R$ 600": o valor sai da regra do horário, não do texto da IA', () => {
  const combo = SERVICOS[2];
  assert.equal(precoNoHorario(combo, { id: 'qualquer' }, '18:00'), 300);
  assert.equal(precoNoHorario(combo, PROFISSIONAIS[0], '18:09'), 300);
  assert.equal(precoNoHorario(combo, PROFISSIONAIS[0], '18:45'), 600);
  assert.equal(precoNoHorario(SERVICOS[3], PROFISSIONAIS[1], '19:00'), 45);
});

test('"após as 16h, me dê três opções": 3 opções por dia em torno do horário', async () => {
  const fetchDay = async () => ({ slots: ['09:00', '15:30', '16:00', '16:30', '17:00', '19:00'] });
  const r = await earliestSlots({ fetchDay, fromDate: '2026-10-29', days: 1, limit: 3, aroundTime: '16:00' });
  assert.equal(r.slots.length, 3);
});

test('17:30 "confirmado!" ao lembrete conta como confirmação de presença', () => {
  for (const texto of ['confirmado!', 'CONFIRMO', 'Confirmo presença', 'confirmado', 'estarei aí']) assert.equal(presenceConfirmIntent(texto), true, texto);
  for (const texto of ['confirmado e gostaria de pagar no pix', 'quero confirmar outro horário', 'oi']) assert.equal(presenceConfirmIntent(texto), false, texto);
});

test('16:39 "quero este Bleu de Chanel": bloqueio de estilo não prende o cliente na fila', () => {
  assert.ok(OUTPUT_STYLE_VIOLATIONS.includes('UNGOVERNED_OPPORTUNITY'));
  assert.equal(canResumeSelfService({ status: 'humano', handoff_reason: 'security:UNGOVERNED_OPPORTUNITY' }), true);
  assert.equal(canResumeSelfService({ status: 'humano', handoff_reason: 'security:POSSIBLE_DOCUMENT' }), false);
});

test('eco do próprio envio não vira "mensagem da equipe" e não pausa a IA', () => {
  registrarEnvioDaPlataforma('5565999990000', 'Opa, Rodrigo! Passando pra lembrar: hoje às 18h45.');
  assert.equal(foiEnviadoPelaPlataforma('65999990000', 'Opa, Rodrigo! Passando pra lembrar: hoje às 18h45.'), true);
  assert.equal(foiEnviadoPelaPlataforma('65999990000', 'Rodrigo você não irá vir?'), false);
});

test('lembrete não sai 1 minuto depois de marcar: com menos de 24h a 1ª etapa já é o "Tá marcado"', () => {
  const agora = new Date('2026-10-27T16:36:00Z');
  const plano = confirmationPlan(new Date('2026-10-27T22:45:00Z'), agora);
  assert.equal(plano.enabled, true);
  assert.ok(plano.firstAt.valueOf() <= agora.valueOf() + 5 * 60 * 1000, 'a 1ª etapa cai no ato e é registrada sem novo envio');
  const src = readFileSync(new URL('./barbershop-appointment-notifications.js', import.meta.url), 'utf8');
  assert.match(src, /plano\.firstAt\.valueOf\(\) <= Date\.now\(\) \+ 5 \* 60 \* 1000/);
});

test('persona T-Rex sem as instruções que geraram o erro', () => {
  const persona = resolvePersona({ persona: { id: 'trex', ativo: true } }, { WHATSAPP_AI_PERSONA: 'trex' }, 'x');
  const bloco = personaSystemBlock(persona, 'Barbearia Dino');
  assert.doesNotMatch(bloco, /65999056008|99905-6008/, 'chave Pix escrita à mão');
  assert.doesNotMatch(bloco, /oferta especial de perfumes/);
  assert.doesNotMatch(bloco, /Apresente 2 opções|as 2 opções livres/);
  assert.doesNotMatch(bloco, /não encontrou o horário\/serviço → acione solicitar_humano/);
  assert.match(bloco, /3 opções reais/);
  assert.match(bloco, /link_pagamento_pedido/);
});

test('instruções completas cabem no limite: a regra de ação pendente (no fim) chega ao modelo', () => {
  const persona = resolvePersona({ persona: { id: 'trex', ativo: true } }, { WHATSAPP_AI_PERSONA: 'trex' }, 'x');
  const texto = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino', persona, extraGuidance: `${agendaCalendarText(new Date('2026-10-28T13:00:00Z'))} ${'Serviços: x; '.repeat(400)}`, pendingAction: { summary: 'Corte e barba com Dino' } });
  assert.ok(texto.length <= SYSTEM_MAX_CHARS, `${texto.length} > ${SYSTEM_MAX_CHARS}`);
  assert.match(texto, /Há uma ação pendente/);
  assert.doesNotMatch(texto, /atende 24 horas por dia, 7 dias por semana/);
});

test('"29 ou 30 de novembro?": o modelo recebe o calendário com a data de hoje', () => {
  const cal = agendaCalendarText(new Date('2026-10-28T13:00:00Z'));
  assert.match(cal, /28\/10/);
  assert.match(cal, /29\/10/);
  assert.match(cal, /30\/10/);
});

test('rotas de depuração e atalho de login não existem no servidor', () => {
  const src = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /env-debug-4321/);
  assert.doesNotMatch(src, /x-magic-bypass/);
  assert.doesNotMatch(src, /app\.get\('\/api\/publico\/dino-carteira'/);
  assert.doesNotMatch(src, /Rotina de Confirmação de Agenda do T-Rex[\s\S]{0,80}setInterval/);
});

test('ferramentas não inventam frete nem pedem CPF', () => {
  const src = readFileSync(new URL('./whatsapp-ai-tools.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Correios PAC', valor: 'R\$ 28,50'/);
  assert.doesNotMatch(src, /customerDocument: \{ type: 'STRING', description: 'CPF/);
  assert.doesNotMatch(src, /criarProfissional\(empresaId, \{\s*nome: 'Guilherme Cunha Martins \(Dino\)'/);
});

test('conversa presa em "humano" sem motivo (sobra de 27-28/10) volta para a IA quando o cliente escreve', () => {
  const src = readFileSync(new URL('./whatsapp-ai.js', import.meta.url), 'utf8');
  assert.match(src, /handoff_requested_at IS NULL AND COALESCE\(NULLIF\(handoff_reason, ''\), NULLIF\(estado->>'handoffReason', ''\)\) IS NULL/);
});

test('30/10 15:21 "Deixa eu ver aqui... Um instante!" não é resposta final', () => {
  assert.equal(unfinishedToolReply('Deixa eu ver aqui os horários para "Corte e Barba" com o Dino no dia 03/11. Um instante!'), true);
  assert.equal(unfinishedToolReply('Só um momento que já te falo.'), true);
  assert.equal(unfinishedToolReply('Tenho 16h, 17h30 ou 18h com o Dino. Qual fica melhor?'), false);
  const persona = resolvePersona({ persona: { id: 'trex', ativo: true } }, { WHATSAPP_AI_PERSONA: 'trex' }, 'x');
  assert.doesNotMatch(personaSystemBlock(persona, 'Barbearia Dino'), /consultar: "Deixa eu ver aqui\."/);
});
