import test from 'node:test';
import assert from 'node:assert';
import { gerarHtmlLaudoOficial } from './modules/concreto/servico.js';
import { eventBus } from './modules/pizzaria/pizzaria-suite-completa.js';

test('1. Laudo NBR 5739: Contém Hash Criptográfico SHA-256 e Selo de Autenticidade Metrológica', async () => {
  const html = await gerarHtmlLaudoOficial('LOTE-NBR-2026-0812');
  assert.ok(html);
  assert.ok(html.includes('HASH SHA-256:'));
  assert.ok(html.includes('SELO DE AUTENTICIDADE METROLÓGICA'));
  assert.ok(html.includes('https://kytto.com.br/validar-laudo-concreto'));
  assert.ok(html.includes('CONFORME ABNT NBR 12655'));
});

test('2. KDS Pizzaria: Evento de status do pedido é registrado no eventBus', () => {
  let eventoCapturado = null;
  const listener = (dados) => {
    eventoCapturado = dados;
  };
  eventBus.on('pedido:status', listener);

  eventBus.registrarEvento('pedido:status', {
    pedidoId: 'ped-teste-001',
    statusAntigo: 'na_bancada',
    novoStatus: 'no_forno',
    praca: 'Forno a Lenha (400°C)'
  });

  assert.ok(eventoCapturado);
  assert.strictEqual(eventoCapturado.novoStatus, 'no_forno');
  assert.strictEqual(eventoCapturado.praca, 'Forno a Lenha (400°C)');

  eventBus.off('pedido:status', listener);
});
