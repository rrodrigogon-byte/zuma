import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anthropicToolsFromDeclarations, estimateCostCents, geminiThinking, parseJsonLoose, routeFor, routerStatus,
  runAiTask, runAnthropicWithTools, providerConfigured, modelFor, anthropicVertexUrl,
} from './ai-router.js';

const KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AI_ROUTE_RESUMIR_EXTRAIR', 'ANTHROPIC_VERTEX_PROJECT_ID', 'ANTHROPIC_VERTEX_REGION', 'AI_MODEL_ANTHROPIC_SMART'];
async function withEnv(values, fn) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
  try { return await fn(); } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}
function response(status, body) { return { ok: status < 400, status, text: async () => JSON.stringify(body) }; }
const noRecord = async () => {};

test('rota padrão e override por ambiente', async () => {
  await withEnv({}, () => {
    assert.deepEqual(routeFor('resumir_extrair').map((s) => s.provider), ['anthropic', 'openai', 'gemini']);
  });
  await withEnv({ AI_ROUTE_RESUMIR_EXTRAIR: 'gemini:smart, openai:fast, inexistente:fast' }, () => {
    assert.deepEqual(routeFor('resumir_extrair'), [{ provider: 'gemini', tier: 'smart' }, { provider: 'openai', tier: 'fast' }]);
  });
});

test('usa o próximo provedor quando o principal falha e registra a reserva', async () => {
  await withEnv({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' }, async () => {
    const calls = [];
    const runs = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url.includes('anthropic')) return response(503, { error: 'down' });
      return response(200, { choices: [{ message: { content: '{"resumo":"ok"}' } }] });
    };
    const out = await runAiTask('resumir_extrair', { user: 'x', json: true, fetchImpl, recorder: async (r) => runs.push(r) });
    assert.equal(out.provider, 'openai');
    assert.equal(out.fallback, true);
    assert.deepEqual(out.data, { resumo: 'ok' });
    assert.equal(calls.length, 2);
    assert.deepEqual(runs.map((r) => [r.provider, r.status]), [['anthropic', 'failed'], ['openai', 'success']]);
    assert.ok(runs[1].costCents >= 0);
  });
});

test('sem nenhuma chave, erro claro e nenhuma chamada de rede', async () => {
  await withEnv({}, async () => {
    let called = false;
    await assert.rejects(runAiTask('avaliar', { user: 'x', fetchImpl: async () => { called = true; }, recorder: noRecord }), (e) => e.code === 'NO_PROVIDER_CONFIGURED');
    assert.equal(called, false);
  });
});

test('teto diário bloqueia antes de chamar a IA', async () => {
  await withEnv({ GEMINI_API_KEY: 'g' }, async () => {
    let called = false;
    await assert.rejects(runAiTask('classificar', { user: 'x', capCents: 100, spentToday: async () => 150, fetchImpl: async () => { called = true; }, recorder: noRecord }), (e) => e.code === 'BUDGET_EXCEEDED');
    assert.equal(called, false);
  });
});

test('exclude evita que a juíza seja a mesma IA que atendeu', async () => {
  await withEnv({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, async () => {
    const out = await runAiTask('avaliar', {
      user: 'x', exclude: ['gemini'], recorder: noRecord,
      fetchImpl: async (url) => { assert.ok(!url.includes('generativelanguage')); return response(200, { content: [{ type: 'text', text: 'nota 5' }] }); },
    });
    assert.equal(out.provider, 'anthropic');
  });
});

test('JSON solto dentro de cercas é aproveitado', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Segue: {"a":2} fim'), { a: 2 });
  assert.equal(parseJsonLoose('nada'), null);
});

test('custo estimado cresce com o texto', () => {
  assert.ok(estimateCostCents('anthropic', 'smart', 10000, 2000) > estimateCostCents('anthropic', 'smart', 1000, 200));
});

test('status nunca expõe chaves', async () => {
  await withEnv({ ANTHROPIC_API_KEY: 'segredo-123' }, () => {
    const status = routerStatus();
    assert.equal(JSON.stringify(status).includes('segredo-123'), false);
    assert.equal(status.providers.find((p) => p.id === 'anthropic').configured, true);
  });
});

test('ferramentas do Gemini viram ferramentas do Claude com tipos em minúsculas', () => {
  const [tool] = anthropicToolsFromDeclarations([{ name: 'x', description: 'd', parameters: { type: 'OBJECT', properties: { a: { type: 'STRING' } }, required: ['a'] } }]);
  assert.deepEqual(tool.input_schema, { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] });
});

test('Claude executa ferramenta e responde (reserva do atendimento)', async () => {
  await withEnv({ ANTHROPIC_API_KEY: 'a' }, async () => {
    let step = 0;
    const executed = [];
    const out = await runAnthropicWithTools({
      systemInstruction: 's', history: [{ role: 'user', text: 'oi' }, { role: 'assistant', text: 'olá' }], userText: 'tem horário?',
      tools: [{ name: 'listar_servicos', description: 'd', parameters: { type: 'OBJECT', properties: {} } }],
      executeTool: async (name) => { executed.push(name); return { ok: true, items: [] }; },
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        step += 1;
        if (step === 1) { assert.equal(body.messages[0].role, 'user'); return response(200, { content: [{ type: 'tool_use', id: 't1', name: 'listar_servicos', input: {} }] }); }
        assert.equal(body.messages.at(-1).content[0].type, 'tool_result');
        return response(200, { content: [{ type: 'text', text: 'Temos corte às 10h.' }] });
      },
    });
    assert.deepEqual(executed, ['listar_servicos']);
    assert.equal(out.text, 'Temos corte às 10h.');
    assert.equal(out.traces[0].ok, true);
  });
});

test('Gemini 2.5 Pro reserva orçamento de raciocínio e Flash desliga o raciocínio', async () => {
  assert.deepEqual(geminiThinking('gemini-2.5-pro'), { config: { thinkingBudget: 256 }, extraTokens: 256 });
  assert.deepEqual(geminiThinking('gemini-2.5-flash'), { config: { thinkingBudget: 0 }, extraTokens: 0 });
  assert.deepEqual(geminiThinking('outro-modelo'), { config: null, extraTokens: 0 });
  await withEnv({ GEMINI_API_KEY: 'g', AI_ROUTE_RESUMIR_EXTRAIR: 'gemini:smart' }, async () => {
    let body = null;
    const out = await runAiTask('resumir_extrair', {
      user: 'conversa', json: true, maxTokens: 900, recorder: noRecord,
      fetchImpl: async (url, init) => { body = JSON.parse(init.body); return response(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'pensando', thought: true }, { text: '{"resumo":"ok"}' }] } }] }); },
    });
    assert.equal(body.generationConfig.maxOutputTokens, 1156);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingBudget: 256 });
    assert.deepEqual(out.data, { resumo: 'ok' });
  });
});

test('Gemini cortado por limite de saída em JSON registra GEMINI_MAX_TOKENS', async () => {
  await withEnv({ GEMINI_API_KEY: 'g', AI_ROUTE_RESUMIR_EXTRAIR: 'gemini:smart' }, async () => {
    const runs = [];
    await assert.rejects(runAiTask('resumir_extrair', {
      user: 'conversa', json: true, recorder: async (r) => { runs.push(r); },
      fetchImpl: async () => response(200, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"resumo":"cort' }] } }] }),
    }));
    assert.equal(runs[0].errorCode, 'GEMINI_MAX_TOKENS');
  });
});

test('Claude pelo Vertex AI: configura sem chave da Anthropic e chama rawPredict com token do GCP', async () => {
  await withEnv({ ANTHROPIC_VERTEX_PROJECT_ID: 'projeto-dino' }, async () => {
    assert.equal(providerConfigured('anthropic'), true);
    assert.equal(modelFor('anthropic', 'smart'), 'claude-sonnet-4-5@20250929');
    assert.equal(anthropicVertexUrl('claude-sonnet-4-5@20250929'), 'https://aiplatform.googleapis.com/v1/projects/projeto-dino/locations/global/publishers/anthropic/models/claude-sonnet-4-5%4020250929:rawPredict');
    let seen = null;
    const out = await runAnthropicWithTools({
      systemInstruction: 'sys', userText: 'oi', tools: [], executeTool: async () => ({}), accessToken: async () => 'tok-123',
      fetchImpl: async (url, init) => { seen = { url, headers: init.headers, body: JSON.parse(init.body) }; return response(200, { content: [{ type: 'text', text: 'Olá!' }] }); },
    });
    assert.equal(out.text, 'Olá!');
    assert.match(seen.url, /aiplatform\.googleapis\.com\/v1\/projects\/projeto-dino\/locations\/global\/publishers\/anthropic/);
    assert.equal(seen.headers.authorization, 'Bearer tok-123');
    assert.equal(seen.body.anthropic_version, 'vertex-2023-10-16');
    assert.equal(seen.body.model, undefined, 'no Vertex o modelo vai na URL');
  });
  await withEnv({ ANTHROPIC_VERTEX_PROJECT_ID: 'p', ANTHROPIC_VERTEX_REGION: 'us-east5', AI_MODEL_ANTHROPIC_SMART: 'claude-x@1' }, async () => {
    assert.equal(modelFor('anthropic', 'smart'), 'claude-x@1');
    assert.match(anthropicVertexUrl('claude-x@1'), /^https:\/\/us-east5-aiplatform\.googleapis\.com\/v1\/projects\/p\/locations\/us-east5\//);
  });
});
