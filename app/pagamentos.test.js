import test from 'node:test';
import assert from 'node:assert/strict';

function restoreEnv(previous) {
  for (const key of ['PIX_CHAVE', 'MP_ACCESS_TOKEN', 'PIX_NOME', 'PIX_CIDADE']) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

function captureEnv() {
  return Object.fromEntries(['PIX_CHAVE', 'MP_ACCESS_TOKEN', 'PIX_NOME', 'PIX_CIDADE'].map(key => [key, process.env[key]]));
}

test('recusa cobrança quando nenhum provedor real está configurado', async () => {
  const previous = captureEnv();
  delete process.env.PIX_CHAVE;
  delete process.env.MP_ACCESS_TOKEN;
  try {
    const payments = await import(`./pagamentos.js?disabled=${Date.now()}`);
    assert.equal(payments.pagamentosAtivos, false);
    await assert.rejects(
      () => payments.criarPix({ valor: 10, descricao: 'teste' }),
      error => error?.code === 'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  } finally {
    restoreEnv(previous);
  }
});

test('Pix estático retorna cobrança real pendente e nunca modo simulado', async () => {
  const previous = captureEnv();
  process.env.PIX_CHAVE = '43084070000188';
  delete process.env.MP_ACCESS_TOKEN;
  try {
    const payments = await import(`./pagamentos.js?static=${Date.now()}`);
    const result = await payments.criarPix({ valor: 25.5, descricao: 'teste' });
    assert.equal(payments.pagamentosAtivos, true);
    assert.equal(result.provedor, 'pix-estatico');
    assert.equal(result.status, 'pendente');
    assert.match(result.copiaECola, /^000201/);
    assert.notEqual(result.provedor, 'simulado');
  } finally {
    restoreEnv(previous);
  }
});

test('Mercado Pago é chamado com token e retorno normalizado', async () => {
  const previous = captureEnv();
  const fetchPrevious = globalThis.fetch;
  process.env.MP_ACCESS_TOKEN = 'test-token-only';
  delete process.env.PIX_CHAVE;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return {
          id: 12345,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-test', qr_code_base64: 'base64-test' } },
        };
      },
    };
  };
  try {
    const payments = await import(`./pagamentos.js?mercadopago=${Date.now()}`);
    const result = await payments.criarPix({ valor: 12.34, email: 'cliente@example.com' });
    assert.equal(result.provedor, 'mercadopago');
    assert.equal(result.status, 'pendente');
    assert.equal(result.externalId, '12345');
    assert.equal(request.url, 'https://api.mercadopago.com/v1/payments');
    assert.equal(request.options.headers.Authorization, 'Bearer test-token-only');
  } finally {
    globalThis.fetch = fetchPrevious;
    restoreEnv(previous);
  }
});
