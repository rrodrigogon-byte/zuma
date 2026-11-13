// Dados operacionais oficiais - Serrano Concreto & Mineração (Tangará da Serra - MT)
// Plataforma Kytto Torre de Pesagem & Central de Operações

export const INITIAL_STATS = {
  pesagensHoje: 75,
  movimentadoTon: 1686.4,
  veiculosNoSite: 6,
  veiculosFila: 0,
  veiculosPatio: 5,
  veiculosBalanca: 1,
  esperaMediaMin: 1.8,
  semIntervencaoPct: 88,
  excecoesAbertas: 1,
  concretoProduzidoM3: 412.5,
  agregadosExpedidosTon: 894.0,
  sefazStatus: 'Operacional (118ms)',
};

export const WEIGHBRIDGES = {
  bal01: {
    id: 'BAL-01',
    nome: 'Balança Usina MT-358',
    tipo: 'Rodoviária 21m · 80 toneladas',
    fabricante: 'Toledo do Brasil · Modelo 720i',
    calibracaoInmetro: 'Certificado 2026/0894-MT (Válido até 08/2027)',
    statusPista: 'ocupada', // 'livre' | 'ocupada' | 'bloqueada'
    pesoAtualKg: 12920,
    zeroEstavel: true,
    semaforo: 'vermelho', // 'verde' | 'vermelho'
    cancela: 'fechada', // 'aberta' | 'fechada'
    veiculoAtual: {
      placa: 'QBF-6M02',
      modelo: 'Scania P310 8x4 Betoneira 10m³ (BT-05)',
      motorista: 'Valdir Silveira',
      tipoOperacao: '1ª Pesagem (Tara)',
      produto: 'Concreto FCK 30 Bombeável',
      taraRegistradaKg: 12920,
      taraMediaKg: 12900,
      desvioPct: '+0.15%',
      statusKyttoIA: 'Aprovado sem desvio',
    },
    cameraLpr: {
      placaLida: 'QBF-6M02',
      confianca: '99.7%',
      eixosDetectados: 4,
      posicionamento: 'Correto sobre as células centrais',
    }
  },
  bal02: {
    id: 'BAL-02',
    nome: 'Balança Mineração Rio Sangue',
    tipo: 'Rodoviária 18m · 60 toneladas',
    fabricante: 'Filizola Industrial · Modelo Titan Plus',
    calibracaoInmetro: 'Certificado 2026/0412-MT (Válido até 05/2027)',
    statusPista: 'livre',
    pesoAtualKg: 0,
    zeroEstavel: true,
    semaforo: 'verde',
    cancela: 'aberta',
    veiculoAtual: null,
    cameraLpr: {
      placaLida: 'NJK-3307',
      confianca: '98.2%',
      eixosDetectados: 3,
      posicionamento: 'Pista liberada',
    }
  }
};

export const SILOS = [
  {
    id: 'CIM-01',
    codigo: 'Silo 01',
    tipo: 'Cimento CP-II-F-32',
    capacidadeTotalTon: 120,
    nivelAtualTon: 62.4,
    nivelPct: 52,
    temperaturaC: 41.5,
    pressaoAeracaoBar: 2.1,
    statusFiltro: 'Normal',
    fornecedor: 'Cimentos Votorantim MT',
    consumoHojeTon: 28.6,
    alerta: null
  },
  {
    id: 'CIM-02',
    codigo: 'Silo 02',
    tipo: 'Cimento CP-V ARI (Alta Resistência)',
    capacidadeTotalTon: 120,
    nivelAtualTon: 93.6,
    nivelPct: 78,
    temperaturaC: 38.2,
    pressaoAeracaoBar: 2.0,
    statusFiltro: 'Normal',
    fornecedor: 'Cimentos Ciplan',
    consumoHojeTon: 14.2,
    alerta: null
  },
  {
    id: 'CIM-03',
    codigo: 'Silo 03',
    tipo: 'Pozolana / Filler Calcário',
    capacidadeTotalTon: 80,
    nivelAtualTon: 27.2,
    nivelPct: 34,
    temperaturaC: 36.0,
    pressaoAeracaoBar: 1.9,
    statusFiltro: 'Normal',
    fornecedor: 'Calcário Tangará',
    consumoHojeTon: 6.8,
    alerta: 'Nível em 34% - Previsão de recarga para 17:00'
  }
];

export const AGGREGATE_BAYS = [
  { id: 'BA-01', nome: 'Areia Média Lavada', estoqueTon: 420, capacidadeTon: 800, granulometria: '0.2 - 2.4 mm', umidadePct: 4.8 },
  { id: 'BA-02', nome: 'Brita 0 (Pedrisco)', estoqueTon: 280, capacidadeTon: 600, granulometria: '4.8 - 9.5 mm', umidadePct: 1.2 },
  { id: 'BA-03', nome: 'Brita 1 (19 mm)', estoqueTon: 610, capacidadeTon: 900, granulometria: '9.5 - 19.0 mm', umidadePct: 0.9 },
  { id: 'BA-04', nome: 'Areia Fina de Rio', estoqueTon: 190, capacidadeTon: 500, granulometria: '0.1 - 0.6 mm', umidadePct: 5.4 },
  { id: 'BA-05', nome: 'Brita 2 (25 mm)', estoqueTon: 340, capacidadeTon: 700, granulometria: '19.0 - 25.0 mm', umidadePct: 0.7 }
];

export const DOSING_PLANT = {
  nome: 'Central Dosadora Convicta 96t',
  tipo: 'Automatizada · Misturador Planetário 2.0 m³',
  capacidadeNominalM3h: 96,
  status: 'Carregando BT-06',
  sensorAtivo: 'BT-06',
  bateladaAtual: {
    numero: 'BAT-2026-0841',
    traço: 'TR-FCK30B',
    volumeTotalM3: 8.0,
    progressoPct: 65,
    pesagemAgregados: { cimentoKg: 2880, areiaKg: 6480, brita0Kg: 2400, brita1Kg: 4960, aguaL: 1440, aditivoL: 28.8 }
  }
};

export const INITIAL_VEHICLES = [
  {
    id: 'v1',
    placa: 'QBF-6M02',
    prefixo: 'BT-05',
    tipo: 'Betoneira 10m³',
    chassi: 'Scania P310 8x4',
    motorista: 'Valdir Silveira',
    localizacao: 'balanca', // 'portaria' | 'espera' | 'balanca' | 'dosadora' | 'lavagem' | 'excecao' | 'saindo'
    unidade: 'usina',
    taraKg: 12920,
    brutoKg: null,
    liquidoKg: null,
    pedidoId: 'PED-4412',
    cliente: 'Construtora Alvorada',
    obra: 'Residencial Manacá - Laje 4º Pavimento',
    traco: 'TR-FCK30B (FCK 30 MPa Bombeável)',
    volumeM3: 10.0,
    horaEntrada: '13:30',
    statusTag: 'Na balança',
    alerta: null
  },
  {
    id: 'v2',
    placa: 'NJK-3307',
    prefixo: 'CC-03',
    tipo: 'Caçamba Basculante Trucada',
    chassi: 'Volvo VM 330 6x4',
    motorista: 'Marcos Souza',
    localizacao: 'excecao',
    unidade: 'mineracao',
    taraKg: 10190,
    brutoKg: null,
    liquidoKg: null,
    pedidoId: 'PED-4409',
    cliente: 'Pavimentação Serra Azul',
    obra: 'Anel Viário KM 14',
    traco: 'Areia Média Lavada',
    volumeM3: 14.0,
    horaEntrada: '13:31',
    statusTag: 'Exceção',
    alerta: 'Tara 10.190 kg vs média 9.600 kg (+6.1%). Padrão de lastro oculto detectado pelo Motor KyttoIA.'
  },
  {
    id: 'v3',
    placa: 'RRA-4A20',
    prefixo: 'BT-06',
    tipo: 'Betoneira 8m³',
    chassi: 'MB 2730 6x4',
    motorista: 'Claudemir Ramos',
    localizacao: 'dosadora',
    unidade: 'usina',
    taraKg: 11480,
    brutoKg: null,
    liquidoKg: null,
    pedidoId: 'PED-4412',
    cliente: 'Construtora Alvorada',
    obra: 'Residencial Manacá',
    traco: 'TR-FCK30B',
    volumeM3: 8.0,
    horaEntrada: '13:20',
    statusTag: 'No pátio (Dosadora)',
    alerta: null
  },
  {
    id: 'v4',
    placa: 'OBX-9K31',
    prefixo: 'BT-12',
    tipo: 'Betoneira 8m³',
    chassi: 'Scania P280 6x4',
    motorista: 'João Paulo Neves',
    localizacao: 'lavagem',
    unidade: 'usina',
    taraKg: 11620,
    brutoKg: 30820,
    liquidoKg: 19200,
    pedidoId: 'PED-4410',
    cliente: 'Empreiteira MT-Norte',
    obra: 'Hospital Regional MT-358',
    traco: 'TR-FCK25',
    volumeM3: 8.0,
    horaEntrada: '13:05',
    statusTag: 'Lavagem de balão',
    alerta: null
  },
  {
    id: 'v5',
    placa: 'KAP-8192',
    prefixo: 'CC-01',
    tipo: 'Caçamba Traçada 16m³',
    chassi: 'Volvo FMX 460 6x4',
    motorista: 'Ailton Barbosa',
    localizacao: 'patio',
    unidade: 'mineracao',
    taraKg: 14200,
    brutoKg: null,
    liquidoKg: null,
    pedidoId: 'PED-4415',
    cliente: 'Agropecuária Rio Bonito',
    obra: 'Estrada Fazenda Esperança',
    traco: 'Brita 1 (19mm)',
    volumeM3: 16.0,
    horaEntrada: '13:25',
    statusTag: 'No pátio (Carregando)',
    alerta: null
  },
  {
    id: 'v6',
    placa: 'NJW-5410',
    prefixo: 'CC-02',
    tipo: 'Caçamba Toco',
    chassi: 'VW Constellation 31.330',
    motorista: 'Rogério Lima',
    localizacao: 'saindo',
    unidade: 'mineracao',
    taraKg: 9800,
    brutoKg: 24350,
    liquidoKg: 14550,
    pedidoId: 'PED-4408',
    cliente: 'ConstruMais Tangará',
    obra: 'Depósito Central',
    traco: 'Pedrisco (Brita 0)',
    volumeM3: 10.0,
    horaEntrada: '13:10',
    statusTag: 'Saindo / MDF-e emitido',
    alerta: null
  }
];

export const INITIAL_FEED_EVENTS = [
  {
    id: 'evt-1',
    hora: '13:34',
    tipo: 'pesagem',
    categoria: 'Pesagem',
    titulo: '1ª pesagem NJK-3307: tara 10.190 kg',
    detalhes: 'BAL-02 sem operador · 3 eixos detectados · Pista livre',
    severidade: 'normal',
    unidade: 'mineracao'
  },
  {
    id: 'evt-2',
    hora: '13:34',
    tipo: 'ia_alerta',
    categoria: 'KyttoIA',
    titulo: 'KyttoIA Tara fora do padrão · NJK-3307',
    detalhes: 'Tara 10.190 kg vs média histórica 9.600 kg (+6,1%). Padrão de lastro oculto antes da pesagem de saída.',
    severidade: 'critico',
    unidade: 'mineracao',
    acao: {
      rotulo: 'Decidir',
      veiculoPlaca: 'NJK-3307',
      excecaoTipo: 'tara_fora_padrao'
    }
  },
  {
    id: 'evt-3',
    hora: '13:33',
    tipo: 'pesagem',
    categoria: 'Pesagem',
    titulo: '1ª pesagem QBF-6M02: tara 12.920 kg',
    detalhes: 'BAL-01 sem operador · Betoneira BT-05 · Posicionamento 100% sobre as células',
    severidade: 'sucesso',
    unidade: 'usina'
  },
  {
    id: 'evt-4',
    hora: '13:32',
    tipo: 'lpr',
    categoria: 'KyttoIA',
    titulo: 'KyttoIA Placa lida: NJK-3307',
    detalhes: 'BAL-02 confiança 98,2% · 3 eixos detectados · Câmera frontal Hikvision LPR',
    severidade: 'info',
    unidade: 'mineracao'
  },
  {
    id: 'evt-5',
    hora: '13:31',
    tipo: 'lpr',
    categoria: 'KyttoIA',
    titulo: 'KyttoIA Placa lida: QBF-6M02',
    detalhes: 'BAL-01 confiança 99,7% · 4 eixos detectados · Câmera frontal Toledo LPR',
    severidade: 'info',
    unidade: 'usina'
  },
  {
    id: 'evt-6',
    hora: '13:31',
    tipo: 'checkin',
    categoria: 'Fiscal',
    titulo: 'Check-in NJK-3307 (Areia Média Lavada)',
    detalhes: 'Venda de agregado · Areia média lavada · Check-in via WhatsApp Kytto Bot',
    severidade: 'normal',
    unidade: 'mineracao'
  },
  {
    id: 'evt-7',
    hora: '13:28',
    tipo: 'fiscal',
    categoria: 'Fiscal',
    titulo: 'MDF-e 582026-00412 Autorizado SEFAZ-MT',
    detalhes: 'Veículo NJW-5410 · 14.550 kg de Pedrisco · Chave: 5126081498200100412858001000004121100094123',
    severidade: 'sucesso',
    unidade: 'mineracao'
  },
  {
    id: 'evt-8',
    hora: '13:20',
    tipo: 'dosagem',
    categoria: 'Operacao',
    titulo: 'Início da Dosagem Central Convicta 96t',
    detalhes: 'Betoneira BT-06 (RRA-4A20) · 8,0 m³ de TR-FCK30B · Slump 16±3 cm',
    severidade: 'info',
    unidade: 'usina'
  }
];

export const CONCRETE_MIXES = [
  {
    id: 'TR-FCK20',
    nome: 'Concreto Magro / Piso FCK 20 MPa',
    classe: 'FCK 20 MPa',
    slump: '10 ± 2 cm',
    aplicacao: 'Pisos industriais, calçadas, contrapisos e estacas',
    brita: 'Brita 1 (19mm)',
    aditivo: 'Plastificante padrão (0.4%)',
    cimentoPorM3Kg: 280,
    areiaPorM3Kg: 780,
    britaPorM3Kg: 1050,
    aguaPorM3L: 185,
    precoM3: 410.00
  },
  {
    id: 'TR-FCK25',
    nome: 'Concreto Estrutural FCK 25 MPa',
    classe: 'FCK 25 MPa',
    slump: '12 ± 2 cm',
    aplicacao: 'Vigas, sapatas, blocos de coroamento e colunas leves',
    brita: 'Brita 1 (19mm)',
    aditivo: 'Polifuncional retardador (0.6%)',
    cimentoPorM3Kg: 320,
    areiaPorM3Kg: 740,
    britaPorM3Kg: 1040,
    aguaPorM3L: 180,
    precoM3: 445.00
  },
  {
    id: 'TR-FCK30B',
    nome: 'Concreto Bombeável FCK 30 MPa (Alta Fluidez)',
    classe: 'FCK 30 MPa',
    slump: '16 ± 3 cm',
    aplicacao: 'Lajes maciças/nervuradas, pilares altos e estruturas protendidas',
    brita: 'Brita 0 e Brita 1 combinada (50/50)',
    aditivo: 'Superplastificante Glenium + Retardador de Pega (2h30 janela)',
    cimentoPorM3Kg: 360,
    areiaPorM3Kg: 810,
    britaPorM3Kg: 920,
    aguaPorM3L: 180,
    precoM3: 485.00
  },
  {
    id: 'TR-FCK35B',
    nome: 'Concreto Alta Resistência FCK 35 MPa',
    classe: 'FCK 35 MPa',
    slump: '18 ± 3 cm',
    aplicacao: 'Edifícios multipavimentos, radier de silos e pontes',
    brita: 'Brita 0 (Pedrisco selecionado)',
    aditivo: 'Hiperplastificante de 3ª Geração (0.9%)',
    cimentoPorM3Kg: 390,
    areiaPorM3Kg: 790,
    britaPorM3Kg: 900,
    aguaPorM3L: 175,
    precoM3: 530.00
  },
  {
    id: 'TR-FCK40ARI',
    nome: 'Concreto Alta Resistência Inicial FCK 40 ARI',
    classe: 'FCK 40 MPa',
    slump: '14 ± 2 cm',
    aplicacao: 'Desforma rápida em 24h, pré-moldados e pistas pesadas',
    brita: 'Brita 1 lavada',
    aditivo: 'Acelerador de pega livre de cloretos',
    cimentoPorM3Kg: 420,
    areiaPorM3Kg: 750,
    britaPorM3Kg: 910,
    aguaPorM3L: 168,
    precoM3: 580.00
  }
];

export const SCHEDULED_POURS = [
  {
    id: 'SCH-01',
    obra: 'Residencial Manacá - Torre B',
    cliente: 'Construtora Alvorada Ltda',
    endereco: 'Av. Brasil, 1420 - Tangará da Serra',
    elemento: 'Laje do 4º Pavimento',
    volumeTotalM3: 64.0,
    volumeEntregueM3: 26.0,
    traco: 'TR-FCK30B',
    slump: '16 ± 3 cm',
    bomba: 'Bomba Lança Schwing 36m (B-02)',
    intervaloBateladasMin: 25,
    horaInicio: '11:30',
    previsaoTermino: '16:00',
    betoneirasDesignadas: ['BT-05 (10m³)', 'BT-06 (8m³)', 'BT-08 (10m³)', 'BT-12 (8m³)'],
    status: 'Em andamento (41%)'
  },
  {
    id: 'SCH-02',
    obra: 'Hospital Regional MT-358',
    cliente: 'Empreiteira MT-Norte',
    endereco: 'Rodovia MT-358, KM 04',
    elemento: 'Radier Bloco Cirúrgico',
    volumeTotalM3: 110.0,
    volumeEntregueM3: 72.0,
    traco: 'TR-FCK25',
    slump: '12 ± 2 cm',
    bomba: 'Bomba Estacionária Putzmeister 500',
    intervaloBateladasMin: 20,
    horaInicio: '08:00',
    previsaoTermino: '15:30',
    betoneirasDesignadas: ['BT-01 (10m³)', 'BT-02 (10m³)', 'BT-04 (8m³)', 'BT-12 (8m³)'],
    status: 'Em andamento (65%)'
  },
  {
    id: 'SCH-03',
    obra: 'Silo Graneleiro Fazenda Esperança',
    cliente: 'Agropecuária Rio Bonito',
    endereco: 'Estrada Rural MT-480, KM 22',
    elemento: 'Piso Reforçado c/ Fibra de Aço',
    volumeTotalM3: 48.0,
    volumeEntregueM3: 0.0,
    traco: 'TR-FCK35B',
    slump: '14 ± 2 cm',
    bomba: 'Convencional (Descarga Direta)',
    intervaloBateladasMin: 35,
    horaInicio: '15:00',
    previsaoTermino: '18:30',
    betoneirasDesignadas: ['BT-05 (10m³)', 'BT-06 (8m³)'],
    status: 'Programado para hoje'
  }
];

export const FRAUD_RULES = [
  {
    id: 'FR-01',
    codigo: 'DESVIO_TARA_HISTORICA',
    nome: 'Desvio de Tara Histórica Acima do Limite',
    descricao: 'Compara a tara pesada com a média móvel dos últimos 90 dias do veículo. Alerta se ultrapassar 2.5% ou 300 kg.',
    sensibilidade: 'Alta',
    acaoAutomatica: 'Encaminhar para Baia de Exceção e exigir justificativa do operador',
    ocorrenciasHoje: 1,
    status: 'Ativo'
  },
  {
    id: 'FR-02',
    codigo: 'RODA_FORA_PLATAFORMA',
    nome: 'Mau Posicionamento / Rodas Fora da Balança',
    descricao: 'Sensores de barreira ótica (BT-05/BM-02) verificam se todos os eixos estão 100% sobre as células de carga.',
    sensibilidade: 'Máxima',
    acaoAutomatica: 'Semáforo vermelho, trava da cancela e aviso sonoro na torre',
    ocorrenciasHoje: 0,
    status: 'Ativo'
  },
  {
    id: 'FR-03',
    codigo: 'DUPLA_PESAGEM_CURTO_INTERVALO',
    nome: 'Dupla Pesagem com Mesma Placa (< 10 min)',
    descricao: 'Detecta se o mesmo caminhão tenta obter segundo ticket de saída sem novo ciclo de carregamento.',
    sensibilidade: 'Crítica',
    acaoAutomatica: 'Bloqueio total de emissão de MDF-e e notificação imediata do CCO',
    ocorrenciasHoje: 0,
    status: 'Ativo'
  },
  {
    id: 'FR-04',
    codigo: 'DIVERGENCIA_OCR_CADASTRO',
    nome: 'Divergência entre Leitura OCR e Cadastro',
    descricao: 'Verifica no banco Kytto se a placa lida coincide com o tipo do veículo (ex: placa de cavalo associada a carreta errada).',
    sensibilidade: 'Média',
    acaoAutomatica: 'Alerta amarelo e revisão manual pelo CCO',
    ocorrenciasHoje: 0,
    status: 'Ativo'
  }
];

export const COPILOT_SUGGESTIONS = [
  'Qual o nível atual dos silos de cimento?',
  'Exibir detalhes da exceção da caçamba NJK-3307',
  'Quantas betoneiras estão programadas para a Construtora Alvorada?',
  'Simular pesagem de saída do caminhão QBF-6M02',
  'Verificar status da integração com a SEFAZ-MT',
  'Gerar ticket de pesagem da BAL-01'
];
