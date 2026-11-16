import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbeariaErpKytto from '../app/barbearia-erp-kytto.js';

const EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'; // Barbearia Dino

test('Comanda Barbearia: preserva preço customizado de serviço alterado na abertura', () => {
  const servicos = barbeariaErpKytto.listarServicos(EMPRESA_ID);
  const corte = servicos.find((s) => s.ativo !== false) || servicos[0];
  assert.ok(corte, 'Deve existir ao menos um serviço');

  const precoCadastro = Number(corte.preco || 0);
  const precoAlterado = precoCadastro + 25.50; // Valor diferente do cadastro

  const comanda = barbeariaErpKytto.criarComandaBarbearia(EMPRESA_ID, {
    clienteNome: 'Cliente Teste Valor Alterado',
    clienteTelefone: '(65) 99999-8888',
    itens: [
      {
        tipo: 'servico',
        servicoId: corte.id,
        preco: precoAlterado,
        precoUnitario: precoAlterado,
        valor: precoAlterado,
        quantidade: 1,
      },
    ],
  });

  assert.ok(comanda.id, 'Comanda deve ser criada com sucesso');
  assert.equal(comanda.itens.length, 1, 'Deve ter 1 item');
  const itemComanda = comanda.itens[0];
  assert.equal(itemComanda.precoUnitario, precoAlterado, `Preço unitário deve ser R$ ${precoAlterado}, e não R$ ${precoCadastro}`);
  assert.equal(itemComanda.subtotal, precoAlterado, 'Subtotal do item deve refletir o preço alterado');
  assert.equal(comanda.subtotal, precoAlterado, 'Subtotal da comanda deve refletir o preço alterado');
  assert.equal(comanda.total, precoAlterado, 'Total da comanda deve refletir o preço alterado');
});

test('Comanda Barbearia: preserva preço customizado de produto de revenda alterado na abertura', () => {
  const produtos = barbeariaErpKytto.listarProdutosRevenda(EMPRESA_ID);
  const pomada = produtos.find((p) => p.ativo !== false) || produtos[0];
  assert.ok(pomada, 'Deve existir ao menos um produto');

  const precoCadastro = Number(pomada.precoVenda || 0);
  const precoPromocional = 42.00;

  const comanda = barbeariaErpKytto.criarComandaBarbearia(EMPRESA_ID, {
    clienteNome: 'Cliente Promocao Pomada',
    clienteTelefone: '(65) 98888-7777',
    itens: [
      {
        tipo: 'produto',
        produtoId: pomada.id,
        preco: precoPromocional,
        precoUnitario: precoPromocional,
        valor: precoPromocional,
        quantidade: 1,
      },
    ],
  });

  assert.ok(comanda.id);
  const item = comanda.itens[0];
  assert.equal(item.precoUnitario, precoPromocional, `Preço do produto deve ser R$ ${precoPromocional}`);
  assert.equal(comanda.total, precoPromocional);
});

test('Comanda Barbearia: atualizarItemComandaBarbearia aceita valor/precoUnitario e recalcula totais', () => {
  const servicos = barbeariaErpKytto.listarServicos(EMPRESA_ID);
  const servico = servicos[0];

  const comanda = barbeariaErpKytto.criarComandaBarbearia(EMPRESA_ID, {
    clienteNome: 'Cliente Ajuste Valor',
    itens: [
      {
        tipo: 'servico',
        servicoId: servico.id,
        quantidade: 1,
      },
    ],
  });

  const itemId = comanda.itens[0].id;
  const novoValor = 115.00;

  const atualizada = barbeariaErpKytto.atualizarItemComandaBarbearia(EMPRESA_ID, comanda.id, itemId, {
    valor: novoValor,
  });

  assert.ok(atualizada, 'Comanda deve ser atualizada');
  const itemAtualizado = atualizada.itens.find((i) => i.id === itemId);
  assert.equal(itemAtualizado.precoUnitario, novoValor, `Preço deve ser alterado para ${novoValor}`);
  assert.equal(itemAtualizado.subtotal, novoValor);
  assert.equal(atualizada.total, novoValor);
  assert.equal(atualizada.saldoPendente, novoValor);
});
