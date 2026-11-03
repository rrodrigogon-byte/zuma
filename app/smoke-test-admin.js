import assert from 'node:assert';

const BASE = process.env.TEST_BASE_URL || 'https://setpoint-tm5n.onrender.com';

async function runSmokeTest() {
  console.log(`[Smoke Test] Iniciando validação em: ${BASE}`);

  // 1. Login Administrativo
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });

  assert.equal(loginRes.status, 200, `Login falhou com status ${loginRes.status}`);
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log(`[Smoke Test] ✅ Login OK: ${loginData.user?.email}`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Empresa-Id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    'X-Loja-Id': 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8'
  };

  const rotasCriticas = [
    { rota: '/health', expected: [200], desc: 'Saúde geral' },
    // Bloco 1: Fiscal (Item 1 completo)
    { rota: '/api/admin/fiscal/estado', expected: [200], desc: 'Fiscal - Estado e Prontidão' },
    { rota: '/api/admin/fiscal/emitentes', expected: [200], desc: 'Fiscal - Emitentes' },
    { rota: '/api/admin/fiscal/certificados', expected: [200], desc: 'Fiscal - Certificados A1' },
    { rota: '/api/admin/fiscal/classificacoes', expected: [200], desc: 'Fiscal - Classificações Tributárias' },
    { rota: '/api/admin/fiscal/numeracao', expected: [200], desc: 'Fiscal - Séries e Numeração' },
    { rota: '/api/admin/fiscal/documentos', expected: [200], desc: 'Fiscal - Documentos' },
    { rota: '/api/admin/fiscal/contingencias', expected: [200], desc: 'Fiscal - Contingência Offline (tpEmis 9)' },
    { rota: '/api/admin/fiscal/contador/resumo', expected: [200], desc: 'Fiscal - Resumo Contábil' },
    // Outros módulos
    { rota: '/api/pdv-offline/terminais', expected: [200], desc: 'PDV Offline' },
    { rota: '/api/admin/barbearia/cerebro-ia', expected: [200], desc: 'Cérebro IA' },
    { rota: '/api/admin/barbearia/cerebro-ia/grafo', expected: [200], desc: 'Grafo IA' },
    { rota: '/api/admin/barbearia/clientes-360', expected: [200], desc: 'Clientes 360' },
    { rota: '/api/admin/barbearia/antiban', expected: [200], desc: 'Antiban WhatsApp' },
    { rota: '/api/admin/commerce/storefront', expected: [200], desc: 'Commerce Storefront' },
    { rota: '/api/admin/commerce/catalog/products?storefrontId=94ce95de-f36d-4ced-ad92-40f4208a7e06&limit=10&offset=0', expected: [200], desc: 'Catálogo de Produtos' },
    { rota: '/api/admin/barbearia/equipe/desempenho?inicio=2026-10-01&fim=2026-11-03', expected: [200], desc: 'Desempenho da Equipe' },
    { rota: '/api/omnichannel/canais', expected: [200], desc: 'Omnichannel Canais' },
    { rota: '/api/omnichannel/fidelidade/configuracao', expected: [200], desc: 'Omnichannel Fidelidade' },
    { rota: '/api/omnichannel/pedidos?limit=10', expected: [200], desc: 'Omnichannel Pedidos' },
    { rota: '/api/omnichannel/integracoes/tarefas', expected: [200], desc: 'Omnichannel Tarefas' }
  ];

  let falhas = 0;
  for (const item of rotasCriticas) {
    try {
      const res = await fetch(`${BASE}${item.rota}`, { headers });
      const text = await res.text();
      const ok = item.expected.includes(res.status);
      if (ok) {
        console.log(`[Smoke Test] ✅ ${res.status} em ${item.desc} (${item.rota})`);
      } else {
        console.error(`[Smoke Test] ❌ ${res.status} em ${item.desc} (${item.rota}): ${text.slice(0, 150)}`);
        falhas++;
      }
    } catch (err) {
      console.error(`[Smoke Test] ❌ ERRO DE CONEXÃO em ${item.desc} (${item.rota}): ${err.message}`);
      falhas++;
    }
  }

  if (falhas > 0) {
    console.error(`[Smoke Test] 💥 Concluído com ${falhas} falha(s)!`);
    process.exit(1);
  } else {
    console.log(`[Smoke Test] 🚀 TODAS AS ${rotasCriticas.length} ROTAS CRÍTICAS RESPONDERAM 100% OK!`);
  }
}

runSmokeTest().catch((err) => {
  console.error('[Smoke Test] Erro fatal:', err);
  process.exit(1);
});
