import test from 'node:test';
import assert from 'node:assert/strict';
process.env.PHONE_VERIFICATION_SECRET = 'segredo-de-teste-verificacao';
const { startPhoneVerification, confirmPhoneVerification, verifyPhoneToken } = await import('./phone-verification.js');

const E = '7d1b3a2e-5c4f-4a6b-9d8e-1f2a3b4c5d6e';
function memoryDb() {
  const rows = [];
  return {
    rows,
    query: async (sql, v) => {
      if (/^\s*SELECT criado_em/.test(sql)) return { rows: rows.filter(r => r.empresa_id === v[0] && r.telefone_chave === v[1]).map(r => ({ criado_em: r.criado_em })).reverse() };
      if (/^\s*INSERT/.test(sql)) { rows.push({ id: String(rows.length + 1), empresa_id: v[0], telefone_chave: v[1], codigo_hash: v[2], tentativas: 0, expira_em: new Date(new Date(v[3]).getTime() + Number(v[4]) * 1000).toISOString(), verificado_em: null, criado_em: v[3] }); return { rows: [] }; }
      if (/^\s*SELECT id, codigo_hash/.test(sql)) return { rows: rows.filter(r => r.empresa_id === v[0] && r.telefone_chave === v[1]).slice(-1) };
      if (/tentativas = tentativas \+ 1/.test(sql)) { const r = rows.find(x => x.id === v[0]); if (!r || r.tentativas >= v[1] || r.verificado_em) return { rows: [] }; r.tentativas += 1; return { rows: [{ codigo_hash: r.codigo_hash, tentativas: r.tentativas }] }; }
      if (/SET verificado_em/.test(sql)) { const r = rows.find(x => x.id === v[0]); if (!r || r.verificado_em) return { rows: [] }; r.verificado_em = v[1]; return { rows: [{ id: r.id }] }; }
      return { rows: [] };
    },
  };
}

test('código vai pelo WhatsApp, confere e devolve comprovante que vale para o número em qualquer formato', async () => {
  const database = memoryDb(); let sentText = '';
  const now = new Date('2026-09-28T15:00:00Z');
  const started = await startPhoneVerification({ empresaId: E, phone: '(65) 99999-0001', database, now, send: async (_n, text) => { sentText = text; return { ok: true }; } });
  assert.equal(started.sent, true);
  const code = sentText.match(/\d{6}/)[0];
  assert.ok(!JSON.stringify(database.rows).includes(code), 'código não é guardado em texto');
  await assert.rejects(() => confirmPhoneVerification({ empresaId: E, phone: '65999990001', code: '000000' === code ? '111111' : '000000', database, now }), e => e.code === 'PHONE_VERIFICATION_INVALID');
  const ok = await confirmPhoneVerification({ empresaId: E, phone: '556599990001', code, database, now });
  assert.equal(verifyPhoneToken(ok.token, E, '+55 65 99999-0001', now), true);
  assert.equal(verifyPhoneToken(ok.token, E, '65999990002', now), false, 'outro número');
  assert.equal(verifyPhoneToken(ok.token, E, '6539990001', now), false, 'fixo com os mesmos 8 finais não vale');
  assert.equal(verifyPhoneToken(ok.token, 'b2222222-2222-4222-8222-222222222222', '65999990001', now), false, 'outra empresa');
  assert.equal(verifyPhoneToken(ok.token, E, '65999990001', new Date(now.getTime() + 31 * 60000)), false, 'vence em 30 min');
  assert.equal(verifyPhoneToken(ok.token.replace(/.$/, 'x'), E, '65999990001', now), false, 'assinatura adulterada');
  await assert.rejects(() => confirmPhoneVerification({ empresaId: E, phone: '65999990001', code, database, now }), e => e.code === 'PHONE_VERIFICATION_EXPIRED', 'código não é reutilizado');
});

test('limites: 1 código por minuto, 3 por hora e 5 tentativas', async () => {
  const database = memoryDb(); let code = '';
  const send = async (_n, text) => { code = text.match(/\d{6}/)[0]; return { ok: true }; };
  const t0 = new Date('2026-09-28T15:00:00Z');
  await startPhoneVerification({ empresaId: E, phone: '65999990001', database, now: t0, send });
  await assert.rejects(() => startPhoneVerification({ empresaId: E, phone: '65999990001', database, now: new Date(t0.getTime() + 30000), send }), e => e.code === 'PHONE_VERIFICATION_RATE_LIMIT');
  await startPhoneVerification({ empresaId: E, phone: '65999990001', database, now: new Date(t0.getTime() + 120000), send });
  await startPhoneVerification({ empresaId: E, phone: '65999990001', database, now: new Date(t0.getTime() + 240000), send });
  await assert.rejects(() => startPhoneVerification({ empresaId: E, phone: '65999990001', database, now: new Date(t0.getTime() + 360000), send }), e => e.code === 'PHONE_VERIFICATION_RATE_LIMIT');
  const wrong = code === '123456' ? '654321' : '123456';
  const t1 = new Date(t0.getTime() + 250000);
  for (let i = 0; i < 5; i += 1) await assert.rejects(() => confirmPhoneVerification({ empresaId: E, phone: '65999990001', code: wrong, database, now: t1 }));
  await assert.rejects(() => confirmPhoneVerification({ empresaId: E, phone: '65999990001', code, database, now: t1 }), e => e.code === 'PHONE_VERIFICATION_LOCKED');
});

test('tentativas em paralelo não passam de 5 por código', async () => {
  const database = memoryDb(); let code = '';
  const now = new Date('2026-09-28T16:00:00Z');
  await startPhoneVerification({ empresaId: E, phone: '65999990003', database, now, send: async (_n, text) => { code = text.match(/\d{6}/)[0]; return { ok: true }; } });
  const wrong = code === '123456' ? '654321' : '123456';
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => confirmPhoneVerification({ empresaId: E, phone: '65999990003', code: wrong, database, now })));
  assert.equal(results.filter(r => r.reason?.code === 'PHONE_VERIFICATION_INVALID').length, 5, 'só 5 comparações');
  assert.equal(database.rows[0].tentativas, 5);
});
