import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('./052_ai_brain_memory_learning.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./run-commerce-schema-migrations.js', import.meta.url), 'utf8');

test('migration 052 só cria estruturas novas do cérebro e amplia a fila', () => {
  for (const table of ['ai_brain_settings', 'ai_router_runs', 'ai_conversation_summaries', 'ai_customer_facts', 'ai_learning_proposals', 'ai_judge_reviews', 'ai_learning_runs', 'ai_automation_log']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`), table);
  }
  assert.match(migration, /ativo BOOLEAN NOT NULL DEFAULT false/, 'cérebro nasce desligado');
  assert.match(migration, /'automacao_ia'/);
  for (const old of ['processar_conversa', 'enviar_campanha', 'recuperar_carrinho', 'notificar_agendamento']) assert.match(migration, new RegExp(`'${old}'`), `mantém ${old}`);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM|UPDATE /i);
  assert.match(runner, /'052_ai_brain_memory_learning\.sql'/);
});
