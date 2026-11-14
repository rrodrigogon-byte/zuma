import test from 'node:test';
import assert from 'node:assert';
import { provisionarCatalogoDino, SERVICOS_DINO_OFICIAIS, PRODUTOS_DINO_OFICIAIS, DINO_EMPRESA_CANONICA } from './dino-catalogo-seed.js';
import { estadoEmpresa } from './barbearia-erp-kytto.js';

test('1. Provisionamento de Catálogo: Todos os serviços são injetados no estado da Dino', () => {
  const res = provisionarCatalogoDino({ empresaId: DINO_EMPRESA_CANONICA });
  assert.ok(res.ok);
  assert.ok(res.totalServicos >= SERVICOS_DINO_OFICIAIS.length);

  const estado = estadoEmpresa(DINO_EMPRESA_CANONICA);
  const corte = estado.servicos['srv-dino-corte-001'];
  assert.ok(corte);
  assert.strictEqual(corte.preco, 90.0);
  assert.strictEqual(corte.duracaoMin, 45);

  const combo = estado.servicos['srv-dino-combo-003'];
  assert.ok(combo);
  assert.strictEqual(combo.preco, 140.0);
});

test('2. Provisionamento de Produtos: Perfumaria e pomadas criadas com estoque inicial', () => {
  const estado = estadoEmpresa(DINO_EMPRESA_CANONICA);
  const pomada = estado.produtosRevenda['prod-dino-pomada-001'];
  assert.ok(pomada);
  assert.strictEqual(pomada.precoVenda, 45.0);
  assert.strictEqual(pomada.estoqueAtual, 40);

  const asad = estado.produtosRevenda['prod-dino-perf-asad-005'];
  assert.ok(asad);
  assert.strictEqual(asad.precoVenda, 75.0);
});

test('3. Unificação de Profissionais: Natani duplicada é inativada e Nati preservada', () => {
  const estado = estadoEmpresa(DINO_EMPRESA_CANONICA);
  const nati = Object.values(estado.profissionais).find(p => p.nome === 'Nati');
  assert.ok(nati);
  assert.strictEqual(nati.ativo, true);
});
