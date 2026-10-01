import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalWhatsappPhone, phoneMatchKey, isWhatsappOptOutText, isWhatsappOptInText } from './whatsapp-phone.js';

test('JID sem o nono dígito e cadastro com 9 têm a mesma identidade', () => {
  assert.equal(canonicalWhatsappPhone('556599990001@s.whatsapp.net'), '5565999990001');
  assert.equal(phoneMatchKey('556599990001'), phoneMatchKey('(65) 99999-0001'));
  assert.equal(phoneMatchKey('+55 65 99999-0001'), phoneMatchKey('65999990001'));
  assert.equal(canonicalWhatsappPhone('6533221100'), '556533221100', 'fixo não ganha 9');
  assert.equal(canonicalWhatsappPhone('55999990000'), '5555999990000', 'DDD 55 sem código do país');
  assert.equal(canonicalWhatsappPhone('123'), '');
});

test('lista única de descadastro', () => {
  for (const text of ['SAIR', 'sair!', 'Pare.', 'PARAR', 'stop', 'Não quero receber', 'remover meu número', 'cancelar marketing']) assert.equal(isWhatsappOptOutText(text), true, text);
  for (const text of ['cancelar', 'quero sair às 10h', 'confirmar', '']) assert.equal(isWhatsappOptOutText(text), false, text);
});

test('SAIR reconhece pedidos comuns de descadastro; consentimento exige falar de promoção', () => {
  for (const text of ['sair da lista', 'Pare de mandar mensagem', 'não me mande mais mensagens', 'quero sair da lista']) assert.equal(isWhatsappOptOutText(text), true, text);
  for (const text of ['pode me mandar o endereço?', 'aceito o horário das 15h', 'sim, pode marcar', 'quero receber o comprovante', 'autorizo', 'Vi a promoção do corte, pode agendar pra mim amanhã?', 'Tem desconto no pix? pode ser', 'quero o cupom de 10%', 'nao quero mais']) assert.equal(isWhatsappOptInText(text), false, text);
  for (const text of ['quero receber promoções', 'pode mandar as ofertas', 'sim, quero receber as novidades', 'autorizo receber descontos', 'me manda as promoções']) assert.equal(isWhatsappOptInText(text), true, text);
  for (const text of ['quero sair às 10h', 'nao quero mais', 'quero sair']) assert.equal(isWhatsappOptOutText(text), false, `ambíguo: ${text}`);
  assert.equal(isWhatsappOptInText('não quero promoções'), false);
});
