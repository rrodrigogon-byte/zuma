import assert from 'node:assert/strict';
import forge from 'node-forge';
import {
  construirQrCodeNfce,
  verificarSchemaOficial,
  validarXmlFiscal,
  montarXmlFiscalV400,
  resolverMeioPagamento,
  assinarXmlFiscal,
  verificarAssinaturaXmlFiscal,
} from './fiscal-xml-kytto.js';
import { gerarChaveAcessoFiscal } from './fiscal-kytto.js';
import { totalizarDocumentoFiscal } from './tributacao-kytto.js';

let total = 0;
function test(nome, fn) {
  try {
    fn();
    total += 1;
    console.log(`✓ ${nome}`);
  } catch (error) {
    console.error(`✗ ${nome}: ${error.message}`);
    process.exitCode = 1;
  }
}

const config = {
  cnpj: '13246882000111', ie: '123456789', razaoSocial: 'Florescer Ação Social', nomeFantasia: 'Kytto Bar',
  uf: 'MT', crt: '1', regimeTributario: 'simples', ambiente: 'homologacao',
  serieNfce: 1, naturezaOperacaoNfce: 'VENDA DE MERCADORIA',
  endereco: { logradouro: 'Rua das Flores', numero: '100', bairro: 'Centro', cidade: 'Cuiabá', codigoMunicipio: '5103403', cep: '78000000' },
};
const chave = gerarChaveAcessoFiscal({ uf: 'MT', dhEmi: '2026-08-09T18:00:00-04:00', cnpj: config.cnpj, modelo: '65', serie: 1, numero: 1, tpEmis: 1, codigoNumerico: '12345678' });
const itemBase = {
  produtoId: 'cerveja-001', descricao: 'Cerveja Nacional Lata', quantidade: 2, valorUnitario: 10,
  fiscal: { ncm: '22030000', cfop: '5102', origem: '0', unidadeTributavel: 'UN', csosn: '102', cstPis: '49', cstCofins: '49' },
};
const calculo = totalizarDocumentoFiscal([itemBase], { regimeTributario: 'simples', exigirNcm: true });
const itemCalculado = calculo.itens[0];

function gerarA1DeTeste() {
  const password = 'senha-de-teste-a1';
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: 'Kytto Fiscal Teste' }];
  cert.setSubject(attrs); cert.setIssuer(attrs); cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' });
  return { pfx: Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'), password, certificate: forge.pki.certificateToPem(cert) };
}

function montarBase(overrides = {}) {
  return montarXmlFiscalV400({
    config, modelo: '65', numero: 1, serie: 1, chaveAcesso: chave, codigoNumerico: '12345678',
    dataEmissao: '2026-08-09T18:00:00-04:00', itens: [itemCalculado], totais: calculo.totais,
    pagamentos: [{ meio: 'dinheiro', valor: calculo.totais.valorTotal }],
    qrCodeUrl: 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode',
    urlChave: 'https://www.sefaz.mt.gov.br/nfce/consultanfce',
    ...overrides,
  });
}

test('reconhece o pacote oficial de schemas e confirma sua integridade SHA-256', () => {
  const schema = verificarSchemaOficial();
  assert.equal(schema.instalado, true);
  assert.match(schema.schemaPath, /nfe_v4\.00\.xsd$/);
});

test('mapeia meios de pagamento usados pelo PDV para códigos fiscais nacionais', () => {
  assert.equal(resolverMeioPagamento('PIX'), '17');
  assert.equal(resolverMeioPagamento('cartao credito'), '03');
  assert.equal(resolverMeioPagamento('dinheiro'), '01');
});

test('gera QR Code NFC-e v3 online segundo o padrão chave|3|tpAmb', () => {
  const qr = construirQrCodeNfce({ chaveAcesso: chave, ambiente: 'homologacao', urlBase: 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode', versao: '3' });
  assert.match(qr, new RegExp(`p=${chave}\\|3\\|2$`));
});

test('bloqueia QR Code NFC-e v3 offline sem assinatura do certificado', () => {
  assert.throws(() => construirQrCodeNfce({ chaveAcesso: chave, ambiente: 'homologacao', urlBase: 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode', versao: '3', contingencia: true }), /assinatura offline/);
});

test('monta NFC-e 4.00 em XML com chave, itens, totais, pagamento e QR v3', () => {
  const xml = montarBase();
  assert.match(xml, new RegExp(`Id="NFe${chave}"`));
  assert.match(xml, /<ICMSSN102>/);
  assert.match(xml, /<PISOutr>/);
  assert.match(xml, /<qrCode>https:\/\/homologacao\.sefaz\.mt\.gov\.br\/nfce\/qrcode\?p=/);
  assert.match(xml, /<tPag>01<\/tPag>/);
});

test('assina a NFC-e com XMLDSig e valida o resultado contra o XSD oficial instalado', () => {
  const material = gerarA1DeTeste();
  const assinado = assinarXmlFiscal(montarBase(), material);
  const assinatura = verificarAssinaturaXmlFiscal(assinado.xml, material.certificate);
  const validacao = validarXmlFiscal(assinado.xml);
  assert.equal(assinatura.valida, true, assinatura.erros.join(' | '));
  assert.equal(validacao.estrutura.valido, true, validacao.estrutura.erros.join(' | '));
  assert.equal(validacao.xsd.valido, true, validacao.xsd.erros.join(' | '));
});

test('monta, assina e valida NF-e modelo 55 com destinatário identificado', () => {
  const chaveNfe = gerarChaveAcessoFiscal({ uf: 'MT', dhEmi: '2026-08-09T18:00:00-04:00', cnpj: config.cnpj, modelo: '55', serie: 1, numero: 1, tpEmis: 1, codigoNumerico: '87654321' });
  const material = gerarA1DeTeste();
  const xml = montarXmlFiscalV400({
    config: { ...config, naturezaOperacaoNfe: 'VENDA DE MERCADORIA' }, modelo: '55', numero: 1, serie: 1, chaveAcesso: chaveNfe, codigoNumerico: '87654321',
    dataEmissao: '2026-08-09T18:00:00-04:00', itens: [itemCalculado], totais: calculo.totais,
    pagamentos: [{ meio: 'dinheiro', valor: calculo.totais.valorTotal }],
    destinatario: { cnpj: '13246882000111', nome: 'Destinatário de Teste', indIEDest: '9', endereco: { logradouro: 'Avenida Brasil', numero: '200', bairro: 'Centro', cidade: 'Cuiabá', uf: 'MT', codigoMunicipio: '5103403', cep: '78000000' } },
  });
  const assinado = assinarXmlFiscal(xml, material);
  const validacao = validarXmlFiscal(assinado.xml);
  assert.match(assinado.xml, /<mod>55<\/mod>/);
  assert.equal(validacao.xsd.valido, true, validacao.xsd.erros.join(' | '));
});

test('bloqueia total de pagamentos inferior ao valor fiscal do documento', () => {
  assert.throws(() => montarBase({ pagamentos: [{ meio: 'dinheiro', valor: 1 }] }), /menor que o valor total/);
});

test('bloqueia item sem NCM em vez de criar XML fiscal inválido', () => {
  const invalido = { ...itemCalculado, fiscal: { ...itemCalculado.fiscal, ncm: '' } };
  assert.throws(() => montarBase({ itens: [invalido] }), /NCM válido/);
});

if (!process.exitCode) console.log(`\n✅ Camada XML fiscal: ${total} testes passaram`);
process.exit(process.exitCode || 0);
