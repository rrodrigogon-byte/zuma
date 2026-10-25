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
    const clientesB = await a2.listarClientes(ctx.db, empresaB);
    assert.deepEqual(clientesB.filter(cliente => !cliente.padrao).map(cliente => cliente.id), [clienteB.id]);
    assert.deepEqual(clientesB.filter(cliente => cliente.padrao).map(cliente => [cliente.id, cliente.nome]), [['cli-padrao-balcao', 'Cliente Balcão']]);
    assert.deepEqual((await ctx.db.query('SELECT id FROM commerce_customers WHERE empresa_id=$1',[empresaB])).rows.map(cliente=>cliente.id), [clienteB.id]);
    assert.equal((await a2.listarContas(ctx.db, empresaB)).length, 0);
    await assert.rejects(() => a2.baixarConta(ctx.db, empresaB, clienteA.id), (error) => error.code === 'NOT_FOUND' || error.code === 'INVALID_ID');
  });

  test('baixa, alerta e fechamento usam o snapshot da própria empresa', async () => {
    const [cliente] = await a2.listarClientes(ctx.db, empresaA);
    const conta = (await a2.listarContas(ctx.db, empresaA))[0];
    assert.equal(conta.status, 'pendente');
    // o fechamento soma o que foi recebido no dia: a baixa precisa ser de hoje
    await a2.baixarConta(ctx.db, empresaA, conta.id, new Date());
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

  test('status do cadastro: padrão ativo, aceita desligado e a edição sem status mantém o atual', async () => {
    const f = await a2.salvarCadastro(ctx.db, empresaA, 'funcionarios', { nome: 'Funcionária Status' });
    assert.equal(f.status, 'ativo');
    const desligada = await a2.salvarCadastro(ctx.db, empresaA, 'funcionarios', { nome: 'Funcionária Status', status: 'desligado' }, f.id);
    assert.equal(desligada.status, 'desligado');
    const editada = await a2.salvarCadastro(ctx.db, empresaA, 'funcionarios', { nome: 'Funcionária Status (nova)' }, f.id);
    assert.equal(editada.status, 'desligado');
    await assert.rejects(() => a2.salvarCadastro(ctx.db, empresaA, 'funcionarios', { nome: 'X', status: 'demitido' }), (e) => e.code === 'VALIDATION_ERROR');
  });

  test('usuário mestre mantém tipo e perfis sem expor senha', async () => {
    const criado = await a2.salvarUsuarioMestre(ctx.db, empresaA, {
      nome: 'Caixa A', email: 'caixa-a@teste.local', tipoUsuario: 'caixa', perfis: ['caixa'], senhaInicial: 'SenhaForte!123',
    });
    assert.equal(criado.tipoUsuario, 'caixa');
    assert.deepEqual(criado.perfis, ['caixa']);
    assert.equal(criado.senhaInicial, '');
    const listado = (await a2.listarUsuariosMestres(ctx.db, empresaA))[0];
    assert.equal(listado.tipoUsuario, 'caixa');
    assert.deepEqual(listado.perfis, ['caixa']);
    assert.equal(listado.senhaInicial, '');
  });
});
