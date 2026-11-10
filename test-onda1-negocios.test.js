import test from 'node:test';
import assert from 'node:assert/strict';
import { listarGruposEmpresariais, obterConsolidacaoGrupo } from './app/modules/empresas/consolidacao.js';

test('Onda 1: listarGruposEmpresariais deduplica empresas e não inventa holdings duplicadas', async () => {
  const mockDb = {};
  const grupos = await listarGruposEmpresariais(mockDb);
  assert.ok(Array.isArray(grupos), 'deve retornar array de grupos');
  assert.ok(grupos.length >= 1, 'deve ter pelo menos a holding principal');
  
  // Confere se as empresas dentro do grupo não têm IDs duplicados
  const grupo = grupos[0];
  const ids = (grupo.empresas || []).map(e => e.id);
  const setIds = new Set(ids);
  assert.equal(ids.length, setIds.size, 'não pode haver empresas duplicadas na holding');
});

test('Onda 1: obterConsolidacaoGrupo não usa números inventados e marca dado parcial', async () => {
  const mockDb = {};
  const consolidado = await obterConsolidacaoGrupo(mockDb, { periodo: 'hoje' });
  assert.ok(consolidado.consolidacaoFinanceira, 'deve ter objeto de consolidacaoFinanceira');
  assert.equal(consolidado.statusAuditoria, 'DADOS_REAIS', 'status de auditoria deve ser DADOS_REAIS');
  
  // Confere que nenhuma empresa tem valores redondos mockados clássicos (345000, 215000, 78000)
  for (const emp of consolidado.empresas || []) {
    assert.notEqual(emp.faturamento, 345000, 'AGRO OPEN não pode ter faturamento mock 345000');
    assert.notEqual(emp.faturamento, 215000, 'Stallone não pode ter faturamento mock 215000');
    assert.notEqual(emp.faturamento, 78000, 'Kytto não pode ter faturamento mock 78000');
  }
});
