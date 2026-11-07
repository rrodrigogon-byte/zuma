import test from 'node:test';
import assert from 'node:assert/strict';
import { listarEmpresas } from './modules/empresas/servico.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const EMPRESA_STALLONE_ID = 'e0e0ac01-8e50-4b61-8c79-de4aaa916da7';

test('Isolamento Multi-tenant: listarEmpresas com filtro de empresaId', async (t) => {
  const dbMock = {
    query: async (sql, params) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('FROM empresas')) {
        if (params && params.length > 0) {
          const idProcurado = params[0];
          if (idProcurado === EMPRESA_DINO_ID) {
            return {
              rows: [{
                id: EMPRESA_DINO_ID,
                nome: 'Barbearia Dino',
                nome_fantasia: 'Dino Barbearia',
                cnpj: '50073355000260',
                tipo_negocio: 'barbearia',
                ativa: true,
                total_lojas: 1
              }]
            };
          }
          if (idProcurado === EMPRESA_STALLONE_ID) {
            return {
              rows: [{
                id: EMPRESA_STALLONE_ID,
                nome: 'Stallone Suplementos',
                nome_fantasia: 'Stallone',
                cnpj: '12345678000199',
                tipo_negocio: 'loja',
                ativa: true,
                total_lojas: 1
              }]
            };
          }
          return { rows: [] };
        }

        return {
          rows: [
            { id: EMPRESA_DINO_ID, nome: 'Barbearia Dino', ativa: true, total_lojas: 1 },
            { id: EMPRESA_STALLONE_ID, nome: 'Stallone Suplementos', ativa: true, total_lojas: 1 },
            { id: 'holding-kytto-id', nome: 'Kytto Holding', ativa: true, total_lojas: 3 }
          ]
        };
      }
      return { rows: [] };
    }
  };

  await t.test('Superadmin sem filtro deve visualizar todas as empresas da holding', async () => {
    const todas = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: null });
    assert.ok(todas.length >= 3, 'Superadmin deve enxergar todas as empresas');
    const ids = todas.map(e => e.id);
    assert.ok(ids.includes(EMPRESA_DINO_ID), 'Superadmin deve ver Dino');
    assert.ok(ids.includes(EMPRESA_STALLONE_ID), 'Superadmin deve ver Stallone');
  });

  await t.test('Inquilino Dino deve receber única e exclusivamente a Barbearia Dino', async () => {
    const doDino = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: EMPRESA_DINO_ID });
    assert.strictEqual(doDino.length, 1, 'Inquilino Dino deve ver exatamente 1 empresa');
    assert.strictEqual(doDino[0].id, EMPRESA_DINO_ID, 'Empresa retornada deve ser exclusivamente a do Dino');
    assert.strictEqual(doDino[0].nome, 'Barbearia Dino');
  });

  await t.test('Inquilino Stallone deve receber única e exclusivamente a Stallone', async () => {
    const doStallone = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: EMPRESA_STALLONE_ID });
    assert.strictEqual(doStallone.length, 1, 'Stallone deve ver apenas sua empresa');
    assert.strictEqual(doStallone[0].id, EMPRESA_STALLONE_ID);
    assert.strictEqual(doStallone[0].nome, 'Stallone Suplementos');
  });
});

test('Segurança de Acesso e Permissões de Rotas Multi-tenant', async (t) => {
  const isPlatformAdmin = (user) => user?.platformAdmin === true || user?.role === 'super_admin';
  const obterEmpresaIdDoUsuario = (req) => req.user?.empresaId || null;

  const verificarAcessoEmpresa = (req, empresaIdAlvo) => {
    if (isPlatformAdmin(req.user)) return true;
    const empresaIdUser = obterEmpresaIdDoUsuario(req);
    if (!empresaIdUser) return false;
    return String(empresaIdUser).trim() === String(empresaIdAlvo).trim();
  };

  const userDino = { id: 'user-dino', role: 'admin', empresaId: EMPRESA_DINO_ID, platformAdmin: false };
  const userStallone = { id: 'user-stallone', role: 'admin', empresaId: EMPRESA_STALLONE_ID, platformAdmin: false };
  const userSuperadmin = { id: 'user-super', role: 'super_admin', platformAdmin: true };

  await t.test('Dino acessando Barbearia Dino -> PERMITIDO', () => {
    assert.strictEqual(verificarAcessoEmpresa({ user: userDino }, EMPRESA_DINO_ID), true);
  });

  await t.test('Dino tentando acessar Stallone -> BLOQUEADO (TENANT_ACCESS_DENIED)', () => {
    assert.strictEqual(verificarAcessoEmpresa({ user: userDino }, EMPRESA_STALLONE_ID), false);
  });

  await t.test('Stallone tentando acessar Dino -> BLOQUEADO (TENANT_ACCESS_DENIED)', () => {
    assert.strictEqual(verificarAcessoEmpresa({ user: userStallone }, EMPRESA_DINO_ID), false);
  });

  await t.test('Superadmin acessando qualquer empresa -> PERMITIDO', () => {
    assert.strictEqual(verificarAcessoEmpresa({ user: userSuperadmin }, EMPRESA_DINO_ID), true);
    assert.strictEqual(verificarAcessoEmpresa({ user: userSuperadmin }, EMPRESA_STALLONE_ID), true);
  });
});
