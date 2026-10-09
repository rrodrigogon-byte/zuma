import assert from 'node:assert/strict';
import test from 'node:test';
import { mail } from './email.js';

async function isolated(config, callback) {
  const names = ['RESEND_API_KEY', 'OPERATIONAL_INVITE_RESEND_API_KEY', 'EMAIL_FROM', 'OPERATIONAL_INVITE_EMAIL_FROM'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  try {
    for (const name of names) { if (config[name] === undefined) delete process.env[name]; else process.env[name] = config[name]; }
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
}
const config = { RESEND_API_KEY: 'synthetic-local-only', EMAIL_FROM: 'Legacy <legacy@example.invalid>', OPERATIONAL_INVITE_EMAIL_FROM: 'Kytto <contact@example.invalid>' };
const payload = { to: 'operator@example.invalid', nome: '<Pessoa>', empresaNome: 'Empresa <B>\nSintética', url: 'https://kytto.example.invalid/aceitar-convite#token=SYNTHETIC_TOKEN', inviteId: '11111111-1111-4111-8111-111111111111' };

test('chave dedicada envia com Authorization própria sem ativar o canal geral', async () => {
  await isolated({ OPERATIONAL_INVITE_RESEND_API_KEY: 'synthetic-dedicated-only', OPERATIONAL_INVITE_EMAIL_FROM: config.OPERATIONAL_INVITE_EMAIL_FROM }, async () => {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-dedicated-only');
      return { ok: true, json: async () => ({ id: 'dedicated-provider-id' }) };
    };
    assert.equal(mail.ativo(), false);
    assert.deepEqual(await mail.enviar({ to: payload.to, subject: 'legacy', html: '<p>legacy</p>' }), { ok: true, simulado: true });
    assert.equal(mail.conviteOperacionalAtivo(), true);
    assert.deepEqual(await mail.conviteOperacional(payload), { ok: true });
    assert.equal(calls, 1);
  });
});

test('chave dedicada tem precedência sobre RESEND_API_KEY no convite', async () => {
  await isolated({ ...config, OPERATIONAL_INVITE_RESEND_API_KEY: 'synthetic-dedicated-preferred' }, async () => {
    globalThis.fetch = async (_, options) => {
      assert.equal(options.headers.Authorization, 'Bearer synthetic-dedicated-preferred');
      return { ok: true, json: async () => ({ id: 'preferred-provider-id' }) };
    };
    assert.deepEqual(await mail.conviteOperacional(payload), { ok: true });
  });
});

test('convites sem chave ou remetente não simulam envio nem chamam o provedor', async () => {
  for (const env of [{}, { RESEND_API_KEY: config.RESEND_API_KEY }]) await isolated(env, async () => {
    globalThis.fetch = () => { throw new Error('egress must not occur'); };
    assert.equal(mail.conviteOperacionalAtivo(), false);
    assert.deepEqual(await mail.conviteOperacional(payload), { ok: false, code: 'MAIL_NOT_CONFIGURED' });
  });
});
test('remetente dedicado, empresa escapada e idempotência sem token nos headers', async () => {
  await isolated(config, async () => {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.resend.com/emails');
      const body = JSON.parse(options.body);
      assert.equal(body.from, config.OPERATIONAL_INVITE_EMAIL_FROM);
      assert.match(body.html, /Empresa &lt;B&gt; Sintética/);
      assert.match(body.html, /&lt;Pessoa&gt;/);
      assert.doesNotMatch(body.html, /administrar as operações somente da Dino/);
      assert.doesNotMatch(body.subject, /[\r\n]/);
      assert.equal(options.headers['Idempotency-Key'], payload.inviteId);
      assert.doesNotMatch(JSON.stringify(options.headers), /SYNTHETIC_TOKEN|operator@example/);
      assert.equal(options.signal instanceof AbortSignal, true);
      return { ok: true, json: async () => ({ id: 'provider-accepted-synthetic' }) };
    };
    assert.equal(mail.conviteOperacionalAtivo(), true);
    assert.deepEqual(await mail.conviteOperacional(payload), { ok: true });
    assert.equal(calls, 1);
  });
});
test('fallback explícito do remetente não altera o canal legado', async () => {
  await isolated({ RESEND_API_KEY: config.RESEND_API_KEY, EMAIL_FROM: config.EMAIL_FROM }, async () => {
    globalThis.fetch = async (_, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${config.RESEND_API_KEY}`);
      assert.equal(JSON.parse(options.body).from, config.EMAIL_FROM);
      return { ok: true, json: async () => ({ id: 'synthetic' }) };
    };
    assert.equal(mail.conviteOperacionalFrom(), config.EMAIL_FROM);
    assert.deepEqual(await mail.conviteOperacional(payload), { ok: true });
  });
});
test('remetente forjado é bloqueado antes do envio', async () => {
  await isolated(config, async () => {
    globalThis.fetch = () => { throw new Error('egress must not occur'); };
    assert.deepEqual(await mail.conviteOperacional({ ...payload, from: 'Other <other@example.invalid>' }), { ok: false, code: 'MAIL_NOT_CONFIGURED' });
  });
});
test('recusa, resposta ambígua e erro bruto retornam somente códigos seguros', async () => {
  await isolated(config, async () => {
    for (const [fetchMock, code] of [
      [async () => ({ ok: false }), 'MAIL_REJECTED'],
      [async () => ({ ok: true, json: async () => ({}) }), 'MAIL_UNCERTAIN'],
      [async () => { throw new Error('sensitive raw provider error'); }, 'MAIL_UNCERTAIN'],
    ]) {
      globalThis.fetch = fetchMock;
      const result = await mail.conviteOperacional(payload);
      assert.deepEqual(result, { ok: false, code });
      assert.doesNotMatch(JSON.stringify(result), /sensitive|TOKEN|example.invalid/);
    }
  });
});
