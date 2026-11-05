import test from 'node:test';
import assert from 'node:assert/strict';
import * as empresasSvc from './modules/empresas/servico.js';

test('listarEmpresas retorna lista de empresas com dados formatados', async () => {
  const fakeDb = {
    query: async () => ({
      rows: [
        {
          id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
          nome: 'Barbearia Dino',
          razao_social: 'DINO BARBEARIA LTDA',
          cnpj: '50073355000260',
          inscricao_estadual: '14.229.191-9',
          inscricao_municipal: '12345',
          tipo_negocio: 'barbearia',
          telefone: '65999999999',
          email: 'contato@barbeariadino.com.br',
          ativa: true,
          total_lojas: 1,
        }
      ]
    })
  };

  const lista = await empresasSvc.listarEmpresas(fakeDb);
  assert.ok(Array.isArray(lista));
  assert.ok(lista.length >= 1);
  const dino = lista.find((e) => e.id === 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  assert.ok(dino, 'Barbearia Dino deve estar na lista');
  assert.equal(dino.cnpj, '50.073.355/0002-60', 'CNPJ deve estar formatado com máscara');
  assert.equal(dino.tipoNegocio, 'barbearia');
});

test('criarEmpresa valida CNPJ e rejeita CNPJ com tamanho inválido', async () => {
  const fakeDb = { query: async () => ({ rows: [] }) };

  await assert.rejects(
    async () => {
      await empresasSvc.criarEmpresa(fakeDb, {
        nome: 'Empresa Teste',
        cnpj: '12345' // inválido (não tem 14 dígitos)
      });
    },
    {
      code: 'VALIDATION_ERROR'
    }
  );
});

test('criarEmpresa insere com sucesso e gera ID válido', async () => {
  let insertExecutado = false;
  const fakeDb = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO empresas')) {
        insertExecutado = true;
        return {
          rows: [
            {
              id: params[0],
              nome: params[1],
              razao_social: params[2],
              cnpj: params[3],
              inscricao_estadual: params[4],
              tipo_negocio: params[6],
              ativa: true,
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const nova = await empresasSvc.criarEmpresa(fakeDb, {
    nome: 'Nova Boutique Fitness',
    razaoSocial: 'BOUTIQUE FITNESS LTDA',
    cnpj: '12.345.678/0001-95',
    inscricaoEstadual: '99887766',
    tipoNegocio: 'loja',
    telefone: '65988887777',
    email: 'contato@boutiquefitness.com.br',
    criarLojaMatriz: false
  });

  assert.equal(insertExecutado, true, 'Insert no banco deve ser executado');
  assert.equal(nova.nome, 'Nova Boutique Fitness');
  assert.equal(nova.cnpjNormalizado, '12345678000195');
  assert.ok(nova.id, 'ID deve ser gerado');
});

test('atualizarEmpresa atualiza dados cadastrais e fiscais', async () => {
  let updateExecutado = false;
  const fakeDb = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE empresas')) {
        updateExecutado = true;
        return {
          rows: [
            {
              id: params[0],
              nome: 'Stallone Nutre Sport Premium',
              razao_social: 'E. P. DE SOUZA LTDA',
              cnpj: '56099531000138',
              inscricao_estadual: '13.555.777-0',
              tipo_negocio: 'loja',
              ativa: true,
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const atualizada = await empresasSvc.atualizarEmpresa(fakeDb, '31f70c83-9172-40c2-945f-9e793b5048be', {
    nome: 'Stallone Nutre Sport Premium',
    inscricaoEstadual: '13.555.777-0',
  });

  assert.equal(updateExecutado, true);
  assert.equal(atualizada.nome, 'Stallone Nutre Sport Premium');
  assert.equal(atualizada.inscricaoEstadual, '13.555.777-0');
});

test('excluirOuInativarEmpresa protege Barbearia Dino canônica contra exclusão', async () => {
  const fakeDb = { query: async () => ({ rows: [] }) };

  await assert.rejects(
    async () => {
      await empresasSvc.excluirOuInativarEmpresa(fakeDb, 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
    },
    {
      code: 'VALIDATION_ERROR'
    }
  );
});
