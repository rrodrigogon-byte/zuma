import test from 'node:test';
import assert from 'node:assert/strict';
import { obterFichaCompletaCliente, registrarMovimentoCreditoCliente } from '../app/barbearia-cliente-ficha-360.js';
import * as clientesKytto from '../app/clientes-contas-kytto.js';
import { DINO_EMPRESA_CANONICA } from '../app/dino-equipe-seed.js';

test('Barbearia Dino - Ficha Completa 360 do Cliente, Pacotes, Comandas e Crediário', async (t) => {
  const empresaId = DINO_EMPRESA_CANONICA;

  // 1. Criar um cliente de teste
  const cpfTeste = `009.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-55`;
  const clienteTeste = clientesKytto.criarCliente(empresaId, {
    nome: "Bruno Mac Teste",
    telefone: `6599${Math.floor(1000000 + Math.random() * 8999999)}`,
    cpf: cpfTeste,
    dataNascimento: "1993-10-08",
    limiteCreditoMensal: 500,
    observacao: "Cliente VIP transferido do Avec",
  });

  await t.test('1. Deve obter a ficha completa com todas as abas consolidadas', () => {
    const ficha = obterFichaCompletaCliente(empresaId, clienteTeste.id);
    assert.equal(ficha.ok, true);
    assert.equal(ficha.cliente.nome, 'Bruno Mac Teste');
    assert.equal(ficha.cliente.cpf, cpfTeste);
    assert.equal(ficha.cliente.saldoDevedor, 0);
    assert.equal(ficha.cliente.limiteCreditoMensal, 500);
    assert.equal(ficha.creditos.creditoDisponivel, 500);

    assert.ok(Array.isArray(ficha.agendamentos), 'Agendamentos deve ser array');
    assert.ok(Array.isArray(ficha.comandas), 'Comandas deve ser array');
    assert.ok(Array.isArray(ficha.pacotes), 'Pacotes deve ser array');
    assert.ok(Array.isArray(ficha.creditos.movimentacoes), 'Movimentações deve ser array');
    assert.ok(Array.isArray(ficha.produtos), 'Produtos deve ser array');
  });

  await t.test('2. Deve adicionar dívida de comanda (fiado) e refletir no saldo devedor e extrato', () => {
    const fichaAposDivida = registrarMovimentoCreditoCliente(empresaId, clienteTeste.id, {
      tipo: 'divida',
      valor: 130.00,
      descricao: 'Dívida da comanda Nº 351',
      numeroComanda: '351',
    });

    assert.equal(fichaAposDivida.cliente.saldoDevedor, 130.00);
    assert.equal(fichaAposDivida.cliente.creditoDisponivel, 370.00); // 500 - 130 = 370
    assert.ok(fichaAposDivida.creditos.movimentacoes.length >= 1, 'Deve registrar a movimentação');
    const mov = fichaAposDivida.creditos.movimentacoes[0];
    assert.equal(mov.comanda, 'Nº 351');
    assert.equal(mov.valor, -130.00);
    assert.equal(mov.status, 'pendente');
  });

  await t.test('3. Deve registrar pagamento/crédito, quitar a dívida e atualizar o saldo devedor para zero', () => {
    const fichaAposPagamento = registrarMovimentoCreditoCliente(empresaId, clienteTeste.id, {
      tipo: 'credito',
      valor: 130.00,
      descricao: 'Pagamento em dinheiro no caixa comanda Nº 351',
    });

    assert.equal(fichaAposPagamento.cliente.saldoDevedor, 0);
    assert.equal(fichaAposPagamento.cliente.creditoDisponivel, 500);
  });
});
