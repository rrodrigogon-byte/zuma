import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarAutopecas,
  salvarAutopeca,
  GRUPOS_AUTOPECAS,
  MONTADORAS_MODELOS,
  CATALAGO_AUTOPECAS_DEFAULT
} from '../app/modules/autopecas/autopecas-suite.js';
import {
  createAutoPecasAdminRouter,
  createAutoPecasPublicoRouter
} from '../app/routes/autopecas-routes.js';
import express from 'express';

test('Suite Completa de Autopeças & E-commerce no ERP Kytto', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/autopecas', createAutoPecasAdminRouter());
  app.use('/api/publico/autopecas', createAutoPecasPublicoRouter());

  await t.test('1. Consulta por Placa do Veículo (Busca Inteligente Veicular)', () => {
    // Placa da Amarok: RNI-4E29
    const pecasAmarok = buscarAutopecas({ placa: 'RNI-4E29' });
    assert.ok(pecasAmarok.length > 0, 'Deve encontrar peças compatíveis com a Amarok');
    const pastilha = pecasAmarok.find(p => p.sku === 'AP-FR-001');
    assert.ok(pastilha, 'Deve encontrar pastilha dianteira para Amarok');
    assert.equal(pastilha.codigoOem, '2H0698151A');
  });

  await t.test('2. Consulta por Código OEM e Cross-Reference', () => {
    const buscaOem = buscarAutopecas({ termo: '17801-0L040' });
    assert.equal(buscaOem.length, 1);
    assert.equal(buscaOem[0].fabricante, 'Mahle Metal Leve');

    const buscaCruzada = buscarAutopecas({ termo: 'BOSCH 0986AB2345' });
    assert.equal(buscaCruzada.length, 1);
    assert.equal(buscaCruzada[0].sku, 'AP-FR-001');
  });

  await t.test('3. Parâmetros Fiscais de Autopeças (Substituição Tributária e CEST)', () => {
    const peca = CATALAGO_AUTOPECAS_DEFAULT[0];
    assert.ok(peca.ncm.startsWith('8708'), 'NCM de autopeças deve pertencer ao capítulo 87');
    assert.ok(peca.cest.startsWith('01.'), 'CEST de autopeças deve iniciar com 01');
    assert.equal(peca.cstIcms, '500', 'Deve utilizar CST/CSOSN 500 de ICMS-ST');
    assert.equal(peca.cstPisCofins, '04', 'Deve utilizar CST 04 Monofásico Alíquota Zero');
    assert.ok(peca.localizacao.corredor, 'Deve possuir endereçamento físico de estoque');
  });

  await t.test('4. API Admin: Listagem e Requisição de Peça para Ordem de Serviço da Oficina', async () => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const resReq = await fetch(`http://127.0.0.1:${port}/api/admin/autopecas/requisicao-oficina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pecaId: 'peca-001', quantidade: 2, numeroOs: 'OS-2026-01042' })
      });
      assert.equal(resReq.status, 200);
      const data = await resReq.json();
      assert.equal(data.ok, true);
      assert.ok(data.mensagem.includes('requisitada com sucesso'));
    } finally {
      server.close();
    }
  });

  await t.test('5. API Pública E-commerce: Catálogo com Filtro por Garagem Virtual', async () => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const resCat = await fetch(`http://127.0.0.1:${port}/api/publico/autopecas/catalogo?montadora=Toyota&modelo=Hilux`);
      assert.equal(resCat.status, 200);
      const data = await resCat.json();
      assert.equal(data.ok, true);
      assert.ok(data.pecas.length > 0, 'Deve retornar peças da Hilux no e-commerce');
      assert.equal(data.cidade, 'Tangará da Serra / MT');
    } finally {
      server.close();
    }
  });
});
