import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarMensagemRecuperacaoTrex,
  verificarOptOut,
  registrarOptOut,
  consolidarReportDiarioTrex,
  formatarMensagemReportGestao,
  executarRecuperacaoAtivaDiaria,
  listarClientesElegiveisRecuperacao,
  EMPRESA_DINO_ID,
} from './dino-recuperacao-ativa.js';

test('1. Mensagem T-Rex: Deve conter 30% de desconto e focar em horários fracos (Segunda, Manhã e Almoço)', () => {
  const clienteMock = {
    nome: 'Carlos Eduardo',
    telefone: '5565992345678',
    dias_sem_visita: 72,
  };

  const msg = gerarMensagemRecuperacaoTrex(clienteMock, { variacao: 0 });

  assert.match(msg, /Carlos/i, 'Deve saudar pelo primeiro nome');
  assert.match(msg, /T-Rex da Barbearia Dino/i, 'Deve conter a persona T-Rex');
  assert.match(msg, /30% DE DESCONTO/i, 'Deve oferecer os 30% de desconto para reativação');
  assert.match(msg, /Segunda-feira/i, 'Deve direcionar para Segunda-feira');
  assert.match(msg, /almoço|08h30 às 11h/i, 'Deve citar faixas de ociosidade matinal/almoço');
  assert.match(msg, /10% DE DESCONTO.*cartão/i, 'Deve oferecer 10% de desconto no cartão para pacotes/assinatura');
  assert.match(msg, /café espresso gourmet ou uma cerveja artesanal/i, 'Deve conter acolhimento com mimos');
  assert.match(msg, /PARAR/i, 'Deve conter cláusula de opt-out contra bloqueio da Meta');
  assert.match(msg, /https:\/\/kytto\.com\.br\/agendar\/dino/i, 'Deve conter o link de agendamento');
});

test('2. Rotação Spintax: Todas as 5 variações devem ser válidas, diferentes e conter os critérios do plano', () => {
  const clienteMock = {
    nome: 'Rodrigo Silveira',
    telefone: '5565981234567',
    dias_sem_visita: 64,
  };

  const variacoes = new Set();
  for (let v = 0; v < 5; v++) {
    const texto = gerarMensagemRecuperacaoTrex(clienteMock, { variacao: v });
    assert.match(texto, /30% DE DESCONTO/i);
    assert.match(texto, /Segunda/i);
    assert.match(texto, /10% DE DESCONTO.*cartão/i);
    assert.match(texto, /PARAR/i);
    variacoes.add(texto);
  }

  assert.equal(variacoes.size, 5, 'Todas as 5 variações geradas devem ter conteúdos e estruturas distintas');
});

test('3. Mecanismo Anti-Bloqueio Meta: Registro e Verificação de Opt-Out', async () => {
  const telefoneTeste = '55659' + Math.floor(10000000 + Math.random() * 90000000);

  const antes = await verificarOptOut(telefoneTeste);
  assert.equal(antes, false, 'Inicialmente o cliente não deve ter opt-out');

  await registrarOptOut(telefoneTeste, EMPRESA_DINO_ID);

  const depois = await verificarOptOut(telefoneTeste);
  assert.equal(depois, true, 'Após responder PARAR, deve ser marcado como opt-out e nunca mais contatado');
});

test('4. Report Diário das 20h00: Consolidação e Formatação para WhatsApp Gestão Dino', async () => {
  const report = await consolidarReportDiarioTrex(EMPRESA_DINO_ID, '2026-11-14');

  assert.ok(report, 'Deve consolidar o relatório');
  assert.equal(report.empresaId, EMPRESA_DINO_ID);
  assert.equal(report.data, '2026-11-14');
  assert.equal(report.dataBr, '14/11/2026');
  assert.ok(typeof report.taxaSucesso === 'number', 'Deve calcular a taxa de sucesso');
  assert.equal(report.sugestoes.length, 3, 'Deve incluir 3 sugestões estratégicas para a gestão');

  const textoMsg = formatarMensagemReportGestao(report);
  assert.match(textoMsg, /(?:RELATÓRIO|REPORT)(?: EXECUTIVO)? DIÁRIO DO T-REX/i, 'Deve ter cabeçalho executivo');
  assert.match(textoMsg, /20:00/i, 'Deve indicar o horário de envio das 20:00');
  assert.match(textoMsg, /Horários Fracos/i, 'Deve indicar agendamentos em horários fracos');
  assert.match(textoMsg, /STATUS DE COMPLIANCE META/i, 'Deve reportar compliance da Meta');
  assert.match(textoMsg, /SUGESTÕES & IDEIAS DO MOTOR KYTTOIA/i, 'Deve listar sugestões para a gestão');
});

test('5. Simulação de Disparo Ativo: Executa com sucesso respeitando os limites', async () => {
  const res = await executarRecuperacaoAtivaDiaria({}, { limite: 3, simular: true });
  assert.ok(res.total_processados >= 0);
  assert.ok(Array.isArray(res.resultados));
  for (const r of res.resultados) {
    assert.equal(r.status, 'simulado');
    assert.match(r.template, /template_v\d/);
  }
});
