import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH;
if (!dbPath) throw new Error('Defina DB_PATH para executar este teste em ambiente isolado.');
fs.rmSync(dbPath, { force: true });

const cadastros = await import('./cadastros-mestres-kytto.js');

const empresa = cadastros.criarEmpresa({
  nome: 'Empresa de Teste Onboarding LTDA',
  nomeFantasia: 'Teste Onboarding',
  cnpj: '12.345.678/0001-95',
  email: 'teste@onboarding.local',
  endereco: 'Rua de Teste, 100, Tangará da Serra, MT',
  permitirEstoqueNegativo: false,
  criadoPorUsuarioId: 'usr-consultor-teste',
});

assert.equal(empresa.statusOnboarding, 'configuracao');
assert.equal(empresa.permitirEstoqueNegativo, false);
assert.ok(empresa.modulos.includes('pagamentos'));
assert.equal(empresa.cnpjNormalizado, '12345678000195');

const administrador = cadastros.criarUsuario(empresa.id, {
  nome: 'Admin da Empresa de Teste',
  email: 'admin@onboarding.local',
  senhaHash: 'hash-ficticio-isolado',
  tipoUsuario: 'administrador',
  perfis: ['administrador'],
});
assert.deepEqual(administrador.empresasAcessiveis, [empresa.id]);

const consultor = cadastros.criarUsuario(empresa.id, {
  nome: 'Consultor de Plataforma',
  email: 'consultor@onboarding.local',
  senhaHash: 'hash-ficticio-isolado',
  tipoUsuario: 'consultor',
  perfis: ['consultor'],
  platformConsultor: true,
});
assert.equal(consultor.platformConsultor, true);
assert.equal(cadastros.empresasDoUsuario(consultor)[0].id, empresa.id);

assert.throws(
  () => cadastros.criarEmpresa({ nome: 'Duplicada', cnpj: '12345678000195' }),
  /Já existe uma empresa cadastrada com este CNPJ/,
);

assert.throws(
  () => cadastros.criarEmpresa({ nome: 'Documento inválido', cnpj: '123' }),
  /CNPJ com 14 dígitos/,
);

const atualizada = cadastros.atualizarEmpresa(empresa.id, { statusOnboarding: 'pronta', permitirEstoqueNegativo: true });
assert.equal(atualizada.statusOnboarding, 'pronta');
assert.equal(atualizada.permitirEstoqueNegativo, true);

const estado = JSON.parse(fs.readFileSync(path.resolve(dbPath), 'utf8'));
assert.ok(estado.cadastrosMestresKytto.empresas[empresa.id]);
assert.ok(estado.cadastrosMestresKytto.usuarios[empresa.id][administrador.id]);
assert.ok(estado.cadastrosMestresKytto.usuarios[empresa.id][consultor.id]);

console.log(JSON.stringify({
  ok: true,
  empresaId: empresa.id,
  administradorId: administrador.id,
  consultorId: consultor.id,
  validacoes: 14,
}, null, 2));
