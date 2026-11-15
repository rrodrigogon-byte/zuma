import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMITENTE_STALLONE,
  calcularModulo11,
  gerarChaveAcesso,
  gerarQrCodeUrlNfce,
  gerarQrCodeSvg,
  calcularTributosItem,
  montarXmlNFe,
  gerarDanfeHtmlStallone,
  gerarXmlStallone,
  emitirNotaFiscalStallone,
  listarNotasFiscaisStallone,
  obterNotaFiscalPorIdOuChave,
  cancelarNotaFiscalStallone,
  consultarStatusSefazMt
} from './emissao-fiscal-stallone.js';

test('1. Emitente Oficial Stallone Nutre Sport: conformidade cadastral e fiscal SEFAZ-MT', () => {
  assert.equal(EMITENTE_STALLONE.cnpj, '56099531000138');
  assert.equal(EMITENTE_STALLONE.cnpjFormatado, '56.099.531/0001-38');
  assert.equal(EMITENTE_STALLONE.ie, '134567890');
  assert.equal(EMITENTE_STALLONE.ieFormatada, '13.456.789-0');
  assert.equal(EMITENTE_STALLONE.crt, '1'); // Simples Nacional
  assert.equal(EMITENTE_STALLONE.codigoMunicipio, '5107958'); // Tangará da Serra/MT
  assert.equal(EMITENTE_STALLONE.uf, 'MT');
  assert.equal(EMITENTE_STALLONE.codigoUf, '51');
});

test('2. Algoritmo Módulo 11 da SEFAZ e Chave de Acesso Oficial de 44 Dígitos', () => {
  // Teste de cálculo do DV
  const base43 = '5126115609953100013865001000001042123456789';
  const dv = calcularModulo11(base43);
  assert.ok(typeof dv === 'number' && dv >= 0 && dv <= 9);

  // Geração de chave de acesso NFC-e 65
  const chaveNfce = gerarChaveAcesso({
    uf: '51',
    dhEmi: '2026-11-15T15:00:00-04:00',
    cnpj: EMITENTE_STALLONE.cnpj,
    modelo: '65',
    serie: 1,
    nNF: 1045,
    tpEmis: 1,
    cNF: 12345678
  });
  assert.equal(chaveNfce.length, 44);
  assert.ok(chaveNfce.startsWith('51')); // MT
  assert.ok(chaveNfce.includes('56099531000138')); // CNPJ
  assert.equal(chaveNfce.slice(20, 22), '65'); // Modelo NFC-e

  // Geração de chave de acesso NF-e 55
  const chaveNfe = gerarChaveAcesso({
    uf: '51',
    dhEmi: '2026-11-15T15:00:00-04:00',
    cnpj: EMITENTE_STALLONE.cnpj,
    modelo: '55',
    serie: 1,
    nNF: 220,
    tpEmis: 1,
    cNF: 87654321
  });
  assert.equal(chaveNfe.length, 44);
  assert.equal(chaveNfe.slice(20, 22), '55'); // Modelo NF-e
});

test('3. QR Code Oficial SEFAZ-MT Versão 2.0 e Geração SVG para Cupom Térmico', async () => {
  const chave = '51261156099531000138650010000010451123456789';
  const qrUrl = gerarQrCodeUrlNfce({
    chave,
    valorTotal: 299.90,
    cDest: '04589211190'
  });

  assert.ok(qrUrl.startsWith('http://www.sefaz.mt.gov.br/nfce/consultanfce?p='));
  assert.ok(qrUrl.includes(chave));
  assert.ok(qrUrl.includes('299.90'));

  const svg = await gerarQrCodeSvg(qrUrl);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
});

test('4. Cálculo Tributário de Suplementos: Simples Nacional e IBPT (Lei 12.741/2012)', () => {
  const item = {
    nome: '100% Pure Whey Pro 900g',
    quantidade: 2,
    preco: 189.90,
    ncm: '21069090'
  };

  const trib = calcularTributosItem(item);
  assert.equal(trib.valorTotal, 379.80);
  assert.equal(trib.ncm, '21069090');
  assert.equal(trib.csosn, '102');
  assert.equal(trib.cfop, '5102');
  assert.ok(trib.ibpt.valorTotal > 0);
  assert.ok(trib.ibpt.valorFederal > 0);
  assert.ok(trib.ibpt.valorEstadual > 0);
});

test('5. Emissão Completa de NFC-e Balcão / PDV para Stallone Nutre Sport', async () => {
  const nota = await emitirNotaFiscalStallone({
    modelo: '65',
    origem: 'pdv_balcao',
    destinatario: { cpf: '045.892.111-90', nome: 'Atleta Fisiculturista' },
    itens: [
      { codigo: 'WHEY-01', nome: '100% Pure Whey Pro 900g', quantidade: 1, preco_unitario: 189.90, ncm: '21069090' },
      { codigo: 'CREAT-02', nome: 'Creatina Creapure 300g', quantidade: 1, preco_unitario: 115.00, ncm: '21069090' }
    ],
    total: 304.90,
    forma_pagamento: 'pix',
    usuario: 'Silvester Natal'
  });

  assert.ok(nota.id);
  assert.equal(nota.modelo, '65');
  assert.equal(nota.status, 'autorizada');
  assert.equal(nota.chaveAcesso.length, 44);
  assert.ok(nota.protocolo.startsWith('1512600'));
  assert.equal(nota.total, 304.90);
  assert.ok(nota.qrCodeUrl.includes('sefaz.mt.gov.br'));
  assert.ok(nota.xml.includes('<NFe'));
  assert.ok(nota.xml.includes('<protNFe'));
  assert.ok(nota.xml.includes('100% Pure Whey Pro 900g'));
});

test('6. Emissão de NF-e Modelo 55 para Faturamento e E-commerce', async () => {
  const nota = await emitirNotaFiscalStallone({
    modelo: '55',
    origem: 'ecommerce_faturamento',
    destinatario: { cnpj: '11.222.333/0001-44', nome: 'Academia Corpo & Movimento Ltda' },
    itens: [
      { codigo: 'ISO-01', nome: 'Iso Hydro Whey 900g', quantidade: 3, preco_unitario: 260.00, ncm: '21069090' }
    ],
    total: 780.00,
    forma_pagamento: 'cartao_credito',
    usuario: 'Faturamento E-commerce'
  });

  assert.equal(nota.modelo, '55');
  assert.equal(nota.chaveAcesso.slice(20, 22), '55');
  assert.equal(nota.status, 'autorizada');
  assert.equal(nota.total, 780.00);
});

test('7. Emissão em Contingência Offline (Tipo de Emissão 9)', async () => {
  const nota = await emitirNotaFiscalStallone({
    modelo: '65',
    origem: 'pdv_balcao',
    contingencia: true,
    justificativa: 'FALHA DE COMUNICACAO PROVEDOR SEFAZ MT',
    itens: [
      { codigo: 'PRE-01', nome: 'Pre-Workout C4 Ultimate', quantidade: 1, preco_unitario: 145.00 }
    ],
    total: 145.00,
    forma_pagamento: 'dinheiro'
  });

  assert.equal(nota.status, 'contingencia');
  assert.equal(nota.contingencia, true);
  assert.equal(nota.chaveAcesso.slice(34, 35), '9'); // tpEmis = 9
  assert.ok(nota.xml.includes('<tpEmis>9</tpEmis>'));
  assert.ok(nota.xml.includes('<dhCont>'));
});

test('8. Geração e Formatação da DANFE Térmica (80mm) em HTML', async () => {
  const lista = listarNotasFiscaisStallone();
  assert.ok(lista.notas.length > 0);
  const primeira = lista.notas[0];

  const htmlDanfe = await gerarDanfeHtmlStallone(primeira.id);
  assert.ok(htmlDanfe.includes('<!DOCTYPE html>'));
  assert.ok(htmlDanfe.includes('STALLONE NUTRE SPORT LTDA'));
  assert.ok(htmlDanfe.includes('56.099.531/0001-38'));
  assert.ok(htmlDanfe.includes('DANFE NFC-e'));
  assert.ok(htmlDanfe.includes(primeira.protocolo));
  assert.ok(htmlDanfe.includes('www.sefaz.mt.gov.br/nfce/consultanfce'));
});

test('9. Geração e Extração do XML Oficial da Nota', () => {
  const lista = listarNotasFiscaisStallone();
  const primeira = lista.notas[0];
  const xml = gerarXmlStallone(primeira.id);

  assert.ok(xml.startsWith('<?xml'));
  assert.ok(xml.includes('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">'));
  assert.ok(xml.includes('<emit>'));
  assert.ok(xml.includes('56099531000138'));
  assert.ok(xml.includes('</NFe>'));
});

test('10. Cancelamento de Documento Fiscal com Justificativa SEFAZ', () => {
  const lista = listarNotasFiscaisStallone({ status: 'autorizada' });
  const notaParaCancelar = lista.notas[0];

  // Deve rejeitar justificativa com menos de 15 caracteres
  assert.throws(() => {
    cancelarNotaFiscalStallone({
      idOuChave: notaParaCancelar.id,
      justificativa: 'Erro de digit'
    });
  }, /mínimo 15 caracteres/);

  // Cancelamento regular
  const resCancelamento = cancelarNotaFiscalStallone({
    idOuChave: notaParaCancelar.id,
    justificativa: 'Cancelamento solicitado pelo consumidor no caixa por desistência da compra.',
    usuario: 'Silvester Natal'
  });

  assert.equal(resCancelamento.sucesso, true);
  assert.ok(resCancelamento.protocoloCancelamento.startsWith('1512699'));
  assert.equal(resCancelamento.nota.status, 'cancelada');
});

test('11. Status do Monitor da SEFAZ-MT e Métricas Executivas', () => {
  const statusSefaz = consultarStatusSefazMt();
  assert.equal(statusSefaz.sucesso, true);
  assert.equal(statusSefaz.uf, 'MT');
  assert.equal(statusSefaz.status, 'OPERACIONAL');

  const resumo = listarNotasFiscaisStallone();
  assert.ok(resumo.metricas.totalFaturado > 0);
  assert.ok(resumo.metricas.qtdAutorizadas >= 0);
  assert.ok(resumo.metricas.ticketMedio > 0);
});
