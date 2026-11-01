// F1 do plano fiscal: produção por empresa (FISCAL_PRODUCAO_EMPRESAS + emitente em produção),
// URLs de produção da SEFAZ-MT, numeração separada por ambiente, retorno assíncrono (recibo),
// ST e regimes (CSOSN 500, CST 20/60), indPres da venda online e vendas sem nota com valor.
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';
import * as fiscal from '../modules/fiscal/servico.js';
import * as sefaz from '../modules/fiscal/sefaz.js';
import { montarXmlFiscalV400, assinarXmlFiscal, validarXmlFiscal, agoraFiscalCuiaba } from '../fiscal-xml-kytto.js';
import { gerarChaveAcessoFiscal } from '../fiscal-kytto.js';
import { totalizarDocumentoFiscal } from '../tributacao-kytto.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');
const STUBS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(255), ativa BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE commerce_products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(200) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active');
CREATE TABLE commerce_product_variants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, product_id UUID NOT NULL, sku VARCHAR(100), ativo BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE commerce_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, loja_id UUID, public_code VARCHAR(30), status VARCHAR(30) NOT NULL DEFAULT 'paid',
  frete NUMERIC(14,2) NOT NULL DEFAULT 0, endereco_entrega JSONB, criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE commerce_order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, order_id UUID NOT NULL, variant_id UUID, nome_snapshot VARCHAR(200),
  quantidade NUMERIC(14,3) NOT NULL, preco_unitario NUMERIC(14,2) NOT NULL, desconto NUMERIC(14,2) NOT NULL DEFAULT 0);
CREATE TABLE commerce_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, order_id UUID NOT NULL, method VARCHAR(30), amount NUMERIC(14,2), status VARCHAR(30), captured_at TIMESTAMPTZ);`;

const SENHA = 'senha-teste';
const PFX = pfxDeTeste(SENHA);
const EMITENTE = {
  cnpj: '50.073.355/0002-60', razaoSocial: 'BARBEARIA TESTE LTDA', nomeFantasia: 'Barbearia', ie: '131234567', im: '12345', crt: '1', uf: 'MT', codigoMunicipio: '5107958',
  endereco: { logradouro: 'Rua Avelina Jaci Bohn', numero: '80', bairro: 'Centro', cidade: 'Tangará da Serra', cep: '78300000' }, cscId: '000001', csc: 'CSC-PRODUCAO-123456',
};

// SEFAZ falsa: responde no ambiente pedido (tpAmb do XML), ou num ambiente forçado
function sefazFalsa({ forcarTpAmb = null, assincrono = false, emProcessamento = 0 } = {}) {
  const enviados = [];
  let pendentes = emProcessamento;
  let ultimo = null;
  const resp = (chave, tpAmb) => `<protNFe versao="4.00"><infProt><tpAmb>${tpAmb}</tpAmb><chNFe>${chave}</chNFe><nProt>151260000000900</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>`;
  const transporte = async ({ url, xml }) => {
    enviados.push({ url, xml });
    const tpAmb = forcarTpAmb || (xml.match(/<tpAmb>(\d)<\/tpAmb>/) || [])[1] || '2';
    if (url.includes('RetAutorizacao')) {
      if (pendentes > 0) { pendentes -= 1; return { status: 200, corpo: '<retConsReciNFe><cStat>105</cStat><xMotivo>Lote em processamento</xMotivo></retConsReciNFe>' }; }
      return { status: 200, corpo: `<retConsReciNFe><tpAmb>${tpAmb}</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo>${resp(ultimo, tpAmb)}</retConsReciNFe>` };
    }
    const chave = (xml.match(/Id="NFe(\d{44})"/) || [])[1];
    ultimo = chave;
    if (assincrono) return { status: 200, corpo: `<retEnviNFe><tpAmb>${tpAmb}</tpAmb><cStat>103</cStat><xMotivo>Lote recebido com sucesso</xMotivo><infRec><nRec>511000000123456</nRec><tMed>1</tMed></infRec></retEnviNFe>` };
    return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><xMotivo>Lote processado</xMotivo>${resp(chave, tpAmb)}</retEnviNFe>` };
  };
  return { transporte, enviados };
}

describe('Fiscal F1 — produção por empresa, ST, regimes e venda online (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID(); const B = randomUUID();
  const MASTER = randomBytes(32).toString('hex');
  const ENV_HOMOLOG = { FISCAL_CERT_MASTER_KEY: MASTER };
  const ENV_PROD = { FISCAL_CERT_MASTER_KEY: MASTER, FISCAL_PRODUCAO_EMPRESAS: `${randomUUID()}, ${A}` };
  const agora = new Date();
  const semEspera = async () => {};
  let variante;

  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '092_fiscal_multiempresa.sql', '100_fiscal_completo.sql', '106_fiscal_producao.sql']) await ctx.db.query(sql(m));
    // reexecutável: o runner pode aplicar a 106 de novo
    await ctx.db.query(sql('106_fiscal_producao.sql'));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    for (const empresa of [A, B]) {
      await fiscal.salvarEmitente(ctx.db, empresa, EMITENTE, { env: ENV_HOMOLOG });
      await fiscal.importarCertificado(ctx.db, empresa, { arquivoBase64: PFX, senha: SENHA }, { env: ENV_HOMOLOG });
    }
    const p = (await ctx.db.query("INSERT INTO commerce_products (empresa_id, nome) VALUES ($1, 'CK Be 100ml') RETURNING id", [A])).rows[0].id;
    variante = (await ctx.db.query("INSERT INTO commerce_product_variants (empresa_id, product_id, sku) VALUES ($1, $2, 'CKBE100') RETURNING id", [A, p])).rows[0].id;
  });
  after(async () => { await ctx?.fechar(); });

  async function pedidoPago({ entrega = true, valor = 300 } = {}) {
    const o = (await ctx.db.query(
      'INSERT INTO commerce_orders (empresa_id, public_code, frete, endereco_entrega) VALUES ($1, $2, 13, $3) RETURNING id',
      [A, `KC-${randomBytes(4).toString('hex').toUpperCase()}`, entrega ? JSON.stringify({ cep: '78300055', logradouro: 'Rua X', numero: '1' }) : null])).rows[0].id;
    await ctx.db.query("INSERT INTO commerce_order_items (empresa_id, order_id, variant_id, nome_snapshot, quantidade, preco_unitario) VALUES ($1, $2, $3, 'CK Be 100ml', 1, $4)", [A, o, variante, valor]);
    await ctx.db.query("INSERT INTO commerce_payments (empresa_id, order_id, method, amount, status, captured_at) VALUES ($1, $2, 'pix', $3, 'captured', CURRENT_TIMESTAMP)", [A, o, valor + 13]);
    return o;
  }

  test('endereços: produção de MT conferida, host tem de bater com o ambiente e tpAmb segue o ambiente', () => {
    const p65 = sefaz.enderecos('MT', '65', { ambiente: 'producao', env: {} });
    assert.equal(p65.autorizacao, 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4');
    assert.equal(p65.retAutorizacao, 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4');
    assert.equal(p65.qrCode, 'http://www.sefaz.mt.gov.br/nfce/consultanfce');
    assert.equal(sefaz.enderecos('MT', '55', { ambiente: 'producao', env: {} }).autorizacao, 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4');
    assert.equal(sefaz.enderecos('MT', '65', { env: {} }).qrCode, 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce');
    // host de homologação em produção (e o contrário) é recusado, mesmo sobreposto por variável
    const errado = { FISCAL_SEFAZ_URLS_PRODUCAO: JSON.stringify({ MT: { 65: { autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4' } } }) };
    assert.throws(() => sefaz.enderecos('MT', '65', { ambiente: 'producao', env: errado }), (e) => e.code === 'AMBIENTE_PROIBIDO');
    const errado2 = { FISCAL_SEFAZ_URLS_HOMOLOGACAO: JSON.stringify({ MT: { 65: { autorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4' } } }) };
    assert.throws(() => sefaz.enderecos('MT', '65', { env: errado2 }), (e) => e.code === 'AMBIENTE_PROIBIDO');
    // UF ainda não conferida para produção
    assert.throws(() => sefaz.enderecos('SP', '65', { ambiente: 'producao', env: {} }), (e) => e.code === 'UF_SEM_ENDERECO');
    assert.match(sefaz.montarInutilizacao({ uf: 'MT', ano: '26', cnpj: '50073355000260', modelo: '65', serie: 1, numeroInicial: 1, numeroFinal: 1, justificativa: 'Teste de ambiente produção', ambiente: 'producao' }).xml, /<tpAmb>1<\/tpAmb>/);
    assert.match(sefaz.montarEventoCancelamento({ uf: 'MT', cnpj: '50073355000260', chave: '5'.repeat(44), protocolo: '1', justificativa: 'Cancelamento em produção', dataEvento: 'x', ambiente: 'producao' }), /<tpAmb>1<\/tpAmb>/);
  });

  test('produção só com a empresa liberada no servidor: sem liberação o emitente fica em homologação', async () => {
    await assert.rejects(() => fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, ambiente: 'producao' }, { env: ENV_HOMOLOG }), (e) => e.code === 'AMBIENTE_PROIBIDO');
    await assert.rejects(() => fiscal.salvarEmitente(ctx.db, B, { ...EMITENTE, ambiente: 'producao' }, { env: ENV_PROD }), (e) => e.code === 'AMBIENTE_PROIBIDO', 'B não está na lista');
    await assert.rejects(() => fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, ambiente: 'teste' }, { env: ENV_PROD }), (e) => e.code === 'VALIDATION_ERROR');
    assert.equal((await fiscal.listarEmitentes(ctx.db, A))[0].ambiente, 'homologacao');
    const p = await fiscal.prontidao(ctx.db, A, { env: ENV_PROD });
    assert.equal(p.ambiente, 'homologacao');
    assert.equal(p.transmissao, 'desligada');
    assert.equal(p.producaoLiberada, true);
    assert.equal(p.validadorXsd, true);
  });

  test('ST no Simples (CSOSN 500): exige CEST; XML com ICMSSN500 e total sem base de ICMS', async () => {
    await assert.rejects(() => fiscal.salvarClassificacao(ctx.db, A, { fonte: 'loja_variante', fonteId: variante, ncm: '33030010', cfop: '5405', csosn: '500' }), (e) => e.code === 'VALIDATION_ERROR' && /CEST/.test(e.message));
    const c = await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'loja_variante', fonteId: variante, ncm: '33030010', cest: '2002000', cfop: '5405', csosn: '500' });
    assert.equal(c.csosn, '500');
    const pedido = await pedidoPago({ entrega: true });
    const vendas = await fiscal.vendasSemNota(ctx.db, A);
    const venda = vendas.find((v) => v.origemId === pedido);
    assert.equal(venda.valor, 300, 'valor do pedido (sem o frete) aparece na lista');
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: pedido }, { env: ENV_HOMOLOG, agora });
    assert.equal(doc.status, 'validado_localmente');
    assert.ok(!doc.mensagens.some((m) => m.codigo === 'XSD_INDISPONIVEL'));
    const xml = (await fiscal.obterDocumento(ctx.db, A, doc.id, { comXml: true })).xmlAssinado;
    assert.match(xml, /<ICMSSN500><orig>0<\/orig><CSOSN>500<\/CSOSN><\/ICMSSN500>/);
    assert.match(xml, /<CEST>2002000<\/CEST>/);
    assert.match(xml, /<ICMSTot><vBC>0.00<\/vBC><vICMS>0.00<\/vICMS>/);
    assert.match(xml, /<vBCST>0.00<\/vBCST><vST>0.00<\/vST>/);
    // venda online com entrega: NFC-e com indPres=4 e sem intermediador
    assert.match(xml, /<indPres>4<\/indPres><indIntermed>0<\/indIntermed>/);
    assert.equal(doc.valorTotal, 300);
    assert.equal((await fiscal.vendasSemNota(ctx.db, A)).some((v) => v.origemId === pedido), false);
  });

  test('pedido com retirada: NFC-e presencial (indPres=1, sem indIntermed)', async () => {
    const pedido = await pedidoPago({ entrega: false, valor: 120 });
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: pedido }, { env: ENV_HOMOLOG, agora });
    const xml = (await fiscal.obterDocumento(ctx.db, A, doc.id, { comXml: true })).xmlAssinado;
    assert.match(xml, /<indPres>1<\/indPres><procEmi>/);
  });

  test('CSOSN 102/103/300/400 usam o grupo ICMSSN102; regime normal: CST 00, 20 (pRedBC) e 60 passam no schema', async () => {
    const base = { config: { ...EMITENTE, cnpj: '50073355000260', endereco: { ...EMITENTE.endereco, codigoMunicipio: '5107958' }, cscId: '000001', csc: 'x', indPres: '1' }, modelo: '65', numero: 1, serie: 1,
      chaveAcesso: gerarChaveAcessoFiscal({ uf: 'MT', dhEmi: agoraFiscalCuiaba(new Date()), cnpj: '50073355000260', modelo: '65', serie: 1, numero: 1, tpEmis: '1', codigoNumerico: '12345678' }), qrCodeUrl: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce', urlChave: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce' };
    for (const csosn of ['102', '103', '300', '400']) {
      const calc = totalizarDocumentoFiscal([{ descricao: 'Item', quantidade: 1, valorUnitario: 10, fiscal: { ncm: '33030010', cfop: '5102', csosn } }], { regimeTributario: 'simples' });
      assert.equal(calc.totais.baseIcms, 0, `CSOSN ${csosn} sem base de ICMS`);
      const xml = montarXmlFiscalV400({ ...base, config: { ...base.config, regimeTributario: 'simples' }, itens: calc.itens.map((c) => ({ ...c, descricao: 'Item', produtoId: '1' })), totais: calc.totais, pagamentos: [{ meio: 'pix', valor: 10 }] });
      assert.match(xml, new RegExp(`<ICMSSN102><orig>0</orig><CSOSN>${csosn}</CSOSN></ICMSSN102>`));
    }
    const calcN = totalizarDocumentoFiscal([
      { descricao: 'Tributado', quantidade: 1, valorUnitario: 100, fiscal: { ncm: '33030010', cfop: '5102', cstIcms: '00', aliquotaIcms: 17, cstPis: '01', aliquotaPis: 0.65, cstCofins: '01', aliquotaCofins: 3 } },
      { descricao: 'Reduzido', quantidade: 1, valorUnitario: 100, fiscal: { ncm: '33030010', cfop: '5102', cstIcms: '20', aliquotaIcms: 17, reducaoBaseIcms: 41.1765 } },
      { descricao: 'ST retida', quantidade: 1, valorUnitario: 100, fiscal: { ncm: '33030010', cest: '2002000', cfop: '5405', cstIcms: '60' } },
      { descricao: 'Isento', quantidade: 1, valorUnitario: 100, fiscal: { ncm: '33030010', cfop: '5102', cstIcms: '50' } },
    ], { regimeTributario: 'lucro_presumido' });
    assert.equal(calcN.totais.baseIcms, 158.82, 'CST 00 (100) + CST 20 com base reduzida (58,82)');
    assert.equal(calcN.totais.valorIcms, 27);
    assert.equal(calcN.totais.baseSt, 0, 'CST 60: ST já retida, sem ST nesta nota');
    const xml = montarXmlFiscalV400({ ...base, config: { ...base.config, regimeTributario: 'lucro_presumido', crt: '3' }, itens: calcN.itens.map((c, i) => ({ ...c, descricao: c.descricao, produtoId: String(i + 1) })), totais: calcN.totais, pagamentos: [{ meio: 'pix', valor: 400 }] });
    assert.match(xml, /<ICMS00><orig>0<\/orig><CST>00<\/CST><modBC>3<\/modBC><vBC>100.00<\/vBC><pICMS>17.00<\/pICMS><vICMS>17.00<\/vICMS><\/ICMS00>/);
    assert.match(xml, /<ICMS20><orig>0<\/orig><CST>20<\/CST><modBC>3<\/modBC><pRedBC>41.1765<\/pRedBC><vBC>58.82<\/vBC>/);
    assert.match(xml, /<ICMS60><orig>0<\/orig><CST>60<\/CST><\/ICMS60>/);
    assert.match(xml, /<ICMS40><orig>0<\/orig><CST>50<\/CST><\/ICMS40>/);
    const assinado = assinarXmlFiscal(xml, { pfx: Buffer.from(PFX, 'base64'), password: SENHA }).xml;
    const validacao = validarXmlFiscal(assinado);
    assert.equal(validacao.valido, true, JSON.stringify(validacao.xsd?.erros || validacao.estrutura?.erros));
    assert.match(xml, /<PISAliq><CST>01<\/CST><vBC>100.00<\/vBC><pPIS>0.6500<\/pPIS><vPIS>0.65<\/vPIS><\/PISAliq>/);
    assert.throws(() => montarXmlFiscalV400({ ...base, config: { ...base.config, regimeTributario: 'simples' }, itens: [{ descricao: 'X', produtoId: '1', quantidade: 1, valorUnitario: 1, valorProduto: 1, baseCalculo: 1, fiscal: { ncm: '33030010', cfop: '5102', csosn: '900' }, icms: {}, pis: {}, cofins: {} }], totais: { valorTotal: 1 }, pagamentos: [] }), /CSOSN 900/);
  });

  test('regime normal: CST 20 exige a redução', async () => {
    await assert.rejects(() => fiscal.salvarClassificacao(ctx.db, A, { fonte: 'est_item', fonteId: 'x', ncm: '33030010', cfop: '5102', cstIcms: '20' }), (e) => /redução/.test(e.message));
  });

  test('produção: transmite para a SEFAZ-MT de produção, sem texto de homologação, numeração própria a partir do 1', async () => {
    const emit = await fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, ambiente: 'producao' }, { env: ENV_PROD });
    assert.equal(emit.ambiente, 'producao');
    // trocar outros dados sem mandar o ambiente mantém produção
    assert.equal((await fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, nomeFantasia: 'Barbearia Dino' }, { env: ENV_PROD })).ambiente, 'producao');
    const p = await fiscal.prontidao(ctx.db, A, { env: ENV_PROD });
    assert.equal(p.ambiente, 'producao');
    assert.equal(p.transmissao, 'producao');
    const pedido = await pedidoPago();
    const { transporte, enviados } = sefazFalsa();
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: pedido }, { env: ENV_PROD, transporte, agora });
    assert.equal(doc.status, 'autorizado');
    assert.equal(doc.ambiente, 'producao');
    assert.equal(doc.numero, 1, 'produção começa no 1, separada da homologação');
    assert.equal(enviados[0].url, 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4');
    const xml = (await fiscal.obterDocumento(ctx.db, A, doc.id, { comXml: true })).xmlAssinado;
    assert.match(xml, /<tpAmb>1<\/tpAmb>/);
    assert.doesNotMatch(xml, /HOMOLOGACAO|SEM VALOR FISCAL/);
    assert.match(xml, /<qrCode>http:\/\/www.sefaz.mt.gov.br\/nfce\/consultanfce\?p=\d{44}\|3\|1<\/qrCode>/);
    assert.match(xml, /<urlChave>http:\/\/www.sefaz.mt.gov.br\/nfce\/consultanfce<\/urlChave>/);
    // DANFE de produção sem o aviso de "sem valor fiscal"
    const html = await fiscal.danfe(ctx.db, A, doc.id);
    assert.doesNotMatch(html, /SEM VALOR FISCAL|homologação/);
    // o mesmo pedido já tinha documento de homologação? a nota de produção é outra
    assert.equal((await fiscal.vendasSemNota(ctx.db, A)).some((v) => v.origemId === pedido), false);
    // tirar a empresa da lista bloqueia a emissão (nada é gravado)
    const outro = await pedidoPago();
    const antes = (await fiscal.listarDocumentos(ctx.db, A)).length;
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: outro }, { env: ENV_HOMOLOG, transporte, agora }), (e) => e.code === 'PRODUCAO_NAO_LIBERADA');
    assert.equal((await fiscal.listarDocumentos(ctx.db, A)).length, antes);
    assert.equal((await fiscal.prontidao(ctx.db, A, { env: ENV_HOMOLOG })).transmissao, 'producao_bloqueada');
  });

  test('produção: resposta da SEFAZ em homologação não autoriza; lote assíncrono é consultado pelo recibo', async () => {
    const p1 = await pedidoPago();
    const errada = sefazFalsa({ forcarTpAmb: '2' });
    const rej = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: p1 }, { env: ENV_PROD, transporte: errada.transporte, agora });
    assert.equal(rej.status, 'rejeitado');
    assert.match(rej.mensagens[0].mensagem, /não é produção/);
    // assíncrono: 103 (lote recebido) → 105 (em processamento) → 104 com protocolo
    const p2 = await pedidoPago();
    const assin = sefazFalsa({ assincrono: true, emProcessamento: 1 });
    const ok = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: p2 }, { env: { ...ENV_PROD, FISCAL_RET_TENTATIVAS: '3' }, transporte: assin.transporte, agora, esperar: semEspera });
    assert.equal(ok.status, 'autorizado');
    const urls = assin.enviados.map((e) => e.url);
    assert.deepEqual(urls, ['https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4', 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4', 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4']);
    assert.match(assin.enviados[1].xml, /<consReciNFe xmlns="http:\/\/www.portalfiscal.inf.br\/nfe" versao="4.00"><tpAmb>1<\/tpAmb><nRec>511000000123456<\/nRec><\/consReciNFe>/);
    // lote que não sai do "em processamento": falha de comunicação (mesmo XML reenviado depois)
    const p3 = await pedidoPago();
    const preso = sefazFalsa({ assincrono: true, emProcessamento: 99 });
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: p3 }, { env: { ...ENV_PROD, FISCAL_RET_TENTATIVAS: '2' }, transporte: preso.transporte, agora, esperar: semEspera }), (e) => e.code === 'FALHA_COMUNICACAO');
  });

  test('produção: inutilização e cancelamento vão para a SEFAZ de produção com tpAmb=1', async () => {
    const enviados = [];
    const t = async (req) => {
      enviados.push(req);
      if (req.url.includes('Inutilizacao')) return { status: 200, corpo: '<retInutNFe><infInut><tpAmb>1</tpAmb><cStat>102</cStat><xMotivo>Inutilizacao de numero homologado</xMotivo><nProt>151260000000700</nProt></infInut></retInutNFe>' };
      return { status: 200, corpo: '<retEnvEvento><cStat>128</cStat><retEvento versao="1.00"><infEvento><tpAmb>1</tpAmb><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><nProt>151260000000701</nProt></infEvento></retEvento></retEnvEvento>' };
    };
    const inut = await fiscal.inutilizarNumeracao(ctx.db, A, { modelo: '65', serie: 1, numeroInicial: 50, numeroFinal: 51, justificativa: 'Numeração pulada em produção' }, { env: ENV_PROD, transporte: t, agora });
    assert.equal(inut.status, 'homologada');
    assert.equal(inut.ambiente, 'producao');
    assert.equal(enviados[0].url, 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeInutilizacao4');
    assert.match(enviados[0].xml, /<tpAmb>1<\/tpAmb>/);
    const docs = (await fiscal.listarDocumentos(ctx.db, A)).filter((d) => d.ambiente === 'producao' && d.status === 'autorizado');
    const cancelado = await fiscal.cancelar(ctx.db, A, docs[0].id, { justificativa: 'Cliente desistiu da compra', env: ENV_PROD, transporte: t, agora });
    assert.equal(cancelado.status, 'cancelado');
    assert.equal(enviados[1].url, 'https://nfce.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4');
    assert.match(enviados[1].xml, /<tpAmb>1<\/tpAmb>/);
  });

  test('excluir: classificação, tabela do IBPT, certificado substituído e emitente (desativa se tiver nota)', async () => {
    await fiscal.salvarClassificacao(ctx.db, B, { fonte: 'est_item', fonteId: 'item-1', ncm: '33030010', cfop: '5102', csosn: '102' });
    assert.deepEqual(await fiscal.excluirClassificacao(ctx.db, B, { fonte: 'est_item', fonteId: 'item-1' }), { ok: true, excluido: true });
    await assert.rejects(() => fiscal.excluirClassificacao(ctx.db, B, { fonte: 'est_item', fonteId: 'item-1' }), (e) => e.code === 'NOT_FOUND');
    await assert.rejects(() => fiscal.excluirClassificacao(ctx.db, A, { fonte: 'loja_variante', fonteId: randomUUID() }), (e) => e.code === 'NOT_FOUND');
    // IBPT
    await ctx.db.query("INSERT INTO fis_ibpt (empresa_id, uf, tipo, codigo, ex, descricao, nacional_federal, importados_federal, estadual, municipal, chave, versao, fonte) VALUES ($1, 'MT', '0', '33030010', '', 'Perfumes', 13.45, 15, 17, 0, 'x', '26.1', 'IBPT')", [B]).catch(async () => {
      await ctx.db.query("INSERT INTO fis_ibpt (empresa_id, uf, codigo, nacional_federal, importados_federal, estadual, municipal) VALUES ($1, 'MT', '33030010', 13.45, 15, 17, 0)", [B]);
    });
    assert.equal((await fiscal.excluirIbpt(ctx.db, B, 'mt')).linhas, 1);
    await assert.rejects(() => fiscal.excluirIbpt(ctx.db, B, 'MT'), (e) => e.code === 'NOT_FOUND');
    // certificado: o ativo não sai; o substituído sai; reativar volta a usar
    const ativo = (await fiscal.listarCertificados(ctx.db, B)).find((c) => c.ativo);
    await assert.rejects(() => fiscal.excluirCertificado(ctx.db, B, ativo.id), (e) => e.code === 'CERTIFICADO_EM_USO');
    const segundo = pfxDeTeste('outra-senha');
    const novo = await fiscal.importarCertificado(ctx.db, B, { arquivoBase64: segundo, senha: 'outra-senha' }, { env: ENV_HOMOLOG });
    assert.equal(novo.ativo, true);
    assert.equal((await fiscal.ativarCertificado(ctx.db, B, ativo.id)).ativo, true);
    assert.deepEqual(await fiscal.excluirCertificado(ctx.db, B, novo.id), { ok: true, excluido: true });
    assert.equal((await fiscal.listarCertificados(ctx.db, B)).length, 1);
    // emitente sem nota (B) é apagado; com nota (A) só desativa e pode ser reativado
    const eB = (await fiscal.listarEmitentes(ctx.db, B))[0];
    assert.equal((await fiscal.excluirEmitente(ctx.db, B, eB.id)).excluido, true);
    assert.equal((await fiscal.listarEmitentes(ctx.db, B)).length, 0);
    const eA = (await fiscal.listarEmitentes(ctx.db, A))[0];
    assert.equal((await fiscal.excluirEmitente(ctx.db, A, eA.id)).desativado, true);
    assert.equal((await fiscal.listarEmitentes(ctx.db, A))[0].ativo, false);
    assert.equal((await fiscal.prontidao(ctx.db, A, { env: ENV_PROD })).pronto, false);
    assert.equal((await fiscal.reativarEmitente(ctx.db, A, eA.id)).ativo, true);
    await assert.rejects(() => fiscal.excluirEmitente(ctx.db, B, eA.id), (e) => e.code === 'NOT_FOUND', 'B não mexe no emitente de A');
    // devolve B ao estado inicial para o teste seguinte
    await fiscal.salvarEmitente(ctx.db, B, EMITENTE, { env: ENV_HOMOLOG });
  });

  test('isolamento: a empresa B continua em homologação e não vê documentos de A', async () => {
    assert.equal((await fiscal.listarEmitentes(ctx.db, B))[0].ambiente, 'homologacao');
    assert.equal((await fiscal.listarDocumentos(ctx.db, B)).length, 0);
    assert.equal((await fiscal.vendasSemNota(ctx.db, B)).length, 0);
  });
});
