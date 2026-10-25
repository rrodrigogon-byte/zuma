import test from 'node:test';
import assert from 'node:assert/strict';
import * as svc from './servico.js';
import * as financeiroKytto from '../../financeiro-central-kytto.js';
import * as clientesKytto from '../../clientes-contas-kytto.js';

test('A2 e Kytto: contas a receber consolidadas, baixa e alertas de vencimento', async () => {
  const emp = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  // 1. Cadastra uma conta via servico A2
  const conta = await svc.criarConta(null, emp, {
    descricao: 'Mensalidade Teste Integração',
    valor: 250.00,
    dataVencimento: '2026-10-31',
    observacao: 'Cliente VIP',
  });

  assert.ok(conta.id, 'Conta criada deve ter ID');
  assert.equal(conta.valor, 250.00);
  assert.equal(conta.status, 'pendente');

  // 2. Verifica se a conta aparece na listagem consolidada
  const contas = await svc.listarContas(null, emp);
  const encontrada = contas.find((c) => c.id === conta.id);
  assert.ok(encontrada, 'A conta criada deve constar na listagem unificada');
  assert.equal(encontrada.descricao, 'Mensalidade Teste Integração');
  assert.equal(encontrada.status, 'pendente');

  // 3. Cadastra uma conta atrasada e verifica os alertas
  const atrasada = await svc.criarConta(null, emp, {
    descricao: 'Conta Antiga em Atraso',
    valor: 180.00,
    dataVencimento: '2026-10-01',
  });

  const alertas = await svc.listarAlertas(null, emp);
  const alertaAtraso = alertas.find((a) => a.contaId === atrasada.id);
  assert.ok(alertaAtraso, 'A conta vencida deve gerar alerta');
  assert.equal(alertaAtraso.tipo, 'atrasada');
  assert.ok(alertaAtraso.diasAtraso > 0);

  // 4. Dá baixa na conta atrasada
  const dataHoje = new Date().toISOString();
  const baixada = await svc.baixarConta(null, emp, atrasada.id, dataHoje);
  assert.equal(baixada.status, 'paga');

  // 5. Após a baixa, o alerta não deve mais existir para ela
  const alertasAposBaixa = await svc.listarAlertas(null, emp);
  assert.equal(alertasAposBaixa.some((a) => a.contaId === atrasada.id), false, 'Conta paga não deve ter alerta ativo');

  // 6. Na listagem, o status da conta deve ser paga
  const contasAposBaixa = await svc.listarContas(null, emp);
  const contaBaixadaNaLista = contasAposBaixa.find((c) => c.id === atrasada.id);
  assert.equal(contaBaixadaNaLista?.status, 'paga');

  // 7. Exclui a conta criada e verifica que foi removida
  const resExclusao = await svc.excluirConta(null, emp, conta.id);
  assert.equal(resExclusao.ok, true);
  const contasAposExclusao = await svc.listarContas(null, emp);
  assert.equal(contasAposExclusao.some((c) => c.id === conta.id), false, 'Conta excluída não deve constar na listagem');
});
