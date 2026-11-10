import assert from 'node:assert/strict';
import test from 'node:test';
import * as barbearia from '../barbearia-erp-kytto.js';
import * as caixa from '../caixa-diario-kytto.js';
import { reset } from '../db.js';

test('Caixa: visualização de comandas fechadas e cancelamento de comanda finalizada', async () => {
  reset();
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'loja-dino-matriz';

  // 1. Criar serviços e profissional
  const servico1 = barbearia.criarServico(empresaId, { nome: 'Corte Cabelo Dino', preco: 80, duracaoMinutos: 30 });
  const servico2 = barbearia.criarServico(empresaId, { nome: 'Barba Terapêutica', preco: 60, duracaoMinutos: 30 });
  const prof = barbearia.criarProfissional(empresaId, { nome: 'Dino Master' });

  // 2. Abrir Caixa Operacional
  const cx = caixa.abrirCaixa(empresaId, { numeroCaixa: 1, valorAbertura: 100, lojaId, confirmado: true });
  assert.equal(cx.status, 'aberto');
  assert.equal(cx.valorAbertura, 100);

  // 3. Criar comanda 1 e pagar em dinheiro
  const cmd1 = barbearia.criarComandaBarbearia(empresaId, {
    clienteNome: 'Cliente Dinheiro',
    clienteTelefone: '65999991111',
    lojaId,
    profissionalId: prof.id,
    itens: [
      { tipo: 'servico', servicoId: servico1.id, nome: servico1.nome, preco: 80, precoUnitario: 80, quantidade: 1, subtotal: 80 },
    ],
  });
  const paga1 = barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd1.id, {
    confirmado: true,
    lojaId,
    meioPagamento: 'dinheiro',
    valor: 80,
    caixaId: cx.id,
  });
  assert.equal(paga1.status, 'paga');
  assert.equal(paga1.totalPago, 80);

  // 4. Criar comanda 2 e pagar via PIX
  const cmd2 = barbearia.criarComandaBarbearia(empresaId, {
    clienteNome: 'Cliente Pix',
    clienteTelefone: '65999992222',
    lojaId,
    profissionalId: prof.id,
    itens: [
      { tipo: 'servico', servicoId: servico2.id, nome: servico2.nome, preco: 60, precoUnitario: 60, quantidade: 1, subtotal: 60 },
    ],
  });
  const paga2 = barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd2.id, {
    confirmado: true,
    lojaId,
    meioPagamento: 'pix',
    valor: 60,
  });
  assert.equal(paga2.status, 'paga');

  // 5. Listar comandas fechadas no caixa
  const comandasHoje = barbearia.listarComandasBarbearia(empresaId, { lojaId });
  assert.equal(comandasHoje.length, 2);
  const fechadas = comandasHoje.filter(c => ['paga', 'em_conta', 'cancelada'].includes(c.status));
  assert.equal(fechadas.length, 2);

  // Conferir detalhamento dos itens da comanda fechada
  const comandaFechada1 = fechadas.find(c => c.id === cmd1.id);
  assert.ok(comandaFechada1);
  assert.equal(comandaFechada1.itens.length, 1);
  assert.equal(comandaFechada1.itens[0].nome, 'Corte Cabelo Dino');
  assert.equal(comandaFechada1.pagamentos[0].meio, 'dinheiro');
  assert.equal(comandaFechada1.pagamentos[0].valor, 80);

  // Conferir movimentos do caixa antes do cancelamento
  let movs = caixa.movimentosDoCaixa(empresaId, cx.id);
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, 'recebimento');
  assert.equal(movs[0].valor, 80);

  // 6. PROCEDIMENTO DE CANCELAMENTO DE COMANDA FINALIZADA
  // Cancelar a comanda paga em dinheiro (estorno no caixa)
  const cancelamento1 = await barbearia.cancelarComandaBarbearia(empresaId, cmd1.id, {
    lojaId,
    motivo: 'Erro de lançamento no caixa',
    usuario: 'Operador Caixa',
  });
  assert.ok(cancelamento1);
  assert.equal(cancelamento1.status, 'cancelada');
  assert.equal(cancelamento1.estornada, true);
  assert.equal(cancelamento1.cancelamentoMotivo, 'Erro de lançamento no caixa');

  // Conferir que o caixa recebeu o estorno do recebimento em dinheiro
  movs = caixa.movimentosDoCaixa(empresaId, cx.id);
  assert.equal(movs.length, 2);
  const estornoMov = movs.find(m => m.tipo === 'estorno_recebimento');
  assert.ok(estornoMov);
  assert.equal(estornoMov.valor, 80);

  // Fechar o caixa e verificar que o valor esperado voltou a 100 (fundo de abertura)
  const fechamento = caixa.fecharCaixa(empresaId, { caixaId: cx.id, lojaId });
  assert.equal(fechamento.resumo.recebimentosDinheiro, 0); // 80 recebido - 80 estornado = 0
  assert.equal(fechamento.resumo.valorEsperado, 100); // Fundo de abertura intacto

  // 7. Cancelar a comanda paga em PIX (estorno de balcão / manual)
  const cancelamento2 = await barbearia.cancelarComandaBarbearia(empresaId, cmd2.id, {
    lojaId,
    motivo: 'Cliente desistiu do procedimento',
    usuario: 'Operador Caixa',
    estornoManual: true,
  });
  assert.ok(cancelamento2);
  assert.equal(cancelamento2.status, 'cancelada');
  assert.equal(cancelamento2.estornada, true);

  // Ambas as comandas agora constam como canceladas
  const atualizadas = barbearia.listarComandasBarbearia(empresaId, { lojaId });
  assert.equal(atualizadas.filter(c => c.status === 'cancelada').length, 2);
  assert.equal(atualizadas.filter(c => c.status === 'paga').length, 0);
});

test('Múltiplos Caixas: abertura simultânea de 2, 3, 4 ou mais caixas e operações independentes', async () => {
  reset();
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'loja-dino-multi';

  // 1. Abrir Caixa 1 (Balcão Principal) com R$ 100 de troco
  const cx1 = caixa.abrirCaixa(empresaId, { numeroCaixa: 1, nomeCaixa: 'Balcão Principal', valorAbertura: 100, lojaId });
  assert.equal(cx1.numeroCaixa, 1);
  assert.equal(cx1.nomeCaixa, 'Balcão Principal');
  assert.equal(cx1.status, 'aberto');

  // 2. Abrir Caixa 2 (Recepção) com R$ 200 de troco
  const cx2 = caixa.abrirCaixa(empresaId, { numeroCaixa: 2, nomeCaixa: 'Recepção 2', valorAbertura: 200, lojaId });
  assert.equal(cx2.numeroCaixa, 2);
  assert.equal(cx2.status, 'aberto');

  // 3. Abrir Caixa 3 (Bar / Cafeteria) com R$ 50 de troco
  const cx3 = caixa.abrirCaixa(empresaId, { numeroCaixa: 3, nomeCaixa: 'Bar Dino', valorAbertura: 50, lojaId });
  assert.equal(cx3.numeroCaixa, 3);
  assert.equal(cx3.status, 'aberto');

  // 4. Abrir Caixa 4 (Turno Noturno) sem passar número explícito (deve auto-atribuir 4)
  const cx4 = caixa.abrirCaixa(empresaId, { nomeCaixa: 'Caixa Noturno', valorAbertura: 150, lojaId });
  assert.equal(cx4.numeroCaixa, 4);
  assert.equal(cx4.status, 'aberto');

  // 5. Validar que os 4 caixas constam como abertos simultaneamente
  const caixasAbertos = caixa.listarCaixas(empresaId, { lojaId, status: 'aberto' });
  assert.equal(caixasAbertos.length, 4);
  assert.deepEqual(caixasAbertos.map(c => c.numeroCaixa), [1, 2, 3, 4]);

  // 6. Registrar suprimento no Caixa 1 e sangria no Caixa 3
  caixa.registrarMovimento(empresaId, { caixaId: cx1.id, tipo: 'suprimento', valor: 50, descricao: 'Reforço troco' });
  caixa.registrarMovimento(empresaId, { caixaId: cx3.id, tipo: 'sangria', valor: 20, descricao: 'Sangria Bar' });

  // 7. Criar e pagar comanda direcionada para o Caixa 2
  const serv = barbearia.criarServico(empresaId, { nome: 'Barba VIP', preco: 70, duracaoMinutos: 30 });
  const cmd = barbearia.criarComandaBarbearia(empresaId, {
    clienteNome: 'Cliente Caixa 2',
    lojaId,
    itens: [{ tipo: 'servico', servicoId: serv.id, nome: serv.nome, preco: 70, precoUnitario: 70, quantidade: 1, subtotal: 70 }],
  });
  barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd.id, {
    confirmado: true,
    lojaId,
    meioPagamento: 'dinheiro',
    valor: 70,
    caixaId: cx2.id,
  });

  // 8. Verificar live expected balances de cada um dos caixas
  const listaAtualizada = caixa.listarCaixas(empresaId, { lojaId, status: 'aberto' });
  const mapaEsperados = Object.fromEntries(listaAtualizada.map(c => [c.numeroCaixa, c.valorEsperadoAtual]));
  assert.equal(mapaEsperados[1], 150); // 100 + 50 suprimento
  assert.equal(mapaEsperados[2], 270); // 200 + 70 recebimento dinheiro
  assert.equal(mapaEsperados[3], 30);  // 50 - 20 sangria
  assert.equal(mapaEsperados[4], 150); // 150 intacto

  // 9. Fechar o Caixa 2 individualmente mantendo Caixa 1, 3 e 4 abertos
  const fechamento2 = caixa.fecharCaixa(empresaId, { caixaId: cx2.id, valorInformado: 270 });
  assert.equal(fechamento2.caixa.status, 'fechado');
  const restantesAbertos = caixa.listarCaixas(empresaId, { lojaId, status: 'aberto' });
  assert.equal(restantesAbertos.length, 3);
  assert.deepEqual(restantesAbertos.map(c => c.numeroCaixa), [1, 3, 4]);
});

test('Comanda em conta: alterar valor de item em comanda finalizada (ex: Sobrancelha R$ 30 -> R$ 20) e refinalizar com recálculo consistente', async () => {
  reset();
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'loja-dino-matriz';
  const clientesKytto = await import('../clientes-contas-kytto.js');

  // 1. Criar cliente com conta corrente
  const cliente = clientesKytto.criarCliente(empresaId, {
    nome: 'Cliente VIP Dino',
    telefone: '65999993333',
    limiteCreditoMensal: 1000,
  });
  assert.equal(cliente.saldoDevedor, 0);

  const sPct = barbearia.criarServico(empresaId, { nome: 'Pacote 6 Procedimentos Premiun', preco: 360, duracaoMinutos: 60 });
  const sSob = barbearia.criarServico(empresaId, { nome: 'Design de Sobrancelha', preco: 30, duracaoMinutos: 20 });

  // 2. Criar comanda com itens idênticos aos da foto do usuário:
  // Pacote R$ 360,00 + Design de Sobrancelha R$ 30,00 = Total R$ 390,00
  const cmd = barbearia.criarComandaBarbearia(empresaId, {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    lojaId,
    itens: [
      { id: 'item-pct-1', tipo: 'servico', servicoId: sPct.id, nome: 'Pacote 6 Procedimentos Premiun', preco: 360, precoUnitario: 360, quantidade: 1, subtotal: 360 },
      { id: 'item-sob-2', tipo: 'servico', servicoId: sSob.id, nome: 'Design de Sobrancelha', preco: 30, precoUnitario: 30, quantidade: 1, subtotal: 30 },
    ],
  });
  assert.equal(cmd.total, 390);

  // 3. Faturar comanda em conta
  const faturada = barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd.id, {
    confirmado: true,
    lojaId,
    meioPagamento: 'conta',
    valor: 390,
    clienteId: cliente.id,
  });
  assert.equal(faturada.status, 'em_conta');
  assert.equal(faturada.totalFaturado, 390);

  // O cliente agora tem R$ 390 de saldo devedor
  const clienteCarregado = clientesKytto.obterCliente(empresaId, cliente.id);
  assert.equal(clienteCarregado.saldoDevedor, 390);

  // 4. ALTERAÇÃO DO ITEM EM COMANDA JÁ FINALIZADA:
  // O operador altera o valor da sobrancelha de R$ 30,00 para R$ 20,00
  const idSobrancelha = cmd.itens[1].id;
  const ajustada = barbearia.alterarItemComandaFinalizada(empresaId, cmd.id, idSobrancelha, {
    valor: 20,
    gerente: 'Gerente Dino',
    motivo: 'Ajuste do valor da sobrancelha digitado incorretamente',
  });

  // 5. Verificações:
  assert.ok(ajustada);
  assert.equal(ajustada.status, 'em_conta');
  // O item sobrancelha agora vale 20
  const itemSobrancelha = ajustada.itens.find(i => i.id === idSobrancelha);
  assert.equal(itemSobrancelha.precoUnitario, 20);
  assert.equal(itemSobrancelha.subtotal, 20);

  // O novo total da comanda é R$ 380,00 (360 + 20)
  assert.equal(ajustada.total, 380);
  assert.equal(ajustada.totalFaturado, 380);
  assert.equal(ajustada.saldoPendente, 0);

  // O pagamento em conta registrado na comanda foi recalculado para 380
  assert.equal(ajustada.pagamentos[0].valor, 380);

  // O saldo devedor do cliente foi devidamente recalculado para R$ 380,00
  const clienteAposAjuste = clientesKytto.obterCliente(empresaId, cliente.id);
  assert.equal(clienteAposAjuste.saldoDevedor, 380);

  // Histórico de auditoria foi gravado na comanda
  assert.equal(ajustada.historicoAlteracoes.length, 1);
  assert.equal(ajustada.historicoAlteracoes[0].tipo, 'alteracao_item_finalizado');
  assert.equal(ajustada.historicoAlteracoes[0].valorAntigo, 30);
  assert.equal(ajustada.historicoAlteracoes[0].valorNovo, 20);
  assert.equal(ajustada.historicoAlteracoes[0].totalAntigo, 390);
  assert.equal(ajustada.historicoAlteracoes[0].totalNovo, 380);
});

test('Comanda finalizada: reabertura para edição e refinalização em conta', async () => {
  reset();
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'loja-dino-matriz';
  const clientesKytto = await import('../clientes-contas-kytto.js');

  const cliente = clientesKytto.criarCliente(empresaId, { nome: 'Cliente Reabertura', limiteCreditoMensal: 500 });
  const s1 = barbearia.criarServico(empresaId, { nome: 'Corte', preco: 50, duracaoMinutos: 30 });
  const s2 = barbearia.criarServico(empresaId, { nome: 'Barba Express', preco: 30, duracaoMinutos: 20 });
  const cmd = barbearia.criarComandaBarbearia(empresaId, {
    clienteId: cliente.id,
    lojaId,
    itens: [{ id: 'i1', tipo: 'servico', servicoId: s1.id, nome: 'Corte', preco: 50, precoUnitario: 50, quantidade: 1, subtotal: 50 }],
  });
  barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd.id, { confirmado: true, meioPagamento: 'conta', valor: 50, clienteId: cliente.id, lojaId });

  // Reabrir
  const reaberta = barbearia.reabrirComandaBarbearia(empresaId, cmd.id, { gerente: 'Gerente', motivo: 'Ajuste de serviços' });
  assert.equal(reaberta.status, 'aguardando_pagamento');
  assert.equal(reaberta.statusAnteriorReabertura, 'em_conta');

  // Adicionar novo item
  barbearia.adicionarItensComandaBarbearia(empresaId, cmd.id, [{
    tipo: 'servico',
    servicoId: s2.id,
    nome: 'Barba Express',
    preco: 30,
    precoUnitario: 30,
    quantidade: 1,
    subtotal: 30,
  }]);

  // Refinalizar em conta
  const refechada = barbearia.refecharComandaEmContaBarbearia(empresaId, cmd.id);
  assert.equal(refechada.status, 'em_conta');
  assert.equal(refechada.total, 80); // 50 + 30
  assert.equal(refechada.totalFaturado, 80);

  const clienteFinal = clientesKytto.obterCliente(empresaId, cliente.id);
  assert.equal(clienteFinal.saldoDevedor, 80);
});

test('Comanda Paga: reabertura, remoção de item abaixo do faturado anterior e refechamento com estorno no caixa', async () => {
  reset();
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'loja-dino-matriz';
  const clientesKytto = await import('../clientes-contas-kytto.js');
  const cliente = clientesKytto.criarCliente(empresaId, { nome: 'Carlos Silva', limiteCreditoMensal: 300 });
  const cx = caixa.abrirCaixa(empresaId, { lojaId, valorAbertura: 200, operador: 'Operador Caixa' });

  const s1 = barbearia.criarServico(empresaId, { nome: 'Corte Degradê', preco: 60, duracaoMinutos: 30 });
  const s2 = barbearia.criarServico(empresaId, { nome: 'Sobrancelha', preco: 30, duracaoMinutos: 15 });

  // 1. Criar comanda com 2 serviços (Total R$ 90,00)
  const cmd = barbearia.criarComandaBarbearia(empresaId, {
    clienteId: cliente.id,
    lojaId,
    itens: [
      { id: 'item-corte', tipo: 'servico', servicoId: s1.id, nome: 'Corte Degradê', preco: 60, precoUnitario: 60, quantidade: 1, subtotal: 60 },
      { id: 'item-sobrancelha', tipo: 'servico', servicoId: s2.id, nome: 'Sobrancelha', preco: 30, precoUnitario: 30, quantidade: 1, subtotal: 30 },
    ],
  });
  assert.equal(cmd.total, 90);

  // 2. Receber e finalizar em dinheiro no caixa (Total R$ 90,00)
  barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd.id, {
    confirmado: true,
    meioPagamento: 'dinheiro',
    valor: 90,
    caixaId: cx.id,
    clienteId: cliente.id,
    lojaId,
  });

  const cmdPaga = barbearia.obterComandaBarbearia(empresaId, cmd.id);
  assert.equal(cmdPaga.status, 'paga');
  assert.equal(cmdPaga.totalPago, 90);

  // 3. Reabrir comanda para correção (autorizado por Jhenyffer / Gerente)
  const cmdReaberta = barbearia.reabrirComandaBarbearia(empresaId, cmd.id, {
    gerente: 'Jhenyffer Andrade',
    motivo: 'Cliente desistiu da sobrancelha antes do atendimento',
  });
  assert.equal(cmdReaberta.status, 'aguardando_pagamento');
  assert.equal(cmdReaberta.reaberta, true);

  // 4. Remover o item Sobrancelha (novo total R$ 60,00 - abaixo do faturado anterior de R$ 90,00!)
  const cmdAposRemover = barbearia.removerItemComandaBarbearia(empresaId, cmd.id, 'item-sobrancelha', {
    autorizadoGerente: true,
    permitirAbaixoFaturado: true,
  });
  assert.equal(cmdAposRemover.itens.length, 1);
  assert.equal(cmdAposRemover.total, 60);

  // 5. Refinalizar comanda mantendo pagamentos e estornando a diferença (R$ 30,00) no caixa
  const cmdRefechada = barbearia.refecharComandaBarbearia(empresaId, cmd.id, {
    meio: 'manter_pagamentos',
    gerente: 'Jhenyffer Andrade',
    usuario: 'Jhenyffer Andrade',
  });

  assert.equal(cmdRefechada.status, 'paga');
  assert.equal(cmdRefechada.total, 60);
  assert.equal(cmdRefechada.totalFaturado, 60);
  assert.equal(cmdRefechada.totalPago, 60);
  assert.equal(cmdRefechada.saldoPendente, 0);

  // 6. Validar que o caixa registrou o estorno de R$ 30,00
  const caixasAbertos = caixa.listarCaixas(empresaId, { lojaId, status: 'aberto' });
  const cxAtual = caixasAbertos.find(c => c.id === cx.id);
  assert.equal(cxAtual.valorEsperadoAtual, 260); // 200 abertura + 90 recebimento - 30 estorno = 260
});

test('Comanda Paga: reabertura, adição de produto e refinalização recebendo diferença via PIX', async () => {
  reset();
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const lojaId = 'loja-dino-matriz';
  const clientesKytto = await import('../clientes-contas-kytto.js');
  const cliente = clientesKytto.criarCliente(empresaId, { nome: 'Rodrigo Gonçalves' });

  const s1 = barbearia.criarServico(empresaId, { nome: 'Corte Clássico', preco: 50, duracaoMinutos: 30 });
  const p1 = barbearia.criarProdutoRevenda(empresaId, { nome: 'Pomada Matte Dino', precoVenda: 45, estoqueAtual: 20 });

  // 1. Criar e pagar comanda de corte (R$ 50,00) via PIX
  const cmd = barbearia.criarComandaBarbearia(empresaId, {
    clienteId: cliente.id,
    lojaId,
    itens: [
      { id: 'item-corte', tipo: 'servico', servicoId: s1.id, nome: 'Corte Clássico', preco: 50, precoUnitario: 50, quantidade: 1, subtotal: 50 },
    ],
  });

  barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd.id, {
    confirmado: true,
    meioPagamento: 'pix',
    valor: 50,
    clienteId: cliente.id,
    lojaId,
  });

  // 2. Reabrir comanda para adicionar pomada comprada na saída
  barbearia.reabrirComandaBarbearia(empresaId, cmd.id, {
    gerente: 'Jhenyffer Andrade',
    motivo: 'Inclusão de pomada na saída',
  });

  // 3. Adicionar Pomada (R$ 45,00) -> Novo total R$ 95,00
  const cmdComProduto = barbearia.adicionarItensComandaBarbearia(empresaId, cmd.id, [{
    tipo: 'produto',
    produtoId: p1.id,
    nome: 'Pomada Matte Dino',
    preco: 45,
    precoUnitario: 45,
    quantidade: 1,
    subtotal: 45,
  }]);

  assert.equal(cmdComProduto.total, 95);
  assert.equal(cmdComProduto.saldoPendente, 45); // 95 - 50 = 45

  // 4. Refechar comanda recebendo a diferença de R$ 45,00 via PIX
  const cmdRefechada = barbearia.refecharComandaBarbearia(empresaId, cmd.id, {
    meio: 'pix',
    gerente: 'Jhenyffer Andrade',
    usuario: 'Jhenyffer Andrade',
  });

  assert.equal(cmdRefechada.status, 'paga');
  assert.equal(cmdRefechada.total, 95);
  assert.equal(cmdRefechada.totalFaturado, 95);
  assert.equal(cmdRefechada.totalPago, 95);
  assert.equal(cmdRefechada.saldoPendente, 0);
  assert.equal(cmdRefechada.pagamentos.length, 2); // 50 inicial + 45 diferença
});
