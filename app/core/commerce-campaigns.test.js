import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import {
  campaignOptOutRequested,
  confirmCampaign,
  createCampaign,
  listCampaignAudience,
  normalizeCampaignCriteria,
  normalizeCampaignPhone,
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

test('lista audiência somente no tenant e aplica busca parametrizada', async () => {
  const original = db.query;
  let captured;
  db.query = async (sql, params) => { captured = { sql, params }; return { rows: [{ id: CUSTOMER, nome: 'Ana', total: 1 }] }; };
  try {
    const result = await listCampaignAudience(CONTEXT, { search: 'Ana', limit: 10 });
    assert.equal(result.total, 1);
    assert.match(captured.sql, /c\.empresa_id = \$1/);
    assert.equal(captured.params[0], CONTEXT.empresaId);
    assert.equal(captured.params[1], '%Ana%');
  } finally { db.query = original; }
});

test('concessão de opt-in exige origem e evidência antes do banco', async () => {
  await assert.rejects(
    () => updateCampaignConsent(CONTEXT, CUSTOMER, { granted: true, origin: 'cliente_solicitou', evidenceNote: '' }),
    error => error.code === 'VALIDATION_ERROR' && /evidência/.test(error.message),
  );
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
      mensagem: 'Olá, {{nome}}', cliente_nome: 'Ana Silva', campanha_status: 'enviando', configuracao: { instance: 'dino' },
    }] };
    if (sql.includes('FROM consentimentos_cliente')) return { rows: [{ concedido: false }] };
    if (sql.includes("SET status = 'bloqueado'")) return { rows: [], rowCount: 1 };
    if (sql.includes('WITH metrics AS')) return { rows: [{ id: CAMPAIGN }] };
    throw new Error(`SQL inesperado: ${sql}`);
  };
  try {
    const result = await processCampaignDeliveryTask({ empresa_id: CONTEXT.empresaId, loja_id: CONTEXT.lojaId, payload: { campaignDeliveryId: DELIVERY } });
    assert.deepEqual(result, { blocked: true });
    assert.equal(calls.some(call => call.sql.includes("status = 'processando'")), false);
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
