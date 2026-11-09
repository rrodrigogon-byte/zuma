import { exigirUuid } from '../acesso/banco.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const dinheiro = (v) => Math.round(Number(v || 0) * 100) / 100;
const fmt2 = (v) => Number(v || 0).toFixed(2).replace('.', ',');
const fmt4 = (v) => Number(v || 0).toFixed(4).replace('.', ',');

export function resolverPeriodo({ competencia, inicio, fim } = {}) {
  const agora = new Date();
  const comp = /^\d{4}-\d{2}$/.test(String(competencia || '').trim())
    ? String(competencia).trim()
    : `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`;
  const [anoStr, mesStr] = comp.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dataInicio = /^\d{4}-\d{2}-\d{2}$/.test(String(inicio || '').trim())
    ? String(inicio).trim()
    : `${comp}-01`;
  const dataFim = /^\d{4}-\d{2}-\d{2}$/.test(String(fim || '').trim())
    ? String(fim).trim()
    : `${comp}-${String(ultimoDia).padStart(2, '0')}`;
  return {
    competencia: comp,
    inicio: dataInicio,
    fim: dataFim,
    dtIniSped: dataInicio.replace(/-/g, ''),
    dtFinSped: dataFim.replace(/-/g, ''),
  };
}

async function carregarDadosPeriodo(db, empresaId, opcoes = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const periodo = resolverPeriodo(opcoes);
  const emitRes = await db.query(
    'SELECT * FROM fis_emitentes WHERE empresa_id = $1 ORDER BY ativo DESC, loja_id NULLS FIRST LIMIT 1',
    [empresa],
  );
  const emit = emitRes.rows[0] || null;

  const params = [empresa, `${periodo.inicio}T00:00:00.000Z`, `${periodo.fim}T23:59:59.999Z`];
  let filtroLoja = '';
  if (opcoes.lojaRestrita || opcoes.lojaId) {
    params.push(opcoes.lojaRestrita || opcoes.lojaId);
    filtroLoja = ` AND loja_id = $${params.length}`;
  }

  const docsRes = await db.query(
    `SELECT * FROM fis_documentos
      WHERE empresa_id = $1
        AND criado_em >= $2::timestamptz
        AND criado_em <= $3::timestamptz${filtroLoja}
      ORDER BY criado_em ASC, modelo ASC, serie ASC, numero ASC`,
    params,
  );

  let inutRows = [];
  try {
    const inutRes = await db.query(
      `SELECT * FROM fis_inutilizacoes
        WHERE empresa_id = $1
          AND criado_em >= $2::timestamptz
          AND criado_em <= $3::timestamptz
        ORDER BY criado_em ASC`,
      [empresa, `${periodo.inicio}T00:00:00.000Z`, `${periodo.fim}T23:59:59.999Z`],
    );
    inutRows = inutRes.rows || [];
  } catch {
    inutRows = [];
  }

  return { empresa, periodo, emit, docs: docsRes.rows || [], inutilizacoes: inutRows };
}

function extrairTributosDocumento(doc) {
  const dados = doc.dados || {};
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const valido = ['autorizado', 'validado_localmente'].includes(doc.status);
  let baseIcms = 0;
  let valorIcms = 0;
  let valorPis = 0;
  let valorCofins = 0;
  let valorIss = 0;
  const cfops = new Set();
  const csts = new Set();

  for (const item of itens) {
    const vProd = dinheiro(item.valorProduto ?? (Number(item.quantidade || 1) * Number(item.valorUnitario || 0)));
    const f = item.fiscal || item.classificacao || {};
    const cfop = soDigitos(item.cfop || f.cfop || (doc.modelo === 'nfse' ? '5933' : '5102')) || '5102';
    const cst = String(f.csosn || f.cstIcms || (doc.modelo === 'nfse' ? 'ISS' : '102'));
    cfops.add(cfop);
    csts.add(cst);

    if (!valido) continue;
    const aliqIcms = Number(f.aliquotaIcms || 0);
    const redBase = Number(f.reducaoBaseIcms || 0);
    if (aliqIcms > 0 && doc.modelo !== 'nfse') {
      const base = dinheiro(vProd * (1 - redBase / 100));
      baseIcms = dinheiro(baseIcms + base);
      valorIcms = dinheiro(valorIcms + dinheiro(base * aliqIcms / 100));
    }
    const aliqPis = Number(f.aliquotaPis || 0);
    const aliqCofins = Number(f.aliquotaCofins || 0);
    if (aliqPis > 0) valorPis = dinheiro(valorPis + dinheiro(vProd * aliqPis / 100));
    if (aliqCofins > 0) valorCofins = dinheiro(valorCofins + dinheiro(vProd * aliqCofins / 100));
    if (doc.modelo === 'nfse') {
      const aliqIss = Number(f.aliquotaIss || item.aliquotaIss || 5);
      valorIss = dinheiro(valorIss + dinheiro(vProd * aliqIss / 100));
    }
  }

  const tribIbpt = dados.tributos || {};
  return {
    baseIcms,
    valorIcms,
    valorPis,
    valorCofins,
    valorIss,
    ibptTotal: valido ? dinheiro(tribIbpt.total || 0) : 0,
    ibptFederal: valido ? dinheiro(tribIbpt.federal || 0) : 0,
    ibptEstadual: valido ? dinheiro(tribIbpt.estadual || 0) : 0,
    ibptMunicipal: valido ? dinheiro(tribIbpt.municipal || 0) : 0,
    cfopPrincipal: [...cfops][0] || (doc.modelo === 'nfse' ? '5933' : '5102'),
    cstPrincipal: [...csts][0] || '102',
  };
}

export async function resumoContabil(db, empresaId, opcoes = {}) {
  const { periodo, emit, docs, inutilizacoes } = await carregarDadosPeriodo(db, empresaId, opcoes);

  const totais = {
    documentos: docs.length,
    autorizados: 0,
    valorAutorizado: 0,
    cancelados: 0,
    valorCancelado: 0,
    rejeitados: 0,
    contingencia: 0,
    inutilizacoes: inutilizacoes.length,
    porModelo: {
      '65': { modelo: '65', nome: 'NFC-e (65)', qtd: 0, valor: 0, canceladas: 0 },
      '55': { modelo: '55', nome: 'NF-e (55)', qtd: 0, valor: 0, canceladas: 0 },
      nfse: { modelo: 'nfse', nome: 'NFS-e (Serviços)', qtd: 0, valor: 0, canceladas: 0 },
    },
    tributos: {
      baseIcms: 0,
      valorIcms: 0,
      valorPis: 0,
      valorCofins: 0,
      valorIss: 0,
      ibptTotal: 0,
      ibptFederal: 0,
      ibptEstadual: 0,
      ibptMunicipal: 0,
    },
  };

  const mapaCfop = new Map();
  const documentos = [];

  for (const doc of docs) {
    const valor = dinheiro(doc.valor_total);
    const valido = ['autorizado', 'validado_localmente'].includes(doc.status);
    const cancelado = doc.status === 'cancelado';
    const mod = totais.porModelo[doc.modelo] || totais.porModelo['65'];

    if (valido) {
      totais.autorizados += 1;
      totais.valorAutorizado = dinheiro(totais.valorAutorizado + valor);
      mod.qtd += 1;
      mod.valor = dinheiro(mod.valor + valor);
    } else if (cancelado) {
      totais.cancelados += 1;
      totais.valorCancelado = dinheiro(totais.valorCancelado + valor);
      mod.canceladas += 1;
    } else if (doc.status === 'rejeitado') {
      totais.rejeitados += 1;
    } else if (doc.status === 'contingencia') {
      totais.contingencia += 1;
    }

    const t = extrairTributosDocumento(doc);
    if (valido) {
      totais.tributos.baseIcms = dinheiro(totais.tributos.baseIcms + t.baseIcms);
      totais.tributos.valorIcms = dinheiro(totais.tributos.valorIcms + t.valorIcms);
      totais.tributos.valorPis = dinheiro(totais.tributos.valorPis + t.valorPis);
      totais.tributos.valorCofins = dinheiro(totais.tributos.valorCofins + t.valorCofins);
      totais.tributos.valorIss = dinheiro(totais.tributos.valorIss + t.valorIss);
      totais.tributos.ibptTotal = dinheiro(totais.tributos.ibptTotal + t.ibptTotal);
      totais.tributos.ibptFederal = dinheiro(totais.tributos.ibptFederal + t.ibptFederal);
      totais.tributos.ibptEstadual = dinheiro(totais.tributos.ibptEstadual + t.ibptEstadual);
      totais.tributos.ibptMunicipal = dinheiro(totais.tributos.ibptMunicipal + t.ibptMunicipal);

      const itens = Array.isArray(doc.dados?.itens) && doc.dados.itens.length
        ? doc.dados.itens
        : [{ valorProduto: valor, cfop: t.cfopPrincipal, fiscal: { csosn: t.cstPrincipal } }];
      for (const item of itens) {
        const vItem = dinheiro(item.valorProduto ?? (Number(item.quantidade || 1) * Number(item.valorUnitario || 0)));
        const f = item.fiscal || item.classificacao || {};
        const cfop = soDigitos(item.cfop || f.cfop || t.cfopPrincipal) || '5102';
        const cstOuCsosn = String(f.csosn || f.cstIcms || (doc.modelo === 'nfse' ? 'ISS' : '102'));
        const chave = `${cfop}:${cstOuCsosn}`;
        const atual = mapaCfop.get(chave) || {
          cfop,
          cstOuCsosn,
          qtdItens: 0,
          valorContabil: 0,
          baseIcms: 0,
          valorIcms: 0,
          valorPis: 0,
          valorCofins: 0,
        };
        atual.qtdItens += 1;
        atual.valorContabil = dinheiro(atual.valorContabil + vItem);
        const aliqIcms = Number(f.aliquotaIcms || 0);
        if (aliqIcms > 0 && doc.modelo !== 'nfse') {
          const base = dinheiro(vItem * (1 - Number(f.reducaoBaseIcms || 0) / 100));
          atual.baseIcms = dinheiro(atual.baseIcms + base);
          atual.valorIcms = dinheiro(atual.valorIcms + dinheiro(base * aliqIcms / 100));
        }
        if (Number(f.aliquotaPis || 0) > 0) atual.valorPis = dinheiro(atual.valorPis + dinheiro(vItem * Number(f.aliquotaPis) / 100));
        if (Number(f.aliquotaCofins || 0) > 0) atual.valorCofins = dinheiro(atual.valorCofins + dinheiro(vItem * Number(f.aliquotaCofins) / 100));
        mapaCfop.set(chave, atual);
      }
    }

    const dest = doc.dados?.destinatario || {};
    documentos.push({
      id: doc.id,
      modelo: doc.modelo,
      serie: Number(doc.serie),
      numero: Number(doc.numero),
      ambiente: doc.ambiente,
      status: doc.status,
      chave: doc.chave || doc.chave_acesso || doc.id_dps || null,
      protocolo: doc.protocolo || null,
      dataEmissao: doc.autorizado_em || doc.criado_em,
      destinatarioNome: dest.nome || dest.razaoSocial || 'CONSUMIDOR FINAL',
      destinatarioDoc: soDigitos(dest.cnpj || dest.cpf) || null,
      cfopPrincipal: t.cfopPrincipal,
      cstPrincipal: t.cstPrincipal,
      valorTotal: valor,
      baseIcms: t.baseIcms,
      valorIcms: t.valorIcms,
      temXml: Boolean(doc.xml_autorizado || doc.xml_assinado),
    });
  }

  const porCfop = [...mapaCfop.values()].sort((a, b) => b.valorContabil - a.valorContabil);

  return {
    competencia: periodo.competencia,
    periodo,
    emitente: emit ? {
      id: emit.id,
      cnpj: emit.cnpj,
      razaoSocial: emit.razao_social,
      nomeFantasia: emit.nome_fantasia || null,
      ie: emit.ie || null,
      im: emit.im || null,
      uf: emit.uf || 'MT',
      codigoMunicipio: emit.codigo_municipio || '5107958',
      crt: emit.crt || '1',
      ambiente: emit.ambiente || 'homologacao',
    } : null,
    totais,
    porCfop,
    documentos,
  };
}

function anexarBloco9(linhas) {
  const contagens = new Map();
  for (const l of linhas) {
    const reg = l.split('|')[1];
    if (reg) contagens.set(reg, (contagens.get(reg) || 0) + 1);
  }
  const regs9900 = [...contagens.entries()];
  const total9900 = regs9900.length + 4; // inclui 9001, 9900, 9990 e 9999
  const bloco9 = ['|9001|0|'];
  for (const [reg, qtd] of regs9900) {
    bloco9.push(`|9900|${reg}|${qtd}|`);
  }
  bloco9.push(`|9900|9001|1|`);
  bloco9.push(`|9900|9900|${total9900}|`);
  bloco9.push(`|9900|9990|1|`);
  bloco9.push(`|9900|9999|1|`);
  bloco9.push(`|9990|${bloco9.length + 2}|`);
  const totalLinhas = linhas.length + bloco9.length + 1;
  bloco9.push(`|9999|${totalLinhas}|`);
  return [...linhas, ...bloco9].join('\r\n') + '\r\n';
}

/**
 * Gera arquivo TXT do SPED Fiscal (EFD ICMS/IPI — Guia Prático Leiaute 017)
 * a partir dos documentos fiscais (modelos 55 e 65) e do emitente da empresa.
 */
export async function gerarSpedFiscalTxt(db, empresaId, opcoes = {}) {
  const { periodo, emit, docs } = await carregarDadosPeriodo(db, empresaId, opcoes);
  const cnpj = soDigitos(emit?.cnpj || '00000000000000').padStart(14, '0');
  const ie = soDigitos(emit?.ie || '') || 'ISENTO';
  const uf = String(emit?.uf || 'MT').toUpperCase();
  const codMun = soDigitos(emit?.codigo_municipio || '5107958').padStart(7, '0');
  const razao = String(emit?.razao_social || 'EMPRESA KYTTO').slice(0, 100);
  const fantasia = String(emit?.nome_fantasia || razao).slice(0, 60);
  const end = emit?.endereco || {};

  const docsMercadoria = docs.filter(
    (d) => ['55', '65'].includes(d.modelo) && ['autorizado', 'validado_localmente', 'cancelado'].includes(d.status),
  );

  const unidades = new Set(['UN']);
  const produtosMap = new Map();
  const participantesMap = new Map();

  for (const d of docsMercadoria) {
    const dest = d.dados?.destinatario || {};
    const docDest = soDigitos(dest.cnpj || dest.cpf);
    if (d.modelo === '55' && docDest) {
      participantesMap.set(docDest, {
        cod: `CLI${docDest.slice(-8)}`,
        nome: String(dest.nome || dest.razaoSocial || 'CONSUMIDOR').slice(0, 100),
        cnpj: docDest.length === 14 ? docDest : '',
        cpf: docDest.length === 11 ? docDest : '',
        ie: soDigitos(dest.ie || ''),
        codMun: soDigitos(dest.endereco?.codigoMunicipio || codMun).padStart(7, '0'),
        logradouro: String(dest.endereco?.logradouro || 'SEM LOGRADOURO').slice(0, 60),
        numero: String(dest.endereco?.numero || 'S/N').slice(0, 10),
        bairro: String(dest.endereco?.bairro || 'CENTRO').slice(0, 60),
      });
    }
    for (const [idx, it] of (d.dados?.itens || []).entries()) {
      const un = String(it.unidade || it.fiscal?.unidadeTributavel || 'UN').toUpperCase().slice(0, 6);
      unidades.add(un);
      const codItem = String(it.produtoId || it.fonteId || `ITEM${idx + 1}`).slice(0, 60);
      if (!produtosMap.has(codItem)) {
        produtosMap.set(codItem, {
          cod: codItem,
          nome: String(it.descricaoOriginal || it.descricao || `Item ${idx + 1}`).replace(/\|/g, ' ').slice(0, 120),
          un,
          ncm: soDigitos(it.ncm || it.fiscal?.ncm || '00000000').padStart(8, '0'),
          cest: soDigitos(it.fiscal?.cest || ''),
          aliqIcms: Number(it.fiscal?.aliquotaIcms || 0),
        });
      }
    }
  }

  const bloco0 = [
    `|0000|017|0|${periodo.dtIniSped}|${periodo.dtFinSped}|${razao}|${cnpj}||${uf}|${ie}|${codMun}|${soDigitos(emit?.im || '')}||A|1|`,
    '|0001|0|',
    `|0005|${fantasia}|${soDigitos(end.cep || '78300000').padStart(8, '0')}|${String(end.logradouro || 'AV BRASIL').slice(0, 60)}|${String(end.numero || 'S/N').slice(0, 10)}|${String(end.complemento || '').slice(0, 60)}|${String(end.bairro || 'CENTRO').slice(0, 60)}|${soDigitos(end.telefone || '')}||${String(end.email || '')}|`,
  ];

  for (const part of participantesMap.values()) {
    bloco0.push(`|0150|${part.cod}|${part.nome}|1058|${part.cnpj}|${part.cpf}|${part.ie}|${part.codMun}||${part.logradouro}|${part.numero}||${part.bairro}|`);
  }
  for (const un of unidades) {
    bloco0.push(`|0190|${un}|Unidade ${un}|`);
  }
  for (const prod of produtosMap.values()) {
    bloco0.push(`|0200|${prod.cod}|${prod.nome}|||${prod.un}|00|${prod.ncm}||${prod.ncm.slice(0, 2)}||${fmt2(prod.aliqIcms)}|${prod.cest}|`);
  }
  bloco0.push(`|0990|${bloco0.length + 1}|`);

  const blocoC = [`|C001|${docsMercadoria.length ? '0' : '1'}|`];
  let totalDebitoIcms = 0;

  for (const d of docsMercadoria) {
    const cancelado = d.status === 'cancelado';
    const codSit = cancelado ? '02' : '00';
    const dtDoc = new Date(d.autorizado_em || d.criado_em).toISOString().slice(0, 10).replace(/-/g, '');
    const chave = soDigitos(d.chave || d.chave_acesso || '').padStart(44, '0').slice(0, 44);
    const dest = d.dados?.destinatario || {};
    const docDest = soDigitos(dest.cnpj || dest.cpf);
    const codPart = d.modelo === '55' && docDest && participantesMap.has(docDest) ? participantesMap.get(docDest).cod : '';
    const t = extrairTributosDocumento(d);
    const valorDoc = cancelado ? 0 : dinheiro(d.valor_total);

    if (cancelado) {
      blocoC.push(`|C100|1|0||${d.modelo}|${codSit}|${d.serie}|${d.numero}|${chave}|||||||||||||||||||||`);
      continue;
    }

    totalDebitoIcms = dinheiro(totalDebitoIcms + t.valorIcms);
    blocoC.push(
      `|C100|1|0|${codPart}|${d.modelo}|${codSit}|${d.serie}|${d.numero}|${chave}|${dtDoc}|${dtDoc}|${fmt2(valorDoc)}|0|${fmt2(d.dados?.desconto || 0)}|0|${fmt2(valorDoc)}|9|0|0|0|${fmt2(t.baseIcms)}|${fmt2(t.valorIcms)}|0|0|0|${fmt2(t.valorPis)}|${fmt2(t.valorCofins)}|0|0|`,
    );

    const itens = Array.isArray(d.dados?.itens) ? d.dados.itens : [];
    const analitico = new Map();
    for (const [idx, it] of itens.entries()) {
      const f = it.fiscal || it.classificacao || {};
      const vItem = dinheiro(it.valorProduto ?? (Number(it.quantidade || 1) * Number(it.valorUnitario || 0)));
      const cfop = soDigitos(it.cfop || f.cfop || '5102') || '5102';
      const cstIcms = String(f.csosn || f.cstIcms || '102').padStart(3, '0');
      const aliqIcms = Number(f.aliquotaIcms || 0);
      const baseItem = aliqIcms > 0 ? vItem : 0;
      const vIcmsItem = aliqIcms > 0 ? dinheiro(vItem * aliqIcms / 100) : 0;
      const codItem = String(it.produtoId || it.fonteId || `ITEM${idx + 1}`).slice(0, 60);
      const un = String(it.unidade || f.unidadeTributavel || 'UN').toUpperCase().slice(0, 6);

      if (d.modelo === '55') {
        blocoC.push(
          `|C170|${idx + 1}|${codItem}|${String(it.descricaoOriginal || it.descricao || '').replace(/\|/g, ' ').slice(0, 80)}|${fmt4(it.quantidade || 1)}|${un}|${fmt2(vItem)}|0|0|${cstIcms}|${cfop}||${fmt2(baseItem)}|${fmt2(aliqIcms)}|${fmt2(vIcmsItem)}|0|0|0|0|49||0|0|0|0|0|${f.cstPis || '49'}|0|0|0|0|0|${f.cstCofins || '49'}|0|0|0|0|0||0|`,
        );
      }

      const chAnalitico = `${cstIcms}|${cfop}|${fmt2(aliqIcms)}`;
      const regA = analitico.get(chAnalitico) || { cstIcms, cfop, aliqIcms, vOpr: 0, vBc: 0, vIcms: 0 };
      regA.vOpr = dinheiro(regA.vOpr + vItem);
      regA.vBc = dinheiro(regA.vBc + baseItem);
      regA.vIcms = dinheiro(regA.vIcms + vIcmsItem);
      analitico.set(chAnalitico, regA);
    }

    for (const a of analitico.values()) {
      blocoC.push(`|C190|${a.cstIcms}|${a.cfop}|${fmt2(a.aliqIcms)}|${fmt2(a.vOpr)}|${fmt2(a.vBc)}|${fmt2(a.vIcms)}|0|0|0|0||`);
    }
  }
  blocoC.push(`|C990|${blocoC.length + 1}|`);

  const blocoE = [
    '|E001|0|',
    `|E100|${periodo.dtIniSped}|${periodo.dtFinSped}|`,
    `|E110|${fmt2(totalDebitoIcms)}|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|${fmt2(totalDebitoIcms)}|0,00|${fmt2(totalDebitoIcms)}|0,00|0,00|`,
  ];
  blocoE.push(`|E990|${blocoE.length + 1}|`);

  const blocoH = ['|H001|1|', '|H990|2|'];

  return {
    nomeArquivo: `SPED-FISCAL-${cnpj}-${periodo.competencia}.txt`,
    conteudo: anexarBloco9([...bloco0, ...blocoC, ...blocoE, ...blocoH]),
  };
}

/**
 * Gera arquivo TXT do SPED Contribuições (EFD PIS/COFINS — Guia Prático Leiaute 006)
 * contemplando Bloco A (NFS-e), Bloco C (NF-e/NFC-e) e Bloco M (Apuração PIS/COFINS).
 */
export async function gerarSpedContribuicoesTxt(db, empresaId, opcoes = {}) {
  const { periodo, emit, docs } = await carregarDadosPeriodo(db, empresaId, opcoes);
  const cnpj = soDigitos(emit?.cnpj || '00000000000000').padStart(14, '0');
  const uf = String(emit?.uf || 'MT').toUpperCase();
  const codMun = soDigitos(emit?.codigo_municipio || '5107958').padStart(7, '0');
  const razao = String(emit?.razao_social || 'EMPRESA KYTTO').slice(0, 100);
  const indIncidencia = emit?.crt === '3' ? '1' : '2'; // 1=Não-cumulativo (Lucro Real), 2=Cumulativo

  const docsValidos = docs.filter((d) => ['autorizado', 'validado_localmente'].includes(d.status));
  const docsServicos = docsValidos.filter((d) => d.modelo === 'nfse');
  const docsMercadoria = docsValidos.filter((d) => ['55', '65'].includes(d.modelo));

  const bloco0 = [
    `|0000|006|0|||${periodo.dtIniSped}|${periodo.dtFinSped}|${razao}|${cnpj}|${uf}|${codMun}||00|0|`,
    '|0001|0|',
    `|0110|${indIncidencia}|1|1|1|`,
    `|0140|EST01|${razao}|${cnpj}|${uf}|${soDigitos(emit?.ie || '')}|${codMun}|${soDigitos(emit?.im || '')}||`,
  ];
  bloco0.push(`|0990|${bloco0.length + 1}|`);

  let totalPis = 0;
  let totalCofins = 0;

  const blocoA = [`|A001|${docsServicos.length ? '0' : '1'}|`];
  if (docsServicos.length) {
    blocoA.push(`|A010|${cnpj}|`);
    for (const d of docsServicos) {
      const dtDoc = new Date(d.autorizado_em || d.criado_em).toISOString().slice(0, 10).replace(/-/g, '');
      const t = extrairTributosDocumento(d);
      const valor = dinheiro(d.valor_total);
      totalPis = dinheiro(totalPis + t.valorPis);
      totalCofins = dinheiro(totalCofins + t.valorCofins);
      blocoA.push(`|A100|0|1||00|${d.serie}|${d.numero}|${d.id_dps || d.chave || ''}|${dtDoc}|${dtDoc}|${fmt2(valor)}|1|0,00|${fmt2(valor)}|${fmt2(t.valorPis)}|${fmt2(valor)}|${fmt2(t.valorCofins)}|0,00|0,00|${fmt2(t.valorIss)}|`);
      for (const [idx, it] of (d.dados?.itens || []).entries()) {
        const vItem = dinheiro(it.valorProduto ?? (Number(it.quantidade || 1) * Number(it.valorUnitario || 0)));
        const f = it.fiscal || {};
        const vPisItem = dinheiro(vItem * Number(f.aliquotaPis || 0) / 100);
        const vCofItem = dinheiro(vItem * Number(f.aliquotaCofins || 0) / 100);
        blocoA.push(`|A170|${idx + 1}|SERV${idx + 1}|${String(it.descricao || 'SERVICO').replace(/\|/g, ' ').slice(0, 60)}|${fmt2(vItem)}|0,00|00|0|${f.cstPis || '49'}|${fmt2(vItem)}|${fmt2(f.aliquotaPis || 0)}|${fmt2(vPisItem)}|${f.cstCofins || '49'}|${fmt2(vItem)}|${fmt2(f.aliquotaCofins || 0)}|${fmt2(vCofItem)}||`);
      }
    }
  }
  blocoA.push(`|A990|${blocoA.length + 1}|`);

  const blocoC = [`|C001|${docsMercadoria.length ? '0' : '1'}|`];
  if (docsMercadoria.length) {
    blocoC.push(`|C010|${cnpj}|2|`);
    for (const d of docsMercadoria) {
      const dtDoc = new Date(d.autorizado_em || d.criado_em).toISOString().slice(0, 10).replace(/-/g, '');
      const chave = soDigitos(d.chave || d.chave_acesso || '').padStart(44, '0').slice(0, 44);
      const t = extrairTributosDocumento(d);
      const valor = dinheiro(d.valor_total);
      totalPis = dinheiro(totalPis + t.valorPis);
      totalCofins = dinheiro(totalCofins + t.valorCofins);
      blocoC.push(`|C100|1|0||${d.modelo}|00|${d.serie}|${d.numero}|${chave}|${dtDoc}|${dtDoc}|${fmt2(valor)}|1|0,00|${fmt2(valor)}|9|0,00|0,00|0,00|${fmt2(t.baseIcms)}|${fmt2(t.valorIcms)}|0,00|0,00|0,00|${fmt2(t.valorPis)}|${fmt2(t.valorCofins)}|0,00|0,00|`);
    }
  }
  blocoC.push(`|C990|${blocoC.length + 1}|`);

  const blocoM = [
    '|M001|0|',
    `|M200|0,00|0,00|0,00|0,00|0,00|0,00|0,00|${fmt2(totalPis)}|0,00|0,00|${fmt2(totalPis)}|${fmt2(totalPis)}|`,
    `|M600|0,00|0,00|0,00|0,00|0,00|0,00|0,00|${fmt2(totalCofins)}|0,00|0,00|${fmt2(totalCofins)}|${fmt2(totalCofins)}|`,
  ];
  blocoM.push(`|M990|${blocoM.length + 1}|`);

  return {
    nomeArquivo: `SPED-CONTRIBUICOES-${cnpj}-${periodo.competencia}.txt`,
    conteudo: anexarBloco9([...bloco0, ...blocoA, ...blocoC, ...blocoM]),
  };
}

/**
 * Exporta planilha CSV compatível com importação fiscal em Domínio Sistemas / Questor / Alterdata.
 */
export async function exportarCsvContador(db, empresaId, opcoes = {}) {
  const resumo = await resumoContabil(db, empresaId, opcoes);
  const cabecalho = [
    'COMPETENCIA',
    'DATA_EMISSAO',
    'MODELO',
    'SERIE',
    'NUMERO',
    'STATUS',
    'AMBIENTE',
    'CHAVE_ACESSO',
    'PROTOCOLO',
    'CPF_CNPJ_DESTINATARIO',
    'NOME_DESTINATARIO',
    'CFOP',
    'CST_CSOSN',
    'VALOR_TOTAL',
    'BASE_ICMS',
    'VALOR_ICMS',
  ].join(';');

  const linhas = resumo.documentos.map((d) => [
    resumo.periodo.competencia,
    d.dataEmissao ? new Date(d.dataEmissao).toISOString().slice(0, 10) : '',
    d.modelo,
    d.serie,
    d.numero,
    d.status,
    d.ambiente,
    d.chave || '',
    d.protocolo || '',
    d.destinatarioDoc || '',
    String(d.destinatarioNome || '').replace(/;/g, ' '),
    d.cfopPrincipal || '',
    d.cstPrincipal || '',
    fmt2(d.valorTotal),
    fmt2(d.baseIcms),
    fmt2(d.valorIcms),
  ].join(';'));

  return {
    nomeArquivo: `fechamento-contabil-${resumo.periodo.competencia}.csv`,
    csv: '\uFEFF' + [cabecalho, ...linhas].join('\r\n') + '\r\n',
  };
}

/**
 * Exporta pacote contábil completo (resumo + CSV + todos os XMLs autorizados/assinados do período).
 */
export async function exportarPacoteContador(db, empresaId, opcoes = {}) {
  const { periodo, docs } = await carregarDadosPeriodo(db, empresaId, opcoes);
  const [resumo, planilha] = await Promise.all([
    resumoContabil(db, empresaId, opcoes),
    exportarCsvContador(db, empresaId, opcoes),
  ]);

  const arquivosXml = docs
    .filter((d) => d.xml_autorizado || d.xml_assinado)
    .map((d) => ({
      id: d.id,
      nomeArquivo: `${d.modelo === 'nfse' ? 'nfse' : d.modelo === '55' ? 'nfe' : 'nfce'}-${d.serie}-${d.numero}-${d.status}.xml`,
      modelo: d.modelo,
      serie: Number(d.serie),
      numero: Number(d.numero),
      status: d.status,
      chave: d.chave || d.chave_acesso || d.id_dps || null,
      valorTotal: dinheiro(d.valor_total),
      xml: d.xml_autorizado || d.xml_assinado,
    }));

  return {
    competencia: periodo.competencia,
    geradoEm: new Date().toISOString(),
    resumo,
    csvContabil: planilha.csv,
    totalXmls: arquivosXml.length,
    arquivosXml,
    xmls: arquivosXml,
  };
}


import zlib from 'zlib';

// Tabela CRC32 padrao IEEE 802.3
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  CRC_TABLE[i] = c;
}

export function montarZipBuffer(arquivos) {
  // arquivos: [ { nome: 'caminho/arquivo.ext', conteudo: Buffer ou string } ]
  const partes = [];
  const registrosDiretorioCentral = [];
  let offset = 0;

  for (const arq of arquivos) {
    const nomeBuf = Buffer.from(arq.nome, 'utf8');
    const dadosBuf = Buffer.isBuffer(arq.conteudo) ? arq.conteudo : Buffer.from(String(arq.conteudo || ''), 'utf8');
    const comprimido = zlib.deflateRawSync(dadosBuf);
    
    let crc = 0 ^ (-1);
    for (let i = 0; i < dadosBuf.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ dadosBuf[i]) & 0xFF];
    }
    crc = (crc ^ (-1)) >>> 0;

    // Header local PK\x03\x04
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // versao necessaria
    localHeader.writeUInt16LE(0, 6);  // flags
    localHeader.writeUInt16LE(8, 8);  // compressao deflate
    localHeader.writeUInt16LE(0, 10); // hora mod
    localHeader.writeUInt16LE(0, 12); // data mod
    localHeader.writeUInt32LE(crc, 14); // crc32
    localHeader.writeUInt32LE(comprimido.length, 18); // comp size
    localHeader.writeUInt32LE(dadosBuf.length, 22);   // uncomp size
    localHeader.writeUInt16LE(nomeBuf.length, 26);    // nome length
    localHeader.writeUInt16LE(0, 28);                 // extra field length

    partes.push(localHeader, nomeBuf, comprimido);

    // Diretorio central PK\x01\x02
    const cdEntry = Buffer.alloc(46);
    cdEntry.writeUInt32LE(0x02014b50, 0);
    cdEntry.writeUInt16LE(20, 4); // versao feita por
    cdEntry.writeUInt16LE(20, 6); // versao necessaria
    cdEntry.writeUInt16LE(0, 8);  // flags
    cdEntry.writeUInt16LE(8, 10); // compressao deflate
    cdEntry.writeUInt16LE(0, 12); // hora
    cdEntry.writeUInt16LE(0, 14); // data
    cdEntry.writeUInt32LE(crc, 16);
    cdEntry.writeUInt32LE(comprimido.length, 20);
    cdEntry.writeUInt32LE(dadosBuf.length, 24);
    cdEntry.writeUInt16LE(nomeBuf.length, 28);
    cdEntry.writeUInt16LE(0, 30); // extra
    cdEntry.writeUInt16LE(0, 32); // comment
    cdEntry.writeUInt16LE(0, 34); // disk num
    cdEntry.writeUInt16LE(0, 36); // internal attr
    cdEntry.writeUInt32LE(0, 38); // external attr
    cdEntry.writeUInt32LE(offset, 42); // offset local header

    registrosDiretorioCentral.push(cdEntry, nomeBuf);
    offset += localHeader.length + nomeBuf.length + comprimido.length;
  }

  const offsetCD = offset;
  let tamanhoCD = 0;
  for (const p of registrosDiretorioCentral) tamanhoCD += p.length;

  // Fim do diretorio central PK\x05\x06
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4); // disk num
  endRecord.writeUInt16LE(0, 6); // disk cd
  endRecord.writeUInt16LE(arquivos.length, 8);  // entries on disk
  endRecord.writeUInt16LE(arquivos.length, 10); // total entries
  endRecord.writeUInt32LE(tamanhoCD, 12);       // cd size
  endRecord.writeUInt32LE(offsetCD, 16);        // cd offset
  endRecord.writeUInt16LE(0, 20);               // comment len

  return Buffer.concat([...partes, ...registrosDiretorioCentral, endRecord]);
}

/**
 * Gera arquivo ZIP completo contendo todos os XMLs de notas fiscais,
 * os relatorios contabeis e os arquivos de SPED Fiscal / Contribuicoes.
 */
export async function gerarPacoteContabilZipBuffer(db, empresaId, opcoes = {}) {
  const { periodo, emit } = await carregarDadosPeriodo(db, empresaId, opcoes);
  const cnpj = soDigitos(emit?.cnpj || '00000000000000');
  const comp = periodo.competencia;

  const [pacote, spedFiscal, spedContr] = await Promise.all([
    exportarPacoteContador(db, empresaId, opcoes),
    gerarSpedFiscalTxt(db, empresaId, opcoes).catch(() => null),
    gerarSpedContribuicoesTxt(db, empresaId, opcoes).catch(() => null),
  ]);

  const arquivosNoZip = [];

  // 1. Adicionar CSV sintetico
  arquivosNoZip.push({
    nome: `RELATORIO-CONTABIL-${cnpj}-${comp}.csv`,
    conteudo: pacote.csvContabil,
  });

  // 2. Adicionar Resumo JSON
  arquivosNoZip.push({
    nome: `RESUMO-CONTABIL-${cnpj}-${comp}.json`,
    conteudo: JSON.stringify(pacote.resumo, null, 2),
  });

  // 3. Adicionar SPED Fiscal se houver
  if (spedFiscal?.conteudo) {
    arquivosNoZip.push({
      nome: spedFiscal.nomeArquivo || `SPED-FISCAL-${cnpj}-${comp}.txt`,
      conteudo: spedFiscal.conteudo,
    });
  }

  // 4. Adicionar SPED Contribuicoes se houver
  if (spedContr?.conteudo) {
    arquivosNoZip.push({
      nome: spedContr.nomeArquivo || `SPED-CONTRIBUICOES-${cnpj}-${comp}.txt`,
      conteudo: spedContr.conteudo,
    });
  }

  // 5. Adicionar todos os XMLs na pasta xml/
  for (const itemXml of pacote.arquivosXml) {
    if (itemXml.xml) {
      arquivosNoZip.push({
        nome: `xml/${itemXml.nomeArquivo}`,
        conteudo: itemXml.xml,
      });
    }
  }

  const zipBuffer = montarZipBuffer(arquivosNoZip);
  return {
    nomeArquivo: `PACOTE-FISCAL-${cnpj}-${comp}.zip`,
    buffer: zipBuffer,
    totalArquivos: arquivosNoZip.length,
    totalXmls: pacote.arquivosXml.length,
  };
}
