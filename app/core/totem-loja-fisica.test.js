import test from 'node:test';
import assert from 'node:assert/strict';
import { reset } from '../db.js';
import * as totemModulo from './totem-loja-fisica.js';

test('Totem e Lojas Físicas: ciclo completo de totem, senhas e painel tv', () => {
  reset();

  // 1. Cadastra totem
  const totem = totemModulo.salvarTotem({
    nome: 'Totem Recepção Dino Barbearia',
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: 'matriz',
    modo: totemModulo.MODOS_TOTEM.HIBRIDO,
    timeoutSegundos: 45,
    pinGerente: '9988',
    permitirPix: true,
  });

  assert.ok(totem.id);
  assert.equal(totem.nome, 'Totem Recepção Dino Barbearia');
  assert.equal(totem.pinGerente, '9988');

  // 2. Lista totens
  const lista = totemModulo.listarTotens({ empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, totem.id);

  // 3. Emite senha normal de atendimento
  const senha1 = totemModulo.emitirSenhaTotem({
    totemId: totem.id,
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: 'matriz',
    tipo: 'atendimento',
    clienteNome: 'Carlos Eduardo',
    clienteTelefone: '11999998888',
    servicoDesejado: 'Corte e Barba',
  });

  assert.equal(senha1.codigo, 'A-001');
  assert.equal(senha1.status, totemModulo.STATUS_SENHA.AGUARDANDO);

  // 4. Emite senha prioritária
  const senha2 = totemModulo.emitirSenhaTotem({
    totemId: totem.id,
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: 'matriz',
    tipo: 'prioritario',
    clienteNome: 'Sr. João Silva',
  });

  assert.equal(senha2.codigo, 'P-002');

  // 5. Atualiza status da senha (chamar na TV)
  const chamada = totemModulo.atualizarStatusSenha({
    id: senha1.id,
    status: totemModulo.STATUS_SENHA.CHAMADA,
    profissionalNome: 'Dino Barbeiro',
    guiche: 'Cadeira 01',
  });

  assert.equal(chamada.status, totemModulo.STATUS_SENHA.CHAMADA);
  assert.equal(chamada.guiche, 'Cadeira 01');

  // 6. Consulta painel TV
  const painel = totemModulo.obterEstadoPainelTV({
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: 'matriz',
  });

  assert.ok(painel.ultimaChamada);
  assert.equal(painel.ultimaChamada.codigo, 'A-001');
  assert.equal(painel.totalAguardando, 1);
  assert.equal(painel.filaAguardando[0].codigo, 'P-002');

  // 7. Registra pedido efetuado no totem
  const pedido = totemModulo.registrarPedidoTotem({
    totemId: totem.id,
    empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    lojaId: 'matriz',
    itens: [
      { nome: 'Pomada Matte Dino', preco: 65, qtd: 1 },
      { nome: 'Energético Monster', preco: 15, qtd: 2 },
    ],
    cliente: { nome: 'Carlos Eduardo', telefone: '11999998888' },
    formaPagamento: 'pix',
    statusPagamento: 'pago',
    total: 95,
  });

  assert.ok(pedido.codigo.startsWith('TOT-'));
  assert.equal(pedido.total, 95);
});
