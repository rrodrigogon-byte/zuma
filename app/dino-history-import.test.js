import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { reset } from './db.js';
import { importarHistoricoAtendimentos, listarAgendamentos, listarComandasBarbearia, listarHistoricoAtendimentos, listarMovimentosEstoque } from './barbearia-erp-kytto.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const LOJA = '22222222-2222-4222-8222-222222222222';
const OUTRA_LOJA = '44444444-4444-4444-8444-444444444444';
beforeEach(() => reset());

const atendimento = {
  dataAgenda: '2025-11-10', hora: '10:00', clienteId: 'cliente-1', clienteNome: 'Cliente de teste',
  profissionalId: 'prof-1', profissionalNome: 'Profissional de teste', servicoId: 'srv-1', servicoNome: 'Corte de teste', valor: 50,
};

test('histórico é associado à unidade da sessão, idempotente e não cria agenda, comanda ou movimento', () => {
  const first = importarHistoricoAtendimentos(EMPRESA, [{ ...atendimento, lojaId: '' }], { origem: 'avec', lojaId: LOJA, usuario: 'operador' });
  const again = importarHistoricoAtendimentos(EMPRESA, [atendimento], { origem: 'avec', lojaId: LOJA, usuario: 'operador' });
  assert.equal(first.criados, 1);
  assert.equal(again.existentes, 1);
  assert.equal(listarHistoricoAtendimentos(EMPRESA, { lojaId: LOJA }).length, 1);
  assert.equal(listarHistoricoAtendimentos(EMPRESA, { lojaId: OUTRA_LOJA }).length, 0, 'histórico explicitamente associado a outra unidade não vaza');
  assert.equal(listarAgendamentos(EMPRESA).length, 0);
  assert.equal(listarComandasBarbearia(EMPRESA).length, 0);
  assert.equal(listarMovimentosEstoque(EMPRESA).length, 0);
});

test('linha com outra unidade é recusada, e a unidade faz parte da chave idempotente', () => {
  const wrong = importarHistoricoAtendimentos(EMPRESA, [{ ...atendimento, lojaId: OUTRA_LOJA }], { origem: 'avec', lojaId: LOJA });
  assert.equal(wrong.criados, 0);
  assert.equal(wrong.invalidos[0].motivo, 'unidade_fora_do_escopo');
  const a = importarHistoricoAtendimentos(EMPRESA, [atendimento], { origem: 'avec', lojaId: LOJA });
  const b = importarHistoricoAtendimentos(EMPRESA, [atendimento], { origem: 'avec', lojaId: OUTRA_LOJA });
  assert.equal(a.criados, 1);
  assert.equal(b.criados, 1);
  assert.equal(listarHistoricoAtendimentos(EMPRESA, { lojaId: LOJA }).length, 1);
  assert.equal(listarHistoricoAtendimentos(EMPRESA, { lojaId: OUTRA_LOJA }).length, 1);
});
