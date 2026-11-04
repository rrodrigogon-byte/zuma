import test from 'node:test';
import assert from 'node:assert/strict';
import { db, save } from './db.js';
import * as caixaKytto from './caixa-diario-kytto.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { obterDetalhesCaixaOperacao } from './dino-caixa-detalhes.js';

test('Fluxo completo de Caixa: abertura, comandas com bandeira, fechamento, drilldown, reabertura e correção', async () => {
  const empresaId = `emp-teste-cx-${Date.now().toString(36)}`;
  const lojaId = `loja-teste-cx-${Date.now().toString(36)}`;
  const data = '2026-10-27';

  // 1. Abre o caixa
  const caixa = caixaKytto.abrirCaixa(empresaId, {
    numeroCaixa: 1,
    valorAbertura: 100,
    dataOperacao: `${data}T12:00:00.000Z`,
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
    observacao: 'Abertura teste',
  });
  assert.equal(caixa.status, 'aberto');
  assert.equal(caixa.numeroCaixa, 1);
  assert.equal(caixa.valorAbertura, 100);

  // Cadastra um profissional
  const prof = barbeariaErpKytto.criarProfissional(empresaId, {
    nome: 'Dino Oficial',
    apelido: 'Dino',
    ativo: true,
    lojaId,
  });

  // 2. Abre comandas e realiza pagamentos em diversos meios e bandeiras
  // Comanda 1: Cartão Débito MasterCard (R$ 21,00)
  const c1 = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    clienteNome: 'Avulso',
    profissionalId: prof.id,
    lojaId,
    data: `${data}T14:00:00.000Z`,
    itens: [{ tipo: 'outro', nome: 'Serviço Rápido', precoUnitario: 21, quantidade: 1 }],
  });
  barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, c1.id, {
    confirmado: true,
    pagamentos: [{ meio: 'debito', bandeira: 'MasterCard', valor: 21 }],
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
  });

  // Comanda 2: Cartão Débito Visa (R$ 132,00)
  const c2 = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    clienteNome: 'Lucas',
    profissionalId: prof.id,
    lojaId,
    data: `${data}T15:00:00.000Z`,
    itens: [{ tipo: 'outro', nome: 'Pacote Barbearia', precoUnitario: 132, quantidade: 1 }],
  });
  barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, c2.id, {
    confirmado: true,
    pagamentos: [{ meio: 'debito', bandeira: 'Visa', valor: 132 }],
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
  });

  // Comanda 3: Cartão Crédito MasterCard (R$ 360,00)
  const c3 = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    clienteNome: 'Heitor Campos',
    profissionalId: prof.id,
    lojaId,
    data: `${data}T16:00:00.000Z`,
    itens: [{ tipo: 'outro', nome: 'Tratamento Especial', precoUnitario: 360, quantidade: 1 }],
  });
  barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, c3.id, {
    confirmado: true,
    pagamentos: [{ meio: 'credito', bandeira: 'MasterCard', valor: 360 }],
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
  });

  // Comanda 4: Pix (R$ 500,00)
  const c4 = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    clienteNome: 'Guilherme',
    profissionalId: prof.id,
    lojaId,
    data: `${data}T17:00:00.000Z`,
    itens: [{ tipo: 'outro', nome: 'Produtos e Serviços', precoUnitario: 500, quantidade: 1 }],
  });
  barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, c4.id, {
    confirmado: true,
    pagamentos: [{ meio: 'pix', valor: 500 }],
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
  });

  // Comanda 5: Dinheiro (R$ 80,00)
  const c5 = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
    clienteNome: 'Alceu Tocchetto',
    profissionalId: prof.id,
    lojaId,
    data: `${data}T18:00:00.000Z`,
    itens: [{ tipo: 'outro', nome: 'Corte + Barba', precoUnitario: 80, quantidade: 1 }],
  });
  barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, c5.id, {
    confirmado: true,
    pagamentos: [{ meio: 'dinheiro', valor: 80 }],
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
  });

  // 3. Testa obterDetalhesCaixaOperacao com caixa aberto
  let detalhes = obterDetalhesCaixaOperacao(empresaId, caixa.id);
  assert.ok(detalhes);
  assert.equal(detalhes.totalFaturado, 1093.00); // 21 + 132 + 360 + 500 + 80
  assert.equal(detalhes.formasPagamento.cartao_debito.total, 153.00); // 21 + 132
  assert.equal(detalhes.formasPagamento.cartao_debito.bandeiras['MasterCard'].total, 21.00);
  assert.equal(detalhes.formasPagamento.cartao_debito.bandeiras['Visa'].total, 132.00);
  assert.equal(detalhes.formasPagamento.cartao_credito.bandeiras['MasterCard'].total, 360.00);
  assert.equal(detalhes.formasPagamento.pix.total, 500.00);
  assert.equal(detalhes.formasPagamento.dinheiro.total, 80.00);

  // Verifica o drilldown de comandas por meio
  const drillDebito = detalhes.comandasPorMeio['cartao_debito'];
  assert.ok(drillDebito);
  assert.equal(drillDebito.total, 153.00);
  assert.equal(drillDebito.comandas.length, 2);

  // 4. Fecha o caixa
  const fechamento = caixaKytto.fecharCaixa(empresaId, {
    caixaId: caixa.id,
    lojaId,
    valorInformado: 180, // Abertura 100 + Dinheiro 80 = 180 esperado
    usuario: 'dino@barbeariadino.com.br',
    observacao: 'Fechado sem divergência',
  });
  assert.equal(fechamento.caixa.status, 'fechado');
  assert.equal(fechamento.caixa.valorEsperado, 180);
  assert.equal(fechamento.caixa.divergencia, 0);

  // Tentativa de alterar pagamento em caixa fechado deve falhar
  assert.throws(() => {
    barbeariaErpKytto.alterarPagamentoComandaBarbearia(empresaId, c1.id, {
      meio: 'credito',
      bandeira: 'MasterCard',
    });
  }, /Para alterar a forma de pagamento, reabra o caixa correspondente/);

  // 5. Reabre o caixa
  const caixaReaberto = caixaKytto.reabrirCaixa(empresaId, {
    caixaId: caixa.id,
    lojaId,
    usuario: 'dino@barbeariadino.com.br',
    motivo: 'Cliente pagou com crédito e foi lançado débito',
  });
  assert.equal(caixaReaberto.status, 'aberto');
  assert.ok(caixaReaberto.reabertoEm);
  assert.equal(caixaReaberto.motivoReabertura, 'Cliente pagou com crédito e foi lançado débito');
  assert.equal(caixaReaberto.historicoFechamentos.length, 1);

  // 6. Altera o pagamento da Comanda 1 de Débito para Crédito ELO
  const c1Atualizada = barbeariaErpKytto.alterarPagamentoComandaBarbearia(empresaId, c1.id, {
    meio: 'credito',
    bandeira: 'ELO',
    motivo: 'Corrigido para Crédito ELO',
    usuario: 'dino@barbeariadino.com.br',
  });
  assert.equal(c1Atualizada.pagamentos[0].meio, 'credito');
  assert.equal(c1Atualizada.pagamentos[0].bandeira, 'ELO');

  // 7. Confere novamente os detalhes do caixa
  detalhes = obterDetalhesCaixaOperacao(empresaId, caixa.id);
  assert.equal(detalhes.formasPagamento.cartao_debito.total, 132.00); // 153 - 21
  assert.equal(detalhes.formasPagamento.cartao_credito.total, 381.00); // 360 + 21
  assert.equal(detalhes.formasPagamento.cartao_credito.bandeiras['ELO'].total, 21.00);

  // 8. Fecha novamente o caixa após a correção
  const refec = caixaKytto.fecharCaixa(empresaId, {
    caixaId: caixa.id,
    lojaId,
    valorInformado: 180,
    usuario: 'dino@barbeariadino.com.br',
    observacao: 'Fechado corrigido com sucesso',
  });
  assert.equal(refec.caixa.status, 'fechado');
});
