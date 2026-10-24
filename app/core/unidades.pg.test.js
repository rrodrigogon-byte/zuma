import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as unidades from '../modules/unidades/servico.js';

// Réplica da tabela `lojas` da migração 003 (a que está em produção) e da função de auditoria.
const LOJAS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL, nome VARCHAR(255) NOT NULL, nome_fantasia VARCHAR(255), cnpj VARCHAR(14),
  inscricao_estadual VARCHAR(20), inscricao_municipal VARCHAR(20), telefone VARCHAR(20), email VARCHAR(255),
  endereco_logradouro VARCHAR(255), endereco_numero VARCHAR(20), endereco_complemento VARCHAR(255),
  endereco_bairro VARCHAR(100), endereco_cidade VARCHAR(100), endereco_estado VARCHAR(2), endereco_cep VARCHAR(8),
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo', ativa BOOLEAN NOT NULL DEFAULT true,
  configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_lojas_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT chk_lojas_codigo CHECK (codigo ~ '^[A-Za-z0-9_-]+$')
);
CREATE FUNCTION verificar_cadeia_auditoria(p_empresa_id UUID) RETURNS TABLE (valida BOOLEAN, motivo TEXT)
  LANGUAGE sql AS $$ SELECT true, 'Cadeia íntegra'::text $$;`;

describe('Unidades da empresa (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const empresaA = randomUUID();
  const empresaB = randomUUID();
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(LOJAS);
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [empresaA, empresaB]);
  });
  after(async () => { await ctx?.fechar(); });

  test('cria, lista e isola as unidades por empresa', async () => {
    const a = await unidades.criarUnidade(ctx.db, empresaA, { codigo: 'matriz', nome: 'Matriz Centro', cnpj: '12.345.678/0001-90', endereco_estado: 'mt' });
    assert.equal(a.codigo, 'MATRIZ');
    assert.equal(a.cnpj, '12345678000190');
    assert.equal(a.endereco_estado, 'MT');
    assert.equal(a.empresaId, empresaA);
    await unidades.criarUnidade(ctx.db, empresaB, { codigo: 'matriz', nome: 'Outra empresa' });
    const listaA = await unidades.listarUnidades(ctx.db, empresaA);
    assert.deepEqual(listaA.map((u) => u.nome), ['Matriz Centro']);
    await assert.rejects(() => unidades.obterUnidade(ctx.db, empresaB, a.id), (e) => e.code === 'NOT_FOUND');
    await assert.rejects(() => unidades.atualizarUnidade(ctx.db, empresaB, a.id, { nome: 'Invasão' }), (e) => e.code === 'NOT_FOUND');
  });

  test('recusa código repetido e dados inválidos', async () => {
    await assert.rejects(() => unidades.criarUnidade(ctx.db, empresaA, { codigo: 'MATRIZ', nome: 'Duplicada' }), (e) => e.code === 'CONFLICT');
    await assert.rejects(() => unidades.criarUnidade(ctx.db, empresaA, { codigo: 'a b', nome: 'Com espaço' }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => unidades.criarUnidade(ctx.db, empresaA, { codigo: 'X1', nome: 'CNPJ curto', cnpj: '123' }), (e) => e.code === 'VALIDATION_ERROR');
    await assert.rejects(() => unidades.criarUnidade(ctx.db, empresaA, { codigo: 'X2' }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('não desativa a última unidade ativa e não troca o código', async () => {
    const [matriz] = await unidades.listarUnidades(ctx.db, empresaA);
    await assert.rejects(() => unidades.atualizarUnidade(ctx.db, empresaA, matriz.id, { ativa: false }), (e) => e.code === 'LAST_STORE');
    const filial = await unidades.criarUnidade(ctx.db, empresaA, { codigo: 'filial-2', nome: 'Filial Norte' });
    const desativada = await unidades.atualizarUnidade(ctx.db, empresaA, filial.id, { ativa: false, codigo: 'OUTRO', nome: 'Filial Norte (fechada)' });
    assert.equal(desativada.ativa, false);
    assert.equal(desativada.codigo, 'FILIAL-2');
    assert.equal((await unidades.listarUnidades(ctx.db, empresaA)).length, 1);
    assert.equal((await unidades.listarUnidades(ctx.db, empresaA, { incluirInativas: true })).length, 2);
  });

  test('permissão presa a uma unidade: vê e edita só ela e não cria nem desativa', async () => {
    const [matriz] = await unidades.listarUnidades(ctx.db, empresaA);
    const outra = await unidades.criarUnidade(ctx.db, empresaA, { codigo: 'sul', nome: 'Filial Sul' });
    const restrita = { lojaRestrita: matriz.id };
    assert.deepEqual((await unidades.listarUnidades(ctx.db, empresaA, restrita)).map((u) => u.id), [matriz.id]);
    await assert.rejects(() => unidades.atualizarUnidade(ctx.db, empresaA, outra.id, { nome: 'Invadida' }, restrita), (e) => e.code === 'NOT_FOUND');
    await assert.rejects(() => unidades.criarUnidade(ctx.db, empresaA, { codigo: 'nova', nome: 'Nova' }, restrita), (e) => e.code === 'PERMISSION_DENIED');
    await assert.rejects(() => unidades.atualizarUnidade(ctx.db, empresaA, matriz.id, { ativa: false }, restrita), (e) => e.code === 'PERMISSION_DENIED');
    assert.equal((await unidades.atualizarUnidade(ctx.db, empresaA, matriz.id, { telefone: '65999990000' }, restrita)).telefone, '65999990000');
    await assert.rejects(() => unidades.verificarAuditoria(ctx.db, empresaA, outra.id, restrita), (e) => e.code === 'NOT_FOUND');
  });

  test('duas desativações ao mesmo tempo não deixam a empresa sem unidade ativa', async () => {
    const empresaC = randomUUID();
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1)', [empresaC]);
    const a = await unidades.criarUnidade(ctx.db, empresaC, { codigo: 'a', nome: 'Unidade A' });
    const b = await unidades.criarUnidade(ctx.db, empresaC, { codigo: 'b', nome: 'Unidade B' });
    const r = await Promise.allSettled([
      unidades.atualizarUnidade(ctx.db, empresaC, a.id, { ativa: false }),
      unidades.atualizarUnidade(ctx.db, empresaC, b.id, { ativa: false }),
    ]);
    assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal((await unidades.listarUnidades(ctx.db, empresaC)).length, 1);
  });

  test('não desativa unidade em uso pela loja online', async () => {
    const outra = await unidades.criarUnidade(ctx.db, empresaB, { codigo: 'vitrine', nome: 'Vitrine' });
    await unidades.criarUnidade(ctx.db, empresaB, { codigo: 'reserva', nome: 'Reserva' });
    await ctx.db.query("CREATE TABLE IF NOT EXISTS commerce_storefronts (empresa_id UUID, loja_id UUID, status VARCHAR(20))");
    await ctx.db.query("INSERT INTO commerce_storefronts VALUES ($1, $2, 'active')", [empresaB, outra.id]);
    await assert.rejects(() => unidades.atualizarUnidade(ctx.db, empresaB, outra.id, { ativa: false }), (e) => e.code === 'STORE_IN_USE' && /loja online/.test(e.message));
    await ctx.db.query("UPDATE commerce_storefronts SET status = 'paused'");
    assert.equal((await unidades.atualizarUnidade(ctx.db, empresaB, outra.id, { ativa: false })).ativa, false);
  });

  test('fuso horário precisa ser válido', async () => {
    await assert.rejects(() => unidades.criarUnidade(ctx.db, empresaA, { codigo: 'tz', nome: 'Fuso', timezone: 'Lua/Base' }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('auditoria só para unidade da própria empresa', async () => {
    const [matriz] = await unidades.listarUnidades(ctx.db, empresaA);
    const r = await unidades.verificarAuditoria(ctx.db, empresaA, matriz.id);
    assert.equal(r.sucesso, true);
    await assert.rejects(() => unidades.verificarAuditoria(ctx.db, empresaB, matriz.id), (e) => e.code === 'NOT_FOUND');
  });
});
