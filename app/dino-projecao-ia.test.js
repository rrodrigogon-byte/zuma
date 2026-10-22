import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeForecastWithAi,
  buildDeterministicAnalysis,
  createDinoForecastAiHandler,
  simulateForecast,
  snapshotForecast,
} from './dino-projecao-ia.js';

const empresaId = '11111111-1111-4111-8111-111111111111';
const lojaId = '22222222-2222-4222-8222-222222222222';
const projection = {
  mes: '2026-10',
  horizonte: 2,
  qualidade: { nivel: 'media', rotulo: 'Média', mesesAnalisados: 6, mesesComDados: 4, dataCorte: '2026-10-22', fontes: { servicos: 12, revenda: 4 }, explicacao: 'Série de teste.' },
  atual: {
    tipo: 'atual', realizado: 80000, servicos: 70000, revenda: 10000, agendaFutura: 12000,
    atendimentosConcluidos: 90, atendimentosAgendados: 12, ticketMedio: 777.78,
    projetadoServicos: 88000, projetadoRevenda: 13000, projecao: 101000,
    conservador: 92000, favoravel: 110000, metaReceita: 105000, diferencaMeta: -4000, noRitmo: false,
  },
  previsoes: [
    { mes: '2026-10', tipo: 'atual', realizado: 80000, projecao: 101000, conservador: 92000, favoravel: 110000, agendaFutura: 12000, metaReceita: 105000, diferencaMeta: -4000 },
    { mes: '2026-11', tipo: 'futuro', realizado: 0, projecao: 104000, conservador: 95000, favoravel: 113000, agendaFutura: 0, metaReceita: 105000, diferencaMeta: -1000 },
  ],
  historico: [
    { mes: '2026-08', realizado: 92000, servicos: 85000, revenda: 7000, atendimentosConcluidos: 102, ticketMedio: 833.33 },
    { mes: '2026-09', realizado: 86000, servicos: 76000, revenda: 10000, atendimentosConcluidos: 96, ticketMedio: 791.67 },
  ],
  profissionais: [
    { profissionalId: 'internal-1', nome: 'Profissional A', ativo: true, meta: { receita: 50000, atendimentos: 55 }, realizado: 36000, agendaFutura: 4000, projecao: 46000, diferencaMeta: -4000, noRitmo: false, atendimentosConcluidos: 40, atendimentosAgendados: 5, ticketMedio: 900, ocupacao: 0.62, tendencia: 'queda', historicoMeses: 4 },
  ],
  fatores: [
    { tipo: 'meta', severidade: 'alerta', titulo: 'Risco de meta', evidencia: 'A projeção está abaixo da meta configurada.', impacto: -4000 },
    { tipo: 'tendencia', severidade: 'alerta', titulo: 'Faturamento em queda recente', evidencia: 'A série caiu no último mês.', impacto: -6000 },
  ],
  acoes: [{ prioridade: 'alta', titulo: 'Revisar produção adicional', descricao: 'Compare a agenda e o ticket por profissional.', aba: 'Ocupação e metas' }],
};

function missingCommerceDb() {
  const missing = () => { throw Object.assign(new Error('table missing'), { code: '42P01' }); };
  return { queryRead: missing, query: missing };
}

async function withoutAiProviders(callback) {
  const names = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_VERTEX_PROJECT_ID'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  names.forEach(name => { delete process.env[name]; });
  try { return await callback(); } finally {
    names.forEach(name => {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    });
  }
}

test('snapshot remove ids internos e conserva fatos numéricos necessários', () => {
  const snapshot = snapshotForecast(projection);
  assert.equal(snapshot.mes, '2026-10');
  assert.equal(snapshot.profissionais[0].nome, 'Profissional A');
  assert.equal(Object.hasOwn(snapshot.profissionais[0], 'profissionalId'), false);
  assert.equal(snapshot.atual.projecao, 101000);
});

test('fallback determinístico explica risco de meta e cria alerta sem provedor', () => {
  const analysis = buildDeterministicAnalysis(projection);
  assert.equal(analysis.status, 'fallback');
  assert.equal(analysis.tendencia, 'queda');
  assert.match(analysis.resumoExecutivo, /101/);
  assert.ok(analysis.alertas.some(item => item.tipo === 'meta'));
  assert.ok(analysis.recomendacoes.length > 0);
});

test('simulador calcula cenário sem alterar a projeção original', () => {
  const result = simulateForecast(projection, { atendimentos: 1.2, ticket: 1.1, revenda: 0.9, ocupacao: 1.15 });
  assert.equal(result.parametros.atendimentos, 1.2);
  assert.equal(result.base.total, 101000);
  assert.ok(result.resultado.total > 0);
  assert.match(result.aviso, /não altera/);
});

test('análise com banco/schema ausente retorna fallback seguro e não falha a tela', async () => {
  const result = await withoutAiProviders(() => analyzeForecastWithAi({ db: missingCommerceDb(), empresaId, lojaId, projection }));
  assert.equal(result.status, 'fallback');
  assert.equal(result.source, 'deterministic');
  assert.equal(result.persisted, false);
  assert.equal(Array.isArray(result.alerts), true);
  assert.equal(result.errorCode, 'NO_PROVIDER_CONFIGURED');
});

test('resposta JSON da IA vira leitura pronta sem substituir fatos determinísticos', async () => {
  const result = await analyzeForecastWithAi({
    db: missingCommerceDb(),
    empresaId,
    lojaId,
    projection,
    runAiTaskImpl: async (task, options) => {
      assert.equal(task, 'previsao_gerencial');
      assert.match(options.user, /SNAPSHOT/);
      return { data: { resumoExecutivo: 'Acompanhe a queda recente e a meta.', tendencia: 'queda', causas: [{ tipo: 'tendencia', titulo: 'Queda observada', explicacao: 'O histórico recente recuou.' }], recomendacoes: [{ prioridade: 'alta', titulo: 'Revisar agenda', descricao: 'Ative a lista de espera.', aba: 'Lista de espera' }], limitacoes: ['Série curta.'] }, provider: 'gemini', model: 'gemini-test' };
    },
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'ai');
  assert.equal(result.provider, 'gemini');
  assert.equal(result.analysis.fatos.projecao, 101000);
  assert.equal(result.analysis.resumoExecutivo, 'Acompanhe a queda recente e a meta.');
  assert.ok(result.analysis.alertas.some(item => item.tipo === 'meta'));
});

test('persistência do insight tipa o status para evitar parâmetro PostgreSQL ambíguo', async () => {
  const queries = [];
  const db = {
    async queryRead() { return { rows: [] }; },
    async query(sql) {
      queries.push(sql);
      if (sql.includes('INSERT INTO dino_forecast_ai_insights')) {
        assert.match(sql, /\$6::varchar,.*CASE WHEN \$6::varchar IN \('ready', 'fallback'\)/s);
        return { rows: [{ id: '33333333-3333-4333-8333-333333333333', gerado_em: new Date().toISOString() }] };
      }
      return { rows: [] };
    },
  };
  const result = await analyzeForecastWithAi({
    db,
    empresaId,
    lojaId,
    projection,
    runAiTaskImpl: async () => ({ data: { resumoExecutivo: 'Leitura tipada.', tendencia: 'queda', causas: [], recomendacoes: [] }, provider: 'gemini', model: 'test' }),
  });
  assert.equal(result.persisted, true);
  assert.ok(queries.some(sql => sql.includes('INSERT INTO dino_forecast_ai_insights')));
});

test('feature desligada devolve fallback sem chamar o executor de IA', async () => {
  let chamadas = 0;
  const result = await analyzeForecastWithAi({ db: missingCommerceDb(), empresaId, lojaId, projection, allowAi: false, runAiTaskImpl: async () => { chamadas += 1; return {}; } });
  assert.equal(result.status, 'fallback');
  assert.equal(result.reason, 'feature_disabled');
  assert.equal(chamadas, 0);
});

test('handler do worker não confirma tarefa sem persistência do insight', async () => {
  const handler = createDinoForecastAiHandler({ db: missingCommerceDb() });
  await assert.rejects(
    () => withoutAiProviders(() => handler({ empresa_id: empresaId, loja_id: lojaId, payload_sanitizado: { mes: projection.mes, projection: snapshotForecast(projection) } })),
    error => error.code === 'DINO_FORECAST_INSIGHT_PERSIST_FAILED' && error.retryable === true,
  );
});
