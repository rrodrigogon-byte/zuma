import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverDadosBarbeiroCampanha,
  gerarMensagemHumanizadaDino,
  processarSpintax,
} from './core/whatsapp-antiban.js';

test('CRM Resgate Dino: resolverDadosBarbeiroCampanha para Equipe da Barbearia (Geral)', () => {
  const dados = resolverDadosBarbeiroCampanha({
    comQuemAgendar: 'equipe',
    vozRemetente: 'institucional',
    cliente: { nome: 'Carlos Silva', profissionalPreferido: 'Dino' },
    empresaSlug: 'dino',
  });

  assert.equal(dados.modo, 'equipe');
  assert.equal(dados.linkAgendamento, 'https://kytto.com.br/agendar/dino');
  assert.equal(dados.vozEfetiva, 'institucional');
  assert.equal(dados.ehPessoal, false);

  const msg = gerarMensagemHumanizadaDino({
    cliente: { nome: 'Carlos Silva', profissionalPreferido: 'Dino' },
    comQuemAgendar: 'equipe',
    vozRemetente: 'institucional',
    incluirLinkAgendamento: true,
  });

  // Mensagem NÃO pode falar "com o Dino", deve falar da equipe
  assert.ok(!msg.includes('com o Dino'), 'Não deve forçar o Dino quando o modo é equipe');
  assert.ok(msg.includes('equipe') || msg.includes('especialistas') || msg.includes('profissionais'), 'Deve convidar para a equipe');
  assert.ok(msg.includes('https://kytto.com.br/agendar/dino'), 'Deve conter link de agendamento geral da Dino');
  assert.ok(msg.includes('PARAR') || msg.includes('SAIR'), 'Deve conter opt-out Meta');
});

test('CRM Resgate Dino: resolverDadosBarbeiroCampanha para Barbeiro Habitual do Cliente', () => {
  // 1. Cliente da Nati
  const dadosNati = resolverDadosBarbeiroCampanha({
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    cliente: { nome: 'Renato Lima', profissionalPreferido: 'Natani Minanis Dobler' },
    empresaSlug: 'dino',
  });
  assert.equal(dadosNati.barbeiroSlug, 'nati');
  assert.equal(dadosNati.linkAgendamento, 'https://kytto.com.br/agendar/dino/nati');

  const msgNati = gerarMensagemHumanizadaDino({
    cliente: { nome: 'Renato Lima', profissionalPreferido: 'Natani Minanis Dobler' },
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    incluirLinkAgendamento: true,
  });
  assert.ok(msgNati.includes('Nati'), 'Deve citar a Nati para o cliente dela');
  assert.ok(msgNati.includes('https://kytto.com.br/agendar/dino/nati'), 'Deve conter link direto da agenda da Nati');

  // 2. Cliente do Bruno
  const dadosBruno = resolverDadosBarbeiroCampanha({
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    cliente: { nome: 'Marcos Souza', profissionalPreferido: 'Bruno Mendes Pedroso' },
    empresaSlug: 'dino',
  });
  assert.equal(dadosBruno.barbeiroSlug, 'bruno');
  assert.equal(dadosBruno.linkAgendamento, 'https://kytto.com.br/agendar/dino/bruno');

  const msgBruno = gerarMensagemHumanizadaDino({
    cliente: { nome: 'Marcos Souza', profissionalPreferido: 'Bruno Mendes Pedroso' },
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    incluirLinkAgendamento: true,
  });
  assert.ok(msgBruno.includes('Bruno'), 'Deve citar o Bruno para o cliente dele');
  assert.ok(msgBruno.includes('https://kytto.com.br/agendar/dino/bruno'), 'Deve conter link direto da agenda do Bruno');

  // 3. Cliente do Dino
  const dadosDino = resolverDadosBarbeiroCampanha({
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    cliente: { nome: 'Felipe Santos', profissionalPreferido: 'Guilherme Cunha Martins' },
    empresaSlug: 'dino',
  });
  assert.equal(dadosDino.barbeiroSlug, 'dino');
  assert.equal(dadosDino.linkAgendamento, 'https://kytto.com.br/agendar/dino/dino');

  // 4. Cliente cujo barbeiro era ex-barbeiro (ex: Gustavo ou Vitor)
  const dadosEx = resolverDadosBarbeiroCampanha({
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    cliente: { nome: 'Lucas Alencar', profissionalPreferido: 'Gustavo Henrique Folha de Carvalho' },
    empresaSlug: 'dino',
  });
  assert.equal(dadosEx.barbeiroSlug, '');
  assert.equal(dadosEx.linkAgendamento, 'https://kytto.com.br/agendar/dino');
  const msgEx = gerarMensagemHumanizadaDino({
    cliente: { nome: 'Lucas Alencar', profissionalPreferido: 'Gustavo Henrique Folha de Carvalho' },
    comQuemAgendar: 'habitual',
    vozRemetente: 'institucional',
    incluirLinkAgendamento: true,
  });
  assert.ok(!msgEx.includes('Gustavo'), 'Não pode citar ex-barbeiro!');
  assert.ok(msgEx.includes('https://kytto.com.br/agendar/dino'), 'Deve encaminhar para o link geral da Dino');
});

test('CRM Resgate Dino: Campanha de Barbeiro Específico Fixo com Voz Pessoal e Link da Agenda', () => {
  // Nati disparando para a própria cadeira
  const dados = resolverDadosBarbeiroCampanha({
    comQuemAgendar: 'especifico',
    profissionalFixo: 'nati',
    vozRemetente: 'pessoal',
    cliente: { nome: 'Lucas Santos' },
    empresaSlug: 'dino',
  });

  assert.equal(dados.modo, 'especifico');
  assert.equal(dados.barbeiroSlug, 'nati');
  assert.equal(dados.ehPessoal, true);
  assert.equal(dados.linkAgendamento, 'https://kytto.com.br/agendar/dino/nati');

  const msg = gerarMensagemHumanizadaDino({
    cliente: { nome: 'Lucas Santos' },
    comQuemAgendar: 'especifico',
    profissionalFixo: 'nati',
    vozRemetente: 'pessoal',
    incluirLinkAgendamento: true,
  });

  assert.ok(msg.includes('Nati') && msg.includes('Barbearia Dino'), 'Deve assinar em nome da Nati na Barbearia Dino');
  assert.ok(msg.includes('comigo'), 'Deve convidar para agendar comigo');
  assert.ok(msg.includes('https://kytto.com.br/agendar/dino/nati'), 'Deve conter link exclusivo da Nati');
  assert.ok(msg.includes('PARAR') || msg.includes('SAIR'), 'Deve conter opt-out Meta');
});

test('CRM Resgate Dino: Spintax e Hash Uniqueness protegem contra detecção de spam da Meta', () => {
  const mensagens = new Set();
  for (let i = 0; i < 20; i++) {
    const msg = gerarMensagemHumanizadaDino({
      cliente: { nome: `Cliente ${i}` },
      comQuemAgendar: 'habitual',
      modelo: 'essencial',
      incluirOptOut: true,
    });
    mensagens.add(msg);
  }
  // Variações de Spintax devem gerar mensagens diferentes
  assert.ok(mensagens.size > 10, 'Spintax deve gerar ampla variação para não cair em bloqueio de hash repetido');
});
