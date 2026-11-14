import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRUPO_GESTAO_DINO_INFO,
  DESTINATARIOS_GESTAO_DINO,
  registrarNotaNpsCliente,
  listarEstatisticasNps,
} from './core/dino-whats-gestao-hub.js';

test('1. Configuração do Grupo Gestão Dino: Retorna participantes e telefones oficiais', () => {
  assert.equal(GRUPO_GESTAO_DINO_INFO.nome, 'Gestão Dino');
  assert.ok(DESTINATARIOS_GESTAO_DINO.includes('5514997462929')); // Rodrigo
  assert.ok(DESTINATARIOS_GESTAO_DINO.includes('5565996722055')); // Guilherme
  assert.ok(DESTINATARIOS_GESTAO_DINO.includes('5514997462929')); // Dino
});

test('2. NPS Pós-Atendimento: Registra nota e calcula média geral e individual', async () => {
  await registrarNotaNpsCliente({
    telefone: '5565999112233',
    nota: 5,
    comentario: 'Bruno mandou muito bem no degradê!',
    clienteNome: 'Marcos Vinicius',
    barbeiroNome: 'Bruno',
  });

  await registrarNotaNpsCliente({
    telefone: '5565999445566',
    nota: 4,
    comentario: 'Muito bom, ambiente agradável.',
    clienteNome: 'Felipe Santos',
    barbeiroNome: 'Bruno',
  });

  const stats = listarEstatisticasNps();
  assert.ok(stats.totalAvaliacoes >= 2);
  assert.ok(stats.desempenhoPorBarbeiro['Bruno']);
  assert.equal(stats.desempenhoPorBarbeiro['Bruno'].total, 2);
  assert.equal(stats.desempenhoPorBarbeiro['Bruno'].media, '4.50');
});
