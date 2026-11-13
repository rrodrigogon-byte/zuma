import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Blindagem de Módulos Financeiros e Tenant Scope', () => {
  test('TENANT_ADMIN_MODULES inclui todas as rotas financeiras e cadastrais necessárias', () => {
    const src = fs.readFileSync('app/server.js', 'utf8');
    const modulosNecessarios = [
      'contas-receber',
      'alertas-vencimento',
      'contas-pagar',
      'dino',
      'funcionarios',
      'fornecedores',
      'usuarios-mestres',
      'servicos',
      'produtos',
      'formas-pagamento',
      'empresas-plataforma',
      'empresa-ativa',
      'meu-perfil',
      'minha-empresa',
      'fluxo-caixa',
      'dre',
      'conciliacao',
      'tesouraria',
      'financeiro',
      'sorteios',
      'barbearia'
    ];

    for (const mod of modulosNecessarios) {
      assert.ok(
        src.includes(`'${mod}'`),
        `Módulo '${mod}' deve estar registrado em TENANT_ADMIN_MODULES no server.js`
      );
    }
  });

  test('FinanceiroEmpresa.jsx importa e renderiza DRE EBITDA, Conciliação TEF e Tesouraria', () => {
    const front = fs.readFileSync('web/src/pages/admin/dino/FinanceiroEmpresa.jsx', 'utf8');
    assert.ok(front.includes('DreEbitdaCompletoPanel'), 'Deve importar DreEbitdaCompletoPanel');
    assert.ok(front.includes('ConciliacaoTefPixPanel'), 'Deve importar ConciliacaoTefPixPanel');
    assert.ok(front.includes('TesourariaCofrePanel'), 'Deve importar TesourariaCofrePanel');
    assert.ok(front.includes("abaAnalitica === 'dre_ebitda'"), 'Deve renderizar aba dre_ebitda');
    assert.ok(front.includes("abaAnalitica === 'conciliacao_tef'"), 'Deve renderizar aba conciliacao_tef');
    assert.ok(front.includes("abaAnalitica === 'tesouraria'"), 'Deve renderizar aba tesouraria');
    assert.ok(!front.includes("'Ver os 71 vencidos'"), 'Não deve ter número de vencidos hardcoded');
  });
});
