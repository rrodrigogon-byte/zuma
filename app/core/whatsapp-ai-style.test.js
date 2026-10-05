import test from 'node:test';
import assert from 'node:assert/strict';
import { bubbleDelayMs, inlineEnumeration, packBubbles, removeBannedPhrases, removeSelfIntro, sentences, splitBubbles, spokenMoney, spokenTimes, stripMarkdown, styleModelText, styleReport } from './whatsapp-ai-style.js';

test('estilo: lista vira frase com "ou"', () => {
  assert.equal(stripMarkdown('Tenho estes horários:\n- 10h30 com o Bruno\n- 17h com o Bruno'), 'Tenho estes horários: 10h30 com o Bruno ou 17h com o Bruno.');
  assert.equal(stripMarkdown('1. Corte\n2. Barba\n3. Sobrancelha'), 'Corte, Barba ou Sobrancelha.');
  assert.equal(stripMarkdown('**Corte** sai *R$ 45*'), 'Corte sai R$ 45');
  assert.equal(stripMarkdown('## Preços\nCorte R$ 45'), 'Preços:\nCorte R$ 45');
  assert.equal(stripMarkdown('Barba: R$ 40,00\nCorte: R$ 45,00'), 'Barba R$ 40,00 e Corte R$ 45,00.');
});

test('estilo: frases de robô saem; se sobrar nada, fica o original', () => {
  assert.equal(removeBannedPhrases('Corte sai R$ 45. Fico à disposição para qualquer dúvida!'), 'Corte sai R$ 45.');
  assert.equal(removeBannedPhrases('Prezado cliente, seu horário está marcado.'), 'Seu horário está marcado.');
  assert.equal(removeBannedPhrases('Infelizmente esse horário saiu.'), 'Esse horário saiu.');
  assert.equal(removeBannedPhrases('Como posso ajudá-lo hoje?'), 'Como posso ajudá-lo hoje?', 'não esvazia a resposta');
});

test('estilo: bolhas de até 120 caracteres, no máximo 2', () => {
  const longo = 'Opa, João! Amanhã tenho 10h30 ou 17h com o Bruno, que é o barbeiro que você costuma escolher aqui na Dino. Também tenho 14h com o Rafael, se preferir outro profissional. Qual fica melhor pra você?';
  const bolhas = packBubbles(longo, { max: 120, maxBubbles: 2 });
  assert.equal(bolhas.length, 2);
  assert.ok(bolhas[0].length <= 120);
  assert.equal(bolhas.join(' ').replace(/\s+/g, ' '), longo, 'não perde texto');
  const curto = styleModelText('**Fechado!** Fico à disposição.');
  assert.equal(curto, 'Fechado!');
});

test('estilo: frase gigante é quebrada em vírgula ou espaço', () => {
  const frase = 'Temos corte masculino, corte com máquina fade, corte infantil, pezinho, barba tradicional, barba completa com toalha quente e barboterapia premium';
  const bolhas = packBubbles(frase, { max: 60, maxBubbles: 5 });
  assert.ok(bolhas.every((b) => b.length <= 60), JSON.stringify(bolhas));
  assert.equal(bolhas.join(' '), frase);
});

test('estilo: envio separa parágrafos e preserva resumo e marcadores', () => {
  const conteudo = 'Opa! Aqui é o T-Rex, da Barbearia Dino.\n\nConfere aí: Corte Masculino com Bruno em sáb 10/10 às 09:00, R$ 45,00, Barbearia Dino.\nResponda SIM para confirmar ou NÃO para desistir.';
  const bolhas = splitBubbles(conteudo, { max: 120 });
  assert.equal(bolhas.length, 2);
  assert.match(bolhas[1], /Responda SIM para confirmar ou NÃO para desistir\./, 'dica de confirmação intacta');
  assert.equal(splitBubbles('Só uma frase.').length, 1);
  const muitos = splitBubbles(['a', 'b', 'c', 'd', 'e', 'f'].join('\n\n'), { hardMax: 4 });
  assert.equal(muitos.length, 4);
  assert.equal(muitos[3], 'd\n\ne\n\nf');
});

test('estilo: horários e valores falados, enumeração na linha vira frase', () => {
  assert.equal(spokenTimes('às 09:00 ou 12:30'), 'às 9h ou 12h30');
  assert.equal(spokenMoney('R$ 45,00 e R$ 1.000,00 e R$ 45,50'), 'R$ 45 e R$ 1.000 e R$ 45,50');
  assert.equal(inlineEnumeration('Tenho: 1) terça 06/10 às 12h; 2) terça 06/10 às 12h30; 3) terça 06/10 às 13h. Qual?'), 'Tenho: terça 06/10 às 12h, 12h30 ou 13h. Qual?');
  assert.equal(inlineEnumeration('Opções: 1) Corte; 2) Barba.'), 'Opções: Corte ou Barba.');
  assert.equal(styleModelText('Barba Completa: R$ 40,00\nCorte + Máquina (Fade): R$ 50,00\nPedicure: R$ 50,00'), 'Barba Completa R$ 40, Corte + Máquina (Fade) R$ 50 e Pedicure R$ 50.');
});

test('estilo: autoapresentação de robô sai só quando pedido', () => {
  assert.equal(removeSelfIntro('Oi! Sou a assistente virtual da Barbearia Dino. Quer marcar?'), 'Oi! Quer marcar?');
  assert.equal(removeSelfIntro('Sou o atendente digital. Corte sai R$ 45.'), 'Corte sai R$ 45.');
  assert.equal(styleModelText('Sou a assistente virtual da Dino, sim.', { dropSelfIntro: false }), 'Sou a assistente virtual da Dino, sim.');
  assert.equal(removeSelfIntro('Sou a assistente virtual.'), 'Sou a assistente virtual.', 'não esvazia a resposta');
});

test('estilo: nunca corta "R$" do valor', () => {
  const bolhas = packBubbles('Barba Completa R$ 40, Corte Masculino R$ 45, Manicure R$ 50, Pedicure R$ 50 e mais um item qualquer R$ 50', { max: 60, maxBubbles: 5 });
  for (const b of bolhas) assert.doesNotMatch(b, /R\$$/, b);
});

test('estilo: sentenças e relatório', () => {
  assert.deepEqual(sentences('Oi! Tudo bem? Corte sai R$ 45.'), ['Oi!', 'Tudo bem?', 'Corte sai R$ 45.']);
  const r = styleReport('**Oi**\n- a\n- b');
  assert.equal(r.markdown, true);
  assert.equal(styleReport('Fico à disposição.').banned, true);
  assert.equal(styleReport('Fechado!').banned, false);
});

test('estilo: pausa entre bolhas configurável (0 desliga)', () => {
  assert.equal(bubbleDelayMs('abc', { WHATSAPP_AI_BUBBLE_DELAY_MS: '0' }), 0);
  assert.equal(bubbleDelayMs('x'.repeat(10), {}), 1200);
  assert.ok(bubbleDelayMs('x'.repeat(1000), {}) <= 3500);
});
