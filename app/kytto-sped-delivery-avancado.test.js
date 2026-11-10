import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarSpedFiscalEfd,
  validarArquivoPvaSped,
  gerarEfdReinfSalaoParceiro
} from './core/sped-efd-avancado.js';
import {
  listarPedidosDeliveryCompleto,
  obterFilaKds,
  listarEntregadores,
  cadastrarEntregador,
  listarZonasFrete,
  salvarZonaFrete,
  atualizarStatusPedidoAvancado,
  despacharRotaAgrupada,
  fecharAcertoMotoboy,
  gerarComandaTermicaTexto,
  apurarCmvDelivery
} from './core/delivery-gestao-entregas.js';

test('SPED Fiscal EFD ICMS/IPI - Geração de Blocos 0, B, C, D, E, H, K, 1 e 9', async () => {
  const empresa = {
    id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    nome: 'Dino Barbearia Ltda',
    nomeFantasia: 'Dino Barbearia',
    cnpj: '50073355000260',
    inscricaoEstadual: '142291919',
    email: 'financeiro@dinobarbearia.com.br'
  };

  const documentosSaida = [
    {
      modelo: '65',
      numero: '1042',
      chaveAcesso: '51261050073355000260650010000010421876543210',
      dataEmissao: '2026-10-15',
      valorTotal: 600.00,
      valorIcms: 102.00,
      status: 'autorizado'
    }
  ];

  const resultado = await gerarSpedFiscalEfd({ empresa, documentosSaida });
  assert.equal(resultado.sucesso, true);
  assert.ok(resultado.conteudoArquivo.includes('|0000|020|0|'));
  assert.ok(resultado.conteudoArquivo.includes('|B020|')); // ISSQN Tangará da Serra MT
  assert.ok(resultado.conteudoArquivo.includes('|C100|1|0||65|')); // Saídas NFC-e
  assert.ok(resultado.conteudoArquivo.includes('|D100|0|0||57|')); // CT-e Frete
  assert.ok(resultado.conteudoArquivo.includes('|E110|')); // Apuração ICMS
  assert.ok(resultado.conteudoArquivo.includes('|H005|')); // Inventário Estoque
  assert.ok(resultado.conteudoArquivo.includes('|K200|')); // Estoque Escriturado Bloco K
  assert.ok(resultado.conteudoArquivo.includes('|1001|0|')); // Bloco 1
  assert.ok(resultado.conteudoArquivo.includes('|9999|')); // Encerramento Bloco 9
  assert.ok(resultado.estatisticas.totalLinhas > 20);
});

test('Validador Pré-PVA do SPED - Detecção de Inconsistências de Chave de Acesso e Inventário', () => {
  const relatorioValido = validarArquivoPvaSped(
    '|0000|020|0|01102026|31102026|DINO|50073355000260|MT|142291919|5107909|||A|1|\r\n|C100|1|0||65|00|1|1|51261050073355000260650010000010421876543210|01102026|01102026|100,00|0|0,00|0,00|100,00|9|0,00|0,00|0,00|100,00|17,00|0,00|0,00|0,00|0,00|0,00|0,00|\r\n|9999|3|'
  );
  assert.equal(relatorioValido.valido, true);
  assert.equal(relatorioValido.statusPva, 'APROVADO_PRE_PVA');

  const relatorioInvalido = validarArquivoPvaSped(
    '|0000|020|0|01102026|31102026|DINO|123|MT|142291919|5107909|||A|1|\r\n|C100|1|0||65|00|1|1|CHAVE_CURTA|01102026|01102026|100,00|\r\n|9999|3|'
  );
  assert.equal(relatorioInvalido.valido, false);
  assert.ok(relatorioInvalido.erros.length >= 2);
});

test('EFD-Reinf - Lei do Salão Parceiro (Lei 13.352/2016 - Evento R-4010)', () => {
  const empresa = {
    nome: 'Dino Barbearia Ltda',
    cnpj: '50073355000260'
  };
  const reinf = gerarEfdReinfSalaoParceiro({ empresa });
  assert.equal(reinf.sucesso, true);
  assert.ok(reinf.totalBrutoGeral > 0);
  assert.ok(reinf.totalRepasseProfissionais > 0);
  assert.ok(reinf.totalReceitaPropriaSalao > 0);
  assert.equal(reinf.relatorio.length, 2);
  assert.equal(reinf.relatorio[0].eventoEfdReinf, 'R-4010');
  assert.equal(reinf.relatorio[0].baseIrRetidoFonte, 0.00);
});

test('Kytto Delivery - Zonas de Frete de Tangará da Serra MT', () => {
  const empresaId = 'test-emp-zonas';
  const zonas = listarZonasFrete(empresaId);
  assert.ok(zonas.length >= 8);
  const centro = zonas.find(z => z.bairro === 'Centro');
  assert.ok(centro);
  assert.equal(centro.taxa, 6.00);

  const nova = salvarZonaFrete(empresaId, {
    bairro: 'Jardim dos Ipês',
    taxa: 11.50,
    tempoMinutos: 35,
    freteGratisAcimaDe: 130.00
  });
  assert.equal(nova.bairro, 'Jardim dos Ipês');
  assert.equal(nova.taxa, 11.50);
});

test('Kytto Delivery - Monitor KDS com Alertas de Tempo', () => {
  const empresaId = 'test-emp-kds';
  const fila = obterFilaKds(empresaId);
  assert.ok(fila.length >= 2);
  assert.ok(['normal', 'atencao', 'critico'].includes(fila[0].alertaKds));
  assert.ok(typeof fila[0].minutosRestantes === 'number');
});

test('Kytto Delivery - Despacho Agrupado e Impressão Térmica 80mm', async () => {
  const empresaId = 'test-emp-despacho';
  const pedidos = listarPedidosDeliveryCompleto(empresaId);
  const comanda = gerarComandaTermicaTexto(pedidos[0]);
  assert.ok(comanda.includes('BARBEARIA DINO · DELIVERY'));
  assert.ok(comanda.includes('SUBTOTAL:'));
  assert.ok(comanda.includes('TOTAL A PAGAR:'));

  const despacho = await despacharRotaAgrupada(empresaId, 'moto-01', [pedidos[0].id]);
  assert.equal(despacho.sucesso, true);
  assert.equal(despacho.totalPedidosDespachados, 1);
});

test('Kytto Delivery - Fechamento de Acerto do Motoboy com Recibo Quitado', () => {
  const empresaId = 'test-emp-acerto';
  const acerto = fecharAcertoMotoboy(empresaId, 'moto-01', 'Acerto do turno noturno');
  assert.equal(acerto.nome, 'Carlos Motoboy (Flash)');
  assert.ok(acerto.reciboTexto.includes('RECIBO DE ACERTO DE REPASSE DE DIÁRIA DE ENTREGA'));
  assert.ok(acerto.reciboTexto.includes('STATUS: QUITADO COM SUCESSO'));
  assert.ok(acerto.totalLiquidoPago > 0);
});

test('Kytto Delivery - Apuração de CMV Teórico vs Real com Detalhamento de Insumos', () => {
  const empresaId = 'test-emp-cmv';
  const cmv = apurarCmvDelivery(empresaId);
  assert.equal(cmv.sucesso, true);
  assert.ok(cmv.faturamentoTotal > 0);
  assert.ok(cmv.cmvTeorico > 0);
  assert.ok(cmv.cmvReal > 0);
  assert.ok(cmv.variacaoDesperdicio >= 0);
  assert.ok(cmv.itensAvaliados.length >= 3);
});
