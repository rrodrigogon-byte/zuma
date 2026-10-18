import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as svc from '../modules/contratos/servico.js';
import { createContratosAdminRouter, createContratosPublicRouter } from '../modules/contratos/rotas.js';
import * as acessoRepo from '../modules/acesso/repositorio.js';
import { decidirAcesso } from '../modules/acesso/regras.js';

describe('clube-contratos (PostgreSQL)', { skip: pgDeTeste }, () => {

const EMPRESA = randomUUID();
let ctx; let server; let base; const whats = []; const aceites = [];

const CORPO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — {{empresa.nome}}

Aluno: {{aluno.nome}}. Plano: {{plano.nome}}, valor mensal de R$ {{plano.valor}}.
As partes aceitam o aceite eletrônico deste contrato, nos termos do art. 10, §2º, da MP 2.200-2/2001.
Emitido em {{data.emissao}}.`;

const DESTAQUES = [
  { id: 'fidelidade', titulo: 'Fidelidade de 12 meses', texto: 'O plano {{plano.nome}} tem fidelidade de 12 meses.' },
  { id: 'multa', titulo: 'Multa de cancelamento', texto: 'Cancelamento antes do prazo gera multa de 10% do saldo restante.' },
];

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '078_clube_cobrancas.sql']);
  const app = express();
  app.set('trust proxy', true);
  const enviarWhatsapp = async (m) => { whats.push(m); };
  app.use('/api/admin/clube/contratos', createContratosAdminRouter({
    db: ctx.db, empresaDaRequisicao: async () => EMPRESA, operadorDaRequisicao: () => 'gestor-1', enviarWhatsapp, urlPublica: 'https://academia.kytto.com.br',
  }));
  app.use('/api/public/contratos', createContratosPublicRouter({ db: ctx.db, enviarWhatsapp, aoAceitar: async (r) => { aceites.push(r); } }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await ctx.fechar(); });

const post = (url, body, headers = {}) => fetch(`${base}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body || {}) });

test('renderização: variáveis preenchidas e lacuna é erro', () => {
  assert.deepEqual(svc.variaveisDoModelo('{{a.b}} e {{ c }} e {{a.b}}'), ['a.b', 'c']);
  assert.equal(svc.renderizar('Olá {{aluno.nome}}', { aluno: { nome: 'Ana' } }), 'Olá Ana');
  assert.throws(() => svc.renderizar('Valor {{plano.valor}}', {}), { code: 'VARIAVEIS_FALTANDO' });
  assert.equal(svc.jsonCanonico({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } }), '{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
});

test('modelo exige cláusula de aceite eletrônico e versiona', async () => {
  await assert.rejects(svc.salvarModelo(ctx.db, EMPRESA, { codigo: 'x', titulo: 'X', corpo: 'texto qualquer '.repeat(5) }), { code: 'CLAUSULA_ACEITE_OBRIGATORIA' });
  const v1 = await svc.salvarModelo(ctx.db, EMPRESA, { codigo: 'matricula', titulo: 'Contrato de matrícula', corpo: CORPO, clausulasDestaque: DESTAQUES });
  assert.equal(v1.versao, 1);
  const v2 = await svc.salvarModelo(ctx.db, EMPRESA, { codigo: 'matricula', titulo: 'Contrato de matrícula', corpo: `${CORPO}\nRevisado.`, clausulasDestaque: DESTAQUES });
  assert.equal(v2.versao, 2);
  const ativos = await svc.listarModelos(ctx.db, EMPRESA);
  assert.equal(ativos.filter((m) => m.codigo === 'matricula').length, 1);
  assert.deepEqual(ativos[0].variaveis.sort(), ['aluno.nome', 'data.emissao', 'empresa.nome', 'plano.nome', 'plano.valor']);
});

let link; let token; let contratoId; let customerId;

test('gerar pelo painel: texto congelado, link enviado no WhatsApp, token só na resposta', async () => {
  customerId = await criarCliente(ctx.db, EMPRESA, 'Beatriz Ramos', '65991112222');
  let r = await post('/api/admin/clube/contratos', { customerId, modeloCodigo: 'matricula', variaveis: { empresa: { nome: 'Academia Teste' }, plano: { nome: 'Livre', valor: '129,90' } } });
  assert.equal(r.status, 201);
  const g = await r.json();
  ({ link, contratoId } = g);
  token = link.split('/').pop();
  assert.match(link, /^https:\/\/academia\.kytto\.com\.br\/contrato\/.{30,}$/);
  assert.equal(whats.length, 1);
  assert.match(whats[0].texto, /Oi, Beatriz!/);
  assert.match(whats[0].texto, /Fidelidade de 12 meses/);
  assert.ok(whats[0].texto.includes(link));
  const row = await ctx.db.query('SELECT token_hash, conteudo FROM clube_contratos WHERE id = $1', [contratoId]);
  assert.ok(!row.rows[0].token_hash.includes(token), 'banco guarda só o hash do token');
  assert.match(row.rows[0].conteudo, /Revisado\./, 'usa a versão ativa do modelo');

  r = await post('/api/admin/clube/contratos', { customerId, modeloCodigo: 'matricula', variaveis: { empresa: { nome: 'X' } } });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).code, 'VARIAVEIS_FALTANDO');
});

test('página pública abre o contrato com destaques e telefone mascarado', async () => {
  const r = await fetch(`${base}/api/public/contratos/${token}`);
  const c = await r.json();
  assert.equal(c.status, 'enviado');
  assert.equal(c.clausulasDestaque.length, 2);
  assert.equal(c.clausulasDestaque[0].texto, 'O plano Livre tem fidelidade de 12 meses.');
  assert.equal(c.telefoneCodigo, '(**) *****-2222');
  assert.equal((await fetch(`${base}/api/public/contratos/${'x'.repeat(32)}`)).status, 404);
});

test('código: vai no WhatsApp, nunca na resposta HTTP; reenvio limitado a 1/min', async () => {
  const antes = whats.length;
  let r = await post(`/api/public/contratos/${token}/codigo`);
  assert.deepEqual(await r.json(), { enviado: true });
  assert.equal(whats.length, antes + 1);
  assert.match(whats.at(-1).texto, /código para aceitar o contrato é \d{6}/);
  r = await post(`/api/public/contratos/${token}/codigo`);
  assert.equal(r.status, 429);
});

test('aceite: exige todas as cláusulas, código certo; erro conta tentativa', async () => {
  const codigo = whats.at(-1).texto.match(/(\d{6})/)[1];
  let r = await post(`/api/public/contratos/${token}/aceite`, { codigo, clausulasMarcadas: ['fidelidade'] });
  assert.equal((await r.json()).code, 'CLAUSULAS_PENDENTES');
  const errado = codigo === '000000' ? '111111' : '000000';
  r = await post(`/api/public/contratos/${token}/aceite`, { codigo: errado, clausulasMarcadas: ['fidelidade', 'multa'] });
  assert.equal((await r.json()).code, 'CODIGO_INVALIDO');
  const t = await ctx.db.query('SELECT codigo_tentativas FROM clube_contratos WHERE id = $1', [contratoId]);
  assert.equal(t.rows[0].codigo_tentativas, 1);

  r = await post(`/api/public/contratos/${token}/aceite`, { codigo, clausulasMarcadas: ['fidelidade', 'multa'], geo: { lat: -14.6, lng: -57.5 } }, { 'user-agent': 'TesteiPhone' });
  const ok = await r.json();
  assert.equal(ok.aceito, true);
  assert.match(ok.hashEvidencias, /^[0-9a-f]{64}$/);
  assert.equal(aceites[0].customerId, customerId);

  r = await post(`/api/public/contratos/${token}/aceite`, { codigo, clausulasMarcadas: ['fidelidade', 'multa'] });
  assert.equal((await r.json()).code, 'CONTRATO_ENCERRADO');
});

test('verificação pública confere a cadeia e mostra nome abreviado', async () => {
  const c = await ctx.db.query('SELECT hash_evidencias FROM clube_contratos WHERE id = $1', [contratoId]);
  const r = await fetch(`${base}/api/public/contratos/verificar/${c.rows[0].hash_evidencias}`);
  const v = await r.json();
  assert.equal(v.valido, true);
  assert.equal(v.signatario, 'Beatriz R.');
  assert.ok(v.eventos >= 6);
  assert.equal((await (await fetch(`${base}/api/public/contratos/verificar/${'a'.repeat(64)}`)).json()).valido, false);
});

test('evidências são imutáveis e contrato aceito não muda', async () => {
  await assert.rejects(ctx.db.query('UPDATE clube_contrato_eventos SET ip = $1 WHERE contrato_id = $2', ['1.1.1.1', contratoId]), /somente inserção/);
  await assert.rejects(ctx.db.query('DELETE FROM clube_contrato_eventos WHERE contrato_id = $1', [contratoId]), /somente inserção/);
  await assert.rejects(ctx.db.query("UPDATE clube_contratos SET conteudo = 'adulterado' WHERE id = $1", [contratoId]), /imutável/);
  const ev = await (await fetch(`${base}/api/admin/clube/contratos/${contratoId}/evidencias`)).json();
  assert.equal(ev.cadeia.integra, true);
  const html = await (await fetch(`${base}/api/admin/clube/contratos/${contratoId}/comprovante`)).text();
  assert.match(html, /Página de evidências/);
  assert.match(html, /cadeia de evidências: íntegra/i);
  assert.ok(!html.includes('<script'), 'comprovante sem script');
});

test('integração com a catraca: contrato pendente bloqueia após 7 dias', async () => {
  const outro = await criarCliente(ctx.db, EMPRESA, 'Diego Melo', '65993334444');
  const plano = await acessoRepo.salvarPlano(ctx.db, EMPRESA, { nome: 'Plano contrato' });
  await acessoRepo.criarMatricula(ctx.db, EMPRESA, { customerId: outro, planoId: plano.id, pagoAte: '2026-12-31' });
  const enviadoEm = new Date('2026-10-01T12:00:00Z');
  await svc.gerarContrato(ctx.db, EMPRESA, { customerId: outro, modeloCodigo: 'matricula', variaveis: { empresa: { nome: 'A' }, plano: { nome: 'B', valor: '1' } } }, { agora: enviadoEm });
  const extras = { contrato: svc.contratoParaAcesso };
  const dia5 = new Date('2026-10-06T15:00:00Z');
  const c5 = await acessoRepo.carregarContexto(ctx.db, { empresaId: EMPRESA, customerId: outro, agora: dia5 }, extras);
  assert.equal(decidirAcesso({ ...c5, agora: dia5 }).liberado, true);
  const dia8 = new Date('2026-10-09T15:00:00Z');
  const c8 = await acessoRepo.carregarContexto(ctx.db, { empresaId: EMPRESA, customerId: outro, agora: dia8 }, extras);
  assert.equal(decidirAcesso({ ...c8, agora: dia8 }).codigo, 'contrato_pendente');
});

test('lembretes no dia 1 e no dia 3, depois param', async () => {
  const agora = new Date('2026-10-05T12:00:00Z'); // Diego: enviado em 01/10
  let devidos = (await svc.lembretesDevidos(ctx.db, { agora })).filter((l) => l.mensagem.includes('Diego'));
  assert.equal(devidos.length, 1);
  await svc.marcarLembreteEnviado(ctx.db, EMPRESA, devidos[0].contratoId);
  devidos = (await svc.lembretesDevidos(ctx.db, { agora })).filter((l) => l.mensagem.includes('Diego'));
  assert.equal(devidos.length, 1, 'segundo lembrete (3 dias) também devido');
  await svc.marcarLembreteEnviado(ctx.db, EMPRESA, devidos[0].contratoId);
  devidos = (await svc.lembretesDevidos(ctx.db, { agora })).filter((l) => l.mensagem.includes('Diego'));
  assert.equal(devidos.length, 0);
});

test('cancelamento de contrato pendente registra motivo; aceito não cancela', async () => {
  let r = await post(`/api/admin/clube/contratos/${contratoId}/cancelar`, { motivo: 'teste' });
  assert.equal(r.status, 404, 'aceito não pode ser cancelado por aqui');
  const lista = await (await fetch(`${base}/api/admin/clube/contratos?status=enviado`)).json();
  const pendente = lista.find((c) => c.aluno === 'Diego Melo');
  r = await post(`/api/admin/clube/contratos/${pendente.id}/cancelar`, { motivo: 'Matrícula refeita' });
  assert.equal(r.status, 200);
});
});
