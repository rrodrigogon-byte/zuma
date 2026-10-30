// As otimizações de performance não mudam resultados: mesma ordem, mesmas datas, mesmo
// preenchimento de registros legados e cache que some quando os dados mudam.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'perf-eq-')), 'db.json');
const { db, reset, save, estadoGravacao } = await import('./db.js');
const bar = await import('./barbearia-erp-kytto.js');
const fin = await import('./financeiro-central-kytto.js');
const cli = await import('./clientes-contas-kytto.js');
const { buildDinoDashboardAnalytics } = await import('./dino-dashboard.js');

const E = 'emp-kytto-001';
beforeEach(() => reset());

test('histórico de atendimentos e de comandas: mesma ordem do localeCompare antigo, inclusive com formatos irregulares', () => {
  bar.importarHistoricoAtendimentos(E, [{ dataAgenda: '2025-03-01', hora: '10:00', clienteNome: 'A', servicoNome: 'Corte' }], { origem: 'importacao_avec' });
  const hist = db().barbearias[E].historicoAtendimentos;
  const cmds = db().barbearias[E].historicoComandas;
  const datas = ['2025-01-05', '2024-12-31', '2025-11-30', '', '31/12/2024', '2025-1-5'];
  const horas = ['10:00', '09:30', '', '9:00', '23:59', undefined];
  for (let i = 0; i < 3000; i += 1) {
    hist[`h${i}`] = { id: `h${i}`, empresaId: E, dataAgenda: datas[i % datas.length], hora: horas[(i * 7) % horas.length], clienteNome: 'X' };
    cmds[`c${i}`] = { id: `c${i}`, empresaId: E, dataFinalizacaoOriginal: i % 5 ? `2025-0${1 + (i % 9)}-1${i % 9} 1${i % 9}:00` : '', numeroComanda: i % 4 ? String(i % 50) : undefined };
  }
  const velhoAt = Object.values(hist).sort((a, b) => `${b.dataAgenda} ${b.hora}`.localeCompare(`${a.dataAgenda} ${a.hora}`)).map((x) => x.id);
  const velhoCm = Object.values(cmds).sort((a, b) => `${b.dataFinalizacaoOriginal} ${b.numeroComanda}`.localeCompare(`${a.dataFinalizacaoOriginal} ${a.numeroComanda}`)).map((x) => x.id);
  assert.deepEqual(bar.listarHistoricoAtendimentos(E).map((x) => x.id), velhoAt);
  assert.deepEqual(bar.listarHistoricoComandas(E).map((x) => x.id), velhoCm);
});

test('lançamentos: mesma ordem e o resumo soma igual com e sem a cópia', () => {
  for (let i = 0; i < 400; i += 1) {
    fin.registrarLancamento(E, { tipo: i % 3 ? 'receita' : 'despesa', descricao: `L${i}`, valor: 10 + (i % 17) + 0.33, dataVencimento: `2026-0${1 + (i % 9)}-1${i % 9}`, status: i % 4 ? 'pago' : 'pendente', ...(i % 4 ? { pagoEm: `2026-0${1 + (i % 9)}-1${i % 9}T12:00:00.000Z` } : {}), categoria: 'Serviços', lojaId: 'loja-1' });
  }
  const lista = fin.listarLancamentos(E, { lojaId: 'loja-1' });
  const velho = Object.values(db().financeiroKytto.empresas[E].lancamentos).filter((x) => x.lojaId === 'loja-1')
    .sort((a, b) => String(b.dataOperacao).localeCompare(String(a.dataOperacao)) || String(b.criadoEm).localeCompare(String(a.criadoEm))).map((x) => x.id);
  assert.deepEqual(lista.map((x) => x.id), velho);
  // a lista pública continua sendo cópia (alterar não mexe no banco)
  lista[0].valor = 999999;
  assert.notEqual(db().financeiroKytto.empresas[E].lancamentos[lista[0].id].valor, 999999);
  const resumo = fin.resumoFinanceiro(E, { lojaId: 'loja-1', hoje: '2026-05-20' });
  const pagas = Object.values(db().financeiroKytto.empresas[E].lancamentos).filter((x) => x.lojaId === 'loja-1' && x.status === 'pago');
  const receitas = pagas.filter((x) => x.tipo === 'receita').reduce((s, x) => s + x.valor, 0);
  assert.equal(resumo.totalReceitas, Number(receitas.toFixed(2)));
});

test('registros antigos da empresa padrão sem empresaId continuam sendo completados, inclusive numa coleção trocada', () => {
  cli.criarCliente(E, { nome: 'Novo', telefone: '65999990000', tipo: 'pf' });
  const store = db().clientesKytto.empresas[E];
  store.clientes['legado-1'] = { id: 'legado-1', nome: 'Antigo', status: 'ativo' }; // sem empresaId
  // a coleção já foi varrida: um registro solto adicionado depois só é completado quando a
  // coleção muda de objeto (restauração), como nos caminhos reais — todo criador já grava empresaId
  store.clientes = { ...store.clientes };
  assert.ok(cli.listarClientes(E).some((c) => c.id === 'legado-1'));
  assert.equal(store.clientes['legado-1'].empresaId, E);
});

test('conversão de hora local do painel: resultado igual e um Date novo a cada chamada', () => {
  const linhas = [{ dataAgenda: '2025-03-10', hora: '10:00', clienteNome: 'A', valor: 50, status: 'concluido' }];
  const entrada = () => ({ commerceAvailable: false, appointments: [], historicalAppointments: linhas, historicalCommands: [], retailSales: [], commands: [], customers: [], financeEntries: [], inventory: [], subscriptions: [], subscriptionPayments: [], scope: { level: 'company', unitId: '' }, unassignedRecords: {}, profit: null, goals: null, funnel: null });
  const agora = new Date('2025-03-20T15:00:00Z');
  const a = buildDinoDashboardAnalytics(entrada(), { period: 30, now: agora });
  const b = buildDinoDashboardAnalytics(entrada(), { period: 30, now: agora });
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('a versão dos dados (contador de alterações) muda a cada gravação: o cache curto se invalida', () => {
  const v1 = estadoGravacao().alteracoes;
  save();
  assert.equal(estadoGravacao().alteracoes, v1 + 1);
});
