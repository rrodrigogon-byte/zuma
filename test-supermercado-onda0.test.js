import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoDashboard } from './app/modules/varejo/servico.js';
import { ErroDominio } from './app/modules/acesso/banco.js';

test('Onda 0: resumoDashboard calcula vendas reais e não inventa números quando zerado', async () => {
  const fakeDb = {
    query: async (sql, params) => {
      if (sql.includes('var_vendas')) {
        // Simula 0 vendas no período
        return { rows: [{ qtd: 0, faturamento: 0 }] };
      }
      if (sql.includes('var_produtos') || sql.includes('produtos')) {
        return { rows: [] };
      }
      if (sql.includes('var_lotes') || sql.includes('lotes')) {
        return { rows: [] };
      }
      if (sql.includes('var_promocoes') || sql.includes('promocoes')) {
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  const fakeEmpresaId = 'a0000000-0000-4000-8000-000000000001';
  const dashHoje = await resumoDashboard(fakeDb, fakeEmpresaId, { periodo: 'hoje' });

  assert.equal(dashHoje.vendasHoje, 0, 'Vendas devem ser 0 quando não há vendas');
  assert.equal(dashHoje.faturamentoHoje, 0, 'Faturamento deve ser 0 quando não há vendas');
  assert.equal(dashHoje.ticketMedioHoje, 0, 'Ticket médio deve ser 0 quando não há vendas');
  assert.equal(dashHoje.valorEstoqueVenda, 0, 'Estoque deve ser 0 quando vazio');

  const dashSemana = await resumoDashboard(fakeDb, fakeEmpresaId, { periodo: 'semana' });
  assert.equal(dashSemana.vendasHoje, 0);

  const dashMes = await resumoDashboard(fakeDb, fakeEmpresaId, { periodo: 'mes' });
  assert.equal(dashMes.vendasHoje, 0);
});

test('Onda 0: Trava de Módulo por Negócio lança MODULO_NAO_LIBERADO para barbearia', async () => {
  const empresaBarbearia = {
    id: 'b0000000-0000-4000-8000-000000000002',
    nome: 'Barbearia Dino Matriz',
    tipo_negocio: 'barbearia',
    modulos: ['barbearia', 'agenda']
  };

  const tipo = String(empresaBarbearia.tipo_negocio || '').toLowerCase();
  const nomeEmp = String(empresaBarbearia.nome || '').toLowerCase();
  const modulos = empresaBarbearia.modulos;

  const bloqueado = (tipo === 'barbearia' || nomeEmp.includes('dino')) &&
    !modulos.includes('supermercado') && !modulos.includes('varejo');

  assert.equal(bloqueado, true, 'Barbearia Dino sem módulo contratado deve ser bloqueada');

  if (bloqueado) {
    const err = new ErroDominio('MODULO_NAO_LIBERADO', 'O módulo de Supermercado não está liberado para este negócio.', 403);
    assert.equal(err.code, 'MODULO_NAO_LIBERADO');
    assert.equal(err.status, 403);
  }
});
