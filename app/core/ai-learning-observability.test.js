import test from 'node:test';
import assert from 'node:assert/strict';
import { runLearningCycle } from './ai-learning.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
async function cycle(router, messages = true) {
  let persisted;
  const writes = [];
  const query = async (sql, values) => {
    writes.push(sql);
    if (sql.includes('INSERT INTO ai_learning_runs')) return { rows: [{ id: 'run' }] };
    if (sql.includes('FROM whatsapp_ai_messages')) return { rows: messages ? [
      { telefone: '5565999990000', papel: 'user', conteudo: 'Olá', criado_em: new Date(), sessao_status: 'ativo' },
    ] : [] };
    if (sql.includes('INSERT INTO ai_conversation_summaries')) return { rows: [{ id: 'summary' }] };
    if (sql.includes("SET status = 'concluido'")) persisted = JSON.parse(values[1]);
    return { rows: [], rowCount: 0 };
  };
  const result = await runLearningCycle({
    empresaId, dia: '2026-10-04', query, router,
    settings: { ativo: true, autonomia: 1, tetoDiarioCentavos: 2000 },
    consentMap: async () => new Map(),
  });
  return { result, persisted, writes };
}

test('falha de extração persiste fallback e erro sem copiar a mensagem de erro', async () => {
  const { result, persisted, writes } = await cycle(async () => { throw new Error('conteúdo que não deve ser registrado'); });
  assert.equal(result.resumosIa, 0);
  assert.equal(result.resumosSemIa, 1);
  assert.equal(result.erros, 1);
  assert.deepEqual(persisted, Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'skipped')));
  assert.doesNotMatch(JSON.stringify(persisted), /conteúdo que não deve/);
  assert.equal(writes.some((sql) => sql.includes('INSERT INTO ai_customer_facts')), false);
});

test('extração válida sem consentimento resume mas não grava memória individual', async () => {
  const { result, writes } = await cycle(async () => ({
    provider: 'gemini', model: 'teste', data: { resumo: 'Cliente iniciou contato.', fatos: [{ categoria: 'preferencia', valor: 'corte' }] },
  }));
  assert.equal(result.resumosIa, 1);
  assert.equal(result.resumosSemIa, 0);
  assert.equal(result.erros, 0);
  assert.equal(writes.some((sql) => sql.includes('INSERT INTO ai_customer_facts')), false);
});

test('dia sem conversas não chama IA nem registra falha', async () => {
  const { result } = await cycle(async () => { assert.fail('não deve chamar IA'); }, false);
  assert.equal(result.conversas, 0);
  assert.equal(result.erros, 0);
});
