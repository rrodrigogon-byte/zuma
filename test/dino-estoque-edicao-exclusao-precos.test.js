import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  listarProdutosRevenda,
  criarProdutoRevenda,
  atualizarProdutoRevenda,
  excluirProdutoRevenda,
} from '../app/barbearia-erp-kytto.js';

const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

describe('Dino Barbearia: Edição, Exclusão de Produtos e Preços Reais do Estoque', () => {

  test('1. Pomada Matte e Óleo de Barba devem possuir preços oficiais de tabela cadastrados (R$ 65,00 e R$ 55,00)', () => {
    const produtos = listarProdutosRevenda(EMPRESA_DINO, { incluirInativos: true });
    
    const pomada = produtos.find(p => p.nome.toLowerCase().includes('pomada modeladora efeito matte dino'));
    assert.ok(pomada, 'Pomada Modeladora Efeito Matte Dino deve existir no estoque');
    assert.equal(pomada.precoVenda, 65, 'Preço de venda da Pomada Matte Dino deve ser R$ 65,00 oficial');

    const oleo = produtos.find(p => p.nome.toLowerCase().includes('óleo hidratante para barba dino'));
    assert.ok(oleo, 'Óleo Hidratante para Barba Dino deve existir no estoque');
    assert.equal(oleo.precoVenda, 55, 'Preço de venda do Óleo Hidratante deve ser R$ 55,00 oficial');
  });

  test('2. Edição / Modificação de produto deve atualizar Preço de Venda, Custo e Saldo com sucesso', () => {
    // Criar item temporário para teste
    const criado = criarProdutoRevenda(EMPRESA_DINO, {
      nome: 'Produto Teste Edição Dino ' + Date.now(),
      categoria: 'Modelador',
      precoVenda: 50.00,
      custoUnitario: 20.00,
      estoqueAtual: 10,
      estoqueMinimo: 5,
    });
    assert.ok(criado?.id);
    assert.equal(criado.precoVenda, 50.00);

    // Modificar preço e saldo
    const atualizado = atualizarProdutoRevenda(EMPRESA_DINO, criado.id, {
      nome: criado.nome + ' Modificado',
      precoVenda: 65.00,
      custoUnitario: 25.00,
      estoqueAtual: 15,
      estoqueMinimo: 8,
    });

    assert.ok(atualizado);
    assert.equal(atualizado.precoVenda, 65.00);
    assert.equal(atualizado.custoUnitario, 25.00);
    assert.equal(atualizado.estoqueAtual, 15);
    assert.equal(atualizado.estoqueMinimo, 8);
    assert.match(atualizado.nome, /Modificado$/);

    // Limpar item temporário
    excluirProdutoRevenda(EMPRESA_DINO, criado.id, { permanente: true });
  });

  test('3. Exclusão permanente deve remover definitivamente o cadastro de produtos obsoletos ou não cadastrados pela equipe', () => {
    const itemParaExcluir = criarProdutoRevenda(EMPRESA_DINO, {
      nome: 'Produto Nao Foi A Gente ' + Date.now(),
      categoria: 'Geral',
      precoVenda: 99.00,
      estoqueAtual: 2,
    });
    assert.ok(itemParaExcluir?.id);

    // Excluir permanentemente
    const res = excluirProdutoRevenda(EMPRESA_DINO, itemParaExcluir.id, { permanente: true });
    assert.ok(res?.excluido);
    assert.equal(res?.permanente, true);

    // Verificar que não consta mais no estoque
    const produtosApos = listarProdutosRevenda(EMPRESA_DINO, { incluirInativos: true });
    const encontrado = produtosApos.find(p => p.id === itemParaExcluir.id);
    assert.equal(encontrado, undefined, 'Produto excluído permanentemente não deve constar no cadastro');
  });

});
