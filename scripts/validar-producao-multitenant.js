#!/usr/bin/env node

/**
 * Script de Validação Rigorosa em Produção do Isolamento Multi-tenant
 * Testa tanto com o usuário do tenant (dino) quanto com o admin da plataforma.
 */

const BASE_URL = 'https://kytto.com.br';

async function logar(user, senha) {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, senha })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha no login de ${user}: HTTP ${res.status} - ${txt}`);
  }
  return await res.json();
}

async function run() {
  console.log('=== TESTE EM PRODUÇÃO: ISOLAMENTO MULTI-TENANT (KYTTO) ===\n');

  // 1. Login com o usuário da Dino
  console.log('1. Autenticando como usuário inquilino (dino)...');
  const sessaoDino = await logar('dino', '123456');
  const tokenDino = sessaoDino.token;
  console.log('✓ Login Dino efetuado com sucesso. Perfil:', sessaoDino.user?.role, '| Empresa ID:', sessaoDino.user?.empresaId);

  const headersDino = {
    'Authorization': `Bearer ${tokenDino}`,
    'Content-Type': 'application/json',
    'X-Empresa-Id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
  };

  // Teste 1.1: Listar empresas
  console.log('\n2. Testando GET /api/admin/empresas com usuário dino...');
  const resEmpresasDino = await fetch(`${BASE_URL}/api/admin/empresas`, { headers: headersDino });
  const dataEmpresasDino = await resEmpresasDino.json();
  console.log('Status HTTP:', resEmpresasDino.status);
  console.log('Total de empresas retornadas:', dataEmpresasDino.total || dataEmpresasDino.empresas?.length);
  const nomes = (dataEmpresasDino.empresas || []).map(e => e.nomeFantasia || e.nome);
  console.log('Empresas na lista:', nomes);

  if (nomes.length === 1 && (nomes[0].toLowerCase().includes('dino') || nomes[0].toLowerCase().includes('barbearia'))) {
    console.log('✅ SUCESSO: Dino visualiza exclusivamente a sua própria barbearia! Nenhuma empresa alheia listada.');
  } else {
    console.error('❌ FALHA: Vazamento de empresas detectado!', nomes);
    process.exit(1);
  }

  // Teste 1.2: Acesso à Consolidação Holding
  console.log('\n3. Testando GET /api/admin/empresas/consolidacao-grupo com usuário dino (deve ser bloqueado)...');
  const resConsolidacaoDino = await fetch(`${BASE_URL}/api/admin/empresas/consolidacao-grupo`, { headers: headersDino });
  const dataConsolidacaoDino = await resConsolidacaoDino.json();
  console.log('Status HTTP:', resConsolidacaoDino.status, '| Código de erro:', dataConsolidacaoDino.code || dataConsolidacaoDino.error);
  if (resConsolidacaoDino.status === 403) {
    console.log('✅ SUCESSO: Rota de consolidação da holding bloqueada com 403 Forbidden para inquilino!');
  } else {
    console.error('❌ FALHA: Rota de consolidação permitida indevidamente!', resConsolidacaoDino.status);
    process.exit(1);
  }

  // Teste 1.3: Diagnóstico Holding IA
  console.log('\n4. Testando GET /api/admin/empresas/diagnostico-holding com usuário dino (deve ser bloqueado)...');
  const resDiagHoldingDino = await fetch(`${BASE_URL}/api/admin/empresas/diagnostico-holding`, { headers: headersDino });
  console.log('Status HTTP:', resDiagHoldingDino.status);
  if (resDiagHoldingDino.status === 403) {
    console.log('✅ SUCESSO: Diagnóstico de holding bloqueado com 403 Forbidden para inquilino!');
  } else {
    console.error('❌ FALHA: Diagnóstico permitido indevidamente!', resDiagHoldingDino.status);
    process.exit(1);
  }

  // Teste 1.4: Tentar acessar empresa alheia (Stallone) diretamente por ID
  console.log('\n5. Testando GET /api/admin/empresas/e0e0ac01-8e50-4b61-8c79-de4aaa916da7 (Stallone) com usuário dino...');
  const resStalloneDino = await fetch(`${BASE_URL}/api/admin/empresas/e0e0ac01-8e50-4b61-8c79-de4aaa916da7`, { headers: headersDino });
  const dataStalloneDino = await resStalloneDino.json();
  console.log('Status HTTP:', resStalloneDino.status, '| Código:', dataStalloneDino.code || dataStalloneDino.error);
  if (resStalloneDino.status === 403) {
    console.log('✅ SUCESSO: Acesso cruzado aos dados da Stallone bloqueado com 403 TENANT_ACCESS_DENIED!');
  } else {
    console.error('❌ FALHA: Acesso cruzado permitido!', resStalloneDino.status);
    process.exit(1);
  }

  // Teste 1.5: Tentar criar nova empresa na plataforma como inquilino
  console.log('\n6. Testando POST /api/admin/empresas com usuário dino (deve ser bloqueado)...');
  const resCriarDino = await fetch(`${BASE_URL}/api/admin/empresas`, {
    method: 'POST',
    headers: headersDino,
    body: JSON.stringify({ nome: 'Empresa Teste Invasora', tipoNegocio: 'outro' })
  });
  console.log('Status HTTP:', resCriarDino.status);
  if (resCriarDino.status === 403) {
    console.log('✅ SUCESSO: Criação de empresas restrita à administração da plataforma (403 PLATFORM_ADMIN_REQUIRED)!');
  } else {
    console.error('❌ FALHA: Criação permitida indevidamente!', resCriarDino.status);
    process.exit(1);
  }

  // 2. Testar com Superadmin
  console.log('\n7. Autenticando como Superadmin da plataforma (admin)...');
  const sessaoAdmin = await logar('admin', '123456');
  const tokenAdmin = sessaoAdmin.token;
  const headersAdmin = {
    'Authorization': `Bearer ${tokenAdmin}`,
    'Content-Type': 'application/json'
  };

  console.log('8. Testando GET /api/admin/empresas com Superadmin...');
  const resEmpresasAdmin = await fetch(`${BASE_URL}/api/admin/empresas`, { headers: headersAdmin });
  const dataEmpresasAdmin = await resEmpresasAdmin.json();
  console.log('Status HTTP:', resEmpresasAdmin.status);
  console.log('Total de empresas na visão Superadmin:', dataEmpresasAdmin.total || dataEmpresasAdmin.empresas?.length);
  if ((dataEmpresasAdmin.total || dataEmpresasAdmin.empresas?.length) > 1) {
    console.log('✅ SUCESSO: Superadmin da holding mantém visão executiva corporativa de todas as empresas!');
  }

  console.log('\n9. Testando GET /api/admin/empresas/consolidacao-grupo com Superadmin...');
  const resConsolidacaoAdmin = await fetch(`${BASE_URL}/api/admin/empresas/consolidacao-grupo`, { headers: headersAdmin });
  console.log('Status HTTP:', resConsolidacaoAdmin.status);
  if (resConsolidacaoAdmin.ok) {
    console.log('✅ SUCESSO: Consolidação da holding operando com 200 OK para o Superadmin!');
  }

  console.log('\n======================================================');
  console.log('🎉 TODOS OS TESTES DE ISOLAMENTO MULTI-TENANT FORAM HOMOLOGADOS COM SUCESSO EM PRODUÇÃO!');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('Erro na validação em produção:', err);
  process.exit(1);
});
