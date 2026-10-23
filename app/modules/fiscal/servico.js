// Fiscal por empresa (migração 092): emitente, certificado A1 no cofre, classificação fiscal,
// numeração, documentos (NFC-e 65, NF-e 55, NFS-e Nacional) e eventos.
//
// SOMENTE HOMOLOGAÇÃO. O XML é montado, assinado e validado aqui; a transmissão à SEFAZ / Sefin
// só acontece com FISCAL_TRANSMITIR_HOMOLOGACAO=1 (senão o documento fica "validado
// localmente": XML pronto, sem valor fiscal e sem envio). Produção exige migração e decisão novas.
import crypto from 'node:crypto';
import { SignedXml } from 'xml-crypto';
import { ErroDominio, exigirTexto, exigirUuid, transacao } from '../acesso/banco.js';
import { cifrar, decifrar, cofreDisponivel } from './cofre.js';
import * as sefaz from './sefaz.js';
import { gerarChaveAcessoFiscal } from '../../fiscal-kytto.js';
import { montarXmlFiscalV400, assinarXmlFiscal, validarXmlFiscal, agoraFiscalCuiaba } from '../../fiscal-xml-kytto.js';
import { totalizarDocumentoFiscal } from '../../tributacao-kytto.js';
import * as nfse from '../../core/nfse-nacional.js';

export const AMBIENTE = 'homologacao';
export const TEXTO_HOMOLOGACAO = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
const MODELOS = ['65', '55', 'nfse'];
const FONTES = ['bar_produto', 'loja_variante', 'est_item', 'servico', 'categoria'];
const CSOSN_SUPORTADOS = ['102', '103', '300', '400'];
const CST_SUPORTADOS = ['00', '40', '41'];
const UFS = Object.keys(sefaz.CODIGOS_UF);

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const textoOpcional = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
const transmitirLigado = (env) => env.FISCAL_TRANSMITIR_HOMOLOGACAO === '1';

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

export async function listarEmitentes(db, empresaId) {
  const r = await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 ORDER BY loja_id NULLS FIRST', [exigirUuid(empresaId, 'empresa')]);
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
  if (dados.ambiente && dados.ambiente !== AMBIENTE) throw new ErroDominio('AMBIENTE_PROIBIDO', 'Nesta versão só o ambiente de homologação é permitido', 422);
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
    const valores = [empresa, loja, cnpj, exigirTexto(dados.razaoSocial, 'Razão social', { min: 2, max: 240 }), textoOpcional(dados.nomeFantasia, 240),
      textoOpcional(soDigitos(dados.ie) || (String(dados.ie || '').toUpperCase() === 'ISENTO' ? 'ISENTO' : ''), 20), textoOpcional(dados.im, 20), crt, uf, mun,
      JSON.stringify(endereco), textoOpcional(dados.cscId, 10), cscCifrado ?? null, textoOpcional(dados.naturezaOperacao, 60) || 'VENDA DE MERCADORIA',
      String(dados.opSimpNac || (crt === '3' ? '1' : crt === '4' ? '2' : '3')), String(dados.regApTribSN || '1'), String(dados.regEspTrib || '0'), pTot, ctrib || null];
    const r = await q(
      `INSERT INTO fis_emitentes (empresa_id, loja_id, cnpj, razao_social, nome_fantasia, ie, im, crt, uf, codigo_municipio, endereco, csc_id, csc_cifrado,
         natureza_operacao, op_simp_nac, reg_ap_trib_sn, reg_esp_trib, p_tot_trib_sn, c_trib_nac_padrao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (empresa_id, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
         cnpj = EXCLUDED.cnpj, razao_social = EXCLUDED.razao_social, nome_fantasia = EXCLUDED.nome_fantasia, ie = EXCLUDED.ie, im = EXCLUDED.im,
         crt = EXCLUDED.crt, uf = EXCLUDED.uf, codigo_municipio = EXCLUDED.codigo_municipio, endereco = EXCLUDED.endereco, csc_id = EXCLUDED.csc_id,
         csc_cifrado = COALESCE(EXCLUDED.csc_cifrado, fis_emitentes.csc_cifrado), natureza_operacao = EXCLUDED.natureza_operacao,
         op_simp_nac = EXCLUDED.op_simp_nac, reg_ap_trib_sn = EXCLUDED.reg_ap_trib_sn, reg_esp_trib = EXCLUDED.reg_esp_trib,
         p_tot_trib_sn = EXCLUDED.p_tot_trib_sn, c_trib_nac_padrao = EXCLUDED.c_trib_nac_padrao, atualizado_em = CURRENT_TIMESTAMP
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
  return { pfx, senha, certPem: pem.certPem, keyPem: pem.keyPem, validoAte: c.valido_ate };
}

// ── classificação fiscal ─────────────────────────────────────────────────────
function classificacaoDto(row) {
  return {
    fonte: row.fonte, fonteId: row.fonte_id, tipo: row.tipo, ncm: row.ncm || null, cest: row.cest || null, cfop: row.cfop || null, origem: row.origem,
    csosn: row.csosn || null, cstIcms: row.cst_icms || null, aliquotaIcms: Number(row.aliquota_icms), cstPis: row.cst_pis, cstCofins: row.cst_cofins,
    aliquotaPis: Number(row.aliquota_pis), aliquotaCofins: Number(row.aliquota_cofins), unidadeTributavel: row.unidade_tributavel || null,
    cTribNac: row.c_trib_nac || null, aliquotaIss: row.aliquota_iss === null ? null : Number(row.aliquota_iss),
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
  const r = await db.query(
    `INSERT INTO fis_classificacoes (empresa_id, fonte, fonte_id, tipo, ncm, cest, cfop, origem, csosn, cst_icms, aliquota_icms, cst_pis, cst_cofins, aliquota_pis, aliquota_cofins, unidade_tributavel, c_trib_nac, aliquota_iss)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (empresa_id, fonte, fonte_id) DO UPDATE SET tipo = EXCLUDED.tipo, ncm = EXCLUDED.ncm, cest = EXCLUDED.cest, cfop = EXCLUDED.cfop, origem = EXCLUDED.origem,
       csosn = EXCLUDED.csosn, cst_icms = EXCLUDED.cst_icms, aliquota_icms = EXCLUDED.aliquota_icms, cst_pis = EXCLUDED.cst_pis, cst_cofins = EXCLUDED.cst_cofins,
       aliquota_pis = EXCLUDED.aliquota_pis, aliquota_cofins = EXCLUDED.aliquota_cofins, unidade_tributavel = EXCLUDED.unidade_tributavel,
       c_trib_nac = EXCLUDED.c_trib_nac, aliquota_iss = EXCLUDED.aliquota_iss, atualizado_em = CURRENT_TIMESTAMP
     RETURNING *`,
    [empresa, dados.fonte, fonteId, tipo, ncm || null, cest || null, cfop || null, /^[0-8]$/.test(String(dados.origem)) ? String(dados.origem) : '0',
      textoOpcional(dados.csosn, 3), textoOpcional(dados.cstIcms, 2), Number(dados.aliquotaIcms) || 0, textoOpcional(dados.cstPis, 2) || '49', textoOpcional(dados.cstCofins, 2) || '49',
      Number(dados.aliquotaPis) || 0, Number(dados.aliquotaCofins) || 0, textoOpcional(String(dados.unidadeTributavel || '').toUpperCase(), 6), ctrib || null,
      dados.aliquotaIss === undefined || dados.aliquotaIss === '' || dados.aliquotaIss === null ? null : Number(dados.aliquotaIss)]);
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
  for (const [k, c] of cls) if (c.fonte === 'servico' || c.fonte === 'categoria') saida.push({ fonte: c.fonte, fonteId: c.fonteId, nome: c.fonteId, grupo: c.fonte === 'servico' ? 'Serviço' : 'Padrão de categoria', classificacao: c, herdada: false, chave: k });
  return saida;
}

async function classificacaoDe(q, empresa, fonte, fonteId, categoria = null) {
  const r = await q("SELECT * FROM fis_classificacoes WHERE empresa_id = $1 AND ((fonte = $2 AND fonte_id = $3) OR (fonte = 'categoria' AND fonte_id = $4)) ORDER BY (fonte = 'categoria')", [empresa, fonte, String(fonteId), categoria ? `bar:${categoria}` : '__nenhuma__']);
  return r.rows[0] ? classificacaoDto(r.rows[0]) : null;
}

// ── venda → itens do documento ───────────────────────────────────────────────
async function vendaDaOrigem(q, empresa, { origem, origemId, itens = [], pagamentos = [] }) {
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
    return {
      loja: o.loja_id || null,
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
  throw new ErroDominio('VALIDATION_ERROR', 'origem deve ser bar_comanda, loja_pedido ou manual');
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
  if (falta > 0) saida[saida.length - 1].valor = dinheiro(saida[saida.length - 1].valor + falta);
  return saida;
}

// ── prontidão e emissão ──────────────────────────────────────────────────────
export async function prontidao(db, empresaId, { lojaId = null, env = process.env } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const pendencias = [];
  const emit = (await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND ativo = true AND (loja_id = $2::uuid OR loja_id IS NULL) ORDER BY loja_id NULLS LAST LIMIT 1', [empresa, lojaId || null])).rows[0];
  if (!emit) pendencias.push('Emitente (CNPJ, IE, endereço) não cadastrado');
  else {
    const e = emit.endereco || {};
    for (const [rotulo, v] of [['logradouro', e.logradouro], ['número', e.numero], ['bairro', e.bairro], ['cidade', e.cidade], ['CEP', e.cep]]) if (!v) pendencias.push(`Endereço do emitente sem ${rotulo}`);
    if (!emit.ie) pendencias.push('Inscrição estadual do emitente (NFC-e/NF-e)');
    if (!emit.csc_cifrado || !emit.csc_id) pendencias.push('CSC e ID do CSC de homologação (NFC-e)');
    if (!emit.im) pendencias.push('Inscrição municipal (NFS-e)');
  }
  const cert = (await db.query('SELECT valido_ate FROM fis_certificados WHERE empresa_id = $1 AND ativo = true', [empresa])).rows[0];
  if (!cert) pendencias.push('Certificado A1');
  else if (new Date(cert.valido_ate) <= new Date()) pendencias.push('Certificado A1 vencido');
  if (!cofreDisponivel(env)) pendencias.push('Cofre fiscal do servidor (FISCAL_CERT_MASTER_KEY)');
  return {
    ambiente: AMBIENTE, transmissao: transmitirLigado(env) ? 'homologacao' : 'desligada',
    pronto: pendencias.length === 0, pendencias,
    certificadoValidoAte: cert?.valido_ate || null,
  };
}

function docDto(row, { comXml = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, modelo: row.modelo, serie: row.serie, numero: Number(row.numero), ambiente: row.ambiente, status: row.status, chave: row.chave || null,
    protocolo: row.protocolo || null, origem: row.origem, origemId: row.origem_id || null, lojaId: row.loja_id || null, valorTotal: Number(row.valor_total),
    mensagens: row.mensagens || [], dados: row.dados || {}, emitidoPor: row.emitido_por || null, autorizadoEm: row.autorizado_em, canceladoEm: row.cancelado_em,
    motivoCancelamento: row.motivo_cancelamento || null, criadoEm: row.criado_em, temXml: Boolean(row.xml_assinado), idempotencia: row.idempotencia,
    ...(comXml ? { xmlAssinado: row.xml_assinado || null, xmlAutorizado: row.xml_autorizado || null } : {}),
  };
}

async function evento(q, empresa, docId, tipo, detalhe = {}, usuario = null) {
  await q('INSERT INTO fis_eventos (empresa_id, documento_id, tipo, detalhe, usuario) VALUES ($1,$2,$3,$4,$5)', [empresa, docId, tipo, JSON.stringify(detalhe), textoOpcional(usuario, 180)]);
}

const ENVIANDO_MAX_MS = 2 * 60 * 1000;
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
export async function emitir(db, empresaId, entrada = {}, { usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const modelo = String(entrada.modelo || '65');
  if (!MODELOS.includes(modelo)) throw new ErroDominio('VALIDATION_ERROR', 'modelo deve ser 65 (NFC-e), 55 (NF-e) ou nfse');
  const origem = String(entrada.origem || 'manual');
  const idempotencia = String(entrada.idempotencia || (entrada.origemId ? `${origem}:${entrada.origemId}:${modelo}` : '')).slice(0, 120);
  if (!idempotencia) throw new ErroDominio('VALIDATION_ERROR', 'Informe a chave de idempotência');
  const transmitir = transmitirLigado(env);

  const passo = await transacao(db, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`fis:doc:${empresa}:${idempotencia}`]);
    const existente = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND idempotencia = $2 FOR UPDATE', [empresa, idempotencia])).rows[0];
    if (existente) {
      if (existente.modelo !== modelo || existente.origem !== origem || (entrada.origemId && String(existente.origem_id || '') !== String(entrada.origemId))) {
        throw new ErroDominio('IDEMPOTENCY_CONFLICT', 'Esta chave já foi usada para outro documento', 409);
      }
      if (lojaRestrita && existente.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
      if (['autorizado', 'validado_localmente', 'cancelado'].includes(existente.status)) return { pronto: existente, jaExistia: true };
      if (existente.status === 'enviando' && agora - new Date(existente.atualizado_em) < ENVIANDO_MAX_MS) throw new ErroDominio('EM_ANDAMENTO', 'Este documento está sendo enviado agora. Aguarde e consulte de novo.', 409);
      if (['enviando', 'falha_comunicacao'].includes(existente.status) && existente.xml_assinado) {
        if (!transmitir) throw new ErroDominio('TRANSMISSAO_DESLIGADA', 'O documento ficou pendente de envio e a transmissão está desligada neste servidor', 409);
        const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, existente.emitente_id])).rows[0];
        const material = await materialAtivo(q, empresa, env, agora);
        const doc = (await q("UPDATE fis_documentos SET status = 'enviando', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, existente.id])).rows[0];
        return { enviar: true, reenvio: true, doc, emit, material };
      }
    }
    // venda (num reenvio de documento manual, os itens guardados valem)
    const entradaVenda = existente && origem === 'manual' && !entrada.itens
      ? { origem, itens: (existente.dados?.itens || []).map((i) => ({ fonte: i.fonte, fonteId: i.fonteId, descricao: i.descricaoOriginal || i.descricao, quantidade: i.quantidade, valorUnitario: i.valorUnitarioOriginal ?? i.valorUnitario })), pagamentos: existente.dados?.pagamentos || [] }
      : { origem, origemId: entrada.origemId, itens: entrada.itens, pagamentos: entrada.pagamentos };
    const venda = await vendaDaOrigem(q, empresa, entradaVenda);
    if (origem === 'bar_comanda') venda.loja = await unidadeDoBar(q, empresa);
    if (lojaRestrita && venda.loja && venda.loja !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Venda não encontrada', 404);
    if (lojaRestrita && origem === 'bar_comanda' && !venda.loja) throw new ErroDominio('PERMISSION_DENIED', 'Nota do bar sem unidade definida exige permissão na empresa toda (defina a unidade do bar no Estoque)', 403);
    const loja = lojaRestrita || entrada.lojaId || venda.loja || null;
    const emit = await emitenteDaUnidade(q, empresa, loja, existente?.emitente_id || entrada.emitenteId);
    if (lojaRestrita && emit.loja_id && emit.loja_id !== lojaRestrita) throw new ErroDominio('NOT_FOUND', 'Emitente não encontrado', 404);
    const destinatario = entrada.destinatario || existente?.dados?.destinatario || (venda.cpf ? { cpf: venda.cpf, nome: 'CONSUMIDOR' } : null);
    // classificação de cada item
    const pendencias = [];
    const itens = [];
    for (const [idx, i] of aplicarDesconto(venda.itens, venda.desconto).entries()) {
      const c = i.classificacao ? { tipo: modelo === 'nfse' ? 'servico' : 'produto', ...i.classificacao } : await classificacaoDe(q, empresa, i.fonte, i.fonteId, i.categoria);
      if (!c) { pendencias.push(`Item ${idx + 1} (${i.descricao}) sem classificação fiscal`); continue; }
      if (modelo === 'nfse') {
        const ct = soDigitos(c.cTribNac || emit.c_trib_nac_padrao);
        if (ct.length !== 6) pendencias.push(`Item ${idx + 1} (${i.descricao}) sem cTribNac`);
        itens.push({ ...i, cTribNac: ct });
        continue;
      }
      if (c.tipo === 'servico') { pendencias.push(`Item ${idx + 1} (${i.descricao}) é serviço: vai em NFS-e`); continue; }
      const simples = ['1', '2', '4'].includes(emit.crt);
      if (simples && !CSOSN_SUPORTADOS.includes(c.csosn || '102')) pendencias.push(`Item ${idx + 1}: CSOSN ${c.csosn} ainda não suportado nesta versão (use ${CSOSN_SUPORTADOS.join(', ')})`);
      if (!simples && !CST_SUPORTADOS.includes(c.cstIcms || '00')) pendencias.push(`Item ${idx + 1}: CST ${c.cstIcms} ainda não suportado nesta versão (use ${CST_SUPORTADOS.join(', ')})`);
      itens.push({
        ...i, descricaoOriginal: i.descricao, produtoId: i.fonteId || String(idx + 1), descricao: modelo === '65' && idx === 0 ? TEXTO_HOMOLOGACAO : i.descricao,
        fiscal: { ncm: c.ncm, cest: c.cest, cfop: c.cfop, origem: c.origem, csosn: c.csosn || '102', cstIcms: c.cstIcms || '00', aliquotaIcms: c.aliquotaIcms, cstPis: c.cstPis, cstCofins: c.cstCofins, aliquotaPis: c.aliquotaPis, aliquotaCofins: c.aliquotaCofins, unidadeTributavel: c.unidadeTributavel || 'UN' },
      });
    }
    if (modelo === '55') {
      const d = destinatario || {}; const e = d.endereco || d;
      if (!(soDigitos(d.cpf).length === 11 || soDigitos(d.cnpj).length === 14)) pendencias.push('NF-e exige destinatário com CPF ou CNPJ');
      if (!(e.logradouro && e.numero && e.bairro && e.cidade && e.uf && soDigitos(e.codigoMunicipio).length === 7 && soDigitos(e.cep).length === 8)) pendencias.push('NF-e exige o endereço completo do destinatário (com código IBGE do município)');
      else if (String(e.uf).toUpperCase() !== emit.uf) pendencias.push('Destinatário de outra UF ainda não é suportado nesta versão');
    }
    if (modelo === 'nfse' && new Set(itens.map((i) => i.cTribNac)).size > 1) pendencias.push('Itens com códigos de serviço diferentes: emita uma NFS-e por código');
    const cert = (await q('SELECT cnpj FROM fis_certificados WHERE empresa_id = $1 AND ativo = true', [empresa])).rows[0];
    if (cert?.cnpj && cert.cnpj.slice(0, 8) !== emit.cnpj.slice(0, 8)) pendencias.push('O certificado A1 ativo é de outro CNPJ (raiz diferente do emitente)');
    if (pendencias.length) throw new ErroDominio('PENDENCIAS_FISCAIS', pendencias.join(' · '), 422);
    const material = await materialAtivo(q, empresa, env, agora);
    const valorTotal = dinheiro(itens.reduce((s, i) => s + i.valorProduto, 0));
    const pagamentos = ajustarPagamentos(venda.pagamentos, valorTotal);
    const dados = JSON.stringify({
      itens: itens.map(({ fiscal, ...x }) => ({ ...x, valorUnitarioOriginal: x.valorUnitario, ncm: fiscal?.ncm, cfop: fiscal?.cfop })),
      destinatario: destinatario || null, pagamentos,
    });
    let doc = existente;
    if (!doc) {
      const serie = Number(entrada.serie) || 1;
      await q('INSERT INTO fis_numeracao (empresa_id, emitente_id, modelo, serie) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [empresa, emit.id, modelo, serie]);
      const num = (await q('UPDATE fis_numeracao SET proximo = proximo + 1 WHERE empresa_id = $1 AND emitente_id = $2 AND modelo = $3 AND serie = $4 RETURNING proximo - 1 AS numero', [empresa, emit.id, modelo, serie])).rows[0].numero;
      try {
        doc = (await q(
          `INSERT INTO fis_documentos (empresa_id, emitente_id, loja_id, modelo, serie, numero, ambiente, status, origem, origem_id, idempotencia, valor_total, dados, emitido_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'rascunho',$8,$9,$10,$11,$12,$13) RETURNING *`,
          [empresa, emit.id, loja, modelo, serie, num, AMBIENTE, origem, entrada.origemId ? String(entrada.origemId) : null, idempotencia, valorTotal, dados, textoOpcional(usuario, 180)])).rows[0];
      } catch (error) {
        if (error?.code === '23505' && String(error.constraint || '').includes('origem')) throw new ErroDominio('VENDA_JA_TEM_NOTA', 'Esta venda já tem um documento deste modelo em andamento ou emitido', 409);
        throw error;
      }
      await evento(q, empresa, doc.id, 'rascunho', { numero: Number(num), serie }, usuario);
    }
    // monta, assina e valida aqui: erro de montagem desfaz tudo (nenhum número é gasto)
    const montado = modelo === 'nfse'
      ? montarNfse({ doc, emit, itens, valorTotal, material, agora, destinatario })
      : montarNfe({ doc, emit, itens, pagamentos, material, env, agora, destinatario, empresa });
    const status = transmitir ? 'enviando' : 'validado_localmente';
    const mensagens = transmitir ? montado.mensagens : [...montado.mensagens, { codigo: 'NAO_TRANSMITIDO', mensagem: modelo === 'nfse' ? 'DPS montada e assinada. Envio à Sefin Nacional (produção restrita) desligado (FISCAL_TRANSMITIR_HOMOLOGACAO).' : 'XML montado, assinado e validado. Transmissão para a SEFAZ de homologação desligada (FISCAL_TRANSMITIR_HOMOLOGACAO).' }];
    const atualizado = (await q(
      `UPDATE fis_documentos SET status = $3, emitente_id = $4, loja_id = $5, valor_total = $6, dados = $7, chave = $8, id_dps = $9, xml_assinado = $10, mensagens = $11, protocolo = NULL, xml_autorizado = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empresa, doc.id, status, emit.id, loja, valorTotal, dados, montado.chave || null, montado.idDps || null, montado.xmlAssinado, JSON.stringify(mensagens)])).rows[0];
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
      : await transmitirNfe({ doc, emit, material, transporte, env });
  } catch (error) {
    const msg = String(error?.message || error).slice(0, 300);
    await db.query("UPDATE fis_documentos SET status = 'falha_comunicacao', mensagens = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND status = 'enviando'", [empresa, doc.id, JSON.stringify([{ codigo: 'COMUNICACAO', mensagem: msg }])]);
    await evento(consulta, empresa, doc.id, 'falha_comunicacao', { mensagem: msg }, usuario);
    throw new ErroDominio('FALHA_COMUNICACAO', 'Falha de comunicação com a autorizadora. Tente de novo: o mesmo XML (mesma chave) é reenviado e, se já tiver sido autorizado, o protocolo é recuperado.', 502);
  }
  const r = await db.query(
    `UPDATE fis_documentos SET status = $3::varchar, chave = COALESCE($4, chave), protocolo = $5, xml_autorizado = $6, mensagens = $7,
            autorizado_em = CASE WHEN $3::varchar = 'autorizado' THEN CURRENT_TIMESTAMP ELSE NULL END, atualizado_em = CURRENT_TIMESTAMP
      WHERE empresa_id = $1 AND id = $2 AND status = 'enviando' RETURNING *`,
    [empresa, doc.id, resultado.status, resultado.chave || null, resultado.protocolo || null, resultado.xmlAutorizado || null, JSON.stringify(resultado.mensagens || [])]);
  if (!r.rows[0]) return { ...docDto((await db.query('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2', [empresa, doc.id])).rows[0]), idempotente: true };
  await evento(consulta, empresa, doc.id, resultado.status, { cStat: resultado.cStat || null, reenvio }, usuario);
  return { ...docDto(r.rows[0]), idempotente: false };
}

function montarNfe({ doc, emit, itens, pagamentos, material, env, agora, destinatario, empresa }) {
  const regime = ['1', '2', '4'].includes(emit.crt) ? 'simples' : 'lucro_presumido';
  const calc = totalizarDocumentoFiscal(itens.map((i) => ({ ...i, desconto: 0 })), { regimeTributario: regime });
  const dhEmi = agoraFiscalCuiaba(agora);
  const chave = gerarChaveAcessoFiscal({ uf: emit.uf, dhEmi, cnpj: emit.cnpj, modelo: doc.modelo, serie: doc.serie, numero: doc.numero, codigoNumerico: String(crypto.randomInt(0, 99999999)).padStart(8, '0') });
  const end = sefaz.enderecosHomologacao(emit.uf, doc.modelo, env); // UF sem endereço falha aqui, antes de gastar número
  const csc = emit.csc_cifrado ? decifrar(emit.csc_cifrado, empresa, env) : '';
  if (doc.modelo === '65' && (!csc || !emit.csc_id)) throw new ErroDominio('PENDENCIAS_FISCAIS', 'CSC de homologação não cadastrado no emitente', 422);
  const config = {
    cnpj: emit.cnpj, razaoSocial: emit.razao_social, nomeFantasia: emit.nome_fantasia, ie: emit.ie, im: emit.im, crt: emit.crt, uf: emit.uf,
    endereco: { ...(emit.endereco || {}), codigoMunicipio: emit.codigo_municipio }, ambiente: AMBIENTE, regimeTributario: regime,
    naturezaOperacaoNfce: emit.natureza_operacao, naturezaOperacaoNfe: emit.natureza_operacao, cscId: emit.csc_id, csc,
  };
  const dest = doc.modelo === '55' ? { ...destinatario, nome: TEXTO_HOMOLOGACAO_NFE } : (destinatario?.cpf || destinatario?.cnpj ? destinatario : null);
  let xml;
  try {
    xml = montarXmlFiscalV400({
      config, modelo: doc.modelo, numero: Number(doc.numero), serie: doc.serie, chaveAcesso: chave, dataEmissao: dhEmi,
      itens: calc.itens.map((c, idx) => ({ ...itens[idx], ...c, fiscal: c.fiscal })), totais: calc.totais, pagamentos, destinatario: dest,
      qrCodeUrl: end.qrCode, urlChave: end.consultaChave, qrCodeVersao: env.FISCAL_NFCE_QR_VERSAO || '3',
    });
  } catch (error) { throw new ErroDominio('XML_INVALIDO', String(error.message).slice(0, 300), 422); }
  let assinado;
  try { assinado = assinarXmlFiscal(xml, { pfx: material.pfx, password: material.senha }).xml; } catch (error) { throw new ErroDominio('ASSINATURA_FALHOU', `Não foi possível assinar: ${String(error.message).slice(0, 200)}`, 422); }
  const validacao = validarXmlFiscal(assinado);
  const mensagens = [];
  if (!validacao.valido) {
    const semValidador = (validacao.xsd?.erros || []).some((e) => /xmllint|Schema oficial/i.test(e));
    if (!semValidador) throw new ErroDominio('XML_INVALIDO', `XML não passou no schema oficial: ${(validacao.xsd?.erros || validacao.estrutura?.erros || []).slice(0, 3).join(' | ')}`, 422);
    mensagens.push({ codigo: 'XSD_INDISPONIVEL', mensagem: 'Validador de schema indisponível neste servidor; XML assinado sem validação XSD.' });
  }
  return { chave, xmlAssinado: assinado, mensagens };
}

async function transmitirNfe({ doc, emit, material, transporte, env }) {
  const t = transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem });
  let ret = await sefaz.autorizar({ uf: emit.uf, modelo: doc.modelo, xmlAssinado: doc.xml_assinado, idLote: Date.now(), transporte: t, env, chaveEsperada: doc.chave });
  if (!ret.autorizado && ret.cStat === '204') {
    // "duplicidade de NF-e": a mesma chave já foi recebida (envio anterior sem resposta) → consulta o protocolo
    ret = await sefaz.consultarProtocolo({ uf: emit.uf, modelo: doc.modelo, chave: doc.chave, transporte: t, env });
  }
  if (!ret.autorizado) return { status: 'rejeitado', cStat: ret.cStat, mensagens: [{ codigo: ret.cStat, mensagem: ret.xMotivo }] };
  const proc = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${doc.xml_assinado.replace(/^\s*<\?xml[^>]*\?>/, '')}${ret.protXml}</nfeProc>`;
  return { status: 'autorizado', chave: doc.chave, protocolo: ret.protocolo, cStat: ret.cStat, xmlAutorizado: proc, mensagens: [{ codigo: ret.cStat, mensagem: ret.xMotivo }] };
}

function cfgNfse(emit, serie) {
  return nfse.normalizarConfigNfse({
    ambiente: 'producao_restrita', cnpj: emit.cnpj, inscricaoMunicipal: emit.im || '', codigoMunicipio: emit.codigo_municipio, serie: String(serie),
    opSimpNac: emit.op_simp_nac, regApTribSN: emit.reg_ap_trib_sn, regEspTrib: emit.reg_esp_trib, cTribNacPadrao: emit.c_trib_nac_padrao || '',
    pTotTribSN: emit.p_tot_trib_sn === null ? '' : Number(emit.p_tot_trib_sn),
  });
}

function montarNfse({ doc, emit, itens, valorTotal, material, agora, destinatario }) {
  if (!emit.im) throw new ErroDominio('PENDENCIAS_FISCAIS', 'Inscrição municipal do emitente é obrigatória na NFS-e', 422);
  const cfg = cfgNfse(emit, doc.serie);
  const descricao = itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.descricaoOriginal || i.descricao}`).join('; ');
  let dps;
  try {
    dps = nfse.montarDpsXml(cfg, { numero: Number(doc.numero), dataEmissao: agora, tomador: destinatario || null, servico: { cTribNac: itens[0].cTribNac, descricao: `${descricao}.` }, valorServico: valorTotal });
  } catch (error) { throw new ErroDominio(error.code || 'NFSE_INVALIDA', error.message, 422); }
  return { idDps: dps.idDps, xmlAssinado: nfse.assinarElemento(dps.xml, 'infDPS', { certPem: material.certPem, keyPem: material.keyPem }), mensagens: [] };
}

async function transmitirNfse({ doc, emit, material, transporte, reenvio }) {
  const cfg = cfgNfse(emit, doc.serie);
  const cliente = nfse.clienteSefin(cfg, transporte || nfse.transporteHttps({ certPem: material.certPem, keyPem: material.keyPem }));
  const recuperar = async () => {
    const c = await cliente.consultarDps(doc.id_dps);
    return c?.chaveAcesso ? { status: 'autorizado', chave: c.chaveAcesso, mensagens: [{ codigo: 'RECUPERADA', mensagem: 'NFS-e recuperada pela DPS já recebida na Sefin.' }] } : null;
  };
  if (reenvio) { const ja = await recuperar(); if (ja) return ja; }
  const r = await cliente.emitir(doc.xml_assinado);
  if (r.ok) return { status: 'autorizado', chave: r.chaveAcesso, xmlAutorizado: r.nfseXmlGZipB64 ? nfse.gunzipB64(r.nfseXmlGZipB64) : null, mensagens: (r.alertas || []).map((a) => ({ codigo: 'ALERTA', mensagem: String(a?.descricao || a).slice(0, 300) })) };
  // DPS já existente (envio anterior sem resposta): recupera em vez de rejeitar
  if ((r.erros || []).some((e) => /j[aá] (existe|foi)|duplic/i.test(`${e.descricao} ${e.complemento || ''}`))) { const ja = await recuperar(); if (ja) return ja; }
  return { status: 'rejeitado', mensagens: (r.erros || []).map((e) => ({ codigo: e.codigo, mensagem: e.descricao })) };
}

/** Assinatura do evento (SEFAZ NF-e: RSA-SHA1, C14N) no elemento infEvento. */
function assinarInfEvento(xml, { certPem, keyPem }) {
  const sig = new SignedXml({ privateKey: keyPem, publicCert: certPem });
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  sig.addReference({ xpath: "//*[local-name(.)='infEvento']", transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'], digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1' });
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='infEvento']", action: 'after' } });
  return sig.getSignedXml();
}

/** Cancela: autorizado → evento na autorizadora; validado localmente → só aqui (nunca foi à SEFAZ). */
export async function cancelar(db, empresaId, id, { justificativa, usuario = null, env = process.env, transporte = null, agora = new Date(), lojaRestrita = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const just = String(justificativa || '').trim();
  if (just.length < 15) throw new ErroDominio('VALIDATION_ERROR', 'A justificativa precisa de pelo menos 15 caracteres');
  return transacao(db, async (q) => {
    const doc = (await q('SELECT * FROM fis_documentos WHERE empresa_id = $1 AND id = $2 FOR UPDATE', [empresa, exigirUuid(id, 'documento')])).rows[0];
    if (!doc || (lojaRestrita && doc.loja_id !== lojaRestrita)) throw new ErroDominio('NOT_FOUND', 'Documento não encontrado', 404);
    if (doc.status === 'cancelado') return docDto(doc);
    if (!['autorizado', 'validado_localmente'].includes(doc.status)) throw new ErroDominio('INVALID_STATUS', `Documento ${doc.status} não se cancela (só autorizado ou validado)`, 409);
    let protocolo = null;
    if (doc.status === 'autorizado' && PRAZO_CANCELAMENTO_MS[doc.modelo] && agora - new Date(doc.autorizado_em) > PRAZO_CANCELAMENTO_MS[doc.modelo]) {
      throw new ErroDominio('PRAZO_CANCELAMENTO', doc.modelo === '65' ? 'NFC-e só se cancela até 30 minutos depois da autorização' : 'NF-e só se cancela até 24 horas depois da autorização', 409);
    }
    if (doc.status === 'autorizado') {
      const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
      const material = await materialAtivo(q, empresa, env, agora);
      if (doc.modelo === 'nfse') {
        const cfg = cfgNfse(emit, doc.serie);
        const ped = nfse.montarPedidoCancelamento(cfg, { chaveAcesso: doc.chave, cMotivo: '1', xMotivo: just, dataEvento: agora });
        const cliente = nfse.clienteSefin(cfg, transporte || nfse.transporteHttps({ certPem: material.certPem, keyPem: material.keyPem }));
        const r = await cliente.registrarEvento(doc.chave, nfse.assinarElemento(ped.xml, 'infPedReg', { certPem: material.certPem, keyPem: material.keyPem }));
        if (!r.ok) throw new ErroDominio('CANCELAMENTO_RECUSADO', (r.erros || []).map((e) => e.descricao).join(' · ') || 'Sefin recusou o cancelamento', 422);
      } else {
        const xml = sefaz.montarEventoCancelamento({ uf: emit.uf, cnpj: emit.cnpj, chave: doc.chave, protocolo: doc.protocolo, justificativa: just, dataEvento: agoraFiscalCuiaba(agora) });
        const r = await sefaz.enviarEvento({ uf: emit.uf, modelo: doc.modelo, xmlAssinado: assinarInfEvento(xml, material), transporte: transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem }), env });
        if (!r.registrado) throw new ErroDominio('CANCELAMENTO_RECUSADO', `SEFAZ recusou o cancelamento (${r.cStat}): ${r.xMotivo}`, 422);
        protocolo = r.protocolo;
      }
    }
    const r = await q("UPDATE fis_documentos SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP, motivo_cancelamento = $3, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *", [empresa, doc.id, just.slice(0, 255)]);
    await evento(q, empresa, doc.id, 'cancelado', { protocolo, naAutorizadora: doc.status === 'autorizado' }, usuario);
    return docDto(r.rows[0]);
  });
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

/** Vendas pagas ainda sem nota (comandas do bar e pedidos da loja), para emitir pela tela. */
export async function vendasSemNota(db, empresaId, { limite = 100 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const existe = async (t) => Boolean((await db.query('SELECT to_regclass($1) AS t', [t])).rows[0]?.t);
  const saida = [];
  const lim = Math.min(Math.max(Number(limite) || 100, 1), 500);
  if (await existe('bar_comandas')) {
    const r = await db.query(`SELECT c.id, c.nome, c.total, c.fechada_em FROM bar_comandas c WHERE c.empresa_id = $1 AND c.status = 'paga'
      AND NOT EXISTS (SELECT 1 FROM fis_documentos d WHERE d.empresa_id = c.empresa_id AND d.origem = 'bar_comanda' AND d.origem_id = c.id::text AND d.status IN ('autorizado', 'validado_localmente', 'enviando'))
      ORDER BY c.fechada_em DESC NULLS LAST LIMIT ${lim}`, [empresa]);
    saida.push(...r.rows.map((c) => ({ origem: 'bar_comanda', origemId: c.id, descricao: `Comanda ${c.nome || ''}`.trim(), valor: Number(c.total || 0), data: c.fechada_em })));
  }
  if (await existe('commerce_orders')) {
    const r = await db.query(`SELECT o.id, o.public_code, o.criado_em FROM commerce_orders o WHERE o.empresa_id = $1
      AND EXISTS (SELECT 1 FROM commerce_payments p WHERE p.empresa_id = o.empresa_id AND p.order_id = o.id AND (p.status IN ('captured', 'paid') OR p.captured_at IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM fis_documentos d WHERE d.empresa_id = o.empresa_id AND d.origem = 'loja_pedido' AND d.origem_id = o.id::text AND d.status IN ('autorizado', 'validado_localmente', 'enviando'))
      ORDER BY o.criado_em DESC LIMIT ${lim}`, [empresa]).catch(() => ({ rows: [] }));
    saida.push(...r.rows.map((o) => ({ origem: 'loja_pedido', origemId: o.id, descricao: `Pedido ${o.public_code}`, valor: null, data: o.criado_em })));
  }
  return saida;
}

export async function testarComunicacao(db, empresaId, { modelo = '65', env = process.env, transporte = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const emit = await emitenteDaUnidade((t, v) => db.query(t, v), empresa, null);
  const material = await materialAtivo((t, v) => db.query(t, v), empresa, env);
  return sefaz.statusServico({ uf: emit.uf, modelo, transporte: transporte || sefaz.transporteSoap({ certPem: material.certPem, keyPem: material.keyPem }), env });
}
