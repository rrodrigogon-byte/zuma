import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeWithProfessional, matchAgendaSlot, moneyMentions, normalizeAgendaDate, normalizeAgendaTime, serviceWithProfessional, unbackedPrices } from './whatsapp-ai-normalize.js';

test('horário do jeito que o cliente fala vira o formato da agenda', () => {
  for (const [input, expected] of [['11h', '11:00'], ['11h00', '11:00'], ['11:00', '11:00'], ['às 11', '11:00'], ['11 horas', '11:00'], ['11.30', '11:30'], ['1130', '11:30'], ['9h', '09:00'], ['17h00', '17:00'], ['12:30:00', '12:30'], ['as 16h30', '16:30']]) {
    assert.equal(normalizeAgendaTime(input), expected, input);
  }
  for (const input of ['', 'tarde', '25h', '11:75', 'abc']) assert.equal(normalizeAgendaTime(input), '', input);
});

test('"11h" casa com o horário "11:00" oferecido pela agenda', () => {
  const slots = ['11:00', '11:30', '12:00'];
  assert.equal(matchAgendaSlot('11h', slots), '11:00');
  assert.equal(matchAgendaSlot('11h30', slots), '11:30');
  assert.equal(matchAgendaSlot('13h', slots), '');
});

test('data falada vira AAAA-MM-DD no fuso da unidade', () => {
  const today = '2026-10-14'; // quarta-feira
  assert.equal(normalizeAgendaDate('hoje', today), '2026-10-14');
  assert.equal(normalizeAgendaDate('amanhã', today), '2026-10-15');
  assert.equal(normalizeAgendaDate('depois de amanhã', today), '2026-10-16');
  assert.equal(normalizeAgendaDate('sexta', today), '2026-10-16');
  assert.equal(normalizeAgendaDate('sexta-feira', today), '2026-10-16');
  assert.equal(normalizeAgendaDate('quarta', today), '2026-10-14');
  assert.equal(normalizeAgendaDate('sábado', today), '2026-10-17');
  assert.equal(normalizeAgendaDate('14/10', today), '2026-10-14');
  assert.equal(normalizeAgendaDate('5/1', today), '2027-01-05');
  assert.equal(normalizeAgendaDate('14/10/2026', today), '2026-10-14');
  assert.equal(normalizeAgendaDate('2026-10-20', today), '2026-10-20');
  assert.equal(normalizeAgendaDate('31/02', today), '');
  assert.equal(normalizeAgendaDate('qualquer dia', today), '');
});

test('não repete o profissional quando ele já está no nome do serviço', () => {
  assert.equal(serviceWithProfessional('Corte e barba com Dino', 'Dino'), 'Corte e barba com Dino');
  assert.equal(serviceWithProfessional('Corte com Bruno ou Nati', 'Nati'), 'Corte com Bruno ou Nati');
  assert.equal(serviceWithProfessional('Corte masculino', 'Nati'), 'Corte masculino com Nati');
  assert.equal(serviceWithProfessional('Corte masculino', 'qualquer'), 'Corte masculino');
  assert.equal(dedupeWithProfessional('amanhã, sex 16/10 às 15h, Corte com Dino com Dino.'), 'amanhã, sex 16/10 às 15h, Corte com Dino.');
});

test('preço citado precisa ter vindo de uma ferramenta', () => {
  const tools = [{ produtos: [{ nome: 'Dior Sauvage Elixir EDP 100ml', preco: 1800, precoTexto: 'R$ 1.800,00' }, { nome: 'Creed Aventus', preco: 3600 }] }, { totalProdutos: 'R$ 179,80' }];
  assert.deepEqual(moneyMentions('Temos por R$ 1.150 e R$1800, total R$ 3.600,00 e R$ 29,9'), [115000, 180000, 360000, 2990]);
  assert.deepEqual(unbackedPrices('O Dior Sauvage Elixir sai por R$ 1.800,00 e o Creed por R$ 3.600.', tools), []);
  assert.deepEqual(unbackedPrices('Temos o Dior Sauvage Elixir por R$ 1.150 e o Tom Ford por R$ 1.800.', tools), [115000]);
  assert.deepEqual(unbackedPrices('Total R$ 179,80.', tools), []);
  assert.deepEqual(unbackedPrices('Sem preço aqui.', []), []);
});

test('link de pagamento gerado sempre vai na resposta', async () => {
  const { ensureToolLinks } = await import('./whatsapp-ai-normalize.js');
  const link = 'https://checkout.infinitepay.io/dino/abc123';
  assert.equal(ensureToolLinks('Show! Aqui está o link para pagar com Pix:', [link]), `Show! Aqui está o link para pagar com Pix:\n\n${link}`);
  assert.equal(ensureToolLinks(`Paga aqui: ${link}`, [link]), `Paga aqui: ${link}`);
  assert.equal(ensureToolLinks('Sem link.', []), 'Sem link.');
});

test('link de pagamento do gateway e link devolvido pela ferramenta passam no filtro', async () => {
  const { isApprovedStoreUrl, stripUnapprovedUrls, validateWhatsappAiOutput } = await import('./whatsapp-ai-profile.js');
  const env = {};
  const pix = 'https://checkout.infinitepay.io/dino?lenc=abc123';
  assert.equal(isApprovedStoreUrl(pix, env), true);
  assert.equal(isApprovedStoreUrl('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1', env), true);
  assert.equal(isApprovedStoreUrl('https://golpe.exemplo.com/pix', env), false);
  assert.equal(isApprovedStoreUrl('https://pagamento.exemplo.com/x', env, ['https://pagamento.exemplo.com/x']), true);
  assert.equal(stripUnapprovedUrls(`Aqui está o link: ${pix}`, env), `Aqui está o link: ${pix}`);
  assert.equal(validateWhatsappAiOutput(`Paga aqui: ${pix}`, { env }).violations.includes('UNAPPROVED_URL'), false);
});

test('calendário do prompt traz hoje e amanhã com o dia da semana certo', async () => {
  const { agendaCalendarText } = await import('./whatsapp-ai-normalize.js');
  const sexta = new Date('2026-10-16T13:00:00Z'); // 09:00 em Cuiabá, sexta-feira
  const texto = agendaCalendarText(sexta, 3);
  assert.match(texto, /agora é sexta-feira, 16 de outubro de 2026, 09:00/);
  assert.match(texto, /hoje = sexta-feira 16\/10 \(2026-10-16\)/);
  assert.match(texto, /amanhã = sábado 17\/10 \(2026-10-17\)/);
  assert.match(texto, /depois de amanhã = domingo 18\/10/);
});

test('dia da semana errado na resposta é corrigido pela data', async () => {
  const { fixWeekdayMistakes } = await import('./whatsapp-ai-normalize.js');
  const sexta = new Date('2026-10-16T13:00:00Z');
  // Conversa real de 16/10: amanhã era sábado.
  let r = fixWeekdayMistakes('Opa! Amanhã, sexta-feira, a Nati tem horários às 12h, 12h30 ou 13h.', sexta);
  assert.equal(r.text, 'Opa! Amanhã, sábado, a Nati tem horários às 12h, 12h30 ou 13h.');
  assert.equal(r.fixes.length, 1);
  r = fixWeekdayMistakes('Tenho sexta, 17/10 às 16h ou sábado 18/10 às 9h.', sexta);
  assert.equal(r.text, 'Tenho sábado, 17/10 às 16h ou domingo 18/10 às 9h.');
  r = fixWeekdayMistakes('Tenho quarta-feira, 14 de outubro, às 11h.', new Date('2026-10-14T13:00:00Z'));
  assert.equal(r.fixes.length, 0);
  r = fixWeekdayMistakes('Tenho Quinta-feira, 17 de outubro.', sexta);
  assert.equal(r.text, 'Tenho Sábado, 17 de outubro.');
  r = fixWeekdayMistakes('Hoje (sexta) tem vaga às 16h.', sexta);
  assert.equal(r.fixes.length, 0);
  assert.equal(fixWeekdayMistakes('Sem datas aqui.', sexta).text, 'Sem datas aqui.');
});

test('nome do cliente é gravado com maiúsculas certas', async () => {
  const { formatPersonName } = await import('./whatsapp-ai-normalize.js');
  assert.equal(formatPersonName('rodrigo goncalves'), 'Rodrigo Goncalves');
  assert.equal(formatPersonName('  ANTONIO   DA SILVA '), 'Antonio da Silva');
  assert.equal(formatPersonName('ana-paula dos santos'), 'Ana-Paula dos Santos');
  assert.equal(formatPersonName('Ana McKenzie'), 'Ana McKenzie');
  assert.equal(formatPersonName(''), '');
});
