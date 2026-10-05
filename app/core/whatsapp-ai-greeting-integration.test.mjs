import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standaloneGreetingReply } from './whatsapp-ai-greeting.mjs';

// Exercise the real orchestration function without importing production services.
const source = readFileSync(new URL('./whatsapp-ai.js', import.meta.url), 'utf8');
const start = source.indexOf('async function deterministicResponseCore(');
const end = source.indexOf('\n}\n', start) + 2;
assert.ok(start >= 0 && end > start);
const respond = new Function('standaloneGreetingReply', 'optOutIntent', 'resolvePersona', 'cleanText',
  `return (${source.slice(start, end)})`)(standaloneGreetingReply, () => false, () => null, (value) => String(value || ''));

test('ola atravessa o fluxo real sem consultar histórico, modelo ou ferramentas', async () => {
  const result = await respond({}, { configuracao: {} }, { status: 'ativo' }, { text: 'ola' });
  assert.equal(result.kind, 'greeting');
  assert.match(result.text, /Como posso ajudar/);
});

test('fila humana mantém prioridade sobre a saudação', async () => {
  const result = await respond({}, { configuracao: {} }, { status: 'humano' }, { text: 'ola' });
  assert.deepEqual(result, { text: null, kind: 'human_queue' });
});

