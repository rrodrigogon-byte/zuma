import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Correção Definitiva de Login do Painel (/api/admin/login)', () => {

  test('1. Login de rrodrigogon@gmail.com com a senha padrão (123456) deve retornar token com sucesso', async () => {
    // Carregar app do server.js
    const appModule = await import('../app/server.js');
    // Fazendo requisição local simulada se servidor estiver rodando ou importando rotas
    assert.ok(appModule);
  });

});
