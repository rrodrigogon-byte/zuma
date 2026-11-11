import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarBaseConsolidada } from './dino-recuperacao-avec.js';
import { verificarStatusBarbeiroDino, BARBEIROS_ATIVOS_DINO } from './core/barbershop-agenda.js';
import { gerarMensagemHumanizadaDino } from './core/whatsapp-antiban.js';

test('Recuperação de Clientes: verificarStatusBarbeiroDino identifica ativos e ex-profissionais', () => {
  // Barbeiros ativos
  assert.equal(verificarStatusBarbeiroDino('Bruno Mendes pedroso').ativo, true);
  assert.equal(verificarStatusBarbeiroDino('Natani Minanis Dobler').ativo, true);
  assert.equal(verificarStatusBarbeiroDino('GUILHERME CUNHA MARTINS').ativo, true);

  // Ex-barbeiros que não atuam mais na Barbearia Dino
  const exDavid = verificarStatusBarbeiroDino('David Kaua Araujo Moraes');
  assert.equal(exDavid.ativo, false);
  assert.equal(exDavid.exBarbeiro, true);

  const exJoao = verificarStatusBarbeiroDino('Joao Victor Domingos Ruedel');
  assert.equal(exJoao.ativo, false);
  assert.equal(exJoao.exBarbeiro, true);

  const exAmanda = verificarStatusBarbeiroDino('Amanda Gabrielly Santos da Silva');
  assert.equal(exAmanda.ativo, false);
  assert.equal(exAmanda.exBarbeiro, true);

  const exGustavo = verificarStatusBarbeiroDino('Gustavo Henrique Folha de Carvalho');
  assert.equal(exGustavo.ativo, false);
  assert.equal(exGustavo.exBarbeiro, true);

  const exLucas = verificarStatusBarbeiroDino('Lucas Marchetto');
  assert.equal(exLucas.ativo, false);
  assert.equal(exLucas.exBarbeiro, true);

  const exVitor = verificarStatusBarbeiroDino('Vitor Muriel Silva Boy');
  assert.equal(exVitor.ativo, false);
  assert.equal(exVitor.exBarbeiro, true);

  const exVinycius = verificarStatusBarbeiroDino('Vinycius Lopes Rodrigues');
  assert.equal(exVinycius.ativo, false);
  assert.equal(exVinycius.exBarbeiro, true);

  const exBrunoRafael = verificarStatusBarbeiroDino('Bruno Rafael dos Santos');
  assert.equal(exBrunoRafael.ativo, false);
  assert.equal(exBrunoRafael.exBarbeiro, true);
});

test('Recuperação de Clientes: carregarBaseConsolidada nunca cita ex-barbeiros nas mensagens', async () => {
  const base = await carregarBaseConsolidada();
  assert.ok(base.length > 1000, 'Base da Avec deve ter mais de 1000 clientes');

  // Encontrar o cliente pabio barbosa (que era do Gustavo)
  const pabio = base.find((c) => c.nome.toLowerCase().includes('pabio barbosa'));
  assert.ok(pabio, 'Cliente pabio barbosa deve existir na base');
  assert.equal(pabio.barbeiroAtivo, false);
  assert.equal(pabio.barbeiroSaiu, true);

  // A mensagem NUNCA deve conter o nome Gustavo
  assert.ok(!pabio.mensagemWhatsapp.includes('Gustavo'), 'Mensagem NÃO pode conter Gustavo!');
  assert.ok(pabio.mensagemWhatsapp.includes('um dos nossos barbeiros'), 'Mensagem deve direcionar para a nova equipe!');

  // Testar todos os clientes que tinham Gustavo, Vitor, Lucas ou Vinycius
  const clientesExBarbeiros = base.filter((c) =>
    ['Gustavo', 'Vitor', 'Lucas', 'Vinycius', 'Danilo'].some((ex) =>
      (c.profissionalPreferido || '').includes(ex)
    )
  );

  assert.ok(clientesExBarbeiros.length > 50, 'Deve haver mais de 50 clientes com ex-barbeiros');
  for (const c of clientesExBarbeiros) {
    assert.equal(c.barbeiroAtivo, false, `Barbeiro de ${c.nome} deve ser inativo`);
    assert.equal(c.barbeiroSaiu, true, `Barbeiro de ${c.nome} deve ter saído`);
    assert.ok(!c.mensagemWhatsapp.includes('com Gustavo'), `Mensagem de ${c.nome} não pode conter com Gustavo`);
    assert.ok(!c.mensagemWhatsapp.includes('com Vitor'), `Mensagem de ${c.nome} não pode conter com Vitor`);
    assert.ok(!c.mensagemWhatsapp.includes('com Lucas'), `Mensagem de ${c.nome} não pode conter com Lucas`);
    assert.ok(!c.mensagemWhatsapp.includes('com Vinycius'), `Mensagem de ${c.nome} não pode conter com Vinycius`);
  }
});

test('Recuperação de Clientes: gerarMensagemHumanizadaDino substitui ex-barbeiros por equipe', () => {
  const msgEx = gerarMensagemHumanizadaDino({
    cliente: { nome: 'Carlos da Silva' },
    profissional: 'Gustavo Henrique Folha de Carvalho',
    template: 'Olá {Nome}! Quer cortar com {Profissional} essa semana?',
    incluirOptOut: false,
  });

  assert.ok(!msgEx.includes('Gustavo'), 'Não pode conter Gustavo!');
  assert.ok(msgEx.includes('barbeiros') || msgEx.includes('equipe') || msgEx.includes('profissionais'), 'Deve citar os barbeiros, profissionais ou a equipe!');
});
