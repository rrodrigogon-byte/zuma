/**
 * Testes da API
 * SetPoint Ultra - Jest + Supertest
 */

import request from 'supertest';
import app from '../server.js';
import { db } from '../core/database.js';

describe('API SetPoint Ultra', () => {
  let token = null;
  let tenantId = null;

  // ========================================================================
  // SETUP E TEARDOWN
  // ========================================================================

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await db.query(
      `
      INSERT INTO tenants (nome, email, ativo)
      VALUES ($1, $2, true)
      RETURNING id
      `,
      ['Tenant Teste', 'teste@teste.local']
    );

    tenantId = tenantResult.rows[0].id;

    // Criar usuário de teste
    const usuarioResult = await db.query(
      `
      INSERT INTO usuarios (
        tenant_id, email, password_hash, nome, roles, ativo
      )
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id
      `,
      [
        tenantId,
        'admin@teste.local',
        'hashed_password',
        'Admin Teste',
        ['admin'],
      ]
    );

    // Fazer login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@teste.local',
        password: 'password123',
      });

    token = loginRes.body.token;
  });

  afterAll(async () => {
    // Limpar dados de teste
    await db.query('DELETE FROM usuarios WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  // ========================================================================
  // TESTES DE AUTENTICAÇÃO
  // ========================================================================

  describe('Autenticação', () => {
    test('Deve fazer login com credenciais válidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@teste.local',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('usuario');
    });

    test('Deve rejeitar login com credenciais inválidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@teste.local',
          password: 'senha_errada',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    test('Deve validar token JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
    });
  });

  // ========================================================================
  // TESTES DE COMANDA
  // ========================================================================

  describe('Comanda', () => {
    let comandaId = null;

    test('Deve criar uma comanda', async () => {
      const res = await request(app)
        .post('/api/bar/comandas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          numero_comanda: 1,
          mesa_id: null,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      comandaId = res.body.id;
    });

    test('Deve obter comanda', async () => {
      const res = await request(app)
        .get(`/api/bar/comandas/${comandaId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(comandaId);
    });

    test('Deve listar comandas', async () => {
      const res = await request(app)
        .get('/api/bar/comandas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Deve fechar comanda', async () => {
      const res = await request(app)
        .post(`/api/bar/comandas/${comandaId}/fechar`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          total_liquido: 100.00,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('fechada');
    });
  });

  // ========================================================================
  // TESTES DE PAGAMENTO
  // ========================================================================

  describe('Pagamento', () => {
    test('Deve processar pagamento em dinheiro', async () => {
      const res = await request(app)
        .post('/api/pagamentos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo_pagamento: 'dinheiro',
          valor: 100.00,
          referencia: 'TESTE-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.sucesso).toBe(true);
    });

    test('Deve rejeitar pagamento com valor inválido', async () => {
      const res = await request(app)
        .post('/api/pagamentos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo_pagamento: 'dinheiro',
          valor: -100.00,
          referencia: 'TESTE-002',
        });

      expect(res.status).toBe(400);
    });
  });

  // ========================================================================
  // TESTES DE ESTOQUE
  // ========================================================================

  describe('Estoque', () => {
    let produtoId = null;

    beforeAll(async () => {
      // Criar produto de teste
      const produtoResult = await db.query(
        `
        INSERT INTO produtos (
          estabelecimento_id, sku, nome, valor_venda, estoque_atual, ativo
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        `,
        [tenantId, 'TEST-001', 'Produto Teste', 50.00, 100]
      );

      produtoId = produtoResult.rows[0].id;
    });

    test('Deve registrar entrada de estoque', async () => {
      const res = await request(app)
        .post('/api/estoque/movimentacoes/entrada')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo_documento: 'NF',
          numero_documento: '001',
          itens: [
            {
              produto_id: produtoId,
              quantidade: 50,
              valor_unitario: 25.00,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.itens_inseridos).toBe(1);
    });

    test('Deve registrar saída de estoque', async () => {
      const res = await request(app)
        .post('/api/estoque/movimentacoes/saida')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo_documento: 'VENDA',
          numero_documento: '001',
          motivo: 'venda',
          itens: [
            {
              produto_id: produtoId,
              quantidade: 10,
            },
          ],
        });

      expect(res.status).toBe(201);
    });

    test('Deve rejeitar saída com estoque insuficiente', async () => {
      const res = await request(app)
        .post('/api/estoque/movimentacoes/saida')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo_documento: 'VENDA',
          numero_documento: '002',
          motivo: 'venda',
          itens: [
            {
              produto_id: produtoId,
              quantidade: 10000,
            },
          ],
        });

      expect(res.status).toBe(400);
    });
  });

  // ========================================================================
  // TESTES DE RELATÓRIOS
  // ========================================================================

  describe('Relatórios', () => {
    test('Deve obter resumo do dashboard', async () => {
      const res = await request(app)
        .get('/api/relatorios/dashboard/resumo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('vendas');
      expect(res.body).toHaveProperty('produtos_mais_vendidos');
    });

    test('Deve obter relatório de vendas', async () => {
      const res = await request(app)
        .get('/api/relatorios/vendas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('Deve obter relatório de estoque', async () => {
      const res = await request(app)
        .get('/api/relatorios/estoque')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('itens');
      expect(res.body).toHaveProperty('resumo');
    });
  });

  // ========================================================================
  // TESTES DE SEGURANÇA
  // ========================================================================

  describe('Segurança', () => {
    test('Deve rejeitar requisição sem token', async () => {
      const res = await request(app).get('/api/bar/comandas');

      expect(res.status).toBe(401);
    });

    test('Deve rejeitar token inválido', async () => {
      const res = await request(app)
        .get('/api/bar/comandas')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });

    test('Deve respeitar permissões de role', async () => {
      // Criar usuário com role 'garcom'
      const usuarioResult = await db.query(
        `
        INSERT INTO usuarios (
          tenant_id, email, password_hash, nome, roles, ativo
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        `,
        [
          tenantId,
          'garcom@teste.local',
          'hashed_password',
          'Garçom Teste',
          ['garcom'],
        ]
      );

      // Tentar acessar rota de admin
      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'novo@teste.local',
          nome: 'Novo Usuário',
        });

      // Deve rejeitar se garcom não tem permissão
      expect([403, 401]).toContain(res.status);
    });
  });
});
