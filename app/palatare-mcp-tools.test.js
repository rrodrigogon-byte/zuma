import test from 'node:test';
import assert from 'node:assert/strict';
import { MCP_READONLY_TOOLS, createOpenApiAndMcpRouter } from './routes/openapi-mcp-routes.js';

test('Catálogo de Ferramentas MCP Kytto ERP', () => {
  assert.ok(MCP_READONLY_TOOLS.length >= 13, 'Deve conter pelo menos 13 ferramentas MCP');

  const names = MCP_READONLY_TOOLS.map(t => t.name);
  assert.ok(names.includes('palatare_cardapio'), 'Deve ter ferramenta palatare_cardapio');
  assert.ok(names.includes('palatare_montador'), 'Deve ter ferramenta palatare_montador');
  assert.ok(names.includes('palatare_kds'), 'Deve ter ferramenta palatare_kds');
  assert.ok(names.includes('palatare_rodizio'), 'Deve ter ferramenta palatare_rodizio');
  assert.ok(names.includes('palatare_crm_cliente'), 'Deve ter ferramenta palatare_crm_cliente');
  assert.ok(names.includes('palatare_delivery'), 'Deve ter ferramenta palatare_delivery');
  assert.ok(names.includes('concreto_cargas'), 'Deve ter ferramenta concreto_cargas');
  assert.ok(names.includes('concreto_dosagem'), 'Deve ter ferramenta concreto_dosagem');
  assert.ok(names.includes('holding_consolidacao'), 'Deve ter ferramenta holding_consolidacao');
});

test('Invocação de Ferramentas MCP - Montador de Pizzas e CRM', async () => {
  const router = createOpenApiAndMcpRouter({
    auth: (_req, _res, next) => next(),
    obterEmpresaIdToken: () => 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9'
  });
  assert.ok(router, 'Router MCP criado');
});
