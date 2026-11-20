import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import supertest from 'supertest';
import { registerMobileRoutes } from '../app/modules/mobile-api-routes.js';

test('Módulo Mobile & Offline Sync: Suíte Completa de Testes Unitários', async (t) => {
  const app = express();
  app.use(express.json());

  // Mocks do ERP
  const agendamentosDb = [
    {
      id: 'ag-101',
      clienteNome: 'Rodrigo Gonçalves',
      servicoNome: 'Corte e Barba',
      profissionalNome: 'Guilherme Dino',
      dataAgenda: '2026-11-20',
      horaLocal: '15:30',
      status: 'confirmado',
      valor: 100,
      clienteTelefone: '5565999056008',
    },
  ];

  const barbeariaMock = {
    listarAgendamentos: () => agendamentosDb,
    alterarStatusAgendamento: (empId, id, status) => {
      const ag = agendamentosDb.find(a => a.id === id);
      if (ag) ag.status = status;
      return ag;
    },
    listarServicos: () => [
      { id: 'srv-1', nome: 'Corte de Cabelo', preco: 60, duracaoMinutos: 40 },
      { id: 'srv-2', nome: 'Barba Terapia', preco: 50, duracaoMinutos: 35 },
    ],
    listarProfissionais: () => [
      { id: 'prof-1', nome: 'Guilherme Dino', ativo: true },
      { id: 'prof-2', nome: 'Nate Barbeiro', ativo: true },
    ],
    listarProdutosRevenda: () => [
      { id: 'prod-1', nome: 'Pomada Dino Matte', codigoBarras: '78910001', preco: 45, estoque: 20 },
    ],
    listarComandasBarbearia: () => [
      { id: 'com-1', clienteNome: 'Rodrigo', status: 'paga', total: 100 },
    ],
    criarAgendamento: (empId, ag) => {
      agendamentosDb.push(ag);
      return ag;
    },
  };

  registerMobileRoutes(app, {
    db: () => ({}),
    save: () => {},
    legacyEmpresaId: () => 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    legacyLojaId: () => 'matriz',
    barbeariaErpKytto: barbeariaMock,
    listarAgendamentosBarbearia: () => agendamentosDb,
  });

  const request = supertest(app);

  await t.test('1. GET /api/v1/barbearia/agendamentos deve retornar formato esperado pelo app', async () => {
    const res = await request.get('/api/v1/barbearia/agendamentos');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    assert.equal(res.body[0].cliente_nome, 'Rodrigo Gonçalves');
    assert.equal(res.body[0].profissional, 'Guilherme Dino');
    assert.equal(res.body[0].horario, '15:30');
    assert.equal(res.body[0].status, 'confirmado');
  });

  await t.test('2. PATCH /api/v1/barbearia/agendamentos/:id/status deve atualizar status', async () => {
    const res = await request
      .patch('/api/v1/barbearia/agendamentos/ag-101/status')
      .send({ status: 'em_atendimento' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, 'em_atendimento');
    assert.equal(agendamentosDb[0].status, 'em_atendimento');
  });

  await t.test('3. GET /api/v1/barbearia/servicos e /profissionais devem listar ativos', async () => {
    const resServ = await request.get('/api/v1/barbearia/servicos');
    assert.equal(resServ.status, 200);
    assert.equal(resServ.body.length, 2);

    const resProf = await request.get('/api/v1/barbearia/profissionais');
    assert.equal(resProf.status, 200);
    assert.equal(resProf.body.length, 2);
  });

  await t.test('4. GET /api/v1/barbearia/slots deve fornecer grade horária diurna', async () => {
    const res = await request.get('/api/v1/barbearia/slots?data=2026-11-20&profissional_id=prof-1');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.includes('08:00'));
    assert.ok(res.body.includes('19:30'));
    // Não pode conter madrugada
    assert.ok(!res.body.includes('03:00'));
    assert.ok(!res.body.includes('04:30'));
  });

  await t.test('5. GET /api/sync/pull e POST /api/sync/push para WatermelonDB', async () => {
    const resPull = await request.get('/api/sync/pull');
    assert.equal(resPull.status, 200);
    assert.ok(Array.isArray(resPull.body.produtos));
    assert.ok(Array.isArray(resPull.body.categorias));
    assert.ok(Array.isArray(resPull.body.comandas));
    assert.ok(resPull.body.timestamp > 0);

    const resPush = await request.post('/api/sync/push').send({
      tipo_operacao: 'insercao',
      tabela: 'agendamentos',
      registro_id: 'ag-local-999',
      dados: { clienteNome: 'Cliente Offline', valor: 60 },
    });
    assert.equal(resPush.status, 200);
    assert.equal(resPush.body.sincronizado, true);
  });

  await t.test('6. PDV: /api/v1/pdv/produto e /api/v1/pdv/venda', async () => {
    const resProd = await request.get('/api/v1/pdv/produto?codigo=78910001');
    assert.equal(resProd.status, 200);
    assert.equal(resProd.body.nome, 'Pomada Dino Matte');

    const resVenda = await request.post('/api/v1/pdv/venda').send({
      itens: [{ nome: 'Pomada', valor: 45 }],
      forma_pagamento: 'pix',
      valor_total: 45,
    });
    assert.equal(resVenda.status, 201);
    assert.equal(resVenda.body.total, 45);
  });

  await t.test('7. Crediário: /api/v1/crediario/contas/:id/carne e pagamento', async () => {
    const resCarne = await request.get('/api/v1/crediario/contas/cli-1/carne');
    assert.equal(resCarne.status, 200);
    assert.equal(resCarne.body.limiteTotal, 500.0);
    assert.ok(resCarne.body.parcelas.length > 0);

    const resPag = await request.post('/api/v1/crediario/parcelas/parc-1/pagar').send({
      formaPagamento: 'pix',
    });
    assert.equal(resPag.status, 200);
    assert.equal(resPag.body.status, 'paga');
  });

  await t.test('8. BI Dashboard e Alertas', async () => {
    const resDash = await request.get('/api/bi/dashboard?periodo=hoje');
    assert.equal(resDash.status, 200);
    assert.equal(resDash.body.periodo, 'hoje');
    assert.ok(resDash.body.faturamento_hoje >= 0);

    const resAlertas = await request.get('/api/v1/alertas');
    assert.equal(resAlertas.status, 200);
    assert.ok(Array.isArray(resAlertas.body));
  });

  await t.test('9. Diagnóstico do App Mobile: /api/admin/barbearia/app-mobile/status', async () => {
    const resStatus = await request.get('/api/admin/barbearia/app-mobile/status');
    assert.equal(resStatus.status, 200);
    assert.equal(resStatus.body.reactNativeDisponivel, true);
    assert.equal(resStatus.body.credencialPadrao, '123456');
    assert.equal(resStatus.body.urlPwa, 'https://kytto.com.br/barbeiro/dino');
  });
});
