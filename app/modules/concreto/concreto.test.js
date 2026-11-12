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
  listarMineracao,
  registrarExtracaoDraga,
  emitirRomaneioVendaAgregado,
  calcularEstatisticaResistenciaLote,
  gerarHtmlRomaneioOficial,
  assinarEntregaCarga,
  obterRomaneioCompleto,
  emitirTicketPesagemBalanca,
  gerarHtmlTicketBalanca,
  obterStatusBalancaAutomacao,
  executarComandoBalanca,
  registrarEntradaVeiculo,
  concluirSegundaPesagemBalanca,
  listarTicketsBalanca,
  listarMedicoesObras,
  criarMedicaoObra,
  atualizarStatusMedicao,
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


test('7. Serrano Mineração: Dragas, pátios de areia e venda de agregados com CFEM', async () => {
  const resMin = await listarMineracao(CONCRETO_EMPRESA_ID);
  assert.equal(resMin.ok, true);
  assert.ok(resMin.dragas.length >= 2, 'Deve ter pelo menos 2 dragas');
  assert.ok(resMin.patios.length >= 4, 'Deve ter pátios de areia e brita');
  assert.ok(resMin.vendas.length >= 2, 'Deve ter romaneios de venda avulsa');
  assert.ok(resMin.resumo.totalAreiaExtraidaHoje > 0);
  assert.ok(resMin.resumo.totalCfemApurado > 0);

  // Registrar extração de draga
  const resExtracao = await registrarExtracaoDraga('draga-01', {
    volumeM3: 45,
    horimetro: 3425,
    status: 'em_operacao',
    umidadeSuperficial: 4.6
  }, CONCRETO_EMPRESA_ID);
  assert.equal(resExtracao.ok, true);
  assert.ok(resExtracao.draga.producaoHojeM3 >= 225);

  // Emitir romaneio de venda de areia na balança com CFEM
  const resVenda = await emitirRomaneioVendaAgregado({
    cliente: 'Construtora Pantanal Norte',
    cnpjCliente: '12.345.678/0001-99',
    obraDestino: 'Obras de Drenagem Av. Brasil',
    veiculoPlaca: 'RAQ-4455',
    motorista: 'Sebastião Alves',
    produtoId: 'ins-areia-med',
    produtoNome: 'Areia Média Lavada de Rio (Serrano Mineração)',
    pesoBrutoKg: 27500,
    taraKg: 12500,
    precoUnitarioM3: 65.00
  }, CONCRETO_EMPRESA_ID);
  assert.equal(resVenda.ok, true);
  assert.equal(resVenda.romaneio.pesoLiquidoKg, 15000);
  assert.equal(resVenda.romaneio.volumeM3, 10);
  assert.equal(resVenda.romaneio.valorTotal, 650.00);
  assert.equal(resVenda.romaneio.valorCfem, 9.75); // 1.5% CFEM
});

test('8. Controle Estatístico NBR 12655 do lote de ensaio (fck estimado e conformidade)', async () => {
  const est88 = calcularEstatisticaResistenciaLote('CP-2026-088', CONCRETO_EMPRESA_ID);
  assert.equal(est88.ok, true);
  assert.equal(est88.fckProjeto, 30);
  assert.equal(est88.nCorposProva28d, 2);
  assert.ok(est88.fckEstimado28d >= 34.0);
  assert.ok(est88.percentualFckAtingido > 100);
  assert.ok(est88.conformidadeEstrutural.includes('CONFORME'));

  const est89 = calcularEstatisticaResistenciaLote('CP-2026-089', CONCRETO_EMPRESA_ID);
  assert.equal(est89.ok, true);
  assert.equal(est89.fckProjeto, 30);
  assert.ok(est89.mensagem.includes('Aguardando rompimento'));
});

test('9. Gerador de Romaneio Oficial NBR 7212 em HTML para visualização e impressão', async () => {
  const resRom = await gerarHtmlRomaneioOficial('crg-1001', CONCRETO_EMPRESA_ID);
  assert.equal(resRom.ok, true);
  assert.equal(resRom.numero, 1001);
  assert.ok(resRom.html.includes('ROMANEIO OFICIAL NBR 7212'));
  assert.ok(resRom.html.includes('SERRANO CONCRETO USINADO & MINERAÇÃO'));
  assert.ok(resRom.html.includes('Construtora MT Horizon'));
  assert.ok(resRom.html.includes('FCK 30 MPa (Brita 1)'));
  assert.ok(resRom.html.includes('150 min'));
  assert.ok(resRom.html.includes('ADVERTÊNCIA NORMATIVA NBR 7212'));
});

test('10. Medições de Obras Construtora e Faturamento Periódico', async () => {
  const resMed = await listarMedicoesObras(CONCRETO_EMPRESA_ID);
  assert.equal(resMed.ok, true);
  assert.ok(resMed.medicoes.length >= 2);

  // Criar nova medição
  const resCriar = await criarMedicaoObra({
    cliente: 'Construtora Tangará Obras',
    cnpjCliente: '33.444.555/0001-22',
    obra: 'Galpão Logístico Agro MT',
    periodoInicio: '2026-11-01',
    periodoFim: '2026-11-12',
    volumeTotalM3: 48,
    precoMedioM3: 410.00,
    taxaBombaTotal: 1200.00,
    retencaoTecnicaPercent: 5.0,
    cargasIds: ['crg-1001']
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resCriar.ok, true);
  assert.ok(resCriar.medicao.numero.startsWith('MED-2026/0'));
  assert.equal(resCriar.medicao.volumeTotalM3, 48);
  assert.equal(resCriar.medicao.valorBrutoTotal, 20880.00); // 48*410 + 1200
  assert.equal(resCriar.medicao.valorRetencaoTecnica, 1044.00); // 5%
  assert.equal(resCriar.medicao.valorLiquidoFaturar, 19836.00);

  // Atualizar status
  const resStatus = await atualizarStatusMedicao(resCriar.medicao.id, 'aprovado_faturado');
  assert.equal(resStatus.ok, true);
  assert.equal(resStatus.medicao.status, 'aprovado_faturado');
});


test('11. Assinatura Digital do Cliente na Entrega da Carga (NBR 7212)', async () => {
  const assinaturaMock = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const resAss = await assinarEntregaCarga('crg-1001', {
    assinaturaBase64: assinaturaMock,
    recebedorNome: 'Eng. Marcelo Dantas de Souza',
    recebedorDocumento: '045.892.110-34',
    recebedorCargo: 'Engenheiro Residente (Fiscal da Obra)',
    slumpMedidoCm: 14.5,
    aguaAdicionadaObraLitros: 0,
    observacoes: 'Recebido com abatimento e temperatura conformes NBR 7212.'
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resAss.ok, true);
  assert.ok(resAss.hashSha256);
  assert.ok(resAss.codigoAutenticidade.startsWith('SERRANO-NBR7212-'));
  assert.equal(resAss.carga.status, 'concluido');
  assert.equal(resAss.carga.assinaturaEntrega.status, 'assinado');
  assert.equal(resAss.carga.assinaturaEntrega.recebedorNome, 'Eng. Marcelo Dantas de Souza');
  assert.equal(resAss.carga.assinaturaEntrega.slumpMedidoCm, 14.5);
  assert.equal(resAss.carga.ticketPesagem.numeroTicket, 'TKT-BAL-1001');
  assert.equal(resAss.carga.ticketPesagem.pesoLiquidoKg, 19200);

  // Consultar Romaneio Completo
  const resRom = await obterRomaneioCompleto('crg-1001', CONCRETO_EMPRESA_ID);
  assert.equal(resRom.ok, true);
  assert.equal(resRom.carga.assinaturaEntrega.recebedorDocumento, '045.892.110-34');
});

test('12. Emissão de Romaneio HTML com Ticket de Pesagem e Assinatura Digital', async () => {
  const resHtml = await gerarHtmlRomaneioOficial('crg-1001', CONCRETO_EMPRESA_ID);
  assert.equal(resHtml.ok, true);
  assert.ok(resHtml.html.includes('ROMANEIO OFICIAL NBR 7212'));
  assert.ok(resHtml.html.includes('Ticket de Pesagem Integrado · Balança Rodoviária 80t Toledo'));
  assert.ok(resHtml.html.includes('TKT-BAL-1001'));
  assert.ok(resHtml.html.includes('19.200 kg'));
  assert.ok(resHtml.html.includes('ASSINADO DIGITALMENTE NA ENTREGA'));
  assert.ok(resHtml.html.includes('Eng. Marcelo Dantas de Souza'));
  assert.ok(resHtml.html.includes('Engª Karin Prestes'));
});

test('13. Emissão de Ticket de Pesagem da Balança Rodoviária de Mineração (CFEM)', async () => {
  const resTicket = await emitirTicketPesagemBalanca({
    cliente: 'Construtora Serra dos Parecis',
    placaVeiculo: 'RAQ-5520',
    motorista: 'Sebastião dos Santos',
    tipoMaterial: 'Areia Média Lavada de Rio (Sepotuba)',
    pesoBrutoKg: 34500,
    taraKg: 13500,
    precoUnitarioM3: 65.00
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resTicket.ok, true);
  assert.ok(resTicket.ticket.numeroTicket.startsWith('TKT-BAL-'));
  assert.equal(resTicket.ticket.pesoLiquidoKg, 21000);
  assert.equal(resTicket.ticket.volumeCalculadoM3, 14.0); // 21000 / 1500
  assert.equal(resTicket.ticket.valorTotal, 910.00); // 14 * 65
  assert.equal(resTicket.ticket.valorCfem, 13.65); // 1.5%

  const resHtml = await gerarHtmlTicketBalanca(resTicket.ticket.id, CONCRETO_EMPRESA_ID);
  assert.equal(resHtml.ok, true);
  assert.ok(resHtml.html.includes('TICKET DE PESAGEM RODOVIÁRIA'));
  assert.ok(resHtml.html.includes('21.000 kg'));
  assert.ok(resHtml.html.includes('Toledo 80t'));
});

test('14. Automação da Balança Rodoviária 80t Toledo: Status e Hardware de Semáforos e Cancelas', async () => {
  const resStatus = await obterStatusBalancaAutomacao(CONCRETO_EMPRESA_ID);
  assert.equal(resStatus.ok, true);
  assert.ok(resStatus.hardware);
  assert.equal(resStatus.hardware.capacidadeMaximaKg, 80000);
  assert.ok(['verde', 'vermelho'].includes(resStatus.hardware.semaforoEntrada));
  assert.ok(['aberta', 'fechada', 'movimento'].includes(resStatus.hardware.cancelaEntrada));
  assert.ok(resStatus.estatisticasHoje.totalVeiculosHoje >= 3);
  assert.ok(resStatus.veiculosNoPatio.length >= 1);
  assert.ok(resStatus.ultimosTickets.length >= 3);
});

test('15. Execução de Comandos Remotos na Balança: Cancelas, Semáforos e Simulação de Veículo', async () => {
  // 1. Abrir cancela de entrada remotamente
  const cmd1 = await executarComandoBalanca('abrir_cancela_entrada', {}, CONCRETO_EMPRESA_ID);
  assert.equal(cmd1.ok, true);
  assert.equal(cmd1.hardware.cancelaEntrada, 'aberta');
  assert.equal(cmd1.hardware.semaforoEntrada, 'verde');

  // 2. Simular posicionamento de veículo na balança (Betoneira BT-01)
  const cmdSim = await executarComandoBalanca('simular_veiculo', {
    placa: 'BT-01 (RRA-4E80)',
    modelo: 'Caminhão Betoneira VW Constellation 26.280',
    pesoBrutoKg: 33480,
    taraKg: 14280,
    foraPosicao: false
  }, CONCRETO_EMPRESA_ID);
  assert.equal(cmdSim.ok, true);
  assert.equal(cmdSim.hardware.pesoAtualKg, 33480);
  assert.equal(cmdSim.hardware.pesoLiquidoAtualKg, 19200);
  assert.equal(cmdSim.hardware.posicionamentoCorreto, true);
  assert.equal(cmdSim.hardware.sensorPresencaPlataforma, true);

  // 3. Simular alerta de eixo fora da plataforma
  const cmdAlerta = await executarComandoBalanca('simular_veiculo', {
    foraPosicao: true,
    pesoBrutoKg: 30000
  }, CONCRETO_EMPRESA_ID);
  assert.equal(cmdAlerta.hardware.posicionamentoCorreto, false);
  assert.equal(cmdAlerta.hardware.sensorBarreiraEntrada, true);

  // 4. Liberar e zerar balança
  const cmdZerar = await executarComandoBalanca('zerar_balanca', {}, CONCRETO_EMPRESA_ID);
  assert.equal(cmdZerar.hardware.pesoAtualKg, 0);
  assert.equal(cmdZerar.hardware.zeroRastreado, true);
});

test('16. Fluxo de Dupla Pesagem Rodoviária: 1ª Pesagem Entrada e 2ª Pesagem Saída', async () => {
  // 1. Entrada de Caçamba Basculante vazia para carregar brita (Tara)
  const resEntrada = await registrarEntradaVeiculo({
    placaVeiculo: 'CAR-15 (QBZ-7710)',
    motorista: 'Laércio Silveira',
    transportadora: 'TransParecis',
    cliente: 'Construtora Vale do Sepotuba',
    tipoMaterial: 'Brita 1 Granítica',
    tipoOperacao: 'expedicao_agregados',
    taraKg: 13200
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resEntrada.ok, true);
  assert.equal(resEntrada.veiculoPatio.taraEntradaKg, 13200);
  assert.equal(resEntrada.veiculoPatio.status, 'carregando_no_patio');

  // 2. Concluir 2ª pesagem na saída (carregado com 32.400 kg brutos)
  const resSaida = await concluirSegundaPesagemBalanca({
    patioId: resEntrada.veiculoPatio.id,
    placaVeiculo: 'CAR-15 (QBZ-7710)',
    modeloVeiculo: 'Caminhão Caçamba Basculante 3 Eixos',
    motorista: 'Laércio Silveira',
    cliente: 'Construtora Vale do Sepotuba',
    tipoMaterial: 'Brita 1 Granítica',
    pesoBrutoKg: 32400,
    taraKg: 13200,
    densidadeKgM3: 1450,
    precoUnitarioM3: 125.00
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resSaida.ok, true);
  assert.equal(resSaida.ticket.pesoLiquidoKg, 19200); // 32400 - 13200
  assert.equal(resSaida.ticket.volumeCalculadoM3, 13.24); // 19200 / 1450
  assert.equal(resSaida.ticket.valorTotal, 1655.00); // 13.24 * 125
  assert.equal(resSaida.ticket.valorCfem, 24.82); // 1.5% CFEM mineração
  assert.ok(resSaida.ticket.codigoAutenticidade.startsWith('BAL-TOLEDO-'));

  // 3. Listar tickets e verificar presença
  const resListar = await listarTicketsBalanca(CONCRETO_EMPRESA_ID, { termo: 'CAR-15' });
  assert.equal(resListar.ok, true);
  assert.ok(resListar.total >= 1);
});
