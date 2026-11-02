// F2 do plano fiscal: classificação em lote, planilha (exportar/importar com prévia), sugestão de
// NCM/CEST, emissão em lote e emissão automática das vendas pagas.
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';
import * as fiscal from '../modules/fiscal/servico.js';
import * as lote from '../modules/fiscal/lote.js';

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
  cnpj: '50.073.355/0002-60', razaoSocial: 'BARBEARIA TESTE LTDA', ie: '131234567', im: '12345', crt: '1', uf: 'MT', codigoMunicipio: '5107958',
  endereco: { logradouro: 'Rua Avelina Jaci Bohn', numero: '80', bairro: 'Centro', cidade: 'Tangará da Serra', cep: '78300000' }, cscId: '000001', csc: 'CSC-HOMOLOG-123456',
};

describe('Fiscal F2 — classificação em massa, emissão em lote e automática (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID(); const B = randomUUID();
  const ENV = { FISCAL_CERT_MASTER_KEY: randomBytes(32).toString('hex') };
  const variantes = {};

  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '092_fiscal_multiempresa.sql', '100_fiscal_completo.sql', '106_fiscal_producao.sql', '107_fiscal_automatica.sql', '108_fiscal_ibs_cbs.sql']) await ctx.db.query(sql(m));
    await ctx.db.query(sql('107_fiscal_automatica.sql')); // reexecutável
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, B]);
    await fiscal.salvarEmitente(ctx.db, A, EMITENTE, { env: ENV });
    await fiscal.importarCertificado(ctx.db, A, { arquivoBase64: PFX, senha: SENHA }, { env: ENV });
    for (const nome of ['1 Million Parfum 100ml', 'CK Be Eau de Toilette 100ml', 'Pomada modeladora 120g', 'Kit misterioso']) {
      const p = (await ctx.db.query('INSERT INTO commerce_products (empresa_id, nome) VALUES ($1, $2) RETURNING id', [A, nome])).rows[0].id;
      variantes[nome] = (await ctx.db.query("INSERT INTO commerce_product_variants (empresa_id, product_id, sku) VALUES ($1, $2, 'SKU') RETURNING id", [A, p])).rows[0].id;
    }
  });
  after(async () => { await ctx?.fechar(); });

  async function pedidoPago(variante, { valor = 100, criadoEm = new Date() } = {}) {
    const o = (await ctx.db.query("INSERT INTO commerce_orders (empresa_id, public_code, criado_em) VALUES ($1, $2, $3) RETURNING id", [A, `KC-${randomBytes(4).toString('hex').toUpperCase()}`, criadoEm])).rows[0].id;
    await ctx.db.query("INSERT INTO commerce_order_items (empresa_id, order_id, variant_id, nome_snapshot, quantidade, preco_unitario) VALUES ($1, $2, $3, 'Item', 1, $4)", [A, o, variante, valor]);
    await ctx.db.query("INSERT INTO commerce_payments (empresa_id, order_id, method, amount, status, captured_at) VALUES ($1, $2, 'pix', $3, 'captured', CURRENT_TIMESTAMP)", [A, o, valor]);
    return o;
  }

  test('sugestão de NCM/CEST pelo nome (perfumaria com CEST do anexo XX)', () => {
    assert.deepEqual(lote.sugerirClassificacao('1 Million Parfum 100ml'), { ncm: '33030010', cest: '2000700', descricao: 'Perfume (extrato)' });
    assert.equal(lote.sugerirClassificacao('CK Be Eau de Toilette').ncm, '33030020');
    assert.equal(lote.sugerirClassificacao('CK Be Eau de Toilette').cest, '2000800');
    assert.equal(lote.sugerirClassificacao('Pomada modeladora').ncm, '33059000');
    assert.equal(lote.sugerirClassificacao('Cerveja lata').cest, undefined, 'bebida: CEST fica para o contador');
    assert.equal(lote.sugerirClassificacao('Kit misterioso'), null);
    assert.ok(lote.PERFIS.some((p) => p.id === 'sn_revenda_st' && p.valores.csosn === '500'));
  });

  test('classificação em lote é tudo ou nada', async () => {
    const itens = [{ fonte: 'loja_variante', fonteId: variantes['1 Million Parfum 100ml'] }, { fonte: 'loja_variante', fonteId: variantes['CK Be Eau de Toilette 100ml'] }];
    // ST sem CEST: recusado, nenhum gravado
    await assert.rejects(() => lote.classificarEmLote(ctx.db, A, { itens, classificacao: { ncm: '33030010', cfop: '5405', csosn: '500' } }), (e) => /Item 1/.test(e.message) && /CEST/.test(e.message));
    assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM fis_classificacoes WHERE empresa_id = $1', [A])).rows[0].n, 0);
    const r = await lote.classificarEmLote(ctx.db, A, { itens, classificacao: { ncm: '33030010', cest: '2000700', cfop: '5405', csosn: '500' } });
    assert.equal(r.aplicadas, 2);
    const lista = await fiscal.listarClassificaveis(ctx.db, A);
    assert.equal(lista.filter((i) => i.classificacao?.csosn === '500').length, 2);
    await assert.rejects(() => lote.classificarEmLote(ctx.db, A, { itens: [] }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('planilha: exporta, prévia não grava, aplicar grava as válidas e aponta a linha de cada erro', async () => {
    const csv = await lote.exportarClassificacoesCsv(ctx.db, A);
    assert.ok(csv.startsWith('﻿fonte;fonte_id;grupo;nome;tipo;ncm;cest;cfop'));
    const linhas = lote.lerCsv(csv);
    const pomada = linhas.find((l) => l[3] === 'Pomada modeladora 120g · SKU');
    assert.ok(pomada, 'item sem classificação está na planilha');
    const idx = Object.fromEntries(linhas[0].map((c, i) => [c, i]));
    assert.equal(pomada[idx.ncm_sugerido], '33059000');
    assert.equal(pomada[idx.cest_sugerido], '2002000');
    // edita como no Excel: pomada com NCM e CSOSN 102; "Kit" com CFOP inválido; "CK" fica sem mudança (já classificado)
    const kit = linhas.find((l) => l[3].startsWith('Kit misterioso'));
    const cab = linhas[0];
    const montar = (l, mudar) => cab.map((c, i) => (c in mudar ? mudar[c] : l[i]));
    const planilha = [cab, montar(pomada, { ncm: '33059000', cfop: '5102', csosn: '102', aliquota_icms: '0,00' }), montar(kit, { ncm: '96050000', cfop: '9999', csosn: '102' }), montar(kit, { ncm: '' })]
      .map((l) => l.map((c) => (/[;"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
    const previa = await lote.importarClassificacoesCsv(ctx.db, A, { arquivo: Buffer.from(planilha, 'utf8') });
    assert.equal(previa.prevista, true);
    assert.equal(previa.validas, 1);
    assert.equal(previa.ignoradas, 1);
    assert.equal(previa.erros.length, 1);
    assert.equal(previa.erros[0].linha, 3);
    assert.match(previa.erros[0].mensagem, /CFOP/);
    assert.equal((await fiscal.listarClassificaveis(ctx.db, A)).find((i) => i.fonteId === variantes['Pomada modeladora 120g']).classificacao, null, 'prévia não grava');
    const aplicado = await lote.importarClassificacoesCsv(ctx.db, A, { arquivo: planilha, aplicar: true });
    assert.equal(aplicado.aplicadas, 1);
    assert.equal((await fiscal.listarClassificaveis(ctx.db, A)).find((i) => i.fonteId === variantes['Pomada modeladora 120g']).classificacao.ncm, '33059000');
    await assert.rejects(() => lote.importarClassificacoesCsv(ctx.db, A, { arquivo: 'ncm;cfop\n1;2' }), (e) => /fonte/.test(e.message));
    // CSV com vírgula também é lido
    assert.deepEqual(lote.lerCsv('a,b\n"x, y",2\n'), [['a', 'b'], ['x, y', '2']]);
  });

  test('emissão em lote: cada venda tem o seu resultado (uma falha não para as outras)', async () => {
    const ok1 = await pedidoPago(variantes['1 Million Parfum 100ml'], { valor: 450 });
    const semCls = await pedidoPago(variantes['Kit misterioso'], { valor: 50 });
    const ok2 = await pedidoPago(variantes['CK Be Eau de Toilette 100ml'], { valor: 300 });
    const r = await lote.emitirEmLote(ctx.db, A, { vendas: [ok1, semCls, ok2].map((origemId) => ({ origem: 'loja_pedido', origemId })) }, { env: ENV });
    assert.equal(r.total, 3);
    assert.equal(r.emitidas, 2);
    assert.equal(r.falhas, 1);
    assert.match(r.resultados[1].erro, /sem classificação/);
    assert.deepEqual(r.resultados.filter((x) => x.ok).map((x) => x.numero), [1, 2]);
    await assert.rejects(() => lote.emitirEmLote(ctx.db, A, { vendas: Array.from({ length: 51 }, () => ({ origem: 'loja_pedido', origemId: ok1 })) }), (e) => /50/.test(e.message));
  });

  test('emissão automática: desligada não faz nada; ligada emite só as vendas pagas depois de ligar', async () => {
    assert.equal((await lote.obterConfigAutomatica(ctx.db, A)).emissaoAutomatica, false);
    const antiga = await pedidoPago(variantes['1 Million Parfum 100ml'], { criadoEm: new Date(Date.now() - 3600_000) });
    let r = await lote.rodarEmissaoAutomatica(ctx.db, { env: ENV });
    assert.equal(r.empresas, 0);
    const agora = new Date();
    const cfg = await lote.salvarConfigAutomatica(ctx.db, A, { emissaoAutomatica: true, origens: ['loja_pedido'] }, { agora });
    assert.equal(cfg.emissaoAutomatica, true);
    assert.equal(new Date(cfg.desde).getTime(), agora.getTime());
    // salvar de novo ligada mantém o "desde"
    assert.equal(new Date((await lote.salvarConfigAutomatica(ctx.db, A, { emissaoAutomatica: true }, { agora: new Date(Date.now() + 60_000) })).desde).getTime(), agora.getTime());
    await assert.rejects(() => lote.salvarConfigAutomatica(ctx.db, A, { emissaoAutomatica: true, origens: ['outra'] }), (e) => e.code === 'VALIDATION_ERROR');
    const nova = await pedidoPago(variantes['CK Be Eau de Toilette 100ml'], { criadoEm: new Date(agora.getTime() + 1000) });
    r = await lote.rodarEmissaoAutomatica(ctx.db, { env: ENV });
    assert.equal(r.empresas, 1);
    assert.equal(r.emitidas, 1);
    const docs = await fiscal.listarDocumentos(ctx.db, A);
    assert.ok(docs.some((d) => d.origemId === nova), 'a venda nova ganhou nota');
    assert.ok(!docs.some((d) => d.origemId === antiga), 'a venda de antes de ligar continua para emissão manual');
    const depois = await lote.obterConfigAutomatica(ctx.db, A);
    assert.equal(depois.ultimoResumo.emitidas, 1);
    // rodada logo em seguida não começa (a anterior acabou de rodar)
    const colada = await lote.rodarEmissaoAutomatica(ctx.db, { env: ENV });
    assert.match(colada.resumos[0].erros[0], /rodada em andamento/);
    // segunda rodada depois do intervalo: nada novo
    assert.equal((await lote.rodarEmissaoAutomatica(ctx.db, { env: ENV, agora: new Date(Date.now() + 60_000) })).emitidas, 0);
    // "Emitir pendentes agora": a rodada só desta empresa, na hora
    const outra = await pedidoPago(variantes['1 Million Parfum 100ml'], { criadoEm: new Date(agora.getTime() + 2000) });
    const agoraBotao = await lote.emitirPendentesAgora(ctx.db, A, { env: ENV, agora: new Date(Date.now() + 120_000) });
    assert.equal(agoraBotao.emitidas, 1);
    assert.equal(agoraBotao.config.ultimoResumo.emitidas, 1);
    assert.ok((await fiscal.listarDocumentos(ctx.db, A)).some((d) => d.origemId === outra));
    // desligar zera o "desde"
    assert.equal((await lote.salvarConfigAutomatica(ctx.db, A, { emissaoAutomatica: false })).desde, null);
    await assert.rejects(() => lote.emitirPendentesAgora(ctx.db, A, { env: ENV }), (e) => e.code === 'AUTOMATICA_DESLIGADA');
  });

  test('emissão automática com o fiscal incompleto registra o motivo e não emite', async () => {
    await lote.salvarConfigAutomatica(ctx.db, B, { emissaoAutomatica: true });
    const r = await lote.rodarEmissaoAutomatica(ctx.db, { env: ENV });
    assert.equal(r.emitidas, 0);
    const cfg = await lote.obterConfigAutomatica(ctx.db, B);
    assert.match(cfg.ultimoResumo.erros[0], /Fiscal não está pronto/);
  });
});
