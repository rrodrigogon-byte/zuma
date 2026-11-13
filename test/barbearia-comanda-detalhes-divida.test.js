import test from 'node:test';
import assert from 'node:assert/strict';
import { obterFichaCompletaCliente } from '../app/barbearia-cliente-ficha-360.js';
import { DINO_EMPRESA_CANONICA, provisionarEquipeDino } from '../app/dino-equipe-seed.js';

test('Ficha 360 - Abertura e Detalhamento de Comandas a partir das Dívidas', async (t) => {
  provisionarEquipeDino();

  await t.test('1. Deve incluir itens detalhados para as comandas de dívida (ex: Nº 351, Nº 788, Nº 32)', () => {
    // Consultar ficha de cliente com movimentações
    const ficha = obterFichaCompletaCliente(DINO_EMPRESA_CANONICA, 'cli-bruno-mac', { nome: 'Bruno Mac' });
    assert.ok(ficha.ok, 'A consulta da ficha deve retornar ok: true');
    assert.ok(Array.isArray(ficha.comandas), 'comandas deve ser um array');

    // Verificar se a comanda 351 está na lista com seus itens discriminados
    const cmd351 = ficha.comandas.find((c) => String(c.numeroComanda).includes('351'));
    if (cmd351) {
      assert.ok(cmd351.itens.length > 0, 'Comanda Nº 351 deve conter itens detalhados');
      assert.ok(cmd351.total > 0, 'Total da Comanda Nº 351 deve ser maior que zero');
    }

    // Verificar se no extrato de créditos cada dívida possui referência à sua comanda
    for (const mov of ficha.creditos.movimentacoes) {
      if (mov.comanda && mov.comanda !== '—') {
        const limpo = String(mov.comanda).replace(/\D/g, '');
        const vinculada = ficha.comandas.find((c) => String(c.numeroComanda).replace(/\D/g, '') === limpo);
        assert.ok(vinculada, `Dívida da comanda ${mov.comanda} deve ter comanda correspondente na lista de comandas`);
        assert.ok(vinculada.itens && vinculada.itens.length > 0, `Comanda ${mov.comanda} vinculada deve conter itens discriminados`);
      }
    }
  });
});
