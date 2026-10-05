import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiError, normalizedGeminiHistory, runGeminiWithTools, unfinishedToolReply } from './gemini-client.js';

function response(payload, ok = true, status = 200) {
  return { ok, status, async text() { return JSON.stringify(payload); } };
}

test('detecta promessas de consulta do incidente sem bloquear perguntas ou resultados', () => {
  for (const text of ['Antes de fecharmos o pedido, vou verificar se temos Madagascar. Só um momento, por favor.', 'Obrigado! Estou verificando a disponibilidade para você.']) assert.equal(unfinishedToolReply(text), true);
  for (const text of ['Qual tamanho você procura?', 'Consultei o catálogo e não encontrei o produto.', 'Você quer que eu vá verificar?', 'Encontrei o produto por R$ 369,00.']) assert.equal(unfinishedToolReply(text), false);
});

test('consulta prometida é executada antes de devolver resposta; não envia o texto de espera', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let requests = 0; let executions = 0;
  const tools = [{ name: 'buscar_produtos', parameters: { type: 'OBJECT', properties: {} } }];
  try {
    const result = await runGeminiWithTools({ requireCompletedReply: true, tools, userText: 'Tem Madagascar?',
      executeTool: async () => { executions++; return { total: 0, produtos: [] }; },
      fetchImpl: async () => {
        requests++;
        const parts = requests === 1 ? [{ text: 'Estou verificando a disponibilidade.' }]
          : requests === 2 ? [{ functionCall: { name: 'buscar_produtos', args: { query: 'Madagascar' } } }]
            : [{ text: 'Não encontrei Madagascar no catálogo. Qual a marca?' }];
        return response({ candidates: [{ content: { parts } }] });
      },
    });
    assert.equal(requests, 3); assert.equal(executions, 1);
    assert.equal(result.text, 'Não encontrei Madagascar no catálogo. Qual a marca?');
    assert.deepEqual(result.traces, [{ name: 'buscar_produtos', ok: true }]);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test('promessa repetida tem uma única correção e falha identificável, sem loop ou execução duplicada', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let requests = 0;
  try {
    await assert.rejects(() => runGeminiWithTools({ requireCompletedReply: true,
      tools: [{ name: 'buscar_produtos' }], executeTool: async () => assert.fail('não houve function call'),
      fetchImpl: async () => { requests++; return response({ candidates: [{ content: { parts: [{ text: 'Vou consultar o catálogo.' }] } }] }); },
    }), error => error.code === 'GEMINI_INCOMPLETE_RESPONSE' && error.retryable === false);
    assert.equal(requests, 2);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test('correção de consulta não ultrapassa o limite de passos nem contorna bloqueio de segurança', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let requests = 0;
  try {
    await assert.rejects(() => runGeminiWithTools({ requireCompletedReply: true, maxSteps: 1,
      tools: [{ name: 'buscar_produtos' }], executeTool: async () => ({}),
      fetchImpl: async () => { requests++; return response({ candidates: [{ content: { parts: [{ text: 'Estou verificando.' }] } }] }); },
    }), error => error.code === 'GEMINI_INCOMPLETE_RESPONSE');
    assert.equal(requests, 1);
    await assert.rejects(() => runGeminiWithTools({ requireCompletedReply: true,
      tools: [{ name: 'buscar_produtos' }], executeTool: async () => assert.fail('segurança bloqueou'),
      fetchImpl: async () => response({ promptFeedback: { blockReason: 'SAFETY' } }),
    }), error => error.code === 'GEMINI_BLOCKED');
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

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
    assert.equal(result.metrics.inputChars > 0, true);
    assert.equal(result.metrics.outputChars, 'Olá! Como posso ajudar?'.length);
    assert.equal(result.metrics.toolCalls, 0);
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
    assert.equal(result.metrics.toolCalls, 1);
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

test('normalizedGeminiHistory aplica orçamento global e preserva as mensagens mais recentes', () => {
  const history = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', text: `${index}`.repeat(1000) }));
  const normalized = normalizedGeminiHistory(history, 4000);
  const total = normalized.reduce((sum, item) => sum + item.parts[0].text.length, 0);
  assert.equal(total <= 4000, true);
  assert.equal(normalized.at(-1).parts[0].text.startsWith('9'), true);
  assert.equal(normalized.length, 4);
});

test('runGeminiWithTools repete uma vez após 429 e retorna sucesso sem expor a resposta de erro', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let calls = 0;
  try {
    const result = await runGeminiWithTools({
      userText: 'Olá',
      executeTool: async () => ({}),
      requestAttempts: 2,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return response({ error: { message: 'temporário' } }, false, 429);
        return response({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] });
      },
    });
    assert.equal(result.text, 'OK');
    assert.equal(calls, 2);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test('runGeminiWithTools não repete erro de autenticação e classifica como não transitório', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let calls = 0;
  try {
    await assert.rejects(
      () => runGeminiWithTools({
        userText: 'Olá',
        executeTool: async () => ({}),
        requestAttempts: 3,
        fetchImpl: async () => { calls += 1; return response({ error: { message: 'negado' } }, false, 403); },
      }),
      error => error instanceof GeminiError && error.code === 'GEMINI_AUTH_ERROR' && error.retryable === false,
    );
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test('runGeminiWithTools bloqueia resposta marcada por política sem executar ferramenta', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let executions = 0;
  try {
    await assert.rejects(
      () => runGeminiWithTools({
        userText: 'Olá',
        executeTool: async () => { executions += 1; },
        fetchImpl: async () => response({ promptFeedback: { blockReason: 'SAFETY' } }),
      }),
      error => error instanceof GeminiError && error.code === 'GEMINI_BLOCKED' && error.retryable === false,
    );
    assert.equal(executions, 0);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
