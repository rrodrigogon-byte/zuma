import test from 'node:test';
import assert from 'node:assert/strict';

import * as barbeariaErp from '../barbearia-erp-kytto.js';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA } from '../dino-equipe-seed.js';
import { availability } from './barbershop-agenda.js';
import { declineWithNewRequest, formatForWhatsapp } from './whatsapp-ai-intents.js';
import { withPendingReminder, presenceConfirmIntent } from './whatsapp-ai.js';
import { personaSystemBlock, resolvePersona } from './whatsapp-ai-persona.js';
import { normalizeAgendaTime, matchAgendaSlot } from './whatsapp-ai-normalize.js';
import { servicosEquivalentes } from './whatsapp-ai-tools.js';

provisionarEquipeDino();
const EMPRESA_DINO = DINO_EMPRESA_CANONICA;
const SCOPE_DINO = { empresaId: EMPRESA_DINO, lojaId: 'loja-1' };

test('Auditoria Conversas 10/11 — 1. Horários falados/escritos ("Quero as 14 e 15", "14 e 15", "14 e meia", "2 e 15 da tarde") convertem exatamente', () => {
  assert.equal(normalizeAgendaTime('Quero as 14 e 15'), '14:15');
  assert.equal(normalizeAgendaTime('14 e 15'), '14:15');
  assert.equal(normalizeAgendaTime('14h e 15'), '14:15');
  assert.equal(normalizeAgendaTime('14 e meia'), '14:30');
  assert.equal(normalizeAgendaTime('às 14 e 45'), '14:45');
  assert.equal(normalizeAgendaTime('2 e 15 da tarde'), '14:15');
  assert.equal(normalizeAgendaTime('7 da noite'), '19:00');
  const slots = ['14:15', '14:30', '14:45'];
  assert.equal(matchAgendaSlot('Quero as 14 e 15', slots), '14:15');
  assert.equal(matchAgendaSlot('14 e 15', slots), '14:15');
  assert.equal(matchAgendaSlot('2:15', slots), '14:15');
});

test('Auditoria Conversas 10/11 — 2. Deduplicação definitiva de Bruno em listarProfissionais', () => {
  const ativos = barbeariaErp.listarProfissionais(EMPRESA_DINO);
  const brunos = ativos.filter((p) => /bruno/i.test(p.nome) || /bruno/i.test(p.apelido || ''));
  assert.equal(brunos.length, 1, `Esperava exatamente 1 Bruno ativo, mas encontrou: ${brunos.map((b) => `${b.id}:${b.nome}`).join(', ')}`);
  assert.match(brunos[0].nome, /Bruno/i);
});

test('Auditoria Conversas 10/11 — 3. Horários com professionalId="qualquer" trazem os nomes dos barbeiros por horário (Bruno/Nati)', async () => {
  const servicos = barbeariaErp.listarServicos(EMPRESA_DINO);
  const corte = servicos.find((s) => /corte/i.test(s.nome) && !/dino/i.test(s.nome)) || servicos[0];
  const disp = await availability(SCOPE_DINO, {
    serviceId: corte.id,
    professionalId: 'qualquer',
    date: '2026-11-11',
  });
  assert.ok(disp.slots.length > 0, 'Deve retornar horários disponíveis na quarta-feira');
  assert.ok(disp.professionalByTime && typeof disp.professionalByTime === 'object', 'Deve retornar mapa professionalByTime');
  assert.ok(Array.isArray(disp.professionalsAvailable) && disp.professionalsAvailable.length > 0, 'Deve listar profissionais disponíveis no dia');
  for (const nome of disp.professionalsAvailable) {
    assert.match(nome, /Bruno|Nati|Dino/i);
  }
  assert.ok(!disp.professional.nome.includes('qualquer profissional disponível'), `Não deve usar texto genérico: ${disp.professional.nome}`);
});

test('Auditoria Conversas 10/11 — 4. Bloqueio de troca silenciosa de Corte por Dermaplaning (Ester)', () => {
  const servicos = [
    { id: 'srv-corte', nome: 'CORTE PREMIUM', preco: 100, profissionaisIds: ['prof-bruno'] },
    { id: 'srv-derma', nome: 'Dermaplaning', preco: 60, profissionaisIds: ['prof-ester'] },
  ];
  const eq = servicosEquivalentes(servicos, 'srv-corte', { id: 'prof-ester', nome: 'Steffany Marielly (Ester)' });
  assert.equal(eq.length, 0, 'Nunca deve considerar Dermaplaning equivalente a Corte Premium');
});

test('Auditoria Conversas 10/11 — 5. Falso positivo de confirmação de presença bloqueado para perguntas e remarcações', () => {
  assert.equal(presenceConfirmIntent('Bom dia! Gostaria de verificar a disponibilidade de hoje um pouco mais cedo, teria vaga?'), false);
  assert.equal(presenceConfirmIntent('Bom dia, tive um imprevisto hoje, poderia reagendar para amanhã?'), false);
  assert.equal(presenceConfirmIntent('Ter horário para tarde?'), false);
  assert.equal(presenceConfirmIntent('Dia 14 não marquei pra dia 21'), false);
  assert.equal(presenceConfirmIntent('Confirmado'), true);
  assert.equal(presenceConfirmIntent('Sim, estarei lá'), true);
});

test('Auditoria Conversas 10/11 — 6. Rejeição de Dermaplaning limpa ação pendente e não anexa lembrete indevido', () => {
  const resumoDerma = 'Dermaplaning com Ester para Maneco, amanhã, quarta 11/11 às 14:15, no valor de R$ 60,00';
  assert.equal(declineWithNewRequest('Não dermaplaning', resumoDerma), true);
  assert.equal(declineWithNewRequest('Eu não quero dermaplaning meu Deus', resumoDerma), true);
  assert.equal(declineWithNewRequest('Eu quero o corte com o David', resumoDerma), true);
  assert.equal(declineWithNewRequest('Quero cortar cabelo', resumoDerma), true);

  const pendingDerma = {
    summary: resumoDerma,
    preparadoEm: new Date().toISOString(),
  };
  const reply = 'Foi mal, Maneco! O serviço de Dermaplaning foi cancelado. Vamos agendar seu corte!';
  assert.equal(withPendingReminder(reply, pendingDerma), reply);
});

test('Auditoria Conversas 10/11 — 7. Limpeza de prefixo interno [Equipe da Loja / Atendente Humano] no texto enviado ao WhatsApp', () => {
  const sujo = '[Equipe da Loja / Atendente Humano: Jhenyffer Andrade] Olá Thiago! Tudo bem?';
  const limpo = formatForWhatsapp(sujo);
  assert.ok(!limpo.includes('Equipe da Loja'), `Prefixo interno vazou: ${limpo}`);
  assert.equal(limpo, 'Olá Thiago! Tudo bem?');
});

test('Auditoria Conversas 10/11 — 8. Persona proíbe repetir "Opa, [Nome]!" e lista apenas barbeiros reais ativos', () => {
  const persona = resolvePersona({ persona: 'dino' }, {}, EMPRESA_DINO);
  const prompt = personaSystemBlock(persona);
  assert.match(prompt, /PROIBIDO repetir "Opa, \[Nome\]!"/);
  assert.match(prompt, /PROIBIDO escrever "com qualquer profissional disponível"/);
  assert.match(prompt, /Ex-profissionais que NÃO trabalham mais na Barbearia Dino/i);
});
