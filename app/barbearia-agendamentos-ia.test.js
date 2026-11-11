import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const pasta = mkdtempSync(join(tmpdir(), 'kytto-agenda-ia-'));
process.env.DB_PATH = join(pasta, 'agenda.json');
const {
  atualizarAgendamento, criarAgendamento, criarProfissional, criarServico,
  estadoEmpresa, obterResumoAgendamentosIa,
} = await import('./barbearia-erp-kytto.js');
after(() => rmSync(pasta, { recursive: true, force: true }));

test('grava a origem da vaga na criação e limpa o vínculo quando o horário muda', () => {
  const empresaId = 'empresa-criacao';
  const profissional = criarProfissional(empresaId, { nome: 'Profissional de teste' });
  const servico = criarServico(empresaId, { nome: 'Corte', preco: 45, duracaoMinutos: 30 });
  const dados = {
    clienteNome: 'Cadastro fictício', profissionalId: profissional.id, servicoId: servico.id,
    dataAgenda: '2030-11-12', horaLocal: '10:00', origem: 'whatsapp_ia',
  };
  const estado = estadoEmpresa(empresaId);
  const cancelado = criarAgendamento(empresaId, dados, { horaOperacionalEstrita: true });
  Object.assign(estado.agendamentos[cancelado.id], {
    status: 'cancelado', criadoEm: '2026-10-01T11:00:00Z', canceladoEm: '2026-10-01T12:00:00Z',
  });
  const novo = criarAgendamento(empresaId, { ...dados, vagaOrigemId: 'injetado' }, { horaOperacionalEstrita: true });
  assert.equal(novo.vagaOrigemId, cancelado.id);
  const salvo = JSON.parse(readFileSync(process.env.DB_PATH, 'utf8'));
  assert.equal(salvo.barbearias[empresaId].agendamentos[novo.id].vagaOrigemId, cancelado.id);
  assert.equal(obterResumoAgendamentosIa(empresaId).vagasRecuperadas.total, 1);

  atualizarAgendamento(empresaId, novo.id, { horaLocal: '11:00' }, { horaOperacionalEstrita: true });
  assert.equal(estado.agendamentos[novo.id].vagaOrigemId, null);
  assert.equal(obterResumoAgendamentosIa(empresaId).vagasRecuperadas.total, 0);
});

test('conta somente vínculos comprovados, separa unidades e distingue confirmação de comanda fechada', () => {
  const empresaId = 'empresa-relatorio';
  const estado = estadoEmpresa(empresaId);
  const base = {
    empresaId, lojaId: 'centro', profissionalId: 'profissional-1', dataAgenda: '2026-11-12',
    horaLocal: '10:00', status: 'agendado', origem: 'whatsapp_ia', valor: 45,
    criadoEm: '2026-11-11T16:00:00Z',
  };
  const origem = { status: 'cancelado', criadoEm: '2026-11-11T14:00:00Z', canceladoEm: '2026-11-11T15:00:00Z' };
  const registros = {
    anterior: { ...origem, confirmacaoAutomatica: { status: 'confirmado' } },
    recuperado: { vagaOrigemId: 'anterior', status: 'confirmado' },
    duplicado: { vagaOrigemId: 'anterior' },
    encaixe: { vagaOrigemId: 'anterior', encaixe: true },
    legado: { horaLocal: '11:00' },
    canceladoLegado: { ...origem, horaLocal: '11:00', motivoCancelamento: 'cliente_desistiu' },
    foraDeOrdem: { vagaOrigemId: 'anterior', criadoEm: '2026-11-11T14:00:00Z' },
    outraUnidade: { vagaOrigemId: 'anterior', lojaId: 'sul' },
    outraEmpresa: { vagaOrigemId: 'anterior', empresaId: 'empresa-estranha' },
    semUnidade: { vagaOrigemId: 'anterior', lojaId: '' },
    vinculoCruzado: { vagaOrigemId: 'canceladoOutraEmpresa', horaLocal: '12:00' },
    canceladoOutraEmpresa: { ...origem, horaLocal: '12:00', empresaId: 'empresa-estranha' },
    semComanda: { status: 'concluido' },
    comComanda: { status: 'concluido' },
    mesmaComanda: { status: 'concluido', historicoRemarcacoes: [{}] },
    comandaOutraUnidade: { status: 'concluido' },
    whatsappManual: { origem: 'whatsapp_equipe' },
    foraPeriodo: { dataAgenda: '2026-11-13' },
  };
  for (const [id, registro] of Object.entries(registros)) estado.agendamentos[id] = { ...base, id, ...registro };
  estado.comandas.paga = {
    id: 'paga', empresaId, lojaId: 'centro', status: 'paga', total: 90,
    agendamentoId: 'comComanda', itens: [{ agendamentoId: 'mesmaComanda' }],
  };
  estado.comandas.cruzada = {
    id: 'cruzada', empresaId, lojaId: 'sul', status: 'paga', total: 45, agendamentoId: 'comandaOutraUnidade',
  };
  const resumo = obterResumoAgendamentosIa(empresaId, {
    de: '2026-11-12', ate: '2026-11-12', lojaId: 'centro', somenteIa: true,
  });
  assert.equal(resumo.criados.total, 12);
  assert.equal(resumo.criados.porOrigem.whatsapp_ia, 12);
  assert.equal(resumo.confirmados.total, 1);
  assert.deepEqual(resumo.concluidos, { total: 2, valorTotal: 90 });
  assert.equal(resumo.remarcados.total, 1);
  assert.equal(resumo.cancelados.total, 2);
  assert.equal(resumo.cancelados.porMotivo.sem_registro, 1);
  assert.equal(resumo.cancelados.porQuem.sem_registro, 2);
  assert.equal(resumo.cancelados.itens.length, 2);
  assert.equal(resumo.vagasRecuperadas.total, 1);
  assert.equal(resumo.vagasRecuperadas.valorRecuperado, 45);
  assert.equal(resumo.vagasRecuperadas.itens[0].agendamentoId, 'recuperado');
  assert.equal(obterResumoAgendamentosIa(empresaId, { profissionalId: 'outro' }).criados.total, 0);
});
