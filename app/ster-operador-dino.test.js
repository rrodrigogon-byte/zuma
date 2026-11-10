import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';
import { sincronizarTenantsEquipes, TENANTS_OFICIAIS } from './tenant-provisioning.js';
import { perfilDoUsuario, operadorPodeNaBarbearia, papelLegadoDoRole } from './core/perfis-acesso.js';

test('Ster - Operadora de Balcão e Atendente da Dino Barbearia', async (t) => {
  // Executa o provisionamento
  provisionarEquipeDino();
  await sincronizarTenantsEquipes(null);

  await t.test('1. Cadastro da Ster em TENANTS_OFICIAIS e db().usuarios', () => {
    const d = db();
    const usuarioSter = (d.usuarios || []).find((u) => u.username === 'ster' || u.email === 'ster@barbeariadino.com.br');
    assert.ok(usuarioSter, 'Usuário ster deve existir em db().usuarios');
    assert.equal(usuarioSter.username, 'ster');
    assert.equal(usuarioSter.role, 'operador', 'O perfil de Ster deve ser operador');
    assert.equal(usuarioSter.empresaId, DINO_EMPRESA_CANONICA, 'Deve pertencer à Dino Barbearia');
    assert.equal(usuarioSter.ativo, true, 'Deve estar ativa no sistema');

    // Validação da senha padrão 123456
    const senhaValida = bcrypt.compareSync('123456', usuarioSter.senhaHash);
    assert.equal(senhaValida, true, 'Senha padrão 123456 deve conferir');
  });

  await t.test('2. Perfil de Acesso do Usuário Ster', () => {
    const d = db();
    const usuarioSter = (d.usuarios || []).find((u) => u.username === 'ster');
    const perfil = perfilDoUsuario(usuarioSter);
    assert.equal(perfil, 'operador', 'perfilDoUsuario deve retornar "operador"');
  });

  await t.test('3. Permissões Operacionais na Barbearia (Agenda, Comandas, Caixa, Clientes)', () => {
    // Leitura operacional liberada
    assert.equal(operadorPodeNaBarbearia('GET', '/agenda'), true, 'Operador pode consultar agenda');
    assert.equal(operadorPodeNaBarbearia('GET', '/comandas'), true, 'Operador pode consultar comandas');
    assert.equal(operadorPodeNaBarbearia('GET', '/clientes'), true, 'Operador pode consultar clientes');
    assert.equal(operadorPodeNaBarbearia('GET', '/operacao/caixas'), true, 'Operador pode consultar caixas');
    assert.equal(operadorPodeNaBarbearia('GET', '/estoque-revenda'), true, 'Operador pode consultar estoque');

    // Escrita operacional liberada
    assert.equal(operadorPodeNaBarbearia('POST', '/agenda'), true, 'Operador pode criar agendamento');
    assert.equal(operadorPodeNaBarbearia('POST', '/comandas'), true, 'Operador pode abrir comanda');
    assert.equal(operadorPodeNaBarbearia('POST', '/comandas/123/pagamentos'), true, 'Operador pode lançar pagamento');
    assert.equal(operadorPodeNaBarbearia('POST', '/clientes'), true, 'Operador pode cadastrar novo cliente');

    // Rotas confidenciais de diretoria bloqueadas
    assert.equal(operadorPodeNaBarbearia('GET', '/dre-gerencial'), false, 'Operador NÃO pode acessar DRE macro');
    assert.equal(operadorPodeNaBarbearia('GET', '/configuracoes-fiscais-diretoria'), false, 'Operador NÃO pode alterar fiscal da diretoria');
  });

  await t.test('4. Isolamento Multi-Tenant Estrito', () => {
    const d = db();
    const usuarioSter = (d.usuarios || []).find((u) => u.username === 'ster');
    assert.notEqual(usuarioSter.empresaId, '31f70c83-9172-40c2-945f-9e793b5048be', 'Ster NÃO deve pertencer a Stallone');
    assert.notEqual(usuarioSter.empresaId, '2e041110-db20-4fd1-8278-12bd3dead008', 'Ster NÃO deve pertencer a Agro Open');
    assert.equal(usuarioSter.empresaId, DINO_EMPRESA_CANONICA, 'Ster pertence exclusivamente a Barbearia Dino');
  });
});
