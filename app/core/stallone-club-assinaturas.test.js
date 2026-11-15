import test, { beforeEach } from 'node:test';
import { db } from '../db.js';
import assert from 'node:assert';
import {
  STALLONE_EMPRESA_ID,
  PLANOS_STALLONE_CLUB,
  listarPlanosStalloneClub,
  criarAssinaturaStalloneClub,
  processarCobrancaCicloAssinatura,
  consultarAssinaturaPorCpf,
  listarTodasAssinaturas
} from './stallone-club-assinaturas.js';

beforeEach(() => {
  try {
    const d = db();
    if (d) {
      d.stalloneClubAssinaturas = {};
    }
  } catch {}
});

test('1. Stallone VIP Club: Catálogo de Planos Recorrentes', () => {
  const planos = listarPlanosStalloneClub();
  assert.equal(planos.length, 3);

  const starter = PLANOS_STALLONE_CLUB.starter;
  assert.equal(starter.mensalidade, 169.00);
  assert.equal(starter.itensInclusos.length, 3);
  assert.equal(starter.cashbackPercentual, 5);

  const performance = PLANOS_STALLONE_CLUB.performance;
  assert.equal(performance.mensalidade, 279.00);
  assert.ok(performance.beneficios.some(b => b.includes('Bioimpedância')));

  const elite = PLANOS_STALLONE_CLUB.elite;
  assert.equal(elite.mensalidade, 429.00);
  assert.equal(elite.itensInclusos.length, 5);
  assert.ok(elite.beneficios.some(b => b.includes('Nutricionista')));
});

test('2. Stallone VIP Club: Adesão e Criação de Assinatura', () => {
  const cpfTeste = '055.999.888-77';
  const res = criarAssinaturaStalloneClub({
    empresaId: STALLONE_EMPRESA_ID,
    clienteNome: 'Atleta Rodrigo Fontana',
    clienteCpf: cpfTeste,
    clienteTelefone: '65999887766',
    planoCodigo: 'performance',
    formaPagamento: 'cartao_recorrente'
  });

  assert.equal(res.sucesso, true);
  assert.ok(res.assinatura.id.startsWith('sub-stal-'));
  assert.equal(res.assinatura.planoCodigo, 'performance');
  assert.equal(res.assinatura.valorMensalidade, 279.00);
  assert.equal(res.assinatura.status, 'ativa');

  // Consulta por CPF
  const consultada = consultarAssinaturaPorCpf(STALLONE_EMPRESA_ID, cpfTeste);
  assert.ok(consultada);
  assert.equal(consultada.clienteNome, 'Atleta Rodrigo Fontana');

  // Bloqueio de duplicidade para o mesmo CPF
  assert.throws(() => {
    criarAssinaturaStalloneClub({
      empresaId: STALLONE_EMPRESA_ID,
      clienteNome: 'Atleta Rodrigo Fontana',
      clienteCpf: cpfTeste,
      planoCodigo: 'elite'
    });
  }, /já possui assinatura ativa/);
});

test('3. Stallone VIP Club: Processamento de Ciclo Recorrente e Crédito de Cashback', () => {
  const cpfTeste = '044.888.777-66';
  const adesao = criarAssinaturaStalloneClub({
    empresaId: STALLONE_EMPRESA_ID,
    clienteNome: 'Dra. Camila Nutrição',
    clienteCpf: cpfTeste,
    clienteTelefone: '65999112233',
    planoCodigo: 'elite',
    formaPagamento: 'pix_recorrente'
  });

  const cobranca = processarCobrancaCicloAssinatura(STALLONE_EMPRESA_ID, adesao.assinatura.id);
  assert.equal(cobranca.sucesso, true);
  assert.equal(cobranca.ciclo.status, 'confirmado_pago');
  assert.equal(cobranca.ciclo.valorCobrado, 429.00);

  // 15% de cashback sobre R$ 429,00 = R$ 64,35
  assert.equal(cobranca.ciclo.cashbackGerado, 64.35);
  assert.equal(cobranca.assinatura.saldoCashbackAcumulado, 64.35);
  assert.equal(cobranca.assinatura.ciclosPagos, 1);
  assert.equal(cobranca.assinatura.status, 'em_dia');
});
