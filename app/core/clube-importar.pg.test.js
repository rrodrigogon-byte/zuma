import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import { lerSociosTtc, importarAlunos, pagoAteDasFaturas, somarMeses } from '../modules/clube/importar-legado.js';

const PLANOS_TTC = [
  { id: 'individual', nome: 'Sócio Individual', valor: 120 },
  { id: 'familia', nome: 'Sócio Família', valor: 200 },
];

// Recorte do JSON do TTC (mesmos campos do server.js: socios com faturas, mensalidades, usuarios)
const SNAPSHOT = {
  usuarios: [{ id: 7, nome: 'Ana Tenista', email: 'ana@ttc.com.br', telefone: '(65) 99911-0001' }],
  planosAssinatura: [{ id: 50, nome: 'Mensal Quadra', valor: 90 }],
  socios: [
    { id: 1, usuarioId: 7, nome: 'Ana Tenista', email: 'ana@ttc.com.br', plano: 'individual', planoNome: 'Sócio Individual', valor: 120, desde: '2025-03-02T10:00:00Z',
      faturas: [{ venc: '2026-08-10', status: 'paga' }, { venc: '2026-09-10', status: 'paga' }, { venc: '2026-10-10', status: 'aberta' }] },
    { id: 2, nome: 'Beto Sem Fone', email: 'beto@ttc.com.br', plano: 'familia', planoNome: 'Sócio Família', valor: 200, desde: '2026-01-05T10:00:00Z',
      faturas: [{ venc: '2026-02-10', status: 'aberta' }] },
    { id: 3, nome: 'Caio Quadra', telefone: '65999110003', planoId: 50, desde: '2026-05-01T10:00:00Z', faturas: [] },
    { id: 4, nome: '', email: 'x@x.com' },
  ],
  // o 2º controle de cobrança (mensalidades) também conta como pago
  mensalidades: [{ socioId: 3, vencimento: '2026-10-05', status: 'pago', pagoEm: '2026-10-04' }],
};

test('datas: soma de meses sem transbordar e "pago até" pelas faturas', () => {
  assert.equal(somarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(somarMeses('2026-12-10', 1), '2027-01-10');
  assert.equal(pagoAteDasFaturas([{ venc: '2026-09-10', paga: true }, { venc: '2026-10-10', paga: false }]), '2026-10-09');
  assert.equal(pagoAteDasFaturas([{ venc: '2026-02-10', paga: false }]), '2026-02-09');
  assert.equal(pagoAteDasFaturas([], '2026-05-01T10:00:00Z'), '2026-05-01');
});

test('adaptador do TTC: telefone do usuário vinculado, plano fixo ou de assinatura, mensalidades e avisos', () => {
  const { alunos, avisos } = lerSociosTtc(SNAPSHOT, { planosFixos: PLANOS_TTC });
  assert.equal(alunos.length, 3);
  assert.equal(avisos.length, 1, 'sócio sem nome é ignorado com aviso');
  const [ana, beto, caio] = alunos;
  assert.equal(ana.telefone, '(65) 99911-0001');
  assert.deepEqual(ana.plano, { nome: 'Sócio Individual', valorMensal: 120 });
  assert.equal(ana.pagoAte, '2026-10-09');
  assert.equal(ana.inicio, '2025-03-02');
  assert.match(beto.problemas[0], /sem telefone/);
  assert.equal(beto.pagoAte, '2026-02-09');
  assert.deepEqual(caio.plano, { nome: 'Mensal Quadra', valorMensal: 90 });
  assert.equal(caio.pagoAte, '2026-11-04');
});

describe('clube-importar (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  before(async () => { ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '079_clube_importacoes.sql']); });
  after(async () => { await ctx.fechar(); });
  const agora = new Date('2026-10-18T15:00:00Z');

  test('prévia não grava; aplicar cria planos, cadastros e matrículas; rodar de novo não duplica', async () => {
    const emp = randomUUID();
    const { alunos } = lerSociosTtc(SNAPSHOT, { planosFixos: PLANOS_TTC });
    // a Ana já existe no Commerce (comprou na loja): é reaproveitada pelo telefone
    const anaExistente = await criarCliente(ctx.db, emp, 'Ana T.', '65999110001');

    const previa = await importarAlunos(ctx.db, emp, { origem: 'ttc_socios', alunos, agora });
    assert.equal(previa.aplicado, false);
    assert.deepEqual([previa.resumo.novos, previa.resumo.planosNovos, previa.resumo.inadimplentes, previa.resumo.comProblema], [3, 3, 2, 1], 'Ana (out/10 em aberto) e Beto');
    assert.equal((await ctx.db.query('SELECT count(*)::int n FROM acesso_planos WHERE empresa_id = $1', [emp])).rows[0].n, 0, 'prévia não grava');

    const r = await importarAlunos(ctx.db, emp, { origem: 'ttc_socios', alunos, aplicar: true, agora });
    assert.equal(r.resumo.erros, 0, JSON.stringify(r.alunos.filter((a) => a.erro)));
    assert.equal(r.alunos[0].customerId, anaExistente, 'sem cadastro duplicado');
    const mats = (await ctx.db.query(
      'SELECT c.nome, m.pago_ate::text AS pago_ate, p.nome AS plano, p.valor_mensal FROM acesso_matriculas m JOIN commerce_customers c ON c.id = m.customer_id JOIN acesso_planos p ON p.id = m.plano_id WHERE m.empresa_id = $1 ORDER BY c.nome',
      [emp],
    )).rows;
    assert.deepEqual(mats.map((m) => [m.plano, m.pago_ate]), [['Sócio Individual', '2026-10-09'], ['Sócio Família', '2026-02-09'], ['Mensal Quadra', '2026-11-04']]);
    assert.equal(Number(mats[0].valor_mensal), 120);
    const catraca = (await ctx.db.query('SELECT count(*)::int n FROM acesso_pessoas_equipamento WHERE empresa_id = $1', [emp])).rows[0].n;
    assert.equal(catraca, 3, 'cada aluno ganha número de catraca');

    // de novo, com um pagamento novo da Ana: só estende o pago até
    const alunos2 = alunos.map((a) => (a.idOrigem === '1' ? { ...a, pagoAte: '2026-11-09' } : a));
    const r2 = await importarAlunos(ctx.db, emp, { origem: 'ttc_socios', alunos: alunos2, aplicar: true, agora });
    assert.deepEqual([r2.resumo.novos, r2.resumo.jaImportados, r2.resumo.planosNovos, r2.resumo.erros], [0, 3, 0, 0]);
    assert.equal((await ctx.db.query('SELECT count(*)::int n FROM acesso_matriculas WHERE empresa_id = $1', [emp])).rows[0].n, 3);
    assert.equal((await ctx.db.query('SELECT count(*)::int n FROM commerce_customers WHERE empresa_id = $1', [emp])).rows[0].n, 3);
    const ana = (await ctx.db.query('SELECT pago_ate::text AS d FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2', [emp, anaExistente])).rows[0];
    assert.equal(ana.d, '2026-11-09');
  });

  test('multiempresa: a mesma origem importada em outra empresa fica separada', async () => {
    const a = randomUUID(); const b = randomUUID();
    const { alunos } = lerSociosTtc(SNAPSHOT, { planosFixos: PLANOS_TTC });
    await importarAlunos(ctx.db, a, { origem: 'ttc_socios', alunos, aplicar: true, agora });
    const rb = await importarAlunos(ctx.db, b, { origem: 'ttc_socios', alunos, agora });
    assert.equal(rb.resumo.novos, 3, 'na outra empresa nada foi importado ainda');
    await assert.rejects(importarAlunos(ctx.db, a, { origem: 'TTC; drop', alunos }), { code: 'VALIDATION_ERROR' });
  });
});
