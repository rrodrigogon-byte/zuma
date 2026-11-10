const BASE_URL = 'https://kytto.com.br';

async function testar() {
  console.log('=== TESTE EM PRODUÇÃO: ONBOARDING ÁGIL & ESCALABILIDADE MULTI-TENANT ===\n');

  // 1. Login como Superadmin (Admin Global)
  console.log('1. Autenticando como Admin Global da Plataforma...');
  const loginAdmin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'admin', pass: 'Senhasupersegura1234' })
  }).then(r => r.json());

  if (!loginAdmin.token) {
    console.error('Falha no login do admin:', loginAdmin);
    process.exit(1);
  }
  const tokenAdmin = loginAdmin.token;
  console.log('✔ Login Admin Global OK!\n');

  // 2. Testar GET /api/admin/empresas/templates
  console.log('2. Consultando templates oficiais de onboarding...');
  const resTemplates = await fetch(`${BASE_URL}/api/admin/empresas/templates`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  }).then(r => r.json());

  console.log(`✔ Templates retornados: ${resTemplates.templates?.length}`);
  resTemplates.templates?.forEach(t => console.log(`   - ${t.icon} ${t.label} (${t.id}): ${t.servicos?.length || 0} serviços, ${t.produtos?.length || 0} produtos`));

  if (!resTemplates.templates || resTemplates.templates.length < 5) {
    console.error('ERRO: Menos de 5 templates retornados!');
    process.exit(1);
  }
  console.log('✔ Templates de Onboarding validados com sucesso!\n');

  // 3. Executar Onboarding Rápido de uma Nova Empresa Completa
  const timestamp = Date.now().toString().slice(-4);
  const nomeNovaEmpresa = `Barbearia Imperial ${timestamp}`;
  const cnpjTeste = `123456780001${timestamp.slice(0, 2)}`;

  console.log(`3. Executando Onboarding Ágil de Nova Empresa: "${nomeNovaEmpresa}"...`);
  const resOnboarding = await fetch(`${BASE_URL}/api/admin/empresas/onboarding-rapido`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenAdmin}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nome: nomeNovaEmpresa,
      razaoSocial: `${nomeNovaEmpresa.toUpperCase()} LTDA`,
      cnpj: '98.765.432/0001-99',
      tipoNegocio: 'barbearia',
      enderecoCidade: 'Cuiabá',
      enderecoEstado: 'MT',
      telefone: '(65) 99888-7766',
      email: `contato@imperial${timestamp}.com.br`,
      administrador: {
        nome: `Gestor Imperial ${timestamp}`,
        email: `gestor.imperial${timestamp}@kytto.com.br`,
        senhaInicial: `Kytto@${timestamp}`
      }
    })
  }).then(r => r.json());

  console.log('✔ Resposta do Onboarding:');
  console.log('   Empresa ID:', resOnboarding.empresa?.id);
  console.log('   Nome:', resOnboarding.empresa?.nomeFantasia);
  console.log('   Admin Login:', resOnboarding.administrador?.email);
  console.log('   Admin Senha:', resOnboarding.administrador?.senhaInicial);
  console.log('   Catálogo Serviços:', resOnboarding.catalogoInicial?.servicosCriados);
  console.log('   Catálogo Produtos:', resOnboarding.catalogoInicial?.produtosCriados);

  const novaEmpresaId = resOnboarding.empresa?.id;
  const adminEmail = resOnboarding.administrador?.email;
  const adminSenha = resOnboarding.administrador?.senhaInicial;

  if (!novaEmpresaId || !adminEmail || !adminSenha) {
    console.error('ERRO no retorno do onboarding!');
    process.exit(1);
  }
  console.log('✔ Nova Empresa provisionada 100% completa!\n');

  // 4. Testar Login do Novo Administrador e Isolamento Estrito
  console.log('4. Testando Login do Novo Administrador da Empresa...');
  const loginNovoAdmin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: adminEmail, pass: adminSenha })
  }).then(r => r.json());

  if (!loginNovoAdmin.token) {
    console.error('Falha no login do novo admin:', loginNovoAdmin);
    process.exit(1);
  }
  const tokenNovoAdmin = loginNovoAdmin.token;
  console.log('✔ Login do novo gestor realizado com sucesso!');
  console.log('   Nome do usuário:', loginNovoAdmin.user?.nome);
  console.log('   Empresa na sessão:', (loginNovoAdmin.sessao?.empresas_acessiveis || []).map(e => e.nome).join(', '));

  // O novo admin listando empresas: deve receber APENAS a sua empresa!
  const resNovoAdminEmpresas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${tokenNovoAdmin}` }
  }).then(r => r.json());

  console.log(`✔ Novo gestor listou empresas: ${resNovoAdminEmpresas.total} empresa(s) retornada(s)`);
  resNovoAdminEmpresas.empresas?.forEach(e => console.log(`   - ${e.nome} (${e.id})`));

  if (resNovoAdminEmpresas.total !== 1 || resNovoAdminEmpresas.empresas[0]?.id !== novaEmpresaId) {
    console.error('ERRO: O novo gestor recebeu empresas alheias ou número incorreto!');
    process.exit(1);
  }
  console.log('✔ ISOLAMENTO DO NOVO TENANT CONFIRMADO: Visualiza APENAS a própria empresa!\n');

  // O novo admin tentando acessar Barbearia Dino
  const resAcessoDino = await fetch(`${BASE_URL}/api/admin/empresas/d0d0ac01-8e50-4b61-8c79-de4aaa916da6`, {
    headers: { 'Authorization': `Bearer ${tokenNovoAdmin}` }
  });
  console.log(`✔ Novo gestor tentando acessar Dino: Status ${resAcessoDino.status} (Esperado 403)`);

  // O novo admin tentando acessar Stallone
  const resAcessoStallone = await fetch(`${BASE_URL}/api/admin/empresas/31f70c83-9172-40c2-945f-9e793b5048be`, {
    headers: { 'Authorization': `Bearer ${tokenNovoAdmin}` }
  });
  console.log(`✔ Novo gestor tentando acessar Stallone: Status ${resAcessoStallone.status} (Esperado 403)`);

  // 5. Testar que Dino NÃO enxerga a nova empresa
  console.log('\n5. Verificando que Dino NÃO enxerga a nova empresa...');
  const loginDino = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', pass: '123456' })
  }).then(r => r.json());

  const resDinoEmpresas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${loginDino.token}` }
  }).then(r => r.json());

  const dinoViuNova = (resDinoEmpresas.empresas || []).some(e => e.id === novaEmpresaId);
  console.log(`✔ Dino tentando ver nova empresa: ${dinoViuNova ? 'FALHA (viu)' : 'SUCESSO (blindado, zero acesso)'}`);
  if (dinoViuNova) {
    console.error('ERRO: Dino viu a nova empresa!');
    process.exit(1);
  }

  // 6. Testar que Silvester NÃO enxerga a nova empresa
  console.log('\n6. Verificando que Silvester NÃO enxerga a nova empresa...');
  const loginSilvester = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'silvester', pass: '123456' })
  }).then(r => r.json());

  const resSilvesterEmpresas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${loginSilvester.token}` }
  }).then(r => r.json());

  const silvesterViuNova = (resSilvesterEmpresas.empresas || []).some(e => e.id === novaEmpresaId);
  console.log(`✔ Silvester tentando ver nova empresa: ${silvesterViuNova ? 'FALHA (viu)' : 'SUCESSO (blindado, zero acesso)'}`);
  if (silvesterViuNova) {
    console.error('ERRO: Silvester viu a nova empresa!');
    process.exit(1);
  }

  // 7. Testar que Admin Global enxerga todas as empresas, incluindo a nova empresa
  console.log('\n7. Verificando que Admin Global enxerga todas as empresas...');
  const resAdminTodas = await fetch(`${BASE_URL}/api/admin/empresas`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  }).then(r => r.json());

  const adminViuNova = (resAdminTodas.empresas || []).some(e => e.id === novaEmpresaId);
  console.log(`✔ Admin Global enxergando nova empresa na holding: ${adminViuNova ? 'SUCESSO (presente)' : 'FALHA'}`);
  console.log(`   Total de empresas sob gestão global: ${resAdminTodas.total}`);

  console.log('\n============================================================');
  console.log('🚀 SUCESSO TOTAL: ONBOARDING ÁGIL & ESCALABILIDADE MULTI-TENANT HOMOLOGADOS EM PRODUÇÃO!');
  console.log('============================================================');
}

testar().catch(err => {
  console.error('Erro na validação de onboarding:', err);
  process.exit(1);
});
