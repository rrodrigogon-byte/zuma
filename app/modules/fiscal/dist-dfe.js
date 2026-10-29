import { db } from '../../core/database.js';
import * as motor from '../../core/fiscal-engine.js';
import https from 'node:https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'node:zlib';
import { parseStringPromise } from 'xml2js';
import { processarNFAi } from '../compras/importador-nf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CERT_DIR = path.join(__dirname, '../../data/certificados');

export async function sincronizarDFeSefaz(tenantId, usuarioId) {
  // 1. Obter config fiscal e certificado
  const config = (await db.query('SELECT * FROM fiscal_configuracoes WHERE tenant_id = $1', [tenantId])).rows[0];
  if (!config || !config.certificado_valido) throw new Error('Certificado A1 não configurado.');
  
  let ultNsu = '000000000000000';
  try {
    const r = await db.query('SELECT ult_nsu FROM fiscal_configuracoes WHERE tenant_id = $1', [tenantId]);
    if (r.rows[0]?.ult_nsu) ultNsu = r.rows[0].ult_nsu.padStart(15, '0');
  } catch (e) {
    // se a coluna não existir ainda, apenas ignora
  }

  const pfxPath = path.join(CERT_DIR, `cert_${tenantId}.pfx`);
  const { cert, key } = motor.extrairChavesCertificado(pfxPath, config.certificado_senha);
  
  const cnpj = config.cnpj.replace(/\D/g, '');
  const url = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <soap12:Header/>
  <soap12:Body>
    <nfe:nfeDadosMsg>
      <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
        <tpAmb>1</tpAmb>
        <cUFAutor>AN</cUFAutor>
        <CNPJ>${cnpj}</CNPJ>
        <distNSU><ultNSU>${ultNsu}</ultNSU></distNSU>
      </distDFeInt>
    </nfe:nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

  const agent = new https.Agent({ cert, key, keepAlive: false });
  const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

  const resHtml = await new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST', agent, timeout: 30000,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': soapAction
      }
    }, res => {
      const parts = [];
      res.on('data', c => parts.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(xml);
    req.end();
  });

  if (resHtml.status !== 200) throw new Error('Falha na comunicação com SEFAZ DistDFe. Código: ' + resHtml.status);

  const parsed = await parseStringPromise(resHtml.body, { explicitArray: false });
  const retDist = parsed['soap:Envelope']?.['soap:Body']?.['nfeDistDFeInteresseResponse']?.['nfeDistDFeInteresseResult']?.['retDistDFeInt'];
  if (!retDist) throw new Error('Resposta inválida da SEFAZ.');
  
  if (retDist.cStat !== '138') {
    if (retDist.cStat === '137') return { nfeImportadas: 0, mensagem: 'Nenhum documento novo.' };
    throw new Error(`SEFAZ retornou erro: ${retDist.cStat} - ${retDist.xMotivo}`);
  }

  let novoUltNsu = retDist.ultNSU || ultNsu;
  const docs = retDist.loteDistDFeInt?.docZip;
  const listDocs = Array.isArray(docs) ? docs : (docs ? [docs] : []);
  
  let importados = 0;
  for (const doc of listDocs) {
    const schema = doc.$.schema;
    if (schema.startsWith('procNFe_') || schema.startsWith('resNFe_')) {
      try {
        const compressed = Buffer.from(doc._, 'base64');
        const uncompressed = zlib.gunzipSync(compressed).toString('utf8');
        
        // Se for procNFe completo, vamos importar com a IA!
        if (schema.startsWith('procNFe_')) {
           const base64Xml = Buffer.from(uncompressed).toString('base64');
           await processarNFAi(tenantId, usuarioId, base64Xml, 'text/xml', true);
           importados++;
        }
      } catch (err) {
        console.error('Falha ao processar docZip NSU ' + doc.$.NSU, err);
      }
    }
  }

  try {
    // Tenta atualizar a coluna se existir, caso contrario ignora
    await db.query('UPDATE fiscal_configuracoes SET ult_nsu = $1 WHERE tenant_id = $2', [novoUltNsu, tenantId]);
  } catch (e) {}
  
  return { nfeImportadas: importados, ultNSU: novoUltNsu, mensagem: `SEFAZ retornou ${listDocs.length} documentos. Importados: ${importados}` };
}
