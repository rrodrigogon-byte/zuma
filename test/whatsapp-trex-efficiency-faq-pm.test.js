import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDinoQuickFaq, extractFastScheduleChoice } from '../app/core/whatsapp-ai-normalize.js';
import { APELIDOS_PROFISSIONAIS, APELIDOS_SERVICOS } from '../app/core/whatsapp-ai-tools.js';

test('Eficiência 1: Reconhecimento resiliente de Natalia/Natália/Natali para a profissional Nati', () => {
  assert.ok(APELIDOS_PROFISSIONAIS['natalia'].some((n) => n.includes('natani') || n.includes('nati')), 'natalia deve mapear para Nati');
  assert.ok(APELIDOS_PROFISSIONAIS['natália'].some((n) => n.includes('natani') || n.includes('nati')), 'natália deve mapear para Nati');
  assert.ok(APELIDOS_PROFISSIONAIS['natali'].some((n) => n.includes('natani') || n.includes('nati')), 'natali deve mapear para Nati');
  assert.ok(APELIDOS_PROFISSIONAIS['nathalia'].some((n) => n.includes('natani') || n.includes('nati')), 'nathalia deve mapear para Nati');
});

test('Eficiência 2: Reconhecimento de cravos/espinhas/black mask para Limpeza de Pele e desenho de barba', () => {
  assert.deepEqual(APELIDOS_SERVICOS['cravos'], ['limpeza de pele']);
  assert.deepEqual(APELIDOS_SERVICOS['espinhas'], ['limpeza de pele']);
  assert.deepEqual(APELIDOS_SERVICOS['cravos e espinhas'], ['limpeza de pele']);
  assert.deepEqual(APELIDOS_SERVICOS['black mask'], ['limpeza de pele']);
  assert.deepEqual(APELIDOS_SERVICOS['mascara negra'], ['limpeza de pele']);
  assert.ok(APELIDOS_SERVICOS['desenhar barba'].some((s) => s.includes('barba')));
});

test('Eficiência 3: Fast-Path FAQ de Duração dos Serviços (< 1ms)', () => {
  const faq1 = detectDinoQuickFaq('Quanto tempo mais ou menos ele gasta pra fazer a barba?');
  assert.ok(faq1, 'Deve detectar pergunta de duração');
  assert.equal(faq1.kind, 'faq_duracao');
  assert.match(faq1.text, /Corte de Cabelo.*45 minutos/i);
  assert.match(faq1.text, /Barba Tradicional.*30 a 40 minutos/i);

  const faq2 = detectDinoQuickFaq('quanto tempo demora o corte?');
  assert.ok(faq2);
  assert.equal(faq2.kind, 'faq_duracao');
});

test('Eficiência 4: Fast-Path FAQ de Preços de Serviços (< 1ms)', () => {
  const precoCorte = detectDinoQuickFaq('quanto custa o corte de cabelo?');
  assert.ok(precoCorte);
  assert.equal(precoCorte.kind, 'faq_preco_corte');
  assert.match(precoCorte.text, /R\$ 90,00/);
  assert.match(precoCorte.text, /https:\/\/kytto\.com\.br\/agendar\/dino/);

  const precoBarba = detectDinoQuickFaq('qual o valor da barba?');
  assert.ok(precoBarba);
  assert.equal(precoBarba.kind, 'faq_preco_barba');
  assert.match(precoBarba.text, /R\$ 60,00 a R\$ 80,00/);

  const precoCombo = detectDinoQuickFaq('quanto custa o combo corte e barba?');
  assert.ok(precoCombo);
  assert.equal(precoCombo.kind, 'faq_preco_combo');
  assert.match(precoCombo.text, /R\$ 140,00 a R\$ 160,00/);
});

test('Eficiência 5: Fast-Path FAQ de Endereço e Horário de Funcionamento (< 1ms)', () => {
  const endereco = detectDinoQuickFaq('onde fica a barbearia?');
  assert.ok(endereco);
  assert.equal(endereco.kind, 'faq_endereco');
  assert.match(endereco.text, /Cuiabá - MT/);

  const horario = detectDinoQuickFaq('qual o horario de funcionamento?');
  assert.ok(horario);
  assert.equal(horario.kind, 'faq_horario');
  assert.match(horario.text, /08h às 19h/);
  assert.match(horario.text, /domingos e feriados fechado/);
});

test('Eficiência 6: Fast-Path FAQ de Barbeiros / Profissionais (< 1ms)', () => {
  const equipe = detectDinoQuickFaq('quem sao os barbeiros que atendem ai?');
  assert.ok(equipe);
  assert.equal(equipe.kind, 'faq_profissionais');
  assert.match(equipe.text, /Bruno/);
  assert.match(equipe.text, /Nati/);
  assert.match(equipe.text, /Dino/);
  assert.match(equipe.text, /https:\/\/kytto\.com\.br\/agendar\/dino\/bruno/);
  assert.match(equipe.text, /https:\/\/kytto\.com\.br\/agendar\/dino\/nati/);
});

test('Eficiência 7: Fallback PM em extractFastScheduleChoice (5:45 -> 17:45 e 6 hs -> 18:00)', () => {
  const assistente = 'Tenho esses horários com o Bruno na terça 17/11: às 17h45 ou às 18h15. Qual prefere?';

  // Cliente digita no padrão coloquial "5:45"
  const escolha1 = extractFastScheduleChoice('5:45', assistente);
  assert.ok(escolha1, 'Deve reconhecer 5:45 como o slot 17:45 oferecido');
  assert.equal(escolha1.horario, '17:45');
  assert.equal(escolha1.profissional, 'Bruno');

  // Cliente digita "6 hs" para o slot das 18:00
  const assistente2 = 'Tenho na sexta 13/11 às 18h00 com a Nati.';
  const escolha2 = extractFastScheduleChoice('6 hs', assistente2);
  assert.ok(escolha2, 'Deve reconhecer 6 hs como 18:00');
  assert.equal(escolha2.horario, '18:00');
  assert.equal(escolha2.profissional, 'Nati');
});
