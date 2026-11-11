import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchAgendaName } from './core/whatsapp-ai-tools.js';
import { verificarStatusBarbeiroDino, BARBEIROS_ATIVOS_DINO } from './core/barbershop-agenda.js';
import { confirmIntent, declineWithNewRequest } from './core/whatsapp-ai-intents.js';

test('Auditoria 112 Conversas Fila — 1. Resolução de corte-masculino e Corte cabelo masculino (Conversa #100)', () => {
  const servicos = [
    { id: 'srv-1', nome: 'CORTE PREMIUM', preco: 100 },
    { id: 'srv-2', nome: 'BARBA PREMIUM', preco: 100 },
    { id: 'srv-3', nome: 'CORTE E BARBA PREMIUM', preco: 200 },
    { id: 'srv-4', nome: 'Dermaplaning', preco: 60 },
    { id: 'srv-5', nome: 'Depilação Masculina - Nariz', preco: 35 },
  ];

  assert.equal(matchAgendaName('corte-masculino', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('Corte cabelo masculino', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('corte de cabelo', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('cortar o cabelo', servicos).item?.id, 'srv-1');
  assert.equal(matchAgendaName('barba masculina', servicos).item?.id, 'srv-2');
});

test('Auditoria 112 Conversas Fila — 2. Somente Dino, Bruno e Nati são barbeiros ativos (Conversas #4, #7, #13, #18)', () => {
  assert.equal(BARBEIROS_ATIVOS_DINO.length, 3);
  const idsAtivos = BARBEIROS_ATIVOS_DINO.map((b) => b.id).sort();
  assert.deepEqual(idsAtivos, ['bruno', 'dino', 'nati']);

  for (const ex of ['João Victor', 'Joao', 'David', 'David Kauã', 'Amanda', 'Lucas', 'Gustavo']) {
    const status = verificarStatusBarbeiroDino(ex);
    assert.equal(status.ativo, false, `${ex} deve estar inativo`);
    assert.equal(status.exBarbeiro, true, `${ex} deve ser exBarbeiro`);
  }
});

test('Auditoria 112 Conversas Fila — 3. Destravamento de acao_pendente em Dermaplaning e confirmações naturais (Conversas #7 e #9)', () => {
  // Conversa #7 (Maneco): "Eu não quero dermaplaning meu Deus" e "Não dermaplaning"
  assert.equal(confirmIntent('Eu não quero dermaplaning meu Deus'), 'cancel');
  assert.equal(confirmIntent('Não dermaplaning'), 'cancel');
  assert.equal(declineWithNewRequest('Eu quero o corte com o Bruno', 'Dermaplaning com Ester para Maneco'), true);

  // Conversa #9 (Juliany): "Ok. Deixa agendado aí. Se abrir uma vaga antes das 18:00 você me fala"
  assert.equal(confirmIntent('Ok. Deixa agendado aí. Se abrir uma vaga antes das 18:00 você me fala'), 'confirm');
  assert.equal(confirmIntent('Pode deixar marcado obrigado'), 'confirm');
});
