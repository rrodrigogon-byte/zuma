// Revisão independente da F1/F2/F3 do fiscal: idempotência pelo emitente que de fato emite,
// respostas transitórias da SEFAZ, CRT 2 com CST, itens da comanda da barbearia (subtotal,
// cobertura do plano, item da loja, id canônico), pagamento que não fecha, numeração (série,
// próximo, padrão, 539 e DPS repetida), CSC na troca de ambiente, grupo card, CC-e, SVC,
// NF-e interestadual com DIFAL e contingências transmitidas no ambiente de cada documento.
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';

// o JSON legado (barbearia) vai para um arquivo temporário, nunca para o data/ do projeto
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'fiscal-revisao-')), 'db.json');
const { db: jsonDb } = await import('../db.js');
const fiscal = await import('../modules/fiscal/servico.js');

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
const EMIT = {
  cnpj: '50073355000260', razaoSocial: 'BARBEARIA TESTE LTDA', ie: '131234567', im: '12345', crt: '1', uf: 'MT', codigoMunicipio: '5107958',
  endereco: { logradouro: 'Rua A', numero: '80', bairro: 'Centro', cidade: 'Tangara da Serra', cep: '78300000' }, cscId: '000001', csc: 'CSC-HOMOLOG-123456',
};
const DEST_SP = {
  cpf: '52998224725', nome: 'CLIENTE DE SAO PAULO', indIEDest: '9',
  endereco: { logradouro: 'Av Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'Sao Paulo', uf: 'SP', codigoMunicipio: '3550308', cep: '01310100' },
};

const prot = (chave, tpAmb, cStat = '100') => `<protNFe versao="4.00"><infProt><tpAmb>${tpAmb}</tpAmb><chNFe>${chave}</chNFe><nProt>151260000000777</nProt><cStat>${cStat}</cStat><xMotivo>Resposta ${cStat}</xMotivo></infProt></protNFe>`;
/** SEFAZ programável: cada envio de autorização consome um "roteiro" (ou repete o último). */
function sefaz(roteiro = ['100']) {
  const enviados = [];
  let i = 0;
  const transporte = async ({ url, xml }) => {
    enviados.push({ url, xml });
    const tpAmb = (xml.match(/<tpAmb>(\d)<\/tpAmb>/) || [])[1] || '2';
    if (/recepcaoevento|RecepcaoEvento/i.test(url)) return { status: 200, corpo: `<retEnvEvento><cStat>128</cStat><retEvento><infEvento><tpAmb>${tpAmb}</tpAmb><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><nProt>151260000000888</nProt></infEvento></retEvento></retEnvEvento>` };
    if (/RetAutorizacao/i.test(url)) return { status: 200, corpo: '<retConsReciNFe><cStat>105</cStat><xMotivo>Lote em processamento</xMotivo></retConsReciNFe>' };
    const chave = (xml.match(/Id="NFe(\d{44})"/) || [])[1];
    const passo = roteiro[Math.min(i, roteiro.length - 1)]; i += 1;
    if (passo === 'http500') return { status: 500, corpo: '<soap:Fault><faultstring>Erro interno</faultstring></soap:Fault>' };
    if (passo === '108') return { status: 200, corpo: '<retEnviNFe><cStat>108</cStat><xMotivo>Servico Paralisado Momentaneamente</xMotivo></retEnviNFe>' };
    if (passo === '103sem') return { status: 200, corpo: '<retEnviNFe><cStat>103</cStat><xMotivo>Lote recebido</xMotivo></retEnviNFe>' };
    if (passo === '103') return { status: 200, corpo: '<retEnviNFe><cStat>103</cStat><xMotivo>Lote recebido</xMotivo><infRec><nRec>511000000999999</nRec></infRec></retEnviNFe>' };
    if (passo === 'lote225') return { status: 200, corpo: '<retEnviNFe><cStat>225</cStat><xMotivo>Rejeicao: Falha no Schema XML do lote</xMotivo></retEnviNFe>' };
    return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><xMotivo>Lote processado</xMotivo>${prot(chave, tpAmb, passo)}</retEnviNFe>` };
  };
  return { transporte, enviados };
}

describe('Fiscal — correções da revisão (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID(); const C = randomUUID(); const D = randomUUID();
  const MASTER = randomBytes(32).toString('hex');
  const ENV = { FISCAL_CERT_MASTER_KEY: MASTER };
  const ENV_TX = { ...ENV, FISCAL_TRANSMITIR_HOMOLOGACAO: '1' };
  const ENV_PROD = { ...ENV, FISCAL_PRODUCAO_EMPRESAS: `${A},${D}` };
  const agora = new Date();
  const semEspera = async () => {};
  let loja; let variante;

  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '092_fiscal_multiempresa.sql', '100_fiscal_completo.sql', '106_fiscal_producao.sql', '108_fiscal_ibs_cbs.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2), ($3)', [A, C, D]);
    loja = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Unidade 2') RETURNING id", [A])).rows[0].id;
    await fiscal.salvarEmitente(ctx.db, A, { ...EMIT, ambiente: 'producao', csc: 'CSC-PRODUCAO-123456' }, { env: ENV_PROD }); // matriz em produção
    await fiscal.salvarEmitente(ctx.db, A, { ...EMIT, cnpj: '50073355000340', lojaId: loja }, { env: ENV_PROD }); // unidade em homologação
    await fiscal.salvarEmitente(ctx.db, C, { ...EMIT, crt: '2' }, { env: ENV });
    await fiscal.salvarEmitente(ctx.db, D, { ...EMIT, crt: '3' }, { env: ENV });
    for (const e of [A, C, D]) await fiscal.importarCertificado(ctx.db, e, { arquivoBase64: PFX, senha: SENHA }, { env: ENV });
    const p = (await ctx.db.query("INSERT INTO commerce_products (empresa_id, nome) VALUES ($1, 'Pomada') RETURNING id", [A])).rows[0].id;
    variante = (await ctx.db.query('INSERT INTO commerce_product_variants (empresa_id, product_id) VALUES ($1, $2) RETURNING id', [A, p])).rows[0].id;
    for (const e of [A, C, D]) {
      await fiscal.salvarClassificacao(ctx.db, e, { fonte: 'loja_variante', fonteId: variante, ncm: '33059000', cfop: '5102', csosn: '102', cstIcms: '00', aliquotaIcms: 17 });
      await fiscal.salvarClassificacao(ctx.db, e, { fonte: 'servico', fonteId: 'corte', tipo: 'servico', cTribNac: '060101' });
    }
  });
  after(async () => { await ctx?.fechar(); });

  async function pedido(empresa, { lojaId = null, valor = 100, pago = valor } = {}) {
    const o = (await ctx.db.query('INSERT INTO commerce_orders (empresa_id, loja_id, public_code) VALUES ($1, $2, $3) RETURNING id', [empresa, lojaId, `KC-${randomBytes(3).toString('hex')}`])).rows[0].id;
    await ctx.db.query("INSERT INTO commerce_order_items (empresa_id, order_id, variant_id, nome_snapshot, quantidade, preco_unitario) VALUES ($1, $2, $3, 'Pomada', 1, $4)", [empresa, o, variante, valor]);
    await ctx.db.query("INSERT INTO commerce_payments (empresa_id, order_id, method, amount, status) VALUES ($1, $2, 'pix', $3, 'captured')", [empresa, o, pago]);
    return o;
  }

  test('idempotência pelo emitente da venda: produção da unidade não reaproveita a nota de homologação', async () => {
    const o = await pedido(A, { lojaId: loja });
    const d1 = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV_PROD, agora });
    assert.equal(d1.ambiente, 'homologacao', 'a unidade ainda está em homologação, mesmo com a matriz em produção');
    assert.equal(d1.idempotencia, `loja_pedido:${o}:65`);
    assert.equal(d1.status, 'validado_localmente');
    // a mesma chamada de novo devolve o mesmo documento
    assert.equal((await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV_PROD, agora })).id, d1.id);
    // trocar de ambiente sem o CSC do novo ambiente é recusado
    await assert.rejects(() => fiscal.salvarEmitente(ctx.db, A, { ...EMIT, cnpj: '50073355000340', lojaId: loja, ambiente: 'producao', csc: '' }, { env: ENV_PROD }), (e) => e.code === 'CSC_DO_AMBIENTE');
    await fiscal.salvarEmitente(ctx.db, A, { ...EMIT, cnpj: '50073355000340', lojaId: loja, ambiente: 'producao', csc: 'CSC-PRODUCAO-UNIDADE' }, { env: ENV_PROD });
    assert.ok((await fiscal.vendasSemNota(ctx.db, A)).some((v) => v.origemId === o), 'nota de homologação não conta mais');
    assert.equal((await fiscal.vendasSemNota(ctx.db, A, { lojaRestrita: randomUUID() })).some((v) => v.origemId === o), false, 'usuário de outra unidade não vê a venda');
    const s = sefaz(['100']);
    const d2 = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV_PROD, transporte: s.transporte, agora });
    assert.notEqual(d2.id, d1.id);
    assert.equal(d2.ambiente, 'producao');
    assert.equal(d2.status, 'autorizado');
    assert.equal(d2.idempotencia, `loja_pedido:${o}:65:producao`);
    assert.match(s.enviados[0].url, /^https:\/\/nfce\.sefaz\.mt\.gov\.br\//);
    assert.equal((await fiscal.vendasSemNota(ctx.db, A)).some((v) => v.origemId === o), false);
    // volta a unidade para homologação (os testes seguintes da empresa A usam homologação na unidade)
    await fiscal.salvarEmitente(ctx.db, A, { ...EMIT, cnpj: '50073355000340', lojaId: loja, ambiente: 'homologacao', csc: 'CSC-HOMOLOG-UNIDADE' }, { env: ENV_PROD });
  });

  test('SEFAZ fora do ar (HTTP 500/SOAP Fault, 108, 103 sem recibo) é falha de comunicação, não rejeição', async () => {
    for (const passo of ['http500', '108', '103sem']) {
      const o = await pedido(C);
      await assert.rejects(() => fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV_TX, transporte: sefaz([passo]).transporte, agora }), (e) => e.code === 'FALHA_COMUNICACAO', passo);
      const doc = (await fiscal.listarDocumentos(ctx.db, C)).find((d) => d.origemId === o);
      assert.equal(doc.status, 'falha_comunicacao', passo);
      // reenvio do mesmo XML autoriza
      const ok = await fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV_TX, transporte: sefaz(['100']).transporte, agora });
      assert.equal(ok.id, doc.id);
      assert.equal(ok.status, 'autorizado');
    }
    // rejeição do lote (225) continua rejeição
    const o = await pedido(C);
    const rej = await fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV_TX, transporte: sefaz(['lote225']).transporte, agora });
    assert.equal(rej.status, 'rejeitado');
  });

  test('lote recebido (recibo) e ainda em processamento não vira contingência offline', async () => {
    const o = await pedido(C);
    await assert.rejects(() => fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o, contingenciaOffline: true }, { env: { ...ENV_TX, FISCAL_RET_TENTATIVAS: '2' }, transporte: sefaz(['103']).transporte, agora, esperar: semEspera }), (e) => e.code === 'FALHA_COMUNICACAO');
    const doc = (await fiscal.listarDocumentos(ctx.db, C)).find((d) => d.origemId === o);
    assert.equal(doc.status, 'falha_comunicacao');
    assert.equal(doc.tpEmis, '1', 'nada de tpEmis=9 com o lote já na SEFAZ');
  });

  test('CRT 2 destaca ICMS por CST (regime normal) e cartão sem integração leva card/tpIntegra=2', async () => {
    const o = (await ctx.db.query("INSERT INTO commerce_orders (empresa_id, public_code) VALUES ($1, 'KC-CRT2') RETURNING id", [C])).rows[0].id;
    await ctx.db.query("INSERT INTO commerce_order_items (empresa_id, order_id, variant_id, nome_snapshot, quantidade, preco_unitario) VALUES ($1, $2, $3, 'Pomada', 2, 50)", [C, o, variante]);
    await ctx.db.query("INSERT INTO commerce_payments (empresa_id, order_id, method, amount, status) VALUES ($1, $2, 'credit_card', 100, 'captured')", [C, o]);
    const d = await fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV, agora });
    const xml = (await fiscal.obterDocumento(ctx.db, C, d.id, { comXml: true })).xmlAssinado;
    assert.match(xml, /<CRT>2<\/CRT>/);
    assert.match(xml, /<ICMS00><orig>0<\/orig><CST>00<\/CST><modBC>3<\/modBC><vBC>100.00<\/vBC><pICMS>17.00<\/pICMS><vICMS>17.00<\/vICMS><\/ICMS00>/);
    assert.doesNotMatch(xml, /CSOSN/);
    assert.match(xml, /<detPag><tPag>03<\/tPag><vPag>100.00<\/vPag><card><tpIntegra>2<\/tpIntegra><\/card><\/detPag>/);
  });

  test('pagamento menor que a nota não é inventado', async () => {
    const o = await pedido(C, { valor: 100, pago: 60 });
    await assert.rejects(() => fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV, agora }), (e) => e.code === 'PAGAMENTO_INSUFICIENTE');
    assert.equal((await fiscal.listarDocumentos(ctx.db, C)).some((d) => d.origemId === o), false, 'nada gravado, nenhum número gasto');
  });

  test('comanda da barbearia: subtotal, item coberto pelo plano fora, item da loja pela variante e id canônico', async () => {
    const id = `cmd-${randomBytes(3).toString('hex')}`;
    jsonDb().barbearias = { ...(jsonDb().barbearias || {}), [A]: { comandas: { [id]: {
      id, codigoVisual: 'B-77', status: 'paga', lojaId: 'dino-web-estoque', // id legado: não pode quebrar o cast para uuid
      clienteNome: 'Ana', desconto: 10,
      itens: [
        { tipo: 'servico', servicoId: 'corte', nome: 'Corte', quantidade: 1, precoUnitario: 60, subtotal: 60 },
        { tipo: 'servico', servicoId: 'barba', nome: 'Barba (plano)', quantidade: 1, precoUnitario: 40, subtotal: 0, coberturaPlano: { assinaturaId: 'x', verificadoPeloServidor: true } },
        { tipo: 'loja', lojaVarianteId: variante, nome: 'Pomada', quantidade: 2, precoUnitario: 20, subtotal: 40 },
      ],
      pagamentos: [{ meio: 'pix', valor: 90 }],
    } } } };
    jsonDb().barbearias[A].produtos = { 'p-gel': { id: 'p-gel', nome: 'Gel', categoria: 'Finalizadores', ncm: '3305.90.00' }, 'p-off': { id: 'p-off', nome: 'Inativo', ativo: false } };
    jsonDb().barbearias[A].servicos = { corte: { id: 'corte', nome: 'Corte' }, sobrancelha: { id: 'sobrancelha', nome: 'Sobrancelha' } };
    const classificaveis = await fiscal.listarClassificaveis(ctx.db, A);
    const gel = classificaveis.find((c) => c.fonte === 'est_item' && c.fonteId === 'p-gel');
    assert.equal(gel.grupo, 'Barbearia · Finalizadores');
    assert.equal(gel.ncmSugerido, '33059000');
    assert.equal(classificaveis.some((c) => c.fonteId === 'p-off'), false);
    assert.equal(classificaveis.filter((c) => c.fonte === 'servico' && c.fonteId === 'corte').length, 1, 'serviço já classificado não aparece duas vezes');
    assert.ok(classificaveis.some((c) => c.fonte === 'servico' && c.fonteId === 'sobrancelha' && c.classificacao === null));
    const outra = await fiscal.listarClassificaveis(ctx.db, C);
    assert.equal(outra.some((c) => c.fonteId === 'p-gel'), false, 'cadastro da barbearia de outra empresa nunca aparece');
    const lista = await fiscal.vendasSemNota(ctx.db, A);
    const venda = lista.find((v) => v.origem === 'barbearia_comanda' && v.origemId === id);
    assert.ok(venda, 'comanda com produto cobrado aparece');
    assert.equal(venda.valor, 36, 'R$ 40 de produto menos 40% do desconto de R$ 10 (o serviço coberto não entra no rateio)');
    // pedida pelo código visual, a nota grava o id canônico da comanda
    const tx = sefaz(['100']).transporte;
    const d = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'barbearia_comanda', origemId: 'B-77' }, { env: ENV_PROD, transporte: tx, agora });
    assert.equal(d.status, 'autorizado');
    assert.equal(d.origemId, id);
    assert.equal(d.idempotencia, `barbearia_comanda:${id}:65:producao`);
    assert.equal(d.valorTotal, 36);
    assert.equal(d.dados.itens.length, 1);
    assert.equal(d.dados.itens[0].fonte, 'loja_variante');
    assert.equal(d.dados.itens[0].fonteId, variante);
    // pedir de novo pelo id devolve a mesma nota
    assert.equal((await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'barbearia_comanda', origemId: id }, { env: ENV_PROD, transporte: tx, agora })).id, d.id);
    assert.equal((await fiscal.vendasSemNota(ctx.db, A)).some((v) => v.origemId === id), false);
    // NFS-e leva só o serviço cobrado (o coberto pelo plano fica fora), com a parte do desconto
    const n = await fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'barbearia_comanda', origemId: id }, { env: ENV_PROD, agora, transporte: async ({ url }) => (url.endsWith('/nfse') ? { status: 201, corpo: { chaveAcesso: '5'.repeat(50), alertas: [] } } : { status: 404, corpo: {} }) });
    assert.equal(n.valorTotal, 54);
    assert.equal(n.dados.itens.length, 1);
  });

  test('numeração: inclui série padrão, só avança, exclui série sem uso e é usada na emissão', async () => {
    const emit = (await fiscal.listarEmitentes(ctx.db, D))[0];
    await assert.rejects(() => fiscal.salvarNumeracao(ctx.db, D, { emitenteId: emit.id, modelo: '65', serie: 900, ambiente: 'homologacao' }), (e) => e.code === 'VALIDATION_ERROR');
    const n = await fiscal.salvarNumeracao(ctx.db, D, { emitenteId: emit.id, modelo: '65', serie: 3, ambiente: 'homologacao', proximo: 1500, padrao: true }, { usuario: 'ana' });
    assert.deepEqual([n.serie, n.proximo, n.padrao, n.atualizadoPor], [3, 1500, true, 'ana']);
    const o = await pedido(D);
    const d = await fiscal.emitir(ctx.db, D, { modelo: '65', origem: 'loja_pedido', origemId: o }, { env: ENV, agora });
    assert.equal(d.serie, 3);
    assert.equal(d.numero, 1500);
    await assert.rejects(() => fiscal.salvarNumeracao(ctx.db, D, { emitenteId: emit.id, modelo: '65', serie: 3, ambiente: 'homologacao', proximo: 1200 }), (e) => e.code === 'NUMERACAO_RETROCEDE');
    await assert.rejects(() => fiscal.excluirNumeracao(ctx.db, D, { emitenteId: emit.id, modelo: '65', serie: 3, ambiente: 'homologacao' }), (e) => e.code === 'SERIE_EM_USO');
    await fiscal.salvarNumeracao(ctx.db, D, { emitenteId: emit.id, modelo: '65', serie: 4, ambiente: 'homologacao', padrao: true });
    const lista = await fiscal.listarNumeracao(ctx.db, D);
    assert.deepEqual(lista.filter((l) => l.padrao).map((l) => l.serie), [4], 'uma série padrão por modelo/ambiente');
    assert.equal(lista.find((l) => l.serie === 3).ultimoUsado, 1500);
    assert.equal((await fiscal.excluirNumeracao(ctx.db, D, { emitenteId: emit.id, modelo: '65', serie: 4, ambiente: 'homologacao' })).ok, true);
    assert.equal((await fiscal.listarNumeracao(ctx.db, D)).some((l) => l.serie === 4), false);
  });

  test('NFS-e: DPS "já existente" no primeiro envio não recupera a nota de outra venda; troca de número', async () => {
    let consultas = 0;
    let emitidas = 0;
    const sefin = async ({ url }) => {
      if (/\/dps\//.test(url)) { consultas += 1; return { status: 200, corpo: { chaveAcesso: '9'.repeat(50) } }; }
      emitidas += 1;
      if (emitidas === 1) return { status: 400, corpo: { erros: [{ codigo: 'E0014', descricao: 'DPS já existe para este número' }] } };
      return { status: 201, corpo: { chaveAcesso: '5'.repeat(50), alertas: [] } };
    };
    const itens = [{ fonte: 'servico', fonteId: 'corte', descricao: 'Corte', quantidade: 1, valorUnitario: 50 }];
    const rej = await fiscal.emitir(ctx.db, D, { modelo: 'nfse', origem: 'manual', idempotencia: 'nfse-dup', itens }, { env: ENV_TX, transporte: sefin, agora });
    assert.equal(rej.status, 'rejeitado');
    assert.equal(consultas, 0, 'não consulta (nem "recupera") a DPS de outra emissão');
    assert.ok(rej.mensagens.some((m) => m.codigo === 'NUMERO_EM_USO'));
    const ok = await fiscal.emitir(ctx.db, D, { modelo: 'nfse', origem: 'manual', idempotencia: 'nfse-dup', itens }, { env: ENV_TX, transporte: sefin, agora });
    assert.equal(ok.id, rej.id);
    assert.equal(ok.status, 'autorizado');
    assert.equal(ok.chave, '5'.repeat(50));
    assert.ok(ok.numero > rej.numero);
  });

  test('NF-e interestadual a consumidor final (regime normal): CFOP 6xxx, idDest 2 e DIFAL; depois CC-e', async () => {
    const itens = [{ fonte: 'loja_variante', fonteId: variante, descricao: 'Pomada', quantidade: 1, valorUnitario: 200 }];
    await assert.rejects(() => fiscal.emitir(ctx.db, D, { modelo: '55', origem: 'manual', idempotencia: 'nfe-sp-0', itens, destinatario: DEST_SP, consumidorFinal: true }, { env: ENV, agora }), (e) => e.code === 'PENDENCIAS_FISCAIS' && /DIFAL/.test(e.message));
    const s = sefaz(['100']);
    const d = await fiscal.emitir(ctx.db, D, { modelo: '55', origem: 'manual', idempotencia: 'nfe-sp-1', itens, destinatario: DEST_SP, consumidorFinal: true, difal: { aliquotaInternaDestino: 18, fcpDestino: 2 } }, { env: ENV_TX, transporte: s.transporte, agora });
    assert.equal(d.status, 'autorizado');
    const xml = s.enviados[0].xml;
    assert.match(xml, /<idDest>2<\/idDest>/);
    assert.match(xml, /<indFinal>1<\/indFinal>/);
    assert.match(xml, /<CFOP>6102<\/CFOP>/);
    assert.match(xml, /<indIEDest>9<\/indIEDest>/);
    // 18% − 12% (MT → SP) sobre 200 = 12,00; FCP 2% = 4,00
    assert.match(xml, /<ICMSUFDest><vBCUFDest>200.00<\/vBCUFDest><vBCFCPUFDest>200.00<\/vBCFCPUFDest><pFCPUFDest>2.0000<\/pFCPUFDest><pICMSUFDest>18.0000<\/pICMSUFDest><pICMSInter>12.00<\/pICMSInter><pICMSInterPart>100.0000<\/pICMSInterPart><vFCPUFDest>4.00<\/vFCPUFDest><vICMSUFDest>12.00<\/vICMSUFDest><vICMSUFRemet>0.00<\/vICMSUFRemet><\/ICMSUFDest>/);
    assert.match(xml, /<vFCPUFDest>4.00<\/vFCPUFDest><vICMSUFDest>12.00<\/vICMSUFDest><vICMSUFRemet>0.00<\/vICMSUFRemet>/);
    // IBS/CBS (regime normal, NT 2025.002): base = 200 − ICMS 34 − DIFAL 12 − FCP destino 4 = 150; IBS UF 0,1% e CBS 0,9%
    assert.match(xml, /<IBSCBS><CST>000<\/CST><cClassTrib>000001<\/cClassTrib><gIBSCBS><vBC>150.00<\/vBC><gIBSUF><pIBSUF>0.1000<\/pIBSUF><vIBSUF>0.15<\/vIBSUF><\/gIBSUF><gIBSMun><pIBSMun>0<\/pIBSMun><vIBSMun>0<\/vIBSMun><\/gIBSMun><vIBS>0.15<\/vIBS><gCBS><pCBS>0.9000<\/pCBS><vCBS>1.35<\/vCBS><\/gCBS><\/gIBSCBS><\/IBSCBS>/);
    assert.match(xml, /<\/ICMSTot><IBSCBSTot><vBCIBSCBS>150.00<\/vBCIBSCBS><gIBS><gIBSUF><vDif>0<\/vDif><vDevTrib>0<\/vDevTrib><vIBSUF>0.15<\/vIBSUF><\/gIBSUF>/);
    assert.match(xml, /<vNF>200.00<\/vNF>/, 'em 2026 o IBS/CBS não entra no total da nota');
    // carta de correção
    await assert.rejects(() => fiscal.cartaCorrecao(ctx.db, D, d.id, { texto: 'curto', env: ENV_TX, transporte: s.transporte }), (e) => e.code === 'VALIDATION_ERROR');
    const cce = await fiscal.cartaCorrecao(ctx.db, D, d.id, { texto: 'Correção do complemento do endereço: apto 52', env: ENV_TX, transporte: s.transporte, agora });
    assert.equal(cce.sequencia, 1);
    assert.equal(cce.protocolo, '151260000000888');
    const evXml = s.enviados.at(-1).xml;
    assert.match(evXml, /<tpEvento>110110<\/tpEvento><nSeqEvento>1<\/nSeqEvento>/);
    assert.match(evXml, /<xCorrecao>Correcao do complemento do endereco: apto 52<\/xCorrecao>/);
    assert.equal((await fiscal.cartaCorrecao(ctx.db, D, d.id, { texto: 'Correção do complemento do endereço: apto 53', env: ENV_TX, transporte: s.transporte, agora })).sequencia, 2);
    const nfce = (await fiscal.listarDocumentos(ctx.db, D, { modelo: '65' }))[0];
    await assert.rejects(() => fiscal.cartaCorrecao(ctx.db, D, nfce.id, { texto: 'Correção qualquer de teste aqui', env: ENV_TX, transporte: s.transporte }), (e) => e.code === 'CCE_SO_NFE');
  });

  test('IBS/CBS: classificação com CST e cClassTrib; CST 410 sai sem valores; Simples não leva o grupo', async () => {
    await assert.rejects(() => fiscal.salvarClassificacao(ctx.db, D, { fonte: 'est_item', fonteId: 'imune', ncm: '49019900', cfop: '5102', cstIcms: '41', cstIbsCbs: '410' }), (e) => /juntos/.test(e.message));
    await assert.rejects(() => fiscal.salvarClassificacao(ctx.db, D, { fonte: 'est_item', fonteId: 'imune', ncm: '49019900', cfop: '5102', cstIcms: '41', cstIbsCbs: '410', cClassTrib: '000001' }), (e) => /não é do CST/.test(e.message));
    await assert.rejects(() => fiscal.salvarClassificacao(ctx.db, D, { fonte: 'est_item', fonteId: 'imune', ncm: '49019900', cfop: '5102', cstIcms: '41', cstIbsCbs: '200', cClassTrib: '200001' }), (e) => /não suportado/.test(e.message));
    const c = await fiscal.salvarClassificacao(ctx.db, D, { fonte: 'est_item', fonteId: 'imune', ncm: '49019900', cfop: '5102', cstIcms: '41', cstIbsCbs: '410', cClassTrib: '410001' });
    assert.deepEqual([c.cstIbsCbs, c.cClassTrib], ['410', '410001']);
    const s = sefaz(['100']);
    const d = await fiscal.emitir(ctx.db, D, { modelo: '65', origem: 'manual', idempotencia: 'ibscbs-410', itens: [{ fonte: 'est_item', fonteId: 'imune', descricao: 'Livro', quantidade: 1, valorUnitario: 50 }] }, { env: ENV_TX, transporte: s.transporte, agora });
    assert.equal(d.status, 'autorizado');
    assert.match(s.enviados[0].xml, /<IBSCBS><CST>410<\/CST><cClassTrib>410001<\/cClassTrib><\/IBSCBS>/);
    // Simples Nacional (empresa A): sem grupo IBS/CBS
    const sA = sefaz(['100']);
    const oA = await pedido(A);
    await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'loja_pedido', origemId: oA }, { env: { ...ENV_PROD }, transporte: sA.transporte, agora });
    assert.doesNotMatch(sA.enviados[0].xml, /IBSCBS/);
    // alíquotas de teste trocáveis por variável
    assert.deepEqual(fiscal.aliquotasIbsCbs({ FISCAL_IBSCBS_ALIQUOTAS: '{"cbs":8.8,"ibsUf":10.2,"ibsMun":7.5}' }), { cbs: 8.8, ibsUf: 10.2, ibsMun: 7.5 });
    assert.deepEqual(fiscal.aliquotasIbsCbs({ FISCAL_IBSCBS_ALIQUOTAS: 'lixo' }), { cbs: 0.9, ibsUf: 0.1, ibsMun: 0 });
  });

  test('NF-e sem resposta vai para a SVC-RS (tpEmis 7) e é autorizada lá', async () => {
    const itens = [{ fonte: 'loja_variante', fonteId: variante, descricao: 'Pomada', quantidade: 1, valorUnitario: 80 }];
    const dest = { ...DEST_SP, endereco: { ...DEST_SP.endereco, uf: 'MT', cidade: 'Tangara da Serra', codigoMunicipio: '5107958', cep: '78300000' } };
    await assert.rejects(() => fiscal.emitir(ctx.db, D, { modelo: '55', origem: 'manual', idempotencia: 'nfe-svc', itens, destinatario: dest }, { env: ENV_TX, transporte: sefaz(['http500']).transporte, agora }), (e) => e.code === 'FALHA_COMUNICACAO');
    const doc = (await fiscal.listarDocumentos(ctx.db, D, { modelo: '55' })).find((x) => x.idempotencia === 'nfe-svc');
    const s = sefaz(['100']);
    const r = await fiscal.emitirEmSvc(ctx.db, D, doc.id, { env: ENV_TX, transporte: s.transporte, agora });
    assert.equal(r.status, 'autorizado');
    assert.equal(r.tpEmis, '7');
    assert.match(s.enviados[0].url, /svrs\.rs\.gov\.br/);
    assert.match(s.enviados[0].xml, /<tpEmis>7<\/tpEmis>/);
    assert.match(s.enviados[0].xml, /<dhCont>/);
  });

  test('contingências: cada documento é transmitido no ambiente dele', async () => {
    const o = await pedido(C);
    const cont = await fiscal.emitir(ctx.db, C, { modelo: '65', origem: 'loja_pedido', origemId: o, contingenciaOffline: true }, { env: ENV_TX, transporte: sefaz(['http500']).transporte, agora });
    assert.equal(cont.status, 'contingencia');
    // sem transmissão de homologação ligada: fica pendente
    const parado = await fiscal.transmitirContingencias(ctx.db, C, { env: ENV, transporte: sefaz(['100']).transporte, agora });
    assert.equal(parado.autorizadas, 0);
    assert.ok(parado.pendentes >= 1);
    const r = await fiscal.transmitirContingencias(ctx.db, C, { env: ENV_TX, transporte: sefaz(['100']).transporte, agora });
    assert.equal(r.autorizadas, 1);
    assert.equal((await fiscal.obterDocumento(ctx.db, C, cont.id)).status, 'autorizado');
  });
});
