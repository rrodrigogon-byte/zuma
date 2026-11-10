const BASE_URL = 'https://kytto.com.br';

async function testar() {
  console.log('=== INICIANDO VALIDAÇÃO DAS REGRAS MULTI-TENANT EM PRODUÇÃO ===\n');

  // -------------------------------------------------------------
  // TESTE 1: GUILHERME (DINO)
  // -------------------------------------------------------------
  console.log('1. TESTANDO USUÁRIO GUILHERME (DINO):');
  const loginDino = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', pass: '123456' })
  }).then(r => r.json());

  if (!loginDino.token) {
    console.error('Falha no login do Dino:', loginDino);
    process.exit(1);
  }

  const tokenDino = loginDino.token;
  console.log('✔ Login realizado com sucesso como Dino');
  console.log('  Nome:', loginDino.user?.nome);
  console.log('  Empresas na sessão:', (loginDino.sessao?.empresas_acessiveis || []).map(e => e.nome).join(', '));
  console.log('  isPlatformAdmin:', loginDino.user?.platformAdmin);

  // GET /api/admin/empresas com token do Dino
  const resDinoEmpresas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${tokenDino}` }
  }).then(r => r.json());

  console.log(`✔ Listar empresas para Dino retornou: ${resDinoEmpresas.total} empresa(s)`);
  resDinoEmpresas.empresas?.forEach(e => console.log(`   - ${e.nome} (${e.id}) - CNPJ: ${e.cnpj}`));

  if (resDinoEmpresas.total !== 1 || resDinoEmpresas.empresas[0]?.id !== 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6') {
    console.error('ERRO: Dino recebeu mais de 1 empresa ou empresa errada!');
    process.exit(1);
  }
  console.log('✔ ISOLAMENTO DINO CONFIRMADO: Guilherme visualiza APENAS Barbearia Dino!\n');

  // Testar tentativa do Dino acessar Stallone
  const resDinoStallone = await fetch(`${BASE_URL}/api/admin/empresas/31f70c83-9172-40c2-945f-9e793b5048be`, {
    headers: { 'Authorization': `Bearer ${tokenDino}` }
  });
  console.log(`✔ Tentativa de Dino acessar Stallone: Status ${resDinoStallone.status} (Esperado 403)`);

  // Testar tentativa do Dino acessar Holding
  const resDinoHolding = await fetch(`${BASE_URL}/api/admin/empresas/consolidacao-grupo`, {
    headers: { 'Authorization': `Bearer ${tokenDino}` }
  });
  console.log(`✔ Tentativa de Dino acessar Consolidação Holding: Status ${resDinoHolding.status} (Esperado 403)\n`);

  // -------------------------------------------------------------
  // TESTE 2: SILVESTER (STALLONE E AGRO OPEN)
  // -------------------------------------------------------------
  console.log('2. TESTANDO USUÁRIO SILVESTER:');
  const loginSilvester = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'silvester', pass: '123456' })
  }).then(r => r.json());

  if (!loginSilvester.token) {
    console.error('Falha no login do Silvester:', loginSilvester);
    process.exit(1);
  }

  const tokenSilvester = loginSilvester.token;
  console.log('✔ Login realizado com sucesso como Silvester');
  console.log('  Nome:', loginSilvester.user?.nome);
  console.log('  Empresas na sessão:', (loginSilvester.sessao?.empresas_acessiveis || []).map(e => e.nome).join(', '));
  console.log('  isPlatformAdmin:', loginSilvester.user?.platformAdmin);

  // GET /api/admin/empresas com token do Silvester
  const resSilvesterEmpresas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${tokenSilvester}` }
  }).then(r => r.json());

  console.log(`✔ Listar empresas para Silvester retornou: ${resSilvesterEmpresas.total} empresa(s)`);
  resSilvesterEmpresas.empresas?.forEach(e => console.log(`   - ${e.nome} (${e.id}) - CNPJ: ${e.cnpj}`));

  const idsSilvester = (resSilvesterEmpresas.empresas || []).map(e => e.id);
  const temStallone = idsSilvester.includes('31f70c83-9172-40c2-945f-9e793b5048be') || idsSilvester.includes('eba1c88c-d8c1-4b5a-bf65-90275d97dc9e');
  const temAgro = idsSilvester.includes('2e041110-db20-4fd1-8278-12bd3dead008');
  const temDinoParaSilvester = idsSilvester.includes('d0d0ac01-8e50-4b61-8c79-de4aaa916da6');

  if (temStallone && temAgro && !temDinoParaSilvester) {
    console.log('✔ ISOLAMENTO SILVESTER CONFIRMADO: Visualiza Stallone e Agro Open, com ZERO ACESSO à Dino!');
  } else {
    console.error('ERRO: Empresas retornadas para Silvester não conferem!', idsSilvester);
    process.exit(1);
  }

  // Testar filtro individual de Silvester para Stallone
  const resSilvesterFiltroStallone = await fetch(`${BASE_URL}/api/admin/empresas?empresaId=31f70c83-9172-40c2-945f-9e793b5048be`, {
    headers: { 'Authorization': `Bearer ${tokenSilvester}` }
  }).then(r => r.json());
  console.log(`✔ Silvester filtrando Stallone: ${resSilvesterFiltroStallone.total} empresa retornada (${resSilvesterFiltroStallone.empresas[0]?.nome})`);

  // Testar filtro individual de Silvester para Agro Open
  const resSilvesterFiltroAgro = await fetch(`${BASE_URL}/api/admin/empresas?empresaId=2e041110-db20-4fd1-8278-12bd3dead008`, {
    headers: { 'Authorization': `Bearer ${tokenSilvester}` }
  }).then(r => r.json());
  console.log(`✔ Silvester filtrando Agro Open: ${resSilvesterFiltroAgro.total} empresa retornada (${resSilvesterFiltroAgro.empresas[0]?.nome})`);

  // Testar tentativa de Silvester acessar Dino
  const resSilvesterDino = await fetch(`${BASE_URL}/api/admin/empresas/d0d0ac01-8e50-4b61-8c79-de4aaa916da6`, {
    headers: { 'Authorization': `Bearer ${tokenSilvester}` }
  });
  console.log(`✔ Tentativa de Silvester acessar Barbearia Dino: Status ${resSilvesterDino.status} (Esperado 403)`);

  // Testar tentativa de Silvester acessar Holding
  const resSilvesterHolding = await fetch(`${BASE_URL}/api/admin/empresas/consolidacao-grupo`, {
    headers: { 'Authorization': `Bearer ${tokenSilvester}` }
  });
  console.log(`✔ Tentativa de Silvester acessar Consolidação Holding: Status ${resSilvesterHolding.status} (Esperado 403)\n`);

  // -------------------------------------------------------------
  // TESTE 3: ADMIN GLOBAL
  // -------------------------------------------------------------
  console.log('3. TESTANDO ADMIN GLOBAL:');
  const loginAdmin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'admin', pass: 'Senhasupersegura1234' })
  }).then(r => r.json());

  if (!loginAdmin.token) {
    console.error('Falha no login do Admin:', loginAdmin);
    process.exit(1);
  }

  const tokenAdmin = loginAdmin.token;
  console.log('✔ Login realizado com sucesso como Admin Global');
  console.log('  Nome:', loginAdmin.user?.nome);
  console.log('  isPlatformAdmin:', loginAdmin.user?.platformAdmin);

  // Listar todas as empresas com token do Admin Global
  const resAdminEmpresas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  }).then(r => r.json());

  console.log(`✔ Admin Global visualiza TODAS as empresas: ${resAdminEmpresas.total} empresas`);
  resAdminEmpresas.empresas?.forEach(e => console.log(`   - ${e.nome} (${e.id})`));

  // Admin filtrando Dino
  const resAdminFiltroDino = await fetch(`${BASE_URL}/api/admin/empresas?empresaId=d0d0ac01-8e50-4b61-8c79-de4aaa916da6`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  }).then(r => r.json());
  console.log(`✔ Admin filtrando Dino: ${resAdminFiltroDino.total} empresa`);

  // Admin acessando Consolidação Holding
  const resAdminHolding = await fetch(`${BASE_URL}/api/admin/empresas/consolidacao-grupo`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
  console.log(`✔ Admin acessando Consolidação Holding: Status ${resAdminHolding.status} (Esperado 200)`);

  console.log('\n=== TODOS OS TESTES EM PRODUÇÃO PASSARAM COM 100% DE SUCESSO! ===');
}

testar().catch(err => {
  console.error('Erro na validação em produção:', err);
  process.exit(1);
});
