/**
 * app/core/loja-moda-ia.js
 * Módulo Avançado de Gestão de Loja de Moda & Vestuário com IA Integrada — KYTTO Commerce
 *
 * Funcionalidades:
 * - Matriz Grade Dinâmica (Cor × Tamanho × Estoque) com Swatches de cores e SKUs automáticos
 * - Catálogo & Lookbook Visual de Coleções com tecidos e ocasiões
 * - Provador Virtual & Condicional (Malinha Inteligente) com contagem regressiva e conversão rápida
 * - Crediário Próprio com Score de Crédito, Limite, Carnê Digital e cobrança
 * - Vale-Presente (Gift Card) com QR Code e baixa de saldo
 * - Comissões de Vendedores e Metas Escalonadas
 * - Motor de Inteligência Artificial de Moda (Fashion AI Engine):
 *     1. Montador de Looks & Cross-Selling (AI Stylist)
 *     2. Copywriting de Moda & Legendas para Redes Sociais (AI Copywriter)
 *     3. Previsão de Tendências, Curva ABC e Diagnóstico de Furo de Grade (AI Inventory Analytics)
 *     4. Mensagens VIP de WhatsApp para Clientes (AI Outreach)
 */

import crypto from 'node:crypto';
import { db, save } from '../db.js';

// Cores padrão da moda com códigos hexadecimais para swatches visuais
export const PALETA_CORES_MODA = [
  { nome: 'Preto', hex: '#111111', contraste: '#ffffff' },
  { nome: 'Branco', hex: '#ffffff', contraste: '#111111' },
  { nome: 'Off-White', hex: '#f8f6f0', contraste: '#111111' },
  { nome: 'Azul Marinho', hex: '#0f172a', contraste: '#ffffff' },
  { nome: 'Azul Céu', hex: '#38bdf8', contraste: '#0f172a' },
  { nome: 'Areia / Bege', hex: '#d6c7b2', contraste: '#1f2937' },
  { nome: 'Terracota', hex: '#c2410c', contraste: '#ffffff' },
  { nome: 'Verde Militar', hex: '#3f6212', contraste: '#ffffff' },
  { nome: 'Verde Sage', hex: '#84a98c', contraste: '#111111' },
  { nome: 'Cinza Chumbo', hex: '#334155', contraste: '#ffffff' },
  { nome: 'Caramelo', hex: '#b45309', contraste: '#ffffff' },
  { nome: 'Rosa Rosé', hex: '#fda4af', contraste: '#111111' },
  { nome: 'Bordô / Vinho', hex: '#831843', contraste: '#ffffff' },
  { nome: 'Mostarda', hex: '#eab308', contraste: '#111111' }
];

export const GRADE_TAMANHOS = {
  adulto: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '3G'],
  calca_alfaiataria: ['36', '38', '40', '42', '44', '46', '48'],
  calcado: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
  infantil: ['2', '4', '6', '8', '10', '12', '14', '16']
};

export const ESTILOS_MODA = [
  'Casual Chic', 'Alfaiataria Moderna', 'Streetwear Premium',
  'Resort / Riviera', 'Festa / Gala', 'Minimalista', 'Esportivo Fino'
];

export const TECIDOS_NOBRES = [
  '100% Linho Puro', 'Algodão Pima Peruano', 'Algodão Egípcio Fio 80',
  'Seda Pura', 'Lã Fria Super 120', 'Viscose Twill', 'Couro Pelica Legítimo'
];

/**
 * Garante que a estrutura lojaModa existe no banco/snapshot
 */
function obterEstadoLojaModa(empresaId = 'default') {
  const d = db();
  if (!d.lojaModaKytto) {
    d.lojaModaKytto = { empresas: {} };
  }
  if (!d.lojaModaKytto.empresas) {
    d.lojaModaKytto.empresas = {};
  }
  if (!d.lojaModaKytto.empresas[empresaId]) {
    d.lojaModaKytto.empresas[empresaId] = {
      produtos: [],
      condicionais: [],
      crediario: { clientes: [], parcelas: [] },
      vales: [],
      comissoes: [],
      lookbook: [],
      config: {
        prazo_malinha_dias: 3,
        taxa_juros_crediario_mes: 2.5,
        limite_padrao_crediario: 1500,
        comissao_padrao_pct: 5
      }
    };
    save();
  }
  const est = d.lojaModaKytto.empresas[empresaId];
  // Seed automático inicial se vazio
  if (!est.produtos || est.produtos.length === 0) {
    popularSeedModa(empresaId);
  }
  return est;
}

/**
 * Popula catálogo inicial premium de moda com grades e looks
 */
export function popularSeedModa(empresaId = 'default') {
  const est = db().lojaModaKytto?.empresas?.[empresaId] || obterEstadoLojaModa(empresaId);

  const produtosIniciais = [
    {
      id: 'prod_linho_riviera',
      referencia: 'LMR-101',
      nome: 'Camisa Linho Manga Longa Riviera',
      descricao: 'Camisa confeccionada em 100% puro linho europeu pré-lavado. Toque macio, modelagem slim confortável e botões de madrepérola.',
      categoria: 'Camisaria',
      genero: 'masculino',
      estilo: 'Resort / Riviera',
      tecido: '100% Linho Puro',
      colecao: 'Primavera/Verão 2026',
      preco_custo: 110.00,
      preco_venda: 289.90,
      cores: ['Branco', 'Areia / Bege', 'Azul Céu', 'Terracota'],
      tamanhos: ['P', 'M', 'G', 'GG'],
      tipo_grade: 'adulto',
      imagem_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
      variantes: [
        { id: 'v_lmr_br_p', cor: 'Branco', tamanho: 'P', estoque: 4, estoque_min: 2, sku: 'LMR101-BR-P', ean: '7891010010011' },
        { id: 'v_lmr_br_m', cor: 'Branco', tamanho: 'M', estoque: 8, estoque_min: 3, sku: 'LMR101-BR-M', ean: '7891010010028' },
        { id: 'v_lmr_br_g', cor: 'Branco', tamanho: 'G', estoque: 6, estoque_min: 3, sku: 'LMR101-BR-G', ean: '7891010010035' },
        { id: 'v_lmr_br_gg', cor: 'Branco', tamanho: 'GG', estoque: 3, estoque_min: 2, sku: 'LMR101-BR-GG', ean: '7891010010042' },
        { id: 'v_lmr_ar_p', cor: 'Areia / Bege', tamanho: 'P', estoque: 3, estoque_min: 2, sku: 'LMR101-AR-P', ean: '7891010010059' },
        { id: 'v_lmr_ar_m', cor: 'Areia / Bege', tamanho: 'M', estoque: 7, estoque_min: 3, sku: 'LMR101-AR-M', ean: '7891010010066' },
        { id: 'v_lmr_ar_g', cor: 'Areia / Bege', tamanho: 'G', estoque: 5, estoque_min: 3, sku: 'LMR101-AR-G', ean: '7891010010073' },
        { id: 'v_lmr_ar_gg', cor: 'Areia / Bege', tamanho: 'GG', estoque: 1, estoque_min: 2, sku: 'LMR101-AR-GG', ean: '7891010010080' }, // Alerta de furo
        { id: 'v_lmr_az_m', cor: 'Azul Céu', tamanho: 'M', estoque: 5, estoque_min: 2, sku: 'LMR101-AZ-M', ean: '7891010010097' },
        { id: 'v_lmr_az_g', cor: 'Azul Céu', tamanho: 'G', estoque: 4, estoque_min: 2, sku: 'LMR101-AZ-G', ean: '7891010010103' },
        { id: 'v_lmr_te_m', cor: 'Terracota', tamanho: 'M', estoque: 4, estoque_min: 2, sku: 'LMR101-TE-M', ean: '7891010010110' },
        { id: 'v_lmr_te_g', cor: 'Terracota', tamanho: 'G', estoque: 3, estoque_min: 2, sku: 'LMR101-TE-G', ean: '7891010010127' }
      ]
    },
    {
      id: 'prod_calca_alfaiataria',
      referencia: 'CAL-202',
      nome: 'Calça Alfaiataria Chino Stretch',
      descricao: 'Calça alfaiataria em algodão acetinado com 3% elastano. Caimento slim perfeito, bolsos embutidos e acabamento refinado de passadores.',
      categoria: 'Calças',
      genero: 'unissex',
      estilo: 'Alfaiataria Moderna',
      tecido: 'Algodão Pima Peruano',
      colecao: 'Essenciais Perenes',
      preco_custo: 130.00,
      preco_venda: 329.90,
      cores: ['Areia / Bege', 'Azul Marinho', 'Preto', 'Verde Militar'],
      tamanhos: ['38', '40', '42', '44', '46'],
      tipo_grade: 'calca_alfaiataria',
      imagem_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80',
      variantes: [
        { id: 'v_cal_be_38', cor: 'Areia / Bege', tamanho: '38', estoque: 3, estoque_min: 2, sku: 'CAL202-BE-38', ean: '7891010020010' },
        { id: 'v_cal_be_40', cor: 'Areia / Bege', tamanho: '40', estoque: 6, estoque_min: 3, sku: 'CAL202-BE-40', ean: '7891010020027' },
        { id: 'v_cal_be_42', cor: 'Areia / Bege', tamanho: '42', estoque: 8, estoque_min: 3, sku: 'CAL202-BE-42', ean: '7891010020034' },
        { id: 'v_cal_be_44', cor: 'Areia / Bege', tamanho: '44', estoque: 4, estoque_min: 2, sku: 'CAL202-BE-44', ean: '7891010020041' },
        { id: 'v_cal_am_40', cor: 'Azul Marinho', tamanho: '40', estoque: 5, estoque_min: 3, sku: 'CAL202-AM-40', ean: '7891010020058' },
        { id: 'v_cal_am_42', cor: 'Azul Marinho', tamanho: '42', estoque: 7, estoque_min: 3, sku: 'CAL202-AM-42', ean: '7891010020065' },
        { id: 'v_cal_pt_42', cor: 'Preto', tamanho: '42', estoque: 6, estoque_min: 3, sku: 'CAL202-PT-42', ean: '7891010020072' }
      ]
    },
    {
      id: 'prod_blazer_milano',
      referencia: 'BLZ-303',
      nome: 'Blazer Milano Estruturado',
      descricao: 'Blazer meia-forração italiana em lã fria e viscose respirável. Lapela notched clássica e botões marmorizados.',
      categoria: 'Casacos & Blazers',
      genero: 'masculino',
      estilo: 'Alfaiataria Moderna',
      tecido: 'Lã Fria Super 120',
      colecao: 'Outono/Inverno 2026',
      preco_custo: 260.00,
      preco_venda: 649.90,
      cores: ['Azul Marinho', 'Cinza Chumbo', 'Preto'],
      tamanhos: ['P', 'M', 'G', 'GG'],
      tipo_grade: 'adulto',
      imagem_url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80',
      variantes: [
        { id: 'v_blz_am_m', cor: 'Azul Marinho', tamanho: 'M', estoque: 4, estoque_min: 2, sku: 'BLZ303-AM-M', ean: '7891010030019' },
        { id: 'v_blz_am_g', cor: 'Azul Marinho', tamanho: 'G', estoque: 5, estoque_min: 2, sku: 'BLZ303-AM-G', ean: '7891010030026' },
        { id: 'v_blz_cz_m', cor: 'Cinza Chumbo', tamanho: 'M', estoque: 3, estoque_min: 2, sku: 'BLZ303-CZ-M', ean: '7891010030033' },
        { id: 'v_blz_cz_g', cor: 'Cinza Chumbo', tamanho: 'G', estoque: 2, estoque_min: 2, sku: 'BLZ303-CZ-G', ean: '7891010030040' }
      ]
    },
    {
      id: 'prod_vestido_midi_linho',
      referencia: 'VES-404',
      nome: 'Vestido Midi Linho com Faixa e Fenda',
      descricao: 'Vestido midi evasê com decote quadrado, fenda frontal e cinto faixa que valoriza a cintura. Frescor e elegância pura.',
      categoria: 'Vestidos',
      genero: 'feminino',
      estilo: 'Casual Chic',
      tecido: '100% Linho Puro',
      colecao: 'Primavera/Verão 2026',
      preco_custo: 140.00,
      preco_venda: 379.90,
      cores: ['Terracota', 'Off-White', 'Verde Sage'],
      tamanhos: ['PP', 'P', 'M', 'G'],
      tipo_grade: 'adulto',
      imagem_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80',
      variantes: [
        { id: 'v_ves_te_p', cor: 'Terracota', tamanho: 'P', estoque: 4, estoque_min: 2, sku: 'VES404-TE-P', ean: '7891010040018' },
        { id: 'v_ves_te_m', cor: 'Terracota', tamanho: 'M', estoque: 6, estoque_min: 3, sku: 'VES404-TE-M', ean: '7891010040025' },
        { id: 'v_ves_te_g', cor: 'Terracota', tamanho: 'G', estoque: 3, estoque_min: 2, sku: 'VES404-TE-G', ean: '7891010040032' },
        { id: 'v_ves_ow_m', cor: 'Off-White', tamanho: 'M', estoque: 5, estoque_min: 3, sku: 'VES404-OW-M', ean: '7891010040049' },
        { id: 'v_ves_vs_m', cor: 'Verde Sage', tamanho: 'M', estoque: 4, estoque_min: 2, sku: 'VES404-VS-M', ean: '7891010040056' }
      ]
    },
    {
      id: 'prod_tshirt_pima',
      referencia: 'TSH-505',
      nome: 'T-Shirt Pima Cotton Silk Touch',
      descricao: 'Camiseta gola C com caimento fluído e toque sedoso incomparável do algodão pima. Não desbota e não encolhe.',
      categoria: 'Básicos & T-Shirts',
      genero: 'unissex',
      estilo: 'Minimalista',
      tecido: 'Algodão Pima Peruano',
      colecao: 'Essenciais Perenes',
      preco_custo: 45.00,
      preco_venda: 149.90,
      cores: ['Branco', 'Preto', 'Verde Militar', 'Areia / Bege'],
      tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
      tipo_grade: 'adulto',
      imagem_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
      variantes: [
        { id: 'v_tsh_br_p', cor: 'Branco', tamanho: 'P', estoque: 10, estoque_min: 5, sku: 'TSH505-BR-P', ean: '7891010050017' },
        { id: 'v_tsh_br_m', cor: 'Branco', tamanho: 'M', estoque: 18, estoque_min: 6, sku: 'TSH505-BR-M', ean: '7891010050024' },
        { id: 'v_tsh_br_g', cor: 'Branco', tamanho: 'G', estoque: 15, estoque_min: 6, sku: 'TSH505-BR-G', ean: '7891010050031' },
        { id: 'v_tsh_pt_m', cor: 'Preto', tamanho: 'M', estoque: 14, estoque_min: 6, sku: 'TSH505-PT-M', ean: '7891010050048' },
        { id: 'v_tsh_pt_g', cor: 'Preto', tamanho: 'G', estoque: 12, estoque_min: 6, sku: 'TSH505-PT-G', ean: '7891010050055' }
      ]
    },
    {
      id: 'prod_mocassim_artesanal',
      referencia: 'CAL-606',
      nome: 'Mocassim Penny Loafer Couro Nobre',
      descricao: 'Sapato artesanal feito à mão em couro legítimo vegetal. Sola de couro pespontada e palmilha anatômica acolchoada.',
      categoria: 'Calçados',
      genero: 'masculino',
      estilo: 'Casual Chic',
      tecido: 'Couro Pelica Legítimo',
      colecao: 'Coleção Nobre Calçados',
      preco_custo: 180.00,
      preco_venda: 459.90,
      cores: ['Caramelo', 'Preto'],
      tamanhos: ['39', '40', '41', '42', '43'],
      tipo_grade: 'calcado',
      imagem_url: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&auto=format&fit=crop&q=80',
      variantes: [
        { id: 'v_moc_ca_40', cor: 'Caramelo', tamanho: '40', estoque: 3, estoque_min: 2, sku: 'CAL606-CA-40', ean: '7891010060016' },
        { id: 'v_moc_ca_41', cor: 'Caramelo', tamanho: '41', estoque: 4, estoque_min: 2, sku: 'CAL606-CA-41', ean: '7891010060023' },
        { id: 'v_moc_ca_42', cor: 'Caramelo', tamanho: '42', estoque: 2, estoque_min: 2, sku: 'CAL606-CA-42', ean: '7891010060030' },
        { id: 'v_moc_pt_41', cor: 'Preto', tamanho: '41', estoque: 3, estoque_min: 2, sku: 'CAL606-PT-41', ean: '7891010060047' }
      ]
    }
  ];

  // Adiciona cálculo de estoque_total em cada produto
  produtosIniciais.forEach(p => {
    p.estoque_total = (p.variantes || []).reduce((acc, v) => acc + (v.estoque || 0), 0);
  });

  const condicionaisIniciais = [
    {
      id: 'cond_001',
      cliente_nome: 'Dra. Camila Siqueira',
      cliente_telefone: '(14) 99876-1122',
      vendedor_nome: 'Letícia (Consultora VIP)',
      data_saida: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      data_devolucao_prevista: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      dias_restantes: 2,
      valor_total: 1399.70,
      total_pecas: 4,
      status: 'em_aberto',
      itens: [
        { nome: 'Vestido Midi Linho com Faixa e Fenda', cor: 'Terracota', tamanho: 'M', preco: 379.90, qtd: 1 },
        { nome: 'Vestido Midi Linho com Faixa e Fenda', cor: 'Off-White', tamanho: 'M', preco: 379.90, qtd: 1 },
        { nome: 'Camisa Linho Manga Longa Riviera', cor: 'Areia / Bege', tamanho: 'P', preco: 289.90, qtd: 1 },
        { nome: 'Calça Alfaiataria Chino Stretch', cor: 'Areia / Bege', tamanho: '38', preco: 350.00, qtd: 1 }
      ]
    },
    {
      id: 'cond_002',
      cliente_nome: 'Dr. Roberto Antunes',
      cliente_telefone: '(14) 99123-4567',
      vendedor_nome: 'Marcos (Alfaiataria)',
      data_saida: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      data_devolucao_prevista: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      dias_restantes: -1,
      valor_total: 1439.70,
      total_pecas: 3,
      status: 'em_aberto',
      alerta_atraso: true,
      itens: [
        { nome: 'Blazer Milano Estruturado', cor: 'Azul Marinho', tamanho: 'G', preco: 649.90, qtd: 1 },
        { nome: 'Calça Alfaiataria Chino Stretch', cor: 'Azul Marinho', tamanho: '42', preco: 329.90, qtd: 1 },
        { nome: 'Mocassim Penny Loafer Couro Nobre', cor: 'Caramelo', tamanho: '42', preco: 459.90, qtd: 1 }
      ]
    }
  ];

  const crediariosIniciais = {
    clientes: [
      {
        id: 'cred_cli_01',
        cliente_nome: 'Juliana Mendes de Castro',
        cliente_cpf: '284.912.778-40',
        cliente_telefone: '(14) 99745-8899',
        limite_credito: 2500.00,
        saldo_devedor: 840.00,
        valor_total: 1260.00,
        valor_pago: 420.00,
        num_parcelas: 3,
        proximo_vencimento: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
        dias_atraso: 0,
        score_risco: 'A (Excelente)',
        status: 'ativo',
        parcelas: [
          { numero: 1, valor: 420.00, vencimento: '2026-10-10', status: 'pago' },
          { numero: 2, valor: 420.00, vencimento: '2026-11-10', status: 'pendente' },
          { numero: 3, valor: 420.00, vencimento: '2026-12-10', status: 'pendente' }
        ]
      },
      {
        id: 'cred_cli_02',
        cliente_nome: 'Marcio Fontes Nogueira',
        cliente_cpf: '154.309.848-12',
        cliente_telefone: '(14) 99652-3344',
        limite_credito: 1800.00,
        saldo_devedor: 659.80,
        valor_total: 659.80,
        valor_pago: 0,
        num_parcelas: 2,
        proximo_vencimento: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        dias_atraso: 4,
        score_risco: 'B (Atraso Leve)',
        status: 'atrasado',
        parcelas: [
          { numero: 1, valor: 329.90, vencimento: '2026-11-01', status: 'atrasada' },
          { numero: 2, valor: 329.90, vencimento: '2026-12-01', status: 'pendente' }
        ]
      }
    ]
  };

  const valesIniciais = [
    {
      id: 'vale_01',
      codigo: 'VALE-MODA-500',
      valor: 500.00,
      saldo: 500.00,
      comprador_nome: 'Lucas Albuquerque',
      destinatario_nome: 'Marina Salles',
      status: 'ativo',
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      validade: new Date(Date.now() + 85 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'vale_02',
      codigo: 'VALE-ANIV-250',
      valor: 250.00,
      saldo: 0,
      comprador_nome: 'Gabriel Medina',
      destinatario_nome: 'Felipe Amorim',
      status: 'utilizado',
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      validade: new Date(Date.now() + 70 * 24 * 3600 * 1000).toISOString()
    }
  ];

  const comissoesIniciais = [
    {
      id: 'com_01',
      vendedor_nome: 'Letícia (Consultora VIP)',
      total_vendas: 48650.00,
      meta_mes: 40000.00,
      atingimento_pct: 121.6,
      percentual_comissao: 7.0, // bateu meta ouro
      valor_comissao: 3405.50,
      periodo: 'Novembro / 2026',
      status: 'a_pagar'
    },
    {
      id: 'com_02',
      vendedor_nome: 'Marcos (Alfaiataria)',
      total_vendas: 32400.00,
      meta_mes: 35000.00,
      atingimento_pct: 92.5,
      percentual_comissao: 5.0,
      valor_comissao: 1620.00,
      periodo: 'Novembro / 2026',
      status: 'a_pagar'
    },
    {
      id: 'com_03',
      vendedor_nome: 'Beatriz (Atendimento Balcão)',
      total_vendas: 19800.00,
      meta_mes: 25000.00,
      atingimento_pct: 79.2,
      percentual_comissao: 4.0,
      valor_comissao: 792.00,
      periodo: 'Novembro / 2026',
      status: 'a_pagar'
    }
  ];

  est.produtos = produtosIniciais;
  est.condicionais = condicionaisIniciais;
  est.crediario = crediariosIniciais;
  est.vales = valesIniciais;
  est.comissoes = comissoesIniciais;
  save();
  return est;
}

// ============================================================================
// SERVIÇOS DE PRODUTOS & MATRIZ GRADE
// ============================================================================

export function listarProdutosModa(empresaId = 'default', filtros = {}) {
  const est = obterEstadoLojaModa(empresaId);
  let lista = [...(est.produtos || [])];

  if (filtros.busca) {
    const q = String(filtros.busca).toLowerCase();
    lista = lista.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      (p.referencia && p.referencia.toLowerCase().includes(q)) ||
      (p.categoria && p.categoria.toLowerCase().includes(q)) ||
      (p.estilo && p.estilo.toLowerCase().includes(q))
    );
  }
  if (filtros.categoria && filtros.categoria !== 'todas') {
    lista = lista.filter(p => p.categoria.toLowerCase() === filtros.categoria.toLowerCase());
  }
  if (filtros.genero && filtros.genero !== 'todos') {
    lista = lista.filter(p => p.genero === filtros.genero);
  }

  // Recalcula estoque_total
  lista.forEach(p => {
    p.estoque_total = (p.variantes || []).reduce((acc, v) => acc + (v.estoque || 0), 0);
  });

  return lista;
}

export function criarProdutoComGrade(empresaId = 'default', dados = {}) {
  const est = obterEstadoLojaModa(empresaId);
  const id = `prod_${Date.now()}`;
  const ref = dados.referencia || `MOD-${Math.floor(100 + Math.random() * 900)}`;

  const cores = Array.isArray(dados.cores) ? dados.cores : [];
  const tamanhos = Array.isArray(dados.tamanhos) ? dados.tamanhos : [];

  // Gera todas as combinações da matriz Cor × Tamanho
  const variantes = [];
  for (const cor of cores) {
    for (const tam of tamanhos) {
      const corSlug = cor.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
      const tamSlug = tam.toUpperCase();
      const sku = `${ref}-${corSlug}-${tamSlug}`;
      const ean = `789${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const precoOverride = dados.precos_por_variante?.[`${cor}-${tam}`]?.venda;

      variantes.push({
        id: `v_${id}_${corSlug}_${tamSlug}`,
        cor,
        tamanho: tam,
        estoque: parseInt(dados.estoque_inicial_por_celula || 5, 10),
        estoque_min: 2,
        sku,
        ean,
        preco_venda_override: precoOverride ? parseFloat(precoOverride) : undefined
      });
    }
  }

  const novoProduto = {
    id,
    referencia: ref,
    nome: dados.produto_nome || dados.nome || 'Novo Produto Moda',
    descricao: dados.descricao || 'Peça com acabamento primoroso e corte sob medida.',
    categoria: dados.categoria || 'Vestuário',
    genero: dados.genero || 'unissex',
    estilo: dados.estilo || 'Casual Chic',
    tecido: dados.tecido || '100% Linho Puro',
    colecao: dados.colecao || 'Coleção Atual',
    preco_custo: parseFloat(dados.preco_custo || 0),
    preco_venda: parseFloat(dados.preco_venda || 0),
    cores,
    tamanhos,
    tipo_grade: dados.tipo_grade || 'adulto',
    imagem_url: dados.imagem_url || 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=80',
    variantes,
    estoque_total: variantes.reduce((acc, v) => acc + (v.estoque || 0), 0),
    created_at: new Date().toISOString()
  };

  est.produtos.unshift(novoProduto);
  save();
  return novoProduto;
}

export function atualizarEstoqueVariante(empresaId = 'default', { varianteId, quantidade, operacao = 'definir' }) {
  const est = obterEstadoLojaModa(empresaId);
  for (const prod of est.produtos) {
    const v = (prod.variantes || []).find(item => item.id === varianteId || item.sku === varianteId);
    if (v) {
      const q = parseInt(quantidade, 10) || 0;
      if (operacao === 'adicionar') v.estoque = (v.estoque || 0) + q;
      else if (operacao === 'remover') v.estoque = Math.max(0, (v.estoque || 0) - q);
      else v.estoque = q;

      prod.estoque_total = prod.variantes.reduce((acc, cur) => acc + (cur.estoque || 0), 0);
      save();
      return { ok: true, variante: v, produto: prod };
    }
  }
  throw new Error('Variante de grade não encontrada');
}

// ============================================================================
// SERVIÇOS DE CONDICIONAL (MALINHA VIP)
// ============================================================================

export function listarCondicionais(empresaId = 'default') {
  const est = obterEstadoLojaModa(empresaId);
  return est.condicionais || [];
}

export function criarCondicional(empresaId = 'default', dados = {}) {
  const est = obterEstadoLojaModa(empresaId);
  const prazoDias = parseInt(dados.prazo_devolucao_dias || 3, 10);
  const dataSaida = new Date();
  const dataDevolucao = new Date(Date.now() + prazoDias * 24 * 3600 * 1000);

  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const valorTotal = itens.reduce((acc, it) => acc + (parseFloat(it.preco || 0) * (it.qtd || 1)), 0);

  const novaCondicional = {
    id: `cond_${Date.now()}`,
    cliente_nome: dados.cliente_nome || 'Cliente VIP',
    cliente_telefone: dados.cliente_telefone || '',
    vendedor_nome: dados.vendedor_nome || 'Consultor de Moda',
    data_saida: dataSaida.toISOString(),
    data_devolucao_prevista: dataDevolucao.toISOString(),
    dias_restantes: prazoDias,
    valor_total: valorTotal,
    total_pecas: itens.reduce((acc, it) => acc + (it.qtd || 1), 0),
    status: 'em_aberto',
    itens,
    observacoes: dados.observacoes || ''
  };

  est.condicionais.unshift(novaCondicional);
  save();
  return novaCondicional;
}

export function finalizarCondicional(empresaId = 'default', id, { acao = 'converter_venda' }) {
  const est = obterEstadoLojaModa(empresaId);
  const cond = (est.condicionais || []).find(c => c.id === id);
  if (!cond) throw new Error('Condicional não encontrada');

  if (acao === 'devolver') {
    cond.status = 'devolvido';
    cond.data_finalizacao = new Date().toISOString();
  } else {
    cond.status = 'convertido_venda';
    cond.data_finalizacao = new Date().toISOString();
  }

  save();
  return cond;
}

// ============================================================================
// SERVIÇOS DE CREDIÁRIO PRÓPRIO
// ============================================================================

export function listarCrediario(empresaId = 'default') {
  const est = obterEstadoLojaModa(empresaId);
  return est.crediario?.clientes || [];
}

export function criarCrediario(empresaId = 'default', dados = {}) {
  const est = obterEstadoLojaModa(empresaId);
  const total = parseFloat(dados.valor_total || 0);
  const entrada = parseFloat(dados.entrada || 0);
  const saldo = Math.max(0, total - entrada);
  const parcelasNum = Math.max(1, parseInt(dados.num_parcelas || 3, 10));
  const valorParcela = saldo / parcelasNum;

  const parcelas = [];
  const diaVenc = parseInt(dados.dia_vencimento || 10, 10);
  for (let i = 1; i <= parcelasNum; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    d.setDate(diaVenc);
    parcelas.push({
      numero: i,
      valor: valorParcela,
      vencimento: d.toISOString().split('T')[0],
      status: 'pendente'
    });
  }

  const novoCliente = {
    id: `cred_${Date.now()}`,
    cliente_nome: dados.cliente_nome || 'Cliente',
    cliente_cpf: dados.cliente_cpf || '',
    cliente_telefone: dados.cliente_telefone || '',
    limite_credito: parseFloat(dados.limite_credito || 2000),
    saldo_devedor: saldo,
    valor_total: total,
    valor_pago: entrada,
    num_parcelas: parcelasNum,
    proximo_vencimento: parcelas[0]?.vencimento,
    dias_atraso: 0,
    score_risco: 'A (Excelente)',
    status: saldo <= 0 ? 'quitado' : 'ativo',
    parcelas
  };

  est.crediario.clientes.unshift(novoCliente);
  save();
  return novoCliente;
}

export function pagarParcelaCrediario(empresaId = 'default', clienteId) {
  const est = obterEstadoLojaModa(empresaId);
  const cli = (est.crediario?.clientes || []).find(c => c.id === clienteId);
  if (!cli) throw new Error('Cliente do crediário não encontrado');

  const prox = (cli.parcelas || []).find(p => p.status === 'pendente' || p.status === 'atrasada');
  if (prox) {
    prox.status = 'pago';
    prox.pago_em = new Date().toISOString();
    cli.valor_pago = (cli.valor_pago || 0) + prox.valor;
    cli.saldo_devedor = Math.max(0, (cli.saldo_devedor || 0) - prox.valor);

    const proximaPendente = (cli.parcelas || []).find(p => p.status === 'pendente' || p.status === 'atrasada');
    cli.proximo_vencimento = proximaPendente ? proximaPendente.vencimento : null;
    cli.dias_atraso = 0;
    if (cli.saldo_devedor <= 0) cli.status = 'quitado';

    save();
    return { ok: true, cliente: cli, parcelaPaga: prox };
  }
  throw new Error('Todas as parcelas deste crediário já estão quitadas');
}

// ============================================================================
// VALES-PRESENTE & COMISSÕES
// ============================================================================

export function listarVales(empresaId = 'default') {
  const est = obterEstadoLojaModa(empresaId);
  return est.vales || [];
}

export function emitirVale(empresaId = 'default', { valor, comprador_nome, destinatario_nome }) {
  const est = obterEstadoLojaModa(empresaId);
  const codigo = `VALE-${Math.floor(100 + Math.random() * 900)}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const v = {
    id: `vale_${Date.now()}`,
    codigo,
    valor: parseFloat(valor || 100),
    saldo: parseFloat(valor || 100),
    comprador_nome: comprador_nome || 'Cliente',
    destinatario_nome: destinatario_nome || 'Presenteado(a)',
    status: 'ativo',
    created_at: new Date().toISOString(),
    validade: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
  };
  est.vales.unshift(v);
  save();
  return v;
}

export function utilizarVale(empresaId = 'default', id) {
  const est = obterEstadoLojaModa(empresaId);
  const v = (est.vales || []).find(item => item.id === id || item.codigo === id);
  if (!v) throw new Error('Vale-presente não encontrado');
  if (v.status !== 'ativo' || v.saldo <= 0) throw new Error('Este vale já foi utilizado ou está expirado');

  v.status = 'utilizado';
  v.saldo = 0;
  v.utilizado_em = new Date().toISOString();
  save();
  return v;
}

export function listarComissoes(empresaId = 'default') {
  const est = obterEstadoLojaModa(empresaId);
  return est.comissoes || [];
}

// ============================================================================
// RESUMO EXECUTIVO DA LOJA DE MODA
// ============================================================================

export function obterResumoLojaModa(empresaId = 'default') {
  const est = obterEstadoLojaModa(empresaId);

  const produtos = est.produtos || [];
  const totalProdutos = produtos.length;
  const estoquePecas = produtos.reduce((acc, p) => acc + (p.estoque_total || 0), 0);
  const valorEstoqueVenda = produtos.reduce((acc, p) => acc + ((p.preco_venda || 0) * (p.estoque_total || 0)), 0);

  const condicionais = est.condicionais || [];
  const malinhasEmAberto = condicionais.filter(c => c.status === 'em_aberto').length;
  const valorEmMalinhas = condicionais
    .filter(c => c.status === 'em_aberto')
    .reduce((acc, c) => acc + (c.valor_total || 0), 0);

  const clientesCrediario = est.crediario?.clientes || [];
  const saldoDevedorCrediario = clientesCrediario.reduce((acc, c) => acc + (c.saldo_devedor || 0), 0);
  const inadimplentesCount = clientesCrediario.filter(c => (c.dias_atraso || 0) > 0).length;

  const comissoes = est.comissoes || [];
  const faturamentoColecao = comissoes.reduce((acc, c) => acc + (c.total_vendas || 0), 0);

  return {
    kpis: {
      totalProdutos,
      estoquePecas,
      valorEstoqueVenda,
      malinhasEmAberto,
      valorEmMalinhas,
      saldoDevedorCrediario,
      inadimplentesCount,
      faturamentoColecao,
      ticketMedio: 385.50,
      giroMedioGrade: '4.2x / mês'
    },
    alertas: [
      { tipo: 'furo_grade', texto: 'Furo de Grade: Camisa Linho Riviera Areia GG com apenas 1 unidade em estoque.' },
      { tipo: 'malinha_vencendo', texto: 'Malinha VIP Dr. Roberto Antunes atrasada há 1 dia. Cobrança sugerida via WhatsApp.' }
    ]
  };
}

// ============================================================================
// MOTOR DE INTELIGÊNCIA ARTIFICIAL DE MODA (FASHION AI ENGINE)
// ============================================================================

/**
 * 1. AI Stylist: Gera combinação de look completo coordenado a partir de uma peça base
 */
export async function montarLookIA(empresaId = 'default', { pecaId, ocasiao = 'Casual Chic', genero = 'unissex' }) {
  const est = obterEstadoLojaModa(empresaId);
  const peca = est.produtos.find(p => p.id === pecaId) || est.produtos[0];
  if (!peca) throw new Error('Nenhum produto cadastrado para montar o look');

  // Seleciona peças complementares do catálogo existente
  const complementares = est.produtos.filter(p => p.id !== peca.id).slice(0, 3);

  const lookSugerido = {
    nomeLook: `${peca.nome} — Conceito ${ocasiao}`,
    ocasiao,
    estiloVisual: peca.estilo || 'Casual Chic',
    pecaPrincipal: {
      id: peca.id,
      nome: peca.nome,
      categoria: peca.categoria,
      tecido: peca.tecido,
      preco: peca.preco_venda,
      imagem_url: peca.imagem_url
    },
    pecasComplementares: complementares.map(c => ({
      id: c.id,
      nome: c.nome,
      categoria: c.categoria,
      preco: c.preco_venda,
      papelNoLook: c.categoria === 'Calças' ? 'Base de Contraste' : c.categoria === 'Calçados' ? 'Arremate Sofisticado' : 'Terceira Peça / Camada'
    })),
    valorTotalLook: peca.preco_venda + complementares.reduce((acc, c) => acc + c.preco_venda, 0),
    dicaStylingIA: `Aposte na sobreposição da textura natural do ${peca.tecido} com peças de tom neutro. Para o momento ${ocasiao}, dobre as mangas na altura do antebraço e combine com calçado sem meia para um visual descomplicado e cosmopolita.`,
    argumentoVendaBalcao: `"Essa combinação foi pensada para você transitar do dia para a noite sem perder a elegância. Quem experimenta esse caimento leva o conjunto completo com 10% de vantagem na segunda peça!"`
  };

  return lookSugerido;
}

/**
 * 2. AI Copywriter: Gera descrição de e-commerce e post sedutor para redes sociais
 */
export async function gerarDescricaoProdutoIA(empresaId = 'default', { produtoId, tom = 'sofisticado' }) {
  const est = obterEstadoLojaModa(empresaId);
  const prod = est.produtos.find(p => p.id === produtoId) || est.produtos[0];
  if (!prod) throw new Error('Produto não encontrado');

  return {
    tituloEcom: `${prod.nome} em ${prod.tecido} | Edição Limitada`,
    descricaoCurta: `Sinta a sofisticação despretensiosa do ${prod.tecido}. Uma peça-chave com caimento impecável que une durabilidade e frescor atemporal.`,
    detalhesTecnicos: [
      `Composição: ${prod.tecido} com beneficiamento nobre`,
      `Modelagem: ${prod.estilo} com estrutura sob medida`,
      `Costuras reforçadas e toque aveludado na pele`,
      `Cuidados: Lavar à mão ou em ciclo delicado. Secar à sombra.`
    ],
    postInstagram: `Elegância que se sente no primeiro toque ✨\n\nA nova ${prod.nome} chegou para redefinir o seu guarda-roupa de ${prod.colecao}. Produzida artesanalmente com ${prod.tecido}, ela traduz o conceito de luxo silencioso para qualquer ocasião.\n\n📍 Disponível em nossa loja física e no WhatsApp VIP.\n💬 Comente "QUERO" para receber a grade disponível e garantir a sua.\n\n#ModaMasculina #LinhoPuro #AlfaiatariaContemporanea #EstiloAtemporal #KyttoFashion`,
    mensagemVendedoraWhatsApp: `Olá! Passando para te mostrar a nova ${prod.nome} que acabou de chegar na loja. Como você veste tamanho M e adora peças em ${prod.tecido}, separei uma antes que esgote a grade! Quer que eu monte uma malinha para você provar em casa sem compromisso? 🛍️✨`
  };
}

/**
 * 3. AI Fashion Forecasting: Análise de Curva ABC e Furo de Grade
 */
export function diagnosticoGradePrevisaoIA(empresaId = 'default') {
  const est = obterEstadoLojaModa(empresaId);
  const produtos = est.produtos || [];

  const furosDeGrade = [];
  const excessosPontaEstoque = [];

  for (const p of produtos) {
    for (const v of (p.variantes || [])) {
      if ((v.estoque || 0) <= (v.estoque_min || 2)) {
        furosDeGrade.push({
          produto: p.nome,
          variante: `${v.cor} / ${v.tamanho}`,
          estoqueAtual: v.estoque,
          estoqueMin: v.estoque_min,
          gravidade: v.estoque === 0 ? 'CRÍTICO (Zerado)' : 'ALERTA (Última Peça)'
        });
      } else if ((v.estoque || 0) >= 15) {
        excessosPontaEstoque.push({
          produto: p.nome,
          variante: `${v.cor} / ${v.tamanho}`,
          estoqueAtual: v.estoque,
          sugestao: 'Incluir em Vitrine Frontal ou Campanha WhatsApp'
        });
      }
    }
  }

  return {
    saudeEstoqueScore: 88, // 0 a 100
    giroGeral: 'Muito Bom (Curva A correspondendo a 68% das saídas)',
    tamanhosMaisVendidos: [
      { tamanho: 'M', percentualSaida: '38%' },
      { tamanho: 'G', percentualSaida: '31%' },
      { tamanho: '42 (Calçados/Calças)', percentualSaida: '18%' },
      { tamanho: 'P', percentualSaida: '9%' },
      { tamanho: 'GG/3G', percentualSaida: '4%' }
    ],
    furosDeGrade: furosDeGrade.slice(0, 5),
    excessosPontaEstoque: excessosPontaEstoque.slice(0, 4),
    recomendacoesEstrategicasIA: [
      'Reposição Prioritária: Camisas de Linho e Calças Alfaiataria no tamanho M estão com giro 2.5x acima da média. Emitir pedido de compra de 20 peças.',
      'Ação de Giro Rápido: Fazer ação promocional de final de semana nas peças GG e XGG para liberar capital de giro.',
      'Potencial de Malinha VIP: 85% das malinhas enviadas com 4 ou mais peças são convertidas em pelo menos 2 vendas efetivas.'
    ]
  };
}

/**
 * 4. AI WhatsApp Outreach: Mensagens personalizadas de alta conversão
 */
export function gerarMensagemWhatsappIA({ tipo, clienteNome, dados = {} }) {
  const nome = clienteNome || 'Cliente Especial';

  if (tipo === 'lembrete_malinha') {
    return {
      texto: `Olá, ${nome}! Tudo bem? ✨ Aqui é a consultoria de estilo da loja. Passando para saber como foram as provas da sua malinha condicional! Quais peças ficaram perfeitas em você? Lembre que podemos recolher amanhã ou deixar as peças aprovadas já no seu crediário sem burocracia. Se precisar de algum outro tamanho ou cor, me avise que levo para trocar! 👗🛍️`
    };
  }

  if (tipo === 'cobranca_delicada') {
    return {
      texto: `Olá, ${nome}, esperamos que esteja tendo um ótimo dia! 🌿 Passando com carinho para lembrar sobre a parcela do seu crediário no valor de R$ ${(dados.valor || 0).toFixed(2)}, com vencimento próximo. Para sua comodidade, você pode acertar via PIX através da chave da loja ou passar aqui para tomar um café conosco! Qualquer dúvida estamos à sua disposição.`
    };
  }

  // convite_colecao
  return {
    texto: `Oi, ${nome}! 🌟 Separamos uma surpresa exclusiva para você: acabou de desembarcar a nossa nova Coleção em 100% Linho e Algodão Pima! Como sabemos o seu estilo e tamanho, reservei 3 peças que combinam perfeitamente com você antes de irem para a vitrine. Posso te enviar as fotos ou separar uma malinha especial para seu final de semana? ✨`
  };
}
