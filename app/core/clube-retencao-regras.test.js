import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarGatilhos, bloqueioDeCadencia, calcularRisco, ehOptOut, pedeCancelamento, passoCrescente, passoRegressivo, diasEntre,
} from '../modules/retencao/gatilhos.js';
import { montarTexto, preencher, TEXTOS_BASE, TONS } from '../modules/retencao/textos.js';
import { calcularDevido } from '../modules/retencao/servico.js';

const base = (extra = {}) => ({
  hoje: '2026-10-21',
  matricula: { id: 'm1', status: 'ativa', pagoAte: '2026-11-10', inicio: '2026-01-10', fimFidelidade: null, canceladaEm: null, ...(extra.matricula || {}) },
  ultimoAcesso: '2026-10-20', acessos4: 10, acessosAnt4: 10, dataNascimento: null, prospect: null, promessaAte: null,
  temMatriculaAtiva: true, checkinsParceiroMes: 0,
  ...extra,
  ...(extra.matricula ? { matricula: { id: 'm1', status: 'ativa', pagoAte: '2026-11-10', inicio: '2026-01-10', fimFidelidade: null, canceladaEm: null, ...extra.matricula } } : {}),
});
const gatilhos = (f, reguas) => avaliarGatilhos(f, reguas).map((g) => g.gatilho);

test('aluno em dia, frequente e sem datas especiais: nenhum gatilho', () => {
  assert.deepEqual(gatilhos(base()), []);
});

test('escadas: passo vale até o próximo; último tem janela; nunca dois de uma vez', () => {
  assert.equal(passoCrescente(0, [1, 3, 7, 15]), null);
  assert.equal(passoCrescente(1, [1, 3, 7, 15]), 1);
  assert.equal(passoCrescente(2, [1, 3, 7, 15]), 1);
  assert.equal(passoCrescente(6, [1, 3, 7, 15]), 3);
  assert.equal(passoCrescente(15, [1, 3, 7, 15]), 15);
  assert.equal(passoCrescente(20, [1, 3, 7, 15]), null);
  assert.equal(passoRegressivo(31, [30, 10]), null);
  assert.equal(passoRegressivo(30, [30, 10]), 30);
  assert.equal(passoRegressivo(11, [30, 10]), 30);
  assert.equal(passoRegressivo(10, [30, 10]), 10);
  assert.equal(passoRegressivo(0, [30, 10]), 10);
  assert.equal(diasEntre('2026-10-01', '2026-10-21'), 20);
});

test('inadimplente nos dias 1, 3, 7 e 15; promessa de pagamento pausa', () => {
  const f = base({ matricula: { pagoAte: '2026-10-18' } }); // 3 dias de atraso
  const [g] = avaliarGatilhos(f);
  assert.equal(g.gatilho, 'inadimplente');
  assert.equal(g.chave, 'inadimplente:2026-10-18:3');
  assert.equal(g.marketing, false);
  assert.deepEqual(gatilhos(base({ matricula: { pagoAte: '2026-10-18' }, promessaAte: '2026-10-25' })), []);
});

test('vencimento 5 e 1 dia antes (vence no dia seguinte ao pago até)', () => {
  assert.deepEqual(gatilhos(base({ matricula: { pagoAte: '2026-10-25' } })), ['vencimento']); // vence 26, faltam 5
  assert.deepEqual(gatilhos(base({ matricula: { pagoAte: '2026-10-21' } })), ['vencimento']); // vence 22, falta 1
  assert.deepEqual(gatilhos(base({ matricula: { pagoAte: '2026-10-23' } })), []);
});

test('faltante leve (7) e sério (15), contando do último acesso ou do início', () => {
  assert.deepEqual(gatilhos(base({ ultimoAcesso: '2026-10-14' })), ['faltante_leve']);
  assert.deepEqual(gatilhos(base({ ultimoAcesso: '2026-10-05' })), ['faltante_serio']);
  const nunca = avaliarGatilhos(base({ ultimoAcesso: null, matricula: { inicio: '2026-10-01' } }));
  assert.equal(nunca[0].gatilho, 'faltante_serio');
  assert.equal(nunca[0].chave, 'faltante_serio:2026-10-01');
  // parâmetro da academia muda o corte
  assert.deepEqual(gatilhos(base({ ultimoAcesso: '2026-10-14' }), { faltante_leve: { parametros: { dias: 10 } } }), []);
});

test('risco de cancelar: queda de 50% com base mínima', () => {
  assert.deepEqual(gatilhos(base({ acessos4: 4, acessosAnt4: 10 })), ['risco_cancelar']);
  assert.deepEqual(gatilhos(base({ acessos4: 1, acessosAnt4: 3 })), [], 'base pequena demais');
});

test('renovação 30 e 10 dias antes do fim da fidelidade; aniversário no dia; pós-aula na 1ª semana', () => {
  assert.deepEqual(gatilhos(base({ matricula: { fimFidelidade: '2026-11-15' } })), ['renovacao']);
  assert.equal(avaliarGatilhos(base({ matricula: { fimFidelidade: '2026-10-28' } }))[0].chave, 'renovacao:2026-10-28:10');
  assert.deepEqual(gatilhos(base({ dataNascimento: '1990-10-21' })), ['aniversario']);
  assert.deepEqual(gatilhos(base({ matricula: { inicio: '2026-10-13' }, ultimoAcesso: '2026-10-20' })), ['pos_aula']);
});

test('prospect 1, 3 e 7 dias; ex-aluno 30, 60, 90; parceiro frequente', () => {
  const pro = base({ matricula: null, temMatriculaAtiva: false, ultimoAcesso: null, prospect: { id: 'p1', criadoEm: '2026-10-18' } });
  pro.matricula = null;
  assert.deepEqual(avaliarGatilhos(pro).map((g) => g.chave), ['prospect:p1:3']);
  const ex = base({ temMatriculaAtiva: false, matricula: { status: 'cancelada', canceladaEm: '2026-08-20' } });
  assert.deepEqual(avaliarGatilhos(ex).map((g) => g.chave), ['ex_aluno:m1:60']);
  const parc = base({ temMatriculaAtiva: false, matricula: null, checkinsParceiroMes: 9 });
  parc.matricula = null;
  assert.deepEqual(gatilhos(parc), ['parceiro_frequente']);
});

test('prioridade: cobrança vence marketing; gatilho desligado não aparece', () => {
  const f = base({ matricula: { pagoAte: '2026-10-14' }, ultimoAcesso: '2026-10-01', dataNascimento: '1990-10-21' });
  assert.deepEqual(gatilhos(f), ['inadimplente', 'aniversario', 'faltante_serio']);
  assert.deepEqual(gatilhos(f, { inadimplente: { ativo: false } }), ['aniversario', 'faltante_serio']);
});

test('cadência: horário, domingo, limite, opt-out só para marketing, pausa por resposta, 1 a cada 3 dias', () => {
  const cfg = { horaInicio: 8, horaFim: 20, enviaDomingo: false, limiteDiario: 80, intervaloDias: 3, pausaRespostaDias: 3 };
  const agora = new Date('2026-10-21T14:00:00Z');
  const ok = { horaLocal: 10, diaSemana: 3, enviadosHoje: 0, agora };
  assert.equal(bloqueioDeCadencia(ok, cfg, { marketing: true }), null);
  assert.equal(bloqueioDeCadencia({ ...ok, horaLocal: 7 }, cfg, { marketing: true }), 'fora_do_horario');
  assert.equal(bloqueioDeCadencia({ ...ok, horaLocal: 20 }, cfg, { marketing: true }), 'fora_do_horario');
  assert.equal(bloqueioDeCadencia({ ...ok, diaSemana: 0 }, cfg, { marketing: false }), 'domingo');
  assert.equal(bloqueioDeCadencia({ ...ok, enviadosHoje: 80 }, cfg, { marketing: false }), 'limite_diario');
  assert.equal(bloqueioDeCadencia({ ...ok, optoutEm: agora }, cfg, { marketing: true }), 'optout');
  assert.equal(bloqueioDeCadencia({ ...ok, optoutEm: agora }, cfg, { marketing: false }), null, 'cobrança continua');
  assert.equal(bloqueioDeCadencia({ ...ok, ultimaRespostaEm: new Date('2026-10-20T10:00:00Z') }, cfg, { marketing: false }), 'em_conversa');
  assert.equal(bloqueioDeCadencia({ ...ok, ultimoDisparoEm: new Date('2026-10-19T14:00:01Z') }, cfg, { marketing: false }), 'cadencia');
  assert.equal(bloqueioDeCadencia({ ...ok, ultimoDisparoEm: new Date('2026-10-18T14:00:00Z') }, cfg, { marketing: false }), null);
});

test('risco: explicável e limitado a 100', () => {
  const baixo = calcularRisco(base());
  assert.equal(baixo.risco, 0);
  const alto = calcularRisco(base({ ultimoAcesso: '2026-09-01', acessos4: 0, acessosAnt4: 12, matricula: { pagoAte: '2026-10-01', fimFidelidade: '2026-11-01' }, ultimaNota: 3, ocorrenciaAberta: true }));
  assert.equal(alto.risco, 100);
  assert.ok(alto.fatores[0].pontos >= alto.fatores.at(-1).pontos);
  assert.ok(alto.fatores.some((x) => /sem treinar/.test(x.fator)));
});

test('opt-out e pedido de cancelamento reconhecidos sem confundir', () => {
  for (const t of ['PARAR', 'pare', 'Não quero mais receber essas mensagens', 'para de me mandar isso', 'não me mande mais', 'stop']) assert.ok(ehOptOut(t), t);
  for (const t of ['quero parar de pagar juros', 'parar o treino de perna?', 'não quero perna hoje', 'quero cancelar o plano', 'não quero', 'Não quero, obrigado']) assert.ok(!ehOptOut(t), t);
  assert.ok(pedeCancelamento('quero cancelar meu plano'));
  assert.ok(pedeCancelamento('como faço o cancelamento da matrícula'));
  assert.ok(!pedeCancelamento('cancelar a reserva de amanhã'));
});

test('textos: todos os gatilhos têm os 3 tons; variação estável; marcadores vazios não deixam buraco', () => {
  for (const [g, tons] of Object.entries(TEXTOS_BASE)) for (const t of TONS) assert.ok(tons[t]?.length >= 2, `${g}.${t}`);
  const a = montarTexto('faltante_leve', { tom: 'proximo', semente: 'aluno1:ep', dados: { nome: 'Ana', dias: 8 } });
  const b = montarTexto('faltante_leve', { tom: 'proximo', semente: 'aluno1:ep', dados: { nome: 'Ana', dias: 8 } });
  assert.equal(a, b);
  assert.match(a, /Ana/);
  assert.equal(preencher('Parabéns, {nome}! {mimo}', { nome: 'Leo' }), 'Parabéns, Leo!');
  assert.equal(montarTexto('aniversario', { personalizados: ['Feliz dia, {nome}, da academia!'], dados: { nome: 'Rui' } }), 'Feliz dia, Rui, da academia!');
});

test('valor devido: multa até 2% e juros pro rata', () => {
  const d = calcularDevido({ pagoAte: '2026-10-01', valorMensal: 100, hoje: '2026-10-16', multaPercentual: 2, jurosMesPercentual: 1 });
  assert.deepEqual(d, { diasAtraso: 15, mesesEmAberto: 1, valorOriginal: 100, multa: 2, juros: 0.5, total: 102.5 });
  assert.equal(calcularDevido({ pagoAte: '2026-10-20', valorMensal: 100, hoje: '2026-10-16' }).total, 0);
  assert.equal(calcularDevido({ pagoAte: '2026-09-01', valorMensal: null, hoje: '2026-10-16' }).total, null);
});
