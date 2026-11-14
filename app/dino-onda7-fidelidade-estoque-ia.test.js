import test from 'node:test';
import assert from 'node:assert';
import {
  consultarCarteiraKyttoPoints,
  creditarCashbackCompra,
  resgatarKyttoPoints,
  VALOR_POR_PONTO_REAIS
} from './core/kytto-points-loyalty.js';
import {
  executarDiagnosticoRupturaEstoque,
  alertarRupturaWhatsApp
} from './core/reposicao-estoque-ia.js';

test('1. Fidelidade & Cashback Cross-Verticais: Acúmulo e Resgate de Kytto Points', async () => {
  const cpfTeste = '04598712399';

  // 1. Consulta inicial (saldo zero)
  const cartInicial = consultarCarteiraKyttoPoints(cpfTeste);
  assert.strictEqual(cartInicial.saldoPontos, 0);

  // 2. Compra de R$ 100,00 na Barbearia Dino (5% cashback = R$ 5,00 = 100 pontos)
  const cred1 = await creditarCashbackCompra({
    identificador: cpfTeste,
    nomeCliente: 'Carlos Eduardo',
    valorCompra: 100.00,
    origemNegocio: 'Barbearia Dino',
    notificarWhats: false
  });

  assert.strictEqual(cred1.ok, true);
  assert.strictEqual(cred1.pontosGanhos, 100);
  assert.strictEqual(cred1.valorCashbackReais, 5.00);
  assert.strictEqual(cred1.novoSaldoPontos, 100);
  assert.strictEqual(cred1.novoSaldoReais, 5.00);

  // 3. Compra de R$ 80,00 na Palatare Pizzaria (5% cashback = R$ 4,00 = 80 pontos)
  const cred2 = await creditarCashbackCompra({
    identificador: cpfTeste,
    valorCompra: 80.00,
    origemNegocio: 'Palatare Pizzaria',
    notificarWhats: false
  });

  assert.strictEqual(cred2.novoSaldoPontos, 180); // 100 + 80 = 180
  assert.strictEqual(cred2.novoSaldoReais, 9.00);   // 180 * 0.05 = R$ 9,00

  // 4. Resgate de 100 pontos (R$ 5,00 de desconto) no Supermercado Kytto
  const resg = resgatarKyttoPoints(cpfTeste, 100, 'Supermercado Kytto');
  assert.strictEqual(resg.ok, true);
  assert.strictEqual(resg.pontosResgatados, 100);
  assert.strictEqual(resg.valorDescontoReais, 5.00);
  assert.strictEqual(resg.saldoRestantePontos, 80);
  assert.strictEqual(resg.saldoRestanteReais, 4.00);

  // 5. Testar tentativa de resgate além do saldo
  const resgInvalido = resgatarKyttoPoints(cpfTeste, 500, 'Barbearia Dino');
  assert.strictEqual(resgInvalido.ok, false);
  assert.ok(resgInvalido.error.includes('Saldo insuficiente'));
});

test('2. IA Preditiva de Estoque: Ponto de Encomenda & Ordens de Compra Sugeridas', async () => {
  const analise = executarDiagnosticoRupturaEstoque();

  assert.strictEqual(analise.motorIa, 'Motor KyttoIA 2.5 Flash Industrial Engine');
  assert.ok(analise.totalItensMonitorados >= 8);
  assert.ok(analise.itensCriticos > 0);
  assert.ok(analise.valorTotalOrdensSugeridas > 0);

  // Validar se há itens das 4 empresas monitoradas
  const empresas = new Set(analise.diagnostico.map(d => d.empresa));
  assert.ok(empresas.has('Barbearia Dino'));
  assert.ok(empresas.has('Serrano Concreto'));
  assert.ok(empresas.has('Palatare Pizzaria'));
  assert.ok(empresas.has('Supermercado Kytto'));

  // Validar ordem sugerida de reposição
  const ordemCimento = analise.ordensCompraSugeridas.find(o => o.nome.includes('Cimento'));
  if (ordemCimento) {
    assert.ok(ordemCimento.quantidadeSugerida > 0);
    assert.strictEqual(ordemCimento.fornecedor, 'Votorantim Cimentos MT');
  }

  // Testar envio de alerta WhatsApp com mock
  const alerta = await alertarRupturaWhatsApp('5514997462929');
  assert.strictEqual(alerta.ok, true);
});
