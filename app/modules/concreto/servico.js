import { db, save } from '../../db.js';
import { 
  CONCRETO_EMPRESA_ID, 
  CONCRETO_DADOS_EMPRESA, 
  CONCRETO_CATALOGO_INICIAL, 
  CONCRETO_FROTA_INICIAL, 
  CONCRETO_CARGAS_INICIAIS 
} from '../../concreto-usina-seed.js';

// =====================================================================
// 1. CONSTANTES E CATÁLOGO DE INSUMOS DE MATÉRIA-PRIMA
// =====================================================================
export const INSUMOS_MATERIA_PRIMA = [
  {
    id: 'ins-cim-cp2',
    codigo: 'INS-CIM-CP2',
    nome: 'Cimento Portland CP II-F-32 a Granel',
    categoria: 'Cimento',
    unidade: 'ton',
    custoUnitario: 580.00,
    fornecedorPadrao: 'Votorantim Cimentos S/A (Fábrica Nobres/MT)',
    siloVinculadoId: 'silo-01',
    siloVinculadoNome: 'Silo Convicta Vertical 96 Toneladas',
    estoqueMinimo: 20,
    leadTimeDias: 2,
    fatorConversaoKg: 1000
  },
  {
    id: 'ins-cim-cp5',
    codigo: 'INS-CIM-CP5',
    nome: 'Cimento Portland CP V-ARI (Alta Resistência Inicial)',
    categoria: 'Cimento',
    unidade: 'ton',
    custoUnitario: 640.00,
    fornecedorPadrao: 'Cimento Itambé / Votorantim',
    siloVinculadoId: 'silo-02',
    siloVinculadoNome: 'Silo Auxiliar Vertical 60 Toneladas',
    estoqueMinimo: 15,
    leadTimeDias: 3,
    fatorConversaoKg: 1000
  },
  {
    id: 'ins-areia-med',
    codigo: 'INS-AREIA-MED',
    nome: 'Areia Média Lavada de Rio (Mineração Própria)',
    categoria: 'Agregado Miúdo',
    unidade: 'm³',
    custoUnitario: 42.00,
    fornecedorPadrao: 'Serrano Mineração Própria (Tangará da Serra/MT)',
    siloVinculadoId: 'patio-01',
    siloVinculadoNome: 'Pátio de Areia Média Lavada',
    estoqueMinimo: 100,
    leadTimeDias: 1,
    densidadeKgM3: 1500
  },
  {
    id: 'ins-areia-gro',
    codigo: 'INS-AREIA-GRO',
    nome: 'Areia Grossa Selecionada de Dragagem',
    categoria: 'Agregado Miúdo',
    unidade: 'm³',
    custoUnitario: 45.00,
    fornecedorPadrao: 'Serrano Mineração Própria (Tangará da Serra/MT)',
    siloVinculadoId: 'patio-02',
    siloVinculadoNome: 'Pátio de Areia Grossa de Dragagem',
    estoqueMinimo: 80,
    leadTimeDias: 1,
    densidadeKgM3: 1550
  },
  {
    id: 'ins-brita-0',
    codigo: 'INS-BRITA-0',
    nome: 'Brita 0 / Pedrisco Basáltico (4,8 a 9,5 mm)',
    categoria: 'Agregado Graúdo',
    unidade: 'm³',
    custoUnitario: 85.00,
    fornecedorPadrao: 'Pedreira Serra dos Parecis Ltda',
    siloVinculadoId: 'patio-03',
    siloVinculadoNome: 'Box Brita 0 (Pedrisco)',
    estoqueMinimo: 60,
    leadTimeDias: 1,
    densidadeKgM3: 1400
  },
  {
    id: 'ins-brita-1',
    codigo: 'INS-BRITA-1',
    nome: 'Brita 1 Granítica Estrutural (9,5 a 19 mm)',
    categoria: 'Agregado Graúdo',
    unidade: 'm³',
    custoUnitario: 92.00,
    fornecedorPadrao: 'Pedreira Serra dos Parecis Ltda',
    siloVinculadoId: 'patio-04',
    siloVinculadoNome: 'Box Brita 1 (Granito Basalto)',
    estoqueMinimo: 120,
    leadTimeDias: 1,
    densidadeKgM3: 1450
  },
  {
    id: 'ins-adit-plast',
    codigo: 'INS-ADIT-PLAST',
    nome: 'Aditivo Plastificante Polifuncional Multiflux NBR 11768',
    categoria: 'Aditivo Químico',
    unidade: 'L',
    custoUnitario: 6.80,
    fornecedorPadrao: 'Vedacit / MC-Bauchemie Brasil',
    siloVinculadoId: 'tanque-01',
    siloVinculadoNome: 'Tanque Dosador Aditivo Plastificante Multiflux',
    estoqueMinimo: 500,
    leadTimeDias: 4
  },
  {
    id: 'ins-adit-retard',
    codigo: 'INS-ADIT-RETARD',
    nome: 'Aditivo Retardador de Pega para Tempo Quente NBR 11768',
    categoria: 'Aditivo Químico',
    unidade: 'L',
    custoUnitario: 8.20,
    fornecedorPadrao: 'Vedacit / Sika Brasil',
    siloVinculadoId: 'tanque-02',
    siloVinculadoNome: 'Tanque Dosador Aditivo Retardador de Pega',
    estoqueMinimo: 300,
    leadTimeDias: 4
  },
  {
    id: 'ins-fibra-poli',
    codigo: 'INS-FIBRA-POLI',
    nome: 'Microfibras Sintéticas de Polipropileno para Pisos',
    categoria: 'Adicional Técnico',
    unidade: 'kg',
    custoUnitario: 28.00,
    fornecedorPadrao: 'Maccaferri do Brasil Ltda',
    siloVinculadoId: 'deposito-01',
    siloVinculadoNome: 'Depósito de Fibras Sintéticas',
    estoqueMinimo: 50,
    leadTimeDias: 5
  },
  {
    id: 'ins-diesel-s10',
    codigo: 'INS-DIESEL-S10',
    nome: 'Óleo Diesel S10 para Frota e Pá Carregadeira',
    categoria: 'Combustível',
    unidade: 'L',
    custoUnitario: 5.95,
    fornecedorPadrao: 'Distribuidora Petrobras Tangará da Serra',
    siloVinculadoId: 'tanque-diesel',
    siloVinculadoNome: 'Tanque Aéreo de Combustível da Usina (10.000 L)',
    estoqueMinimo: 1500,
    leadTimeDias: 1
  },
  {
    id: 'ins-agua-poco',
    codigo: 'INS-AGUA-POCO',
    nome: 'Água Desmineralizada / Poço Artesiano Industrial',
    categoria: 'Insumo Básico',
    unidade: 'm³',
    custoUnitario: 2.50,
    fornecedorPadrao: 'Captação Própria Usina Serrano',
    siloVinculadoId: 'caixa-dagua',
    siloVinculadoNome: 'Reservatório Elevado 30.000 L',
    estoqueMinimo: 10,
    leadTimeDias: 0
  }
];

// =====================================================================
// 2. LISTAS TÉCNICAS (BOM - BILL OF MATERIALS) DE CADA TRAÇO
// =====================================================================
export const TRACOS_NORMATIZADOS = {
  15: { cimentoKg: 260, areiaM3: 0.68, britaM3: 0.88, aguaL: 185, aditivoL: 2.0, fatorAc: 0.65, slumpPadrao: '10 ± 2 cm', descricao: 'Concreto Magro / Regularização de Fundações' },
  20: { cimentoKg: 300, areiaM3: 0.65, britaM3: 0.85, aguaL: 180, aditivoL: 2.4, fatorAc: 0.55, slumpPadrao: '12 ± 2 cm', descricao: 'Pisos residenciais, calçadas, baldrames e estacas' },
  25: { cimentoKg: 340, areiaM3: 0.62, britaM3: 0.82, aguaL: 175, aditivoL: 2.7, fatorAc: 0.50, slumpPadrao: '12 ± 2 cm', descricao: 'Lajes maciças/treliçadas, vigas e pilares residenciais' },
  30: { cimentoKg: 380, areiaM3: 0.58, britaM3: 0.80, aguaL: 170, aditivoL: 3.0, fatorAc: 0.45, slumpPadrao: '14 ± 2 cm', descricao: 'Estrutural pesado, edifícios comerciais e galpões de grande vão' },
  35: { cimentoKg: 420, areiaM3: 0.55, britaM3: 0.78, aguaL: 165, aditivoL: 3.4, fatorAc: 0.42, slumpPadrao: '14 ± 2 cm', descricao: 'Pisos industriais com tráfego de carretas e empilhadeiras' },
  40: { cimentoKg: 460, areiaM3: 0.52, britaM3: 0.75, aguaL: 160, aditivoL: 3.8, fatorAc: 0.38, slumpPadrao: '16 ± 2 cm', descricao: 'Obras de arte especiais, pontes e concreto de alta resistência' },
  45: { cimentoKg: 500, areiaM3: 0.50, britaM3: 0.72, aguaL: 155, aditivoL: 4.2, fatorAc: 0.35, slumpPadrao: '16 ± 2 cm', descricao: 'Concreto de altíssimo desempenho (CAD) e pré-moldados pesados' },
};

/**
 * Monta as Fichas Técnicas / BOM completas de fabricação de concreto
 */
export function gerarListaTecnicaBOM() {
  const fcks = [15, 20, 25, 30, 35, 40, 45];
  return fcks.map(fck => {
    const t = TRACOS_NORMATIZADOS[fck];
    const cimentoTon = t.cimentoKg / 1000;
    const cimentoCusto = cimentoTon * (fck >= 40 ? 640 : 580);
    const areiaCusto = t.areiaM3 * 42.00;
    const britaCusto = t.britaM3 * 92.00;
    const aguaCusto = (t.aguaL / 1000) * 2.50;
    const aditivoCusto = t.aditivoL * 6.80;
    const fibraKg = fck === 35 ? 1.2 : 0;
    const fibraCusto = fibraKg * 28.00;

    const custoInsumosM3 = +(cimentoCusto + areiaCusto + britaCusto + aguaCusto + aditivoCusto + fibraCusto).toFixed(2);
    const perdaAderenciaPercent = 1.5;
    const custoInsumosComPerda = +(custoInsumosM3 * (1 + perdaAderenciaPercent / 100)).toFixed(2);

    return {
      id: `bom-fck-${fck}`,
      codigo: `BOM-FCK-${fck}`,
      fck,
      nome: `Concreto Usinado FCK ${fck} MPa`,
      descricao: t.descricao,
      normaReferencia: 'ABNT NBR 7212 / NBR 8953 / NBR 6118',
      slumpPadrao: t.slumpPadrao,
      fatorAguaCimento: t.fatorAc,
      teorArgamassaPercent: fck >= 30 ? 53 : 51,
      proporcaoMassa: `1 : ${(t.areiaM3 * 1500 / t.cimentoKg).toFixed(2)} : ${(t.britaM3 * 1450 / t.cimentoKg).toFixed(2)} : ${t.fatorAc}`,
      perdaAderenciaPercent,
      componentes: [
        { insumoId: fck >= 40 ? 'ins-cim-cp5' : 'ins-cim-cp2', nome: fck >= 40 ? 'Cimento CP V-ARI' : 'Cimento CP II-F-32', consumo: t.cimentoKg, unidade: 'kg', custoUnitarioKg: fck >= 40 ? 0.64 : 0.58, subtotalCusto: +cimentoCusto.toFixed(2) },
        { insumoId: 'ins-areia-med', nome: 'Areia Média Lavada Rio', consumo: t.areiaM3, unidade: 'm³', consumoKg: Math.round(t.areiaM3 * 1500), custoUnitario: 42.00, subtotalCusto: +areiaCusto.toFixed(2) },
        { insumoId: 'ins-brita-1', nome: 'Brita 1 Granítica', consumo: t.britaM3, unidade: 'm³', consumoKg: Math.round(t.britaM3 * 1450), custoUnitario: 92.00, subtotalCusto: +britaCusto.toFixed(2) },
        { insumoId: 'ins-agua-poco', nome: 'Água de Amassamento', consumo: t.aguaL, unidade: 'L', custoUnitario: 0.0025, subtotalCusto: +aguaCusto.toFixed(2) },
        { insumoId: 'ins-adit-plast', nome: 'Aditivo Plastificante Multiflux', consumo: t.aditivoL, unidade: 'L', custoUnitario: 6.80, subtotalCusto: +aditivoCusto.toFixed(2) },
        ...(fibraKg > 0 ? [{ insumoId: 'ins-fibra-poli', nome: 'Microfibras Sintéticas Polipropileno', consumo: fibraKg, unidade: 'kg', custoUnitario: 28.00, subtotalCusto: +fibraCusto.toFixed(2) }] : [])
      ],
      custoDiretoInsumosM3: custoInsumosComPerda,
      precoSugeridoVendaM3: fck === 15 ? 340 : fck === 20 ? 380 : fck === 25 ? 410 : fck === 30 ? 440 : fck === 35 ? 480 : fck === 40 ? 520 : 570
    };
  });
}

// =====================================================================
// 3. COMPRAS INICIAIS DE MATÉRIAS-PRIMAS
// =====================================================================
export const COMPRAS_INICIAIS = [
  {
    id: 'pc-2026-048',
    numero: 'PC-2026-048',
    data: '2026-11-08',
    fornecedor: 'Votorantim Cimentos S/A (Nobres/MT)',
    insumoId: 'ins-cim-cp2',
    insumoNome: 'Cimento Portland CP II-F-32 a Granel',
    siloDestinoId: 'silo-01',
    siloDestinoNome: 'Silo Convicta Vertical 96 Toneladas',
    quantidade: 45.0,
    unidade: 'ton',
    precoUnitario: 580.00,
    valorTotal: 26100.00,
    notaFiscal: 'NF-e 108.432',
    pesoBalançaEntradaTon: 45.12,
    formaPagamento: 'Boleto Bancário 30 DDL',
    status: 'entregue_pesado',
    responsavelRecebimento: 'Carlos Eduardo (Operador de Usina)'
  },
  {
    id: 'pc-2026-049',
    numero: 'PC-2026-049',
    data: '2026-11-09',
    fornecedor: 'Pedreira Serra dos Parecis Ltda',
    insumoId: 'ins-brita-1',
    insumoNome: 'Brita 1 Granítica Estrutural',
    siloDestinoId: 'patio-04',
    siloDestinoNome: 'Box Brita 1',
    quantidade: 30.0,
    unidade: 'm³',
    precoUnitario: 92.00,
    valorTotal: 2760.00,
    notaFiscal: 'NF-e 045.119',
    pesoBalançaEntradaTon: 43.5,
    formaPagamento: 'PIX à Vista com Desconto',
    status: 'entregue_pesado',
    responsavelRecebimento: 'Carlos Eduardo'
  },
  {
    id: 'pc-2026-050',
    numero: 'PC-2026-050',
    data: '2026-11-10',
    fornecedor: 'Vedacit / MC-Bauchemie Brasil',
    insumoId: 'ins-adit-plast',
    insumoNome: 'Aditivo Plastificante Multiflux IBC 1000L',
    siloDestinoId: 'tanque-01',
    siloDestinoNome: 'Tanque Dosador Aditivo Plastificante',
    quantidade: 1000,
    unidade: 'L',
    precoUnitario: 6.80,
    valorTotal: 6800.00,
    notaFiscal: 'NF-e 092.841',
    formaPagamento: 'Boleto Bancário 28 DDL',
    status: 'entregue_pesado',
    responsavelRecebimento: 'Engª Karin Prestes'
  },
  {
    id: 'pc-2026-051',
    numero: 'PC-2026-051',
    data: '2026-11-11',
    fornecedor: 'Votorantim Cimentos S/A (Nobres/MT)',
    insumoId: 'ins-cim-cp2',
    insumoNome: 'Cimento Portland CP II-F-32 a Granel (Bitrem 42t)',
    siloDestinoId: 'silo-01',
    siloDestinoNome: 'Silo Convicta Vertical 96 Toneladas',
    quantidade: 42.0,
    unidade: 'ton',
    precoUnitario: 580.00,
    valorTotal: 24360.00,
    notaFiscal: 'NF-e 108.995',
    formaPagamento: 'Boleto Bancário 30 DDL',
    status: 'em_transito',
    previsaoEntrega: '2026-11-13'
  },
  {
    id: 'pc-2026-052',
    numero: 'PC-2026-052',
    data: '2026-11-12',
    fornecedor: 'Distribuidora Petrobras Tangará da Serra',
    insumoId: 'ins-diesel-s10',
    insumoNome: 'Óleo Diesel S10 para Frota de Betoneiras',
    siloDestinoId: 'tanque-diesel',
    siloDestinoNome: 'Tanque Próprio de Combustível Usina',
    quantidade: 5000,
    unidade: 'L',
    precoUnitario: 5.95,
    valorTotal: 29750.00,
    notaFiscal: 'Aguardando Faturamento',
    formaPagamento: 'Faturado 15 DDL',
    status: 'solicitado',
    previsaoEntrega: '2026-11-14'
  }
];

// =====================================================================
// 4. ORDENS DE PRODUÇÃO (OP) DE CONCRETO
// =====================================================================
export const ORDENS_PRODUCAO_INICIAIS = [
  {
    id: 'op-2026-091',
    numero: 'OP-2026-091',
    dataHora: '2026-11-11 08:30:00',
    cargaId: 'crg-0998',
    cliente: 'Grupo Moradda Incorporadora',
    obra: 'Edifício Residencial Belvedere Tower',
    fck: 30,
    volumeM3: 40,
    totalBateladas: 5,
    betoneirasEscaladas: ['BT-01', 'BT-02', 'BT-03'],
    consumoTeorico: {
      cimentoKg: 15200,
      areiaKg: 34800,
      britaKg: 46400,
      aguaL: 6800,
      aditivoL: 120
    },
    consumoRealBalança: {
      cimentoKg: 15240,
      areiaKg: 35120,
      britaKg: 46280,
      aguaL: 6720,
      aditivoL: 121
    },
    status: 'concluida',
    operador: 'Carlos Eduardo',
    aprovadoEngenharia: true,
    laudoCpVinculado: 'CP-2026-088'
  },
  {
    id: 'op-2026-092',
    numero: 'OP-2026-092',
    dataHora: '2026-11-12 07:15:00',
    cargaId: 'crg-1001',
    cliente: 'Construtora MT Horizon',
    obra: 'Edifício Residencial Serra Dourada · Lajes 4º Pav.',
    fck: 30,
    volumeM3: 24,
    totalBateladas: 3,
    betoneirasEscaladas: ['BT-01', 'BT-02', 'BT-03'],
    consumoTeorico: {
      cimentoKg: 9120,
      areiaKg: 20880,
      britaKg: 27840,
      aguaL: 4080,
      aditivoL: 72
    },
    consumoRealBalança: {
      cimentoKg: 9140,
      areiaKg: 21020,
      britaKg: 27790,
      aguaL: 4040,
      aditivoL: 72
    },
    status: 'concluida',
    operador: 'Carlos Eduardo',
    aprovadoEngenharia: true,
    laudoCpVinculado: 'CP-2026-089'
  },
  {
    id: 'op-2026-093',
    numero: 'OP-2026-093',
    dataHora: '2026-11-12 13:45:00',
    cargaId: 'crg-1002',
    cliente: 'AgroLog Transportes & Logística',
    obra: 'Piso Industrial Galpão de Cargas · Etapa 2',
    fck: 35,
    volumeM3: 32,
    totalBateladas: 4,
    betoneirasEscaladas: ['BT-04', 'BT-05'],
    consumoTeorico: {
      cimentoKg: 13440,
      areiaKg: 26400,
      britaKg: 34944,
      aguaL: 5280,
      aditivoL: 108.8,
      fibrasKg: 38.4
    },
    consumoRealBalança: null,
    status: 'em_producao',
    operador: 'Carlos Eduardo',
    aprovadoEngenharia: true,
    laudoCpVinculado: 'CP-2026-090'
  }
];

export const ENSAIOS_INICIAIS = [
  {
    id: 'cp-2026-088',
    lote: 'CP-2026-088',
    cargaId: 'crg-0998',
    cliente: 'Grupo Moradda Incorporadora',
    obra: 'Edifício Residencial Belvedere Tower · Lajes do 6º Pavimento',
    endereco: 'Rua José Corsino, 880, Jardim Europa, Tangará da Serra/MT',
    fckProjeto: 30,
    slumpMedidoCm: 14,
    slumpProjeto: '14 ± 2 cm',
    dataMoldagem: '2026-10-14',
    responsavelTecnico: 'Engª Karin Prestes (CREA-MT 027300)',
    status: 'aprovado',
    corposProva: [
      { id: 'CP-1', idadeDias: 7, dataRuptura: '2026-10-21', forcaKn: 195.2, tensaoMpa: 24.8, percentualFck: 82.7 },
      { id: 'CP-2', idadeDias: 7, dataRuptura: '2026-10-21', forcaKn: 198.5, tensaoMpa: 25.3, percentualFck: 84.3 },
      { id: 'CP-3', idadeDias: 28, dataRuptura: '2026-11-11', forcaKn: 268.4, tensaoMpa: 34.2, percentualFck: 114.0 },
      { id: 'CP-4', idadeDias: 28, dataRuptura: '2026-11-11', forcaKn: 271.8, tensaoMpa: 34.6, percentualFck: 115.3 }
    ],
    fckEstimado28d: 34.2,
    laudoAprovado: true,
    laudoNumero: 'LAUDO-2026/088-NBR5739'
  },
  {
    id: 'cp-2026-089',
    lote: 'CP-2026-089',
    cargaId: 'crg-1001',
    cliente: 'Construtora MT Horizon',
    obra: 'Edifício Residencial Serra Dourada · Lajes do 4º Pavimento',
    endereco: 'Rua José Corsino, 450, Jardim Europa, Tangará da Serra/MT',
    fckProjeto: 30,
    slumpMedidoCm: 13,
    slumpProjeto: '14 ± 2 cm',
    dataMoldagem: '2026-11-04',
    responsavelTecnico: 'Engª Karin Prestes (CREA-MT 027300)',
    status: 'em_cura',
    corposProva: [
      { id: 'CP-1', idadeDias: 7, dataRuptura: '2026-11-11', forcaKn: 201.1, tensaoMpa: 25.6, percentualFck: 85.3 },
      { id: 'CP-2', idadeDias: 7, dataRuptura: '2026-11-11', forcaKn: 203.8, tensaoMpa: 25.9, percentualFck: 86.3 },
      { id: 'CP-3', idadeDias: 28, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-4', idadeDias: 28, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null }
    ],
    fckEstimado28d: null,
    laudoAprovado: null,
    laudoNumero: 'LAUDO-2026/089-EM-ANDAMENTO'
  },
  {
    id: 'cp-2026-090',
    lote: 'CP-2026-090',
    cargaId: 'crg-1002',
    cliente: 'AgroLog Transportes & Logística',
    obra: 'Piso Industrial Galpão de Cargas · Etapa 2',
    endereco: 'Av. Lions Internacional, 1800, Distrito Industrial, Tangará da Serra/MT',
    fckProjeto: 35,
    slumpMedidoCm: 14,
    slumpProjeto: '14 ± 2 cm',
    dataMoldagem: '2026-11-12',
    responsavelTecnico: 'Engª Karin Prestes (CREA-MT 027300)',
    status: 'moldado',
    corposProva: [
      { id: 'CP-1', idadeDias: 7, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-2', idadeDias: 7, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-3', idadeDias: 28, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-4', idadeDias: 28, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null }
    ],
    fckEstimado28d: null,
    laudoAprovado: null,
    laudoNumero: 'LAUDO-2026/090-AGUARDANDO-CURA'
  }
];

export const PROPOSTAS_INICIAIS = [
  {
    id: 'prop-2026-101',
    numero: 101,
    cliente: 'Grupo Moradda Incorporadora',
    contato: 'Danilo Moraes',
    telefone: '(65) 99981-4455',
    obra: 'Condomínio Residencial Tangará Garden · Bloco C Lajes',
    endereco: 'Av. Brasil, 2100, Jardim Tangará, Tangará da Serra/MT',
    dataCriacao: '2026-11-10',
    validadeDias: 15,
    fck: 30,
    volumeM3: 48,
    tipoBomba: 'Bomba Lança 32m',
    precoM3: 440.00,
    subtotalConcreto: 21120.00,
    taxaBomba: 1325.00,
    freteKm: 0,
    totalProposta: 22445.00,
    condicaoPagamento: 'Boleto 14/28 DDL faturado',
    status: 'aprovada',
    observacoes: 'Descarga prevista em duas etapas de 24m³. Incluso 4 corpos de prova com rompimento 7 e 28 dias.'
  },
  {
    id: 'prop-2026-102',
    numero: 102,
    cliente: 'Construtora Vale do Parecis',
    contato: 'Eng. Ricardo Silveira',
    telefone: '(65) 99972-3322',
    obra: 'Galpão de Maquinários Agrícolas · Piso com Fibras',
    endereco: 'Rodovia MT-358 km 12, Distrito Industrial, Tangará da Serra/MT',
    dataCriacao: '2026-11-11',
    validadeDias: 10,
    fck: 35,
    volumeM3: 64,
    tipoBomba: 'Descarga Direta (Calha)',
    precoM3: 480.00,
    subtotalConcreto: 30720.00,
    taxaBomba: 0,
    freteKm: 250.00,
    totalProposta: 30970.00,
    condicaoPagamento: 'Entrada 50% PIX + 50% após término da concretagem',
    status: 'enviada',
    observacoes: 'Traço com adição de 1,2 kg/m³ de microfibras de polipropileno para controle de fissuras.'
  }
];

export const SILOS_INSUMOS_INICIAIS = [
  { id: 'silo-01', codigo: 'SILO-01', nome: 'Silo Convicta Vertical 96 Toneladas', tipo: 'cimento_cp2', insumo: 'Cimento Portland CP II-F-32 a Granel', capacidadeTotalTon: 96, estoqueAtualTon: 78.4, nivelPercent: 81.6, fornecedor: 'Votorantim Cimentos', ultimoCarregamento: '2026-11-09', alertaMinimoTon: 20 },
  { id: 'silo-02', codigo: 'SILO-02', nome: 'Silo Auxiliar Vertical 60 Toneladas', tipo: 'cimento_cp5', insumo: 'Cimento Portland CP V-ARI (Alta Resistência)', capacidadeTotalTon: 60, estoqueAtualTon: 42.1, nivelPercent: 70.1, fornecedor: 'Cimento Itambé', ultimoCarregamento: '2026-11-05', alertaMinimoTon: 15 },
  { id: 'patio-01', codigo: 'PAT-AREIA-MED', nome: 'Pátio de Areia Média Lavada', tipo: 'agregado_areia', insumo: 'Areia Média Lavada de Rio (Serrano Mineração)', capacidadeTotalM3: 800, estoqueAtualM3: 540, nivelPercent: 67.5, umidadeAtual: 4.8, fornecedor: 'Serrano Mineração Própria', alertaMinimoM3: 100 },
  { id: 'patio-02', codigo: 'PAT-AREIA-GRO', nome: 'Pátio de Areia Grossa de Dragagem', tipo: 'agregado_areia', insumo: 'Areia Grossa Selecionada (Serrano Mineração)', capacidadeTotalM3: 600, estoqueAtualM3: 390, nivelPercent: 65.0, umidadeAtual: 5.2, fornecedor: 'Serrano Mineração Própria', alertaMinimoM3: 80 },
  { id: 'patio-03', codigo: 'PAT-BRITA-0', nome: 'Box Brita 0 (Pedrisco Basáltico 4,8 a 9,5mm)', tipo: 'agregado_brita', insumo: 'Brita 0 / Pedrisco Selecionado', capacidadeTotalM3: 500, estoqueAtualM3: 310, nivelPercent: 62.0, fornecedor: 'Pedreira Serra dos Parecis', alertaMinimoM3: 60 },
  { id: 'patio-04', codigo: 'PAT-BRITA-1', nome: 'Box Brita 1 (Granito Basalto 9,5 a 19mm)', tipo: 'agregado_brita', insumo: 'Brita 1 Estrutural Granítica', capacidadeTotalM3: 900, estoqueAtualM3: 620, nivelPercent: 68.8, fornecedor: 'Pedreira Serra dos Parecis', alertaMinimoM3: 120 },
  { id: 'tanque-01', codigo: 'TNQ-ADITIVO-PLAST', nome: 'Tanque Dosador Aditivo Plastificante Multiflux', tipo: 'aditivo', insumo: 'Aditivo Plastificante Polifuncional NBR 11768', capacidadeTotalL: 3000, estoqueAtualL: 2150, nivelPercent: 71.6, fornecedor: 'Vedacit / MC-Bauchemie', alertaMinimoL: 500 },
  { id: 'tanque-02', codigo: 'TNQ-ADITIVO-RETARD', nome: 'Tanque Dosador Aditivo Retardador de Pega (Tempo Quente)', tipo: 'aditivo', insumo: 'Aditivo Retardador de Pega NBR 11768', capacidadeTotalL: 2000, estoqueAtualL: 1400, nivelPercent: 70.0, fornecedor: 'Vedacit / Sika', alertaMinimoL: 300 },
  { id: 'deposito-01', codigo: 'DEP-FIBRAS', nome: 'Depósito de Fibras Sintéticas de Polipropileno', tipo: 'adicional', insumo: 'Fibras Estruturais para Piso Industrial (Sacos 1kg)', capacidadeTotalKg: 500, estoqueAtualKg: 320, nivelPercent: 64.0, fornecedor: 'Maccaferri', alertaMinimoKg: 50 },
  { id: 'tanque-diesel', codigo: 'TNQ-DIESEL-S10', nome: 'Tanque Próprio de Combustível da Usina (10.000 L)', tipo: 'combustivel', insumo: 'Óleo Diesel S10 para Frota e Pá Carregadeira', capacidadeTotalL: 10000, estoqueAtualL: 6800, nivelPercent: 68.0, fornecedor: 'Distribuidora Petrobras Tangará', alertaMinimoL: 1500 }
];

// =====================================================================
// 5. INICIALIZAÇÃO E OBTENÇÃO CONSOLIDADA DOS DADOS
// =====================================================================

// =====================================================================
// DADOS INICIAIS DE MINERAÇÃO SERRANO & MEDIÇÕES DE OBRAS
// =====================================================================
export const DRAGAS_MINERACAO_INICIAIS = [
  {
    id: 'draga-01',
    codigo: 'DRG-SEP-01',
    nome: 'Draga Flutuante Sepotuba I',
    local: 'Rio Sepotuba · Córrego das Pedras (Tangará da Serra/MT)',
    licencaAmbiental: 'LAO nº 3418/2024 · SEMA-MT',
    registroANM: 'Processo ANM 866.421/2019',
    vazaoM3H: 45,
    bombaDragagemPolegadas: 8,
    operador: 'Almir Rogério dos Santos',
    status: 'em_operacao',
    horimetroHoras: 3420,
    producaoHojeM3: 180,
    tipoExtracao: 'Areia Média Lavada de Leito de Rio'
  },
  {
    id: 'draga-02',
    codigo: 'DRG-FOR-02',
    nome: 'Draga Flutuante Formoso II',
    local: 'Rio Formoso · Distrito de Progresso (Tangará da Serra/MT)',
    licencaAmbiental: 'LAO nº 4120/2025 · SEMA-MT',
    registroANM: 'Processo ANM 866.904/2021',
    vazaoM3H: 35,
    bombaDragagemPolegadas: 6,
    operador: 'Benedito Santana Pereira',
    status: 'em_operacao',
    horimetroHoras: 2150,
    producaoHojeM3: 140,
    tipoExtracao: 'Areia Grossa de Dragagem com Seixo'
  }
];

export const PATIOS_MINERACAO_INICIAIS = [
  {
    id: 'patio-areia-media',
    codigo: 'PAT-AM-01',
    nome: 'Pátio Areia Média Lavada Rio (Mineração Própria)',
    capacidadeM3: 2500,
    estoqueAtualM3: 1420,
    densidadeKgM3: 1500,
    umidadeSuperficialPercent: 4.8,
    custoExtracaoM3: 42.00,
    precoVendaM3: 65.00
  },
  {
    id: 'patio-areia-grossa',
    codigo: 'PAT-AG-02',
    nome: 'Pátio Areia Grossa Selecionada (Mineração Própria)',
    capacidadeM3: 2000,
    estoqueAtualM3: 980,
    densidadeKgM3: 1550,
    umidadeSuperficialPercent: 5.2,
    custoExtracaoM3: 45.00,
    precoVendaM3: 72.00
  },
  {
    id: 'patio-brita-0',
    codigo: 'PAT-BR0-03',
    nome: 'Box Brita 0 (Pedrisco Basáltico 4,8 a 9,5 mm)',
    capacidadeM3: 1500,
    estoqueAtualM3: 620,
    densidadeKgM3: 1400,
    umidadeSuperficialPercent: 1.2,
    custoAquisicaoM3: 85.00,
    precoVendaM3: 115.00
  },
  {
    id: 'patio-brita-1',
    codigo: 'PAT-BR1-04',
    nome: 'Box Brita 1 Granítica Estrutural (9,5 a 19 mm)',
    capacidadeM3: 3000,
    estoqueAtualM3: 1850,
    densidadeKgM3: 1450,
    umidadeSuperficialPercent: 1.0,
    custoAquisicaoM3: 92.00,
    precoVendaM3: 125.00
  }
];

export const VENDAS_AGREGADOS_INICIAIS = [
  {
    id: 'vda-agr-501',
    numeroRomaneio: 'ROM-AGR-501',
    data: '2026-11-12 09:15',
    cliente: 'Construtora MT Horizon Ltda',
    cnpjCliente: '28.910.420/0001-90',
    obraDestino: 'Pavimentação Loteamento Jardim dos Ipês',
    veiculoPlaca: 'RAQ-3E89 (Caçamba Basculante)',
    motorista: 'Claudemir Gomes',
    produtoId: 'ins-areia-med',
    produtoNome: 'Areia Média Lavada de Rio (Mineração Própria)',
    pesoBrutoKg: 28450,
    taraKg: 12250,
    pesoLiquidoKg: 16200,
    volumeM3: 10.8,
    precoUnitarioM3: 65.00,
    valorTotal: 702.00,
    aliquotaCfemPercent: 1.5,
    valorCfem: 10.53,
    statusNfe: 'autorizada',
    nfeNumero: '004819'
  },
  {
    id: 'vda-agr-502',
    numeroRomaneio: 'ROM-AGR-502',
    data: '2026-11-12 10:40',
    cliente: 'Loteamento Residencial Tangará',
    cnpjCliente: '34.567.890/0001-12',
    obraDestino: 'Base para Asfalto e Drenagem',
    veiculoPlaca: 'QBE-9102 (Caçamba Três Eixos)',
    motorista: 'Jonas Viana de Oliveira',
    produtoId: 'ins-brita-1',
    produtoNome: 'Brita 1 Granítica Estrutural',
    pesoBrutoKg: 31800,
    taraKg: 13100,
    pesoLiquidoKg: 18700,
    volumeM3: 12.9,
    precoUnitarioM3: 125.00,
    valorTotal: 1612.50,
    aliquotaCfemPercent: 1.5,
    valorCfem: 24.19,
    statusNfe: 'autorizada',
    nfeNumero: '004820'
  }
];

export const MEDICOES_OBRAS_INICIAIS = [
  {
    id: 'med-2026-01',
    numero: 'MED-2026/01',
    cliente: 'Construtora MT Horizon',
    cnpjCliente: '28.910.420/0001-90',
    obra: 'Edifício Residencial Serra Dourada',
    endereco: 'Rua José Corsino, 450, Jardim Europa, Tangará da Serra/MT',
    periodoInicio: '2026-11-01',
    periodoFim: '2026-11-15',
    volumeTotalM3: 56.0,
    cargasIds: ['crg-1001', 'crg-1002'],
    eventosBombeamento: 2,
    taxaBombaTotal: 1500.00,
    valorBrutoConcreto: 25020.00,
    valorBrutoTotal: 26520.00,
    retencaoTecnicaPercent: 5.0,
    valorRetencaoTecnica: 1326.00,
    valorLiquidoFaturar: 25194.00,
    status: 'aguardando_aprovacao_engenheiro',
    engenheiroFiscalObra: 'Eng. Marcelo Tavares (CREA-MT 039820)',
    condicaoPagamento: 'Boleto bancário faturado 28 DDL'
  },
  {
    id: 'med-2026-02',
    numero: 'MED-2026/02',
    cliente: 'Grupo Moradda Incorporadora',
    cnpjCliente: '19.820.140/0001-44',
    obra: 'Edifício Residencial Belvedere Tower',
    endereco: 'Rua José Corsino, 880, Jardim Europa, Tangará da Serra/MT',
    periodoInicio: '2026-11-01',
    periodoFim: '2026-11-10',
    volumeTotalM3: 40.0,
    cargasIds: ['crg-0998'],
    eventosBombeamento: 1,
    taxaBombaTotal: 800.00,
    valorBrutoConcreto: 17600.00,
    valorBrutoTotal: 18400.00,
    retencaoTecnicaPercent: 0,
    valorRetencaoTecnica: 0,
    valorLiquidoFaturar: 18400.00,
    status: 'faturado_boleto',
    engenheiroFiscalObra: 'Eng. Roberto Alcantara (CREA-MT 028114)',
    condicaoPagamento: 'Boleto bancário 14 DDL (Emitido Kytto ERP)'
  }
];

export function inicializarDatastoreConcreto() {
  const data = db();
  if (!Array.isArray(data.concreto_cargas)) data.concreto_cargas = [];
  if (!Array.isArray(data.concreto_produtos)) data.concreto_produtos = [];
  if (!Array.isArray(data.concreto_frota)) data.concreto_frota = [];
  if (!Array.isArray(data.concreto_ensaios)) data.concreto_ensaios = [];
  if (!Array.isArray(data.concreto_propostas)) data.concreto_propostas = [];
  if (!Array.isArray(data.concreto_silos)) data.concreto_silos = [];
  if (!Array.isArray(data.concreto_compras)) data.concreto_compras = [];
  if (!Array.isArray(data.concreto_ordens_producao)) data.concreto_ordens_producao = [];
  if (!Array.isArray(data.concreto_mineracao_dragas)) data.concreto_mineracao_dragas = [];
  if (!Array.isArray(data.concreto_mineracao_patios)) data.concreto_mineracao_patios = [];
  if (!Array.isArray(data.concreto_vendas_agregados)) data.concreto_vendas_agregados = [];
  if (!Array.isArray(data.concreto_medicoes_obras)) data.concreto_medicoes_obras = [];

  // Popular se vazio
  if (data.concreto_cargas.length === 0) {
    data.concreto_cargas = CONCRETO_CARGAS_INICIAIS.map(c => ({ ...c, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_produtos.length === 0) {
    data.concreto_produtos = CONCRETO_CATALOGO_INICIAL.map(p => ({ ...p, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_frota.length === 0) {
    data.concreto_frota = CONCRETO_FROTA_INICIAL.map(f => ({ ...f, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_ensaios.length === 0) {
    data.concreto_ensaios = ENSAIOS_INICIAIS.map(e => ({ ...e, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_propostas.length === 0) {
    data.concreto_propostas = PROPOSTAS_INICIAIS.map(p => ({ ...p, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_silos.length === 0) {
    data.concreto_silos = SILOS_INSUMOS_INICIAIS.map(s => ({ ...s, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_compras.length === 0) {
    data.concreto_compras = COMPRAS_INICIAIS.map(c => ({ ...c, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_ordens_producao.length === 0) {
    data.concreto_ordens_producao = ORDENS_PRODUCAO_INICIAIS.map(op => ({ ...op, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_mineracao_dragas.length === 0) {
    data.concreto_mineracao_dragas = DRAGAS_MINERACAO_INICIAIS.map(d => ({ ...d, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_mineracao_patios.length === 0) {
    data.concreto_mineracao_patios = PATIOS_MINERACAO_INICIAIS.map(p => ({ ...p, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_vendas_agregados.length === 0) {
    data.concreto_vendas_agregados = VENDAS_AGREGADOS_INICIAIS.map(v => ({ ...v, empresaId: CONCRETO_EMPRESA_ID }));
  }
  if (data.concreto_medicoes_obras.length === 0) {
    data.concreto_medicoes_obras = MEDICOES_OBRAS_INICIAIS.map(m => ({ ...m, empresaId: CONCRETO_EMPRESA_ID }));
  }

  save();
  return data;
}

export async function obterDadosConcreto(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  let empId = empresaId;
  let cargas = (data.concreto_cargas || []).filter(c => !c.empresaId || c.empresaId === empId);
  if (cargas.length === 0) {
    empId = CONCRETO_EMPRESA_ID;
    cargas = (data.concreto_cargas || []).filter(c => !c.empresaId || c.empresaId === empId);
  }
  const empresa = data.empresas?.find(e => e.id === empId) || CONCRETO_DADOS_EMPRESA;
  const catalogo = (data.concreto_produtos || []).filter(p => !p.empresaId || p.empresaId === empId);
  const frota = (data.concreto_frota || []).filter(f => !f.empresaId || f.empresaId === empId);
  const ensaios = (data.concreto_ensaios || []).filter(e => !e.empresaId || e.empresaId === empId);
  const propostas = (data.concreto_propostas || []).filter(p => !p.empresaId || p.empresaId === empId);
  const silos = (data.concreto_silos || []).filter(s => !s.empresaId || s.empresaId === empId);
  const compras = (data.concreto_compras || []).filter(c => !c.empresaId || c.empresaId === empId);
  const ordensProducao = (data.concreto_ordens_producao || []).filter(op => !op.empresaId || op.empresaId === empId);
  const dragas = (data.concreto_mineracao_dragas || []).filter(d => !d.empresaId || d.empresaId === empId);
  const patiosMineracao = (data.concreto_mineracao_patios || []).filter(p => !p.empresaId || p.empresaId === empId);
  const vendasAgregados = (data.concreto_vendas_agregados || []).filter(v => !v.empresaId || v.empresaId === empId);
  const medicoesObras = (data.concreto_medicoes_obras || []).filter(m => !m.empresaId || m.empresaId === empId);
  const listasTecnicas = gerarListaTecnicaBOM();

  // KPIs Industriais
  const volumeProgramadoHoje = cargas.reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
  const volumeEntregueHoje = cargas.filter(c => c.status === 'concluido').reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
  const betoneirasOperando = frota.filter(f => f.status !== 'disponivel').length;
  const faturamentoHoje = cargas.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
  const laudosConformesPercent = 100;
  const comprasPendentesValor = compras.filter(c => c.status !== 'entregue_pesado').reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
  const totalOrdensProducao = ordensProducao.length;

  return {
    ok: true,
    empresa,
    cargas,
    catalogo,
    frota,
    ensaios,
    propostas,
    silos,
    compras,
    ordensProducao,
    listasTecnicas,
    insumosCatalogo: INSUMOS_MATERIA_PRIMA,
    dragas,
    patiosMineracao,
    vendasAgregados,
    medicoesObras,
    kpis: {
      volumeProgramadoHoje,
      volumeEntregueHoje,
      betoneirasOperando,
      totalFrota: frota.length,
      faturamentoHoje,
      laudosConformesPercent,
      comprasPendentesValor,
      totalOrdensProducao
    }
  };
}

// =====================================================================
// 6. MOTOR DE COMPRAS DE MATÉRIA-PRIMA
// =====================================================================
export async function listarComprasInsumos(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const compras = (data.concreto_compras || []).filter(c => !c.empresaId || c.empresaId === empresaId);
  return { ok: true, compras, insumosCatalogo: INSUMOS_MATERIA_PRIMA };
}

export async function criarPedidoCompraInsumo(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  const insumo = INSUMOS_MATERIA_PRIMA.find(i => i.id === dados.insumoId || i.codigo === dados.insumoId);
  if (!insumo) throw new Error(`Insumo ${dados.insumoId} não cadastrado no catálogo.`);

  const quantidade = Number(dados.quantidade);
  if (!quantidade || quantidade <= 0) throw new Error('Quantidade inválida para pedido de compra.');

  const precoUnitario = dados.precoUnitario != null ? Number(dados.precoUnitario) : insumo.custoUnitario;
  const valorTotal = +(quantidade * precoUnitario).toFixed(2);

  const ultimoNum = (data.concreto_compras || []).reduce((max, c) => {
    const num = parseInt(String(c.numero).replace(/\D/g, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 50);
  const proximoNum = ultimoNum + 1;
  const numeroPedido = `PC-2026-${String(proximoNum).padStart(3, '0')}`;

  const novoPedido = {
    id: `pc-${Date.now()}`,
    numero: numeroPedido,
    empresaId,
    data: new Date().toISOString().slice(0, 10),
    fornecedor: dados.fornecedor || insumo.fornecedorPadrao,
    insumoId: insumo.id,
    insumoNome: insumo.nome,
    siloDestinoId: dados.siloDestinoId || insumo.siloVinculadoId,
    siloDestinoNome: dados.siloDestinoNome || insumo.siloVinculadoNome,
    quantidade,
    unidade: insumo.unidade,
    precoUnitario,
    valorTotal,
    formaPagamento: dados.formaPagamento || 'Boleto 30 DDL',
    notaFiscal: dados.notaFiscal || 'Aguardando Emissão',
    previsaoEntrega: dados.previsaoEntrega || new Date(Date.now() + insumo.leadTimeDias * 86400000).toISOString().slice(0, 10),
    status: 'solicitado',
    observacoes: dados.observacoes || ''
  };

  data.concreto_compras.unshift(novoPedido);
  save();
  return { ok: true, pedido: novoPedido };
}

export async function registrarRecebimentoPesagemCompra(pedidoId, dadosRecebimento) {
  const data = inicializarDatastoreConcreto();
  const pedido = (data.concreto_compras || []).find(c => c.id === pedidoId || c.numero === pedidoId);
  if (!pedido) throw new Error(`Pedido de compra ${pedidoId} não encontrado.`);

  pedido.status = 'entregue_pesado';
  pedido.dataEntrada = new Date().toISOString().slice(0, 10);
  pedido.pesoBalançaEntradaTon = dadosRecebimento.pesoBalançaEntradaTon ? Number(dadosRecebimento.pesoBalançaEntradaTon) : pedido.quantidade;
  if (dadosRecebimento.notaFiscal) pedido.notaFiscal = dadosRecebimento.notaFiscal;
  if (dadosRecebimento.responsavelRecebimento) pedido.responsavelRecebimento = dadosRecebimento.responsavelRecebimento;

  // Creditar no Silo / Pátio correspondente
  const silo = (data.concreto_silos || []).find(s => s.id === pedido.siloDestinoId || s.codigo === pedido.siloDestinoId);
  if (silo) {
    const qtdEntrada = pedido.pesoBalançaEntradaTon || pedido.quantidade;
    if (silo.estoqueAtualTon != null) {
      silo.estoqueAtualTon = Math.min(silo.capacidadeTotalTon, +(silo.estoqueAtualTon + qtdEntrada).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualTon / silo.capacidadeTotalTon) * 100);
    } else if (silo.estoqueAtualM3 != null) {
      silo.estoqueAtualM3 = Math.min(silo.capacidadeTotalM3, +(silo.estoqueAtualM3 + qtdEntrada).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualM3 / silo.capacidadeTotalM3) * 100);
    } else if (silo.estoqueAtualL != null) {
      silo.estoqueAtualL = Math.min(silo.capacidadeTotalL, Math.round(silo.estoqueAtualL + qtdEntrada));
      silo.nivelPercent = Math.round((silo.estoqueAtualL / silo.capacidadeTotalL) * 100);
    }
    silo.ultimoCarregamento = new Date().toISOString().slice(0, 10);
  }

  save();
  return { ok: true, pedido, siloAtualizado: silo };
}

// =====================================================================
// 7. MOTOR DE CUSTOS E FORMAÇÃO DE PREÇO (COSTING ENGINE)
// =====================================================================
export function calcularCustoConcretoAvancado(params = {}) {
  const fck = Number(params.fck) || 25;
  const volumeM3 = Number(params.volumeM3) || 8;
  const distanciaKm = Number(params.distanciaKm) || 12; // Média urbana/perímetro Tangará da Serra
  const usaBomba = Boolean(params.tipoBomba && String(params.tipoBomba).toLowerCase().includes('bomba'));
  const bdiPercent = Number(params.bdiPercent) || 25.0; // BDI Industrial

  // 1. Busca BOM do traço
  const listaBOM = gerarListaTecnicaBOM();
  const bom = listaBOM.find(b => b.fck === fck) || listaBOM.find(b => b.fck === 25);
  const cpvInsumosM3 = bom.custoDiretoInsumosM3;
  const totalCpvInsumos = +(cpvInsumosM3 * volumeM3).toFixed(2);

  // 2. Custos Operacionais de Usinagem da Central Convicta (por m³)
  const energiaEletricaUsinaM3 = 8.50; // Consumo kWh dos motores da esteira e misturador
  const maoDeObraOperacionalM3 = 14.00; // Operador de usina + laboratorista + pá carregadeira
  const manutencaoDepreciacaoM3 = 7.50; // Desgaste de chapas de desgaste, balança e células
  const custoUsinagemM3 = +(energiaEletricaUsinaM3 + maoDeObraOperacionalM3 + manutencaoDepreciacaoM3).toFixed(2);
  const totalCustoUsinagem = +(custoUsinagemM3 * volumeM3).toFixed(2);

  // 3. Custos Logísticos de Transporte em Caminhão Betoneira 8x4 / 6x4
  // Consumo médio: 1,8 km/litro de Diesel S10 (R$ 5,95/L) com balão girando sob carga
  const consumoDieselPorKm = 5.95 / 1.8; // ~ R$ 3,30 por km rodado
  const freteBaseUrbanoM3 = 22.00; // Até 15 km de raio
  const freteKmExcedenteM3 = distanciaKm > 15 ? (distanciaKm - 15) * 1.80 : 0;
  const custoFreteM3 = +(freteBaseUrbanoM3 + freteKmExcedenteM3).toFixed(2);
  const totalCustoFrete = +(custoFreteM3 * volumeM3).toFixed(2);

  // 4. Custos de Bombeamento (se aplicável)
  let custoBombaM3 = 0;
  let totalCustoBomba = 0;
  if (usaBomba) {
    const taxaFixaMobilizacao = 750.00;
    const taxaExcedenteM3 = volumeM3 > 25 ? (volumeM3 - 25) * 25.00 : 0;
    totalCustoBomba = +(taxaFixaMobilizacao + taxaExcedenteM3).toFixed(2);
    custoBombaM3 = +(totalCustoBomba / volumeM3).toFixed(2);
  }

  // 5. Custo Direto Industrial Total (CPV + Usinagem + Frete + Bomba)
  const custoDiretoTotalM3 = +(cpvInsumosM3 + custoUsinagemM3 + custoFreteM3 + custoBombaM3).toFixed(2);
  const totalCustoDireto = +(totalCpvInsumos + totalCustoUsinagem + totalCustoFrete + totalCustoBomba).toFixed(2);

  // 6. Tributos Incidentes sobre o Faturamento (Simples / Lucro Presumido Tangará)
  // ISSQN Tangará da Serra: 3,0% | PIS/COFINS: 3,65% | IRPJ/CSLL Presumido: 4,80% = 11,45%
  const cargaTributariaPercent = 11.45;

  // 7. Formação de Preço
  // Preço de Venda = Custo Direto / (1 - (Tributos% + Margem% + DespesasAdm%)/100)
  const despesasAdmPercent = 5.0; // Despesas de escritório, comercial e TI
  const margemLucroDesejadaPercent = Number(params.margemDesejadaPercent) || 18.0;
  const divisorMarkup = (100 - (cargaTributariaPercent + despesasAdmPercent + margemLucroDesejadaPercent)) / 100;

  const precoSugeridoVendaM3 = +(custoDiretoTotalM3 / Math.max(0.4, divisorMarkup)).toFixed(2);
  const totalPrecoSugerido = +(precoSugeridoVendaM3 * volumeM3).toFixed(2);

  // Margem de Contribuição
  const tributosUnitario = +(precoSugeridoVendaM3 * (cargaTributariaPercent / 100)).toFixed(2);
  const receitaLiquidaM3 = +(precoSugeridoVendaM3 - tributosUnitario).toFixed(2);
  const margemContribuicaoM3 = +(receitaLiquidaM3 - custoDiretoTotalM3).toFixed(2);
  const margemContribuicaoPercent = +((margemContribuicaoM3 / precoSugeridoVendaM3) * 100).toFixed(1);

  return {
    fck,
    volumeM3,
    distanciaKm,
    usaBomba,
    traçoNome: bom.nome,
    proporcaoMassa: bom.proporcaoMassa,
    decomposicaoCustosM3: {
      cpvInsumos: cpvInsumosM3,
      usinagemCentral: custoUsinagemM3,
      freteBetoneira: custoFreteM3,
      servicoBomba: custoBombaM3,
      custoDiretoTotal: custoDiretoTotalM3
    },
    totaisLote: {
      totalCpvInsumos,
      totalCustoUsinagem,
      totalCustoFrete,
      totalCustoBomba,
      totalCustoDireto
    },
    precificacao: {
      tributosPercent: cargaTributariaPercent,
      despesasAdmPercent,
      margemLucroDesejadaPercent,
      precoSugeridoVendaM3,
      totalPrecoSugerido,
      margemContribuicaoM3,
      margemContribuicaoPercent
    },
    componentesBOM: bom.componentes
  };
}

// =====================================================================
// 8. ORDENS DE PRODUÇÃO (OP) & BAIXA ESTEQUIOMÉTRICA DE SILOS
// =====================================================================
export async function listarOrdensProducao(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const ordens = (data.concreto_ordens_producao || []).filter(op => !op.empresaId || op.empresaId === empresaId);
  return { ok: true, ordens };
}

export async function criarOrdemProducao(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  const fck = Number(dados.fck) || 25;
  const volumeM3 = Number(dados.volumeM3) || 8;
  const listaBOM = gerarListaTecnicaBOM();
  const bom = listaBOM.find(b => b.fck === fck) || listaBOM.find(b => b.fck === 25);

  const ultimoNum = (data.concreto_ordens_producao || []).reduce((max, op) => {
    const num = parseInt(String(op.numero).replace(/\D/g, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 90);
  const proximoNum = ultimoNum + 1;
  const numeroOP = `OP-2026-${String(proximoNum).padStart(3, '0')}`;

  const cimentoTeoricoKg = Math.round(bom.componentes.find(c => c.insumoId.includes('cim'))?.consumo * volumeM3 || 0);
  const areiaTeoricaKg = Math.round(bom.componentes.find(c => c.insumoId.includes('areia'))?.consumoKg * volumeM3 || 0);
  const britaTeoricaKg = Math.round(bom.componentes.find(c => c.insumoId.includes('brita'))?.consumoKg * volumeM3 || 0);
  const aguaTeoricaL = Math.round(bom.componentes.find(c => c.insumoId.includes('agua'))?.consumo * volumeM3 || 0);
  const aditivoTeoricoL = +(bom.componentes.find(c => c.insumoId.includes('adit'))?.consumo * volumeM3 || 0).toFixed(1);

  const novaOP = {
    id: `op-${Date.now()}`,
    numero: numeroOP,
    empresaId,
    dataHora: new Date().toISOString().replace('T', ' ').slice(0, 19),
    cargaId: dados.cargaId || null,
    cliente: dados.cliente || 'Produção Interna / Carga Avulsa',
    obra: dados.obra || 'Obra Padrão Tangará da Serra',
    fck,
    volumeM3,
    totalBateladas: Math.ceil(volumeM3 / 8),
    betoneirasEscaladas: dados.betoneirasEscaladas || ['BT-01'],
    consumoTeorico: {
      cimentoKg: cimentoTeoricoKg,
      areiaKg: areiaTeoricaKg,
      britaKg: britaTeoricaKg,
      aguaL: aguaTeoricaL,
      aditivoL: aditivoTeoricoL
    },
    consumoRealBalança: null,
    status: 'planejada',
    operador: dados.operador || 'Carlos Eduardo',
    aprovadoEngenharia: true,
    laudoCpVinculado: dados.laudoCpVinculado || null
  };

  data.concreto_ordens_producao.unshift(novaOP);
  save();
  return { ok: true, ordemProducao: novaOP };
}

export async function concluirOrdemProducao(opId, consumoRealBalança = null) {
  const data = inicializarDatastoreConcreto();
  const op = (data.concreto_ordens_producao || []).find(o => o.id === opId || o.numero === opId);
  if (!op) throw new Error(`Ordem de produção ${opId} não encontrada.`);

  op.status = 'concluida';
  op.consumoRealBalança = consumoRealBalança || op.consumoTeorico;

  // Realizar baixa automática de estoque nos silos e pátios
  const cimentoKg = op.consumoRealBalança.cimentoKg || op.consumoTeorico.cimentoKg;
  const cimentoTon = +(cimentoKg / 1000).toFixed(2);
  const areiaKg = op.consumoRealBalança.areiaKg || op.consumoTeorico.areiaKg;
  const areiaM3 = +(areiaKg / 1500).toFixed(2);
  const britaKg = op.consumoRealBalança.britaKg || op.consumoTeorico.britaKg;
  const britaM3 = +(britaKg / 1450).toFixed(2);
  const aditivoL = Math.round(op.consumoRealBalança.aditivoL || op.consumoTeorico.aditivoL);

  // Baixa no Silo 1 (Cimento CP II)
  const silo1 = (data.concreto_silos || []).find(s => s.id === 'silo-01' || s.codigo === 'SILO-01');
  if (silo1 && silo1.estoqueAtualTon != null) {
    silo1.estoqueAtualTon = Math.max(0, +(silo1.estoqueAtualTon - cimentoTon).toFixed(2));
    silo1.nivelPercent = Math.round((silo1.estoqueAtualTon / silo1.capacidadeTotalTon) * 100);
  }

  // Baixa no Pátio de Areia Média (Serrano Mineração)
  const patioAreia = (data.concreto_silos || []).find(s => s.id === 'patio-01' || s.codigo === 'PAT-AREIA-MED');
  if (patioAreia && patioAreia.estoqueAtualM3 != null) {
    patioAreia.estoqueAtualM3 = Math.max(0, +(patioAreia.estoqueAtualM3 - areiaM3).toFixed(2));
    patioAreia.nivelPercent = Math.round((patioAreia.estoqueAtualM3 / patioAreia.capacidadeTotalM3) * 100);
  }

  // Baixa no Box de Brita 1
  const boxBrita = (data.concreto_silos || []).find(s => s.id === 'patio-04' || s.codigo === 'PAT-BRITA-1');
  if (boxBrita && boxBrita.estoqueAtualM3 != null) {
    boxBrita.estoqueAtualM3 = Math.max(0, +(boxBrita.estoqueAtualM3 - britaM3).toFixed(2));
    boxBrita.nivelPercent = Math.round((boxBrita.estoqueAtualM3 / boxBrita.capacidadeTotalM3) * 100);
  }

  // Baixa no Tanque de Aditivo Plastificante
  const tanqueAditivo = (data.concreto_silos || []).find(s => s.id === 'tanque-01' || s.codigo === 'TNQ-ADITIVO-PLAST');
  if (tanqueAditivo && tanqueAditivo.estoqueAtualL != null) {
    tanqueAditivo.estoqueAtualL = Math.max(0, Math.round(tanqueAditivo.estoqueAtualL - aditivoL));
    tanqueAditivo.nivelPercent = Math.round((tanqueAditivo.estoqueAtualL / tanqueAditivo.capacidadeTotalL) * 100);
  }

  save();
  return { ok: true, ordemProducao: op, silosAtualizados: [silo1, patioAreia, boxBrita, tanqueAditivo] };
}

// =====================================================================
// 9. FUNÇÕES DE CARGAS, TELEMETRIA, ENSAIOS E PROPOSTAS
// =====================================================================
export async function criarCargaConcreto(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  const fck = Number(dados.fck) || 25;
  const volumeM3 = Number(dados.volumeM3) || 8;
  const tracoInfo = TRACOS_NORMATIZADOS[fck] || TRACOS_NORMATIZADOS[25];

  const ultimoNumero = (data.concreto_cargas || []).reduce((max, c) => Math.max(max, Number(c.numero) || 1000), 1000);
  const proximoNumero = ultimoNumero + 1;

  const precoM3 = dados.precoM3 || (fck === 20 ? 380 : fck === 25 ? 410 : fck === 30 ? 440 : fck === 35 ? 480 : fck === 40 ? 520 : 340);
  const subtotalConcreto = volumeM3 * precoM3;

  let taxaBomba = 0;
  if (dados.bomba && dados.bomba.toLowerCase().includes('bomba')) {
    taxaBomba = 750.00;
    if (volumeM3 > 25) {
      taxaBomba += (volumeM3 - 25) * 25.00;
    }
  }

  const valorTotal = subtotalConcreto + taxaBomba;

  const viagens = [];
  let volumeRestante = volumeM3;
  let viagemIndex = 1;
  const betoneirasDisponiveis = (data.concreto_frota || []).filter(f => f.tipo === 'betoneira');

  while (volumeRestante > 0) {
    const volViagem = Math.min(volumeRestante, 8);
    const betoneiraIndex = (viagemIndex - 1) % (betoneirasDisponiveis.length || 1);
    const veiculo = betoneirasDisponiveis[betoneiraIndex] || { codigo: `BT-0${viagemIndex}`, motorista: 'Motorista Padrão' };

    viagens.push({
      viagemNumero: viagemIndex,
      betoneira: veiculo.codigo,
      motorista: veiculo.motorista,
      volumeM3: volViagem,
      saidaUsina: null,
      chegadaObra: null,
      inicioDescarga: null,
      fimDescarga: null,
      status: 'agendada'
    });

    volumeRestante -= volViagem;
    viagemIndex++;
  }

  const loteCpId = `CP-2026-${String(proximoNumero).slice(-3)}`;
  const novaCarga = {
    id: `crg-${proximoNumero}`,
    numero: proximoNumero,
    empresaId,
    cliente: dados.cliente || 'Construtora Parceira',
    obra: dados.obra || 'Obra Residencial / Comercial',
    endereco: dados.endereco || 'Tangará da Serra - MT',
    elemento: dados.elemento || 'Lajes e Vigas',
    data: dados.data || new Date().toISOString().slice(0, 10),
    horarioInicio: dados.horarioInicio || '08:00',
    fck,
    slump: dados.slump || tracoInfo.slumpPadrao,
    brita: dados.brita || 'Brita 1',
    volumeM3,
    bomba: dados.bomba || 'Bomba Lança 32m (BL-01)',
    precoM3,
    subtotalConcreto,
    taxaBomba,
    valorTotal,
    status: 'agendado',
    loteCp: loteCpId,
    viagens
  };

  data.concreto_cargas.unshift(novaCarga);

  // Criar lote inicial de corpos de prova no laboratório
  const novoEnsaio = {
    id: `cp-2026-${String(proximoNumero).slice(-3)}`,
    lote: loteCpId,
    cargaId: novaCarga.id,
    cliente: novaCarga.cliente,
    obra: novaCarga.obra,
    endereco: novaCarga.endereco,
    fckProjeto: fck,
    slumpMedidoCm: parseInt(novaCarga.slump, 10) || 12,
    slumpProjeto: tracoInfo.slumpPadrao,
    dataMoldagem: novaCarga.data,
    responsavelTecnico: 'Engª Karin Prestes (CREA-MT 027300)',
    status: 'moldado',
    corposProva: [
      { id: 'CP-1', idadeDias: 7, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-2', idadeDias: 7, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-3', idadeDias: 28, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null },
      { id: 'CP-4', idadeDias: 28, dataRuptura: null, forcaKn: null, tensaoMpa: null, percentualFck: null }
    ],
    fckEstimado28d: null,
    laudoAprovado: null,
    laudoNumero: `LAUDO-2026/${String(proximoNumero).slice(-3)}-AGUARDANDO`
  };
  data.concreto_ensaios.unshift(novoEnsaio);

  // Criar Ordem de Produção (OP) vinculada
  await criarOrdemProducao({
    cargaId: novaCarga.id,
    cliente: novaCarga.cliente,
    obra: novaCarga.obra,
    fck,
    volumeM3,
    betoneirasEscaladas: viagens.map(v => v.betoneira),
    laudoCpVinculado: loteCpId
  }, empresaId);

  save();
  return { ok: true, carga: novaCarga, ensaio: novoEnsaio };
}

export async function atualizarStatusCarga(cargaId, status, observacoes = '') {
  const data = inicializarDatastoreConcreto();
  const carga = (data.concreto_cargas || []).find(c => c.id === cargaId || String(c.numero) === String(cargaId));
  if (!carga) throw new Error(`Carga ${cargaId} não encontrada.`);

  carga.status = status;
  if (observacoes) carga.observacoes = observacoes;

  save();
  return { ok: true, carga };
}

export async function registrarEventoViagem(cargaId, viagemIndex, evento, horario = null) {
  const data = inicializarDatastoreConcreto();
  const carga = (data.concreto_cargas || []).find(c => c.id === cargaId || String(c.numero) === String(cargaId));
  if (!carga) throw new Error(`Carga ${cargaId} não encontrada.`);

  const idx = Number(viagemIndex);
  const viagem = carga.viagens?.[idx];
  if (!viagem) throw new Error(`Viagem #${idx} não encontrada na carga.`);

  const agora = horario || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });

  if (evento === 'saida_usina') {
    viagem.saidaUsina = agora;
    viagem.status = 'em_transito';
    carga.status = 'em_andamento';
  } else if (evento === 'chegada_obra') {
    viagem.chegadaObra = agora;
    viagem.status = 'na_obra';
  } else if (evento === 'inicio_descarga') {
    viagem.inicioDescarga = agora;
    viagem.status = 'descarregando';
  } else if (evento === 'fim_descarga') {
    viagem.fimDescarga = agora;
    viagem.status = 'concluida';

    // Apuração de tempo de espera e hora parada
    if (viagem.chegadaObra && viagem.fimDescarga) {
      const [hChegada, mChegada] = viagem.chegadaObra.split(':').map(Number);
      const [hFim, mFim] = viagem.fimDescarga.split(':').map(Number);
      const minutosTotal = (hFim * 60 + mFim) - (hChegada * 60 + mChegada);
      viagem.tempoPermanenciaMinutos = minutosTotal;
      if (minutosTotal > 60) {
        viagem.esperaExcedenteMinutos = minutosTotal - 60;
        viagem.taxaHoraParada = +( (viagem.esperaExcedenteMinutos / 60) * 180.00 ).toFixed(2);
      } else {
        viagem.esperaExcedenteMinutos = 0;
        viagem.taxaHoraParada = 0;
      }
    }

    const todasConcluidas = carga.viagens.every(v => v.status === 'concluida');
    if (todasConcluidas) {
      carga.status = 'concluido';
    }
  }

  save();
  return { ok: true, carga, viagem };
}

export async function registrarRupturaCorpoProva(loteId, cpId, idadeDias, tensaoMpa, forcaKn = null) {
  const data = inicializarDatastoreConcreto();
  const ensaio = (data.concreto_ensaios || []).find(e => e.id === loteId || e.lote === loteId);
  if (!ensaio) throw new Error(`Lote de ensaio ${loteId} não encontrado.`);

  const cp = ensaio.corposProva?.find(c => c.id === cpId);
  if (!cp) throw new Error(`Corpo de prova ${cpId} não encontrado no lote.`);

  const tensao = Number(tensaoMpa);
  const forca = forcaKn != null ? Number(forcaKn) : +(tensao * 7.854).toFixed(1);

  cp.idadeDias = Number(idadeDias);
  cp.dataRuptura = new Date().toISOString().slice(0, 10);
  cp.tensaoMpa = tensao;
  cp.forcaKn = forca;
  cp.percentualFck = +((tensao / ensaio.fckProjeto) * 100).toFixed(1);

  const cps28d = ensaio.corposProva.filter(c => c.idadeDias === 28 && c.tensaoMpa != null);
  if (cps28d.length >= 2) {
    const soma = cps28d.reduce((acc, c) => acc + c.tensaoMpa, 0);
    const media28d = +(soma / cps28d.length).toFixed(1);
    ensaio.fckEstimado28d = media28d;
    ensaio.laudoAprovado = media28d >= ensaio.fckProjeto;
    ensaio.status = ensaio.laudoAprovado ? 'aprovado' : 'divergente';
    ensaio.laudoNumero = `LAUDO-2026/${ensaio.lote.replace(/\D/g, '')}-NBR5739`;
  } else {
    ensaio.status = 'em_cura';
  }

  save();
  return { ok: true, ensaio, corpoProva: cp };
}

export function calcularDosagemAvancada(params = {}) {
  const f = Number(params.fck) || 25;
  const v = Number(params.volumeM3) || 8;
  const uAreia = Number(params.umidadeAreiaPercent) || 4.5;
  const brita = params.brita || 'Brita 1';

  const base = TRACOS_NORMATIZADOS[f] || TRACOS_NORMATIZADOS[25];

  const cimentoKg = base.cimentoKg;
  const areiaSecaKg = Math.round(base.areiaM3 * 1500);
  const britaSecaKg = Math.round(base.britaM3 * 1450);
  const aguaLitros = base.aguaL;
  const aditivoLitros = base.aditivoL;

  const aguaContidaAreiaLitros = Math.round(areiaSecaKg * (uAreia / 100));
  const areiaCorrigidaKg = Math.round(areiaSecaKg * (1 + uAreia / 100));
  const aguaCorrigidaLitros = Math.max(80, Math.round(aguaLitros - aguaContidaAreiaLitros));

  return {
    fck: f,
    volumeM3: v,
    umidadeAreiaPercent: uAreia,
    brita,
    tracoProporcao: `1 : ${(areiaSecaKg / cimentoKg).toFixed(2)} : ${(britaSecaKg / cimentoKg).toFixed(2)} : ${base.fatorAc}`,
    fatorAguaCimento: base.fatorAc,
    porMetroCubico: {
      cimentoKg,
      areiaCorrigidaKg,
      britaKg: britaSecaKg,
      aguaCorrigidaLitros,
      aditivoLitros,
      aguaDescontadaLitros: aguaContidaAreiaLitros
    },
    totalCargaBetoneira: {
      cimentoTotalKg: Math.round(cimentoKg * v),
      cimentoSacos50: Math.round((cimentoKg * v) / 50),
      areiaTotalKg: Math.round(areiaCorrigidaKg * v),
      areiaTotalM3: (base.areiaM3 * v).toFixed(2),
      britaTotalKg: Math.round(britaSecaKg * v),
      britaTotalM3: (base.britaM3 * v).toFixed(2),
      aguaTotalLitros: Math.round(aguaCorrigidaLitros * v),
      aditivoTotalLitros: +(aditivoLitros * v).toFixed(1),
      pesoTotalEstimadoKg: Math.round((cimentoKg + areiaCorrigidaKg + britaSecaKg + aguaCorrigidaLitros) * v)
    }
  };
}

export async function criarPropostaComercial(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  const ultimoNumero = (data.concreto_propostas || []).reduce((max, p) => Math.max(max, Number(p.numero) || 100), 100);
  const proximoNumero = ultimoNumero + 1;

  const fck = Number(dados.fck) || 25;
  const volumeM3 = Number(dados.volumeM3) || 8;
  const precoM3 = dados.precoM3 || (fck === 20 ? 380 : fck === 25 ? 410 : fck === 30 ? 440 : fck === 35 ? 480 : fck === 40 ? 520 : 340);
  const subtotalConcreto = volumeM3 * precoM3;

  let taxaBomba = 0;
  if (dados.tipoBomba && dados.tipoBomba.toLowerCase().includes('bomba')) {
    taxaBomba = 750.00;
    if (volumeM3 > 25) {
      taxaBomba += (volumeM3 - 25) * 25.00;
    }
  }

  const freteKm = Number(dados.freteKm) || 0;
  const totalProposta = subtotalConcreto + taxaBomba + freteKm;

  const novaProposta = {
    id: `prop-2026-${proximoNumero}`,
    numero: proximoNumero,
    empresaId,
    cliente: dados.cliente || 'Construtora Parceira',
    contato: dados.contato || 'Responsável pela Obra',
    telefone: dados.telefone || '(65) 99999-0000',
    obra: dados.obra || 'Obra Residencial / Comercial',
    endereco: dados.endereco || 'Tangará da Serra - MT',
    dataCriacao: new Date().toISOString().slice(0, 10),
    validadeDias: Number(dados.validadeDias) || 15,
    fck,
    volumeM3,
    tipoBomba: dados.tipoBomba || 'Bomba Lança 32m',
    precoM3,
    subtotalConcreto,
    taxaBomba,
    freteKm,
    totalProposta,
    condicaoPagamento: dados.condicaoPagamento || 'Boleto faturado 14/28 DDL',
    status: 'enviada',
    observacoes: dados.observacoes || 'Incluso ensaio de slump test na obra e moldagem de 4 corpos de prova com laudo certificado.'
  };

  data.concreto_propostas.unshift(novaProposta);
  save();
  return { ok: true, proposta: novaProposta };
}

export async function atualizarStatusProposta(propostaId, status) {
  const data = inicializarDatastoreConcreto();
  const proposta = (data.concreto_propostas || []).find(p => p.id === propostaId);
  if (!proposta) throw new Error(`Proposta ${propostaId} não encontrada.`);

  proposta.status = status;
  save();
  return { ok: true, proposta };
}

export async function atualizarStatusVeiculoFrota(veiculoId, status, horimetro = null, motorista = null) {
  const data = inicializarDatastoreConcreto();
  const veiculo = (data.concreto_frota || []).find(f => f.id === veiculoId || f.codigo === veiculoId);
  if (!veiculo) throw new Error(`Veículo ${veiculoId} não encontrado na frota.`);

  veiculo.status = status;
  if (horimetro != null) veiculo.horimetro = Number(horimetro);
  if (motorista) veiculo.motorista = motorista;

  save();
  return { ok: true, veiculo };
}

export async function registrarMovimentacaoInsumoSilo(siloId, tipoMov, quantidade, motivo = '') {
  const data = inicializarDatastoreConcreto();
  const silo = (data.concreto_silos || []).find(s => s.id === siloId || s.codigo === siloId);
  if (!silo) throw new Error(`Silo / Pátio ${siloId} não encontrado.`);

  const qtd = Number(quantidade);
  if (tipoMov === 'entrada') {
    if (silo.estoqueAtualTon != null) {
      silo.estoqueAtualTon = Math.min(silo.capacidadeTotalTon, +(silo.estoqueAtualTon + qtd).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualTon / silo.capacidadeTotalTon) * 100);
    } else if (silo.estoqueAtualM3 != null) {
      silo.estoqueAtualM3 = Math.min(silo.capacidadeTotalM3, +(silo.estoqueAtualM3 + qtd).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualM3 / silo.capacidadeTotalM3) * 100);
    } else if (silo.estoqueAtualL != null) {
      silo.estoqueAtualL = Math.min(silo.capacidadeTotalL, Math.round(silo.estoqueAtualL + qtd));
      silo.nivelPercent = Math.round((silo.estoqueAtualL / silo.capacidadeTotalL) * 100);
    }
    silo.ultimoCarregamento = new Date().toISOString().slice(0, 10);
  } else if (tipoMov === 'saida') {
    if (silo.estoqueAtualTon != null) {
      silo.estoqueAtualTon = Math.max(0, +(silo.estoqueAtualTon - qtd).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualTon / silo.capacidadeTotalTon) * 100);
    } else if (silo.estoqueAtualM3 != null) {
      silo.estoqueAtualM3 = Math.max(0, +(silo.estoqueAtualM3 - qtd).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualM3 / silo.capacidadeTotalM3) * 100);
    } else if (silo.estoqueAtualL != null) {
      silo.estoqueAtualL = Math.max(0, Math.round(silo.estoqueAtualL - qtd));
      silo.nivelPercent = Math.round((silo.estoqueAtualL / silo.capacidadeTotalL) * 100);
    }
  }

  save();
  return { ok: true, silo };
}


// =====================================================================
// 10. MÓDULO SERRANO MINERAÇÃO (DRAGAGEM DE AREIA & EXPEDIÇÃO DE AGREGADOS)
// =====================================================================
export async function listarMineracao(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const dragas = (data.concreto_mineracao_dragas || []).filter(d => !d.empresaId || d.empresaId === empresaId);
  const patios = (data.concreto_mineracao_patios || []).filter(p => !p.empresaId || p.empresaId === empresaId);
  const vendas = (data.concreto_vendas_agregados || []).filter(v => !v.empresaId || v.empresaId === empresaId);
  const totalAreiaExtraidaHoje = dragas.reduce((acc, d) => acc + (Number(d.producaoHojeM3) || 0), 0);
  const faturamentoAgregadosHoje = vendas.reduce((acc, v) => acc + (Number(v.valorTotal) || 0), 0);
  const totalCfemApurado = vendas.reduce((acc, v) => acc + (Number(v.valorCfem) || 0), 0);

  return {
    ok: true,
    dragas,
    patios,
    vendas,
    resumo: {
      totalAreiaExtraidaHoje,
      faturamentoAgregadosHoje,
      totalCfemApurado,
      royaltiesAliquota: '1.5% (Lei 13.540/2017)',
      licencasSemaMt: 'Regulares'
    }
  };
}

export async function registrarExtracaoDraga(dragaId, dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const draga = (data.concreto_mineracao_dragas || []).find(d => d.id === dragaId);
  if (!draga) throw new Error(`Draga ${dragaId} não encontrada.`);

  const volumeM3 = Number(dados.volumeM3) || 0;
  draga.producaoHojeM3 = (Number(draga.producaoHojeM3) || 0) + volumeM3;
  if (dados.horimetro) draga.horimetroHoras = Number(dados.horimetro);
  if (dados.status) draga.status = dados.status;

  // Atualizar estoque no pátio de areia correspondente
  const patioId = dados.patioId || (dragaId === 'draga-01' ? 'patio-areia-media' : 'patio-areia-grossa');
  const patio = (data.concreto_mineracao_patios || []).find(p => p.id === patioId);
  if (patio) {
    patio.estoqueAtualM3 = Math.min(patio.capacidadeM3, +(patio.estoqueAtualM3 + volumeM3).toFixed(2));
    if (dados.umidadeSuperficial) patio.umidadeSuperficialPercent = Number(dados.umidadeSuperficial);
  }

  save();
  return { ok: true, draga, patio };
}

export async function emitirRomaneioVendaAgregado(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const numeroSeq = (data.concreto_vendas_agregados?.length || 0) + 503;
  const pesoBruto = Number(dados.pesoBrutoKg) || 0;
  const tara = Number(dados.taraKg) || 0;
  const pesoLiquido = Math.max(0, pesoBruto - tara);
  const densidade = dados.produtoId?.includes('brita') ? 1450 : 1500;
  const volumeM3 = +(pesoLiquido / densidade).toFixed(2);
  const precoUnitario = Number(dados.precoUnitarioM3) || (dados.produtoId?.includes('brita') ? 125.00 : 65.00);
  const valorTotal = +(volumeM3 * precoUnitario).toFixed(2);
  const valorCfem = +(valorTotal * 0.015).toFixed(2); // 1.5% CFEM

  const novoRomaneio = {
    id: `vda-agr-${numeroSeq}`,
    numeroRomaneio: `ROM-AGR-${numeroSeq}`,
    data: new Date().toISOString().replace('T', ' ').slice(0, 16),
    empresaId,
    cliente: dados.cliente || 'Cliente Balança Balcão',
    cnpjCliente: dados.cnpjCliente || '00.000.000/0001-00',
    obraDestino: dados.obraDestino || 'Obras Tangará da Serra/MT',
    veiculoPlaca: dados.veiculoPlaca || 'RAQ-1234',
    motorista: dados.motorista || 'Motorista Próprio',
    produtoId: dados.produtoId || 'ins-areia-med',
    produtoNome: dados.produtoNome || 'Areia Média Lavada Rio (Serrano Mineração)',
    pesoBrutoKg: pesoBruto,
    taraKg: tara,
    pesoLiquidoKg: pesoLiquido,
    volumeM3,
    precoUnitarioM3: precoUnitario,
    valorTotal,
    aliquotaCfemPercent: 1.5,
    valorCfem,
    statusNfe: 'autorizada',
    nfeNumero: `00${numeroSeq + 4310}`
  };

  data.concreto_vendas_agregados.unshift(novoRomaneio);

  // Dar baixa no estoque do pátio
  const patio = (data.concreto_mineracao_patios || []).find(p => p.id === (dados.patioId || 'patio-areia-media'));
  if (patio) {
    patio.estoqueAtualM3 = Math.max(0, +(patio.estoqueAtualM3 - volumeM3).toFixed(2));
  }

  save();
  return { ok: true, romaneio: novoRomaneio };
}

// =====================================================================
// 11. CONTROLE ESTATÍSTICO DE RESISTÊNCIA DO CONCRETO NBR 12655
// =====================================================================
export function calcularEstatisticaResistenciaLote(loteId, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const ensaio = (data.concreto_ensaios || []).find(e => e.lote === loteId || e.id === loteId);
  if (!ensaio) throw new Error(`Lote de ensaio ${loteId} não encontrado.`);

  const fckProjeto = Number(ensaio.fckProjeto) || 30;
  const cps28d = (ensaio.corposProva || []).filter(cp => cp.idadeDias === 28 && cp.tensaoMpa != null);
  const tensoes = cps28d.map(cp => Number(cp.tensaoMpa));

  if (tensoes.length === 0) {
    return {
      ok: true,
      lote: ensaio.lote,
      fckProjeto,
      status: ensaio.status,
      mensagem: 'Aguardando rompimento aos 28 dias para apuração do fck estimado NBR 12655.'
    };
  }

  // Estatística Amostral NBR 12655
  const n = tensoes.length;
  const soma = tensoes.reduce((a, b) => a + b, 0);
  const media = +(soma / n).toFixed(2);
  const variancia = tensoes.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / (n > 1 ? n - 1 : 1);
  const desvioPadrao = +(Math.sqrt(variancia)).toFixed(2);
  const coeficienteVariacao = +((desvioPadrao / media) * 100).toFixed(1);

  // fck estimado conforme NBR 12655 para n >= 2 (amostragem 1:1)
  const fckEstimado = Math.min(...tensoes);
  const percentualAtingido = +((fckEstimado / fckProjeto) * 100).toFixed(1);
  const aprovado = fckEstimado >= fckProjeto;

  return {
    ok: true,
    lote: ensaio.lote,
    cliente: ensaio.cliente,
    obra: ensaio.obra,
    fckProjeto,
    nCorposProva28d: n,
    tensoesIndividuais: tensoes,
    resistenciaMediaMpa: media,
    desvioPadraoMpa: desvioPadrao,
    coeficienteVariacaoPercent: coeficienteVariacao,
    fckEstimado28d: fckEstimado,
    percentualFckAtingido: percentualAtingido,
    conformidadeEstrutural: aprovado ? 'CONFORME (NBR 12655)' : 'NÃO CONFORME (ABRIR INVESTIGAÇÃO NBR 7680)',
    responsavelTecnico: ensaio.responsavelTecnico,
    laudoNumero: ensaio.laudoNumero
  };
}

// =====================================================================
// 12. GERADOR DE ROMANEIO OFICIAL NBR 7212 (HTML TIMBRADO PARA IMPRESSÃO)
// =====================================================================
export async function gerarHtmlRomaneioOficial(cargaId, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const carga = (data.concreto_cargas || []).find(c => c.id === cargaId || c.numero === Number(cargaId));
  if (!carga) throw new Error(`Carga ${cargaId} não encontrada.`);

  const v1 = carga.viagens?.[0] || { betoneira: 'BT-01', motorista: 'Marcos Silveira', volume: 8 };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Romaneio de Entrega NBR 7212 - Carga #${carga.numero}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; background: #FFF; }
    .header { border-bottom: 2px solid #EA580C; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 16px; font-weight: bold; color: #0F172A; text-transform: uppercase; }
    .subtitle { font-size: 10px; color: #64748B; }
    .doc-num { font-size: 14px; font-weight: bold; color: #EA580C; text-align: right; }
    .box { border: 1px solid #CBD5E1; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .label { font-size: 9px; font-weight: bold; color: #64748B; text-transform: uppercase; }
    .value { font-size: 12px; font-weight: bold; color: #0F172A; }
    .alert-nbr { background: #FEF3C7; border: 1px solid #F59E0B; padding: 8px; border-radius: 4px; font-size: 10px; color: #92400E; margin-bottom: 10px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; text-align: center; }
    .line { border-top: 1px solid #111; margin-top: 40px; padding-top: 4px; font-weight: bold; font-size: 10px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">🚚 SERRANO CONCRETO USINADO & MINERAÇÃO</div>
      <div class="subtitle">Tangará da Serra - MT · CNPJ: 51.499.928/0001-01 · Inscrição Estadual: 13.567.890-3 · RNTRC: 056256077</div>
      <div class="subtitle">Central Telefônica: (65) 99946-4899 / (65) 99996-3795 · RT: Engª Karin Prestes (CREA-MT 027300)</div>
    </div>
    <div>
      <div class="doc-num">ROMANEIO OFICIAL NBR 7212</div>
      <div style="font-size: 13px; font-weight: bold; text-align: right;">Carga Nº ${carga.numero}</div>
      <div style="font-size: 10px; text-align: right; color: #64748B;">Data: ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>

  <div class="box">
    <div class="label">DADOS DO CLIENTE & OBRA DE CONCRETAGEM</div>
    <div class="grid-2" style="margin-top: 4px;">
      <div><span class="label">Cliente / Construtora:</span> <span class="value">${carga.cliente}</span></div>
      <div><span class="label">Local / Obra:</span> <span class="value">${carga.obra}</span></div>
      <div style="grid-column: span 2;"><span class="label">Endereço da Obra:</span> <span class="value">${carga.endereco}</span></div>
    </div>
  </div>

  <div class="box">
    <div class="label">ESPECIFICAÇÕES TÉCNICAS DO CONCRETO (NBR 7212 / NBR 8953)</div>
    <div class="grid" style="margin-top: 4px;">
      <div><span class="label">Resistência de Projeto (FCK):</span> <div class="value" style="color: #EA580C;">${carga.fck}</div></div>
      <div><span class="label">Slump de Projeto:</span> <div class="value">${carga.slump}</div></div>
      <div><span class="label">Volume Total Programado:</span> <div class="value">${carga.volumeM3} m³</div></div>
      <div><span class="label">Sistema de Descarga:</span> <div class="value">${carga.bomba}</div></div>
    </div>
  </div>

  <div class="box">
    <div class="label">TELEMETRIA DA BETONEIRA & HORÁRIOS NORMATIVOS (NBR 7212)</div>
    <div class="grid" style="margin-top: 4px;">
      <div><span class="label">Veículo Betoneira:</span> <div class="value">${v1.betoneira || 'BT-01'}</div></div>
      <div><span class="label">Motorista / Operador:</span> <div class="value">${v1.motorista || 'Marcos Silveira'}</div></div>
      <div><span class="label">Horário Adição de Água na Usina:</span> <div class="value">${v1.saida || '08:15'}</div></div>
      <div><span class="label">Tempo Limite Descarga (150 min):</span> <div class="value" style="color: #DC2626;">Máximo 2h30 da adição de água</div></div>
      <div><span class="label">Horário Chegada na Obra:</span> <div class="value">${v1.chegada || '____:____'}</div></div>
      <div><span class="label">Início da Descarga:</span> <div class="value">____:____</div></div>
      <div><span class="label">Término da Descarga:</span> <div class="value">${v1.fimDescarga || '____:____'}</div></div>
      <div><span class="label">Slump Test Medido na Obra:</span> <div class="value">____ ± 2 cm</div></div>
    </div>
  </div>

  <div class="alert-nbr">
    <strong>⚠️ ADVERTÊNCIA NORMATIVA NBR 7212 (ITEM 5.4.3):</strong> É expressamente proibida a adição de água no caminhão betoneira na obra sem a prévia autorização por escrito do engenheiro responsável estrutural. Qualquer água adicional não prevista no traço anula a garantia tecnológica da resistência FCK contratada.
  </div>

  <div class="box">
    <div class="label">CORPOS DE PROVA MOLDADOS (NBR 5738 / CONTROLE TECNOLÓGICO)</div>
    <div class="grid-2" style="margin-top: 4px;">
      <div><span class="label">Identificação do Lote:</span> <span class="value">${carga.laudoCp || 'CP-2026-089 (4 corpos de prova)'}</span></div>
      <div><span class="label">Idades de Ruptura Homologadas:</span> <span class="value">7 dias (controle prévio) e 28 dias (característica)</span></div>
    </div>
  </div>

  <div class="signatures">
    <div>
      <div class="line">ASSINATURA DO MOTORISTA DA BETONEIRA<br><span style="font-size: 9px; color: #64748B;">Serrano Concreto Usinado</span></div>
    </div>
    <div>
      <div class="line">RECEBIDO NA OBRA (ENCARREGADO / ENGENHEIRO)<br><span style="font-size: 9px; color: #64748B;">Nome Legível e Assinatura</span></div>
    </div>
  </div>
</body>
</html>`;

  return { ok: true, cargaId: carga.id, numero: carga.numero, html };
}

// =====================================================================
// 13. MÓDULO DE MEDIÇÕES DE OBRAS & CONTRATOS DE CONCRETO
// =====================================================================
export async function listarMedicoesObras(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const medicoes = (data.concreto_medicoes_obras || []).filter(m => !m.empresaId || m.empresaId === empresaId);
  return { ok: true, medicoes };
}

export async function criarMedicaoObra(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const numeroSeq = (data.concreto_medicoes_obras?.length || 0) + 1;
  const volTotal = Number(dados.volumeTotalM3) || 0;
  const precoM3 = Number(dados.precoMedioM3) || 440.00;
  const taxaBomba = Number(dados.taxaBombaTotal) || 0;
  const valorBrutoConcreto = +(volTotal * precoM3).toFixed(2);
  const valorBrutoTotal = +(valorBrutoConcreto + taxaBomba).toFixed(2);
  const retencaoPerc = Number(dados.retencaoTecnicaPercent) || 0;
  const valorRetencao = +(valorBrutoTotal * (retencaoPerc / 100)).toFixed(2);
  const valorLiquido = +(valorBrutoTotal - valorRetencao).toFixed(2);

  const novaMedicao = {
    id: `med-2026-0${numeroSeq}`,
    numero: `MED-2026/0${numeroSeq}`,
    empresaId,
    cliente: dados.cliente || 'Construtora',
    cnpjCliente: dados.cnpjCliente || '00.000.000/0001-00',
    obra: dados.obra || 'Obra Comercial',
    endereco: dados.endereco || 'Tangará da Serra/MT',
    periodoInicio: dados.periodoInicio || new Date().toISOString().slice(0, 10),
    periodoFim: dados.periodoFim || new Date().toISOString().slice(0, 10),
    volumeTotalM3: volTotal,
    cargasIds: dados.cargasIds || [],
    eventosBombeamento: Number(dados.eventosBombeamento) || 1,
    taxaBombaTotal: taxaBomba,
    valorBrutoConcreto,
    valorBrutoTotal,
    retencaoTecnicaPercent: retencaoPerc,
    valorRetencaoTecnica: valorRetencao,
    valorLiquidoFaturar: valorLiquido,
    status: 'aguardando_aprovacao_engenheiro',
    engenheiroFiscalObra: dados.engenheiroFiscalObra || 'Eng. Fiscal Responsável',
    condicaoPagamento: dados.condicaoPagamento || 'Boleto 28 DDL'
  };

  data.concreto_medicoes_obras.unshift(novaMedicao);
  save();
  return { ok: true, medicao: novaMedicao };
}

export async function atualizarStatusMedicao(medicaoId, status) {
  const data = inicializarDatastoreConcreto();
  const medicao = (data.concreto_medicoes_obras || []).find(m => m.id === medicaoId || m.numero === medicaoId);
  if (!medicao) throw new Error(`Medição ${medicaoId} não encontrada.`);
  medicao.status = status;
  save();
  return { ok: true, medicao };
}
