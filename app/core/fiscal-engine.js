/**
 * Motor Fiscal Próprio — SetPoint Ultra
 * Comunicação direta com SEFAZ (NFC-e / NF-e)
 * Sem provedores externos. Assinatura A1 (.pfx), XML e WebServices.
 */

import fs from 'fs';
import forge from 'node-forge';
import axios from 'axios';
import { Builder, parseStringPromise } from 'xml2js';
import crypto from 'crypto';
import https from 'https';

// ============================================================================
// ASSINATURA DIGITAL (CERTIFICADO A1 - PFX/P12)
// ============================================================================

export function extrairChavesCertificado(pfxPath, senha) {
  try {
    const p12Der = fs.readFileSync(pfxPath).toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

    let privateKey = null;
    let certBags = [];

    // Extrair chave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    if (keyBag) privateKey = keyBag.key;

    // Extrair certificado
    const certBagGroup = p12.getBags({ bagType: forge.pki.oids.certBag });
    certBags = certBagGroup[forge.pki.oids.certBag];
    const certBag = certBags[0];

    const pemCert = forge.pki.certificateToPem(certBag.cert);
    const pemKey = forge.pki.privateKeyToPem(privateKey);

    return { cert: pemCert, key: pemKey, p12 };
  } catch (err) {
    throw new Error('Erro ao ler certificado A1. Verifique a senha e o arquivo: ' + err.message);
  }
}

function canonicalizeXml(xml) {
  // Canonicalização simplificada para SEFAZ (C14N)
  return xml.replace(/\r\n/g, '\n').trim();
}

export function assinarXml(xmlOriginal, tagAssinatura, pfxPath, senha) {
  const { cert, key } = extrairChavesCertificado(pfxPath, senha);

  // Isolar a tag que será assinada (ex: <infNFe id="NFe...">)
  const regexInf = new RegExp(`<${tagAssinatura} [^>]+>.*?</${tagAssinatura}>`, 's');
  const match = xmlOriginal.match(regexInf);
  if (!match) throw new Error(`Tag ${tagAssinatura} não encontrada para assinatura.`);

  const infoNode = match[0];
  const infoCanon = canonicalizeXml(infoNode);

  // Calcular DigestValue (SHA-1 do nó)
  const sha1 = crypto.createHash('sha1');
  sha1.update(infoCanon, 'utf8');
  const digestValue = sha1.digest('base64');

  // Montar SignedInfo
  const signedInfo = `
    <SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="#${infoNode.match(/Id="([^"]+)"/)[1]}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>${digestValue}</DigestValue>
      </Reference>
    </SignedInfo>
  `.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

  // Assinar o SignedInfo com a chave privada (RSA-SHA1)
  const sign = crypto.createSign('RSA-SHA1');
  sign.update(signedInfo);
  const signatureValue = sign.sign(key, 'base64');

  // Extrair X509Certificate (sem cabeçalhos PEM)
  const x509Cert = cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\r|\n/g, '');

  // Montar nó Signature completo
  const signatureXml = `
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      ${signedInfo}
      <SignatureValue>${signatureValue}</SignatureValue>
      <KeyInfo>
        <X509Data>
          <X509Certificate>${x509Cert}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </Signature>
  `.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

  // Inserir a assinatura no XML original
  const tagFechamento = `</NFe>`;
  return xmlOriginal.replace(tagFechamento, `${signatureXml}${tagFechamento}`);
}

// ============================================================================
// COMUNICAÇÃO SEFAZ (WEBSERVICES SOAP)
// ============================================================================

export async function enviarSefaz(uf, ambiente, servico, xmlDados, pfxPath, senha) {
  const { cert, key } = extrairChavesCertificado(pfxPath, senha);

  // URLs SEFAZ MT (Exemplo - NFC-e Autorização)
  const urls = {
    'MT': {
      'homologacao': {
        'NfeAutorizacao': 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
        'NfeRetAutorizacao': 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4'
      },
      'producao': {
        'NfeAutorizacao': 'https://nfcews.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
        'NfeRetAutorizacao': 'https://nfcews.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4'
      }
    }
  };

  const url = urls[uf]?.[ambiente]?.[servico];
  if (!url) throw new Error(`URL não mapeada para UF ${uf}, Ambiente ${ambiente}, Serviço ${servico}`);

  // Envelope SOAP
  const soapXml = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <soapenv:Header/>
      <soapenv:Body>
        <nfe:nfeDadosMsg>
          ${xmlDados}
        </nfe:nfeDadosMsg>
      </soapenv:Body>
    </soapenv:Envelope>
  `.trim();

  // Configurar agente HTTPS com o certificado A1
  const httpsAgent = new https.Agent({
    cert: cert,
    key: key,
    rejectUnauthorized: false // Em homologação SEFAZ, às vezes a cadeia falha
  });

  const response = await axios.post(url, soapXml, {
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': `http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote`
    },
    httpsAgent
  });

  return parseStringPromise(response.data, { explicitArray: false });
}

// ============================================================================
// GERAÇÃO DE CHAVE DE ACESSO E QR CODE NFC-E
// ============================================================================

export function gerarChaveAcesso(uf, anoMes, cnpj, modelo, serie, numero, tipoEmissao, cNF) {
  // Formato: cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
  const chaveParcial = `${uf}${anoMes}${cnpj.padStart(14,'0')}${modelo}${String(serie).padStart(3,'0')}${String(numero).padStart(9,'0')}${tipoEmissao}${String(cNF).padStart(8,'0')}`;

  // Calcular Dígito Verificador (Módulo 11)
  let peso = 2;
  let soma = 0;
  for (let i = chaveParcial.length - 1; i >= 0; i--) {
    soma += parseInt(chaveParcial.charAt(i)) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;

  return `${chaveParcial}${dv}`;
}

export function gerarQrCodeNFCe(chave, versao, ambiente, cpfCnpj, dataHora, valorTotal, icms, digestValue, cscId, csc) {
  // Layout QR Code NFC-e 2.0
  const urlConsulta = ambiente === 'producao'
    ? 'http://www.sefaz.mt.gov.br/nfce/consultanfce'
    : 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce';

  const hexDigest = Buffer.from(digestValue, 'base64').toString('hex');
  const params = `chNFe=${chave}&nVersao=${versao}&tpAmb=${ambiente==='producao'?1:2}&cDest=${cpfCnpj||''}&dhEmi=${Buffer.from(dataHora).toString('hex')}&vNF=${valorTotal}&vICMS=${icms}&digVal=${hexDigest}&cIdToken=${String(cscId).padStart(6,'0')}`;

  const sha1 = crypto.createHash('sha1');
  sha1.update(params + csc, 'utf8');
  const hash = sha1.digest('hex').toUpperCase();

  return `${urlConsulta}?p=${params}|${hash}`;
}
