import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidarBriefingMatinalEquipe, formatarMensagemBriefingMatinal } from './core/automacao-resumo-gestao.js';
import { kyttoEventBus } from './core/kytto-event-bus.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

test('Briefing Matinal da Equipe: consolidação e geração de mensagem formatada', () => {
  const briefing = consolidarBriefingMatinalEquipe(EMPRESA_DINO_ID, '2026-11-09');

  assert.ok(briefing, 'Briefing deve ser gerado');
  assert.equal(briefing.empresaId, EMPRESA_DINO_ID);
  assert.ok(typeof briefing.totalAgendamentos === 'number', 'Deve calcular total de agendamentos');
  assert.ok(Array.isArray(briefing.equipe), 'Deve listar equipe de profissionais');

  const mensagem = formatarMensagemBriefingMatinal(briefing);
  assert.ok(mensagem.includes('BRIEFING MATINAL DA EQUIPE'), 'Mensagem deve conter cabeçalho');
  assert.ok(mensagem.includes('Agenda Total do Dia'), 'Mensagem deve conter resumo da agenda');
  assert.ok(mensagem.includes('Barbearia Dino · Kytto ERP'), 'Mensagem deve referenciar o ERP');
});

test('Barramento de Eventos: emissão e captura de briefing matinal', () => {
  let eventoCapturado = null;
  const listener = (evento) => {
    eventoCapturado = evento;
  };

  kyttoEventBus.on('agenda.briefing_matinal', listener);

  kyttoEventBus.emitir('agenda.briefing_matinal', {
    data: '2026-11-09',
    totalAgendamentos: 8
  }, { empresaId: EMPRESA_DINO_ID, origem: 'teste-unitario' });

  assert.ok(eventoCapturado, 'Evento deve ser capturado pelo listener');
  assert.equal(eventoCapturado.dados.totalAgendamentos, 8);
  assert.equal(eventoCapturado.empresaId, EMPRESA_DINO_ID);

  kyttoEventBus.off('agenda.briefing_matinal', listener);
});
