import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChecklist } from './dino-ativacao-routes.js';

const base = () => ({
  agora: Date.parse('2026-09-28T20:00:00Z'), baseUrl: 'https://dino.kytto.com.br', commerce: true, migracao: true,
  provider: 'chatbot_backend', instance: 'dino-1', env: { CHATBOT_BACKEND_KEY: true, CHATBOT_BACKEND_URL: true, WHATSAPP_AI_WEBHOOK_SECRET: true, FEATURE_WHATSAPP_AI: true }, modo: 'isa', empresaDoNumero: true,
  ia: { gemini: true, anthropic: false, openai: false }, conexao: 'open',
  canal: { status: 'ativo', instance: 'dino-1', publicCode: 'abc123', lastEventAt: '2026-09-28T19:00:00Z' },
  politica: { personalizationEnabled: true, privacyNotice: 'x' }, cerebro: { ativo: true, autonomia: 1 }, execucoes: 1,
  slug: 'dino', agendamentoAtivo: true, vitrine: { aliasCount: 1, accent: '#6E7CE0', phone: '5565999990000' }, semFoto: [], esgotados: [],
});

test('tudo pronto: opcionais não contam', () => {
  const r = buildChecklist(base());
  assert.equal(r.prontos, r.total);
  assert.ok(r.itens.find((i) => i.id === 'claude').opcional);
});

test('situação de 28/09: slug, vitrine laranja, esgotados e canal oferecem a ação certa', () => {
  const f = { ...base(), slug: '', canal: null, politica: null, vitrine: { aliasCount: 1, accent: '#FF6B2C', phone: '' }, esgotados: [{ id: 'x', nome: 'Xerjoff Erba Pura' }], semFoto: [{ id: 'y', nome: 'Tom Ford Oud Wood' }] };
  const r = buildChecklist(f);
  const by = Object.fromEntries(r.itens.map((i) => [i.id, i]));
  assert.equal(by.slug.acao, 'slug');
  assert.equal(by.vitrine_cores.ok, false); assert.equal(by.vitrine_cores.acao, 'vitrine');
  assert.equal(by.esgotados.acao, 'esgotados'); assert.match(by.esgotados.detalhe, /Xerjoff/);
  assert.equal(by.canal.acao, 'criar_canal');
  assert.equal(by.politica.acao, null, 'política só depois do canal');
  assert.match(by.fotos.detalhe, /Tom Ford/);
});

test('webhook mostra URL e nome do cabeçalho, nunca o valor do segredo', () => {
  const r = buildChecklist({ ...base(), canal: { status: 'rascunho', instance: 'dino-1', publicCode: 'abc123', lastEventAt: null } });
  const w = r.itens.find((i) => i.id === 'webhook');
  assert.equal(w.ok, false);
  assert.equal(w.dados.url, 'https://dino.kytto.com.br/api/webhooks/whatsapp/abc123');
  assert.equal(w.dados.segredo, 'WHATSAPP_AI_WEBHOOK_SECRET');
  assert.equal(r.itens.find((i) => i.id === 'canal').acao, 'ativar_canal');
});

test('modelo Isa: exige URL própria e o número ligado a esta empresa; webhook não é exigido', () => {
  const r = buildChecklist({ ...base(), env: { CHATBOT_BACKEND_KEY: true, FEATURE_WHATSAPP_AI: true }, empresaDoNumero: false });
  const by = Object.fromEntries(r.itens.map((i) => [i.id, i]));
  assert.equal(by.whatsapp_url.ok, false);
  assert.equal(by.whatsapp_empresa.ok, false);
  assert.equal(by.webhook_segredo.ok, true);
  assert.match(by.webhook_segredo.detalhe, /igual à Isa/);
});
