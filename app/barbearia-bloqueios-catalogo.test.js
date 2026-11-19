import test from 'node:test';
import assert from 'node:assert/strict';
import * as barbearia from './barbearia-erp-kytto.js';
import { provisionarCatalogoDino } from './dino-catalogo-seed.js';

test('1. Catálogo real: serviços de seed (srv-dino-*) não aparecem ativos quando empresa possui serviços reais', () => {
  const empresaId = `emp-teste-cat-real-${Date.now()}`;
  const prof = barbearia.criarProfissional(empresaId, {
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    especialidade: 'Barbeiro',
  });
  const srvReal = barbearia.criarServico(empresaId, {
    nome: 'BARBA PREMIUM',
    preco: 100,
    duracaoMinutos: 30,
    profissionaisIds: [prof.id],
    permiteAgendamentoOnline: true,
  });
  assert.ok(srvReal.id);

  // Rodar provisionarCatalogoDino na empresa que já tem serviço real
  provisionarCatalogoDino({ empresaId });

  const ativos = barbearia.listarServicos(empresaId);
  const temSeedAtivo = ativos.some((s) => String(s.id).startsWith('srv-dino-'));
  assert.equal(temSeedAtivo, false, 'Nenhum serviço fictício srv-dino-* deve aparecer ativo quando há serviços reais');
  assert.equal(ativos.some((s) => s.nome === 'BARBA PREMIUM'), true);
});

test('2. Bloqueio recorrente por dias da semana (Seg e Qua 18:00 às 18:30 - Buscar filho no judô)', () => {
  const empresaId = `emp-teste-blk-judo-${Date.now()}`;
  const bruno = barbearia.criarProfissional(empresaId, {
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    especialidade: 'Barbeiro',
    diasTrabalho: [1, 2, 3, 4, 5, 6],
    horarioInicio: '08:00',
    horarioFim: '20:00',
  });
  const srv = barbearia.criarServico(empresaId, {
    nome: 'CORTE PREMIUM',
    preco: 100,
    duracaoMinutos: 30,
    profissionaisIds: [bruno.id],
    permiteAgendamentoOnline: true,
  });

  // Gerar lote de Segundas (1) e Quartas (3) durante 30 dias a partir de 2026-11-18 (Quarta)
  const dataInicio = '2026-11-18';
  const diasSemanaValidos = [1, 3]; // Seg e Qua
  const lote = [];
  const cursor = new Date(`${dataInicio}T12:00:00`);
  for (let i = 0; i < 30; i++) {
    if (diasSemanaValidos.includes(cursor.getDay())) {
      const isoDia = cursor.toISOString().slice(0, 10);
      lote.push({
        titulo: 'Buscar filho no judô',
        motivo: 'Toda segunda e quarta das 18:00 às 18:30 o Bruno busca o filho dele no judô',
        inicio: new Date(`${isoDia}T18:00:00-04:00`).toISOString(),
        fim: new Date(`${isoDia}T18:30:00-04:00`).toISOString(),
        profissionalId: bruno.id,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  assert.ok(lote.length >= 8, 'Em 30 dias deve haver pelo menos 8 segundas e quartas');
  const criados = barbearia.criarBloqueiosEmLote(empresaId, lote);
  assert.equal(criados.length, lote.length);

  // Verificar na Quarta-feira 2026-11-25 (futura): 18:00 deve estar bloqueado, 18:30 deve estar livre!
  const horariosQuarta = barbearia.listarHorariosDisponiveis(empresaId, {
    data: '2026-11-25',
    servicoId: srv.id,
    profissionalId: bruno.id,
  });
  const slot1800Qua = horariosQuarta.find((h) => h.horario === '18:00');
  const slot1830Qua = horariosQuarta.find((h) => h.horario === '18:30');
  assert.equal(slot1800Qua?.disponivel, false, 'Quarta às 18:00 deve estar bloqueado para o Bruno');
  assert.equal(slot1830Qua?.disponivel, true, 'Quarta às 18:30 já deve estar liberado para o Bruno');

  // Verificar na Quinta-feira 2026-11-26: 18:00 deve estar livre!
  const horariosQuinta = barbearia.listarHorariosDisponiveis(empresaId, {
    data: '2026-11-26',
    servicoId: srv.id,
    profissionalId: bruno.id,
  });
  const slot1800Qui = horariosQuinta.find((h) => h.horario === '18:00');
  assert.equal(slot1800Qui?.disponivel, true, 'Quinta às 18:00 deve estar disponível (bloqueio é só Seg e Qua)');

  // Desativar série completa
  const desativados = barbearia.desativarBloqueiosSerie(empresaId, {
    profissionalId: bruno.id,
    titulo: 'Buscar filho no judô',
    futurosApenas: false,
  });
  assert.equal(desativados.length, lote.length);
});
