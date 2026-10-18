import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgDeTeste, criarBancoTeste, criarCliente } from './fixtures/clube-pg.js';
import * as quadras from '../modules/quadras/servico.js';
import * as acesso from '../modules/acesso/repositorio.js';
import { resumoDoClube } from '../modules/clube/painel-resumo.js';

describe('clube-painel (PostgreSQL)', { skip: pgDeTeste }, () => {
let ctx;
before(async () => {
  ctx = await criarBancoTeste(['073_clube_acesso_controle.sql', '076_clube_retencao.sql', '077_clube_parceiros.sql', '074_clube_contratos_digitais.sql', '075_clube_aulas_agenda.sql', '078_clube_cobrancas.sql', '080_clube_quadras.sql']);
});
after(async () => { await ctx.fechar(); });

test('painel do clube: sócios, atraso, quadras do dia e próximas reservas, só da própria empresa', async () => {
  const emp = randomUUID();
  const agora = new Date('2026-10-20T10:00:00-04:00');
  await quadras.salvarConfig(ctx.db, emp, { funcionamento: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ abre: '05:00', fecha: '23:00' }]])) });
  const [q1] = (await quadras.criarQuadrasEmLote(ctx.db, emp, { quantidade: 2, prefixo: 'Saibro', modalidade: 'tenis', piso: 'saibro' })).criadas;
  const plano = await acesso.salvarPlano(ctx.db, emp, { nome: 'Sócio', valorMensal: 120 });
  const emDia = await criarCliente(ctx.db, emp, 'Sócia Em Dia');
  await acesso.criarMatricula(ctx.db, emp, { customerId: emDia, planoId: plano.id, pagoAte: '2026-11-30', inicio: '2026-01-01' });
  const atrasado = await criarCliente(ctx.db, emp, 'Sócio Atrasado');
  await acesso.criarMatricula(ctx.db, emp, { customerId: atrasado, planoId: plano.id, pagoAte: '2026-09-01', inicio: '2026-01-01' });
  await quadras.reservar(ctx.db, emp, { quadraId: q1.id, customerId: emDia, data: '2026-10-20', hora: '18:00', agora });
  await quadras.reservar(ctx.db, emp, { quadraId: q1.id, tipo: 'manutencao', data: '2026-10-20', hora: '06:00', duracaoMin: 120, agora: new Date('2026-10-20T05:00:00-04:00') });

  const r = await resumoDoClube(ctx.db, emp, { agora });
  assert.equal(r.data, '2026-10-20');
  assert.equal(r.socios.ativos, 2);
  assert.equal(r.socios.inadimplentes, 1);
  assert.equal(r.quadras.quantidade, 2);
  assert.equal(r.quadras.ocupacao.ocupados, 3, '1 h de sócio + 2 h de manutenção');
  assert.deepEqual(r.quadras.proximas.map((p) => [p.inicio, p.quem]), [['18:00', 'Sócia Em Dia']], 'a manutenção das 06h já passou');
  assert.equal(r.pixPendentes.quantidade, 0);
  assert.equal(r.recebidoNoMes, undefined, 'sem valores financeiros no painel da recepção');

  const outra = await resumoDoClube(ctx.db, randomUUID(), { agora });
  assert.equal(outra.socios.ativos, 0);
  assert.equal(outra.quadras.quantidade, 0);
});
});
