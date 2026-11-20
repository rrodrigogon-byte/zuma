import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './db.js';
import * as carteira from './dino-carteira-clientes.js';
import * as barbearia from './barbearia-erp-kytto.js';

test('Carteira de clientes por profissional - mapeamento e resumo', async (t) => {
  const empId = `test-carteira-${Date.now()}`;
  const root = db();

  root.barbearias ||= {};
  root.barbearias[empId] = {
    profissionais: {
      'prof-dino': { id: 'prof-dino', nome: 'Guilherme Cunha', apelido: 'Dino', ativo: true },
      'prof-nat': { id: 'prof-nat', nome: 'Natani Dobler', apelido: 'Nat', ativo: true },
      'prof-bruno': { id: 'prof-bruno', nome: 'Bruno Mendes', apelido: 'Bruno', ativo: true },
    },
    servicos: {
      'srv-corte': { id: 'srv-corte', nome: 'Corte Tradicional', preco: 60, duracaoMinutos: 30, ativo: true },
    },
    agendamentos: {},
    bloqueios: {},
    comandas: {},
  };

  root.clientesKytto ||= { empresas: {} };
  root.clientesKytto.empresas[empId] = {
    clientes: {
      'cli-1': { id: 'cli-1', nome: 'Carlos Silva', telefone: '65999991111', status: 'ativo', barbeiroId: 'prof-dino', barbeiroNome: 'Guilherme Cunha' },
      'cli-2': { id: 'cli-2', nome: 'Rafael Souza', telefone: '65999992222', status: 'ativo', barbeiroId: 'prof-nat', barbeiroNome: 'Natani Dobler' },
      'cli-3': { id: 'cli-3', nome: 'Marcos Lima', telefone: '65999993333', status: 'ativo' }, // Sem barbeiro explícito
    },
  };

  // Cria agendamento para o cli-3 com Bruno para inferir
  root.barbearias[empId].agendamentos['ag-1'] = {
    id: 'ag-1',
    clienteId: 'cli-3',
    clienteNome: 'Marcos Lima',
    clienteTelefone: '65999993333',
    profissionalId: 'prof-bruno',
    servicoId: 'srv-corte',
    servicoNome: 'Corte Tradicional',
    dataAgenda: '2026-10-10',
    dataHora: '2026-10-10T14:00:00Z',
    status: 'concluido',
    valor: 60,
  };

  await t.test('mapearCarteiras atribui Dino para cli-1 e Nat para cli-2', () => {
    const res = carteira.mapearCarteiras(empId);
    assert.equal(res.carteiraCompleta.length, 3);
    const cli1 = res.carteiraCompleta.find(c => c.clienteId === 'cli-1');
    assert.equal(cli1.barbeiroId, 'prof-dino');
    assert.equal(cli1.barbeiroApelido, 'Dino');

    const cli2 = res.carteiraCompleta.find(c => c.clienteId === 'cli-2');
    assert.equal(cli2.barbeiroId, 'prof-nat');
    assert.equal(cli2.barbeiroApelido, 'Nat');

    // cli-3 foi inferido para Bruno
    const cli3 = res.carteiraCompleta.find(c => c.clienteId === 'cli-3');
    assert.equal(cli3.barbeiroId, 'prof-bruno');
    assert.equal(cli3.barbeiroFonte, 'inferido');
  });

  await t.test('listarCarteiraClientes com filtro de profissional traz apenas clientes do Dino', () => {
    const res = carteira.listarCarteiraClientes(empresaId => empId, { profissionalId: 'prof-dino' });
    const resDino = carteira.listarCarteiraClientes(empId, { profissionalId: 'prof-dino' });
    assert.equal(resDino.total, 1);
    assert.equal(resDino.clientes[0].nome, 'Carlos Silva');
  });

  await t.test('listarCarteiraClientes com filtro de profissional traz apenas clientes da Nat', () => {
    const resNat = carteira.listarCarteiraClientes(empId, { profissionalId: 'prof-nat' });
    assert.equal(resNat.total, 1);
    assert.equal(resNat.clientes[0].nome, 'Rafael Souza');
  });

  await t.test('resumoCarteirasProfissionais totaliza clientes por barbeiro', () => {
    const resumo = carteira.resumoCarteirasProfissionais(empId);
    assert.equal(resumo.totalGeralClientes, 3);
    const cartDino = resumo.carteiras.find(c => c.profissionalId === 'prof-dino');
    assert.equal(cartDino.totalClientes, 1);
    const cartNat = resumo.carteiras.find(c => c.profissionalId === 'prof-nat');
    assert.equal(cartNat.totalClientes, 1);
  });

  await t.test('vincularClienteBarbeiro atualiza o profissional responsável', () => {
    const atualizado = carteira.vincularClienteBarbeiro(empId, 'cli-3', {
      profissionalId: 'prof-dino',
      profissionalNome: 'Guilherme Cunha',
    });
    assert.equal(atualizado.barbeiroId, 'prof-dino');
    const resDino = carteira.listarCarteiraClientes(empId, { profissionalId: 'prof-dino' });
    assert.equal(resDino.total, 2);
  });

  await t.test('gerarMensagemWhatsappRetorno formata texto personalizado', () => {
    const msg = carteira.gerarMensagemWhatsappRetorno({
      clienteNome: 'Carlos Silva',
      barbeiroApelido: 'Dino',
      servicoFavorito: 'Corte Degradê',
      diasSemRetorno: 25,
      linkAgendamento: 'https://kytto.com.br/clube-vip',
    });
    assert(msg.includes('Carlos'));
    assert(msg.includes('Dino'));
    assert(msg.includes('25 dias'));
  });

  await t.test('resumo calcula taxa de retencao e ticket medio', () => {
    const resumo = carteira.resumoCarteirasProfissionais(empId);
    assert(typeof resumo.taxaRetencaoGeral === 'number');
    assert(typeof resumo.ticketMedioGeral === 'number');
    assert.equal(resumo.carteiras[0].taxaRetencao >= 0, true);
  });

  await t.test('exportarCarteiraCsv gera cabecalho e linhas no formato brasileiro', () => {
    const csv = carteira.exportarCarteiraCsv(empId);
    assert(csv.startsWith('\uFEFF'));
    assert(csv.includes('Nome do Cliente;Telefone;Barbeiro Titular'));
    assert(csv.includes('Ciclo Medio Retorno (dias)'));
  });

  await t.test('calcula ciclo medio de retorno em dias por profissional e geral', () => {
    root.barbearias[empId].agendamentos['ag-2'] = {
      id: 'ag-2',
      clienteId: 'cli-3',
      clienteNome: 'Marcos Lima',
      clienteTelefone: '65999993333',
      profissionalId: 'prof-dino',
      servicoId: 'srv-corte',
      servicoNome: 'Corte Tradicional',
      dataAgenda: '2026-10-30',
      dataHora: '2026-10-30T14:00:00Z',
      status: 'concluido',
      valor: 60,
    };
    const res = carteira.resumoCarteirasProfissionais(empId);
    assert.equal(typeof res.cicloMedioRetornoGeral, 'number');
    assert.equal(res.cicloMedioRetornoGeral > 0, true);
    assert.equal(typeof res.carteiras[0].cicloMedioRetornoDias, 'number');
  });

  await t.test('cache em memoria funciona e invalidarCacheCarteira renova dados', () => {
    // Primeira chamada preenche o cache
    const r1 = carteira.mapearCarteiras(empId);
    assert.ok(r1.carteiraCompleta);

    // Segunda chamada reaproveita o cache instantaneamente
    const r2 = carteira.mapearCarteiras(empId);
    assert.equal(r1, r2);

    // Invalidação força recálculo
    carteira.invalidarCacheCarteira(empId);
    const r3 = carteira.mapearCarteiras(empId);
    assert.notEqual(r1, r3);
  });
});
