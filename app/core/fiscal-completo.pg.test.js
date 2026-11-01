// Fiscal completo (migração 100) — SÓ HOMOLOGAÇÃO: inutilização de numeração, contingência
// offline da NFC-e, DANFE em HTML, tributos aproximados do IBPT e classificação de est_itens.
// Nenhum teste sai da máquina: a SEFAZ é sempre um transporte falso.
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto, { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';
import { lerCertificadoPfx } from './nfse-nacional.js';
import * as fiscal from '../modules/fiscal/servico.js';
import * as sefaz from '../modules/fiscal/sefaz.js';
import { lerCsvIbpt } from '../modules/fiscal/ibpt.js';
import { createFiscalAdminRouter } from '../modules/fiscal/rotas.js';
import { validarXmlFiscal, conteudoQrCodeOfflineV3 } from '../fiscal-xml-kytto.js';
import * as bar from '../modules/bar/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');
const STUBS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(255), ativa BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE est_itens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, sku VARCHAR(60), nome VARCHAR(180) NOT NULL, unidade VARCHAR(10) NOT NULL DEFAULT 'UN',
  tipo VARCHAR(20) NOT NULL DEFAULT 'mercadoria', categoria VARCHAR(80), ncm VARCHAR(8), ativo BOOLEAN NOT NULL DEFAULT true);`;

const ENV = { FISCAL_CERT_MASTER_KEY: randomBytes(32).toString('hex') };
const ENV_TX = { ...ENV, FISCAL_TRANSMITIR_HOMOLOGACAO: '1' };
const SENHA = 'senha-teste';
const PFX = pfxDeTeste(SENHA);
const CERT_PEM = lerCertificadoPfx(PFX, SENHA).certPem;
const EMITENTE = {
  cnpj: '50073355000260', razaoSocial: 'TANGARA TENIS CLUBE', nomeFantasia: 'TTC', ie: '131234567', im: '12345', crt: '1', uf: 'MT', codigoMunicipio: '5107958',
  endereco: { logradouro: 'Rua das Palmeiras', numero: '100', bairro: 'Centro', cidade: 'Tangará da Serra', cep: '78300000' }, cscId: '000001', csc: 'CSC-HOMOLOGACAO-123456',
};
const DEST = { cnpj: '11222333000181', nome: 'Cliente Empresa', endereco: { logradouro: 'Av. Brasil', numero: '10', bairro: 'Centro', cidade: 'Tangará da Serra', uf: 'MT', codigoMunicipio: '5107958', cep: '78300000' }, indIEDest: '9' };
const CSV_IBPT = [
  'codigo;ex;tipo;descricao;nacionalfederal;importadosfederal;estadual;municipal;vigenciainicio;vigenciafim;chave;versao;fonte',
  '22030000;;0;"Cervejas de malte; inclusive chope";10.00;15.00;17.00;0.00;01/10/2026;31/12/2099;A1B2C3;26.2.A;IBPT/empresometro.com.br',
  '19059090;;0;Outros produtos de padaria;8.00;12.00;12.00;0.00;01/10/2026;31/12/2099;A1B2C3;26.2.A;IBPT/empresometro.com.br',
  '1401;;2;Servicos de manutencao;13.45;13.45;0.00;2.00;01/10/2026;31/12/2099;A1B2C3;26.2.A;IBPT/empresometro.com.br',
  'xx;;9;linha quebrada;1;1;1;1;;;;;',
].join('\r\n');

// SEFAZ de homologação falsa (o teste nunca sai da máquina)
const autorizada = (xml, cStat = '100') => {
  const chave = (xml.match(/Id="NFe(\d{44})"/) || [])[1];
  return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><nProt>151260000000123</nProt><cStat>${cStat}</cStat><xMotivo>${cStat === '100' ? 'Autorizado o uso da NF-e' : 'Rejeicao'}</xMotivo></infProt></protNFe></retEnviNFe>` };
};
const consultaAutorizada = (xml) => {
  const ch = (xml.match(/<chNFe>(\d{44})<\/chNFe>/) || [])[1];
  return { status: 200, corpo: `<retConsSitNFe><cStat>100</cStat><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${ch}</chNFe><nProt>151260000000777</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></retConsSitNFe>` };
};
const retInut = (cStat) => ({ status: 200, corpo: `<soap:Envelope><soap:Body><nfeResultMsg><retInutNFe versao="4.00"><infInut><tpAmb>2</tpAmb><cStat>${cStat}</cStat><xMotivo>${cStat === '102' ? 'Inutilizacao de numero homologado' : 'Rejeicao'}</xMotivo>${cStat === '102' ? '<nProt>151260000000555</nProt>' : ''}</infInut></retInutNFe></nfeResultMsg></soap:Body></soap:Envelope>` });
const quebra = async () => { throw Object.assign(new Error('Tempo esgotado na comunicação com a SEFAZ.'), { code: 'SEFAZ_TIMEOUT' }); };

describe('Fiscal completo — homologação (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx; let lojaA;
  const A = randomUUID(); const B = randomUUID();
  const agora = new Date();
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '092_fiscal_multiempresa.sql', '100_fiscal_completo.sql', '106_fiscal_producao.sql']) await ctx.db.query(sql(m));
    // a 100 é idempotente (o runner pode reaplicar)
    await ctx.db.query(sql('100_fiscal_completo.sql'));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    lojaA = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Sede') RETURNING id", [A])).rows[0].id;
    for (const empresa of [A, B]) {
      await fiscal.salvarEmitente(ctx.db, empresa, EMITENTE, { env: ENV });
      await fiscal.importarCertificado(ctx.db, empresa, { arquivoBase64: PFX, senha: SENHA }, { env: ENV });
    }
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'categoria', fonteId: 'bar:Bebidas', ncm: '22030000', cfop: '5405', csosn: '102' });
    await fiscal.salvarClassificacao(ctx.db, B, { fonte: 'categoria', fonteId: 'bar:Bebidas', ncm: '22030000', cfop: '5405', csosn: '102' });
  });
  after(async () => { await ctx?.fechar(); });

  async function comandaPaga(empresa, nome) {
    const cerveja = (await bar.listarProdutos(ctx.db, empresa)).find((p) => p.nome === 'Cerveja lata') || await bar.salvarProduto(ctx.db, empresa, { nome: 'Cerveja lata', categoria: 'Bebidas', setor: 'bar', preco: 8, estoqueAtual: 1000 });
    const c = await bar.abrirComanda(ctx.db, empresa, { nome });
    await bar.adicionarItens(ctx.db, empresa, c.id, [{ produtoId: cerveja.id, qtd: 3 }]);
    await bar.pagarComanda(ctx.db, empresa, c.id, { meio: 'pix', servico: false });
    return c.id;
  }
  const xmlDe = async (empresa, id) => (await fiscal.obterDocumento(ctx.db, empresa, id, { comXml: true })).xmlAssinado;

  test('classificação: itens do estoque único entram com o NCM do cadastro como sugestão, só da própria empresa', async () => {
    const itemA = (await ctx.db.query("INSERT INTO est_itens (empresa_id, nome, sku, categoria, ncm) VALUES ($1, 'Pão de queijo congelado', 'PQ-1', 'Padaria', '19059090') RETURNING id", [A])).rows[0].id;
    await ctx.db.query("INSERT INTO est_itens (empresa_id, nome, categoria, ncm, tipo) VALUES ($1, 'Farinha (insumo)', 'Insumos', '11010010', 'insumo')", [A]);
    await ctx.db.query("INSERT INTO est_itens (empresa_id, nome, ncm) VALUES ($1, 'Item da empresa B', '22030000')", [B]);
    const lista = await fiscal.listarClassificaveis(ctx.db, A);
    const est = lista.filter((i) => i.fonte === 'est_item');
    assert.equal(est.length, 1, 'só mercadoria da empresa A');
    assert.equal(est[0].fonteId, itemA);
    assert.equal(est[0].ncmSugerido, '19059090');
    assert.equal(est[0].grupo, 'Estoque · Padaria');
    assert.equal(est[0].classificacao, null);
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'est_item', fonteId: itemA, ncm: '19059090', cfop: '5102', csosn: '102' });
    const depois = (await fiscal.listarClassificaveis(ctx.db, A)).find((i) => i.fonte === 'est_item');
    assert.equal(depois.classificacao.ncm, '19059090');
    assert.equal((await fiscal.listarClassificaveis(ctx.db, B)).filter((i) => i.fonte === 'est_item').length, 1);
    // NF-e 55 manual com item do estoque usa a classificação dele
    const nfe = await fiscal.emitir(ctx.db, A, { modelo: '55', origem: 'manual', idempotencia: 'est-1', itens: [{ fonte: 'est_item', fonteId: itemA, descricao: 'Pão de queijo congelado', quantidade: 2, valorUnitario: 15 }], destinatario: DEST }, { env: ENV, agora });
    assert.equal(nfe.status, 'validado_localmente');
    assert.match(await xmlDe(A, nfe.id), /<NCM>19059090<\/NCM>/);
  });

  test('IBPT: lê o CSV oficial (aspas, Latin-1, linhas ruins) e a tabela é por empresa/UF', async () => {
    assert.throws(() => lerCsvIbpt('codigo;descricao\n123;x'), (e) => e.code === 'VALIDATION_ERROR' && /faltam as colunas/.test(e.message));
    const lido = lerCsvIbpt(Buffer.from(CSV_IBPT.replace('Servicos de manutencao', 'Serviços de manutenção'), 'latin1'));
    assert.equal(lido.linhas.length, 3);
    assert.equal(lido.ignoradas, 1);
    assert.equal(lido.linhas[0].descricao, 'Cervejas de malte; inclusive chope');
    assert.equal(lido.linhas[2].descricao, 'Serviços de manutenção');
    assert.equal(lido.linhas[0].vigenciaFim, '2099-12-31');
    // antes de importar: emissão sem vTotTrib (comportamento anterior)
    const c0 = await comandaPaga(A, 'Mesa IBPT 0');
    const sem = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c0 }, { env: ENV, agora });
    assert.doesNotMatch(await xmlDe(A, sem.id), /vTotTrib/);
    assert.equal(sem.dados.tributos, undefined);
    const imp = await fiscal.importarIbpt(ctx.db, A, { arquivo: CSV_IBPT }); // UF do emitente
    assert.deepEqual({ uf: imp.uf, importadas: imp.importadas, ignoradas: imp.ignoradas, versao: imp.versao }, { uf: 'MT', importadas: 3, ignoradas: 1, versao: '26.2.A' });
    // B importa outra tabela (alíquotas diferentes) — não pode vazar para A
    await fiscal.importarIbpt(ctx.db, B, { uf: 'MT', arquivo: CSV_IBPT.replace('10.00;15.00;17.00', '50.00;50.00;50.00') });
    assert.equal((await fiscal.listarIbpt(ctx.db, A))[0].linhas, 3);
    // reimportar troca a tabela da UF inteira
    await fiscal.importarIbpt(ctx.db, A, { uf: 'MT', arquivo: CSV_IBPT.split('\r\n').slice(0, 3).join('\n') });
    assert.equal((await fiscal.listarIbpt(ctx.db, A))[0].linhas, 2);
    await assert.rejects(() => fiscal.importarIbpt(ctx.db, A, { uf: 'XX', arquivo: CSV_IBPT }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('IBPT: NFC-e com vTotTrib por item e total (passa no schema) e DANFE com "Tributos aproximados"', async () => {
    const c = await comandaPaga(A, 'Mesa IBPT 1');
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV, agora });
    assert.equal(doc.status, 'validado_localmente');
    assert.ok(!doc.mensagens.some((m) => m.codigo === 'XSD_INDISPONIVEL'), 'XML com vTotTrib passou no XSD oficial');
    const xml = await xmlDe(A, doc.id);
    // 24,00 × (10 + 17 + 0)% = 6,48 (alíquotas da empresa A, não as de B)
    assert.equal((xml.match(/<vTotTrib>6\.48<\/vTotTrib>/g) || []).length, 2);
    assert.match(xml, /<\/vNF><vTotTrib>6\.48<\/vTotTrib><\/ICMSTot>/);
    assert.equal(doc.dados.tributos.total, 6.48);
    assert.equal(doc.dados.tributos.federal, 2.4);
    const html = await fiscal.danfe(ctx.db, A, doc.id);
    assert.match(html, /Tributos aproximados: R\$ 6,48 \(Fonte: IBPT\)/);
  });

  test('DANFE NFC-e: cupom 80 mm com QR Code, chave formatada, itens, totais e aviso de homologação', async () => {
    const c = await comandaPaga(A, 'Mesa DANFE');
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: async (r) => autorizada(r.xml), agora });
    assert.equal(doc.status, 'autorizado');
    const html = await fiscal.danfe(ctx.db, A, doc.id);
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /size:80mm/);
    assert.match(html, /EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL/);
    assert.match(html, /<svg[^>]*>/, 'QR Code em SVG');
    assert.ok(html.includes(doc.chave.match(/.{4}/g).join(' ')), 'chave em grupos de 4');
    assert.match(html, /Cerveja lata/, 'descrição original do item (não o texto de homologação do XML)');
    assert.match(html, /Valor a pagar R\$<\/td><td class="r b">24,00/);
    assert.match(html, /PIX/);
    assert.match(html, /Protocolo de autorização: 151260000000123/);
    assert.match(html, /CONSUMIDOR NÃO IDENTIFICADO/);
    assert.doesNotMatch(html, /NÃO AUTORIZADO/);
    // nada de script e todo texto escapado
    const esc = await fiscal.emitir(ctx.db, A, { modelo: '55', origem: 'manual', idempotencia: 'xss-1', destinatario: { ...DEST, nome: '<script>alert(1)</script>' }, itens: [{ fonte: 'est_item', fonteId: (await ctx.db.query('SELECT id FROM est_itens WHERE empresa_id = $1 AND ncm = $2', [A, '19059090'])).rows[0].id, descricao: 'Pão <b>doce</b>', quantidade: 1, valorUnitario: 10 }] }, { env: ENV, agora });
    const a4 = await fiscal.danfe(ctx.db, A, esc.id);
    assert.doesNotMatch(a4, /<script|<b>doce/);
    assert.match(a4, /Pão &lt;b&gt;doce&lt;\/b&gt;/);
    assert.match(a4, /size:A4/);
    assert.match(a4, /DANFE/);
    assert.match(a4, /19059090/);
    assert.match(a4, /DOCUMENTO NÃO AUTORIZADO PELA SEFAZ/);
    assert.match(a4, /EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL/);
    // isolamento e NFS-e
    await assert.rejects(() => fiscal.danfe(ctx.db, B, doc.id), (e) => e.status === 404);
    await assert.rejects(() => fiscal.danfe(ctx.db, A, doc.id, { lojaRestrita: randomUUID() }), (e) => e.status === 404);
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'servico', fonteId: 'aula', tipo: 'servico', cTribNac: '060101' });
    const nfse = await fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'manual', idempotencia: 'nfse-danfe', itens: [{ fonte: 'servico', fonteId: 'aula', descricao: 'Aula', quantidade: 1, valorUnitario: 50 }] }, { env: ENV, agora });
    await assert.rejects(() => fiscal.danfe(ctx.db, A, nfse.id), (e) => e.code === 'DANFE_INDISPONIVEL');
  });

  test('inutilização: validações, faixa só da série do emitente, bloqueio de reuso e "validado localmente" sem transmissão', async () => {
    // série 1 da NFC-e já existe (notas acima); próxima livre é a seguinte
    const prox = Number((await ctx.db.query("SELECT proximo FROM fis_numeracao n JOIN fis_emitentes e ON e.id = n.emitente_id WHERE n.empresa_id = $1 AND n.modelo = '65' AND n.serie = 1", [A])).rows[0].proximo);
    const base = { modelo: '65', serie: 1, justificativa: 'Falha no sistema pulou a numeração do caixa' };
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: prox + 2, numeroFinal: prox + 4, justificativa: 'curta' }, { env: ENV, agora }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 5, numeroFinal: 2 }, { env: ENV, agora }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, modelo: 'nfse', numeroInicial: 1 }, { env: ENV, agora }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, serie: 7, numeroInicial: 1 }, { env: ENV, agora }), (e) => e.code === 'SERIE_INEXISTENTE');
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 1, numeroFinal: prox + 1 }, { env: ENV, agora }), (e) => e.code === 'NUMERO_EM_USO');
    const inut = await fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: prox + 1, numeroFinal: prox + 3 }, { env: ENV, agora, usuario: 'gestor' });
    assert.equal(inut.status, 'validado_localmente');
    assert.equal(inut.ambiente, 'homologacao');
    assert.ok(inut.mensagens.some((m) => m.codigo === 'NAO_TRANSMITIDO'));
    const row = (await ctx.db.query('SELECT * FROM fis_inutilizacoes WHERE id = $1', [inut.id])).rows[0];
    assert.equal(row.id_inut.length, 43);
    assert.equal(row.id_inut, `ID51${row.ano}5007335500026065001${String(prox + 1).padStart(9, '0')}${String(prox + 3).padStart(9, '0')}`);
    assert.match(row.xml_assinado, /<inutNFe xmlns="http:\/\/www.portalfiscal.inf.br\/nfe" versao="4.00"><infInut Id="ID\d{41}"><tpAmb>2<\/tpAmb><xServ>INUTILIZAR<\/xServ><cUF>51<\/cUF>/);
    assert.match(row.xml_assinado, /<Reference URI="#ID\d{41}">/);
    assert.match(row.xml_assinado, /<\/infInut><Signature/);
    // repetir é idempotente; faixa sobreposta é recusada
    assert.equal((await fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: prox + 1, numeroFinal: prox + 3 }, { env: ENV, agora })).idempotente, true);
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: prox + 3, numeroFinal: prox + 6 }, { env: ENV, agora }), (e) => e.code === 'NUMERO_INUTILIZADO');
    // a emissão pula a faixa inutilizada
    const n1 = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: await comandaPaga(A, 'Mesa I1') }, { env: ENV, agora });
    const n2 = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: await comandaPaga(A, 'Mesa I2') }, { env: ENV, agora });
    assert.equal(n1.numero, prox);
    assert.equal(n2.numero, prox + 4, 'pulou os números inutilizados');
    // o banco só aceita homologação ou produção
    await assert.rejects(() => ctx.db.query("UPDATE fis_inutilizacoes SET ambiente = 'teste' WHERE id = $1", [inut.id]), /chk_fis_inut_ambiente/);
    // isolamento entre empresas
    assert.equal((await fiscal.listarInutilizacoes(ctx.db, B)).length, 0);
    assert.equal((await fiscal.listarInutilizacoes(ctx.db, A)).length, 1);
  });

  test('inutilização: unidade não inutiliza a série do emitente da empresa toda e só vê as da sua unidade', async () => {
    await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Filial')", [A]);
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { modelo: '65', serie: 1, numeroInicial: 900, justificativa: 'Teste de permissão por unidade' }, { env: ENV, agora, lojaRestrita: lojaA }), (e) => e.code === 'PERMISSION_DENIED');
    assert.equal((await fiscal.listarInutilizacoes(ctx.db, A, { lojaRestrita: lojaA })).length, 0);
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, B, { modelo: '55', serie: 1, numeroInicial: 1, justificativa: 'Série que B nunca usou' }, { env: ENV, agora }), (e) => e.code === 'SERIE_INEXISTENTE');
  });

  test('inutilização transmitida à SEFAZ de homologação: homologada, falha + reenvio e rejeitada libera a faixa', async () => {
    const enviados = [];
    const sefazInut = (cStat) => async (req) => { enviados.push(req); return retInut(cStat); };
    const base = { modelo: '55', serie: 1, justificativa: 'Numeração pulada por erro do operador' };
    const h = await fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 50, numeroFinal: 52 }, { env: ENV_TX, transporte: sefazInut('102'), agora });
    assert.equal(h.status, 'homologada');
    assert.equal(h.protocolo, '151260000000555');
    assert.equal(enviados[0].url, 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4');
    assert.match(enviados[0].xml, /<nfeDadosMsg xmlns="http:\/\/www.portalfiscal.inf.br\/nfe\/wsdl\/NFeInutilizacao4"><inutNFe/);
    assert.match(enviados[0].xml, /<tpAmb>2<\/tpAmb>/);
    // falha de comunicação: números continuam bloqueados; o mesmo pedido é reenviado e 256 vale como homologada
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 60, numeroFinal: 60 }, { env: ENV_TX, transporte: quebra, agora }), (e) => e.code === 'FALHA_COMUNICACAO');
    const pend = (await fiscal.listarInutilizacoes(ctx.db, A)).find((i) => i.numeroInicial === 60);
    assert.equal(pend.status, 'falha_comunicacao');
    const xmlAntes = (await ctx.db.query('SELECT xml_assinado FROM fis_inutilizacoes WHERE id = $1', [pend.id])).rows[0].xml_assinado;
    enviados.length = 0;
    const re = await fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 60, numeroFinal: 60 }, { env: ENV_TX, transporte: sefazInut('256'), agora });
    assert.equal(re.id, pend.id);
    assert.equal(re.status, 'homologada');
    assert.ok(enviados[0].xml.includes(xmlAntes.replace(/^\s*<\?xml[^>]*\?>/, '')), 'reenviou o MESMO pedido assinado');
    // 256 num primeiro envio é recusa
    const r256 = await fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 70, numeroFinal: 70 }, { env: ENV_TX, transporte: sefazInut('256'), agora });
    assert.equal(r256.status, 'rejeitada');
    // rejeitada não bloqueia: dá para pedir a mesma faixa de novo
    const de = await fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 70, numeroFinal: 70 }, { env: ENV_TX, transporte: sefazInut('102'), agora });
    assert.equal(de.status, 'homologada');
    assert.notEqual(de.id, r256.id);
    // endereço de produção sobreposto por variável de ambiente é recusado antes de gravar/enviar
    enviados.length = 0;
    const envProd = { ...ENV_TX, FISCAL_SEFAZ_URLS_HOMOLOGACAO: JSON.stringify({ MT: { 55: { inutilizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4' } } }) };
    await assert.rejects(() => fiscal.inutilizarNumeracao(ctx.db, A, { ...base, numeroInicial: 80, numeroFinal: 80 }, { env: envProd, transporte: sefazInut('102'), agora }), (e) => e.code === 'AMBIENTE_PROIBIDO');
    assert.equal(enviados.length, 0);
    assert.equal((await fiscal.listarInutilizacoes(ctx.db, A)).some((i) => i.numeroInicial === 80), false);
    // resposta de ambiente de produção não vale
    const prod = await sefaz.inutilizar({ uf: 'MT', modelo: '55', xmlAssinado: '<inutNFe/>', transporte: async () => ({ status: 200, corpo: '<retInutNFe><infInut><tpAmb>1</tpAmb><cStat>102</cStat></infInut></retInutNFe>' }), env: ENV_TX });
    assert.equal(prod.homologada, false);
  });

  test('inutilização: número de documento rejeitado pode ser inutilizado e o documento não volta a ser enviado', async () => {
    const c = await comandaPaga(A, 'Mesa Rejeitada');
    const rej = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: async (r) => autorizada(r.xml, '778'), agora });
    assert.equal(rej.status, 'rejeitado');
    await fiscal.inutilizarNumeracao(ctx.db, A, { modelo: '65', serie: 1, numeroInicial: rej.numero, justificativa: 'Nota rejeitada abandonada pelo caixa' }, { env: ENV, agora });
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: async (r) => autorizada(r.xml), agora }), (e) => e.code === 'NUMERO_INUTILIZADO');
  });

  test('contingência offline: SEFAZ sem resposta → NFC-e tpEmis 9 com dhCont, xJust e QR v3 assinado; NF-e 55 continua em falha', async () => {
    const c = await comandaPaga(A, 'Mesa Contingência');
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c, contingenciaOffline: true }, { env: ENV_TX, transporte: quebra, agora });
    assert.equal(doc.status, 'contingencia');
    assert.equal(doc.tpEmis, '9');
    assert.equal(doc.chave[34], '9', 'tpEmis na chave de acesso');
    assert.equal(doc.contingenciaAtrasada, false);
    assert.ok(doc.prazoContingencia);
    const row = (await ctx.db.query('SELECT * FROM fis_documentos WHERE id = $1', [doc.id])).rows[0];
    assert.equal(row.chave_substituida.slice(0, 34), doc.chave.slice(0, 34), 'mesmo número, chave nova');
    assert.equal(row.chave_substituida[34], '1');
    const xml = row.xml_assinado;
    assert.match(xml, /<tpEmis>9<\/tpEmis>/);
    assert.match(xml, /<dhCont>[^<]+<\/dhCont><xJust>SEFAZ sem resposta[^<]*<\/xJust><\/ide>/);
    assert.match(xml, /<tpAmb>2<\/tpAmb>/);
    const v = validarXmlFiscal(xml);
    assert.equal(v.valido, true, JSON.stringify(v.xsd?.erros || v.estrutura?.erros));
    // QR Code v3 offline: chave|3|2|dia|vNF|||assinatura (RSA-SHA1 do certificado), coerente com o XML
    const qr = xml.match(/<qrCode>([^<]+)<\/qrCode>/)[1].replace(/&amp;/g, '&');
    const partes = qr.split('?p=')[1].split('|');
    assert.deepEqual(partes.slice(0, 7), [doc.chave, '3', '2', xml.match(/<dhEmi>\d{4}-\d{2}-(\d{2})/)[1], '24.00', '', '']);
    const conteudo = conteudoQrCodeOfflineV3({ chaveAcesso: doc.chave, dataEmissao: xml.match(/<dhEmi>([^<]+)/)[1], valorTotal: 24 });
    assert.equal(partes.slice(0, 7).join('|'), conteudo);
    assert.equal(crypto.verify('RSA-SHA1', Buffer.from(conteudo), CERT_PEM, Buffer.from(partes[7], 'base64')), true, 'assinatura do QR confere com o certificado');
    // repetir a emissão devolve a mesma contingência; a venda não aceita outra nota
    assert.equal((await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: quebra, agora })).id, doc.id);
    assert.equal((await fiscal.vendasSemNota(ctx.db, A)).some((x) => x.origemId === c), false);
    await assert.rejects(() => fiscal.cancelar(ctx.db, A, doc.id, { justificativa: 'Cliente desistiu da compra', env: ENV_TX }), (e) => e.code === 'INVALID_STATUS');
    // DANFE da contingência
    assert.match(await fiscal.danfe(ctx.db, A, doc.id), /EMITIDA EM CONTINGÊNCIA/);
    // NF-e 55 não tem contingência offline: segue o fluxo de falha de comunicação
    const c55 = await comandaPaga(A, 'Mesa 55');
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '55', origem: 'bar_comanda', origemId: c55, destinatario: DEST, contingenciaOffline: true }, { env: ENV_TX, transporte: quebra, agora }), (e) => e.code === 'FALHA_COMUNICACAO');
    const f55 = (await fiscal.listarDocumentos(ctx.db, A, { status: 'falha_comunicacao', modelo: '55' }))[0];
    assert.equal(f55.tpEmis, '1');
    await assert.rejects(() => fiscal.entrarEmContingencia(ctx.db, A, f55.id, { env: ENV, agora }), (e) => e.code === 'CONTINGENCIA_SO_NFCE');
    // NFC-e sem pedir contingência fica em falha e pode ir para contingência depois (rota)
    const c2 = await comandaPaga(A, 'Mesa Contingência 2');
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c2 }, { env: ENV_TX, transporte: quebra, agora }), (e) => e.code === 'FALHA_COMUNICACAO');
    const falha = (await fiscal.listarDocumentos(ctx.db, A, { status: 'falha_comunicacao', modelo: '65' }))[0];
    await assert.rejects(() => fiscal.entrarEmContingencia(ctx.db, B, falha.id, { env: ENV, agora }), (e) => e.status === 404);
    const cont2 = await fiscal.entrarEmContingencia(ctx.db, A, falha.id, { env: ENV, agora, usuario: 'caixa' });
    assert.equal(cont2.status, 'contingencia');
    assert.equal(cont2.numero, falha.numero);
  });

  test('contingência: rotina marca as atrasadas (> 24 h) e transmite as pendentes; 539 recupera a emissão normal autorizada', async () => {
    const pendentes = await fiscal.listarContingencias(ctx.db, A);
    assert.equal(pendentes.length, 2);
    assert.equal((await fiscal.listarContingencias(ctx.db, B)).length, 0);
    const [velha, nova] = pendentes;
    await ctx.db.query("UPDATE fis_documentos SET contingencia_em = now() - interval '25 hours' WHERE id = $1", [velha.id]);
    // sem transmissão: só marca as atrasadas
    const r0 = await fiscal.transmitirContingencias(ctx.db, A, { env: ENV, agora: new Date() });
    assert.deepEqual({ t: r0.transmissao, m: r0.marcadasAtrasadas, p: r0.pendentes }, { t: 'desligada', m: 1, p: 2 });
    const marcada = await fiscal.obterDocumento(ctx.db, A, velha.id);
    assert.equal(marcada.contingenciaAtrasada, true);
    assert.ok(marcada.eventos.some((e) => e.tipo === 'contingencia_atrasada'));
    // a rotina de B não toca nas contingências de A
    const rB = await fiscal.transmitirContingencias(ctx.db, B, { env: ENV_TX, transporte: async () => { throw new Error('não devia transmitir'); }, agora: new Date() });
    assert.equal(rB.pendentes, 0);
    // com transmissão: a "velha" é autorizada com a chave de contingência; a "nova" recebe 539
    // (a emissão normal já tinha sido autorizada) e passa a valer a original
    const novaRow = (await ctx.db.query('SELECT chave, chave_substituida FROM fis_documentos WHERE id = $1', [nova.id])).rows[0];
    const urls = [];
    const sefazRotina = async ({ url, xml }) => {
      urls.push(url);
      assert.match(url, /^https:\/\/homologacao\.sefaz\.mt\.gov\.br\//);
      if (url.includes('NfeConsulta')) return consultaAutorizada(xml);
      if (xml.includes(novaRow.chave)) return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${novaRow.chave}</chNFe><cStat>539</cStat><xMotivo>Duplicidade de NF-e com diferenca na Chave de Acesso</xMotivo></infProt></protNFe></retEnviNFe>` };
      return autorizada(xml);
    };
    const r1 = await fiscal.transmitirContingencias(ctx.db, A, { env: ENV_TX, transporte: sefazRotina, agora: new Date() });
    assert.deepEqual({ a: r1.autorizadas, r: r1.rejeitadas, f: r1.falhas, p: r1.pendentes }, { a: 2, r: 0, f: 0, p: 0 });
    const v1 = await fiscal.obterDocumento(ctx.db, A, velha.id, { comXml: true });
    assert.equal(v1.status, 'autorizado');
    assert.equal(v1.chave[34], '9');
    assert.match(v1.xmlAutorizado, /<nfeProc/);
    const n1 = await fiscal.obterDocumento(ctx.db, A, nova.id, { comXml: true });
    assert.equal(n1.status, 'autorizado');
    assert.equal(n1.chave, novaRow.chave_substituida, 'vale a chave da emissão normal');
    assert.equal(n1.tpEmis, '1');
    assert.match(n1.xmlAssinado, /<tpEmis>1<\/tpEmis>/);
    assert.ok(n1.mensagens.some((m) => m.codigo === 'CONTINGENCIA_DESCARTADA'));
    // falha de comunicação na rotina: volta a "contingencia"
    const c = await comandaPaga(A, 'Mesa Contingência 3');
    const d3 = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c, contingenciaOffline: true }, { env: ENV_TX, transporte: quebra, agora: new Date() });
    const r2 = await fiscal.transmitirContingencias(ctx.db, A, { env: ENV_TX, transporte: quebra, agora: new Date() });
    assert.equal(r2.falhas, 1);
    assert.equal((await fiscal.obterDocumento(ctx.db, A, d3.id)).status, 'contingencia');
  });

  test('ambientes: CHECKs, endereços de homologação só com host de homologação', async () => {
    await assert.rejects(() => ctx.db.query("UPDATE fis_documentos SET ambiente = 'teste' WHERE empresa_id = $1", [A]), /chk_fis_doc_ambiente/);
    await assert.rejects(() => ctx.db.query("UPDATE fis_documentos SET tp_emis = '9' WHERE empresa_id = $1 AND modelo = '55'", [A]), /chk_fis_doc_tp_emis/);
    await assert.rejects(() => ctx.db.query("UPDATE fis_documentos SET status = 'autorizado_producao' WHERE empresa_id = $1", [A]), /chk_fis_doc_status/);
    for (const [uf, modelo] of [['MT', '65'], ['MT', '55'], ['SC', '65'], ['SC', '55']]) {
      assert.match(new URL(sefaz.enderecosHomologacao(uf, modelo, {}).inutilizacao).hostname, /homolog/);
    }
    const x = sefaz.montarInutilizacao({ uf: 'MT', ano: '26', cnpj: '50073355000260', modelo: '65', serie: 1, numeroInicial: 1, numeroFinal: 2, justificativa: 'Justificativa com & e < >' });
    assert.match(x.xml, /<tpAmb>2<\/tpAmb>/);
    assert.match(x.xml, /<xJust>Justificativa com &amp; e &lt; &gt;<\/xJust>/);
  });

  test('rotas: DANFE em text/html (payments.read), inutilizações e IBPT (settings.write) com escopo da empresa', async () => {
    const permissoes = [];
    const app = express();
    app.use((req, res, next) => { req.user = { nome: 'gestor' }; next(); });
    app.use('/api/admin/fiscal', createFiscalAdminRouter({ db: ctx.db, env: ENV, escopoDaRequisicao: async (req, permissao) => { permissoes.push(permissao); return { empresaId: req.headers['x-empresa'] }; } }));
    const srv = app.listen(0);
    const base = `http://127.0.0.1:${srv.address().port}/api/admin/fiscal`;
    try {
      const [doc] = await fiscal.listarDocumentos(ctx.db, A, { modelo: '65', status: 'autorizado' });
      let r = await fetch(`${base}/documentos/${doc.id}/danfe`, { headers: { 'x-empresa': A } });
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type'), /^text\/html/);
      assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
      assert.match(await r.text(), /SEM VALOR FISCAL/);
      assert.equal(permissoes.pop(), 'payments.read');
      r = await fetch(`${base}/documentos/${doc.id}/danfe`, { headers: { 'x-empresa': B } });
      assert.equal(r.status, 404);
      // IBPT como arquivo cru (fora do limite do JSON) e como JSON
      r = await fetch(`${base}/ibpt?uf=MT`, { method: 'POST', headers: { 'x-empresa': B, 'content-type': 'text/csv' }, body: Buffer.from(CSV_IBPT, 'latin1') });
      assert.equal(r.status, 201);
      assert.equal((await r.json()).importadas, 3);
      assert.equal(permissoes.pop(), 'settings.write');
      r = await fetch(`${base}/ibpt`, { method: 'POST', headers: { 'x-empresa': B, 'content-type': 'application/json' }, body: JSON.stringify({ uf: 'MT', csv: CSV_IBPT }) });
      assert.equal(r.status, 201);
      r = await fetch(`${base}/ibpt`, { headers: { 'x-empresa': B } });
      assert.equal((await r.json())[0].uf, 'MT');
      r = await fetch(`${base}/inutilizacoes`, { method: 'POST', headers: { 'x-empresa': A, 'content-type': 'application/json' }, body: JSON.stringify({ modelo: '65', serie: 1, numeroInicial: 5000, numeroFinal: 5001, justificativa: 'Faixa reservada por engano no PDV' }) });
      assert.equal(r.status, 201);
      assert.equal((await r.json()).status, 'validado_localmente');
      assert.equal(permissoes.pop(), 'settings.write');
      r = await fetch(`${base}/inutilizacoes`, { headers: { 'x-empresa': B } });
      assert.deepEqual(await r.json(), []);
      r = await fetch(`${base}/contingencias`, { headers: { 'x-empresa': A } });
      assert.equal(r.status, 200);
      r = await fetch(`${base}/contingencias/transmitir`, { method: 'POST', headers: { 'x-empresa': A, 'content-type': 'application/json' }, body: '{}' });
      assert.equal((await r.json()).transmissao, 'desligada', 'sem FISCAL_TRANSMITIR_HOMOLOGACAO nada é enviado');
    } finally { srv.close(); }
  });
});
