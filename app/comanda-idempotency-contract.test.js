import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('Fixture de comanda proibida em production');
const dir = mkdtempSync(join(tmpdir(), 'dino-comanda-replay-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = join(dir, 'db.json');
process.env.GCS_BUCKET = '';
const erp = await import('./barbearia-erp-kytto.js');
const caixa = await import('./caixa-diario-kytto.js');
const { db, reset, save } = await import('./db.js');
const empresa = 'comanda-fixture.invalid';
const loja = 'unidade-fixture.invalid';
beforeEach(() => reset());
after(() => { reset(); rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const servico = erp.criarServico(empresa, { nome: 'Serviço fixture', preco: 50, duracaoMinutos: 30 });
  const produto = erp.criarProdutoRevenda(empresa, { nome: 'Produto fixture', sku: 'FIXTURE-INVALID', precoVenda: 30, estoqueAtual: 2 });
  const comanda = erp.criarComandaBarbearia(empresa, { lojaId: loja, itens: [{ tipo: 'servico', servicoId: servico.id }, { tipo: 'produto', produtoId: produto.id, quantidade: 1 }] });
  return { comanda, produto };
}
const receive = (comanda, body) => erp.registrarPagamentoComandaBarbearia(empresa, comanda.id, { confirmado: true, ...body });
const snapshot = () => JSON.stringify(db());
function rejectWithoutEffects(comanda, body) {
  const before = snapshot();
  assert.throws(() => receive(comanda, body), error => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.equal(snapshot(), before);
}

test('mesma chave rejeita payload divergente antes e depois da quitação sem novo ledger/estoque', () => {
  const { comanda } = fixture();
  const partial = { chaveIdempotencia: 'fixture-partial', pagamentos: [{ meio: 'pix', valor: 20 }] };
  receive(comanda, partial);
  for (const payments of [[{ meio: 'pix', valor: 21 }], [{ meio: 'cartao', valor: 20 }]]) rejectWithoutEffects(comanda, { ...partial, pagamentos: payments });
  rejectWithoutEffects(comanda, { ...partial, clienteId: 'other-fixture.invalid' });
  rejectWithoutEffects(comanda, { ...partial, lojaId: 'other-unit.invalid' });
  rejectWithoutEffects(comanda, { ...partial, dataVencimento: '2030-01-01' });
  const final = { chaveIdempotencia: 'fixture-final', pagamentos: [{ meio: 'pix', valor: 60 }] };
  receive(comanda, final);
  rejectWithoutEffects(comanda, { ...final, pagamentos: [{ meio: 'pix', valor: 59 }] });
  const before = snapshot();
  assert.equal(receive(comanda, final).idempotente, true);
  assert.equal(snapshot(), before);
});

test('replay não depende de caixa ainda aberto nem do novo caixa automático', () => {
  const { comanda } = fixture();
  const opened = caixa.abrirCaixa(empresa, { lojaId: loja, valorAbertura: 0, numeroCaixa: 1 });
  const body = { chaveIdempotencia: 'fixture-cash', pagamentos: [{ meio: 'dinheiro', valor: 80 }] };
  receive(comanda, body);
  caixa.fecharCaixa(empresa, { caixaId: opened.id, lojaId: loja, valorInformado: 80 });
  const next = caixa.abrirCaixa(empresa, { lojaId: loja, valorAbertura: 0, numeroCaixa: 2 });
  const before = snapshot();
  assert.equal(receive(comanda, body).idempotente, true);
  assert.equal(snapshot(), before);
  rejectWithoutEffects(comanda, { ...body, pagamentos: [{ meio: 'dinheiro', valor: 80, caixaId: next.id }] });
});

test('lote legado misto sem fingerprint reutiliza todos os pagamentos e não só o primeiro', () => {
  const { comanda } = fixture();
  const body = { chaveIdempotencia: 'fixture-legacy-mixed', pagamentos: [{ meio: 'pix', valor: 10 }, { meio: 'cartao', valor: 10 }] };
  receive(comanda, body);
  const persisted = db().barbearias[empresa].comandas[comanda.id];
  for (const payment of persisted.pagamentos) { delete payment.idempotenciaFingerprint; delete payment.idempotenciaBatchKey; }
  save();
  const before = snapshot();
  assert.equal(receive(comanda, body).idempotente, true);
  assert.equal(snapshot(), before);
  rejectWithoutEffects(comanda, { ...body, pagamentos: [{ meio: 'pix', valor: 11 }, { meio: 'cartao', valor: 9 }] });
});

test('novo lote com identificador individual já usado é bloqueado antes de somar faturamento', () => {
  const { comanda } = fixture();
  const body = { chaveIdempotencia: 'fixture-batch1', pagamentos: [{ id: 'fixture-payment1', chaveIdempotencia: 'fixture-individual1', meio: 'pix', valor: 20 }] };
  receive(comanda, body);
  const before = snapshot();
  assert.equal(receive(comanda, body).idempotente, true);
  assert.equal(snapshot(), before);
  rejectWithoutEffects(comanda, { ...body, chaveIdempotencia: 'fixture-batch2' });
  rejectWithoutEffects(comanda, { chaveIdempotencia: 'fixture-batch3', pagamentos: [{ id: 'fixture-payment1', meio: 'pix', valor: 20 }] });
  rejectWithoutEffects(comanda, { chaveIdempotencia: 'fixture-batch4', pagamentos: [{ meio: 'pix', valor: 20, chaveIdempotencia: 'fixture-individual1' }] });
});

test('identificador duplicado dentro do lote não causa dois lançamentos nem dois pagamentos', () => {
  const { comanda } = fixture();
  rejectWithoutEffects(comanda, { chaveIdempotencia: 'fixture-duplicate', pagamentos: [{ id: 'same-fixture', meio: 'pix', valor: 10 }, { id: 'same-fixture', meio: 'pix', valor: 10 }] });
});

test('fingerprint parcial, lote incompleto e conteúdo persistido divergente falham fechado sem efeitos', () => {
  for (const corruption of ['partial-hash', 'missing-item', 'changed-value', 'conflicting-hash']) {
    reset();
    const { comanda } = fixture();
    const body = { chaveIdempotencia: 'fixture-corruption', pagamentos: [{ meio: 'pix', valor: 10 }, { meio: 'cartao', valor: 10 }] };
    receive(comanda, body);
    const persisted = db().barbearias[empresa].comandas[comanda.id];
    if (corruption === 'partial-hash') { delete persisted.pagamentos[1].idempotenciaFingerprint; persisted.pagamentos[1].valor = 9; }
    if (corruption === 'missing-item') persisted.pagamentos.pop();
    if (corruption === 'changed-value') persisted.pagamentos[1].valor = 9;
    if (corruption === 'conflicting-hash') persisted.pagamentos[1].idempotenciaFingerprint = 'corrupt-fixture-hash';
    save();
    rejectWithoutEffects(comanda, body);
  }
});
