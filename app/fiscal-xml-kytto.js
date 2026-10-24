import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import forge from 'node-forge';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { validarChaveAcessoFiscal } from './fiscal-kytto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';
const SCHEMA_ROOT = path.join(__dirname, 'fiscal-schemas');
const SCHEMA_MANIFEST = path.join(SCHEMA_ROOT, 'PL_010b_NT2025_002_v1.30.manifest.json');
const QR_VERSAO_ATUAL = '3';

const MEIO_PAGAMENTO = Object.freeze({
  dinheiro: '01', cheque: '02', cartao_credito: '03', credito: '03', cartao_debito: '04', debito: '04',
  credito_loja: '05', vale_alimentacao: '10', vale_refeicao: '11', vale_presente: '12', vale_combustivel: '13',
  duplicata: '14', boleto: '15', deposito: '16', pix: '17', transferencia: '18', fidelidade: '19',
  sem_pagamento: '90', outros: '99',
});

function text(value, max = 600) {
  return String(value ?? '').trim().slice(0, max);
}

function digits(value, max = null) {
  const valueDigits = String(value ?? '').replace(/\D/g, '');
  return max ? valueDigits.slice(0, max) : valueDigits;
}

function number(value, fallback = 0) {
  const converted = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(converted) ? converted : fallback;
}

function money(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}

function decimal(value, places) {
  return number(value).toFixed(places);
}

function xml(value) {
  return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function tag(name, value, { optional = false, raw = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return '';
  return `<${name}>${raw ? String(value ?? '') : xml(value)}</${name}>`;
}

function normalizarModelo(value) {
  const modelo = String(value || '65');
  if (!['55', '65'].includes(modelo)) throw new Error('O modelo fiscal deve ser 55 (NF-e) ou 65 (NFC-e).');
  return modelo;
}

function diaEmissao(value) {
  // dhEmi vem com o fuso local (ex.: 2026-10-23T21:00:00-04:00): o dia é o local, não o UTC
  const local = String(value ?? '').match(/^\d{4}-\d{2}-(\d{2})T/);
  if (local) return local[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error('Data de emissão inválida.');
  return String(parsed.getUTCDate()).padStart(2, '0');
}

export function agoraFiscalCuiaba(date = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}-04:00`;
}

export function resolverMeioPagamento(value) {
  const candidate = String(value ?? '').trim().toLowerCase();
  if (/^\d{2}$/.test(candidate)) return candidate;
  const normalized = candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
  return MEIO_PAGAMENTO[normalized] || '99';
}

/**
 * Conteúdo assinado no QR Code v3 de contingência offline (tpEmis=9): os sete primeiros
 * parâmetros do QR, separados por "|" (chave|3|tpAmb|dia|vNF|tpIdDest|idDest). A assinatura
 * (RSA-SHA1 com a chave do certificado A1, em Base64) vai como oitavo parâmetro.
 */
export function conteudoQrCodeOfflineV3({ chaveAcesso, ambiente = 'homologacao', dataEmissao, valorTotal = 0, identificacaoDestinatario = '' } = {}) {
  const chave = digits(chaveAcesso);
  const identificacao = digits(identificacaoDestinatario, 14);
  const tipoIdentificacao = identificacao.length === 11 ? '1' : identificacao.length === 14 ? '2' : '';
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  return `${chave}|3|${tpAmb}|${diaEmissao(dataEmissao)}|${decimal(valorTotal, 2)}|${tipoIdentificacao}|${tipoIdentificacao ? identificacao : ''}`;
}

export function construirQrCodeNfce({ chaveAcesso, ambiente = 'homologacao', urlBase, versao = QR_VERSAO_ATUAL, contingencia = false, valorTotal = 0, dataEmissao = new Date(), identificacaoDestinatario = '', assinaturaOfflineBase64 = '', cscId = '', csc = '' } = {}) {
  const chave = digits(chaveAcesso);
  if (!validarChaveAcessoFiscal(chave)) throw new Error('A chave de acesso deve ter 44 dígitos e DV válido para gerar o QR Code.');
  if (!/^https?:\/\//i.test(String(urlBase || ''))) throw new Error('Informe a URL oficial de consulta QR Code da UF.');
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const separator = String(urlBase).includes('?') ? '&' : '?';
  const url = `${urlBase}${separator}p=`;

  if (String(versao) === '3' && !contingencia) {
    // NT 2025.001 — padrão online: chave|3|tpAmb.
    return `${url}${chave}|3|${tpAmb}`;
  }

  if (String(versao) === '3' && contingencia) {
    if (!assinaturaOfflineBase64) throw new Error('QR Code v3 em contingência exige assinatura offline do certificado A1.');
    return `${url}${conteudoQrCodeOfflineV3({ chaveAcesso: chave, ambiente, dataEmissao, valorTotal, identificacaoDestinatario })}|${assinaturaOfflineBase64}`;
  }

  if (String(versao) === '2') {
    if (!digits(cscId) || !text(csc)) throw new Error('QR Code v2 exige CSC ID e CSC configurados.');
    const payload = `${chave}|2|${tpAmb}|${digits(cscId)}|${text(csc)}`;
    const hash = crypto.createHash('sha1').update(payload, 'utf8').digest('hex').toUpperCase();
    return `${url}${chave}|2|${tpAmb}|${digits(cscId)}|${hash}`;
  }
  throw new Error(`Versão de QR Code NFC-e não suportada: ${versao}.`);
}

export function verificarSchemaOficial({ manifestPath = SCHEMA_MANIFEST } = {}) {
  if (!fs.existsSync(manifestPath)) return { instalado: false, motivo: 'Manifesto do pacote oficial de schemas não encontrado.' };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const archivePath = path.join(path.dirname(manifestPath), manifest.arquivo || '');
  const entryPath = path.join(path.dirname(manifestPath), manifest.entradaNfe || '');
  if (!fs.existsSync(archivePath) || !fs.existsSync(entryPath)) return { instalado: false, manifest, motivo: 'Arquivos do pacote oficial de schemas estão incompletos.' };
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
  return {
    instalado: checksum === manifest.sha256,
    manifest, schemaPath: entryPath, sha256: checksum,
    motivo: checksum === manifest.sha256 ? null : 'SHA-256 do pacote de schemas não confere com o manifesto.',
  };
}

function validarEstruturaBasica(xmlFiscal) {
  const doc = new DOMParser().parseFromString(xmlFiscal, 'application/xml');
  const erro = doc.getElementsByTagName('parsererror')[0];
  if (erro) return { valido: false, erros: [erro.textContent || 'XML malformado.'] };
  const root = doc.documentElement;
  const infNFe = doc.getElementsByTagName('infNFe')[0];
  const required = ['ide', 'emit', 'total', 'transp', 'pag'];
  const missing = required.filter((name) => !doc.getElementsByTagName(name)[0]);
  const erros = [];
  if (!root || root.localName !== 'NFe') erros.push('A raiz do XML deve ser NFe.');
  if (!infNFe?.getAttribute('Id')?.match(/^NFe\d{44}$/)) erros.push('infNFe deve possuir Id NFe seguido de chave de 44 dígitos.');
  if (missing.length) erros.push(`Grupos obrigatórios ausentes: ${missing.join(', ')}.`);
  return { valido: erros.length === 0, erros };
}

export function validarXmlComXsd(xmlFiscal, { schema = verificarSchemaOficial() } = {}) {
  if (!schema.instalado) return { valido: false, tipo: 'XSD', erros: [schema.motivo || 'Schema oficial indisponível.'], schema };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kytto-nfe-xsd-'));
  const xmlPath = path.join(tempDir, 'documento.xml');
  try {
    fs.writeFileSync(xmlPath, xmlFiscal, 'utf8');
    const result = spawnSync('xmllint', ['--noout', '--schema', schema.schemaPath, xmlPath], { encoding: 'utf8', timeout: 15000 });
    if (result.error?.code === 'ENOENT') return { valido: false, tipo: 'XSD', erros: ['Validador xmllint não está disponível na imagem de execução.'], schema };
    const output = `${result.stderr || ''}\n${result.stdout || ''}`.trim();
    return { valido: result.status === 0, tipo: 'XSD', erros: result.status === 0 ? [] : output.split('\n').filter(Boolean).slice(-12), schema };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function validarXmlFiscal(xmlFiscal) {
  const estrutura = validarEstruturaBasica(xmlFiscal);
  if (!estrutura.valido) return { valido: false, estrutura, xsd: null };
  const xsd = validarXmlComXsd(xmlFiscal);
  return { valido: xsd.valido, estrutura, xsd };
}

function xmlIcms(item, regime) {
  const fiscal = item.fiscal || {};
  const icms = item.icms || {};
  const origem = fiscal.origem || icms.origem || '0';
  if (regime === 'simples') {
    const csosn = fiscal.csosn || icms.csosn || '102';
    return `<ICMS><ICMSSN${csosn}>${tag('orig', origem)}${tag('CSOSN', csosn)}</ICMSSN${csosn}></ICMS>`;
  }
  const cst = fiscal.cstIcms || icms.cst || '00';
  if (['40', '41', '50'].includes(cst)) return `<ICMS><ICMS${cst}>${tag('orig', origem)}${tag('CST', cst)}</ICMS${cst}></ICMS>`;
  const body = `${tag('orig', origem)}${tag('CST', cst)}${tag('modBC', '3')}${tag('vBC', decimal(icms.baseCalculo, 2))}${tag('pICMS', decimal(icms.aliquota, 2))}${tag('vICMS', decimal(icms.valor, 2))}`;
  return `<ICMS><ICMS${cst}>${body}</ICMS${cst}></ICMS>`;
}

function xmlPis(item) {
  const pis = item.pis || {};
  const cst = pis.cst || item.fiscal?.cstPis || '49';
  if (['04', '05', '06', '07', '08', '09'].includes(cst)) return `<PIS><PISNT>${tag('CST', cst)}</PISNT></PIS>`;
  const calculo = `${tag('CST', cst)}${tag('vBC', decimal(pis.baseCalculo, 2))}${tag('pPIS', decimal(pis.aliquota, 4))}${tag('vPIS', decimal(pis.valor, 2))}`;
  return ['01', '02'].includes(cst) ? `<PIS><PISAliq>${calculo}</PISAliq></PIS>` : `<PIS><PISOutr>${calculo}</PISOutr></PIS>`;
}

function xmlCofins(item) {
  const cofins = item.cofins || {};
  const cst = cofins.cst || item.fiscal?.cstCofins || '49';
  if (['04', '05', '06', '07', '08', '09'].includes(cst)) return `<COFINS><COFINSNT>${tag('CST', cst)}</COFINSNT></COFINS>`;
  const calculo = `${tag('CST', cst)}${tag('vBC', decimal(cofins.baseCalculo, 2))}${tag('pCOFINS', decimal(cofins.aliquota, 4))}${tag('vCOFINS', decimal(cofins.valor, 2))}`;
  return ['01', '02'].includes(cst) ? `<COFINS><COFINSAliq>${calculo}</COFINSAliq></COFINS>` : `<COFINS><COFINSOutr>${calculo}</COFINSOutr></COFINS>`;
}

function xmlItens(itens, regime) {
  return itens.map((item, index) => {
    const fiscal = item.fiscal || {};
    const codigo = text(item.produtoId || item.id || index + 1, 60) || String(index + 1);
    const ncm = digits(fiscal.ncm, 8);
    if (ncm.length !== 8) throw new Error(`Item ${index + 1} sem NCM válido de 8 dígitos.`);
    const qCom = Math.max(0.001, number(item.quantidade, 1));
    const vUn = Math.max(0, number(item.valorUnitario, 0));
    const vProd = money(item.valorProduto ?? qCom * vUn);
    return `<det nItem="${index + 1}"><prod>`
      + `${tag('cProd', codigo)}${tag('cEAN', text(item.gtin || 'SEM GTIN', 14))}${tag('xProd', text(item.descricao || item.nome, 120))}`
      + `${tag('NCM', ncm)}${fiscal.cest ? tag('CEST', digits(fiscal.cest, 7)) : ''}${tag('CFOP', digits(fiscal.cfop, 4) || '5102')}`
      + `${tag('uCom', fiscal.unidadeTributavel || item.unidade || 'UN')}${tag('qCom', decimal(qCom, 4))}${tag('vUnCom', decimal(vUn, 10))}${tag('vProd', decimal(vProd, 2))}`
      + `${tag('cEANTrib', text(item.gtin || 'SEM GTIN', 14))}${tag('uTrib', fiscal.unidadeTributavel || item.unidade || 'UN')}${tag('qTrib', decimal(qCom, 4))}${tag('vUnTrib', decimal(vUn, 10))}${tag('indTot', '1')}`
      + `</prod><imposto>${item.vTotTrib !== undefined && item.vTotTrib !== null ? tag('vTotTrib', decimal(item.vTotTrib, 2)) : ''}${xmlIcms(item, regime)}${xmlPis(item)}${xmlCofins(item)}</imposto></det>`;
  }).join('');
}

function xmlPagamentos(pagamentos, valorTotal) {
  const lista = Array.isArray(pagamentos) && pagamentos.length ? pagamentos : [{ meio: 'dinheiro', valor: valorTotal }];
  const totalPago = money(lista.reduce((sum, item) => sum + number(item.valor, 0), 0));
  if (totalPago < money(valorTotal)) throw new Error('O total dos pagamentos é menor que o valor total do documento fiscal.');
  const det = lista.map((pagamento) => {
    const meio = resolverMeioPagamento(pagamento.meio || pagamento.metodo || pagamento.codigo);
    const valor = money(pagamento.valor);
    if (meio === '90' && valor !== 0) throw new Error('O meio de pagamento 90 exige valor zero.');
    let card = '';
    if (['03', '04', '17'].includes(meio) && pagamento.integrado) {
      const cnpj = digits(pagamento.cnpjCredenciadora, 14);
      const autorizacao = text(pagamento.codigoAutorizacao, 128);
      if (cnpj.length !== 14 || !autorizacao) throw new Error('Pagamento integrado por cartão ou PIX exige CNPJ da credenciadora e código de autorização.');
      card = `<card>${tag('tpIntegra', '1')}${tag('CNPJ', cnpj)}${pagamento.bandeira ? tag('tBand', digits(pagamento.bandeira, 2)) : ''}${tag('cAut', autorizacao)}</card>`;
    }
    return `<detPag>${tag('tPag', meio)}${tag('vPag', decimal(valor, 2))}${card}</detPag>`;
  }).join('');
  return { xml: `<pag>${det}${tag('vTroco', decimal(Math.max(0, totalPago - money(valorTotal)), 2))}</pag>`, totalPago };
}

function xmlEmitente(config) {
  const endereco = config.endereco || {};
  const cnpj = digits(config.cnpj, 14);
  if (cnpj.length !== 14) throw new Error('Emitente sem CNPJ válido.');
  const required = [['razaoSocial', config.razaoSocial], ['IE', config.ie], ['logradouro', endereco.logradouro], ['número', endereco.numero], ['bairro', endereco.bairro], ['cidade', endereco.cidade], ['código IBGE', endereco.codigoMunicipio], ['CEP', endereco.cep]];
  const missing = required.filter(([, value]) => !text(value)).map(([label]) => label);
  if (missing.length) throw new Error(`Emitente incompleto: ${missing.join(', ')}.`);
  return `<emit>${tag('CNPJ', cnpj)}${tag('xNome', config.razaoSocial)}${config.nomeFantasia ? tag('xFant', config.nomeFantasia) : ''}<enderEmit>`
    + `${tag('xLgr', endereco.logradouro)}${tag('nro', endereco.numero)}${endereco.complemento ? tag('xCpl', endereco.complemento) : ''}${tag('xBairro', endereco.bairro)}`
    + `${tag('cMun', digits(endereco.codigoMunicipio, 7))}${tag('xMun', endereco.cidade)}${tag('UF', config.uf)}${tag('CEP', digits(endereco.cep, 8))}${tag('cPais', '1058')}${tag('xPais', 'BRASIL')}`
    + `</enderEmit>${tag('IE', config.ie)}${config.im ? tag('IM', config.im) : ''}${tag('CRT', config.crt || '1')}</emit>`;
}

function xmlDestinatario(destinatario) {
  if (!destinatario) return '';
  const cnpj = digits(destinatario.cnpj, 14);
  const cpf = digits(destinatario.cpf, 11);
  if (!cnpj && !cpf) return '';
  const documento = cnpj ? tag('CNPJ', cnpj) : tag('CPF', cpf);
  const end = destinatario.endereco || destinatario;
  const possuiEndereco = text(end.logradouro) && text(end.numero) && text(end.bairro) && text(end.cidade) && text(end.uf) && digits(end.codigoMunicipio, 7) && digits(end.cep, 8);
  const indIe = destinatario.indIEDest || (destinatario.ie ? '1' : '9');
  return `<dest>${documento}${tag('xNome', destinatario.nome || 'CONSUMIDOR FINAL')}${possuiEndereco ? `<enderDest>${tag('xLgr', end.logradouro)}${tag('nro', end.numero)}${end.complemento ? tag('xCpl', end.complemento) : ''}${tag('xBairro', end.bairro)}${tag('cMun', digits(end.codigoMunicipio, 7))}${tag('xMun', end.cidade)}${tag('UF', end.uf)}${tag('CEP', digits(end.cep, 8))}${tag('cPais', '1058')}${tag('xPais', 'BRASIL')}</enderDest>` : ''}${tag('indIEDest', indIe)}${indIe === '1' && destinatario.ie ? tag('IE', destinatario.ie) : ''}${destinatario.email ? tag('email', destinatario.email) : ''}</dest>`;
}

function xmlTotais(totais = {}) {
  return `<total><ICMSTot>`
    + `${tag('vBC', decimal(totais.baseIcms, 2))}${tag('vICMS', decimal(totais.valorIcms, 2))}${tag('vICMSDeson', '0.00')}${tag('vFCP', decimal(totais.valorFcp, 2))}`
    + `${tag('vBCST', decimal(totais.baseSt, 2))}${tag('vST', decimal(totais.valorSt, 2))}${tag('vFCPST', '0.00')}${tag('vFCPSTRet', '0.00')}`
    + `${tag('vProd', decimal(totais.valorProdutos, 2))}${tag('vFrete', '0.00')}${tag('vSeg', '0.00')}${tag('vDesc', decimal(totais.desconto, 2))}${tag('vII', '0.00')}${tag('vIPI', '0.00')}${tag('vIPIDevol', '0.00')}`
    + `${tag('vPIS', decimal(totais.valorPis, 2))}${tag('vCOFINS', decimal(totais.valorCofins, 2))}${tag('vOutro', '0.00')}${tag('vNF', decimal(totais.valorTotal, 2))}${totais.vTotTrib !== undefined && totais.vTotTrib !== null ? tag('vTotTrib', decimal(totais.vTotTrib, 2)) : ''}`
    + `</ICMSTot></total>`;
}

/**
 * Gera um XML de NF-e/NFC-e v4.00 sem assinatura. A função nunca transmite.
 * O chamador deve validar o resultado e somente depois assinar, em etapa separada.
 */
export function montarXmlFiscalV400({ config, modelo = '65', numero, serie, chaveAcesso, codigoNumerico, dataEmissao = agoraFiscalCuiaba(), itens = [], totais, pagamentos = [], destinatario = null, contingencia = false, justificativaContingencia = '', qrCodeUrl, urlChave, qrCodeVersao = QR_VERSAO_ATUAL, qrCodeOfflineAssinatura = '' } = {}) {
  const model = normalizarModelo(modelo);
  const chave = digits(chaveAcesso);
  if (!validarChaveAcessoFiscal(chave)) throw new Error('Chave fiscal inválida para montagem do XML.');
  if (!Array.isArray(itens) || !itens.length) throw new Error('O documento fiscal precisa de ao menos um item.');
  const total = totais || {};
  const regime = config?.regimeTributario || 'simples';
  const tpAmb = config?.ambiente === 'producao' ? '1' : '2';
  const tpEmis = contingencia ? '9' : '1';
  const natOp = model === '65' ? (config?.naturezaOperacaoNfce || 'VENDA DE MERCADORIA') : (config?.naturezaOperacaoNfe || 'VENDA DE MERCADORIA');
  const qr = model === '65' ? construirQrCodeNfce({
    chaveAcesso: chave, ambiente: config?.ambiente, urlBase: qrCodeUrl, versao: qrCodeVersao, contingencia,
    valorTotal: total.valorTotal, dataEmissao, identificacaoDestinatario: digits(destinatario?.cnpj) || digits(destinatario?.cpf) || '',
    assinaturaOfflineBase64: qrCodeOfflineAssinatura, cscId: config?.cscId, csc: config?.csc,
  }) : null;
  const pagamentosXml = xmlPagamentos(pagamentos, total.valorTotal);
  const ide = `<ide>${tag('cUF', chave.slice(0, 2))}${tag('cNF', String(codigoNumerico ?? chave.slice(35, 43)).padStart(8, '0'))}${tag('natOp', natOp)}${tag('mod', model)}${tag('serie', serie)}${tag('nNF', numero)}${tag('dhEmi', dataEmissao)}${tag('tpNF', '1')}${tag('idDest', '1')}${tag('cMunFG', digits(config?.endereco?.codigoMunicipio, 7))}${tag('tpImp', model === '65' ? '4' : '1')}${tag('tpEmis', tpEmis)}${tag('cDV', chave.slice(-1))}${tag('tpAmb', tpAmb)}${tag('finNFe', '1')}${tag('indFinal', '1')}${tag('indPres', '1')}${tag('procEmi', '0')}${tag('verProc', 'Kytto Fiscal 1.0')}${contingencia ? `${tag('dhCont', dataEmissao)}${tag('xJust', text(justificativaContingencia, 256) || 'Contingência offline')}` : ''}</ide>`;
  const suplementar = model === '65' ? `<infNFeSupl>${tag('qrCode', qr)}${tag('urlChave', urlChave)}</infNFeSupl>` : '';
  // TNFe exige a sequência raiz: infNFe, infNFeSupl (opcional), Signature.
  const infNFe = `<infNFe versao="4.00" Id="NFe${chave}">${ide}${xmlEmitente(config)}${xmlDestinatario(destinatario)}${xmlItens(itens, regime)}${xmlTotais(total)}<transp>${tag('modFrete', '9')}</transp>${pagamentosXml.xml}</infNFe>`;
  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="${NFE_NAMESPACE}">${infNFe}${suplementar}</NFe>`;
}

function pfxParaPem(pfxBuffer, password) {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(pfxBuffer).toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBag = keyBags.find((bag) => bag.key);
  const certBag = certBags.find((bag) => bag.cert);
  if (!keyBag?.key || !certBag?.cert) throw new Error('O certificado A1 não contém chave privada e certificado público utilizáveis.');
  return { privateKey: forge.pki.privateKeyToPem(keyBag.key), certificate: forge.pki.certificateToPem(certBag.cert) };
}

export function assinarXmlFiscal(xmlFiscal, { pfx, password } = {}) {
  if (!pfx || !password) throw new Error('Material A1 ausente para assinatura XMLDSig.');
  const { privateKey, certificate } = pfxParaPem(pfx, password);
  const signature = new SignedXml({ privateKey, publicCert: certificate });
  signature.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  signature.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  signature.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  // No TNFe, Signature vem após infNFeSupl quando a NFC-e possui esse grupo.
  const possuiSuplementar = xmlFiscal.includes('<infNFeSupl>');
  signature.computeSignature(xmlFiscal, {
    location: possuiSuplementar
      ? { reference: "//*[local-name(.)='infNFeSupl']", action: 'after' }
      : { reference: "//*[local-name(.)='infNFe']", action: 'after' },
  });
  return { xml: signature.getSignedXml(), certificadoPem: certificate };
}

export function verificarAssinaturaXmlFiscal(xmlFiscal, certificatePem) {
  const document = new DOMParser().parseFromString(xmlFiscal, 'application/xml');
  const signatureNode = document.getElementsByTagName('Signature')[0];
  if (!signatureNode) return { valida: false, erros: ['Elemento Signature ausente no XML.'] };
  const verifier = new SignedXml({ publicCert: certificatePem });
  verifier.loadSignature(signatureNode);
  const valida = verifier.checkSignature(xmlFiscal);
  return { valida, erros: valida ? [] : verifier.validationErrors || ['Assinatura XMLDSig inválida.'] };
}

export default {
  agoraFiscalCuiaba,
  resolverMeioPagamento,
  construirQrCodeNfce,
  conteudoQrCodeOfflineV3,
  verificarSchemaOficial,
  validarXmlComXsd,
  validarXmlFiscal,
  montarXmlFiscalV400,
  assinarXmlFiscal,
  verificarAssinaturaXmlFiscal,
};
