// SPED fiscal a partir das notas emitidas pela própria empresa (fis_documentos):
//  - EFD ICMS/IPI (leiaute 020, vigente em 2026, Guia Prático 3.2.2);
//  - EFD-Contribuições (leiaute 006, Guia Prático 1.35) no regime cumulativo (Lucro Presumido).
// Os valores saem do XML que foi para a SEFAZ (o que vale fiscalmente), não de recálculo.
//
// LIMITE IMPORTANTE: só entram as SAÍDAS emitidas aqui. Entradas (compras com crédito), inventário,
// ajustes e outros documentos (CT-e, energia etc.) não estão no sistema: o arquivo é a base do
// contador, que completa no PVA antes de transmitir. Simples Nacional é dispensado das duas EFDs.
import { DOMParser } from '@xmldom/xmldom';
import { ErroDominio, exigirUuid } from '../acesso/banco.js';

export const COD_VER_EFD_ICMS_IPI = { 2025: '019', 2026: '020' };
export const COD_VER_EFD_CONTRIBUICOES = '006';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const limpar = (v, max = 0) => {
  // sem "|" nem caracteres de controle; o arquivo é ISO-8859-1
  const t = String(v ?? '').replace(/[|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return max ? t.slice(0, max) : t;
};
const num = (v, casas = 2) => {
  const n = Number(v || 0);
  return (Math.round(n * 10 ** casas) / 10 ** casas).toFixed(casas).replace('.', ',');
};
const dataSped = (d) => { const [a, m, dia] = String(d).slice(0, 10).split('-'); return `${dia}${m}${a}`; };
const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;

// ── leitura do XML da NF-e/NFC-e ─────────────────────────────────────────────
const filho = (el, nome) => (el ? Array.from(el.childNodes || []).find((n) => n.nodeType === 1 && n.localName === nome) || null : null);
const primeiro = (el, nome) => (el ? el.getElementsByTagNameNS('*', nome)[0] || null : null);
const txt = (el, nome) => { const e = nome ? primeiro(el, nome) : el; return e ? String(e.textContent || '').trim() : ''; };
const val = (el, nome) => Number(txt(el, nome) || 0);

/** Extrai do XML (autorizado ou assinado) o que a escrituração precisa. */
export function lerNotaXml(xml) {
  const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
  const inf = primeiro(doc, 'infNFe');
  if (!inf) throw new Error('XML sem infNFe');
  const ide = filho(inf, 'ide'); const emit = filho(inf, 'emit'); const dest = filho(inf, 'dest'); const total = filho(inf, 'total');
  const tot = filho(total, 'ICMSTot');
  const itens = Array.from(inf.getElementsByTagNameNS('*', 'det')).map((det) => {
    const prod = filho(det, 'prod'); const imp = filho(det, 'imposto');
    const icmsGrupo = filho(imp, 'ICMS'); const icms = icmsGrupo ? Array.from(icmsGrupo.childNodes).find((n) => n.nodeType === 1) : null;
    const pisG = filho(imp, 'PIS'); const pis = pisG ? Array.from(pisG.childNodes).find((n) => n.nodeType === 1) : null;
    const cofG = filho(imp, 'COFINS'); const cof = cofG ? Array.from(cofG.childNodes).find((n) => n.nodeType === 1) : null;
    const dif = filho(imp, 'ICMSUFDest');
    const orig = txt(icms, 'orig') || '0';
    const cst = txt(icms, 'CST'); const csosn = txt(icms, 'CSOSN');
    const vProd = val(prod, 'vProd');
    return {
      nItem: Number(det.getAttribute('nItem') || 0), cProd: txt(prod, 'cProd'), xProd: txt(prod, 'xProd'), ncm: txt(prod, 'NCM'), cest: txt(prod, 'CEST'),
      cfop: txt(prod, 'CFOP'), uCom: txt(prod, 'uCom') || 'UN', qCom: val(prod, 'qCom'), vProd, vDesc: val(prod, 'vDesc'), vFrete: val(prod, 'vFrete'),
      vSeg: val(prod, 'vSeg'), vOutro: val(prod, 'vOutro'),
      cstIcms: `${orig}${cst || csosn}`.slice(0, 4), simples: Boolean(csosn),
      vBC: val(icms, 'vBC'), pICMS: val(icms, 'pICMS'), vICMS: val(icms, 'vICMS'), pRedBC: val(icms, 'pRedBC'),
      vBCST: val(icms, 'vBCST'), pICMSST: val(icms, 'pICMSST'), vICMSST: val(icms, 'vICMSST'),
      cstPis: txt(pis, 'CST'), vBCPis: val(pis, 'vBC'), pPIS: val(pis, 'pPIS'), vPIS: val(pis, 'vPIS'),
      cstCofins: txt(cof, 'CST'), vBCCofins: val(cof, 'vBC'), pCOFINS: val(cof, 'pCOFINS'), vCOFINS: val(cof, 'vCOFINS'),
      difal: dif ? { vFCPUFDest: val(dif, 'vFCPUFDest'), vICMSUFDest: val(dif, 'vICMSUFDest'), vICMSUFRemet: val(dif, 'vICMSUFRemet') } : null,
    };
  });
  const enderDest = filho(dest, 'enderDest');
  const pag = Array.from(inf.getElementsByTagNameNS('*', 'tPag')).map((e) => e.textContent.trim());
  return {
    chave: String(inf.getAttribute('Id') || '').replace(/^NFe/, ''),
    modelo: txt(ide, 'mod'), serie: txt(ide, 'serie'), numero: txt(ide, 'nNF'), dhEmi: txt(ide, 'dhEmi'), dhSaiEnt: txt(ide, 'dhSaiEnt'),
    tpNF: txt(ide, 'tpNF'), emitCnpj: txt(emit, 'CNPJ'), crt: txt(emit, 'CRT'),
    dest: dest ? {
      cnpj: txt(dest, 'CNPJ'), cpf: txt(dest, 'CPF'), nome: txt(dest, 'xNome'), ie: txt(dest, 'IE'), uf: txt(enderDest, 'UF'), codMun: txt(enderDest, 'cMun'),
      end: txt(enderDest, 'xLgr'), num: txt(enderDest, 'nro'), compl: txt(enderDest, 'xCpl'), bairro: txt(enderDest, 'xBairro'), pais: txt(enderDest, 'cPais') || '1058',
    } : null,
    modFrete: txt(inf, 'modFrete'), pagamentoAPrazo: pag.includes('05') || pag.includes('15'),
    totais: {
      vBC: val(tot, 'vBC'), vICMS: val(tot, 'vICMS'), vBCST: val(tot, 'vBCST'), vST: val(tot, 'vST'), vProd: val(tot, 'vProd'), vFrete: val(tot, 'vFrete'),
      vSeg: val(tot, 'vSeg'), vDesc: val(tot, 'vDesc'), vIPI: val(tot, 'vIPI'), vPIS: val(tot, 'vPIS'), vCOFINS: val(tot, 'vCOFINS'), vOutro: val(tot, 'vOutro'), vNF: val(tot, 'vNF'),
      vFCPUFDest: val(tot, 'vFCPUFDest'), vICMSUFDest: val(tot, 'vICMSUFDest'), vICMSUFRemet: val(tot, 'vICMSUFRemet'),
    },
    itens,
  };
}

// ── montagem do arquivo ─────────────────────────────────────────────────────
class Arquivo {
  constructor() { this.linhas = []; this.contagem = new Map(); }
  add(reg, ...campos) {
    this.linhas.push(`|${[reg, ...campos].map((c) => (c === null || c === undefined ? '' : String(c))).join('|')}|`);
    this.contagem.set(reg, (this.contagem.get(reg) || 0) + 1);
  }
  linhasDoBloco(letra) { return this.linhas.filter((l) => l[1] === letra).length; }
  /** Fecha o bloco 9 (9001, 9900 de cada registro — inclusive 9900, 9990 e 9999 —, 9990 e 9999). */
  fechar() {
    this.add('9001', '0');
    const regs = [...this.contagem.keys(), '9900', '9990', '9999'];
    const unicos = [...new Set(regs)];
    const q9900 = unicos.length; // um 9900 por tipo de registro, ele incluído
    for (const r of unicos) {
      const q = r === '9900' ? q9900 : r === '9990' || r === '9999' ? 1 : this.contagem.get(r);
      this.linhas.push(`|9900|${r}|${q}|`);
    }
    this.contagem.set('9900', q9900);
    const linhas9 = 1 + q9900 + 1 + 1; // 9001 + 9900s + 9990 + 9999
    this.linhas.push(`|9990|${linhas9}|`);
    this.linhas.push(`|9999|${this.linhas.length + 1}|`);
    return this.linhas.join('\r\n') + '\r\n';
  }
}
const fecharBloco = (a, letra, reg) => a.add(reg, String(a.linhasDoBloco(letra) + 1));

// ── dados da empresa e das notas do período ─────────────────────────────────
export async function obterConfigSped(db, empresaId) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const r = await db.query('SELECT dados FROM fis_sped_config WHERE empresa_id = $1', [empresa]);
  return configDto(r.rows[0]?.dados || {});
}
function configDto(d = {}) {
  const c = d.contador || {};
  return {
    perfil: ['A', 'B', 'C'].includes(d.perfil) ? d.perfil : 'A',
    industrial: d.industrial === true,
    codReceitaIcms: d.codReceitaIcms || '', diaVencimentoIcms: Number(d.diaVencimentoIcms) || 0,
    codReceitaDifal: d.codReceitaDifal || '',
    contador: {
      nome: c.nome || '', cpf: c.cpf || '', crc: c.crc || '', cnpj: c.cnpj || '', cep: c.cep || '', endereco: c.endereco || '', numero: c.numero || '',
      complemento: c.complemento || '', bairro: c.bairro || '', fone: c.fone || '', email: c.email || '', codigoMunicipio: c.codigoMunicipio || '',
    },
    fantasia: d.fantasia || '', fone: d.fone || '', email: d.email || '',
  };
}
export async function salvarConfigSped(db, empresaId, entrada = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const c = entrada.contador || {};
  const cpf = soDigitos(c.cpf); const cnpj = soDigitos(c.cnpj); const cep = soDigitos(c.cep); const mun = soDigitos(c.codigoMunicipio);
  if (cpf && cpf.length !== 11) throw new ErroDominio('VALIDATION_ERROR', 'CPF do contador com 11 dígitos');
  if (cnpj && cnpj.length !== 14) throw new ErroDominio('VALIDATION_ERROR', 'CNPJ do escritório de contabilidade com 14 dígitos');
  if (cep && cep.length !== 8) throw new ErroDominio('VALIDATION_ERROR', 'CEP do contador com 8 dígitos');
  if (mun && mun.length !== 7) throw new ErroDominio('VALIDATION_ERROR', 'Código IBGE do município do contador com 7 dígitos');
  const dia = entrada.diaVencimentoIcms === '' || entrada.diaVencimentoIcms === undefined ? 0 : Number(entrada.diaVencimentoIcms);
  if (!(Number.isInteger(dia) && dia >= 0 && dia <= 31)) throw new ErroDominio('VALIDATION_ERROR', 'Dia de vencimento do ICMS entre 1 e 31');
  const dados = configDto({
    ...entrada, diaVencimentoIcms: dia,
    contador: { ...c, cpf, cnpj, cep, codigoMunicipio: mun, fone: soDigitos(c.fone).slice(0, 11) },
    fone: soDigitos(entrada.fone).slice(0, 11),
  });
  const r = await db.query(
    `INSERT INTO fis_sped_config (empresa_id, dados) VALUES ($1, $2) ON CONFLICT (empresa_id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = CURRENT_TIMESTAMP RETURNING dados`,
    [empresa, JSON.stringify(dados)]);
  return configDto(r.rows[0].dados);
}

async function carregarPeriodo(db, empresa, { ano, mes, emitenteId = null, ambiente = 'producao' }) {
  if (!(Number.isInteger(ano) && ano >= 2020 && ano <= 2100 && Number.isInteger(mes) && mes >= 1 && mes <= 12)) throw new ErroDominio('VALIDATION_ERROR', 'Informe o ano e o mês do período');
  const emitentes = (await db.query('SELECT * FROM fis_emitentes WHERE empresa_id = $1 ORDER BY ativo DESC, loja_id NULLS FIRST', [empresa])).rows;
  const emit = emitenteId ? emitentes.find((e) => e.id === emitenteId) : emitentes[0];
  if (!emit) throw new ErroDominio('SEM_EMITENTE', 'Cadastre o emitente antes de gerar o SPED', 422);
  const ini = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia(ano, mes)).padStart(2, '0')}`;
  const docs = (await db.query(
    `SELECT * FROM fis_documentos WHERE empresa_id = $1 AND emitente_id = $2 AND modelo IN ('55', '65') AND ambiente = $3
       AND status IN ('autorizado', 'cancelado') AND (xml_autorizado IS NOT NULL OR xml_assinado IS NOT NULL)
       AND COALESCE(NULLIF(dados->>'dhEmi', '')::timestamptz, autorizado_em, criado_em) >= ($4::date::timestamp AT TIME ZONE 'America/Cuiaba')
       AND COALESCE(NULLIF(dados->>'dhEmi', '')::timestamptz, autorizado_em, criado_em) < (($5::date + 1)::timestamp AT TIME ZONE 'America/Cuiaba')
     ORDER BY modelo, serie, numero`, [empresa, emit.id, ambiente, ini, fim])).rows;
  const notas = [];
  const avisos = [];
  for (const d of docs) {
    try {
      const n = lerNotaXml(d.xml_autorizado || d.xml_assinado);
      notas.push({ ...n, cancelada: d.status === 'cancelado', docId: d.id });
    } catch (error) { avisos.push(`Documento ${d.modelo} ${d.serie}/${d.numero}: XML ilegível (${String(error.message).slice(0, 80)}) — ficou fora do arquivo`); }
  }
  return { emit, ini, fim, notas, avisos };
}

function simplesNacional(emit) { return ['1', '4'].includes(String(emit.crt)); }

const codPart = (dest) => `P${soDigitos(dest.cnpj) || soDigitos(dest.cpf)}`;

// ── EFD ICMS/IPI ────────────────────────────────────────────────────────────
export async function gerarEfdIcmsIpi(db, empresaId, { ano, mes, emitenteId = null, ambiente = 'producao', finalidade = 0 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  ano = Number(ano); mes = Number(mes);
  const codVer = COD_VER_EFD_ICMS_IPI[ano];
  if (!codVer) throw new ErroDominio('VALIDATION_ERROR', `Leiaute da EFD ICMS/IPI não cadastrado para ${ano} (disponível: ${Object.keys(COD_VER_EFD_ICMS_IPI).join(', ')})`);
  const cfg = await obterConfigSped(db, empresa);
  const { emit, ini, fim, notas, avisos } = await carregarPeriodo(db, empresa, { ano, mes, emitenteId, ambiente });
  if (simplesNacional(emit)) throw new ErroDominio('SIMPLES_DISPENSADO', 'Empresa do Simples Nacional: dispensada da EFD ICMS/IPI (o ICMS vai no DAS/PGDAS-D)', 422);
  const pend = pendenciasCadastro(emit, cfg);
  if (pend.length) throw new ErroDominio('PENDENCIAS_SPED', pend.join(' · '), 422);
  const e = emit.endereco || {};
  const a = new Arquivo();
  // Bloco 0
  a.add('0000', codVer, String(finalidade === 1 ? 1 : 0), dataSped(ini), dataSped(fim), limpar(emit.razao_social, 100), emit.cnpj, '', emit.uf,
    soDigitos(emit.ie), emit.codigo_municipio, limpar(emit.im), '', cfg.perfil, cfg.industrial ? '0' : '1');
  a.add('0001', '0');
  a.add('0005', limpar(cfg.fantasia || emit.nome_fantasia || emit.razao_social, 60), soDigitos(e.cep), limpar(e.logradouro, 60), limpar(e.numero, 10),
    limpar(e.complemento, 60), limpar(e.bairro, 60), cfg.fone || '', '', limpar(cfg.email));
  const ct = cfg.contador;
  a.add('0100', limpar(ct.nome, 100), ct.cpf, limpar(ct.crc, 15), ct.cnpj, ct.cep, limpar(ct.endereco, 60), limpar(ct.numero, 10), limpar(ct.complemento, 60),
    limpar(ct.bairro, 60), ct.fone, '', limpar(ct.email), ct.codigoMunicipio);
  const validas = notas.filter((n) => !n.cancelada);
  const participantes = new Map();
  for (const n of validas) if (n.modelo === '55' && n.dest && (n.dest.cnpj || n.dest.cpf)) participantes.set(codPart(n.dest), n.dest);
  for (const [cod, d] of participantes) {
    a.add('0150', cod, limpar(d.nome, 100), d.pais === '1058' || !d.pais ? '01058' : soDigitos(d.pais).padStart(5, '0'), soDigitos(d.cnpj), d.cnpj ? '' : soDigitos(d.cpf),
      d.ie && d.ie !== 'ISENTO' ? soDigitos(d.ie) : '', soDigitos(d.codMun), '', limpar(d.end, 60), limpar(d.num, 10), limpar(d.compl, 60), limpar(d.bairro, 60));
  }
  fecharBloco(a, '0', '0990');
  // Bloco B (fora do DF: só abertura e encerramento)
  a.add('B001', '1'); fecharBloco(a, 'B', 'B990');
  // Bloco C
  a.add('C001', notas.length ? '0' : '1');
  const difalPorUf = new Map();
  let debitos = 0;
  for (const n of notas) {
    if (n.cancelada) {
      a.add('C100', '1', '0', '', n.modelo, '02', n.serie, n.numero, n.chave, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '');
      continue;
    }
    const t = n.totais;
    const nfce = n.modelo === '65';
    const ipt = n.pagamentoAPrazo ? '1' : '0';
    a.add('C100', '1', '0', nfce || !n.dest ? '' : codPart(n.dest), n.modelo, '00', n.serie, n.numero, n.chave, dataSped(n.dhEmi), dataSped(n.dhSaiEnt || n.dhEmi),
      num(t.vNF), ipt, num(t.vDesc), num(0), num(t.vProd), nfce ? '9' : (n.modFrete || '9'), num(t.vFrete), num(t.vSeg), num(t.vOutro), num(t.vBC), num(t.vICMS),
      nfce ? '' : num(t.vBCST), nfce ? '' : num(t.vST), nfce ? '' : num(t.vIPI), nfce ? '' : num(t.vPIS), nfce ? '' : num(t.vCOFINS), nfce ? '' : num(0), nfce ? '' : num(0));
    if (!nfce && (t.vICMSUFDest > 0 || t.vFCPUFDest > 0)) {
      a.add('C101', num(t.vFCPUFDest), num(t.vICMSUFDest), num(t.vICMSUFRemet));
      const uf = n.dest?.uf || '';
      const acc = difalPorUf.get(uf) || { difal: 0, fcp: 0 };
      acc.difal = dinheiro(acc.difal + t.vICMSUFDest); acc.fcp = dinheiro(acc.fcp + t.vFCPUFDest);
      difalPorUf.set(uf, acc);
    }
    // C190: um por CST + CFOP + alíquota
    const grupos = new Map();
    for (const i of n.itens) {
      const k = `${i.cstIcms}|${i.cfop}|${i.pICMS}`;
      const g = grupos.get(k) || { cst: i.cstIcms, cfop: i.cfop, aliq: i.pICMS, opr: 0, bc: 0, icms: 0, bcst: 0, st: 0, red: 0 };
      g.opr += i.vProd - i.vDesc + i.vFrete + i.vSeg + i.vOutro + i.vICMSST;
      g.bc += i.vBC; g.icms += i.vICMS; g.bcst += i.vBCST; g.st += i.vICMSST;
      if (i.pRedBC > 0) g.red += Math.max(0, i.vProd - i.vDesc - i.vBC);
      grupos.set(k, g);
    }
    for (const g of grupos.values()) {
      a.add('C190', g.cst.length === 3 ? g.cst : g.cst.padEnd(3, '0'), g.cfop, num(g.aliq), num(g.opr), num(g.bc), num(g.icms), num(g.bcst), num(g.st), num(g.red), num(0), '');
      debitos += g.icms;
    }
  }
  fecharBloco(a, 'C', 'C990');
  // Bloco D (sem serviços de transporte/comunicação emitidos aqui)
  a.add('D001', '1'); fecharBloco(a, 'D', 'D990');
  // Bloco E — apuração com os débitos das saídas emitidas aqui (os créditos das entradas o contador completa)
  debitos = dinheiro(debitos);
  a.add('E001', '0');
  a.add('E100', dataSped(ini), dataSped(fim));
  a.add('E110', num(debitos), num(0), num(0), num(0), num(0), num(0), num(0), num(0), num(0), num(debitos), num(0), num(debitos), num(0), num(0));
  const mesRef = `${String(mes).padStart(2, '0')}${ano}`;
  const vencimento = (codRec) => {
    const proxMes = mes === 12 ? 1 : mes + 1; const proxAno = mes === 12 ? ano + 1 : ano;
    const dia = Math.min(cfg.diaVencimentoIcms || 10, ultimoDia(proxAno, proxMes));
    return { dt: `${String(dia).padStart(2, '0')}${String(proxMes).padStart(2, '0')}${proxAno}`, codRec };
  };
  if (debitos > 0) {
    const v = vencimento(cfg.codReceitaIcms);
    a.add('E116', '000', num(debitos), v.dt, limpar(v.codRec), '', '', '', '', mesRef);
  }
  for (const [uf, acc] of [...difalPorUf.entries()].sort()) {
    a.add('E300', uf, dataSped(ini), dataSped(fim));
    a.add('E310', '1', num(0), num(acc.difal), num(0), num(0), num(0), num(0), num(0), num(acc.difal), num(0), num(0),
      num(0), num(acc.fcp), num(0), num(0), num(0), num(0), num(0), num(acc.fcp), num(0), num(0));
    if (acc.difal > 0) { const v = vencimento(cfg.codReceitaDifal); a.add('E316', '000', num(acc.difal), v.dt, limpar(v.codRec), '', '', '', '', mesRef); }
    if (acc.fcp > 0) { const v = vencimento(cfg.codReceitaDifal); a.add('E316', '006', num(acc.fcp), v.dt, limpar(v.codRec), '', '', '', '', mesRef); }
  }
  fecharBloco(a, 'E', 'E990');
  a.add('G001', '1'); fecharBloco(a, 'G', 'G990');
  a.add('H001', '1'); fecharBloco(a, 'H', 'H990');
  a.add('K001', '1'); fecharBloco(a, 'K', 'K990');
  a.add('1001', '0');
  a.add('1010', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N');
  fecharBloco(a, '1', '1990');
  const conteudo = a.fechar();
  if (debitos > 0 && !cfg.codReceitaIcms) avisos.push('Informe o código de receita do ICMS (E116) na configuração do SPED: o PVA exige quando há ICMS a recolher.');
  if (difalPorUf.size && !cfg.codReceitaDifal) avisos.push('Há DIFAL no período: informe o código de receita do DIFAL/FCP (E316) na configuração.');
  if (mes === 2) avisos.push('Fevereiro: o inventário de 31/12 (Bloco H, registro H005/H010) deve ser informado pelo contador.');
  avisos.push('Só entram as saídas emitidas no Kytto: o contador completa as entradas (créditos), ajustes e demais documentos no PVA antes de transmitir.');
  if (ambiente !== 'producao') avisos.push('Arquivo de TESTE com notas de homologação (sem valor fiscal): não transmita.');
  return {
    tipo: 'efd-icms-ipi', nomeArquivo: `EFD-ICMS-IPI-${emit.cnpj}-${ano}${String(mes).padStart(2, '0')}.txt`, conteudo,
    resumo: { documentos: notas.length, cancelados: notas.filter((n) => n.cancelada).length, debitosIcms: debitos, linhas: conteudo.split('\r\n').length - 1, leiaute: codVer },
    avisos,
  };
}

function pendenciasCadastro(emit, cfg) {
  const p = [];
  const e = emit.endereco || {};
  if (!soDigitos(emit.ie)) p.push('Inscrição estadual do emitente');
  if (soDigitos(e.cep).length !== 8) p.push('CEP do emitente');
  if (!e.logradouro || !e.bairro) p.push('Endereço do emitente');
  const c = cfg.contador;
  if (!c.nome) p.push('Nome do contador (registro 0100)');
  if (soDigitos(c.cpf).length !== 11) p.push('CPF do contador');
  if (!c.crc) p.push('CRC do contador');
  if (soDigitos(c.codigoMunicipio).length !== 7) p.push('Município (IBGE) do contador');
  return p;
}

// ── EFD-Contribuições (Lucro Presumido, regime cumulativo, competência) ────────
export async function gerarEfdContribuicoes(db, empresaId, { ano, mes, emitenteId = null, ambiente = 'producao' } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  ano = Number(ano); mes = Number(mes);
  const cfg = await obterConfigSped(db, empresa);
  const { emit, ini, fim, notas, avisos } = await carregarPeriodo(db, empresa, { ano, mes, emitenteId, ambiente });
  if (simplesNacional(emit)) throw new ErroDominio('SIMPLES_DISPENSADO', 'Empresa do Simples Nacional: dispensada da EFD-Contribuições (PIS/COFINS vão no DAS)', 422);
  const pend = pendenciasCadastro(emit, cfg).filter((x) => !/estadual/.test(x));
  if (pend.length) throw new ErroDominio('PENDENCIAS_SPED', pend.join(' · '), 422);
  const validas = notas.filter((n) => !n.cancelada);
  const a = new Arquivo();
  a.add('0000', COD_VER_EFD_CONTRIBUICOES, '0', '', '', dataSped(ini), dataSped(fim), limpar(emit.razao_social, 100), emit.cnpj, emit.uf, emit.codigo_municipio, '', '00', cfg.industrial ? '0' : '2');
  a.add('0001', '0');
  const ct = cfg.contador;
  a.add('0100', limpar(ct.nome, 100), ct.cpf, limpar(ct.crc, 15), ct.cnpj, ct.cep, limpar(ct.endereco, 60), limpar(ct.numero, 10), limpar(ct.complemento, 60),
    limpar(ct.bairro, 60), ct.fone, '', limpar(ct.email), ct.codigoMunicipio);
  // 2 = regime cumulativo; 1 = alíquota básica; 9 = competência, escrituração detalhada
  a.add('0110', '2', '', '1', '9');
  a.add('0140', '', limpar(emit.razao_social, 100), emit.cnpj, emit.uf, soDigitos(emit.ie), emit.codigo_municipio, limpar(emit.im), '');
  const participantes = new Map();
  for (const n of validas) if (n.modelo === '55' && n.dest && (n.dest.cnpj || n.dest.cpf)) participantes.set(codPart(n.dest), n.dest);
  for (const [cod, d] of participantes) {
    a.add('0150', cod, limpar(d.nome, 100), '01058', soDigitos(d.cnpj), d.cnpj ? '' : soDigitos(d.cpf), d.ie && d.ie !== 'ISENTO' ? soDigitos(d.ie) : '', soDigitos(d.codMun), '',
      limpar(d.end, 60), limpar(d.num, 10), limpar(d.compl, 60), limpar(d.bairro, 60));
  }
  // itens das NF-e (C170 referencia 0200, que referencia 0190)
  const itensNfe = new Map(); const unidades = new Set();
  for (const n of validas) if (n.modelo === '55') for (const i of n.itens) { itensNfe.set(limpar(i.cProd, 60), i); unidades.add(limpar(i.uCom, 6) || 'UN'); }
  for (const u of [...unidades].sort()) a.add('0190', u, u);
  for (const [cod, i] of [...itensNfe.entries()].sort()) a.add('0200', cod, limpar(i.xProd), '', '', limpar(i.uCom, 6) || 'UN', '00', soDigitos(i.ncm), '', soDigitos(i.ncm).slice(0, 2), '', num(i.pICMS));
  fecharBloco(a, '0', '0990');
  a.add('A001', '1'); fecharBloco(a, 'A', 'A990');
  // Bloco C
  a.add('C001', notas.length ? '0' : '1');
  const apur = { pis: new Map(), cofins: new Map(), isentasPis: new Map(), isentasCofins: new Map() };
  const somar = (mapa, k, rec, bc, v) => { const g = mapa.get(k) || { rec: 0, bc: 0, v: 0 }; g.rec += rec; g.bc += bc; g.v += v; mapa.set(k, g); };
  const tributada = (cst) => ['01', '02'].includes(cst);
  const isenta = (cst) => ['04', '05', '06', '07', '08', '09'].includes(cst);
  if (notas.length) {
    a.add('C010', emit.cnpj, '2');
    for (const n of notas) {
      if (n.cancelada) {
        a.add('C100', '1', '0', '', n.modelo, '02', n.serie, n.numero, n.chave, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '');
        continue;
      }
      const t = n.totais; const nfce = n.modelo === '65';
      a.add('C100', '1', '0', nfce || !n.dest ? '' : codPart(n.dest), n.modelo, '00', n.serie, n.numero, n.chave, dataSped(n.dhEmi), dataSped(n.dhSaiEnt || n.dhEmi),
        num(t.vNF), n.pagamentoAPrazo ? '1' : '0', num(t.vDesc), num(0), num(t.vProd), nfce ? '9' : (n.modFrete || '9'), num(t.vFrete), num(t.vSeg), num(t.vOutro), num(t.vBC), num(t.vICMS),
        num(t.vBCST), num(t.vST), num(t.vIPI), num(t.vPIS), num(t.vCOFINS), num(0), num(0));
      if (nfce) {
        // C175: consolidado por CFOP + CST PIS/COFINS + alíquotas
        const g = new Map();
        for (const i of n.itens) {
          const k = `${i.cfop}|${i.cstPis}|${i.pPIS}|${i.cstCofins}|${i.pCOFINS}`;
          const x = g.get(k) || { i, opr: 0, desc: 0, bcp: 0, vp: 0, bcc: 0, vc: 0 };
          x.opr += i.vProd - i.vDesc; x.desc += i.vDesc; x.bcp += i.vBCPis; x.vp += i.vPIS; x.bcc += i.vBCCofins; x.vc += i.vCOFINS; g.set(k, x);
        }
        for (const x of g.values()) {
          const i = x.i;
          a.add('C175', i.cfop, num(x.opr), num(x.desc), i.cstPis, num(x.bcp), num(i.pPIS, 4), '', '', num(x.vp), i.cstCofins, num(x.bcc), num(i.pCOFINS, 4), '', '', num(x.vc), '', '');
          acumular(i.cstPis, i.cstCofins, i.pPIS, i.pCOFINS, x.opr, x.bcp, x.vp, x.bcc, x.vc);
        }
      } else {
        for (const i of n.itens) {
          a.add('C170', String(i.nItem), limpar(i.cProd, 60), '', String(i.qCom).replace('.', ','), limpar(i.uCom, 6) || 'UN', num(i.vProd), num(i.vDesc), '0',
            i.cstIcms.length === 3 ? i.cstIcms : i.cstIcms.padEnd(3, '0'), i.cfop, '', num(i.vBC), num(i.pICMS), num(i.vICMS), num(i.vBCST), num(i.pICMSST), num(i.vICMSST), '',
            '', '', '', '', '', i.cstPis, num(i.vBCPis), num(i.pPIS, 4), '', '', num(i.vPIS), i.cstCofins, num(i.vBCCofins), num(i.pCOFINS, 4), '', '', num(i.vCOFINS), '');
          acumular(i.cstPis, i.cstCofins, i.pPIS, i.pCOFINS, i.vProd - i.vDesc, i.vBCPis, i.vPIS, i.vBCCofins, i.vCOFINS);
        }
      }
    }
  }
  function acumular(cstPis, cstCofins, pPis, pCofins, rec, bcp, vp, bcc, vc) {
    if (tributada(cstPis)) somar(apur.pis, pPis, rec, bcp, vp); else if (isenta(cstPis)) somar(apur.isentasPis, cstPis, rec, 0, 0);
    if (tributada(cstCofins)) somar(apur.cofins, pCofins, rec, bcc, vc); else if (isenta(cstCofins)) somar(apur.isentasCofins, cstCofins, rec, 0, 0);
  }
  fecharBloco(a, 'C', 'C990');
  a.add('D001', '1'); fecharBloco(a, 'D', 'D990');
  a.add('F001', '1'); fecharBloco(a, 'F', 'F990');
  a.add('I001', '1'); fecharBloco(a, 'I', 'I990');
  // Bloco M — apuração cumulativa (código 51 = alíquota básica)
  a.add('M001', '0');
  const totPis = dinheiro([...apur.pis.values()].reduce((s, g) => s + g.v, 0));
  a.add('M200', num(0), num(0), num(0), num(0), num(0), num(0), num(0), num(totPis), num(0), num(0), num(totPis), num(totPis));
  for (const [aliq, g] of apur.pis) a.add('M210', '51', num(g.rec), num(g.bc), num(0), num(0), num(g.bc), num(aliq, 4), '', '', num(g.v), num(0), num(0), num(0), num(0), num(g.v));
  for (const [cst, g] of apur.isentasPis) a.add('M400', cst, num(g.rec), '', 'Receitas sem incidência/isentas — detalhar a natureza (M410) no PVA');
  const totCof = dinheiro([...apur.cofins.values()].reduce((s, g) => s + g.v, 0));
  a.add('M600', num(0), num(0), num(0), num(0), num(0), num(0), num(0), num(totCof), num(0), num(0), num(totCof), num(totCof));
  for (const [aliq, g] of apur.cofins) a.add('M610', '51', num(g.rec), num(g.bc), num(0), num(0), num(g.bc), num(aliq, 4), '', '', num(g.v), num(0), num(0), num(0), num(0), num(g.v));
  for (const [cst, g] of apur.isentasCofins) a.add('M800', cst, num(g.rec), '', 'Receitas sem incidência/isentas — detalhar a natureza (M810) no PVA');
  fecharBloco(a, 'M', 'M990');
  a.add('P001', '1'); fecharBloco(a, 'P', 'P990');
  a.add('1001', '1'); fecharBloco(a, '1', '1990');
  const conteudo = a.fechar();
  if (apur.isentasPis.size || apur.isentasCofins.size) avisos.push('Há receitas com CST 04 a 09 (monofásico, alíquota zero, isenção, suspensão): o PVA pede a natureza da receita (M410/M810) — o contador completa.');
  avisos.push('Regime cumulativo (Lucro Presumido), competência. Só entram as vendas emitidas no Kytto: demais receitas (serviços, financeiras) e retenções o contador completa no PVA.');
  if (ambiente !== 'producao') avisos.push('Arquivo de TESTE com notas de homologação (sem valor fiscal): não transmita.');
  return {
    tipo: 'efd-contribuicoes', nomeArquivo: `EFD-Contribuicoes-${emit.cnpj}-${ano}${String(mes).padStart(2, '0')}.txt`, conteudo,
    resumo: { documentos: notas.length, cancelados: notas.filter((n) => n.cancelada).length, pis: totPis, cofins: totCof, linhas: conteudo.split('\r\n').length - 1, leiaute: COD_VER_EFD_CONTRIBUICOES },
    avisos,
  };
}

/** Conteúdo em ISO-8859-1 (o leiaute exige) e em base64, para a tela baixar. */
export function arquivoParaDownload(r) {
  return { ...r, conteudo: undefined, base64: Buffer.from(r.conteudo, 'latin1').toString('base64'), encoding: 'ISO-8859-1' };
}
