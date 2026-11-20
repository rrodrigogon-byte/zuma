import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarOfertaContextualUpsell } from '../app/core/dino-upsell-inteligente.js';
import { extractFactsFromMessages, summarizeSessionConversation } from '../app/core/trex-historical-learner.js';

test('Dino Upsell Inteligente: gera ofertas contextuais alinhadas ao perfil do cliente', () => {
  // Teste 1: Cliente agendou corte -> upsell de barba ou alinhamento com barbeiro titular
  const ofertaCorte = gerarOfertaContextualUpsell({
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    clienteNome: 'Rodrigo',
    servicoNome: 'Corte Cabelo Degrade',
    profissionalNome: 'Dino',
    fatos: [{ tipo: 'servico_habitual', valor: 'Barba' }],
  });
  assert.match(ofertaCorte, /barba/i, 'Deve sugerir barba para quem agendou corte e tem hábito de barba');
  assert.match(ofertaCorte, /Dino/i, 'Deve citar o barbeiro titular');

  // Teste 2: Cliente agendou barba -> upsell de corte ou sobrancelha
  const ofertaBarba = gerarOfertaContextualUpsell({
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    clienteNome: 'Carlos',
    servicoNome: 'Barboterapia Tradicional',
    profissionalNome: 'Bruno',
    fatos: [],
  });
  assert.match(ofertaBarba, /corte|sobrancelha|óleo/i, 'Deve sugerir corte, sobrancelha ou óleo para quem agendou barba');

  // Teste 3: Cliente agendou combo completo -> upsell de Pomada Matte Dino da casa
  const ofertaCombo = gerarOfertaContextualUpsell({
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    clienteNome: 'Fernando',
    servicoNome: 'Cabelo e Barba Completo',
    profissionalNome: 'Dino',
    fatos: [],
  });
  assert.match(ofertaCombo, /Pomada|Matte|65/i, 'Deve sugerir Pomada Matte para combo');

  // Teste 4: Cliente é assinante do Club Dino -> upsell com benefício de 10%
  const ofertaClube = gerarOfertaContextualUpsell({
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    clienteNome: 'Marcos',
    servicoNome: 'Corte Social',
    profissionalNome: 'Dino',
    plano: { nome: 'Club Dino VIP' },
  });
  assert.match(ofertaClube, /10% de desconto exclusivo|Club Dino/i, 'Deve destacar benefício do Club Dino');
});

test('T-Rex Historical Learner: extração semântica de fatos a partir de mensagens históricas', () => {
  const mensagens = [
    { papel: 'user', texto: 'Boa tarde, queria marcar com o Dino na sexta às 18:00 se tiver vago' },
    { papel: 'assistant', texto: 'Fala meu 10! Com o Dino temos 18h sim. Qual serviço vai ser hoje?' },
    { papel: 'user', texto: 'Vou fazer cabelo e barba degrade e separar uma pomada matte pra mim' },
    { papel: 'assistant', texto: 'Show de bola! Já deixo agendado e reservada a pomada.' },
    { papel: 'user', texto: 'Valeu meu 10! Traz uma cerveja gelada qdo eu chegar' },
  ];

  const fatos = extractFactsFromMessages(mensagens);
  assert.ok(fatos.length >= 3, `Deve extrair múltiplos fatos da conversa (extraídos: ${fatos.length})`);

  const barbeiro = fatos.find(f => f.categoria === 'profissional_preferido' || f.tipo === 'profissional_preferido');
  assert.ok(barbeiro, 'Deve detectar barbeiro preferido');
  assert.match(barbeiro.valor, /Dino/i);

  const produto = fatos.find(f => f.categoria === 'produto_interesse' || f.tipo === 'produto_interesse');
  assert.ok(produto, 'Deve detectar interesse em pomada matte');

  const horario = fatos.find(f => f.categoria === 'preferencia_horario' || f.tipo === 'preferencia_horario');
  assert.ok(horario, 'Deve detectar preferência por horário');

  const resumo = summarizeSessionConversation(mensagens, { customerName: 'Rodrigo' });
  assert.ok(resumo, 'Deve gerar resumo semântico da sessão');
  assert.ok(resumo.resumo, 'Resumo deve conter texto estruturado');
});
