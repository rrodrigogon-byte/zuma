import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularTributacaoReforma,
  simularImpactoCargaTributaria,
  CONFIG_REFORMA_TRIBUTARIA
} from './core/reforma-tributaria-ibs-cbs.js';
import {
  criarProdutoComGrade,
  gerarPayloadNotaDevolucao
} from './core/varejo-grade-multicanal.js';
import {
  calcularFilaDaVezProfissionais,
  gerarSugestoesUpsell
} from './core/dino-regras-atendimento-avancado.js';

test('Kytto Enterprise ERP - Suíte de Excelência 100% (Reforma Tributária, Grade & Balcão)', async (t) => {
  await t.test('1. Reforma Tributária (IBS/CBS): Cálculo de Teste 2026 (0,9% CBS + 0,1% IBS)', () => {
    const res = calcularTributacaoReforma({
      valorOperacao: 200.0,
      tipoOperacao: 'servico',
      anoCompetencia: 2026,
      ufDestino: 'MT'
    });

    assert.equal(res.baseCalculo, 200.0);
    assert.equal(res.cbs.valor, 1.80, 'CBS 0,9% sobre R$ 200 deve ser R$ 1,80');
    assert.equal(res.ibs.valor, 0.20, 'IBS 0,1% sobre R$ 200 deve ser R$ 0,20');
    assert.equal(res.ibs.reparticao.estadualMT, 0.15, '75% do IBS MT deve ser R$ 0,15');
    assert.equal(res.ibs.reparticao.municipalTangara, 0.05, '25% do IBS Tangará deve ser R$ 0,05');
    assert.equal(res.totalTributosDual, 2.00, 'Total tributos teste deve ser R$ 2,00');
    assert.equal(res.splitPayment.repasseLiquidoEmpresa, 198.00, 'Líquido após split payment deve ser R$ 198,00');
  });

  await t.test('2. Reforma Tributária: Imposto Seletivo (IS 12%) sobre Bebidas Alcoólicas do Bar', () => {
    const res = calcularTributacaoReforma({
      valorOperacao: 100.0,
      tipoOperacao: 'bebida_alcoolica',
      anoCompetencia: 2026,
      ufDestino: 'MT'
    });

    assert.equal(res.is.incide, true, 'IS deve incidir sobre bebidas alcoólicas');
    assert.equal(res.is.valor, 12.00, 'IS 12% sobre R$ 100 deve ser R$ 12,00');
    assert.equal(res.totalTributosDual, 13.00, 'CBS (0,90) + IBS (0,10) + IS (12,00) = R$ 13,00');
    assert.equal(res.splitPayment.repasseLiquidoEmpresa, 87.00);
  });

  await t.test('3. Planejamento Tributário: Simulação de Carga Simples Nacional vs Dual 2033', () => {
    const sim = simularImpactoCargaTributaria({
      faturamentoMensal: 60000,
      regimeAtual: 'simples_nacional'
    });

    assert.equal(sim.faturamentoMensal, 60000);
    assert.equal(sim.cenarioAtual.valorRecolhidoMensal, 3600.0, '6% de R$ 60.000 deve ser R$ 3.600');
    assert.equal(sim.cenarioTransicao2026.valorMensal, 600.0, '1% teste de R$ 60.000 deve ser R$ 600');
    assert.ok(sim.recomendacaoEstrategica.includes('Lei do Salão Parceiro'));
  });

  await t.test('4. Varejo Stallone Nutre Sport: Grade Multidimensional de Sabores e Tamanhos', () => {
    const whey = criarProdutoComGrade({
      nome: 'Whey Protein 100%',
      codigoPai: 'STL-WHEY-100'
    });

    assert.equal(whey.codigoPai, 'STL-WHEY-100');
    assert.equal(whey.totalVariacoes, 5, 'Deve gerar 5 SKUs filhos');
    assert.equal(whey.estoqueTotalPai, 77, 'Soma do estoque de todos os sabores deve ser 77');

    const choc900 = whey.skus.find(s => s.sabor === 'Chocolate Belga' && s.tamanhoPeso === '900g');
    assert.ok(choc900, 'SKU Chocolate Belga 900g deve existir');
    assert.equal(choc900.precos.lojaFisica, 149.90, 'Preço de loja física deve ser R$ 149,90');
    assert.equal(choc900.precos.ecommerce, 139.90, 'Preço e-commerce deve ter desconto');
    assert.equal(choc900.precos.atacadoB2B, 115.00, 'Preço atacado B2B para revenda');
  });

  await t.test('5. Varejo: Emissão de Nota de Devolução com Chave de Acesso Referenciada (CFOP 1.202)', () => {
    const payload = gerarPayloadNotaDevolucao({
      chaveAcessoOriginal: '51261150073355000260550010000010421893748291',
      numeroNfOriginal: '1042',
      motivoDevolucao: 'Troca de mercadoria',
      itensDevolvidos: [
        { sku: 'STL-WHEY-CHOC-900G', descricao: 'Whey 900g', quantidade: 2, valorUnitario: 140.0 }
      ]
    });

    assert.equal(payload.cfop, '1.202');
    assert.equal(payload.finalidade, 4, 'Finalidade 4 = NF-e de Devolução');
    assert.equal(payload.documentoReferenciado.chaveAcessoReferenciada, '51261150073355000260550010000010421893748291');
    assert.equal(payload.valorTotalDevolucao, 280.00);
    assert.equal(payload.acaoEstoque, 'RETORNO_AUTOMATICO_AO_ESTOQUE_FISICO');
  });

  await t.test('6. Barbearia Dino: Fila da Vez (Rodízio Justo de Barbeiros) e Equidade de Atendimentos', () => {
    const barbeiros = [
      { id: 'b1', nome: 'Bruno', ativo: true, presente: true },
      { id: 'b2', nome: 'Nati', ativo: true, presente: true },
      { id: 'b3', nome: 'David', ativo: true, presente: true }
    ];

    const historicoHoje = [
      { profissionalId: 'b1', status: 'concluido' },
      { profissionalId: 'b1', status: 'concluido' },
      { profissionalId: 'b2', status: 'concluido' },
      { profissionalId: 'b3', status: 'em_atendimento' }
    ];

    const fila = calcularFilaDaVezProfissionais(barbeiros, historicoHoje);
    assert.equal(fila.length, 3);
    // Nati fez apenas 1 atendimento e não está em atendimento, portanto deve ser a 1ª da fila!
    assert.equal(fila[0].profissionalNome, 'Nati');
    assert.equal(fila[0].eProximo, true);
    assert.equal(fila[0].statusDisponibilidade, 'PRÓXIMO_DA_VEZ');
    // David está em atendimento, logo deve ser o último
    assert.equal(fila[2].profissionalNome, 'David');
    assert.equal(fila[2].statusDisponibilidade, 'EM_ATENDIMENTO');
  });

  await t.test('7. Barbearia Dino: Motor de Upsell Inteligente com Sugestões de Barba e Pomada', () => {
    const sugestoes = gerarSugestoesUpsell({
      servicosAtuais: [{ nome: 'Corte Degrade Premium' }],
      produtosAtuais: []
    });

    assert.ok(sugestoes.length >= 2, 'Deve sugerir serviços e produtos adicionais');
    const barbaSug = sugestoes.find(s => s.item.id === 'srv-barba');
    assert.ok(barbaSug, 'Deve sugerir Barba Terapia');
    assert.equal(barbaSug.descontoCombo, 10.0, 'Desconto combo de R$ 10');

    const pomadaSug = sugestoes.find(s => s.item.id === 'prod-pomada-matte');
    assert.ok(pomadaSug, 'Deve sugerir Pomada Matte');
    assert.equal(pomadaSug.comissaoBarbeiro, 4.5, 'Comissão do barbeiro de R$ 4,50');
  });
});
