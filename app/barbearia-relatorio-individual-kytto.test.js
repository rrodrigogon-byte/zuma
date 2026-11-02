import test from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';
import * as barbearia from './barbearia-erp-kytto.js';
import {
  normalizarFaixasComissao,
  calcularFaixaBonificacao,
} from './barbearia-erp-kytto.js';
import {
  resolverPeriodo,
  ehServicoExtra,
  categorizarServico,
  relatorioIndividualProfissional,
  relatorioEquipeMetasComissoes,
} from './barbearia-relatorio-individual-kytto.js';

test('Faixas de bonificação progressiva: cálculo exato do caso Naty', () => {
  const faixasNaty = [
    { metaFaturamento: 10000, bonusPercentual: 5, descricao: '1ª Meta (45%)' },
    { metaFaturamento: 15000, bonusPercentual: 7, descricao: '2ª Meta (47%)' },
    { metaFaturamento: 20000, bonusPercentual: 10, descricao: '3ª Meta (50%)' },
  ];

  const normalizadas = normalizarFaixasComissao(faixasNaty);
  assert.equal(normalizadas.length, 3);
  assert.equal(normalizadas[0].metaFaturamento, 10000);
  assert.equal(normalizadas[1].bonusPercentual, 7);

  // Cenário 1: faturou R$ 8.000 (abaixo da 1ª meta)
  const r8k = calcularFaixaBonificacao(8000, 40, faixasNaty);
  assert.equal(r8k.bonusPercentual, 0);
  assert.equal(r8k.percentualEfetivo, 40);
  assert.equal(r8k.faixaAtual, null);
  assert.equal(r8k.proximaFaixa.metaFaturamento, 10000);
  assert.equal(r8k.faltaParaProxima, 2000);
  assert.equal(r8k.progressoPct, 80);

  // Cenário 2: Naty faturou R$ 18.000 (atingiu a 2ª meta de R$ 15.000, faltam R$ 2.000 para a 3ª meta de R$ 20.000)
  const r18k = calcularFaixaBonificacao(18000, 40, faixasNaty);
  assert.equal(r18k.bonusPercentual, 7);
  assert.equal(r18k.percentualEfetivo, 47); // 40% + 7% = 47%
  assert.equal(r18k.faixaAtual.descricao, '2ª Meta (47%)');
  assert.equal(r18k.proximaFaixa.metaFaturamento, 20000);
  assert.equal(r18k.faltaParaProxima, 2000);
  assert.equal(r18k.progressoPct, 60); // 18k está a 60% entre 15k e 20k
  assert.match(r18k.mensagemStatus, /atingiu 2ª Meta \(47%\)/);
  assert.match(r18k.mensagemStatus, /faltam R\$ 2\.000,00 para alcançar a próxima meta \(50%\)/);

  // Cenário 3: faturou R$ 22.000 (atingiu o teto máximo da 3ª meta de R$ 20.000)
  const r22k = calcularFaixaBonificacao(22000, 40, faixasNaty);
  assert.equal(r22k.bonusPercentual, 10);
  assert.equal(r22k.percentualEfetivo, 50); // 40% + 10% = 50%
  assert.equal(r22k.proximaFaixa, null);
  assert.equal(r22k.faltaParaProxima, 0);
  assert.equal(r22k.progressoPct, 100);
  assert.match(r22k.mensagemStatus, /teto máximo de bonificação: 50%/);
});

test('Comissões de produtos separadas com metas próprias', () => {
  const faixasProdutos = [
    { metaFaturamento: 1000, bonusPercentual: 2, descricao: 'Meta 1 Produtos (12%)' },
    { metaFaturamento: 2500, bonusPercentual: 5, descricao: 'Meta 2 Produtos (15%)' },
  ];

  // Faturou R$ 1.200 em produtos (base 10% + 2% bônus = 12%)
  const rProd = calcularFaixaBonificacao(1200, 10, faixasProdutos);
  assert.equal(rProd.bonusPercentual, 2);
  assert.equal(rProd.percentualEfetivo, 12);
  assert.equal(rProd.proximaFaixa.metaFaturamento, 2500);
  assert.equal(rProd.faltaParaProxima, 1300);
});

test('Resolução de períodos rápidos: dia, semana, quinzena e mês', () => {
  const dataFixa = new Date('2026-10-25T14:00:00Z'); // 25/10/2026 (Domingo)

  const dia = resolverPeriodo('dia', { dataReferencia: dataFixa });
  assert.equal(dia.inicio, '2026-10-25');
  assert.equal(dia.fim, '2026-10-25');

  const semana = resolverPeriodo('semana', { dataReferencia: dataFixa });
  assert.equal(semana.inicio, '2026-10-19'); // Segunda-feira
  assert.equal(semana.fim, '2026-10-25'); // Domingo

  const quinzena = resolverPeriodo('quinzena', { dataReferencia: dataFixa });
  assert.equal(quinzena.quinzenaNumero, 2);
  assert.equal(quinzena.inicio, '2026-10-16');
  assert.equal(quinzena.fim, '2026-10-31');

  const mes = resolverPeriodo('mes', { dataReferencia: dataFixa });
  assert.equal(mes.inicio, '2026-10-01');
  assert.equal(mes.fim, '2026-10-31');
});

test('Detecção de serviços extras e categorização de procedimentos', () => {
  assert.equal(ehServicoExtra('Hidratação Capilar Profunda'), true);
  assert.equal(ehServicoExtra('Design de Sobrancelha'), true);
  assert.equal(ehServicoExtra('Pigmentação de Barba'), true);
  assert.equal(ehServicoExtra('Selagem Térmica'), true);
  assert.equal(ehServicoExtra('Botox Capilar'), true);
  assert.equal(ehServicoExtra('Corte Degradê Navalhado'), false);
  assert.equal(ehServicoExtra('Barba Modelada'), false);

  assert.equal(categorizarServico('Corte Degradê'), 'Cabelo & Cortes');
  assert.equal(categorizarServico('Barba com Toalha Quente'), 'Barba & Modelagem');
  assert.equal(categorizarServico('Pigmentação de Barba'), 'Procedimentos & Extras');
  assert.equal(categorizarServico('Hidratação Ozonizada'), 'Procedimentos & Extras');
});

test('Relatório Individual Completo: Faturamento, Categorias, Planos, Extras nominais e Produtos', () => {
  reset();
  const empresaId = 'emp-relatorio-teste';

  // 1. Cadastra Naty com faixas de metas de serviços e produtos
  const naty = barbearia.criarProfissional(empresaId, {
    nome: 'Naty Barbeira',
    percentualComissao: 40,
    percentualComissaoProduto: 10,
    faixasComissaoServico: [
      { metaFaturamento: 100, bonusPercentual: 5, descricao: 'Meta 1 (45%)' },
      { metaFaturamento: 200, bonusPercentual: 10, descricao: 'Meta 2 (50%)' },
    ],
    faixasComissaoProduto: [
      { metaFaturamento: 50, bonusPercentual: 5, descricao: 'Meta Prod (15%)' },
    ],
  });

  // 2. Cadastra serviços
  const corte = barbearia.criarServico(empresaId, { nome: 'Corte Degradê', preco: 60, duracaoMinutos: 30, categoria: 'Cabelo' });
  const barba = barbearia.criarServico(empresaId, { nome: 'Barba Terapia', preco: 50, duracaoMinutos: 30, categoria: 'Barba' });
  const hidratacao = barbearia.criarServico(empresaId, { nome: 'Hidratação Capilar', preco: 80, duracaoMinutos: 40, categoria: 'Procedimentos' });
  const pigmentacao = barbearia.criarServico(empresaId, { nome: 'Pigmentação', preco: 40, duracaoMinutos: 30, categoria: 'Procedimentos' });

  // 3. Cadastra produto
  const pomada = barbearia.criarProdutoRevenda(empresaId, { nome: 'Pomada Matte Dino', precoVenda: 50, precoCusto: 20, estoqueAtual: 20 });

  // 4. Cria comanda paga com serviços normais, serviços extras e produtos
  const comanda = barbearia.criarComandaBarbearia(empresaId, {
    lojaId: 'loja-1',
    profissionalId: naty.id,
    clienteNome: 'João Silva',
  });

  barbearia.adicionarItensComandaBarbearia(empresaId, comanda.id, [
    { tipo: 'servico', servicoId: corte.id, profissionalId: naty.id },
    { tipo: 'servico', servicoId: barba.id, profissionalId: naty.id },
    { tipo: 'servico', servicoId: hidratacao.id, profissionalId: naty.id },
    { tipo: 'servico', servicoId: pigmentacao.id, profissionalId: naty.id },
    { tipo: 'produto', produtoId: pomada.id, profissionalId: naty.id },
  ]);

  // Total serviços = 60 + 50 + 80 + 40 = R$ 230 (atinge Meta 2 de R$ 200 -> 50% de comissão!)
  // Total produtos = R$ 50 (atinge Meta Prod de R$ 50 -> 15% de comissão!)
  barbearia.registrarPagamentoComandaBarbearia(empresaId, comanda.id, {
    confirmado: true,
    pagamentos: [{ meio: 'pix', valor: 280 }],
  });

  // 5. Gera o relatório individual da Naty
  const hoje = barbearia.obterComissoes(empresaId).data;
  const relatorio = relatorioIndividualProfissional(empresaId, naty.id, {
    periodo: 'dia',
    inicio: hoje,
    fim: hoje,
  });

  // Verificações do Faturamento e Bonificações
  assert.equal(relatorio.profissional.nome, 'Naty Barbeira');
  assert.equal(relatorio.faturamento.brutoServicos, 230);
  assert.equal(relatorio.faturamento.brutoProdutos, 50);
  assert.equal(relatorio.faturamento.brutoTotal, 280);

  // Bonificação de serviços: 50% de 230 = 115
  assert.equal(relatorio.metasEvolucao.servicos.percentualEfetivo, 50);
  assert.equal(relatorio.metasEvolucao.servicos.bonusPercentual, 10);
  assert.equal(relatorio.faturamento.comissaoServicos, 115);

  // Bonificação de produtos: 15% de 50 = 7.50
  assert.equal(relatorio.metasEvolucao.produtos.percentualEfetivo, 15);
  assert.equal(relatorio.metasEvolucao.produtos.bonusPercentual, 5);
  assert.equal(relatorio.faturamento.comissaoProdutos, 7.5);

  // Relatório de Categorias
  assert.ok(relatorio.servicosPorCategoria.length >= 2);
  const catProcedimentos = relatorio.servicosPorCategoria.find((c) => c.categoria === 'Procedimentos' || c.categoria === 'Procedimentos & Extras');
  assert.ok(catProcedimentos);
  assert.equal(catProcedimentos.quantidade, 2); // Hidratação + Pigmentação
  assert.equal(catProcedimentos.faturamento, 120); // 80 + 40

  // Relatório de Serviços Extras: lista nominal dos clientes
  assert.equal(relatorio.servicosExtras.quantidadeTotal, 2);
  assert.equal(relatorio.servicosExtras.faturamentoTotal, 120);
  assert.equal(relatorio.servicosExtras.clientesAtendidos.length, 2);
  assert.equal(relatorio.servicosExtras.clientesAtendidos[0].cliente, 'João Silva');

  // Relatório de Produtos
  assert.equal(relatorio.produtos.unidadesVendidas, 1);
  assert.equal(relatorio.produtos.faturamentoBruto, 50);
  assert.equal(relatorio.produtos.percentualEfetivo, 15);
  assert.equal(relatorio.produtos.comissaoTotal, 7.5);
  assert.equal(relatorio.produtos.itens[0].nome, 'Pomada Matte Dino');

  // 6. Relatório Geral da Equipe
  const relEquipe = relatorioEquipeMetasComissoes(empresaId, { periodo: 'dia', inicio: hoje, fim: hoje });
  assert.equal(relEquipe.equipe.length, 1);
  assert.equal(relEquipe.equipe[0].profissional.nome, 'Naty Barbeira');
  assert.equal(relEquipe.totaisGerais.faturamentoBrutoTotal, 280);
});

test('Integração de histórico Avec/legado no relatório individual e equipe', () => {
  reset();
  const empresaId = 'emp-teste-hist-avec';
  const profNaty = barbearia.criarProfissional(empresaId, {
    nome: 'Natani',
    especialidade: 'Barbeira Master',
    percentualComissao: 40,
    percentualComissaoProduto: 10,
    faixasComissaoServico: [
      { metaFaturamento: 100, bonusPercentual: 5, descricao: 'Meta 100 (+5%)' }
    ]
  });

  // Importa atendimentos históricos do Avec com o nome "Natani Minanis Dobler"
  barbearia.importarHistoricoAtendimentos(empresaId, [
    {
      dataAgenda: '2026-09-15',
      hora: '14:00',
      clienteNome: 'Marcos Histórico',
      profissionalNome: 'Natani Minanis Dobler',
      servicoNome: 'Corte Fade',
      valor: 80,
      status: 'concluido'
    },
    {
      dataAgenda: '2026-09-20',
      hora: '15:30',
      clienteNome: 'Lucas Histórico',
      profissionalNome: 'Natani Minanis Dobler',
      servicoNome: 'Pomada Modeladora',
      valor: 50,
      status: 'concluido'
    },
    {
      dataAgenda: '2026-10-10',
      hora: '16:00',
      clienteNome: 'Roberto Histórico',
      profissionalNome: 'Natani Minanis Dobler',
      servicoNome: 'Hidratação Capilar',
      valor: 120,
      status: 'concluido'
    }
  ]);

  // Consulta por "tudo" (todo o histórico completo)
  const relTudo = relatorioIndividualProfissional(empresaId, profNaty.id, { periodo: 'tudo' });
  assert.equal(relTudo.faturamento.brutoServicos, 200); // 80 + 120 (atinge a meta de 100 -> 45%)
  assert.equal(relTudo.faturamento.brutoProdutos, 50); // 50
  assert.equal(relTudo.faturamento.brutoTotal, 250);
  assert.equal(relTudo.metasEvolucao.servicos.percentualEfetivo, 45);
  assert.equal(relTudo.faturamento.comissaoServicos, 90); // 45% de 200
  assert.equal(relTudo.servicosExtras.quantidadeTotal, 1); // Hidratação Capilar
  assert.equal(relTudo.servicosExtras.clientesAtendidos[0].cliente, 'Roberto Histórico');

  // Consulta por mês de outubro (2026-10)
  // Período fechado e explícito: com 'mes' o relatório usa o mês corrente e o teste
  // quebrava ao virar o mês (01/11).
  const relMes = relatorioIndividualProfissional(empresaId, profNaty.id, { periodo: 'custom', inicio: '2026-10-01', fim: '2026-10-31' });
  assert.equal(relMes.faturamento.brutoServicos, 120); // Somente 10/10
  assert.equal(relMes.faturamento.brutoProdutos, 0);

  // Consulta da equipe inteira
  const relEquipe = relatorioEquipeMetasComissoes(empresaId, { periodo: 'tudo' });
  assert.equal(relEquipe.equipe[0].profissional.nome, 'Natani');
  assert.equal(relEquipe.equipe[0].faturamento.brutoTotal, 250);
});
