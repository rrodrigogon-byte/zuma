// Painel da conversa do T-Rex (30/10): histórico completo, resposta do atendente e devolução
// em que o T-Rex continua de onde parou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.js';
import { getWhatsappAiConversation, releaseWhatsappAiHandoff, sendWhatsappAiStaffMessage } from './whatsapp-ai.js';
import { recordStaffMessages } from './whatsapp-staff-takeover.js';

const E = '11111111-1111-4111-8111-111111111111';
const L = '22222222-2222-4222-8222-222222222222';
const U = '33333333-3333-4333-8333-333333333333';
const S = '44444444-4444-4444-8444-444444444444';
const C = '55555555-5555-4555-8555-555555555555';
const ctx = () => ({ empresaId: E, lojaId: L, usuarioId: U });
const originals = () => ({ queryRead: db.queryRead, query: db.query, transaction: db.transaction });
const restore = (o) => Object.assign(db, o);

test('histórico completo: cliente, T-Rex e equipe em ordem, telefone mascarado', async () => {
  const o = originals();
  db.queryRead = async (sql) => {
    if (/FROM whatsapp_ai_sessions/.test(sql)) return { rows: [{ id: S, telefone: '5565999990001', nome: 'Bruno', status: 'humano', handoff_reason: 'cliente pediu uma pessoa', assigned_to: U }] };
    return { rows: [
      { id: 'm3', papel: 'assistant', conteudo: 'Oi Bruno, aqui é a Nati', criado_em: '3', autor: 'equipe', autor_nome: 'Nati', delivery_status: 'sent' },
      { id: 'm2', papel: 'assistant', conteudo: 'Já chamei a equipe', criado_em: '2', delivery_status: 'sent' },
      { id: 'm1', papel: 'user', conteudo: 'Quero falar com alguém', criado_em: '1' },
    ] };
  };
  try {
    const r = await getWhatsappAiConversation(ctx(), S);
    assert.equal(r.sessao.telefone, '***0001');
    assert.equal(r.sessao.minha, true);
    assert.deepEqual(r.mensagens.map((m) => m.autor), ['cliente', 'trex', 'equipe']);
    assert.equal(r.mensagens[2].autorNome, 'Nati');
    assert.doesNotMatch(JSON.stringify(r), /5565999990001/);
  } finally { restore(o); }
});

test('atendente só responde com a conversa na equipe e nunca na de outro atendente', async () => {
  const o = originals();
  try {
    db.transaction = async (fn) => fn({
      query: async (sql) => {
        if (/UPDATE whatsapp_ai_sessions/.test(sql)) return { rows: [{ id: S, status: 'humano', assigned_to: U }] };
        if (/SELECT id, status/.test(sql)) return { rows: [{ id: S, status: 'ativo', assigned_to: null }] };
        return { rows: [] };
      }
    });
    db.query = async () => ({ rows: [{ id: 'm-new', criado_em: new Date().toISOString() }] });
    db.queryRead = async () => ({ rows: [{ id: S, status: 'humano', assigned_to: C, telefone: '5565999990001', canal_id: C, configuracao: {} }] });
    await assert.rejects(() => sendWhatsappAiStaffMessage(ctx(), S, { texto: 'oi' }), { code: 'WHATSAPP_AI_SESSION_CONFLICT' });
    await assert.rejects(() => sendWhatsappAiStaffMessage(ctx(), S, { texto: '   ' }), { code: 'WHATSAPP_AI_EMPTY_MESSAGE' });
  } finally { restore(o); }
});

test('devolver: T-Rex responde a última mensagem do cliente se ninguém respondeu', async () => {
  const o = originals();
  const writes = [];
  db.transaction = async (fn) => fn({ query: async (sql) => /UPDATE whatsapp_ai_sessions/.test(sql) ? { rows: [{ id: S, status: 'ativo', canal_id: C }] } : { rows: [] } });
  db.queryRead = async (sql) => {
    if (/FROM whatsapp_ai_messages/.test(sql)) return { rows: [{ papel: 'user', evento_externo_id: 'api:5565:abc' }] };
    if (/FROM eventos_integracao_canais/.test(sql)) return { rows: [{ id: 'ev1' }] };
    return { rows: [] };
  };
  db.query = async (sql, params) => { writes.push({ sql, params }); return { rows: [] }; };
  try {
    const r = await releaseWhatsappAiHandoff(ctx(), S);
    assert.equal(r.retomou, true);
    const tarefa = writes.find((w) => /INSERT INTO tarefas_integracao_canais/.test(w.sql));
    assert.ok(tarefa, 'reenfileira a última mensagem do cliente');
    assert.equal(tarefa.params[3], 'ev1');
  } finally { restore(o); }
});

test('devolver: se a equipe respondeu por último, o T-Rex espera a próxima mensagem do cliente', async () => {
  const o = originals();
  const writes = [];
  db.transaction = async (fn) => fn({ query: async (sql) => /UPDATE whatsapp_ai_sessions/.test(sql) ? { rows: [{ id: S, status: 'ativo', canal_id: C }] } : { rows: [] } });
  db.queryRead = async () => ({ rows: [{ papel: 'assistant', evento_externo_id: 'equipe:x' }] });
  db.query = async (sql) => { writes.push(sql); return { rows: [] }; };
  try {
    const r = await releaseWhatsappAiHandoff(ctx(), S);
    assert.equal(r.retomou, false);
    assert.equal(writes.some((w) => /tarefas_integracao_canais/.test(w)), false);
    const semRetomar = await releaseWhatsappAiHandoff(ctx(), S, { retomar: false });
    assert.equal(semRetomar.motivo, 'desligado');
  } finally { restore(o); }
});

test('mensagem digitada pela equipe no celular vai para o histórico (só as orgânicas)', async () => {
  const calls = [];
  const database = { query: async (sql, params) => { calls.push(params); return { rows: [{ id: 'x' }] }; } };
  const n = await recordStaffMessages({ id: C }, [
    { chatId: '5565999990001', role: 'assistant', interactionType: 'organic', content: 'Oi, aqui é a Nati', timestamp: '2026-10-30T20:00:00Z', whatsappMessageId: 'W1' },
    { chatId: '5565999990001', role: 'assistant', interactionType: 'bot', content: 'resposta do T-Rex', timestamp: '2026-10-30T20:01:00Z' },
    { chatId: '5565999990001', role: 'user', content: 'cliente', timestamp: '2026-10-30T20:02:00Z' },
  ], { database });
  assert.equal(n, 1);
  assert.equal(calls[0][2], 'staff:W1');
  assert.equal(calls[0][3], 'Oi, aqui é a Nati');
});

test('atualização da entrega da mensagem da equipe tipa o parâmetro (PostgreSQL 42P08)', async () => {
  // O mesmo parâmetro aparece na coluna VARCHAR e na comparação do CASE: sem o cast o
  // PostgreSQL deduz tipos diferentes e recusa a consulta depois do envio ao WhatsApp.
  const { readFile } = await import('node:fs/promises');
  const fonte = await readFile(new URL('./whatsapp-ai.js', import.meta.url), 'utf8');
  const trecho = fonte.slice(fonte.indexOf('export async function sendWhatsappAiStaffMessage'), fonte.indexOf('export async function closeWhatsappAiHandoff'));
  assert.match(trecho, /delivery_status = \$5::text/);
  assert.match(trecho, /WHEN \$5::text = 'sent'/);
});

test('assumir conversa que voltou ao T-Rex com assigned_to antigo efetivamente assume (status humano)', async () => {
  const { claimWhatsappAiHandoff } = await import('./whatsapp-ai.js');
  const original = db.transaction;
  const updates = [];
  db.transaction = async (fn) => fn({
    query: async (sql, params) => {
      if (/^\s*SELECT id, status, assigned_to/.test(sql)) return { rows: [{ id: S, status: 'ativo', assigned_to: U, assigned_at: '2026-10-31T16:28:55Z', priority: 2 }] };
      if (/UPDATE whatsapp_ai_sessions/.test(sql)) { updates.push(sql); return { rows: [{ id: S, status: 'humano', assigned_to: U, priority: 2 }] }; }
      return { rows: [] };
    },
  });
  try {
    const r = await claimWhatsappAiHandoff({ empresaId: E, lojaId: L, usuarioId: U }, S);
    assert.equal(r.status, 'humano');
    assert.ok(updates.some((sql) => /SET status = 'humano'/.test(sql)), 'precisa tirar do T-Rex');
    // Outro atendente com assigned_to antigo também não é conflito enquanto está com o T-Rex.
    const outro = '55555555-5555-4555-8555-555555555555';
    const r2 = await claimWhatsappAiHandoff({ empresaId: E, lojaId: L, usuarioId: outro }, S);
    assert.equal(r2.status, 'humano');
  } finally { db.transaction = original; }
});
