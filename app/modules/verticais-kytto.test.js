import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createVerticaisRouter } from './verticais-kytto.js';

function criarAppMock() {
  const store = {};
  const app = express();
  app.use('/api/v1', createVerticaisRouter({
    getDb: () => store,
    saveDb: () => {},
  }));
  return { app, store };
}

async function reqJson(server, method, path, body) {
  const addr = server.address();
  const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Empresa-Id': 'emp-vert-1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

test('verticais-kytto: oficina (OS + orçamento WhatsApp), varejo (orçamento -> pedido), loja de moda (grade, crediário, condicional, vale) e agropecuária (pet, vacina, prontuário, receituário)', async () => {
  const { app } = criarAppMock();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    // 1. Oficina Mecânica
    const osCriada = await reqJson(server, 'POST', '/api/v1/oficina/ordens', {
      placa: 'qbc-1234',
      marca: 'Toyota',
      modelo: 'Hilux',
      cliente_nome: 'Carlos Motorista',
      cliente_telefone: '65999990000',
      valor_pecas: 450,
      valor_mao_obra: 250,
    });
    assert.equal(osCriada.status, 201);
    assert.equal(osCriada.data.placa, 'QBC-1234');
    assert.equal(osCriada.data.valor_total, 700);
    const wpp = await reqJson(server, 'POST', `/api/v1/oficina/ordens/${osCriada.data.id}/enviar-orcamento`, {});
    assert.equal(wpp.data.ok, true);
    assert.equal(wpp.data.os.status, 'orcamento_enviado');

    // 2. Varejo Geral
    const orc = await reqJson(server, 'POST', '/api/v1/varejo/orcamentos', {
      cliente_nome: 'Construtora MT',
      validade_dias: 10,
      itens: [{ descricao: 'Cabo Flexível 2.5mm', quantidade: 4, unidade: 'RL', valor_unitario: 120 }],
    });
    assert.equal(orc.status, 201);
    assert.equal(orc.data.valor_total, 480);
    const conv = await reqJson(server, 'POST', `/api/v1/varejo/orcamentos/${orc.data.id}/converter`, {});
    assert.equal(conv.data.ok, true);
    assert.equal(conv.data.pedido.valor_total, 480);
    const peds = await reqJson(server, 'GET', '/api/v1/varejo/pedidos');
    assert.equal(peds.data.pedidos.length, 1);

    // 3. Loja de Moda
    const grade = await reqJson(server, 'POST', '/api/v1/loja-moda/grade', {
      produto_nome: 'Camisa Linho Premium',
      referencia: 'LIN-01',
      preco_custo: 70,
      preco_venda: 189.9,
      cores: ['Branco', 'Azul'],
      tamanhos: ['P', 'M', 'G'],
    });
    assert.equal(grade.status, 201);
    assert.equal(grade.data.variantes.length, 6);
    const cred = await reqJson(server, 'POST', '/api/v1/loja-moda/crediario', {
      cliente_nome: 'Ana Moda',
      valor_total: 600,
      entrada: 100,
      num_parcelas: 5,
    });
    assert.equal(cred.status, 201);
    const pago = await reqJson(server, 'POST', `/api/v1/loja-moda/crediario/${cred.data.id}/pagar`, {});
    assert.equal(pago.data.valor_pago, 200);

    // 4. Agropecuária e Petshop
    const pet = await reqJson(server, 'POST', '/api/v1/agropecuaria/pets', {
      nome: 'Thor',
      especie: 'cão',
      raca: 'Golden Retriever',
      peso_kg: 32,
      cliente_nome: 'Roberto Agro',
    });
    assert.equal(pet.status, 201);
    const vac = await reqJson(server, 'POST', '/api/v1/agropecuaria/vacinas', {
      pet_nome: 'Thor',
      nome_vacina: 'V10 Importada',
      veterinario: 'Dra. Juliana',
    });
    assert.equal(vac.status, 201);
    const rec = await reqJson(server, 'POST', '/api/v1/agropecuaria/receituarios', {
      tipo: 'agronomico',
      profissional_nome: 'Eng. Marcos',
      profissional_registro: 'CREA-MT 9912',
      cliente_nome: 'Fazenda Santa Fé',
    });
    assert.equal(rec.status, 201);
    assert.equal(rec.data.numero_receita, 'REC-0001');
  } finally {
    server.close();
  }
});
