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
    { rota: '/health', expected: [200] },
    { rota: '/api/admin/fiscal/documentos', expected: [200] },
    { rota: '/api/admin/fiscal/estado', expected: [200] },
    { rota: '/api/admin/fiscal/contingencias', expected: [200] },
    { rota: '/api/pdv-offline/terminais', expected: [200] },
    { rota: '/api/admin/barbearia/cerebro-ia', expected: [200] },
    { rota: '/api/admin/barbearia/cerebro-ia/grafo', expected: [200] },
    { rota: '/api/admin/barbearia/clientes-360', expected: [200] },
    { rota: '/api/admin/barbearia/antiban', expected: [200] },
    { rota: '/api/admin/commerce/storefront', expected: [200] },
    { rota: '/api/admin/commerce/catalog/products?storefrontId=94ce95de-f36d-4ced-ad92-40f4208a7e06&limit=10&offset=0', expected: [200] },
    { rota: '/api/admin/barbearia/equipe/desempenho?inicio=2026-10-01&fim=2026-11-03', expected: [200] }
  ];

  let falhas = 0;
  for (const item of rotasCriticas) {
    try {
      const res = await fetch(`${BASE}${item.rota}`, { headers });
      const text = await res.text();
      const ok = item.expected.includes(res.status);
      if (ok) {
        console.log(`[Smoke Test] ✅ ${res.status} em ${item.rota}`);
      } else {
        console.error(`[Smoke Test] ❌ ${res.status} em ${item.rota} (esperado ${item.expected.join(',')}): ${text.slice(0, 150)}`);
        falhas++;
      }
    } catch (err) {
      console.error(`[Smoke Test] ❌ ERRO DE CONEXÃO em ${item.rota}: ${err.message}`);
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
