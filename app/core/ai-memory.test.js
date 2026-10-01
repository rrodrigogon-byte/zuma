import assert from 'node:assert/strict';
import test from 'node:test';
import { initialFactStatus, isSensitiveFact, memoryPhone, normalizeFact } from './ai-memory.js';
import { buildWhatsappAiSystemPrompt } from './whatsapp-ai.js';
import { heuristicAnalysis, proposalKey, redact, sanitizeAnalysis, sanitizeJudge, transcriptFromMessages } from './ai-learning.js';

test('telefone vira 55 + DDD + número', () => {
  assert.equal(memoryPhone('(65) 99999-0001'), '5565999990001');
  assert.equal(memoryPhone('5565999990001'), '5565999990001');
  assert.equal(memoryPhone('123'), '');
});

test('fatos sensíveis nunca entram na memória', () => {
  for (const valor of ['alergia a amônia', 'toma remédio para pressão', 'está com dívida no banco', 'vota no partido X', 'é evangélico da igreja Y', 'CPF 123.456.789-09']) {
    assert.equal(normalizeFact({ categoria: 'estilo', valor, confianca: 0.95 }), null, valor);
  }
  assert.equal(isSensitiveFact('prefere sábado cedo'), false);
});

test('fato válido é normalizado e data especial só aceita dia/mês', () => {
  assert.deepEqual(normalizeFact({ chave: 'Horário Preferido', valor: 'sábado de manhã', categoria: 'preferencia_horario', confianca: 0.93, trecho: 'sábado cedo é melhor' }),
    { chave: 'horario_preferido', valor: 'sábado de manhã', categoria: 'preferencia_horario', confianca: 0.93, trecho: 'sábado cedo é melhor' });
  assert.ok(normalizeFact({ categoria: 'data_especial', valor: '14/11', confianca: 0.9 }));
  assert.equal(normalizeFact({ categoria: 'data_especial', valor: '14/11/1990', confianca: 0.9 }), null);
  assert.equal(normalizeFact({ categoria: 'inventada', valor: 'algo', confianca: 0.9 }).categoria, 'outro');
});

test('status inicial depende da autonomia e da confiança', () => {
  assert.equal(initialFactStatus(0.85, 1), 'ativo');
  assert.equal(initialFactStatus(0.6, 1), 'proposto');
  assert.equal(initialFactStatus(0.95, 0), 'proposto');
});

test('memória só vai para o prompt com personalização autorizada', () => {
  const memory = { fatos: [{ tipo: 'Profissional preferido', valor: 'Bruno' }] };
  const withConsent = buildWhatsappAiSystemPrompt({ customerProfile: { consent: { personalization: true } }, customerMemory: memory, teamAnswers: [{ pergunta: 'Tem estacionamento?', resposta: 'Sim, em frente.' }] });
  assert.match(withConsent, /MEMÓRIA DO CLIENTE/);
  assert.match(withConsent, /RESPOSTAS APROVADAS PELA EQUIPE/);
  const without = buildWhatsappAiSystemPrompt({ customerProfile: { consent: { personalization: false } }, customerMemory: memory });
  assert.doesNotMatch(without, /MEMÓRIA DO CLIENTE/);
});

test('transcrição tira e-mails, links e números longos antes de ir para a IA', () => {
  assert.equal(redact('me manda em ana@x.com ou 65 99999-0001 https://a.b/c'), 'me manda em [email] ou [número] [link]');
  const text = transcriptFromMessages([{ papel: 'user', conteudo: 'oi' }, { papel: 'tool', conteudo: 'x' }, { papel: 'assistant', conteudo: 'olá' }]);
  assert.equal(text, 'Cliente: oi\nAtendente: olá');
});

test('análise sem IA acha pergunta não respondida e resultado', () => {
  const rows = [
    { papel: 'user', conteudo: 'Vocês fazem luzes com platinado?' },
    { papel: 'assistant', conteudo: 'Não tenho essa informação, encaminhei para a equipe.' },
    { papel: 'user', conteudo: 'valeu' },
  ];
  const a = heuristicAnalysis(rows);
  assert.deepEqual(a.perguntasSemResposta, ['Vocês fazem luzes com platinado?']);
  assert.equal(a.sentimento, 'positivo');
  assert.equal(heuristicAnalysis([{ papel: 'user', conteudo: 'oi' }, { papel: 'assistant', conteudo: 'Agendamento confirmado para amanhã.' }]).resultado, 'agendou');
});

test('saída da IA é saneada', () => {
  const a = sanitizeAnalysis({ resumo: 'x'.repeat(2000), resultado: 'inventado', sentimento: 'feliz', perguntas_sem_resposta: ['ok', 'Qual o horário de sábado?'] });
  assert.equal(a.resumo.length, 1200);
  assert.equal(a.resultado, 'duvida');
  assert.equal(a.sentimento, 'neutro');
  assert.deepEqual(a.perguntasSemResposta, ['Qual o horário de sábado?']);
  assert.equal(sanitizeJudge({ nota: 9 }), null);
  assert.deepEqual(sanitizeJudge({ nota: 4, criterios: { precisao: 5, extra: 3 } }), { nota: 4, criterios: { precisao: 5 }, comentario: '' });
});

test('chave de proposta agrupa a mesma pergunta escrita de jeitos diferentes', () => {
  assert.equal(proposalKey('Oi, vocês têm estacionamento?'), proposalKey('voces tem estacionamento'));
});
