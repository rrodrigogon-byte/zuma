import test from 'node:test';
import assert from 'node:assert';
import { provisionarCatalogoDino, SERVICOS_DINO_OFICIAIS, PRODUTOS_DINO_OFICIAIS, DINO_EMPRESA_CANONICA } from './dino-catalogo-seed.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

test('1. Rotas de Catálogo: Provisionamento garante catálogo completo no ERP', () => {
  const seed = provisionarCatalogoDino({ empresaId: DINO_EMPRESA_CANONICA });
  assert.ok(seed.ok);
  assert.ok(seed.totalServicos >= 8);
  assert.ok(seed.totalProdutos >= 6);

  const estado = barbeariaErpKytto.estadoEmpresa(DINO_EMPRESA_CANONICA);
  assert.ok(estado.servicos['srv-dino-combo-003']);
  assert.strictEqual(estado.servicos['srv-dino-combo-003'].preco, 140.0);
  assert.ok(estado.produtosRevenda['prod-dino-pomada-001']);
  assert.strictEqual(estado.produtosRevenda['prod-dino-pomada-001'].precoVenda, 45.0);
});

test('2. Upsell de Balcão: Adicionar Pomada na comanda inclui item de R$ 45 e comissão R$ 4,50', () => {
  const empresaId = DINO_EMPRESA_CANONICA;
  // Cria comanda de teste
  const comanda = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    clienteNome: 'Cliente Teste Upsell',
    clienteTelefone: '5565999998888',
    profissionalId: 'prof-mwf821gx-004'
  });

  assert.ok(comanda && comanda.id);

  // Adiciona upsell de pomada
  const itemPomada = {
    tipo: 'produto',
    produtoId: 'prod-dino-pomada-001',
    nome: 'Pomada Modeladora Efeito Matte Dino (150g)',
    precoUnitario: 45.0,
    quantidade: 1,
    profissionalId: 'prof-mwf821gx-004',
    subtotal: 45.0,
    comissaoPercentual: 10,
    comissaoValor: 4.5
  };

  const atualizada = barbeariaErpKytto.adicionarItensComandaBarbearia(empresaId, comanda.id, [itemPomada]);
  assert.ok(atualizada);
  const temPomada = atualizada.itens.some(i => i.produtoId === 'prod-dino-pomada-001');
  assert.ok(temPomada);
  assert.strictEqual(atualizada.total, 45.0);
});
