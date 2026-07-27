/**
 * Motor Fiscal Próprio — NF-e 55 / NFC-e 65 / SAT / NFS-e
 * SetPoint Ultra · Comunicação direta com SEFAZ sem provedor externo
 * Suporte: MT, SP, MG, RS, PR, SC, GO, BA, CE, RJ, ES, PE, MA, PA, AM, TO
 */

import forge from 'node-forge';
import { DOMParser, XMLSerializer } from 'xmldom';
import { db } from './database.js';
import { gerarDanfe } from './danfe-generator.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES E TABELAS SEFAZ
// ─────────────────────────────────────────────────────────────────────────────

const SEFAZ_ENDPOINTS = {
  // Ambiente Produção
  producao: {
    MT: { nfe: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4', nfce: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4' },
    SP: { nfe: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx', nfce: 'https://nfce.fazenda.sp.gov.br/ws/NfeAutorizacao4.asmx' },
    MG: { nfe: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4', nfce: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4' },
    RS: { nfe: 'https://nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx', nfce: 'https://nfce.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx' },
    PR: { nfe: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4', nfce: 'https://nfce.sefa.pr.gov.br/nfe/NFeAutorizacao4' },
    GO: { nfe: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4', nfce: 'https://nfce.sefaz.go.gov.br/nfe/services/NFeAutorizacao4' },
    // SVAN (Sefaz Virtual do Ambiente Nacional) — demais estados
    SVAN: { nfe: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4', nfce: 'https://nfce.sefaz.go.gov.br/nfe/services/NFeAutorizacao4' },
  },
  // Ambiente Homologação
  homologacao: {
    MT: { nfe: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4', nfce: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4' },
    SP: { nfe: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx', nfce: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NfeAutorizacao4.asmx' },
    SVAN: { nfe: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', nfce: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx' },
  }
};

const CODIGO_UF = { AC:12,AL:27,AM:13,AP:16,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,MG:31,MS:50,MT:51,PA:15,PB:25,PE:26,PI:22,PR:41,RJ:33,RN:24,RO:11,RR:14,RS:43,SC:42,SE:28,SP:35,TO:17 };

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE CHAVE DE ACESSO (44 dígitos)
// ─────────────────────────────────────────────────────────────────────────────

export function gerarChaveAcesso({ uf, dhEmi, cnpj, modelo, serie, nNF, tpEmis, cNF }) {
  const cUF   = String(CODIGO_UF[uf] || 51).padStart(2, '0');
  const aamm  = dhEmi.substring(2, 4) + dhEmi.substring(5, 7);
  const cnpjF = cnpj.replace(/\D/g, '').padStart(14, '0');
  const mod   = String(modelo).padStart(2, '0');
  const serF  = String(serie).padStart(3, '0');
  const nNFF  = String(nNF).padStart(9, '0');
  const tpEmF = String(tpEmis);
  const cNFF  = String(cNF).padStart(8, '0');
  const semDV = `${cUF}${aamm}${cnpjF}${mod}${serF}${nNFF}${tpEmF}${cNFF}`;
  const cDV   = calcularModulo11(semDV);
  return `${semDV}${cDV}`;
}

function calcularModulo11(chave) {
  let soma = 0, mult = 2;
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]) * mult;
    mult = mult === 9 ? 2 : mult + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTAGEM DO XML NF-e 55 / NFC-e 65
// ─────────────────────────────────────────────────────────────────────────────

export function montarXmlNFe(dados) {
  const { empresa, loja, destinatario, itens, pagamentos, totais, info } = dados;
  const modelo = info.modelo || '65'; // 55=NF-e, 65=NFC-e
  const dhEmi  = new Date().toISOString().replace('T', 'T').substring(0, 19) + '-04:00';
  const cNF    = String(Math.floor(Math.random() * 99999999)).padStart(8, '0');
  const chave  = gerarChaveAcesso({
    uf: empresa.uf, dhEmi, cnpj: empresa.cnpj,
    modelo, serie: loja?.serie_nfce || 1,
    nNF: info.numero, tpEmis: info.contingencia ? 9 : 1, cNF
  });

  const itensXml = itens.map((item, idx) => `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <cEAN>${item.ean || 'SEM GTIN'}</cEAN>
        <xProd>${item.descricao.substring(0, 120)}</xProd>
        <NCM>${(item.ncm || '00000000').replace(/\D/g, '')}</NCM>
        ${item.cest ? `<CEST>${item.cest}</CEST>` : ''}
        <CFOP>${item.cfop || '5102'}</CFOP>
        <uCom>${item.unidade || 'UN'}</uCom>
        <qCom>${Number(item.quantidade).toFixed(3)}</qCom>
        <vUnCom>${Number(item.valor_unitario).toFixed(10)}</vUnCom>
        <vProd>${Number(item.valor_total).toFixed(2)}</vProd>
        <cEANTrib>${item.ean || 'SEM GTIN'}</cEANTrib>
        <uTrib>${item.unidade || 'UN'}</uTrib>
        <qTrib>${Number(item.quantidade).toFixed(3)}</qTrib>
        <vUnTrib>${Number(item.valor_unitario).toFixed(10)}</vUnTrib>
        <indTot>1</indTot>
        ${item.peso_liquido ? `<pesoL>${Number(item.peso_liquido).toFixed(3)}</pesoL>` : ''}
        ${item.peso_bruto ? `<pesoB>${Number(item.peso_bruto).toFixed(3)}</pesoB>` : ''}
      </prod>
      <imposto>
        <ICMS>
          ${montarIcmsXml(item, empresa)}
        </ICMS>
        <PIS>
          ${montarPisXml(item)}
        </PIS>
        <COFINS>
          ${montarCofinsXml(item)}
        </COFINS>
        ${item.aliquota_ipi ? montarIpiXml(item) : ''}
      </imposto>
    </det>`).join('');

  const pagamentosXml = pagamentos.map(pag => `
    <detPag>
      <tPag>${pag.codigo_tpag || '01'}</tPag>
      <vPag>${Number(pag.valor).toFixed(2)}</vPag>
      ${pag.cnpj_credenciadora ? `<card><tpIntegra>2</tpIntegra><CNPJ>${pag.cnpj_credenciadora}</CNPJ><tBand>${pag.bandeira || '99'}</tBand><cAut>${pag.autorizacao || ''}</cAut></card>` : ''}
    </detPag>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe versao="4.00" Id="NFe${chave}">
  <ide>
    <cUF>${CODIGO_UF[empresa.uf] || 51}</cUF>
    <cNF>${cNF}</cNF>
    <natOp>${info.natureza_operacao || 'VENDA DE MERCADORIA'}</natOp>
    <mod>${modelo}</mod>
    <serie>${loja?.serie_nfce || 1}</serie>
    <nNF>${info.numero}</nNF>
    <dhEmi>${dhEmi}</dhEmi>
    <tpNF>1</tpNF>
    <idDest>1</idDest>
    <cMunFG>${empresa.codigo_municipio || '5107602'}</cMunFG>
    <tpImp>${modelo === '65' ? '4' : '1'}</tpImp>
    <tpEmis>${info.contingencia ? '9' : '1'}</tpEmis>
    <cDV>${chave.slice(-1)}</cDV>
    <tpAmb>${info.ambiente === 'producao' ? '1' : '2'}</tpAmb>
    <finNFe>1</finNFe>
    <indFinal>1</indFinal>
    <indPres>1</indPres>
    <procEmi>0</procEmi>
    <verProc>SetPoint Ultra 3.0</verProc>
    ${info.contingencia ? `<dhCont>${info.contingencia_dt}</dhCont><xJust>${info.contingencia_motivo}</xJust>` : ''}
  </ide>
  <emit>
    <CNPJ>${empresa.cnpj.replace(/\D/g, '')}</CNPJ>
    <xNome>${empresa.razao_social}</xNome>
    <xFant>${empresa.nome_fantasia || empresa.razao_social}</xFant>
    <enderEmit>
      <xLgr>${empresa.endereco_logradouro}</xLgr>
      <nro>${empresa.endereco_numero || 'S/N'}</nro>
      <xBairro>${empresa.endereco_bairro}</xBairro>
      <cMun>${empresa.codigo_municipio || '5107602'}</cMun>
      <xMun>${empresa.endereco_cidade}</xMun>
      <UF>${empresa.uf}</UF>
      <CEP>${(empresa.cep || '').replace(/\D/g, '')}</CEP>
      <cPais>1058</cPais>
      <xPais>Brasil</xPais>
      ${empresa.telefone ? `<fone>${empresa.telefone.replace(/\D/g, '')}</fone>` : ''}
    </enderEmit>
    <IE>${empresa.inscricao_estadual || 'ISENTO'}</IE>
    ${empresa.inscricao_municipal ? `<IM>${empresa.inscricao_municipal}</IM>` : ''}
    <CRT>${empresa.crt || '1'}</CRT>
  </emit>
  ${destinatario ? montarDestinatarioXml(destinatario) : '<dest><CPF>00000000000</CPF><xNome>CONSUMIDOR NAO IDENTIFICADO</xNome><indIEDest>9</indIEDest></dest>'}
  ${itensXml}
  <total>
    <ICMSTot>
      <vBC>${Number(totais.base_icms || 0).toFixed(2)}</vBC>
      <vICMS>${Number(totais.valor_icms || 0).toFixed(2)}</vICMS>
      <vICMSDeson>0.00</vICMSDeson>
      <vFCP>0.00</vFCP>
      <vBCST>0.00</vBCST>
      <vST>0.00</vST>
      <vFCPST>0.00</vFCPST>
      <vFCPSTRet>0.00</vFCPSTRet>
      <vProd>${Number(totais.valor_produtos).toFixed(2)}</vProd>
      <vFrete>0.00</vFrete>
      <vSeg>0.00</vSeg>
      <vDesc>${Number(totais.desconto || 0).toFixed(2)}</vDesc>
      <vII>0.00</vII>
      <vIPI>0.00</vIPI>
      <vIPIDevol>0.00</vIPIDevol>
      <vPIS>${Number(totais.valor_pis || 0).toFixed(2)}</vPIS>
      <vCOFINS>${Number(totais.valor_cofins || 0).toFixed(2)}</vCOFINS>
      <vOutro>0.00</vOutro>
      <vNF>${Number(totais.valor_total).toFixed(2)}</vNF>
    </ICMSTot>
  </total>
  <transp>
    <modFrete>9</modFrete>
  </transp>
  <pag>
    ${pagamentosXml}
    <vTroco>${Number(totais.troco || 0).toFixed(2)}</vTroco>
  </pag>
  <infAdic>
    <infCpl>${info.informacoes_adicionais || ''}</infCpl>
  </infAdic>
  ${modelo === '65' ? `<infNFeSupl><qrCode>${gerarQrCodeNfce(chave, totais.valor_total, info.ambiente, empresa.csc, empresa.csc_id)}</qrCode><urlChave>https://www.sefaz.mt.gov.br/nfce/consultanfce</urlChave></infNFeSupl>` : ''}
</infNFe>
</NFe>
</nfeProc>`;
}

function montarIcmsXml(item, empresa) {
  const crt = empresa.crt || '1';
  if (crt === '1') {
    // Simples Nacional — CSOSN
    const csosn = item.csosn || '400';
    return `<ICMSSN${csosn}><orig>${item.origem || 0}</orig><CSOSN>${csosn}</CSOSN></ICMSSN${csosn}>`;
  }
  // Regime Normal — CST
  const cst = item.cst_icms || '00';
  return `<ICMS${cst}>
    <orig>${item.origem || 0}</orig>
    <CST>${cst}</CST>
    <modBC>3</modBC>
    <vBC>${Number(item.valor_total).toFixed(2)}</vBC>
    <pICMS>${Number(item.aliquota_icms || 0).toFixed(2)}</pICMS>
    <vICMS>${Number((item.valor_total * (item.aliquota_icms || 0)) / 100).toFixed(2)}</vICMS>
  </ICMS${cst}>`;
}

function montarPisXml(item) {
  const cst = item.cst_pis || '07';
  if (['07','08','09'].includes(cst)) {
    return `<PISOutr><CST>${cst}</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr>`;
  }
  return `<PISAliq><CST>${cst}</CST><vBC>${Number(item.valor_total).toFixed(2)}</vBC><pPIS>${Number(item.aliquota_pis || 0.0065).toFixed(4)}</pPIS><vPIS>${Number(item.valor_total * (item.aliquota_pis || 0.0065)).toFixed(2)}</vPIS></PISAliq>`;
}

function montarCofinsXml(item) {
  const cst = item.cst_cofins || '07';
  if (['07','08','09'].includes(cst)) {
    return `<COFINSOutr><CST>${cst}</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr>`;
  }
  return `<COFINSAliq><CST>${cst}</CST><vBC>${Number(item.valor_total).toFixed(2)}</vBC><pCOFINS>${Number(item.aliquota_cofins || 0.03).toFixed(4)}</pCOFINS><vCOFINS>${Number(item.valor_total * (item.aliquota_cofins || 0.03)).toFixed(2)}</vCOFINS></COFINSAliq>`;
}

function montarIpiXml(item) {
  return `<IPI><cEnq>999</cEnq><IPITrib><CST>${item.cst_ipi || '50'}</CST><vBC>${Number(item.valor_total).toFixed(2)}</vBC><pIPI>${Number(item.aliquota_ipi || 0).toFixed(2)}</pIPI><vIPI>${Number(item.valor_total * (item.aliquota_ipi || 0) / 100).toFixed(2)}</vIPI></IPITrib></IPI>`;
}

function montarDestinatarioXml(dest) {
  const doc = dest.cnpj ? `<CNPJ>${dest.cnpj.replace(/\D/g,'')}</CNPJ>` : `<CPF>${(dest.cpf || '').replace(/\D/g,'').padStart(11,'0')}</CPF>`;
  return `<dest>
    ${doc}
    <xNome>${dest.nome}</xNome>
    <enderDest>
      <xLgr>${dest.logradouro || ''}</xLgr>
      <nro>${dest.numero || 'S/N'}</nro>
      <xBairro>${dest.bairro || ''}</xBairro>
      <cMun>${dest.codigo_municipio || '9999999'}</cMun>
      <xMun>${dest.cidade || ''}</xMun>
      <UF>${dest.uf || 'MT'}</UF>
      <CEP>${(dest.cep || '').replace(/\D/g,'')}</CEP>
      <cPais>1058</cPais>
      <xPais>Brasil</xPais>
    </enderDest>
    <indIEDest>${dest.ie ? '1' : '9'}</indIEDest>
    ${dest.ie ? `<IE>${dest.ie}</IE>` : ''}
    ${dest.email ? `<email>${dest.email}</email>` : ''}
  </dest>`;
}

function gerarQrCodeNfce(chave, valor, ambiente, csc, cscId) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const url   = tpAmb === '1'
    ? 'https://www.sefaz.mt.gov.br/nfce/qrcode'
    : 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode';
  const dhEmi = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const vNF   = Number(valor).toFixed(2);
  const cHashQRCode = forge.md.sha1.create();
  cHashQRCode.update(`${chave}|2|${tpAmb}|${cscId || '000001'}|${csc || ''}`);
  const hash = cHashQRCode.digest().toHex().toUpperCase();
  return `${url}?p=${chave}|2|${tpAmb}|${cscId || '000001'}|${hash}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSINATURA DIGITAL COM CERTIFICADO A1
// ─────────────────────────────────────────────────────────────────────────────

export function assinarXml(xmlString, pfxBuffer, senha) {
  try {
    const p12Der  = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

    let privateKey = null, certificate = null;
    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          privateKey = safeBag.key;
        } else if (safeBag.type === forge.pki.oids.certBag) {
          certificate = safeBag.cert;
        }
      }
    }

    if (!privateKey || !certificate) throw new Error('Certificado ou chave privada não encontrados no PFX');

    const parser = new DOMParser();
    const doc    = parser.parseFromString(xmlString, 'text/xml');
    const infNFe = doc.getElementsByTagNameNS('http://www.portalfiscal.inf.br/nfe', 'infNFe')[0];
    if (!infNFe) throw new Error('Elemento infNFe não encontrado no XML');

    const id = infNFe.getAttribute('Id');
    const serializer = new XMLSerializer();
    const infNFeStr  = serializer.serializeToString(infNFe);

    // Canonicalização C14N
    const c14n = infNFeStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Digest SHA-1
    const md = forge.md.sha1.create();
    md.update(c14n, 'utf8');
    const digestValue = forge.util.encode64(md.digest().bytes());

    // SignedInfo
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${id}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

    // Assinatura RSA-SHA1
    const mdSig = forge.md.sha1.create();
    mdSig.update(signedInfo, 'utf8');
    const signature = forge.util.encode64(privateKey.sign(mdSig));

    // Certificado em Base64
    const certDer  = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes();
    const certB64  = forge.util.encode64(certDer);

    // Montar bloco Signature
    const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signature}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo></Signature>`;

    // Inserir Signature antes de </infNFe>
    const xmlAssinado = xmlString.replace('</infNFe>', `${signatureBlock}</infNFe>`);
    return { sucesso: true, xml: xmlAssinado };
  } catch (err) {
    return { sucesso: false, erro: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMUNICAÇÃO COM A SEFAZ VIA SOAP
// ─────────────────────────────────────────────────────────────────────────────

export async function transmitirNFe(xmlAssinado, empresa, modelo, ambiente) {
  const { default: axios } = await import('axios');
  const uf      = empresa.uf || 'MT';
  const env     = ambiente === 'producao' ? 'producao' : 'homologacao';
  const tipo    = modelo === '55' ? 'nfe' : 'nfce';
  const endpoint = SEFAZ_ENDPOINTS[env][uf]?.[tipo] || SEFAZ_ENDPOINTS[env].SVAN[tipo];

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>${Date.now()}</idLote>
        <indSinc>1</indSinc>
        ${xmlAssinado}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

  try {
    const response = await axios.post(endpoint, soapEnvelope, {
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'SOAPAction': '' },
      timeout: 30000,
    });

    return parsearRetornoSefaz(response.data);
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') {
      return { sucesso: false, contingencia: true, erro: 'SEFAZ indisponível — modo contingência ativado', codigo: 'TIMEOUT' };
    }
    return { sucesso: false, erro: err.message, codigo: 'ERRO_COMUNICACAO' };
  }
}

function parsearRetornoSefaz(xml) {
  try {
    const parser  = new DOMParser();
    const doc     = parser.parseFromString(xml, 'text/xml');
    const cStat   = doc.getElementsByTagName('cStat')[0]?.textContent;
    const xMotivo = doc.getElementsByTagName('xMotivo')[0]?.textContent;
    const nProt   = doc.getElementsByTagName('nProt')[0]?.textContent;
    const dhRecbto = doc.getElementsByTagName('dhRecbto')[0]?.textContent;

    if (cStat === '100') {
      return { sucesso: true, protocolo: nProt, data_autorizacao: dhRecbto, codigo: cStat, motivo: xMotivo };
    }
    return { sucesso: false, codigo: cStat, motivo: xMotivo, contingencia: ['108','109','110','999'].includes(cStat) };
  } catch {
    return { sucesso: false, erro: 'Erro ao parsear retorno SEFAZ', codigo: 'PARSE_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCELAMENTO DE NF-e / NFC-e
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelarNFe({ empresa, chave_acesso, protocolo, justificativa, pfxBuffer, senha, ambiente }) {
  if (!justificativa || justificativa.length < 15) {
    return { sucesso: false, erro: 'Justificativa deve ter no mínimo 15 caracteres' };
  }

  // Verificar prazo: NFC-e 30 min, NF-e 24h
  const modelo = chave_acesso.substring(20, 22);
  const prazoMinutos = modelo === '65' ? 30 : 1440;
  const dhEmiStr = chave_acesso.substring(2, 8);
  const dhEmi = new Date(`20${dhEmiStr.substring(0,2)}-${dhEmiStr.substring(2,4)}-01`);
  const diff  = (Date.now() - dhEmi.getTime()) / 60000;
  if (diff > prazoMinutos) {
    return { sucesso: false, erro: `Prazo de cancelamento expirado (${prazoMinutos} minutos)` };
  }

  const xmlEvento = `<evento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <infEvento Id="ID110111${chave_acesso}01">
      <cOrgao>${CODIGO_UF[empresa.uf] || 51}</cOrgao>
      <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
      <CNPJ>${empresa.cnpj.replace(/\D/g,'')}</CNPJ>
      <chNFe>${chave_acesso}</chNFe>
      <dhEvento>${new Date().toISOString().substring(0,19)}-04:00</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>${protocolo}</nProt>
        <xJust>${justificativa}</xJust>
      </detEvento>
    </infEvento>
  </evento>`;

  const assinado = assinarXml(xmlEvento, pfxBuffer, senha);
  if (!assinado.sucesso) return assinado;

  // Enviar para SEFAZ
  const { default: axios } = await import('axios');
  const uf  = empresa.uf || 'MT';
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  const endpoint = (SEFAZ_ENDPOINTS[env][uf]?.nfe || SEFAZ_ENDPOINTS[env].SVAN.nfe)
    .replace('NFeAutorizacao4', 'NFeRecepcaoEvento4');

  try {
    const response = await axios.post(endpoint, `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${assinado.xml}</nfeDadosMsg></soap12:Body>
</soap12:Envelope>`, {
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      timeout: 30000,
    });
    return parsearRetornoSefaz(response.data);
  } catch (err) {
    return { sucesso: false, erro: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INUTILIZAÇÃO DE NUMERAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export async function inutilizarNumeracao({ empresa, serie, nNFIni, nNFFin, justificativa, pfxBuffer, senha, ambiente }) {
  const ano  = new Date().getFullYear().toString().substring(2);
  const cnpj = empresa.cnpj.replace(/\D/g,'');
  const id   = `ID${CODIGO_UF[empresa.uf] || 51}${ano}${cnpj}55${String(serie).padStart(3,'0')}${String(nNFIni).padStart(9,'0')}${String(nNFFin).padStart(9,'0')}`;

  const xmlInut = `<inutNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <infInut Id="${id}">
      <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
      <xServ>INUTILIZAR</xServ>
      <cUF>${CODIGO_UF[empresa.uf] || 51}</cUF>
      <ano>${ano}</ano>
      <CNPJ>${cnpj}</CNPJ>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNFIni>${nNFIni}</nNFIni>
      <nNFFin>${nNFFin}</nNFFin>
      <xJust>${justificativa}</xJust>
    </infInut>
  </inutNFe>`;

  return assinarXml(xmlInut, pfxBuffer, senha);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTA DE STATUS DA SEFAZ
// ─────────────────────────────────────────────────────────────────────────────

export async function consultarStatusSefaz(uf, ambiente) {
  const { default: axios } = await import('axios');
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  const endpoint = (SEFAZ_ENDPOINTS[env][uf]?.nfe || SEFAZ_ENDPOINTS[env].SVAN.nfe)
    .replace('NFeAutorizacao4', 'NFeStatusServico4');

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
    <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
      <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
      <cUF>${CODIGO_UF[uf] || 51}</cUF>
      <xServ>STATUS</xServ>
    </consStatServ>
  </nfeDadosMsg></soap12:Body>
</soap12:Envelope>`;

  try {
    const response = await axios.post(endpoint, soap, {
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      timeout: 10000,
    });
    return parsearRetornoSefaz(response.data);
  } catch {
    return { sucesso: false, online: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO COMPLETO: EMITIR DOCUMENTO FISCAL
// ─────────────────────────────────────────────────────────────────────────────

export async function emitirDocumentoFiscal(tenantId, dadosVenda, pfxBuffer, senha) {
  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Buscar configuração da empresa
    const empRes = await client.query(
      'SELECT * FROM empresas WHERE id = $1', [tenantId]
    );
    const empresa = empRes.rows[0];
    if (!empresa) throw new Error('Empresa não encontrada');

    // Próximo número de documento (com lock para evitar duplicidade)
    const modelo = dadosVenda.modelo || '65';
    const serie  = dadosVenda.serie || 1;
    const numRes = await client.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS proximo
       FROM documento_fiscal
       WHERE empresa_id = $1 AND modelo = $2 AND serie = $3
       FOR UPDATE`,
      [tenantId, modelo, serie]
    );
    const numero = numRes.rows[0].proximo;

    // Montar XML
    const xmlBruto = montarXmlNFe({ ...dadosVenda, empresa, info: { ...dadosVenda.info, numero, modelo } });

    // Assinar
    const assinado = assinarXml(xmlBruto, pfxBuffer, senha);
    if (!assinado.sucesso) throw new Error(`Erro na assinatura: ${assinado.erro}`);

    // Verificar status SEFAZ
    const status = await consultarStatusSefaz(empresa.uf, dadosVenda.ambiente);

    let resultado;
    if (!status.sucesso) {
      // Modo contingência
      resultado = { contingencia: true, xml: assinado.xml, numero };
      await client.query(
        `INSERT INTO documento_fiscal (empresa_id, modelo, serie, numero, status, xml_assinado, em_contingencia, contingencia_motivo, contingencia_dt, venda_id)
         VALUES ($1, $2, $3, $4, 'contingencia', $5, true, $6, NOW(), $7)`,
        [tenantId, modelo, serie, numero, assinado.xml, 'SEFAZ indisponível', dadosVenda.venda_id]
      );
    } else {
      // Transmitir
      resultado = await transmitirNFe(assinado.xml, empresa, modelo, dadosVenda.ambiente);
      const statusDoc = resultado.sucesso ? 'autorizado' : 'rejeitado';

      await client.query(
        `INSERT INTO documento_fiscal (empresa_id, modelo, serie, numero, chave_acesso, status, xml_assinado, xml_autorizado, protocolo, data_autorizacao, motivo_rejeicao, venda_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [tenantId, modelo, serie, numero,
         resultado.sucesso ? extrairChave(assinado.xml) : null,
         statusDoc, assinado.xml,
         resultado.sucesso ? assinado.xml : null,
         resultado.protocolo || null,
         resultado.data_autorizacao ? new Date(resultado.data_autorizacao) : null,
         resultado.sucesso ? null : resultado.motivo,
         dadosVenda.venda_id]
      );
    }

    await client.query('COMMIT');
    return { ...resultado, numero };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function extrairChave(xml) {
  const match = xml.match(/Id="NFe(\d{44})"/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPROCESSAMENTO DE CONTINGÊNCIAS
// ─────────────────────────────────────────────────────────────────────────────

export async function reprocessarContingencias(tenantId) {
  const pool = db.getPool();
  const pendentes = await pool.query(
    `SELECT df.*, e.uf, e.certificado_a1_encrypted, e.certificado_a1_senha_enc
     FROM documento_fiscal df
     JOIN empresas e ON e.id = df.empresa_id
     WHERE df.empresa_id = $1 AND df.status = 'contingencia'
     ORDER BY df.criado_em ASC LIMIT 50`,
    [tenantId]
  );

  const resultados = [];
  for (const doc of pendentes.rows) {
    const status = await consultarStatusSefaz(doc.uf, 'producao');
    if (!status.sucesso) break; // SEFAZ ainda fora

    const resultado = await transmitirNFe(doc.xml_assinado, { uf: doc.uf }, doc.modelo, 'producao');
    if (resultado.sucesso) {
      await pool.query(
        `UPDATE documento_fiscal SET status='autorizado', protocolo=$1, data_autorizacao=$2, xml_autorizado=$3, em_contingencia=false
         WHERE id=$4`,
        [resultado.protocolo, new Date(resultado.data_autorizacao), doc.xml_assinado, doc.id]
      );
      resultados.push({ id: doc.id, numero: doc.numero, sucesso: true });
    }
  }
  return resultados;
}
