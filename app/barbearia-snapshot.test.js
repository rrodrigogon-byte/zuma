// Snapshot das operações da barbearia (comanda, reserva, revenda): a cópia de segurança
// deixa o histórico importado de fora (por referência) e, em caso de erro, devolve o banco
// exatamente como estava, inclusive os apelidos internos entre coleções.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset } from './db.js';
import {
  _snapshotBarbeariaParaTeste,
  copiarEstadoEmpresaSemHistorico,
  criarProdutoRevenda,
  estadoSnapshotsBarbearia,
  listarInventoryReservations,
  reserveInventoryForOperation,
} from './barbearia-erp-kytto.js';

const { raizSnapshot, restaurarRaiz } = _snapshotBarbeariaParaTeste;
const EMPRESA = 'emp-snapshot';
const LOJA = 'loja-snapshot';

function comHistorico(qtd) {
  const estado = db().barbearias[EMPRESA];
  estado.historicoAtendimentos = {};
  estado.historicoComandas = {};
  for (let i = 0; i < qtd; i += 1) {
    estado.historicoAtendimentos[`h-${i}`] = { id: `h-${i}`, clienteNome: `Cliente ${i % 900}`, servicoNome: 'Corte', valor: 50 + (i % 30), dataAgenda: '2025-03-10', sourceHash: 'a'.repeat(64) };
    if (i % 3 === 0) estado.historicoComandas[`c-${i}`] = { id: `c-${i}`, numeroComanda: String(i), total: 80, itens: [{ nome: 'Corte', valor: 50 }] };
  }
  return estado;
}

beforeEach(() => reset());

test('erro numa operação devolve o banco igual, com o mesmo histórico e os apelidos de reserva', () => {
  const produto = criarProdutoRevenda(EMPRESA, { lojaId: LOJA, nome: 'Pomada', precoVenda: 30, estoqueAtual: 1 });
  reserveInventoryForOperation(EMPRESA, { lojaId: LOJA, produtoId: produto.id, quantidade: 1, origem: 'teste', idempotencyKey: 'r-1', expiresAt: '2099-01-01T00:00:00.000Z' });
  const estado = comHistorico(2000);
  const historico = estado.historicoAtendimentos;
  const antes = JSON.stringify(db());
  assert.throws(() => reserveInventoryForOperation(EMPRESA, { lojaId: LOJA, produtoId: produto.id, quantidade: 1, origem: 'teste', idempotencyKey: 'r-2', expiresAt: '2099-01-01T00:00:00.000Z' }), (error) => error.code === 'INVENTORY_INSUFFICIENT');
  assert.equal(JSON.stringify(db()), antes);
  const depois = db().barbearias[EMPRESA];
  assert.equal(depois.historicoAtendimentos, historico, 'o histórico continua sendo o mesmo objeto');
  assert.equal(depois.reservasEstoque, depois.inventoryReservations, 'o apelido reservasEstoque → inventoryReservations continua');
  assert.equal(listarInventoryReservations(EMPRESA, { lojaId: LOJA }).length, 1);
  assert.ok(estadoSnapshotsBarbearia().restauracoes >= 1);
});

test('mudança feita antes do erro é desfeita por inteiro e a ordem das chaves não muda', () => {
  criarProdutoRevenda(EMPRESA, { lojaId: LOJA, nome: 'Óleo', precoVenda: 40, estoqueAtual: 5 });
  comHistorico(50);
  db().outraColecao = { a: 1 };
  const antes = JSON.stringify(db());
  const chavesAntes = Object.keys(db().barbearias[EMPRESA]);
  const snapshot = raizSnapshot();
  // simula uma operação que muda várias partes e depois falha
  const estado = db().barbearias[EMPRESA];
  Object.values(estado.produtosRevenda)[0].estoqueAtual = 0;
  estado.inventoryReservations['rsv-x'] = { id: 'rsv-x' };
  db().outraColecao.a = 2;
  db().novaChave = true;
  restaurarRaiz(snapshot);
  assert.equal(JSON.stringify(db()), antes);
  assert.deepEqual(Object.keys(db().barbearias[EMPRESA]), chavesAntes);
  assert.equal(db().barbearias[EMPRESA].reservasEstoque, db().barbearias[EMPRESA].inventoryReservations);
  assert.equal(db().novaChave, undefined);
});

test('o snapshot não copia o histórico e fica bem mais rápido que a cópia do banco inteiro', () => {
  criarProdutoRevenda(EMPRESA, { lojaId: LOJA, nome: 'Shampoo', precoVenda: 25, estoqueAtual: 3 });
  comHistorico(120000);
  const t0 = performance.now();
  structuredClone(db());
  const inteiro = performance.now() - t0;
  const t1 = performance.now();
  const snapshot = raizSnapshot();
  const parcial = performance.now() - t1;
  assert.equal(snapshot.barbearias[EMPRESA].historicoAtendimentos, db().barbearias[EMPRESA].historicoAtendimentos);
  assert.notEqual(snapshot.barbearias[EMPRESA].produtosRevenda, db().barbearias[EMPRESA].produtosRevenda);
  assert.ok(parcial * 5 < inteiro, `snapshot ${parcial.toFixed(1)} ms × cópia inteira ${inteiro.toFixed(1)} ms`);
});

test('cópia do estado da empresa (compras) mantém o histórico por referência e copia o resto', () => {
  criarProdutoRevenda(EMPRESA, { lojaId: LOJA, nome: 'Cera', precoVenda: 35, estoqueAtual: 2 });
  const estado = comHistorico(10);
  const copia = copiarEstadoEmpresaSemHistorico(estado);
  assert.equal(copia.historicoComandas, estado.historicoComandas);
  assert.notEqual(copia.produtosRevenda, estado.produtosRevenda);
  assert.deepEqual(copia.produtosRevenda, estado.produtosRevenda);
  assert.equal(copia.reservasEstoque, copia.inventoryReservations);
  assert.deepEqual(Object.keys(copia), Object.keys(estado));
});
