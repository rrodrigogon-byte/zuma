import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import { montarClube, executarRotinasClube } from '../modules/clube/index.js';
import { declaracoesClube, executarFerramentaClube } from '../modules/clube/ferramentas-ia.js';
import * as acesso from '../modules/acesso/repositorio.js';
import * as contratos from '../modules/contratos/servico.js';
import * as aulas from '../modules/aulas/servico.js';
import { extensaoIaClube, telefoneNormalizado } from '../modules/clube/ia-agro-open.js';

describe('clube-integracao (PostgreSQL)', { skip: pgDeTeste }, () => {

const EMP = randomUUID();
const QR = 'segredo-qr-integracao-1234567890';
let ctx; let server; let base; let integ; const whats = [];
const flush = () => new Promise((r) => setTimeout(r, 150));

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
  const app = express();
  integ = montarClube(app, {
    db: ctx.db,
    empresaDaRequisicao: async () => EMP,
    operadorDaRequisicao: () => 'recepcao-1',
    enviarWhatsapp: async (m) => { whats.push(m); },
    urlPublica: 'https://academia.kytto.com.br',
    gerarLinkPagamento: async () => 'https://pay.exemplo/pix/123',
    qrSecret: QR,
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await ctx.fechar(); });

const json = (url, method = 'GET', body) => fetch(`${base}${url}`, {
  method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const catraca = (segredo, userId, uuid) => fetch(`${base}/api/acesso/controlid/${segredo}/new_user_identified.fcgi`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ device_id: '42', user_id: String(userId), event: '7', portal_id: '1', uuid }).toString(),
}).then((r) => r.json());

test('jornada: inadimplente na catraca recebe Pix no WhatsApp; contrato pendente recebe novo link', async () => {
  const disp = await json('/api/admin/clube/acesso/dispositivos', 'POST', { nome: 'Entrada' });
  const segredo = disp.body.configuracao.servidorOnline.split('/').pop();
  const plano = await json('/api/admin/clube/acesso/planos', 'POST', { nome: 'Mensal' });
  const c = await criarCliente(ctx.db, EMP, 'Joana Prado', '65990001111');
  await json('/api/admin/clube/acesso/matriculas', 'POST', { customerId: c, planoId: plano.body.id, pagoAte: '2026-01-31' });
  const pe = await ctx.db.query('SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE customer_id = $1', [c]);
  const userId = Number(pe.rows[0].user_id_equipamento);

  const r1 = await catraca(segredo, userId, 'j-1');
  assert.equal(r1.result.message, 'Mensalidade em aberto');
  await flush();
  assert.match(whats.at(-1).texto, /pay\.exemplo\/pix\/123/);
  const antes = whats.length;
  await catraca(segredo, userId, 'j-2');
  await flush();
  assert.equal(whats.length, antes, 'não repete a mensagem se insistir na catraca');

  // paga, mas tem contrato pendente vencido
  const mat = await ctx.db.query('SELECT id FROM acesso_matriculas WHERE customer_id = $1', [c]);
  await json(`/api/admin/clube/acesso/matriculas/${mat.rows[0].id}/pagamento`, 'POST', { pagoAte: '2099-12-31' });
  await contratos.salvarModelo(ctx.db, EMP, { codigo: 'matricula', titulo: 'Contrato de matrícula', corpo: `Contrato de {{aluno.nome}}. As partes aceitam o aceite eletrônico deste documento conforme a lei.`, clausulasDestaque: [{ id: 'f', titulo: 'Fidelidade', texto: '12 meses' }] });
  await contratos.gerarContrato(ctx.db, EMP, { customerId: c, modeloCodigo: 'matricula' }, { agora: new Date(Date.now() - 10 * 86400000) });
  const r2 = await catraca(segredo, userId, 'j-3');
  assert.equal(r2.result.message, 'Aceite seu contrato no WhatsApp');
  await flush();
  const msg = whats.at(-1).texto;
  const link = msg.match(/https:\/\/academia\.kytto\.com\.br\/contrato\/(\S+)/);
  assert.ok(link, 'novo link de aceite enviado');

  // aceita pelo link novo → catraca libera
  await json(`/api/public/contratos/${link[1]}/codigo`, 'POST');
  const codigo = whats.at(-1).texto.match(/(\d{6})/)[1];
  const aceite = await json(`/api/public/contratos/${link[1]}/aceite`, 'POST', { codigo, clausulasMarcadas: ['f'], aceitaMarketing: true });
  assert.equal(aceite.body.aceito, true);
  await flush();
  const ok = (await ctx.db.query('SELECT marketing_consentido_em, marketing_evidencia FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2', [EMP, c])).rows[0];
  assert.ok(ok?.marketing_consentido_em, 'autorização opcional marcada no aceite vira consentimento com evidência');
  assert.equal(ok.marketing_evidencia.origem, 'contrato');
  const r3 = await catraca(segredo, userId, 'j-4');
  assert.equal(r3.result.event, 7);
  assert.equal(r3.result.message, 'Bom treino, Joana!');
});

test('IA do WhatsApp: vagas, reserva, minhas aulas, status e QR com a identidade da conversa', async () => {
  assert.ok(declaracoesClube.every((d) => d.name.startsWith('clube_') && d.parameters.type === 'OBJECT'));
  const m = await aulas.salvarModalidade(ctx.db, EMP, { nome: 'Funcional' });
  await aulas.salvarTurma(ctx.db, EMP, { modalidadeId: m.id, nome: 'Funcional noite', diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: '19:00', capacidade: 10, vigenciaInicio: '2026-01-01' });
  const amanha = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
  await aulas.gerarOcorrencias(ctx.db, EMP, { de: amanha, ate: amanha });
  const plano = await acesso.salvarPlano(ctx.db, EMP, { nome: 'IA plano' });
  const c = await criarCliente(ctx.db, EMP, 'Marcos IA', '65990002222');
  await acesso.criarMatricula(ctx.db, EMP, { customerId: c, planoId: plano.id, pagoAte: '2099-01-01' });
  const conversa = { empresaId: EMP, customerId: c, qrSecret: QR };

  const vagas = await executarFerramentaClube(ctx.db, conversa, 'clube_listar_vagas', { dia: amanha, modalidade: 'funcional' });
  assert.equal(vagas.ok, true);
  assert.equal(vagas.aulas[0].vagas, 10);
  const res = await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_aula', { ocorrencia_id: vagas.aulas[0].ocorrencia_id });
  assert.equal(res.ok, true);
  const minhas = await executarFerramentaClube(ctx.db, conversa, 'clube_minhas_reservas', {});
  assert.equal(minhas.reservas.length, 1);
  const repetida = await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_aula', { ocorrencia_id: vagas.aulas[0].ocorrencia_id });
  assert.deepEqual([repetida.ok, repetida.codigo], [false, 'JA_RESERVADO'], 'erro de regra volta como texto para a IA, não estoura');
  const status = await executarFerramentaClube(ctx.db, conversa, 'clube_status_acesso', {});
  assert.equal(status.liberado, true);
  const qr = await executarFerramentaClube(ctx.db, conversa, 'clube_qr_entrada', {});
  assert.match(qr.qr, /^K1\.\d+\.\d+\./);
  const semId = await executarFerramentaClube(ctx.db, { empresaId: EMP }, 'clube_reservar_aula', { ocorrencia_id: vagas.aulas[0].ocorrencia_id });
  assert.equal(semId.ok, false, 'sem cliente identificado não age');
});

test('IA do agro-open: aluno pelo telefone (com ou sem 9º dígito), lead só ao registrar interesse, só ativa na academia', async () => {
  assert.equal(telefoneNormalizado('(65) 99000-2222'), '5565990002222');
  assert.equal(telefoneNormalizado('5565990002222'), '5565990002222');
  assert.equal(telefoneNormalizado('123'), null);
  const ext = extensaoIaClube({ db: ctx.db, integracao: integ });
  assert.equal(await ext.ativaPara({ empresaId: EMP }), true, 'academia com plano/turma ativa');
  assert.equal(await ext.ativaPara({ empresaId: randomUUID() }), false, 'outra empresa (barbearia, loja) não vê as ferramentas');

  const aluno = await criarCliente(ctx.db, EMP, 'Rita Telefone', '65990004444');
  const plano = await acesso.salvarPlano(ctx.db, EMP, { nome: 'IA plano 2' });
  await acesso.criarMatricula(ctx.db, EMP, { customerId: aluno, planoId: plano.id, pagoAte: '2099-01-01' });
  const st = await ext.executar({ empresaId: EMP, phone: '5565990004444' }, 'clube_status_acesso', {});
  assert.equal(st.liberado, true);
  // mesmo telefone em outra empresa não enxerga o aluno desta
  const outra = await ext.executar({ empresaId: randomUUID(), phone: '5565990004444' }, 'clube_status_acesso', {});
  assert.equal(outra.ok, false);

  // JID sem o 9º dígito (12 dígitos) acha o cadastro feito com 13
  const st12 = await ext.executar({ empresaId: EMP, phone: '556590004444' }, 'clube_status_acesso', {});
  assert.equal(st12.liberado, true, 'JID sem o nono dígito');

  // número desconhecido: ferramenta de aluno recusa; ver vagas NÃO cria cadastro; interesse cria (uma vez só)
  const desconhecido = await ext.executar({ empresaId: EMP, phone: '65990005555' }, 'clube_status_acesso', {});
  assert.equal(desconhecido.ok, false);
  const amanha = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
  const v = await ext.executar({ empresaId: EMP, phone: '65990005555', customerName: 'Lia Interessada' }, 'clube_listar_vagas', { dia: amanha });
  assert.equal(v.ok, true);
  const contar = async () => (await ctx.db.query("SELECT nome FROM commerce_customers WHERE empresa_id = $1 AND telefone_normalizado = '5565990005555'", [EMP])).rows;
  assert.deepEqual(await contar(), [], 'minimização: consultar vagas não cadastra ninguém');
  for (let i = 0; i < 2; i += 1) {
    await ext.executar({ empresaId: EMP, phone: '556590005555', customerName: 'Lia Interessada' }, 'clube_registrar_interesse', { modalidade: 'funcional' });
  }
  assert.deepEqual((await contar()).map((l) => l.nome), ['Lia Interessada'], 'interesse cria o lead uma vez, com o 9º dígito');

  // mensagem do aluno: pausa a régua e grava o "parar"
  await ext.aoReceber({ empresaId: EMP, phone: '5565990004444', text: 'parar' });
  const ct = (await ctx.db.query('SELECT optout_em FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2', [EMP, aluno])).rows[0];
  assert.ok(ct?.optout_em);
  await ext.aoReceber({ empresaId: EMP, phone: '65 0000', text: 'oi' }); // telefone inválido: ignora sem erro
});

test('rotinas: rodam sem erro e mandam lembretes de contrato', async () => {
  const c = await criarCliente(ctx.db, EMP, 'Paula Rotina', '65990003333');
  await contratos.gerarContrato(ctx.db, EMP, { customerId: c, modeloCodigo: 'matricula' }, { agora: new Date(Date.now() - 2 * 86400000) });
  const antes = whats.length;
  const r = await executarRotinasClube(ctx.db, { enviarWhatsapp: async (m) => { whats.push(m); }, agora: new Date() });
  assert.deepEqual(r.erros, []);
  assert.ok(r.lembretesContrato >= 1);
  assert.ok(whats.slice(antes).some((m) => /Paula/.test(m.texto)));
});

test('página de aceite é servida sem cache e sem vazar o token por Referer', async () => {
  const r = await fetch(`${base}/contrato/qualquer-token-de-teste-123456`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(await r.text(), /Confirme com o código/);
});
});
