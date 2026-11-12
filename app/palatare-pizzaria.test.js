import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PALATARE_EMPRESA_ID,
  PALATARE_LOJA_ID,
  PALATARE_CNPJ,
  PALATARE_CNPJ_NUM,
  PALATARE_DADOS_EMPRESA,
  PALATARE_CARDAPIO_INICIAL,
  PALATARE_MESAS_INICIAIS,
  provisionarPalatarePizzaria
} from './palatare-pizzaria-seed.js';
import { validarCnpj } from './core/formatadores.js';
import { TEMPLATES_NEGOCIO } from './modules/empresas/onboarding-templates.js';
import { listarEmpresas } from './modules/empresas/servico.js';
import { db } from './db.js';

test('Palatare Pizzaria & Restaurante: dados cadastrais, CNPJ e identidade visual', () => {
  assert.equal(PALATARE_EMPRESA_ID, 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9');
  assert.equal(PALATARE_LOJA_ID, 'c1c1ac01-8e50-4b61-8c79-de4aaa916da0');
  assert.equal(PALATARE_CNPJ, '31.002.650/0001-08');
  assert.equal(validarCnpj(PALATARE_CNPJ), true);
  assert.equal(PALATARE_DADOS_EMPRESA.tipoNegocio, 'restaurante');
  assert.equal(PALATARE_DADOS_EMPRESA.logoUrl, '/palatare-logo.png');
  assert.equal(PALATARE_DADOS_EMPRESA.bannerUrl, '/palatare-banner.png');
  assert.equal(PALATARE_DADOS_EMPRESA.instagram, '@palataretga');
  assert.equal(PALATARE_DADOS_EMPRESA.enderecoCidade, 'Tangará da Serra');
  assert.equal(PALATARE_DADOS_EMPRESA.enderecoEstado, 'MT');
  assert.equal(PALATARE_DADOS_EMPRESA.telefone, '(65) 99999-0090');
});

test('Templates de Negócio: restaurante e pizzaria registrados no onboarding de empresas', () => {
  assert.ok(TEMPLATES_NEGOCIO.restaurante, 'Template restaurante deve existir');
  assert.equal(TEMPLATES_NEGOCIO.restaurante.icon, '🍕');
  assert.ok(TEMPLATES_NEGOCIO.restaurante.produtos.length >= 20, 'Deve ter cardápio inicial robusto');
  
  assert.ok(TEMPLATES_NEGOCIO.pizzaria, 'Template pizzaria deve existir');
  assert.equal(TEMPLATES_NEGOCIO.pizzaria.icon, '🍕');

  const categorias = new Set(TEMPLATES_NEGOCIO.restaurante.produtos.map(p => p.categoria));
  assert.ok(categorias.has('Pizzas Tradicionais'));
  assert.ok(categorias.has('Pizzas Especiais'));
  assert.ok(categorias.has('Pizzas Doces'));
  assert.ok(categorias.has('Pratos & Massas'));
  assert.ok(categorias.has('Vinhos & Adega'));
});

test('Cardápio Oficial Palatare: produtos com setores cozinha/bar e preços configurados', () => {
  assert.ok(PALATARE_CARDAPIO_INICIAL.length >= 25);
  
  const picanha = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Picanha'));
  assert.ok(picanha, 'Pizza de Picanha deve existir no cardápio');
  assert.equal(picanha.setor, 'cozinha');
  assert.equal(picanha.preco, 89.00);

  const fileGorgonzola = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Gorgonzola'));
  assert.ok(fileGorgonzola, 'Pizza de Filé com Gorgonzola deve existir no cardápio');
  assert.equal(fileGorgonzola.setor, 'cozinha');

  const rodizio = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Rodízio'));
  assert.ok(rodizio, 'Rodízio tradicional deve existir no cardápio');
  assert.equal(rodizio.preco, 59.90);

  const calzone = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Calzone'));
  assert.ok(calzone, 'Calzone deve existir no cardápio');

  const borda = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Borda Recheada'));
  assert.ok(borda, 'Borda recheada deve existir no cardápio');

  const chopp = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Chopp Pilsen'));
  assert.ok(chopp);
  assert.equal(chopp.setor, 'bar');
});

test('Mesas da Palatare: 20 mesas físicas (salão/varanda) + balcão + delivery', () => {
  assert.equal(PALATARE_MESAS_INICIAIS.length, 22);
  const fisica1 = PALATARE_MESAS_INICIAIS.find(m => m.numero === 1);
  assert.equal(fisica1.tipo, 'fisica');
  assert.equal(fisica1.nome, 'Mesa 1 · Salão');

  const balcao = PALATARE_MESAS_INICIAIS.find(m => m.numero === 101);
  assert.equal(balcao.tipo, 'virtual');

  const delivery = PALATARE_MESAS_INICIAIS.find(m => m.numero === 102);
  assert.equal(delivery.tipo, 'virtual');
});

test('Provisionamento da Palatare no Datastore JSON', async () => {
  const res = await provisionarPalatarePizzaria();
  assert.equal(res.empresaProvisionada, true);
  assert.ok(res.usuariosProvisionados >= 3);

  const resLista = await listarEmpresas(db()); const empresas = Array.isArray(resLista) ? resLista : (resLista?.empresas || []);
  const palatare = empresas.find(e => e.id === PALATARE_EMPRESA_ID || e.nome.includes('Palatare'));
  assert.ok(palatare, 'Empresa Palatare deve estar listada');
  assert.equal(palatare.cnpj, '31.002.650/0001-08');
  assert.equal(palatare.tipoNegocio, 'restaurante');
});
