import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiError, runGeminiWithTools } from './gemini-client.js';

function response(payload, ok = true, status = 200) {
  return { ok, status, async text() { return JSON.stringify(payload); } };
}

test('runGeminiWithTools retorna texto sem executar ferramenta quando não há function call', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let executions = 0;
  try {
    const result = await runGeminiWithTools({
      systemInstruction: 'Teste',
      userText: 'Olá',
      executeTool: async () => { executions += 1; },
      fetchImpl: async () => response({ candidates: [{ content: { parts: [{ text: 'Olá! Como posso ajudar?' }] } }] }),
    });
    assert.equal(result.text, 'Olá! Como posso ajudar?');
    assert.equal(executions, 0);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test('runGeminiWithTools executa somente a ferramenta fornecida pela aplicação e devolve resultado ao modelo', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  const requests = [];
  let calls = 0;
  try {
    const result = await runGeminiWithTools({
      systemInstruction: 'Teste',
      userText: 'Tem perfume?',
      tools: [{ name: 'buscar_produtos', parameters: { type: 'OBJECT', properties: {} } }],
      executeTool: async (name, args) => {
        assert.equal(name, 'buscar_produtos');
        assert.deepEqual(args, { query: 'perfume' });
        calls += 1;
        return { ok: true, produtos: [{ nome: 'Teste' }] };
      },
      fetchImpl: async (_url, options) => {
        requests.push(JSON.parse(options.body));
        if (requests.length === 1) return response({ candidates: [{ content: { parts: [{ functionCall: { name: 'buscar_produtos', args: { query: 'perfume' } } }] } }] });
        return response({ candidates: [{ content: { parts: [{ text: 'Encontrei o produto Teste.' }] } }] });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.text, 'Encontrei o produto Teste.');
    assert.deepEqual(result.traces, [{ name: 'buscar_produtos', ok: true }]);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].contents.at(-1).parts[0].functionResponse.name, 'buscar_produtos');
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test('runGeminiWithTools falha de modo seguro sem credencial', async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      () => runGeminiWithTools({ userText: 'oi', executeTool: async () => ({}) }),
      error => error instanceof GeminiError && error.code === 'GEMINI_NOT_CONFIGURED',
    );
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});
