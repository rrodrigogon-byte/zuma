import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const APP = path.resolve(new URL('../', import.meta.url).pathname);
const RUNNER = path.join(APP, 'migrations', 'run-avec-dino-import.js');
const EMPRESA = 'emp-kytto-001';
const LOJA = 'dino-web-estoque';

function execute(dbPath) {
  return spawnSync(process.execPath, [RUNNER], {
    cwd: APP,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_PATH: dbPath,
      AVEC_DINO_IMPORT_CONFIRM: 'PRD_AVEC_DINO_IMPORT_20261022_FINANCE_V1',
      AVEC_DINO_IMPORT_EMPRESA_ID: EMPRESA,
      AVEC_DINO_IMPORT_LOJA_ID: LOJA,
      GCS_BUCKET: '',
    },
  });
}

test('importador financeiro aplica o extrato Avec uma vez e preserva replay idempotente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avec-finance-import-'));
  const dbPath = path.join(dir, 'db.json');
  fs.writeFileSync(dbPath, JSON.stringify({
    barbearias: { [EMPRESA]: {} },
    clientesKytto: { empresas: { [EMPRESA]: { clientes: {}, contasReceber: {}, alertas: {}, fechamentoDiario: {} } } },
  }));

  const first = execute(dbPath);
  assert.equal(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  assert.equal(firstPayload.ok, true);
  assert.equal(firstPayload.report.imported.lancamentosFinanceirosHistoricos, 6866);
  assert.equal(firstPayload.report.financialSafety.paymentsCreated, 0);
  assert.equal(firstPayload.report.financialSafety.historicalPaidRevenue, 1148494.38);
  assert.equal(firstPayload.report.financialSafety.historicalPaidExpenses, 614507.86);
  assert.equal(firstPayload.report.financialSafety.historicalPendingExpenses, 48076.63);

  const applied = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const entries = Object.values(applied.financeiroKytto.empresas[EMPRESA].lancamentos)
    .filter((item) => item.origem === 'avec-import-financeiro-20261022');
  assert.equal(entries.length, 6866);
  assert.ok(entries.every((item) => item.empresaId === EMPRESA && item.lojaId === LOJA));
  assert.equal(entries.filter((item) => item.tipo === 'receita' && item.status === 'pago').length, 6405);
  assert.equal(entries.filter((item) => item.tipo === 'despesa' && item.status === 'pendente').length, 71);
  const idsBefore = entries.map((item) => item.id).sort();

  const second = execute(dbPath);
  assert.equal(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.equal(secondPayload.alreadyApplied, true);
  const replayed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const idsAfter = Object.values(replayed.financeiroKytto.empresas[EMPRESA].lancamentos)
    .filter((item) => item.origem === 'avec-import-financeiro-20261022')
    .map((item) => item.id).sort();
  assert.deepEqual(idsAfter, idsBefore);

  // Mesmo sem a marca de lote (recuperação/reconciliação), a origem de cada
  // registro continua protegendo a carga contra replay e perda de edições.
  const product = Object.values(replayed.barbearias[EMPRESA].produtosRevenda)[0];
  Object.assign(product, { estoqueAtual: 3, precoVenda: 123.45, estoqueMinimo: 2, ativo: false, atualizadoEm: '2026-10-23T12:00:00.000Z' });
  const productBefore = structuredClone(product);
  const stateBefore = replayed.barbearias[EMPRESA];
  const countsBefore = Object.fromEntries(['produtosRevenda', 'movimentosEstoque', 'historicoAtendimentos', 'historicoComandas'].map(key => [key, Object.keys(stateBefore[key]).length]));
  delete replayed.importacoesAvec['avec-dino-20261022-finance-v1'];
  fs.writeFileSync(dbPath, JSON.stringify(replayed));

  const recovered = execute(dbPath);
  assert.equal(recovered.status, 0, recovered.stderr);
  const recoveryPayload = JSON.parse(recovered.stdout);
  assert.equal(recoveryPayload.report.imported.lancamentosFinanceirosHistoricos, 0);
  assert.equal(recoveryPayload.report.imported.movimentosEstoqueInicial, 0);
  assert.equal(recoveryPayload.report.existing.produtos, 32);
  const afterRecovery = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert.deepEqual(afterRecovery.barbearias[EMPRESA].produtosRevenda[product.id], productBefore);
  const countsAfter = Object.fromEntries(Object.keys(countsBefore).map(key => [key, Object.keys(afterRecovery.barbearias[EMPRESA][key]).length]));
  assert.deepEqual(countsAfter, countsBefore);
  const recoveredFinancial = Object.values(afterRecovery.financeiroKytto.empresas[EMPRESA].lancamentos);
  assert.deepEqual(recoveredFinancial.map(item => item.id).sort(), idsBefore);
});
