import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import {
  campaignOptOutRequested,
  cancelCampaign,
  confirmCampaign,
  createCampaign,
  listCampaignAudience,
  markCampaignDeliveryBlocked,
  normalizeCampaignCriteria,
  normalizeCampaignPhone,
  previewCampaign,
  processCampaignDeliveryTask,
  recordCampaignProviderEvent,
  updateCampaignConsent,
} from './commerce-campaigns.js';

const CONTEXT = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  usuarioId: '33333333-3333-4333-8333-333333333333',
};
const CAMPAIGN = '44444444-4444-4444-8444-444444444444';
const DELIVERY = '55555555-5555-4555-8555-555555555555';
const CUSTOMER = '66666666-6666-4666-8666-666666666666';
const CHANNEL = '77777777-7777-4777-8777-777777777777';

test('opt-out automático reconhece apenas comandos inequívocos', () => {
  assert.equal(campaignOptOutRequested({ phone: '5565999990000', text: 'SAIR!' }), true);
  assert.equal(campaignOptOutRequested({ phone: '5565999990000', text: 'Não quero receber.' }), true);
  assert.equal(campaignOptOutRequested({ phone: '5565999990000', text: 'Quero sair mais tarde' }), false);
  assert.equal(campaignOptOutRequested({ ignored: true, phone: '5565999990000', text: 'sair' }), false);
});

test('normaliza telefones brasileiros e rejeita formatos incompletos', () => {
  assert.equal(normalizeCampaignPhone('(65) 99999-0000'), '5565999990000');
  assert.equal(normalizeCampaignPhone('+55 65 99999-0000'), '5565999990000');
  assert.equal(normalizeCampaignPhone('123'), '');
});

test('normaliza critérios em allowlist e limita listas e períodos', () => {
  const criteria = normalizeCampaignCriteria({ city: ' Tangará ', state: 'mt', tag: 'VIP', createdWithinDays: 99999, customerIds: [CUSTOMER, CUSTOMER, 'principal'], sql: 'DROP TABLE' });
  assert.deepEqual(criteria, { city: 'Tangará', state: 'MT', tag: 'VIP', createdWithinDays: 3650, customerIds: [CUSTOMER] });
  assert.equal('sql' in criteria, false);
});

test('cria campanha somente como rascunho e audita sem enfileirar envio', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO campanhas_crm')) return { rows: [{ id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, status: 'rascunho' }] };
      if (sql.includes('INSERT INTO campanhas_crm_eventos')) return { rows: [] };
      throw new Error(`SQL inesperado: ${sql}`);
    },
  });
  try {
    const result = await createCampaign(CONTEXT, { name: 'Clientes VIP', message: 'Olá, {{nome}}! Temos novidades.', criteria: { tag: 'vip' } });
    assert.equal(result.status, 'rascunho');
    assert.equal(calls.length, 2);
    assert.match(calls[0].sql, /'rascunho'/);
    assert.deepEqual(calls[0].params.slice(0, 2), [CONTEXT.empresaId, CONTEXT.lojaId]);
    assert.equal(calls.some(call => call.sql.includes('tarefas_integracao_canais')), false);
  } finally { db.transaction = original; }
});

test('cancelamento limita campanha, destinatários e tarefas à empresa+unidade ativas', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SELECT * FROM campanhas_crm')) return { rows: [{ id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, status: 'enviando' }] };
    return { rows: [], rowCount: 1 };
  } });
  try {
    assert.deepEqual(await cancelCampaign(CONTEXT, CAMPAIGN), { id: CAMPAIGN, status: 'cancelada' });
    const campaignUpdate = calls.find(call => call.sql.includes('UPDATE campanhas_crm'));
    const deliveryUpdate = calls.find(call => call.sql.includes('UPDATE envios_campanha'));
    const taskUpdate = calls.find(call => call.sql.includes('UPDATE tarefas_integracao_canais'));
    assert.match(campaignUpdate.sql, /id = \$1 AND empresa_id = \$2 AND loja_id = \$3/);
    assert.deepEqual(campaignUpdate.params, [CAMPAIGN, CONTEXT.empresaId, CONTEXT.lojaId]);
    assert.match(deliveryUpdate.sql, /campanha_id = \$1 AND empresa_id = \$2 AND loja_id = \$3/);
    assert.deepEqual(deliveryUpdate.params, [CAMPAIGN, CONTEXT.empresaId, CONTEXT.lojaId]);
    assert.match(taskUpdate.sql, /empresa_id = \$1 AND loja_id = \$2/);
    assert.deepEqual(taskUpdate.params, [CONTEXT.empresaId, CONTEXT.lojaId, `${CAMPAIGN}:%`]);
  } finally { db.transaction = original; }
});

test('gate bloqueado terminaliza entrega CRM scoped e recalcula contadores', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('UPDATE envios_campanha ec')) return { rows: [{ campanha_id: CAMPAIGN }], rowCount: 1 };
    if (sql.includes('WITH metrics AS')) return { rows: [{ id: CAMPAIGN }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  const task = { id: '99999999-9999-4999-8999-999999999999', empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, canal_id: CHANNEL, tipo: 'enviar_campanha', payload: { campaignDeliveryId: DELIVERY } };
  try {
    assert.deepEqual(await markCampaignDeliveryBlocked(task, 'cliente_pediu_sair'), { terminalized: true });
    const update = calls.find(call => call.sql.includes('UPDATE envios_campanha ec'));
    assert.match(update.sql, /ec\.empresa_id = \$2 AND ec\.loja_id = \$3 AND ec\.canal_id = \$4/);
    assert.match(update.sql, /t\.id = \$6 AND t\.empresa_id = \$2 AND t\.loja_id = \$3 AND t\.canal_id = \$4/);
    assert.deepEqual(update.params.slice(0, 4), [DELIVERY, CONTEXT.empresaId, CONTEXT.lojaId, CHANNEL]);
    assert.equal(calls.some(call => call.sql.includes('WITH metrics AS')), true);
  } finally { db.query = original; }
});

test('bloqueia audiência CRM sem vínculo comprovável cliente-unidade antes da consulta', async () => {
  const original = db.query;
  let queryCalled = false;
  db.query = async () => { queryCalled = true; throw new Error('não deve consultar audiência tenant-wide'); };
  try {
    await assert.rejects(
      listCampaignAudience(CONTEXT, { search: 'Ana', limit: 10 }),
      error => error.code === 'AUDIENCE_STORE_SCOPE_UNAVAILABLE' && /não comprova vínculo/.test(error.message),
    );
    assert.equal(queryCalled, false);
  } finally { db.query = original; }
});

test('concessão de opt-in exige origem e evidência antes do banco', async () => {
  await assert.rejects(
    () => updateCampaignConsent(CONTEXT, CUSTOMER, { granted: true, origin: 'cliente_solicitou', evidenceNote: '' }),
    error => error.code === 'VALIDATION_ERROR' && /evidência/.test(error.message),
  );
});

test('bloqueia alteração administrativa de consentimento sem vínculo cliente-unidade', async () => {
  const original = db.transaction;
  let transactionCalled = false;
  db.transaction = async () => { transactionCalled = true; throw new Error('não deve consultar cliente tenant-wide'); };
  try {
    await assert.rejects(
      updateCampaignConsent(CONTEXT, CUSTOMER, { granted: true, origin: 'cliente_solicitou', evidenceNote: 'Consentimento registrado' }),
      error => error.code === 'AUDIENCE_STORE_SCOPE_UNAVAILABLE',
    );
    assert.equal(transactionCalled, false);
  } finally { db.transaction = original; }
});

test('preview e confirmação CRM falham fechados sem selecionar nem enfileirar contatos', async () => {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const queries = [];
  db.query = async sql => {
    queries.push(sql);
    if (sql.includes('SELECT * FROM campanhas_crm')) return { rows: [{ id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, status: 'rascunho', segmento_criterios: {} }] };
    throw new Error(`consulta inesperada: ${sql}`);
  };
  db.transaction = async callback => callback({ query: async sql => {
    queries.push(sql);
    if (sql.includes('SELECT * FROM campanhas_crm')) return { rows: [{ id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, status: 'rascunho', segmento_criterios: {} }] };
    throw new Error(`consulta transacional inesperada: ${sql}`);
  } });
  try {
    await assert.rejects(previewCampaign(CONTEXT, CAMPAIGN), error => error.code === 'AUDIENCE_STORE_SCOPE_UNAVAILABLE');
    await assert.rejects(
      confirmCampaign(CONTEXT, CAMPAIGN, { confirmed: true, previewHash: 'a'.repeat(64) }),
      error => error.code === 'AUDIENCE_STORE_SCOPE_UNAVAILABLE',
    );
    assert.equal(queries.some(sql => /FROM clientes c/.test(sql)), false);
    assert.equal(queries.some(sql => /INSERT INTO envios_campanha|tarefas_integracao_canais/.test(sql)), false);
  } finally { db.query = originalQuery; db.transaction = originalTransaction; }
});

test('confirmação de campanha é rejeitada antes do banco sem aceite humano', async () => {
  await assert.rejects(
    () => confirmCampaign(CONTEXT, CAMPAIGN, { confirmed: false, previewHash: 'a'.repeat(64) }),
    error => error.code === 'CONFIRMATION_REQUIRED',
  );
});

test('replay do mesmo fingerprint retorna o lote existente sem nova mutação', async () => {
  const original = db.transaction;
  const hash = 'a'.repeat(64);
  const calls = [];
  db.transaction = async callback => callback({ async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('FROM campanhas_crm')) return { rows: [{ id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, status: 'enviando', preview_hash: hash }] };
    if (sql.includes('COUNT(*)::int AS total FROM envios_campanha')) return { rows: [{ total: 2 }] };
    throw new Error('replay não deve mutar campanha');
  } });
  try {
    const result = await confirmCampaign(CONTEXT, CAMPAIGN, { confirmed: true, previewHash: hash });
    assert.equal(result.replayed, true);
    assert.equal(result.queued, 2);
    assert.equal(calls.length, 2);
  } finally { db.transaction = original; }
});

test('worker revalida consentimento e bloqueia destinatário antes de chamar Evolution', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM envios_campanha ec')) return { rows: [{
      id: DELIVERY, campanha_id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId,
      canal_id: CHANNEL, cliente_id: CUSTOMER, status: 'pendente', telefone: '(65) 99999-0000',
      mensagem: 'Olá, {{nome}}', cliente_nome: 'Ana Silva', campanha_status: 'enviando', canal_status: 'ativo', configuracao: { instance: 'dino' },
    }] };
    if (sql.includes('FROM consentimentos_cliente')) return { rows: [{ concedido: false }] };
    if (sql.includes("SET status = 'bloqueado'")) return { rows: [], rowCount: 1 };
    if (sql.includes('WITH metrics AS')) return { rows: [{ id: CAMPAIGN }] };
    throw new Error(`SQL inesperado: ${sql}`);
  };
  try {
    const result = await processCampaignDeliveryTask({ empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, canal_id: CHANNEL, payload: { campaignDeliveryId: DELIVERY } });
    assert.deepEqual(result, { blocked: true });
    assert.match(calls[0].sql, /c\.loja_id = ec\.loja_id/);
    assert.match(calls[0].sql, /ci\.loja_id = ec\.loja_id/);
    assert.match(calls[0].sql, /ec\.canal_id = \$4 AND ci\.id = \$4/);
    assert.deepEqual(calls[0].params, [DELIVERY, CONTEXT.empresaId, CONTEXT.lojaId, CHANNEL]);
    assert.equal(calls.some(call => call.sql.includes("status = 'processando'")), false);
  } finally { db.query = original; }
});

test('exception do provedor só libera retry quando marcada retryable; caso ambíguo fica incerto', async () => {
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const task = {
    id: '99999999-9999-4999-8999-999999999999', empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId,
    canal_id: CHANNEL, lease_token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    payload: { campaignDeliveryId: DELIVERY },
  };
  const run = async (providerError, expectedStatus, shouldClearClaim) => {
    const calls = [];
    db.query = async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM envios_campanha ec')) return { rows: [{
        id: DELIVERY, campanha_id: CAMPAIGN, empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId,
        canal_id: CHANNEL, cliente_id: CUSTOMER, status: 'pendente', telefone: '5565999990000',
        mensagem: 'Olá', cliente_nome: 'Ana', campanha_status: 'enviando', canal_status: 'ativo',
      }] };
      if (sql.includes('FROM consentimentos_cliente')) return { rows: [{ concedido: true }] };
      if (sql.includes('WITH metrics AS')) return { rows: [{ id: CAMPAIGN }] };
      throw new Error(`SQL inesperado: ${sql}`);
    };
    db.transaction = async callback => callback({ query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('delivery_started_at = CURRENT_TIMESTAMP')) return { rowCount: 1 };
      if (sql.includes("SET status = 'processando'")) return { rowCount: 1 };
      if (sql.includes('SET status = $5, erro = $6')) return { rowCount: 1 };
      if (sql.includes('SET delivery_started_at = NULL')) return { rowCount: 1 };
      throw new Error(`SQL transacional inesperado: ${sql}`);
    } });
    await assert.rejects(
      processCampaignDeliveryTask(task, { sendMessage: async () => { throw providerError; } }),
      error => error.code === (shouldClearClaim ? 'CAMPAIGN_SEND_FAILED' : 'CAMPAIGN_DELIVERY_UNKNOWN')
        && error.retryable === shouldClearClaim,
    );
    const state = calls.find(call => call.sql.includes('SET status = $5, erro = $6'));
    assert.equal(state.params[4], expectedStatus);
    const clear = calls.find(call => call.sql.includes('SET delivery_started_at = NULL'));
    assert.equal(Boolean(clear), shouldClearClaim);
    if (clear) assert.deepEqual(clear.params, [task.id, CONTEXT.empresaId, CONTEXT.lojaId, CHANNEL, task.lease_token]);
  };
  try {
    await run(Object.assign(new Error('timeout'), { uncertain: true }), 'incerto', false);
    await run(Object.assign(new Error('rate limit'), { retryable: true, uncertain: false }), 'falha', true);
  } finally { db.query = originalQuery; db.transaction = originalTransaction; }
});

test('replay de campanha já enviado conclui idempotente mesmo com canal agora inativo', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: DELIVERY, campanha_id: CAMPAIGN, status: 'enviado', canal_status: 'inativo' }] };
  };
  try {
    const result = await processCampaignDeliveryTask({
      id: '99999999-9999-4999-8999-999999999999', empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId,
      canal_id: CHANNEL, delivery_started_at: new Date().toISOString(),
      payload: { campaignDeliveryId: DELIVERY },
    });
    assert.deepEqual(result, { idempotent: true, status: 'enviado' });
    assert.equal(calls.length, 1);
    assert.doesNotMatch(calls[0].sql, /ci\.status = 'ativo'/);
  } finally { db.query = original; }
});

test('webhook de leitura atualiza somente a mensagem externa do canal e recalcula a campanha', async () => {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('UPDATE envios_campanha SET status = CASE')) return { rows: [{ campanha_id: CAMPAIGN }] };
    if (sql.includes('WITH metrics AS')) return { rows: [{ id: CAMPAIGN }] };
    throw new Error(`SQL inesperado: ${sql}`);
  };
  try {
    const result = await recordCampaignProviderEvent(
      { id: CHANNEL, empresa_id: CONTEXT.empresaId },
      { data: { key: { id: 'MSG-123' }, status: 'READ' } },
      { ignored: true },
    );
    assert.deepEqual(result.updatedCampaigns, [CAMPAIGN]);
    assert.deepEqual(calls[0].params, [CONTEXT.empresaId, CHANNEL, 'lido', 'MSG-123']);
  } finally { db.query = original; }
});
