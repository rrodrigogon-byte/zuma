import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeAvecRevenueMix, moneyCents, mixForPeriod, saveAvecMix, loadAvecMix, DINO_MIX_SCOPE } from './avec-revenue-mix.js';
import { buildDinoDashboardAnalytics } from '../dino-dashboard.js';
import { localPostgresFixture } from '../tests/local-postgres-fixture.js';
const headers = ['Data','Comanda','Item','Tipo','Categoria','Profissional','Assistente 1','Assistente 2','Comissão (%)','Cliente','Email','Telefone','Celular','Valor','Desconto','Qtd.','Custo','Comissão','Líquido','UA'];
const row = (type = 'Serviço', value = 180, qty = 2, day = '01/09/2026') => [day, 123, `Item ${type}`, type, 'Categoria', 'Profissional privado','','',50,'Cliente privado','privado@fixture.invalid','',123,value,10,qty,20,50,20,''];
const report = (...rows) => ({ headers, rows });
test('0186 usa total da linha menos desconto, nunca líquido nem quantidade, e remove dados pessoais', () => {
  const snapshot = normalizeAvecRevenueMix(report(row()));
  assert.equal(snapshot.summary.includedCents, 17000);
  assert.equal(snapshot.rows[0].quantity, 2);
  assert.equal(JSON.stringify(snapshot).includes('privado'), false);
  assert.equal(moneyCents('1.234,56'), 123456);
  assert.throws(() => moneyCents('1,2.3'));
  assert.throws(() => normalizeAvecRevenueMix(report(row('Produto', 100, 1, '31/02/2026'))));
  assert.throws(() => normalizeAvecRevenueMix({ headers: ['Data'], rows: [] }));
});
test('repetições são todas retidas e anomalias não viram receita', () => {
  const invalid = row('Produto', 5, 0);
  const snapshot = normalizeAvecRevenueMix(report(row(),row(),invalid,row('desconhecido')));
  assert.equal(snapshot.summary.includedRows, 0);
  assert.equal(snapshot.summary.heldRows, 4);
  assert.equal(snapshot.summary.duplicateRows, 2);
  assert.equal(snapshot.summary.invalidRows, 1);
  assert.equal(snapshot.summary.unknownTypeRows, 1);
  assert.equal(snapshot.summary.sourceCents, snapshot.summary.heldCents);
});
test('mix histórico substitui sobreposição operacional, inclui pacotes na unidade e mantém caixa intacto', () => {
  const historicalMix = normalizeAvecRevenueMix(report(row(), row('Produto', 60), row('Pacote', 200), row('caixinha', 12)));
  const input = { subscriptionPaymentsAvailable: false, commands: [{status:'paga', atualizadoEm:'2026-09-01T16:00:00Z',total:170,itens:[{tipo:'servico',nome:'Item Serviço',subtotal:170}]}], historicalAppointments: [{dataAgenda:'2026-09-01',total:99999}], financeEntries:[] };
  const before = buildDinoDashboardAnalytics(input,{period:1,now:new Date('2026-09-01T18:00:00Z')});
  const after = buildDinoDashboardAnalytics({...input,historicalMix},{period:1,now:new Date('2026-09-01T18:00:00Z')});
  assert.equal(after.strategicMix.total,412);
  assert.equal(after.strategicMix.items.find(x=>x.id==='plans').available,true);
  assert.equal(after.strategicMix.historical.details.length,4);
  assert.deepEqual(after.kpis,before.kpis);
  assert.equal(mixForPeriod(historicalMix,'2026-09-02','2026-09-03').length,0);
  const nextDay = buildDinoDashboardAnalytics({...input,historicalMix,commands:[{status:'paga',atualizadoEm:'2026-09-02T16:00:00Z',itens:[{tipo:'produto',subtotal:50}]}]},{period:7,now:new Date('2026-09-02T18:00:00Z')});
  assert.equal(nextDay.strategicMix.total,462);
});
test('PostgreSQL: replay, concorrência, troca atômica, isolamento e versões para recuperação', async () => {
  const fixture = await localPostgresFixture();
  try {
    const a=await fixture.connect(), b=await fixture.connect();
    await a.query(fs.readFileSync(new URL('../migrations/104_avec_revenue_mix.sql',import.meta.url),'utf8'));
    const snapshot=normalizeAvecRevenueMix(report(row()));
    const args={...DINO_MIX_SCOPE,expectedPreviousHash:null,expectedReportHash:snapshot.reportHash};
    assert.equal(await loadAvecMix(a,args.empresaId,args.lojaId),null);
    const results=await Promise.all([saveAvecMix(a,snapshot,args),saveAvecMix(b,snapshot,args)]);
    assert.equal(results.filter(x=>x.changed).length,1);
    assert.equal((await loadAvecMix(a,args.empresaId,args.lojaId)).summary.includedCents,17000);
    assert.equal(await loadAvecMix(a,'outra',args.lojaId),null);
    await assert.rejects(saveAvecMix(a,snapshot,{...args,lojaId:'outra'}));
    const next=normalizeAvecRevenueMix(report(row('Produto')));
    await assert.rejects(saveAvecMix(a,next,{...args,expectedReportHash:next.reportHash}),{code:'AVEC_MIX_CONFLICT'});
    assert.equal((await loadAvecMix(a,args.empresaId,args.lojaId)).reportHash,snapshot.reportHash);
    await saveAvecMix(a,next,{...args,expectedPreviousHash:snapshot.reportHash,expectedReportHash:next.reportHash});
    assert.equal((await a.query('SELECT count(*)::int AS n FROM kytto_avec_revenue_mix')).rows[0].n,1);
    assert.equal((await a.query('SELECT count(*)::int AS n FROM kytto_avec_revenue_mix_versions')).rows[0].n,2);
  } finally {await fixture.close();}
});

test('relatório cobre mais de um ano e preserva todas as categorias sem limite do BI geral', () => {
  const snapshot = normalizeAvecRevenueMix(report(row('Serviço',100,1,'05/06/2025'),row('Produto',60,2,'23/10/2026'),row('Pacote',200,1,'01/09/2026')));
  const all = mixForPeriod(snapshot,'2025-06-05','2026-10-24');
  assert.equal(all.reduce((sum,row)=>sum+row.value,0),330);
  assert.equal(all.length,3);
  assert.equal(mixForPeriod(snapshot,'2026-10-23','2026-10-24')[0].value,50);
  assert.equal(mixForPeriod(snapshot,'2025-06-06','2026-10-23').length,1);
});
