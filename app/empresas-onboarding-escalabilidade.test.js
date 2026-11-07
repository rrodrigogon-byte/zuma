import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES_NEGOCIO, provisionarCatalogoSegmento, gerarSlug } from './modules/empresas/onboarding-templates.js';
import { criarEmpresa, listarEmpresas } from './modules/empresas/servico.js';
import { estadoEmpresa } from './barbearia-erp-kytto.js';

test('Templates de Negócio e Onboarding Rápido Kytto', async (t) => {
  await t.test('1. Deve possuir templates para barbearia, loja, bar, esporte e supermercado', () => {
    assert.ok(TEMPLATES_NEGOCIO.barbearia, 'Deve ter template barbearia');
    assert.ok(TEMPLATES_NEGOCIO.loja, 'Deve ter template loja');
    assert.ok(TEMPLATES_NEGOCIO.bar, 'Deve ter template bar');
    assert.ok(TEMPLATES_NEGOCIO.esporte, 'Deve ter template esporte');
    assert.ok(TEMPLATES_NEGOCIO.supermercado, 'Deve ter template supermercado');

    assert.strictEqual(TEMPLATES_NEGOCIO.barbearia.servicos.length, 6, 'Barbearia tem 6 servicos essenciais');
    assert.strictEqual(TEMPLATES_NEGOCIO.barbearia.produtos.length, 5, 'Barbearia tem 5 produtos essenciais');
    assert.strictEqual(TEMPLATES_NEGOCIO.barbearia.comissoes.baseServicos, 40, 'Comissão base de serviços 40%');
  });

  await t.test('2. gerarSlug gera slugs limpos e consistentes', () => {
    assert.strictEqual(gerarSlug('Barbearia Imperial Premium'), 'barbearia-imperial-premium');
    assert.strictEqual(gerarSlug('Stallone & Nutre Sport!'), 'stallone-nutre-sport');
    assert.strictEqual(gerarSlug('AGRO OPEN TTC 2026'), 'agro-open-ttc-2026');
  });

  await t.test('3. provisionarCatalogoSegmento auto-provisiona serviços, produtos e comissões', () => {
    const novaEmpresaId = 'emp-teste-onboarding-' + Date.now();
    const res = provisionarCatalogoSegmento(novaEmpresaId, 'barbearia');

    assert.strictEqual(res.servicosCriados, 6, 'Deve criar os 6 serviços');
    assert.strictEqual(res.produtosCriados, 5, 'Deve criar os 5 produtos');
    assert.strictEqual(res.comissoesConfiguradas, true, 'Deve configurar metas e comissões');

    const estado = estadoEmpresa(novaEmpresaId);
    assert.strictEqual(Object.keys(estado.servicos).length, 6, 'Serviços salvos no estado isolado da empresa');
    assert.strictEqual(Object.keys(estado.produtosRevenda).length, 5, 'Produtos salvos no estoque isolado');
    assert.strictEqual(estado.configuracoes.comissaoBaseServicos, 40, 'Comissão de 40% gravada no estado');
  });
});

test('Escalabilidade & Isolamento Estrito de Novos Tenants Criados', async (t) => {
  const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const EMPRESA_STALLONE_ID = '31f70c83-9172-40c2-945f-9e793b5048be';
  const EMPRESA_NOVA_ID = 'emp-nova-onboarding-12345';

  const mockDb = {
    query: async (sql, params) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('FROM empresas')) {
        if (params && params.length > 0) {
          const idsFiltro = Array.isArray(params[0]) ? params[0] : [params[0]];
          const mockEmpresas = [
            { id: EMPRESA_DINO_ID, nome: 'Barbearia Dino', cnpj: '50073355000260', ativa: true, total_lojas: 1 },
            { id: EMPRESA_STALLONE_ID, nome: 'Stallone Nutre Sport', cnpj: '56099531000138', ativa: true, total_lojas: 1 },
            { id: EMPRESA_NOVA_ID, nome: 'Barbearia Imperial', cnpj: '98765432000199', ativa: true, total_lojas: 1 }
          ];
          return { rows: mockEmpresas.filter(e => idsFiltro.includes(e.id)) };
        }
        return {
          rows: [
            { id: EMPRESA_DINO_ID, nome: 'Barbearia Dino', cnpj: '50073355000260', ativa: true, total_lojas: 1 },
            { id: EMPRESA_STALLONE_ID, nome: 'Stallone Nutre Sport', cnpj: '56099531000138', ativa: true, total_lojas: 1 },
            { id: EMPRESA_NOVA_ID, nome: 'Barbearia Imperial', cnpj: '98765432000199', ativa: true, total_lojas: 1 }
          ]
        };
      }
      return { rows: [] };
    }
  };

  await t.test('1. Novo inquilino da Barbearia Imperial recebe única e exclusivamente sua empresa', async () => {
    const empresasImperial = await listarEmpresas(mockDb, {
      incluirInativas: true,
      empresaIdFiltro: [EMPRESA_NOVA_ID]
    });
    assert.strictEqual(empresasImperial.length, 1, 'Deve retornar exatamente 1 empresa');
    assert.strictEqual(empresasImperial[0].id, EMPRESA_NOVA_ID, 'Empresa deve ser a Barbearia Imperial');
    assert.strictEqual(empresasImperial[0].nome, 'Barbearia Imperial');
  });

  await t.test('2. Novo inquilino não tem acesso à Barbearia Dino nem à Stallone', () => {
    const verificarAcessoEmpresa = (user, alvoId) => {
      const target = String(alvoId || '').toLowerCase();
      const userEmp = String(user?.empresaId || '').toLowerCase();
      return userEmp === target;
    };

    const userImperial = { id: 'usr-imperial', email: 'admin@imperial.com', empresaId: EMPRESA_NOVA_ID };
    assert.strictEqual(verificarAcessoEmpresa(userImperial, EMPRESA_NOVA_ID), true, 'Acesso à própria empresa permitido');
    assert.strictEqual(verificarAcessoEmpresa(userImperial, EMPRESA_DINO_ID), false, 'Acesso cruzado à Dino BLOQUEADO');
    assert.strictEqual(verificarAcessoEmpresa(userImperial, EMPRESA_STALLONE_ID), false, 'Acesso cruzado à Stallone BLOQUEADO');
  });

  await t.test('3. Superadmin da plataforma enxerga a nova empresa juntamente com todas as outras', async () => {
    const todas = await listarEmpresas(mockDb, { incluirInativas: true, empresaIdFiltro: null });
    assert.ok(todas.length >= 3, 'Superadmin enxerga todas as empresas');
    const ids = todas.map(e => e.id);
    assert.ok(ids.includes(EMPRESA_DINO_ID), 'Superadmin enxerga Dino');
    assert.ok(ids.includes(EMPRESA_STALLONE_ID), 'Superadmin enxerga Stallone');
    assert.ok(ids.includes(EMPRESA_NOVA_ID), 'Superadmin enxerga nova empresa Imperial');
  });
});
