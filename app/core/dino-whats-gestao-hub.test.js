import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRUPO_GESTAO_DINO_INFO,
  DESTINATARIOS_GESTAO_DINO,
  formatarMensagemAvaliacaoNps,
  tratarComandaFechadaParaNps,
  registrarNotaNpsCliente,
  listarEstatisticasNps,
  formatarMenuComandosGestao,
  formatarMensagemRankingNps,
  dispararFechamentoGestaoDino,
} from './dino-whats-gestao-hub.js';

test('1. Canal Oficial Gestão Dino: Nome do grupo e participantes corretos do print', () => {
  assert.equal(GRUPO_GESTAO_DINO_INFO.nome, 'Gestão Dino');
  assert.equal(GRUPO_GESTAO_DINO_INFO.participantes.length, 3);

  // Participantes do print: Rodrigo, Guilherme e Dino
  const nomes = GRUPO_GESTAO_DINO_INFO.participantes.map(p => p.nome).join(' ');
  assert.ok(nomes.includes('Rodrigo'));
  assert.ok(nomes.includes('Guilherme'));
  assert.ok(nomes.includes('Dino'));

  assert.ok(DESTINATARIOS_GESTAO_DINO.includes('5514997462929')); // Rodrigo
  assert.ok(DESTINATARIOS_GESTAO_DINO.includes('5565996722055')); // Guilherme
});

test('2. Script de Avaliação Pós-Atendimento (NPS Dino): Humanizado e com escala 1 a 5', () => {
  const msg = formatarMensagemAvaliacaoNps({
    clienteNome: 'Rodrigo Gonçalves',
    barbeiroNome: 'Nati',
    servicosTexto: 'Corte e Barba',
  });

  assert.ok(msg.includes('Rodrigo'));
  assert.ok(msg.includes('Nati'));
  assert.ok(msg.includes('Corte e Barba'));
  assert.ok(msg.includes('1 a 5'));
  assert.ok(msg.includes('T-Rex'));
});

test('3. Registro de Nota NPS e Notificação ao Grupo Gestão Dino', async () => {
  const resultado = await registrarNotaNpsCliente({
    telefone: '5565999876543',
    nota: 5,
    comentario: 'Atendimento impecável da Nati, pontual e muito atenciosa!',
    clienteNome: 'Cauã Rafael',
    barbeiroNome: 'Nati',
  });

  assert.ok(resultado.ok);
  assert.equal(resultado.avaliacao.nota, 5);
  assert.equal(resultado.avaliacao.clienteNome, 'Cauã Rafael');

  const stats = listarEstatisticasNps();
  assert.ok(stats.totalAvaliacoes >= 1);
  assert.ok(stats.desempenhoPorBarbeiro['Nati']);
  assert.equal(stats.desempenhoPorBarbeiro['Nati'].media, '5.00');
});

test('4. Tratamento de Comanda Fechada sem Telefone: Retorna motivo seguro sem quebrar', async () => {
  const resultado = await tratarComandaFechadaParaNps({
    comandaId: 'cmd-teste-01',
    clienteId: null,
    clienteNome: 'Cliente Balcão Sem Cadastro',
    itens: [{ nome: 'Corte Máquina', barbeiroNome: 'Bruno' }],
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, 'cliente_sem_telefone');
});

test('5. Menu de Ajuda Executivo: Contém comandos oficiais e número do gestor Guilherme Dino', () => {
  const menu = formatarMenuComandosGestao();
  assert.ok(menu.includes('!report'));
  assert.ok(menu.includes('!fechamento'));
  assert.ok(menu.includes('!nps'));
  assert.ok(menu.includes('!equipe'));
  assert.ok(menu.includes('+55 65 99672-2055'));
  assert.ok(/kyttoia/i.test(menu));
});

test('6. Ranking de Satisfação NPS: Produz formato com estrelas e média geral', () => {
  const ranking = formatarMensagemRankingNps();
  assert.ok(ranking.includes('PAINEL DE SATISFAÇÃO'));
  assert.ok(ranking.includes('Nota Média Geral'));
  assert.ok(ranking.includes('Desempenho por Barbeiro'));
});

test('7. Fechamento Executivo Gestão Dino: Compila resumo diário e produz mensagem elegante', async () => {
  const res = await dispararFechamentoGestaoDino();
  assert.ok(res.resumo);
  assert.ok(res.mensagem.includes('FECHAMENTO EXECUTIVO DO DIA'));
  assert.ok(res.mensagem.includes('Barbearia Dino'));
  assert.ok(res.mensagem.includes('Faturamento Total'));
});
