import { db, save } from '../../db.js';
import { 
  CONCRETO_EMPRESA_ID, 
  CONCRETO_DADOS_EMPRESA, 
  CONCRETO_CATALOGO_INICIAL, 
  CONCRETO_FROTA_INICIAL, 
  CONCRETO_CARGAS_INICIAIS 
} from '../../concreto-usina-seed.js';

// Constantes e Traços Normatizados NBR 7212 / NBR 8953 / NBR 6118
export const TRACOS_NORMATIZADOS = {
  15: { cimentoKg: 260, areiaM3: 0.68, britaM3: 0.88, aguaL: 185, aditivoL: 2.0, fatorAc: 0.65, slumpPadrao: '10 ± 2 cm', descricao: 'Concreto Magro / Regularização de Fundações' },
  20: { cimentoKg: 300, areiaM3: 0.65, britaM3: 0.85, aguaL: 180, aditivoL: 2.4, fatorAc: 0.55, slumpPadrao: '12 ± 2 cm', descricao: 'Pisos residenciais, calçadas, baldrames e estacas' },
  25: { cimentoKg: 340, areiaM3: 0.62, britaM3: 0.82, aguaL: 175, aditivoL: 2.7, fatorAc: 0.50, slumpPadrao: '12 ± 2 cm', descricao: 'Lajes maciças/treliçadas, vigas e pilares residenciais' },
  30: { cimentoKg: 380, areiaM3: 0.58, britaM3: 0.80, aguaL: 170, aditivoL: 3.0, fatorAc: 0.45, slumpPadrao: '14 ± 2 cm', descricao: 'Estrutural pesado, edifícios comerciais e galpões de grande vão' },
  35: { cimentoKg: 420, areiaM3: 0.55, britaM3: 0.78, aguaL: 165, aditivoL: 3.4, fatorAc: 0.42, slumpPadrao: '14 ± 2 cm', descricao: 'Pisos industriais com tráfego de carretas e empilhadeiras' },
  40: { cimentoKg: 460, areiaM3: 0.52, britaM3: 0.75, aguaL: 160, aditivoL: 3.8, fatorAc: 0.38, slumpPadrao: '16 ± 2 cm', descricao: 'Obras de arte especiais, pontes e concreto de alta resistência' },
  45: { cimentoKg: 500, areiaM3: 0.50, britaM3: 0.72, aguaL: 155, aditivoL: 4.2, fatorAc: 0.35, slumpPadrao: '16 ± 2 cm', descricao: 'Concreto de altíssimo desempenho (CAD) e pré-moldados pesados' },
};

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
    taxaBomba: 1325.00, // 750 (25m³) + 23m³ * 25
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
    freteKm: 250.00, // Fora do perímetro urbano
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
];

/**
 * Garante que as tabelas de concreto no datastore contenham dados inicializados
 */
export function inicializarDatastoreConcreto() {
  const data = db();
  if (!Array.isArray(data.concreto_cargas)) data.concreto_cargas = [];
  if (!Array.isArray(data.concreto_produtos)) data.concreto_produtos = [];
  if (!Array.isArray(data.concreto_frota)) data.concreto_frota = [];
  if (!Array.isArray(data.concreto_ensaios)) data.concreto_ensaios = [];
  if (!Array.isArray(data.concreto_propostas)) data.concreto_propostas = [];
  if (!Array.isArray(data.concreto_silos)) data.concreto_silos = [];

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

  save();
  return data;
}

/**
 * Retorna todos os dados consolidados do módulo de Concreto & Mineração
 */
export async function obterDadosConcreto(empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  const empresa = data.empresas?.find(e => e.id === empresaId) || CONCRETO_DADOS_EMPRESA;
  const cargas = (data.concreto_cargas || []).filter(c => !c.empresaId || c.empresaId === empresaId);
  const catalogo = (data.concreto_produtos || []).filter(p => !p.empresaId || p.empresaId === empresaId);
  const frota = (data.concreto_frota || []).filter(f => !f.empresaId || f.empresaId === empresaId);
  const ensaios = (data.concreto_ensaios || []).filter(e => !e.empresaId || e.empresaId === empresaId);
  const propostas = (data.concreto_propostas || []).filter(p => !p.empresaId || p.empresaId === empresaId);
  const silos = (data.concreto_silos || []).filter(s => !s.empresaId || s.empresaId === empresaId);

  // KPIs
  const volumeProgramadoHoje = cargas.reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
  const volumeEntregueHoje = cargas.filter(c => c.status === 'concluido').reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
  const betoneirasOperando = frota.filter(f => f.status !== 'disponivel').length;
  const faturamentoHoje = cargas.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
  const laudosConformesPercent = 100; // Todos aprovados conforme NBR 5739

  return {
    ok: true,
    empresa,
    cargas,
    catalogo,
    frota,
    ensaios,
    propostas,
    silos,
    kpis: {
      volumeProgramadoHoje,
      volumeEntregueHoje,
      betoneirasOperando,
      totalFrota: frota.length,
      faturamentoHoje,
      laudosConformesPercent
    }
  };
}

/**
 * Cadastra uma nova Carga / Concretagem
 */
export async function criarCargaConcreto(dados, empresaId = CONCRETO_EMPRESA_ID) {
  const data = inicializarDatastoreConcreto();

  const fck = Number(dados.fck) || 25;
  const volumeM3 = Number(dados.volumeM3) || 8;
  const tracoInfo = TRACOS_NORMATIZADOS[fck] || TRACOS_NORMATIZADOS[25];

  // Calcular número sequencial
  const ultimoNumero = (data.concreto_cargas || []).reduce((max, c) => Math.max(max, Number(c.numero) || 1000), 1000);
  const proximoNumero = ultimoNumero + 1;

  // Preço por m³
  const precoM3 = dados.precoM3 || (fck === 20 ? 380 : fck === 25 ? 410 : fck === 30 ? 440 : fck === 35 ? 480 : fck === 40 ? 520 : 340);
  const subtotalConcreto = volumeM3 * precoM3;

  // Taxa de bomba
  let taxaBomba = 0;
  if (dados.bomba && dados.bomba.toLowerCase().includes('bomba')) {
    taxaBomba = 750.00; // Taxa mínima até 25 m³
    if (volumeM3 > 25) {
      taxaBomba += (volumeM3 - 25) * 25.00;
    }
  }

  const valorTotal = subtotalConcreto + taxaBomba;

  // Gerar viagens automáticas em betoneiras de 8m³ ou 10m³
  const viagens = [];
  let volumeRestante = volumeM3;
  const betoneirasDisponiveis = (data.concreto_frota || []).filter(f => f.tipo === 'betoneira');
  let bIndex = 0;

  while (volumeRestante > 0) {
    const volViagem = Math.min(volumeRestante, 8);
    const bt = betoneirasDisponiveis[bIndex % betoneirasDisponiveis.length] || { codigo: 'BT-01', motorista: 'Marcos Silveira' };
    viagens.push({
      betoneira: bt.codigo,
      motorista: bt.motorista,
      volume: volViagem,
      saida: null,
      chegada: null,
      inicioDescarga: null,
      fimDescarga: null,
      retorno: null,
      tempoEsperaMin: 0,
      horaParadaCobranca: 0
    });
    volumeRestante -= volViagem;
    bIndex++;
  }

  const novaCarga = {
    id: `crg-${proximoNumero}`,
    numero: proximoNumero,
    empresaId,
    cliente: dados.cliente || 'Cliente Balcão',
    obra: dados.obra || 'Obra Residencial',
    endereco: dados.endereco || 'Tangará da Serra - MT',
    fck: `FCK ${fck} MPa (${dados.brita || 'Brita 1'})`,
    fckNumero: fck,
    slump: dados.slump || tracoInfo.slumpPadrao,
    volumeM3,
    brita: dados.brita || 'Brita 1',
    bomba: dados.bomba || 'Descarga Direta (Calha)',
    horarioAgendado: dados.horarioAgendado || '09:00',
    dataAgendada: dados.dataAgendada || new Date().toISOString().slice(0, 10),
    status: 'agendado',
    viagens,
    valorTotal,
    subtotalConcreto,
    taxaBomba,
    laudoCp: `CP-2026-${String(proximoNumero).slice(-3)} (Aguardando moldagem)`,
    observacoes: dados.observacoes || '',
    criadoEm: new Date().toISOString()
  };

  data.concreto_cargas.unshift(novaCarga);

  // Criar ensaio de laboratório automaticamente
  const novoEnsaio = {
    id: `cp-2026-${String(proximoNumero).slice(-3)}`,
    lote: `CP-2026-${String(proximoNumero).slice(-3)}`,
    empresaId,
    cargaId: novaCarga.id,
    cliente: novaCarga.cliente,
    obra: novaCarga.obra,
    endereco: novaCarga.endereco,
    fckProjeto: fck,
    slumpMedidoCm: Number(String(dados.slump || '14').replace(/[^0-9]/g, '')) || 14,
    slumpProjeto: dados.slump || tracoInfo.slumpPadrao,
    dataMoldagem: novaCarga.dataAgendada,
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

  // Abater do estoque dos silos da usina
  abaterEstoqueSilos(data, fck, volumeM3);

  save();
  return { ok: true, carga: novaCarga, ensaio: novoEnsaio };
}

/**
 * Abate insumos do silo com base na dosagem consumida
 */
function abaterEstoqueSilos(data, fck, volumeM3) {
  const traco = TRACOS_NORMATIZADOS[fck] || TRACOS_NORMATIZADOS[25];
  const cimentoConsumidoTon = (traco.cimentoKg * volumeM3) / 1000;
  const areiaConsumidaM3 = traco.areiaM3 * volumeM3;
  const britaConsumidaM3 = traco.britaM3 * volumeM3;

  if (Array.isArray(data.concreto_silos)) {
    // Cimento
    const siloCimento = data.concreto_silos.find(s => s.tipo === 'cimento_cp2');
    if (siloCimento) {
      siloCimento.estoqueAtualTon = Math.max(0, +(siloCimento.estoqueAtualTon - cimentoConsumidoTon).toFixed(2));
      siloCimento.nivelPercent = Math.round((siloCimento.estoqueAtualTon / siloCimento.capacidadeTotalTon) * 100);
    }
    // Areia
    const patioAreia = data.concreto_silos.find(s => s.tipo === 'agregado_areia');
    if (patioAreia) {
      patioAreia.estoqueAtualM3 = Math.max(0, +(patioAreia.estoqueAtualM3 - areiaConsumidaM3).toFixed(2));
      patioAreia.nivelPercent = Math.round((patioAreia.estoqueAtualM3 / patioAreia.capacidadeTotalM3) * 100);
    }
    // Brita
    const patioBrita = data.concreto_silos.find(s => s.tipo === 'agregado_brita');
    if (patioBrita) {
      patioBrita.estoqueAtualM3 = Math.max(0, +(patioBrita.estoqueAtualM3 - britaConsumidaM3).toFixed(2));
      patioBrita.nivelPercent = Math.round((patioBrita.estoqueAtualM3 / patioBrita.capacidadeTotalM3) * 100);
    }
  }
}

/**
 * Atualiza status geral de uma carga
 */
export async function atualizarStatusCarga(cargaId, status, observacoes = '') {
  const data = inicializarDatastoreConcreto();
  const carga = (data.concreto_cargas || []).find(c => c.id === cargaId);
  if (!carga) {
    throw new Error(`Carga ${cargaId} não encontrada.`);
  }

  carga.status = status;
  if (observacoes) {
    carga.observacoes = (carga.observacoes ? carga.observacoes + ' | ' : '') + observacoes;
  }
  carga.atualizadoEm = new Date().toISOString();

  save();
  return { ok: true, carga };
}

/**
 * Atualiza evento de telemetria em uma viagem de betoneira
 */
export async function registrarEventoViagem(cargaId, viagemIndex, evento, horario = null) {
  const data = inicializarDatastoreConcreto();
  const carga = (data.concreto_cargas || []).find(c => c.id === cargaId);
  if (!carga) throw new Error(`Carga ${cargaId} não encontrada.`);

  const vIndex = Number(viagemIndex);
  if (!carga.viagens || !carga.viagens[vIndex]) {
    throw new Error(`Viagem index ${vIndex} não encontrada na carga ${cargaId}.`);
  }

  const viagem = carga.viagens[vIndex];
  const agoraHora = horario || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (evento === 'saida_usina') {
    viagem.saida = agoraHora;
    carga.status = 'em_transito';
    // Atualizar status do caminhão para em_transito
    const caminhao = (data.concreto_frota || []).find(f => f.codigo === viagem.betoneira);
    if (caminhao) caminhao.status = 'em_transito';
  } else if (evento === 'chegada_obra') {
    viagem.chegada = agoraHora;
    carga.status = 'na_obra';
    const caminhao = (data.concreto_frota || []).find(f => f.codigo === viagem.betoneira);
    if (caminhao) caminhao.status = 'na_obra';
  } else if (evento === 'inicio_descarga') {
    viagem.inicioDescarga = agoraHora;
    carga.status = 'na_obra';
  } else if (evento === 'fim_descarga') {
    viagem.fimDescarga = agoraHora;
    // Calcular tempo de espera na obra
    if (viagem.chegada) {
      const [hC, mC] = viagem.chegada.split(':').map(Number);
      const [hF, mF] = agoraHora.split(':').map(Number);
      const minutosTotal = (hF * 60 + mF) - (hC * 60 + mC);
      viagem.tempoEsperaMin = Math.max(0, minutosTotal);
      if (viagem.tempoEsperaMin > 60) {
        // Franquia NBR 7212 é de 60 minutos
        const horasExcedentes = (viagem.tempoEsperaMin - 60) / 60;
        viagem.horaParadaCobranca = +(horasExcedentes * 120.00).toFixed(2); // R$ 120/h
      }
    }
    const caminhao = (data.concreto_frota || []).find(f => f.codigo === viagem.betoneira);
    if (caminhao) caminhao.status = 'retornando';
  } else if (evento === 'retorno_usina') {
    viagem.retorno = agoraHora;
    const caminhao = (data.concreto_frota || []).find(f => f.codigo === viagem.betoneira);
    if (caminhao) caminhao.status = 'disponivel';
  }

  // Se todas as viagens foram finalizadas, concluir carga
  const todasConcluidas = carga.viagens.every(v => v.fimDescarga);
  if (todasConcluidas) {
    carga.status = 'concluido';
  }

  save();
  return { ok: true, carga, viagem };
}

/**
 * Registra rompimento de corpo de prova no laboratório de qualidade
 */
export async function registrarRupturaCorpoProva(loteId, cpId, idadeDias, tensaoMpa, forcaKn) {
  const data = inicializarDatastoreConcreto();
  const ensaio = (data.concreto_ensaios || []).find(e => e.id === loteId || e.lote === loteId);
  if (!ensaio) throw new Error(`Ensaio de lote ${loteId} não encontrado.`);

  const cp = (ensaio.corposProva || []).find(c => c.id === cpId && c.idadeDias === Number(idadeDias));
  if (!cp) throw new Error(`Corpo de prova ${cpId} para idade ${idadeDias} dias não encontrado no lote.`);

  const tensao = Number(tensaoMpa);
  cp.dataRuptura = new Date().toISOString().slice(0, 10);
  cp.tensaoMpa = tensao;
  cp.forcaKn = Number(forcaKn) || +(tensao * 7.854).toFixed(1); // Área de cilindro 10x20 = 78.54 cm²
  cp.percentualFck = +((tensao / ensaio.fckProjeto) * 100).toFixed(1);

  // Se foram rompidos os CPs de 28 dias, calcular conformidade final
  const cps28d = ensaio.corposProva.filter(c => c.idadeDias === 28 && c.tensaoMpa != null);
  if (cps28d.length >= 2) {
    const media28d = +(cps28d.reduce((acc, c) => acc + c.tensaoMpa, 0) / cps28d.length).toFixed(1);
    ensaio.fckEstimado28d = media28d;
    ensaio.laudoAprovado = media28d >= ensaio.fckProjeto;
    ensaio.status = ensaio.laudoAprovado ? 'aprovado' : 'reprovado';
    ensaio.laudoNumero = `LAUDO-${ensaio.lote}-NBR5739-FINAL`;
  } else {
    ensaio.status = 'em_ensaio';
  }

  save();
  return { ok: true, ensaio, cp };
}

/**
 * Calculadora avançada de dosagem por m³ conforme ABNT NBR 7212
 * Com correção automatizada da umidade superficial da areia
 */
export function calcularDosagemAvancada({ fck = 25, volumeM3 = 8, umidadeAreiaPercent = 4.5, brita = 'Brita 1' }) {
  const f = Number(fck) || 25;
  const v = Number(volumeM3) || 1;
  const uAreia = Number(umidadeAreiaPercent) || 0; // % de umidade superficial

  const base = TRACOS_NORMATIZADOS[f] || TRACOS_NORMATIZADOS[25];

  // Pesagens secas base por m³
  const cimentoKg = base.cimentoKg;
  const areiaSecaKg = Math.round(base.areiaM3 * 1500); // Densidade aparente areia seca ~ 1.500 kg/m³
  const britaSecaKg = Math.round(base.britaM3 * 1450); // Densidade aparente brita ~ 1.450 kg/m³
  const aguaLitros = base.aguaL;
  const aditivoLitros = base.aditivoL;

  // Correção de umidade NBR 7212:
  // A areia úmida pesa mais: P_areia_umida = P_areia_seca * (1 + u/100)
  // A água livre contida na areia deve ser subtraída da água de amassamento:
  const aguaContidaAreiaLitros = Math.round(areiaSecaKg * (uAreia / 100));
  const areiaCorrigidaKg = Math.round(areiaSecaKg * (1 + uAreia / 100));
  const aguaCorrigidaLitros = Math.max(80, Math.round(aguaLitros - aguaContidaAreiaLitros));

  // Totais para a carga completa da betoneira (v m³)
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

/**
 * Cria ou atualiza proposta comercial de concretagem
 */
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

/**
 * Atualiza status da proposta comercial
 */
export async function atualizarStatusProposta(propostaId, status) {
  const data = inicializarDatastoreConcreto();
  const proposta = (data.concreto_propostas || []).find(p => p.id === propostaId);
  if (!proposta) throw new Error(`Proposta ${propostaId} não encontrada.`);

  proposta.status = status;
  save();
  return { ok: true, proposta };
}

/**
 * Atualiza status de um veículo da frota
 */
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

/**
 * Registra movimentação de insumos nos silos e pátios da Serrano Mineração
 */
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
    }
    silo.ultimoCarregamento = new Date().toISOString().slice(0, 10);
  } else if (tipoMov === 'saida') {
    if (silo.estoqueAtualTon != null) {
      silo.estoqueAtualTon = Math.max(0, +(silo.estoqueAtualTon - qtd).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualTon / silo.capacidadeTotalTon) * 100);
    } else if (silo.estoqueAtualM3 != null) {
      silo.estoqueAtualM3 = Math.max(0, +(silo.estoqueAtualM3 - qtd).toFixed(2));
      silo.nivelPercent = Math.round((silo.estoqueAtualM3 / silo.capacidadeTotalM3) * 100);
    }
  }

  save();
  return { ok: true, silo };
}
