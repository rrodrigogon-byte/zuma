import test from 'node:test';
import assert from 'node:assert/strict';
import { obterConsolidacaoGrupo, listarGruposEmpresariais } from './modules/empresas/consolidacao.js';
import { emitirEventoInterno, listarEventosInternos, obterMetricasEventosInternos } from './modules/a2/eventos.js';

test('Sincronização por evento interno entre Nossa Gente e Ultra emite e registra evento com 100% de sucesso', () => {
  const evento = emitirEventoInterno({
    origem: 'Nossa Gente',
    destino: 'Ultra',
    tipo: 'cadastro_atualizado',
    acao: 'sincronizar_colaborador',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    id: 'colab-001',
    payload: { nome: 'Natani Barbeira', cargo: 'Barbeira Especialista', comissaoBase: 40 }
  });

  assert.ok(evento.id.startsWith('evt-'));
  assert.equal(evento.origem, 'Nossa Gente');
  assert.equal(evento.destino, 'Ultra');
  assert.equal(evento.status, 'sincronizado');
  assert.equal(evento.tentativas, 1);

  const lista = listarEventosInternos({ empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' });
  assert.ok(lista.length >= 1);
  assert.equal(lista[0].origem, 'Nossa Gente');

  const metricas = obterMetricasEventosInternos();
  assert.equal(metricas.taxaSucesso, 100.0);
  assert.equal(metricas.statusFila, 'saudavel');
});

test('listarGruposEmpresariais retorna holdings com empresas associadas', async () => {
  const mockDb = { query: async () => ({ rows: [] }) };
  const grupos = await listarGruposEmpresariais(mockDb);

  assert.ok(Array.isArray(grupos));
  assert.ok(grupos.length >= 1);
  assert.equal(grupos[0].id, 'grp-kytto-silvester-01');
  assert.ok(grupos[0].nome.includes('Silvester Holding') || grupos[0].nome.includes('Kytto'));
});

test('obterConsolidacaoGrupo calcula DRE consolidado e metricas multi-business', async () => {
  const mockDb = { query: async () => ({ rows: [] }) };
  const consolidado = await obterConsolidacaoGrupo(mockDb, { periodo: 'mes_atual' });

  assert.ok(consolidado.grupo);
  assert.ok(consolidado.consolidacaoFinanceira);
  assert.ok(consolidado.consolidacaoFinanceira.receitaBruta > 0);
  assert.ok(consolidado.consolidacaoFinanceira.lucroLiquido > 0);
  assert.ok(consolidado.consolidacaoFinanceira.margemLiquidaPercentual > 0);

  // Validação DRE
  const fin = consolidado.consolidacaoFinanceira;
  assert.equal(fin.receitaLiquida, fin.receitaBruta - fin.deducoesImpostos);
  assert.equal(fin.lucroBruto, fin.receitaLiquida - fin.custoInsumosMercadorias);

  // Validação Multi-Business
  assert.ok(Array.isArray(consolidado.segmentosMultiBusiness));
  assert.ok(consolidado.segmentosMultiBusiness.some(s => s.tipo === 'barbearia_beleza'));
  assert.ok(consolidado.segmentosMultiBusiness.some(s => s.tipo === 'ecommerce_omnichannel'));

  // Validação de Empresas
  assert.ok(Array.isArray(consolidado.empresas));
  assert.ok(consolidado.empresas.length >= 1);
  assert.ok(consolidado.empresas[0].faturamento > 0);
  assert.ok(consolidado.empresas[0].participacaoNoGrupoPercentual > 0);
});
