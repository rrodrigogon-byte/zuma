import test from 'node:test';
import assert from 'node:assert';
import {
  obterMetricasCockpit360,
  dispararFechamentoExecutivoWhatsApp,
  TELEFONE_GESTAO_RODRIGO
} from './core/cockpit-360-hub.js';

test('1. Cockpit Executivo 360: Consolidação das 4 verticais de negócio', () => {
  const metricas = obterMetricasCockpit360();

  assert.strictEqual(metricas.statusEcossistema, '100% Operacional em PRD');
  assert.strictEqual(metricas.motorIa, 'Motor KyttoIA 2.5 Flash Industrial Engine');
  assert.ok(metricas.verticais.barbeariaDino);
  assert.ok(metricas.verticais.serranoConcreto);
  assert.ok(metricas.verticais.palatarePizzaria);
  assert.ok(metricas.verticais.supermercadoKytto);

  // Validação dos dados consolidados
  assert.ok(metricas.resumoFinanceiro.faturamentoTotalEstimado > 0);
  assert.ok(metricas.resumoFinanceiro.taxaMdrEstimada > 0);
  assert.ok(metricas.resumoFinanceiro.liquidoEstimado > 0);
  assert.strictEqual(
    metricas.resumoFinanceiro.liquidoEstimado,
    Number((metricas.resumoFinanceiro.faturamentoTotalEstimado - metricas.resumoFinanceiro.taxaMdrEstimada).toFixed(2))
  );
});

test('2. Cockpit Executivo 360: Disparo do Fechamento Noturno para o WhatsApp de Gestão', async () => {
  const res = await dispararFechamentoExecutivoWhatsApp(TELEFONE_GESTAO_RODRIGO);

  assert.strictEqual(res.ok, true);
  assert.ok(res.mensagem.includes(TELEFONE_GESTAO_RODRIGO));
  assert.ok(res.metricas);
  assert.ok(res.metricas.verticais.barbeariaDino);
  assert.ok(res.metricas.verticais.serranoConcreto);
});
