import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { db } from './database.js';
import {
  buildWhatsappAiSystemPrompt,
  claimWhatsappAiHandoff,
  closeWhatsappAiHandoff,
  configureWhatsappAiChannel,
  configureWhatsappAiPolicy,
  listWhatsappAiSessions,
  parseEvolutionMessage,
  processWhatsappConversationTask,
  releaseWhatsappAiHandoff,
  syncWhatsappAiWebhook,
  testWhatsappAiGemini,
  whatsappAiOperationalStatus,
} from './whatsapp-ai.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const USUARIO = '33333333-3333-4333-8333-333333333333';
const SESSAO = '44444444-4444-4444-8444-444444444444';

test('parseEvolutionMessage extrai mensagem individual recebida da Evolution', () => {
  const parsed = parseEvolutionMessage({
    event: 'messages.upsert',
    data: {
      key: { id: 'MSG-1', remoteJid: '5565999999999@s.whatsapp.net', fromMe: false },
      pushName: 'Cliente Dino',
      messageTimestamp: 123456,
      message: { conversation: 'Quero agendar um corte' },
    },
  });
  assert.deepEqual(parsed, {
    ignored: false,
    event: 'MESSAGES_UPSERT',
    externalId: 'MSG-1',
    remoteJid: '5565999999999@s.whatsapp.net',
    phone: '5565999999999',
    name: 'Cliente Dino',
    text: 'Quero agendar um corte',
    timestamp: 123456,
  });
});

test('parseEvolutionMessage ignora mensagens enviadas pela própria instância', () => {
  const parsed = parseEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-2', remoteJid: '5565999999999@s.whatsapp.net', fromMe: true }, message: { conversation: 'eco' } } });
  assert.equal(parsed.ignored, true);
  assert.equal(parsed.reason, 'from_me');
});

test('parseEvolutionMessage ignora grupos e conteúdo sem texto', () => {
  const group = parseEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-3', remoteJid: '1203630@g.us', fromMe: false }, message: { conversation: 'oi' } } });
  assert.equal(group.reason, 'group');
  const media = parseEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-4', remoteJid: '5565999999999@s.whatsapp.net', fromMe: false }, message: { audioMessage: {} } } });
  assert.equal(media.reason, 'unsupported_content');
});

test('prompt exige ferramentas, confirmação, transparência e handoff sem pagamento externo', () => {
  const prompt = buildWhatsappAiSystemPrompt({ storeName: 'Barbearia Dino', pendingAction: { summary: '1x produto' } });
  assert.match(prompt, /assistente virtual/i);
  assert.match(prompt, /Nunca invente produto/);
  assert.match(prompt, /SIM \(ou CONFIRMAR\) para concluir ou NÃO para desistir/);
  assert.match(prompt, /responder SIM para confirmar ou NÃO para desistir/);
  assert.match(prompt, /áudio do cliente transcrito/);
  assert.match(prompt, /Pagamento externo não está habilitado/);
  assert.match(prompt, /solicitar_humano/);
  assert.match(prompt, /Há uma ação pendente/);
});

test('status operacional rejeita contexto legado antes de consultar colunas UUID', async () => {
  await assert.rejects(
    () => whatsappAiOperationalStatus({ empresaId: 'principal', lojaId: '' }),
    (error) => {
      assert.equal(error.code, 'TENANT_CONTEXT_REQUIRED');
      assert.match(error.message, /empresa Commerce autorizada/i);
      assert.doesNotMatch(error.message, /uuid/i);
      return true;
    },
  );
});

test('status operacional exige loja Commerce UUID mesmo com empresa válida', async () => {
  await assert.rejects(
    () => whatsappAiOperationalStatus({ empresaId: EMPRESA, lojaId: 'principal' }),
    (error) => {
      assert.equal(error.code, 'STORE_SELECTION_REQUIRED');
      assert.match(error.message, /loja Commerce autorizada/i);
      return true;
    },
  );
});

test('política administrativa preserva defaults governados, exige escopo e audita sem conteúdo', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      if (/UPDATE canais_integracao/.test(sql)) return { rows: [{ id: SESSAO, codigo_publico: SESSAO, nome: 'Dino', status: 'rascunho', configuracao: { ai_policy: JSON.parse(params[2]) } }] };
      return { rows: [], rowCount: 1 };
    },
  });
  try {
    const result = await configureWhatsappAiPolicy({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO }, {
      personalizationEnabled: true,
      opportunitiesEnabled: true,
      cooldownDays: 45,
      privacyNotice: 'Atendimento virtual com personalização consentida.',
      confirmed: true,
    });
    assert.equal(result.policy.personalizationEnabled, true);
    assert.equal(result.policy.opportunitiesEnabled, true);
    assert.equal(result.policy.maxOpportunities, 1);
    assert.match(calls[0].sql, /empresa_id = \$1 AND loja_id = \$2/);
    assert.match(calls[1].sql, /commerce_audit_logs/);
    assert.doesNotMatch(JSON.stringify(calls), /telefone|conteudo|GEMINI_API_KEY|EVOLUTION_API_KEY/);
    await assert.rejects(() => configureWhatsappAiPolicy({ empresaId: EMPRESA, lojaId: LOJA }, { personalizationEnabled: true }), /confirmação humana/i);
    await assert.rejects(() => configureWhatsappAiPolicy({ empresaId: EMPRESA, lojaId: LOJA }, { personalizationEnabled: false, opportunitiesEnabled: true, confirmed: true }), /exigem personalização/i);
  } finally { db.transaction = original; }
});

test('operações sensíveis rejeitam chamadas sem confirmação server-side', async () => {
  await assert.rejects(
    () => configureWhatsappAiChannel({ empresaId: EMPRESA, lojaId: LOJA }, { status: 'ativo', instance: 'dino' }),
    /confirmação humana/i,
  );
  await assert.rejects(() => syncWhatsappAiWebhook({ empresaId: EMPRESA, lojaId: LOJA }), /confirmação humana/i);
  await assert.rejects(() => testWhatsappAiGemini({ empresaId: EMPRESA, lojaId: LOJA }), /confirmação humana/i);
});

test('lista de sessões expõe somente DTO operacional mascarado', async () => {
  const original = db.queryRead;
  db.queryRead = async () => ({ rows: [{
    id: SESSAO, telefone: '5511999999999', nome: 'Cliente', status: 'humano', assigned_to: USUARIO,
    has_pending_action: true, marketing_opt_out: false, handoff_reason: 'pedido_do_cliente',
    priority: 3, opportunity_count: 1, estado: { secret: 'não expor' }, acao_pendente: { request: 'não expor' },
  }] });
  try {
    const rows = await listWhatsappAiSessions({ empresaId: EMPRESA, lojaId: LOJA }, { limit: 10 });
    assert.equal(rows[0].telefone, '***9999');
    assert.equal(rows[0].hasPendingAction, true);
    assert.equal(rows[0].assigned, true);
    assert.equal(rows[0].assigned_to, undefined);
    assert.equal(rows[0].estado, undefined);
    assert.equal(rows[0].acao_pendente, undefined);
    assert.doesNotMatch(JSON.stringify(rows), /não expor/);
  } finally { db.queryRead = original; }
});

test('status operacional retorna apenas readiness e métricas agregadas, sem URL de API ou segredo', async () => {
  const original = db.queryRead;
  db.queryRead = async (sql) => {
    if (/FROM canais_integracao/.test(sql)) return { rows: [{ id: SESSAO, codigo_publico: SESSAO, nome: 'Dino', status: 'pausado', api_base_url: 'https://secret.invalid', configuracao: { instance: 'dino', segredo_env: 'SECRET' }, ai_consecutive_failures: 2 }] };
    if (/FROM whatsapp_ai_sessions/.test(sql)) return { rows: [{ status: 'humano', total: 2, unassigned: 1 }] };
    if (/FROM tarefas_integracao_canais/.test(sql)) return { rows: [{ status: 'falha', total: 3, dead_letter: 1 }] };
    if (/FROM whatsapp_ai_messages/.test(sql)) return { rows: [{ status: 'unknown', total: 1 }, { status: 'sent', total: 4 }] };
    if (/FROM whatsapp_ai_provider_runs/.test(sql)) return { rows: [{ total: 5, success: 4, failed: 1, avg_latency_ms: 800, tool_calls: 2 }] };
    if (/FROM whatsapp_ai_worker_leases/.test(sql)) return { rows: [{ titular: 'host-private', active: false, expira_em: null, atualizado_em: '2026-09-02T20:00:00Z' }] };
    return { rows: [] };
  };
  try {
    const status = await whatsappAiOperationalStatus({ empresaId: EMPRESA, lojaId: LOJA });
    assert.equal(status.channel.instance, 'dino');
    assert.equal(status.channel.api_base_url, undefined);
    assert.equal(status.channel.configuracao, undefined);
    assert.equal(status.humanQueue.unassigned, 1);
    assert.equal(status.tasks.deadLetter, 1);
    assert.equal(status.deliveries.unknown, 1);
    assert.equal(status.provider24h.avgLatencyMs, 800);
    assert.equal(status.worker.titular, undefined);
    assert.doesNotMatch(JSON.stringify(status), /secret\.invalid|SECRET|host-private/);
  } finally { db.queryRead = original; }
});

function mockHandoffTransaction(returning) {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      if (/UPDATE whatsapp_ai_sessions/.test(sql)) return { rows: [returning], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  });
  return { calls, restore() { db.transaction = original; } };
}

test('claim de handoff é tenant-scoped, atribui o operador autenticado e audita sem conteúdo', async () => {
  const mock = mockHandoffTransaction({ id: SESSAO, status: 'humano', assigned_to: USUARIO, priority: 3 });
  try {
    const result = await claimWhatsappAiHandoff({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO }, SESSAO);
    assert.equal(result.assigned_to, USUARIO);
    assert.match(mock.calls[0].sql, /empresa_id = \$2 AND loja_id = \$3/);
    assert.match(mock.calls[0].sql, /assigned_to IS NULL OR assigned_to = \$4/);
    assert.deepEqual(mock.calls[0].params, [SESSAO, EMPRESA, LOJA, USUARIO]);
    assert.match(mock.calls[1].sql, /commerce_audit_logs/);
    assert.doesNotMatch(JSON.stringify(mock.calls[1].params), /telefone|conteudo|remote_jid/);
  } finally { mock.restore(); }
});

test('retomar e encerrar handoff exigem o mesmo tenant e registram auditoria', async () => {
  const releaseMock = mockHandoffTransaction({ id: SESSAO, status: 'ativo' });
  try {
    assert.equal((await releaseWhatsappAiHandoff({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO }, SESSAO)).status, 'ativo');
    assert.match(releaseMock.calls[0].sql, /status = 'humano'/);
    assert.match(releaseMock.calls[1].params[4], /automation_resumed/);
  } finally { releaseMock.restore(); }
  const closeMock = mockHandoffTransaction({ id: SESSAO, status: 'encerrado' });
  try {
    assert.equal((await closeWhatsappAiHandoff({ empresaId: EMPRESA, lojaId: LOJA, usuarioId: USUARIO }, SESSAO)).status, 'encerrado');
    assert.match(closeMock.calls[0].sql, /acao_pendente = NULL/);
    assert.match(closeMock.calls[1].params[4], /closed/);
  } finally { closeMock.restore(); }
});

async function withEvolutionServer(callback) {
  let body;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      body = JSON.parse(raw);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ key: { id: 'evolution-1' } }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`, () => body);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function mockConversationDatabase({ baseUrl, priorOutput = null } = {}) {
  const originals = { query: db.query, queryRead: db.queryRead, transaction: db.transaction };
  const session = { id: SESSAO, empresa_id: EMPRESA, loja_id: LOJA, canal_id: '55555555-5555-4555-8555-555555555555', telefone: '5565999999999', nome: 'Cliente', status: 'ativo', estado: {}, privacy_notice_at: null };
  const record = {
    id: '66666666-6666-4666-8666-666666666666', empresa_id: EMPRESA, loja_id: LOJA,
    canal_id: session.canal_id, evento_integracao_id: '77777777-7777-4777-8777-777777777777',
    event_payload: { event: 'MESSAGES_UPSERT', data: { key: { id: 'MSG-HANDOFF', remoteJid: `${session.telefone}@s.whatsapp.net`, fromMe: false }, pushName: 'Cliente', message: { conversation: 'Quero falar com atendente' } } },
    provedor: 'whatsapp', canal_status: 'ativo', canal_nome: 'Dino', api_base_url: baseUrl,
    configuracao: { instance: 'dino', display_name: 'Barbearia Dino' }, ai_circuit_open_until: null,
  };
  const calls = [];
  db.transaction = async callback => callback({
    async query(sql) {
      calls.push(sql);
      if (/INSERT INTO whatsapp_ai_sessions/.test(sql)) return { rows: [session], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  });
  db.queryRead = async sql => {
    calls.push(sql);
    if (/SELECT t\.\*, e\.payload/.test(sql)) return { rows: [record] };
    if (/FROM whatsapp_ai_messages/.test(sql) && /evento_externo_id/.test(sql) && !/COUNT/.test(sql)) return { rows: priorOutput ? [priorOutput] : [] };
    if (/COUNT\(\*\) FILTER/.test(sql)) return { rows: [{ contact_total: 0, channel_total: 0 }] };
    return { rows: [] };
  };
  db.query = async (sql, params) => {
    calls.push(sql);
    if (/privacy_notice_at = CURRENT_TIMESTAMP/.test(sql)) return { rows: [{ id: SESSAO }], rowCount: 1 };
    if (/INSERT INTO whatsapp_ai_messages/.test(sql)) return { rows: [{ id: '88888888-8888-4888-8888-888888888888', empresa_id: EMPRESA, loja_id: LOJA, canal_id: session.canal_id, sessao_id: SESSAO, conteudo: params[5], metadados: JSON.parse(params[6]), delivery_status: 'prepared' }], rowCount: 1 };
    if (/delivery_status = 'sending'/.test(sql)) return { rows: [{ id: '88888888-8888-4888-8888-888888888888', empresa_id: EMPRESA, loja_id: LOJA, canal_id: session.canal_id, sessao_id: SESSAO, conteudo: `${'Sou o assistente virtual da Barbearia Dino.'}\n\nCerto. Encaminhei sua conversa para a equipe humana da Barbearia Dino.`, metadados: {}, delivery_status: 'sending' }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  return {
    record,
    calls,
    restore() { db.query = originals.query; db.queryRead = originals.queryRead; db.transaction = originals.transaction; },
  };
}

test('processamento local informa privacidade, envia uma vez e mantém handoff humano', async () => {
  await withEvolutionServer(async (baseUrl, requestBody) => {
    const mock = mockConversationDatabase({ baseUrl });
    try {
      const result = await processWhatsappConversationTask(mock.record);
      assert.equal(result.delivered, true);
      assert.equal(result.kind, 'handoff');
      assert.match(requestBody().text, /assistente virtual/i);
      assert.match(requestBody().text, /equipe humana/i);
      assert.equal(mock.calls.some(sql => /handoff_requested_at/.test(sql)), true);
      assert.equal(mock.calls.some(sql => /delivery_status = 'sent'/.test(sql)), true);
    } finally { mock.restore(); }
  });
});

test('saída anterior incerta nunca chama Evolution novamente e força revisão humana', async () => {
  const prior = { id: '88888888-8888-4888-8888-888888888888', empresa_id: EMPRESA, loja_id: LOJA, canal_id: '55555555-5555-4555-8555-555555555555', sessao_id: SESSAO, conteudo: 'resposta anterior', metadados: {}, delivery_status: 'unknown' };
  const mock = mockConversationDatabase({ baseUrl: 'http://127.0.0.1:1', priorOutput: prior });
  try {
    const result = await processWhatsappConversationTask(mock.record);
    assert.equal(result.handoff, true);
    assert.equal(result.uncertain, true);
    assert.equal(mock.calls.some(sql => /handoff_requested_at/.test(sql)), true);
    assert.equal(mock.calls.some(sql => /delivery_status = 'sending'/.test(sql)), false);
  } finally { mock.restore(); }
});

test('parser aceita os formatos do backend NossaGente (Baileys e wppconnect) sem afrouxar filtros', () => {
  const baileys = parseEvolutionMessage({ event: 'messages.upsert', data: { messages: [{ key: { id: 'B1', remoteJid: '5565999990000@s.whatsapp.net', fromMe: false }, pushName: 'Ana', message: { conversation: 'Quero agendar' } }] } });
  assert.equal(baileys.ignored, false);
  assert.equal(baileys.phone, '5565999990000');
  assert.equal(baileys.text, 'Quero agendar');
  const wpp = parseEvolutionMessage({ event: 'onmessage', data: { id: 'W1', from: '5565988887777@c.us', body: 'Oi', type: 'chat', notifyName: 'Beto' } });
  assert.equal(wpp.ignored, false);
  assert.equal(wpp.name, 'Beto');
  assert.equal(parseEvolutionMessage({ event: 'message', data: { id: 'G1', from: '123@g.us', body: 'x', isGroupMsg: true } }).reason, 'group');
  assert.equal(parseEvolutionMessage({ event: 'message', data: { id: 'M1', from: '5565988887777@c.us', body: 'eco', fromMe: true } }).reason, 'from_me');
  assert.equal(parseEvolutionMessage({ event: 'connection.update', data: { state: 'open' } }).reason, 'unsupported_event');
});

test('mensagem com endereço @lid usa o número real enviado pelo provedor, ou é ignorada', () => {
  const comNumero = parseEvolutionMessage({ event: 'messages.upsert', data: { key: { id: 'LID-1', remoteJid: '123456789012345@lid', senderPn: '5565999990001@s.whatsapp.net', fromMe: false }, message: { conversation: 'SAIR' } } });
  assert.equal(comNumero.ignored, false);
  assert.equal(comNumero.phone, '5565999990001');
  assert.equal(comNumero.remoteJid, '5565999990001@s.whatsapp.net', 'resposta vai para o número, não para o LID');
  const semNumero = parseEvolutionMessage({ event: 'messages.upsert', data: { key: { id: 'LID-2', remoteJid: '123456789012345@lid', fromMe: false }, message: { conversation: 'oi' } } });
  assert.equal(semNumero.ignored, true);
  assert.equal(semNumero.reason, 'lid_without_phone');
});

test('segredo do webhook só pode vir de variável própria de webhook (nunca JWT_SECRET, DATABASE_URL…)', async () => {
  for (const name of ['JWT_SECRET', 'DATABASE_URL', 'EVOLUTION_API_KEY', 'NODE_ENV']) {
    await assert.rejects(
      () => configureWhatsappAiChannel({ empresaId: EMPRESA, lojaId: LOJA }, { status: 'rascunho', instance: 'dino', webhookSecretEnv: name }),
      /WHATSAPP_AI_WEBHOOK_SECRET/,
      name,
    );
  }
});
