/**
 * Camada fiscal KYTTO para a persistência JSON/GCS usada em produção.
 *
 * Certificados A1 não são gravados no db.json: o arquivo fica cifrado em objeto
 * dedicado do GCS e a senha também fica cifrada com uma chave injetada pelo
 * Secret Manager. O db.json guarda somente metadados não sensíveis.
 */
import crypto from 'crypto';
import forge from 'node-forge';
import { Storage } from '@google-cloud/storage';
import { db, save } from './db.js';

const CERT_OBJECT_PREFIX = 'setpoint-ultra/certificados';
const CERT_FORMATS = new Set(['.p12', '.pfx']);

function tenantKey(value = 'principal') {
  return String(value || 'principal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'principal';
}

function masterKey() {
  const raw = process.env.FISCAL_CERT_MASTER_KEY;
  if (!raw || raw.length < 24) {
    throw new Error('Cofre fiscal indisponível. A chave mestre do certificado não foi configurada.');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptBuffer(input) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  return {
    cipher: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

function decryptBuffer(payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
}

function fiscalStore() {
  const state = db();
  if (!state.fiscalKytto || typeof state.fiscalKytto !== 'object') {
    state.fiscalKytto = { configuracoes: {}, certificados: {}, documentos: {}, inventarios: [] };
  }
  state.fiscalKytto.configuracoes ||= {};
  state.fiscalKytto.certificados ||= {};
  state.fiscalKytto.documentos ||= {};
  return state.fiscalKytto;
}

function gcsBucket() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) throw new Error('Armazenamento fiscal indisponível. Bucket de produção não configurado.');
  return new Storage().bucket(bucketName);
}

function cnpjFromSubject(subject) {
  const match = String(subject || '').match(/(?:CNPJ|OU=|OU\s*=\s*)(\d{14})/i);
  return match ? match[1] : '';
}

function describeCertificate(pfxBuffer, password) {
  try {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bag = bags[forge.pki.oids.certBag]?.[0];
    if (!bag?.cert) throw new Error('Certificado público não encontrado no arquivo A1.');
    const cert = bag.cert;
    const attrs = cert.subject.attributes || [];
    const subject = attrs.map(({ shortName, name, value }) => `${shortName || name}=${value}`).join(', ');
    const cn = attrs.find(({ shortName }) => shortName === 'CN')?.value || '';
    const validFrom = cert.validity.notBefore?.toISOString?.() || new Date(cert.validity.notBefore).toISOString();
    const validTo = cert.validity.notAfter?.toISOString?.() || new Date(cert.validity.notAfter).toISOString();
    const expiresAt = new Date(validTo);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= new Date()) throw new Error('Certificado A1 expirado.');
    return {
      subject,
      commonName: cn,
      cnpj: cnpjFromSubject(subject) || (cn.match(/(\d{14})/) || [])[1] || '',
      validFrom,
      validTo,
      fingerprint: crypto.createHash('sha256').update(pfxBuffer).digest('hex'),
    };
  } catch (error) {
    throw new Error(`Certificado inválido, expirado ou senha incorreta: ${error.message}`);
  }
}

function emptyConfig(tenantId) {
  return {
    tenantId,
    cnpj: '', ie: '', im: '', razaoSocial: '', nomeFantasia: '', uf: 'MT',
    regimeTributario: 'simples', ambiente: 'homologacao', cscId: '', csc: '',
    serieNfce: 1, serieNfe: 1, proximoNumeroNfce: 1, proximoNumeroNfe: 1,
    endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', codigoMunicipio: '', cep: '' },
    certificadoAtivoId: null, emissaoAutomaticaAtiva: false, updatedAt: null,
  };
}

function normalizarConfig(tenantId, raw = {}, anterior = emptyConfig(tenantId)) {
  const text = (value, max = 180) => String(value ?? '').trim().slice(0, max);
  const number = (value, fallback) => Math.max(1, Math.floor(Number(value) || fallback));
  const sourceAddress = raw.endereco && typeof raw.endereco === 'object' ? raw.endereco : {};
  const previousAddress = anterior.endereco || {};
  return {
    ...anterior,
    tenantId,
    cnpj: text(raw.cnpj ?? anterior.cnpj, 22).replace(/[^0-9]/g, ''),
    ie: text(raw.ie ?? anterior.ie, 30),
    im: text(raw.im ?? anterior.im, 30),
    razaoSocial: text(raw.razaoSocial ?? raw.razao_social ?? anterior.razaoSocial),
    nomeFantasia: text(raw.nomeFantasia ?? raw.nome_fantasia ?? anterior.nomeFantasia),
    uf: text(raw.uf ?? anterior.uf, 2).toUpperCase() || 'MT',
    regimeTributario: ['simples', 'lucro_presumido', 'lucro_real'].includes(raw.regimeTributario ?? raw.regime_tributario)
      ? (raw.regimeTributario ?? raw.regime_tributario) : anterior.regimeTributario,
    ambiente: ['homologacao', 'producao'].includes(raw.ambiente) ? raw.ambiente : anterior.ambiente,
    cscId: text(raw.cscId ?? raw.csc_id ?? anterior.cscId, 24),
    // O frontend nunca recebe o CSC existente; valor vazio significa "manter".
    csc: text(raw.csc, 220) || anterior.csc,
    serieNfce: number(raw.serieNfce ?? raw.serie_nfce, anterior.serieNfce),
    serieNfe: number(raw.serieNfe ?? raw.serie_nfe, anterior.serieNfe),
    endereco: {
      logradouro: text(sourceAddress.logradouro ?? raw.endereco_logradouro ?? previousAddress.logradouro),
      numero: text(sourceAddress.numero ?? raw.endereco_numero ?? previousAddress.numero, 30),
      complemento: text(sourceAddress.complemento ?? raw.endereco_complemento ?? previousAddress.complemento, 100),
      bairro: text(sourceAddress.bairro ?? raw.endereco_bairro ?? previousAddress.bairro),
      cidade: text(sourceAddress.cidade ?? raw.endereco_cidade ?? previousAddress.cidade),
      codigoMunicipio: text(sourceAddress.codigoMunicipio ?? raw.codigo_municipio ?? previousAddress.codigoMunicipio, 7).replace(/\D/g, ''),
      cep: text(sourceAddress.cep ?? raw.cep ?? previousAddress.cep, 10).replace(/\D/g, ''),
    },
    emissaoAutomaticaAtiva: Boolean(raw.emissaoAutomaticaAtiva ?? anterior.emissaoAutomaticaAtiva),
    updatedAt: new Date().toISOString(),
  };
}

export function obterConfiguracaoFiscal(tenantId = 'principal') {
  const store = fiscalStore();
  const key = tenantKey(tenantId);
  const config = store.configuracoes[key] || emptyConfig(key);
  const cert = config.certificadoAtivoId ? store.certificados[config.certificadoAtivoId] : null;
  return {
    ...config,
    certificado: cert ? {
      id: cert.id, nomeArquivo: cert.nomeArquivo, commonName: cert.commonName, cnpj: cert.cnpj,
      validFrom: cert.validFrom, validTo: cert.validTo, fingerprint: cert.fingerprint,
      ativo: true,
    } : null,
    preflight: verificarProntidao(config, cert),
  };
}

export function salvarConfiguracaoFiscal(tenantId = 'principal', raw = {}) {
  const store = fiscalStore();
  const key = tenantKey(tenantId);
  const atual = store.configuracoes[key] || emptyConfig(key);
  const config = normalizarConfig(key, raw, atual);
  if (config.certificadoAtivoId !== atual.certificadoAtivoId) config.certificadoAtivoId = atual.certificadoAtivoId;
  store.configuracoes[key] = config;
  save();
  return obterConfiguracaoFiscal(key);
}

export async function importarCertificadoA1(tenantId = 'principal', { arquivoBase64, senha, nomeArquivo = 'certificado.p12' }) {
  if (!arquivoBase64 || !senha) throw new Error('Envie o certificado A1 e a senha correspondente.');
  const extension = `.${String(nomeArquivo).split('.').pop()?.toLowerCase()}`;
  if (!CERT_FORMATS.has(extension)) throw new Error('Formato não aceito. Utilize um certificado .p12 ou .pfx.');
  const pfx = Buffer.from(arquivoBase64, 'base64');
  if (pfx.length < 512 || pfx.length > 2 * 1024 * 1024) throw new Error('O certificado possui tamanho inválido.');
  const info = describeCertificate(pfx, senha);
  const key = tenantKey(tenantId);
  const certId = `a1-${key}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const objectName = `${CERT_OBJECT_PREFIX}/${key}/${certId}${extension}.enc`;
  const encryptedFile = encryptBuffer(pfx);
  const encryptedPassword = encryptBuffer(Buffer.from(String(senha), 'utf8'));
  await gcsBucket().file(objectName).save(JSON.stringify(encryptedFile), {
    contentType: 'application/json', resumable: false,
    metadata: { cacheControl: 'no-store', metadata: { application: 'setpoint-ultra', certificateId: certId } },
  });
  const store = fiscalStore();
  store.certificados[certId] = {
    id: certId, tenantId: key, nomeArquivo: String(nomeArquivo).replace(/[^a-zA-Z0-9._-]/g, '_'), objectName,
    ...info, encryptedPassword, criadoEm: new Date().toISOString(), ativo: true,
  };
  const config = store.configuracoes[key] || emptyConfig(key);
  config.certificadoAtivoId = certId;
  if (!config.cnpj && info.cnpj) config.cnpj = info.cnpj;
  if (!config.razaoSocial && info.commonName) config.razaoSocial = info.commonName.replace(/:\d{14}$/, '').trim();
  config.updatedAt = new Date().toISOString();
  store.configuracoes[key] = config;
  save();
  return obterConfiguracaoFiscal(key);
}

export async function listarCertificados(tenantId = 'principal') {
  const key = tenantKey(tenantId);
  return Object.values(fiscalStore().certificados)
    .filter(cert => cert.tenantId === key)
    .map(({ encryptedPassword, ...cert }) => cert)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

export function ativarCertificado(tenantId = 'principal', certificadoId) {
  const store = fiscalStore();
  const key = tenantKey(tenantId);
  const cert = store.certificados[certificadoId];
  if (!cert || cert.tenantId !== key) throw new Error('Certificado não encontrado para esta empresa.');
  const config = store.configuracoes[key] || emptyConfig(key);
  config.certificadoAtivoId = cert.id;
  config.updatedAt = new Date().toISOString();
  store.configuracoes[key] = config;
  save();
  return obterConfiguracaoFiscal(key);
}

export function verificarProntidao(config, cert) {
  const pendencias = [];
  if (!cert) pendencias.push('Importe e ative um certificado A1 válido.');
  else if (new Date(cert.validTo) <= new Date()) pendencias.push('O certificado A1 ativo está expirado.');
  if (!/^\d{14}$/.test(config.cnpj || '')) pendencias.push('Informe um CNPJ válido com 14 dígitos.');
  if (!String(config.ie || '').trim()) pendencias.push('Informe a Inscrição Estadual.');
  if (!String(config.razaoSocial || '').trim()) pendencias.push('Informe a razão social.');
  const endereco = config.endereco || {};
  for (const [key, label] of [['logradouro', 'logradouro'], ['numero', 'número'], ['bairro', 'bairro'], ['cidade', 'cidade'], ['codigoMunicipio', 'código IBGE do município'], ['cep', 'CEP']]) {
    if (!String(endereco[key] || '').trim()) pendencias.push(`Informe ${label} do endereço do emitente.`);
  }
  if (config.ambiente === 'producao') {
    if (!String(config.cscId || '').trim() || !String(config.csc || '').trim()) {
      pendencias.push('Informe CSC ID e CSC para NFC-e em produção.');
    }
  }
  return { pronto: pendencias.length === 0, pendencias, ambiente: config.ambiente };
}

export async function carregarMaterialAtivo(tenantId = 'principal') {
  const key = tenantKey(tenantId);
  const store = fiscalStore();
  const config = store.configuracoes[key] || emptyConfig(key);
  const cert = config.certificadoAtivoId ? store.certificados[config.certificadoAtivoId] : null;
  const preflight = verificarProntidao(config, cert);
  if (!preflight.pronto) throw new Error(`Emissão bloqueada: ${preflight.pendencias.join(' ')}`);
  const [content] = await gcsBucket().file(cert.objectName).download();
  const pfx = decryptBuffer(JSON.parse(content.toString('utf8')));
  const password = decryptBuffer(cert.encryptedPassword).toString('utf8');
  return { config, cert, pfx, password };
}

export function registrarPreflightEmissao(tenantId = 'principal', venda = {}) {
  const key = tenantKey(tenantId);
  const config = obterConfiguracaoFiscal(key);
  if (!config.preflight.pronto) throw new Error(`Emissão bloqueada: ${config.preflight.pendencias.join(' ')}`);
  const store = fiscalStore();
  const id = `nfce-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const documento = {
    id, tenantId: key, tipo: 'NFC-e', status: 'pronto_para_autorizacao',
    ambiente: config.ambiente, serie: config.serieNfce, numero: config.proximoNumeroNfce,
    valorTotal: Number(venda.valorTotal || 0), itens: Array.isArray(venda.itens) ? venda.itens.length : 0,
    criadoEm: new Date().toISOString(),
  };
  store.documentos[id] = documento;
  const persisted = store.configuracoes[key];
  persisted.proximoNumeroNfce += 1;
  save();
  return documento;
}

export function listarDocumentos(tenantId = 'principal') {
  const key = tenantKey(tenantId);
  return Object.values(fiscalStore().documentos)
    .filter(doc => doc.tenantId === key)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

export function limparDadosSensiveis(config) {
  if (!config) return config;
  const { csc, ...safe } = config;
  return { ...safe, cscConfigurado: Boolean(csc) };
}

export default {
  obterConfiguracaoFiscal, salvarConfiguracaoFiscal, importarCertificadoA1,
  listarCertificados, ativarCertificado, verificarProntidao, carregarMaterialAtivo,
  registrarPreflightEmissao, listarDocumentos, limparDadosSensiveis,
};
