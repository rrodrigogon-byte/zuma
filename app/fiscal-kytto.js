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

// A tabela mantém o domínio preparado para múltiplas UFs. Os URLs de cada
// serviço são versionados e atualizados no adaptador de transporte fiscal;
// esta camada decide somente qual configuração deve ser usada pelo documento.
const CODIGOS_UF = Object.freeze({
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52,
  MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41,
  RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17,
});

const TABELA_UF_PADRAO = Object.freeze({
  MT: {
    uf: 'MT', codigoUf: 51, habilitada: true,
    versaoLayout: '4.00', modelos: ['55', '65'],
    observacao: 'Configuração inicial. A autorização SEFAZ será habilitada somente após homologação controlada.',
    nfce: {
      qrCode: { producao: 'https://www.sefaz.mt.gov.br/nfce/qrcode', homologacao: 'https://homologacao.sefaz.mt.gov.br/nfce/qrcode', versao: '3' },
      consultaChave: { producao: 'https://www.sefaz.mt.gov.br/nfce/consultanfce', homologacao: 'https://homologacao.sefaz.mt.gov.br/nfce/consultanfce' },
    },
  },
  SP: {
    uf: 'SP', codigoUf: 35, habilitada: false,
    versaoLayout: '4.00', modelos: ['55', '65'],
    observacao: 'Estrutura de prova multi-UF; requer homologação específica antes de ativação.',
  },
});

function somenteDigitos(value) {
  return String(value || '').replace(/\D/g, '');
}

export function calcularDigitoVerificadorChave(chaveSemDv) {
  const chave = somenteDigitos(chaveSemDv);
  if (chave.length !== 43) throw new Error('A chave sem dígito verificador deve conter 43 dígitos.');
  let soma = 0;
  let peso = 2;
  for (let index = chave.length - 1; index >= 0; index -= 1) {
    soma += Number(chave[index]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? '0' : String(11 - resto);
}

export function gerarChaveAcessoFiscal({ uf = 'MT', dhEmi, cnpj, modelo = '65', serie = 1, numero, tpEmis = 1, codigoNumerico }) {
  const cUf = String(CODIGOS_UF[String(uf).toUpperCase()] || CODIGOS_UF.MT).padStart(2, '0');
  const emissao = new Date(dhEmi || new Date().toISOString());
  if (Number.isNaN(emissao.valueOf())) throw new Error('Data de emissão inválida para gerar chave de acesso.');
  // AAMM do horário local da emissão (o dhEmi já vem com o fuso, ex.: 2026-10-31T21:00:00-04:00);
  // pelo UTC, a noite do último dia do mês viraria o mês seguinte e a chave não bateria com o dhEmi
  const local = String(dhEmi || '').match(/^(\d{4})-(\d{2})-\d{2}T/);
  const aamm = local ? `${local[1].slice(-2)}${local[2]}` : `${String(emissao.getUTCFullYear()).slice(-2)}${String(emissao.getUTCMonth() + 1).padStart(2, '0')}`;
  const cnpjNormalizado = somenteDigitos(cnpj);
  if (cnpjNormalizado.length !== 14) throw new Error('CNPJ inválido para gerar chave de acesso.');
  const mod = String(modelo).padStart(2, '0');
  if (!['55', '65'].includes(mod)) throw new Error('Modelo fiscal deve ser 55 ou 65.');
  const serieNormalizada = String(Math.max(1, Number(serie) || 1)).padStart(3, '0');
  const numeroNormalizado = String(Math.max(1, Number(numero) || 1)).padStart(9, '0');
  const emissaoNormalizada = String(tpEmis || 1).slice(0, 1);
  const codigo = String(codigoNumerico ?? crypto.randomInt(0, 100000000)).replace(/\D/g, '').padStart(8, '0').slice(-8);
  const semDv = `${cUf}${aamm}${cnpjNormalizado}${mod}${serieNormalizada}${numeroNormalizado}${emissaoNormalizada}${codigo}`;
  return `${semDv}${calcularDigitoVerificadorChave(semDv)}`;
}

export function validarChaveAcessoFiscal(chave) {
  const normalizada = somenteDigitos(chave);
  return normalizada.length === 44 && normalizada.slice(-1) === calcularDigitoVerificadorChave(normalizada.slice(0, -1));
}

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
    state.fiscalKytto = { configuracoes: {}, certificados: {}, documentos: {}, numeracoes: {}, eventos: {}, tabelaUf: {}, tabelasIbpt: {}, arquivos: {}, contingencias: {}, inventarios: [] };
  }
  state.fiscalKytto.configuracoes ||= {};
  state.fiscalKytto.certificados ||= {};
  state.fiscalKytto.documentos ||= {};
  state.fiscalKytto.numeracoes ||= {};
  state.fiscalKytto.eventos ||= {};
  state.fiscalKytto.tabelaUf ||= {};
  state.fiscalKytto.tabelasIbpt ||= {};
  state.fiscalKytto.arquivos ||= {};
  state.fiscalKytto.contingencias ||= {};
  return state.fiscalKytto;
}

function gcsBucket() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) throw new Error('Armazenamento fiscal indisponível. Bucket de produção não configurado.');
  return new Storage().bucket(bucketName);
}

function apenasDigitos(value) {
  return String(value || '').replace(/\D/g, '');
}

function cnpjFromCommonName(commonName) {
  const normalized = String(commonName || '').trim();
  // Certificados ICP-Brasil podem exibir o CNPJ do titular no final do CN,
  // com pontuação, barra ou espaços: "Empresa: 12.345.678/0001-90".
  const match = normalized.match(/:\s*([0-9.\-/\s]+)$/);
  const cnpj = apenasDigitos(match?.[1] || '');
  return cnpj.length === 14 ? cnpj : '';
}

function cnpjFromSubject(subject) {
  const match = String(subject || '').match(/(?:CNPJ|OU=|OU\s*=\s*)([0-9.\-/\s]{14,})/i);
  const cnpj = apenasDigitos(match?.[1] || '');
  return cnpj.length === 14 ? cnpj : '';
}

function cnpjDoCertificado(certificado) {
  // O CN identifica o titular do e-CNPJ e deve prevalecer sobre OUs da cadeia
  // ICP-Brasil, que podem conter CNPJs de entidades certificadoras.
  return cnpjFromCommonName(certificado?.commonName) || apenasDigitos(certificado?.cnpj);
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
      // O CN do e-CNPJ identifica o titular; priorizá-lo evita confundir CNPJs
      // presentes em OUs da cadeia ICP-Brasil com o CNPJ do emitente.
      cnpj: cnpjFromCommonName(cn) || cnpjFromSubject(subject) || '',
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
    cnpj: '', ie: '', im: '', cnae: '', razaoSocial: '', nomeFantasia: '', uf: 'MT',
    regimeTributario: 'simples', crt: '1', ambiente: 'homologacao', cscId: '', csc: '',
    serieNfce: 1, serieNfe: 1, proximoNumeroNfce: 1, proximoNumeroNfe: 1,
    naturezaOperacaoNfce: 'VENDA DE MERCADORIA', naturezaOperacaoNfe: 'VENDA DE MERCADORIA',
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
    cnae: text(raw.cnae ?? anterior.cnae, 10).replace(/[^0-9]/g, ''),
    crt: ['1', '2', '3'].includes(String(raw.crt ?? anterior.crt)) ? String(raw.crt ?? anterior.crt) : anterior.crt,
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
    naturezaOperacaoNfce: text(raw.naturezaOperacaoNfce ?? raw.natureza_operacao_nfce ?? anterior.naturezaOperacaoNfce),
    naturezaOperacaoNfe: text(raw.naturezaOperacaoNfe ?? raw.natureza_operacao_nfe ?? anterior.naturezaOperacaoNfe),
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
      id: cert.id, nomeArquivo: cert.nomeArquivo, commonName: cert.commonName, cnpj: cnpjDoCertificado(cert) || cert.cnpj,
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
  else if (cnpjDoCertificado(cert) && config.cnpj && cnpjDoCertificado(cert) !== config.cnpj) pendencias.push('O CNPJ do certificado A1 não corresponde ao CNPJ configurado para a empresa.');
  if (!/^\d{14}$/.test(config.cnpj || '')) pendencias.push('Informe um CNPJ válido com 14 dígitos.');
  try {
    const uf = obterConfiguracaoUf(config.uf || 'MT');
    if (!uf.habilitada) pendencias.push(`A UF ${config.uf} ainda não está habilitada para emissão neste motor fiscal.`);
  } catch (error) {
    pendencias.push(error.message);
  }
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

function chaveNumeracao(tenantId, modelo, serie) {
  return `${tenantKey(tenantId)}:${String(modelo)}:${String(serie)}`;
}

export function listarConfiguracoesUf() {
  const customizadas = fiscalStore().tabelaUf || {};
  return Object.values({ ...TABELA_UF_PADRAO, ...customizadas })
    .map((item) => ({ ...item, modelos: [...(item.modelos || [])] }))
    .sort((a, b) => String(a.uf).localeCompare(String(b.uf)));
}

export function obterConfiguracaoUf(uf = 'MT') {
  const chave = String(uf || 'MT').toUpperCase();
  const encontrada = fiscalStore().tabelaUf?.[chave] || TABELA_UF_PADRAO[chave];
  if (!encontrada) throw new Error(`UF ${chave} ainda não possui configuração fiscal cadastrada.`);
  return { ...encontrada, modelos: [...(encontrada.modelos || [])] };
}

export function obterUrlsNfce(uf = 'MT', ambiente = 'homologacao') {
  const configUf = obterConfiguracaoUf(uf);
  const chaveAmbiente = ambiente === 'producao' ? 'producao' : 'homologacao';
  const qrCodeUrl = configUf.nfce?.qrCode?.[chaveAmbiente];
  const urlChave = configUf.nfce?.consultaChave?.[chaveAmbiente];
  if (!qrCodeUrl || !urlChave) throw new Error(`A UF ${configUf.uf} não possui URLs NFC-e configuradas para ${chaveAmbiente}.`);
  return { qrCodeUrl, urlChave, versaoQrCode: String(configUf.nfce?.qrCode?.versao || '3'), uf: configUf.uf, ambiente: chaveAmbiente };
}

export function reservarNumeracaoFiscal(tenantId = 'principal', modelo = '65') {
  const key = tenantKey(tenantId);
  const modeloNormalizado = String(modelo);
  if (!['55', '65'].includes(modeloNormalizado)) throw new Error('Modelo fiscal deve ser 55 ou 65.');
  const store = fiscalStore();
  const config = store.configuracoes[key] || emptyConfig(key);
  const serie = modeloNormalizado === '65' ? config.serieNfce : config.serieNfe;
  const campoProximo = modeloNormalizado === '65' ? 'proximoNumeroNfce' : 'proximoNumeroNfe';
  const referencia = chaveNumeracao(key, modeloNormalizado, serie);
  const controle = store.numeracoes[referencia] || {
    tenantId: key, modelo: modeloNormalizado, serie, proximoNumero: Math.max(1, Number(config[campoProximo]) || 1),
    atualizadoEm: null,
  };
  const numero = Math.max(1, Number(controle.proximoNumero) || 1);
  controle.proximoNumero = numero + 1;
  controle.atualizadoEm = new Date().toISOString();
  store.numeracoes[referencia] = controle;
  config[campoProximo] = controle.proximoNumero;
  config.updatedAt = new Date().toISOString();
  store.configuracoes[key] = config;
  save();
  return { tenantId: key, modelo: modeloNormalizado, serie, numero, referencia };
}

export function criarDocumentoFiscalRascunho(tenantId = 'principal', venda = {}, { modelo = '65', origemId = null } = {}) {
  const key = tenantKey(tenantId);
  const modeloNormalizado = String(modelo);
  const configResposta = obterConfiguracaoFiscal(key);
  if (!configResposta.preflight.pronto) throw new Error(`Emissão bloqueada: ${configResposta.preflight.pendencias.join(' ')}`);
  const configuracaoUf = obterConfiguracaoUf(configResposta.uf);
  if (!configuracaoUf.habilitada || !configuracaoUf.modelos.includes(modeloNormalizado)) {
    throw new Error(`O modelo ${modeloNormalizado} ainda não está habilitado para a UF ${configResposta.uf}.`);
  }
  const store = fiscalStore();
  if (origemId) {
    const existente = Object.values(store.documentos).find((documento) =>
      documento.tenantId === key && documento.modelo === modeloNormalizado && documento.origemId === String(origemId)
        && !['cancelado', 'inutilizado'].includes(documento.status),
    );
    if (existente) return existente;
  }
  const numeracao = reservarNumeracaoFiscal(key, modeloNormalizado);
  const criadoEm = new Date().toISOString();
  const codigoNumerico = String(crypto.randomInt(0, 100000000)).padStart(8, '0');
  const chaveAcesso = gerarChaveAcessoFiscal({
    uf: configResposta.uf, dhEmi: criadoEm, cnpj: configResposta.cnpj, modelo: modeloNormalizado,
    serie: numeracao.serie, numero: numeracao.numero, codigoNumerico,
  });
  const id = `fiscal-${modeloNormalizado}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const documento = {
    id, tenantId: key, origemId: origemId ? String(origemId) : null,
    tipo: modeloNormalizado === '65' ? 'NFC-e' : 'NF-e', modelo: modeloNormalizado,
    status: 'rascunho', ambiente: configResposta.ambiente,
    serie: numeracao.serie, numero: numeracao.numero, codigoNumerico, chaveAcesso,
    versaoLayout: configuracaoUf.versaoLayout, uf: configResposta.uf,
    valorTotal: Number(venda.valorTotal || venda.total || 0), itens: Array.isArray(venda.itens) ? venda.itens : [],
    pagamentos: Array.isArray(venda.pagamentos) ? venda.pagamentos : [],
    tributos: {}, eventos: [], criadoEm, atualizadoEm: criadoEm,
  };
  store.documentos[id] = documento;
  save();
  registrarEventoFiscal(key, id, 'rascunho_criado', { origemId: documento.origemId, referenciaNumeracao: numeracao.referencia });
  return documento;
}

export function registrarPreflightEmissao(tenantId = 'principal', venda = {}) {
  return criarDocumentoFiscalRascunho(tenantId, venda, { modelo: '65', origemId: venda.origemId || venda.comandaId || venda.vendaId || null });
}

export function atualizarDocumentoFiscalRascunho(tenantId = 'principal', documentoId, atualizacao = {}) {
  const key = tenantKey(tenantId);
  const store = fiscalStore();
  const documento = store.documentos[documentoId];
  if (!documento || documento.tenantId !== key) throw new Error('Documento fiscal não encontrado para esta empresa.');
  if (!['rascunho', 'validado_local', 'rejeitado_local'].includes(documento.status)) {
    throw new Error(`O documento no status ${documento.status} não pode ser alterado localmente.`);
  }
  const jaArquivado = Object.values(store.arquivos || {}).some((arquivo) => arquivo.tenantId === key && arquivo.documentoId === documentoId && arquivo.tipo === 'xml_assinado');
  if (jaArquivado) throw new Error('O XML possui guarda legal registrada e não pode mais ser alterado localmente.');
  const camposPermitidos = ['itens', 'pagamentos', 'tributos', 'valorTotal', 'xmlBruto', 'xmlAssinado', 'hashXmlAssinado', 'schema', 'validacao', 'destinatario', 'tipo', 'modelo'];
  for (const campo of camposPermitidos) {
    if (atualizacao[campo] !== undefined) documento[campo] = atualizacao[campo];
  }
  documento.status = atualizacao.status === 'rejeitado_local' ? 'rejeitado_local' : 'validado_local';
  documento.atualizadoEm = new Date().toISOString();
  save();
  registrarEventoFiscal(key, documentoId, documento.status === 'validado_local' ? 'xml_validado_localmente' : 'xml_rejeitado_localmente', {
    schemaVersao: documento.schema?.versao || null,
    hashXmlAssinado: documento.hashXmlAssinado || null,
    erros: Array.isArray(documento.validacao?.erros) ? documento.validacao.erros.slice(0, 12) : [],
  });
  return { ...documento };
}

export function registrarEventoFiscal(tenantId = 'principal', documentoId, tipo, detalhes = {}) {
  const key = tenantKey(tenantId);
  const store = fiscalStore();
  const documento = store.documentos[documentoId];
  if (!documento || documento.tenantId !== key) throw new Error('Documento fiscal não encontrado para esta empresa.');
  const eventoId = `evento-fiscal-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const evento = {
    id: eventoId, documentoId, tenantId: key, tipo: String(tipo || 'evento'),
    detalhes: detalhes && typeof detalhes === 'object' ? { ...detalhes } : {}, criadoEm: new Date().toISOString(),
  };
  store.eventos[eventoId] = evento;
  documento.eventos ||= [];
  documento.eventos.push(eventoId);
  documento.atualizadoEm = evento.criadoEm;
  save();
  return evento;
}

export function listarEventosFiscais(tenantId = 'principal', documentoId = null) {
  const key = tenantKey(tenantId);
  return Object.values(fiscalStore().eventos)
    .filter((evento) => evento.tenantId === key && (!documentoId || evento.documentoId === documentoId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

function normalizarLinhaIbpt(raw = {}) {
  const ncm = somenteDigitos(raw.ncm || raw.codigoNcm || raw.codigo || '').slice(0, 8);
  const nacional = Math.min(100, Math.max(0, Number(raw.nacional ?? raw.aliquotaNacional ?? raw.percentualNacional ?? 0) || 0));
  const importado = Math.min(100, Math.max(0, Number(raw.importado ?? raw.aliquotaImportado ?? raw.percentualImportado ?? 0) || 0));
  return { ncm, nacional, importado, descricao: String(raw.descricao || raw.ex || '').trim().slice(0, 300) };
}

export function importarTabelaIbpt(tenantId = 'principal', { versao, vigenciaInicio, vigenciaFim, linhas = [] } = {}) {
  const key = tenantKey(tenantId);
  const versaoNormalizada = String(versao || '').trim().slice(0, 80);
  if (!versaoNormalizada) throw new Error('Informe a versão de referência da tabela IBPT.');
  if (!Array.isArray(linhas) || !linhas.length) throw new Error('Informe ao menos uma linha válida da tabela IBPT.');
  const registros = linhas.map(normalizarLinhaIbpt).filter((linha) => linha.ncm.length === 8);
  if (!registros.length) throw new Error('A tabela IBPT não possui NCMs válidos com 8 dígitos.');
  const deduplicado = Object.fromEntries(registros.map((linha) => [linha.ncm, linha]));
  const store = fiscalStore();
  store.tabelasIbpt[key] ||= [];
  const tabela = {
    id: `ibpt-${key}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    tenantId: key, versao: versaoNormalizada,
    vigenciaInicio: vigenciaInicio ? new Date(vigenciaInicio).toISOString() : null,
    vigenciaFim: vigenciaFim ? new Date(vigenciaFim).toISOString() : null,
    linhas: deduplicado, quantidadeLinhas: Object.keys(deduplicado).length,
    criadaEm: new Date().toISOString(), ativa: true,
  };
  for (const existente of store.tabelasIbpt[key]) existente.ativa = false;
  store.tabelasIbpt[key].push(tabela);
  save();
  return { ...tabela, linhas: undefined };
}

export function listarTabelasIbpt(tenantId = 'principal') {
  const key = tenantKey(tenantId);
  return (fiscalStore().tabelasIbpt[key] || [])
    .map(({ linhas, ...tabela }) => ({ ...tabela }))
    .sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));
}

export function obterAliquotasIbpt(tenantId = 'principal', ncm) {
  const key = tenantKey(tenantId);
  const codigo = somenteDigitos(ncm).slice(0, 8);
  const tabela = (fiscalStore().tabelasIbpt[key] || []).find((item) => item.ativa);
  const linha = tabela?.linhas?.[codigo];
  return linha ? { nacional: Number(linha.nacional || 0), importado: Number(linha.importado || 0), versao: tabela.versao, ncm: codigo } : null;
}

export function arquivarDocumentoFiscal(tenantId = 'principal', documentoId) {
  const key = tenantKey(tenantId);
  const store = fiscalStore();
  const documento = store.documentos[documentoId];
  if (!documento || documento.tenantId !== key) throw new Error('Documento fiscal não encontrado para arquivamento.');
  if (!documento.xmlAssinado || !documento.hashXmlAssinado) throw new Error('Somente XML assinado e validado localmente pode ser arquivado.');
  const existente = Object.values(store.arquivos).find((arquivo) => arquivo.tenantId === key && arquivo.documentoId === documentoId && arquivo.tipo === 'xml_assinado');
  if (existente) return { ...existente };
  const agora = new Date();
  const retencaoAte = new Date(agora);
  retencaoAte.setUTCFullYear(retencaoAte.getUTCFullYear() + 5);
  const arquivo = {
    id: `arquivo-fiscal-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    tenantId: key, documentoId, tipo: 'xml_assinado', hashSha256: documento.hashXmlAssinado,
    tamanhoBytes: Buffer.byteLength(documento.xmlAssinado, 'utf8'), criadoEm: agora.toISOString(),
    retencaoAte: retencaoAte.toISOString(), armazenamento: process.env.GCS_BUCKET ? 'gcs_db_replicado' : 'local_teste',
    imutavel: true,
  };
  store.arquivos[arquivo.id] = arquivo;
  save();
  registrarEventoFiscal(key, documentoId, 'arquivo_legal_registrado', { arquivoId: arquivo.id, hashSha256: arquivo.hashSha256, retencaoAte: arquivo.retencaoAte });
  return { ...arquivo };
}

export function listarArquivosFiscais(tenantId = 'principal', documentoId = null) {
  const key = tenantKey(tenantId);
  return Object.values(fiscalStore().arquivos)
    .filter((arquivo) => arquivo.tenantId === key && (!documentoId || arquivo.documentoId === documentoId))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((arquivo) => ({ ...arquivo }));
}

const EVENTOS_INTERNOS_PERMITIDOS = new Set(['intencao_cancelamento', 'intencao_cce', 'intencao_inutilizacao', 'contingencia_ativada', 'contingencia_resolvida', 'reprocessamento_local']);

export function registrarEventoInternoFiscal(tenantId = 'principal', documentoId, tipo, detalhes = {}) {
  if (!EVENTOS_INTERNOS_PERMITIDOS.has(String(tipo))) throw new Error('Tipo de evento interno fiscal não permitido.');
  const evento = registrarEventoFiscal(tenantId, documentoId, String(tipo), { ...detalhes, natureza: 'interna_sem_efeito_sefaz' });
  return { ...evento, natureza: 'interna_sem_efeito_sefaz' };
}

export function enfileirarContingenciaFiscal(tenantId = 'principal', documentoId, { motivo, tipo = 'offline', usuario = null } = {}) {
  const key = tenantKey(tenantId);
  const store = fiscalStore();
  const documento = store.documentos[documentoId];
  if (!documento || documento.tenantId !== key) throw new Error('Documento fiscal não encontrado para contingência.');
  if (!documento.xmlAssinado || documento.status !== 'validado_local') throw new Error('A contingência interna exige rascunho assinado e validado localmente.');
  const existente = Object.values(store.contingencias).find((item) => item.tenantId === key && item.documentoId === documentoId && item.status === 'pendente');
  if (existente) return { ...existente };
  const registro = {
    id: `contingencia-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    tenantId: key, documentoId, tipo: String(tipo || 'offline').slice(0, 40), motivo: String(motivo || 'Falha de comunicação registrada pelo operador.').trim().slice(0, 500),
    status: 'pendente', tentativas: 0, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
    usuario: String(usuario || '').trim().slice(0, 160) || null,
    bloqueio: 'Nenhuma transmissão automática é realizada; requer homologação e ação explícita futura.',
  };
  store.contingencias[registro.id] = registro;
  save();
  registrarEventoInternoFiscal(key, documentoId, 'contingencia_ativada', { contingenciaId: registro.id, motivo: registro.motivo, tipo: registro.tipo });
  return { ...registro };
}

export function listarContingenciasFiscais(tenantId = 'principal', { status = null } = {}) {
  const key = tenantKey(tenantId);
  return Object.values(fiscalStore().contingencias)
    .filter((item) => item.tenantId === key && (!status || item.status === status))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map((item) => ({ ...item }));
}

export function resolverContingenciaInterna(tenantId = 'principal', contingenciaId, { observacao = '', usuario = null } = {}) {
  const key = tenantKey(tenantId);
  const store = fiscalStore();
  const registro = store.contingencias[contingenciaId];
  if (!registro || registro.tenantId !== key) throw new Error('Registro de contingência não encontrado.');
  if (registro.status === 'resolvida') return { ...registro };
  registro.status = 'resolvida';
  registro.resolvidaEm = new Date().toISOString();
  registro.atualizadoEm = registro.resolvidaEm;
  registro.observacaoResolucao = String(observacao || '').trim().slice(0, 500) || null;
  registro.usuarioResolucao = String(usuario || '').trim().slice(0, 160) || null;
  save();
  registrarEventoInternoFiscal(key, registro.documentoId, 'contingencia_resolvida', { contingenciaId: registro.id, observacao: registro.observacaoResolucao });
  return { ...registro };
}

export function obterObservabilidadeFiscal(tenantId = 'principal') {
  const key = tenantKey(tenantId);
  const documentos = listarDocumentos(key);
  const arquivos = listarArquivosFiscais(key);
  const contingencias = listarContingenciasFiscais(key);
  const eventos = listarEventosFiscais(key);
  const certificados = Object.values(fiscalStore().certificados).filter((certificado) => certificado.tenantId === key && certificado.ativo);
  const certificado = certificados.sort((a, b) => String(b.validTo).localeCompare(String(a.validTo)))[0] || null;
  const diasCertificado = certificado?.validTo ? Math.floor((new Date(certificado.validTo).valueOf() - Date.now()) / 86400000) : null;
  const documentosAssinados = documentos.filter((documento) => Boolean(documento.xmlAssinado));
  const documentosArquivados = new Set(arquivos.filter((arquivo) => arquivo.tipo === 'xml_assinado').map((arquivo) => arquivo.documentoId));
  const pendentesArquivo = documentosAssinados.filter((documento) => !documentosArquivados.has(documento.id));
  return {
    tenantId: key, geradoEm: new Date().toISOString(),
    documentos: { total: documentos.length, rascunhos: documentos.filter((doc) => doc.status === 'rascunho').length, validadosLocalmente: documentos.filter((doc) => doc.status === 'validado_local').length, rejeitadosLocalmente: documentos.filter((doc) => doc.status === 'rejeitado_local').length },
    arquivoLegal: { total: arquivos.length, documentosAssinados: documentosAssinados.length, pendentesArquivo: pendentesArquivo.length, conforme: pendentesArquivo.length === 0 },
    contingencia: { pendentes: contingencias.filter((item) => item.status === 'pendente').length, resolvidas: contingencias.filter((item) => item.status === 'resolvida').length, transmissaoAutomatica: false },
    certificado: certificado ? { id: certificado.id, validoAte: certificado.validTo, diasParaExpirar: diasCertificado, alerta: diasCertificado !== null && diasCertificado <= 30 } : { alerta: true, motivo: 'Nenhum certificado ativo.' },
    eventos: { total: eventos.length, ultimos: eventos.slice(0, 10) },
  };
}

export function listarDocumentos(tenantId = 'principal') {
  const key = tenantKey(tenantId);
  return Object.values(fiscalStore().documentos)
    .filter(doc => doc.tenantId === key)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

// Migra o vínculo lógico de um tenant legado para a empresa padrão. O arquivo
// cifrado permanece no mesmo objeto privado do GCS; somente os metadados e a
// autorização de acesso são realocados de forma idempotente.
export function migrarTenant(origem, destino) {
  const store = fiscalStore();
  const sourceKey = tenantKey(origem);
  const targetKey = tenantKey(destino);
  if (sourceKey === targetKey || store.configuracoes[targetKey]) return false;
  const origemConfig = store.configuracoes[sourceKey];
  if (!origemConfig) return false;
  store.configuracoes[targetKey] = { ...origemConfig, tenantId: targetKey, updatedAt: new Date().toISOString() };
  delete store.configuracoes[sourceKey];
  for (const certificado of Object.values(store.certificados)) {
    if (certificado.tenantId === sourceKey) certificado.tenantId = targetKey;
  }
  for (const documento of Object.values(store.documentos)) {
    if (documento.tenantId === sourceKey) documento.tenantId = targetKey;
  }
  save();
  return true;
}

export function limparDadosSensiveis(config) {
  if (!config) return config;
  const { csc, ...safe } = config;
  return { ...safe, cscConfigurado: Boolean(csc) };
}

export default {
  calcularDigitoVerificadorChave, gerarChaveAcessoFiscal, validarChaveAcessoFiscal,
  obterConfiguracaoFiscal, salvarConfiguracaoFiscal, importarCertificadoA1,
  listarCertificados, ativarCertificado, verificarProntidao, carregarMaterialAtivo,
  listarConfiguracoesUf, obterConfiguracaoUf, obterUrlsNfce, reservarNumeracaoFiscal,
  criarDocumentoFiscalRascunho, registrarPreflightEmissao, atualizarDocumentoFiscalRascunho, registrarEventoFiscal,
  listarEventosFiscais, registrarEventoInternoFiscal, enfileirarContingenciaFiscal, listarContingenciasFiscais, resolverContingenciaInterna,
  arquivarDocumentoFiscal, listarArquivosFiscais, obterObservabilidadeFiscal, importarTabelaIbpt, listarTabelasIbpt, obterAliquotasIbpt,
  listarDocumentos, migrarTenant, limparDadosSensiveis,
};
