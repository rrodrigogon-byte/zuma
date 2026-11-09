// KYTTO — NFS-e Padrão Nacional (Sefin Nacional / ADN), integração própria.
//
// Monta a DPS (leiaute 1.01), assina com o certificado A1 da empresa (XMLDSig
// enveloped, RSA-SHA256, C14N), envia comprimida (gzip + base64) por mTLS e
// interpreta a resposta. Também monta e envia o evento de cancelamento (e101101).
//
// Segredos (PFX e senha) NUNCA ficam no banco: a configuração guarda só o NOME
// das variáveis de ambiente que os contêm (ex.: NFSE_PFX_B64_DINO / NFSE_PFX_SENHA_DINO).

import crypto from 'node:crypto';
import https from 'node:https';
import zlib from 'node:zlib';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export const NS_NFSE = 'http://www.sped.fazenda.gov.br/nfse';
export const VERSAO_DPS = '1.00';
export const VER_APLIC = 'kytto-nfse-1.0';

export const AMBIENTES = Object.freeze({
  producao_restrita: { tpAmb: '2', sefin: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional', adn: 'https://adn.producaorestrita.nfse.gov.br' },
  producao: { tpAmb: '1', sefin: 'https://sefin.nfse.gov.br/SefinNacional', adn: 'https://adn.nfse.gov.br' },
});

export const MOTIVOS_CANCELAMENTO = Object.freeze({ 1: 'Erro na emissão', 2: 'Serviço não prestado', 9: 'Outros' });

export class NfseError extends Error {
  constructor(message, code = 'NFSE_ERROR', detalhes = null) {
    super(message);
    this.code = code;
    this.detalhes = detalhes;
  }
}

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const texto = (v, max = 2000) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
function xmlEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function valor2(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new NfseError('Valor monetário inválido.', 'NFSE_VALOR_INVALIDO');
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// Configuração (sem segredos)
export function normalizarConfigNfse(entrada = {}, atual = {}) {
  const v = (k, d) => (entrada[k] !== undefined ? entrada[k] : (atual[k] !== undefined ? atual[k] : d));
  const cfg = {
    ativo: v('ativo', false) === true,
    ambiente: AMBIENTES[v('ambiente', 'producao_restrita')] ? v('ambiente', 'producao_restrita') : 'producao_restrita',
    cnpj: soDigitos(v('cnpj', '')),
    inscricaoMunicipal: texto(v('inscricaoMunicipal', ''), 15),
    codigoMunicipio: soDigitos(v('codigoMunicipio', '5107958')),
    serie: soDigitos(v('serie', '1')) || '1',
    opSimpNac: String(v('opSimpNac', '3')),
    regApTribSN: String(v('regApTribSN', '1')),
    regEspTrib: String(v('regEspTrib', '0')),
    cTribNacPadrao: soDigitos(v('cTribNacPadrao', '')),
    cTribNacPorServico: (v('cTribNacPorServico', {}) && typeof v('cTribNacPorServico', {}) === 'object') ? Object.fromEntries(Object.entries(v('cTribNacPorServico', {})).map(([k, c]) => [String(k), soDigitos(c)]).filter(([, c]) => c)) : {},
    pTotTribSN: v('pTotTribSN', '') === '' || v('pTotTribSN', '') === null ? '' : Number(v('pTotTribSN', '')),
    envPfxBase64: texto(v('envPfxBase64', ''), 80),
    envPfxSenha: texto(v('envPfxSenha', ''), 80),
    proximoNumero: Math.max(1, Math.floor(Number(v('proximoNumero', 1)) || 1)),
  };
  if (cfg.cnpj && cfg.cnpj.length !== 14) throw new NfseError('CNPJ do prestador deve ter 14 dígitos.', 'NFSE_CONFIG_INVALIDA');
  if (cfg.codigoMunicipio.length !== 7) throw new NfseError('Código IBGE do município deve ter 7 dígitos.', 'NFSE_CONFIG_INVALIDA');
  if (!['1', '2', '3'].includes(cfg.opSimpNac)) throw new NfseError('opSimpNac deve ser 1 (não optante), 2 (MEI) ou 3 (ME/EPP).', 'NFSE_CONFIG_INVALIDA');
  if (cfg.cTribNacPadrao && cfg.cTribNacPadrao.length !== 6) throw new NfseError('Código de tributação nacional (cTribNac) deve ter 6 dígitos.', 'NFSE_CONFIG_INVALIDA');
  for (const c of Object.values(cfg.cTribNacPorServico)) if (c.length !== 6) throw new NfseError('Todo cTribNac por serviço deve ter 6 dígitos.', 'NFSE_CONFIG_INVALIDA');
  if (cfg.pTotTribSN !== '' && !(cfg.pTotTribSN >= 0 && cfg.pTotTribSN <= 100)) throw new NfseError('Percentual de tributos do Simples deve ficar entre 0 e 100.', 'NFSE_CONFIG_INVALIDA');
  for (const nome of [cfg.envPfxBase64, cfg.envPfxSenha]) if (nome && !/^[A-Z][A-Z0-9_]{2,79}$/.test(nome)) throw new NfseError('Informe o NOME da variável de ambiente (ex.: NFSE_PFX_B64_DINO), não o conteúdo.', 'NFSE_CONFIG_INVALIDA');
  return cfg;
}

// O que falta para emitir (sem expor segredos).
export function prontidaoNfse(cfg = {}, env = process.env) {
  const pendencias = [];
  if (!cfg.cnpj) pendencias.push('CNPJ do prestador');
  if (!cfg.inscricaoMunicipal) pendencias.push('Inscrição municipal');
  if (!cfg.cTribNacPadrao && !Object.keys(cfg.cTribNacPorServico || {}).length) pendencias.push('Código de tributação nacional (cTribNac) do serviço');
  if (!cfg.envPfxBase64 || !env[cfg.envPfxBase64]) pendencias.push('Certificado A1 (variável de ambiente com o PFX em base64)');
  if (!cfg.envPfxSenha || env[cfg.envPfxSenha] === undefined) pendencias.push('Senha do certificado (variável de ambiente)');
  return { pronto: pendencias.length === 0, pendencias, ambiente: cfg.ambiente || 'producao_restrita', ativo: cfg.ativo === true };
}

// ---------------------------------------------------------------------------
// Certificado
export function lerCertificadoPfx(pfxBase64, senha) {
  try {
    const der = Buffer.from(String(pfxBase64 || ''), 'base64').toString('binary');
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), String(senha ?? ''));
    const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]
      || (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
    const certBags = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []);
    const certBag = certBags[0];
    if (!keyBag?.key || !certBag?.cert) throw new Error('PFX sem chave privada ou certificado');
    const validoAte = certBag.cert.validity.notAfter;
    const certLeafPem = forge.pki.certificateToPem(certBag.cert);
    const certChainPem = certBags.map((b) => forge.pki.certificateToPem(b.cert)).join('\n');
    return { certPem: certLeafPem, certChainPem, keyPem: forge.pki.privateKeyToPem(keyBag.key), validoAte: validoAte.toISOString(), titular: certBag.cert.subject.getField('CN')?.value || '' };
  } catch (error) {
    throw new NfseError('Não foi possível ler o certificado A1: confira o arquivo e a senha.', 'NFSE_CERTIFICADO_INVALIDO');
  }
}

export function certificadoDoAmbiente(cfg, env = process.env) {
  const b64 = cfg.envPfxBase64 ? env[cfg.envPfxBase64] : '';
  if (!b64) throw new NfseError('Certificado A1 não configurado no ambiente.', 'NFSE_SEM_CERTIFICADO');
  const cert = lerCertificadoPfx(b64, cfg.envPfxSenha ? env[cfg.envPfxSenha] : '');
  if (new Date(cert.validoAte) < new Date()) throw new NfseError('Certificado A1 vencido.', 'NFSE_CERTIFICADO_VENCIDO');
  return cert;
}

// ---------------------------------------------------------------------------
// DPS
export function montarIdDps({ codigoMunicipio, cnpj, cpf, serie, numero }) {
  const insc = cnpj ? soDigitos(cnpj) : soDigitos(cpf);
  const tpInsc = cnpj ? '2' : '1';
  const id = `DPS${soDigitos(codigoMunicipio).padStart(7, '0')}${tpInsc}${insc.padStart(14, '0')}${soDigitos(serie).padStart(5, '0')}${String(numero).padStart(15, '0')}`;
  if (!/^DPS[0-9]{42}$/.test(id)) throw new NfseError('Id da DPS inválido.', 'NFSE_ID_INVALIDO');
  return id;
}

function dataHoraBrasilia(data = new Date()) {
  const local = new Date(data.valueOf() - 3 * 3600 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

/**
 * dados: { numero, dataEmissao(Date), competencia('AAAA-MM-DD'), tomador:{cpf|cnpj, nome}|null,
 *          servico:{ cTribNac, descricao }, valorServico }
 */
export function montarDpsXml(cfg, dados) {
  const numero = Math.floor(Number(dados.numero));
  if (!(numero >= 1 && numero <= 999999999999999)) throw new NfseError('Número da DPS inválido.', 'NFSE_NUMERO_INVALIDO');
  const id = montarIdDps({ codigoMunicipio: cfg.codigoMunicipio, cnpj: cfg.cnpj, serie: cfg.serie, numero });
  const tpAmb = AMBIENTES[cfg.ambiente].tpAmb;
  const dhEmi = dataHoraBrasilia(dados.dataEmissao || new Date());
  const dCompet = String(dados.competencia || dhEmi.slice(0, 10)).slice(0, 10);
  const cTribNac = soDigitos(dados.servico?.cTribNac);
  if (cTribNac.length !== 6) throw new NfseError('Serviço sem código de tributação nacional (cTribNac) de 6 dígitos.', 'NFSE_SEM_CTRIBNAC');
  const descricao = texto(dados.servico?.descricao, 2000);
  if (!descricao) throw new NfseError('Descrição do serviço é obrigatória.', 'NFSE_SEM_DESCRICAO');
  const vServ = valor2(dados.valorServico);
  if (Number(vServ) <= 0) throw new NfseError('Valor do serviço deve ser positivo.', 'NFSE_VALOR_INVALIDO');

  const regTrib = `<regTrib><opSimpNac>${cfg.opSimpNac}</opSimpNac>${cfg.opSimpNac === '3' ? `<regApTribSN>${cfg.regApTribSN}</regApTribSN>` : ''}<regEspTrib>${cfg.regEspTrib}</regEspTrib></regTrib>`;
  const prest = `<prest><CNPJ>${cfg.cnpj}</CNPJ>${cfg.inscricaoMunicipal ? `<IM>${xmlEsc(cfg.inscricaoMunicipal)}</IM>` : ''}${regTrib}</prest>`;

  let toma = '';
  const t = dados.tomador || null;
  if (t && (soDigitos(t.cpf) || soDigitos(t.cnpj))) {
    const doc = soDigitos(t.cnpj) ? `<CNPJ>${soDigitos(t.cnpj)}</CNPJ>` : `<CPF>${soDigitos(t.cpf)}</CPF>`;
    if (soDigitos(t.cnpj) && soDigitos(t.cnpj).length !== 14) throw new NfseError('CNPJ do tomador inválido.', 'NFSE_TOMADOR_INVALIDO');
    if (!soDigitos(t.cnpj) && soDigitos(t.cpf).length !== 11) throw new NfseError('CPF do tomador inválido.', 'NFSE_TOMADOR_INVALIDO');
    toma = `<toma>${doc}<xNome>${xmlEsc(texto(t.nome, 300) || 'Consumidor')}</xNome></toma>`;
  }

  let totTrib = '';
  if (cfg.pTotTribSN !== '' && cfg.pTotTribSN !== null && Number.isFinite(Number(cfg.pTotTribSN))) {
    totTrib = `<totTrib><pTotTribSN>${Number(cfg.pTotTribSN).toFixed(2)}</pTotTribSN></totTrib>`;
  } else if (cfg.opSimpNac === '1') {
    // Não optante pelo Simples Nacional: informa indTotTrib
    totTrib = '<totTrib><indTotTrib>0</indTotTrib></totTrib>';
  }
  // Para ME/EPP optante pelo Simples (opSimpNac !== '1') sem pTotTribSN informado: não envia indTotTrib (regra E0712)

  const xml = `<DPS xmlns="${NS_NFSE}" versao="${VERSAO_DPS}"><infDPS Id="${id}">`
    + `<tpAmb>${tpAmb}</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>${VER_APLIC}</verAplic>`
    + `<serie>${String(cfg.serie || '1').padStart(5, '0')}</serie><nDPS>${numero}</nDPS><dCompet>${dCompet}</dCompet>`
    + `<tpEmit>1</tpEmit><cLocEmi>${cfg.codigoMunicipio}</cLocEmi>`
    + prest + toma
    + `<serv><locPrest><cLocPrestacao>${cfg.codigoMunicipio}</cLocPrestacao></locPrest>`
    + `<cServ><cTribNac>${cTribNac}</cTribNac><xDescServ>${xmlEsc(descricao)}</xDescServ></cServ></serv>`
    + `<valores><vServPrest><vServ>${vServ}</vServ></vServPrest>`
    + `<trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun>${totTrib}</trib></valores>`
    + `</infDPS></DPS>`;
  return { xml, idDps: id, numero, dhEmi };
}

// ---------------------------------------------------------------------------
// Assinatura XMLDSig (enveloped, RSA-SHA256, C14N), Signature irmã de infX.
export function assinarElemento(xml, nomeElemento, { certPem, keyPem }) {
  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${nomeElemento}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${certPem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, '')}</X509Certificate></X509Data>`;
  sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${nomeElemento}']`, action: 'after' }, existingPrefixes: {} });
  return sig.getSignedXml();
}

export function verificarAssinatura(xmlAssinado, certPem) {
  const sig = new SignedXml({ publicCert: certPem });
  const m = xmlAssinado.match(/<Signature[\s\S]*<\/Signature>/);
  if (!m) return false;
  sig.loadSignature(m[0]);
  return sig.checkSignature(xmlAssinado);
}

export const gzipB64 = (xml) => zlib.gzipSync(Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, 'utf8')).toString('base64');
export const gunzipB64 = (b64) => zlib.gunzipSync(Buffer.from(String(b64 || ''), 'base64')).toString('utf8');

// ---------------------------------------------------------------------------
// Cancelamento (e101101)
export function montarPedidoCancelamento(cfg, { chaveAcesso, cMotivo, xMotivo, dataEvento = new Date(), nPedRegEvento = 1 }) {
  const chave = soDigitos(chaveAcesso);
  if (chave.length !== 50) throw new NfseError('Chave de acesso da NFS-e deve ter 50 dígitos.', 'NFSE_CHAVE_INVALIDA');
  const motivo = String(cMotivo);
  if (!MOTIVOS_CANCELAMENTO[motivo]) throw new NfseError('Motivo de cancelamento deve ser 1, 2 ou 9.', 'NFSE_MOTIVO_INVALIDO');
  const justificativa = texto(xMotivo, 255);
  if (justificativa.length < 15) throw new NfseError('Justificativa do cancelamento precisa de pelo menos 15 caracteres.', 'NFSE_MOTIVO_INVALIDO');
  const seq = String(Math.max(1, Math.floor(Number(nPedRegEvento) || 1)));
  const id = `PRE${chave}101101${seq.padStart(3, '0')}`;
  const xml = `<pedRegEvento xmlns="${NS_NFSE}" versao="${VERSAO_DPS}"><infPedReg Id="${id}">`
    + `<tpAmb>${AMBIENTES[cfg.ambiente].tpAmb}</tpAmb><verAplic>${VER_APLIC}</verAplic><dhEvento>${dataHoraBrasilia(dataEvento)}</dhEvento>`
    + `<CNPJAutor>${cfg.cnpj}</CNPJAutor><chNFSe>${chave}</chNFSe><nPedRegEvento>${seq}</nPedRegEvento>`
    + `<e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>${motivo}</cMotivo><xMotivo>${xmlEsc(justificativa)}</xMotivo></e101101>`
    + `</infPedReg></pedRegEvento>`;
  return { xml, id };
}

// ---------------------------------------------------------------------------
// Respostas
export function normalizarErros(corpo = {}) {
  const lista = [];
  for (const chave of Object.keys(corpo || {})) {
    if (!/^erros?$/i.test(chave)) continue;
    const v = corpo[chave];
    for (const e of Array.isArray(v) ? v : [v]) {
      if (!e) continue;
      const get = (n) => e[Object.keys(e).find((k) => k.toLowerCase() === n)];
      lista.push({ codigo: String(get('codigo') ?? ''), descricao: String(get('descricao') ?? get('mensagem') ?? JSON.stringify(e)).slice(0, 500), complemento: get('complemento') ? String(get('complemento')).slice(0, 500) : undefined });
    }
  }
  return lista;
}

function campo(corpo, nome) {
  const k = Object.keys(corpo || {}).find((x) => x.toLowerCase() === nome.toLowerCase());
  return k ? corpo[k] : undefined;
}

// ---------------------------------------------------------------------------
// Cliente HTTP (mTLS). `transporte` pode ser injetado nos testes.
export function transporteHttps({ certPem, keyPem, certChainPem, timeoutMs = 30000 }) {
  const agent = new https.Agent({ cert: certChainPem || certPem, key: keyPem, keepAlive: false, rejectUnauthorized: false });
  return ({ metodo, url, corpo }) => new Promise((resolve, reject) => {
    const bodyStr = corpo !== undefined ? JSON.stringify(corpo) : null;
    const payload = bodyStr ? Buffer.from(bodyStr, 'utf8') : null;
    const req = https.request(url, {
      method: metodo,
      agent,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        ...(payload ? { 'Content-Length': payload.length } : {})
      },
      timeout: timeoutMs
    }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => {
        const bruto = Buffer.concat(partes).toString('utf8');
        let json = null;
        try { json = bruto ? JSON.parse(bruto) : {}; } catch { json = { bruto: bruto.slice(0, 2000) }; }
        resolve({ status: res.statusCode, corpo: json });
      });
    });
    req.on('timeout', () => req.destroy(new NfseError('Tempo esgotado na comunicação com a Sefin Nacional.', 'NFSE_TIMEOUT')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export function clienteSefin(cfg, transporte) {
  const base = AMBIENTES[cfg.ambiente];
  const chamar = async (metodo, caminho, corpo) => {
    const r = await transporte({ metodo, url: `${base.sefin}${caminho}`, corpo });
    return { ...r, erros: normalizarErros(r.corpo) };
  };
  return {
    async emitir(xmlAssinado) {
      const r = await chamar('POST', '/nfse', { dpsXmlGZipB64: gzipB64(xmlAssinado) });
      const chaveAcesso = campo(r.corpo, 'chaveAcesso');
      if (r.status >= 200 && r.status < 300 && chaveAcesso) {
        const nfseB64 = campo(r.corpo, 'nfseXmlGZipB64');
        return { ok: true, chaveAcesso: String(chaveAcesso), idDps: campo(r.corpo, 'idDps') || null, nfseXmlGZipB64: nfseB64 || null, alertas: campo(r.corpo, 'alertas') || [], processadoEm: campo(r.corpo, 'dataHoraProcessamento') || null };
      }
      return { ok: false, status: r.status, erros: r.erros.length ? r.erros : [{ codigo: String(r.status), descricao: 'Resposta inesperada da Sefin Nacional.' }] };
    },
    async consultarPorChave(chave) {
      const r = await chamar('GET', `/nfse/${soDigitos(chave)}`);
      return { status: r.status, corpo: r.corpo, erros: r.erros };
    },
    async consultarDps(idDps) {
      const r = await chamar('GET', `/dps/${encodeURIComponent(idDps)}`);
      return { status: r.status, chaveAcesso: campo(r.corpo, 'chaveAcesso') || null, erros: r.erros };
    },
    async registrarEvento(chave, xmlAssinado) {
      const r = await chamar('POST', `/nfse/${soDigitos(chave)}/eventos`, { pedidoRegistroEventoXmlGZipB64: gzipB64(xmlAssinado) });
      const evento = campo(r.corpo, 'eventoXmlGZipB64');
      if (r.status >= 200 && r.status < 300 && evento) return { ok: true, eventoXmlGZipB64: evento };
      return { ok: false, status: r.status, erros: r.erros.length ? r.erros : [{ codigo: String(r.status), descricao: 'Resposta inesperada da Sefin Nacional.' }] };
    },
    async convenioMunicipio(codigoMunicipio = cfg.codigoMunicipio) {
      const r = await chamar('GET', `/parametros_municipais/${soDigitos(codigoMunicipio)}/convenio`);
      return { status: r.status, corpo: r.corpo, erros: r.erros };
    },
  };
}

// Valor e descrição do serviço a partir dos itens de serviço do documento fiscal.
// Produtos ficam fora (NFS-e é só serviço) e a gorjeta não entra na base.
export function servicoDoDocumento(documento, cfg, servicosCadastro = []) {
  const itens = (documento.itens || []).filter((item) => item.tipo === 'servico');
  if (!itens.length) throw new NfseError('Esta comanda não tem serviços para NFS-e (produtos exigem NFC-e).', 'NFSE_SEM_SERVICO');
  const bruto = itens.reduce((s, i) => s + Number(i.total || 0), 0);
  const brutoTotal = (documento.itens || []).reduce((s, i) => s + Number(i.total || 0), 0) || bruto;
  const descontoProporcional = Number(documento.desconto || 0) * (bruto / brutoTotal);
  const valor = Math.max(0, bruto - descontoProporcional);
  const codigos = [...new Set(itens.map((i) => cfg.cTribNacPorServico?.[i.referenciaId] || cfg.cTribNacPadrao).filter(Boolean))];
  if (!codigos.length) throw new NfseError('Configure o código de tributação nacional (cTribNac) do serviço.', 'NFSE_SEM_CTRIBNAC');
  if (codigos.length > 1) throw new NfseError('A comanda mistura serviços com códigos de tributação diferentes; emita uma NFS-e por código.', 'NFSE_CODIGOS_MISTOS');
  const nomes = new Map(servicosCadastro.map((s) => [s.id, s.nome]));
  const descricao = itens.map((i) => `${Number(i.quantidade || 1) > 1 ? `${i.quantidade}x ` : ''}${nomes.get(i.referenciaId) || i.descricao}`).join('; ');
  return { cTribNac: codigos[0], descricao: `${descricao}.`, valor: Number(valor.toFixed(2)) };
}

export function hashConteudo(xml) {
  return crypto.createHash('sha256').update(String(xml)).digest('hex');
}
