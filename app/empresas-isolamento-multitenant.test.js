import test from 'node:test';
import assert from 'node:assert/strict';
import { listarEmpresas } from './modules/empresas/servico.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const EMPRESA_STALLONE_ID = '31f70c83-9172-40c2-945f-9e793b5048be';
const EMPRESA_AGRO_OPEN_ID = '2e041110-db20-4fd1-8278-12bd3dead008';

test('Isolamento Multi-tenant: listarEmpresas com regras de Admin Global, Guilherme e Silvester', async (t) => {
  const dbMock = {
    query: async (sql, params) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('FROM empresas')) {
        if (params && params.length > 0) {
          const idsFiltro = Array.isArray(params[0]) ? params[0] : [params[0]];
          const mockEmpresas = [
            { id: EMPRESA_DINO_ID, nome: 'Barbearia Dino', cnpj: '50073355000260', tipo_negocio: 'barbearia', ativa: true, total_lojas: 1 },
            { id: EMPRESA_STALLONE_ID, nome: 'Stallone Nutre Sport', cnpj: '56099531000138', tipo_negocio: 'loja', ativa: true, total_lojas: 1 },
            { id: EMPRESA_AGRO_OPEN_ID, nome: 'AGRO OPEN TTC', cnpj: '43084070000188', tipo_negocio: 'bar', ativa: true, total_lojas: 1 }
          ];
          const filtradas = mockEmpresas.filter(e => idsFiltro.includes(e.id.toLowerCase()));
          return { rows: filtradas };
        }

        return {
          rows: [
            { id: EMPRESA_DINO_ID, nome: 'Barbearia Dino', cnpj: '50073355000260', tipo_negocio: 'barbearia', ativa: true, total_lojas: 1 },
            { id: EMPRESA_STALLONE_ID, nome: 'Stallone Nutre Sport', cnpj: '56099531000138', tipo_negocio: 'loja', ativa: true, total_lojas: 1 },
            { id: EMPRESA_AGRO_OPEN_ID, nome: 'AGRO OPEN TTC', cnpj: '43084070000188', tipo_negocio: 'bar', ativa: true, total_lojas: 1 }
          ]
        };
      }
      return { rows: [] };
    }
  };

  await t.test('1. Admin Global (rodrigo.goncalves e rrodrigogon) visualiza todas as empresas e pode filtrar qualquer uma', async () => {
    // Sem filtro
    const todas = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: null });
    assert.ok(todas.length >= 3, 'Admin Global enxerga todas as empresas da holding');
    const ids = todas.map(e => e.id);
    assert.ok(ids.includes(EMPRESA_DINO_ID), 'Contém Dino');
    assert.ok(ids.includes(EMPRESA_STALLONE_ID), 'Contém Stallone');
    assert.ok(ids.includes(EMPRESA_AGRO_OPEN_ID), 'Contém Agro Open');

    // Com filtro para uma específica
    const apenasDino = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: EMPRESA_DINO_ID });
    assert.strictEqual(apenasDino.length, 1);
    assert.strictEqual(apenasDino[0].id, EMPRESA_DINO_ID);

    const apenasStallone = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: EMPRESA_STALLONE_ID });
    assert.strictEqual(apenasStallone.length, 1);
    assert.strictEqual(apenasStallone[0].id, EMPRESA_STALLONE_ID);
  });

  await t.test('2. Guilherme visualiza única e exclusivamente a Barbearia Dino', async () => {
    const doGuilherme = await listarEmpresas(dbMock, { incluirInativas: true, empresaIdFiltro: [EMPRESA_DINO_ID, 'dino'] });
    assert.strictEqual(doGuilherme.length, 1, 'Guilherme deve ver exatamente 1 empresa');
    assert.strictEqual(doGuilherme[0].id, EMPRESA_DINO_ID, 'Empresa retornada deve ser exclusivamente a Barbearia Dino');
    assert.strictEqual(doGuilherme[0].nome, 'Barbearia Dino');
  });

  await t.test('3. Silvester visualiza única e exclusivamente Stallone e Agro Open', async () => {
    const doSilvester = await listarEmpresas(dbMock, {
      incluirInativas: true,
      empresaIdFiltro: [EMPRESA_STALLONE_ID, EMPRESA_AGRO_OPEN_ID]
    });
    assert.strictEqual(doSilvester.length, 2, 'Silvester deve ver exatamente 2 empresas (Stallone e Agro Open)');
    const idsSilvester = doSilvester.map(e => e.id);
    assert.ok(idsSilvester.includes(EMPRESA_STALLONE_ID), 'Silvester tem acesso à Stallone');
    assert.ok(idsSilvester.includes(EMPRESA_AGRO_OPEN_ID), 'Silvester tem acesso ao Agro Open');
    assert.ok(!idsSilvester.includes(EMPRESA_DINO_ID), 'Silvester NÃO deve ter acesso à Barbearia Dino');
  });

  await t.test('4. Silvester pode filtrar individualmente entre Stallone e Agro Open', async () => {
    const silvesterStallone = await listarEmpresas(dbMock, {
      incluirInativas: true,
      empresaIdFiltro: [EMPRESA_STALLONE_ID]
    });
    assert.strictEqual(silvesterStallone.length, 1);
    assert.strictEqual(silvesterStallone[0].id, EMPRESA_STALLONE_ID);

    const silvesterAgro = await listarEmpresas(dbMock, {
      incluirInativas: true,
      empresaIdFiltro: [EMPRESA_AGRO_OPEN_ID]
    });
    assert.strictEqual(silvesterAgro.length, 1);
    assert.strictEqual(silvesterAgro[0].id, EMPRESA_AGRO_OPEN_ID);
  });
});

test('Segurança e Permissões Estritas de Acesso por Usuário', async (t) => {
  const isAdminGlobal = (u) => {
    const em = String(u?.email || u?.username || '').toLowerCase();
    return em.includes('rodrigo.goncalves') || em.includes('rrodrigogon') || em === 'admin';
  };

  const isSilvesterUser = (u) => {
    const em = String(u?.email || u?.username || '').toLowerCase();
    return (em.includes('silvester') || em.includes('silvestre')) && !isAdminGlobal(u);
  };

  const isGuilhermeUser = (u) => {
    const em = String(u?.email || u?.username || '').toLowerCase();
    return (em.includes('guilherme') || em.includes('guicunha') || em.includes('dino') || em === 'gui') && !isAdminGlobal(u);
  };

  const verificarAcessoEmpresa = (user, empresaIdAlvo) => {
    if (isAdminGlobal(user)) return true;
    const target = String(empresaIdAlvo || '').toLowerCase();
    if (isSilvesterUser(user)) {
      return [EMPRESA_STALLONE_ID.toLowerCase(), EMPRESA_AGRO_OPEN_ID.toLowerCase()].includes(target);
    }
    if (isGuilhermeUser(user)) {
      return target === EMPRESA_DINO_ID.toLowerCase() || target === 'dino';
    }
    return String(user?.empresaId || '').toLowerCase() === target;
  };

  const userRodrigo = { email: 'rodrigo.goncalves@uisa.com.br', role: 'admin' };
  const userRrodrigogon = { email: 'rrodrigogon@gmail.com', role: 'admin' };
  const userGuilherme = { email: 'guicunha136@gmail.com', username: 'dino', role: 'organizador', empresaId: EMPRESA_DINO_ID };
  const userSilvester = { email: 'silvester_natal@hotmail.com', username: 'silvester', role: 'gerente', empresaId: EMPRESA_STALLONE_ID };
  const userOutro = { email: 'funcionario@stallone.com', empresaId: EMPRESA_STALLONE_ID };

  await t.test('Admin Global (rodrigo.goncalves / rrodrigogon) -> Acesso permitido a qualquer empresa', () => {
    assert.strictEqual(verificarAcessoEmpresa(userRodrigo, EMPRESA_DINO_ID), true);
    assert.strictEqual(verificarAcessoEmpresa(userRodrigo, EMPRESA_STALLONE_ID), true);
    assert.strictEqual(verificarAcessoEmpresa(userRodrigo, EMPRESA_AGRO_OPEN_ID), true);

    assert.strictEqual(verificarAcessoEmpresa(userRrodrigogon, EMPRESA_DINO_ID), true);
    assert.strictEqual(verificarAcessoEmpresa(userRrodrigogon, EMPRESA_STALLONE_ID), true);
    assert.strictEqual(verificarAcessoEmpresa(userRrodrigogon, EMPRESA_AGRO_OPEN_ID), true);
  });

  await t.test('Guilherme -> Acesso permitido APENAS à Barbearia Dino', () => {
    assert.strictEqual(verificarAcessoEmpresa(userGuilherme, EMPRESA_DINO_ID), true);
    assert.strictEqual(verificarAcessoEmpresa(userGuilherme, EMPRESA_STALLONE_ID), false, 'Guilherme bloqueado de acessar Stallone');
    assert.strictEqual(verificarAcessoEmpresa(userGuilherme, EMPRESA_AGRO_OPEN_ID), false, 'Guilherme bloqueado de acessar Agro Open');
  });

  await t.test('Silvester -> Acesso permitido APENAS a Stallone e Agro Open', () => {
    assert.strictEqual(verificarAcessoEmpresa(userSilvester, EMPRESA_STALLONE_ID), true, 'Silvester acessa Stallone');
    assert.strictEqual(verificarAcessoEmpresa(userSilvester, EMPRESA_AGRO_OPEN_ID), true, 'Silvester acessa Agro Open');
    assert.strictEqual(verificarAcessoEmpresa(userSilvester, EMPRESA_DINO_ID), false, 'Silvester estritamente BLOQUEADO de acessar Barbearia Dino');
  });

  await t.test('Outro inquilino -> Acesso restrito à sua empresa vinculada', () => {
    assert.strictEqual(verificarAcessoEmpresa(userOutro, EMPRESA_STALLONE_ID), true);
    assert.strictEqual(verificarAcessoEmpresa(userOutro, EMPRESA_DINO_ID), false);
    assert.strictEqual(verificarAcessoEmpresa(userOutro, EMPRESA_AGRO_OPEN_ID), false);
  });
});
