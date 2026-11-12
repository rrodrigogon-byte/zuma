import { db, save } from './db.js';

export const CONCRETO_EMPRESA_ID = 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2';
export const CONCRETO_LOJA_ID = 'c2c2ac01-8e50-4b61-8c79-de4aaa916da0';
export const CONCRETO_CNPJ = '51.499.928/0001-01';
export const CONCRETO_CNPJ_NUM = '51499928000101';

export const CONCRETO_GRUPO_ID = "grp-serrano-palatare-03";
export const CONCRETO_GRUPO_NOME = "Grupo Serrano & Palatare";

export const CONCRETO_DADOS_EMPRESA = {
  id: CONCRETO_EMPRESA_ID,
  grupoId: CONCRETO_GRUPO_ID,
  grupoNome: CONCRETO_GRUPO_NOME,
  holding: "Serrano & Palatare Participações S/A",
  empresaIrmaId: "c1c1ac01-8e50-4b61-8c79-de4aaa916da9",
  empresaIrmaNome: "Palatare Pizzaria & Restaurante",
  nome: 'Serrano Concreto Usinado',
  nomeFantasia: 'Serrano Concreto',
  razaoSocial: 'SERRANO CONCRETO E ARTEFATOS DE CIMENTO LTDA',
  cnpj: CONCRETO_CNPJ,
  cnpjNormalizado: CONCRETO_CNPJ_NUM,
  inscricaoEstadual: '13.567.890-3',
  inscricaoMunicipal: '77410',
  rntrc: '056256077',
  cnpjFilialUsina: '53.798.485/0001-77',
  razaoSocialFilial: 'SERRANO USINADO LTDA',
  responsavelTecnica: 'Engª Karin Prestes (CREA-MT 027300)',
  mineracaoPropria: 'Serrano Mineração (Areia Média e Grossa Lavada de Rio)',
  silosArmazenamento: 'Silo Convicta Vertical 96 Toneladas e Silo Auxiliar 60 Toneladas',
  tipoNegocio: 'concreto',
  segmento: 'industria_concreto',
  telefone: '(65) 99996-3795',
  whatsapp: '(65) 99946-4899',
  email: 'serranomineracao@hotmail.com',
  instagram: '@serrano_concreto',
  instagramUrl: 'https://www.instagram.com/serrano_concreto/',
  website: 'https://concreto.kytto.com.br',
  enderecoLogradouro: 'Av. Inácio Bittencourt Cardoso',
  enderecoNumero: '4451 - E',
  enderecoComplemento: 'Sala 02 · Usina e Pátio Industrial',
  enderecoBairro: 'Zona Leste',
  enderecoCidade: 'Tangará da Serra',
  enderecoEstado: 'MT',
  enderecoCep: '78301555',
  endereco: 'Av. Inácio Bittencourt Cardoso, 4451 - E, Sala 02, Zona Leste, Tangará da Serra/MT, CEP 78301-555',
  capacidadeUsina: '80 m³/hora (Usina Dosadora Automatizada)',
  frotaBetoneiras: '8 caminhões betoneira (capacidade 8m³ a 10m³)',
  bombasLanca: '2 caminhões bomba lança (32m e 36m)',
  laboratorioProprio: 'Controle tecnológico com prensa de ruptura e câmara úmida',
  logoUrl: '/brand/concreto-usina-logo.png',
  ativa: true,
  permitirEstoqueNegativo: false,
  totalLojas: 1,
};

export const CONCRETO_CATALOGO_INICIAL = [
  // Concretos Estruturais por FCK
  { id: 'cnc-fck-20', nome: 'Concreto Usinado FCK 20 MPa (Pisos e Baldrames)', categoria: 'Concreto Usinado', preco: 380.00, unidade: 'm³', fck: 20, slump: '12 ± 2 cm', brita: 'Brita 1', traco: '1 : 2,2 : 2,8 : 0,55', descricao: 'Indicado para pisos residenciais, calçadas, baldrames e estacas de fundação.' },
  { id: 'cnc-fck-25', nome: 'Concreto Usinado FCK 25 MPa (Lajes, Vigas e Pilares)', categoria: 'Concreto Usinado', preco: 410.00, unidade: 'm³', fck: 25, slump: '12 ± 2 cm', brita: 'Brita 1', traco: '1 : 1,9 : 2,5 : 0,50', descricao: 'O traço mais consumido na construção civil para lajes maciças, treliçadas, vigas e pilares residenciais.' },
  { id: 'cnc-fck-30', nome: 'Concreto Usinado FCK 30 MPa (Estrutural Pesado / Edifícios)', categoria: 'Concreto Usinado', preco: 440.00, unidade: 'm³', fck: 30, slump: '14 ± 2 cm', brita: 'Brita 1', traco: '1 : 1,6 : 2,2 : 0,45', descricao: 'Concreto de alta resistência para edifícios comerciais, galpões de grande vão e fundações de alto porte.' },
  { id: 'cnc-fck-35', nome: 'Concreto Usinado FCK 35 MPa (Pisos Industriais)', categoria: 'Concreto Usinado', preco: 480.00, unidade: 'm³', fck: 35, slump: '14 ± 2 cm', brita: 'Brita 1', traco: '1 : 1,4 : 1,9 : 0,42', descricao: 'Elevada durabilidade e resistência à abrasão para tráfego pesado de carretas e empilhadeiras.' },
  { id: 'cnc-fck-40', nome: 'Concreto Usinado FCK 40 MPa (Obras Especiais e Pontes)', categoria: 'Concreto Usinado', preco: 520.00, unidade: 'm³', fck: 40, slump: '16 ± 2 cm', brita: 'Brita 1', traco: '1 : 1,2 : 1,7 : 0,38', descricao: 'Concreto de alta performance para pontes, viadutos e estruturas pré-tensionadas.' },
  { id: 'cnc-fck-15', nome: 'Concreto Magro / Regularização FCK 15 MPa', categoria: 'Concreto Usinado', preco: 340.00, unidade: 'm³', fck: 15, slump: '10 ± 2 cm', brita: 'Brita 2', traco: '1 : 3,0 : 3,5 : 0,65', descricao: 'Camada de proteção e nivelamento para fundações e armaduras.' },

  // Concretos Especiais & Bombeáveis
  { id: 'cnc-bomb-brita0-25', nome: 'Concreto Bombeável Brita 0 (Pedrisco) FCK 25 MPa', categoria: 'Concretos Especiais', preco: 425.00, unidade: 'm³', fck: 25, slump: '16 ± 2 cm', brita: 'Brita 0', traco: '1 : 2,1 : 2,2 : 0,50', descricao: 'Ideal para lajes nervuradas, ferragens densas e tubulações longas de bombeamento.' },
  { id: 'cnc-bomb-brita0-30', nome: 'Concreto Bombeável Brita 0 (Pedrisco) FCK 30 MPa', categoria: 'Concretos Especiais', preco: 455.00, unidade: 'm³', fck: 30, slump: '16 ± 2 cm', brita: 'Brita 0', traco: '1 : 1,8 : 2,0 : 0,45', descricao: 'Concreto de alta fluidez para pilares esbeltos e vigas com alta taxa de aço.' },
  { id: 'cnc-auto-adensavel', nome: 'Concreto Auto-adensável (CAA) FCK 30 MPa', categoria: 'Concretos Especiais', preco: 475.00, unidade: 'm³', fck: 30, slump: 'Espalhamento 65cm', brita: 'Brita 0/1', traco: '1 : 1,7 : 2,0 : 0,44', descricao: 'Concreto fluido que preenche todas as formas sem necessidade de vibração mecânica.' },
  { id: 'cnc-fibras-sinteticas', nome: 'Concreto com Fibras Estruturais FCK 30 MPa', categoria: 'Concretos Especiais', preco: 465.00, unidade: 'm³', fck: 30, slump: '14 ± 2 cm', brita: 'Brita 1', traco: '1 : 1,6 : 2,2 : 0,45 + 1kg Fibra', descricao: 'Adição de fibras de polipropileno para controle de fissuras por retração plástica.' },
  { id: 'cnc-impermeavel', nome: 'Concreto com Aditivo Impermeabilizante FCK 25 MPa', categoria: 'Concretos Especiais', preco: 445.00, unidade: 'm³', fck: 25, slump: '12 ± 2 cm', brita: 'Brita 1', traco: '1 : 1,9 : 2,5 : 0,48 + Hidrófugo', descricao: 'Resistência hidrófuga contra infiltrações para piscinas, reservatórios e cortinas.' },

  // Serviços de Bombeamento e Logística
  { id: 'srv-bomba-lanca-32', nome: 'Serviço de Caminhão Bomba Lança 32m (até 25 m³)', categoria: 'Serviços de Bombeamento', preco: 750.00, unidade: 'viagem', descricao: 'Taxa mínima de bombeamento com alcance vertical de 32 metros e tubulação flexível.' },
  { id: 'srv-bomba-excedente', nome: 'Bombeamento Adicional por m³ excedente', categoria: 'Serviços de Bombeamento', preco: 25.00, unidade: 'm³', descricao: 'Valor cobrado por metro cúbico bombeado acima da taxa mínima de 25m³.' },
  { id: 'srv-bomba-estacionaria', nome: 'Serviço de Bomba Estacionária (Tubulação de 100m)', categoria: 'Serviços de Bombeamento', preco: 850.00, unidade: 'diária', descricao: 'Bomba rebocável para locais de difícil acesso, túneis ou pavimentos superiores.' },
  { id: 'srv-espera-betoneira', nome: 'Taxa de Espera de Betoneira na Obra (por hora)', categoria: 'Serviços de Bombeamento', preco: 120.00, unidade: 'hora', descricao: 'Aplicada quando a descarga ultrapassa a franquia de 1h gratuita concedida.' },
  { id: 'srv-ensaio-slump', nome: 'Ensaio de Slump Test (Abatimento de Cone na Obra)', categoria: 'Controle Tecnológico', preco: 50.00, unidade: 'ensaio', descricao: 'Aferição oficial da consistência do concreto na chegada do caminhão à obra.' },
  { id: 'srv-rompimento-cp', nome: 'Moldagem e Laudo de Ruptura de Corpos de Prova (7 e 28 dias)', categoria: 'Controle Tecnológico', preco: 180.00, unidade: 'laudo', descricao: 'Moldagem de 4 corpos de prova cilíndricos (10x20cm) com ensaio de compressão axial certificado.' },

  // Insumos Industriais (Estoque de Usina)
  { id: 'ins-cimento-cp2', nome: 'Cimento Portland CP II-F-32 a Granel', categoria: 'Insumos de Usina', preco: 680.00, unidade: 'ton', estoque: 120, minimo: 25, descricao: 'Armazenado em silos verticais de 60t com pesagem por células de carga.' },
  { id: 'ins-cimento-cp5', nome: 'Cimento Portland CP V-ARI de Alta Resistência Inicial', categoria: 'Insumos de Usina', preco: 740.00, unidade: 'ton', estoque: 60, minimo: 15, descricao: 'Para desforma rápida e concretos de alta resistência FCK 35 a 45.' },
  { id: 'ins-areia-media', nome: 'Areia Média Lavada de Rio Natural', categoria: 'Insumos de Usina', preco: 95.00, unidade: 'm³', estoque: 450, minimo: 80, descricao: 'Baixo teor de finos, curva granulométrica controlada para traços nobres.' },
  { id: 'ins-brita-0', nome: 'Brita 0 / Pedrisco Basáltico (4,8 a 9,5 mm)', categoria: 'Insumos de Usina', preco: 115.00, unidade: 'm³', estoque: 320, minimo: 60, descricao: 'Agregado miúdo limpo para concretos bombeáveis de brita zero.' },
  { id: 'ins-brita-1', nome: 'Brita 1 Granítica Selecionada (9,5 a 19 mm)', categoria: 'Insumos de Usina', preco: 110.00, unidade: 'm³', estoque: 580, minimo: 100, descricao: 'Agregado graúdo de alta dureza para estrutura e pisos.' },
  { id: 'ins-aditivo-plastificante', nome: 'Aditivo Plastificante Polifuncional Multiflux', categoria: 'Insumos de Usina', preco: 8.50, unidade: 'litro', estoque: 2400, minimo: 500, descricao: 'Redutor de água e melhorador de trabalhabilidade conforme NBR 11768.' },
  { id: 'ins-aditivo-retardador', nome: 'Aditivo Retardador de Pega para Tempo Quente', categoria: 'Insumos de Usina', preco: 11.00, unidade: 'litro', estoque: 1200, minimo: 300, descricao: 'Estende o tempo de pega em viagens longas e temperaturas acima de 32°C.' },
  { id: 'ins-fibras-polipropileno', nome: 'Fibras Sintéticas Estruturais de Polipropileno', categoria: 'Insumos de Usina', preco: 28.00, unidade: 'kg', estoque: 350, minimo: 50, descricao: 'Fibras para reforço secundário de concreto em lajes e pisos.' },

  // Serrano Mineração (Venda Direta de Agregados)
  { id: 'min-areia-media', nome: 'Areia Média Lavada de Rio (Carga Fechada)', categoria: 'Serrano Mineração', preco: 95.00, unidade: 'm³', descricao: 'Produzida por dragagem moderna na Serrano Mineração, ideal para concreto e argamassas finas.' },
  { id: 'min-areia-grossa', nome: 'Areia Grossa de Dragagem para Concreto', categoria: 'Serrano Mineração', preco: 105.00, unidade: 'm³', descricao: 'Alta compacidade e resistência mecânica para traços estruturais nobres.' },
  { id: 'min-brita-pedrisco', nome: 'Brita 0 / Pedrisco Lavado (4,8 a 9,5 mm)', categoria: 'Serrano Mineração', preco: 115.00, unidade: 'm³', descricao: 'Excelente para concreto bombeado de brita zero, lajes e pré-moldados.' },
  { id: 'min-brita-1', nome: 'Brita 1 Granítica Selecionada (9,5 a 19 mm)', categoria: 'Serrano Mineração', preco: 110.00, unidade: 'm³', descricao: 'Agregado graúdo para vigas, pilares, sapatas e pavimentação.' },
  { id: 'min-po-pedra', nome: 'Pó de Pedra Basáltico Selecionado', categoria: 'Serrano Mineração', preco: 85.00, unidade: 'm³', descricao: 'Ideal para assentamento de paver, calçamento e regularização.' },

  // Artefatos de Cimento
  { id: 'art-tubo-60', nome: 'Tubo de Concreto Macho e Fêmea 600mm (PS1)', categoria: 'Artefatos de Cimento', preco: 145.00, unidade: 'peça', descricao: 'Tubo de concreto para drenagem pluvial e bueiros de alta vazão conforme NBR 8890.' },
  { id: 'art-mourao-curvo', nome: 'Mourão de Concreto Curvo para Alambrado 3,0m', categoria: 'Artefatos de Cimento', preco: 48.00, unidade: 'peça', descricao: 'Mourão armado vibrado para cercas de chácaras, fazendas e indústrias.' },
  { id: 'art-paver-16f', nome: 'Bloquete Paver Intertravado 16 Faces 8cm', categoria: 'Artefatos de Cimento', preco: 62.00, unidade: 'm²', descricao: 'Pavimentação de alta resistência (35 MPa) para tráfego pesado de caminhões e pátios.' },
];

export const CONCRETO_FROTA_INICIAL = [
  { id: 'bet-01', codigo: 'BT-01', placa: 'RAX-3E21', modelo: 'Mercedes-Benz Actros 2651 8x4', capacidadeM3: 10, tipo: 'betoneira', status: 'em_transito', motorista: 'Marcos Silveira', telefone: '(65) 99981-1101', horimetro: 3420 },
  { id: 'bet-02', codigo: 'BT-02', placa: 'RBY-4F32', modelo: 'Scania P360 8x4', capacidadeM3: 10, tipo: 'betoneira', status: 'em_transito', motorista: 'Carlos Eduardo Santos', telefone: '(65) 99981-1102', horimetro: 2890 },
  { id: 'bet-03', codigo: 'BT-03', placa: 'RCZ-5G43', modelo: 'Volvo VM 330 6x4', capacidadeM3: 8, tipo: 'betoneira', status: 'disponivel', motorista: 'Valdemir Oliveira', telefone: '(65) 99981-1103', horimetro: 4150 },
  { id: 'bet-04', codigo: 'BT-04', placa: 'RDA-6H54', modelo: 'Ford Cargo 2629 6x4', capacidadeM3: 8, tipo: 'betoneira', status: 'carregando', motorista: 'Roberto Lima', telefone: '(65) 99981-1104', horimetro: 5120 },
  { id: 'bet-05', codigo: 'BT-05', placa: 'RDB-7J65', modelo: 'VW Constellation 26.280 6x4', capacidadeM3: 8, tipo: 'betoneira', status: 'disponivel', motorista: 'Fernando Souza', telefone: '(65) 99981-1105', horimetro: 1980 },
  { id: 'bmb-01', codigo: 'BL-01', placa: 'REC-8K76', modelo: 'Mercedes-Benz Atego 2430 6x2', alcanceMetros: 32, tipo: 'bomba_lanca', status: 'na_obra', operador: 'Gilberto Ramos', telefone: '(65) 99981-2201', horimetro: 1640 },
  { id: 'bmb-02', codigo: 'BL-02', placa: 'RED-9L87', modelo: 'Volvo VM 270 6x2 Schwing', alcanceMetros: 36, tipo: 'bomba_lanca', status: 'disponivel', operador: 'Claudemir Costa', telefone: '(65) 99981-2202', horimetro: 2110 },
];

export const CONCRETO_CARGAS_INICIAIS = [
  {
    id: 'crg-1001',
    numero: 1001,
    cliente: 'Construtora MT Horizon',
    obra: 'Edifício Residencial Serra Dourada · Lajes do 4º Pavimento',
    endereco: 'Rua José Corsino, 450, Jardim Europa, Tangará da Serra/MT',
    fck: 'FCK 30 MPa (Brita 1)',
    slump: '14 ± 2 cm',
    volumeM3: 24,
    bomba: 'BL-01 (Bomba Lança 32m)',
    horarioAgendado: '08:30',
    status: 'concluido',
    viagens: [
      { betoneira: 'BT-01', motorista: 'Marcos Silveira', volume: 8, saida: '08:15', chegada: '08:35', fimDescarga: '09:20' },
      { betoneira: 'BT-02', motorista: 'Carlos Eduardo Santos', volume: 8, saida: '08:50', chegada: '09:10', fimDescarga: '10:00' },
      { betoneira: 'BT-03', motorista: 'Valdemir Oliveira', volume: 8, saida: '09:30', chegada: '09:55', fimDescarga: '10:45' },
    ],
    valorTotal: 11160.00, // 24m³ * 440 + 750 taxa bomba
    laudoCp: 'CP-2026-089 (4 corpos de prova moldados)'
  },
  {
    id: 'crg-1002',
    numero: 1002,
    cliente: 'AgroLog Transportes & Logística',
    obra: 'Piso Industrial Galpão de Cargas · Etapa 2',
    endereco: 'Av. Lions Internacional, 1800, Distrito Industrial, Tangará da Serra/MT',
    fck: 'FCK 35 MPa com Fibras Sintéticas',
    slump: '14 ± 2 cm',
    volumeM3: 32,
    bomba: 'Descarga Direta (Calha)',
    horarioAgendado: '13:30',
    status: 'em_transito',
    viagens: [
      { betoneira: 'BT-01', motorista: 'Marcos Silveira', volume: 8, saida: '13:10', chegada: '13:25', fimDescarga: '14:15' },
      { betoneira: 'BT-02', motorista: 'Carlos Eduardo Santos', volume: 8, saida: '13:45', chegada: '14:05', fimDescarga: null },
      { betoneira: 'BT-04', motorista: 'Roberto Lima', volume: 8, saida: '14:20', chegada: null, fimDescarga: null },
      { betoneira: 'BT-05', motorista: 'Fernando Souza', volume: 8, saida: null, chegada: null, fimDescarga: null },
    ],
    valorTotal: 15360.00,
    laudoCp: 'CP-2026-090 (4 corpos de prova moldados)'
  },
  {
    id: 'crg-1003',
    numero: 1003,
    cliente: 'Eng. Marcelo Dantas Residencial',
    obra: 'Casa Térrea Lote 12 Quadra 08 · Vigas e Baldrames',
    endereco: 'Rua das Palmeiras, 112, Alphaville Tangará, Tangará da Serra/MT',
    fck: 'FCK 25 MPa (Brita 1)',
    slump: '12 ± 2 cm',
    volumeM3: 16,
    bomba: 'BL-01 (Bomba Lança 32m)',
    horarioAgendado: '16:00',
    status: 'carregando',
    viagens: [
      { betoneira: 'BT-03', motorista: 'Valdemir Oliveira', volume: 8, saida: null, chegada: null, fimDescarga: null },
      { betoneira: 'BT-04', motorista: 'Roberto Lima', volume: 8, saida: null, chegada: null, fimDescarga: null },
    ],
    valorTotal: 7310.00,
    laudoCp: 'Pendente de moldagem'
  }
];


export const CONCRETO_SILOS_INICIAIS = [
  {
    id: 'silo-01',
    codigo: 'SILO-01',
    nome: 'Silo 01 · Cimento CP II-F 32 (Uso Geral & Estrutural)',
    material: 'Cimento Portland CP II-F 32',
    fornecedor: 'Cimentos Votoran / Ciper MT',
    capacidadeToneladas: 100,
    capacidadeTotalTon: 100,
    nivelAtualToneladas: 74.5,
    estoqueAtualTon: 74.5,
    nivelPercent: 74.5,
    nivelPercentual: 74.5,
    pressaoDespoeiramento: '2.4 bar',
    filtroStatus: 'operacional',
    valvulaDescarga: 'fechada_pronta',
    temperaturaInterna: '34°C',
    ultimaRecargaData: '11/11/2026 08:30',
    ultimaRecargaQtd: '38.2 t (Bitrem Scania)',
    alertaReposicao: false,
    corBadge: '#F59E0B'
  },
  {
    id: 'silo-02',
    codigo: 'SILO-02',
    nome: 'Silo 02 · Cimento CP V-ARI (Alta Resistência Inicial)',
    material: 'Cimento Portland CP V-ARI',
    fornecedor: 'Cimentos Votoran / Ciper MT',
    capacidadeToneladas: 80,
    capacidadeTotalTon: 80,
    nivelAtualToneladas: 58.2,
    estoqueAtualTon: 58.2,
    nivelPercent: 72.8,
    nivelPercentual: 72.8,
    pressaoDespoeiramento: '2.2 bar',
    filtroStatus: 'operacional',
    valvulaDescarga: 'fechada_pronta',
    temperaturaInterna: '36°C',
    ultimaRecargaData: '10/11/2026 14:15',
    ultimaRecargaQtd: '32.0 t (Carreta Volvo)',
    alertaReposicao: false,
    corBadge: '#3B82F6'
  },
  {
    id: 'silo-03',
    codigo: 'SILO-03',
    nome: 'Silo 03 · Pozolana Ativa / Filler Calcário Micronizado',
    material: 'Adição Mineral / Pozolana NBR 12653',
    fornecedor: 'Calcário & Minerais Tangará',
    capacidadeToneladas: 50,
    capacidadeTotalTon: 50,
    nivelAtualToneladas: 18.0,
    estoqueAtualTon: 18.0,
    nivelPercent: 36.0,
    nivelPercentual: 36.0,
    pressaoDespoeiramento: '1.9 bar',
    filtroStatus: 'operacional',
    valvulaDescarga: 'fechada_pronta',
    temperaturaInterna: '29°C',
    ultimaRecargaData: '05/11/2026 11:00',
    ultimaRecargaQtd: '25.0 t (Carreta)',
    alertaReposicao: true,
    corBadge: '#8B5CF6'
  },
  {
    id: 'patio-01',
    codigo: 'PAT-AREIA-MED',
    nome: 'Pátio de Areia Média Lavada',
    material: 'Areia Média Lavada de Rio (Serrano Mineração)',
    tipo: 'agregado_areia',
    capacidadeToneladas: 650,
    capacidadeTotalTon: 650,
    capacidadeTotalM3: 800,
    nivelAtualToneladas: 320,
    estoqueAtualTon: 320,
    estoqueAtualM3: 540,
    nivelPercent: 67.5,
    umidadeAtual: 4.8,
    fornecedor: 'Serrano Mineração Própria',
    alertaMinimoM3: 100
  },
  {
    id: 'patio-02',
    codigo: 'PAT-AREIA-GRO',
    nome: 'Pátio de Areia Grossa de Dragagem',
    material: 'Areia Grossa Selecionada (Serrano Mineração)',
    tipo: 'agregado_areia',
    capacidadeToneladas: 500,
    capacidadeTotalTon: 500,
    capacidadeTotalM3: 600,
    nivelAtualToneladas: 240,
    estoqueAtualTon: 240,
    estoqueAtualM3: 390,
    nivelPercent: 65.0,
    umidadeAtual: 5.2,
    fornecedor: 'Serrano Mineração Própria',
    alertaMinimoM3: 80
  },
  {
    id: 'patio-03',
    codigo: 'PAT-BRITA-0',
    nome: 'Box Brita 0 (Pedrisco Basáltico 4,8 a 9,5mm)',
    material: 'Brita 0 / Pedrisco Selecionado',
    tipo: 'agregado_brita',
    capacidadeToneladas: 400,
    capacidadeTotalTon: 400,
    capacidadeTotalM3: 500,
    nivelAtualToneladas: 190,
    estoqueAtualTon: 190,
    estoqueAtualM3: 310,
    nivelPercent: 62.0,
    fornecedor: 'Pedreira Serra dos Parecis',
    alertaMinimoM3: 60
  },
  {
    id: 'patio-04',
    codigo: 'PAT-BRITA-1',
    nome: 'Box Brita 1 (Granito Basalto 9,5 a 19mm)',
    material: 'Brita 1 Estrutural Granítica',
    tipo: 'agregado_brita',
    capacidadeToneladas: 600,
    capacidadeTotalTon: 600,
    capacidadeTotalM3: 900,
    nivelAtualToneladas: 285,
    estoqueAtualTon: 285,
    estoqueAtualM3: 620,
    nivelPercent: 68.8,
    fornecedor: 'Pedreira Serra dos Parecis',
    alertaMinimoM3: 120
  }
];

export const CONCRETO_BAIAS_INICIAIS = [
  {
    id: 'baia-01',
    codigo: 'BAIA-01',
    nome: 'Baia 01 · Areia Média Lavada de Rio (Sepotuba)',
    material: 'Areia Média Lavada (NBR 7211)',
    capacidadeToneladas: 300,
    estoqueAtualToneladas: 215.0,
    estoqueAtualM3: 143.3,
    umidadePercentual: 4.5,
    densidadeAparente: 1.50,
    moduloFinura: 2.60,
    fornecedor: 'Areial Rio Sepotuba / Tangará',
    sensorUmidade: 'Sonda Capacitiva Online (Calibrada)',
    aguaContidaLitros: 9675,
    status: 'operacional',
    corBadge: '#EAB308'
  },
  {
    id: 'baia-02',
    codigo: 'BAIA-02',
    nome: 'Baia 02 · Areia Fina / Usinada (Quartzo)',
    material: 'Areia Fina de Usina',
    capacidadeToneladas: 200,
    estoqueAtualToneladas: 140.0,
    estoqueAtualM3: 96.5,
    umidadePercentual: 3.8,
    densidadeAparente: 1.45,
    moduloFinura: 1.85,
    fornecedor: 'Mineradora Serra Morena',
    sensorUmidade: 'Sonda Capacitiva Online (Calibrada)',
    aguaContidaLitros: 5320,
    status: 'operacional',
    corBadge: '#CA8A04'
  },
  {
    id: 'baia-03',
    codigo: 'BAIA-03',
    nome: 'Baia 03 · Brita 0 / Pedrisco Limpo (4,8 a 9,5 mm)',
    material: 'Pedrisco Brita 0 Basalto',
    capacidadeToneladas: 250,
    estoqueAtualToneladas: 185.0,
    estoqueAtualM3: 132.1,
    umidadePercentual: 1.2,
    densidadeAparente: 1.40,
    fornecedor: 'Pedreira Serra Bonita',
    sensorUmidade: 'Aferição Laboratorial Diária',
    status: 'operacional',
    corBadge: '#94A3B8'
  },
  {
    id: 'baia-04',
    codigo: 'BAIA-04',
    nome: 'Baia 04 · Brita 1 Granítica (9,5 a 19 mm)',
    material: 'Brita 1 Granítica Estrutural',
    capacidadeToneladas: 400,
    estoqueAtualToneladas: 310.0,
    estoqueAtualM3: 221.4,
    umidadePercentual: 0.8,
    densidadeAparente: 1.40,
    fornecedor: 'Pedreira Serra Bonita',
    sensorUmidade: 'Aferição Laboratorial Diária',
    status: 'operacional',
    corBadge: '#64748B'
  },
  {
    id: 'baia-05',
    codigo: 'BAIA-05',
    nome: 'Baia 05 · Brita 2 Granítica (19 a 25 mm)',
    material: 'Brita 2 Granítica para Pisos Pesados',
    capacidadeToneladas: 250,
    estoqueAtualToneladas: 165.0,
    estoqueAtualM3: 117.8,
    umidadePercentual: 0.5,
    densidadeAparente: 1.40,
    fornecedor: 'Pedreira Serra Bonita',
    sensorUmidade: 'Aferição Laboratorial Diária',
    status: 'operacional',
    corBadge: '#475569'
  }
];

export const CONCRETO_TANQUES_ADITIVOS = [
  {
    id: 'tanque-01',
    codigo: 'TK-ADIT-01',
    nome: 'Tanque A1 · Plastificante Polifuncional Tecflow 200',
    produto: 'Tecflow 200 (Plastificante / Redutor de Água)',
    capacidadeLitros: 3000,
    nivelAtualLitros: 2250,
    nivelPercentual: 75.0,
    dosagemPadrao: '0.6% sobre peso de cimento',
    fornecedor: 'Tecnologia em Aditivos do Brasil',
    status: 'operacional',
    corBadge: '#06B6D4'
  },
  {
    id: 'tanque-02',
    codigo: 'TK-ADIT-02',
    nome: 'Tanque A2 · Superplastificante Policarboxilato Optima 1000',
    produto: 'Optima 1000 (Superplastificante Alta Performance CAA)',
    capacidadeLitros: 2000,
    nivelAtualLitros: 1480,
    nivelPercentual: 74.0,
    dosagemPadrao: '0.9% sobre peso de cimento',
    fornecedor: 'Química Industrial Estrutural',
    status: 'operacional',
    corBadge: '#0EA5E9'
  },
  {
    id: 'tanque-03',
    codigo: 'TK-ADIT-03',
    nome: 'Tanque A3 · Retardador de Pega para Alta Temperatura',
    produto: 'Retard-MT (Estabilizador de hidratação sob sol)',
    capacidadeLitros: 2000,
    nivelAtualLitros: 1650,
    nivelPercentual: 82.5,
    dosagemPadrao: '0.4% sobre peso de cimento',
    fornecedor: 'Química Industrial Estrutural',
    status: 'operacional',
    corBadge: '#38BDF8'
  },
  {
    id: 'tanque-04',
    codigo: 'TK-AGUA-01',
    nome: 'Reservatório Principal de Água Industrial + Chiller',
    produto: 'Água Potável / Industrial Resfriada (18°C)',
    capacidadeLitros: 60000,
    nivelAtualLitros: 48500,
    nivelPercentual: 80.8,
    temperaturaAgua: '18.5°C',
    pressaoRede: '4.2 bar',
    status: 'operacional',
    corBadge: '#0284C7'
  }
];

export const CONCRETO_ENTRADAS_SUPRIMENTOS = [
  {
    id: 'ent-2026-001',
    ticketBalança: 'TK-BAL-8841',
    dataHora: '12/11/2026 09:15',
    fornecedor: 'Cimentos Votoran / Ciper MT',
    material: 'Cimento Portland CP II-F 32 a Granel',
    destino: 'Silo 01 (SILO-CP2)',
    placaCarreta: 'RBF-8A90',
    motorista: 'Claudio Roberto Santana',
    notaFiscal: 'NF-e 001.442.190',
    pesoBruto: 56840,
    tara: 18620,
    pesoLiquido: 38220, // 38.22 toneladas
    certificadoQualidade: 'Cert-CP2-2026-9022 (Aprovado)',
    lacreFornecedor: 'LCR-99210-VOT',
    operadorUsina: 'Eng. Tiago Alencar',
    status: 'descarregado_concluido'
  },
  {
    id: 'ent-2026-002',
    ticketBalança: 'TK-BAL-8842',
    dataHora: '12/11/2026 10:40',
    fornecedor: 'Pedreira Serra Bonita',
    material: 'Brita 1 Granítica Estrutural',
    destino: 'Baia 04 (BAIA-BRITA-1)',
    placaCarreta: 'NXC-5J11',
    motorista: 'Marcos Vinicius Pereira',
    notaFiscal: 'NF-e 089.123',
    pesoBruto: 44300,
    tara: 15100,
    pesoLiquido: 29200, // 29.20 toneladas
    certificadoQualidade: 'Abrasão Los Angeles: 22% (Aprovado)',
    lacreFornecedor: 'LCR-PB-1102',
    operadorUsina: 'Eng. Tiago Alencar',
    status: 'descarregado_concluido'
  },
  {
    id: 'ent-2026-003',
    ticketBalança: 'TK-BAL-8843',
    dataHora: '12/11/2026 13:20',
    fornecedor: 'Areial Rio Sepotuba',
    material: 'Areia Média Lavada de Rio',
    destino: 'Baia 01 (BAIA-AREIA-MED)',
    placaCarreta: 'QBY-9C44',
    motorista: 'José Carlos Furtado',
    notaFiscal: 'NF-e 012.774',
    pesoBruto: 45800,
    tara: 16200,
    pesoLiquido: 29600, // 29.60 toneladas
    umidadeAferidaBalança: '4.5%',
    certificadoQualidade: 'Teor de Argila < 1.0% (Aprovado)',
    operadorUsina: 'Eng. Tiago Alencar',
    status: 'descarregado_concluido'
  }
];

export const CONCRETO_BATELADAS_PROCESSO = [
  {
    id: 'bat-1001-01',
    numeroTicket: 'BAT-2026-0841',
    horario: '13:45',
    cargaId: 'crg-1001',
    cliente: 'Construtora Tangará Obras Civis',
    obra: 'Edifício Residencial Belvedere Tower · Laje do 4º Pavimento',
    betoneira: 'BT-01 (Mercedes-Benz 8m³)',
    motorista: 'Carlos Eduardo Silva',
    fck: 'FCK 30 MPa (Brita 1)',
    slumpEspecificado: '14 ± 2 cm',
    slumpMedidoUsina: '14.0 cm',
    volumeBateladaM3: 8.0,
    cimentoProgramadoKg: 2800,
    cimentoPesadoKg: 2808,
    desvioCimentoPct: '+0.28%',
    areiaMediaSecaKg: 4480,
    areiaMediaPesadaKg: 4682, // corrigida c/ 4.5% umidade
    aguaAdicionadaAreiaKg: 202,
    brita1ProgramadaKg: 6160,
    brita1PesadaKg: 6140,
    desvioBritaPct: '-0.32%',
    aguaProgramadaLitros: 1260,
    aguaRealAdicionadaLitros: 1058, // 1260 - 202L da areia
    aditivoPlastificanteLitros: 19.6,
    aditivoRetardadorLitros: 8.4,
    fatorAcReal: 0.45,
    tempoMisturaSegundos: 180,
    rotacaoBalaoRPM: 16,
    temperaturaConcreto: '28.5°C',
    lacreBetoneira: 'LCR-CNC-8821',
    conformidadeNBR7212: 'TOTALMENTE_CONFORME',
    operadorBatcher: 'Marcio Fontes (Operador de Usina)'
  },
  {
    id: 'bat-1002-01',
    numeroTicket: 'BAT-2026-0842',
    horario: '14:20',
    cargaId: 'crg-1002',
    cliente: 'AgroLog Transportes & Armazéns',
    obra: 'Piso Industrial Reforçado com Fibras · Módulo 03',
    betoneira: 'BT-02 (Volvo FMX 8m³)',
    motorista: 'Adilson Silveira',
    fck: 'FCK 35 MPa (Pisos Industriais)',
    slumpEspecificado: '14 ± 2 cm',
    slumpMedidoUsina: '13.5 cm',
    volumeBateladaM3: 8.0,
    cimentoProgramadoKg: 3120,
    cimentoPesadoKg: 3130,
    desvioCimentoPct: '+0.32%',
    areiaMediaSecaKg: 4368,
    areiaMediaPesadaKg: 4565,
    brita1ProgramadaKg: 5928,
    brita1PesadaKg: 5910,
    desvioBritaPct: '-0.30%',
    aguaProgramadaLitros: 1310,
    aguaRealAdicionadaLitros: 1113,
    aditivoPlastificanteLitros: 28.0,
    fibrasPolipropilenoKg: 8.0,
    fatorAcReal: 0.42,
    tempoMisturaSegundos: 210,
    rotacaoBalaoRPM: 16,
    temperaturaConcreto: '29.0°C',
    lacreBetoneira: 'LCR-CNC-8822',
    conformidadeNBR7212: 'TOTALMENTE_CONFORME',
    operadorBatcher: 'Marcio Fontes (Operador de Usina)'
  }
];

export async function provisionarConcretoUsina() {
  const data = db();
  if (!Array.isArray(data.empresas)) data.empresas = [];
  if (!Array.isArray(data.lojas)) data.lojas = [];
  if (!Array.isArray(data.usuarios)) data.usuarios = [];
  if (!Array.isArray(data.concreto_produtos)) data.concreto_produtos = [];
  if (!Array.isArray(data.concreto_frota)) data.concreto_frota = [];
  if (!Array.isArray(data.concreto_cargas)) data.concreto_cargas = [];

  // 1. Empresa
  let empresa = data.empresas.find(e => e.id === CONCRETO_EMPRESA_ID || e.cnpj === CONCRETO_CNPJ);
  if (!empresa) {
    empresa = { ...CONCRETO_DADOS_EMPRESA };
    data.empresas.push(empresa);
  } else {
    Object.assign(empresa, CONCRETO_DADOS_EMPRESA);
  }

  // 2. Loja / Unidade Usina Matriz
  let loja = data.lojas.find(l => l.id === CONCRETO_LOJA_ID);
  if (!loja) {
    loja = {
      id: CONCRETO_LOJA_ID,
      empresaId: CONCRETO_EMPRESA_ID,
      codigo: 'USINA-01',
      nome: 'Serrano Concreto · Usina Matriz',
      nomeFantasia: 'Usina Matriz Distrito Industrial',
      tipoNegocio: 'concreto',
      ativa: true
    };
    data.lojas.push(loja);
  }

  // 3. Usuários da Usina
  const SENHA_PADRAO_HASH = '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq'; // 123456
  const usuariosConcreto = [
    { id: 'usr-concreto-admin-01', user: 'concreto', nome: 'Gerente da Usina Serrano', email: 'gerente@serranoconcreto.com.br', role: 'admin', empresaId: CONCRETO_EMPRESA_ID },
    { id: 'usr-concreto-operador-01', user: 'operador_usina', nome: 'Operador Central Dosadora', email: 'usina@serranoconcreto.com.br', role: 'operador', empresaId: CONCRETO_EMPRESA_ID },
    { id: 'usr-concreto-despacho-01', user: 'despacho', nome: 'Despacho & Balança de Concreto', email: 'despacho@serranoconcreto.com.br', role: 'atendente', empresaId: CONCRETO_EMPRESA_ID }
  ];

  for (const u of usuariosConcreto) {
    let exist = data.usuarios.find(x => x.user === u.user || x.id === u.id);
    if (!exist) {
      data.usuarios.push({ ...u, senhaHash: SENHA_PADRAO_HASH, ativo: true });
    } else {
      exist.empresaId = CONCRETO_EMPRESA_ID;
      exist.ativo = true;
      if (!exist.senhaHash) exist.senhaHash = SENHA_PADRAO_HASH;
    }
  }

  // Vincular ao superadmin Rodrigo
  const superAdmin = data.usuarios.find(x => x.user === 'rrodrigogon@gmail.com' || x.user === 'rodrigo');
  if (superAdmin) {
    if (!Array.isArray(superAdmin.empresasAutorizadas)) superAdmin.empresasAutorizadas = [];
    if (!superAdmin.empresasAutorizadas.includes(CONCRETO_EMPRESA_ID)) {
      superAdmin.empresasAutorizadas.push(CONCRETO_EMPRESA_ID);
    }
  }

  // 4. Catálogo de Concretos e Traços
  data.concreto_produtos = data.concreto_produtos.filter(p => p.empresaId !== CONCRETO_EMPRESA_ID);
  for (const item of CONCRETO_CATALOGO_INICIAL) {
    data.concreto_produtos.push({ ...item, empresaId: CONCRETO_EMPRESA_ID, lojaId: CONCRETO_LOJA_ID, ativo: true });
  }

  // 5. Frota
  data.concreto_frota = data.concreto_frota.filter(f => f.empresaId !== CONCRETO_EMPRESA_ID);
  for (const f of CONCRETO_FROTA_INICIAL) {
    data.concreto_frota.push({ ...f, empresaId: CONCRETO_EMPRESA_ID });
  }

  // 6. Cargas
  data.concreto_cargas = data.concreto_cargas.filter(c => c.empresaId !== CONCRETO_EMPRESA_ID);
  for (const c of CONCRETO_CARGAS_INICIAIS) {
    data.concreto_cargas.push({ ...c, empresaId: CONCRETO_EMPRESA_ID });
  }

  // 7. Silos de Cimento e Pozolana
  if (!Array.isArray(data.concreto_silos) || data.concreto_silos.length === 0) {
    data.concreto_silos = CONCRETO_SILOS_INICIAIS.map(s => ({ ...s, empresaId: CONCRETO_EMPRESA_ID }));
  }

  // 8. Baias de Agregados (Areias e Britas)
  if (!Array.isArray(data.concreto_baias) || data.concreto_baias.length === 0) {
    data.concreto_baias = CONCRETO_BAIAS_INICIAIS.map(b => ({ ...b, empresaId: CONCRETO_EMPRESA_ID }));
  }

  // 9. Tanques de Aditivos e Água
  if (!Array.isArray(data.concreto_tanques) || data.concreto_tanques.length === 0) {
    data.concreto_tanques = CONCRETO_TANQUES_ADITIVOS.map(t => ({ ...t, empresaId: CONCRETO_EMPRESA_ID }));
  }

  // 10. Entradas de Suprimentos na Balança
  if (!Array.isArray(data.concreto_entradas_suprimentos) || data.concreto_entradas_suprimentos.length === 0) {
    data.concreto_entradas_suprimentos = CONCRETO_ENTRADAS_SUPRIMENTOS.map(e => ({ ...e, empresaId: CONCRETO_EMPRESA_ID }));
  }

  // 11. Bateladas e Controle de Processo
  if (!Array.isArray(data.concreto_bateladas) || data.concreto_bateladas.length === 0) {
    data.concreto_bateladas = CONCRETO_BATELADAS_PROCESSO.map(b => ({ ...b, empresaId: CONCRETO_EMPRESA_ID }));
  }

  save();

  // 7. Sincronizar no PostgreSQL se disponível
  try {
    const { getPool } = await import('./db.js').catch(() => ({}));
    const pool = typeof getPool === 'function' ? getPool() : null;
    if (pool && typeof pool.query === 'function') {
      await pool.query(`
        INSERT INTO empresas (id, nome, razao_social, cnpj, tipo_negocio, ativa, config, grupo_id)
        VALUES ($1, $2, $3, $4, $5, true, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          razao_social = EXCLUDED.razao_social,
          cnpj = EXCLUDED.cnpj,
          tipo_negocio = EXCLUDED.tipo_negocio,
          ativa = true,
          config = EXCLUDED.config,
          grupo_id = EXCLUDED.grupo_id;
      `, [
        CONCRETO_EMPRESA_ID,
        CONCRETO_DADOS_EMPRESA.nome,
        CONCRETO_DADOS_EMPRESA.razaoSocial,
        CONCRETO_CNPJ,
        'concreto',
        JSON.stringify(CONCRETO_DADOS_EMPRESA),
        CONCRETO_GRUPO_ID
      ]);

      await pool.query(`
        INSERT INTO lojas (id, empresa_id, codigo, nome, ativa)
        VALUES ($1, $2, 'USINA-01', 'Serrano Concreto · Usina Matriz', true)
        ON CONFLICT (id) DO UPDATE SET
          empresa_id = EXCLUDED.empresa_id,
          nome = EXCLUDED.nome,
          ativa = true;
      `, [CONCRETO_LOJA_ID, CONCRETO_EMPRESA_ID]);
    }
  } catch (err) {
    // console.warn('[concreto-seed] PostgreSQL opcional:', err.message);
  }

  return { ok: true, empresaId: CONCRETO_EMPRESA_ID, lojaId: CONCRETO_LOJA_ID };
}
