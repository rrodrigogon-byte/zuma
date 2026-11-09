/**
 * Catálogo Oficial dos Principais Bancos do Brasil
 * Suporte a conciliação bancária, código COMPE, ISPB, máscaras e padrões de extrato.
 */

export const BANCOS_BRASIL = [
  {
    codigo: '748',
    ispb: '01181521',
    nome: 'Sicredi',
    razaoSocial: 'Banco Cooperativo Sicredi S.A.',
    tipo: 'Cooperativo / Comercial',
    cor: '#008542',
    padroesExtrato: ['SICREDI', 'BANSICREDI', 'COOP SICREDI', '748'],
    repassesCartao: ['STONE', 'CIELO', 'REDE', 'PAGSEGURO', 'GETNET', 'VERO', 'SICREDI CART']
  },
  {
    codigo: '756',
    ispb: '20301861',
    nome: 'Sicoob',
    razaoSocial: 'Banco Cooperativo Sicoob S.A.',
    tipo: 'Cooperativo',
    cor: '#003641',
    padroesExtrato: ['SICOOB', 'BANCOOB', '756'],
    repassesCartao: ['SIPAG', 'STONE', 'CIELO', 'REDE', 'PAGSEGURO']
  },
  {
    codigo: '341',
    ispb: '60701190',
    nome: 'Itaú Unibanco',
    razaoSocial: 'Itaú Unibanco S.A.',
    tipo: 'Múltiplo',
    cor: '#EC7000',
    padroesExtrato: ['ITAU', 'UNIBANCO', '341'],
    repassesCartao: ['REDE', 'REDECARD', 'STONE', 'CIELO', 'PAGSEGURO']
  },
  {
    codigo: '237',
    ispb: '60746948',
    nome: 'Bradesco',
    razaoSocial: 'Banco Bradesco S.A.',
    tipo: 'Múltiplo',
    cor: '#CC092F',
    padroesExtrato: ['BRADESCO', 'BCO BRADESCO', '237'],
    repassesCartao: ['CIELO', 'STONE', 'REDE', 'PAGSEGURO', 'GETNET']
  },
  {
    codigo: '033',
    ispb: '90400888',
    nome: 'Santander',
    razaoSocial: 'Banco Santander (Brasil) S.A.',
    tipo: 'Múltiplo',
    cor: '#EC0000',
    padroesExtrato: ['SANTANDER', 'BANCO SANTANDER', '033'],
    repassesCartao: ['GETNET', 'STONE', 'CIELO', 'REDE', 'PAGSEGURO']
  },
  {
    codigo: '001',
    ispb: '00000000',
    nome: 'Banco do Brasil',
    razaoSocial: 'Banco do Brasil S.A.',
    tipo: 'Múltiplo / Estatal',
    cor: '#FED100',
    padroesExtrato: ['BANCO DO BRASIL', 'BB', 'BCO BRASIL', '001'],
    repassesCartao: ['CIELO', 'STONE', 'REDE', 'PAGSEGURO']
  },
  {
    codigo: '104',
    ispb: '00360305',
    nome: 'Caixa Econômica',
    razaoSocial: 'Caixa Econômica Federal',
    tipo: 'Público Federal',
    cor: '#0066B3',
    padroesExtrato: ['CAIXA', 'CEF', 'CAIXA ECONOMICA', '104'],
    repassesCartao: ['CIELO', 'REDE', 'STONE', 'PAGSEGURO']
  },
  {
    codigo: '260',
    ispb: '18236120',
    nome: 'Nubank',
    razaoSocial: 'Nu Pagamentos S.A.',
    tipo: 'Instituição de Pagamento / Digital',
    cor: '#820AD1',
    padroesExtrato: ['NU PAGAMENTOS', 'NUBANK', 'NU FINANCEIRA', '260'],
    repassesCartao: ['NU PAY', 'STONE', 'MERCADO PAGO', 'PAGSEGURO']
  },
  {
    codigo: '077',
    ispb: '00416968',
    nome: 'Banco Inter',
    razaoSocial: 'Banco Inter S.A.',
    tipo: 'Múltiplo / Digital',
    cor: '#FF7A00',
    padroesExtrato: ['BANCO INTER', 'INTERMEDIUM', '077'],
    repassesCartao: ['INTER PAG', 'GRANITO', 'STONE', 'CIELO']
  },
  {
    codigo: '208',
    ispb: '30723886',
    nome: 'BTG Pactual',
    razaoSocial: 'Banco BTG Pactual S.A.',
    tipo: 'Múltiplo / Investimento',
    cor: '#001E62',
    padroesExtrato: ['BTG PACTUAL', 'BANCO BTG', '208'],
    repassesCartao: ['BTG EMPRESAS', 'STONE']
  },
  {
    codigo: '336',
    ispb: '31872495',
    nome: 'C6 Bank',
    razaoSocial: 'Banco C6 S.A.',
    tipo: 'Múltiplo / Digital',
    cor: '#242424',
    padroesExtrato: ['BANCO C6', 'C6 BANK', '336'],
    repassesCartao: ['C6 PAY', 'STONE', 'PAGSEGURO']
  },
  {
    codigo: '422',
    ispb: '58160789',
    nome: 'Banco Safra',
    razaoSocial: 'Banco Safra S.A.',
    tipo: 'Múltiplo',
    cor: '#C49A45',
    padroesExtrato: ['BANCO SAFRA', 'SAFRA', '422'],
    repassesCartao: ['SAFRAPAY', 'STONE']
  },
  {
    codigo: '041',
    ispb: '92702067',
    nome: 'Banrisul',
    razaoSocial: 'Banco do Estado do Rio Grande do Sul S.A.',
    tipo: 'Múltiplo Estadual',
    cor: '#005CA9',
    padroesExtrato: ['BANRISUL', '041'],
    repassesCartao: ['VERO', 'STONE', 'CIELO']
  }
];

/**
 * Identifica o banco brasileiro pelo código COMPE, nome ou cabeçalho do extrato OFX
 */
export function identificarBanco(termoOuCodigo) {
  if (!termoOuCodigo) return BANCOS_BRASIL[0]; // fallback Sicredi
  const busca = String(termoOuCodigo).trim().toUpperCase();

  const porCodigo = BANCOS_BRASIL.find(b => b.codigo === busca || b.ispb === busca);
  if (porCodigo) return porCodigo;

  const porPadrao = BANCOS_BRASIL.find(b => 
    b.nome.toUpperCase().includes(busca) ||
    b.razaoSocial.toUpperCase().includes(busca) ||
    b.padroesExtrato.some(p => busca.includes(p))
  );

  return porPadrao || {
    codigo: '000',
    ispb: '00000000',
    nome: termoOuCodigo,
    razaoSocial: termoOuCodigo,
    tipo: 'Outro Banco Nacional',
    cor: '#4B5563',
    padroesExtrato: [busca],
    repassesCartao: ['STONE', 'CIELO', 'REDE', 'PAGSEGURO']
  };
}

/**
 * Categoriza uma linha de extrato bancário
 */
export function categorizarLinhaBancaria(descricao, valor) {
  const d = String(descricao || '').toUpperCase();

  // Tarifas Bancárias
  if (d.includes('TAR ') || d.includes('TARIFA') || d.includes('MANUT') || d.includes('IOF') || d.includes('TAXA') || d.includes('PACOTE')) {
    return { categoria: 'Tarifas Bancárias', tipo: 'despesa', confiavel: true };
  }

  // Rendimentos de Aplicação Financeira
  if (d.includes('RENDIMENTO') || d.includes('RESGATE') || d.includes('JUROS S/ CAP') || d.includes('APLICACAO')) {
    return { categoria: 'Rendimentos Financeiros', tipo: valor >= 0 ? 'receita' : 'despesa', confiavel: true };
  }

  // Repasses de Cartões / Adquirentes
  if (d.includes('STONE') || d.includes('CIELO') || d.includes('REDE') || d.includes('REDECARD') || d.includes('PAGSEGURO') || d.includes('GETNET') || d.includes('VERO') || d.includes('MERCADOPAGO') || d.includes('SAFRAPAY')) {
    return { categoria: 'Recebimento de Cartões / TEF', tipo: 'receita', confiavel: true, adquirente: d };
  }

  // Pix Recebido ou Enviado
  if (d.includes('PIX TRANSF') || d.includes('PIX RECEB') || d.includes('PIX QR') || d.includes('PIX')) {
    return { categoria: valor >= 0 ? 'Recebimento via PIX' : 'Transferência PIX', tipo: valor >= 0 ? 'receita' : 'despesa', confiavel: true };
  }

  // Pagamento de Boletos / Fornecedores
  if (d.includes('PAGTO') || d.includes('LIQ') || d.includes('BOLETO') || d.includes('TITULO') || d.includes('CONV')) {
    return { categoria: 'Pagamento de Contas e Boletos', tipo: 'despesa', confiavel: false };
  }

  return {
    categoria: valor >= 0 ? 'Outras Entradas' : 'Outras Saídas',
    tipo: valor >= 0 ? 'receita' : 'despesa',
    confiavel: false
  };
}
