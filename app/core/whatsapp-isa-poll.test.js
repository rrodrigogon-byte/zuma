// Entrada do WhatsApp igual à da Isa: consulta GET /messages, id de evento da Isa,
// idade máxima, áudio com resposta fixa, modos shadow/pilot e sem duplicar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackendMessage, runIsaPollPass as runPoll, AUDIO_REPLY, pollEnabled } from './whatsapp-isa-poll.js';

// Apenas fixtures: produção usa canalDaEmpresa() com empresa, loja e unicidade.
const runIsaPollPass = options => runPoll({ ...options, carregarCanal: options?.carregarCanal || (async () => options?.canal || null) });

// Etapa "equipe assumiu pelo celular" sem banco nestes testes (coberta em whatsapp-staff-takeover.test.js e no simulador).
const SEM_EQUIPE = { liberar: async () => 0, pausar: async () => ({ paused: false }) };

const ENV = { WHATSAPP_PROVIDER: 'chatbot_backend', CHATBOT_BACKEND_MODE: undefined, CHATBOT_BACKEND_URL: 'https://dino-backend.test', CHATBOT_BACKEND_KEY: 'chave-de-teste-com-24-car', WHATSAPP_POLL_MODE: undefined, WHATSAPP_POLL_PILOT_PHONES: undefined, WHATSAPP_MAX_REPLY_AGE_MINUTES: '30' };

async function comEnv(valores, fn) {
  const salvos = {};
  for (const [chave, valor] of Object.entries(valores)) { salvos[chave] = process.env[chave]; if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; }
  try { return await fn(); } finally { for (const [chave, valor] of Object.entries(salvos)) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; } }
}

const AGORA = Date.parse('2026-10-01T18:10:00.000Z');
const historico = {
  users: [
    { chatId: '5565999990001@c.us', messages: [
      { role: 'user', content: 'Quero marcar um corte amanhã', timestamp: '2026-10-01T18:05:00.000Z', whatsappMessageId: 'wa-1', messageType: 'text' },
      { role: 'assistant', content: 'Claro!', timestamp: '2026-10-01T18:05:05.000Z', messageType: 'text' },
      { role: 'user', content: 'mensagem velha', timestamp: '2026-10-01T16:00:00.000Z', whatsappMessageId: 'wa-0' },
    ] },
    { chatId: '5565999990002', messages: [
      { role: 'user', content: '[ÁUDIO RECEBIDO]', timestamp: '2026-10-01T18:06:00.000Z', whatsappMessageId: 'wa-2', messageType: 'audio' },
    ] },
  ],
};

function fetchHistorico() {
  const chamadas = [];
  const fn = async (url, options) => {
    chamadas.push({ url, method: options.method, headers: options.headers });
    return { ok: true, status: 200, text: async () => JSON.stringify(historico) };
  };
  fn.chamadas = chamadas;
  return fn;
}

function ingestFalso() {
  const vistos = new Set();
  const recebidos = [];
  const fn = async (canal, parsed) => {
    if (vistos.has(parsed.externalId)) return { duplicate: true };
    vistos.add(parsed.externalId);
    recebidos.push(parsed);
    return { duplicate: false, ignored: parsed.ignored };
  };
  fn.recebidos = recebidos;
  return fn;
}

test('mensagem do backend vira o mesmo evento do webhook, com id no formato da Isa', () => {
  const parsed = parseBackendMessage({ chatId: '65999990001', role: 'user', content: 'oi', timestamp: '2026-10-01T18:05:00.000Z', whatsappMessageId: 'wa-1' }, { agora: AGORA });
  assert.equal(parsed.ignored, false);
  assert.equal(parsed.event, 'MESSAGES_UPSERT');
  assert.equal(parsed.remoteJid, '5565999990001@s.whatsapp.net');
  assert.match(parsed.externalId, /^api:5565999990001:wa-1:[0-9a-f]{16}$/);
  assert.equal(parseBackendMessage({ chatId: '5565999990001', role: 'assistant', content: 'x', timestamp: '2026-10-01T18:05:00.000Z' }).reason, 'from_me');
  assert.equal(parseBackendMessage({ chatId: '120363@g.us', role: 'user', content: 'x', timestamp: '2026-10-01T18:05:00.000Z' }).reason, 'invalid_sender');
});

test('passada: só a mensagem nova e recente vai para a IA; áudio sem transcrição segue para a IA com aviso; repetir não duplica', async () => {
  await comEnv(ENV, async () => {
    assert.equal(pollEnabled(), true);
    const fetch = fetchHistorico();
    const ingest = ingestFalso();
    const enviados = [];
    const enviar = async (msg) => { enviados.push(msg); return { ok: true }; };
    const canal = { id: 'canal-1', empresa_id: 'e', loja_id: 'l' };
    const primeira = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal, ingest, enviar, autorizarSaida: async () => ({ ok: true }), comTrava: false, equipe: SEM_EQUIPE });
    // Regra de 28/10/2026: áudio que não pôde ser transcrito também segue para a IA (com aviso de falha).
    assert.equal(primeira.novas, 2, 'a mensagem de texto recente e o áudio sem transcrição');
    assert.equal(primeira.audios, 1);
    assert.equal(primeira.ignoradas, 2, 'mensagem velha e resposta da própria atendente');
    assert.deepEqual(enviados, [], 'sem resposta fixa: quem responde o áudio é a IA');
    assert.match(ingest.recebidos.find((item) => item.phone === '5565999990002').text, /Falha ao baixar ou transcrever audio/);
    assert.match(fetch.chamadas[0].url, /^https:\/\/dino-backend\.test\/api\/v1\/whats-app\/messages\?latest=false&role=user/);
    assert.equal(fetch.chamadas[0].headers['X-API-KEY'], 'chave-de-teste-com-24-car');
    assert.equal(ingest.recebidos.find((item) => !item.ignored && item.phone !== '5565999990002').text, 'Quero marcar um corte amanhã');

    const segunda = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal, ingest, enviar, autorizarSaida: async () => ({ ok: true }), comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(segunda.novas, 0);
    assert.ok(segunda.duplicadas >= 2);
    assert.equal(enviados.length, 0, 'nada é enviado fora da IA');
  });
});

test('polling pode registrar entrada sem enviar resposta de mídia com egress desligado', async () => {
  await comEnv({ ...ENV, CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino-1', CHATBOT_BACKEND_EMPRESA_ID: '11111111-1111-4111-8111-111111111111', WHATSAPP_LINE_VERIFIED: '1', WHATSAPP_POLL_MODE: 'pilot', WHATSAPP_POLL_PILOT_PHONES: '5565999990001,5565999990002', WHATSAPP_EGRESS_MODE: undefined }, async () => {
    let outbound = 0;
    const canal = { id: '33333333-3333-4333-8333-333333333333', empresa_id: '11111111-1111-4111-8111-111111111111', loja_id: '22222222-2222-4222-8222-222222222222', configuracao: { instance: 'dino-1' } };
    const summary = await runIsaPollPass({
      fetchImpl: fetchHistorico(), agora: AGORA,
      canal, carregarCanal: async () => canal,
      ingest: ingestFalso(), enviar: async () => { outbound += 1; return { ok: true }; },
      comTrava: false, equipe: SEM_EQUIPE,
    });
    assert.equal(summary.audios, 1);
    assert.equal(outbound, 0);
  });
});

test('modos: shadow só registra; pilot responde só os números liberados; off desliga', async () => {
  const canal = { id: 'canal-1', empresa_id: 'e', loja_id: 'l' };
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'shadow' }, async () => {
    const ingest = ingestFalso();
    const resumo = await runIsaPollPass({ fetchImpl: fetchHistorico(), agora: AGORA, canal, ingest, enviar: async () => ({ ok: true }), comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(resumo.novas, 0);
    assert.ok(ingest.recebidos.every((item) => item.ignored));
  });
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'pilot', WHATSAPP_POLL_PILOT_PHONES: '(65) 99999-0009' }, async () => {
    const resumo = await runIsaPollPass({ fetchImpl: fetchHistorico(), agora: AGORA, canal, ingest: ingestFalso(), enviar: async () => ({ ok: true }), comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(resumo.novas, 0);
    assert.equal(resumo.foraDoPiloto, 1);
  });
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'pilot', WHATSAPP_POLL_PILOT_PHONES: '65999990001' }, async () => {
    const resumo = await runIsaPollPass({ fetchImpl: fetchHistorico(), agora: AGORA, canal, ingest: ingestFalso(), enviar: async () => ({ ok: true }), comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(resumo.novas, 1);
  });
  await comEnv({ ...ENV, WHATSAPP_POLL_MODE: 'off' }, async () => {
    assert.equal((await runIsaPollPass({ canal, comTrava: false, equipe: SEM_EQUIPE })).reason, 'poll_disabled');
  });
  await comEnv({ ...ENV, CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino-1' }, async () => assert.equal(pollEnabled(), false, 'sem linha comprovada não se consulta mensagens'));
  await comEnv({ ...ENV, CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino-1', WHATSAPP_LINE_VERIFIED: '1', WHATSAPP_POLL_MODE: 'pilot' }, async () => assert.equal(pollEnabled(), true, 'piloto explícito pode consultar'));
  await comEnv({ ...ENV, CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino-1', WHATSAPP_LINE_VERIFIED: '1', WHATSAPP_POLL_MODE: 'on' }, async () => assert.equal(pollEnabled(), false, 'on requer rollout amplo aprovado'));
});

test('polling multi-instância exige vínculo canal↔instância antes de qualquer GET ou envio', async () => {
  await comEnv({ ...ENV, CHATBOT_BACKEND_MODE: 'instancias', CHATBOT_BACKEND_INSTANCE: 'dino-1', WHATSAPP_LINE_VERIFIED: '1', WHATSAPP_POLL_MODE: 'pilot' }, async () => {
    const fetch = fetchHistorico();
    const mismatch = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal: { id: 'canal-1', configuracao: { instance: 'isa' } }, ingest: ingestFalso(), comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(mismatch.reason, 'instance_scope_mismatch');
    assert.equal(fetch.chamadas.length, 0);
    const canal = { id: 'canal-1', empresa_id: 'empresa-1', loja_id: 'loja-1', configuracao: { instance: 'dino-1' } };
    const duplicate = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal, carregarCanal: async () => null, comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(duplicate.reason, 'channel_scope_mismatch', 'canal injetado e duplicado não consulta histórico');
    assert.equal(fetch.chamadas.length, 0);
    const matched = await runIsaPollPass({ fetchImpl: fetch, agora: AGORA, canal, carregarCanal: async () => canal, ingest: ingestFalso(), enviar: async () => ({ ok: true }), comTrava: false, equipe: SEM_EQUIPE });
    assert.equal(matched.skipped, false);
    assert.match(fetch.chamadas[0].url, /[?&]instanceName=dino-1/);
  });
});

test('canal injetado no modo Isa confirma ownership canônico antes do GET global', async () => {
  await comEnv({ ...ENV, CHATBOT_BACKEND_EMPRESA_ID: undefined }, async () => {
    const fetch = fetchHistorico();
    const result = await runPoll({
      fetchImpl: fetch, agora: AGORA,
      canal: { id: 'canal-incorreto', empresa_id: 'empresa-incorreta', loja_id: 'loja-incorreta' },
      carregarCanal: async () => ({ id: 'canal-oficial', empresa_id: 'empresa-oficial', loja_id: 'loja-oficial' }),
      comTrava: false, equipe: SEM_EQUIPE,
    });
    assert.equal(result.reason, 'channel_scope_mismatch');
    assert.equal(fetch.chamadas.length, 0);
  });
});

test('equipe respondeu pelo celular: a pausa é aplicada ANTES de entregar a mensagem do cliente', async () => {
  await comEnv(ENV, async () => {
    const ordem = [];
    const canal = { id: '00000000-0000-4000-8000-000000000001', empresa_id: 'e', loja_id: 'l' };
    const fetchImpl = async (url) => {
      const role = new URL(String(url)).searchParams.get('role');
      const corpo = role === 'assistant'
        ? { users: [{ chatId: '5565999990001', messages: [
          { role: 'assistant', interactionType: 'organic', content: 'Oi, aqui é a Jhenyffer', timestamp: '2026-10-01T18:04:00.000Z' },
          { role: 'assistant', interactionType: 'bot', content: 'lembrete', timestamp: '2026-10-01T18:03:00.000Z' },
        ] }, { chatId: '5565999990003', messages: [
          { role: 'assistant', interactionType: 'bot', content: 'Confirma seu horário?', timestamp: '2026-10-01T18:03:00.000Z' },
        ] }] }
        : { users: [{ chatId: '5565999990001', messages: [
          { role: 'user', content: 'pode ser às 15h?', timestamp: '2026-10-01T18:05:00.000Z', whatsappMessageId: 'wa-9', messageType: 'text' },
        ] }] };
      return { ok: true, status: 200, text: async () => JSON.stringify(corpo) };
    };
    const equipe = {
      liberar: async () => { ordem.push('liberar'); return 0; },
      pausar: async (_canal, contato) => { ordem.push(`pausar:${contato.phone}`); return { paused: true }; },
    };
    const ingest = async (_canal, parsed) => { ordem.push(`entregar:${parsed.phone}`); return { duplicate: false }; };
    const resumo = await runIsaPollPass({ fetchImpl, agora: AGORA, canal, ingest, enviar: async () => ({ ok: true }), comTrava: false, equipe });
    assert.deepEqual(ordem, ['liberar', 'pausar:5565999990001', 'entregar:5565999990001'], 'só o contato com mensagem "organic" pausa, e antes da entrega');
    assert.equal(resumo.equipeAssumiu, 1);
  });
});

test('WHATSAPP_AI_STAFF_TAKEOVER=off e modo shadow não consultam saídas nem pausam', async () => {
  for (const extra of [{ WHATSAPP_AI_STAFF_TAKEOVER: 'off' }, { WHATSAPP_POLL_MODE: 'shadow' }]) {
    await comEnv({ ...ENV, ...extra }, async () => {
      const chamadas = [];
      const equipe = { liberar: async () => { chamadas.push('liberar'); return 0; }, pausar: async () => { chamadas.push('pausar'); return { paused: true }; } };
      const fetchImpl = fetchHistorico();
      await runIsaPollPass({ fetchImpl, agora: AGORA, canal: { id: 'c' }, ingest: ingestFalso(), enviar: async () => ({ ok: true }), comTrava: false, equipe });
      assert.deepEqual(chamadas, []);
      assert.ok(fetchImpl.chamadas.every((c) => !/role=assistant/.test(c.url)));
    });
  }
});
