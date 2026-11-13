import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as ficha360 from '../app/barbearia-cliente-ficha-360.js';
import * as clientesKytto from '../app/clientes-contas-kytto.js';

describe('Kytto Barbearia - Ficha 360 Ações Avançadas e Edição', () => {
  const empresaId = 'emp-kytto-001';

  test('1. Deve permitir criar, editar e excluir movimentações de crediário/dívida', () => {
    // Criar cliente temporário
    const cli = clientesKytto.criarCliente(empresaId, {
      nome: 'Cliente Teste Ações',
      telefone: '65999990001',
      limiteCreditoMensal: 500,
    });

    // 1. Adicionar dívida
    const ficha1 = ficha360.registrarMovimentoCreditoCliente(empresaId, cli.id, {
      tipo: 'divida',
      valor: 150,
      descricao: 'Dívida de teste da comanda Nº 888',
      numeroComanda: '888',
    });

    assert.equal(ficha1.creditos.saldoDevedor, 150);
    const mov = ficha1.creditos.movimentacoes.find((m) => m.comanda === 'Nº 888' || m.descricao.includes('888'));
    assert.ok(mov, 'Movimento criado deve constar no extrato');

    // 2. Editar movimento
    const ficha2 = ficha360.atualizarMovimentoCreditoCliente(empresaId, cli.id, mov.id, {
      descricao: 'Dívida da comanda Nº 888 - Atualizada',
      valor: 180,
    });
    const movEditado = ficha2.creditos.movimentacoes.find((m) => m.id === mov.id);
    assert.ok(movEditado.descricao.includes('Atualizada'), 'Descrição deve ter sido editada');
    assert.equal(movEditado.valorAbsoluto, 180, 'Valor deve ter sido atualizado');

    // 3. Quitar / Adicionar crédito
    const ficha3 = ficha360.registrarMovimentoCreditoCliente(empresaId, cli.id, {
      tipo: 'credito',
      valor: 180,
      descricao: 'Pagamento total da comanda 888',
      numeroComanda: '888',
    });
    assert.equal(ficha3.creditos.saldoDevedor, 0, 'Saldo devedor deve ser zerado após pagamento');

    // 4. Excluir / Estornar movimento
    const ficha4 = ficha360.excluirMovimentoCreditoCliente(empresaId, cli.id, mov.id);
    const movCancelado = ficha4.creditos.movimentacoes.find((m) => m.id === mov.id);
    assert.equal(movCancelado, undefined, 'Movimento cancelado não deve figurar como pendente');
  });

  test('2. Deve permitir adicionar novo pacote e consumir sessões', () => {
    const cli = clientesKytto.criarCliente(empresaId, {
      nome: 'Cliente Pacote Teste',
      telefone: '65999990002',
    });

    // Adicionar pacote
    const ficha1 = ficha360.adicionarPacoteCliente(empresaId, cli.id, {
      pacoteNome: 'Combo VIP 4 Sessões',
      servicosDisponiveis: 'Corte + Barba + Hidratação',
      sessoesTotal: 4,
    });

    const pct = ficha1.pacotes.find((p) => p.pacote === 'Combo VIP 4 Sessões');
    assert.ok(pct, 'Pacote deve estar na lista');
    assert.equal(pct.sessoesRestantes, 4);

    // Consumir 1 sessão
    const ficha2 = ficha360.consumirSessaoPacoteCliente(empresaId, cli.id, pct.id);
    const pctAposUso = ficha2.pacotes.find((p) => p.id === pct.id);
    assert.equal(pctAposUso.sessoesRestantes, 3, 'Deve sobrar 3 sessões');
    assert.equal(pctAposUso.quantidade, '3/4');
  });
});
