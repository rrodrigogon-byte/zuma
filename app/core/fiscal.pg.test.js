import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';
import * as fiscal from '../modules/fiscal/servico.js';
import { cifrar, decifrar } from '../modules/fiscal/cofre.js';
import * as bar from '../modules/bar/servico.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');
const STUBS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(255), ativa BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE commerce_products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(200) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active');
CREATE TABLE commerce_product_variants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, product_id UUID NOT NULL, sku VARCHAR(100), ativo BOOLEAN NOT NULL DEFAULT true);`;

const ENV = { FISCAL_CERT_MASTER_KEY: randomBytes(32).toString('hex') };
const ENV_TX = { ...ENV, FISCAL_TRANSMITIR_HOMOLOGACAO: '1' };
const SENHA = 'senha-teste';
const PFX = pfxDeTeste(SENHA);
const EMITENTE = {
  cnpj: '50.073.355/0002-60', razaoSocial: 'TANGARA TENIS CLUBE', nomeFantasia: 'TTC', ie: '131234567', im: '12345', crt: '1', uf: 'MT', codigoMunicipio: '5107958',
  endereco: { logradouro: 'Rua das Palmeiras', numero: '100', bairro: 'Centro', cidade: 'Tangará da Serra', cep: '78300000' }, cscId: '000001', csc: 'CSC-HOMOLOGACAO-123456', cTribNacPadrao: '060101',
};

// Respostas falsas da SEFAZ/Sefin (o teste nunca sai da máquina).
const sefazFalsa = (cStat = '100') => async ({ url, xml }) => {
  if (url.includes('RecepcaoEvento') || url.includes('recepcaoevento')) return { status: 200, corpo: `<retEnvEvento><cStat>128</cStat><retEvento versao="1.00"><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><nProt>151260000000999</nProt></infEvento></retEvento></retEnvEvento>` };
  if (url.includes('NfeConsulta')) {
    const ch = (xml.match(/<chNFe>(\d{44})<\/chNFe>/) || [])[1];
    return { status: 200, corpo: `<retConsSitNFe><tpAmb>2</tpAmb><cStat>100</cStat><xMotivo>Autorizado</xMotivo><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${ch}</chNFe><nProt>151260000000777</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></retConsSitNFe>` };
  }
  const chave = (xml.match(/Id="NFe(\d{44})"/) || [])[1];
  if (cStat === '204') return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><cStat>204</cStat><xMotivo>Duplicidade de NF-e</xMotivo></infProt></protNFe></retEnviNFe>` };
  if (cStat === 'outra') return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${'5'.repeat(44)}</chNFe><nProt>1</nProt><cStat>100</cStat><xMotivo>ok</xMotivo></infProt></protNFe></retEnviNFe>` };
  return { status: 200, corpo: `<soap:Envelope><soap:Body><nfeResultMsg><retEnviNFe><cStat>104</cStat><xMotivo>Lote processado</xMotivo><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><nProt>151260000000123</nProt><cStat>${cStat}</cStat><xMotivo>${cStat === '100' ? 'Autorizado o uso da NF-e' : 'Rejeicao: teste'}</xMotivo></infProt></protNFe></retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>` };
};

describe('Fiscal por empresa — homologação (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx; let loja;
  const A = randomUUID(); const B = randomUUID();
  const agora = new Date();
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '092_fiscal_multiempresa.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    loja = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Sede') RETURNING id", [A])).rows[0].id;
  });
  after(async () => { await ctx?.fechar(); });

  async function comandaPaga(nome = 'Mesa 1') {
    const cerveja = (await bar.listarProdutos(ctx.db, A)).find((p) => p.nome === 'Cerveja lata') || await bar.salvarProduto(ctx.db, A, { nome: 'Cerveja lata', categoria: 'Bebidas', setor: 'bar', preco: 8, estoqueAtual: 100 });
    const c = await bar.abrirComanda(ctx.db, A, { nome });
    await bar.adicionarItens(ctx.db, A, c.id, [{ produtoId: cerveja.id, qtd: 3 }]);
    await bar.pagarComanda(ctx.db, A, c.id, { meio: 'pix', servico: false });
    return c.id;
  }

  test('cofre: cifra por empresa, não abre com outra empresa e recusa sem chave mestra', () => {
    const s = cifrar('segredo', A, ENV);
    assert.doesNotMatch(s, /segredo/);
    assert.equal(decifrar(s, A, ENV), 'segredo');
    assert.throws(() => decifrar(s, B, ENV), (e) => e.code === 'COFRE_CHAVE_INVALIDA');
    assert.throws(() => cifrar('x', A, {}), (e) => e.code === 'COFRE_INDISPONIVEL');
  });

  test('emitente: só homologação, CSC guardado cifrado e nunca devolvido', async () => {
    await assert.rejects(() => fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, ambiente: 'producao' }, { env: ENV }), (e) => e.code === 'AMBIENTE_PROIBIDO');
    await assert.rejects(() => fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, codigoMunicipio: '3550308' }, { env: ENV }), (e) => e.code === 'VALIDATION_ERROR');
    const e = await fiscal.salvarEmitente(ctx.db, A, EMITENTE, { env: ENV });
    assert.equal(e.cnpj, '50073355000260');
    assert.equal(e.cscConfigurado, true);
    assert.equal(JSON.stringify(e).includes('CSC-HOMOLOGACAO'), false);
    const bruto = (await ctx.db.query('SELECT csc_cifrado FROM fis_emitentes WHERE empresa_id = $1', [A])).rows[0].csc_cifrado;
    assert.doesNotMatch(bruto, /CSC-HOMOLOGACAO/);
    // salvar de novo sem CSC mantém o atual
    await fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, csc: '' }, { env: ENV });
    assert.equal((await ctx.db.query('SELECT csc_cifrado FROM fis_emitentes WHERE empresa_id = $1', [A])).rows[0].csc_cifrado, bruto);
    await assert.rejects(() => ctx.db.query("UPDATE fis_emitentes SET ambiente = 'producao' WHERE empresa_id = $1", [A]), /chk_fis_emit_ambiente/);
  });

  test('certificado: senha errada recusada; aceito fica cifrado e a API não devolve segredo', async () => {
    await assert.rejects(() => fiscal.importarCertificado(ctx.db, A, { arquivoBase64: PFX, senha: 'errada' }, { env: ENV }), (e) => e.code === 'CERTIFICADO_INVALIDO');
    await assert.rejects(() => fiscal.importarCertificado(ctx.db, A, { arquivoBase64: PFX, senha: SENHA }, { env: {} }), (e) => e.code === 'COFRE_INDISPONIVEL');
    const c = await fiscal.importarCertificado(ctx.db, A, { arquivoBase64: PFX, senha: SENHA }, { usuario: 'gestor', env: ENV });
    assert.equal(c.ativo, true);
    assert.equal(c.cnpj, '50073355000260');
    const lista = await fiscal.listarCertificados(ctx.db, A);
    assert.equal(JSON.stringify(lista).includes(SENHA), false);
    const row = (await ctx.db.query('SELECT pfx_cifrado, senha_cifrada FROM fis_certificados WHERE empresa_id = $1', [A])).rows[0];
    assert.doesNotMatch(row.senha_cifrada, new RegExp(SENHA));
    assert.equal(row.pfx_cifrado.includes(PFX.slice(0, 40)), false);
    assert.equal((await fiscal.listarCertificados(ctx.db, B)).length, 0);
  });

  test('sem classificação a emissão é recusada sem consumir número; com ela, XML assinado e validado', async () => {
    const comanda = await comandaPaga('Mesa 7');
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: comanda }, { env: ENV, agora }), (e) => e.code === 'PENDENCIAS_FISCAIS' && /sem classificação/.test(e.message));
    assert.equal((await fiscal.listarDocumentos(ctx.db, A)).length, 0);
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'categoria', fonteId: 'bar:Bebidas', ncm: '22030000', cfop: '5405', csosn: '102', cest: '0302100' });
    const doc = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: comanda }, { env: ENV, agora, usuario: 'caixa' });
    assert.equal(doc.status, 'validado_localmente');
    assert.equal(doc.numero, 1);
    assert.equal(doc.valorTotal, 24);
    assert.ok(!doc.mensagens.some((m) => m.codigo === 'XSD_INDISPONIVEL'), 'XML passou no schema oficial (xmllint presente)');
    const completo = await fiscal.obterDocumento(ctx.db, A, doc.id, { comXml: true });
    assert.match(completo.xmlAssinado, /<tpAmb>2<\/tpAmb>/);
    assert.match(completo.xmlAssinado, /NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL/);
    assert.match(completo.xmlAssinado, /<Signature/);
    assert.match(completo.xmlAssinado, /<CEST>0302100<\/CEST>/);
    const repetido = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: comanda }, { env: ENV, agora });
    assert.equal(repetido.id, doc.id);
    assert.equal(repetido.idempotente, true);
    assert.equal((await fiscal.vendasSemNota(ctx.db, A)).some((v) => v.origemId === comanda), false);
  });

  test('transmissão em homologação: autorizado, rejeitado reaproveita número e cancelamento por evento', async () => {
    const c1 = await comandaPaga('Mesa 8');
    const ok = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c1 }, { env: ENV_TX, transporte: sefazFalsa('100'), agora });
    assert.equal(ok.status, 'autorizado');
    assert.equal(ok.protocolo, '151260000000123');
    assert.equal(ok.chave.length, 44);
    const c2 = await comandaPaga('Mesa 9');
    const rej = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c2 }, { env: ENV_TX, transporte: sefazFalsa('539'), agora });
    assert.equal(rej.status, 'rejeitado');
    const ok2 = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c2 }, { env: ENV_TX, transporte: sefazFalsa('100'), agora });
    assert.equal(ok2.id, rej.id);
    assert.equal(ok2.numero, rej.numero, 'rejeitado não consome número');
    assert.equal(ok2.status, 'autorizado');
    await assert.rejects(() => fiscal.cancelar(ctx.db, A, ok.id, { justificativa: 'curta' }), (e) => e.code === 'VALIDATION_ERROR');
    const canc = await fiscal.cancelar(ctx.db, A, ok.id, { justificativa: 'Cliente desistiu da compra no caixa', env: ENV_TX, transporte: sefazFalsa() });
    assert.equal(canc.status, 'cancelado');
    const ev = await fiscal.obterDocumento(ctx.db, A, ok.id);
    assert.deepEqual(ev.eventos.map((e) => e.tipo), ['rascunho', 'autorizado', 'cancelado']);
    await assert.rejects(() => fiscal.obterDocumento(ctx.db, B, ok.id), (e) => e.status === 404);
  });

  test('NFS-e Nacional (produção restrita): DPS assinada; com envio, autorizada pela Sefin', async () => {
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'servico', fonteId: 'aula-tenis', tipo: 'servico', cTribNac: '060101' });
    const local = await fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'manual', idempotencia: 'aula-1', itens: [{ fonte: 'servico', fonteId: 'aula-tenis', descricao: 'Aula de tênis', quantidade: 1, valorUnitario: 150 }] }, { env: ENV, agora });
    assert.equal(local.status, 'validado_localmente');
    const completo = await fiscal.obterDocumento(ctx.db, A, local.id, { comXml: true });
    assert.match(completo.xmlAssinado, /<tpAmb>2<\/tpAmb>/);
    const sefin = async ({ url }) => (url.endsWith('/nfse') ? { status: 201, corpo: { chaveAcesso: '5'.repeat(50), idDps: 'x', alertas: [] } } : { status: 404, corpo: {} });
    const enviada = await fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'manual', idempotencia: 'aula-2', itens: [{ fonte: 'servico', fonteId: 'aula-tenis', descricao: 'Aula de tênis', quantidade: 2, valorUnitario: 150 }] }, { env: ENV_TX, transporte: sefin, agora });
    assert.equal(enviada.status, 'autorizado');
    assert.equal(enviada.valorTotal, 300);
    assert.equal(enviada.numero, local.numero + 1);
  });

  test('numeração não repete em emissões simultâneas e usuário de unidade não vê documento de outra', async () => {
    const itens = [{ fonte: 'servico', fonteId: 'aula-tenis', descricao: 'Aula', quantidade: 1, valorUnitario: 10 }];
    const res = await Promise.all([1, 2, 3, 4].map((n) => fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'manual', idempotencia: `par-${n}`, itens }, { env: ENV, agora })));
    assert.equal(new Set(res.map((d) => d.numero)).size, 4);
    const outraLoja = randomUUID();
    await assert.rejects(() => fiscal.obterDocumento(ctx.db, A, res[0].id, { lojaRestrita: outraLoja }), (e) => e.status === 404);
    const p = await fiscal.prontidao(ctx.db, A, { env: ENV });
    assert.equal(p.ambiente, 'homologacao');
    assert.equal(p.pronto, true, JSON.stringify(p.pendencias));
    assert.ok((await fiscal.prontidao(ctx.db, B, { env: ENV })).pendencias.length >= 2);
    void loja;
  });

  test('revisão: chave reutilizada com outro modelo, venda com duas notas e certificado reenviado', async () => {
    const c = await comandaPaga('Mesa 30');
    const d = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c, idempotencia: 'K-1' }, { env: ENV, agora });
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'manual', idempotencia: 'K-1', itens: [{ fonte: 'servico', fonteId: 'aula-tenis', descricao: 'x', quantidade: 1, valorUnitario: 1 }] }, { env: ENV, agora }), (e) => e.code === 'IDEMPOTENCY_CONFLICT');
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c, idempotencia: 'K-2' }, { env: ENV, agora }), (e) => e.code === 'VENDA_JA_TEM_NOTA');
    assert.equal(d.status, 'validado_localmente');
    const c2 = await fiscal.importarCertificado(ctx.db, A, { arquivoBase64: PFX, senha: SENHA }, { env: ENV });
    assert.equal(c2.ativo, true);
    assert.equal((await fiscal.listarCertificados(ctx.db, A)).length, 1);
  });

  test('revisão: falha de comunicação reenvia o MESMO XML e recupera o protocolo; resposta de outra chave não autoriza', async () => {
    const c = await comandaPaga('Mesa 31');
    const quebra = async () => { throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }); };
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: quebra, agora }), (e) => e.code === 'FALHA_COMUNICACAO');
    const [falhou] = (await fiscal.listarDocumentos(ctx.db, A, { status: 'falha_comunicacao' }));
    const enviados = [];
    const espiao = async (req) => { enviados.push(req.xml); return sefazFalsa('204')(req); };
    const ok = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: espiao, agora });
    assert.equal(ok.id, falhou.id);
    assert.equal(ok.status, 'autorizado');
    assert.equal(ok.chave, falhou.chave, 'mesma chave do primeiro envio');
    assert.equal(ok.protocolo, '151260000000777');
    assert.ok(enviados.some((x) => x.includes(falhou.chave)));
    const c3 = await comandaPaga('Mesa 32');
    const div = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c3 }, { env: ENV_TX, transporte: sefazFalsa('outra'), agora });
    assert.equal(div.status, 'rejeitado');
  });

  test('revisão: duas emissões simultâneas com a mesma chave transmitem uma vez só', async () => {
    const c = await comandaPaga('Mesa 33');
    let envios = 0;
    const lento = async (req) => { envios += 1; await new Promise((r) => setTimeout(r, 150)); return sefazFalsa('100')(req); };
    const res = await Promise.allSettled([1, 2].map(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: lento, agora })));
    assert.equal(envios, 1);
    assert.equal(res.filter((r) => r.status === 'fulfilled' && r.value.status === 'autorizado').length, 1);
    assert.equal(res.find((r) => r.status === 'rejected').reason.code, 'EM_ANDAMENTO');
  });

  test('revisão: prazo de cancelamento da NFC-e e NF-e 55 com destinatário passa no schema', async () => {
    const c = await comandaPaga('Mesa 34');
    const ok = await fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV_TX, transporte: sefazFalsa('100'), agora });
    await ctx.db.query("UPDATE fis_documentos SET autorizado_em = now() - interval '2 hours' WHERE id = $1", [ok.id]);
    await assert.rejects(() => fiscal.cancelar(ctx.db, A, ok.id, { justificativa: 'Cliente desistiu da compra no caixa', env: ENV_TX, transporte: sefazFalsa() }), (e) => e.code === 'PRAZO_CANCELAMENTO');
    const c2 = await comandaPaga('Mesa 35');
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '55', origem: 'bar_comanda', origemId: c2 }, { env: ENV, agora }), (e) => e.code === 'PENDENCIAS_FISCAIS');
    const dest = { cnpj: '11222333000181', nome: 'Cliente Empresa', endereco: { logradouro: 'Av. Brasil', numero: '10', bairro: 'Centro', cidade: 'Tangará da Serra', uf: 'MT', codigoMunicipio: '5107958', cep: '78300000' }, indIEDest: '9' };
    const nfe = await fiscal.emitir(ctx.db, A, { modelo: '55', origem: 'bar_comanda', origemId: c2, destinatario: dest }, { env: ENV, agora });
    assert.equal(nfe.status, 'validado_localmente');
    assert.ok(!nfe.mensagens.some((m) => m.codigo === 'XSD_INDISPONIVEL'));
    const xml = (await fiscal.obterDocumento(ctx.db, A, nfe.id, { comXml: true })).xmlAssinado;
    assert.match(xml, /<xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL<\/xNome>/);
  });

  test('revisão: usuário de uma unidade não emite com o CNPJ de outra', async () => {
    const lojaB = (await ctx.db.query("INSERT INTO lojas (empresa_id, nome) VALUES ($1, 'Filial') RETURNING id", [A])).rows[0].id;
    const emitB = await fiscal.salvarEmitente(ctx.db, A, { ...EMITENTE, lojaId: lojaB, cnpj: '50073355000340' }, { env: ENV });
    const itens = [{ fonte: 'servico', fonteId: 'aula-tenis', descricao: 'Aula', quantidade: 1, valorUnitario: 10 }];
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: 'nfse', origem: 'manual', idempotencia: 'u-1', itens, emitenteId: emitB.id }, { env: ENV, agora, lojaRestrita: loja }), (e) => e.status === 404);
    const c = await comandaPaga('Mesa 36'); // agora há duas unidades e o bar não tem unidade definida
    await assert.rejects(() => fiscal.emitir(ctx.db, A, { modelo: '65', origem: 'bar_comanda', origemId: c }, { env: ENV, agora, lojaRestrita: loja }), (e) => e.code === 'PERMISSION_DENIED');
  });
});
