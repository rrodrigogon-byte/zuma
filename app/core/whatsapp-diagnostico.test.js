import test from 'node:test';
import assert from 'node:assert/strict';
import { conclusoesDoDiagnostico } from './whatsapp-diagnostico.js';

const AGORA = '2026-10-04T18:00:00.000Z';
const base = () => ({
  agora: AGORA, provedor: 'chatbot_backend', configurado: true, modo: 'instancias', instancia: 'dino',
  instancias: [{ name: 'dino', state: 'open' }], estado: 'open', numeroIdentificado: true, chaveRecusada: false, saida: 'pilot',
  canal: { id: 'c1', ultimo_evento_em: '2026-10-04T17:59:30.000Z' },
  entrada: { ativa: true, workerIniciado: true, modo: 'pilot', modoPedido: 'pilot', linhaVerificada: true, rolloutAprovado: false, pilotos: 1, intervaloMs: 5000, empresaPorVariavel: true, ultimaPassada: { em: '2026-10-04T17:59:55.000Z', resultado: { lidas: 3, novas: 1 } } },
  mensagens24h: { total: 3, contatos: 1, ultimaEm: '2026-10-04T17:59:20.000Z' },
});
const por = (f) => Object.fromEntries(conclusoesDoDiagnostico(f).map((c) => [c.titulo, c]));

test('mensagem gravada mas fora do piloto não deixa diagnóstico todo verde', () => {
  const f = base();
  f.entrada.ultimaPassada.resultado.foraDoPiloto = 4;
  const c = por(f);
  assert.equal(c['Mensagens fora do piloto'].ok, false);
  assert.match(c['Mensagens fora do piloto'].detalhe, /4 mensagem/);
  assert.match(c['Mensagens fora do piloto'].detalhe, /mensagem nova/);
  assert.match(c['Mensagens chegando no Kytto'].detalhe, /não comprova resposta/);
  f.entrada.modo = 'on';
  assert.equal(por(f)['Mensagens fora do piloto'], undefined, 'contagem de uma passada anterior não bloqueia modo on');
});

test('piloto pronto: todas as conclusões verdes', () => {
  const c = conclusoesDoDiagnostico(base());
  assert.ok(c.length >= 9);
  assert.deepEqual(c.filter((i) => !i.ok).map((i) => i.titulo), []);
});

test('sessão aberta sem telefone não aparece como saúde totalmente verde', () => {
  const f = { ...base(), numeroIdentificado: false };
  const c = por(f);
  assert.equal(c['Sessão conectada'].ok, true);
  assert.equal(c['Linha verificada'].ok, true, 'gate administrativo é separado da identidade reportada pelo backend');
  assert.equal(c['Número identificado pelo backend'].ok, false);
  assert.match(c['Número identificado pelo backend'].detalhe, /referência manual não confirma/);
});

test('situação de 04/10: sem empresa dona, sem linha verificada, entrada on sem rollout e saída desligada', () => {
  const f = base();
  f.saida = 'off';
  f.canal = null;
  f.entrada = { ...f.entrada, empresaPorVariavel: false, linhaVerificada: false, modo: 'off', modoPedido: 'on', workerIniciado: false };
  const c = por(f);
  assert.match(c['Empresa dona do número'].detalhe, /CHATBOT_BACKEND_EMPRESA_ID/);
  assert.match(c['Linha verificada'].detalhe, /WHATSAPP_LINE_VERIFIED=1/);
  assert.equal(c['Entrada das mensagens'].ok, false);
  assert.match(c['Saída das respostas'].detalhe, /WHATSAPP_EGRESS_MODE/);
  assert.equal(c['Leitura rodando'], undefined, 'não cobra o leitor enquanto a entrada está fechada');
});

test('entrada on sem rollout aprovado explica a trava e sugere o piloto', () => {
  const f = base();
  f.entrada = { ...f.entrada, modo: 'off', modoPedido: 'on' };
  assert.match(por(f)['Entrada das mensagens'].detalhe, /WHATSAPP_FULL_ROLLOUT_APPROVED=1/);
});

test('leitor não iniciado pede reinício; erro na passada aparece', () => {
  const f = base();
  f.entrada = { ...f.entrada, workerIniciado: false };
  assert.match(por(f)['Leitura rodando'].detalhe, /Reinicie/);
  const g = base();
  g.entrada = { ...g.entrada, ultimaPassada: { em: '2026-10-04T17:59:55.000Z', erro: 'timeout' } };
  assert.match(por(g)['Leitura rodando'].detalhe, /timeout/);
});

test('backend sem mensagens gravadas aponta WHATSAPP_CAPTURE_ORGANIC; atraso no Kytto é sinalizado', () => {
  assert.match(por({ ...base(), mensagens24h: { total: 0, contatos: 0, ultimaEm: null } })['Mensagens gravadas no backend (24 h)'].detalhe, /WHATSAPP_CAPTURE_ORGANIC=true/);
  assert.equal(por({ ...base(), canal: { id: 'c1', ultimo_evento_em: '2026-10-03T21:59:14.000Z' } })['Mensagens chegando no Kytto'].ok, false);
});

test('chave recusada e modo isa param na primeira trava', () => {
  assert.equal(conclusoesDoDiagnostico({ ...base(), chaveRecusada: true }).length, 1);
  const isa = conclusoesDoDiagnostico({ ...base(), modo: 'isa' });
  assert.equal(isa.length, 1);
  assert.match(isa[0].detalhe, /CHATBOT_BACKEND_MODE=instancias/);
});


test('modo on não declara saída pronta sem sessão, dono, canal e verificação da linha', () => {
  for (const change of [f => { f.estado = 'qr'; }, f => { f.entrada.empresaPorVariavel = false; }, f => { f.canal = null; }, f => { f.entrada.linhaVerificada = false; }]) {
    const facts = base(); facts.saida = 'on'; change(facts);
    const result = por(facts)['Saída das respostas'];
    assert.equal(result.ok, false);
    assert.match(result.detalhe, /Envio bloqueado/);
  }
});
