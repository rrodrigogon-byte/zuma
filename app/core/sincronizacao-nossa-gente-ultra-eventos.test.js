import test from 'node:test';
import assert from 'node:assert/strict';
import { kyttoEventBus } from './kytto-event-bus.js';
import { armazenarCopiaSegura, obterCopiaSegura, listarArquivosSeguros, obterEstatisticasArmazenamento } from './armazenamento-seguro.js';

test('1. Sincronização por Evento Interno: Nossa Gente -> Ultra (Colaborador)', () => {
  const evento = kyttoEventBus.emitir('cadastro.colaborador_sincronizado', {
    colaborador: 'Jhenyffer Andrade',
    cargo: 'Gerente Operacional',
    cpf: '123.456.789-00',
    status: 'ativo'
  }, {
    origem: 'Nossa Gente',
    destino: 'Ultra',
    empresaId: 'emp-dino-01',
    usuario: 'nossa-gente-sync'
  });

  assert.equal(evento.origem, 'Nossa Gente');
  assert.equal(evento.destino, 'Ultra');
  assert.equal(evento.status, 'sincronizado');
  assert.equal(evento.tipo, 'cadastro.colaborador_sincronizado');
});

test('2. Sincronização por Evento Interno: Auditoria CPF RM/BigQuery (Nossa Gente -> Ultra)', () => {
  const evento = kyttoEventBus.emitir('cpf.validado_rm_bigquery', {
    totalAuditados: 180,
    divergenciasCorrigidas: 0,
    conformidade: '100%'
  }, {
    origem: 'Nossa Gente',
    destino: 'Ultra',
    empresaId: 'emp-dino-01'
  });

  assert.equal(evento.origem, 'Nossa Gente');
  assert.equal(evento.destino, 'Ultra');
  assert.equal(evento.status, 'sincronizado');
});

test('3. Comanda Paga / Refinalizada no Ultra gera evento de comissão para a Folha do Nossa Gente', (t, done) => {
  // Listener para capturar o evento propagado
  const listener = (ev) => {
    if (ev.tipo === 'folha.comissao_apurada' && ev.dados?.profissionalNome === 'Dino Barbeiro') {
      assert.equal(ev.origem, 'Ultra');
      assert.equal(ev.destino, 'Nossa Gente');
      assert.equal(ev.dados.valorComissao, 50.00); // 50% de 100.00
      assert.equal(ev.dados.statusIntegracao, 'creditado_folha_nossagente');
      kyttoEventBus.removeListener('folha.comissao_apurada', listener);
      done();
    }
  };
  kyttoEventBus.on('folha.comissao_apurada', listener);

  // Emite comanda fechada
  kyttoEventBus.emitir('comanda.fechada', {
    comandaId: 'cmd-teste-folha-01',
    clienteNome: 'Cliente Evento',
    profissionalNome: 'Dino Barbeiro',
    totalFaturado: 100.00,
    totalPago: 100.00
  }, {
    origem: 'Ultra',
    destino: 'Nossa Gente',
    empresaId: 'emp-dino-01'
  });
});

test('4. Armazenamento Seguro de Imagens e Dados com Hashing Criptográfico SHA-256', () => {
  const payloadTeste = {
    comprovantePix: '00020126580014br.gov.bcb.pix...',
    valor: 150.00,
    cliente: 'Vinicius Batista',
    timestamp: '2026-11-10T14:00:00Z'
  };

  const registro = armazenarCopiaSegura(JSON.stringify(payloadTeste), {
    nomeOriginal: 'comprovante_pix_150.json',
    tipoMime: 'application/json',
    origem: 'Ultra',
    destino: 'Nossa Gente',
    empresaId: 'emp-dino-01'
  });

  assert.ok(registro.id.startsWith('sec-'));
  assert.equal(registro.sha256.length, 64); // SHA-256 hex é 64 chars
  assert.equal(registro.origem, 'Ultra');
  assert.equal(registro.destino, 'Nossa Gente');

  // Recupera e valida integridade
  const recuperado = obterCopiaSegura(registro.id);
  assert.ok(recuperado);
  assert.equal(recuperado.integridadeConfirmada, true);
  assert.equal(recuperado.sha256, registro.sha256);

  const dadosParseados = JSON.parse(recuperado.buffer.toString('utf-8'));
  assert.equal(dadosParseados.valor, 150.00);
});

test('5. Inventário e Métricas de Armazenamento Seguro', () => {
  const stats = obterEstatisticasArmazenamento();
  assert.ok(stats.totalArquivos >= 1);
  assert.equal(stats.conformidadeSha256, '100%');
  assert.equal(stats.statusStorage, 'ativo_e_seguro');

  const lista = listarArquivosSeguros({ limite: 10 });
  assert.ok(Array.isArray(lista));
  assert.ok(lista.length >= 1);
});
