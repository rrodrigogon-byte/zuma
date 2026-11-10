/**
 * ============================================================================
 * KYTTO ENTERPRISE ERP - MOTOR DE VAREJO MULTICANAL & GRADE MULTIDIMENSIONAL
 * Módulo: app/core/varejo-grade-multicanal.js
 * 
 * Funcionalidades homologadas:
 * 1. Grade Multidimensional de Produtos (SKU Pai e Variações de Sabores / Tamanhos)
 * 2. Tabela de Preços Diferenciada por Canal (Loja Física, E-commerce, Atacado B2B)
 * 3. Gestão e Emissão de Devolução de Vendas com Chave Referenciada (CFOP 1.202)
 * ============================================================================
 */

export function criarProdutoComGrade({
  nome = 'Whey Protein 100% Concentrado',
  marca = 'Stallone Nutrition',
  categoria = 'Suplementos',
  ncm = '2106.90.90',
  codigoPai = 'STL-WHEY-100',
  variacoes = [
    { atributo1: 'Chocolate Belga', atributo2: '900g', precoLoja: 149.90, precoEcommerce: 139.90, precoAtacado: 115.00, estoque: 25 },
    { atributo1: 'Baunilha Cream', atributo2: '900g', precoLoja: 149.90, precoEcommerce: 139.90, precoAtacado: 115.00, estoque: 18 },
    { atributo1: 'Morango Silvestre', atributo2: '900g', precoLoja: 149.90, precoEcommerce: 139.90, precoAtacado: 115.00, estoque: 14 },
    { atributo1: 'Chocolate Belga', atributo2: '1.8kg', precoLoja: 269.90, precoEcommerce: 249.90, precoAtacado: 210.00, estoque: 12 },
    { atributo1: 'Baunilha Cream', atributo2: '1.8kg', precoLoja: 269.90, precoEcommerce: 249.90, precoAtacado: 210.00, estoque: 8 }
  ]
}) {
  const skusFilhos = variacoes.map((v, idx) => {
    const slug1 = v.atributo1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug2 = v.atributo2.toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      sku: `${codigoPai}-${slug1}-${slug2}`.toUpperCase(),
      nomeCompleto: `${nome} - ${v.atributo1} (${v.atributo2})`,
      sabor: v.atributo1,
      tamanhoPeso: v.atributo2,
      precos: {
        lojaFisica: v.precoLoja,
        ecommerce: v.precoEcommerce,
        atacadoB2B: v.precoAtacado
      },
      estoqueFisico: v.estoque,
      custoMedio: Number((v.precoAtacado * 0.70).toFixed(2))
    };
  });

  return {
    codigoPai,
    nome,
    marca,
    categoria,
    ncm,
    totalVariacoes: skusFilhos.length,
    estoqueTotalPai: skusFilhos.reduce((acc, s) => acc + s.estoqueFisico, 0),
    skus: skusFilhos
  };
}

/**
 * Cria payload para Emissão de Nota de Devolução de Venda referenciando a NF-e/NFC-e original
 */
export function gerarPayloadNotaDevolucao({
  chaveAcessoOriginal = '',
  numeroNfOriginal = '1042',
  motivoDevolucao = 'Troca de sabor/tamanho pelo cliente',
  cliente = { nome: 'Rodrigo Gonçalves', documento: '000.000.000-00' },
  itensDevolvidos = [
    { sku: 'STL-WHEY-100-CHOCOLATEBELGA-900G', descricao: 'Whey Protein Chocolate 900g', quantidade: 1, valorUnitario: 149.90 }
  ]
}) {
  if (!chaveAcessoOriginal || chaveAcessoOriginal.replace(/\D/g, '').length !== 44) {
    throw new Error('A chave de acesso da nota original deve conter exatamente 44 dígitos numéricos.');
  }

  const vTotal = itensDevolvidos.reduce((acc, i) => acc + (i.quantidade * i.valorUnitario), 0);

  return {
    naturezaOperacao: 'DEVOLUCAO DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS',
    cfop: '1.202',
    tipoDocumento: 0, // Entrada (Devolução para a empresa)
    finalidade: 4, // 4 = NF-e de Devolução
    documentoReferenciado: {
      tipo: 'NFe',
      chaveAcessoReferenciada: chaveAcessoOriginal.replace(/\D/g, ''),
      numeroNotaOriginal: numeroNfOriginal
    },
    dadosCliente: cliente,
    motivoDevolucao,
    itens: itensDevolvidos.map((it, idx) => ({
      numeroItem: idx + 1,
      sku: it.sku,
      descricao: it.descricao,
      cfop: '1.202',
      ncm: '2106.90.90',
      quantidade: it.quantidade,
      valorUnitario: it.valorUnitario,
      valorTotal: Number((it.quantidade * it.valorUnitario).toFixed(2))
    })),
    valorTotalDevolucao: Number(vTotal.toFixed(2)),
    acaoEstoque: 'RETORNO_AUTOMATICO_AO_ESTOQUE_FISICO',
    acaoFinanceiro: 'GERAR_CREDITO_OU_ESTORNO_CAIXA'
  };
}
