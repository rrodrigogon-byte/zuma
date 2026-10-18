import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.CLUBE_PARCEIROS_SECRET ||= 'segredo-de-teste-dos-parceiros-0123456789abcdef';
const { wellhub, totalpass, cifrar, decifrar, hmacDocumento, hostTotalpassPermitido } = await import('../modules/parceiros/adaptadores.js');

test('cifra AES-GCM: ida e volta; adulteração é detectada; sem segredo, erro claro', () => {
  const c = cifrar('place-api-key');
  assert.notEqual(c, 'place-api-key');
  assert.equal(decifrar(c), 'place-api-key');
  const partes = c.split('.');
  partes[3] = Buffer.from('xxxxxxxx').toString('base64url');
  assert.throws(() => decifrar(partes.join('.')));
  const antes = process.env.CLUBE_PARCEIROS_SECRET;
  process.env.CLUBE_PARCEIROS_SECRET = 'curto';
  try { assert.throws(() => cifrar('x'), { code: 'PARCEIROS_SEGREDO_AUSENTE' }); } finally { process.env.CLUBE_PARCEIROS_SECRET = antes; }
});

test('CPF vira HMAC estável, independente da máscara', () => {
  assert.equal(hmacDocumento('123.456.789-09'), hmacDocumento('12345678909'));
  assert.equal(hmacDocumento('123'), null);
  assert.ok(!hmacDocumento('12345678909').includes('12345678909'));
});

test('Wellhub: assinatura HMAC do corpo cru (com ou sem prefixo), comparação em tempo constante', () => {
  const corpo = Buffer.from('{"event_type":"checkin"}');
  const sig = createHmac('sha1', 's3gredo').update(corpo).digest('hex');
  assert.equal(wellhub.assinaturaValida(corpo, { 'x-gympass-signature': sig }, 's3gredo'), true);
  assert.equal(wellhub.assinaturaValida(corpo, { 'x-gympass-signature': `sha1=${sig.toUpperCase()}` }, 's3gredo'), true);
  assert.equal(wellhub.assinaturaValida(corpo, { 'x-gympass-signature': sig }, 'outro'), false);
  assert.equal(wellhub.assinaturaValida(corpo, {}, 's3gredo'), false);
  assert.equal(wellhub.assinaturaValida(corpo, { 'x-gympass-signature': sig }, ''), false, 'sem segredo configurado nunca aceita');
});

test('Wellhub: lê envelope e variações; ignora outros eventos; rejeita sem pessoa', () => {
  const e = wellhub.lerCheckin({ event_type: 'checkin', event_data: { user: { unique_token: '123', first_name: 'Ana', phone_number: '+55 (65) 99999-0000' }, gym: { id: 77, product: { id: 3 } }, timestamp: 1790000000 } });
  assert.equal(e.contaExterna, '77');
  assert.equal(e.idExterno, '123:1790000000');
  assert.equal(e.telefone, '5565999990000');
  assert.equal(e.produto, '3');
  assert.equal(wellhub.lerCheckin({ event_type: 'booking-requested' }).ignorar, true);
  assert.equal(wellhub.lerCheckin({ event_type: 'checkin', event_data: { gym: { id: 1 } } }).invalido, true);
});

test('TotalPass: aceita só URL de validação HTTPS da TotalPass (anti-SSRF)', () => {
  assert.equal(hostTotalpassPermitido('https://gym-service-api.totalpass.com/webhook_confirmations/abcdef123456'), true);
  assert.equal(hostTotalpassPermitido('http://gym-service-api.totalpass.com/x'), false);
  assert.equal(hostTotalpassPermitido('https://totalpass.com.evil.io/x'), false);
  assert.equal(hostTotalpassPermitido('https://169.254.169.254/latest'), false);
  const ok = totalpass.lerCheckin({ type: 'CHECK_IN_CREATED', endpoint: 'https://gym-service-api.totalpass.com/webhook_confirmations/tok-unico-123456', check_in: { expires_at: '2026-10-21T15:00:00Z', plan_code: 'P1' }, place: { code: 'PL' }, user: { code: 'U1', document_number: '123.456.789-09', document_type: 'cpf' } });
  assert.equal(ok.contaExterna, 'PL');
  assert.equal(ok.expiraEm.toISOString(), '2026-10-21T15:00:00.000Z');
  assert.ok(!ok.idExterno.includes('tok-unico'), 'token de uso único não vira identificador em claro');
  assert.equal(hostTotalpassPermitido('https://gym-service-api.totalpass.com/admin/delete'), false, 'só o caminho de validação');
  assert.equal(hostTotalpassPermitido('https://gym-service-api.totalpass.com/webhook_confirmations/abcdef123456?x=1'), false);
  assert.equal(totalpass.lerCheckin({ type: 'CHECK_IN_CREATED', endpoint: 'https://evil.com/x', user: { code: 'U' } }).invalido, true);
  assert.equal(totalpass.lerCheckin({ type: 'CHECK_IN_CANCELED' }).ignorar, true);
});

test('validação: 2xx valida; 5xx/rede tenta de novo; 4xx recusa; 422 expirado na TotalPass', async () => {
  const resp = (status, corpo = {}) => async () => ({ ok: status < 300, status, json: async () => corpo });
  const conta = { id_externo: '1', ambiente: 'sandbox' };
  const ck = { pessoa_externa: 'p' };
  assert.equal((await wellhub.validar({ conta, checkin: ck, fetch: resp(200), token: 't' })).resultado, 'validado');
  assert.deepEqual((await wellhub.validar({ conta, checkin: ck, fetch: resp(503), token: 't' })).tentarDeNovo, true);
  assert.equal((await wellhub.validar({ conta, checkin: ck, fetch: async () => { throw new Error('ECONNRESET'); }, token: 't' })).tentarDeNovo, true);
  assert.equal((await wellhub.validar({ conta, checkin: ck, fetch: resp(400, { message: 'invalid' }), token: 't' })).resultado, 'negado');
  assert.equal((await wellhub.validar({ conta, checkin: ck, fetch: resp(200), token: '' })).tentarDeNovo, false);
  const url = 'https://gym-service-api.totalpass.com/webhook_confirmations/tok-123456789';
  assert.equal((await totalpass.validar({ checkin: { validacao_url: url }, fetch: resp(422, { message: 'Checkin expirado' }) })).resultado, 'expirado');
  assert.equal((await totalpass.validar({ checkin: { validacao_url: 'https://evil.com' }, fetch: resp(200) })).resultado, 'negado');
  const r302 = await totalpass.validar({ checkin: { validacao_url: url }, fetch: resp(302) });
  assert.equal(r302.tentarDeNovo, false, 'redirecionamento é recusado (não leva as chaves para outro endereço)');
});
