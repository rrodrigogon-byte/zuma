import assert from 'node:assert/strict';
import {
  normalizarPerfis,
  permissoesDoUsuario,
  resumoAcessoUsuario,
  temPermissao,
  validarConfiguracaoUsuario,
} from './app/perfis-usuarios-kytto.js';

const admin = resumoAcessoUsuario({ roles: ['admin'], ativo: true });
assert.equal(admin.tipoUsuario, 'administrador');
assert.ok(admin.perfis.includes('administrador'));
assert.equal(temPermissao({ ...admin, ativo: true }, 'fiscal', 'editar'), true);

const garcom = resumoAcessoUsuario({ tipoUsuario: 'garcom', perfis: ['garcom'], ativo: true });
assert.equal(temPermissao({ ...garcom, ativo: true }, 'mesas', 'criar'), true);
assert.equal(temPermissao({ ...garcom, ativo: true }, 'fiscal', 'ler'), false);
assert.equal(temPermissao({ ...garcom, ativo: true }, 'estoque', 'editar'), false);

const multiperfil = resumoAcessoUsuario({ tipoUsuario: 'gerente', perfis: ['gerente_operacional', 'gerente_estoque'], ativo: true });
assert.equal(temPermissao({ ...multiperfil, ativo: true }, 'clientes', 'editar'), true);
assert.equal(temPermissao({ ...multiperfil, ativo: true }, 'estoque', 'excluir'), true);
assert.equal(temPermissao({ ...multiperfil, ativo: true }, 'fiscal', 'editar'), false);

assert.deepEqual(normalizarPerfis(['admin', 'gerente-financeiro']), ['administrador', 'gerente_operacional']);
assert.throws(() => validarConfiguracaoUsuario({ tipoUsuario: 'inexistente', perfis: ['garcom'] }));
assert.deepEqual(validarConfiguracaoUsuario({ tipoUsuario: 'garcom', perfis: [] }).perfis, ['garcom']);
assert.equal(Object.keys(permissoesDoUsuario({ tipoUsuario: 'caixa', perfis: ['caixa'] })).includes('pagamentos'), true);

console.log('OK: perfis, permissões e compatibilidade de perfis legados validados.');
