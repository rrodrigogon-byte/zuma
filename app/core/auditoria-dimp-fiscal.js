/**
 * ============================================================================
 * KYTTO ERP ENTERPRISE - MOTOR DE AUDITORIA FISCAL PREVENTIVA DIMP VS FISCAL
 * ============================================================================
 * Cruzamento eletrônico preventivo entre os meios de pagamento reais (Cartões
 * TEF/POS e Pix) e os documentos fiscais emitidos (NFC-e mod 65, NF-e mod 55
 * e NFS-e DPS Sefin Nacional) da empresa ativa.
 *
 * Base Legal: Convênio ICMS 134/2016, Ato COTEPE/ICMS 65/2018 e SEFAZ-MT.
 */

export const ADQUIRENTES_DIMP = {
  REDE: { codigo: '001', nome: 'Rede / Itaú', cnpj: '01425787000104' },
  CIELO: { codigo: '002', nome: 'Cielo S.A.', cnpj: '01027058000191' },
  STONE: { codigo: '003', nome: 'Stone Pagamentos', cnpj: '16501555000157' },
  PAGSEGURO: { codigo: '004', nome: 'PagBank / PagSeguro', cnpj: '08561701000101' },
  SICREDI: { codigo: '005', nome: 'Sicredi Cartões & Pix', cnpj: '01181521000155' },
  MERCADO_PAGO: { codigo: '006', nome: 'Mercado Pago Instituição de Pagamento', cnpj: '10573521000191' }
};

export function executarAuditoriaDimpFiscal({
  empresaId,
  mes = String(new Date().getMonth() + 1).padStart(2, '0'),
  ano = String(new Date().getFullYear()),
  transacoesMeiosPagamento = [],
  documentosFiscais = [],
  vendasSemDocumento = [],
} = {}) {
  if (!empresaId) {
    throw new Error('Identificador da empresa ativa é obrigatório para auditoria DIMP.');
  }
  const pagamentos = Array.isArray(transacoesMeiosPagamento) ? transacoesMeiosPagamento : [];
  const docsFiscais = Array.isArray(documentosFiscais) ? documentosFiscais : [];
  const pendentesReais = Array.isArray(vendasSemDocumento) ? vendasSemDocumento : [];

  const totalMeiosPagamento = Number(pagamentos.reduce((acc, p) => acc + Number(p.valor || 0), 0).toFixed(2));
  const totalCartaoCredito = Number(pagamentos.filter((p) => p.tipo === 'CARTAO_CREDITO').reduce((acc, p) => acc + Number(p.valor || 0), 0).toFixed(2));
  const totalCartaoDebito = Number(pagamentos.filter((p) => p.tipo === 'CARTAO_DEBITO').reduce((acc, p) => acc + Number(p.valor || 0), 0).toFixed(2));
  const totalPix = Number(pagamentos.filter((p) => p.tipo === 'PIX_DINAMICO' || p.tipo === 'PIX').reduce((acc, p) => acc + Number(p.valor || 0), 0).toFixed(2));

  const totalFiscalEmitido = Number(docsFiscais.reduce((acc, d) => acc + Number(d.valorTotal || 0), 0).toFixed(2));
  const totalNfce = Number(docsFiscais.filter((d) => String(d.modelo) === '65').reduce((acc, d) => acc + Number(d.valorTotal || 0), 0).toFixed(2));
  const totalNfe = Number(docsFiscais.filter((d) => String(d.modelo) === '55').reduce((acc, d) => acc + Number(d.valorTotal || 0), 0).toFixed(2));
  const totalNfse = Number(docsFiscais.filter((d) => String(d.modelo).toUpperCase().includes('NFS')).reduce((acc, d) => acc + Number(d.valorTotal || 0), 0).toFixed(2));

  const diferencaNaoFaturada = Math.max(0, Number((totalMeiosPagamento - totalFiscalEmitido).toFixed(2)));
  const percentualCobertura = totalMeiosPagamento > 0
    ? Number(Math.min(100, (totalFiscalEmitido / totalMeiosPagamento) * 100).toFixed(2))
    : (docsFiscais.length > 0 ? 100 : 0);

  let nivelRisco = 'ZERO';
  let parecerFiscal = 'Nenhuma divergência apurada no período selecionado.';
  let acaoRecomendada = 'Nenhuma ação necessária.';

  if (pagamentos.length === 0 && docsFiscais.length === 0) {
    nivelRisco = 'ZERO';
    parecerFiscal = 'Sem movimentações eletrônicas ou documentos fiscais registrados nesta competência.';
    acaoRecomendada = 'Selecione outra competência ou registre vendas na empresa ativa.';
  } else if (diferencaNaoFaturada > 5000) {
    nivelRisco = 'ALTO';
    parecerFiscal = `Divergência de R$ ${diferencaNaoFaturada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entre recebimentos eletrônicos (DIMP) e documentos fiscais emitidos.`;
    acaoRecomendada = 'Revisar individualmente cada operação pendente e emitir documento fiscal em homologação/produção conforme regime.';
  } else if (diferencaNaoFaturada > 0) {
    nivelRisco = 'MEDIO';
    parecerFiscal = `Diferença de R$ ${diferencaNaoFaturada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entre pagamentos eletrônicos e notas emitidas.`;
    acaoRecomendada = 'Conferir vendas sem documento fiscal vinculado na competência.';
  } else {
    nivelRisco = 'ZERO';
    parecerFiscal = 'Recebimentos eletrônicos (Cartão e Pix) conciliados com os documentos fiscais emitidos no período.';
    acaoRecomendada = 'Competência conciliada para escrituração fiscal.';
  }

  const resumoAdquirentes = Object.keys(ADQUIRENTES_DIMP).map((key) => {
    const adq = ADQUIRENTES_DIMP[key];
    const transAdq = pagamentos.filter((p) => String(p.adquirente || '').toUpperCase() === key);
    const totalAdq = Number(transAdq.reduce((acc, p) => acc + Number(p.valor || 0), 0).toFixed(2));
    return {
      chave: key,
      nome: adq.nome,
      cnpj: adq.cnpj,
      quantidadeTransacoes: transAdq.length,
      valorTotal: totalAdq,
    };
  }).filter((a) => a.quantidadeTransacoes > 0);

  return {
    sucesso: true,
    semDados: pagamentos.length === 0 && docsFiscais.length === 0,
    empresaId,
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    ambientePadrao: 2,
    ambienteDescricao: 'Homologação (tpAmb=2)',
    dataAuditoria: new Date().toISOString(),
    totaisMeiosPagamento: {
      totalGeral: totalMeiosPagamento,
      cartaoCredito: totalCartaoCredito,
      cartaoDebito: totalCartaoDebito,
      pix: totalPix,
      quantidadeTransacoes: pagamentos.length,
    },
    totaisDocumentosFiscais: {
      totalGeral: totalFiscalEmitido,
      nfce: totalNfce,
      nfe: totalNfe,
      nfse: totalNfse,
      quantidadeDocumentos: docsFiscais.length,
    },
    analiseDivergencia: {
      diferencaNaoFaturada,
      percentualCobertura,
      nivelRisco,
      parecerFiscal,
      acaoRecomendada,
    },
    resumoAdquirentes,
    vendasPendentesEmissao: pendentesReais,
    podeRegularizarEmLote: false,
  };
}

export function regularizarPendenciasDimp({ empresaId, itensRegularizar = [], tpAmb = 2 } = {}) {
  if (!empresaId) {
    throw new Error('Empresa ativa é obrigatória.');
  }
  if (!Array.isArray(itensRegularizar) || itensRegularizar.length !== 1) {
    throw new Error('Apenas 1 item pode ser regularizado por confirmação individual.');
  }
  const item = itensRegularizar[0];
  const ambiente = Number(tpAmb) === 1 ? 1 : 2;
  if (ambiente === 1) {
    throw new Error('Emissão direta na tela DIMP permitida apenas em ambiente de Homologação (tpAmb=2).');
  }
  const valor = Number(item.valorFaltante || item.valor || 0);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe o valor positivo do documento pendente.');
  const validacao = {
    idVenda: item.idVenda || item.id || null,
    nsu: item.nsu || null,
    modelo: item.codigoServico ? 'NFS-e' : '65',
    tipo: item.codigoServico ? 'NFS-e DPS (Homologação)' : 'NFC-e (Homologação)',
    tpAmb: 2,
    valor,
    status: 'VALIDACAO_LOCAL',
    registradoEm: new Date().toISOString(),
  };

  return {
    sucesso: true,
    tpAmb: 2,
    ambiente: 'homologacao',
    mensagem: 'Validação local concluída. A operação continua pendente de emissão no módulo fiscal.',
    totalRegularizado: 0,
    quantidadeNotasEmitidas: 0,
    notasEmitidas: [],
    validacao,
  };
}
