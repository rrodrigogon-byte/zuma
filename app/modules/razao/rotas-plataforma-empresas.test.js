import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRazaoPlataformaRouter } from './rotas.js';

const EMP_A = '11111111-1111-4111-8111-111111111111';
const EMP_B = '22222222-2222-4222-8222-222222222222';

function bancoFalso() {
  const consultas = [];
  return {
    consultas,
    async query(sql, params = []) {
      consultas.push(sql);
      if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) throw new Error('não pode gravar');
      if (sql.includes('to_regclass')) return { rows: [{ t: params[0] }] };
      if (sql.includes('FROM empresas')) return { rows: [{ id: EMP_A, nome: 'Alfa' }, { id: EMP_B, nome: 'Beta' }] };
      if (sql.includes('FROM a2_contas_receber')) return { rows: [{ quantidade: params[0] === EMP_A ? 2 : 0, aberto: params[0] === EMP_A ? 150 : 0, pago: 0 }] };
      if (sql.includes('FROM fin_lancamentos')) return { rows: [{ quantidade: 0, receber: 0, pagar: 0 }] };
      if (sql.includes('FROM fin_config')) return { rows: [] };
      if (sql.includes('fin_fontes_sincronizadas')) return { rows: [] };
      return { rows: [] };
    },
  };
}

test('panorama da conciliação: todas as empresas, três bases, sem gravar nada', async () => {
  const db = bancoFalso();
  const fonteJson = async (empresaId) => (empresaId === EMP_A ? { chaveLegada: 'legado-a', lancamentos: [
    { id: '1', tipo: 'receita', status: 'pendente', valor: 100, lojaId: 'l1' },
    { id: '2', tipo: 'despesa', status: 'pendente', valor: 40.5, lojaId: '' },
    { id: '3', tipo: 'receita', status: 'pago', valor: 10, lojaId: 'l1' },
    { id: '4', tipo: 'outro', status: 'pago', valor: 10 },
  ], mapaUnidades: {} } : null);
  const app = express();
  app.use('/p', createRazaoPlataformaRouter({ db, fonteJson }));
  const servidor = app.listen(0);
  try {
    const resposta = await fetch(`http://127.0.0.1:${servidor.address().port}/p/empresas`);
    assert.equal(resposta.status, 200);
    const corpo = await resposta.json();
    assert.equal(corpo.empresas.length, 2);
    const alfa = corpo.empresas.find((e) => e.nome === 'Alfa');
    assert.deepEqual(alfa.financeiroAntigo, { chaveLegada: 'legado-a', quantidade: 3, receitaPendente: 100, despesaPendente: 40.5, receitaPaga: 10, despesaPaga: 0, semUnidade: 1 });
    assert.deepEqual(alfa.a2ContasReceber, { quantidade: 2, aberto: 150, pago: 0 });
    assert.equal(corpo.empresas.find((e) => e.nome === 'Beta').financeiroAntigo, null);
    assert.ok(db.consultas.every((sql) => !/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)));
  } finally {
    servidor.close();
  }
});
