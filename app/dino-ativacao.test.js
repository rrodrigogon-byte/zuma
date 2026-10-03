import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChecklist, fatosAgendaParaIa } from './dino-ativacao-routes.js';

const base = () => ({
  agora: Date.parse('2026-09-28T20:00:00Z'), baseUrl: 'https://dino.kytto.com.br', commerce: true, migracao: true,
  provider: 'chatbot_backend', instance: 'dino-1', env: { CHATBOT_BACKEND_KEY: true, CHATBOT_BACKEND_URL: true, WHATSAPP_AI_WEBHOOK_SECRET: true, FEATURE_WHATSAPP_AI: true }, modo: 'isa', empresaDoNumero: true,
  ia: { gemini: true, anthropic: false, openai: false }, conexao: 'open',
  canal: { status: 'ativo', instance: 'dino-1', publicCode: 'abc123', lastEventAt: '2026-09-28T19:00:00Z' },
  politica: { personalizationEnabled: true, privacyNotice: 'x' }, cerebro: { ativo: true, autonomia: 1 }, execucoes: 1,
  slug: 'dino', agendamentoAtivo: true, vitrine: { aliasCount: 1, accent: '#6E7CE0', phone: '5565999990000' }, semFoto: [], esgotados: [],
  poll: { modo: 'pilot', pilotos: 1 }, resumo: { ativo: false, hora: '21:00', destinatarios: [] }, filaAntiga: 0,
  agendaIa: { profissionais: 6, semJornada: [], semQuemFaz: [], agendamentosFuturos: 12 },
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

const AGORA = Date.parse('2026-10-03T12:00:00Z');
const SEG_A_SAB = [1, 2, 3, 4, 5, 6];

test('fatos da agenda: futuros válidos, jornada e quem faz os serviços especializados', () => {
  const f = fatosAgendaParaIa({
    agora: AGORA,
    profissionais: [
      { id: 'p1', nome: 'Bruno', horarioInicio: '06:00', horarioFim: '21:00', diasTrabalho: SEG_A_SAB },
      { id: 'p2', nome: 'Nathy', horarioInicio: '06:00', horarioFim: '21:00', diasTrabalho: [] },
      { id: 'p3', nome: 'Antigo', ativo: false },
    ],
    servicos: [
      { id: 's1', nome: 'Corte Masculino', profissionaisIds: [] },
      { id: 's2', nome: 'Manicure', profissionaisIds: [] },
      { id: 's3', nome: 'Pedicure', profissionaisIds: ['p2'] },
      { id: 's4', nome: 'Massagem Relaxante' },
      { id: 's5', nome: 'Química (Relaxamento)', ativo: false },
    ],
    agendamentos: [
      { status: 'agendado', dataHora: '2026-10-05T12:00:00Z' },
      { status: 'confirmado', dataHora: '2026-10-06T12:00:00Z' },
      { status: 'cancelado', dataHora: '2026-10-07T12:00:00Z' },
      { status: 'concluido', dataHora: '2026-10-02T12:00:00Z' },
    ],
  });
  assert.equal(f.profissionais, 2, 'inativo não conta');
  assert.deepEqual(f.semJornada.map((p) => p.nome), ['Nathy']);
  assert.deepEqual(f.semQuemFaz.map((s) => s.nome), ['Manicure', 'Massagem Relaxante'], 'corte pode ser com qualquer um; inativo fica de fora');
  assert.equal(f.agendamentosFuturos, 2);
});

test('situação de produção em 03/10: modo on, agenda vazia e manicure sem dono bloqueiam a liberação', () => {
  const r = buildChecklist({
    ...base(), conexao: 'close', poll: { modo: 'on', pilotos: 0 }, filaAntiga: 1,
    agendaIa: { profissionais: 6, semJornada: [], semQuemFaz: [{ id: 's2', nome: 'Manicure' }, { id: 's3', nome: 'Pedicure' }], agendamentosFuturos: 0 },
  });
  const by = Object.fromEntries(r.itens.map((i) => [i.id, i]));
  assert.equal(by.modo_entrada.ok, false);
  assert.match(by.modo_entrada.detalhe, /todos os clientes falam com a IA/);
  assert.equal(by.agenda.ok, false);
  assert.match(by.agenda.detalhe, /outro sistema/);
  assert.equal(by.quem_faz.ok, false);
  assert.match(by.quem_faz.detalhe, /Manicure, Pedicure/);
  assert.equal(by.fila.ok, false);
  assert.equal(by.jornada.ok, true);
  assert.equal(by.resumo.opcional, true);
  assert.ok(r.prontos < r.total);
});

test('modo de entrada: piloto precisa de telefone; on só fica verde com tudo pronto', () => {
  const sem = buildChecklist({ ...base(), poll: { modo: 'pilot', pilotos: 0 } }).itens.find((i) => i.id === 'modo_entrada');
  assert.equal(sem.ok, false); assert.match(sem.detalhe, /WHATSAPP_POLL_PILOT_PHONES/);
  assert.equal(buildChecklist({ ...base(), poll: { modo: 'shadow' } }).itens.find((i) => i.id === 'modo_entrada').ok, false);
  const on = buildChecklist({ ...base(), poll: { modo: 'on', pilotos: 0 } }).itens.find((i) => i.id === 'modo_entrada');
  assert.equal(on.ok, true); assert.match(on.detalhe, /todos os clientes/);
});

test('resumo diário configurado mostra só os finais dos telefones', () => {
  const r = buildChecklist({ ...base(), resumo: { ativo: true, hora: '21:00', destinatarios: ['***0001'] } }).itens.find((i) => i.id === 'resumo');
  assert.equal(r.ok, true);
  assert.equal(r.detalhe, 'Às 21:00 para ***0001.');
});

test('agenda ilegível não derruba a lista', () => {
  const r = buildChecklist({ ...base(), agendaIa: null });
  assert.equal(r.itens.find((i) => i.id === 'agenda').ok, false);
});
