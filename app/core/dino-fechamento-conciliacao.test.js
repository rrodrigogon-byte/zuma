import test from 'node:test';
import * as assert from 'node:assert/strict';
import { reset, save } from '../db.js';
import * as caixaKytto from '../caixa-diario-kytto.js';
import * as barbeariaErpKytto from '../barbearia-erp-kytto.js';
import * as financeiroKytto from '../financeiro-central-kytto.js';
import {
  obterFechamentoDiarioEConciliacao,
  executarFechamentoDiarioIntegrado,
  reabrirFechamentoDiarioIntegrado,
  listarEmpresasParaFechamento,
  fecharTodosOsCaixasDaEmpresa,
  abrirNovoCaixaEmpresa,
  fecharCaixaIndividualEmpresa,
  DINO_EMPRESA_CANONICA,
} from '../dino-fechamento-conciliacao.js';

test('Dino Fechamento Diário e Conciliação com ERP', async (t) => {
  reset();
  const empresaId = DINO_EMPRESA_CANONICA;
  const lojaId = 'loja-dino-matriz';
  const data = '2026-11-05';

  // Registra catálogo base
  const srvCorte = barbeariaErpKytto.criarServico(empresaId, { nome: 'Corte Cabelo', preco: 60.00, duracaoMinutos: 30 });
  const prodPomada = barbeariaErpKytto.criarProdutoRevenda(empresaId, { nome: 'Pomada Matte', precoVenda: 40.00, estoqueAtual: 20 });
  const profDino = barbeariaErpKytto.criarProfissional(empresaId, { nome: 'Dino Master' });

  await t.test('1. Deve calcular conciliação inicial com dia sem movimentos', () => {
    const res = obterFechamentoDiarioEConciliacao(empresaId, data, { lojaId });
    assert.equal(res.ok, true);
    assert.equal(res.data, data);
    assert.equal(res.statusGeral, 'conciliado');
    assert.equal(res.kpisGestao.faturamentoBruto, 0);
    assert.equal(res.kpisGestao.totalRecebidoLiquido, 0);
    assert.equal(res.caixas.length, 0);
  });

  await t.test('2. Deve apurar caixa aberto, comandas pagas e conciliação com ERP', () => {
    // Abre Caixa 1
    const caixa1 = caixaKytto.abrirCaixa(empresaId, {
      lojaId,
      data,
      numeroCaixa: 1,
      nomeCaixa: 'Caixa Balcão',
      valorAbertura: 150.00,
      usuario: 'operador@dino.com.br',
    });

    // Registra suprimento de R$ 50
    caixaKytto.registrarMovimento(empresaId, {
      caixaId: caixa1.id,
      lojaId,
      tipo: 'suprimento',
      valor: 50.00,
      descricao: 'Troco extra cedido pelo gerente',
      usuario: 'gerente@dino.com.br',
    });

    // Cria comanda com Corte (R$ 60) e Pomada (R$ 40)
    const comanda1 = barbeariaErpKytto.criarComandaBarbearia(empresaId, {
      lojaId,
      data,
      clienteNome: 'João Silva',
      clienteTelefone: '65999887766',
      profissionalId: profDino.id,
      itens: [
        { tipo: 'servico', servicoId: srvCorte.id, nome: srvCorte.nome, preco: 60.00, quantidade: 1 },
        { tipo: 'produto', produtoId: prodPomada.id, nome: prodPomada.nome, preco: 40.00, quantidade: 1 },
      ],
    });

    // Paga comanda: R$ 50 no Dinheiro (vinculado ao Caixa 1) e R$ 50 no PIX
    barbeariaErpKytto.registrarPagamentoComandaBarbearia(empresaId, comanda1.id, {
      confirmado: true,
      data,
      pagamentos: [
        { meio: 'dinheiro', valor: 50.00, caixaId: caixa1.id },
        { meio: 'pix', valor: 50.00 },
      ],
      lojaId,
      usuario: 'operador@dino.com.br',
    });

    // Lança despesa no ERP de R$ 30 (café/limpeza)
    financeiroKytto.registrarLancamento(empresaId, {
      tipo: 'despesa',
      categoria: 'Insumos / Limpeza',
      descricao: 'Café e copos descartáveis',
      valor: 30.00,
      status: 'pago',
      meioPagamento: 'pix',
      dataOperacao: data,
      pagoEm: data,
      lojaId,
    });

    // Obtém a conciliação
    const res = obterFechamentoDiarioEConciliacao(empresaId, data, { lojaId });
    assert.equal(res.ok, true);
    assert.equal(res.statusGeral, 'pendente'); // Pois o caixa 1 ainda está aberto
    assert.equal(res.kpisGestao.faturamentoBruto, 100.00);
    assert.equal(res.kpisGestao.totalRecebidoLiquido, 100.00);
    assert.equal(res.kpisGestao.totalDespesasPagas, 30.00);
    assert.equal(res.kpisGestao.saldoLiquidoDia, 70.00);
    assert.equal(res.kpisGestao.totalServicos, 1);
    assert.equal(res.kpisGestao.totalProdutos, 1);

    // Valida linhas de conciliação Meio a Meio
    const linhaDinheiro = res.conciliacao.find((l) => l.chave === 'dinheiro');
    assert.equal(linhaDinheiro.operacao, 50.00);
    assert.equal(linhaDinheiro.erp, 50.00);
    assert.equal(linhaDinheiro.diferenca, 0);
    assert.equal(linhaDinheiro.status, 'conciliado');
    // Esperado na gaveta: 150 (abertura) + 50 (suprimento) + 50 (dinheiro da comanda) = 250
    assert.equal(linhaDinheiro.esperadoGaveta, 250.00);

    const linhaPix = res.conciliacao.find((l) => l.chave === 'pix');
    assert.equal(linhaPix.operacao, 50.00);
    assert.equal(linhaPix.erp, 50.00);
    assert.equal(linhaPix.status, 'conciliado');
  });

  await t.test('3. Deve executar fechamento diário integrado com sucesso', () => {
    const fechamento = executarFechamentoDiarioIntegrado(empresaId, {
      data,
      lojaId,
      usuario: 'gerente@dino.com.br',
      observacao: 'Fechamento de conferência diária homologada',
    });

    assert.equal(fechamento.ok, true);
    assert.equal(fechamento.caixasFechados, 1);
    assert.ok(fechamento.fechamento);

    // Verifica que agora o status está conciliado e o dia fechado
    const res = obterFechamentoDiarioEConciliacao(empresaId, data, { lojaId });
    assert.equal(res.statusGeral, 'conciliado');
    assert.equal(res.diaFechado, true);
    assert.equal(res.caixas[0].status, 'fechado');
    assert.equal(res.caixas[0].valorEsperado, 250.00);
    assert.equal(res.caixas[0].valorInformado, 250.00);
    assert.equal(res.caixas[0].quebraCaixa, 0);
  });

  await t.test('4. Deve permitir reabertura do fechamento diário integrado', () => {
    const reab = reabrirFechamentoDiarioIntegrado(empresaId, data, {
      lojaId,
      usuario: 'gerente@dino.com.br',
      motivo: 'Ajuste de comanda com valor incorreto',
      reabrirCaixas: true,
    });

    assert.equal(reab.ok, true);
    assert.equal(reab.reaberto, true);
    assert.equal(reab.caixasReabertos, 1);

    const res = obterFechamentoDiarioEConciliacao(empresaId, data, { lojaId });
    assert.equal(res.caixas[0].status, 'aberto');
    assert.equal(res.statusGeral, 'pendente');
  });

  await t.test('5. Deve listar todas as empresas do sistema para fechamento separado', () => {
    const empresas = listarEmpresasParaFechamento();
    assert.ok(Array.isArray(empresas));
    assert.ok(empresas.length >= 3);
    assert.ok(empresas.some(e => e.id === DINO_EMPRESA_CANONICA));
    assert.ok(empresas.some(e => e.slug === 'stallone' || e.id === '31f70c83-9172-40c2-945f-9e793b5048be'));
    assert.ok(empresas.some(e => e.slug === 'agroopen' || e.id === '2e041110-db20-4fd1-8278-12bd3dead008'));
  });

  await t.test('6. Deve fechar todos os caixas da empresa em lote de maneira separada e segura', () => {
    const empStallone = '31f70c83-9172-40c2-945f-9e793b5048be';
    const dataStallone = '2026-11-05';
    
    // Abre 2 caixas na empresa Stallone
    const cx1 = abrirNovoCaixaEmpresa(empStallone, {
      data: dataStallone,
      numeroCaixa: 1,
      nomeCaixa: 'Caixa Suplementos 1',
      valorAbertura: 100.00,
      responsavel: 'Vendedor 1',
    });
    const cx2 = abrirNovoCaixaEmpresa(empStallone, {
      data: dataStallone,
      numeroCaixa: 2,
      nomeCaixa: 'Caixa Suplementos 2',
      valorAbertura: 200.00,
      responsavel: 'Vendedor 2',
    });

    assert.equal(cx1.status, 'aberto');
    assert.equal(cx2.status, 'aberto');

    // Fecha todos os caixas da Stallone em lote
    const resLote = fecharTodosOsCaixasDaEmpresa(empStallone, {
      data: dataStallone,
      usuario: 'gerente@stallone.com.br',
      valoresPorCaixa: {
        [cx1.id]: 100.00,
        [cx2.id]: 200.00,
      },
      observacao: 'Fechamento em lote Stallone',
    });

    assert.equal(resLote.ok, true);
    assert.equal(resLote.caixasFechados, 2);
    assert.equal(resLote.empresaId, empStallone);

    // Verifica que ambos os caixas estão fechados e o dia está fechado
    const resStallone = obterFechamentoDiarioEConciliacao(empStallone, dataStallone);
    assert.equal(resStallone.diaFechado, true);
    assert.equal(resStallone.caixas.every(c => c.status === 'fechado'), true);
  });
});
