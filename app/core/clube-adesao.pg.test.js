import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import { montarClube } from '../modules/clube/index.js';
import * as cob from '../modules/cobrancas/servico.js';
import * as acesso from '../modules/acesso/repositorio.js';
import * as contratos from '../modules/contratos/servico.js';

describe('clube-adesao (PostgreSQL)', { skip: pgDeTeste }, () => {

let ctx; let server; let base; let empresaAtual;
const whats = [];
const MODELO = {
  codigo: 'associacao', titulo: 'Contrato de associação',
  corpo: 'Contrato entre {{empresa.nome}} e {{aluno.nome}}, assinado por {{signatario.nome}}, plano {{plano.nome}} por R$ {{plano.valor}}. As partes aceitam o aceite eletrônico deste documento.',
  clausulasDestaque: [{ id: 'fid', titulo: 'Fidelidade', texto: 'Plano {{plano.nome}} com 12 meses.' }],
};

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
  const app = express();
  montarClube(app, {
    db: ctx.db,
    empresaDaRequisicao: async () => empresaAtual,
    operadorDaRequisicao: () => 'Recepção 1',
    enviarWhatsapp: async (m) => { whats.push(m); return { ok: true }; },
    urlPublica: 'https://ttc.kytto.com.br',
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await ctx.fechar(); });

const aderir = (body) => fetch(`${base}/api/admin/clube/adesao`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

async function clube({ pix = true, modelo = true } = {}) {
  const emp = randomUUID();
  empresaAtual = emp;
  const plano = await acesso.salvarPlano(ctx.db, emp, { nome: 'Sócio Individual', valorMensal: 120, fidelidadeMeses: 12 });
  if (pix) await cob.salvarConfig(ctx.db, emp, { ativo: true, pixChave: '43.084.070/0001-88', pixNome: 'AGRO OPEN TTC', pixCidade: 'TANGARA DA SERRA' });
  if (modelo) await contratos.salvarModelo(ctx.db, emp, MODELO);
  return { emp, plano };
}

test('sócio novo: cadastro, matrícula, contrato e Pix da 1ª mensalidade no WhatsApp, num passo só', async () => {
  const c = await clube();
  whats.length = 0;
  const r = await aderir({
    aluno: { nome: 'Marcos Tenista', telefone: '(65) 99911-2233', email: 'marcos@ex.com' },
    planoId: c.plano.id, inicio: '2026-10-20', pagamento: 'pix', enviarContrato: true, aceitaNovidades: true, empresaNome: 'AGRO OPEN TTC',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.aluno.criado, true);
  assert.equal(r.body.matricula.pagoAte, '2026-10-19', 'sem pagamento: vale até a véspera; a tolerância dá o prazo do Pix');
  assert.equal(r.body.contrato.enviado, true);
  assert.match(r.body.contrato.link, /^https:\/\/ttc\.kytto\.com\.br\/contrato\//);
  assert.equal(r.body.pix.enviado, true);
  assert.equal(r.body.pix.valor, 120);
  assert.deepEqual(r.body.avisos, []);
  assert.equal(whats.length, 2);
  assert.match(whats[0].texto, /contrato de associação/i);
  assert.match(whats[1].texto, /1ª mensalidade do plano Sócio Individual \(R\$ 120,00\).*\/clube\/pagar\//s);
  const ctr = (await ctx.db.query('SELECT conteudo FROM clube_contratos WHERE empresa_id = $1', [c.emp])).rows[0];
  assert.match(ctr.conteudo, /AGRO OPEN TTC e Marcos Tenista.*Sócio Individual por R\$ 120,00/);
  const cons = (await ctx.db.query('SELECT marketing_evidencia FROM clube_retencao_contatos WHERE empresa_id = $1 AND customer_id = $2', [c.emp, r.body.aluno.id])).rows[0];
  assert.equal(cons.marketing_evidencia.operador, 'Recepção 1');
  const cobr = (await ctx.db.query("SELECT tipo, origem, valor FROM clube_cobrancas WHERE empresa_id = $1", [c.emp])).rows;
  assert.deepEqual(cobr.map((x) => [x.tipo, x.origem, Number(x.valor)]), [['mensalidade', 'recepcao', 120]]);
  const catraca = (await ctx.db.query('SELECT count(*)::int n FROM acesso_pessoas_equipamento WHERE empresa_id = $1', [c.emp])).rows[0].n;
  assert.equal(catraca, 1, 'cadastro enviado à catraca');

  // de novo para a mesma pessoa: matrícula ativa não duplica
  const dup = await aderir({ aluno: { nome: 'Marcos Tenista', telefone: '65999112233' }, planoId: c.plano.id, pagamento: 'depois' });
  assert.equal(dup.status, 409);
});

test('menor de idade: contrato e Pix vão para o responsável, que assina', async () => {
  const c = await clube();
  whats.length = 0;
  const r = await aderir({
    aluno: { nome: 'Pedro Junior' }, menor: true, responsavel: { nome: 'Ana Mãe', telefone: '65998887766' },
    planoId: c.plano.id, pagamento: 'pix', enviarContrato: true, empresaNome: 'AGRO OPEN TTC',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.responsavel.nome, 'Ana Mãe');
  assert.ok(whats.length === 2 && whats.every((m) => String(m.telefone).replace(/\D/g, '').endsWith('65998887766')), `tudo para o WhatsApp do responsável: ${JSON.stringify(whats.map((m) => m.telefone))}`);
  const ctr = (await ctx.db.query('SELECT customer_id, signatario_customer_id FROM clube_contratos WHERE empresa_id = $1', [c.emp])).rows[0];
  assert.equal(ctr.customer_id, r.body.aluno.id);
  assert.equal(ctr.signatario_customer_id, r.body.responsavel.id);
  assert.equal((await aderir({ aluno: { nome: 'Sem Responsavel' }, menor: true, planoId: c.plano.id })).status, 400);
});

test('pago na recepção libera 30 dias; cliente já cadastrado é reaproveitado; sem Pix/modelo o resumo explica', async () => {
  const c = await clube({ pix: false, modelo: false });
  const existente = await criarCliente(ctx.db, c.emp, 'Clara Cadastro', '65990001234');
  whats.length = 0;
  const r = await aderir({ aluno: { customerId: existente }, planoId: c.plano.id, inicio: '2026-10-20', pagamento: 'balcao', enviarContrato: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.aluno.criado, false);
  assert.equal(r.body.matricula.pagoAte, '2026-11-19');
  assert.equal(r.body.pix, null);
  assert.ok(r.body.avisos.some((a) => /modelo de contrato/.test(a)));
  const semPix = await aderir({ aluno: { nome: 'Davi Pix', telefone: '65990004321' }, planoId: c.plano.id, pagamento: 'pix', enviarContrato: false });
  assert.ok(semPix.body.avisos.some((a) => /Pix desligada/.test(a)), JSON.stringify(semPix.body.avisos));
  // outra empresa não usa o plano desta
  empresaAtual = randomUUID();
  assert.equal((await aderir({ aluno: { nome: 'Intruso Teste' }, planoId: c.plano.id })).status, 404);
});

});
