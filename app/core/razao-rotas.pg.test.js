import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { createRazaoAdminRouter } from '../modules/razao/rotas.js';

// Rotas do razão com um escopo de teste: o cabeçalho diz a empresa e, se houver, a unidade a que a
// permissão da pessoa está presa (no server.js isso vem do requireCommercePermission).
describe('Rotas do razão: escopo de unidade', { skip: pgDeTeste }, () => {
  let ctx; let server; let base;
  const empresa = randomUUID();
  const lojaA = randomUUID();
  const lojaB = randomUUID();
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query('CREATE TABLE empresas (id UUID PRIMARY KEY)');
    await ctx.db.query(readFileSync(new URL('../migrations/090_financeiro_razao.sql', import.meta.url), 'utf8'));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [empresa]);
    await ctx.db.query('CREATE TABLE lojas (id UUID PRIMARY KEY, empresa_id UUID NOT NULL)');
    await ctx.db.query('INSERT INTO lojas (id, empresa_id) VALUES ($1, $3), ($2, $3)', [lojaA, lojaB, empresa]);
    const app = express();
    app.use('/r', createRazaoAdminRouter({
      db: ctx.db,
      ativo: () => true,
      escopoDaRequisicao: async (req, permissao) => {
        if (req.headers['x-negar'] === permissao) throw Object.assign(new Error('permissão insuficiente'), { status: 403, code: 'PERMISSION_DENIED' });
        return { empresaId: empresa, lojaRestrita: req.headers['x-loja-restrita'] || null };
      },
    }));
    await new Promise((ok) => { server = app.listen(0, ok); });
    base = `http://127.0.0.1:${server.address().port}/r`;
  });
  after(async () => { server?.close(); await ctx?.fechar(); });

  const chamar = async (metodo, caminho, corpo, headers = {}) => {
    const r = await fetch(base + caminho, { method: metodo, headers: { 'content-type': 'application/json', ...headers }, body: corpo ? JSON.stringify(corpo) : undefined });
    return { status: r.status, json: await r.json() };
  };

  test('gestor da empresa vê tudo; quem é de uma unidade vê só a dela e grava nela', async () => {
    const a = await chamar('POST', '/lancamentos', { tipo: 'despesa', descricao: 'Luz loja A', valor: 100, lojaId: lojaA });
    const b = await chamar('POST', '/lancamentos', { tipo: 'despesa', descricao: 'Luz loja B', valor: 200, lojaId: lojaB });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal((await chamar('GET', '/lancamentos')).json.length, 2);
    const soA = await chamar('GET', '/lancamentos', null, { 'x-loja-restrita': lojaA });
    assert.deepEqual(soA.json.map((l) => l.descricao), ['Luz loja A']);
    const forcado = await chamar('POST', '/lancamentos', { tipo: 'receita', descricao: 'Tentou loja B', valor: 5, lojaId: lojaB }, { 'x-loja-restrita': lojaA });
    assert.equal(forcado.json[0].lojaId, lojaA);
    const outra = await chamar('POST', `/lancamentos/${b.json[0].id}/baixar`, {}, { 'x-loja-restrita': lojaA });
    assert.equal(outra.status, 404);
    const pedida = await chamar('GET', `/resumo?lojaId=${lojaB}`, null, { 'x-loja-restrita': lojaA });
    assert.equal(pedida.status, 403);
    const resumo = await chamar('GET', '/resumo', null, { 'x-loja-restrita': lojaA });
    assert.equal(resumo.json.aPagar, 100);
  });

  test('permissão negada e estado do módulo', async () => {
    const negado = await chamar('POST', '/lancamentos', { tipo: 'despesa', descricao: 'x', valor: 1 }, { 'x-negar': 'payments.write' });
    assert.equal(negado.status, 403);
    const estado = await chamar('GET', '/estado');
    assert.equal(estado.json.ativo, true);
    assert.ok(Array.isArray(estado.json.fontes));
    assert.match(estado.json.hoje, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('quem é de uma unidade não mexe em categorias e centros da empresa nem vê as fontes', async () => {
    const r = { 'x-loja-restrita': lojaA };
    assert.equal((await chamar('POST', '/categorias', { tipo: 'despesa', nome: 'Gás', grupoDre: 'operacional' }, r)).status, 403);
    assert.equal((await chamar('POST', '/centros-custo', { codigo: 'C1', nome: 'Cozinha' }, r)).status, 403);
    assert.deepEqual((await chamar('GET', '/estado', null, r)).json.fontes, []);
    assert.equal((await chamar('POST', '/categorias', { tipo: 'despesa', nome: 'Gás', grupoDre: 'operacional' })).status, 201);
  });
});
