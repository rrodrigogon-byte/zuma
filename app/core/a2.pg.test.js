import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import * as a2 from '../modules/a2/servico.js';

describe('A2 financeiro e cadastros multiempresa (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const empresaA = randomUUID();
  const empresaB = randomUUID();
  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query('CREATE TABLE empresas (id UUID PRIMARY KEY)');
    await ctx.db.query(readFileSync(new URL('../migrations/082_financeiro_cadastros_multiempresa.sql', import.meta.url), 'utf8'));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [empresaA, empresaB]);
  });
  after(async () => { await ctx?.fechar(); });

  test('isola clientes e contas a receber entre empresas', async () => {
    const clienteA = await a2.salvarCliente(ctx.db, empresaA, { nome: 'Cliente A', email: 'a@teste.local', limiteCreditoMensal: 500 });
    const clienteB = await a2.salvarCliente(ctx.db, empresaB, { nome: 'Cliente B', email: 'b@teste.local' });
    await a2.criarConta(ctx.db, empresaA, { clienteId: clienteA.id, descricao: 'Consumo A', valor: 120, dataVencimento: '2099-12-31' });
    assert.deepEqual((await a2.listarClientes(ctx.db, empresaB)).map((cliente) => cliente.id), [clienteB.id]);
    assert.equal((await a2.listarContas(ctx.db, empresaB)).length, 0);
    await assert.rejects(() => a2.baixarConta(ctx.db, empresaB, clienteA.id), (error) => error.code === 'NOT_FOUND' || error.code === 'INVALID_ID');
  });

  test('baixa, alerta e fechamento usam o snapshot da própria empresa', async () => {
    const [cliente] = await a2.listarClientes(ctx.db, empresaA);
    const conta = (await a2.listarContas(ctx.db, empresaA))[0];
    assert.equal(conta.status, 'pendente');
    await a2.baixarConta(ctx.db, empresaA, conta.id, new Date('2026-10-18T12:00:00Z'));
    assert.equal((await a2.listarContas(ctx.db, empresaA))[0].status, 'paga');
    const fechamento = await a2.criarFechamento(ctx.db, empresaA, 'Conferência do caixa', 'operador-a');
    assert.equal(fechamento.responsavel, 'operador-a');
    assert.equal(fechamento.totalRecebido, 120);
    assert.equal((await a2.listarFechamentos(ctx.db, empresaB)).length, 0);
    assert.equal(cliente.nome, 'Cliente A');
  });

  test('funcionários e fornecedores não atravessam empresas', async () => {
    const funcionario = await a2.salvarCadastro(ctx.db, empresaA, 'funcionarios', { nome: 'Funcionário A', cargo: 'Caixa' });
    const fornecedor = await a2.salvarCadastro(ctx.db, empresaA, 'fornecedores', { nome: 'Fornecedor A', cnpj: '123' });
    assert.equal((await a2.listarCadastros(ctx.db, empresaA, 'funcionarios'))[0].id, funcionario.id);
    assert.equal((await a2.listarCadastros(ctx.db, empresaA, 'fornecedores'))[0].id, fornecedor.id);
    assert.deepEqual(await a2.listarCadastros(ctx.db, empresaB, 'funcionarios'), []);
    assert.deepEqual(await a2.listarCadastros(ctx.db, empresaB, 'fornecedores'), []);
  });
});
