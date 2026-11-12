import crypto from 'crypto';
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
  if (!Array.isArray(data.concreto_tickets_balanca)) data.concreto_tickets_balanca = [];

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
  if (data.concreto_tickets_balanca.length === 0) {
    data.concreto_tickets_balanca = TICKETS_BALANCA_INICIAIS.map(t => ({ ...t, empresaId: CONCRETO_EMPRESA_ID }));
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
// =====================================================================
// 14. ASSINATURA DIGITAL NA ENTREGA & ROMANEIO COM TICKET DE PESAGEM
// =====================================================================

export async function assinarEntregaCarga(cargaId, dadosAssinatura, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  let carga = (data.concreto_cargas || []).find(c => c.id === cargaId || String(c.numero) === String(cargaId));
  
  if (!carga) {
    // Buscar carga padrao se ainda não salva no datastore
    const cDefault = CONCRETO_CARGAS_INICIAIS.find(c => c.id === cargaId || String(c.numero) === String(cargaId));
    if (cDefault) {
      carga = JSON.parse(JSON.stringify(cDefault));
      data.concreto_cargas.push(carga);
    } else {
      throw new Error(`Carga ${cargaId} não encontrada para assinatura.`);
    }
  }

  const horaAtualCuiaba = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });
  const dataAtualCuiaba = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });
  const isoAtual = new Date().toISOString();

  const recebedorNome = dadosAssinatura.recebedorNome || 'Eng. Marcelo Dantas';
  const recebedorDocumento = dadosAssinatura.recebedorDocumento || '045.892.110-34';
  const recebedorCargo = dadosAssinatura.recebedorCargo || 'Engenheiro Residente (Fiscal da Obra)';
  const slumpMedidoCm = Number(dadosAssinatura.slumpMedidoCm) || 14.0;
  const aguaAdicionadaObraLitros = Number(dadosAssinatura.aguaAdicionadaObraLitros) || 0;
  const observacoes = dadosAssinatura.observacoes || 'Concreto recebido nas condições normativas NBR 7212. Slump aprovado.';

  // Gerar hash criptográfico SHA-256 de autenticidade do romaneio e assinatura
  const payloadHash = `${carga.id}|${carga.numero}|${recebedorDocumento}|${isoAtual}|${slumpMedidoCm}|${aguaAdicionadaObraLitros}`;
  const hashSha256 = crypto.createHash('sha256').update(payloadHash).digest('hex');
  const codigoAutenticidade = `SERRANO-NBR7212-${hashSha256.slice(0, 16).toUpperCase()}`;

  // Criar ou atualizar Ticket de Pesagem da Balança Rodoviária 80t Toledo
  const pesoBrutoKg = 33480;
  const taraKg = 14280;
  const pesoLiquidoKg = pesoBrutoKg - taraKg; // 19.200 kg
  const volumeM3 = Number(carga.volumeM3) || 8;
  const densidadeAparente = Math.round(pesoLiquidoKg / volumeM3);

  const ticketPesagem = {
    numeroTicket: `TKT-BAL-${carga.numero || 1001}`,
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    operadorBalanca: 'Paulo Cezar (Matrícula 042 - Certificação IPEM-MT)',
    dataHoraPesagem: `${dataAtualCuiaba} ${horaAtualCuiaba}`,
    veiculoPlaca: carga.viagens?.[0]?.veiculo ? `${carga.viagens[0].veiculo} · VW Constellation 26.280 (Placa RRA-4E80)` : 'BT-01 · VW Constellation 26.280 (Placa RRA-4E80)',
    motorista: 'Marcos Silveira',
    pesoBrutoKg,
    taraKg,
    pesoLiquidoKg,
    densidadeKgM3: densidadeAparente,
    volumeCalculadoM3: volumeM3,
    afericaoIpem: 'Portaria INMETRO/IPEM-MT nº 148/2026 · Válida até 08/2027'
  };

  // Registrar assinatura digital
  carga.assinaturaEntrega = {
    status: 'assinado',
    imagemBase64: dadosAssinatura.assinaturaBase64 || null,
    recebedorNome,
    recebedorDocumento,
    recebedorCargo,
    dataHoraAssinatura: `${dataAtualCuiaba} às ${horaAtualCuiaba}`,
    dataHoraIso: isoAtual,
    slumpMedidoCm,
    aguaAdicionadaObraLitros,
    observacoes,
    hashSha256,
    codigoAutenticidade,
    termoAceite: 'Declaro para os devidos fins que o concreto usinado especificado neste romaneio foi conferido e recebido na obra em conformidade com as normas ABNT NBR 7212 e NBR 8953, atestando consistência de abatimento (slump) e volume.'
  };

  carga.ticketPesagem = ticketPesagem;
  carga.status = 'concluido';

  // Atualizar viagens
  if (Array.isArray(carga.viagens) && carga.viagens.length > 0) {
    carga.viagens = carga.viagens.map(v => ({
      ...v,
      fimDescarga: v.fimDescarga && v.fimDescarga !== '—' ? v.fimDescarga : horaAtualCuiaba,
      status: 'concluido',
      assinado: true
    }));
  }

  save();
  return { ok: true, carga, hashSha256, codigoAutenticidade };
}

export async function obterRomaneioCompleto(cargaId, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  let carga = (data.concreto_cargas || []).find(c => c.id === cargaId || String(c.numero) === String(cargaId));
  if (!carga) {
    carga = CONCRETO_CARGAS_INICIAIS.find(c => c.id === cargaId || String(c.numero) === String(cargaId));
  }
  if (!carga) throw new Error(`Carga ${cargaId} não encontrada.`);
  return { ok: true, carga };
}

export async function emitirTicketPesagemBalanca(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const seq = (data.concreto_tickets_balanca?.length || 0) + 9840;
  const dataAtual = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });

  const pesoBruto = Number(dados.pesoBrutoKg) || 0;
  const tara = Number(dados.taraKg) || 0;
  const pesoLiquido = Math.max(0, pesoBruto - tara);
  const densidade = dados.tipoMaterial?.toLowerCase().includes('brita') ? 1450 : 1500;
  const volumeM3 = +(pesoLiquido / densidade).toFixed(2);
  const precoM3 = Number(dados.precoUnitarioM3) || (dados.tipoMaterial?.toLowerCase().includes('brita') ? 125.00 : 65.00);
  const valorTotal = +(volumeM3 * precoM3).toFixed(2);
  const valorCfem = +(valorTotal * 0.015).toFixed(2);

  const hashSha256 = crypto.createHash('sha256').update(`TKT-${seq}|${dados.placaVeiculo}|${pesoLiquido}|${new Date().toISOString()}`).digest('hex');

  const novoTicket = {
    id: `tkt-${seq}`,
    numeroTicket: `TKT-BAL-${seq}`,
    empresaId,
    dataHora: `${dataAtual} ${horaAtual}`,
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    operador: dados.operador || 'Paulo Cezar (Matrícula 042 - IPEM-MT)',
    cliente: dados.cliente || 'Construtora / Terceiro',
    cnpjCpfCliente: dados.cnpjCpfCliente || '00.000.000/0001-00',
    obraDestino: dados.obraDestino || 'Obras em Tangará da Serra/MT',
    veiculoPlaca: dados.placaVeiculo || 'RAQ-4420',
    motorista: dados.motorista || 'Motorista Transportador',
    transportadora: dados.transportadora || 'Frota Própria Serrano',
    tipoMaterial: dados.tipoMaterial || 'Areia Média Lavada de Rio (Sepotuba)',
    pesoBrutoKg: pesoBruto,
    taraKg: tara,
    pesoLiquidoKg: pesoLiquido,
    densidadeKgM3: densidade,
    volumeCalculadoM3: volumeM3,
    precoUnitarioM3: precoM3,
    valorTotal,
    valorCfem,
    aliquotaCfemPercent: 1.5,
    assinaturaMotoristaBase64: dados.assinaturaMotoristaBase64 || null,
    status: 'emitido',
    codigoAutenticidade: `BAL-TOLEDO-${hashSha256.slice(0, 16).toUpperCase()}`
  };

  data.concreto_tickets_balanca.unshift(novoTicket);
  save();
  return { ok: true, ticket: novoTicket };
}

export async function gerarHtmlTicketBalanca(ticketId, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const ticket = (data.concreto_tickets_balanca || []).find(t => t.id === ticketId || t.numeroTicket === ticketId) || {
    numeroTicket: 'TKT-BAL-9841',
    dataHora: '12/11/2026 08:12',
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    operador: 'Paulo Cezar (Matrícula 042 - IPEM-MT)',
    cliente: 'Construtora MT Horizon',
    veiculoPlaca: 'BT-01 (VW Constellation 26.280 · Placa RRA-4E80)',
    motorista: 'Marcos Silveira',
    tipoMaterial: 'Concreto Usinado Estrutural FCK 30 MPa',
    pesoBrutoKg: 33480,
    taraKg: 14280,
    pesoLiquidoKg: 19200,
    volumeCalculadoM3: 8.0,
    codigoAutenticidade: 'BAL-TOLEDO-A79B3F40E2C18901'
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Ticket de Pesagem - Balança Rodoviária 80t Toledo - Serrano Concreto</title>
  <style>
    body { font-family: 'Courier New', monospace; width: 340px; margin: 0 auto; padding: 15px; color: #111; font-size: 11px; line-height: 1.4; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #333; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .stamp { border: 2px solid #16A34A; color: #16A34A; font-weight: bold; text-align: center; padding: 6px; margin: 10px 0; border-radius: 4px; font-size: 10px; }
    @media print { body { width: 100%; padding: 0; } }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 13px;">SERRANO CONCRETO & MINERAÇÃO LTDA</div>
  <div class="center">Rodovia MT-358 km 08 · Tangará da Serra/MT</div>
  <div class="center">CNPJ: 51.499.928/0001-01 · IE: 13.567.890-3</div>
  <div class="divider"></div>
  <div class="center bold" style="font-size: 12px;">TICKET DE PESAGEM RODOVIÁRIA</div>
  <div class="center bold" style="font-size: 13px; color: #EA580C;">${ticket.numeroTicket}</div>
  <div class="divider"></div>
  <div class="row"><span>Data/Hora:</span><span class="bold">${ticket.dataHora}</span></div>
  <div class="row"><span>Balança:</span><span>Toledo 80t (Plataforma 21m)</span></div>
  <div class="row"><span>Operador:</span><span>${ticket.operador}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Veículo/Placa:</span><span class="bold">${ticket.veiculoPlaca}</span></div>
  <div class="row"><span>Motorista:</span><span>${ticket.motorista}</span></div>
  <div class="row"><span>Cliente:</span><span class="bold">${ticket.cliente}</span></div>
  <div class="row"><span>Material:</span><span>${ticket.tipoMaterial}</span></div>
  <div class="divider"></div>
  <div class="row" style="font-size: 13px;"><span>PESO BRUTO:</span><span class="bold">${Number(ticket.pesoBrutoKg).toLocaleString('pt-BR')} kg</span></div>
  <div class="row" style="font-size: 13px;"><span>TARA VEÍCULO:</span><span class="bold">${Number(ticket.taraKg).toLocaleString('pt-BR')} kg</span></div>
  <div class="divider"></div>
  <div class="row bold" style="font-size: 15px; color: #111;"><span>PESO LÍQUIDO:</span><span>${Number(ticket.pesoLiquidoKg).toLocaleString('pt-BR')} kg</span></div>
  <div class="row"><span>Volume Equivalente:</span><span class="bold">${ticket.volumeCalculadoM3} m³</span></div>
  <div class="divider"></div>
  <div class="stamp">✓ PESAGEM AUTOMÁTICA REGISTRADA NO SISTEMA KYTTO ERP<br><small>${ticket.codigoAutenticidade}</small></div>
  <div class="center" style="margin-top: 15px;">___________________________________<br>Assinatura do Motorista / Conferente</div>
</body>
</html>`;
  return { ok: true, ticketId: ticket.id || ticket.numeroTicket, html };
}

// =====================================================================
// 15. GERADOR OFICIAL DE ROMANEIO NBR 7212 COM ASSINATURA DIGITAL
// =====================================================================

export async function gerarHtmlRomaneioOficial(cargaId, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  let carga = (data.concreto_cargas || []).find(c => c.id === cargaId || String(c.numero) === String(cargaId));
  if (!carga) {
    carga = CONCRETO_CARGAS_INICIAIS.find(c => c.id === cargaId || String(c.numero) === String(cargaId)) || {
      id: 'crg-1001',
      numero: 1001,
      cliente: 'Construtora MT Horizon',
      obra: 'Edifício Residencial Serra Dourada · Lajes do 4º Pavimento',
      endereco: 'Rua José Corsino, 450, Jardim Europa, Tangará da Serra/MT',
      fck: 'FCK 30 MPa (Brita 1)',
      slump: '14 ± 2 cm',
      volumeM3: 24,
      bomba: 'BL-01 (Bomba Lança 32m)',
      laudoCp: 'CP-2026-089 (4 corpos de prova)',
      status: 'concluido'
    };
  }

  const v1 = (carga.viagens && carga.viagens[0]) || {
    veiculo: 'BT-01',
    motorista: 'Marcos Silveira',
    saidaUsina: '08:15',
    chegadaObra: '08:35',
    fimDescarga: '09:20'
  };

  const ass = carga.assinaturaEntrega || null;
  const tkt = carga.ticketPesagem || {
    numeroTicket: `TKT-BAL-${carga.numero || 1001}`,
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano',
    operadorBalanca: 'Paulo Cezar (Matrícula 042)',
    pesoBrutoKg: 33480,
    taraKg: 14280,
    pesoLiquidoKg: 19200,
    densidadeKgM3: 2400,
    volumeCalculadoM3: 8.0
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Romaneio Oficial NBR 7212 - Carga #${carga.numero} - Serrano Concreto</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; color: #16181B; background: #FFFFFF; font-size: 11px; line-height: 1.45; }
    .container { max-width: 820px; margin: 0 auto; border: 2px solid #CBD5E1; padding: 18px; border-radius: 6px; }
    .header { border-bottom: 2px solid #FF7000; padding-bottom: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 18px; font-weight: 900; color: #16181B; letter-spacing: -0.5px; }
    .brand span { color: #FF7000; }
    .subtitle { font-size: 10px; color: #475569; margin-top: 2px; }
    .doc-badge { text-align: right; }
    .doc-badge .title { font-size: 13px; font-weight: 900; color: #FF7000; text-transform: uppercase; }
    .doc-badge .number { font-size: 18px; font-weight: 900; color: #16181B; font-family: monospace; }
    .section-title { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E2E8F0; padding-bottom: 3px; margin-bottom: 6px; }
    .box { border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; background: #F8FAFC; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .label { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .val { font-size: 12px; font-weight: 700; color: #0F172A; }
    .alert-nbr { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 8px 12px; font-size: 10px; color: #92400E; margin-bottom: 10px; line-height: 1.4; border-radius: 0 4px 4px 0; }
    .sign-card { border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center; background: #FFFFFF; min-height: 130px; display: flex; flex-direction: column; justify-content: space-between; }
    .sign-stamp { border: 2px solid #16A34A; background: #F0FDF4; color: #15803D; font-weight: 800; padding: 6px; border-radius: 4px; font-size: 10px; text-align: center; margin-bottom: 8px; }
    .sign-img { max-height: 55px; max-width: 180px; object-fit: contain; margin: 4px auto; }
    .print-btn { display: inline-block; background: #FF7000; color: #FFF; font-weight: bold; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; text-decoration: none; margin-bottom: 15px; }
    @media print {
      body { padding: 0; }
      .container { border: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <button class="print-btn" onclick="window.print()">🖨️ Imprimir Romaneio Oficial A4</button>
      <span style="font-size: 11px; color: #64748B;">Padrão ABNT NBR 7212 · Sistema Kytto ERP</span>
    </div>

    <div class="header">
      <div>
        <div class="brand">SERRANO CONCRETO USINADO & MINERAÇÃO</div>
        <div class="subtitle">Rodovia MT-358 km 08 · Distrito Industrial · Tangará da Serra/MT · CEP 78300-000</div>
        <div class="subtitle">CNPJ Usinado: 53.798.485/0001-77 · Matriz Mineração: 51.499.928/0001-01 · IE: 14.229.191-9</div>
        <div class="subtitle">Responsável Técnica: <b>Engª Karin Prestes (CREA-MT 027300)</b> · Central: (65) 99946-4899</div>
      </div>
      <div class="doc-badge">
        <div class="title">ROMANEIO OFICIAL NBR 7212</div>
        <div class="number">ROM #${carga.numero || 1001}</div>
        <div style="font-size: 10px; color: #64748B;">Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>

    <!-- DADOS DO CLIENTE E OBRA -->
    <div class="box">
      <div class="section-title">1. Destinatário &amp; Obra de Concretagem</div>
      <div class="grid-2">
        <div><span class="label">Cliente / Construtora:</span> <div class="val">${carga.cliente}</div></div>
        <div><span class="label">Local / Obra:</span> <div class="val">${carga.obra}</div></div>
        <div style="grid-column: span 2;"><span class="label">Endereço de Entrega:</span> <div class="val">${carga.endereco}</div></div>
      </div>
    </div>

    <!-- ESPECIFICAÇÃO TÉCNICA DO CONCRETO -->
    <div class="box">
      <div class="section-title">2. Especificação Técnica do Traço NBR 7212 / NBR 8953</div>
      <div class="grid-4">
        <div><span class="label">Resistência de Projeto:</span> <div class="val" style="color: #FF7000;">${String(carga.fck).startsWith('FCK') ? carga.fck : `FCK ${carga.fck} MPa`}</div></div>
        <div><span class="label">Abatimento de Projeto:</span> <div class="val">${carga.slump || '14 ± 2 cm'}</div></div>
        <div><span class="label">Volume da Carga:</span> <div class="val">${carga.volumeM3} m³</div></div>
        <div><span class="label">Sistema de Descarga:</span> <div class="val">${carga.bomba || 'BL-01 (Bomba Lança 32m)'}</div></div>
        <div><span class="label">Dimensão Máx. Agregado:</span> <div class="val">${carga.brita || 'Brita 1 (19mm)'}</div></div>
        <div><span class="label">Lote Controle Tecnológico:</span> <div class="val">${carga.laudoCp || 'CP-2026-089'}</div></div>
        <div><span class="label">Corpos de Prova Moldados:</span> <div class="val">4 unidades (7d e 28d)</div></div>
        <div><span class="label">Aditivo Dosado Usina:</span> <div class="val">Plastificante Multiflux NBR 11768</div></div>
      </div>
    </div>

    <!-- TICKET DE PESAGEM DA BALANÇA RODOVIÁRIA TOLEDO 80T -->
    <div class="box" style="border-left: 4px solid #0284C7; background: #F0F9FF;">
      <div class="section-title" style="color: #0369A1;">3. Ticket de Pesagem Integrado · Balança Rodoviária 80t Toledo</div>
      <div class="grid-4">
        <div><span class="label">Ticket de Pesagem:</span> <div class="val" style="font-family: monospace;">${tkt.numeroTicket}</div></div>
        <div><span class="label">Data/Hora Pesagem:</span> <div class="val">${tkt.dataHoraPesagem || '12/11/2026 08:12'}</div></div>
        <div><span class="label">Operador da Balança:</span> <div class="val">${tkt.operadorBalanca || 'Paulo Cezar (Matrícula 042)'}</div></div>
        <div><span class="label">Aferição Inmetro:</span> <div class="val" style="color: #0369A1;">Certificado IPEM-MT Válido</div></div>
        <div><span class="label">Peso Bruto Total:</span> <div class="val" style="font-size: 13px;">${Number(tkt.pesoBrutoKg || 33480).toLocaleString('pt-BR')} kg</div></div>
        <div><span class="label">Tara da Betoneira:</span> <div class="val" style="font-size: 13px;">${Number(tkt.taraKg || 14280).toLocaleString('pt-BR')} kg</div></div>
        <div><span class="label">Peso Líquido Concreto:</span> <div class="val" style="font-size: 14px; color: #0284C7; font-weight: 800;">${Number(tkt.pesoLiquidoKg || 19200).toLocaleString('pt-BR')} kg</div></div>
        <div><span class="label">Densidade Aparente Calculada:</span> <div class="val">${tkt.densidadeKgM3 || 2400} kg/m³</div></div>
      </div>
    </div>

    <!-- TELEMETRIA E PRAZO DE PEGA NBR 7212 -->
    <div class="box">
      <div class="section-title">4. Telemetria da Betoneira &amp; Horários Normativos (NBR 7212)</div>
      <div class="grid-4">
        <div><span class="label">Caminhão Betoneira:</span> <div class="val">${v1.veiculo || 'BT-01'} (VW 26.280 - RRA-4E80)</div></div>
        <div><span class="label">Motorista Usina:</span> <div class="val">${v1.motorista || 'Marcos Silveira'}</div></div>
        <div><span class="label">Adição de Água Usina:</span> <div class="val" style="color: #FF7000;">${v1.saidaUsina || '08:15'}</div></div>
        <div><span class="label">Limite de Pega (150 min):</span> <div class="val" style="color: #DC2626;">Máximo 2h30 da adição de água</div></div>
        <div><span class="label">Chegada na Obra:</span> <div class="val">${v1.chegadaObra || '08:35'}</div></div>
        <div><span class="label">Início da Descarga:</span> <div class="val">${v1.inicioDescarga || '08:42'}</div></div>
        <div><span class="label">Término da Descarga:</span> <div class="val">${v1.fimDescarga || '09:20'}</div></div>
        <div><span class="label">Tempo Total na Obra:</span> <div class="val" style="color: #16A34A;">Conforme (Dentro de 150 min)</div></div>
      </div>
    </div>

    <!-- ADVERTÊNCIA NORMATIVA NBR 7212 -->
    <div class="alert-nbr">
      <b>⚠️ ADVERTÊNCIA NORMATIVA NBR 7212 (ITEM 5.4.3):</b> É expressamente proibida a adição de água no caminhão betoneira na obra sem a autorização formal do responsável técnico estrutural. Qualquer adição de água extemporânea anula a garantia tecnológica do traço e compromete a resistência FCK do elemento estrutural.
    </div>

    <!-- QUADRO DE ASSINATURAS E VALIDAÇÃO DIGITAL -->
    <div class="grid-2" style="margin-top: 15px;">
      <!-- Assinatura da Usina / Motorista -->
      <div class="sign-card">
        <div>
          <div class="label">Expedição &amp; Responsável Técnica Usina</div>
          <div style="font-weight: 800; margin-top: 4px;">SERRANO CONCRETO USINADO LTDA</div>
          <div style="font-size: 10px; color: #64748B;">Motorista: ${v1.motorista || 'Marcos Silveira'}</div>
        </div>
        <div style="margin: 12px 0; border-top: 1px dashed #94A3B8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: bold; color: #16181B;">Engª Karin Prestes</div>
          <div style="font-size: 9px; color: #64748B;">Responsável Técnica · CREA-MT 027300</div>
        </div>
      </div>

      <!-- Assinatura Digital do Cliente na Entrega -->
      <div class="sign-card">
        <div>
          <div class="label">Recebimento na Obra &amp; Aceite Digital</div>
          <div style="font-weight: 800; margin-top: 4px;">${carga.cliente}</div>
        </div>
        ${ass && ass.imagemBase64 ? `
          <div style="margin: 4px 0;">
            <img src="${ass.imagemBase64}" class="sign-img" alt="Assinatura Digital do Recebedor" />
            <div class="sign-stamp">✓ ASSINADO DIGITALMENTE NA ENTREGA<br><small style="font-size: 8px;">${ass.codigoAutenticidade || 'AUTENTICADO NBR 7212'}</small></div>
          </div>
          <div style="border-top: 1px dashed #94A3B8; padding-top: 6px;">
            <div style="font-size: 11px; font-weight: bold;">${ass.recebedorNome}</div>
            <div style="font-size: 9px; color: #64748B;">CPF: ${ass.recebedorDocumento} · ${ass.recebedorCargo}</div>
            <div style="font-size: 8px; color: #64748B; margin-top: 2px;">Assinado em ${ass.dataHoraAssinatura}</div>
          </div>
        ` : `
          <div style="margin: 15px 0; padding: 12px; background: #F1F5F9; border-radius: 4px; border: 1px dashed #94A3B8;">
            <div style="font-size: 10px; color: #64748B;">Assinatura Coletada Digitalmente via Touch / Tablet de Obra</div>
            <div style="font-size: 9px; color: #94A3B8; margin-top: 4px;">(Aguardando assinatura do cliente na entrega)</div>
          </div>
          <div style="border-top: 1px dashed #94A3B8; padding-top: 6px;">
            <div style="font-size: 10px; color: #64748B;">Nome Legível / Cargo / CPF</div>
          </div>
        `}
      </div>
    </div>

    <!-- RODAPÉ DE VALIDAÇÃO E HASH -->
    <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748B;">
      <div>Kytto ERP Industrial · Módulo Serrano Concreto Usinado &amp; Mineração (Tangará da Serra/MT)</div>
      <div style="font-family: monospace;">Hash SHA-256: ${ass?.hashSha256 ? ass.hashSha256.slice(0, 32) + '...' : 'GERADO_NA_ASSINATURA'}</div>
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

// =====================================================================
// 14. AUTOMAÇÃO DA BALANÇA RODOVIÁRIA 80T TOLEDO, SEMÁFOROS E OPERAÇÃO REMOTA
// =====================================================================
export const TICKETS_BALANCA_INICIAIS = [
  {
    id: 'tkt-9841',
    numeroTicket: 'TKT-BAL-9841',
    empresaId: CONCRETO_EMPRESA_ID,
    dataHora: '12/11/2026 14:28',
    dataHoraEntrada: '12/11/2026 14:10',
    dataHoraSaida: '12/11/2026 14:28',
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    modeloIndicador: 'Toledo Prix 9094 / Células de Carga Digitais 80.000 kg',
    operador: 'Paulo Cezar (Matrícula 042 - IPEM-MT)',
    cliente: 'Construtora MT Horizon Ltda',
    cnpjCpfCliente: '18.492.301/0001-92',
    obraDestino: 'Edifício Residencial Ilhas do Lago · Tangará da Serra/MT',
    veiculoPlaca: 'BT-01 (RRA-4E80)',
    modeloVeiculo: 'Caminhão Betoneira VW Constellation 26.280 8x4 (8m³)',
    motorista: 'Marcos Silveira',
    cpfMotorista: '821.492.011-84',
    transportadora: 'Frota Própria Serrano Concreto',
    tipoOperacao: 'Expedição de Concreto Usinado',
    tipoMaterial: 'Concreto Usinado Estrutural FCK 30 MPa (Slump 12±2cm)',
    pesoBrutoKg: 33480,
    taraKg: 14280,
    pesoLiquidoKg: 19200,
    densidadeKgM3: 2400,
    volumeCalculadoM3: 8.0,
    precoUnitarioM3: 420.00,
    valorTotal: 3360.00,
    valorCfem: 0,
    aliquotaCfemPercent: 0,
    status: 'concluido',
    statusSemaforo: 'verde',
    cancelaLiberada: true,
    posicionamentoPlataforma: '100% Ok (Sensores Dianteiro e Traseiro Desobstruídos)',
    modoOperacao: 'remoto',
    codigoAutenticidade: 'BAL-TOLEDO-A79B3F40E2C18901'
  },
  {
    id: 'tkt-9840',
    numeroTicket: 'TKT-BAL-9840',
    empresaId: CONCRETO_EMPRESA_ID,
    dataHora: '12/11/2026 13:52',
    dataHoraEntrada: '12/11/2026 13:35',
    dataHoraSaida: '12/11/2026 13:52',
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    modeloIndicador: 'Toledo Prix 9094 / Células de Carga Digitais 80.000 kg',
    operador: 'Operação Remota CCO (Guarita Automatizada)',
    cliente: 'Pavimentadora & Construtora Guimarães',
    cnpjCpfCliente: '04.192.839/0001-44',
    obraDestino: 'Obras de Duplicação MT-358 · Trecho Tangará-Nova Olímpia',
    veiculoPlaca: 'CAR-04 (QBO-4892)',
    modeloVeiculo: 'Cavalo Scania R450 + Caçamba Basculante Rossetti 3 Eixos',
    motorista: 'Valdir Silvestre',
    cpfMotorista: '492.381.902-15',
    transportadora: 'TransGrãos & Minérios Tangará',
    tipoOperacao: 'Expedição de Agregados / Mineração',
    tipoMaterial: 'Areia Média Lavada de Rio (Jazida Sepotuba)',
    pesoBrutoKg: 46250,
    taraKg: 15450,
    pesoLiquidoKg: 30800,
    densidadeKgM3: 1500,
    volumeCalculadoM3: 20.53,
    precoUnitarioM3: 65.00,
    valorTotal: 1334.45,
    valorCfem: 20.02,
    aliquotaCfemPercent: 1.5,
    status: 'concluido',
    statusSemaforo: 'verde',
    cancelaLiberada: true,
    posicionamentoPlataforma: '100% Ok (Sensores Dianteiro e Traseiro Desobstruídos)',
    modoOperacao: 'remoto',
    codigoAutenticidade: 'BAL-TOLEDO-B83C1A72F9D04128'
  },
  {
    id: 'tkt-9839',
    numeroTicket: 'TKT-BAL-9839',
    empresaId: CONCRETO_EMPRESA_ID,
    dataHora: '12/11/2026 11:15',
    dataHoraEntrada: '12/11/2026 10:48',
    dataHoraSaida: '12/11/2026 11:15',
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    modeloIndicador: 'Toledo Prix 9094 / Células de Carga Digitais 80.000 kg',
    operador: 'Paulo Cezar (Matrícula 042 - IPEM-MT)',
    cliente: 'Serrano Concreto Usinado Ltda (Recepção de Insumo)',
    cnpjCpfCliente: '03.849.201/0001-10',
    obraDestino: 'Silo 01 de Cimento CP-II F 32 (Usina Tangará)',
    veiculoPlaca: 'SIL-02 (KAJ-1204)',
    modeloVeiculo: 'Carreta Silo Rodoviário Cimento a Granel 4 Eixos',
    motorista: 'Donizete Aparecido',
    cpfMotorista: '601.294.182-33',
    transportadora: 'Transportadora Votoran / Cimento MT',
    tipoOperacao: 'Recepção de Matéria-Prima (Cimento CP-II)',
    tipoMaterial: 'Cimento CP-II F 32 a Granel',
    pesoBrutoKg: 52100,
    taraKg: 15100,
    pesoLiquidoKg: 37000,
    densidadeKgM3: 1400,
    volumeCalculadoM3: 26.43,
    precoUnitarioM3: 620.00,
    valorTotal: 22940.00,
    valorCfem: 0,
    aliquotaCfemPercent: 0,
    status: 'concluido',
    statusSemaforo: 'verde',
    cancelaLiberada: true,
    posicionamentoPlataforma: '100% Ok',
    modoOperacao: 'remoto',
    codigoAutenticidade: 'BAL-TOLEDO-94CF2810AA12B763'
  }
];

let estadoHardwareBalanca = {
  semaforoEntrada: 'verde',
  cancelaEntrada: 'fechada',
  semaforoSaida: 'vermelho',
  cancelaSaida: 'fechada',
  sensorBarreiraEntrada: false,
  sensorBarreiraSaida: false,
  sensorPresencaPlataforma: false,
  posicionamentoCorreto: true,
  pesoAtualKg: 0,
  estabilidade: 'estavel',
  taraAtualKg: 0,
  pesoLiquidoAtualKg: 0,
  zeroRastreado: true,
  capacidadeMaximaKg: 80000,
  divisaoKg: 10,
  cameraLprAtiva: true,
  placaDetectada: '',
  rfidDetectado: '',
  confiancaLpr: 0.98,
  modoOperacao: 'remoto',
  interfoneAtivo: false,
  mensagemInterfone: 'Aguardando aproximação de veículo...',
  veiculoAtual: null,
  veiculosNoPatio: [
    {
      id: 'patio-01',
      ticketEntradaId: 'tkt-ent-101',
      placa: 'CAR-08 (JZZ-4190)',
      motorista: 'Ademir Fagundes',
      transportadora: 'TransGrãos Tangará',
      tipoVeiculo: 'Caçamba Basculante Toco 2 Eixos',
      cliente: 'Pavimentadora Parecis',
      produto: 'Brita 1 Granítica',
      dataHoraEntrada: '12/11/2026 16:45',
      taraEntradaKg: 11200,
      status: 'carregando_no_patio'
    },
    {
      id: 'patio-02',
      ticketEntradaId: 'tkt-ent-102',
      placa: 'ROD-03 (OBK-8211)',
      motorista: 'Sebastião Moreira',
      transportadora: 'Frota Própria Serrano',
      tipoVeiculo: 'Rodotrem 9 Eixos Basculante',
      cliente: 'Usina Serrano (Transferência)',
      produto: 'Areia Grossa de Rio',
      dataHoraEntrada: '12/11/2026 17:10',
      taraEntradaKg: 24500,
      status: 'carregando_no_patio'
    }
  ]
};

export async function obterStatusBalancaAutomacao(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const tickets = (data.concreto_tickets_balanca || []).filter(t => !t.empresaId || t.empresaId === empresaId);
  const totalKg = tickets.reduce((acc, t) => acc + (Number(t.pesoLiquidoKg) || 0), 0);
  const totalTon = +(totalKg / 1000).toFixed(2);
  const totalValor = tickets.reduce((acc, t) => acc + (Number(t.valorTotal) || 0), 0);

  return {
    ok: true,
    hardware: { ...estadoHardwareBalanca },
    estatisticasHoje: {
      totalVeiculosHoje: tickets.length,
      totalToneladasHoje: totalTon,
      tempoMedioPesagemSegundos: 38,
      veiculosNoPatioQtd: estadoHardwareBalanca.veiculosNoPatio.length,
      faturamentoPesagensHoje: totalValor
    },
    veiculoAtual: estadoHardwareBalanca.veiculoAtual,
    veiculosNoPatio: estadoHardwareBalanca.veiculosNoPatio,
    ultimosTickets: tickets.slice(0, 15)
  };
}

export async function executarComandoBalanca(comando, payload = {}, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  switch (comando) {
    case 'abrir_cancela_entrada':
      estadoHardwareBalanca.cancelaEntrada = 'aberta';
      estadoHardwareBalanca.semaforoEntrada = 'verde';
      break;
    case 'fechar_cancela_entrada':
      estadoHardwareBalanca.cancelaEntrada = 'fechada';
      break;
    case 'abrir_cancela_saida':
      estadoHardwareBalanca.cancelaSaida = 'aberta';
      estadoHardwareBalanca.semaforoSaida = 'verde';
      break;
    case 'fechar_cancela_saida':
      estadoHardwareBalanca.cancelaSaida = 'fechada';
      break;
    case 'alternar_semaforo_entrada':
      estadoHardwareBalanca.semaforoEntrada = estadoHardwareBalanca.semaforoEntrada === 'verde' ? 'vermelho' : 'verde';
      break;
    case 'alternar_semaforo_saida':
      estadoHardwareBalanca.semaforoSaida = estadoHardwareBalanca.semaforoSaida === 'verde' ? 'vermelho' : 'verde';
      break;
    case 'zerar_balanca':
      estadoHardwareBalanca.pesoAtualKg = 0;
      estadoHardwareBalanca.taraAtualKg = 0;
      estadoHardwareBalanca.pesoLiquidoAtualKg = 0;
      estadoHardwareBalanca.zeroRastreado = true;
      estadoHardwareBalanca.estabilidade = 'estavel';
      break;
    case 'tara_manual':
      estadoHardwareBalanca.taraAtualKg = Number(payload.taraKg) || 0;
      estadoHardwareBalanca.pesoLiquidoAtualKg = Math.max(0, estadoHardwareBalanca.pesoAtualKg - estadoHardwareBalanca.taraAtualKg);
      break;
    case 'simular_veiculo': {
      const peso = Number(payload.pesoBrutoKg) || 33480;
      const tara = Number(payload.taraKg) || 14280;
      const foraPosicao = Boolean(payload.foraPosicao);

      estadoHardwareBalanca.sensorPresencaPlataforma = true;
      estadoHardwareBalanca.sensorBarreiraEntrada = foraPosicao;
      estadoHardwareBalanca.sensorBarreiraSaida = false;
      estadoHardwareBalanca.posicionamentoCorreto = !foraPosicao;
      estadoHardwareBalanca.semaforoEntrada = 'vermelho';
      estadoHardwareBalanca.cancelaEntrada = 'fechada';
      estadoHardwareBalanca.semaforoSaida = 'vermelho';
      estadoHardwareBalanca.cancelaSaida = 'fechada';

      estadoHardwareBalanca.pesoAtualKg = peso;
      estadoHardwareBalanca.taraAtualKg = tara;
      estadoHardwareBalanca.pesoLiquidoAtualKg = Math.max(0, peso - tara);
      estadoHardwareBalanca.zeroRastreado = false;
      estadoHardwareBalanca.estabilidade = 'estavel';

      estadoHardwareBalanca.placaDetectada = payload.placa || 'BT-01 (RRA-4E80)';
      estadoHardwareBalanca.rfidDetectado = payload.rfid || 'TAG-MT-0428';
      estadoHardwareBalanca.mensagemInterfone = foraPosicao 
        ? 'Atenção motorista: reposicione o veículo! Eixo dianteiro fora da plataforma.'
        : 'Veículo posicionado. Aguardando estabilização da pesagem...';

      estadoHardwareBalanca.veiculoAtual = {
        placa: estadoHardwareBalanca.placaDetectada,
        rfid: estadoHardwareBalanca.rfidDetectado,
        modelo: payload.modelo || 'Caminhão Betoneira VW Constellation 26.280',
        motorista: payload.motorista || 'Marcos Silveira',
        cpfMotorista: payload.cpfMotorista || '821.492.011-84',
        transportadora: payload.transportadora || 'Frota Própria Serrano Concreto',
        cliente: payload.cliente || 'Construtora MT Horizon',
        produto: payload.produto || 'Concreto Usinado Estrutural FCK 30 MPa',
        pesoBrutoKg: peso,
        taraKg: tara,
        pesoLiquidoKg: Math.max(0, peso - tara),
        tipoOperacao: payload.tipoOperacao || 'expedicao_concreto',
        posicionamentoCorreto: !foraPosicao
      };
      break;
    }
    case 'remover_veiculo':
      estadoHardwareBalanca.sensorPresencaPlataforma = false;
      estadoHardwareBalanca.sensorBarreiraEntrada = false;
      estadoHardwareBalanca.sensorBarreiraSaida = false;
      estadoHardwareBalanca.posicionamentoCorreto = true;
      estadoHardwareBalanca.pesoAtualKg = 0;
      estadoHardwareBalanca.taraAtualKg = 0;
      estadoHardwareBalanca.pesoLiquidoAtualKg = 0;
      estadoHardwareBalanca.zeroRastreado = true;
      estadoHardwareBalanca.estabilidade = 'estavel';
      estadoHardwareBalanca.placaDetectada = '';
      estadoHardwareBalanca.rfidDetectado = '';
      estadoHardwareBalanca.veiculoAtual = null;
      estadoHardwareBalanca.cancelaSaida = 'aberta';
      estadoHardwareBalanca.semaforoSaida = 'verde';
      estadoHardwareBalanca.mensagemInterfone = 'Pesagem concluída! Pista liberada. Boa viagem!';
      break;
    case 'interfone_voz':
      estadoHardwareBalanca.interfoneAtivo = true;
      estadoHardwareBalanca.mensagemInterfone = payload.mensagem || 'Operação Remota CCO: Por favor desligue o motor do veículo.';
      break;
    case 'modo_operacao':
      if (['remoto', 'local', 'autoatendimento'].includes(payload.modo)) {
        estadoHardwareBalanca.modoOperacao = payload.modo;
      }
      break;
    default:
      throw new Error(`Comando de automação desconhecido: ${comando}`);
  }

  return { ok: true, comando, hardware: { ...estadoHardwareBalanca } };
}

export async function registrarEntradaVeiculo(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const id = `patio-${Date.now()}`;
  const dataAtual = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });

  const novoItemPatio = {
    id,
    ticketEntradaId: `tkt-ent-${Date.now().toString().slice(-4)}`,
    placa: dados.placaVeiculo || 'CAR-09 (MTZ-9910)',
    modeloVeiculo: dados.modeloVeiculo || 'Caminhão Caçamba Basculante',
    motorista: dados.motorista || 'Motorista Terceiro',
    cpfMotorista: dados.cpfMotorista || '000.000.000-00',
    transportadora: dados.transportadora || 'Transportadora Terceirizada',
    cliente: dados.cliente || 'Construtora / Terceiro',
    cnpjCpfCliente: dados.cnpjCpfCliente || '00.000.000/0001-00',
    obraDestino: dados.obraDestino || 'Obras em Tangará da Serra/MT',
    produto: dados.tipoMaterial || 'Areia Média Lavada',
    tipoOperacao: dados.tipoOperacao || 'expedicao_agregados',
    dataHoraEntrada: `${dataAtual} ${horaAtual}`,
    taraEntradaKg: Number(dados.taraKg) || Number(dados.pesoAtualKg) || 12000,
    status: 'carregando_no_patio'
  };

  estadoHardwareBalanca.veiculosNoPatio.unshift(novoItemPatio);
  estadoHardwareBalanca.cancelaEntrada = 'aberta';
  estadoHardwareBalanca.semaforoEntrada = 'verde';
  estadoHardwareBalanca.mensagemInterfone = `Entrada registrada para ${novoItemPatio.placa}. Siga até o pátio de carregamento!`;

  return { ok: true, veiculoPatio: novoItemPatio };
}

export async function concluirSegundaPesagemBalanca(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();
  const seq = (data.concreto_tickets_balanca?.length || 0) + 9842;
  const dataAtual = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });

  const pesoBruto = Number(dados.pesoBrutoKg) || Number(estadoHardwareBalanca.pesoAtualKg) || 35000;
  const tara = Number(dados.taraKg) || Number(estadoHardwareBalanca.taraAtualKg) || 12000;
  const pesoLiquido = Math.max(0, pesoBruto - tara);
  const densidade = Number(dados.densidadeKgM3) || (dados.tipoMaterial?.toLowerCase().includes('brita') ? 1450 : dados.tipoMaterial?.toLowerCase().includes('concreto') ? 2400 : 1500);
  const volumeM3 = +(pesoLiquido / densidade).toFixed(2);
  const precoM3 = Number(dados.precoUnitarioM3) || (dados.tipoMaterial?.toLowerCase().includes('concreto') ? 420.00 : 65.00);
  const valorTotal = +(volumeM3 * precoM3).toFixed(2);
  const eMineral = dados.tipoMaterial?.toLowerCase().includes('areia') || dados.tipoMaterial?.toLowerCase().includes('brita');
  const valorCfem = eMineral ? +(valorTotal * 0.015).toFixed(2) : 0;

  const hashSha256 = crypto.createHash('sha256').update(`TKT-${seq}|${dados.placaVeiculo}|${pesoLiquido}|${new Date().toISOString()}`).digest('hex');

  const novoTicket = {
    id: `tkt-${seq}`,
    numeroTicket: `TKT-BAL-${seq}`,
    empresaId,
    dataHora: `${dataAtual} ${horaAtual}`,
    dataHoraEntrada: dados.dataHoraEntrada || `${dataAtual} 13:00`,
    dataHoraSaida: `${dataAtual} ${horaAtual}`,
    balanca: 'Balança Rodoviária 80t Toledo · Usina Serrano (Rodovia MT-358 km 08)',
    modeloIndicador: 'Toledo Prix 9094 / Células de Carga Digitais 80.000 kg',
    operador: dados.operador || 'Operação Remota CCO (Guarita Automatizada)',
    cliente: dados.cliente || 'Construtora / Terceiro',
    cnpjCpfCliente: dados.cnpjCpfCliente || '00.000.000/0001-00',
    obraDestino: dados.obraDestino || 'Obras em Tangará da Serra/MT',
    veiculoPlaca: dados.placaVeiculo || 'CAR-08 (JZZ-4190)',
    modeloVeiculo: dados.modeloVeiculo || 'Caminhão Caçamba Basculante 3 Eixos',
    motorista: dados.motorista || 'Ademir Fagundes',
    cpfMotorista: dados.cpfMotorista || '521.849.012-33',
    transportadora: dados.transportadora || 'TransGrãos Tangará',
    tipoOperacao: dados.tipoOperacao || 'Expedição de Agregados / Mineração',
    tipoMaterial: dados.tipoMaterial || 'Brita 1 Granítica',
    pesoBrutoKg: pesoBruto,
    taraKg: tara,
    pesoLiquidoKg: pesoLiquido,
    densidadeKgM3: densidade,
    volumeCalculadoM3: volumeM3,
    precoUnitarioM3: precoM3,
    valorTotal,
    valorCfem,
    aliquotaCfemPercent: eMineral ? 1.5 : 0,
    assinaturaMotoristaBase64: dados.assinaturaMotoristaBase64 || null,
    status: 'concluido',
    statusSemaforo: 'verde',
    cancelaLiberada: true,
    posicionamentoPlataforma: '100% Ok (Sensores Dianteiro e Traseiro Desobstruídos)',
    modoOperacao: estadoHardwareBalanca.modoOperacao,
    codigoAutenticidade: `BAL-TOLEDO-${hashSha256.slice(0, 16).toUpperCase()}`
  };

  data.concreto_tickets_balanca.unshift(novoTicket);
  if (dados.patioId) {
    estadoHardwareBalanca.veiculosNoPatio = estadoHardwareBalanca.veiculosNoPatio.filter(p => p.id !== dados.patioId);
  }
  save();

  estadoHardwareBalanca.cancelaSaida = 'aberta';
  estadoHardwareBalanca.semaforoSaida = 'verde';
  estadoHardwareBalanca.mensagemInterfone = `Pesagem final concluída (${novoTicket.pesoLiquidoKg.toLocaleString('pt-BR')} kg líquidos). Cancela liberada!`;

  return { ok: true, ticket: novoTicket };
}

export async function listarTicketsBalanca(empresaId = CONCRETO_EMPRESA_ID, filtros = {}) {
  const data = inicializarDatastoreConcreto();
  let lista = (data.concreto_tickets_balanca || []).filter(t => !t.empresaId || t.empresaId === empresaId);
  if (filtros.termo) {
    const t = filtros.termo.toLowerCase();
    lista = lista.filter(x => 
      x.numeroTicket?.toLowerCase().includes(t) ||
      x.veiculoPlaca?.toLowerCase().includes(t) ||
      x.motorista?.toLowerCase().includes(t) ||
      x.cliente?.toLowerCase().includes(t) ||
      x.tipoMaterial?.toLowerCase().includes(t)
    );
  }
  return { ok: true, total: lista.length, tickets: lista };
}
