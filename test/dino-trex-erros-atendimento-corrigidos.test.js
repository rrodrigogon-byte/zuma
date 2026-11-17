import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarAgendamento, estadoEmpresa } from '../app/barbearia-erp-kytto.js';
import { staffPauseMinutes } from '../app/core/whatsapp-staff-takeover.js';

describe('Correções de Erros Humanos e T-Rex (Dino Barbearia)', () => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  it('deve ter staffPauseMinutes reduzido para 30 minutos no máximo por padrão', () => {
    delete process.env.WHATSAPP_AI_STAFF_PAUSE_MIN;
    const pausa = staffPauseMinutes();
    assert.equal(pausa, 30, 'Pausa da equipe deve ser de 30 minutos por padrão para não deixar cliente no vácuo');
  });

  it('deve impedir criação de agendamento duplicado no mesmo dia, hora, barbeiro e cliente', () => {
    const estado = estadoEmpresa(empresaId);
    const servicos = Object.values(estado.servicos || {}).filter(s => s.ativo !== false);
    const profs = Object.values(estado.profissionais || {}).filter(p => p.ativo !== false);
    assert.ok(servicos.length > 0, 'Deve ter serviços');
    assert.ok(profs.length > 0, 'Deve ter profissionais');

    const srv = servicos[0];
    const prof = profs[0];
    const dataAgenda = '2026-11-25';
    const horaLocal = '14:30';
    const dataHora = `${dataAgenda}T${horaLocal}:00-04:00`;

    const ag1 = criarAgendamento(empresaId, {
      clienteNome: 'Roberto Teste Duplicidade',
      clienteTelefone: '5566992476986',
      servicoId: srv.id,
      profissionalId: prof.id,
      dataAgenda,
      horaLocal,
      dataHora,
      status: 'agendado',
    }, { permitirEncaixe: true });

    assert.ok(ag1.id, 'Primeiro agendamento criado com sucesso');

    // Tentar criar exatamente o mesmo agendamento novamente (simulando duplo clique da equipe)
    const ag2 = criarAgendamento(empresaId, {
      clienteNome: 'Roberto Teste Duplicidade',
      clienteTelefone: '5566992476986',
      servicoId: srv.id,
      profissionalId: prof.id,
      dataAgenda,
      horaLocal,
      dataHora,
      status: 'agendado',
    }, { permitirEncaixe: true });

    assert.equal(ag2.id, ag1.id, 'Segundo agendamento idêntico deve retornar o mesmo ID e evitar duplicidade');
  });
});
