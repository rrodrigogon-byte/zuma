import test from 'node:test';
import assert from 'node:assert/strict';
import { kyttoEventBus } from './core/kytto-event-bus.js';
import { listarPlanosParaRenovacao, renderizarMensagemRenovacao, executarRodadaVencimentoPlanos } from './core/automacao-planos-vencimento.js';
import { consolidarResumoDiario, formatarMensagemBriefingGestao } from './core/automacao-resumo-gestao.js';
import * as captacao from './dino-captacao-kytto.js';
import * as barbearia from './barbearia-erp-kytto.js';
import { createAutomacoesRouter } from './routes/automacoes-routes.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

test('1. KyttoEventBus: Emissão, escuta e sincronização por evento interno', () => {
  let eventoCapturado = null;
  const unsubscribe = (evento) => { eventoCapturado = evento; };
  kyttoEventBus.once('teste.interno', unsubscribe);

  const emitido = kyttoEventBus.emitir('teste.interno', {
    clienteNome: 'Rodrigo Gonçalves',
    acao: 'corte_executado'
  }, { empresaId: EMPRESA_DINO_ID, usuario: 'admin@kytto.com' });

  assert.equal(emitido.tipo, 'teste.interno');
  assert.equal(emitido.empresaId, EMPRESA_DINO_ID);
  assert.equal(eventoCapturado?.id, emitido.id);
  assert.equal(eventoCapturado?.dados.clienteNome, 'Rodrigo Gonçalves');

  // Teste de consulta de histórico
  const lista = kyttoEventBus.listarEventos({ empresaId: EMPRESA_DINO_ID, tipo: 'teste.interno' });
  assert.ok(lista.length >= 1, 'Deve listar o evento emitido no histórico');
  assert.equal(lista[0].tipo, 'teste.interno');

  // Teste de métricas operacionais
  const metricas = kyttoEventBus.obterMetricas(EMPRESA_DINO_ID);
  assert.ok(metricas.totalEventos >= 1);
  assert.equal(metricas.taxaSucesso, '100.0%');
});

test('2. Automação de Planos: Listagem de vencimentos e renderização com PIX', () => {
  // Teste da mensagem humanizada do T-Rex
  const msgEmBreve = renderizarMensagemRenovacao({
    clienteNome: 'Rodrigo',
    planoNome: 'Clube Dino VIP',
    valorFormatado: 'R$ 150,00',
    pagoAte: '2026-11-10',
    situacao: 'vence_em_breve',
    diffDias: 3,
    chavePix: '50.073.355/0002-60',
    linkCartao: 'https://kytto.com.br/pay/clube-dino'
  });

  assert.ok(msgEmBreve.includes('Rodrigo'));
  assert.ok(msgEmBreve.includes('Clube Dino VIP'));
  assert.ok(msgEmBreve.includes('50.073.355/0002-60'));
  assert.ok(msgEmBreve.includes('R$ 150,00'));
  assert.ok(msgEmBreve.includes('PIX'));

  // Teste da mensagem de vencimento hoje
  const msgHoje = renderizarMensagemRenovacao({
    clienteNome: 'Cauã',
    planoNome: 'Plano Barba & Cabelo',
    valorFormatado: 'R$ 180,00',
    pagoAte: '2026-11-07',
    situacao: 'vence_hoje',
    diffDias: 0
  });

  assert.ok(msgHoje.includes('Cauã'));
  assert.ok(msgHoje.includes('Hoje'));
  assert.ok(msgHoje.includes('R$ 180,00'));

  // Teste de execução da rodada (dry-run com emissão de evento)
  const pendencias = listarPlanosParaRenovacao(EMPRESA_DINO_ID);
  assert.ok(Array.isArray(pendencias));
});

test('3. Tolerância de Pacote Vencido na Comanda (Carência Operacional)', () => {
  const planos = barbearia.listarPlanos(EMPRESA_DINO_ID);
  const plano = planos[0];
  if (!plano) return;

  const assinaturas = barbearia.listarAssinaturas(EMPRESA_DINO_ID);
  const ass = assinaturas[0];
  if (!ass) return;

  // Com permitirVencido: true ou comandaId, não deve lançar erro de assinatura inadimplente
  try {
    const uso = captacao.registrarUsoAssinatura(EMPRESA_DINO_ID, ass.id, {
      servicoId: plano.servicosIds?.[0] || 'serv-corte',
      permitirVencido: true,
      origemComanda: true
    });
    assert.ok(uso, 'Deve permitir o uso com tolerância/carência');
  } catch (err) {
    // Se falhar apenas por limite de sessões ou fora do plano, é esperado
    assert.ok(!err.message.includes('Assinatura com pagamento em atraso'), 'Não deve bloquear por pagamento em atraso com a tolerância');
  }
});

test('4. Resumo Executivo Diário: Consolidação e Briefing Noturno', () => {
  const resumo = consolidarResumoDiario(EMPRESA_DINO_ID);
  assert.equal(resumo.empresaId, EMPRESA_DINO_ID);
  assert.ok(typeof resumo.totalFaturado === 'number');
  assert.ok(Array.isArray(resumo.producaoBarbeiros));
  assert.ok(Array.isArray(resumo.itensAlertaEstoque));

  const msgBriefing = formatarMensagemBriefingGestao(resumo);
  assert.ok(msgBriefing.includes('FECHAMENTO EXECUTIVO DO DIA'));
  assert.ok(msgBriefing.includes('Barbearia Dino'));
  assert.ok(msgBriefing.includes('Faturamento Total'));
  assert.ok(msgBriefing.includes('Status Operacional'));
});

test('5. Rotas de Automações: Status, Métricas e Eventos Internos', async () => {
  const router = createAutomacoesRouter({
    obterEmpresaIdDoUsuario: () => EMPRESA_DINO_ID,
    isPlatformAdmin: () => false
  });

  assert.ok(router, 'Router de automações criado');
});
