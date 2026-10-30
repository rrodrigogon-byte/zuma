import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standaloneGreetingReply } from './whatsapp-ai-greeting.mjs';

// Exercise the real orchestration function without importing production services.
const source = readFileSync(new URL('./whatsapp-ai.js', import.meta.url), 'utf8');
const start = source.indexOf('async function deterministicResponseCore(');
const end = source.indexOf('\n}\n', start) + 2;
assert.ok(start >= 0 && end > start);
// Dependências da função ficam isoladas num escopo: as conhecidas recebem dublês e qualquer
// outra devolve um dublê neutro, para o teste não quebrar a cada helper novo do orquestrador.
const stubs = {
  standaloneGreetingReply,
  optOutIntent: () => false,
  resolvePersona: () => null,
  cleanText: (value) => String(value || ''),
  whatsappChannelType: (value) => String(value || 'cliente'),
  AUTO_RESUME_HANDOFF_REASONS: [],
};
const scope = new Proxy(stubs, {
  has: (target, key) => typeof key === 'string' && !(key in globalThis),
  get: (target, key) => (key in target ? target[key] : (key in globalThis ? globalThis[key] : () => false)),
});
const respond = new Function('scope', `with (scope) { return (${source.slice(start, end)}) }`)(scope);

test('ola atravessa o fluxo real sem consultar histórico, modelo ou ferramentas', async () => {
  const result = await respond({}, { configuracao: {} }, { status: 'ativo' }, { text: 'ola' });
  assert.equal(result.kind, 'greeting');
  assert.match(result.text, /Como posso ajudar/);
});

test('fila humana mantém prioridade sobre a saudação', async () => {
  const result = await respond({}, { configuracao: {} }, { status: 'humano' }, { text: 'ola' });
  assert.deepEqual(result, { text: null, kind: 'human_queue' });
});

