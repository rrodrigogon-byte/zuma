// Transmissão de NF-e (55) e NFC-e (65) direto à SEFAZ, em homologação (tpAmb=2) ou produção (tpAmb=1).
//
// SOAP 1.2 com mTLS (certificado A1 da empresa). O transporte é injetável para os testes.
// A tabela de endpoints é por UF/autorizadora e por ambiente; conferir no Portal da NF-e/NFC-e
// antes do primeiro envio de cada UF e, se mudar, sobrepor com FISCAL_SEFAZ_URLS_HOMOLOGACAO ou
// FISCAL_SEFAZ_URLS_PRODUCAO (JSON {"MT":{"65":{"autorizacao":"…","evento":"…"}}}) sem mexer no código.
// Quem decide o ambiente é o emitente (servico.js); aqui só se garante que o host bate com ele.
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
    retAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4',
    // URL do QR Code e da consulta por chave (tabela da SEFAZ-MT/ENCAT; a antiga ".../nfce/qrcode" não existe)
    qrCode: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce',
    consultaChave: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce',
    consulta: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
    inutilizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeInutilizacao4',
  },
  '55': {
    autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    evento: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4',
    status: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
    retAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4',
    consulta: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    inutilizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4',
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
    inutilizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  },
  '55': {
    autorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    evento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    status: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    consulta: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    inutilizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  },
};
// UFs atendidas pela SVRS (autorizadora virtual) nos dois modelos.
const UFS_SVRS = ['AC', 'AL', 'AP', 'DF', 'ES', 'PB', 'PI', 'RJ', 'RN', 'RO', 'RR', 'SC', 'SE', 'TO'];

// Produção. MT conferido na tabela de web services NFC-e/NF-e 4.00 (01/11/2026). Outras UFs
// entram por FISCAL_SEFAZ_URLS_PRODUCAO até serem conferidas aqui.
const MT_PRODUCAO = {
  '65': {
    autorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
    retAutorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4',
    evento: 'https://nfce.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4',
    status: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4',
    qrCode: 'http://www.sefaz.mt.gov.br/nfce/consultanfce',
    consultaChave: 'http://www.sefaz.mt.gov.br/nfce/consultanfce',
    consulta: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
    inutilizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeInutilizacao4',
  },
  '55': {
    autorizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    retAutorizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4',
    evento: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4',
    status: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
    consulta: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    inutilizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4',
  },
};

// SVC (contingência da NF-e 55 na autorizadora virtual). MT e as UFs abaixo usam a SVC-RS
// (tpEmis=7); as demais, a SVC-AN (tpEmis=6). URLs conferidas na tabela de web services 4.00.
const UFS_SVC_RS = ['AM', 'BA', 'CE', 'GO', 'MA', 'MS', 'MT', 'PA', 'PE', 'PI', 'PR'];
const SVC = {
  RS: {
    homologacao: {
      autorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      status: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      evento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    },
    producao: {
      autorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      status: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      evento: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    },
  },
  AN: {
    homologacao: {
      autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
      consulta: 'https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      status: 'https://hom.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
      evento: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    },
    producao: {
      autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
      consulta: 'https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      status: 'https://www.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
      evento: 'https://www.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    },
  },
};
/** tpEmis da SVC da UF: 7 (SVC-RS) ou 6 (SVC-AN). */
export const tpEmisSvc = (uf) => (UFS_SVC_RS.includes(String(uf || '').toUpperCase()) ? '7' : '6');

export const AMBIENTES = Object.freeze(['homologacao', 'producao']);
export const tpAmbDe = (ambiente) => (ambiente === 'producao' ? '1' : '2');
const ehHostDeHomologacao = (host) => /homolog|(^|\.)hom\./i.test(host);

/**
 * Endereços da autorizadora para a UF, o modelo e o ambiente. O host tem de bater com o ambiente:
 * em homologação só hosts de homologação; em produção nenhum host de homologação (um documento
 * nunca vai para o ambiente errado por engano de configuração).
 */
export function enderecos(uf, modelo, { ambiente = 'homologacao', env = process.env, svc = false } = {}) {
  if (!AMBIENTES.includes(ambiente)) throw new ErroDominio('AMBIENTE_PROIBIDO', `Ambiente fiscal inválido: ${ambiente}`, 422);
  const u = String(uf || '').toUpperCase();
  const producao = ambiente === 'producao';
  if (svc && String(modelo) !== '55') throw new ErroDominio('CONTINGENCIA_SO_NFE', 'SVC é só da NF-e (55)', 422);
  const variavel = producao ? env.FISCAL_SEFAZ_URLS_PRODUCAO : env.FISCAL_SEFAZ_URLS_HOMOLOGACAO;
  let sobrepostos = {};
  try { sobrepostos = variavel ? JSON.parse(variavel) : {}; } catch { sobrepostos = {}; }
  const base = svc ? { 55: SVC[tpEmisSvc(u) === '7' ? 'RS' : 'AN'][ambiente] }
    : producao ? (u === 'MT' ? MT_PRODUCAO : null) : (u === 'MT' ? MT : UFS_SVRS.includes(u) ? SVRS : null);
  const end = { ...(base?.[modelo] || {}), ...(svc ? {} : (sobrepostos?.[u]?.[modelo] || {})) };
  const nome = producao ? 'produção' : 'homologação';
  if (!end.autorizacao) throw new ErroDominio('UF_SEM_ENDERECO', `Endereço da SEFAZ de ${nome} para ${u}, modelo ${modelo}, ainda não cadastrado.`, 422);
  for (const url of [end.autorizacao, end.retAutorizacao, end.evento, end.status, end.consulta, end.inutilizacao].filter(Boolean)) {
    let host = ''; let protocolo = '';
    try { const x = new URL(url); host = x.hostname; protocolo = x.protocol; } catch { host = ''; }
    if (protocolo !== 'https:' || !host) throw new ErroDominio('AMBIENTE_PROIBIDO', 'Endereço da SEFAZ inválido (precisa ser https).', 422);
    if (producao === ehHostDeHomologacao(host)) {
      throw new ErroDominio('AMBIENTE_PROIBIDO', producao ? 'Endereço de homologação configurado para produção.' : 'Só endereços de homologação são aceitos em homologação.', 422);
    }
  }
  return end;
}

/** Compatibilidade: endereços de homologação. */
export function enderecosHomologacao(uf, modelo, env = process.env) {
  return enderecos(uf, modelo, { ambiente: 'homologacao', env });
}

const SERVICOS = {
  autorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
  evento: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4',
  status: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4',
  retAutorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4',
  consulta: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4',
  inutilizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4',
};

export function envelope(servico, corpoXml) {
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>`
    + `<nfeDadosMsg xmlns="${SERVICOS[servico]}">${corpoXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

const semDeclaracao = (xml) => String(xml).replace(/^\s*<\?xml[^>]*\?>/, '');
const pegar = (xml, tag) => { const m = String(xml || '').match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`)); return m ? m[1].trim() : null; };

/** Transporte HTTPS com o certificado da empresa (mTLS). */
export function transporteSoap({ certPem, keyPem, timeoutMs = 30000 }) {
  const agent = new https.Agent({ cert: certPem, key: keyPem, keepAlive: false, rejectUnauthorized: false });
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

const esperarPadrao = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envia um NFe assinado (pede processamento síncrono, indSinc=1). Se a autorizadora devolver
 * "lote recebido" (cStat 103) em vez do protocolo, consulta o recibo (NFeRetAutorizacao4) algumas
 * vezes. Lote ainda em processamento depois disso é falha de comunicação (Error comum): o mesmo
 * XML é reenviado depois e a duplicidade (204) leva à consulta do protocolo.
 * Retorno: { autorizado, cStat, xMotivo, protocolo, chave, protXml } — cStat 100/150 = autorizado.
 */
// Respostas que NÃO são rejeição da nota: serviço fora/instável. Viram falha de comunicação
// (o mesmo XML é reenviado depois e, se já tiver sido autorizado, o protocolo é recuperado).
const CSTAT_TRANSITORIOS = new Set(['106', '108', '109', '999']);
function falhaTransitoria(mensagem, codigo = 'SEFAZ_INDISPONIVEL') {
  return Object.assign(new Error(mensagem), { code: codigo });
}
/** Sem retorno legível (HTTP ≠ 200, SOAP Fault, corpo vazio) ou cStat transitório → lança (não rejeita). */
function exigirRespostaUtil(r, ret, servico) {
  const cStat = pegar(ret || '', 'cStat');
  if (!ret || !cStat) throw falhaTransitoria(`SEFAZ sem resposta válida em ${servico} (HTTP ${r?.status ?? '?'}${/Fault/i.test(String(r?.corpo || '')) ? ', SOAP Fault' : ''})`);
  if (CSTAT_TRANSITORIOS.has(cStat)) throw falhaTransitoria(`SEFAZ indisponível em ${servico} (${cStat}): ${pegar(ret, 'xMotivo') || 'tente de novo'}`);
  return cStat;
}

export async function autorizar({ uf, modelo, xmlAssinado, idLote, transporte, env = process.env, chaveEsperada = null, ambiente = 'homologacao', esperar = esperarPadrao, svc = false }) {
  const end = enderecos(uf, modelo, { ambiente, env, svc });
  const corpo = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${String(idLote).replace(/\D/g, '').slice(0, 15) || '1'}</idLote><indSinc>1</indSinc>${semDeclaracao(xmlAssinado)}</enviNFe>`;
  const r = await transporte({ url: end.autorizacao, xml: envelope('autorizacao', corpo) });
  const ret = pegar(r.corpo, 'retEnviNFe') ?? '';
  const prot = pegar(ret, 'protNFe');
  if (prot) return lerProtocolo(prot, chaveEsperada, ambiente);
  const cStatLote = exigirRespostaUtil(r, ret, 'autorização');
  if (cStatLote === '103' || cStatLote === '105') {
    const recibo = pegar(ret, 'nRec');
    if (!recibo) throw falhaTransitoria(`Lote recebido pela SEFAZ (${cStatLote}) sem número de recibo`, 'SEFAZ_RECIBO');
    return consultarRecibo({ end, recibo, transporte, env, chaveEsperada, ambiente, esperar });
  }
  return { autorizado: false, cStat: cStatLote, xMotivo: pegar(ret, 'xMotivo') || 'Lote rejeitado pela SEFAZ', protocolo: null, chave: null, protXml: null };
}

/** Consulta o resultado de um lote assíncrono (NFeRetAutorizacao4) até sair do "em processamento" (105). */
async function consultarRecibo({ end, recibo, transporte, env, chaveEsperada, ambiente, esperar }) {
  if (!end.retAutorizacao) throw Object.assign(new Error(`Lote recebido pela SEFAZ (recibo ${recibo}) sem endereço de consulta de recibo cadastrado.`), { code: 'SEFAZ_RECIBO' });
  const tentativas = Math.min(Math.max(Number(env.FISCAL_RET_TENTATIVAS) || 4, 1), 10);
  const corpo = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmbDe(ambiente)}</tpAmb><nRec>${String(recibo).replace(/\D/g, '')}</nRec></consReciNFe>`;
  for (let i = 0; i < tentativas; i += 1) {
    await esperar(1500 * (i + 1));
    const r = await transporte({ url: end.retAutorizacao, xml: envelope('retAutorizacao', corpo) });
    const ret = pegar(r.corpo, 'retConsReciNFe') ?? '';
    const prot = pegar(ret, 'protNFe');
    if (prot) return lerProtocolo(prot, chaveEsperada, ambiente);
    let cStat;
    try { cStat = exigirRespostaUtil(r, ret, 'consulta do recibo'); } catch (error) {
      throw Object.assign(error, { code: 'SEFAZ_RECIBO', message: `${error.message} (recibo ${recibo})` });
    }
    if (cStat === '105') continue; // lote em processamento
    return { autorizado: false, cStat, xMotivo: pegar(ret, 'xMotivo') || 'Lote rejeitado pela SEFAZ', protocolo: null, chave: null, protXml: null };
  }
  throw Object.assign(new Error(`Lote ainda em processamento na SEFAZ (recibo ${recibo}). Tente de novo em instantes.`), { code: 'SEFAZ_EM_PROCESSAMENTO' });
}

/** Lê o protNFe: só vale como autorizado se for da chave enviada e do ambiente esperado. */
function lerProtocolo(prot, chaveEsperada, ambiente = 'homologacao') {
  const infProt = pegar(prot, 'infProt') ?? '';
  const cStat = pegar(infProt, 'cStat');
  const chave = pegar(infProt, 'chNFe');
  const tpAmb = pegar(infProt, 'tpAmb');
  if (chaveEsperada && chave !== chaveEsperada) return { autorizado: false, cStat: 'RESPOSTA_DIVERGENTE', xMotivo: 'A SEFAZ respondeu sobre outra chave de acesso', protocolo: null, chave: null, protXml: null };
  if (tpAmb && tpAmb !== tpAmbDe(ambiente)) return { autorizado: false, cStat: 'RESPOSTA_DIVERGENTE', xMotivo: `Resposta de ambiente que não é ${ambiente === 'producao' ? 'produção' : 'homologação'}`, protocolo: null, chave: null, protXml: null };
  return {
    autorizado: ['100', '150'].includes(cStat),
    cStat, xMotivo: pegar(infProt, 'xMotivo'), protocolo: pegar(infProt, 'nProt'), chave: pegar(infProt, 'chNFe'),
    protXml: `<protNFe versao="4.00">${prot}</protNFe>`,
  };
}

/** Monta o evento de cancelamento (110111) sem assinatura; quem chama assina `infEvento`. */
/** Consulta a situação da NF-e pela chave (NfeConsultaProtocolo4). */
export async function consultarProtocolo({ uf, modelo, chave, transporte, env = process.env, ambiente = 'homologacao', svc = false }) {
  const end = enderecos(uf, modelo, { ambiente, env, svc });
  if (!end.consulta) throw new ErroDominio('UF_SEM_ENDERECO', 'Endereço de consulta da SEFAZ não cadastrado', 422);
  const corpo = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmbDe(ambiente)}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;
  const r = await transporte({ url: end.consulta, xml: envelope('consulta', corpo) });
  const ret = pegar(r.corpo, 'retConsSitNFe') ?? '';
  const prot = pegar(ret, 'protNFe');
  if (!prot) exigirRespostaUtil(r, ret, 'consulta do protocolo');
  if (!prot) return { autorizado: false, cStat: pegar(ret, 'cStat'), xMotivo: pegar(ret, 'xMotivo') || 'Consulta sem protocolo', protocolo: null, chave: null, protXml: null };
  return lerProtocolo(prot, chave, ambiente);
}

export function montarEventoCancelamento({ uf, cnpj, chave, protocolo, justificativa, dataEvento, seq = 1, ambiente = 'homologacao' }) {
  const xJust = String(justificativa || '').trim().replace(/\s+/g, ' ');
  if (xJust.length < 15 || xJust.length > 255) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa do cancelamento precisa ter de 15 a 255 caracteres.');
  const n = String(seq).padStart(2, '0');
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now().toString().slice(-15)}</idLote><evento versao="1.00">`
    + `<infEvento Id="ID110111${chave}${n}"><cOrgao>${CODIGOS_UF[String(uf).toUpperCase()]}</cOrgao><tpAmb>${tpAmbDe(ambiente)}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe>`
    + `<dhEvento>${dataEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${seq}</nSeqEvento><verEvento>1.00</verEvento>`
    + `<detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${esc(xJust)}</xJust></detEvento></infEvento></evento></envEvento>`;
}

// Texto fixo exigido pelo leiaute da CC-e (sem acentos, exatamente assim).
export const CONDICAO_USO_CCE = 'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.';

/** Monta a carta de correção (110110) sem assinatura; quem chama assina `infEvento`. Só NF-e (55). */
export function montarEventoCartaCorrecao({ uf, cnpj, chave, texto, dataEvento, seq = 1, ambiente = 'homologacao' }) {
  // sem acentos e sem quebras: o schema aceita, mas várias SEFAZ recusam caracteres fora do básico
  const xCorrecao = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (xCorrecao.length < 15 || xCorrecao.length > 1000) throw new ErroDominio('VALIDATION_ERROR', 'O texto da carta de correção precisa ter de 15 a 1000 caracteres.');
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new ErroDominio('VALIDATION_ERROR', 'A NF-e aceita no máximo 20 cartas de correção.');
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now().toString().slice(-15)}</idLote><evento versao="1.00">`
    + `<infEvento Id="ID110110${chave}${String(n).padStart(2, '0')}"><cOrgao>${CODIGOS_UF[String(uf).toUpperCase()]}</cOrgao><tpAmb>${tpAmbDe(ambiente)}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe>`
    + `<dhEvento>${dataEvento}</dhEvento><tpEvento>110110</tpEvento><nSeqEvento>${n}</nSeqEvento><verEvento>1.00</verEvento>`
    + `<detEvento versao="1.00"><descEvento>Carta de Correcao</descEvento><xCorrecao>${esc(xCorrecao)}</xCorrecao><xCondUso>${CONDICAO_USO_CCE}</xCondUso></detEvento></infEvento></evento></envEvento>`;
}

export async function enviarEvento({ uf, modelo, xmlAssinado, transporte, env = process.env, ambiente = 'homologacao' }) {
  const end = enderecos(uf, modelo, { ambiente, env });
  const r = await transporte({ url: end.evento, xml: envelope('evento', semDeclaracao(xmlAssinado)) });
  const ret = pegar(r.corpo, 'retEvento') ?? pegar(r.corpo, 'retEnvEvento') ?? '';
  const cStat = pegar(ret, 'infEvento') ? pegar(pegar(ret, 'infEvento'), 'cStat') : pegar(ret, 'cStat');
  const inf = pegar(ret, 'infEvento') ?? ret;
  // 573 = duplicidade de evento: o cancelamento já está registrado (resposta anterior se perdeu)
  return { registrado: ['135', '155', '573'].includes(cStat), cStat, xMotivo: pegar(inf, 'xMotivo'), protocolo: pegar(inf, 'nProt') };
}

export async function statusServico({ uf, modelo, transporte, env = process.env, ambiente = 'homologacao' }) {
  const end = enderecos(uf, modelo, { ambiente, env });
  const corpo = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmbDe(ambiente)}</tpAmb><cUF>${CODIGOS_UF[String(uf).toUpperCase()]}</cUF><xServ>STATUS</xServ></consStatServ>`;
  const r = await transporte({ url: end.status, xml: envelope('status', corpo) });
  return { cStat: pegar(r.corpo, 'cStat'), xMotivo: pegar(r.corpo, 'xMotivo') };
}

// ── inutilização de numeração (NFeInutilizacao4) ────────────────────────────

const escaparXml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Monta o pedido de inutilização (inutNFe 4.00) sem assinatura; quem chama assina `infInut`.
 * Id = "ID" + cUF(2) + ano(2) + CNPJ(14) + modelo(2) + série(3) + nNFIni(9) + nNFFin(9).
 */
export function montarInutilizacao({ uf, ano, cnpj, modelo, serie, numeroInicial, numeroFinal, justificativa, ambiente = 'homologacao' }) {
  const cUF = CODIGOS_UF[String(uf || '').toUpperCase()];
  if (!cUF) throw new ErroDominio('VALIDATION_ERROR', 'UF do emitente inválida');
  const xJust = String(justificativa || '').trim().replace(/\s+/g, ' ');
  if (xJust.length < 15 || xJust.length > 255) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa da inutilização precisa ter de 15 a 255 caracteres.');
  if (!['55', '65'].includes(String(modelo))) throw new ErroDominio('VALIDATION_ERROR', 'Inutilização só para NF-e (55) ou NFC-e (65)');
  const aa = String(ano).padStart(2, '0').slice(-2);
  const doc = String(cnpj).replace(/\D/g, '');
  const id = `ID${cUF}${aa}${doc}${modelo}${String(serie).padStart(3, '0')}${String(numeroInicial).padStart(9, '0')}${String(numeroFinal).padStart(9, '0')}`;
  const xml = `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut Id="${id}"><tpAmb>${tpAmbDe(ambiente)}</tpAmb><xServ>INUTILIZAR</xServ>`
    + `<cUF>${cUF}</cUF><ano>${aa}</ano><CNPJ>${doc}</CNPJ><mod>${modelo}</mod><serie>${Number(serie)}</serie>`
    + `<nNFIni>${Number(numeroInicial)}</nNFIni><nNFFin>${Number(numeroFinal)}</nNFFin><xJust>${escaparXml(xJust)}</xJust></infInut></inutNFe>`;
  return { id, xml, justificativa: xJust };
}

/**
 * Envia o pedido assinado. cStat 102 = inutilização homologada. Num REENVIO do mesmo pedido,
 * 256 (a faixa já está inutilizada na SEFAZ) significa que a resposta anterior se perdeu e
 * também vale como homologada; num primeiro envio é recusa (outra faixa já cobre esses números).
 * Resposta de outro ambiente nunca vale.
 */
export async function inutilizar({ uf, modelo, xmlAssinado, transporte, env = process.env, reenvio = false, ambiente = 'homologacao' }) {
  const end = enderecos(uf, modelo, { ambiente, env });
  if (!end.inutilizacao) throw new ErroDominio('UF_SEM_ENDERECO', `Endereço de inutilização da SEFAZ para ${uf}, modelo ${modelo}, não cadastrado.`, 422);
  const r = await transporte({ url: end.inutilizacao, xml: envelope('inutilizacao', semDeclaracao(xmlAssinado)) });
  const ret = pegar(r.corpo, 'retInutNFe') ?? '';
  const inf = pegar(ret, 'infInut') ?? ret;
  const cStat = pegar(inf, 'cStat') || String(r.status);
  const tpAmb = pegar(inf, 'tpAmb');
  if (tpAmb && tpAmb !== tpAmbDe(ambiente)) return { homologada: false, cStat: 'RESPOSTA_DIVERGENTE', xMotivo: 'Resposta de outro ambiente da SEFAZ', protocolo: null, xmlRetorno: null };
  return { homologada: cStat === '102' || (reenvio && cStat === '256'), cStat, xMotivo: pegar(inf, 'xMotivo') || `Resposta inesperada da SEFAZ (HTTP ${r.status})`, protocolo: pegar(inf, 'nProt'), xmlRetorno: ret ? `<retInutNFe>${ret}</retInutNFe>` : null };
}
