/**
 * Módulo de Autopeças, Motopeças & Acessórios Automotivos do ERP Kytto
 * Inclui: Catálogo OEM, Cross-Reference, Compatibilidade Veicular,
 * Endereçamento Físico (Corredor/Prateleira), Fiscal ST (ICMS-ST/CEST) e E-commerce.
 */

export const GRUPOS_AUTOPECAS = [
  { id: 'freios', nome: 'Sistema de Freios', icone: '🛑' },
  { id: 'suspensao', nome: 'Suspensão & Direção', icone: '🛞' },
  { id: 'motor', nome: 'Motor & Transmissão', icone: '⚙️' },
  { id: 'filtros_oleos', nome: 'Filtros & Lubrificantes', icone: '🛢️' },
  { id: 'injecao_ignicao', nome: 'Injeção Eletrônica & Ignição', icone: '⚡' },
  { id: 'arrefecimento', nome: 'Arrefecimento & Climatização', icone: '❄️' },
  { id: 'iluminacao_eletrica', nome: 'Iluminação & Baterias', icone: '💡' },
  { id: 'acessorios', nome: 'Acessórios & Estética', icone: '✨' }
];

export const MONTADORAS_MODELOS = [
  {
    montadora: 'Volkswagen',
    modelos: [
      { nome: 'Amarok', anos: '2010-2024', motores: ['2.0 16V TDI', '3.0 V6 TDI'] },
      { nome: 'Gol', anos: '2008-2023', motores: ['1.0 8V TotalFlex', '1.6 8V MSI'] },
      { nome: 'Saveiro', anos: '2010-2024', motores: ['1.6 8V MSI', '1.6 16V'] },
      { nome: 'T-Cross', anos: '2019-2024', motores: ['1.0 200 TSI', '1.4 250 TSI'] }
    ]
  },
  {
    montadora: 'Toyota',
    modelos: [
      { nome: 'Hilux', anos: '2015-2024', motores: ['2.8 16V Turbo Diesel', '2.7 16V Flex'] },
      { nome: 'Corolla', anos: '2014-2024', motores: ['1.8 16V Dual VVT-i', '2.0 16V Direct Shift', '1.8 Híbrido'] },
      { nome: 'Yaris', anos: '2018-2024', motores: ['1.3 16V', '1.5 16V'] }
    ]
  },
  {
    montadora: 'Chevrolet',
    modelos: [
      { nome: 'S10', anos: '2012-2024', motores: ['2.8 CTDI Turbo Diesel', '2.5 Ecotec Flex'] },
      { nome: 'Onix', anos: '2013-2024', motores: ['1.0 12V Turbo', '1.0 12V Aspirado', '1.4 8V SPE/4'] },
      { nome: 'Tracker', anos: '2020-2024', motores: ['1.0 Turbo', '1.2 Turbo'] }
    ]
  },
  {
    montadora: 'Fiat',
    modelos: [
      { nome: 'Strada', anos: '2020-2024', motores: ['1.3 Firefly', '1.0 Turbo 200'] },
      { nome: 'Toro', anos: '2016-2024', motores: ['2.0 16V Multijet Diesel', '1.3 Turbo 270'] }
    ]
  }
];

export const CATALAGO_AUTOPECAS_DEFAULT = [
  {
    id: 'peca-001',
    sku: 'AP-FR-001',
    codigoFabricante: 'PD/1458',
    fabricante: 'Fras-le',
    codigoOem: '2H0698151A',
    codigosCruzados: ['BOSCH 0986AB2345', 'COFAP PFC080012', 'SYL 2214'],
    nome: 'Pastilha de Freio Dianteira Cerâmica Heavy Duty',
    grupo: 'freios',
    posicao: 'Dianteira (Direita/Esquerda)',
    descricao: 'Jogo com 4 pastilhas de freio cerâmicas de alta performance. Baixo índice de fuligem e frenagem estável mesmo em altas temperaturas.',
    aplicacoes: [
      { montadora: 'Volkswagen', modelo: 'Amarok', anos: '2010-2024', motor: '2.0 TDI / 3.0 V6' }
    ],
    ncm: '8708.30.90',
    cest: '01.001.00',
    cfop: '5405',
    cstIcms: '500', // ICMS ST cobrado anteriormente
    cstPisCofins: '04', // Monofásico Alíquota Zero no varejo
    localizacao: {
      corredor: 'A',
      prateleira: '02',
      gaveta: '14'
    },
    estoqueAtual: 18,
    estoqueMinimo: 5,
    custoMedio: 220.00,
    precoVenda: 380.00,
    precoPromocionalEcommerce: 349.90,
    publicadoEcommerce: true,
    destaqueEcommerce: true,
    fotoUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    pesoKg: 2.4,
    garantiaMeses: 12
  },
  {
    id: 'peca-002',
    sku: 'AP-FL-002',
    codigoFabricante: 'LX 3241',
    fabricante: 'Mahle Metal Leve',
    codigoOem: '17801-0L040',
    codigosCruzados: ['TECFIL ARL9608', 'FRAM CA11440', 'WEGA FAP9054'],
    nome: 'Filtro de Ar do Motor Alto Fluxo',
    grupo: 'filtros_oleos',
    posicao: 'Motor / Caixa de Ar',
    descricao: 'Elemento filtrante de celulose especial repelente a poeira e umidade, essencial para a durabilidade do motor em estradas de terra e lavouras.',
    aplicacoes: [
      { montadora: 'Toyota', modelo: 'Hilux', anos: '2016-2024', motor: '2.8 Turbo Diesel' }
    ],
    ncm: '8421.31.00',
    cest: '01.015.00',
    cfop: '5405',
    cstIcms: '500',
    cstPisCofins: '04',
    localizacao: {
      corredor: 'B',
      prateleira: '04',
      gaveta: '02'
    },
    estoqueAtual: 34,
    estoqueMinimo: 10,
    custoMedio: 68.00,
    precoVenda: 145.00,
    precoPromocionalEcommerce: 129.90,
    publicadoEcommerce: true,
    destaqueEcommerce: true,
    fotoUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80',
    pesoKg: 0.65,
    garantiaMeses: 6
  },
  {
    id: 'peca-003',
    sku: 'AP-SU-003',
    codigoFabricante: 'GP33245',
    fabricante: 'Cofap',
    codigoOem: '52063851',
    codigosCruzados: ['MONROE SP389', 'NAKATA HG41189'],
    nome: 'Amortecedor Dianteiro Pressurizado Turbogás',
    grupo: 'suspensao',
    posicao: 'Dianteiro (Direito/Esquerdo)',
    descricao: 'Amortecedor pressurizado a gás que garante estabilidade extrema e conforto mesmo com carga pesada e pisos irregulares.',
    aplicacoes: [
      { montadora: 'Fiat', modelo: 'Toro', anos: '2016-2024', motor: '2.0 Diesel / 1.3 Turbo' }
    ],
    ncm: '8708.80.00',
    cest: '01.011.00',
    cfop: '5405',
    cstIcms: '500',
    cstPisCofins: '04',
    localizacao: {
      corredor: 'C',
      prateleira: '01',
      gaveta: '08'
    },
    estoqueAtual: 12,
    estoqueMinimo: 4,
    custoMedio: 295.00,
    precoVenda: 489.00,
    precoPromocionalEcommerce: 449.00,
    publicadoEcommerce: true,
    destaqueEcommerce: false,
    fotoUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80',
    pesoKg: 4.8,
    garantiaMeses: 24
  },
  {
    id: 'peca-004',
    sku: 'AP-LU-004',
    codigoFabricante: 'MAGNATEC 5W30',
    fabricante: 'Castrol',
    codigoOem: 'CASTROL-5W30-D',
    codigosCruzados: ['MOBIL SUPER 3000', 'SHELL HELIX ULTRA ECT', 'LUBRAX TOP TURBO'],
    nome: 'Óleo Motor 100% Sintético 5W30 DPF (1 Litro)',
    grupo: 'filtros_oleos',
    posicao: 'Motor',
    descricao: 'Lubrificante sintético premium com tecnologia de moléculas inteligentes que aderem às peças do motor formando uma camada protetora extra desde a partida.',
    aplicacoes: [
      { montadora: 'Volkswagen', modelo: 'Amarok', anos: '2010-2024', motor: '2.0 / 3.0' },
      { montadora: 'Toyota', modelo: 'Hilux', anos: '2016-2024', motor: '2.8 Diesel' },
      { montadora: 'Chevrolet', modelo: 'S10', anos: '2012-2024', motor: '2.8 Diesel' }
    ],
    ncm: '2710.19.32',
    cest: '06.001.00',
    cfop: '5405',
    cstIcms: '500',
    cstPisCofins: '04',
    localizacao: {
      corredor: 'B',
      prateleira: '01',
      gaveta: 'A-Geral'
    },
    estoqueAtual: 86,
    estoqueMinimo: 24,
    custoMedio: 38.50,
    precoVenda: 65.00,
    precoPromocionalEcommerce: 59.90,
    publicadoEcommerce: true,
    destaqueEcommerce: true,
    fotoUrl: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
    pesoKg: 0.95,
    garantiaMeses: 3
  }
];

/**
 * Consulta de autopeças com busca inteligente por:
 * - Placa do veículo (ex: RNI-4E29)
 * - Código OEM ou Fabricante
 * - Termo genérico (ex: pastilha, amortecedor)
 * - Filtro por Montadora e Modelo
 */
export function buscarAutopecas({ termo = '', montadora = '', modelo = '', placa = '', grupo = '' } = {}) {
  let lista = [...CATALAGO_AUTOPECAS_DEFAULT];

  // Se informou placa, mapear veículo correspondente
  if (placa) {
    const pLimpa = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (pLimpa.includes('RNI') || pLimpa.includes('4E29')) {
      montadora = 'Volkswagen';
      modelo = 'Amarok';
    } else if (pLimpa.includes('QBQ') || pLimpa.includes('8J12')) {
      montadora = 'Toyota';
      modelo = 'Hilux';
    }
  }

  if (grupo) {
    lista = lista.filter(p => p.grupo === grupo);
  }

  if (montadora) {
    lista = lista.filter(p => p.aplicacoes.some(a => a.montadora.toLowerCase() === montadora.toLowerCase()));
  }

  if (modelo) {
    lista = lista.filter(p => p.aplicacoes.some(a => a.modelo.toLowerCase().includes(modelo.toLowerCase())));
  }

  if (termo) {
    const t = termo.toLowerCase().trim();
    lista = lista.filter(p => {
      const matchNome = p.nome.toLowerCase().includes(t);
      const matchSku = p.sku.toLowerCase().includes(t);
      const matchFab = p.codigoFabricante.toLowerCase().includes(t);
      const matchOem = p.codigoOem.toLowerCase().includes(t);
      const matchCruz = (p.codigosCruzados || []).some(c => c.toLowerCase().includes(t));
      const matchFabricanteNome = p.fabricante.toLowerCase().includes(t);
      return matchNome || matchSku || matchFab || matchOem || matchCruz || matchFabricanteNome;
    });
  }

  return lista;
}

/**
 * Cadastrar ou atualizar autopeça
 */
export function salvarAutopeca(dados) {
  if (!dados.nome) throw new Error('Nome da peça é obrigatório');
  if (!dados.sku) dados.sku = `AP-${Date.now().toString(36).toUpperCase()}`;

  const index = CATALAGO_AUTOPECAS_DEFAULT.findIndex(p => p.id === dados.id || p.sku === dados.sku);
  const pecaSalva = {
    id: dados.id || `peca-${Date.now()}`,
    ...dados,
    atualizadoEm: new Date().toISOString()
  };

  if (index >= 0) {
    CATALAGO_AUTOPECAS_DEFAULT[index] = pecaSalva;
  } else {
    CATALAGO_AUTOPECAS_DEFAULT.unshift(pecaSalva);
  }

  return pecaSalva;
}
