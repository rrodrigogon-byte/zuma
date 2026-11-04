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
