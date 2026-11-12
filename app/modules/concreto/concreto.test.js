import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterDadosConcreto,
  criarCargaConcreto,
  atualizarStatusCarga,
  registrarEventoViagem,
  registrarRupturaCorpoProva,
  calcularDosagemAvancada,
  criarPropostaComercial,
  atualizarStatusProposta,
  atualizarStatusVeiculoFrota,
  registrarMovimentacaoInsumoSilo,
  gerarListaTecnicaBOM,
  listarComprasInsumos,
  criarPedidoCompraInsumo,
  registrarRecebimentoPesagemCompra,
  calcularCustoConcretoAvancado,
  listarOrdensProducao,
  criarOrdemProducao,
  concluirOrdemProducao,
  INSUMOS_MATERIA_PRIMA,
  TRACOS_NORMATIZADOS
} from './servico.js';
import { CONCRETO_EMPRESA_ID } from '../../concreto-usina-seed.js';

test('1. Obter dados completos de concreto e mineração', async () => {
  const dados = await obterDadosConcreto(CONCRETO_EMPRESA_ID);
  assert.equal(dados.ok, true);
  assert.ok(dados.empresa, 'Deve conter empresa');
  assert.equal(dados.empresa.cnpj, '51.499.928/0001-01');
  assert.ok(dados.cargas.length >= 3, 'Deve conter cargas');
  assert.ok(dados.catalogo.length >= 10, 'Deve conter catálogo');
  assert.ok(dados.frota.length >= 7, 'Deve conter frota');
  assert.ok(dados.ensaios.length >= 2, 'Deve conter ensaios de laboratório');
  assert.ok(dados.silos.length >= 5, 'Deve conter silos e pátios da mineração');
  assert.ok(dados.propostas.length >= 1, 'Deve conter propostas comerciais');
  assert.ok(dados.compras.length >= 3, 'Deve conter pedidos de compra de insumos');
  assert.ok(dados.ordensProducao.length >= 2, 'Deve conter ordens de produção');
  assert.ok(dados.listasTecnicas.length >= 7, 'Deve conter fichas técnicas BOM FCK 15 a 45');
  assert.ok(dados.kpis.volumeProgramadoHoje > 0, 'KPIs operacionais calculados');
});

test('2. Calculadora de dosagem NBR 7212 com correção de umidade da areia', () => {
  const dosagem = calcularDosagemAvancada({
    fck: 30,
    volumeM3: 8,
    umidadeAreiaPercent: 5.0, // 5% de umidade na areia
    brita: 'Brita 1'
  });

  assert.equal(dosagem.fck, 30);
  assert.equal(dosagem.volumeM3, 8);
  assert.ok(dosagem.totalCargaBetoneira.cimentoTotalKg > 0);
  assert.ok(dosagem.totalCargaBetoneira.areiaTotalKg > 0);
  assert.ok(dosagem.totalCargaBetoneira.britaTotalKg > 0);
  assert.ok(dosagem.porMetroCubico.aguaDescontadaLitros > 0, 'Deve descontar água contida na areia úmida');
  assert.ok(dosagem.porMetroCubico.aguaCorrigidaLitros < 170, 'Água de amassamento corrigida para baixo');
});

test('3. Gerar Lista Técnica (BOM) completa de fabricação de concreto', () => {
  const boms = gerarListaTecnicaBOM();
  assert.equal(boms.length, 7, 'Deve conter 7 traços normatizados de FCK 15 a 45');

  const bom25 = boms.find(b => b.fck === 25);
  assert.ok(bom25, 'BOM FCK 25 deve existir');
  assert.equal(bom25.codigo, 'BOM-FCK-25');
  assert.ok(bom25.custoDiretoInsumosM3 > 0, 'Custo direto de insumos deve ser positivo');
  assert.ok(bom25.componentes.length >= 5, 'Deve conter cimento, areia, brita, água e aditivo');
  assert.ok(bom25.proporcaoMassa.startsWith('1 :'), 'Proporção em massa normatizada');

  const bom35 = boms.find(b => b.fck === 35);
  assert.ok(bom35.componentes.some(c => c.nome.toLowerCase().includes('fibras')), 'FCK 35 para pisos deve conter microfibras');
});

test('4. Motor de Compras de Matérias-Primas e Entrada com Pesagem nos Silos', async () => {
  const resCompras = await listarComprasInsumos(CONCRETO_EMPRESA_ID);
  assert.equal(resCompras.ok, true);
  assert.ok(resCompras.compras.length >= 3);
  assert.ok(resCompras.insumosCatalogo.length >= 8);

  // Criar novo pedido de compra de cimento a granel
  const resCriacao = await criarPedidoCompraInsumo({
    insumoId: 'ins-cim-cp2',
    quantidade: 40.0, // 40 toneladas em Bitrem
    fornecedor: 'Votorantim Cimentos S/A (Nobres/MT)',
    formaPagamento: 'Boleto Bancário 30 DDL'
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resCriacao.ok, true);
  assert.ok(resCriacao.pedido.numero.startsWith('PC-2026-'));
  assert.equal(resCriacao.pedido.quantidade, 40.0);
  assert.equal(resCriacao.pedido.status, 'solicitado');
  assert.equal(resCriacao.pedido.valorTotal, 40.0 * 580.00);

  // Registrar recebimento na balança da usina
  const resEntrada = await registrarRecebimentoPesagemCompra(resCriacao.pedido.id, {
    pesoBalançaEntradaTon: 40.25,
    notaFiscal: 'NF-e 109.845',
    responsavelRecebimento: 'Carlos Eduardo (Operador Central Convicta)'
  });

  assert.equal(resEntrada.ok, true);
  assert.equal(resEntrada.pedido.status, 'entregue_pesado');
  assert.equal(resEntrada.pedido.pesoBalançaEntradaTon, 40.25);
  assert.ok(resEntrada.siloAtualizado, 'Silo Convicta deve ter sido abastecido');
  assert.ok(resEntrada.siloAtualizado.estoqueAtualTon > 0);
});

test('5. Calculadora Industrial de Custos e Formação de Preço (Costing Engine)', () => {
  const resultado = calcularCustoConcretoAvancado({
    fck: 30,
    volumeM3: 24,
    distanciaKm: 18,
    tipoBomba: 'Bomba Lança 32m',
    bdiPercent: 25.0,
    margemDesejadaPercent: 18.0
  });

  assert.equal(resultado.fck, 30);
  assert.equal(resultado.volumeM3, 24);
  assert.ok(resultado.decomposicaoCustosM3.cpvInsumos > 200, 'CPV de insumos coerente');
  assert.ok(resultado.decomposicaoCustosM3.usinagemCentral > 0, 'Custo de usinagem apurado');
  assert.ok(resultado.decomposicaoCustosM3.freteBetoneira > 0, 'Custo de frete por km apurado');
  assert.ok(resultado.decomposicaoCustosM3.servicoBomba > 0, 'Custo de bombeamento incluído');
  assert.ok(resultado.precificacao.precoSugeridoVendaM3 > resultado.decomposicaoCustosM3.custoDiretoTotal, 'Preço de venda deve cobrir custos diretos e tributos');
  assert.ok(resultado.precificacao.margemContribuicaoM3 > 0, 'Margem de contribuição positiva');
  assert.ok(resultado.precificacao.margemContribuicaoPercent >= 15.0, 'Margem percentual consistente');
});

test('6. Ordens de Produção (OP) de Concreto com Baixa nos Silos', async () => {
  const resOPs = await listarOrdensProducao(CONCRETO_EMPRESA_ID);
  assert.equal(resOPs.ok, true);
  assert.ok(resOPs.ordens.length >= 2);

  // Criar nova OP
  const resCriar = await criarOrdemProducao({
    cliente: 'Edifício Residencial Horizonte',
    obra: 'Vigas do 5º Pavimento',
    fck: 25,
    volumeM3: 16,
    betoneirasEscaladas: ['BT-01', 'BT-02']
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resCriar.ok, true);
  assert.ok(resCriar.ordemProducao.numero.startsWith('OP-2026-'));
  assert.equal(resCriar.ordemProducao.fck, 25);
  assert.equal(resCriar.ordemProducao.volumeM3, 16);
  assert.ok(resCriar.ordemProducao.consumoTeorico.cimentoKg > 5000);
  assert.equal(resCriar.ordemProducao.status, 'planejada');

  // Concluir OP com baixa no Silo Convicta e Pátio da Mineração
  const resConcluir = await concluirOrdemProducao(resCriar.ordemProducao.id, {
    cimentoKg: 5460,
    areiaKg: 14900,
    britaKg: 18400,
    aguaL: 2800,
    aditivoL: 43.2
  });

  assert.equal(resConcluir.ok, true);
  assert.equal(resConcluir.ordemProducao.status, 'concluida');
  assert.ok(resConcluir.silosAtualizados.length >= 3, 'Deve atualizar cimento, areia e brita');
});
