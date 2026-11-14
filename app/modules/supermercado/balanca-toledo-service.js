/**
 * ============================================================================
 * KYTTO ERP · MÓDULO SUPERMERCADO: PROTOCOLO SERIAL BALANÇA TOLEDO PRIX 3 FIT
 * ============================================================================
 * Driver de comunicação serial RS-232 / USB e emulador para balanças de checkout.
 * Compatível com protocolos Toledo Prt 1, Prix 3 Fit, Prix 3 Plus e Filizola.
 */

export const PROTOCOLOS_HOMOLOGADOS = [
  'Toledo Prt 1 (Prix 3 Fit / 3 Plus)',
  'Toledo Prt 3 (Contínuo)',
  'Filizola CS / BP / Platina',
  'Urano Pop-Z'
];

/**
 * Decodifica o frame recebido da balança Toledo Prix 3 Fit
 * Formato padrão Prt 1: [STX] [5 dígitos peso] [ETX] ou [STX] [Status] [Peso] [ETX]
 */
export function decodificarFrameToledo(frameString) {
  if (!frameString || typeof frameString !== 'string') {
    throw new Error('Frame serial inválido ou vazio.');
  }

  // Limpar caracteres de controle
  const limpo = frameString.replace(/[\x02\x03\r\n]/g, '').trim();

  // Expressão regular para capturar peso com ponto ou dígitos contínuos
  let pesoKg = 0.0;
  let estavel = true;

  if (limpo.includes('.')) {
    const match = limpo.match(/(\d+\.\d{3})/);
    if (match) pesoKg = parseFloat(match[1]);
  } else {
    // 5 dígitos inteiros em gramas (ex: "01250" -> 1.250 kg)
    const matchDigitos = limpo.match(/(\d{4,6})/);
    if (matchDigitos) {
      const gramas = parseInt(matchDigitos[1], 10);
      pesoKg = gramas / 1000.0;
    }
  }

  // Verificar se a leitura é estável ou se balança está oscilando
  if (frameString.includes('?') || frameString.includes('U') || pesoKg < 0) {
    estavel = false;
  }

  return {
    pesoKg: Number(pesoKg.toFixed(3)),
    estavel,
    unidade: 'kg',
    bruto: limpo
  };
}

/**
 * Calcula o preço de venda de um item pesado no checkout
 */
export function calcularItemPesado(produto, pesoKg, taraKg = 0.0) {
  if (!produto || typeof produto !== 'object') {
    throw new Error('Produto não informado para pesagem.');
  }

  const pesoLiquido = Math.max(0, pesoKg - taraKg);
  const precoKg = Number(produto.precoVenda || produto.preco || 0.0);
  const valorTotal = Number((pesoLiquido * precoKg).toFixed(2));

  return {
    produtoId: produto.id,
    produtoNome: produto.nome,
    codigoBarras: produto.codigoBarras || produto.ean || 'PESAVEL',
    pesoBrutoKg: Number(pesoKg.toFixed(3)),
    taraKg: Number(taraKg.toFixed(3)),
    pesoLiquidoKg: Number(pesoLiquido.toFixed(3)),
    precoPorKg: precoKg,
    valorTotal,
    timestamp: new Date().toISOString()
  };
}

/**
 * Emulador de leitura de balança Toledo para testes de bancada ou modo sem hardware
 */
export function emularLeituraBalancaToledo(pesoSimuladoKg = 1.450) {
  const gramasStr = String(Math.round(pesoSimuladoKg * 1000)).padStart(5, '0');
  const frameEmulado = `\x02${gramasStr}\x03`;
  const decodificado = decodificarFrameToledo(frameEmulado);

  return {
    sucesso: true,
    protocolo: 'Toledo Prt 1 (Prix 3 Fit)',
    frameHex: Buffer.from(frameEmulado, 'ascii').toString('hex'),
    leitura: decodificado
  };
}
