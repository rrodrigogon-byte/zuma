import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from './database.js';
import { confirmPendingAction, createWhatsappAiToolExecutor, WhatsappAiToolError, WHATSAPP_AI_TOOL_DECLARATIONS } from './whatsapp-ai-tools.js';

const CONTEXT = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  phone: '5565999999999',
  externalEventId: 'MSG-1',
};

test('executor rejeita ferramenta fora da allowlist', async () => {
  await assert.rejects(
    () => createWhatsappAiToolExecutor(CONTEXT)('apagar_banco', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'TOOL_NOT_ALLOWED',
  );
});

test('confirmPendingAction devolve ação concluída sem executar nova mutação', async () => {
  const original = db.transaction;
  const calls = [];
  db.transaction = async callback => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM whatsapp_ai_sessions')) return { rows: [{ acao_pendente: { actionId: '55555555-5555-4555-8555-555555555555' } }] };
      if (sql.includes('FROM whatsapp_ai_actions')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', status: 'concluida', resposta: { ok: true, publicCode: 'KC-TESTE' } }] };
      throw new Error('nenhuma mutação adicional deveria ocorrer');
    },
  });
  try {
    const result = await confirmPendingAction(CONTEXT);
    assert.deepEqual(result, { ok: true, publicCode: 'KC-TESTE' });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].params.slice(1), [CONTEXT.empresaId, CONTEXT.lojaId]);
    assert.deepEqual(calls[1].params.slice(1), [CONTEXT.empresaId, CONTEXT.lojaId]);
  } finally { db.transaction = original; }
});

test('executor bloqueia promoções quando a capacidade não está habilitada no canal', async () => {
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, capabilities: { sendPromotions: false } })('listar_promocoes_ativas', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'CAPABILITY_DISABLED',
  );
});

test('despesa está na allowlist e pode ser desabilitada por canal', async () => {
  assert.equal(WHATSAPP_AI_TOOL_DECLARATIONS.some((tool) => tool.name === 'preparar_despesa'), true);
  await assert.rejects(
    () => createWhatsappAiToolExecutor({ ...CONTEXT, capabilities: { financialOperations: false } })('preparar_despesa', {}),
    error => error instanceof WhatsappAiToolError && error.code === 'CAPABILITY_DISABLED',
  );
});

test('mesma mídia de despesa não cria segunda ação', async () => {
  const original = db.queryRead;
  const mediaHash = 'a'.repeat(64);
  db.queryRead = async () => ({ rows: [{ id: 'acao-existente', status: 'preparada', solicitacao: {}, resposta: null }] });
  try {
    const result = await createWhatsappAiToolExecutor({
      ...CONTEXT,
      customerText: `[foto enviada pelo cliente]\n[despesa extraída da foto] ${JSON.stringify({ fornecedor: 'Fornecedor Teste', valor: 47, dataDocumento: '2026-10-14', categoria: 'Outros', descricao: 'Recibo', confianca: 0.99, mediaHash })}`,
    })('preparar_despesa', {});
    assert.equal(result.duplicada, true);
    assert.equal(result.acao.id, 'acao-existente');
  } finally { db.queryRead = original; }
});
