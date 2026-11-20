import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectDinoQuickFaq
} from '../app/core/whatsapp-ai-normalize.js';

import {
  consolidateLearnedProposals,
  getDynamicLearnedGuidance,
  DINO_LEARNED_KNOWLEDGE
} from '../app/core/trex-auto-learner.js';

test('1. detectDinoQuickFaq deve responder instantaneamente às novas dúvidas aprendidas de produção', () => {
  // Caso A: Pacotes e agendamento pelo link
  const rPacote = detectDinoQuickFaq('como o meu é pacote, faço o agendamento pelo link normalmente?');
  assert.equal(rPacote?.kind, 'faq_pacote_agendamento');
  assert.match(rPacote.text, /sem nenhum pagamento adicional/);
  assert.match(rPacote.text, /https:\/\/kytto\.com\.br\/agendar\/dino/);

  // Caso B: Validade do pacote
  const rValidade = detectDinoQuickFaq('Até quando é meu pacote?');
  assert.equal(rValidade?.kind, 'faq_pacote_agendamento');

  // Caso C: Sinuca e bebidas
  const rSinuca = detectDinoQuickFaq('E tem mesa de sinuca, essas coisas?');
  assert.equal(rSinuca?.kind, 'faq_sinuca_bebidas');
  assert.match(rSinuca.text, /mesa de sinuca/);
  assert.match(rSinuca.text, /bebidas geladas/);

  const rBebida = detectDinoQuickFaq('Tem bebida?');
  assert.equal(rBebida?.kind, 'faq_sinuca_bebidas');

  // Caso D: Visagismo
  const rVisagismo = detectDinoQuickFaq('Tem algum outro local na cidade que faz visagismo?');
  assert.equal(rVisagismo?.kind, 'faq_visagismo');
  assert.match(rVisagismo.text, /visagismo masculino/);

  // Caso E: Quem pode atender hoje
  const rQuemAtende = detectDinoQuickFaq('Quem pode me atender hoje??');
  assert.equal(rQuemAtende?.kind, 'faq_quem_atende_hoje');
  assert.match(rQuemAtende.text, /Bruno/);
  assert.match(rQuemAtende.text, /Nati/);
  assert.match(rQuemAtende.text, /Mestre Dino/);

  // Caso F: Só cabelo
  const rSoCabelo = detectDinoQuickFaq('E se for só cabelo??');
  assert.equal(rSoCabelo?.kind, 'faq_preco_corte');
  assert.match(rSoCabelo.text, /R\$ 90,00/);

  // Caso G: Contato do responsável
  const rResponsavel = detectDinoQuickFaq('Poderia também me mandar o número do responsável para conversar melhor sobre?');
  assert.equal(rResponsavel?.kind, 'faq_contato_responsavel');
  assert.match(rResponsavel.text, /canal oficial de atendimento/);
});

test('2. consolidateLearnedProposals deve preencher e aprovar propostas aprendidas no banco', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const propostasMock = [
    { id: 'p-1', tipo: 'objecao', chave: 'horario indisponivel', titulo: 'horário indisponível', proposta: null, status: 'proposto' },
    { id: 'p-2', tipo: 'objecao', chave: 'viagem', titulo: 'viagem', proposta: null, status: 'proposto' },
    { id: 'p-3', tipo: 'faq', chave: 'ate quando meu pacote', titulo: 'Até quando é meu pacote?', proposta: null, status: 'proposto' }
  ];

  const updatedRows = [];
  const mockQuery = async (sql, params) => {
    if (sql.includes('UPDATE ai_learning_proposals') && sql.includes('SET proposta = $3')) {
      const chavePattern = params[1];
      const match = propostasMock.find(p => p.chave.includes(chavePattern));
      if (match) {
        match.proposta = params[2];
        match.status = 'aprovado';
        updatedRows.push(match);
        return { rows: [match] };
      }
      return { rows: [] };
    }
    if (sql.includes('UPDATE ai_learning_proposals') && sql.includes("status = 'aprovado'")) {
      return { rows: updatedRows };
    }
    return { rows: [] };
  };

  const resultado = await consolidateLearnedProposals(empresaId, { query: mockQuery });
  assert.ok(resultado.atualizadas > 0, 'Deve atualizar propostas com conhecimento da Dino Barbearia');
  assert.ok(propostasMock.some(p => p.chave === 'viagem' && p.status === 'aprovado' && p.proposta !== null));
  assert.ok(propostasMock.some(p => p.chave === 'horario indisponivel' && p.status === 'aprovado'));
});

test('3. getDynamicLearnedGuidance deve injetar diretrizes aprovadas no prompt do Motor KyttoIA', async () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  const mockQuery = async (sql, params) => {
    if (sql.includes('FROM ai_learning_proposals') && sql.includes("status = 'aprovado'")) {
      return {
        rows: [
          { tipo: 'objecao', titulo: 'horário indisponível', proposta: DINO_LEARNED_KNOWLEDGE['horario indisponivel'] },
          { tipo: 'faq', titulo: 'Até quando é meu pacote?', proposta: DINO_LEARNED_KNOWLEDGE['ate quando meu pacote'] }
        ]
      };
    }
    return { rows: [] };
  };

  const guidance = await getDynamicLearnedGuidance(empresaId, { query: mockQuery });
  assert.match(guidance, /DIRETRIZES E RESPOSTAS AUTO-APRENDIDAS/);
  assert.match(guidance, /horário indisponível/);
  assert.match(guidance, /Até quando é meu pacote\?/);
  assert.match(guidance, /KyttoIA Continuous Learning Loop/);
});
