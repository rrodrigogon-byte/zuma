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
