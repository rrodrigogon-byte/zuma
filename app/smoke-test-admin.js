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
    { rota: '/health', expected: [200], desc: '0. Saúde geral' },
    
    // Módulo 1: Fiscal (NFC-e, NF-e, NFS-e, SPED)
    { rota: '/api/admin/fiscal/estado', expected: [200], desc: '1.1 Fiscal - Estado e Prontidão' },
    { rota: '/api/admin/fiscal/emitentes', expected: [200], desc: '1.2 Fiscal - Emitentes' },
    { rota: '/api/admin/fiscal/certificados', expected: [200], desc: '1.3 Fiscal - Certificados A1' },
    { rota: '/api/admin/fiscal/classificacoes', expected: [200], desc: '1.4 Fiscal - Classificações Tributárias' },
    { rota: '/api/admin/fiscal/numeracao', expected: [200], desc: '1.5 Fiscal - Séries e Numeração' },
    { rota: '/api/admin/fiscal/documentos', expected: [200], desc: '1.6 Fiscal - Documentos Emitidos' },
    { rota: '/api/admin/fiscal/contingencias', expected: [200], desc: '1.7 Fiscal - Contingência Offline (tpEmis 9)' },
    { rota: '/api/admin/fiscal/contador/resumo', expected: [200], desc: '1.8 Fiscal - Resumo Contábil' },
    
    // Módulo 2: PDV e Caixa com Contingência
    { rota: '/api/pdv-offline/terminais', expected: [200], desc: '2.1 PDV - Terminais Provisionados' },
    { rota: '/api/pdv-offline/conflitos', expected: [200], desc: '2.2 PDV - Auditoria de Conflitos Offline' },
    { rota: '/api/admin/bar/produtos', expected: [200], desc: '2.3 PDV - Catálogo do Balcão' },
    
    // Módulo 3: Estoque, Compras, Fichas Técnicas e Inventário
    { rota: '/api/admin/estoque', expected: [200], desc: '3.1 Estoque - Lista Geral e Saldos' },
    { rota: '/api/admin/estoque/ocorrencias', expected: [200], desc: '3.2 Estoque - Ocorrências e Perdas' },
    { rota: '/api/admin/estoque/inventarios', expected: [200], desc: '3.3 Estoque - Histórico de Inventários' },
    { rota: '/api/admin/estoque/acuracidade', expected: [200], desc: '3.4 Estoque - Relatório de Acuracidade' },
    { rota: '/api/admin/fichas-tecnicas', expected: [200], desc: '3.5 Estoque - Fichas Técnicas (Baixa por Insumo)' },
    { rota: '/api/admin/barbearia/compras/reposicao?dias=30', expected: [200], desc: '3.6 Compras - Sugestão de Reposição' },
    { rota: '/api/admin/barbearia/compras/curva-abc?dias=30', expected: [200], desc: '3.7 Compras - Curva ABC por Receita' },
    { rota: '/api/admin/barbearia/estoque-revenda', expected: [200], desc: '3.8 Estoque - Itens de Revenda' },
    
    // Módulo 4: Financeiro com Conciliação Bancária
    { rota: '/api/admin/barbearia/equipe/desempenho?inicio=2026-10-01&fim=2026-11-03', expected: [200], desc: '4.1 Financeiro - Comissões e Metas' },
    
    // Módulo 5: Cadastros Mestres e Multiempresa
    { rota: '/api/admin/a2/funcionarios', expected: [200], desc: '5.1 Mestres - Funcionários' },
    { rota: '/api/admin/a2/fornecedores', expected: [200], desc: '5.2 Mestres - Fornecedores' },
    { rota: '/api/admin/a2/usuarios-mestres', expected: [200], desc: '5.3 Mestres - Usuários' },
    { rota: '/api/admin/barbearia/clientes-360?limit=10', expected: [200], desc: '5.4 Mestres - Cliente 360' },
    
    // Módulo 6: Vendas, CRM e Omnichannel
    { rota: '/api/admin/barbearia/captacao/retornos', expected: [200], desc: '6.1 CRM - Retorno Previsto e Reativação' },
    { rota: '/api/admin/barbearia/antiban', expected: [200], desc: '6.2 CRM - WhatsApp Proteção Antiban' },
    { rota: '/api/admin/cupons', expected: [200], desc: '6.3 Vendas - Cupons e Promoções' },
    { rota: '/api/omnichannel/canais', expected: [200], desc: '6.4 Omnichannel - Canais de Venda' },
    { rota: '/api/omnichannel/fidelidade/configuracao', expected: [200], desc: '6.5 Omnichannel - Regras de Fidelidade' },
    { rota: '/api/omnichannel/pedidos?limit=10', expected: [200], desc: '6.6 Omnichannel - Pedido Único' },
    { rota: '/api/omnichannel/integracoes/tarefas', expected: [200], desc: '6.7 Omnichannel - Tarefas de Integração' },
    
    // Módulo 7 e 8: Inteligência, BI e Verticais
    { rota: '/api/admin/barbearia/cerebro-ia', expected: [200], desc: '7.1 IA - Fatos e Cérebro' },
    { rota: '/api/admin/barbearia/cerebro-ia/grafo', expected: [200], desc: '7.2 IA - Grafo de Conhecimento' },
    { rota: '/api/admin/commerce/storefront', expected: [200], desc: '8.1 E-commerce - Loja Virtual e Catálogo' }
  ];

  let falhas = 0;
  for (const item of rotasCriticas) {
    try {
      const res = await fetch(`${BASE}${item.rota}`, { headers });
      const text = await res.text();
      const ok = item.expected.includes(res.status);
      if (ok) {
        console.log(`[Smoke Test] ✅ ${res.status} em ${item.desc}`);
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
    console.log(`\n[Smoke Test] 🚀 SUCESSO TOTAL: TODAS AS ${rotasCriticas.length} ROTAS DOS 8 MÓDULOS RESPONDERAM 100% OK!`);
  }
}

runSmokeTest().catch((err) => {
  console.error('[Smoke Test] Erro fatal:', err);
  process.exit(1);
});
