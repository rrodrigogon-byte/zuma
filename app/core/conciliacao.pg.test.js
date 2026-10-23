import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as razao from '../modules/razao/servico.js';
import * as conc from '../modules/razao/conciliacao.js';
import { lerOfx, decodificarOfx } from '../modules/razao/ofx.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');

// OFX 1.x (SGML, sem fechar tags) em Windows-1252, como os bancos brasileiros exportam.
function ofx(linhas, { conta = '12345-6', saldo = '1000.00' } = {}) {
  const trn = linhas.map((l) => `<STMTTRN>\r\n<TRNTYPE>${l.tipo || (l.valor > 0 ? 'CREDIT' : 'DEBIT')}\r\n<DTPOSTED>${l.data.replace(/-/g, '')}120000[-3:BRT]\r\n<TRNAMT>${l.valor.toFixed(2)}\r\n<FITID>${l.fitid}\r\n<MEMO>${l.memo}\r\n</STMTTRN>`).join('\r\n');
  const texto = `OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102\r\nENCODING:USASCII\r\nCHARSET:1252\r\n\r\n<OFX>\r\n<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\r\n<BANKACCTFROM>\r\n<BANKID>0001\r\n<BRANCHID>1234\r\n<ACCTID>${conta}\r\n</BANKACCTFROM>\r\n<BANKTRANLIST>\r\n<DTSTART>20261001\r\n<DTEND>20261031\r\n${trn}\r\n</BANKTRANLIST>\r\n<LEDGERBAL>\r\n<BALAMT>${saldo}\r\n<DTASOF>20261031\r\n</LEDGERBAL>\r\n</STMTRS></STMTTRNRS></BANKMSGSRSV1>\r\n</OFX>`;
  return Buffer.from(texto, 'latin1').toString('base64');
}

describe('Conciliação bancária (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID(); const B = randomUUID();
  const agora = new Date('2026-10-31T15:00:00-04:00');
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query('CREATE TABLE empresas (id UUID PRIMARY KEY); CREATE TABLE lojas (id UUID PRIMARY KEY, empresa_id UUID NOT NULL);');
    for (const m of ['090_financeiro_razao.sql', '093_conciliacao_bancaria.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
  });
  after(async () => { await ctx?.fechar(); });

  test('leitura do OFX: 1252, datas, valores com sinal e conta', () => {
    const r = lerOfx(decodificarOfx(Buffer.from(ofx([{ fitid: 'X1', data: '2026-10-05', valor: -12.5, memo: 'TARIFA MANUTENÇÃO' }]), 'base64')));
    assert.equal(r.conta, '12345-6');
    assert.equal(r.banco, '0001');
    assert.equal(r.saldoFinal, 1000);
    assert.deepEqual(r.transacoes.map((t) => [t.fitid, t.data, t.valor]), [['X1', '2026-10-05', -12.5]]);
    assert.match(r.transacoes[0].descricao, /MANUTENÇÃO/);
    assert.throws(() => lerOfx('isto não é ofx'), (e) => e.code === 'OFX_INVALIDO');
  });

  test('Pix recebido baixa a conta a receber; pagamento casa com o pago; ambíguo fica para conferir; reimportar não duplica', async () => {
    const [fiado] = await razao.criarManual(ctx.db, A, { tipo: 'receita', categoria: 'Contas de clientes', descricao: 'Fiado mesa 4', valor: 90, vencimento: '2026-10-20', contraparteNome: 'Maria Souza' }, { agora });
    const [luz] = await razao.criarManual(ctx.db, A, { tipo: 'despesa', categoria: 'Energia, água e internet', descricao: 'Energia', valor: 300, status: 'pago', vencimento: '2026-10-10', pagoEm: '2026-10-10' }, { agora });
    await razao.criarManual(ctx.db, A, { tipo: 'receita', descricao: 'Aula avulsa 1', valor: 50, vencimento: '2026-10-15' }, { agora });
    await razao.criarManual(ctx.db, A, { tipo: 'receita', descricao: 'Aula avulsa 2', valor: 50, vencimento: '2026-10-16' }, { agora });
    const arquivo = ofx([
      { fitid: 'P1', data: '2026-10-21', valor: 90, memo: 'PIX RECEBIDO MARIA SOUZA', tipo: 'CREDIT' },
      { fitid: 'D1', data: '2026-10-11', valor: -300, memo: 'PAGTO CONTA ENERGIA' },
      { fitid: 'P2', data: '2026-10-15', valor: 50, memo: 'PIX RECEBIDO' },
      { fitid: 'T1', data: '2026-10-31', valor: -12.5, memo: 'TARIFA PACOTE' },
    ]);
    const imp = await conc.importarOfx(ctx.db, A, { arquivoBase64: arquivo, nomeArquivo: 'extrato.ofx' }, { usuario: 'financeiro' });
    assert.equal(imp.novas, 4);
    assert.equal(imp.automatico.conciliadas, 2);
    assert.equal(imp.automatico.baixas, 1);
    const pago = await razao.obter(ctx.db, A, fiado.id);
    assert.equal(pago.status, 'pago');
    assert.equal(pago.meioPagamento, 'pix');
    assert.equal(razao.hojeNoFuso(new Date(pago.pagoEm)), '2026-10-21');
    const linhas = await conc.listarLinhas(ctx.db, A);
    assert.deepEqual(linhas.map((l) => l.fitid).sort(), ['P2', 'T1']);
    assert.equal(linhas.find((l) => l.fitid === 'P2').sugestoes.length, 2, 'duas aulas de 50: conferir à mão');
    const de2 = await conc.importarOfx(ctx.db, A, { arquivoBase64: arquivo }, { usuario: 'financeiro' });
    assert.equal(de2.novas, 0);
    assert.equal((await conc.listarLinhas(ctx.db, A, { status: 'conciliado' })).find((l) => l.fitid === 'D1').lancamentoId, luz.id);
  });

  test('conciliar à mão, criar lançamento da tarifa, ignorar, desfazer e isolamento', async () => {
    const pend = await conc.listarLinhas(ctx.db, A);
    const p2 = pend.find((l) => l.fitid === 'P2');
    const t1 = pend.find((l) => l.fitid === 'T1');
    await assert.rejects(() => conc.conciliar(ctx.db, B, p2.id, p2.sugestoes[0].lancamento.id), (e) => e.status === 404);
    const luz = (await razao.listar(ctx.db, A, { q: 'Energia' }))[0];
    await assert.rejects(() => conc.conciliar(ctx.db, A, p2.id, luz.id), (e) => e.code === 'VALUE_MISMATCH');
    const ok = await conc.conciliar(ctx.db, A, p2.id, p2.sugestoes[0].lancamento.id, { usuario: 'financeiro' });
    assert.equal(ok.baixado, true);
    await assert.rejects(() => conc.conciliar(ctx.db, A, p2.id, p2.sugestoes[1].lancamento.id), (e) => e.code === 'ALREADY_RECONCILED');
    const tarifa = await conc.criarLancamentoDaLinha(ctx.db, A, t1.id, { categoria: 'Juros e tarifas bancárias' }, { usuario: 'financeiro' });
    assert.equal(tarifa.lancamento.tipo, 'despesa');
    assert.equal(tarifa.lancamento.valor, 12.5);
    assert.equal(tarifa.lancamento.status, 'pago');
    const volta = await conc.desfazer(ctx.db, A, t1.id);
    assert.equal(volta.status, 'pendente');
    assert.equal((await conc.ignorarLinha(ctx.db, A, t1.id, { usuario: 'financeiro' })).status, 'ignorado');
    const contas = await conc.resumoContas(ctx.db, A);
    assert.equal(contas[0].saldoBanco, 1000);
    assert.equal(contas[0].pendentes, 0);
    assert.equal((await conc.resumoContas(ctx.db, B)).length, 0);
  });

  test('dia fechado: a baixa automática não acontece e a linha fica para conferir', async () => {
    const [conta] = await razao.criarManual(ctx.db, A, { tipo: 'receita', descricao: 'Mensalidade João Lima', valor: 77, vencimento: '2026-10-25', contraparteNome: 'João Lima' }, { agora });
    await razao.fecharDia(ctx.db, A, { data: '2026-10-26', responsavel: 'Caixa', agora });
    const imp = await conc.importarOfx(ctx.db, A, { arquivoBase64: ofx([{ fitid: 'P9', data: '2026-10-26', valor: 77, memo: 'PIX JOAO LIMA' }], { saldo: '1077.00' }) });
    assert.equal(imp.automatico.conciliadas, 0);
    assert.equal(imp.automatico.paraConferir, 1);
    assert.equal((await razao.obter(ctx.db, A, conta.id)).status, 'pendente');
  });
});
