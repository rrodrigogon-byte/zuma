import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';
import { criarCliente } from './clientes-contas-kytto.js';
import { abrirCaixa } from './caixa-diario-kytto.js';
import {
  alterarStatusAgendamento, criarAgendamento, criarProfissional, criarServico,
  criarComandaBarbearia, obterComissoes, registrarPagamentoComandaBarbearia, atualizarConfiguracao,
} from './barbearia-erp-kytto.js';

const EMPRESA = 'emp-correcoes';
const LOJA = 'loja-a';
beforeEach(() => reset());
afterEach(() => reset());
const base = () => ({ profissional: criarProfissional(EMPRESA, { nome: 'Rafa' }), servico: criarServico(EMPRESA, { nome: 'Corte', duracaoMinutos: 30, preco: 50 }) });

test('desconto da comanda reduz a base da comissão', () => {
  const { profissional, servico } = base();
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteNome: 'Cliente', profissionalId: profissional.id, desconto: 20, itens: [{ tipo: 'servico', servicoId: servico.id, profissionalId: profissional.id, quantidade: 2 }] });
  registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, meioPagamento: 'pix', valor: 80 });
  const linha = obterComissoes(EMPRESA).porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(linha.brutoServicos, 80);
  assert.equal(linha.comissaoServicos, 40);
});

test('atendimento da agenda pago em comanda de outro dia não conta duas vezes', () => {
  const { profissional, servico } = base();
  const agendamento = criarAgendamento(EMPRESA, { clienteNome: 'Cliente', profissionalId: profissional.id, servicoId: servico.id, dataHora: '2030-04-02T13:00:00.000Z', dataAgenda: '2030-04-02', horaLocal: '09:00' });
  alterarStatusAgendamento(EMPRESA, agendamento.id, 'confirmado');
  alterarStatusAgendamento(EMPRESA, agendamento.id, 'em_atendimento');
  alterarStatusAgendamento(EMPRESA, agendamento.id, 'concluido');
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: LOJA, agendamentoId: agendamento.id, clienteNome: 'Cliente', profissionalId: profissional.id, itens: [{ tipo: 'servico', servicoId: servico.id, profissionalId: profissional.id }] });
  registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, meioPagamento: 'pix', valor: 50 });
  const diaDaAgenda = obterComissoes(EMPRESA, { data: '2030-04-02' }).porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(diaDaAgenda?.brutoServicos || 0, 0, 'no dia da agenda, o atendimento já pertence à comanda');
  const total = obterComissoes(EMPRESA).porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(total.brutoServicos, 50);
});

test('parte em conta + outro meio não cobra acima do total', () => {
  const { servico } = base();
  const cliente = criarCliente(EMPRESA, { nome: 'Cliente conta', limiteCreditoMensal: 200 });
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteId: cliente.id, clienteNome: cliente.nome, itens: [{ tipo: 'servico', servicoId: servico.id }] });
  registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, clienteId: cliente.id, meioPagamento: 'conta', valor: 30, chaveIdempotencia: 'p1' });
  assert.throws(() => registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, meioPagamento: 'pix', valor: 30, chaveIdempotencia: 'p2' }), /excede o saldo pendente de 20/);
  const fim = registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, meioPagamento: 'pix', valor: 20, chaveIdempotencia: 'p3' });
  assert.equal(fim.status, 'em_conta');
});

test('dinheiro sem caixa escolhido vai para o caixa aberto da unidade; caixa usa o dia local', () => {
  const { servico } = base();
  const caixa = abrirCaixa(EMPRESA, { numeroCaixa: 1, valorAbertura: 0, lojaId: 'loja-a', dataOperacao: '2030-05-01T23:30:00-04:00' });
  assert.equal(caixa.data, '2030-05-01', '23h30 em Cuiabá ainda é o mesmo dia');
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: 'loja-a', clienteNome: 'Cliente', itens: [{ tipo: 'servico', servicoId: servico.id }] });
  const paga = registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { confirmado: true, meioPagamento: 'dinheiro', valor: 50, lojaId: 'loja-a' });
  assert.equal(paga.pagamentos[0].caixaId, caixa.id);
});

test('comanda paga com dois meios rateia a taxa de maquininha', () => {
  const { profissional, servico } = base();
  atualizarConfiguracao(EMPRESA, { taxasPagamento: { credito: { percentual: 4, fixa: 0, fonte: 'Contrato teste' }, pix: { percentual: 0, fixa: 0, fonte: 'Contrato teste' } } });
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteNome: 'Cliente', profissionalId: profissional.id, itens: [{ tipo: 'servico', servicoId: servico.id, profissionalId: profissional.id, quantidade: 2 }] });
  registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, pagamentos: [{ meio: 'pix', valor: 50 }, { meio: 'credito', valor: 50 }] });
  const linha = obterComissoes(EMPRESA).porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(linha.taxas, 2, '4% só sobre os R$ 50 no crédito');
});

test('comanda fechada em conta (parte na conta, parte no pix) gera comissão', () => {
  const profissional = criarProfissional(EMPRESA, { nome: 'Rafa', percentualComissao: 50 });
  const servico = criarServico(EMPRESA, { nome: 'Corte', duracaoMinutos: 30, preco: 50 });
  const cliente = criarCliente(EMPRESA, { nome: 'Cliente conta', limiteCreditoMensal: 500 });
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteId: cliente.id, clienteNome: 'Cliente conta', profissionalId: profissional.id, itens: [{ tipo: 'servico', servicoId: servico.id, profissionalId: profissional.id }] });
  const fechada = registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, clienteId: cliente.id, pagamentos: [{ meio: 'conta', valor: 30 }, { meio: 'pix', valor: 20 }] });
  assert.equal(fechada.status, 'em_conta');
  const linha = obterComissoes(EMPRESA).porProfissional.find((item) => item.profissionalId === profissional.id);
  assert.equal(linha.brutoServicos, 50);
  assert.equal(linha.comissaoServicos, 25);
});

test('tarifa fixa da maquininha é cobrada uma vez por pagamento, não por item', () => {
  const profissional = criarProfissional(EMPRESA, { nome: 'Rafa', percentualComissao: 50, descontaTaxaMaquininha: true });
  const servico = criarServico(EMPRESA, { nome: 'Corte', duracaoMinutos: 30, preco: 50 });
  atualizarConfiguracao(EMPRESA, { taxasPagamento: { credito: { percentual: 0, fixa: 1, fonte: 'Contrato teste' } } });
  const item = { tipo: 'servico', servicoId: servico.id, profissionalId: profissional.id };
  const comanda = criarComandaBarbearia(EMPRESA, { lojaId: LOJA, clienteNome: 'Cliente', profissionalId: profissional.id, itens: [item, item, item] });
  registrarPagamentoComandaBarbearia(EMPRESA, comanda.id, { lojaId: LOJA, confirmado: true, meioPagamento: 'credito', valor: 150 });
  const linha = obterComissoes(EMPRESA).porProfissional.find((row) => row.profissionalId === profissional.id);
  assert.ok(Math.abs(linha.taxas - 1) < 0.01, `uma tarifa fixa de R$ 1 (${linha.taxas})`);
});
