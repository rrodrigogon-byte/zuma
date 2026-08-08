/**
 * Service: Fiscal Nacional Completo (ADAPTADO PARA JSON)
 * SetPoint Kytto — NFC-e, NF-e, Certificado A1, Contingência
 * Persistência: db.json (GCS) em vez de PostgreSQL
 */

import { db } from '../../core/database.js';
import * as motor from '../../core/fiscal-nfe.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERT_DIR = path.join(__dirname, '../../data/certificados');

// ============================================================================
// CONFIGURAÇÃO FISCAL DO TENANT E CERTIFICADO
// ============================================================================

export async function obterConfigFiscal(tenantId) {
  const dados = db();
  if (!dados.fiscal) dados.fiscal = {};
  if (!dados.fiscal.config) dados.fiscal.config = {};
  return dados.fiscal.config[tenantId] || null;
}

export async function salvarConfigFiscal(tenantId, dados) {
  const dbData = db();
  if (!dbData.fiscal) dbData.fiscal = {};
  if (!dbData.fiscal.config) dbData.fiscal.config = {};

  const config = {
    tenant_id: tenantId,
    cnpj: dados.cnpj,
    ie: dados.ie,
    im: dados.im,
    razao_social: dados.razao_social,
    nome_fantasia: dados.nome_fantasia,
    regime_tributario: dados.regime_tributario || 'simples',
    ambiente: dados.ambiente || 'homologacao',
    uf: dados.uf,
    csc_id: dados.csc_id,
    csc: dados.csc,
    serie_nfce: dados.serie_nfce || 1,
    serie_nfe: dados.serie_nfe || 1,
    proximo_numero_nfce: dados.proximo_numero_nfce || 1,
    proximo_numero_nfe: dados.proximo_numero_nfe || 1,
    certificado_valido: false,
    updated_at: new Date().toISOString()
  };

  dbData.fiscal.config[tenantId] = config;
  await require('../../db.js').save();
  return config;
}

/**
 * Upload e armazenamento seguro do certificado A1
 * O certificado é armazenado criptografado no db.json
 */
export async function uploadCertificadoA1(tenantId, base64Pfx, senha) {
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

  const pfxPath = path.join(CERT_DIR, `cert_${tenantId}.pfx`);
  const pfxBuffer = Buffer.from(base64Pfx, 'base64');
  fs.writeFileSync(pfxPath, pfxBuffer);

  // Testar leitura e extração para garantir que a senha está correta
  try {
    motor.assinarXml('<test/>', pfxBuffer, senha);
  } catch (err) {
    fs.unlinkSync(pfxPath);
    throw new Error('Certificado inválido ou senha incorreta: ' + err.message);
  }

  // Criptografar certificado em repouso (AES-256-GCM)
  const chave = crypto.scryptSync(senha, 'setpoint-fiscal-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave, iv);
  let encrypted = cipher.update(pfxBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Armazenar no db.json
  const dbData = db();
  if (!dbData.fiscal) dbData.fiscal = {};
  if (!dbData.fiscal.certificados) dbData.fiscal.certificados = {};

  dbData.fiscal.certificados[tenantId] = {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    uploaded_at: new Date().toISOString()
  };

  // Marcar configuração como válida
  if (dbData.fiscal.config && dbData.fiscal.config[tenantId]) {
    dbData.fiscal.config[tenantId].certificado_valido = true;
  }

  await require('../../db.js').save();

  return { sucesso: true, mensagem: 'Certificado A1 configurado com sucesso' };
}

/**
 * Recuperar certificado descriptografado para uso em operações fiscais
 */
export async function obterCertificadoDescriptografado(tenantId, senha) {
  const dbData = db();
  if (!dbData.fiscal || !dbData.fiscal.certificados || !dbData.fiscal.certificados[tenantId]) {
    throw new Error('Certificado não encontrado');
  }

  const certData = dbData.fiscal.certificados[tenantId];
  const chave = crypto.scryptSync(senha, 'setpoint-fiscal-salt', 32);
  const iv = Buffer.from(certData.iv, 'base64');
  const authTag = Buffer.from(certData.authTag, 'base64');
  const encrypted = Buffer.from(certData.encrypted, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', chave, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  } catch (err) {
    throw new Error('Senha de certificado incorreta ou certificado corrompido');
  }
}

// ============================================================================
// EMISSÃO DE NFC-e (MOTOR PRÓPRIO)
// ============================================================================

export async function emitirNFCe(tenantId, dadosVenda, senhaCertificado) {
  const config = await obterConfigFiscal(tenantId);
  if (!config || !config.certificado_valido) {
    throw new Error('Configuração fiscal ou certificado ausente');
  }

  // Obter certificado descriptografado
  const pfxBuffer = await obterCertificadoDescriptografado(tenantId, senhaCertificado);

  // Obter próximo número
  const dbData = db();
  if (!dbData.fiscal.config[tenantId]) throw new Error('Configuração não encontrada');

  const numero = dbData.fiscal.config[tenantId].proximo_numero_nfce;
  dbData.fiscal.config[tenantId].proximo_numero_nfce += 1;

  // Gerar Chave de Acesso
  const codigoAleatorio = Math.floor(Math.random() * 99999999);
  const ufCodigo = '28'; // MT (Mato Grosso)
  const anoMes = new Date().toISOString().slice(2, 7).replace('-', '');
  const chaveAcesso = motor.gerarChaveAcesso({
    uf: ufCodigo,
    dhEmi: anoMes,
    cnpj: config.cnpj,
    modelo: '65',
    serie: config.serie_nfce,
    nNF: numero,
    tpEmis: '1',
    cNF: codigoAleatorio
  });

  // Registrar documento
  if (!dbData.fiscal.documentos) dbData.fiscal.documentos = {};

  const docId = `nfce_${tenantId}_${numero}`;
  const documento = {
    id: docId,
    tenant_id: tenantId,
    tipo: 'nfce',
    numero: numero,
    serie: config.serie_nfce,
    status: 'processando',
    ambiente: config.ambiente,
    valor_total: dadosVenda.valor_total,
    destinatario_nome: dadosVenda.destinatario_nome,
    destinatario_cpf_cnpj: dadosVenda.destinatario_cpf,
    chave_acesso: chaveAcesso,
    created_at: new Date().toISOString(),
    xml_assinado: null,
    protocolo: null,
    qrcode: null
  };

  dbData.fiscal.documentos[docId] = documento;
  await require('../../db.js').save();

  // Emissão Assíncrona (não bloqueia a resposta)
  setImmediate(async () => {
    try {
      const xmlGerado = motor.montarXmlNFe({
        chaveAcesso,
        numero,
        serie: config.serie_nfce,
        cnpj: config.cnpj,
        ie: config.ie,
        razaoSocial: config.razao_social,
        nomeFantasia: config.nome_fantasia,
        uf: config.uf,
        itens: dadosVenda.itens,
        valor_total: dadosVenda.valor_total,
        ambiente: config.ambiente
      });

      const xmlAssinado = motor.assinarXml(xmlGerado, pfxBuffer, senhaCertificado);
      documento.xml_assinado = xmlAssinado;
      documento.status = 'assinado';

      // Transmitir para SEFAZ (se em produção)
      if (config.ambiente === 'producao') {
        const resultado = await motor.transmitirNFe(xmlAssinado, config, '65', config.ambiente);
        documento.protocolo = resultado.protocolo;
        documento.status = resultado.status;
      } else {
        documento.status = 'homologacao';
      }

      await require('../../db.js').save();
    } catch (err) {
      documento.status = 'erro';
      documento.erro = err.message;
      await require('../../db.js').save();
    }
  });

  return { sucesso: true, documento, mensagem: 'NFC-e em processamento' };
}

// ============================================================================
// CONSULTA DE DOCUMENTOS
// ============================================================================

export async function listarDocumentos(tenantId, filtro = {}) {
  const dbData = db();
  if (!dbData.fiscal || !dbData.fiscal.documentos) return [];

  const docs = Object.values(dbData.fiscal.documentos).filter(d => d.tenant_id === tenantId);

  if (filtro.tipo) docs = docs.filter(d => d.tipo === filtro.tipo);
  if (filtro.status) docs = docs.filter(d => d.status === filtro.status);

  return docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function obterDocumento(tenantId, docId) {
  const dbData = db();
  if (!dbData.fiscal || !dbData.fiscal.documentos) return null;

  const doc = dbData.fiscal.documentos[docId];
  if (!doc || doc.tenant_id !== tenantId) return null;

  return doc;
}

// ============================================================================
// CANCELAMENTO E INUTILIZAÇÃO
// ============================================================================

export async function cancelarNFCe(tenantId, docId, justificativa, senhaCertificado) {
  const doc = await obterDocumento(tenantId, docId);
  if (!doc) throw new Error('Documento não encontrado');
  if (doc.status !== 'autorizado') throw new Error('Apenas documentos autorizados podem ser cancelados');

  const config = await obterConfigFiscal(tenantId);
  const pfxBuffer = await obterCertificadoDescriptografado(tenantId, senhaCertificado);

  try {
    const resultado = await motor.cancelarNFe({
      empresa: config,
      chave_acesso: doc.chave_acesso,
      protocolo: doc.protocolo,
      justificativa,
      pfxBuffer,
      senha: senhaCertificado,
      ambiente: config.ambiente
    });

    doc.status = 'cancelado';
    doc.justificativa_cancelamento = justificativa;
    doc.cancelamento_protocolo = resultado.protocolo;
    doc.cancelado_em = new Date().toISOString();

    await require('../../db.js').save();
    return { sucesso: true, documento: doc };
  } catch (err) {
    throw new Error('Erro ao cancelar NFC-e: ' + err.message);
  }
}

export default {
  obterConfigFiscal,
  salvarConfigFiscal,
  uploadCertificadoA1,
  obterCertificadoDescriptografado,
  emitirNFCe,
  listarDocumentos,
  obterDocumento,
  cancelarNFCe
};
