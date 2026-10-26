import test from 'node:test';
import assert from 'node:assert/strict';
import {
  carregarBaseConsolidada,
  consultarClientesRecuperacao,
  exportarCsvRecuperacao,
  invalidarCacheRecuperacao,
} from './dino-recuperacao-avec.js';

test('carregarBaseConsolidada: consolida o histórico do Avec com métricas e segmentação', async () => {
  invalidarCacheRecuperacao();
  const dados = await carregarBaseConsolidada({ dataReferencia: '2026-10-26' });
  assert.ok(Array.isArray(dados));
  assert.ok(dados.length > 1000, `Esperado mais de 1000 clientes, recebido ${dados.length}`);

  const cliente = dados.find((c) => c.nome && c.totalVisitas > 0);
  assert.ok(cliente);
  assert.ok(cliente.ultimaVisita);
  assert.ok(typeof cliente.diasSemVir === 'number');
  assert.ok(['essencial', 'premium', 'club'].includes(cliente.modeloRecomendado));
  assert.ok(cliente.mensagemWhatsapp.includes('Barbearia Dino'));
});

test('consultarClientesRecuperacao: filtro de coorte ativo Jan-Ago/2026 e ausente Set-Out/2026', async () => {
  const dados = await carregarBaseConsolidada({ dataReferencia: '2026-10-26' });

  // Coorte do reajuste de preços: ativo até agosto, ausente a partir de setembro
  const resultado = consultarClientesRecuperacao(dados, {
    deAtivo: '2026-01-01',
    ateAtivo: '2026-08-31',
    deAusente: '2026-09-01',
    ateAusente: '2026-10-31',
    pagina: 1,
    limite: 10,
  });

  assert.ok(resultado.total > 500, `Esperado mais de 500 clientes no churn de reajuste, recebido ${resultado.total}`);
  assert.equal(resultado.itens.length, 10);
  assert.ok(resultado.resumo.faturamentoPotencialRecuperavel > 10000);

  // Todo cliente retornado deve ter última visita antes de 2026-09-01
  for (const c of resultado.itens) {
    assert.ok(c.ultimaVisita < '2026-09-01', `Cliente ${c.nome} veio em ${c.ultimaVisita}`);
  }
});

test('consultarClientesRecuperacao: filtro por profissional e modelo Essencial vs Premium', async () => {
  const dados = await carregarBaseConsolidada({ dataReferencia: '2026-10-26' });

  const essencial = consultarClientesRecuperacao(dados, {
    modelo: 'essencial',
    limite: 20,
  });

  assert.ok(essencial.total > 100);
  for (const c of essencial.itens) {
    assert.equal(c.modeloRecomendado, 'essencial');
    assert.ok(c.mensagemWhatsapp.includes('Modelo Essencial'));
  }

  const premium = consultarClientesRecuperacao(dados, {
    modelo: 'premium',
    limite: 20,
  });

  assert.ok(premium.total > 100);
  for (const c of premium.itens) {
    assert.equal(c.modeloRecomendado, 'premium');
    assert.ok(c.mensagemWhatsapp.includes('Atendimento Premium'));
  }
});

test('exportarCsvRecuperacao: gera CSV com BOM, delimitador e mensagens prontas', async () => {
  const dados = await carregarBaseConsolidada({ dataReferencia: '2026-10-26' });
  const consulta = consultarClientesRecuperacao(dados, { limite: 5 });
  const csv = exportarCsvRecuperacao(consulta.itens);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Nome do Cliente;Telefone;CPF;Ultima Visita'));
  assert.ok(csv.includes('Barbearia Dino'));
});
