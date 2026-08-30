import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_BAR_TTC_OFICIAL, CATALOGO_BAR_TTC_SKUS, RESUMO_CATALOGO_BAR_TTC } from './catalogo-bar-ttc-oficial.js';

test('catálogo oficial tem 29 itens do PDF e nenhuma semente fictícia', () => {
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.length, 29);
  assert.equal(CATALOGO_BAR_TTC_SKUS.length, 29);
  assert.equal(RESUMO_CATALOGO_BAR_TTC.itens, 29);
  assert.ok(CATALOGO_BAR_TTC_OFICIAL.every((item) => item.indisponivel === false));
  assert.ok(CATALOGO_BAR_TTC_OFICIAL.every((item) => item.precoPendente === false));
  assert.ok(CATALOGO_BAR_TTC_OFICIAL.every((item) => item.origemCardapio === 'cardapio_bar_ttc_completo.pdf'));
  assert.equal(new Set(CATALOGO_BAR_TTC_SKUS.map((item) => item.sku)).size, 29);
});

test('categorias e preços oficiais estão alinhados ao cardápio', () => {
  const porNome = (nome, subcategoria) => CATALOGO_BAR_TTC_OFICIAL.find((item) => item.nome === nome && (!subcategoria || item.subcategoria === subcategoria));
  assert.equal(porNome('Água Mineral')?.preco, 5);
  assert.equal(porNome('Original 600ml')?.preco, 16.9);
  assert.equal(porNome('Isca de Tilápia')?.subcategoria, 'Peixes');
  assert.equal(porNome('Filé com Fritas')?.subcategoria, 'Bovinos');
  assert.equal(porNome('Jungle Burger')?.subcategoria, 'Bovinos · Costela 180g');
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Bebidas').length, 16);
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Porções').length, 4);
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Espetos').length, 6);
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Burgers').length, 3);
});

test('unidades e apresentações são explícitas', () => {
  assert.ok(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat === 'Porções').every((item) => item.unidade === 'PORÇÃO'));
  assert.ok(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.cat !== 'Porções').every((item) => item.unidade === 'UN'));
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.find((item) => item.nome === 'Original 600ml')?.volumeMl, 600);
  assert.equal(CATALOGO_BAR_TTC_OFICIAL.filter((item) => item.embalagem === 'Completo').length, 3);
});
