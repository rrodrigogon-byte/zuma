import test from 'node:test';
import assert from 'node:assert/strict';
import { obterConsolidacaoGrupo, listarGruposEmpresariais } from './modules/empresas/consolidacao.js';
import { emitirEventoInterno, listarEventosInternos, obterMetricasEventosInternos } from './modules/a2/eventos.js';

test('Sincronização por evento interno entre sistemas corporativos Kytto emite e registra evento com 100% de sucesso', () => {
  const evento = emitirEventoInterno({
    origem: 'RH Kytto',
    destino: 'Operação Kytto',
    tipo: 'cadastro_atualizado',
    acao: 'sincronizar_colaborador',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    id: 'colab-001',
    payload: { nome: 'Natani Barbeira', cargo: 'Barbeira Especialista', comissaoBase: 40 }
  });

  assert.ok(evento.id.startsWith('evt-'));
  assert.equal(evento.origem, 'RH Kytto');
  assert.equal(evento.destino, 'Operação Kytto');
  assert.equal(evento.status, 'sincronizado');
  assert.equal(evento.tentativas, 1);

  const lista = listarEventosInternos({ empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' });
  assert.ok(lista.length >= 1);
  assert.equal(lista[0].origem, 'RH Kytto');

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

test('obterConsolidacaoGrupo calcula a DRE a partir das empresas do grupo e indica falta de dados', async () => {
  const empresaId = '31f70c83-9172-40c2-945f-9e793b5048be';
  const semMovimento = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const mockDb = { query: async (sql, params) => {
    if (sql.includes('FROM grupos_empresariais')) return { rows: [{ id: 'grupo-fixture', nome: 'Grupo teste', empresas: [
      { id: empresaId, nome: 'Varejo fixture' }, { id: semMovimento, nome: 'Serviços fixture' },
    ] }] };
    assert.ok([empresaId, semMovimento].includes(params[0]));
    if (params[0] === empresaId && sql.includes('FROM var_vendas')) return { rows: [{ total: 1000, count: 2 }] };
    if (params[0] === empresaId && sql.includes('FROM fin_lancamentos')) return { rows: [{ despesas: 200 }] };
    return { rows: [] };
  } };
  const consolidado = await obterConsolidacaoGrupo(mockDb, { grupoId: 'grupo-fixture', periodo: 'mes_atual' });
  assert.equal(consolidado.grupo.id, 'grupo-fixture');
  const fin = consolidado.consolidacaoFinanceira;
  assert.equal(fin.receitaBruta, 1000);
  assert.equal(fin.receitaLiquida, fin.receitaBruta - fin.deducoesImpostos);
  assert.equal(fin.lucroBruto, fin.receitaLiquida - fin.custosInsumosCMV);
  assert.equal(fin.lucroLiquido, 590);
  assert.equal(fin.dadoParcial, true);
  assert.equal(consolidado.empresas[0].participacaoNoGrupoPercentual, 100);
  assert.equal(consolidado.empresas[1].faturamento, 0);
  assert.equal(consolidado.empresas[1].dadoParcial, true);
});
