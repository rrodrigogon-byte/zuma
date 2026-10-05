import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHandoffEmail,
  buildHandoffHumanMessage,
  notifyHumanHandoff,
} from './whatsapp-handoff-notify.js';

const TRANSCRIPT = [
  { role: 'user', text: 'vamos fechar a compra de todos', at: '2026-10-05T20:06:00Z' },
  { role: 'assistant', text: 'Que ótimo! Qual seu nome?', at: '2026-10-05T20:07:00Z' },
  { role: 'user', text: 'Lucas dos Passos Silva', at: '2026-10-05T20:07:30Z' },
];

test('buildHandoffEmail monta assunto, cliente, motivo legível e histórico', () => {
  const { subject, html, text } = buildHandoffEmail({
    storeName: 'Dino Barbearia',
    customerName: 'Lucas dos Passos Silva',
    customerPhone: '55 65 99999-0001',
    reason: 'security:output_policy',
    priority: 5,
    transcript: TRANSCRIPT,
  });
  assert.match(subject, /Lucas dos Passos Silva/);
  assert.match(html, /Dino Barbearia/);
  assert.match(html, /5565999990001/); // telefone só dígitos
  assert.match(html, /segurança/); // motivoLegivel('security:...') => 'segurança'
  assert.match(html, /Lucas dos Passos Silva/);
  assert.match(text, /Histórico:/);
  assert.match(text, /vamos fechar a compra de todos/);
});

test('buildHandoffEmail escapa HTML do conteúdo do cliente', () => {
  const { html } = buildHandoffEmail({
    customerName: '<script>x</script>',
    transcript: [{ role: 'user', text: '<b>oi</b> & "cia"', at: null }],
  });
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;b&gt;oi&lt;\/b&gt; &amp; &quot;cia&quot;/);
});

test('buildHandoffHumanMessage traz loja, cliente, motivo e últimas mensagens', () => {
  const msg = buildHandoffHumanMessage({
    storeName: 'Dino Barbearia',
    customerName: 'Lucas',
    customerPhone: '5565999990001',
    reason: 'pedido_do_cliente',
    transcript: TRANSCRIPT,
  });
  assert.match(msg, /Dino Barbearia/);
  assert.match(msg, /Lucas/);
  assert.match(msg, /5565999990001/);
  assert.match(msg, /cliente pediu uma pessoa/); // motivoLegivel('pedido_do_cliente')
  assert.match(msg, /Lucas dos Passos Silva/); // última mensagem do cliente
});

test('notifyHumanHandoff envia e-mail e WhatsApp quando ambos configurados', async () => {
  const calls = { mail: [], wa: [] };
  const deps = {
    mail: { enviar: async (args) => { calls.mail.push(args); return { ok: true, id: 'e1' }; } },
    enviarMensagem: async (tenant, phone, text) => { calls.wa.push({ tenant, phone, text }); return { ok: true }; },
  };
  const res = await notifyHumanHandoff(
    {
      session: { empresa_id: 'E', loja_id: 'L', canal_id: 'C' },
      reason: 'security:output_policy',
      priority: 5,
      storeName: 'Dino',
      customerName: 'Lucas',
      customerPhone: '5565999990001',
      transcript: TRANSCRIPT,
      config: { handoff_notify_email: 'recepcao@dino.com', handoff_human_phone: '5565988887777' },
    },
    deps,
  );
  assert.equal(calls.mail.length, 1);
  assert.equal(calls.mail[0].to, 'recepcao@dino.com');
  assert.equal(calls.wa.length, 1);
  assert.equal(calls.wa[0].phone, '5565988887777');
  assert.equal(res.emailed.ok, true);
  assert.equal(res.messaged.ok, true);
});

test('notifyHumanHandoff não manda WhatsApp para o próprio número do cliente', async () => {
  const calls = { wa: 0 };
  const deps = {
    mail: { enviar: async () => ({ ok: true }) },
    enviarMensagem: async () => { calls.wa += 1; return { ok: true }; },
  };
  const res = await notifyHumanHandoff(
    {
      customerPhone: '5565999990001',
      config: { handoff_human_phone: '55 65 99999-0001' }, // mesmo número do cliente
    },
    deps,
  );
  assert.equal(calls.wa, 0);
  assert.equal(res.messaged, null);
});

test('notifyHumanHandoff não faz nada e não lança sem config', async () => {
  const res = await notifyHumanHandoff(
    { customerPhone: '5565999990001', config: {} },
    { mail: { enviar: async () => { throw new Error('não deveria chamar'); } }, enviarMensagem: async () => { throw new Error('não deveria chamar'); } },
  );
  assert.deepEqual(res, { emailed: null, messaged: null });
});

test('notifyHumanHandoff isola falha do e-mail e segue (best-effort)', async () => {
  const deps = {
    mail: { enviar: async () => { throw new Error('resend caiu'); } },
    enviarMensagem: async () => ({ ok: true }),
  };
  const res = await notifyHumanHandoff(
    {
      customerPhone: '5565999990001',
      config: { handoff_notify_email: 'r@d.com', handoff_human_phone: '5565988887777' },
    },
    deps,
  );
  assert.equal(res.emailed.ok, false);
  assert.equal(res.messaged.ok, true);
});


test('configuração salva pelo painel envia ambos os canais e email desativado não simula sucesso', async () => {
  const calls = [];
  const input = { customerPhone: '5565999990001', config: { notify_email: 'recepcao@example.com', attendant_phone: '5565999990002' } };
  const deps = { mail: { ativo: () => true, enviar: async () => { calls.push('email'); return { ok: true }; } }, enviarMensagem: async () => { calls.push('wa'); return { ok: true }; } };
  await notifyHumanHandoff(input, deps);
  assert.deepEqual(calls, ['email', 'wa']);
  const off = await notifyHumanHandoff(input, { ...deps, mail: { ativo: () => false } });
  assert.equal(off.emailed.code, 'MAIL_NOT_CONFIGURED');
  assert.equal(off.messaged.ok, true);
});
test('mesmo cliente com e sem nono dígito não recebe alerta de atendente', async () => {
  let sent = false;
  await notifyHumanHandoff({ customerPhone: '5565999990001', config: { attendant_phone: '556599990001' } }, { enviarMensagem: async () => { sent = true; } });
  assert.equal(sent, false);
});
test('histórico de notificação omite cartão e credenciais', () => {
  const email = buildHandoffEmail({ transcript: [{ role: 'user', text: 'meu cartão é 4111 1111 1111 1111' }] });
  assert.doesNotMatch(email.text, /4111/);
  assert.match(email.text, /sensível omitido/);
});
