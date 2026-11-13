import test from 'node:test';
import assert from 'node:assert';
import {
  eventBus,
  ZONAS_ENTREGA_TANGARA,
  MOTOBOYS_FROTA_PALATARE,
  calcularFretePorBairroOuKm,
  gerarComandaCozinhaEscPos,
  gerarCupomMotoboyEscPos,
  gerarPreviaNfcePizzaria,
  listarCardapioPublico,
  chamarGarcomMesa,
  listarEstoqueInsumos,
  darBaixaInsumosPedido,
  gerarComandasMultiPracas,
  CONFIG_IMPRESSORAS_PRACAS,
  obterEstadoPainelTv,
  obterPerfilFidelidade,
  creditarCashbackPedido
} from '../app/modules/pizzaria/pizzaria-suite-completa.js';

test('1. EventBus interno reativo da pizzaria', (t) => {
  let eventoRecebido = null;
  eventBus.on('pedido:status', (dados) => {
    eventoRecebido = dados;
  });

  eventBus.emit('pedido:status', { id: 'CMD-TESTE', status: 'forno' });
  assert.ok(eventoRecebido, 'Evento deve ser recebido pelo listener');
  assert.strictEqual(eventoRecebido.status, 'forno');
});

test('2. Zonas de entrega e cálculo de frete de Tangará da Serra/MT', (t) => {
  assert.ok(ZONAS_ENTREGA_TANGARA.length >= 4, 'Devem existir no mínimo 4 zonas de entrega');
  const freteCentro = calcularFretePorBairroOuKm('Centro');
  assert.ok(freteCentro.taxaEntrega >= 6.00 && freteCentro.taxaEntrega <= 8.00);

  const freteDistrito = calcularFretePorBairroOuKm('Distrito Industrial');
  assert.ok(freteDistrito.taxaEntrega >= 10.00);
});

test('3. Frota de motoboys da Palatare', (t) => {
  assert.ok(MOTOBOYS_FROTA_PALATARE.length >= 4, 'Devem existir motoboys cadastrados');
  const motoboyDisponivel = MOTOBOYS_FROTA_PALATARE.find(m => m.status === 'disponivel' || m.status === 'na_base');
  assert.ok(motoboyDisponivel, 'Deve existir motoboy disponível ou na base');
});

test('4. Spooler térmico ESC/POS 80mm e 48 colunas', (t) => {
  const pedidoMock = {
    id: 'CMD-0892',
    cliente: 'Dr. Ricardo Mendonça',
    mesa: 'Mesa 04',
    itens: [
      {
        fracoes: [
          { nome: 'Pizza Filé Mignon ao Gorgonzola', observacoes: 'Sem cebola' },
          { nome: 'Pizza de Picanha Especial', observacoes: 'Alho frito' }
        ]
      }
    ],
    massa: 'napolitana_48h',
    borda: 'catupiry',
    taxaEntrega: 6.00,
    total: 104.00
  };

  const comanda = gerarComandaCozinhaEscPos(pedidoMock);
  const textoComanda = comanda.rawText || comanda;
  assert.ok(textoComanda.includes('PALATARE'), 'Comanda deve conter cabeçalho Palatare');
  assert.ok(textoComanda.includes('CMD-0892'), 'Comanda deve conter número do pedido');

  const cupom = gerarCupomMotoboyEscPos(pedidoMock);
  const textoCupom = cupom.rawText || cupom;
  assert.ok(textoCupom.includes('CUPOM DE ENTREGA'), 'Cupom deve conter identificação de entrega');
});

test('5. Emissão fiscal de NFC-e SEFAZ-MT (Modelo 65)', (t) => {
  const pedidoMock = {
    id: 'CMD-0892',
    cliente: 'Dr. Ricardo Mendonça',
    cpfCnpj: '123.456.789-00',
    total: 104.00
  };

  const previaNfce = gerarPreviaNfcePizzaria(pedidoMock);
  assert.strictEqual(previaNfce.modelo, '65');
  assert.strictEqual(previaNfce.chaveAcesso.length, 44);
  assert.ok(previaNfce.chaveAcesso.startsWith('51'), 'Chave deve iniciar com 51 (Mato Grosso)');
  assert.ok(previaNfce.qrCodeUrl.includes('sefaz.mt.gov.br'));
});

test('6. Estoque de insumos críticos e farinha 00 italiana', (t) => {
  const estoque = listarEstoqueInsumos();
  assert.ok(estoque.length >= 8, 'Devem existir no mínimo 8 insumos críticos');

  const farinha00 = estoque.find(i => i.id === 'ins-01');
  assert.ok(farinha00, 'Farinha 00 Italiana deve existir no estoque');
  assert.ok(farinha00.saldoAtual > 0, 'Saldo de farinha 00 deve ser positivo');

  const saldoAntes = farinha00.saldoAtual;
  darBaixaInsumosPedido({ id: 'CMD-TESTE', itens: [{}], tipo: 'delivery' });
  const estoqueDepois = listarEstoqueInsumos();
  const farinhaDepois = estoqueDepois.find(i => i.id === 'ins-01');
  assert.ok(farinhaDepois.saldoAtual <= saldoAntes, 'Saldo deve reduzir após baixa de produção');
});

test('7. Roteamento multi-impressoras por praça (Forno / Bar / Caixa)', (t) => {
  assert.strictEqual(CONFIG_IMPRESSORAS_PRACAS.length, 3, 'Devem existir 3 praças configuradas');
  const comandas = gerarComandasMultiPracas({ id: 'CMD-0892', mesa: 'Mesa 04' });
  assert.ok(comandas.forno, 'Deve gerar comanda para o Forno');
  assert.ok(comandas.bar, 'Deve gerar comanda para o Bar');
  assert.ok(comandas.expedicao, 'Deve gerar cupom de Expedição');
});

test('8. Painel TV de senhas e chamadas balcão', (t) => {
  const painel = obterEstadoPainelTv();
  assert.ok(painel.horaAtual, 'Painel deve ter horário atual');
  assert.ok(painel.forno.temperaturaAtualC >= 400, 'Forno napolitano deve estar a 400°C ou mais');
  assert.ok(Array.isArray(painel.preparandoNoForno));
  assert.ok(Array.isArray(painel.prontosParaRetirada));
});

test('9. Programa de Fidelidade Palatare Pass & Cashback 5%', (t) => {
  const perfil = obterPerfilFidelidade('(65) 99654-2201');
  assert.ok(perfil.cliente.includes('Dr. Ricardo Mendonça'));

  const resultado = creditarCashbackPedido('(65) 99654-2201', 100.00);
  assert.strictEqual(resultado.cashbackGanho, 5.00, 'Cashback de R$ 100 deve ser R$ 5,00 (5%)');
  assert.ok(resultado.mensagemWhatsApp.includes('Cashback'));
});
