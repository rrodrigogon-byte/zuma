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
  assert.equal(PALATARE_CNPJ, '52.184.920/0001-00');
  assert.equal(validarCnpj(PALATARE_CNPJ), true);
  assert.equal(PALATARE_DADOS_EMPRESA.tipoNegocio, 'restaurante');
  assert.equal(PALATARE_DADOS_EMPRESA.logoUrl, '/palatare-logo.png');
  assert.equal(PALATARE_DADOS_EMPRESA.enderecoCidade, 'Tangará da Serra');
  assert.equal(PALATARE_DADOS_EMPRESA.enderecoEstado, 'MT');
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

test('Cardápio Oficial Palatare: 25 produtos com setores cozinha/bar e preços configurados', () => {
  assert.equal(PALATARE_CARDAPIO_INICIAL.length, 25);
  
  const calabresa = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Calabresa'));
  assert.ok(calabresa);
  assert.equal(calabresa.setor, 'cozinha');
  assert.equal(calabresa.preco, 68.00);

  const palatareEsp = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Palatare Especial'));
  assert.ok(palatareEsp);
  assert.equal(palatareEsp.setor, 'cozinha');
  assert.equal(palatareEsp.preco, 89.00);

  const chopp = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Chopp Pilsen'));
  assert.ok(chopp);
  assert.equal(chopp.setor, 'bar');
  assert.equal(chopp.preco, 15.00);

  const vinho = PALATARE_CARDAPIO_INICIAL.find(p => p.nome.includes('Cabernet Sauvignon'));
  assert.ok(vinho);
  assert.equal(vinho.setor, 'bar');
  assert.equal(vinho.preco, 98.00);
});

test('Mesas Oficiais Palatare: 20 mesas físicas (salão e varanda) e 2 mesas virtuais (balcão e delivery)', () => {
  assert.equal(PALATARE_MESAS_INICIAIS.length, 22);
  const fisicas = PALATARE_MESAS_INICIAIS.filter(m => m.tipo === 'fisica');
  const virtuais = PALATARE_MESAS_INICIAIS.filter(m => m.tipo === 'virtual');
  assert.equal(fisicas.length, 20);
  assert.equal(virtuais.length, 2);
  assert.ok(virtuais.some(m => m.nome.includes('Balcão')));
  assert.ok(virtuais.some(m => m.nome.includes('Delivery')));
});

test('Provisionamento Palatare: seed insere empresa e usuários gerenciais no Datastore', async () => {
  const res = await provisionarPalatarePizzaria();
  assert.equal(res.empresaProvisionada, true);
  assert.ok(res.usuariosProvisionados >= 3);

  const rootDb = db();
  const empJson = rootDb.cadastrosMestresKytto?.empresas?.[PALATARE_EMPRESA_ID];
  assert.ok(empJson, 'Palatare deve estar em cadastrosMestresKytto.empresas');
  assert.equal(empJson.nomeFantasia, 'Palatare Pizzaria');

  const uGerente = rootDb.usuarios.find(u => u.username === 'palatare');
  assert.ok(uGerente, 'Usuário gerente palatare deve existir');
  assert.equal(uGerente.role, 'organizador');
  assert.equal(uGerente.empresaId, PALATARE_EMPRESA_ID);
});

test('Listagem de Empresas: Palatare é listada canonicamente para Admin Global', async () => {
  const mockDb = { query: async () => ({ rows: [] }) };
  // Admin Global (sem filtro): deve ver Palatare
  const empresasGlobal = await listarEmpresas(mockDb, { incluirInativas: true });
  const temPalatare = empresasGlobal.some(e => e.id === PALATARE_EMPRESA_ID || e.nome.includes('Palatare'));
  assert.equal(temPalatare, true, 'Admin Global deve visualizar Palatare');

  // Isolamento do Guilherme (Dino): NÃO deve ver Palatare
  const empresasDino = await listarEmpresas(mockDb, { incluirInativas: true, empresaIdFiltro: ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6'] });
  const dinoVePalatare = empresasDino.some(e => e.id === PALATARE_EMPRESA_ID || e.nome.includes('Palatare'));
  assert.equal(dinoVePalatare, false, 'Dino não pode visualizar Palatare (isolamento estrito)');
});
