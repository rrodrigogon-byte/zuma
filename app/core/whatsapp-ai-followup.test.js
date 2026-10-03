// Autonomia do atendente: retoma conversa parada antes da confirmação (1 toque,
// com travas) e oferece os próximos horários reais em uma única consulta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planPendingFollowUp, followUpText, runPendingFollowUpRound } from './whatsapp-ai-followup.js';
import { earliestSlots, WHATSAPP_AI_TOOL_DECLARATIONS } from './whatsapp-ai-tools.js';

// 15:00 em Cuiabá (UTC-4) = 19:00Z — fora do horário silencioso.
const AGORA = new Date('2026-10-02T19:00:00.000Z');
const min = (n) => new Date(AGORA.valueOf() - n * 60000).toISOString();

function sessao(extra = {}) {
  return {
    id: 's1', empresa_id: 'e', loja_id: 'l', canal_id: 'c', telefone: '5565999990010', nome: 'Rafael Souza', status: 'ativo', estado: {},
    ultima_interacao_em: min(15), atualizado_em: min(15),
    acao_pendente: { actionId: 'a1', type: 'agendamento', summary: 'Corte Masculino com Bruno em 03/10 às 15:00.', mostrado: true, preparadoEm: min(15) },
    ...extra,
  };
}

test('toque só quando o cliente sumiu depois de ver o resumo e a ação ainda vale', () => {
  assert.deepEqual(planPendingFollowUp(sessao(), { now: AGORA }), { send: true, reason: 'customer_idle_before_confirmation' });
  assert.equal(planPendingFollowUp(sessao({ ultima_interacao_em: min(4) }), { now: AGORA }).reason, 'too_soon');
  assert.equal(planPendingFollowUp(sessao({ acao_pendente: { ...sessao().acao_pendente, mostrado: false } }), { now: AGORA }).reason, 'summary_not_shown');
  assert.equal(planPendingFollowUp(sessao({ status: 'humano' }), { now: AGORA }).reason, 'not_automated');
  assert.equal(planPendingFollowUp(sessao({ estado: { followup: { actionId: 'a1' } } }), { now: AGORA }).reason, 'already_followed_up');
  assert.equal(planPendingFollowUp(sessao({ acao_pendente: { ...sessao().acao_pendente, preparadoEm: min(28) } }), { now: AGORA }).reason, 'action_expiring');
  assert.equal(planPendingFollowUp(sessao({ acao_pendente: null }), { now: AGORA }).reason, 'no_pending_action');
  // 22:30 em Cuiabá
  assert.equal(planPendingFollowUp(sessao({ ultima_interacao_em: '2026-10-03T02:15:00.000Z', acao_pendente: { ...sessao().acao_pendente, preparadoEm: '2026-10-03T02:15:00.000Z' } }), { now: new Date('2026-10-03T02:30:00.000Z') }).reason, 'quiet_hours');
});

test('texto do toque é cordial, usa o primeiro nome e o resumo do sistema', () => {
  const texto = followUpText(sessao());
  assert.match(texto, /^Oi, Rafael! Ficou faltando só sua confirmação: Corte Masculino com Bruno em 03\/10 às 15:00\./);
  assert.match(texto, /Responda SIM para confirmar ou NÃO para desistir/);
  assert.match(followUpText(sessao({ nome: '' })), /^Oi! /);
});

test('rodada: marca antes de enviar, 1 toque por ação e registra no histórico', async () => {
  const marcados = new Set();
  const enviados = [];
  const registrados = [];
  const sessoes = [sessao(), sessao({ id: 's2', telefone: '5565999990020', ultima_interacao_em: min(3) }), sessao({ id: 's3', status: 'humano' })];
  const deps = {
    now: AGORA,
    loadSessions: async () => sessoes,
    claim: async (s) => { const k = `${s.id}:${s.acao_pendente.actionId}`; if (marcados.has(k)) return false; marcados.add(k); return true; },
    send: async (tenant, telefone, texto) => { enviados.push({ telefone, texto }); return { ok: true }; },
    record: async (s, texto, ok) => { registrados.push({ id: s.id, ok }); },
  };
  const r1 = await runPendingFollowUpRound(deps);
  assert.deepEqual(r1, { avaliadas: 3, enviadas: 1, falhas: 0 });
  assert.equal(enviados[0].telefone, '5565999990010');
  assert.deepEqual(registrados, [{ id: 's1', ok: true }]);
  const r2 = await runPendingFollowUpRound(deps);
  assert.equal(r2.enviadas, 0, 'a mesma ação nunca recebe dois toques');
});

test('próximos horários: varre dias, pula dia fechado e horário que já passou, filtra período', async () => {
  const agenda = {
    '2026-10-02': ['09:00', '14:00', '16:30'],
    '2026-10-03': ['08:00', '10:00', '15:00', '18:30'],
    '2026-10-05': ['09:30', '13:00'],
  };
  const fetchDay = async (date) => {
    if (date === '2026-10-04') { const e = new Error('fechado'); e.code = 'SLOT_UNAVAILABLE'; throw e; }
    return { slots: agenda[date] || [], professional: { nome: 'qualquer profissional disponível' } };
  };
  const tarde = await earliestSlots({ fetchDay, fromDate: '2026-10-02', days: 4, period: 'tarde', limit: 3, notBefore: '15:00' });
  assert.deepEqual(tarde.slots.map((s) => `${s.weekday} ${s.date} ${s.time}`), ['sexta 2026-10-02 16:30', 'sábado 2026-10-03 15:00', 'segunda 2026-10-05 13:00']);
  assert.deepEqual(tarde.closedDays, ['2026-10-04']);
  const primeiros = await earliestSlots({ fetchDay, fromDate: '2026-10-02', days: 7, limit: 4, notBefore: '15:00' });
  assert.deepEqual(primeiros.slots.map((s) => s.time), ['16:30', '08:00', '10:00', '15:00']);
  const manha = await earliestSlots({ fetchDay, fromDate: '2026-10-02', period: 'Manhã', limit: 2 });
  assert.equal(manha.period, 'manha');
  assert.deepEqual(manha.slots.map((s) => s.time), ['09:00', '08:00']);
  await assert.rejects(earliestSlots({ fetchDay: async () => { const e = new Error('x'); e.code = 'SERVICE_NOT_FOUND'; throw e; }, fromDate: '2026-10-02' }), { code: 'SERVICE_NOT_FOUND' });
  // id inválido/erro de banco nunca vira "sem vaga"
  await assert.rejects(earliestSlots({ fetchDay: async () => { const e = new Error('x'); e.code = 'INVALID_ID'; throw e; }, fromDate: '2026-10-02' }), { code: 'INVALID_ID' });
  // fora da janela de reserva: para de procurar e devolve o que achou
  const janela = await earliestSlots({ fetchDay: async (d) => { if (d > '2026-10-03') { const e = new Error('x'); e.code = 'DATE_OUT_OF_RANGE'; throw e; } return { slots: ['10:00'] }; }, fromDate: '2026-10-02', days: 10, limit: 10 });
  assert.deepEqual(janela.slots.map((s) => s.date), ['2026-10-02', '2026-10-03']);
});

test('as novas ferramentas estão declaradas para o Gemini', () => {
  const nomes = WHATSAPP_AI_TOOL_DECLARATIONS.map((t) => t.name);
  assert.ok(nomes.includes('sugerir_proximos_horarios'));
  assert.ok(nomes.includes('entrar_lista_espera'));
  const espera = WHATSAPP_AI_TOOL_DECLARATIONS.find((t) => t.name === 'entrar_lista_espera');
  assert.ok(espera.parameters.required.includes('customerAgreed'));
});

// ---- Regras novas encontradas pelo simulador de cenários ----
import { splitBurst, burstUserText, confirmationFailureReply } from './whatsapp-ai.js';
import { friendlyWhen } from './whatsapp-ai-tools.js';
import { lembreteRedundante, quandoRelativo } from './barbershop-appointment-notifications.js';
import { validateWhatsappAiOutput } from './whatsapp-ai-profile.js';

test('rajada: junta só mensagens seguidas do cliente dentro de 3 min', () => {
  const at = (s) => new Date(Date.parse('2026-10-02T17:00:00Z') + s * 1000).toISOString();
  const h = [
    { role: 'user', text: 'oi antigo', at: at(-900) },
    { role: 'assistant', text: 'Olá!', at: at(-890) },
    { role: 'user', text: 'esquecido', at: at(-400) },
    { role: 'user', text: 'oi', at: at(-20) },
    { role: 'user', text: 'quero marcar', at: at(-10) },
    { role: 'user', text: 'barba amanhã', at: at(0) },
  ];
  const { prior, burst } = splitBurst(h);
  assert.deepEqual(burst.map((m) => m.text), ['oi', 'quero marcar', 'barba amanhã']);
  assert.equal(prior.length, 3, 'mensagem de 6 min atrás fica no histórico, fora da rajada');
  assert.equal(burstUserText(burst), 'oi\nquero marcar\nbarba amanhã');
  assert.deepEqual(splitBurst([{ role: 'user', text: 'só uma', at: at(0) }]).burst.map((m) => m.text), ['só uma']);
});

test('falha ao confirmar vira explicação ao cliente', () => {
  assert.match(confirmationFailureReply('SLOT_UNAVAILABLE', 'agendamento'), /acabou de ser ocupado/);
  assert.match(confirmationFailureReply('ACTION_EXPIRED', 'pedido'), /o pedido/);
  assert.match(confirmationFailureReply('PHONE_LIMIT'), /já tem horários/);
  assert.match(confirmationFailureReply('QUALQUER'), /Posso preparar de novo/);
});

test('data amigável no resumo (fuso de Cuiabá)', () => {
  const agora = new Date('2026-10-02T17:00:00Z'); // sexta 13h em Cuiabá
  assert.equal(friendlyWhen('2026-10-02', '15:00', agora), 'hoje, sexta 02/10 às 15:00');
  assert.equal(friendlyWhen('2026-10-03', '09:30', agora), 'amanhã, sábado 03/10 às 09:30');
  assert.equal(friendlyWhen('2026-10-06', '10:00', agora), 'terça 06/10 às 10:00');
});

test('lembrete não repete a confirmação de quem acabou de marcar; texto diz hoje/amanhã/dia', () => {
  const agora = Date.parse('2026-10-02T17:00:00Z');
  const marcadoAgora = { atualizadoEm: new Date(agora - 60000).toISOString() };
  assert.equal(lembreteRedundante(marcadoAgora, new Date(agora + 23.5 * 3600000), agora), true);
  assert.equal(lembreteRedundante(marcadoAgora, new Date(agora + 3 * 86400000), agora), false, 'horário distante mantém lembrete');
  assert.equal(lembreteRedundante({ atualizadoEm: new Date(agora - 8 * 3600000).toISOString() }, new Date(agora + 24 * 3600000), agora), false);
  const sexta13h = new Date('2026-10-02T17:00:00Z');
  assert.equal(quandoRelativo({ dataAgenda: '2026-10-03' }, sexta13h), 'amanhã');
  assert.equal(quandoRelativo({ dataAgenda: '2026-10-02' }, sexta13h), 'hoje');
  assert.equal(quandoRelativo({ dataAgenda: '2026-10-04' }, sexta13h), 'no domingo');
  assert.equal(quandoRelativo({ dataAgenda: '2026-10-05' }, sexta13h), 'na segunda');
});

test('pergunta educada não é "linguagem de pressão"; pressão real continua bloqueada', () => {
  assert.equal(validateWhatsappAiOutput('Claro! O que você precisa?').ok, true);
  assert.equal(validateWhatsappAiOutput('Do que você precisa hoje?').ok, true);
  assert.equal(validateWhatsappAiOutput('Última chance! Compre agora.').ok, false);
  assert.equal(validateWhatsappAiOutput('Você precisa garantir o seu hoje.').ok, false);
});

test('aroundTime: "lá pelas 16h" devolve os 2 horários mais próximos por dia', async () => {
  const fetchDay = async (date) => ({ slots: date === '2026-10-05' ? ['09:00', '13:00', '15:30', '16:15', '19:00'] : ['10:00', '16:00', '16:30', '17:00'] });
  const r = await earliestSlots({ fetchDay, fromDate: '2026-10-05', days: 2, limit: 4, aroundTime: '16:00' });
  assert.deepEqual(r.slots.map((s) => `${s.date.slice(8)} ${s.time}`), ['05 15:30', '05 16:15', '06 16:00', '06 16:30']);
});
