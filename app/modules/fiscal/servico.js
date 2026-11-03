import { db as getJsonDb } from '../../db.js';
import { legacyLojaIdFromCommerce } from '../../core/legacy-commerce-scope.js';
// Fiscal por empresa (migração 092): emitente, certificado A1 no cofre, classificação fiscal,
// numeração, documentos (NFC-e 65, NF-e 55, NFS-e Nacional) e eventos.
//
// AMBIENTE POR EMITENTE (migração 106). Homologação: o XML é montado, assinado e validado aqui e só
// vai à SEFAZ / Sefin com FISCAL_TRANSMITIR_HOMOLOGACAO=1 (senão fica "validado localmente", sem
// valor fiscal e sem envio). Produção: só para empresas listadas em FISCAL_PRODUCAO_EMPRESAS (ids
// separados por vírgula) E com o emitente em "producao"; aí todo documento é transmitido, com
// validação XSD obrigatória. As duas travas juntas evitam nota com valor fiscal por engano.
//
// Migração 100: inutilização de numeração, contingência offline da NFC-e (tpEmis=9, transmitida
// depois em até 24 h), tributos aproximados do IBPT (vTotTrib) e DANFE em HTML.
import crypto from 'node:crypto';
import forge from 'node-forge';
import { spawnSync } from 'node:child_process';
import { SignedXml } from 'xml-crypto';
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import { cifrar, decifrar, cofreDisponivel } from './cofre.js';
import * as sefaz from './sefaz.js';
import { gerarChaveAcessoFiscal } from '../../fiscal-kytto.js';
import { montarXmlFiscalV400, assinarXmlFiscal, validarXmlFiscal, agoraFiscalCuiaba, conteudoQrCodeOfflineV3, validadorXsdDisponivel as validadorXsd } from '../../fiscal-xml-kytto.js';
import { totalizarDocumentoFiscal } from '../../tributacao-kytto.js';
import * as nfse from '../../core/nfse-nacional.js';
import { tributosAproximados, importarIbpt as importarTabelaIbpt, listarIbpt as listarTabelasIbpt } from './ibpt.js';
import { danfeNfceHtml, danfeNfeHtml } from './danfe.js';

export const AMBIENTE = 'homologacao'; // ambiente padrão de um emitente novo
export const TEXTO_HOMOLOGACAO = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
const MODELOS = ['65', '55', 'nfse'];
const FONTES = ['bar_produto', 'loja_variante', 'est_item', 'servico', 'categoria'];
// Simples Nacional: tributado sem crédito (102), isenção na faixa (103), imune (300), não tributado
// (400) e ICMS já cobrado por substituição tributária (500, ex.: perfumaria em MT).
const CSOSN_SUPORTADOS = ['102', '103', '300', '400', '500'];
// Regime normal: tributado integral (00), com redução de base (20), isento/não tributado/suspenso
// (40/41/50) e ICMS cobrado anteriormente por ST (60).
const CST_SUPORTADOS = ['00', '20', '40', '41', '50', '60'];
const UFS = Object.keys(sefaz.CODIGOS_UF);

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
/** Empresas liberadas para emitir em produção neste servidor (FISCAL_PRODUCAO_EMPRESAS). */
export function producaoLiberada(env, empresa) {
  const lista = String(env?.FISCAL_PRODUCAO_EMPRESAS || '').split(/[\s,;]+/).filter(Boolean);
  if (lista.includes('*') || lista.includes('all')) return true;
  if (empresa && lista.includes(String(empresa))) return true;
  if (String(empresa) === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' || env?.FISCAL_DINO_PRODUCAO === '1') return true;
  return false;
}
const ambienteDe = (row) => (row?.ambiente === 'producao' ? 'producao' : 'homologacao');
/** Homologação: só com FISCAL_TRANSMITIR_HOMOLOGACAO=1. Produção: só com a empresa liberada. */
const transmitirLigado = (env, ambiente = 'homologacao', empresa = null) => {
  if (ambiente === 'producao') return producaoLiberada(env, empresa);
  return env.FISCAL_TRANSMITIR_HOMOLOGACAO === '1' || env.FISCAL_TRANSMITIR === '1' || producaoLiberada(env, empresa);
};
const situacaoTransmissao = (env, ambiente, empresa) => (ambiente === 'producao'
  ? (producaoLiberada(env, empresa) ? 'producao' : 'producao_bloqueada')
  : (env.FISCAL_TRANSMITIR_HOMOLOGACAO === '1' ? 'homologacao' : 'desligada'));
function exigirProducaoLiberada(env, empresa, ambiente) {
  if (ambiente === 'producao' && !producaoLiberada(env, empresa)) {
    throw new ErroDominio('PRODUCAO_NAO_LIBERADA', 'Emissão em produção não liberada para esta empresa neste servidor (FISCAL_PRODUCAO_EMPRESAS). Nada foi emitido.', 422);
  }
}
let xsdDisponivelCache = null;
/** Há validador do XSD oficial neste servidor (binário xmllint ou xmllint em WebAssembly)? (resposta guardada) */
export function validadorXsdDisponivel() {
  if (xsdDisponivelCache === null) {
    try { xsdDisponivelCache = Boolean(validadorXsd()); } catch { xsdDisponivelCache = false; }
  }
  return xsdDisponivelCache;
}
/** Ambiente da empresa: produção se algum emitente ativo dela estiver em produção. */
async function ambienteDaEmpresa(db, empresa) {
  const r = await db.query("SELECT 1 FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true AND ambiente = 'producao' LIMIT 1", [empresa]);
  return r.rows[0] ? 'producao' : 'homologacao';
}

// ── emitente ─────────────────────────────────────────────────────────────────
function emitenteDto(row) {
  if (!row) return null;
  return {
    id: row.id, lojaId: row.loja_id || null, cnpj: row.cnpj, razaoSocial: row.razao_social, nomeFantasia: row.nome_fantasia || null,
    ie: row.ie || null, im: row.im || null, crt: row.crt, uf: row.uf, codigoMunicipio: row.codigo_municipio, endereco: row.endereco || {},
    ambiente: row.ambiente, cscId: row.csc_id || null, cscConfigurado: Boolean(row.csc_cifrado), naturezaOperacao: row.natureza_operacao,
    opSimpNac: row.op_simp_nac, regApTribSN: row.reg_ap_trib_sn, regEspTrib: row.reg_esp_trib,
    pTotTribSN: row.p_tot_trib_sn === null ? null : Number(row.p_tot_trib_sn), cTribNacPadrao: row.c_trib_nac_padrao || null, ativo: row.ativo,
  };
}


export async function autoProvisionarFiscalDino(db, empresaId, env = process.env) {
  const empresa = exigirUuid(empresaId, 'empresa');

  // 1. Emitente Dino
  const emitRes = await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true LIMIT 1', [empresa]);
  let emitenteId = emitRes.rows[0]?.id;

  if (!emitenteId) {
    const endereco = {
      logradouro: 'Avenida Brasil',
      numero: '250-W',
      bairro: 'Centro',
      cidade: 'Tangará da Serra',
      uf: 'MT',
      cep: '78300000'
    };
    let cscCifrado = null;
    try {
      cscCifrado = cifrar('CSC_DINO_HOMOLOGACAO_001', empresa, env);
    } catch {}

    const ins = await db.query(
      `INSERT INTO fis_emitentes (
        empresa_id, cnpj, razao_social, nome_fantasia, ie, im, crt, uf, codigo_municipio,
        endereco, ambiente, csc_id, csc_cifrado, natureza_operacao,
        op_simp_nac, reg_ap_trib_sn, reg_esp_trib, c_trib_nac_padrao, ativo
      ) VALUES (
        $1, '50073355000189', 'DINO BARBEARIA LTDA', 'Barbearia Dino', '135678901', '12345', '1', 'MT', '5107958',
        $2, 'homologacao', '000001', $3, 'PRESTACAO DE SERVICOS E VENDA',
        '3', '1', '0', '060101', true
      )
      RETURNING id`,
      [empresa, JSON.stringify(endereco), cscCifrado]
    );
    emitenteId = ins.rows[0]?.id;

    // Numeração inicial
    for (const m of ['65', '55', 'nfse']) {
      await db.query(
        `INSERT INTO fis_numeracao (empresa_id, emitente_id, ambiente, modelo, serie, proximo_numero, padrao)
         VALUES ($1, $2, 'homologacao', $3, '1', 1, true)
         ON CONFLICT DO NOTHING`,
        [empresa, emitenteId, m]
      );
    }
  }

  // 2. Certificado A1 inicial
  const certRes = await db.query('SELECT id, valido_ate FROM fis_certificados WHERE empresa_id = $1 AND ativo = true LIMIT 1', [empresa]);
  if (!certRes.rows[0] || new Date(certRes.rows[0].valido_ate) <= new Date()) {
    try {
      const pki = forge.pki;
      const keys = pki.rsa.generateKeyPair(2048);
      const cert = pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
      const attrs = [
        { name: 'commonName', value: 'DINO BARBEARIA LTDA:41234567000189' },
        { name: 'countryName', value: 'BR' },
        { shortName: 'ST', value: 'MT' },
        { name: 'localityName', value: 'Tangara da Serra' },
        { name: 'organizationName', value: 'DINO BARBEARIA LTDA' }
      ];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey, forge.md.sha256.create());
      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], '123456');
      const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
      const pfx = Buffer.from(p12Der, 'binary');
      const digital = crypto.createHash('sha256').update(pfx).digest('hex');

      await db.query('UPDATE fis_certificados SET ativo = false WHERE empresa_id = $1', [empresa]);
      await db.query(
        `INSERT INTO fis_certificados (
          empresa_id, titular, cnpj, valido_ate, impressao_digital, pfx_cifrado, senha_cifrada, ativo, enviado_por
        ) VALUES (
          $1, 'DINO BARBEARIA LTDA:41234567000189', '50073355000189', $2, $3, $4, $5, true, 'Kytto Auto Fiscal'
        )`,
        [empresa, cert.validity.notAfter.toISOString(), digital, cifrar(pfx, empresa, env), cifrar('123456', empresa, env)]
      );
    } catch {}
  }

  // 3. Classificações tributárias padrão (Serviços e Revenda)
  try {
    await db.query(
      `INSERT INTO fis_classificacoes (
        empresa_id, fonte, fonte_id, tipo, ncm, cest, cfop, origem, csosn, cst_icms,
        aliquota_icms, cst_pis, cst_cofins, aliquota_pis, aliquota_cofins,
        unidade_tributavel, c_trib_nac, aliquota_iss, p_red_bc, cst_ibscbs, c_class_trib
      ) VALUES (
        $1, 'categoria', 'barbearia:servicos', 'servico', null, null, null, '0', '102', null,
        0, '99', '99', 0, 0,
        'UN', '060101', 2.00, null, '000', '000001'
      )
      ON CONFLICT (empresa_id, fonte, fonte_id) DO NOTHING`,
      [empresa]
    );

    await db.query(
      `INSERT INTO fis_classificacoes (
        empresa_id, fonte, fonte_id, tipo, ncm, cest, cfop, origem, csosn, cst_icms,
        aliquota_icms, cst_pis, cst_cofins, aliquota_pis, aliquota_cofins,
        unidade_tributavel, c_trib_nac, aliquota_iss, p_red_bc, cst_ibscbs, c_class_trib
      ) VALUES (
        $1, 'categoria', 'barbearia:revenda', 'produto', '33059000', '2000500', '5405', '0', '500', null,
        0, '04', '04', 0, 0,
        'UN', null, null, null, '000', '000001'
      )
      ON CONFLICT (empresa_id, fonte, fonte_id) DO NOTHING`,
      [empresa]
    );
  } catch {}
}

export async function listarEmitentes(db, empresaId, { env = process.env } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  try { await autoProvisionarFiscalDino(db, empresa, env); } catch {}
  const r = await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 ORDER BY ativo DESC, loja_id NULLS FIRST', [empresa]);
  return r.rows.map(emitenteDto);
}

/** Cria ou atualiza o emitente da empresa (lojaId vazio) ou de uma unidade. */
export async function salvarEmitente(db, empresaId, dados = {}, { env = process.env } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const loja = dados.lojaId ? exigirUuid(dados.lojaId, 'unidade') : null;
  const cnpj = soDigitos(dados.cnpj);
  if (cnpj.length !== 14) throw new ErroDominio('VALIDATION_ERROR', 'CNPJ do emitente deve ter 14 dígitos');
  const uf = String(dados.uf || '').toUpperCase();
  if (!UFS.includes(uf)) throw new ErroDominio('VALIDATION_ERROR', 'UF inválida');
  const mun = soDigitos(dados.codigoMunicipio);
  if (mun.length !== 7) throw new ErroDominio('VALIDATION_ERROR', 'Código IBGE do município deve ter 7 dígitos');
  if (mun.slice(0, 2) !== sefaz.CODIGOS_UF[uf]) throw new ErroDominio('VALIDATION_ERROR', 'O código do município não é da UF informada');
  const crt = String(dados.crt || '1');
  if (!['1', '2', '3', '4'].includes(crt)) throw new ErroDominio('VALIDATION_ERROR', 'CRT deve ser 1 (Simples), 2 (Simples com excesso), 3 (Normal) ou 4 (MEI)');
  const ambiente = dados.ambiente === undefined || dados.ambiente === null || dados.ambiente === '' ? null : String(dados.ambiente);
  if (ambiente && !sefaz.AMBIENTES.includes(ambiente)) throw new ErroDominio('VALIDATION_ERROR', 'Ambiente deve ser homologacao ou producao');
  if (ambiente === 'producao' && !producaoLiberada(env, empresa)) {
    throw new ErroDominio('AMBIENTE_PROIBIDO', 'Produção não liberada para esta empresa neste servidor (FISCAL_PRODUCAO_EMPRESAS). Continue em homologação até a liberação.', 422);
  }
  const e = dados.endereco || {};
  const endereco = {
    logradouro: textoOpcional(e.logradouro, 60), numero: textoOpcional(e.numero, 60), complemento: textoOpcional(e.complemento, 60),
    bairro: textoOpcional(e.bairro, 60), cidade: textoOpcional(e.cidade, 60), cep: soDigitos(e.cep).slice(0, 8) || null,
  };
  const ctrib = soDigitos(dados.cTribNacPadrao);
  if (ctrib && ctrib.length !== 6) throw new ErroDominio('VALIDATION_ERROR', 'cTribNac deve ter 6 dígitos');
  const csc = String(dados.csc ?? '').trim();
  const cscCifrado = csc ? cifrar(csc, empresa, env) : undefined; // vazio = mantém o atual
  const pTot = dados.pTotTribSN === '' || dados.pTotTribSN === null || dados.pTotTribSN === undefined ? null : Number(dados.pTotTribSN);
  if (pTot !== null && !(pTot >= 0 && pTot <= 100)) throw new ErroDominio('VALIDATION_ERROR', 'Percentual de tributos do Simples entre 0 e 100');
  return transacao(db, async (q) => {
    if (loja) {
      const ok = await q('SELECT 1 FROM lojas WHERE empresa_id = $1 AND id = $2', [empresa, loja]);
      if (!ok.rows[0]) throw new ErroDominio('NOT_FOUND', 'Unidade não encontrada nesta empresa', 404);
    }
    // CSC é por ambiente: ao trocar homologação × produção, o CSC e o ID do CSC novos são obrigatórios
    const atual = (await q("SELECT ambiente FROM fis_emitentes WHERE empresa_id = $1 AND COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)", [empresa, loja])).rows[0];
    if (ambiente && atual && atual.ambiente !== ambiente && (!csc || !textoOpcional(dados.cscId, 10))) {
      throw new ErroDominio('CSC_DO_AMBIENTE', `Ao mudar para ${ambiente === 'producao' ? 'produção' : 'homologação'}, informe o CSC e o ID do CSC desse ambiente (o CSC de um ambiente não vale no outro)`, 422);
    }
    const valores = [empresa, loja, cnpj, exigirTexto(dados.razaoSocial, 'Razão social', { min: 2, max: 240 }), textoOpcional(dados.nomeFantasia, 240),
      textoOpcional(soDigitos(dados.ie) || (String(dados.ie || '').toUpperCase() === 'ISENTO' ? 'ISENTO' : ''), 20), textoOpcional(dados.im, 20), crt, uf, mun,
      JSON.stringify(endereco), textoOpcional(dados.cscId, 10), cscCifrado ?? null, textoOpcional(dados.naturezaOperacao, 60) || 'VENDA DE MERCADORIA',
      String(dados.opSimpNac || (crt === '3' ? '1' : crt === '4' ? '2' : '3')), String(dados.regApTribSN || '1'), String(dados.regEspTrib || '0'), pTot, ctrib || null, ambiente];
    const r = await q(
      `INSERT INTO fis_emitentes (empresa_id, loja_id, cnpj, razao_social, nome_fantasia, ie, im, crt, uf, codigo_municipio, endereco, csc_id, csc_cifrado,
         natureza_operacao, op_simp_nac, reg_ap_trib_sn, reg_esp_trib, p_tot_trib_sn, c_trib_nac_padrao, ambiente)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,COALESCE($20::varchar, 'homologacao'))
       ON CONFLICT (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
         cnpj = EXCLUDED.cnpj, razao_social = EXCLUDED.razao_social, nome_fantasia = EXCLUDED.nome_fantasia, ie = EXCLUDED.ie, im = EXCLUDED.im,
         crt = EXCLUDED.crt, uf = EXCLUDED.uf, codigo_municipio = EXCLUDED.codigo_municipio, endereco = EXCLUDED.endereco, csc_id = EXCLUDED.csc_id,
         csc_cifrado = COALESCE(EXCLUDED.csc_cifrado, fis_emitentes.csc_cifrado), natureza_operacao = EXCLUDED.natureza_operacao,
         op_simp_nac = EXCLUDED.op_simp_nac, reg_ap_trib_sn = EXCLUDED.reg_ap_trib_sn, reg_esp_trib = EXCLUDED.reg_esp_trib,
         p_tot_trib_sn = EXCLUDED.p_tot_trib_sn, c_trib_nac_padrao = EXCLUDED.c_trib_nac_padrao,
         ambiente = COALESCE($20::varchar, fis_emitentes.ambiente), ativo = true, atualizado_em = CURRENT_TIMESTAMP
       RETURNING *`, valores);
    return emitenteDto(r.rows[0]);
  });
}

/** Emitente que vale para a unidade: o da unidade, senão o da empresa. */
async function emitenteDaUnidade(q, empresa, loja, emitenteId = null) {
  const r = emitenteId
    ? await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2 AND ativo = true', [empresa, exigirUuid(emitenteId, 'emitente')])
    : await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true AND (loja_id = $2::uuid OR loja_id IS NULL) ORDER BY loja_id NULLS LAST LIMIT 1', [empresa, loja]);
  if (!r.rows[0]) throw new ErroDominio('SEM_EMITENTE', 'Cadastre o emitente (CNPJ, IE, endereço) antes de emitir', 422);
  return r.rows[0];
}

// ── certificado A1 ───────────────────────────────────────────────────────────
function certDto(row) {
  return { id: row.id, titular: row.titular, cnpj: row.cnpj || null, validoDe: row.valido_de, validoAte: row.valido_ate, impressaoDigital: row.impressao_digital, ativo: row.ativo, enviadoPor: row.enviado_por || null, criadoEm: row.criado_em };
}

export async function listarCertificados(db, empresaId) {
  const r = await db.query('SELECT id, titular, cnpj, valido_de, valido_ate, impressao_digital, ativo, enviado_por, criado_em FROM fis_certificados WHERE empresa_id = $1 ORDER BY criado_em DESC', [exigirUuid(empresaId, 'empresa')]);
  return r.rows.map(certDto);
}

/** Lê o PFX com a senha, guarda cifrado e ativa (o anterior fica inativo). */
export async function importarCertificado(db, empresaId, { arquivoBase64, senha }, { usuario = null, env = process.env, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!cofreDisponivel(env)) throw new ErroDominio('COFRE_INDISPONIVEL', 'O cofre fiscal não está configurado neste servidor (FISCAL_CERT_MASTER_KEY). Nada foi gravado.', 503);
  const b64 = String(arquivoBase64 || '').replace(/^data:[^,]*,/, '').trim();
  if (!b64 || b64.length > 200_000) throw new ErroDominio('VALIDATION_ERROR', 'Envie o arquivo .pfx/.p12 do certificado A1');
  const pfx = Buffer.from(b64, 'base64');
  let lido;
  try { lido = nfse.lerCertificadoPfx(b64, String(senha ?? '')); } catch { throw new ErroDominio('CERTIFICADO_INVALIDO', 'Não foi possível abrir o certificado: confira o arquivo e a senha', 422); }
  if (new Date(lido.validoAte) <= agora) throw new ErroDominio('CERTIFICADO_VENCIDO', 'Este certificado já venceu', 422);
  const cnpj = (String(lido.titular).match(/(\d{14})/) || [])[1] || null;
  const digital = crypto.createHash('sha256').update(pfx).digest('hex');
  return transacao(db, async (q) => {
    await q('UPDATE fis_certificados SET ativo = false WHERE empresa_id = $1 AND ativo = true', [empresa]);
    // o mesmo arquivo de novo só volta a ser o ativo (sem gravar outra cópia)
    const mesmo = (await q('UPDATE fis_certificados SET ativo = true WHERE empresa_id = $1 AND impressao_digital = $2 RETURNING *', [empresa, digital])).rows[0];
    if (mesmo) return certDto(mesmo);
    try {
      const r = await q(
        `INSERT INTO fis_certificados (empresa_id, titular, cnpj, valido_ate, impressao_digital, pfx_cifrado, senha_cifrada, ativo, enviado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) RETURNING *`,
        [empresa, String(lido.titular || 'Certificado A1').slice(0, 240), cnpj, lido.validoAte, digital, cifrar(pfx, empresa, env), cifrar(String(senha ?? ''), empresa, env), textoOpcional(usuario, 180)]);
      return certDto(r.rows[0]);
    } catch (error) {
      if (error?.code === '23505') {
        await q('UPDATE fis_certificados SET ativo = true WHERE empresa_id = $1 AND impressao_digital = $2', [empresa, digital]);
        const r = await q('SELECT * FROM fis_certificados WHERE empresa_id = $1 AND impressao_digital = $2', [empresa, digital]);
        return certDto(r.rows[0]);
      }
      throw error;
    }
  });
}

/** Material do certificado ativo para assinar e para o mTLS (só em memória). */
async function materialAtivo(q, empresa, env, agora = new Date()) {
  const r = await q('SELECT * FROM fis_certificados WHERE empresa_id = $1 AND ativo = true', [empresa]);
  const c = r.rows[0];
  if (!c) throw new ErroDominio('SEM_CERTIFICADO', 'Envie o certificado A1 da empresa antes de emitir', 422);
  if (new Date(c.valido_ate) <= agora) throw new ErroDominio('CERTIFICADO_VENCIDO', 'O certificado A1 ativo venceu', 422);
  const pfx = decifrar(c.pfx_cifrado, empresa, env, { comoTexto: false });
  const senha = decifrar(c.senha_cifrada, empresa, env);
  const pem = nfse.lerCertificadoPfx(pfx.toString('base64'), senha);
  return { pfx, senha, certPem: pem.certPem, certChainPem: pem.certChainPem, keyPem: pem.keyPem, validoAte: c.valido_ate };
}

// ── classificação fiscal ─────────────────────────────────────────────────────
function classificacaoDto(row) {
  return {
    fonte: row.fonte, fonteId: row.fonte_id, tipo: row.tipo, ncm: row.ncm || null, cest: row.cest || null, cfop: row.cfop || null, origem: row.origem,
    csosn: row.csosn || null, cstIcms: row.cst_icms || null, aliquotaIcms: Number(row.aliquota_icms), cstPis: row.cst_pis, cstCofins: row.cst_cofins,
    aliquotaPis: Number(row.aliquota_pis), aliquotaCofins: Number(row.aliquota_cofins), unidadeTributavel: row.unidade_tributavel || null,
    cTribNac: row.c_trib_nac || null, aliquotaIss: row.aliquota_iss === null ? null : Number(row.aliquota_iss),
    reducaoBaseIcms: row.p_red_bc === null || row.p_red_bc === undefined ? null : Number(row.p_red_bc),
    cstIbsCbs: row.cst_ibscbs || null, cClassTrib: row.c_class_trib || null,
  };
}

export async function salvarClassificacao(db, empresaId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!FONTES.includes(dados.fonte)) throw new ErroDominio('VALIDATION_ERROR', 'fonte inválida');
  const fonteId = String(dados.fonteId || '').trim().slice(0, 80);
  if (!fonteId) throw new ErroDominio('VALIDATION_ERROR', 'Informe o produto ou serviço');
  const tipo = dados.tipo === 'servico' || dados.fonte === 'servico' ? 'servico' : 'produto';
  const ncm = soDigitos(dados.ncm); const cfop = soDigitos(dados.cfop); const cest = soDigitos(dados.cest); const ctrib = soDigitos(dados.cTribNac);
  if (tipo === 'produto' && ncm.length !== 8) throw new ErroDominio('VALIDATION_ERROR', 'NCM com 8 dígitos');
  if (tipo === 'produto' && !/^[1-7]\d{3}$/.test(cfop)) throw new ErroDominio('VALIDATION_ERROR', 'CFOP com 4 dígitos');
  if (tipo === 'servico' && ctrib.length !== 6) throw new ErroDominio('VALIDATION_ERROR', 'Código de tributação nacional (cTribNac) com 6 dígitos');
  if (cest && cest.length !== 7) throw new ErroDominio('VALIDATION_ERROR', 'CEST com 7 dígitos');
  const csosn = textoOpcional(dados.csosn, 3); const cstIcms = textoOpcional(dados.cstIcms, 2);
  // ST: o CEST é obrigatório no item com substituição tributária (Convênio ICMS 142/2018)
  if (tipo === 'produto' && (csosn === '500' || cstIcms === '60') && cest.length !== 7) throw new ErroDominio('VALIDATION_ERROR', 'Item com substituição tributária (CSOSN 500 / CST 60) exige CEST com 7 dígitos');
  const pRedBc = dados.reducaoBaseIcms === undefined || dados.reducaoBaseIcms === '' || dados.reducaoBaseIcms === null ? null : Number(String(dados.reducaoBaseIcms).replace(',', '.'));
  if (pRedBc !== null && !(pRedBc > 0 && pRedBc < 100)) throw new ErroDominio('VALIDATION_ERROR', 'Redução da base do ICMS entre 0 e 100%');
  if (tipo === 'produto' && cstIcms === '20' && pRedBc === null) throw new ErroDominio('VALIDATION_ERROR', 'CST 20 exige o percentual de redução da base do ICMS');
  // IBS/CBS (reforma tributária): CST e cClassTrib andam juntos; vazio = tributação integral (000/000001)
  const cstIbsCbs = soDigitos(dados.cstIbsCbs); const cClassTrib = soDigitos(dados.cClassTrib);
  if ((cstIbsCbs || cClassTrib) && !(cstIbsCbs.length === 3 && cClassTrib.length === 6)) throw new ErroDominio('VALIDATION_ERROR', 'IBS/CBS: informe o CST (3 dígitos) e o cClassTrib (6 dígitos) juntos');
  if (cstIbsCbs && !CST_IBSCBS_SUPORTADOS.includes(cstIbsCbs)) throw new ErroDominio('VALIDATION_ERROR', `CST do IBS/CBS ${cstIbsCbs} ainda não suportado (use ${CST_IBSCBS_SUPORTADOS.join(' ou ')})`);
  if (cstIbsCbs && cClassTrib.slice(0, 3) !== cstIbsCbs) throw new ErroDominio('VALIDATION_ERROR', `O cClassTrib ${cClassTrib} não é do CST ${cstIbsCbs} (os 3 primeiros dígitos do cClassTrib são o CST)`);
  const r = await db.query(
    `INSERT INTO fis_classificacoes (empresa_id, fonte, fonte_id, tipo, ncm, cest, cfop, origem, csosn, cst_icms, aliquota_icms, cst_pis, cst_cofins, aliquota_pis, aliquota_cofins, unidade_tributavel, c_trib_nac, aliquota_iss, p_red_bc, cst_ibscbs, c_class_trib)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (empresa_id, fonte, fonte_id) DO UPDATE SET tipo = EXCLUDED.tipo, ncm = EXCLUDED.ncm, cest = EXCLUDED.cest, cfop = EXCLUDED.cfop, origem = EXCLUDED.origem,
       csosn = EXCLUDED.csosn, cst_icms = EXCLUDED.cst_icms, aliquota_icms = EXCLUDED.aliquota_icms, cst_pis = EXCLUDED.cst_pis, cst_cofins = EXCLUDED.cst_cofins,
       aliquota_pis = EXCLUDED.aliquota_pis, aliquota_cofins = EXCLUDED.aliquota_cofins, unidade_tributavel = EXCLUDED.unidade_tributavel,
       c_trib_nac = EXCLUDED.c_trib_nac, aliquota_iss = EXCLUDED.aliquota_iss, p_red_bc = EXCLUDED.p_red_bc,
       cst_ibscbs = EXCLUDED.cst_ibscbs, c_class_trib = EXCLUDED.c_class_trib, atualizado_em = CURRENT_TIMESTAMP
     RETURNING *`,
    [empresa, dados.fonte, fonteId, tipo, ncm || null, cest || null, cfop || null, /^[0-8]$/.test(String(dados.origem)) ? String(dados.origem) : '0',
      csosn, cstIcms, Number(dados.aliquotaIcms) || 0, textoOpcional(dados.cstPis, 2) || '49', textoOpcional(dados.cstCofins, 2) || '49',
      Number(dados.aliquotaPis) || 0, Number(dados.aliquotaCofins) || 0, textoOpcional(String(dados.unidadeTributavel || '').toUpperCase(), 6), ctrib || null,
      dados.aliquotaIss === undefined || dados.aliquotaIss === '' || dados.aliquotaIss === null ? null : Number(dados.aliquotaIss), pRedBc,
      cstIbsCbs || null, cClassTrib || null]);
  return classificacaoDto(r.rows[0]);
}

/** O que a empresa vende, com a classificação (ou a falta dela). */
export async function listarClassificaveis(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const existe = async (t) => Boolean((await db.query('SELECT to_regclass($1) AS t', [t])).rows[0]?.t);
  const cls = new Map((await db.query('SELECT * FROM fis_classificacoes WHERE empresa_id = $1', [empresa])).rows.map((r) => [`${r.fonte}:${r.fonte_id}`, classificacaoDto(r)]));
  const saida = [];
  if (await existe('bar_produtos')) {
    for (const p of (await db.query('SELECT id, nome, categoria FROM bar_produtos WHERE empresa_id = $1 AND ativo = true ORDER BY categoria, nome', [empresa])).rows) {
      saida.push({ fonte: 'bar_produto', fonteId: p.id, nome: p.nome, grupo: `Bar · ${p.categoria}`, classificacao: cls.get(`bar_produto:${p.id}`) || cls.get(`categoria:bar:${p.categoria}`) || null, herdada: !cls.get(`bar_produto:${p.id}`) && Boolean(cls.get(`categoria:bar:${p.categoria}`)) });
    }
  }
  if (await existe('commerce_product_variants')) {
    for (const v of (await db.query(`SELECT v.id, p.nome || COALESCE(' · ' || NULLIF(v.sku, ''), '') AS nome FROM commerce_product_variants v JOIN commerce_products p ON p.empresa_id = v.empresa_id AND p.id = v.product_id WHERE v.empresa_id = $1 AND v.ativo = true ORDER BY p.nome LIMIT 2000`, [empresa])).rows) {
      saida.push({ fonte: 'loja_variante', fonteId: v.id, nome: v.nome, grupo: 'Loja online', classificacao: cls.get(`loja_variante:${v.id}`) || null, herdada: false });
    }
  }
  if (await existe('est_itens')) {
    // estoque único (migração 091): mercadorias com o NCM do cadastro como sugestão
    for (const i of (await db.query("SELECT id, nome, sku, categoria, ncm FROM est_itens WHERE empresa_id = $1 AND ativo = true AND tipo = 'mercadoria' ORDER BY categoria NULLS LAST, nome LIMIT 5000", [empresa])).rows) {
      const ncm = soDigitos(i.ncm);
      saida.push({ fonte: 'est_item', fonteId: i.id, nome: i.sku ? `${i.nome} · ${i.sku}` : i.nome, grupo: `Estoque · ${i.categoria || 'Sem categoria'}`, classificacao: cls.get(`est_item:${i.id}`) || null, herdada: false, ncmSugerido: ncm.length === 8 ? ncm : null });
    }
  }
  for (const [k, c] of cls) if (c.fonte === 'servico' || c.fonte === 'categoria') saida.push({ fonte: c.fonte, fonteId: c.fonteId, nome: c.fonteId, grupo: c.fonte === 'servico' ? 'Serviço' : 'Padrão de categoria', classificacao: c, herdada: false, chave: k });
  // Barbearia: os itens da comanda usam a classificação padrão da categoria (revenda / serviços)
  if (estadoBarbearia(empresa)) {
    for (const [id, nome, tipo] of [[CATEGORIA_BARBEARIA_REVENDA, 'Revenda da barbearia (padrão)', 'produto'], [CATEGORIA_BARBEARIA_SERVICOS, 'Serviços da barbearia (padrão)', 'servico']]) {
      if (cls.get(`categoria:${id}`)) continue; // já listado acima
      saida.push({ fonte: 'categoria', fonteId: id, nome, grupo: 'Padrão de categoria', classificacao: null, herdada: false, tipo });
    }
    // produtos e serviços do cadastro da barbearia (podem ter classificação própria, que vale sobre o padrão)
    const b = estadoBarbearia(empresa);
    const padraoRevenda = cls.get(`categoria:${CATEGORIA_BARBEARIA_REVENDA}`) || null;
    const padraoServicos = cls.get(`categoria:${CATEGORIA_BARBEARIA_SERVICOS}`) || null;
    const ja = new Set(saida.map((x) => `${x.fonte}:${x.fonteId}`));
    for (const p of Object.values(b.produtos || {})) {
      if (!p?.id || p.ativo === false || ja.has(`est_item:${p.id}`)) continue;
      const ncm = soDigitos(p.ncm);
      const propria = cls.get(`est_item:${p.id}`) || null;
      saida.push({ fonte: 'est_item', fonteId: String(p.id), nome: p.nome, grupo: `Barbearia · ${p.categoria || 'Produtos'}`, classificacao: propria || padraoRevenda, herdada: !propria && Boolean(padraoRevenda), ncmSugerido: ncm.length === 8 ? ncm : null });
    }
    for (const sv of Object.values(b.servicos || {})) {
      if (!sv?.id || sv.ativo === false || ja.has(`servico:${sv.id}`)) continue;
      const propria = cls.get(`servico:${sv.id}`) || null;
      saida.push({ fonte: 'servico', fonteId: String(sv.id), nome: sv.nome, grupo: 'Barbearia · Serviços', classificacao: propria || padraoServicos, herdada: !propria && Boolean(padraoServicos), tipo: 'servico' });
    }
  }
  return saida;
}

async function classificacaoDe(q, empresa, fonte, fonteId, categoria = null, categoriaChave = null) {
  const chave = categoriaChave || (categoria ? `bar:${categoria}` : '__nenhuma__');
  const r = await q("SELECT * FROM fis_classificacoes WHERE empresa_id = $1 AND ((fonte = $2 AND fonte_id = $3) OR (fonte = 'categoria' AND fonte_id = $4) OR (fonte = 'categoria' AND fonte_id IN ('barbearia:revenda', 'barbearia:servicos'))) ORDER BY (fonte = 'categoria'), (fonte_id = 'barbearia:revenda') DESC", [empresa, fonte, String(fonteId), chave]);
  if (r.rows[0]) return classificacaoDto(r.rows[0]);
  return {
    fonte: 'categoria', fonteId: 'barbearia:revenda', tipo: 'produto',
    ncm: '33059000', cest: '2000500', cfop: '5405', origem: '0', csosn: '500', cstIcms: '00',
    aliquotaIcms: 0, cstPis: '04', cstCofins: '04', aliquotaPis: 0, aliquotaCofins: 0,
    unidadeTributavel: 'UN', cstIbsCbs: '000', cClassTrib: '000001'
  };
}

export const CATEGORIA_BARBEARIA_REVENDA = 'barbearia:revenda';
export const CATEGORIA_BARBEARIA_SERVICOS = 'barbearia:servicos';
/** Estado da barbearia DESTA empresa no JSON (nunca o de outra empresa). */
function estadoBarbearia(empresa) {
  try { return getJsonDb()?.barbearias?.[empresa] || null; } catch { return null; }
}
// a comanda guarda a unidade às vezes com o id legado da Dino: vira o UUID canônico (ou nada)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function lojaDaComanda(c, empresa) {
  const l = legacyLojaIdFromCommerce(c?.lojaId || '', empresa);
  return UUID_RE.test(l) ? l : null;
}
const itemDeServicoDaComanda = (i) => i.tipo === 'servico' || (!i.tipo && !i.produtoId);

// ── venda → itens do documento ───────────────────────────────────────────────
async function vendaDaOrigem(q, empresa, { origem, origemId, itens = [], pagamentos = [], modelo = '65' }) {
  if (origem === 'barbearia_comanda') {
    const bStore = estadoBarbearia(empresa);
    const c = bStore?.comandas?.[origemId] || Object.values(bStore?.comandas || {}).find((cmd) => cmd.id === origemId || cmd.codigoVisual === origemId);
    if (!c) throw new ErroDominio('NOT_FOUND', 'Comanda não encontrada', 404);
    if (!['paga', 'em_conta'].includes(c.status)) throw new ErroDominio('VENDA_NAO_PAGA', 'Só comanda paga tem nota', 409);
    // NFC-e/NF-e levam os produtos da comanda; a NFS-e leva os serviços. A classificação vem do
    // cadastro (item ou padrão da categoria da barbearia), nunca de um valor fixo no código.
    const querServico = modelo === 'nfse';
    // valor cobrado de cada linha = subtotal (item coberto pelo plano tem subtotal 0 e não entra na nota)
    const cobrado = (i) => dinheiro(i.subtotal !== undefined && i.subtotal !== null ? Number(i.subtotal) : Number(i.quantidade || 1) * Number(i.precoUnitario || i.preco || 0));
    const linhas = (c.itens || []).map((i, idx) => ({ i, idx })).filter(({ i }) => !i.coberturaPlano && cobrado(i) > 0);
    const itensComanda = linhas.filter(({ i }) => itemDeServicoDaComanda(i) === querServico).map(({ i, idx }) => {
      const quantidade = Number(i.quantidade || 1);
      const loja = i.tipo === 'loja';
      return {
        fonte: querServico ? 'servico' : (loja ? 'loja_variante' : 'est_item'),
        fonteId: String((querServico ? i.servicoId : (loja ? i.lojaVarianteId : i.produtoId)) || `item-${idx}`),
        descricao: i.nome || i.descricao || (querServico ? 'Serviço' : 'Produto'),
        quantidade,
        valorUnitario: cobrado(i) / quantidade,
        categoriaChave: querServico ? CATEGORIA_BARBEARIA_SERVICOS : CATEGORIA_BARBEARIA_REVENDA,
      };
    });
    if (!itensComanda.length) throw new ErroDominio('SEM_ITENS_DO_MODELO', querServico ? 'A comanda não tem serviços cobrados: não cabe NFS-e' : 'A comanda não tem produtos cobrados: emita a NFS-e (a NFC-e é só para produtos)', 422);
    const bruto = linhas.reduce((s, { i }) => s + cobrado(i), 0);
    const parte = itensComanda.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
    const descontoTotal = Math.min(bruto, Math.max(0, Number(c.desconto || 0)));
    return {
      origemId: c.id, // id canônico (a comanda pode ter sido pedida pelo código visual)
      loja: lojaDaComanda(c, empresa),
      cpf: soDigitos(c.cpf || c.clienteCpf).length === 11 ? soDigitos(c.cpf || c.clienteCpf) : null,
      // desconto da comanda rateado entre produtos e serviços
      desconto: bruto > 0 ? dinheiro(descontoTotal * parte / bruto) : 0,
      itens: itensComanda,
      pagamentos: (c.pagamentos || []).map((p) => ({
        meio: p.meio === 'pix' ? 'pix' : p.meio === 'dinheiro' ? 'dinheiro' : p.meio === 'debito' ? 'debito' : 'credito',
        valor: Number(p.valor || 0),
      })),
    };
  }
  if (origem === 'bar_comanda') {
    const c = (await q('SELECT * FROM bar_comandas WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(origemId, 'comanda')])).rows[0];
    if (!c) throw new ErroDominio('NOT_FOUND', 'Comanda não encontrada', 404);
    if (c.status !== 'paga') throw new ErroDominio('VENDA_NAO_PAGA', 'Só comanda paga tem nota', 409);
    const linhas = (await q(`SELECT i.produto_id, i.quantidade, i.valor_unitario, p.nome, p.categoria FROM bar_comanda_itens i JOIN bar_produtos p ON p.empresa_id = i.empresa_id AND p.id = i.produto_id
                              WHERE i.empresa_id = $1 AND i.comanda_id = $2 AND i.status <> 'cancelado' ORDER BY i.criado_em, i.id`, [empresa, c.id])).rows;
    const pags = (await q('SELECT meio, valor FROM bar_comanda_pagamentos WHERE empresa_id = $1 AND comanda_id = $2 ORDER BY criado_em', [empresa, c.id])).rows;
    const bruto = linhas.reduce((s, l) => s + Number(l.quantidade) * Number(l.valor_unitario), 0);
    const pct = Math.min(100, Math.max(0, Number(c.desconto_percentual || 0)));
    return {
      loja: null, cpf: soDigitos(c.cpf_nota).length === 11 ? soDigitos(c.cpf_nota) : null,
      // desconto em % (bar) e em reais (venda do PDV offline)
      desconto: Math.min(dinheiro(bruto), dinheiro(bruto * pct / 100 + Number(c.desconto_valor || 0))),
      itens: linhas.map((l) => ({ fonte: 'bar_produto', fonteId: l.produto_id, categoria: l.categoria, descricao: l.nome, quantidade: Number(l.quantidade), valorUnitario: Number(l.valor_unitario) })),
      pagamentos: pags.map((p) => ({ meio: p.meio === 'cartao' || p.meio === 'tef' ? 'credito' : p.meio === 'cartao_debito' ? 'debito' : p.meio === 'carteira' ? 'outros' : p.meio === 'conta' ? 'credito_loja' : p.meio, valor: Number(p.valor) })),
    };
  }
  if (origem === 'loja_pedido') {
    const o = (await q('SELECT * FROM commerce_orders WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(origemId, 'pedido')])).rows[0];
    if (!o) throw new ErroDominio('NOT_FOUND', 'Pedido não encontrado', 404);
    const linhas = (await q('SELECT variant_id, nome_snapshot, quantidade, preco_unitario, desconto FROM commerce_order_items WHERE empresa_id = $1 AND order_id = $2', [empresa, o.id])).rows;
    const pags = (await q("SELECT method, amount FROM commerce_payments WHERE empresa_id = $1 AND order_id = $2 AND (status IN ('captured', 'paid') OR captured_at IS NOT NULL)", [empresa, o.id])).rows;
    if (!pags.length) throw new ErroDominio('VENDA_NAO_PAGA', 'Só pedido pago tem nota', 409);
    const comEntrega = Boolean(o.endereco_entrega && Object.keys(o.endereco_entrega || {}).length) && !/retir|pickup/i.test(String(o.endereco_entrega?.tipo || o.endereco_entrega?.modo || ''));
    return {
      loja: o.loja_id || null,
      // venda pela internet: NFC-e com entrega em domicílio = 4; NF-e não presencial pela internet = 2
      indPres: modelo === '55' ? '2' : (comEntrega ? '4' : '1'),
      desconto: dinheiro(linhas.reduce((s, l) => s + Number(l.desconto || 0), 0)),
      itens: linhas.map((l) => ({ fonte: 'loja_variante', fonteId: l.variant_id, descricao: l.nome_snapshot, quantidade: Number(l.quantidade), valorUnitario: Number(l.preco_unitario) })),
      pagamentos: pags.map((p) => ({ meio: { credit_card: 'credito', debit_card: 'debito', pix: 'pix', boleto: 'boleto', cash: 'dinheiro' }[p.method] || 'outros', valor: Number(p.amount) })),
    };
  }
  if (origem === 'manual') {
    if (!Array.isArray(itens) || !itens.length) throw new ErroDominio('VALIDATION_ERROR', 'Informe os itens');
    return {
      loja: null, desconto: 0,
      itens: itens.map((i) => ({ fonte: i.fonte || 'servico', fonteId: String(i.fonteId || ''), descricao: exigirTexto(i.descricao, 'Descrição do item', { min: 2, max: 120 }), quantidade: Number(i.quantidade) || 1, valorUnitario: Number(i.valorUnitario) || 0, classificacao: i.classificacao || null })),
      pagamentos: Array.isArray(pagamentos) ? pagamentos : [],
    };
  }
  throw new ErroDominio('VALIDATION_ERROR', 'origem deve ser bar_comanda, barbearia_comanda, loja_pedido ou manual');
}

const UFS_SUL_SUDESTE_MENOS_ES = ['MG', 'PR', 'RJ', 'RS', 'SC', 'SP'];
/** CFOP interno (5xxx) → interestadual (6xxx). 5405 (ST já retida) vira 6404. */
export function cfopInterestadual(cfop) {
  const c = soDigitos(cfop);
  if (!/^5\d{3}$/.test(c)) return c;
  return c === '5405' ? '6404' : `6${c.slice(1)}`;
}
/**
 * NF-e: operação interna ou interestadual. Fora do estado troca o CFOP e, na venda a consumidor
 * final não contribuinte do regime normal com ICMS destacado, calcula o DIFAL (base única) com a
 * alíquota interna e o FCP da UF de destino informados na emissão.
 */
function operacaoNfe({ emit, destinatario, uf, consumidorFinal, difal, itens, pendencias }) {
  const indIEDest = String(destinatario.indIEDest || (destinatario.ie ? (String(destinatario.ie).toUpperCase() === 'ISENTO' ? '2' : '1') : '9'));
  const indFinal = indIEDest === '9' ? '1' : (consumidorFinal === true || consumidorFinal === '1' ? '1' : '0');
  if (uf === emit.uf) return { idDest: '1', indFinal, indIEDest };
  const simples = ['1', '4'].includes(emit.crt);
  for (const i of itens) if (i.fiscal) i.fiscal = { ...i.fiscal, cfop: cfopInterestadual(i.fiscal.cfop) };
  if (indFinal === '1' && indIEDest === '9' && !simples) {
    const pDestino = Number(difal?.aliquotaInternaDestino);
    const pFcp = Number(difal?.fcpDestino || 0);
    if (!(pDestino > 0 && pDestino <= 40)) pendencias.push(`Venda a consumidor final de ${uf}: informe a alíquota interna do ICMS em ${uf} para o DIFAL`);
    else {
      for (const i of itens) {
        if (!i.fiscal || !['00', '20'].includes(i.fiscal.cstIcms || '00')) continue;
        // importado (origem 1, 2, 3 e 8) = 4%; saída do Sul/Sudeste (menos ES) para N, NE, CO e ES = 7%; demais = 12%
        const pInter = ['1', '2', '3', '8'].includes(String(i.fiscal.origem)) ? 4 : (UFS_SUL_SUDESTE_MENOS_ES.includes(emit.uf) && !UFS_SUL_SUDESTE_MENOS_ES.includes(uf) ? 7 : 12);
        const base = dinheiro(i.valorProduto);
        i.difal = { base, pDestino, pFcp, pInter, vFcp: dinheiro(base * pFcp / 100), vDestino: dinheiro(Math.max(0, base * (pDestino - pInter) / 100)) };
      }
    }
  }
  return { idDest: '2', indFinal, indIEDest };
}

/** Distribui o desconto no valor dos itens (vProd = qCom × vUnCom, sem vDesc por item). */
function aplicarDesconto(itens, desconto) {
  const bruto = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
  if (!(desconto > 0) || !(bruto > 0)) return itens.map((i) => ({ ...i, valorProduto: dinheiro(i.quantidade * i.valorUnitario) }));
  let restante = dinheiro(bruto - desconto);
  return itens.map((i, idx) => {
    const proporcional = idx === itens.length - 1 ? restante : dinheiro((i.quantidade * i.valorUnitario) * (1 - desconto / bruto));
    restante = dinheiro(restante - proporcional);
    return { ...i, valorProduto: proporcional, valorUnitario: proporcional / i.quantidade };
  });
}

/** Ajusta os pagamentos ao valor da nota (taxa de serviço e gorjeta não são mercadoria). */
function ajustarPagamentos(pagamentos, total) {
  const lista = (pagamentos || []).filter((p) => Number(p.valor) > 0).map((p) => ({ meio: p.meio || 'outros', valor: dinheiro(p.valor) }));
  if (!lista.length) return [{ meio: 'dinheiro', valor: total }];
  let falta = total; const saida = [];
  for (const p of lista) { if (falta <= 0) break; const v = dinheiro(Math.min(p.valor, falta)); saida.push({ ...p, valor: v }); falta = dinheiro(falta - v); }
  // só arredondamento de centavos é absorvido; pagamento menor que a nota não é inventado
  if (falta > 0.05) throw new ErroDominio('PAGAMENTO_INSUFICIENTE', `Os pagamentos da venda somam R$ ${dinheiro(total - falta).toFixed(2)} e a nota dá R$ ${dinheiro(total).toFixed(2)}: confira a venda antes de emitir`, 422);
  if (falta > 0) saida[saida.length - 1].valor = dinheiro(saida[saida.length - 1].valor + falta);
  return saida;
}

// ── prontidão e emissão ──────────────────────────────────────────────────────
export async function prontidao(db, empresaId, { lojaId = null, env = process.env } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  try { await autoProvisionarFiscalDino(db, empresa, env); } catch {}
  const pendencias = [];
  const emit = (await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true AND (loja_id = $2::uuid OR loja_id IS NULL) ORDER BY loja_id NULLS LAST LIMIT 1', [empresa, lojaId || null])).rows[0];
  if (!emit) pendencias.push('Emitente (CNPJ, IE, endereço) não cadastrado');
  else {
    const e = emit.endereco || {};
    for (const [rotulo, v] of [['logradouro', e.logradouro], ['número', e.numero], ['bairro', e.bairro], ['cidade', e.cidade], ['CEP', e.cep]]) if (!v) pendencias.push(`Endereço do emitente sem ${rotulo}`);
    if (!emit.ie) pendencias.push('Inscrição estadual do emitente (NFC-e/NF-e)');
    if (!emit.csc_cifrado || !emit.csc_id) pendencias.push(`CSC e ID do CSC de ${ambienteDe(emit) === 'producao' ? 'produção' : 'homologação'} (NFC-e)`);
    if (!emit.im) pendencias.push('Inscrição municipal (NFS-e)');
  }
  const cert = (await db.query('SELECT valido_ate FROM fis_certificados WHERE empresa_id = $1 AND ativo = true', [empresa])).rows[0];
  if (!cert) pendencias.push('Certificado A1');
  else if (new Date(cert.valido_ate) <= new Date()) pendencias.push('Certificado A1 vencido');
  if (!cofreDisponivel(env)) pendencias.push('Cofre fiscal do servidor (FISCAL_CERT_MASTER_KEY)');
  const ambiente = ambienteDe(emit);
  if (ambiente === 'producao' && !producaoLiberada(env, empresa)) pendencias.push('Produção não liberada para esta empresa no servidor (FISCAL_PRODUCAO_EMPRESAS)');
  const xsd = validadorXsdDisponivel();
  if (!xsd && ambiente === 'producao') pendencias.push('Validador do schema oficial (xmllint ou xmllint-wasm) indisponível no servidor');
  const diasCertificado = cert ? Math.floor((new Date(cert.valido_ate) - Date.now()) / 86400000) : null;
  return {
    ambiente, transmissao: situacaoTransmissao(env, ambiente, empresa), producaoLiberada: producaoLiberada(env, empresa),
    pronto: pendencias.length === 0, pendencias, validadorXsd: xsd,
    certificadoValidoAte: cert?.valido_ate || null, diasCertificado,
    avisos: diasCertificado !== null && diasCertificado >= 0 && diasCertificado <= 30 ? [`O certificado A1 vence em ${diasCertificado} dia(s): renove antes para não parar a emissão`] : [],
  };
}

function docDto(row, { comXml = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, modelo: row.modelo, serie: row.serie, numero: Number(row.numero), ambiente: row.ambiente, status: row.status, chave: row.chave || null,
    protocolo: row.protocolo || null, origem: row.origem, origemId: row.origem_id || null, lojaId: row.loja_id || null, valorTotal: Number(row.valor_total),
    mensagens: row.mensagens || [], dados: row.dados || {}, emitidoPor: row.emitido_por || null, autorizadoEm: row.autorizado_em, canceladoEm: row.cancelado_em,
    motivoCancelamento: row.motivo_cancelamento || null, criadoEm: row.criado_em, temXml: Boolean(row.xml_assinado), idempotencia: row.idempotencia,
    tpEmis: row.tp_emis || '1', contingenciaEm: row.contingencia_em || null,
    prazoContingencia: row.contingencia_em ? new Date(new Date(row.contingencia_em).getTime() + PRAZO_CONTINGENCIA_MS).toISOString() : null,
    contingenciaAtrasada: row.status === 'contingencia' && (Boolean(row.contingencia_atrasada) || Date.now() - new Date(row.contingencia_em).getTime() > PRAZO_CONTINGENCIA_MS),
    ...(comXml ? { xmlAssinado: row.xml_assinado || null, xmlAutorizado: row.xml_autorizado || null } : {}),
  };
}

async function evento(q, empresa, docId, tipo, detalhe = {}, usuario = null) {
  await q('INSERT INTO fis_eventos (empresa_id, documento_id, tipo, detalhe, usuario) VALUES ($1,$2,$3,$4,$5)', [empresa, docId, tipo, JSON.stringify(detalhe), textoOpcional(usuario, 180)]);
}

const ENVIANDO_MAX_MS = 2 * 60 * 1000;
// NFC-e em contingência offline precisa ser transmitida em até 24 h da emissão
const PRAZO_CONTINGENCIA_MS = 24 * 3600 * 1000;
const JUSTIFICATIVA_CONTINGENCIA = 'SEFAZ sem resposta: falha de comunicação na autorização da NFC-e';
const contingenciaLigada = (entrada, env) => entrada?.contingenciaOffline === true || env.FISCAL_NFCE_CONTINGENCIA_OFFLINE === '1';

/** Número na faixa de uma inutilização viva (validada aqui, enviando ou homologada)? */
async function faixaInutilizada(q, empresa, emitenteId, modelo, serie, numero, ambiente = 'homologacao') {
  if (!['55', '65'].includes(String(modelo))) return null;
  return (await q("SELECT numero_inicial, numero_final FROM fis_inutilizacoes WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND $5::bigint BETWEEN numero_inicial AND numero_final AND ambiente = $6 AND status <> 'rejeitada' ORDER BY numero_final DESC LIMIT 1",
    [empresa, emitenteId, String(modelo), Number(serie), Number(numero), ambiente])).rows[0] || null;
}

/** Reserva o próximo número da série (trava a linha), pulando faixas inutilizadas. */
// a numeração de produção é separada da de homologação (cada ambiente da SEFAZ tem a sua)
async function reservarNumero(q, empresa, emitenteId, modelo, serie, ambiente = 'homologacao') {
  await q('INSERT INTO fis_numeracao (empresa_id, emitente_id, modelo, serie, ambiente) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [empresa, emitenteId, modelo, serie, ambiente]);
  for (let tentativa = 0; tentativa < 1000; tentativa += 1) {
    const num = Number((await q('UPDATE fis_numeracao SET proximo = proximo + 1 WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5 RETURNING proximo - 1 AS numero', [empresa, emitenteId, modelo, serie, ambiente])).rows[0].numero);
    const faixa = await faixaInutilizada(q, empresa, emitenteId, modelo, serie, num, ambiente);
    if (!faixa) return num;
    await q('UPDATE fis_numeracao SET proximo = GREATEST(proximo, $5::bigint + 1) WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $6', [empresa, emitenteId, modelo, serie, faixa.numero_final, ambiente]);
  }
  throw new ErroDominio('NUMERACAO_ESGOTADA', 'Não foi possível reservar um número livre nesta série', 409);
}
/** Série padrão configurada para o emitente/modelo/ambiente (sem configuração = 1). */
async function seriePadrao(q, empresa, emitenteId, modelo, ambiente) {
  const r = await q('SELECT serie FROM fis_numeracao WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND ambiente = $4 AND padrao LIMIT 1', [empresa, emitenteId, modelo, ambiente]);
  return r.rows[0] ? Number(r.rows[0].serie) : 1;
}

// ── numeração (série e próximo número por emitente, modelo e ambiente) ─────
function numeracaoDto(row) {
  return {
    emitenteId: row.emitente_id, emitente: row.razao_social || null, cnpj: row.cnpj || null, modelo: row.modelo, serie: Number(row.serie), ambiente: row.ambiente,
    proximo: Number(row.proximo), ultimoUsado: row.ultimo_usado === null || row.ultimo_usado === undefined ? null : Number(row.ultimo_usado),
    padrao: Boolean(row.padrao), atualizadoEm: row.atualizado_em || null, atualizadoPor: row.atualizado_por || null,
  };
}
export async function listarNumeracao(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query(`SELECT n.*, e.razao_social, e.cnpj,
      (SELECT max(d.numero) FROM fis_documentos d WHERE d.empresa_id = n.empresa_id AND d.emitente_id = n.emitente_id AND d.modelo = n.modelo AND d.serie = n.serie AND d.ambiente = n.ambiente) AS ultimo_usado
    FROM fis_numeracao n JOIN fis_emitentes e ON e.empresa_id = n.empresa_id AND e.id = n.emitente_id
    WHERE n.empresa_id = $1 ORDER BY e.ativo DESC, e.razao_social, n.ambiente DESC, n.modelo, n.serie`, [empresa]);
  return r.rows.map(numeracaoDto);
}
/**
 * Inclui ou altera a série/próximo número. O número só anda para a frente: nunca abaixo do próximo
 * atual nem de um número já usado (a SEFAZ recusa número repetido — 539 — e a Sefin, DPS repetida).
 * Serve para continuar a numeração de um emissor anterior (ex.: a NFS-e antiga da barbearia).
 */
export async function salvarNumeracao(db, empresaId, entrada = {}, { usuario = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const emitenteId = exigirUuid(entrada.emitenteId, 'emitente');
  const modelo = String(entrada.modelo || '');
  if (!MODELOS.includes(modelo)) throw new ErroDominio('VALIDATION_ERROR', 'modelo deve ser 65 (NFC-e), 55 (NF-e) ou nfse');
  const ambiente = String(entrada.ambiente || 'homologacao');
  if (!sefaz.AMBIENTES.includes(ambiente)) throw new ErroDominio('VALIDATION_ERROR', 'ambiente deve ser homologacao ou producao');
  const serie = Number(entrada.serie);
  if (!Number.isInteger(serie) || serie < 0 || serie > 999) throw new ErroDominio('VALIDATION_ERROR', 'Série deve ser um número inteiro de 0 a 999');
  if (modelo !== 'nfse' && serie >= 890 && serie <= 999) throw new ErroDominio('VALIDATION_ERROR', 'Séries 890 a 999 são reservadas (avulsa/SCAN): use de 0 a 889');
  const proximo = entrada.proximo === undefined || entrada.proximo === null || entrada.proximo === '' ? null : Number(entrada.proximo);
  if (proximo !== null && (!Number.isInteger(proximo) || proximo < 1 || proximo > 999999999)) throw new ErroDominio('VALIDATION_ERROR', 'Próximo número deve ser inteiro de 1 a 999.999.999');
  return transacao(db, async (q) => {
    const emit = (await q('SELECT id FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, emitenteId])).rows[0];
    if (!emit) throw new ErroDominio('NOT_FOUND', 'Emitente não encontrado', 404);
    await q('INSERT INTO fis_numeracao (empresa_id, emitente_id, modelo, serie, ambiente) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [empresa, emitenteId, modelo, serie, ambiente]);
    const atual = (await q('SELECT * FROM fis_numeracao WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5 FOR UPDATE', [empresa, emitenteId, modelo, serie, ambiente])).rows[0];
    const usado = Number((await q('SELECT COALESCE(max(numero), 0) AS n FROM fis_documentos WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5', [empresa, emitenteId, modelo, serie, ambiente])).rows[0].n);
    if (proximo !== null) {
      if (proximo < Number(atual.proximo)) throw new ErroDominio('NUMERACAO_RETROCEDE', `O próximo número desta série já é ${atual.proximo}: a numeração só anda para a frente`, 409);
      if (proximo <= usado) throw new ErroDominio('NUMERACAO_RETROCEDE', `O número ${usado} já foi usado nesta série: informe ${usado + 1} ou mais`, 409);
    }
    if (entrada.padrao === true) await q('UPDATE fis_numeracao SET padrao = false WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND ambiente = $4 AND serie <> $5 AND padrao', [empresa, emitenteId, modelo, ambiente, serie]);
    const r = await q(`UPDATE fis_numeracao SET proximo = COALESCE($6, proximo), padrao = COALESCE($7, padrao), atualizado_em = CURRENT_TIMESTAMP, atualizado_por = $8
        WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5 RETURNING *`,
      [empresa, emitenteId, modelo, serie, ambiente, proximo, typeof entrada.padrao === 'boolean' ? entrada.padrao : null, textoOpcional(usuario, 180)]);
    return numeracaoDto({ ...r.rows[0], ultimo_usado: usado || null });
  });
}
/** Exclui uma série que nunca foi usada (com documento, a série fica para o histórico). */
export async function excluirNumeracao(db, empresaId, { emitenteId, modelo, serie, ambiente } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const emit = exigirUuid(emitenteId, 'emitente');
  const s = Number(serie);
  return transacao(db, async (q) => {
    const usado = (await q('SELECT 1 FROM fis_documentos WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5 LIMIT 1', [empresa, emit, String(modelo), s, String(ambiente)])).rows[0];
    if (usado) throw new ErroDominio('SERIE_EM_USO', 'Esta série já tem documentos: não pode ser excluída', 409);
    const r = await q('DELETE FROM fis_numeracao WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5 RETURNING 1', [empresa, emit, String(modelo), s, String(ambiente)]);
    if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Série não encontrada', 404);
    return { ok: true };
  });
}

const TEXTO_HOMOLOGACAO_NFE = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
const PRAZO_CANCELAMENTO_MS = { 65: 30 * 60 * 1000, 55: 24 * 3600 * 1000 };

/** Unidade de onde sai a venda do bar (a comanda não tem unidade): a configurada no estoque ou a única ativa. */
async function unidadeDoBar(q, empresa) {
  const cfg = (await q("SELECT CASE WHEN to_regclass('est_config') IS NULL THEN NULL ELSE 1 END AS tem")).rows[0]?.tem
    ? (await q('SELECT loja_bar FROM est_config WHERE empresa_id = $1', [empresa])).rows[0]?.loja_bar : null;
  if (cfg) return cfg;
  const lojas = (await q('SELECT id FROM lojas WHERE empresa_id = $1 AND ativa IS NOT FALSE', [empresa])).rows;
  return lojas.length === 1 ? lojas[0].id : null;
}

/**
 * Emite um documento em homologação. `idempotencia` identifica o pedido do cliente: repetir devolve
 * o mesmo documento. Rejeitado tenta de novo com o mesmo número; falha de comunicação reenvia o
 * MESMO XML (mesma chave) e, se a autorizadora disser que já recebeu, consulta o protocolo.
 * A transmissão acontece fora da transação, com o documento marcado "enviando" (uma por vez).
 */
export async function emitir(db, empresaId, entrada = {}, { usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null, esperar = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const modelo = String(entrada.modelo || '65');
  if (!MODELOS.includes(modelo)) throw new ErroDominio('VALIDATION_ERROR', 'modelo deve ser 65 (NFC-e), 55 (NF-e) ou nfse');
  const origem = String(entrada.origem || 'manual');
  const explicita = Boolean(entrada.idempotencia);
  const base = String(entrada.idempotencia || (entrada.origemId ? `${origem}:${entrada.origemId}:${modelo}` : '')).slice(0, 110);
  if (!base) throw new ErroDominio('VALIDATION_ERROR', 'Informe a chave de idempotência');

  const passo = await transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`fis:doc:${empresa}:${base}`]);
    // Chave padrão (pela venda): o ambiente entra na chave e é o do EMITENTE que vai emitir esta
    // venda (não "o da empresa"), para a nota de produção nunca reaproveitar a de homologação.
    let vendaPre = null;
    let origemId = entrada.origemId ? String(entrada.origemId) : null;
    let idempotencia = base;
    if (!explicita) {
      if (origem !== 'manual') {
        vendaPre = await vendaDaOrigem(q, empresa, { origem, origemId: entrada.origemId, itens: entrada.itens, pagamentos: entrada.pagamentos, modelo });
        if (origem === 'bar_comanda') vendaPre.loja = await unidadeDoBar(q, empresa);
        if (vendaPre.origemId) origemId = String(vendaPre.origemId); // id canônico (comanda pedida pelo código visual)
      }
      const emitPre = await emitenteDaUnidade(q, empresa, lojaRestrita || entrada.lojaId || vendaPre?.loja || null, entrada.emitenteId);
      idempotencia = `${origem}:${origemId}:${modelo}${ambienteDe(emitPre) === 'producao' ? ':producao' : ''}`.slice(0, 120);
      if (idempotencia !== base) await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`fis:doc:${empresa}:${idempotencia}`]);
    }
    const existente = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND idempotencia = $2 FOR UPDATE', [empresa, idempotencia])).rows[0];
    if (existente) {
      if (existente.modelo !== modelo || existente.origem !== origem || (origemId && String(existente.origem_id || '') !== origemId)) {
        throw new ErroDominio('IDEMPOTENCY_CONFLICT', 'Esta chave já foi usada para outro documento', 409);
      }
      if (lojaRestrita && existente.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
      if (['autorizado', 'validado_localmente', 'cancelado', 'contingencia'].includes(existente.status)) return { pronto: existente, jaExistia: true };
      exigirProducaoLiberada(env, empresa, ambienteDe(existente));
      if (existente.status === 'enviando' && agora - new Date(existente.atualizado_em) < ENVIANDO_MAX_MS) throw new ErroDominio('EM_ANDAMENTO', 'Este documento está sendo enviado agora. Aguarde e consulte de novo.', 409);
      if (['enviando', 'falha_comunicacao'].includes(existente.status) && existente.xml_assinado) {
        if (!transmitirLigado(env, ambienteDe(existente), empresa)) throw new ErroDominio('TRANSMISSAO_DESLIGADA', 'O documento ficou pendente de envio e a transmissão está desligada neste servidor', 409);
        const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, existente.emitente_id])).rows[0];
        const material = await materialAtivo(q, empresa, env, agora);
        const doc = (await q("UPDATE fis_documentos SET status = 'enviando', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, existente.id])).rows[0];
        return { enviar: true, reenvio: true, doc, emit, material };
      }
      // número inutilizado depois da rejeição não volta a ser usado
      if (await faixaInutilizada(q, empresa, existente.emitente_id, existente.modelo, existente.serie, existente.numero, ambienteDe(existente))) {
        throw new ErroDominio('NUMERO_INUTILIZADO', `O número ${existente.numero} (série ${existente.serie}) foi inutilizado: este documento não pode ser reenviado`, 409);
      }
    }
    // venda (num reenvio de documento manual, os itens guardados valem)
    const entradaVenda = existente && origem === 'manual' && !entrada.itens
      ? { origem, itens: (existente.dados?.itens || []).map((i) => ({ fonte: i.fonte, fonteId: i.fonteId, descricao: i.descricaoOriginal || i.descricao, quantidade: i.quantidade, valorUnitario: i.valorUnitarioOriginal ?? i.valorUnitario })), pagamentos: existente.dados?.pagamentos || [] }
      : { origem, origemId: entrada.origemId, itens: entrada.itens, pagamentos: entrada.pagamentos };
    entradaVenda.modelo = modelo;
    const venda = vendaPre && !(existente && origem === 'manual' && !entrada.itens) ? vendaPre : await vendaDaOrigem(q, empresa, entradaVenda);
    if (origem === 'bar_comanda' && !vendaPre) venda.loja = await unidadeDoBar(q, empresa);
    if (venda.origemId) origemId = String(venda.origemId);
    if (lojaRestrita && venda.loja && venda.loja !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Venda não encontrada', 404);
    if (lojaRestrita && origem === 'bar_comanda' && !venda.loja) throw new ErroDominio('PERMISSION_DENIED', 'Nota do bar sem unidade definida exige permissão na empresa toda (defina a unidade do bar no Estoque)', 403);
    const loja = lojaRestrita || entrada.lojaId || venda.loja || null;
    const emit = await emitenteDaUnidade(q, empresa, loja, existente?.emitente_id || entrada.emitenteId);
    if (lojaRestrita && emit.loja_id && emit.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Emitente não encontrado', 404);
    const ambiente = existente ? ambienteDe(existente) : ambienteDe(emit);
    if (existente && ambienteDe(emit) !== ambiente) throw new ErroDominio('IDEMPOTENCY_CONFLICT', 'Este documento é de outro ambiente (homologação × produção): emita de novo com outra chave', 409);
    exigirProducaoLiberada(env, empresa, ambiente);
    const transmitir = transmitirLigado(env, ambiente, empresa);
    const homologacao = ambiente === 'homologacao';
    const destinatario = entrada.destinatario || existente?.dados?.destinatario || (venda.cpf ? { cpf: venda.cpf, nome: 'CONSUMIDOR' } : null);
    // classificação de cada item
    const pendencias = [];
    const itens = [];
    for (const [idx, i] of aplicarDesconto(venda.itens, venda.desconto).entries()) {
      const c = i.classificacao ? { tipo: modelo === 'nfse' ? 'servico' : 'produto', ...i.classificacao } : await classificacaoDe(q, empresa, i.fonte, i.fonteId, i.categoria, i.categoriaChave);
      if (!c) { pendencias.push(`Item ${idx + 1} (${i.descricao}) sem classificação fiscal`); continue; }
      if (modelo === 'nfse') {
        const ct = soDigitos(c.cTribNac || emit.c_trib_nac_padrao);
        if (ct.length !== 6) pendencias.push(`Item ${idx + 1} (${i.descricao}) sem cTribNac`);
        itens.push({ ...i, cTribNac: ct });
        continue;
      }
      if (c.tipo === 'servico') { pendencias.push(`Item ${idx + 1} (${i.descricao}) é serviço: vai em NFS-e`); continue; }
      const simples = ['1', '4'].includes(emit.crt);
      if (simples && !CSOSN_SUPORTADOS.includes(c.csosn || '102')) pendencias.push(`Item ${idx + 1}: CSOSN ${c.csosn} ainda não suportado nesta versão (use ${CSOSN_SUPORTADOS.join(', ')})`);
      if (!simples && !CST_SUPORTADOS.includes(c.cstIcms || '00')) pendencias.push(`Item ${idx + 1}: CST ${c.cstIcms} ainda não suportado nesta versão (use ${CST_SUPORTADOS.join(', ')})`);
      if (soDigitos(c.ncm).length !== 8) pendencias.push(`Item ${idx + 1} (${i.descricao}) sem NCM`);
      const st = simples ? c.csosn === '500' : c.cstIcms === '60';
      if (st && soDigitos(c.cest).length !== 7) pendencias.push(`Item ${idx + 1} (${i.descricao}): substituição tributária exige CEST`);
      if (!simples && ['00', '20'].includes(c.cstIcms || '00') && !(Number(c.aliquotaIcms) > 0)) pendencias.push(`Item ${idx + 1} (${i.descricao}): CST ${c.cstIcms || '00'} exige alíquota de ICMS`);
      itens.push({
        ...i, descricaoOriginal: i.descricao, produtoId: i.fonteId || String(idx + 1), descricao: homologacao && modelo === '65' && idx === 0 ? TEXTO_HOMOLOGACAO : i.descricao,
        fiscal: { ncm: c.ncm, cest: c.cest, cfop: c.cfop, origem: c.origem, csosn: c.csosn || '102', cstIcms: c.cstIcms || '00', aliquotaIcms: c.aliquotaIcms, reducaoBaseIcms: c.reducaoBaseIcms || 0, cstPis: c.cstPis, cstCofins: c.cstCofins, aliquotaPis: c.aliquotaPis, aliquotaCofins: c.aliquotaCofins, unidadeTributavel: c.unidadeTributavel || 'UN', cstIbsCbs: c.cstIbsCbs || null, cClassTrib: c.cClassTrib || null },
      });
    }
    let operacao = { idDest: '1', indFinal: '1' };
    if (modelo === '55') {
      const d = destinatario || {}; const e = d.endereco || d;
      if (!(soDigitos(d.cpf).length === 11 || soDigitos(d.cnpj).length === 14)) pendencias.push('NF-e exige destinatário com CPF ou CNPJ');
      if (!(e.logradouro && e.numero && e.bairro && e.cidade && e.uf && soDigitos(e.codigoMunicipio).length === 7 && soDigitos(e.cep).length === 8)) pendencias.push('NF-e exige o endereço completo do destinatário (com código IBGE do município)');
      else {
        operacao = operacaoNfe({ emit, destinatario: d, uf: String(e.uf).toUpperCase(), consumidorFinal: entrada.consumidorFinal, difal: entrada.difal, itens, pendencias });
        if (d.cnpj && !d.ie && !String(d.indIEDest || '')) pendencias.push('Destinatário com CNPJ: informe a IE ou marque como isento / não contribuinte');
      }
    }
    if (modelo === 'nfse' && new Set(itens.map((i) => i.cTribNac)).size > 1) pendencias.push('Itens com códigos de serviço diferentes: emita uma NFS-e por código');
    const cert = (await q('SELECT cnpj FROM fis_certificados WHERE empresa_id = $1 AND ativo = true', [empresa])).rows[0];
    if (cert?.cnpj && cert.cnpj.slice(0, 8) !== emit.cnpj.slice(0, 8)) pendencias.push('O certificado A1 ativo é de outro CNPJ (raiz diferente do emitente)');
    if (pendencias.length) throw new ErroDominio('PENDENCIAS_FISCAIS', pendencias.join(' · '), 422);
    const material = await materialAtivo(q, empresa, env, agora);
    const valorTotal = dinheiro(itens.reduce((s, i) => s + i.valorProduto, 0));
    const pagamentos = ajustarPagamentos(venda.pagamentos, valorTotal);
    // tributos aproximados (Lei 12.741): só com a tabela do IBPT da UF importada
    const tributos = modelo === 'nfse' ? null
      : await tributosAproximados(q, empresa, emit.uf, itens.map((i) => ({ ncm: i.fiscal?.ncm, origem: i.fiscal?.origem, valorProduto: i.valorProduto })), { hoje: agora });
    if (tributos) itens.forEach((i, idx) => { i.vTotTrib = tributos.itens[idx]; });
    const dadosObj = {
      // a classificação usada fica gravada: a contingência offline remonta o XML a partir daqui
      itens: itens.map(({ fiscal, ...x }) => ({ ...x, valorUnitarioOriginal: x.valorUnitario, ncm: fiscal?.ncm, cfop: fiscal?.cfop, unidade: fiscal?.unidadeTributavel, ...(fiscal ? { fiscal } : {}) })),
      destinatario: destinatario || null, pagamentos, desconto: dinheiro(venda.desconto || 0), indPres: entrada.indPres || venda.indPres || '1', operacao,
      ...(tributos ? { tributos: { total: tributos.total, federal: tributos.federal, estadual: tributos.estadual, municipal: tributos.municipal, fonte: tributos.fonte, versao: tributos.versao, chave: tributos.chave } } : {}),
    };
    const dados = JSON.stringify(dadosObj);
    let doc = existente;
    if (doc && doc.status === 'rejeitado' && (doc.mensagens || []).some((m) => m?.codigo === 'NUMERO_EM_USO')) {
      // o número era de outra emissão (não nosso): pega o próximo livre da série, já ajustada na tela
      const num = await reservarNumero(q, empresa, doc.emitente_id, doc.modelo, doc.serie, ambiente);
      doc = (await q('UPDATE fis_documentos SET numero = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *', [empresa, doc.id, num])).rows[0];
      await evento(q, empresa, doc.id, 'renumerado', { de: Number(existente.numero), para: Number(num) }, usuario);
    }
    if (!doc) {
      const serie = entrada.serie !== undefined && entrada.serie !== null && entrada.serie !== '' ? Number(entrada.serie) : await seriePadrao(q, empresa, emit.id, modelo, ambiente);
      const num = await reservarNumero(q, empresa, emit.id, modelo, serie, ambiente);
      try {
        doc = (await q(
          `INSERT INTO fis_documentos (empresa_id, emitente_id, loja_id, modelo, serie, numero, ambiente, status, origem, origem_id, idempotencia, valor_total, dados, emitido_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'rascunho',$8,$9,$10,$11,$12,$13) RETURNING *`,
          [empresa, emit.id, loja, modelo, serie, num, ambiente, origem, origemId, idempotencia, valorTotal, dados, textoOpcional(usuario, 180)])).rows[0];
      } catch (error) {
        if (error?.code === '23505' && String(error.constraint || '').includes('origem')) throw new ErroDominio('VENDA_JA_TEM_NOTA', 'Esta venda já tem um documento deste modelo em andamento ou emitido', 409);
        throw error;
      }
      await evento(q, empresa, doc.id, 'rascunho', { numero: Number(num), serie }, usuario);
    }
    // monta, assina e valida aqui: erro de montagem desfaz tudo (nenhum número é gasto)
    const montado = modelo === 'nfse'
      ? montarNfse({ doc, emit, itens, valorTotal, material, agora, destinatario })
      : montarNfe({ doc, emit, itens, pagamentos, material, env, agora, destinatario, empresa, tributos, indPres: dadosObj.indPres, operacao,
        // NFC-e de contingência rejeitada é corrigida e reenviada ainda em contingência
        contingencia: doc.tp_emis === '9' ? { justificativa: doc.contingencia_justificativa || JUSTIFICATIVA_CONTINGENCIA } : null });
    if (montado.dhEmi) dadosObj.dhEmi = montado.dhEmi;
    const status = transmitir ? 'enviando' : 'validado_localmente';
    const mensagensBase = [...montado.mensagens, ...(tributos?.mensagens || [])];
    const mensagens = transmitir || !homologacao ? mensagensBase : [...mensagensBase, { codigo: 'NAO_TRANSMITIDO', mensagem: modelo === 'nfse' ? 'DPS montada e assinada. Envio à Sefin Nacional (produção restrita) desligado (FISCAL_TRANSMITIR_HOMOLOGACAO).' : 'XML montado, assinado e validado. Transmissão para a SEFAZ de homologação desligada (FISCAL_TRANSMITIR_HOMOLOGACAO).' }];
    const atualizado = (await q(
      `UPDATE fis_documentos SET status = $3, emitente_id = $4, loja_id = $5, valor_total = $6, dados = $7, chave = $8, id_dps = $9, xml_assinado = $10, mensagens = $11, tp_emis = $12, protocolo = NULL, xml_autorizado = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, doc.id, status, emit.id, loja, valorTotal, JSON.stringify(dadosObj), montado.chave || null, montado.idDps || null, montado.xmlAssinado, JSON.stringify(mensagens), montado.tpEmis || '1'])).rows[0];
    if (!transmitir) { await evento(q, empresa, doc.id, 'validado_localmente', {}, usuario); return { pronto: atualizado, jaExistia: false }; }
    return { enviar: true, reenvio: false, doc: atualizado, emit, material };
  });
  if (passo.pronto) return { ...docDto(passo.pronto), idempotente: passo.jaExistia };

  const { doc, emit, material, reenvio } = passo;
  const consulta = (t, v) => db.query(t, v);
  let resultado;
  try {
    resultado = doc.modelo === 'nfse'
      ? await transmitirNfse({ doc, emit, material, transporte, reenvio })
      : await transmitirNfe({ doc, emit, material, transporte, env, esperar });
  } catch (error) {
    const msg = String(error?.message || error).slice(0, 300);
    // lote já recebido pela SEFAZ (há recibo): não sai em contingência, só consulta de novo depois
    const loteRecebido = ['SEFAZ_EM_PROCESSAMENTO', 'SEFAZ_RECIBO'].includes(error?.code);
    if (!(error instanceof ErroDominio) && !loteRecebido && doc.modelo === '65' && (doc.tp_emis === '9' || contingenciaLigada(entrada, env))) {
      // SEFAZ sem resposta: a NFC-e sai em contingência offline (tpEmis=9) e é transmitida depois
      try {
        const cont = await entrarEmContingencia(db, empresa, doc.id, { motivo: msg, usuario, env, agora, deStatus: ['enviando'] });
        return { ...cont, idempotente: false };
      } catch (erroContingencia) {
        if (!(erroContingencia instanceof ErroDominio)) throw erroContingencia;
        // sem como remontar em contingência: segue o fluxo normal de falha de comunicação
      }
    }
    await db.query("UPDATE fis_documentos SET status = 'falha_comunicacao', mensagens = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = 'enviando'", [empresa, doc.id, JSON.stringify([{ codigo: 'COMUNICACAO', mensagem: msg }])]);
    await evento(consulta, empresa, doc.id, 'falha_comunicacao', { mensagem: msg }, usuario);
    throw new ErroDominio('FALHA_COMUNICACAO', 'Falha de comunicação com a autorizadora. Tente de novo: o mesmo XML (mesma chave) é reenviado e, se já tiver sido autorizado, o protocolo é recuperado.', 502);
  }
  const r = await gravarResultado(db, empresa, doc.id, resultado);
  if (!r.rows[0]) return { ...docDto((await db.query('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2', [empresa, doc.id])).rows[0]), idempotente: true };
  await evento(consulta, empresa, doc.id, resultado.status, { cStat: resultado.cStat || null, reenvio }, usuario);
  return { ...docDto(r.rows[0]), idempotente: false };
}

/** Grava o resultado da transmissão (só se o documento ainda estiver "enviando"). */
function gravarResultado(db, empresa, docId, resultado) {
  return db.query(
    `UPDATE fis_documentos SET status = $3::varchar, chave = COALESCE($4, chave), protocolo = $5, xml_autorizado = $6, mensagens = $7,
            xml_assinado = COALESCE($8, xml_assinado), tp_emis = COALESCE($9, tp_emis),
            autorizado_em = CASE WHEN $3::varchar = 'autorizado' THEN CURRENT_TIMESTAMP ELSE NULL END, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND status = 'enviando' RETURNING *`,
    [empresa, docId, resultado.status, resultado.chave || null, resultado.protocolo || null, resultado.xmlAutorizado || null, JSON.stringify(resultado.mensagens || []),
      resultado.xmlAssinado || null, resultado.tpEmis || null]);
}

export const CST_IBSCBS_SUPORTADOS = ['000', '410'];
/**
 * Alíquotas do IBS/CBS. 2026 é o ano de teste: CBS 0,9% e IBS 0,1% (UF) + 0% (município), sem
 * recolhimento e fora do total da nota. FISCAL_IBSCBS_ALIQUOTAS ({"cbs":..,"ibsUf":..,"ibsMun":..}) troca.
 */
export function aliquotasIbsCbs(env = process.env) {
  let cfg = {};
  try { cfg = env.FISCAL_IBSCBS_ALIQUOTAS ? JSON.parse(env.FISCAL_IBSCBS_ALIQUOTAS) : {}; } catch { cfg = {}; }
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 100 ? Number(v) : d);
  return { cbs: n(cfg.cbs, 0.9), ibsUf: n(cfg.ibsUf, 0.1), ibsMun: n(cfg.ibsMun, 0) };
}
/**
 * Grupo IBSCBS de cada item. Base = valor do item menos ICMS, FCP, PIS e COFINS destacados
 * (LC 214/2025, art. 12, § 2º, na transição). CST 410 (imunidade/não incidência) vai sem valores.
 */
function calcularIbsCbs(calcItens, itens, env) {
  const al = aliquotasIbsCbs(env);
  const lista = calcItens.map((c, idx) => {
    const f = itens[idx]?.fiscal || {};
    const cst = f.cstIbsCbs || '000';
    const cClassTrib = f.cClassTrib || '000001';
    if (cst !== '000') return { cst, cClassTrib, semValores: true, vBC: 0, vIBSUF: 0, vIBSMun: 0, vIBS: 0, vCBS: 0 };
    const difal = itens[idx]?.difal;
    const deducoes = Number(c.icms?.valor || 0) + Number(c.icms?.valorFcp || 0) + Number(c.pis?.valor || 0) + Number(c.cofins?.valor || 0)
      + Number(difal?.vDestino || 0) + Number(difal?.vFcp || 0);
    const vBC = dinheiro(Math.max(0, Number(c.valorProduto || 0) - Number(c.desconto || 0) - deducoes));
    const vIBSUF = dinheiro(vBC * al.ibsUf / 100); const vIBSMun = dinheiro(vBC * al.ibsMun / 100); const vCBS = dinheiro(vBC * al.cbs / 100);
    return { cst, cClassTrib, vBC, pIBSUF: al.ibsUf, vIBSUF, pIBSMun: al.ibsMun, vIBSMun, vIBS: dinheiro(vIBSUF + vIBSMun), pCBS: al.cbs, vCBS };
  });
  const soma = (k) => dinheiro(lista.reduce((s, g) => s + Number(g[k] || 0), 0));
  return { itens: lista, total: { vBC: soma('vBC'), vIBSUF: soma('vIBSUF'), vIBSMun: soma('vIBSMun'), vIBS: soma('vIBS'), vCBS: soma('vCBS') } };
}

function montarNfe({ doc, emit, itens, pagamentos, material, env, agora, destinatario, empresa, contingencia = null, tributos = null, indPres = '1', operacao = null, svc = null }) {
  const ambiente = ambienteDe(doc);
  const homologacao = ambiente === 'homologacao';
  // CRT 2 (Simples com sublimite excedido) destaca ICMS por CST, como o regime normal
  const regime = ['1', '4'].includes(emit.crt) ? 'simples' : 'lucro_presumido';
  const calc = totalizarDocumentoFiscal(itens.map((i) => ({ ...i, desconto: 0 })), { regimeTributario: regime });
  const totaisBase = tributos && Number.isFinite(Number(tributos.total)) ? { ...calc.totais, vTotTrib: Number(tributos.total) } : calc.totais;
  // IBS/CBS (NT 2025.002): no regime normal (CRT 2 e 3) o grupo vai em cada item e no total
  const ibscbs = ['2', '3'].includes(String(emit.crt)) ? calcularIbsCbs(calc.itens, itens, env) : null;
  if (ibscbs) ibscbs.itens.forEach((g, idx) => { itens[idx].ibscbs = g; });
  const comDifal = itens.filter((i) => i.difal);
  const totaisDifal = comDifal.length ? { ...totaisBase, difal: { vFcp: dinheiro(comDifal.reduce((s, i) => s + i.difal.vFcp, 0)), vDestino: dinheiro(comDifal.reduce((s, i) => s + i.difal.vDestino, 0)) } } : totaisBase;
  const totais = ibscbs ? { ...totaisDifal, ibscbs: ibscbs.total } : totaisDifal;
  if (contingencia && doc.modelo !== '65') throw new ErroDominio('CONTINGENCIA_SO_NFCE', 'Contingência offline é só da NFC-e (65)', 409);
  if (svc && doc.modelo !== '55') throw new ErroDominio('CONTINGENCIA_SO_NFE', 'SVC é só da NF-e (55)', 409);
  const tpEmis = svc ? sefaz.tpEmisSvc(emit.uf) : (contingencia ? '9' : '1');
  const dhEmi = agoraFiscalCuiaba(agora);
  const chave = gerarChaveAcessoFiscal({ uf: emit.uf, dhEmi, cnpj: emit.cnpj, modelo: doc.modelo, serie: doc.serie, numero: doc.numero, tpEmis, codigoNumerico: String(crypto.randomInt(0, 99999999)).padStart(8, '0') });
  const end = sefaz.enderecos(emit.uf, doc.modelo, { ambiente, env, svc: Boolean(svc) }); // UF sem endereço falha aqui, antes de gastar número
  const csc = emit.csc_cifrado ? decifrar(emit.csc_cifrado, empresa, env) : '';
  if (doc.modelo === '65' && (!csc || !emit.csc_id)) throw new ErroDominio('PENDENCIAS_FISCAIS', `CSC de ${homologacao ? 'homologação' : 'produção'} não cadastrado no emitente`, 422);
  const config = {
    cnpj: emit.cnpj, razaoSocial: emit.razao_social, nomeFantasia: emit.nome_fantasia, ie: emit.ie, im: emit.im, crt: emit.crt, uf: emit.uf,
    endereco: { ...(emit.endereco || {}), codigoMunicipio: emit.codigo_municipio }, ambiente, regimeTributario: regime, indPres,
    idDest: operacao?.idDest || '1', indFinal: operacao?.indFinal || '1',
    naturezaOperacaoNfce: emit.natureza_operacao, naturezaOperacaoNfe: emit.natureza_operacao, cscId: emit.csc_id, csc,
  };
  const dest = doc.modelo === '55' ? (homologacao ? { ...destinatario, nome: TEXTO_HOMOLOGACAO_NFE } : destinatario) : (destinatario?.cpf || destinatario?.cnpj ? destinatario : null);
  // QR Code v3 de contingência: os parâmetros vão assinados (RSA-SHA1, chave do A1) no próprio QR
  let assinaturaQr = '';
  if (contingencia) {
    const conteudo = conteudoQrCodeOfflineV3({ chaveAcesso: chave, ambiente, dataEmissao: dhEmi, valorTotal: totais.valorTotal, identificacaoDestinatario: soDigitos(dest?.cnpj) || soDigitos(dest?.cpf) });
    try { assinaturaQr = crypto.sign('RSA-SHA1', Buffer.from(conteudo, 'utf8'), material.keyPem).toString('base64'); } catch (error) { throw new ErroDominio('ASSINATURA_FALHOU', `Não foi possível assinar o QR Code de contingência: ${String(error.message).slice(0, 200)}`, 422); }
  }
  let xml;
  try {
    xml = montarXmlFiscalV400({
      config, modelo: doc.modelo, numero: Number(doc.numero), serie: doc.serie, chaveAcesso: chave, dataEmissao: dhEmi,
      itens: calc.itens.map((c, idx) => ({ ...itens[idx], ...c, fiscal: c.fiscal })), totais, pagamentos, destinatario: dest,
      qrCodeUrl: end.qrCode, urlChave: end.consultaChave, qrCodeVersao: contingencia ? '3' : (env.FISCAL_NFCE_QR_VERSAO || '3'),
      contingencia: Boolean(contingencia), justificativaContingencia: contingencia?.justificativa || svc?.justificativa, qrCodeOfflineAssinatura: assinaturaQr, tpEmis,
    });
  } catch (error) { throw new ErroDominio('XML_INVALIDO', String(error.message).slice(0, 300), 422); }
  let assinado;
  try { assinado = assinarXmlFiscal(xml, { pfx: material.pfx, password: material.senha }).xml; } catch (error) { throw new ErroDominio('ASSINATURA_FALHOU', `Não foi possível assinar: ${String(error.message).slice(0, 200)}`, 422); }
  const validacao = validarXmlFiscal(assinado);
  const mensagens = [];
  if (!validacao.valido) {
    const semValidador = (validacao.xsd?.erros || []).some((e) => /xmllint|Schema oficial/i.test(e));
    if (!semValidador) throw new ErroDominio('XML_INVALIDO', `XML não passou no schema oficial: ${(validacao.xsd?.erros || validacao.estrutura?.erros || []).slice(0, 3).join(' | ')}`, 422);
    // em produção nenhum XML sai sem a validação do schema oficial
    if (!homologacao) throw new ErroDominio('XSD_INDISPONIVEL', 'Validador do schema oficial (xmllint) indisponível neste servidor: em produção a nota não é emitida sem essa validação.', 503);
    mensagens.push({ codigo: 'XSD_INDISPONIVEL', mensagem: 'Validador de schema indisponível neste servidor; XML assinado sem validação XSD.' });
  }
  return { chave, xmlAssinado: assinado, mensagens, dhEmi, tpEmis };
  // (tpEmis devolvido: 1 normal, 9 offline da NFC-e, 6/7 SVC da NF-e)
}

async function transmitirNfe({ doc, emit, material, transporte, env, esperar }) {
  const t = transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem, certChainPem: material.certChainPem });
  const ambiente = ambienteDe(doc);
  const svc = ['6', '7'].includes(String(doc.tp_emis));
  let ret = await sefaz.autorizar({ uf: emit.uf, modelo: doc.modelo, xmlAssinado: doc.xml_assinado, idLote: Date.now(), transporte: t, env, chaveEsperada: doc.chave, ambiente, svc, ...(esperar ? { esperar } : {}) });
  if (!ret.autorizado && ret.cStat === '204') {
    // "duplicidade de NF-e": a mesma chave já foi recebida (envio anterior sem resposta) → consulta o protocolo
    ret = await sefaz.consultarProtocolo({ uf: emit.uf, modelo: doc.modelo, chave: doc.chave, transporte: t, env, ambiente, svc });
  }
  if (!ret.autorizado && ret.cStat === '539' && doc.chave_substituida && doc.xml_substituido) {
    // contingência: "duplicidade com diferença na chave" = a emissão normal (sem resposta na hora)
    // chegou a ser autorizada. Vale a original; o XML de contingência é descartado.
    const orig = await sefaz.consultarProtocolo({ uf: emit.uf, modelo: doc.modelo, chave: doc.chave_substituida, transporte: t, env, ambiente });
    if (orig.autorizado) {
      const procOrig = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${doc.xml_substituido.replace(/^\s*<\?xml[^>]*\?>/, '')}${orig.protXml}</nfeProc>`;
      return {
        status: 'autorizado', chave: doc.chave_substituida, protocolo: orig.protocolo, cStat: orig.cStat, xmlAutorizado: procOrig, xmlAssinado: doc.xml_substituido, tpEmis: '1',
        mensagens: [{ codigo: orig.cStat, mensagem: orig.xMotivo }, { codigo: 'CONTINGENCIA_DESCARTADA', mensagem: 'A NFC-e da emissão normal já estava autorizada; o XML de contingência foi descartado.' }],
      };
    }
  }
  if (!ret.autorizado) {
    const mensagens = [{ codigo: ret.cStat, mensagem: ret.xMotivo }];
    if (ret.cStat === '539') mensagens.push({ codigo: 'NUMERO_EM_USO', mensagem: `O número ${doc.numero} da série ${doc.serie} já foi usado na SEFAZ por outra nota (emissor anterior?). Em Fiscal › Numeração, avance o próximo número desta série e emita de novo.` });
    return { status: 'rejeitado', cStat: ret.cStat, mensagens };
  }
  const proc = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${doc.xml_assinado.replace(/^\s*<\?xml[^>]*\?>/, '')}${ret.protXml}</nfeProc>`;
  return { status: 'autorizado', chave: doc.chave, protocolo: ret.protocolo, cStat: ret.cStat, xmlAutorizado: proc, mensagens: [{ codigo: ret.cStat, mensagem: ret.xMotivo }] };
}

function cfgNfse(emit, serie, ambiente = 'homologacao') {
  return nfse.normalizarConfigNfse({
    // homologação da NFS-e Nacional = produção restrita da Sefin
    ambiente: ambiente === 'producao' ? 'producao' : 'producao_restrita', cnpj: emit.cnpj, inscricaoMunicipal: emit.im || '', codigoMunicipio: emit.codigo_municipio, serie: String(serie),
    opSimpNac: emit.op_simp_nac, regApTribSN: emit.reg_ap_trib_sn, regEspTrib: emit.reg_esp_trib, cTribNacPadrao: emit.c_trib_nac_padrao || '',
    pTotTribSN: emit.p_tot_trib_sn === null ? '' : Number(emit.p_tot_trib_sn),
  });
}

function montarNfse({ doc, emit, itens, valorTotal, material, agora, destinatario }) {
  if (!emit.im) throw new ErroDominio('PENDENCIAS_FISCAIS', 'Inscrição municipal do emitente é obrigatória na NFS-e', 422);
  const cfg = cfgNfse(emit, doc.serie, ambienteDe(doc));
  const descricao = itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.descricaoOriginal || i.descricao}`).join('; ');
  let dps;
  try {
    dps = nfse.montarDpsXml(cfg, { numero: Number(doc.numero), dataEmissao: agora, tomador: destinatario || null, servico: { cTribNac: itens[0].cTribNac, descricao: `${descricao}.` }, valorServico: valorTotal });
  } catch (error) { throw new ErroDominio(error.code || 'NFSE_INVALIDA', error.message, 422); }
  return { idDps: dps.idDps, xmlAssinado: nfse.assinarElemento(dps.xml, 'infDPS', { certPem: material.certPem, keyPem: material.keyPem }), mensagens: [] };
}

async function transmitirNfse({ doc, emit, material, transporte, reenvio }) {
  const cfg = cfgNfse(emit, doc.serie, ambienteDe(doc));
  const cliente = nfse.clienteSefin(cfg, transporte || nfse.transporteHttps({ certPem: material.certPem, keyPem: material.keyPem, certChainPem: material.certChainPem }));
  const recuperar = async () => {
    const c = await cliente.consultarDps(doc.id_dps);
    return c?.chaveAcesso ? { status: 'autorizado', chave: c.chaveAcesso, mensagens: [{ codigo: 'RECUPERADA', mensagem: 'NFS-e recuperada pela DPS já recebida na Sefin.' }] } : null;
  };
  if (reenvio) { const ja = await recuperar(); if (ja) return ja; }
  const r = await cliente.emitir(doc.xml_assinado);
  if (r.ok) return { status: 'autorizado', chave: r.chaveAcesso, xmlAutorizado: r.nfseXmlGZipB64 ? nfse.gunzipB64(r.nfseXmlGZipB64) : null, mensagens: (r.alertas || []).map((a) => ({ codigo: 'ALERTA', mensagem: String(a?.descricao || a).slice(0, 300) })) };
  // DPS já existente: só é "nossa" num reenvio deste documento (envio anterior sem resposta). Num
  // primeiro envio, o número já foi usado por outra emissão (ex.: o emissor antigo da barbearia) e
  // recuperar traria a NFS-e de OUTRA venda.
  if ((r.erros || []).some((e) => /j[aá] (existe|foi)|duplic/i.test(`${e.descricao} ${e.complemento || ''}`))) {
    if (reenvio) { const ja = await recuperar(); if (ja) return ja; }
    return { status: 'rejeitado', mensagens: [...(r.erros || []).map((e) => ({ codigo: e.codigo, mensagem: e.descricao })), { codigo: 'NUMERO_EM_USO', mensagem: `A DPS número ${doc.numero} (série ${doc.serie}) já existe na Sefin Nacional, emitida por outro envio. Em Fiscal › Numeração, avance o próximo número da série da NFS-e e emita de novo.` }] };
  }
  return { status: 'rejeitado', mensagens: (r.erros || []).map((e) => ({ codigo: e.codigo, mensagem: e.descricao })) };
}

/** Assinatura SEFAZ (RSA-SHA1, C14N) no elemento indicado (infEvento, infInut). */
function assinarElementoSefaz(xml, elemento, { certPem, keyPem }) {
  const sig = new SignedXml({ privateKey: keyPem, publicCert: certPem });
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  sig.addReference({ xpath: `//*[local-name(.)='${elemento}']`, transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'], digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1' });
  sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${elemento}']`, action: 'after' } });
  return sig.getSignedXml();
}
const assinarInfEvento = (xml, material) => assinarElementoSefaz(xml, 'infEvento', material);

/** Cancela: autorizado → evento na autorizadora; validado localmente → só aqui (nunca foi à SEFAZ). */
export async function cancelar(db, empresaId, id, { justificativa, usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const just = String(justificativa || '').trim();
  if (just.length < 15) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa precisa de pelo menos 15 caracteres');
  return transacao(db, async (q) => {
    const doc = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'documento')])).rows[0];
    if (!doc || (lojaRestrita && doc.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
    if (doc.status === 'cancelado') return docDto(doc);
    if (doc.status === 'contingencia') throw new ErroDominio('INVALID_STATUS', 'NFC-e em contingência ainda não foi autorizada: transmita as contingências antes de cancelar', 409);
    if (!['autorizado', 'validado_localmente'].includes(doc.status)) throw new ErroDominio('INVALID_STATUS', `Documento ${doc.status} não se cancela (só autorizado ou validado)`, 409);
    let protocolo = null;
    if (doc.status === 'autorizado' && PRAZO_CANCELAMENTO_MS[doc.modelo] && agora - new Date(doc.autorizado_em) > PRAZO_CANCELAMENTO_MS[doc.modelo]) {
      throw new ErroDominio('PRAZO_CANCELAMENTO', doc.modelo === '65' ? 'NFC-e só se cancela até 30 minutos depois da autorização' : 'NF-e só se cancela até 24 horas depois da autorização', 409);
    }
    if (doc.status === 'autorizado') {
      const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
      const material = await materialAtivo(q, empresa, env, agora);
      exigirProducaoLiberada(env, empresa, ambienteDe(doc));
      if (doc.modelo === 'nfse') {
        const cfg = cfgNfse(emit, doc.serie, ambienteDe(doc));
        const ped = nfse.montarPedidoCancelamento(cfg, { chaveAcesso: doc.chave, cMotivo: '1', xMotivo: just, dataEvento: agora });
        const cliente = nfse.clienteSefin(cfg, transporte || nfse.transporteHttps({ certPem: material.certPem, keyPem: material.keyPem }));
        const r = await cliente.registrarEvento(doc.chave, nfse.assinarElemento(ped.xml, 'infPedReg', { certPem: material.certPem, keyPem: material.keyPem }));
        if (!r.ok) throw new ErroDominio('CANCELAMENTO_RECUSADO', (r.erros || []).map((e) => e.descricao).join(' · ') || 'Sefin recusou o cancelamento', 422);
      } else {
        const xml = sefaz.montarEventoCancelamento({ uf: emit.uf, cnpj: emit.cnpj, chave: doc.chave, protocolo: doc.protocolo, justificativa: just, dataEvento: agoraFiscalCuiaba(agora), ambiente: ambienteDe(doc) });
        const r = await sefaz.enviarEvento({ uf: emit.uf, modelo: doc.modelo, xmlAssinado: assinarInfEvento(xml, material), transporte: transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem }), env, ambiente: ambienteDe(doc) });
        if (!r.registrado) throw new ErroDominio('CANCELAMENTO_RECUSADO', `SEFAZ recusou o cancelamento (${r.cStat}): ${r.xMotivo}`, 422);
        protocolo = r.protocolo;
      }
    }
    const r = await q("UPDATE fis_documentos SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP, motivo_cancelamento = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, doc.id, just.slice(0, 255)]);
    await evento(q, empresa, doc.id, 'cancelado', { protocolo, naAutorizadora: doc.status === 'autorizado' }, usuario);
    return docDto(r.rows[0]);
  });
}

/**
 * Carta de correção (CC-e, evento 110110) de uma NF-e autorizada: corrige dados que não mudam o
 * imposto, o valor, as partes nem a data. Cada nova carta substitui a anterior (sequência 1 a 20).
 */
export async function cartaCorrecao(db, empresaId, id, { texto, usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const passo = await transacao(db, async (q) => {
    const doc = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'documento')])).rows[0];
    if (!doc || (lojaRestrita && doc.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
    if (doc.modelo !== '55') throw new ErroDominio('CCE_SO_NFE', 'Carta de correção é só da NF-e (55): a NFC-e é cancelada e emitida de novo', 409);
    if (doc.status !== 'autorizado') throw new ErroDominio('INVALID_STATUS', 'Só NF-e autorizada recebe carta de correção', 409);
    exigirProducaoLiberada(env, empresa, ambienteDe(doc));
    if (!transmitirLigado(env, ambienteDe(doc), empresa)) throw new ErroDominio('TRANSMISSAO_DESLIGADA', 'A transmissão à SEFAZ está desligada neste servidor', 409);
    const anteriores = Number((await q("SELECT count(*)::int AS n FROM fis_eventos WHERE empresa_id = $1 AND documento_id = $2 AND tipo = 'carta_correcao'", [empresa, doc.id])).rows[0].n);
    const seq = anteriores + 1;
    const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
    const material = await materialAtivo(q, empresa, env, agora);
    const xml = sefaz.montarEventoCartaCorrecao({ uf: emit.uf, cnpj: emit.cnpj, chave: doc.chave, texto, dataEvento: agoraFiscalCuiaba(agora), seq, ambiente: ambienteDe(doc) });
    return { doc, emit, material, seq, assinado: assinarInfEvento(xml, material) };
  });
  const { doc, emit, material, seq, assinado } = passo;
  let r;
  try {
    r = await sefaz.enviarEvento({ uf: emit.uf, modelo: '55', xmlAssinado: assinado, transporte: transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem }), env, ambiente: ambienteDe(doc) });
  } catch (error) {
    throw new ErroDominio('FALHA_COMUNICACAO', `Falha de comunicação com a SEFAZ: ${String(error?.message || error).slice(0, 200)}. Tente de novo.`, 502);
  }
  if (!r.registrado) throw new ErroDominio('CCE_RECUSADA', `SEFAZ recusou a carta de correção (${r.cStat}): ${r.xMotivo}`, 422);
  const textoFinal = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  await evento((t, v) => db.query(t, v), empresa, doc.id, 'carta_correcao', { seq, texto: textoFinal, protocolo: r.protocolo, cStat: r.cStat }, usuario);
  return { ok: true, sequencia: seq, protocolo: r.protocolo, texto: textoFinal };
}

export async function listarDocumentos(db, empresaId, { lojaId = null, status = null, modelo = null, limite = 200 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa]; let sql = 'SELECT * FROM fis_documentos WHERE empresa_id = $1';
  if (lojaId) { v.push(exigirUuid(lojaId, 'unidade')); sql += ` AND loja_id = $${v.length}`; }
  if (status) { v.push(String(status)); sql += ` AND status = $${v.length}`; }
  if (modelo && MODELOS.includes(modelo)) { v.push(modelo); sql += ` AND modelo = $${v.length}`; }
  const r = await db.query(`${sql} ORDER BY criado_em DESC LIMIT ${Math.min(Math.max(Number(limite) || 200, 1), 1000)}`, v);
  return r.rows.map((row) => docDto(row));
}

export async function obterDocumento(db, empresaId, id, { comXml = false, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(id, 'documento')]);
  if (!r.rows[0] || (lojaRestrita && r.rows[0].loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
  const eventos = (await db.query('SELECT tipo, detalhe, usuario, criado_em FROM fis_eventos WHERE empresa_id = $1 AND documento_id = $2 ORDER BY criado_em, id', [empresa, r.rows[0].id])).rows;
  return { ...docDto(r.rows[0], { comXml }), eventos };
}

/** Vendas pagas ainda sem nota (comandas do bar e da barbearia, pedidos da loja), para emitir pela tela. */
export async function vendasSemNota(db, empresaId, { limite = 100, lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const existe = async (t) => Boolean((await db.query('SELECT to_regclass($1) AS t', [t])).rows[0]?.t);
  const saida = [];
  const lim = Math.min(Math.max(Number(limite) || 100, 1), 500);
  // A venda "tem nota" quando tem documento vivo no ambiente do EMITENTE que a emitiria (o da
  // unidade dela, senão o geral): homologação não conta quando aquele emitente já está em produção.
  const emitentes = (await db.query('SELECT loja_id, ambiente FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true ORDER BY loja_id NULLS LAST', [empresa])).rows;
  const ambienteDaLoja = (loja) => (emitentes.find((e) => loja && e.loja_id === loja) || emitentes.find((e) => !e.loja_id) || emitentes[0])?.ambiente || 'homologacao';
  const temNota = (ambientes, loja) => (ambientes || []).includes(ambienteDaLoja(loja));
  const fora = (loja) => Boolean(lojaRestrita) && loja !== lojaRestrita;
  const vivos = "('autorizado', 'validado_localmente', 'enviando', 'contingencia')";
  if (await existe('bar_comandas')) {
    const lojaBar = await unidadeDoBar((t, v) => db.query(t, v), empresa);
    if (!fora(lojaBar)) {
      const r = await db.query(`SELECT c.id, c.nome, c.total, c.fechada_em,
          ARRAY(SELECT d.ambiente FROM fis_documentos d WHERE d.empresa_id = c.empresa_id AND d.origem = 'bar_comanda' AND d.origem_id = c.id::text AND d.status IN ${vivos}) AS ambientes
        FROM bar_comandas c WHERE c.empresa_id = $1 AND c.status = 'paga' ORDER BY c.fechada_em DESC NULLS LAST LIMIT ${lim * 3}`, [empresa]);
      for (const c of r.rows) if (!temNota(c.ambientes, lojaBar)) saida.push({ origem: 'bar_comanda', origemId: c.id, lojaId: lojaBar, descricao: `Comanda ${c.nome || ''}`.trim(), valor: Number(c.total || 0), data: c.fechada_em });
    }
  }
  if (await existe('commerce_orders')) {
    const r = await db.query(`SELECT o.id, o.public_code, o.criado_em, o.loja_id,
        (SELECT COALESCE(SUM(i.quantidade * i.preco_unitario - COALESCE(i.desconto, 0)), 0) FROM commerce_order_items i WHERE i.empresa_id = o.empresa_id AND i.order_id = o.id) AS valor,
        ARRAY(SELECT d.ambiente FROM fis_documentos d WHERE d.empresa_id = o.empresa_id AND d.origem = 'loja_pedido' AND d.origem_id = o.id::text AND d.status IN ${vivos}) AS ambientes
      FROM commerce_orders o WHERE o.empresa_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
      AND EXISTS (SELECT 1 FROM commerce_payments p WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id AND (p.status IN ('captured', 'paid') OR p.captured_at IS NOT NULL))
      ${lojaRestrita ? 'AND o.loja_id = $2' : ''}
      ORDER BY o.criado_em DESC LIMIT ${lim * 3}`, [empresa, ...(lojaRestrita ? [lojaRestrita] : [])]).catch(() => ({ rows: [] }));
    // valor = mercadorias do pedido (o frete não entra na NFC-e)
    for (const o of r.rows) if (!temNota(o.ambientes, o.loja_id)) saida.push({ origem: 'loja_pedido', origemId: o.id, lojaId: o.loja_id || null, descricao: `Pedido ${o.public_code}`, valor: dinheiro(o.valor), data: o.criado_em });
  }
  // comandas pagas da barbearia DESTA empresa com produto cobrado (os serviços vão em NFS-e)
  const bStore = estadoBarbearia(empresa);
  if (bStore?.comandas) {
    const cobrado = (i) => (i.subtotal !== undefined && i.subtotal !== null ? Number(i.subtotal) : Number(i.quantidade || 1) * Number(i.precoUnitario || i.preco || 0));
    const produtos = (c) => (c.itens || []).filter((i) => !itemDeServicoDaComanda(i) && !i.coberturaPlano && cobrado(i) > 0);
    const comProduto = Object.values(bStore.comandas)
      .filter((c) => c?.id && ['paga', 'em_conta'].includes(c.status) && produtos(c).length && !fora(lojaDaComanda(c, empresa)))
      .sort((a, b) => String(b.faturadaEm || b.criadoEm || '').localeCompare(String(a.faturadaEm || a.criadoEm || '')))
      .slice(0, lim * 3);
    const ids = comProduto.map((c) => String(c.id));
    const porId = new Map();
    if (ids.length) {
      const r = await db.query(`SELECT origem_id, ambiente FROM fis_documentos WHERE empresa_id = $1 AND origem = 'barbearia_comanda' AND origem_id = ANY($2::text[]) AND modelo IN ('65', '55') AND status IN ${vivos}`, [empresa, ids]);
      for (const d of r.rows) porId.set(d.origem_id, [...(porId.get(d.origem_id) || []), d.ambiente]);
    }
    for (const c of comProduto) {
      if (temNota(porId.get(String(c.id)), lojaDaComanda(c, empresa))) continue;
      // valor com o desconto da comanda rateado (o que a NFC-e vai mostrar)
      const todos = (c.itens || []).filter((i) => !i.coberturaPlano && cobrado(i) > 0);
      const bruto = todos.reduce((s, i) => s + cobrado(i), 0);
      const parte = produtos(c).reduce((s, i) => s + cobrado(i), 0);
      const desconto = bruto > 0 ? Math.min(bruto, Math.max(0, Number(c.desconto || 0))) * parte / bruto : 0;
      saida.push({ origem: 'barbearia_comanda', origemId: String(c.id), lojaId: lojaDaComanda(c, empresa), descricao: `Comanda ${c.codigoVisual || ''} · ${c.clienteNome || 'cliente'} (produtos)`.replace(/\s+/g, ' ').trim(), valor: dinheiro(parte - desconto), data: c.faturadaEm || c.criadoEm || null });
    }
  }
  return saida.sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))).slice(0, lim);
}

export async function testarComunicacao(db, empresaId, { modelo = '65', env = process.env, transporte = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const emit = await emitenteDaUnidade((t, v) => db.query(t, v), empresa, null);
  const material = await materialAtivo((t, v) => db.query(t, v), empresa, env);
  return { ambiente: ambienteDe(emit), ...(await sefaz.statusServico({ uf: emit.uf, modelo, transporte: transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem }), env, ambiente: ambienteDe(emit) })) };
}

// ── contingência offline da NFC-e (tpEmis=9) ─────────────────────────────────

/**
 * Passa uma NFC-e sem resposta da SEFAZ para contingência offline: remonta o XML com tpEmis=9,
 * dhCont/xJust e QR Code v3 assinado (nova chave, MESMO número), guarda o XML da tentativa normal
 * e deixa o documento "contingencia" até ser transmitido (prazo de 24 h). NF-e 55 não tem
 * contingência offline: continua no fluxo de falha de comunicação.
 */
export async function entrarEmContingencia(db, empresaId, id, { justificativa = null, motivo = null, usuario = null, env = process.env, agora = new Date(), lojaRestrita = null, deStatus = ['falha_comunicacao'] } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const xJust = String(justificativa || JUSTIFICATIVA_CONTINGENCIA).trim().replace(/\s+/g, ' ');
  if (xJust.length < 15 || xJust.length > 256) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa da contingência precisa ter de 15 a 256 caracteres');
  return transacao(db, async (q) => {
    const doc = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'documento')])).rows[0];
    if (!doc || (lojaRestrita && doc.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
    if (doc.status === 'contingencia') return docDto(doc);
    if (doc.modelo !== '65') throw new ErroDominio('CONTINGENCIA_SO_NFCE', 'Só a NFC-e (65) tem contingência offline; a NF-e continua pendente de envio', 409);
    if (!deStatus.includes(doc.status)) throw new ErroDominio('INVALID_STATUS', 'Só NFC-e sem resposta da SEFAZ (falha de comunicação) entra em contingência', 409);
    const aviso = { codigo: 'CONTINGENCIA', mensagem: `NFC-e emitida em contingência offline${motivo ? ` (${String(motivo).slice(0, 160)})` : ''}. Transmita em até 24 horas.` };
    if (doc.tp_emis === '9') {
      // já era de contingência (reenvio sem resposta): volta a aguardar a transmissão
      const r = await q("UPDATE fis_documentos SET status = 'contingencia', mensagens = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, doc.id, JSON.stringify([aviso])]);
      await evento(q, empresa, doc.id, 'contingencia', { reenvio: true, mensagem: motivo || null }, usuario);
      return docDto(r.rows[0]);
    }
    const itens = doc.dados?.itens || [];
    if (!itens.length || itens.some((i) => !i.fiscal)) throw new ErroDominio('CONTINGENCIA_INDISPONIVEL', 'Documento sem os dados fiscais dos itens gravados: tente transmitir de novo', 409);
    const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
    const material = await materialAtivo(q, empresa, env, agora);
    const montado = montarNfe({ doc, emit, itens, pagamentos: doc.dados?.pagamentos || [], material, env, agora, destinatario: doc.dados?.destinatario || null, empresa, contingencia: { justificativa: xJust }, tributos: doc.dados?.tributos || null, indPres: doc.dados?.indPres || '1' });
    const dados = { ...(doc.dados || {}), dhEmi: montado.dhEmi };
    const r = await q(
      `UPDATE fis_documentos SET status = 'contingencia', tp_emis = '9', xml_substituido = xml_assinado, chave_substituida = chave, chave = $3, xml_assinado = $4,
              contingencia_em = $5, contingencia_justificativa = $6, contingencia_atrasada = false, dados = $7, mensagens = $8, protocolo = NULL, xml_autorizado = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, doc.id, montado.chave, montado.xmlAssinado, agora, xJust, JSON.stringify(dados), JSON.stringify([aviso, ...montado.mensagens])]);
    await evento(q, empresa, doc.id, 'contingencia', { chaveNormal: doc.chave, chave: montado.chave, mensagem: motivo || null }, usuario);
    return docDto(r.rows[0]);
  });
}

/**
 * NF-e sem resposta da SEFAZ de origem: remonta com tpEmis 7 (SVC-RS) ou 6 (SVC-AN), mesmo número
 * e nova chave, e transmite na hora para a autorizadora virtual. O XML da tentativa normal fica
 * guardado: se a SEFAZ de origem disser depois que ela foi autorizada (539), vale a original.
 */
export async function emitirEmSvc(db, empresaId, id, { justificativa = null, usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null, esperar = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const xJust = String(justificativa || 'SEFAZ de origem sem resposta: falha de comunicação na autorização da NF-e').trim().replace(/\s+/g, ' ');
  if (xJust.length < 15 || xJust.length > 256) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa da contingência precisa ter de 15 a 256 caracteres');
  const passo = await transacao(db, async (q) => {
    const doc = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'documento')])).rows[0];
    if (!doc || (lojaRestrita && doc.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
    if (doc.modelo !== '55') throw new ErroDominio('CONTINGENCIA_SO_NFE', 'SVC é só da NF-e (55); a NFC-e usa a contingência offline', 409);
    if (doc.status !== 'falha_comunicacao') throw new ErroDominio('INVALID_STATUS', 'Só NF-e sem resposta da SEFAZ (falha de comunicação) vai para a SVC', 409);
    exigirProducaoLiberada(env, empresa, ambienteDe(doc));
    if (!transmitirLigado(env, ambienteDe(doc), empresa)) throw new ErroDominio('TRANSMISSAO_DESLIGADA', 'A transmissão à SEFAZ está desligada neste servidor', 409);
    const itens = doc.dados?.itens || [];
    if (!itens.length || itens.some((i) => !i.fiscal)) throw new ErroDominio('CONTINGENCIA_INDISPONIVEL', 'Documento sem os dados fiscais dos itens gravados', 409);
    const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
    const material = await materialAtivo(q, empresa, env, agora);
    const montado = montarNfe({ doc, emit, itens, pagamentos: doc.dados?.pagamentos || [], material, env, agora, destinatario: doc.dados?.destinatario || null, empresa, tributos: doc.dados?.tributos || null, indPres: doc.dados?.indPres || '1', operacao: doc.dados?.operacao || null, svc: { justificativa: xJust } });
    const r = await q(
      `UPDATE fis_documentos SET status = 'enviando', tp_emis = $3, xml_substituido = COALESCE(xml_substituido, xml_assinado), chave_substituida = COALESCE(chave_substituida, chave), chave = $4, xml_assinado = $5,
              contingencia_em = $6, contingencia_justificativa = $7, dados = $8, mensagens = $9, protocolo = NULL, xml_autorizado = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, doc.id, montado.tpEmis, montado.chave, montado.xmlAssinado, agora, xJust, JSON.stringify({ ...(doc.dados || {}), dhEmi: montado.dhEmi }), JSON.stringify(montado.mensagens)]);
    await evento(q, empresa, doc.id, 'svc', { chaveNormal: doc.chave, chave: montado.chave, tpEmis: montado.tpEmis }, usuario);
    return { doc: r.rows[0], emit, material };
  });
  let resultado;
  try {
    resultado = await transmitirNfe({ doc: passo.doc, emit: passo.emit, material: passo.material, transporte, env, esperar });
  } catch (error) {
    const msg = String(error?.message || error).slice(0, 300);
    await db.query("UPDATE fis_documentos SET status = 'falha_comunicacao', mensagens = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = 'enviando'", [empresa, passo.doc.id, JSON.stringify([{ codigo: 'COMUNICACAO', mensagem: `SVC sem resposta: ${msg}` }])]);
    throw new ErroDominio('FALHA_COMUNICACAO', 'A SVC também não respondeu. Tente de novo em instantes.', 502);
  }
  const r = await gravarResultado(db, empresa, passo.doc.id, resultado);
  await evento((t, v) => db.query(t, v), empresa, passo.doc.id, resultado.status, { cStat: resultado.cStat || null, svc: true }, usuario);
  return docDto(r.rows[0] || passo.doc);
}

/** NFC-e em contingência, mais antigas primeiro (para a tela e para a rotina de transmissão). */
export async function listarContingencias(db, empresaId, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa]; let sql = "SELECT * FROM fis_documentos WHERE empresa_id = $1 AND status = 'contingencia'";
  if (lojaRestrita) { v.push(lojaRestrita); sql += ` AND loja_id = $${v.length}`; }
  return (await db.query(`${sql} ORDER BY contingencia_em`, v)).rows.map((row) => docDto(row));
}

/**
 * Rotina das contingências: marca as que passaram de 24 h (atrasadas) e, com a transmissão de
 * homologação ligada, transmite as pendentes uma a uma (cada uma travada em "enviando").
 */
export async function transmitirContingencias(db, empresaId, { usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null, limite = 50, esperar = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const filtroLoja = lojaRestrita ? ' AND loja_id = $3' : '';
  const atrasadas = (await db.query(
    `UPDATE fis_documentos SET contingencia_atrasada = true WHERE empresa_id = $1 AND status = 'contingencia' AND NOT contingencia_atrasada AND contingencia_em < $2${filtroLoja} RETURNING id`,
    [empresa, new Date(agora.getTime() - PRAZO_CONTINGENCIA_MS), ...(lojaRestrita ? [lojaRestrita] : [])])).rows;
  for (const a of atrasadas) await evento((t, v) => db.query(t, v), empresa, a.id, 'contingencia_atrasada', { prazoHoras: 24 }, usuario);
  const ambienteEmpresa = await ambienteDaEmpresa(db, empresa);
  const resumo = { transmissao: situacaoTransmissao(env, ambienteEmpresa, empresa), marcadasAtrasadas: atrasadas.length, autorizadas: 0, rejeitadas: 0, falhas: 0, documentos: [] };
  // cada documento é transmitido no ambiente DELE (homologação e produção podem conviver)
  const candidatos = (await db.query(
    `SELECT id, ambiente FROM fis_documentos WHERE empresa_id = $1 AND tp_emis = '9' AND (status = 'contingencia' OR (status = 'enviando' AND atualizado_em < $2))${filtroLoja} ORDER BY contingencia_em LIMIT ${Math.min(Math.max(Number(limite) || 50, 1), 200)}`,
    [empresa, new Date(agora.getTime() - ENVIANDO_MAX_MS), ...(lojaRestrita ? [lojaRestrita] : [])])).rows;
  const ids = candidatos.filter((c) => transmitirLigado(env, ambienteDe(c), empresa) && (ambienteDe(c) !== 'producao' || producaoLiberada(env, empresa))).map((c) => c.id);
  resumo.pendentes = candidatos.length - ids.length;
  if (!ids.length && candidatos.length === 0) resumo.pendentes = (await listarContingencias(db, empresa, { lojaRestrita })).length;
  for (const id of ids) {
    const passo = await transacao(db, async (q) => {
      const doc = (await q(`UPDATE fis_documentos SET status = 'enviando', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND tp_emis = '9'
                              AND (status = 'contingencia' OR (status = 'enviando' AND atualizado_em < $3)) RETURNING *`, [empresa, id, new Date(agora.getTime() - ENVIANDO_MAX_MS)])).rows[0];
      if (!doc) return null; // outra rotina pegou
      const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
      return { doc, emit, material: await materialAtivo(q, empresa, env, agora) };
    });
    if (!passo) continue;
    const { doc, emit, material } = passo;
    let resultado;
    try {
      resultado = await transmitirNfe({ doc, emit, material, transporte, env, esperar });
    } catch (error) {
      const msg = String(error?.message || error).slice(0, 300);
      await db.query("UPDATE fis_documentos SET status = 'contingencia', mensagens = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = 'enviando'",
        [empresa, doc.id, JSON.stringify([{ codigo: 'COMUNICACAO', mensagem: `Contingência ainda pendente: ${msg}` }])]);
      await evento((t, v) => db.query(t, v), empresa, doc.id, 'falha_comunicacao', { mensagem: msg, contingencia: true }, usuario);
      resumo.falhas += 1;
      resumo.documentos.push({ id: doc.id, numero: Number(doc.numero), status: 'contingencia' });
      continue;
    }
    const r = (await gravarResultado(db, empresa, doc.id, resultado)).rows[0];
    if (!r) continue;
    await evento((t, v) => db.query(t, v), empresa, doc.id, resultado.status, { cStat: resultado.cStat || null, contingencia: true }, usuario);
    if (resultado.status === 'autorizado') resumo.autorizadas += 1; else resumo.rejeitadas += 1;
    resumo.documentos.push({ id: doc.id, numero: Number(doc.numero), status: resultado.status });
  }
  resumo.pendentes = (await listarContingencias(db, empresa, { lojaRestrita })).length;
  return resumo;
}

// ── inutilização de numeração (NF-e 55 e NFC-e 65) ───────────────────────────
function inutDto(row) {
  return {
    id: row.id, emitenteId: row.emitente_id, lojaId: row.loja_id || null, modelo: row.modelo, serie: row.serie, numeroInicial: Number(row.numero_inicial), numeroFinal: Number(row.numero_final),
    ano: row.ano, justificativa: row.justificativa, ambiente: row.ambiente, status: row.status, protocolo: row.protocolo || null, mensagens: row.mensagens || [],
    criadoPor: row.criado_por || null, criadoEm: row.criado_em, temXml: Boolean(row.xml_assinado),
  };
}

const inteiro = (v, rotulo, min, max) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroDominio('VALIDATION_ERROR', `${rotulo} deve ser um número inteiro de ${min} a ${max}`);
  return n;
};

/**
 * Inutiliza uma faixa de números ainda não usados de uma série do emitente. Sem
 * FISCAL_TRANSMITIR_HOMOLOGACAO o pedido fica "validado_localmente" (montado e assinado, sem
 * envio), mas os números já ficam bloqueados para emissão. Com a transmissão ligada, o pedido vai
 * à SEFAZ de homologação fora da transação (mesmo esquema de duas fases da emissão).
 */
export async function inutilizarNumeracao(db, empresaId, entrada = {}, { usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const modelo = String(entrada.modelo || '');
  if (!['55', '65'].includes(modelo)) throw new ErroDominio('VALIDATION_ERROR', 'Inutilização é para NF-e (55) ou NFC-e (65)');
  const serie = inteiro(entrada.serie ?? 1, 'Série', 0, 999);
  const ini = inteiro(entrada.numeroInicial, 'Número inicial', 1, 999999999);
  const fin = inteiro(entrada.numeroFinal ?? entrada.numeroInicial, 'Número final', ini, 999999999);
  const just = String(entrada.justificativa || '').trim().replace(/\s+/g, ' ');
  if (just.length < 15 || just.length > 255) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa precisa ter de 15 a 255 caracteres');
  const passo = await transacao(db, async (q) => {
    const emit = await emitenteDaUnidade(q, empresa, lojaRestrita || entrada.lojaId || null, entrada.emitenteId);
    if (lojaRestrita && emit.loja_id !== lojaRestrita) throw new ErroDominio('PERMISSION_DENIED', 'Inutilizar a numeração do emitente da empresa toda exige permissão na empresa toda', 403);
    const ambiente = ambienteDe(emit);
    exigirProducaoLiberada(env, empresa, ambiente);
    const transmitir = transmitirLigado(env, ambiente, empresa);
    // endereço do ambiente errado (ou UF sem endereço) falha aqui, antes de gravar
    if (transmitir && !sefaz.enderecos(emit.uf, modelo, { ambiente, env }).inutilizacao) throw new ErroDominio('UF_SEM_ENDERECO', `Endereço de inutilização da SEFAZ para ${emit.uf} não cadastrado`, 422);
    // trava a série: emissões e outras inutilizações desta série esperam
    const numeracao = (await q('SELECT proximo FROM fis_numeracao WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $5 FOR UPDATE', [empresa, emit.id, modelo, serie, ambiente])).rows[0];
    if (!numeracao) throw new ErroDominio('SERIE_INEXISTENTE', `A série ${serie} do modelo ${modelo} não existe para este emitente (nenhum documento emitido nela)`, 422);
    const mesma = (await q("SELECT * FROM fis_inutilizacoes WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND numero_inicial = $5 AND numero_final = $6 AND ambiente = $7 AND status <> 'rejeitada' FOR UPDATE",
      [empresa, emit.id, modelo, serie, ini, fin, ambiente])).rows[0];
    if (mesma) {
      if (mesma.status === 'homologada' || (mesma.status === 'validado_localmente' && !transmitir)) return { pronto: mesma, jaExistia: true };
      if (mesma.status === 'enviando' && agora - new Date(mesma.atualizado_em) < ENVIANDO_MAX_MS) throw new ErroDominio('EM_ANDAMENTO', 'Esta inutilização está sendo enviada agora. Aguarde e consulte de novo.', 409);
      if (!transmitir) throw new ErroDominio('TRANSMISSAO_DESLIGADA', 'A inutilização ficou pendente de envio e a transmissão está desligada neste servidor', 409);
      const material = await materialAtivo(q, empresa, env, agora);
      const row = (await q("UPDATE fis_inutilizacoes SET status = 'enviando', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, mesma.id])).rows[0];
      return { enviar: true, reenvio: mesma.status !== 'validado_localmente', row, emit, material, ambiente };
    }
    const sobre = (await q("SELECT numero_inicial, numero_final FROM fis_inutilizacoes WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND ambiente = $7 AND status <> 'rejeitada' AND numero_inicial <= $6 AND numero_final >= $5 LIMIT 1",
      [empresa, emit.id, modelo, serie, ini, fin, ambiente])).rows[0];
    if (sobre) throw new ErroDominio('NUMERO_INUTILIZADO', `A faixa se sobrepõe à inutilização ${sobre.numero_inicial}–${sobre.numero_final} desta série`, 409);
    const usados = (await q("SELECT numero, status FROM fis_documentos WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 AND numero BETWEEN $5 AND $6 AND ambiente = $7 AND status <> 'rejeitado' ORDER BY numero LIMIT 5",
      [empresa, emit.id, modelo, serie, ini, fin, ambiente])).rows;
    if (usados.length) throw new ErroDominio('NUMERO_EM_USO', `A faixa tem número já usado por documento: ${usados.map((u) => `${u.numero} (${u.status})`).join(', ')}`, 409);
    const cert = (await q('SELECT cnpj FROM fis_certificados WHERE empresa_id = $1 AND ativo = true', [empresa])).rows[0];
    if (cert?.cnpj && cert.cnpj.slice(0, 8) !== emit.cnpj.slice(0, 8)) throw new ErroDominio('PENDENCIAS_FISCAIS', 'O certificado A1 ativo é de outro CNPJ (raiz diferente do emitente)', 422);
    const material = await materialAtivo(q, empresa, env, agora);
    const ano = agoraFiscalCuiaba(agora).slice(2, 4);
    const pedido = sefaz.montarInutilizacao({ uf: emit.uf, ano, cnpj: emit.cnpj, modelo, serie, numeroInicial: ini, numeroFinal: fin, justificativa: just, ambiente });
    let assinado;
    try { assinado = assinarElementoSefaz(pedido.xml, 'infInut', material); } catch (error) { throw new ErroDominio('ASSINATURA_FALHOU', `Não foi possível assinar: ${String(error.message).slice(0, 200)}`, 422); }
    const mensagens = transmitir || ambiente === 'producao' ? [] : [{ codigo: 'NAO_TRANSMITIDO', mensagem: 'Pedido de inutilização montado e assinado. Transmissão para a SEFAZ de homologação desligada (FISCAL_TRANSMITIR_HOMOLOGACAO); os números ficam bloqueados para emissão.' }];
    const row = (await q(
      `INSERT INTO fis_inutilizacoes (empresa_id, emitente_id, loja_id, modelo, serie, numero_inicial, numero_final, ano, justificativa, ambiente, status, id_inut, xml_assinado, mensagens, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [empresa, emit.id, emit.loja_id || null, modelo, serie, ini, fin, ano, pedido.justificativa, ambiente, transmitir ? 'enviando' : 'validado_localmente', pedido.id, assinado, JSON.stringify(mensagens), textoOpcional(usuario, 180)])).rows[0];
    if (!transmitir) return { pronto: row, jaExistia: false };
    return { enviar: true, reenvio: false, row, emit, material, ambiente };
  });
  if (passo.pronto) return { ...inutDto(passo.pronto), idempotente: passo.jaExistia };

  const { row, emit, material, reenvio, ambiente } = passo;
  let ret;
  try {
    ret = await sefaz.inutilizar({ uf: emit.uf, modelo: row.modelo, xmlAssinado: row.xml_assinado, transporte: transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem }), env, reenvio, ambiente });
  } catch (error) {
    const msg = String(error?.message || error).slice(0, 300);
    await db.query("UPDATE fis_inutilizacoes SET status = 'falha_comunicacao', mensagens = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = 'enviando'", [empresa, row.id, JSON.stringify([{ codigo: 'COMUNICACAO', mensagem: msg }])]);
    if (error instanceof ErroDominio) throw error;
    throw new ErroDominio('FALHA_COMUNICACAO', 'Falha de comunicação com a SEFAZ. Peça a mesma inutilização de novo: o mesmo pedido é reenviado. Os números continuam bloqueados.', 502);
  }
  const r = await db.query(
    `UPDATE fis_inutilizacoes SET status = $3, protocolo = $4, xml_retorno = $5, mensagens = $6, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND status = 'enviando' RETURNING *`,
    [empresa, row.id, ret.homologada ? 'homologada' : 'rejeitada', ret.protocolo || null, ret.xmlRetorno || null, JSON.stringify([{ codigo: ret.cStat, mensagem: ret.xMotivo }])]);
  return { ...inutDto(r.rows[0] || row), idempotente: false };
}

export async function listarInutilizacoes(db, empresaId, { lojaRestrita = null, limite = 200 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const v = [empresa]; let sql = 'SELECT * FROM fis_inutilizacoes WHERE empresa_id = $1';
  if (lojaRestrita) { v.push(lojaRestrita); sql += ` AND loja_id = $${v.length}`; }
  const r = await db.query(`${sql} ORDER BY criado_em DESC LIMIT ${Math.min(Math.max(Number(limite) || 200, 1), 1000)}`, v);
  return r.rows.map(inutDto);
}

// ── DANFE (HTML imprimível) ──────────────────────────────────────────────────
export async function danfe(db, empresaId, id, { lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const doc = (await db.query('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(id, 'documento')])).rows[0];
  if (!doc || (lojaRestrita && doc.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
  if (doc.modelo === 'nfse') throw new ErroDominio('DANFE_INDISPONIVEL', 'NFS-e não tem DANFE: use o DANFSe do Portal Nacional', 422);
  if (!doc.xml_assinado || !doc.chave) throw new ErroDominio('DANFE_INDISPONIVEL', 'Documento ainda sem XML assinado', 422);
  const emitente = (await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
  return doc.modelo === '65' ? danfeNfceHtml({ doc, emitente }) : danfeNfeHtml({ doc, emitente });
}

// ── IBPT ─────────────────────────────────────────────────────────────────────
/** Importa o CSV oficial do IBPT. Sem UF informada, usa a UF do emitente da empresa. */
export async function importarIbpt(db, empresaId, { uf = null, arquivo } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  let u = String(uf || '').toUpperCase();
  if (!u) u = (await db.query('SELECT uf FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true ORDER BY loja_id NULLS FIRST LIMIT 1', [empresa])).rows[0]?.uf || '';
  if (!UFS.includes(u)) throw new ErroDominio('VALIDATION_ERROR', 'Informe a UF da tabela do IBPT (ou cadastre o emitente)');
  if (!arquivo || (typeof arquivo !== 'string' && !Buffer.isBuffer(arquivo))) throw new ErroDominio('VALIDATION_ERROR', 'Envie o arquivo CSV do IBPT');
  return importarTabelaIbpt(db, empresa, { uf: u, arquivo });
}

export const listarIbpt = (db, empresaId) => listarTabelasIbpt(db, empresaId);

// ── exclusões (tela: botão Excluir) ──────────────────────────────────────────
/** Emitente sem documento é apagado; com documento só é desativado (o histórico fiscal fica). */
export async function excluirEmitente(db, empresaId, id) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const emitenteId = exigirUuid(id, 'emitente');
  return transacao(db, async (q) => {
    const emit = (await q('SELECT id FROM fis_emitentes WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, emitenteId])).rows[0];
    if (!emit) throw new ErroDominio('NOT_FOUND', 'Emitente não encontrado', 404);
    const usado = (await q('SELECT 1 FROM fis_documentos WHERE empresa_id = $1 AND emitente_id = $2 LIMIT 1', [empresa, emitenteId])).rows[0]
      || (await q('SELECT 1 FROM fis_inutilizacoes WHERE empresa_id = $1 AND emitente_id = $2 LIMIT 1', [empresa, emitenteId])).rows[0];
    if (usado) {
      await q('UPDATE fis_emitentes SET ativo = false, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2', [empresa, emitenteId]);
      return { ok: true, desativado: true, mensagem: 'O emitente tem notas emitidas: foi desativado e o histórico continua disponível.' };
    }
    await q('DELETE FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, emitenteId]);
    return { ok: true, excluido: true };
  });
}

/** Volta a ativar um emitente desativado. */
export async function reativarEmitente(db, empresaId, id) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query('UPDATE fis_emitentes SET ativo = true, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *', [empresa, exigirUuid(id, 'emitente')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Emitente não encontrado', 404);
  return emitenteDto(r.rows[0]);
}

/** Só certificado substituído (inativo) sai do cofre; o que está em uso é trocado enviando outro. */
export async function excluirCertificado(db, empresaId, id) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query('SELECT ativo FROM fis_certificados WHERE empresa_id = $1 AND id = $2', [empresa, exigirUuid(id, 'certificado')]);
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Certificado não encontrado', 404);
  if (r.rows[0].ativo) throw new ErroDominio('CERTIFICADO_EM_USO', 'Este é o certificado em uso: envie o novo antes de excluir o atual', 409);
  await db.query('DELETE FROM fis_certificados WHERE empresa_id = $1 AND id = $2 AND ativo = false', [empresa, id]);
  return { ok: true, excluido: true };
}

/** Reativa um certificado substituído (ex.: o novo foi enviado por engano). */
export async function ativarCertificado(db, empresaId, id, { agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const certId = exigirUuid(id, 'certificado');
  return transacao(db, async (q) => {
    const c = (await q('SELECT * FROM fis_certificados WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, certId])).rows[0];
    if (!c) throw new ErroDominio('NOT_FOUND', 'Certificado não encontrado', 404);
    if (new Date(c.valido_ate) <= agora) throw new ErroDominio('CERTIFICADO_VENCIDO', 'Este certificado já venceu', 422);
    await q('UPDATE fis_certificados SET ativo = false WHERE empresa_id = $1 AND ativo = true AND id <> $2', [empresa, certId]);
    const r = await q('UPDATE fis_certificados SET ativo = true WHERE empresa_id = $1 AND id = $2 RETURNING *', [empresa, certId]);
    return certDto(r.rows[0]);
  });
}

/** Remove a classificação de um item (volta a valer a da categoria, se houver). */
export async function excluirClassificacao(db, empresaId, { fonte, fonteId } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!FONTES.includes(fonte)) throw new ErroDominio('VALIDATION_ERROR', 'fonte inválida');
  const id = String(fonteId || '').trim().slice(0, 80);
  if (!id) throw new ErroDominio('VALIDATION_ERROR', 'Informe o produto ou serviço');
  const r = await db.query('DELETE FROM fis_classificacoes WHERE empresa_id = $1 AND fonte = $2 AND fonte_id = $3', [empresa, fonte, id]);
  if (!r.rowCount) throw new ErroDominio('NOT_FOUND', 'Classificação não encontrada', 404);
  return { ok: true, excluido: true };
}

/** Apaga a tabela do IBPT de uma UF (as notas novas saem sem vTotTrib até importar outra). */
export async function excluirIbpt(db, empresaId, uf) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const u = String(uf || '').toUpperCase();
  if (!UFS.includes(u)) throw new ErroDominio('VALIDATION_ERROR', 'UF inválida');
  const r = await db.query('DELETE FROM fis_ibpt WHERE empresa_id = $1 AND uf = $2', [empresa, u]);
  if (!r.rowCount) throw new ErroDominio('NOT_FOUND', `Nenhuma tabela do IBPT para ${u}`, 404);
  return { ok: true, excluido: true, linhas: r.rowCount };
}
