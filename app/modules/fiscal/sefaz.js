// Transmissão de NF-e (55) e NFC-e (65) direto à SEFAZ — SOMENTE HOMOLOGAÇÃO (tpAmb=2).
//
// SOAP 1.2 com mTLS (certificado A1 da empresa). O transporte é injetável para os testes.
// A tabela de endpoints é por UF/autorizadora; conferir no Portal Nacional da NF-e antes do
// primeiro envio de cada UF e, se mudar, sobrepor com FISCAL_SEFAZ_URLS_HOMOLOGACAO (JSON
// {"MT":{"65":{"autorizacao":"…","evento":"…","status":"…"}}}) sem mexer no código.
import https from 'node:https';
import { ErroDominio } from '../acesso/banco.js';

export const CODIGOS_UF = Object.freeze({
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52',
  MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26', PI: '22', PR: '41',
  RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42', SE: '28', SP: '35', TO: '17',
});

const MT = {
  '65': {
    autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
    evento: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4',
    status: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4',
    qrCode: 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode',
    consultaChave: 'https://homologacao.sefaz.mt.gov.br/nfce/consultanfce',
    consulta: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
  },
  '55': {
    autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    evento: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4',
    status: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
    consulta: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
  },
};
const SVRS = {
  '65': {
    autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    evento: 'https://nfce-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    status: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    qrCode: 'https://dfe-portal.svrs.rs.gov.br/NFCE/QRCode',
    consultaChave: 'www.sefaz.rs.gov.br/nfce/consulta',
    consulta: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  },
  '55': {
    autorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    evento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    status: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    consulta: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  },
};
// UFs atendidas pela SVRS (autorizadora virtual) nos dois modelos.
const UFS_SVRS = ['AC', 'AL', 'AP', 'DF', 'ES', 'PB', 'PI', 'RJ', 'RN', 'RO', 'RR', 'SC', 'SE', 'TO'];

export function enderecosHomologacao(uf, modelo, env = process.env) {
  const u = String(uf || '').toUpperCase();
  let sobrepostos = {};
  try { sobrepostos = env.FISCAL_SEFAZ_URLS_HOMOLOGACAO ? JSON.parse(env.FISCAL_SEFAZ_URLS_HOMOLOGACAO) : {}; } catch { sobrepostos = {}; }
  const base = u === 'MT' ? MT : UFS_SVRS.includes(u) ? SVRS : null;
  const end = { ...(base?.[modelo] || {}), ...(sobrepostos?.[u]?.[modelo] || {}) };
  if (!end.autorizacao) throw new ErroDominio('UF_SEM_ENDERECO', `Endereço da SEFAZ de homologação para ${u}, modelo ${modelo}, ainda não cadastrado.`, 422);
  // o HOST precisa ser de homologação (não basta "homolog" na URL)
  for (const url of [end.autorizacao, end.evento, end.status, end.consulta].filter(Boolean)) {
    let host = '';
    try { host = new URL(url).hostname; } catch { host = ''; }
    if (!/^https:$/.test(new URL(url, 'https://x').protocol) || !/homolog/i.test(host)) throw new ErroDominio('AMBIENTE_PROIBIDO', 'Só endereços de homologação são aceitos nesta versão.', 422);
  }
  return end;
}

const SERVICOS = {
  autorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
  evento: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4',
  status: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4',
  consulta: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4',
};

export function envelope(servico, corpoXml) {
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>`
    + `<nfeDadosMsg xmlns="${SERVICOS[servico]}">${corpoXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

const semDeclaracao = (xml) => String(xml).replace(/^\s*<\?xml[^>]*\?>/, '');
const pegar = (xml, tag) => { const m = String(xml || '').match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`)); return m ? m[1].trim() : null; };

/** Transporte HTTPS com o certificado da empresa (mTLS). */
export function transporteSoap({ certPem, keyPem, timeoutMs = 30000 }) {
  const agent = new https.Agent({ cert: certPem, key: keyPem, keepAlive: false });
  return ({ url, xml }) => new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', agent, timeout: timeoutMs, headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' } }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(partes).toString('utf8') }));
    });
    // erro de transporte NÃO é ErroDominio: quem chama trata como falha de comunicação (a nota pode ter sido autorizada)
    req.on('timeout', () => req.destroy(Object.assign(new Error('Tempo esgotado na comunicação com a SEFAZ.'), { code: 'SEFAZ_TIMEOUT' })));
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

/**
 * Envia um NFe assinado (síncrono, indSinc=1). Retorno:
 *  { autorizado, cStat, xMotivo, protocolo, chave, protXml } — cStat 100/150 = autorizado.
 */
export async function autorizar({ uf, modelo, xmlAssinado, idLote, transporte, env = process.env, chaveEsperada = null }) {
  const end = enderecosHomologacao(uf, modelo, env);
  const corpo = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${String(idLote).replace(/\D/g, '').slice(0, 15) || '1'}</idLote><indSinc>1</indSinc>${semDeclaracao(xmlAssinado)}</enviNFe>`;
  const r = await transporte({ url: end.autorizacao, xml: envelope('autorizacao', corpo) });
  const ret = pegar(r.corpo, 'retEnviNFe') ?? '';
  const prot = pegar(ret, 'protNFe');
  const cStatLote = pegar(ret, 'cStat');
  if (!prot) return { autorizado: false, cStat: cStatLote || String(r.status), xMotivo: pegar(ret, 'xMotivo') || `Resposta inesperada da SEFAZ (HTTP ${r.status})`, protocolo: null, chave: null, protXml: null };
  return lerProtocolo(prot, chaveEsperada);
}

/** Lê o protNFe: só vale como autorizado se for da chave enviada e do ambiente de homologação. */
function lerProtocolo(prot, chaveEsperada) {
  const infProt = pegar(prot, 'infProt') ?? '';
  const cStat = pegar(infProt, 'cStat');
  const chave = pegar(infProt, 'chNFe');
  const tpAmb = pegar(infProt, 'tpAmb');
  if (chaveEsperada && chave !== chaveEsperada) return { autorizado: false, cStat: 'RESPOSTA_DIVERGENTE', xMotivo: 'A SEFAZ respondeu sobre outra chave de acesso', protocolo: null, chave: null, protXml: null };
  if (tpAmb && tpAmb !== '2') return { autorizado: false, cStat: 'RESPOSTA_DIVERGENTE', xMotivo: 'Resposta de ambiente que não é homologação', protocolo: null, chave: null, protXml: null };
  return {
    autorizado: ['100', '150'].includes(cStat),
    cStat, xMotivo: pegar(infProt, 'xMotivo'), protocolo: pegar(infProt, 'nProt'), chave: pegar(infProt, 'chNFe'),
    protXml: `<protNFe versao="4.00">${prot}</protNFe>`,
  };
}

/** Monta o evento de cancelamento (110111) sem assinatura; quem chama assina `infEvento`. */
/** Consulta a situação da NF-e pela chave (NfeConsultaProtocolo4). */
export async function consultarProtocolo({ uf, modelo, chave, transporte, env = process.env }) {
  const end = enderecosHomologacao(uf, modelo, env);
  if (!end.consulta) throw new ErroDominio('UF_SEM_ENDERECO', 'Endereço de consulta da SEFAZ não cadastrado', 422);
  const corpo = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;
  const r = await transporte({ url: end.consulta, xml: envelope('consulta', corpo) });
  const ret = pegar(r.corpo, 'retConsSitNFe') ?? '';
  const prot = pegar(ret, 'protNFe');
  if (!prot) return { autorizado: false, cStat: pegar(ret, 'cStat') || String(r.status), xMotivo: pegar(ret, 'xMotivo') || 'Consulta sem protocolo', protocolo: null, chave: null, protXml: null };
  return lerProtocolo(prot, chave);
}

export function montarEventoCancelamento({ uf, cnpj, chave, protocolo, justificativa, dataEvento, seq = 1 }) {
  const xJust = String(justificativa || '').trim().replace(/\s+/g, ' ');
  if (xJust.length < 15 || xJust.length > 255) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa do cancelamento precisa ter de 15 a 255 caracteres.');
  const n = String(seq).padStart(2, '0');
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now().toString().slice(-15)}</idLote><evento versao="1.00">`
    + `<infEvento Id="ID110111${chave}${n}"><cOrgao>${CODIGOS_UF[String(uf).toUpperCase()]}</cOrgao><tpAmb>2</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe>`
    + `<dhEvento>${dataEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${seq}</nSeqEvento><verEvento>1.00</verEvento>`
    + `<detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${esc(xJust)}</xJust></detEvento></infEvento></evento></envEvento>`;
}

export async function enviarEvento({ uf, modelo, xmlAssinado, transporte, env = process.env }) {
  const end = enderecosHomologacao(uf, modelo, env);
  const r = await transporte({ url: end.evento, xml: envelope('evento', semDeclaracao(xmlAssinado)) });
  const ret = pegar(r.corpo, 'retEvento') ?? pegar(r.corpo, 'retEnvEvento') ?? '';
  const cStat = pegar(ret, 'infEvento') ? pegar(pegar(ret, 'infEvento'), 'cStat') : pegar(ret, 'cStat');
  const inf = pegar(ret, 'infEvento') ?? ret;
  // 573 = duplicidade de evento: o cancelamento já está registrado (resposta anterior se perdeu)
  return { registrado: ['135', '155', '573'].includes(cStat), cStat, xMotivo: pegar(inf, 'xMotivo'), protocolo: pegar(inf, 'nProt') };
}

export async function statusServico({ uf, modelo, transporte, env = process.env }) {
  const end = enderecosHomologacao(uf, modelo, env);
  const corpo = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><cUF>${CODIGOS_UF[String(uf).toUpperCase()]}</cUF><xServ>STATUS</xServ></consStatServ>`;
  const r = await transporte({ url: end.status, xml: envelope('status', corpo) });
  return { cStat: pegar(r.corpo, 'cStat'), xMotivo: pegar(r.corpo, 'xMotivo') };
}
