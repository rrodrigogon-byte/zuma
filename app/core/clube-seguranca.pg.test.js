// Testes de regressão dos achados da revisão de segurança: cada teste reproduz o ataque/defeito
// encontrado e garante que a correção continua de pé.
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as contratos from '../modules/contratos/servico.js';
import * as acesso from '../modules/acesso/repositorio.js';
import * as aulas from '../modules/aulas/servico.js';
import { executarFerramentaClube } from '../modules/clube/ferramentas-ia.js';
import { cicloRotinasClube, limparDadosAntigos, criarDisparadorDeAcoes } from '../modules/clube/index.js';
import { ACOES } from '../modules/acesso/regras.js';

describe('clube-seguranca (PostgreSQL)', { skip: pgDeTeste }, () => {

const EMP = randomUUID();
let ctx;

const CORPO = `CONTRATO {{empresa.nome}} — aluno {{aluno.nome}}.
As partes aceitam o aceite eletrônico deste contrato, nos termos do art. 10, §2º, da MP 2.200-2/2001.`;
const DESTAQUES = [{ id: 'multa', titulo: 'Multa', texto: 'Multa de 10%.' }];

before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql']);
  await contratos.salvarModelo(ctx.db, EMP, { codigo: 'matricula', titulo: 'Matrícula', corpo: CORPO, clausulasDestaque: DESTAQUES });
});
after(async () => { await ctx.fechar(); });

async function novoContrato(nome = 'Carla Dias') {
  const customerId = await criarCliente(ctx.db, EMP, nome);
  const g = await contratos.gerarContrato(ctx.db, EMP, { customerId, modeloCodigo: 'matricula', variaveis: { empresa: { nome: 'Academia' } } });
  return { ...g, customerId };
}

async function aceitar(c) {
  const { codigo } = await contratos.solicitarCodigo(ctx.db, c.token, {});
  return contratos.aceitarContrato(ctx.db, c.token, { codigo, clausulasMarcadas: ['multa'], ip: '10.0.0.1' });
}

/* C1 ---------------------------------------------------------------- */
test('C1: código guardado como HMAC (não dá para achar por força bruta no banco) e evidências sem colunas sensíveis', async () => {
  const c = await novoContrato();
  const { codigo } = await contratos.solicitarCodigo(ctx.db, c.token, {});
  const row = (await ctx.db.query('SELECT codigo_hash FROM clube_contratos WHERE id = $1', [c.contratoId])).rows[0];
  assert.notEqual(row.codigo_hash, createHash('sha256').update(codigo).digest('hex'));
  assert.notEqual(row.codigo_hash, createHash('sha256').update(`${c.contratoId}:${codigo}`).digest('hex'));
  const ev = await contratos.evidenciasDoContrato(ctx.db, EMP, c.contratoId);
  for (const campo of ['codigo_hash', 'token_hash', 'codigo_expira_em']) assert.ok(!(campo in ev.contrato), `${campo} não pode sair na resposta`);
});

test('C1: sem CLUBE_CONTRATO_SECRET o código não é emitido', async () => {
  const c = await novoContrato('Sem Segredo');
  const antes = process.env.CLUBE_CONTRATO_SECRET;
  process.env.CLUBE_CONTRATO_SECRET = 'curto';
  try {
    await assert.rejects(contratos.solicitarCodigo(ctx.db, c.token, {}), { code: 'CONTRATO_SEGREDO_AUSENTE' });
  } finally { process.env.CLUBE_CONTRATO_SECRET = antes; }
});

/* C2 ---------------------------------------------------------------- */
test('C2: adulterar o texto de um contrato aceito (mesmo desligando os gatilhos) é detectado na verificação', async () => {
  const c = await novoContrato('Adulterado');
  const ok = await aceitar(c);
  assert.equal((await contratos.verificarPorHash(ctx.db, ok.hashEvidencias)).valido, true);
  await assert.rejects(ctx.db.query("UPDATE clube_contratos SET status = 'cancelado' WHERE id = $1", [c.contratoId]));
  await assert.rejects(ctx.db.query('DELETE FROM clube_contratos WHERE id = $1', [c.contratoId]));
  // atacante com acesso de dono do banco: desliga os gatilhos e reescreve o texto
  await ctx.db.query('ALTER TABLE clube_contratos DISABLE TRIGGER USER');
  await ctx.db.query("UPDATE clube_contratos SET conteudo = conteudo || ' Multa de 90%.' WHERE id = $1", [c.contratoId]);
  await ctx.db.query('ALTER TABLE clube_contratos ENABLE TRIGGER USER');
  const v = await contratos.verificarPorHash(ctx.db, ok.hashEvidencias);
  assert.equal(v.valido, false);
  assert.equal(v.checagens.conteudo, false);
});

/* M6 ---------------------------------------------------------------- */
test('M6: catraca com contrato pendente avisa o responsável (quem assina), sem trocar o link recém-enviado', async () => {
  const menor = await criarCliente(ctx.db, EMP, 'Pedro Menor', '65990000001');
  const mae = await criarCliente(ctx.db, EMP, 'Joana Mãe', '65990000002');
  const g = await contratos.gerarContrato(ctx.db, EMP, { customerId: menor, signatarioCustomerId: mae, modeloCodigo: 'matricula', variaveis: { empresa: { nome: 'Academia' } } });
  const enviados = [];
  const disparar = criarDisparadorDeAcoes({ db: ctx.db, urlPublica: 'https://a.kytto.com.br', enviarWhatsapp: async (m) => { enviados.push(m); } });
  await disparar({ acao: ACOES.REENVIAR_CONTRATO, empresaId: EMP, customerId: menor });
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].telefone, '65990000002');
  assert.equal(enviados[0].customerId, mae);
  assert.match(enviados[0].texto, /Joana.*contrato de Pedro/);
  assert.ok(!enviados[0].texto.includes('/contrato/'), 'link recém-enviado continua valendo: não manda outro');
  // o link original continua funcionando
  assert.equal((await contratos.abrirContrato(ctx.db, g.token, {})).status, 'enviado');
});

/* A1 ---------------------------------------------------------------- */
test('A1: evidências gravadas em paralelo mantêm a cadeia íntegra (sem bifurcação)', async () => {
  const c = await novoContrato('Paralelo');
  await Promise.all(Array.from({ length: 12 }, (_, i) => contratos.abrirContrato(ctx.db, c.token, { ip: `10.0.0.${i}` })));
  const cadeia = await contratos.verificarCadeia(ctx.db, c.contratoId);
  assert.equal(cadeia.integra, true);
  const n = await ctx.db.query('SELECT COUNT(*)::int AS n FROM clube_contrato_eventos WHERE contrato_id = $1', [c.contratoId]);
  assert.equal(n.rows[0].n, 13, 'gerado + 12 aberturas');
});

/* A2 ---------------------------------------------------------------- */
test('A2: tentativas erradas em paralelo não furam o limite de 5 por código', async () => {
  const c = await novoContrato('Força Bruta');
  const { codigo } = await contratos.solicitarCodigo(ctx.db, c.token, {});
  const errados = Array.from({ length: 20 }, (_, i) => String((Number(codigo) + 1 + i) % 1000000).padStart(6, '0'));
  const r = await Promise.allSettled(errados.map((x) => contratos.aceitarContrato(ctx.db, c.token, { codigo: x, clausulasMarcadas: ['multa'] })));
  const codigos = r.map((x) => x.reason?.code);
  assert.equal(codigos.filter((x) => x === 'CODIGO_INVALIDO').length, 5);
  assert.equal(codigos.filter((x) => x === 'CODIGO_BLOQUEADO').length, 15);
  const row = (await ctx.db.query('SELECT codigo_tentativas, erros_codigo_total FROM clube_contratos WHERE id = $1', [c.contratoId])).rows[0];
  assert.equal(row.codigo_tentativas, 5);
  assert.equal(row.erros_codigo_total, 5);
  // o código certo também fica bloqueado: precisa pedir outro
  await assert.rejects(contratos.aceitarContrato(ctx.db, c.token, { codigo, clausulasMarcadas: ['multa'] }), { code: 'CODIGO_BLOQUEADO' });
});

/* A3/A4 ------------------------------------------------------------- */
test('A3/A4: comando mais novo da mesma pessoa supera o antigo já enviado; reenvio nunca manda o velho', async () => {
  const { dispositivo } = await acesso.criarDispositivo(ctx.db, EMP, { nome: `Catraca ${randomUUID().slice(0, 4)}` });
  await acesso.reservarComandos(ctx.db, dispositivo.id, 'limpa');
  await acesso.enfileirarComando(ctx.db, { empresaId: EMP, dispositivoId: dispositivo.id, chave: 'pessoa:7', comando: { versao: 1 } });
  const l1 = await acesso.reservarComandos(ctx.db, dispositivo.id, 'l1');
  assert.deepEqual(l1.map((x) => x.comando.versao), [1]);
  await acesso.enfileirarComando(ctx.db, { empresaId: EMP, dispositivoId: dispositivo.id, chave: 'pessoa:7', comando: { versao: 2 } });
  await ctx.db.query("UPDATE acesso_fila_push SET enviado_em = CURRENT_TIMESTAMP - interval '10 minutes' WHERE push_uuid = 'l1'");
  const l2 = await acesso.reservarComandos(ctx.db, dispositivo.id, 'l2');
  assert.deepEqual(l2.map((x) => x.comando.versao), [2], 'só a versão nova vai para o aparelho');
  // resposta atrasada do lote antigo não marca a versão nova como concluída
  await acesso.concluirComandos(ctx.db, dispositivo.id, 'l1', [{ transactionid: 1, sucesso: true }]);
  const viva = await ctx.db.query("SELECT status FROM acesso_fila_push WHERE dispositivo_id = $1 AND comando->>'versao' = '2'", [dispositivo.id]);
  assert.equal(viva.rows[0].status, 'enviado');
});

/* M3 + A7 ----------------------------------------------------------- */
const AGORA = new Date('2026-10-21T14:00:00Z'); // quarta, 10:00 em Cuiabá
let plano;
async function aluno(nome) {
  plano ||= acesso.salvarPlano(ctx.db, EMP, { nome: 'Aulas' });
  const { id: planoId } = await plano;
  const id = await criarCliente(ctx.db, EMP, nome);
  await acesso.criarMatricula(ctx.db, EMP, { customerId: id, planoId, pagoAte: '2026-12-31' });
  return id;
}
async function aulaCom(capacidade) {
  const nome = `Pilates ${randomUUID().slice(0, 6)}`;
  const m = await aulas.salvarModalidade(ctx.db, EMP, { nome });
  await aulas.salvarTurma(ctx.db, EMP, {
    modalidadeId: m.id, nome, diasSemana: [3], horaInicio: '19:00', duracaoMin: 50, capacidade, vigenciaInicio: '2026-10-01',
  });
  await aulas.gerarOcorrencias(ctx.db, EMP, { de: '2026-10-21', ate: '2026-10-21' });
  const g = await aulas.listarGrade(ctx.db, EMP, { de: '2026-10-21T00:00:00Z', ate: '2026-10-22T06:00:00Z' });
  return g.find((x) => x.turma === nome);
}

test('M3: duas vagas abertas chamam dois da fila; a vaga oferecida fica guardada; com vaga livre não entra na fila', async () => {
  const aula = await aulaCom(2);
  const [d1, d2, f1, f2, f3, intruso] = await Promise.all(['D1', 'D2', 'F1', 'F2', 'F3', 'Intruso'].map((n) => aluno(`Aluno ${n}`)));
  const r1 = await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: d1, agora: AGORA });
  await assert.rejects(aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f1, agora: AGORA }), { code: 'VAGA_DISPONIVEL' });
  const r2 = await aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: d2, agora: AGORA });
  for (const f of [f1, f2, f3]) await aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f, agora: AGORA });

  const c1 = await aulas.cancelarReserva(ctx.db, EMP, { reservaId: r1.reservaId, agora: AGORA });
  assert.deepEqual(c1.avisos.map((a) => a.customerId), [f1]);
  const c2 = await aulas.cancelarReserva(ctx.db, EMP, { reservaId: r2.reservaId, agora: AGORA });
  assert.deepEqual(c2.avisos.map((a) => a.customerId), [f2], 'segunda vaga chama o segundo, não repete o primeiro');

  // quem não está na fila não pega a vaga guardada para os chamados
  await assert.rejects(aulas.reservar(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: intruso, agora: AGORA }), { code: 'LOTADA' });
  assert.equal((await aulas.responderFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f1, aceitar: true, agora: AGORA })).reservado, true);
  assert.equal((await aulas.responderFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: f2, aceitar: true, agora: AGORA })).reservado, true);
  const lotacao = await ctx.db.query("SELECT COUNT(*)::int AS n FROM aulas_reservas WHERE ocorrencia_id = $1 AND status = 'reservada'", [aula.id]);
  assert.equal(lotacao.rows[0].n, 2);
});

test('A7: a IA não recebe nome nem texto de outros alunos; os avisos vão direto pelo WhatsApp', async () => {
  const aula = await aulaCom(1);
  const [dono, esperando] = await Promise.all([aluno('Dono IA'), aluno('Esperando IA')]);
  const conversa = { empresaId: EMP, customerId: dono };
  const reserva = await executarFerramentaClube(ctx.db, conversa, 'clube_reservar_aula', { ocorrencia_id: aula.id }, { agora: AGORA });
  await aulas.entrarNaFila(ctx.db, EMP, { ocorrenciaId: aula.id, customerId: esperando, agora: AGORA });
  const enviados = [];
  const r = await executarFerramentaClube(ctx.db, conversa, 'clube_cancelar_reserva', { reserva_id: reserva.reserva_id }, {
    agora: AGORA, enviarAvisos: async (a) => { enviados.push(...a); },
  });
  assert.deepEqual(Object.keys(r).sort(), ['ok', 'tardio']);
  assert.ok(!JSON.stringify(r).includes('Esperando'));
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].customerId, esperando);
});

test('limite de reservas futuras resiste a pedidos simultâneos em aulas diferentes', async () => {
  const nome = `Limite ${randomUUID().slice(0, 6)}`;
  const m = await aulas.salvarModalidade(ctx.db, EMP, { nome, limiteReservasFuturas: 1 });
  await aulas.salvarTurma(ctx.db, EMP, { modalidadeId: m.id, nome, diasSemana: [4, 5, 6], horaInicio: '07:00', duracaoMin: 50, capacidade: 10, vigenciaInicio: '2026-10-01' });
  await aulas.gerarOcorrencias(ctx.db, EMP, { de: '2026-10-22', ate: '2026-10-24' });
  const g = (await aulas.listarGrade(ctx.db, EMP, { de: '2026-10-22T00:00:00Z', ate: '2026-10-25T06:00:00Z' })).filter((x) => x.turma === nome);
  assert.equal(g.length, 3);
  const quem = await aluno('Apressado');
  const r = await Promise.allSettled(g.map((o) => aulas.reservar(ctx.db, EMP, { ocorrenciaId: o.id, customerId: quem, agora: AGORA })));
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
});

/* A5 ---------------------------------------------------------------- */
test('A5: rotinas não rodam em paralelo e a trava não fica presa no pool', async () => {
  const outro = await ctx.db.beginTransaction();
  await ctx.db.queryInTransaction(outro, 'SELECT pg_advisory_xact_lock(825410801)');
  assert.equal(await cicloRotinasClube(ctx.db, { gerarGrade: false }), null, 'outra instância rodando: pula');
  await ctx.db.rollback(outro);
  const r = await cicloRotinasClube(ctx.db, { gerarGrade: false });
  assert.ok(r && Array.isArray(r.erros));
  assert.deepEqual(r.erros, []);
  // depois do ciclo nenhuma conexão segura a trava
  const presa = await ctx.db.query("SELECT COUNT(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = 825410801");
  assert.equal(presa.rows[0].n, 0);
});

test('LGPD: fila Push concluída é apagada após 7 dias', async () => {
  const { dispositivo } = await acesso.criarDispositivo(ctx.db, EMP, { nome: `Velha ${randomUUID().slice(0, 4)}` });
  await acesso.enfileirarComando(ctx.db, { empresaId: EMP, dispositivoId: dispositivo.id, chave: 'velho', comando: { nome: 'Fulano' } });
  await ctx.db.query("UPDATE acesso_fila_push SET status = 'ok', criado_em = CURRENT_TIMESTAMP - interval '8 days' WHERE chave = 'velho'");
  assert.ok(await limparDadosAntigos(ctx.db) >= 1);
  assert.equal((await ctx.db.query("SELECT 1 FROM acesso_fila_push WHERE chave = 'velho'")).rowCount, 0);
});

});
