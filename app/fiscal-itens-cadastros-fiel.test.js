import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arquivarCatalogoDemoDino,
  classificarProdutosAgroOpen,
  classificarProdutosStallonePorGrupo,
  auditarCadastrosIncompletos
} from './modules/fiscal/servico.js';

test('arquivarCatalogoDemoDino executa com seguranca e retorna relatorio', async () => {
  const dbMock = {
    query: async (sql, params) => {
      if (sql.includes('est_itens')) {
        return { rowCount: 28, rows: [{ id: '1', nome: 'Picanha', categoria: 'Açougue e Carnes' }] };
      }
      if (sql.includes('commerce_products')) {
        return { rowCount: 3, rows: [{ id: '2', nome: 'Homologação R$ 3,00' }] };
      }
      return { rowCount: 0, rows: [] };
    }
  };

  const res = await arquivarCatalogoDemoDino(dbMock);
  assert.equal(res.ok, true);
  assert.equal(res.totalArquivadosEstoque, 28);
  assert.equal(res.totalArquivadosCommerce, 3);
  assert.match(res.mensagem, /Arquivados com sucesso/);
});

test('classificarProdutosAgroOpen mapeia os 16 produtos oficiais de AOT-001 a AOT-016', async () => {
  const updates = [];
  const dbMock = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE commerce_products')) {
        const sku = params[7];
        updates.push({ sku, ncm: params[1], cfop: params[3] });
        return { rowCount: 1, rows: [{ id: `prod-${sku}`, nome: `Item ${sku}` }] };
      }
      return { rowCount: 1, rows: [] };
    }
  };

  const res = await classificarProdutosAgroOpen(dbMock);
  assert.equal(res.ok, true);
  assert.equal(res.totalClassificados, 16);
  assert.equal(updates.length, 16);
  
  // Confere NCM da Camiseta (61091000) e do Boné (65050090)
  const camiseta = updates.find(u => u.sku === 'AOT-001');
  const bone = updates.find(u => u.sku === 'AOT-002');
  assert.equal(camiseta?.ncm, '61091000');
  assert.equal(bone?.ncm, '65050090');
  assert.equal(camiseta?.cfop, '5102');
});

test('classificarProdutosStallonePorGrupo classifica por grupos de suplementacao', async () => {
  const dbMock = {
    query: async (sql, params) => {
      return { rowCount: 50, rows: [{ id: '1' }] };
    }
  };

  const res = await classificarProdutosStallonePorGrupo(dbMock);
  assert.equal(res.ok, true);
  assert.ok(res.totalClassificados >= 50);
});

test('auditarCadastrosIncompletos identifica pendencias cadastrais de produtos', async () => {
  const dbMock = {
    query: async (sql, params) => {
      if (sql.includes('est_itens')) {
        return {
          rows: [
            { id: '1', nome: 'Item Sem Ncm', sku: 'SKU1', tipo: 'mercadoria', ncm: null, custo_medio: 0, ean: null },
            { id: '2', nome: 'Item Completo', sku: 'SKU2', tipo: 'mercadoria', ncm: '33059000', custo_medio: 25.5, ean: '7891234567890' }
          ]
        };
      }
      if (sql.includes('commerce_products')) {
        return {
          rows: [
            { id: '3', nome: 'Whey Protein', tipo: 'produto', dados_fiscais: { ncm: '21061000' }, sku: 'WHEY-1' }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const res = await auditarCadastrosIncompletos(dbMock, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  assert.equal(res.ok, true);
  assert.equal(res.totais.semNcm, 1);
  assert.equal(res.totais.semCusto, 1);
  assert.equal(res.totais.semEan, 1);
});
