import test from 'node:test';
import assert from 'node:assert/strict';
import { kyttoEventBus, TOPICOS_KYTTO } from './core/kytto-event-bus.js';
import { armazenarCopiaSegura, listarArquivosSeguros, obterEstatisticasArmazenamento } from './core/armazenamento-seguro.js';

test('1. Sincronização por Evento Interno: Registro e despacho no KyttoEventBus', () => {
  const evento = kyttoEventBus.emitir(TOPICOS_KYTTO.CADASTRO_SINCRONIZADO, {
    colaboradorId: 'colab-1029',
    nome: 'Bruno Mendes Barbeiro',
    cpf: '044.***.***-21',
    cargo: 'Barbeiro Especialista'
  }, {
    origem: 'Nossa Gente',
    destino: 'Ultra',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
  });

  assert.ok(evento.id.startsWith('evt-'));
  assert.equal(evento.origem, 'Nossa Gente');
  assert.equal(evento.destino, 'Ultra');
  assert.equal(evento.status, 'sincronizado');

  const eventos = kyttoEventBus.listarEventos({ origem: 'Nossa Gente', limite: 10 });
  assert.ok(eventos.length > 0);
  assert.ok(eventos.some(e => e.origem === 'Nossa Gente'));

  const metricas = kyttoEventBus.obterMetricas();
  assert.ok(metricas.totalEventos > 0);
  assert.ok(metricas.eventosNossaGenteUltra > 0);
  assert.equal(metricas.protocolo, 'Sincronização por Evento Interno (EDA)');
});

test('2. Armazenamento Seguro: Cópia segura com Hash SHA-256 e metadados autorizados', () => {
  const payloadExemplo = JSON.stringify({
    documento: 'Comprovante Fechamento Caixa Dino',
    data: '2026-11-14',
    total: 1850.00,
    nsu: '984210772-001'
  });

  const registro = armazenarCopiaSegura(payloadExemplo, {
    nomeOriginal: 'fechamento_dino_14112026.json',
    tipoMime: 'application/json',
    origem: 'Ultra',
    destino: 'Nossa Gente',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    entidadeId: 'caixa-1411'
  });

  assert.ok(registro.id.startsWith('sec-'));
  assert.equal(registro.sha256.length, 64);
  assert.equal(registro.origem, 'Ultra');
  assert.equal(registro.destino, 'Nossa Gente');

  const arquivos = listarArquivosSeguros({ empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' });
  assert.ok(arquivos.length > 0);

  const stats = obterEstatisticasArmazenamento();
  assert.ok(stats.totalArquivos > 0);
  assert.ok(stats.totalBytes > 0);
});
