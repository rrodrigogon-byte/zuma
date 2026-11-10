import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarSpedFiscalEfd, validarArquivoPvaSped } from './core/sped-efd-avancado.js';
import {
  listarPedidosDeliveryCompleto,
  listarEntregadores,
  cadastrarEntregador,
  atualizarStatusPedidoAvancado,
  apurarCmvDelivery
} from './core/delivery-gestao-entregas.js';

test('SPED Fiscal EFD ICMS/IPI - Geração de Blocos 0, C, E, 1 e 9', async () => {
  const empresa = {
    id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    nome: 'Dino Barbearia Ltda',
    nomeFantasia: 'Dino Barbearia',
    cnpj: '50073355000260',
    inscricaoEstadual: '142291919'
  };

  const documentosSaida = [
    {
      modelo: '65',
      numero: '1001',
      chaveAcesso: '51261050073355000260650010000010011876543210',
      dataEmissao: '2026-10-10',
      valorTotal: 350.00,
      valorIcms: 59.50,
      status: 'autorizado'
    }
  ];

  const resultado = await gerarSpedFiscalEfd({
    empresa,
    periodo: { mes: 10, ano: 2026 },
    documentosSaida
  });

  assert.equal(resultado.sucesso, true);
  assert.ok(resultado.conteudoArquivo.includes('|0000|020|0|'));
  assert.ok(resultado.conteudoArquivo.includes('|C100|1|0|'));
  assert.ok(resultado.conteudoArquivo.includes('|E110|'));
  assert.ok(resultado.conteudoArquivo.includes('|9999|'));
  assert.ok(resultado.estatisticas.totalLinhas > 10);
});

test('Validador Pré-PVA do SPED - Detecção de Inconsistências de Chave de Acesso', () => {
  const spedInvalido = '|0000|020|0|01102026|31102026|Dino|50073355000260|MT|142291919|5107909|||A|1|\r\n|C100|1|0||65|00|1|1001|CHAVE_CURTA|01102026|01102026|100,00|';
  const validacao = validarArquivoPvaSped(spedInvalido);
  assert.equal(validacao.valido, false);
  assert.equal(validacao.statusPva, 'REQUER_AJUSTES');
  assert.ok(validacao.erros.some(e => e.includes('Chave de acesso')));
});

test('Kytto Delivery - Listagem de Entregadores e Cadastro', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const motoboys = listarEntregadores(empresaId);
  assert.ok(motoboys.length >= 2);

  const novo = cadastrarEntregador(empresaId, {
    nome: 'Roberto Express',
    telefone: '5565991122334',
    veiculo: 'Honda Bros 160'
  });
  assert.equal(novo.nome, 'Roberto Express');
  assert.equal(novo.status, 'disponivel');
});

test('Kytto Delivery - Despacho de Pedido com Régua WhatsApp e Atualização de Status', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const pedidos = listarPedidosDeliveryCompleto(empresaId);
  assert.ok(pedidos.length >= 1);

  const despachado = atualizarStatusPedidoAvancado(empresaId, 'del-101', 'saiu_entrega', {
    entregadorId: 'moto-01'
  });

  assert.equal(despachado.sucesso, true);
  assert.equal(despachado.pedido.status, 'saiu_entrega');
  assert.ok(despachado.mensagemWpp.includes('acabou de sair para entrega'));
  assert.ok(despachado.mensagemWpp.includes('Carlos Motoboy'));
});

test('Kytto Delivery - Apuração de CMV Teórico vs Real', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const cmv = apurarCmvDelivery(empresaId);
  assert.ok(cmv.totalFaturado > 0);
  assert.ok(cmv.totalCmvTeorico > 0);
  assert.ok(cmv.totalCmvReal >= cmv.totalCmvTeorico);
  assert.ok(cmv.percCmvTeorico > 0);
});
