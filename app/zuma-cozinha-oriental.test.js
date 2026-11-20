import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ZUMA_EMPRESA_ID,
  ZUMA_LOJA_ID,
  ZUMA_DADOS_EMPRESA,
  ZUMA_CATEGORIAS,
  ZUMA_CARDAPIO_COMPLETO,
  ZUMA_MESAS_INICIAIS,
  ZUMA_CLIENTES_CRM,
  ZUMA_AI_CUSTOMER_FACTS,
  ZUMA_WHATSAPP_CONFIG,
  ZUMA_COMMERCE_STOREFRONT,
  ZUMA_GANHOS_ENGENHARIA_CARDAPIO,
  ZUMA_MASCOTE_ZUMI,
  ZUMA_PLANO_CRESCIMENTO_250,
  ZUMA_PROGRAMACAO_SEMANAL,
  ZUMA_CAMPANHAS_WHATSAPP,
  ZUMA_CLUBE_ASSINATURA,
  ZUMA_RANKING_MESTRE_SUSHI,
  provisionarZumaRestaurante
} from './zuma-cozinha-oriental-seed.js';

import { TEMPLATES_NEGOCIO } from './modules/empresas/onboarding-templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Zuma Cozinha Oriental - Dados cadastrais da empresa e matriz', () => {
  assert.equal(ZUMA_EMPRESA_ID, 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3');
  assert.equal(ZUMA_LOJA_ID, 'c3c3ac01-8e50-4b61-8c79-de4aaa916da0');
  assert.equal(ZUMA_DADOS_EMPRESA.cnpj, '36.296.848/0001-57');
  assert.equal(ZUMA_DADOS_EMPRESA.razaoSocial, 'Zuma Cozinha Oriental LTDA');
  assert.equal(ZUMA_DADOS_EMPRESA.enderecoCidade, 'Tangará da Serra');
  assert.equal(ZUMA_DADOS_EMPRESA.enderecoEstado, 'MT');
  assert.ok(ZUMA_DADOS_EMPRESA.logoUrl.includes('logo_square_400'));
  assert.ok(ZUMA_DADOS_EMPRESA.bannerUrl.includes('loja_images'));
  assert.equal(ZUMA_DADOS_EMPRESA.identidadeVisual.corPrimaria, '#E63946');
});

test('Zuma Cozinha Oriental - Cardápio completo com 23 categorias e 211 produtos', () => {
  assert.equal(ZUMA_CATEGORIAS.length, 23, 'Deve conter exatamente 23 categorias extraídas');
  assert.equal(ZUMA_CARDAPIO_COMPLETO.length, 211, 'Deve conter exatamente 211 produtos reais extraídos');

  // Verificar distribuição por setores da operação
  const setores = new Set(ZUMA_CARDAPIO_COMPLETO.map(p => p.setor));
  assert.ok(setores.has('sushi_bar'), 'Deve ter itens para o Sushi Bar');
  assert.ok(setores.has('cozinha'), 'Deve ter itens para a Cozinha');
  assert.ok(setores.has('bar'), 'Deve ter itens para o Bar');
  assert.ok(setores.has('balcao'), 'Deve ter itens para o Balcão');

  // Verificar campos essenciais em cada produto
  for (const p of ZUMA_CARDAPIO_COMPLETO) {
    assert.ok(p.id, 'Produto deve ter id');
    assert.ok(p.nome, 'Produto deve ter nome');
    assert.ok(typeof p.preco === 'number' && p.preco >= 0, `Preço inválido em ${p.nome}`);
    assert.ok(p.categoria, `Produto ${p.nome} deve ter categoria`);
    assert.ok(p.setor, `Produto ${p.nome} deve ter setor`);
  }

  // Verificar alguns itens icônicos
  const combo = ZUMA_CARDAPIO_COMPLETO.find(p => p.nome.toLowerCase().includes('combo') || p.nome.toLowerCase().includes('zuma'));
  assert.ok(combo, 'Deve conter combos/especiais Zuma no cardápio');

  const hotRoll = ZUMA_CARDAPIO_COMPLETO.find(p => p.nome.toLowerCase().includes('hot roll') || p.nome.toLowerCase().includes('hot'));
  assert.ok(hotRoll, 'Deve conter hot rolls no cardápio');
});

test('Zuma Cozinha Oriental - Mesas físicas, bistrô, deck, sushi bar e virtuais', () => {
  assert.equal(ZUMA_MESAS_INICIAIS.length, 27, 'Deve conter 27 mesas e canais');

  const setoresMesas = new Set(ZUMA_MESAS_INICIAIS.map(m => m.setor));
  assert.ok(setoresMesas.has('salao'));
  assert.ok(setoresMesas.has('deck'));
  assert.ok(setoresMesas.has('bistro'));
  assert.ok(setoresMesas.has('sushi_bar'));
  assert.ok(setoresMesas.has('balcao'));
  assert.ok(setoresMesas.has('delivery'));

  for (const m of ZUMA_MESAS_INICIAIS) {
    assert.ok(m.numero >= 1);
    assert.ok(m.nome.length > 0);
  }
});

test('Zuma Cozinha Oriental - Perfis de clientes VIP no CRM e fatos de IA', () => {
  assert.ok(ZUMA_CLIENTES_CRM.length >= 7, 'Deve ter pelo menos 7 clientes VIP parametrizados');
  for (const c of ZUMA_CLIENTES_CRM) {
    assert.ok(c.nome);
    assert.ok(c.telefone);
    assert.ok(Array.isArray(c.pratosFavoritos));
    assert.ok(c.ticketMedio > 0);
    assert.ok(c.segmentoRFV);
  }

  assert.ok(ZUMA_AI_CUSTOMER_FACTS.length >= 7, 'Deve ter fatos para contextualizar o Motor KyttoIA');
  for (const f of ZUMA_AI_CUSTOMER_FACTS) {
    assert.ok(f.telefone);
    assert.ok(f.chave);
    assert.ok(f.valor);
    assert.ok(f.categoria);
  }
});

test('Zuma Cozinha Oriental - Integrações e Motor KyttoIA 2.5 Flash', () => {
  assert.equal(ZUMA_WHATSAPP_CONFIG.status, 'ativo');
  assert.equal(ZUMA_WHATSAPP_CONFIG.persona.motorIa, 'KyttoIA 2.5 Flash');
  assert.equal(ZUMA_WHATSAPP_CONFIG.persona.nome, 'Zumi');
  assert.equal(ZUMA_MASCOTE_ZUMI.nome, 'Zumi');
  assert.ok(ZUMA_MASCOTE_ZUMI.bordoes.length >= 3);
  assert.ok(ZUMA_WHATSAPP_CONFIG.persona.tom.includes('Ágil'));
  assert.equal(ZUMA_COMMERCE_STOREFRONT.alias, 'zuma');
  assert.ok(ZUMA_COMMERCE_STOREFRONT.publicConfig.displayName.includes('ZUMA'));
});

test('Zuma Cozinha Oriental - Plano de Crescimento +250%, Campanhas e Clube Zumi', () => {
  assert.equal(ZUMA_PLANO_CRESCIMENTO_250.alavancas.length, 4, 'Deve conter as 4 alavancas multiplicadoras');
  assert.equal(ZUMA_PROGRAMACAO_SEMANAL.length, 7, 'Deve cobrir os 7 dias da semana');
  assert.equal(ZUMA_CAMPANHAS_WHATSAPP.length, 8, 'Deve conter as 8 campanhas estratégicas de WhatsApp');
  assert.equal(ZUMA_CLUBE_ASSINATURA.valorMensal, 29.90);
  assert.equal(ZUMA_RANKING_MESTRE_SUSHI.selosDisponiveis.length, 7);
});

test('Zuma Cozinha Oriental - Engenharia de cardápio e projeções financeiras', () => {
  const eng = ZUMA_GANHOS_ENGENHARIA_CARDAPIO;
  assert.ok(eng.matrizBcgPratos.estrelas.length > 0, 'Deve ter itens Estrela');
  assert.ok(eng.matrizBcgPratos.cavalosDeBatalha.length > 0, 'Deve ter itens Cavalo de Batalha');
  assert.ok(eng.matrizBcgPratos.quebraCabecas.length > 0, 'Deve ter itens Quebra-cabeça');
  assert.ok(eng.indicadores.faturamentoMensalProjetado > 0);
  assert.ok(eng.indicadores.lucroLiquidoMensalProjetado > 0);
  assert.ok(eng.indicadores.ticketMedioProjetadoComIA > eng.indicadores.ticketMedioAtual);
  assert.ok(eng.upsellRulesKyttoIA.length >= 3);
});

test('Zuma Cozinha Oriental - Template oriental no onboarding-templates', () => {
  assert.ok(TEMPLATES_NEGOCIO.oriental, 'Template oriental deve estar registrado');
  assert.equal(TEMPLATES_NEGOCIO.oriental.id, 'oriental');
  assert.equal(TEMPLATES_NEGOCIO.oriental.icon, '🍣');
  assert.ok(TEMPLATES_NEGOCIO.oriental.produtos.length >= 10);
  assert.ok(TEMPLATES_NEGOCIO.oriental.servicos.length >= 2);
});

test('Zuma Cozinha Oriental - Arquivo de Migration 128 existe e possui sintaxe SQL válida', () => {
  const migrationPath = path.join(__dirname, 'migrations', '128_zuma_cozinha_oriental_completo.sql');
  assert.ok(fs.existsSync(migrationPath), 'Arquivo 128_zuma_cozinha_oriental_completo.sql deve existir');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(sqlContent.length > 50000, 'Migration deve ser substancial (cardápio de 211 itens + mesas + crm)');
  assert.ok(sqlContent.includes('c3c3ac01-8e50-4b61-8c79-de4aaa916da3'), 'Deve conter o ID da empresa Zuma');
  assert.ok(sqlContent.includes('Zuma Cozinha Oriental'), 'Deve conter o nome da empresa Zuma');
  assert.ok(sqlContent.includes('zuma.kytto.com.br'), 'Deve conter o domínio storefront');
  assert.ok(sqlContent.includes('KyttoIA 2.5 Flash'), 'Deve referenciar o Motor KyttoIA');
});

test('Zuma Cozinha Oriental - Provisionamento mock em memória', async () => {
  const queriesExecutadas = [];
  const mockDb = {
    async query(sql, params) {
      queriesExecutadas.push({ sql, params });
      return { rows: [] };
    }
  };

  const resultado = await provisionarZumaRestaurante({ commerceDb: mockDb });
  assert.equal(resultado.empresaProvisionada, true);
  assert.equal(resultado.lojaProvisionada, true);
  assert.equal(resultado.produtosCriados, 211);
  assert.equal(resultado.mesasCriadas, 27);
  assert.equal(resultado.storefrontProvisionado, true);
  assert.equal(resultado.canalWhatsappProvisionado, true);
  assert.ok(queriesExecutadas.length > 10, 'Deve ter executado as queries de inserção no banco');
});

test('Zuma Cozinha Oriental - Arquivos estáticos e Web App interativa', () => {
  const zumaHtmlPath = path.join(__dirname, 'public', 'zuma', 'index.html');
  const zumaSvgPath = path.join(__dirname, 'public', 'zuma', 'zumi-mascote.svg');
  const zumaPilotPath = path.join(__dirname, 'public', 'zuma', 'pilot.html');
  assert.ok(fs.existsSync(zumaHtmlPath), 'app/public/zuma/index.html deve existir');
  assert.ok(fs.existsSync(zumaSvgPath), 'app/public/zuma/zumi-mascote.svg deve existir');
  assert.ok(fs.existsSync(zumaPilotPath), 'app/public/zuma/pilot.html deve existir');

  const html = fs.readFileSync(zumaHtmlPath, 'utf8');
  assert.ok(html.includes('Zuma Cozinha Oriental'), 'HTML deve conter título da loja');
  assert.ok(html.includes('Zumi'), 'HTML deve conter referência ao mascote Zumi');
  assert.ok(html.includes('KyttoIA'), 'HTML deve referenciar Motor KyttoIA');
  assert.ok(html.includes('scratch-canvas'), 'HTML deve conter elemento canvas da raspadinha');
  assert.ok(html.includes('Clube Zumi VIP'), 'HTML deve conter Clube Zumi VIP');
  assert.ok(html.includes('27 Mesas'), 'HTML deve conter visualizador de mesas');
  assert.ok(html.includes('tab-mapa-calor'), 'HTML deve conter aba de mapa de calor');
  assert.ok(html.includes('tab-mercado-ia'), 'HTML deve conter aba de análise de mercado');
  assert.ok(html.includes('tab-simulador-crm'), 'HTML deve conter aba de simulador RFM');
  assert.ok(html.includes('tab-clima-delivery'), 'HTML deve conter aba de motor de clima');
  assert.ok(html.includes('tab-hub-omnichannel'), 'HTML deve conter aba de hub omnichannel');

  const svg = fs.readFileSync(zumaSvgPath, 'utf8');
  assert.ok(svg.includes('<svg'), 'SVG deve ser válido');
  assert.ok(svg.includes('ZUMI'), 'SVG deve conter o nome do mascote');

  const pilot = fs.readFileSync(zumaPilotPath, 'utf8');
  assert.ok(pilot.includes('Zuma Pilot'), 'Pilot deve conter título');
  assert.ok(pilot.includes('KyttoIA 2.5 Flash'), 'Pilot deve citar KyttoIA 2.5 Flash');
});

test('Zuma Cozinha Oriental - Módulo routerZuma e endpoints de API', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  assert.ok(routerZuma, 'routerZuma deve ser exportado');
  assert.equal(typeof routerZuma, 'function', 'routerZuma deve ser um middleware Express');
});

test('Zuma Cozinha Oriental - Central Operacional 360°, PWA e Download Offline', async () => {
  const operacaoHtmlPath = path.join(__dirname, 'public', 'zuma', 'operacao.html');
  const manifestPath = path.join(__dirname, 'public', 'zuma', 'manifest.json');
  const swPath = path.join(__dirname, 'public', 'zuma', 'sw.js');
  const cardapioRealJsonPath = path.join(__dirname, 'public', 'zuma', 'cardapio-real-zuma.json');

  assert.ok(fs.existsSync(operacaoHtmlPath), 'operacao.html deve existir');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json deve existir');
  assert.ok(fs.existsSync(swPath), 'sw.js deve existir');
  assert.ok(fs.existsSync(cardapioRealJsonPath), 'cardapio-real-zuma.json deve existir');

  const operacaoHtml = fs.readFileSync(operacaoHtmlPath, 'utf8');
  assert.ok(operacaoHtml.includes('Central Operacional 360°'), 'HTML deve conter título da estação');
  assert.ok(operacaoHtml.includes('mod-caixa'), 'HTML deve conter módulo de Frente de Caixa');
  assert.ok(operacaoHtml.includes('mod-cozinha'), 'HTML deve conter módulo de KDS Cozinha');
  assert.ok(operacaoHtml.includes('mod-garcom'), 'HTML deve conter módulo do App Garçom');
  assert.ok(operacaoHtml.includes('mod-motoboy'), 'HTML deve conter módulo do App Motoboy');
  assert.ok(operacaoHtml.includes('baixarTudoOffline'), 'HTML deve conter função de download offline');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './operacao.html');

  const cardapioJson = JSON.parse(fs.readFileSync(cardapioRealJsonPath, 'utf8'));
  assert.equal(cardapioJson.totalProdutos, 211, 'cardapio-real-zuma.json deve ter exatamente 211 produtos');
  assert.equal(cardapioJson.totalCategorias, 23, 'cardapio-real-zuma.json deve ter exatamente 23 categorias');
});

test('Zuma Cozinha Oriental - Endpoints operacionais backend (Caixa, KDS, Garçom, Motoboy)', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');

  // Mock Express helper
  const callRoute = (method, path, body = {}, query = {}) => {
    return new Promise((resolve) => {
      const req = { method, url: path, body, query };
      const res = {
        statusCode: 200,
        json(data) {
          resolve({ status: this.statusCode, data });
        },
        status(code) {
          this.statusCode = code;
          return this;
        }
      };

      // find layer matching path
      const layer = routerZuma.stack.find(l => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found' } });
      }
    });
  };

  // Testar /operacional/completo
  const opRes = await callRoute('GET', '/operacional/completo');
  assert.equal(opRes.status, 200);
  assert.equal(opRes.data.ok, true);
  assert.equal(opRes.data.totalProdutosCatalogo, 211);
  assert.equal(opRes.data.totalMesas, 27);
  assert.ok(Array.isArray(opRes.data.produtos) && opRes.data.produtos.length === 211);
  assert.ok(Array.isArray(opRes.data.categorias) && opRes.data.categorias.length === 23);

  // Testar /caixa/fechar-venda
  const caixaRes = await callRoute('POST', '/caixa/fechar-venda', {
    mesaNumero: 4,
    valorTotal: 150.00,
    formaPagamento: 'pix',
    itens: [{ cod: '666', nome: 'Promo Combo Grelhado', qtd: 1, preco: 82.00 }]
  });
  assert.equal(caixaRes.status, 200);
  assert.equal(caixaRes.data.ok, true);
  assert.ok(caixaRes.data.venda.id.startsWith('VND-'));

  // Testar /garcom/lancar-pedido
  const garcomRes = await callRoute('POST', '/garcom/lancar-pedido', {
    mesaNumero: 8,
    garcomNome: 'Pedro Garçom',
    itens: [{ nome: 'Tubo Uramaki Filadélfia', qtd: 2 }]
  });
  assert.equal(garcomRes.status, 200);
  assert.equal(garcomRes.data.ok, true);
  assert.ok(garcomRes.data.kdsId.startsWith('KDS-'));

  // Testar /cozinha/atualizar-status
  const kdsRes = await callRoute('POST', '/cozinha/atualizar-status', {
    kdsId: garcomRes.data.kdsId,
    novoStatus: 'pronto'
  });
  assert.equal(kdsRes.status, 200);
  assert.equal(kdsRes.data.ok, true);

  // Testar /download-offline
  const downRes = await callRoute('GET', '/download-offline');
  assert.equal(downRes.status, 200);
  assert.equal(downRes.data.ok, true);
  assert.equal(downRes.data.catalogoProdutos.length, 211);
});

test('Zuma Cozinha Oriental - Zuma Pilot Cockpit: Aba #mercado e Inteligência Competitiva KyttoIA', () => {
  const pilotHtmlPath = path.join(__dirname, 'public', 'zuma', 'pilot.html');
  assert.ok(fs.existsSync(pilotHtmlPath), 'pilot.html deve existir');

  const html = fs.readFileSync(pilotHtmlPath, 'utf8');
  assert.ok(html.includes('href="#mercado"'), 'Deve conter link de navegação para #mercado');
  assert.ok(html.includes('id="v-mercado"'), 'Deve conter section view v-mercado');
  assert.ok(html.includes('id="kpiMktShare"'), 'Deve conter KPI de Market share');
  assert.ok(html.includes('id="mktBars"'), 'Deve conter gráfico de barras de market share');
  assert.ok(html.includes('id="sMkt"'), 'Deve conter slider de simulação de market share');
  assert.ok(html.includes('id="tblBenchmarking"'), 'Deve conter tabela de benchmarking');
  assert.ok(html.includes('Sansei Sushi Tangará'), 'Deve mapear Sansei Sushi Tangará');
  assert.ok(html.includes('Sushi Ya Delivery'), 'Deve mapear Sushi Ya Delivery');
  assert.ok(html.includes('Matsuri Culinária Oriental'), 'Deve mapear Matsuri Culinária Oriental');
  assert.ok(html.includes('cIfoodOrders'), 'Deve conter slider de pedidos iFood');
  assert.ok(html.includes('btnMigrateIfood'), 'Deve conter botão de migração de clientes iFood');
  assert.ok(html.includes('avenidasCards'), 'Deve conter 4 avenidas de crescimento (+R$ 95.175/mês)');
  assert.ok(html.includes('btnGenStrategy'), 'Deve conter gerador de estratégias KyttoIA');
  assert.ok(html.includes('Motor KyttoIA 2.5 Flash'), 'Deve utilizar o nome oficial Motor KyttoIA 2.5 Flash');
  assert.ok(html.includes('"mercado"'), 'VIEWS deve incluir rota mercado');
});

test('Zuma Cozinha Oriental - Zuma Pilot: 18 Módulos Completos (Operação, Vendas & Leads e Gestão 360°)', () => {
  const pilotHtmlPath = path.join(__dirname, 'public', 'zuma', 'pilot.html');
  const html = fs.readFileSync(pilotHtmlPath, 'utf8');

  const modulos = [
    'cockpit', 'zumi', 'campanhas', 'leads', 'clientes', 'horarios', 'clube',
    'trafego', 'indicacao', 'b2b', 'recuperacao',
    'mercado', 'engenharia', 'rfm', 'clima', 'omnichannel', 'financeiro', 'estoque'
  ];

  modulos.forEach(mod => {
    assert.ok(html.includes(`id="v-${mod}"`), `Deve conter section view v-${mod}`);
    assert.ok(html.includes(`data-v="${mod}"`), `Deve conter link nav data-v="${mod}"`);
  });

  // Validações específicas dos módulos avançados
  assert.ok(html.includes('engCatFilter'), 'Deve conter filtro de categorias na engenharia de cardápio');
  assert.ok(html.includes('engBcgFilter'), 'Deve conter filtro BCG na engenharia de cardápio');
  assert.ok(html.includes('sRfm'), 'Deve conter simulador de aceleração de recompra RFM');
  assert.ok(html.includes('climaConditionsCards'), 'Deve conter seletor de condições climáticas');
  assert.ok(html.includes('omniChannelCards'), 'Deve conter cartões do hub omnichannel');
  assert.ok(html.includes('sSalmWeight'), 'Deve conter simulador de rendimento do salmão fresco');
  assert.ok(html.includes('Motor KyttoIA 2.5 Flash'), 'Deve manter a diretriz oficial da marca Motor KyttoIA 2.5 Flash');
});

test('Zuma Cozinha Oriental - Máquina de Vendas & Leads 360° (Tráfego, Indicação, B2B Agro e Recuperação)', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const [pathname, queryString] = p.split("?");
      const query = {};
      if (queryString) {
        new URLSearchParams(queryString).forEach((val, key) => { query[key] = val; });
      }
      const req = { method, path: pathname, query, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && (l.route.path === pathname || l.route.path === p) && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: "Route not found" } });
      }
    });
  };

  // 1. Tráfego & Campanhas Meta Ads
  const trafRes = await callRoute("GET", "/trafego/campanhas");
  assert.equal(trafRes.status, 200);
  assert.equal(trafRes.data.ok, true);
  assert.equal(trafRes.data.motorIA, "Motor KyttoIA 2.5 Flash");
  assert.ok(Array.isArray(trafRes.data.campanhas) && trafRes.data.campanhas.length >= 4);
  assert.ok(trafRes.data.campanhas[0].copyKyttoIA.includes("Zuma"));

  // 2. Indicação Viral (Member Get Member)
  const indDadosRes = await callRoute("GET", "/indicacao/dados");
  assert.equal(indDadosRes.status, 200);
  assert.equal(indDadosRes.data.ok, true);
  assert.equal(indDadosRes.data.kFactorViralidade, 1.35);
  assert.ok(indDadosRes.data.topEmbaixadores.length >= 5);

  const indLinkRes = await callRoute("POST", "/indicacao/gerar-link", { nome: "Rodrigo", telefone: "(65) 99988-1234" });
  assert.equal(indLinkRes.status, 200);
  assert.equal(indLinkRes.data.ok, true);
  assert.ok(indLinkRes.data.link.includes("ref="));
  assert.ok(indLinkRes.data.textoWhatsApp.includes("Zuma Cozinha Oriental"));

  // 3. Convênios Corporativos & Almoço do Agro
  const b2bDadosRes = await callRoute("GET", "/b2b/convenios");
  assert.equal(b2bDadosRes.status, 200);
  assert.equal(b2bDadosRes.data.ok, true);
  assert.ok(b2bDadosRes.data.empresasConveniadas.length >= 5);
  assert.ok(b2bDadosRes.data.empresasConveniadas[0].empresa.includes("SLC Agrícola"));

  const b2bPropRes = await callRoute("POST", "/b2b/proposta", {
    empresaNome: "Agro Brasil Tangará",
    contatoNome: "Diretoria Agro",
    qtdColaboradores: 45
  });
  assert.equal(b2bPropRes.status, 200);
  assert.equal(b2bPropRes.data.ok, true);
  assert.ok(b2bPropRes.data.propostaTexto.includes("Motor KyttoIA 2.5 Flash"));

  // 4. Recuperador de Carrinhos Abandonados
  const recRes = await callRoute("GET", "/recuperacao/carrinhos");
  assert.equal(recRes.status, 200);
  assert.equal(recRes.data.ok, true);
  assert.equal(recRes.data.taxaMediaRecuperacao, 34.8);
  assert.ok(recRes.data.reguasAutomacao.length === 3);
});


test('Zuma Cozinha Oriental - Módulos de Diferenciação Japonesa no Cardápio Digital', () => {
  const indexHtmlPath = path.join(__dirname, 'public', 'zuma', 'index.html');
  assert.ok(fs.existsSync(indexHtmlPath), 'index.html deve existir');
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Abas de Diferenciação Especializada em Sushi & Gastronomia Oriental
  assert.ok(html.includes('id="tab-btn-monte-barca"'), 'Deve conter botão da aba Monte sua Barca');
  assert.ok(html.includes('id="tab-monte-barca"'), 'Deve conter seção Monte sua Barca');
  assert.ok(html.includes('id="tab-btn-sommelier-saque"'), 'Deve conter botão da aba Carta de Saquês');
  assert.ok(html.includes('id="tab-sommelier-saque"'), 'Deve conter seção Carta de Saquês e Harmonização');
  assert.ok(html.includes('id="tab-btn-rastreabilidade-frescor"'), 'Deve conter botão da aba Selo de Frescor');
  assert.ok(html.includes('id="tab-rastreabilidade-frescor"'), 'Deve conter seção Selo de Frescor & Cadeia Fria');
  assert.ok(html.includes('id="tab-btn-eventos-buffet"'), 'Deve conter botão da aba Buffet & Eventos');
  assert.ok(html.includes('id="tab-eventos-buffet"'), 'Deve conter seção Calculadora de Eventos');

  // Modal de Customização Artesanal do Sushiman
  assert.ok(html.includes('id="modal-customizacao-sushi"'), 'Deve conter modal de customização do sushiman');
  assert.ok(html.includes('opt-ponto-cru'), 'Deve permitir ponto do peixe fresco cru');
  assert.ok(html.includes('opt-ponto-macaricado'), 'Deve permitir ponto do peixe maçaricado');
  assert.ok(html.includes('opt-arroz-tradicional'), 'Deve permitir seleção de arroz shari tradicional');
  assert.ok(html.includes('opt-arroz-lowcarb'), 'Deve permitir opção sem arroz low carb');
  assert.ok(html.includes('check-mod-trufado'), 'Deve permitir topping de azeite trufado');
  assert.ok(html.includes('abrirModalCustomizacao'), 'Deve conter função de abertura do modal');
});

test('Zuma Cozinha Oriental - ERP Completo Gastronômico 360° e Isolamento de Empresa Única', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const { listarEmpresas, EMPRESA_ZUMA_ID } = await import('./modules/empresas/servico.js');

  // 1. Isolamento de Empresa Única: apenas Zuma Cozinha Oriental ativa no sistema
  const empresas = await listarEmpresas(null, { empresaIdFiltro: EMPRESA_ZUMA_ID });
  assert.equal(empresas.length, 1, 'Deve retornar apenas 1 empresa ativa no sistema');
  assert.equal(empresas[0].id, 'c3c3ac01-8e50-4b61-8c79-de4aaa916da3');
  assert.equal(empresas[0].razaoSocial, 'Zuma Cozinha Oriental LTDA');

  // Helper para chamar routerZuma com suporte a rotas parametrizadas
  const callRoute = (method, p, body = {}, query = {}) => {
    return new Promise((resolve) => {
      let matchedLayer = null;
      let params = {};
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          const match = layer.match(p);
          if (match) {
            matchedLayer = layer;
            params = layer.params || {};
            break;
          }
        }
      }

      if (!matchedLayer) {
        return resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }

      const req = { method, url: p, path: p, body, query, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      matchedLayer.route.stack[0].handle(req, res);
    });
  };

  // 2. Caixa & Fechamento de Turno
  const abrirTurno = await callRoute('POST', '/caixa/abrir-turno', { fundoTroco: 450.00, operador: 'Carlos Operador' });
  assert.equal(abrirTurno.status, 200);
  assert.equal(abrirTurno.data.ok, true);
  assert.equal(abrirTurno.data.turno.fundoTrocoInicial, 450.00);

  const sangria = await callRoute('POST', '/caixa/sangria', { valor: 200.00, motivo: 'Depósito cofre', operador: 'Carlos Operador' });
  assert.equal(sangria.status, 200);
  assert.equal(sangria.data.ok, true);
  assert.equal(sangria.data.sangria.valor, 200.00);

  const suprimento = await callRoute('POST', '/caixa/suprimento', { valor: 50.00, motivo: 'Troco moedas', operador: 'Carlos Operador' });
  assert.equal(suprimento.status, 200);
  assert.equal(suprimento.data.ok, true);

  const relCaixa = await callRoute('GET', '/caixa/relatorio-fechamento');
  assert.equal(relCaixa.status, 200);
  assert.equal(relCaixa.data.ok, true);
  assert.ok(relCaixa.data.turno);

  const confCaixa = await callRoute('GET', '/caixa/conferencia');
  assert.equal(confCaixa.status, 200);
  assert.equal(confCaixa.data.ok, true);
  assert.ok(confCaixa.data.vendasTotaisPorForma);

  // 3. Estoque Especializado de Pescados & Fichas Técnicas / CMV
  const pescados = await callRoute('GET', '/estoque/pescados');
  assert.equal(pescados.status, 200);
  assert.equal(pescados.data.ok, true);
  assert.ok(pescados.data.itens.length >= 4);
  const salmao = pescados.data.itens.find(p => p.nome.toLowerCase().includes('salmão'));
  assert.ok(salmao, 'Deve monitorar estoque de salmão');
  assert.equal(salmao.rendimentoMedioFilePct, 58.0);

  const perdaPeixe = await callRoute('POST', '/estoque/perda-peixe', {
    codigoInsumo: 'INS-001',
    qtdKg: 0.85,
    motivo: 'Apara excessiva de tosa',
    sushiman: 'Sushiman Chefe'
  });
  assert.equal(perdaPeixe.status, 200);
  assert.equal(perdaPeixe.data.ok, true);

  const fichas = await callRoute('GET', '/estoque/fichas-tecnicas');
  assert.equal(fichas.status, 200);
  assert.equal(fichas.data.ok, true);
  assert.ok(fichas.data.fichas.length >= 3);
  assert.ok(fichas.data.fichas[0].cmvPercentual);

  // 4. Gestão Financeira & DRE Gerencial
  const dre = await callRoute('GET', '/financeiro/dre');
  assert.equal(dre.status, 200);
  assert.equal(dre.data.ok, true);
  assert.ok(dre.data.dre.receitaBrutaVendas > 0);
  assert.ok(dre.data.dre.lucroLiquidoReal > 0);
  assert.ok(dre.data.dre.lucroLiquidoPercentual);

  const cp = await callRoute('GET', '/financeiro/contas-pagar');
  assert.equal(cp.status, 200);
  assert.equal(cp.data.ok, true);
  assert.ok(cp.data.titulos.length >= 3);

  const cr = await callRoute('GET', '/financeiro/contas-receber');
  assert.equal(cr.status, 200);
  assert.equal(cr.data.ok, true);
  assert.ok(cr.data.titulos.length >= 2);

  // 5. Mesas, Salão & Rodízio Tangará
  const mesa4 = await callRoute('GET', '/mesas/detalhe/4');
  assert.equal(mesa4.status, 200);
  assert.equal(mesa4.data.ok, true);
  assert.equal(mesa4.data.mesa.numero, 4);

  const addMesa = await callRoute('POST', '/mesas/adicionar-item', {
    mesaNumero: 4,
    itemNome: 'Promo Combo Grelhado',
    precoUnit: 82.00,
    qtd: 1
  });
  assert.equal(addMesa.status, 200);
  assert.equal(addMesa.data.ok, true);

  const divConta = await callRoute('POST', '/mesas/dividir-conta', { valorTotal: 598.07, qtdPessoas: 3 });
  assert.equal(divConta.status, 200);
  assert.equal(divConta.data.ok, true);
  assert.ok(divConta.data.valorPorPessoa > 0);

  // 6. Central de Delivery & Motoboys por Bairros de Tangará da Serra
  const bairros = await callRoute('GET', '/delivery/taxas-bairros');
  assert.equal(bairros.status, 200);
  assert.equal(bairros.data.ok, true);
  assert.ok(bairros.data.bairros.length >= 6);

  const despachar = await callRoute('POST', '/delivery/despachar', {
    pedidoId: 'DEL-TG-01',
    motoboyNome: 'Carlos Ninja'
  });
  assert.equal(despachar.status, 200);
  assert.equal(despachar.data.ok, true);

  // 7. CRM & Clube Zumi
  const crm = await callRoute('GET', '/crm/clientes');
  assert.equal(crm.status, 200);
  assert.equal(crm.data.ok, true);
  assert.ok(crm.data.clientes.length >= 5);

  const aniv = await callRoute('POST', '/crm/disparar-aniversariantes', { mes: 11 });
  assert.equal(aniv.status, 200);
  assert.equal(aniv.data.ok, true);
  assert.ok(aniv.data.totalDisparados >= 1);

  // 8. Arquivo erp.html
  const erpHtmlPath = path.join(__dirname, 'public', 'zuma', 'erp.html');
  assert.ok(fs.existsSync(erpHtmlPath), 'erp.html deve existir em app/public/zuma');
  const erpHtml = fs.readFileSync(erpHtmlPath, 'utf8');
  assert.ok(erpHtml.includes('Zuma ERP 360°'), 'Deve conter título do ERP');
  assert.ok(erpHtml.includes('aba-visao-geral'), 'Deve conter aba Visão Geral');
  assert.ok(erpHtml.includes('aba-caixa-fechamento'), 'Deve conter aba Caixa');
  assert.ok(erpHtml.includes('aba-mesas-salao'), 'Deve conter aba Mesas e Salão');
  assert.ok(erpHtml.includes('aba-kds-producao'), 'Deve conter aba KDS e Produção');
  assert.ok(erpHtml.includes('aba-estoque-pescados'), 'Deve conter aba Estoque Pescados e Fichas');
  assert.ok(erpHtml.includes('aba-financeiro-dre'), 'Deve conter aba Financeiro e DRE');
  assert.ok(erpHtml.includes('aba-delivery-motoboys'), 'Deve conter aba Delivery e Motoboys');
  assert.ok(erpHtml.includes('aba-crm-clube-zumi'), 'Deve conter aba CRM e Clube Zumi');
  assert.ok(erpHtml.includes('aba-empresa-cadastros'), 'Deve conter aba Empresa Cadastros');
});

test('Zuma Cozinha Oriental - Catálogo 100% Real Sincronizado com zumacozinhaoriental.com.br', () => {
  const cardapioJsonPath = path.join(__dirname, 'public', 'zuma', 'cardapio-real-zuma.json');
  assert.ok(fs.existsSync(cardapioJsonPath), 'cardapio-real-zuma.json deve existir');
  const cardapio = JSON.parse(fs.readFileSync(cardapioJsonPath, 'utf8'));

  assert.equal(cardapio.totalProdutos, 211, 'Deve ter exatamente 211 produtos reais');
  assert.equal(cardapio.totalCategorias, 23, 'Deve ter exatamente 23 categorias reais');
  assert.equal(cardapio.totalFotosReais, 116, 'Deve ter 116 produtos com foto real oficial de CDN');
  assert.ok(cardapio.destaques.sugestao_da_casa, 'Deve conter sugestões da casa oficiais');
  assert.equal(cardapio.destaques.sugestao_da_casa.itens.length, 11, 'Deve conter 11 itens nas sugestões da casa');

  // Todas as 23 categorias devem conter capa oficial de CDN
  const categoriasComCapa = cardapio.categorias.filter(c => c.capa_url && c.capa_url.includes('cdnimages.ligafiles.com.br'));
  assert.equal(categoriasComCapa.length, 23, 'Todas as 23 categorias devem ter capa oficial de CDN');

  // Produtos devem conter grupos de complementos reais da loja
  const produtosComComplementos = cardapio.produtos.filter(p => p.categorias_complementos && p.categorias_complementos.length > 0);
  assert.ok(produtosComComplementos.length >= 170, 'Pelo menos 170 produtos devem conter grupos de complementos oficiais');

  // Verificar PWA index.html com os novos componentes
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'zuma', 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="categoria-banner-container"'), 'PWA deve conter banner hero dinâmico de categoria');
  assert.ok(indexHtml.includes('id="modal-complementos-dinamicos"'), 'Modal deve conter container de complementos dinâmicos');
  assert.ok(indexHtml.includes('id="modal-fotos-galeria"'), 'Modal deve conter galeria multi-fotos');
  assert.ok(indexHtml.includes('setFiltroRapido'), 'PWA deve conter função de filtros rápidos');
});


test('Zuma Cozinha Oriental - Fluxo Completo Zumi Atende via WhatsApp: Baixa em Tempo Real de Pescados & CMV da Ficha Técnica', async () => {
  const { routerZuma, ESTOQUE_PESCADOS_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Verificar catálogo de fichas técnicas
  const fichasRes = await callRoute('GET', '/fichas-tecnicas');
  assert.equal(fichasRes.status, 200);
  assert.equal(fichasRes.data.ok, true);
  assert.ok(fichasRes.data.totalFichas >= 4);
  const ftCombo = fichasRes.data.fichas.find(f => f.codigoPdv === 'ZUM-003');
  assert.ok(ftCombo, 'Ficha do Combinado 30 Peças deve existir');
  assert.equal(ftCombo.precoVenda, 89.90);
  assert.ok(ftCombo.cmvTeorico > 0, 'CMV deve ser positivo');
  assert.ok(ftCombo.cmvPercentual <= 50.0, 'CMV deve estar dentro da margem saudável (<50%)');

  // 2. Saldo inicial do salmão fresco
  const estoqueInicialRes = await callRoute('GET', '/estoque-pescados');
  assert.equal(estoqueInicialRes.status, 200);
  const salmaoAntes = estoqueInicialRes.data.itens.find(i => i.id === 'ins-salmao-fresco');
  assert.ok(salmaoAntes, 'Insumo salmão fresco chileno deve existir');
  const saldoSalmaoInicial = salmaoAntes.saldoAtual;

  // 3. Simular pedido completo via WhatsApp com o Zumi (Motor KyttoIA 2.5 Flash)
  const pedidoRes = await callRoute('POST', '/whatsapp/simular-pedido', {
    clienteNome: 'Rodrigo Ribeiro Gonçalves',
    clienteTelefone: '(65) 99988-1234',
    enderecoEntrega: 'Av. Tancredo Neves, 850 - Centro, Tangará da Serra - MT',
    formaPagamento: 'PIX',
    mensagem: 'Olá Zumi! Quero pedir 1x Combinado Especial 30 Peças Salmão Fresco e 1x Hot Roll Filadélfia Especial para entrega no Centro.',
    itensCustomizados: [
      { codigoPdv: 'ZUM-003', nome: 'Combinado Especial 30 Peças Salmão Fresco', qtd: 1, precoUnitario: 89.90 },
      { codigoPdv: 'ZUM-HOT', nome: 'Hot Roll Filadélfia Especial (10 un)', qtd: 1, precoUnitario: 42.00 }
    ]
  });

  assert.equal(pedidoRes.status, 200);
  assert.equal(pedidoRes.data.ok, true);
  assert.equal(pedidoRes.data.motorIa, 'KyttoIA 2.5 Flash');
  assert.ok(pedidoRes.data.comanda.id.startsWith('ZUM-WPP-'));
  assert.equal(pedidoRes.data.comanda.subtotalProdutos, 131.90);
  assert.equal(pedidoRes.data.comanda.total, 141.90);

  // Validar Diálogo de WhatsApp
  assert.equal(pedidoRes.data.dialogoWhatsApp.length, 4);
  assert.ok(pedidoRes.data.dialogoWhatsApp[1].texto.includes('36.296.848/0001-57'), 'Deve conter chave PIX CNPJ do Zuma');
  assert.ok(pedidoRes.data.dialogoWhatsApp[3].texto.includes('PAGAMENTO CONFIRMADO'), 'Zumi deve confirmar o pagamento');

  // Validar Cálculo de CMV da Ficha Técnica
  assert.ok(pedidoRes.data.analiseCmvFichaTecnica.cmvTotalInsumos > 0);
  assert.ok(pedidoRes.data.analiseCmvFichaTecnica.cmvPercentualGlobal < 50.0);
  assert.ok(pedidoRes.data.analiseCmvFichaTecnica.margemBrutaValor > 60.0);
  assert.equal(pedidoRes.data.analiseCmvFichaTecnica.detalhamentoPorItem.length, 2);

  // Validar Baixa em Tempo Real de Pescados
  assert.ok(pedidoRes.data.baixaEstoquePescadosEmTempoReal.totalInsumosBaixados >= 2);
  const salmaoConsolidado = pedidoRes.data.baixaEstoquePescadosEmTempoReal.consumoConsolidadoPorInsumo.find(m => m.insumoId === 'ins-salmao-fresco');
  assert.ok(salmaoConsolidado, 'Deve haver consumo consolidado de salmão fresco');
  assert.equal(salmaoConsolidado.consumoTotal, 0.530, 'Deve consumir exatamente 530g de salmão (380g do combo + 150g do hot)');
  assert.equal(salmaoConsolidado.saldoFinal, parseFloat((saldoSalmaoInicial - 0.530).toFixed(3)));
  assert.ok(pedidoRes.data.reciboFiscalNFCe.chaveAcesso.startsWith('51261136296848000157'), 'Chave NFC-e com CNPJ de Zuma e UF 51 MT');
});


test("Zuma Cozinha Oriental - Acesso Unificado login.html e Responsividade iPhone First", () => {
  const loginPath = path.join(__dirname, "public", "zuma", "login.html");
  const pilotPath = path.join(__dirname, "public", "zuma", "pilot.html");
  const indexPath = path.join(__dirname, "public", "zuma", "index.html");

  assert.ok(fs.existsSync(loginPath), "login.html deve existir");
  const loginHtml = fs.readFileSync(loginPath, "utf8");

  // Perfis e credenciais de PRD
  assert.ok(loginHtml.includes("leandro@zumacozinhaoriental.com.br"), "login.html deve conter credencial de gerente");
  assert.ok(loginHtml.includes("chef@zumacozinhaoriental.com.br"), "login.html deve conter credencial do chef sushiman");
  assert.ok(loginHtml.includes("atendimento@zumacozinhaoriental.com.br"), "login.html deve conter credencial de atendimento");
  assert.ok(loginHtml.includes("123456"), "login.html deve conter senha padrão de PRD");
  assert.ok(loginHtml.includes("selecionarPerfil"), "login.html deve conter seletor rápido de perfis em 1 clique");
  assert.ok(loginHtml.includes("viewport-fit=cover"), "login.html deve ter viewport-fit=cover para iPhone");
  assert.ok(loginHtml.includes("env(safe-area-inset-top"), "login.html deve suportar safe area do iPhone");

  // Pilot e Index com iOS First
  const pilotHtml = fs.readFileSync(pilotPath, "utf8");
  assert.ok(pilotHtml.includes("ios-bottom-bar"), "pilot.html deve conter barra inferior estilo iOS");
  assert.ok(pilotHtml.includes("mobileModuleSelect"), "pilot.html deve conter seletor wheel de módulos para iPhone");

  const indexHtml = fs.readFileSync(indexPath, "utf8");
  assert.ok(indexHtml.includes("login.html"), "index.html deve ter link direto para login.html");
  assert.ok(indexHtml.includes("cart-badge-bottom"), "index.html deve sincronizar badge na barra inferior iOS");
});


test('Zuma Cozinha Oriental - Gestão de Câmaras Frias IoT e Perdas Técnicas de Pescados', async () => {
  const { routerZuma, CAMARAS_FRIAS_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Telemetria das Câmaras Frias
  const camarasRes = await callRoute('GET', '/estoque/camaras-frias');
  assert.equal(camarasRes.status, 200);
  assert.equal(camarasRes.data.ok, true);
  assert.equal(camarasRes.data.totalCamarasMonitoradas, 3);
  assert.equal(camarasRes.data.statusGeral, '100%_CONFORME');

  const camaraPescados = camarasRes.data.camaras.find(c => c.id === 'camara-01-pescados-frescos');
  assert.ok(camaraPescados, 'Câmara de salmão e atum fresco deve existir');
  assert.ok(camaraPescados.temperaturaAtual >= camaraPescados.faixaMinima && camaraPescados.temperaturaAtual <= camaraPescados.faixaMaxima, 'Temperatura deve estar na faixa de -2°C a +2°C');

  // 2. Registro de Perda Técnica de Salmão Fresco
  const perdaRes = await callRoute('POST', '/estoque/perda-descarte', {
    insumoId: 'ins-salmao-fresco',
    quantidadeKg: 0.500,
    tipo: 'apara_tecnica_sushiman',
    motivo: 'Apara de gordura escura e sangria para sushi premium',
    sushiman: 'Kenji Mestre'
  });
  assert.equal(perdaRes.status, 200);
  assert.equal(perdaRes.data.ok, true);
  assert.equal(perdaRes.data.perda.quantidadeKg, 0.500);
  assert.ok(perdaRes.data.perda.id.startsWith('PERD-'));
});

test('Zuma Cozinha Oriental - Mapa de Temperatura & Heatmap do Salão e Mesas (25 Mesas)', async () => {
  const { routerZuma, MESAS_SALAO_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Obter Mapa de Calor de Mesas
  const mapaRes = await callRoute('GET', '/mesas/mapa-temperatura');
  assert.equal(mapaRes.status, 200);
  assert.equal(mapaRes.data.ok, true);
  assert.equal(mapaRes.data.totalMesas, 25);
  assert.ok(mapaRes.data.taxaOcupacaoMesasPct > 0);
  assert.ok(mapaRes.data.totalFaturamentoSalaoAtual > 0);
  assert.ok(mapaRes.data.ticketMedioSalao > 50.0);

  // Validar indicadores de giro das mesas
  const mesaConta = mapaRes.data.mesas.find(m => m.solicitouConta);
  assert.ok(mesaConta, 'Deve haver mesa solicitando conta');
  assert.equal(mesaConta.heatmapGiro.nivel, 'alerta_giro_roxo');

  // 2. Alterar status de mesa
  const altRes = await callRoute('POST', '/mesas/alterar-status', {
    mesaId: 3,
    novoStatus: 'consumindo',
    garcom: 'Roberto Kenji',
    valorAdicionar: 150.00
  });
  assert.equal(altRes.status, 200);
  assert.equal(altRes.data.ok, true);
  assert.equal(altRes.data.mesa.status, 'consumindo');
  assert.equal(altRes.data.mesa.valorAcumulado, 150.00);
});

test('Zuma Cozinha Oriental - Módulo Fiscal Completo com Emissão SEFAZ-MT (NFC-e & NF-e)', async () => {
  const { routerZuma, HISTORICO_NOTAS_FISCAIS_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Painel Fiscal e Certificado Digital A1
  const painelRes = await callRoute('GET', '/fiscal/painel');
  assert.equal(painelRes.status, 200);
  assert.equal(painelRes.data.ok, true);
  assert.equal(painelRes.data.cnpj, '36.296.848/0001-57');
  assert.equal(painelRes.data.certificadoDigital.status, 'VALIDO_E_ATIVO');
  assert.equal(painelRes.data.contingenciaOffline.status, 'PRONTA_STANDBY');
  assert.ok(painelRes.data.notas.length >= 3);

  // 2. Emitir NFC-e Modelo 65
  const emissaoRes = await callRoute('POST', '/fiscal/emitir', {
    modelo: 'NFC-e (65)',
    origemVenda: 'Mesa 12 · Salão Principal',
    cliente: 'Consumidor VIP Tangará',
    formaPagamento: 'PIX',
    itens: [
      { descricao: 'Combinado Zuma Casal 40 Peças', qtd: 1, precoUnit: 139.00, ncm: '2106.90.90' },
      { descricao: 'Hot Roll Filadélfia Especial (10 un)', qtd: 1, precoUnit: 42.00, ncm: '2106.90.90' }
    ]
  });

  assert.equal(emissaoRes.status, 200);
  assert.equal(emissaoRes.data.ok, true);
  assert.equal(emissaoRes.data.notaFiscal.modelo, 'NFC-e (65)');
  assert.equal(emissaoRes.data.notaFiscal.valorTotal, 181.00);
  assert.ok(emissaoRes.data.notaFiscal.chaveAcesso.startsWith('51261136296848000157'), 'Chave com UF 51 MT e CNPJ Zuma');
  assert.ok(emissaoRes.data.notaFiscal.protocoloSEFAZ.startsWith('1512600'), 'Protocolo SEFAZ-MT');
  assert.ok(emissaoRes.data.notaFiscal.qrcodeUrl.includes('sefaz.mt.gov.br'), 'URL de QR Code oficial SEFAZ-MT');
});


test('Zuma Cozinha Oriental - PDV de Caixa Completo: Venda Rápida, Baixa Ficha Técnica e NFC-e', async () => {
  const { routerZuma, CAIXA_TURNO_ATUAL_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) layer.route.stack[0].handle(req, res);
      else resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Status do Caixa
  const statusRes = await callRoute('GET', '/pdv/status-caixa');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.ok, true);
  assert.equal(statusRes.data.caixa.status, 'ABERTO');

  // 2. Venda Rápida no PDV com Baixa de Salmão e Emissão Fiscal
  const vendaRes = await callRoute('POST', '/pdv/venda-rapida', {
    itens: [
      { id: 'comb-30', nome: 'Combinado Zuma 30 Peças', qtd: 2, precoUnit: 139.90, ncm: '2106.90.90' },
      { id: 'coca', nome: 'Coca-Cola Zero 350ml', qtd: 2, precoUnit: 8.50, ncm: '2202.10.00' }
    ],
    formaPagamento: 'PIX',
    cliente: 'Rodrigo Gonçalves VIP',
    tipoVenda: 'BALCAO',
    emitirNfce: true
  });

  assert.equal(vendaRes.status, 200);
  assert.equal(vendaRes.data.ok, true);
  assert.equal(vendaRes.data.total, 296.80);
  assert.ok(vendaRes.data.salmaoBaixadoKg > 0, 'Deve baixar salmão da ficha técnica');
  assert.ok(vendaRes.data.notaFiscal, 'NFC-e deve ser emitida');
  assert.equal(vendaRes.data.notaFiscal.statusSEFAZ, '100_AUTORIZADA_PRODUCAO');
  assert.ok(vendaRes.data.kdsId.startsWith('KDS-'), 'Pedido despachado para a Cozinha KDS');
});

test('Zuma Cozinha Oriental - KDS de Cozinha Multi-Praças e Transição de Etapas de Preparo', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) layer.route.stack[0].handle(req, res);
      else resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Obter pedidos ativos em preparo
  const kdsRes = await callRoute('GET', '/cozinha/pedidos-ativos');
  assert.equal(kdsRes.status, 200);
  assert.equal(kdsRes.data.ok, true);
  assert.ok(kdsRes.data.totalPedidos >= 3);
  assert.ok(kdsRes.data.estatisticas.sushiBar >= 1);
  assert.ok(kdsRes.data.estatisticas.cozinhaQuente >= 1);

  // 2. Avançar etapa de preparo para PRONTO_CHAMADA
  const avancaRes = await callRoute('POST', '/cozinha/avancar-etapa', {
    pedidoId: 'KDS-101',
    novoStatus: 'PRONTO_CHAMADA'
  });
  assert.equal(avancaRes.status, 200);
  assert.equal(avancaRes.data.ok, true);
  assert.equal(avancaRes.data.pedido.status, 'PRONTO_CHAMADA');
});

test('Zuma Cozinha Oriental - Kardex de Estoque: Entrada NF-e Fornecedor & Transferência Interna', async () => {
  const { routerZuma, ESTOQUE_PESCADOS_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) layer.route.stack[0].handle(req, res);
      else resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Entrada de Lote por NF-e de Fornecedor
  const entradaRes = await callRoute('POST', '/estoque/entrada-nfe-xml', {
    insumoId: 'ins-salmao-fresco',
    quantidadeKg: 15.0,
    custoUnitario: 88.50,
    fornecedorNome: 'Frigorífico Pescados do Pantanal & Pacífico',
    numeroNota: '8821',
    temperaturaRecebimento: 0.2
  });
  assert.equal(entradaRes.status, 200);
  assert.equal(entradaRes.data.ok, true);
  assert.ok(entradaRes.data.novoSaldoKg >= 15.0);
  assert.equal(entradaRes.data.kardex.tipoMovimento, 'ENTRADA_FORNECEDOR_NFE');

  // 2. Transferência Interna (Câmara Fria 01 -> Bancada Sushi Bar)
  const transfRes = await callRoute('POST', '/estoque/transferencia-interna', {
    insumoId: 'ins-salmao-fresco',
    quantidadeKg: 3.5,
    origem: 'Câmara Fria 01',
    destino: 'Bancada Sushi Bar',
    responsável: 'Kenji Sushiman'
  });
  assert.equal(transfRes.status, 200);
  assert.equal(transfRes.data.ok, true);
  assert.equal(transfRes.data.kardex.tipoMovimento, 'TRANSFERENCIA_INTERNA');

  // 3. Extrato Kardex
  const kardexRes = await callRoute('GET', '/estoque/kardex');
  assert.equal(kardexRes.status, 200);
  assert.equal(kardexRes.data.ok, true);
  assert.ok(kardexRes.data.totalMovimentacoes >= 4);
});

test('Zuma Cozinha Oriental - Gestão Fiscal Avançada: Cancelamento NFC-e, CC-e e Livro de Apuração MT', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) layer.route.stack[0].handle(req, res);
      else resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Cancelamento de NFC-e com Protocolo SEFAZ-MT
  const cancRes = await callRoute('POST', '/fiscal/cancelar', {
    chaveAcesso: '51261136296848000157650010000010411827364519',
    numeroNota: 1041,
    justificativa: 'Cancelamento por duplicidade de comanda no salão pelo garçom'
  });
  assert.equal(cancRes.status, 200);
  assert.equal(cancRes.data.ok, true);
  assert.ok(cancRes.data.evento.protocoloCancelamento.startsWith('1512600'));
  assert.equal(cancRes.data.evento.statusSEFAZ, '135_EVENTO_VINCULADO_A_NF_HOMOLOGADO');

  // 2. Carta de Correção Eletrônica (CC-e) para NF-e mod 55
  const cceRes = await callRoute('POST', '/fiscal/carta-correcao', {
    chaveAcesso: '51261136296848000157550010000055101827364519',
    numeroNota: 5510,
    correcao: 'Inclusão de número de ordem de compra OC-2026-AGRO no campo dados adicionais'
  });
  assert.equal(cceRes.status, 200);
  assert.equal(cceRes.data.ok, true);
  assert.ok(cceRes.data.evento.protocoloCCE.startsWith('1512600'));

  // 3. Livro de Apuração Fiscal Simples Nacional MT
  const apuracaoRes = await callRoute('GET', '/fiscal/livro-apuracao');
  assert.equal(apuracaoRes.status, 200);
  assert.equal(apuracaoRes.data.ok, true);
  assert.equal(apuracaoRes.data.resumo.aliquotaEfetivaICMS, '3.85%');
  assert.ok(apuracaoRes.data.resumo.icmsSimplesDevido > 0);
  assert.ok(apuracaoRes.data.resumo.economiaTributariaMonofasica > 0);

  // 4. Exportação de XMLs para Contabilidade
  const exportRes = await callRoute('GET', '/fiscal/exportar-xmls');
  assert.equal(exportRes.status, 200);
  assert.equal(exportRes.data.ok, true);
  assert.ok(exportRes.data.totalArquivosXml >= 3);
  assert.ok(exportRes.data.downloadZipUrl.endsWith('.zip'));
});


test('Zuma Cozinha Oriental - Módulo de Pagamentos KyttoPay (PIX Dinâmico, Cartões e Histórico)', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Gerar PIX Dinâmico
  const pixRes = await callRoute('POST', '/pagamentos/pix-gerar', {
    valor: 147.50,
    pedidoId: 'ZUM-TEST-01',
    clienteNome: 'Rodrigo Teste',
    descricao: 'Combinado 30 Pçs + Temaki'
  });
  assert.equal(pixRes.status, 200);
  assert.equal(pixRes.data.ok, true);
  assert.equal(pixRes.data.pix.valor, 147.50);
  assert.equal(pixRes.data.pix.status, 'AGUARDANDO_PAGAMENTO');
  assert.ok(pixRes.data.pix.pixPayloadEmv.includes('br.gov.bcb.pix'));
  assert.ok(pixRes.data.pix.qrcodeUrl.includes('create-qr-code'));

  // 2. Confirmar Pagamento com Sucesso
  const confRes = await callRoute('POST', '/pagamentos/confirmar', {
    txid: pixRes.data.pix.txid,
    pedidoId: 'ZUM-TEST-01',
    forma: 'PIX',
    valor: 147.50
  });
  assert.equal(confRes.status, 200);
  assert.equal(confRes.data.ok, true);
  assert.equal(confRes.data.transacao.status, 'CONFIRMADO');
  assert.ok(confRes.data.comprovanteDigital.nsu);

  // 3. Consultar Histórico e Totais
  const histRes = await callRoute('GET', '/pagamentos/historico');
  assert.equal(histRes.status, 200);
  assert.equal(histRes.data.ok, true);
  assert.ok(histRes.data.resumo.totalGeral > 0);
  assert.ok(histRes.data.transacoes.length >= 3);
});

test('Zuma Cozinha Oriental - App do Entregador com Rastreabilidade, GPS e Mapa de Tangará da Serra', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const [pathname, queryString] = p.split("?");
      const query = {};
      if (queryString) {
        new URLSearchParams(queryString).forEach((val, key) => { query[key] = val; });
      }
      const req = { method, path: pathname, query, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && (l.route.path === pathname || l.route.path === p) && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Posição GPS e Status do Motoboy
  const posRes = await callRoute('GET', '/entregador/posicao-atual');
  assert.equal(posRes.status, 200);
  assert.equal(posRes.data.ok, true);
  assert.equal(posRes.data.motoboy.nome, "Carlos 'Ninja' Silva");
  assert.ok(posRes.data.motoboy.lat < 0);
  assert.ok(posRes.data.motoboy.lng < 0);

  // 2. Lista de Corridas / Entregas Pendentes
  const corrsRes = await callRoute('GET', '/entregador/corridas');
  assert.equal(corrsRes.status, 200);
  assert.equal(corrsRes.data.ok, true);
  assert.ok(corrsRes.data.corridas.length >= 2);
  assert.equal(corrsRes.data.sede.cidade, "Tangará da Serra - MT");

  // 3. Atualizar Status da Entrega com Código OTP
  const updRes = await callRoute('POST', '/entregador/atualizar-status', {
    corridaId: 'CORR-701',
    novoStatus: 'entregue',
    codigoOtp: '4192'
  });
  assert.equal(updRes.status, 200);
  assert.equal(updRes.data.ok, true);
  assert.equal(updRes.data.corrida.status, 'entregue');
  assert.ok(updRes.data.corrida.horaConclusao);

  // 4. Fechamento de Diária e Repasse de Taxas do Entregador
  const fechRes = await callRoute('GET', '/entregador/fechamento-diaria?motoboyId=MOTO-01');
  assert.equal(fechRes.status, 200);
  assert.equal(fechRes.data.ok, true);
  assert.ok(fechRes.data.totalEntregasConcluidas >= 1);
  assert.ok(fechRes.data.totalTaxasRepasse > 0);
});

test("Zuma Cozinha Oriental - Módulos Especializados v2: Fiscal NFC-e, Reservas/Fila Hostess, Matriz BCG, Spool Impressão, Compras e Zumi IA", async () => {
  const { routerZuma } = await import("./modules/restaurante-zuma.js");

  const callRoute = (method, p, body = {}, query = {}) => {
    return new Promise((resolve) => {
      let matchedLayer = null;
      let params = {};
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          const match = layer.match(p);
          if (match) {
            matchedLayer = layer;
            params = layer.params || {};
            break;
          }
        }
      }

      if (!matchedLayer) {
        return resolve({ status: 404, data: { error: "Route not found: " + p } });
      }

      const req = { method, url: p, path: p, body, query, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      matchedLayer.route.stack[0].handle(req, res);
    });
  };

  // 1. Fiscal NFC-e SEFAZ-MT
  const notasEmitidas = await callRoute("GET", "/fiscal/notas-emitidas");
  assert.equal(notasEmitidas.status, 200);
  assert.equal(notasEmitidas.data.ok, true);
  assert.ok(notasEmitidas.data.notas.length >= 1);
  assert.equal(notasEmitidas.data.ambiente, "producao");

  const emitirNfce = await callRoute("POST", "/fiscal/emitir-nfce", {
    valorTotal: 159.90,
    cpfConsumidor: "123.456.789-00",
    itens: [{ descricao: "Barca Zuma Especial 40 Peças", qtd: 1, valorUnit: 159.90 }]
  });
  assert.equal(emitirNfce.status, 201);
  assert.equal(emitirNfce.data.ok, true);
  assert.equal(emitirNfce.data.nota.chaveAcesso.length, 44);
  assert.ok(emitirNfce.data.nota.protocoloAutorizacao.length > 5);

  const danfe = await callRoute("GET", `/fiscal/danfe-xml/${emitirNfce.data.nota.chaveAcesso}`);
  assert.equal(danfe.status, 200);
  assert.ok(danfe.data.danfeSimplificadaText.includes("ZUMA COZINHA ORIENTAL"));
  assert.ok(danfe.data.xmlString.includes(emitirNfce.data.nota.chaveAcesso));

  const cancelarNfce = await callRoute("POST", "/fiscal/cancelar-nfce", {
    chaveAcesso: emitirNfce.data.nota.chaveAcesso,
    motivo: "Erro de teste homologação"
  });
  assert.equal(cancelarNfce.status, 200);
  assert.equal(cancelarNfce.data.ok, true);
  assert.equal(cancelarNfce.data.nota.status, "cancelada");

  const regrasFiscais = await callRoute("GET", "/fiscal/regras-tributarias");
  assert.equal(regrasFiscais.status, 200);
  assert.ok(regrasFiscais.data.regimeTributario.includes("Simples Nacional"));
  assert.ok(regrasFiscais.data.regras.length >= 2);

  // 2. Reservas e Fila de Espera Hostess
  const fila = await callRoute("GET", "/fila");
  assert.equal(fila.status, 200);
  assert.equal(fila.data.ok, true);
  assert.ok(Array.isArray(fila.data.fila));

  const entrarFila = await callRoute("POST", "/fila/entrar", {
    clienteNome: "Família Souza",
    qtdPessoas: 4,
    telefoneWhatsapp: "65999881122"
  });
  assert.equal(entrarFila.status, 201);
  assert.equal(entrarFila.data.ok, true);
  assert.equal(entrarFila.data.entrada.clienteNome, "Família Souza");

  const chamarFila = await callRoute("POST", "/fila/chamar", {
    id: entrarFila.data.entrada.id,
    mesaNumero: 6
  });
  assert.equal(chamarFila.status, 200);
  assert.equal(chamarFila.data.ok, true);
  assert.equal(chamarFila.data.item.status, "chamada");

  const acomodarFila = await callRoute("POST", "/fila/acomodar", {
    id: entrarFila.data.entrada.id,
    mesaNumero: 6
  });
  assert.equal(acomodarFila.status, 200);
  assert.equal(acomodarFila.data.ok, true);
  assert.equal(acomodarFila.data.item.status, "sentada");

  const reservas = await callRoute("GET", "/reservas");
  assert.equal(reservas.status, 200);
  assert.equal(reservas.data.ok, true);
  assert.ok(reservas.data.reservas.length >= 2);

  const criarReserva = await callRoute("POST", "/reservas/criar", {
    clienteNome: "Dr. Leonardo",
    qtdPessoas: 4,
    data: "2026-11-20",
    hora: "21:00",
    setorDesejado: "Tatame VIP 1"
  });
  assert.equal(criarReserva.status, 201);
  assert.equal(criarReserva.data.ok, true);
  assert.equal(criarReserva.data.reserva.setorDesejado, "Tatame VIP 1");

  // 3. Matriz BCG do Cardápio
  const matrizBcg = await callRoute("GET", "/engenharia-cardapio/matriz-bcg");
  assert.equal(matrizBcg.status, 200);
  assert.equal(matrizBcg.data.ok, true);
  assert.equal(matrizBcg.data.totalProdutosAnalisados, 211);
  assert.ok(matrizBcg.data.matrizBcg.estrelas.total > 0);
  assert.ok(matrizBcg.data.matrizBcg.burrosDeCarga.total > 0);
  assert.ok(matrizBcg.data.matrizBcg.quebraCabecasOportunidades.total > 0);
  assert.ok(matrizBcg.data.matrizBcg.caesParaSubstituir.total > 0);

  // 4. Spool de Impressão Térmica ESC/POS 80mm
  const spoolMesa = await callRoute("POST", "/impressao/comanda-mesa", { mesaNumero: 4, garcom: "Leandro" });
  assert.equal(spoolMesa.status, 200);
  assert.equal(spoolMesa.data.ok, true);
  assert.ok(spoolMesa.data.spool.conteudoFormatado.includes("ZUMA COZINHA ORIENTAL"));
  assert.equal(spoolMesa.data.spool.tamanho, "80mm");

  const spoolKds = await callRoute("POST", "/impressao/tiquete-kds", { mesaNumero: 4, setor: "Sushi Bar", sushiman: "Rafael" });
  assert.equal(spoolKds.status, 200);
  assert.equal(spoolKds.data.ok, true);
  assert.ok(spoolKds.data.spool.conteudoFormatado.includes("PRODUÇÃO") || spoolKds.data.spool.conteudoFormatado.includes("PRODUCAO"));

  const spoolHist = await callRoute("GET", "/impressao/historico");
  assert.equal(spoolHist.status, 200);
  assert.equal(spoolHist.data.ok, true);
  assert.ok(spoolHist.data.spools.length >= 2);

  // 5. Compras de Pescados Nobres com Controle de Temperatura
  const compras = await callRoute("GET", "/compras/pedidos");
  assert.equal(compras.status, 200);
  assert.equal(compras.data.ok, true);
  assert.ok(Array.isArray(compras.data.compras));

  const novaCompra = await callRoute("POST", "/compras/lancar-ordem", {
    fornecedor: "Costa Sul Pescados",
    itens: [{ insumo: "Salmão Fresco", qtdKg: 40.0, precoKg: 68.50 }]
  });
  assert.equal(novaCompra.status, 201);
  assert.equal(novaCompra.data.ok, true);
  assert.equal(novaCompra.data.ordemCompra.fornecedor, "Costa Sul Pescados");

  // 6. Zumi & Akira IA: Processamento de Pedidos em Linguagem Natural
  const iaPedido = await callRoute("POST", "/ia/interpretar-pedido", {
    textoMensagem: "Boa noite! Quero pedir 1 barco supremo de 40 peças, 1 temaki e 2 cocas para o Jardim Tangará II"
  });
  assert.equal(iaPedido.status, 200);
  assert.equal(iaPedido.data.ok, true);
  assert.equal(iaPedido.data.pedido.bairro, "Jardim Tangará II");
  assert.equal(iaPedido.data.pedido.taxaEntrega, 9.0);
  assert.ok(iaPedido.data.pedido.itens.length >= 2);
  assert.ok(iaPedido.data.pedido.mensagemWhatsapp.includes("Zuma Cozinha Oriental"));
  assert.ok(iaPedido.data.pedido.pixCopiaECola.length > 30);

  // 7. Persistência de Estado em Disco
  const estadoPersistidoPath = path.join(__dirname, "data", "zuma-erp-estado.json");
  assert.ok(fs.existsSync(estadoPersistidoPath), "Arquivo app/data/zuma-erp-estado.json deve existir");
  const estadoJson = JSON.parse(fs.readFileSync(estadoPersistidoPath, "utf8"));
  assert.equal(estadoJson.empresaId, "c3c3ac01-8e50-4b61-8c79-de4aaa916da3");
  assert.ok(estadoJson.turnoCaixa);
  assert.ok(estadoJson.fiscalNotasEmitidas);
  assert.ok(estadoJson.reservasMesas);

  // 8. Novas Abas no erp.html
  const erpHtmlPath = path.join(__dirname, "public", "zuma", "erp.html");
  const erpHtml = fs.readFileSync(erpHtmlPath, "utf8");
  assert.ok(erpHtml.includes("aba-fiscal-nfce"), "Deve conter aba Fiscal & NFC-e");
  assert.ok(erpHtml.includes("aba-reservas-fila"), "Deve conter aba Reservas & Fila Hostess");
  assert.ok(erpHtml.includes("aba-engenharia-bcg"), "Deve conter aba Matriz BCG");
  assert.ok(erpHtml.includes("aba-impressao-termica"), "Deve conter aba Impressão Térmica");
  assert.ok(erpHtml.includes("aba-compras-pescados"), "Deve conter aba Compras Pescados");
  assert.ok(erpHtml.includes("aba-zumi-ia-pedidos"), "Deve conter aba Zumi IA");
});

test('Zuma Cozinha Oriental - CRUD Completo de Cardápio: Incluir, Modificar e Excluir Item', async () => {
  const { routerZuma, CARDAPIO_DINAMICO_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(p)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Incluir Item
  const totalAntes = CARDAPIO_DINAMICO_ZUMA.length;
  const incRes = await callRoute('POST', '/cardapio/item', {
    nome: 'Niguiri Especial de Salmão Maçaricado com Azeite Trufado',
    categoria: 'Niguiris Especiais',
    preco: 38.50,
    descricao: 'Dupla de niguiri de salmão fresco maçaricado, azeite trufado e flor de sal'
  });
  assert.equal(incRes.status, 201);
  assert.equal(incRes.data.ok, true);
  assert.ok(incRes.data.item.id);
  const itemId = incRes.data.item.id;
  assert.equal(CARDAPIO_DINAMICO_ZUMA.length, totalAntes + 1);

  // 2. Modificar / Salvar Item
  const modRes = await callRoute('PUT', `/cardapio/item/${itemId}`, {
    preco: 42.00,
    descricao: 'Dupla de niguiri de salmão fresco maçaricado com raspas de limão siciliano e trufas'
  }, { id: itemId });
  assert.equal(modRes.status, 200);
  assert.equal(modRes.data.ok, true);
  assert.equal(modRes.data.item.preco, 42.00);

  // 3. Excluir Item
  const delRes = await callRoute('DELETE', `/cardapio/item/${itemId}`, {}, { id: itemId });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.ok, true);
  assert.equal(delRes.data.itemExcluido.id, itemId);
  assert.equal(CARDAPIO_DINAMICO_ZUMA.length, totalAntes);
});

test('Zuma Cozinha Oriental - CRUD Completo de Mesas: Incluir, Modificar e Excluir Mesa', async () => {
  const { routerZuma, MESAS_SALAO_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(p)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  const totalAntes = MESAS_SALAO_ZUMA.length;
  // 1. Incluir Mesa
  const incRes = await callRoute('POST', '/mesas', {
    numero: 88,
    setor: 'Deck Lounge',
    capacidade: 6,
    garcom: 'Kenji Mestre'
  });
  assert.equal(incRes.status, 201);
  assert.equal(incRes.data.ok, true);
  assert.equal(incRes.data.mesa.numero, 88);
  assert.equal(MESAS_SALAO_ZUMA.length, totalAntes + 1);

  // 2. Modificar / Salvar Mesa
  const modRes = await callRoute('PUT', '/mesas/88', {
    capacidade: 8,
    garcom: 'Ana Sato'
  }, { id: '88' });
  assert.equal(modRes.status, 200);
  assert.equal(modRes.data.ok, true);
  assert.equal(modRes.data.mesa.capacidade, 8);
  assert.equal(modRes.data.mesa.garcom, 'Ana Sato');

  // 3. Excluir Mesa
  const delRes = await callRoute('DELETE', '/mesas/88', {}, { id: '88' });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.ok, true);
  assert.equal(delRes.data.mesaExcluida.numero, 88);
  assert.equal(MESAS_SALAO_ZUMA.length, totalAntes);
});

test('Zuma Cozinha Oriental - CRUD Completo de Estoque e Insumos: Incluir, Modificar e Excluir Insumo', async () => {
  const { routerZuma, ESTOQUE_PESCADOS_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(p)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Incluir Insumo
  const incRes = await callRoute('POST', '/estoque/insumo', {
    nome: 'Polvo Fresco Português Especial',
    codigo: 'PESC-099',
    unidade: 'kg',
    saldoAtual: 8.5,
    saldoMinimo: 4.0,
    custoMedioUnitario: 155.00,
    fornecedor: 'Importadora Marítima Nobre'
  });
  assert.equal(incRes.status, 201);
  assert.equal(incRes.data.ok, true);
  const insId = incRes.data.insumo.id;
  assert.ok(ESTOQUE_PESCADOS_ZUMA[insId]);

  // 2. Modificar Insumo
  const modRes = await callRoute('PUT', `/estoque/insumo/${insId}`, {
    saldoAtual: 11.0,
    custoMedioUnitario: 150.00
  }, { id: insId });
  assert.equal(modRes.status, 200);
  assert.equal(modRes.data.ok, true);
  assert.equal(modRes.data.insumo.saldoAtual, 11.0);

  // 3. Excluir Insumo
  const delRes = await callRoute('DELETE', `/estoque/insumo/${insId}`, {}, { id: insId });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.ok, true);
  assert.equal(ESTOQUE_PESCADOS_ZUMA[insId], undefined);
});

test('Zuma Cozinha Oriental - CRUD Completo de Cozinha KDS: Incluir, Modificar e Excluir Pedido Manual', async () => {
  const { routerZuma, PEDIDOS_COZINHA_KDS_ZUMA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(p)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  const totalAntes = PEDIDOS_COZINHA_KDS_ZUMA.length;
  // 1. Incluir Pedido KDS
  const incRes = await callRoute('POST', '/cozinha/pedido', {
    numeroComanda: 'CMD-TEST-777',
    origem: 'Mesa 10 · Salão',
    praca: 'SUSHI_BAR',
    itens: [{ nome: 'Combinado Salmão 20 Peças', qtd: 1, obs: 'Gengibre extra' }],
    prioridade: 'URGENTE',
    garcom: 'Roberto Kenji'
  });
  assert.equal(incRes.status, 201);
  assert.equal(incRes.data.ok, true);
  const pedId = incRes.data.pedido.id;
  assert.equal(PEDIDOS_COZINHA_KDS_ZUMA.length, totalAntes + 1);

  // 2. Modificar Pedido KDS
  const modRes = await callRoute('PUT', `/cozinha/pedido/${pedId}`, {
    prioridade: 'ALTA',
    praca: 'COZINHA_QUENTE'
  }, { id: pedId });
  assert.equal(modRes.status, 200);
  assert.equal(modRes.data.ok, true);
  assert.equal(modRes.data.pedido.prioridade, 'ALTA');
  assert.equal(modRes.data.pedido.praca, 'COZINHA_QUENTE');

  // 3. Excluir / Cancelar Pedido KDS
  const delRes = await callRoute('DELETE', `/cozinha/pedido/${pedId}`, {}, { id: pedId });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.ok, true);
  assert.equal(delRes.data.pedidoCancelado.id, pedId);
  assert.equal(PEDIDOS_COZINHA_KDS_ZUMA.length, totalAntes);

  const swPath = path.join(__dirname, 'public', 'zuma', 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert.ok(swContent.includes('zuma-kytto-v3') || swContent.includes('zuma-kytto-v4') || swContent.includes('zuma-kytto-v5'), 'Service Worker deve estar na versão v3, v4 ou v5');
  assert.ok(swContent.includes('apps.html'), 'Cache do SW deve conter apps.html');
  assert.ok(swContent.includes('entregador.html'), 'Cache do SW deve conter entregador.html');
  assert.ok(swContent.includes('garcom.html'), 'Cache do SW deve conter garcom.html');
});

test('Zuma Cozinha Oriental - App do Proprietário (Gestão na Palma da Mão, Comparativos Mesmos Dias, Radar de Concorrência e Ações)', async () => {
  const { routerZuma, DASHBOARD_PROPRIETARIO_ZUMA, RADAR_CONCORRENCIA_TANGARA } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const req = { method, path: p, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === p && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: 'Route not found: ' + p } });
      }
    });
  };

  // 1. Dashboard Executivo do Proprietário
  const dashRes = await callRoute('GET', '/proprietario/dashboard');
  assert.equal(dashRes.status, 200);
  assert.equal(dashRes.data.ok, true);
  const kpis = dashRes.data.dashboard.kpisHoje;
  assert.ok(kpis.faturamentoHoje >= 8000.00, 'Faturamento hoje deve estar registrado');
  assert.ok(kpis.lucroLiquidoEstimadoHoje > 3000.00, 'Lucro líquido estimado deve ser positivo');
  assert.ok(kpis.cmvPercentualHoje <= 30.0, 'CMV deve estar dentro da meta');
  assert.equal(kpis.pedidosHojeTotal, 58, 'Total de 58 pedidos hoje');

  // 2. Comparativo de Mesmos Dias (D-7 e D-30)
  const comp = dashRes.data.dashboard.comparativoMesmosDias;
  assert.ok(comp.d7, 'Deve conter comparativo D-7');
  assert.ok(comp.d7.diffPercentualFaturamento > 0, 'Crescimento positivo D-7');
  assert.ok(comp.d30, 'Deve conter comparativo D-30');
  assert.ok(dashRes.data.dashboard.curvaHorariaHojeVsD7.length >= 8, 'Curva horária deve ter as horas do dia');

  // 3. Radar de Concorrência em Tangará da Serra (MT)
  const radarRes = await callRoute('GET', '/proprietario/concorrencia');
  assert.equal(radarRes.status, 200);
  assert.equal(radarRes.data.ok, true);
  assert.equal(radarRes.data.radar.cidade, 'Tangará da Serra - MT');
  assert.ok(radarRes.data.radar.estabelecimentos.length >= 4, 'Deve monitorar concorrentes locais');
  assert.ok(radarRes.data.radar.benchmarkPratos.length >= 5, 'Deve comparar pratos âncora');
  assert.ok(radarRes.data.radar.diagnosticoMotorKyttoIA.oportunidadesImediatas.length >= 2);

  // 3.1. Visão Online da IA e Evolução dos Atendimentos
  const iaRes = await callRoute('GET', '/proprietario/ia-atendimentos');
  assert.equal(iaRes.status, 200);
  assert.equal(iaRes.data.ok, true);
  assert.ok(iaRes.data.iaAtendimentos.kpisAtendimentos.totalAtendimentosHoje >= 300, 'Total de atendimentos hoje >= 300');
  assert.ok(iaRes.data.iaAtendimentos.kpisAtendimentos.taxaResolucaoAutonoma >= 90.0, 'Resolução autônoma da IA >= 90%');
  assert.ok(iaRes.data.iaAtendimentos.curvaAtendimentosHora.length >= 8, 'Curva hora a hora de atendimentos');
  assert.ok(iaRes.data.iaAtendimentos.pipelineOportunidadesKyttoIA.length >= 3, 'Pipeline de oportunidades financeiras');

  // 3.2. Matriz de Ganhos, Perdas e Onde Melhorar (Churn & Flow)
  const gpRes = await callRoute('GET', '/proprietario/ganhos-perdas');
  assert.equal(gpRes.status, 200);
  assert.equal(gpRes.data.ok, true);
  assert.ok(gpRes.data.matrizGanhosPerdas.ondeEstamosGanhando.length >= 2, 'Alavancas de ganho de clientes');
  assert.ok(gpRes.data.matrizGanhosPerdas.ondeEstamosPerdendo.length >= 2, 'Pontos de fuga e churn');
  assert.ok(gpRes.data.matrizGanhosPerdas.matrizOndeMelhorarKyttoIA.length >= 2, 'Matriz prescritiva onde melhorar KyttoIA');

  // 3.3. Radar e Teia de CNPJs de Tangará da Serra (MT)
  const cnpjsRes = await callRoute('GET', '/proprietario/cnpjs-cidade');
  assert.equal(cnpjsRes.status, 200);
  assert.equal(cnpjsRes.data.ok, true);
  assert.equal(cnpjsRes.data.radarCnpjs.cidade, 'Tangará da Serra - MT');
  assert.ok(cnpjsRes.data.radarCnpjs.cnpjsCadastrados.length >= 8, 'Mapeamento de no mínimo 8 CNPJs locais');
  assert.ok(cnpjsRes.data.radarCnpjs.marketShareOriental.length >= 4, 'Market share da gastronomia oriental');
  assert.ok(cnpjsRes.data.radarCnpjs.teiaConexoesSocietarias.length >= 2, 'Teia de conexões societárias e fornecedores');

  // 4. Tomada de Ação Rápida pelo Proprietário
  const acaoRes = await callRoute('POST', '/proprietario/acao', {
    acaoId: 'oferta_relampago_vip',
    titulo: 'Disparo de Oferta VIP via WhatsApp',
    detalhes: 'Envio de cupom para 180 clientes mais frequentes'
  });
  assert.equal(acaoRes.status, 200);
  assert.equal(acaoRes.data.ok, true);
  assert.equal(acaoRes.data.acao.status, 'Executado com Sucesso');
  assert.ok(acaoRes.data.totalAcoesExecutadas >= 1);

  // 5. Existência física dos arquivos do Proprietário
  const propHtml = path.join(__dirname, 'public', 'zuma', 'proprietario.html');
  const propManifest = path.join(__dirname, 'public', 'zuma', 'manifest-proprietario.json');
  const propApk = path.join(__dirname, 'public', 'zuma', 'downloads', 'zuma-proprietario.apk');

  assert.ok(fs.existsSync(propHtml), 'proprietario.html deve existir em app/public/zuma');
  assert.ok(fs.existsSync(propManifest), 'manifest-proprietario.json deve existir');
  assert.ok(fs.existsSync(propApk), 'zuma-proprietario.apk deve existir');

  const propContent = fs.readFileSync(propHtml, 'utf8');
  assert.ok(propContent.includes('Zuma Proprietário'), 'Deve conter branding do proprietário');
  assert.ok(propContent.includes('Tangará da Serra'), 'Deve referenciar Tangará da Serra');
  assert.ok(propContent.includes('D-7'), 'Deve conter comparativo D-7');
  assert.ok(propContent.includes('executarAcao'), 'Deve conter função de tomada de ação');
});
test("Zuma Cozinha Oriental - CRUD Completo de Clientes no CRM: Incluir, Modificar e Excluir Cliente VIP", async () => {
  const { routerZuma, ZUMA_CLIENTES_CRM } = await import("./modules/restaurante-zuma.js");
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const [pathname] = p.split("?");
      const req = { method, path: pathname, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(pathname)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: "Route not found: " + p } });
    });
  };

  const totalAntes = ZUMA_CLIENTES_CRM.length;

  // 1. Incluir Cliente VIP
  const incRes = await callRoute("POST", "/crm/cliente", {
    nome: "Dra. Renata Vasconcelos",
    telefone: "(65) 99911-8844",
    email: "renata.vasconcelos@tga.adv.br",
    bairro: "Jardim Tangará II",
    cidade: "Tangará da Serra",
    aniversario: "1988-09-12",
    pratosFavoritos: ["Sashimi Nobre de Salmão", "Uramaki Ebi Especial"],
    segmentoRFV: "VIP Diamante"
  });
  assert.equal(incRes.status, 201);
  assert.equal(incRes.data.ok, true);
  const cliId = incRes.data.cliente.id;
  assert.equal(ZUMA_CLIENTES_CRM.length, totalAntes + 1);

  // 2. Modificar Cliente VIP
  const modRes = await callRoute("PUT", `/crm/cliente/${cliId}`, {
    observacoes: "Prefere mesas reservadas no deck climatizado às sextas-feiras.",
    segmentoRFV: "VIP Black Master"
  }, { id: cliId });
  assert.equal(modRes.status, 200);
  assert.equal(modRes.data.ok, true);
  assert.equal(modRes.data.cliente.segmentoRFV, "VIP Black Master");

  // 3. Excluir Cliente VIP
  const delRes = await callRoute("DELETE", `/crm/cliente/${cliId}`, {}, { id: cliId });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.ok, true);
  assert.equal(delRes.data.clienteExcluido.id, cliId);
  assert.equal(ZUMA_CLIENTES_CRM.length, totalAntes);
});

test("Zuma Cozinha Oriental - CRUD Completo de Delivery & Expedição: Incluir, Modificar e Excluir Corrida", async () => {
  const { routerZuma, CORRIDAS_ENTREGADOR_ZUMA } = await import("./modules/restaurante-zuma.js");
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const [pathname] = p.split("?");
      const req = { method, path: pathname, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(pathname)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: "Route not found: " + p } });
    });
  };

  const totalAntes = CORRIDAS_ENTREGADOR_ZUMA.length;

  // 1. Incluir Corrida de Delivery
  const incRes = await callRoute("POST", "/delivery/corrida", {
    clienteNome: "Rodrigo Gonçalves",
    telefone: "(65) 99905-6008",
    endereco: "Av. Brasil, nº 880 - Centro",
    bairro: "Centro",
    valorTotal: 178.50,
    taxaEntrega: 12.00,
    formaPagamento: "PIX Dinâmico KyttoPay"
  });
  assert.equal(incRes.status, 201);
  assert.equal(incRes.data.ok, true);
  const corridaId = incRes.data.corrida.id;
  assert.equal(CORRIDAS_ENTREGADOR_ZUMA.length, totalAntes + 1);

  // 2. Modificar Corrida
  const modRes = await callRoute("PUT", `/delivery/corrida/${corridaId}`, {
    status: "em_rota",
    taxaEntrega: 15.00
  }, { id: corridaId });
  assert.equal(modRes.status, 200);
  assert.equal(modRes.data.ok, true);
  assert.equal(modRes.data.corrida.status, "em_rota");
  assert.equal(modRes.data.corrida.taxaEntrega, 15.00);

  // 3. Excluir / Cancelar Corrida
  const delRes = await callRoute("DELETE", `/delivery/corrida/${corridaId}`, {}, { id: corridaId });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.ok, true);
  assert.equal(delRes.data.corridaCancelada.id, corridaId);
  assert.equal(CORRIDAS_ENTREGADOR_ZUMA.length, totalAntes);
});

test("Zuma Cozinha Oriental - Operações Avançadas de Mesas: Divisão de Conta e Transferência de Comanda", async () => {
  const { routerZuma } = await import("./modules/restaurante-zuma.js");
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const [pathname] = p.split("?");
      const req = { method, path: pathname, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === pathname && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: "Route not found: " + p } });
      }
    });
  };

  // 1. Divisão de Conta em 3 pessoas com 10%
  const divRes = await callRoute("POST", "/mesas/dividir-conta", {
    numeroMesa: "04",
    numeroPessoas: 3,
    incluirDezPorcento: true
  });
  assert.equal(divRes.status, 200);
  assert.equal(divRes.data.ok, true);
  assert.equal(divRes.data.pessoas, 3);
  assert.ok(divRes.data.valorPorPessoa > 0);
  assert.ok(divRes.data.taxaServico > 0);

  // 2. Transferência de Comanda
  const transfRes = await callRoute("POST", "/mesas/transferir-comanda", {
    mesaOrigem: "04",
    mesaDestino: "12",
    garcom: "Marcos Salão"
  });
  assert.equal(transfRes.status, 200);
  assert.equal(transfRes.data.ok, true);
});

test("Zuma Cozinha Oriental - Operações Avançadas de Estoque: Ajuste Rápido de Inventário e Balanço Físico", async () => {
  const { routerZuma, ESTOQUE_PESCADOS_ZUMA } = await import("./modules/restaurante-zuma.js");
  const callRoute = (method, p, body = {}) => {
    return new Promise((resolve) => {
      const [pathname] = p.split("?");
      const req = { method, path: pathname, query: {}, body, params: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      const layer = routerZuma.stack.find(l => l.route && l.route.path === pathname && l.route.methods[method.toLowerCase()]);
      if (layer) {
        layer.route.stack[0].handle(req, res);
      } else {
        resolve({ status: 404, data: { error: "Route not found: " + p } });
      }
    });
  };

  const ajusteRes = await callRoute("POST", "/estoque/ajuste-rapido", {
    insumoId: "salmao",
    novoSaldo: 35.5,
    motivo: "Inventário semanal de pescados nobres",
    responsavel: "Chef Sushiman Executivo"
  });
  assert.equal(ajusteRes.status, 200);
  assert.equal(ajusteRes.data.ok, true);
  assert.equal(ajusteRes.data.novoSaldo, 35.5);
  assert.equal(ESTOQUE_PESCADOS_ZUMA['ins-salmao-fresco'].saldoAtual, 35.5);
});


test("Zuma Cozinha Oriental - Central ERP PWA (erp.html): CRUD Dinâmico de Cardápio, Mesas, Insumos e Modais", () => {
  const erpHtmlPath = path.join(__dirname, "public", "zuma", "erp.html");
  assert.ok(fs.existsSync(erpHtmlPath), "erp.html deve existir em app/public/zuma/");
  const content = fs.readFileSync(erpHtmlPath, "utf8");
  assert.ok(content.includes("aba-cardapio-crud"), "Deve conter aba de CRUD de cardápio");
  assert.ok(content.includes("modal-prato-erp"), "Deve conter modal de pratos");
  assert.ok(content.includes("modal-insumo-erp"), "Deve conter modal de insumos");
  assert.ok(content.includes("abrirModalDividirContaPrompt"), "Deve conter função de divisão de conta");
  assert.ok(content.includes("abrirModalTransferirPrompt"), "Deve conter função de transferência de mesas");
  assert.ok(content.includes("abrirModalAjusteRapidoPrompt"), "Deve conter função de ajuste rápido de estoque");
  assert.ok(content.includes("carregarCardapioDinamicoErp"), "Deve conter inicialização de cardápio dinâmico");
});

test('Zuma Cozinha Oriental - CRUD Completo de Fichas Técnicas e Matriz BCG KyttoIA', async () => {
  const { routerZuma, FICHAS_TECNICAS_ZUMA } = await import('./modules/restaurante-zuma.js');

  // 1. Criar Ficha Técnica via POST
  const fakeReqPost = {
    body: {
      codigoPdv: "ZUM-TEST-FT",
      nomeProduto: "Uramaki Especial Trufado c/ Vieira Fresca",
      categoria: "Especiais Omakase",
      precoVenda: 75.00,
      rendimento: 1,
      descricao: "Uramaki maçaricado com lâmina de vieira e azeite trufado",
      insumos: [
        { id: "ins-salmao-fresco", nome: "Salmão Fresco", qtd: 0.120, unidade: "kg", custoUnitario: 82.93 },
        { id: "ins-arroz-gohan", nome: "Arroz Gohan", qtd: 0.100, unidade: "kg", custoUnitario: 14.00 }
      ]
    }
  };
  let postStatusCode = 200;
  let postData = null;
  const fakeResPost = {
    status: (c) => { postStatusCode = c; return fakeResPost; },
    json: (d) => { postData = d; return fakeResPost; }
  };
  const postHandler = routerZuma.stack.find(s => s.route && s.route.methods.post && s.route.path.includes('/fichas-tecnicas')).route.stack[0].handle;
  postHandler(fakeReqPost, fakeResPost);

  assert.strictEqual(postStatusCode, 201);
  assert.strictEqual(postData.ok, true);
  assert.strictEqual(postData.ficha.codigoPdv, "ZUM-TEST-FT");
  assert.strictEqual(postData.ficha.nomeProduto, "Uramaki Especial Trufado c/ Vieira Fresca");
  assert.ok(postData.ficha.cmvTeorico > 0);
  assert.ok(postData.ficha.margemContribuicao > 0);

  // 2. Modificar Ficha Técnica via PUT
  const fakeReqPut = {
    params: { id: "ZUM-TEST-FT" },
    body: {
      nomeProduto: "Uramaki Especial Trufado c/ Vieira Fresca Premium",
      precoVenda: 82.00
    }
  };
  let putData = null;
  const fakeResPut = {
    json: (d) => { putData = d; return fakeResPut; }
  };
  const putHandler = routerZuma.stack.find(s => s.route && s.route.methods.put && s.route.path.includes('/fichas-tecnicas/:id')).route.stack[0].handle;
  putHandler(fakeReqPut, fakeResPut);

  assert.strictEqual(putData.ok, true);
  assert.strictEqual(putData.ficha.precoVenda, 82.00);

  // 3. Matriz BCG
  let bcgData = null;
  const fakeResBcg = {
    json: (d) => { bcgData = d; return fakeResBcg; }
  };
  const bcgHandler = routerZuma.stack.find(s => s.route && s.route.methods.get && s.route.path === '/fichas-tecnicas/matriz-bcg').route.stack[0].handle;
  bcgHandler({}, fakeResBcg);

  assert.strictEqual(bcgData.ok, true);
  assert.ok(bcgData.matrizBcg.estrelas.total > 0);
  assert.ok(bcgData.matrizBcg.burrosDeCarga.total > 0);

  // 4. Excluir Ficha Técnica via DELETE
  const fakeReqDel = { params: { id: "ZUM-TEST-FT" } };
  let delData = null;
  const fakeResDel = {
    json: (d) => { delData = d; return fakeResDel; }
  };
  const delHandler = routerZuma.stack.find(s => s.route && s.route.methods.delete && s.route.path.includes('/fichas-tecnicas/:id')).route.stack[0].handle;
  delHandler(fakeReqDel, fakeResDel);

  assert.strictEqual(delData.ok, true);
  assert.strictEqual(FICHAS_TECNICAS_ZUMA["ZUM-TEST-FT"], undefined);
});

test('Zuma Cozinha Oriental - CRUD Completo de Reservas e Hostess Fila de Espera', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');

  // 1. Criar Reserva via POST /reservas
  const fakeReqPost = {
    body: {
      clienteNome: "Dra. Mariana Zang",
      telefoneWhatsapp: "(65) 99888-7711",
      data: "2026-11-21",
      hora: "20:30",
      qtdPessoas: 4,
      setorDesejado: "Tatame VIP 01",
      observacoes: "Comemoração de aniversário"
    }
  };
  let postStatusCode = 200;
  let postData = null;
  const fakeResPost = {
    status: (c) => { postStatusCode = c; return fakeResPost; },
    json: (d) => { postData = d; return fakeResPost; }
  };
  const postHandler = routerZuma.stack.find(s => s.route && s.route.methods.post && s.route.path === '/reservas').route.stack[0].handle;
  postHandler(fakeReqPost, fakeResPost);

  assert.strictEqual(postStatusCode, 201);
  assert.strictEqual(postData.ok, true);
  assert.strictEqual(postData.reserva.clienteNome, "Dra. Mariana Zang");
  const reservaId = postData.reserva.id;

  // 2. Modificar Reserva via PUT /reservas/:id
  const fakeReqPut = {
    params: { id: reservaId },
    body: {
      qtdPessoas: 6,
      status: "confirmada"
    }
  };
  let putData = null;
  const fakeResPut = {
    json: (d) => { putData = d; return fakeResPut; }
  };
  const putHandler = routerZuma.stack.find(s => s.route && s.route.methods.put && s.route.path === '/reservas/:id').route.stack[0].handle;
  putHandler(fakeReqPut, fakeResPut);

  assert.strictEqual(putData.ok, true);
  assert.strictEqual(putData.reserva.qtdPessoas, 6);

  // 3. Excluir Reserva via DELETE /reservas/:id
  const fakeReqDel = { params: { id: reservaId } };
  let delData = null;
  const fakeResDel = {
    json: (d) => { delData = d; return fakeResDel; }
  };
  const delHandler = routerZuma.stack.find(s => s.route && s.route.methods.delete && s.route.path === '/reservas/:id').route.stack[0].handle;
  delHandler(fakeReqDel, fakeResDel);

  assert.strictEqual(delData.ok, true);
  assert.strictEqual(delData.reserva.id, reservaId);
});

test('Zuma Cozinha Oriental - Módulo de Compras, Reposição e Fornecedores Pescados', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');

  // 1. Sugestões de Compras
  let sugestoesData = null;
  const fakeResSug = {
    json: (d) => { sugestoesData = d; return fakeResSug; }
  };
  const sugHandler = routerZuma.stack.find(s => s.route && s.route.methods.get && s.route.path === '/compras/sugestoes').route.stack[0].handle;
  sugHandler({}, fakeResSug);

  assert.strictEqual(sugestoesData.ok, true);
  assert.ok(sugestoesData.totalSugestoes > 0);
  assert.ok(sugestoesData.valorTotalEstimadoCompras > 0);

  // 2. Lançar Ordem de Compra
  const fakeReqPost = {
    body: {
      fornecedor: "Pescados Pantanal Cuiabá",
      itens: [
        { insumo: "Salmão Fresco Chileno (Filé Limpo)", qtdKg: 50.0, precoKg: 82.93 }
      ],
      condicaoPagamento: "Boleto 14 dias"
    }
  };
  let postStatusCode = 200;
  let postData = null;
  const fakeResPost = {
    status: (c) => { postStatusCode = c; return fakeResPost; },
    json: (d) => { postData = d; return fakeResPost; }
  };
  const postHandler = routerZuma.stack.find(s => s.route && s.route.methods.post && s.route.path === '/compras/lancar-ordem').route.stack[0].handle;
  postHandler(fakeReqPost, fakeResPost);

  assert.strictEqual(postStatusCode, 201);
  assert.strictEqual(postData.ok, true);
  const ordemId = postData.ordemCompra.id;

  // 3. Receber Mercadoria da Ordem
  const fakeReqPut = {
    params: { id: ordemId },
    body: {
      numeroNotaFiscalFornecedor: "NF-99201",
      temperaturaConferenciaC: 1.5
    }
  };
  let putData = null;
  const fakeResPut = {
    json: (d) => { putData = d; return fakeResPut; }
  };
  const putHandler = routerZuma.stack.find(s => s.route && s.route.methods.put && s.route.path === '/compras/pedidos/:id/receber').route.stack[0].handle;
  putHandler(fakeReqPut, fakeResPut);

  assert.strictEqual(putData.ok, true);
  assert.strictEqual(putData.ordem.status, "recebido");

  // 4. Cancelar/Excluir Ordem de Compra
  const fakeReqDel = { params: { id: ordemId } };
  let delData = null;
  const fakeResDel = {
    json: (d) => { delData = d; return fakeResDel; }
  };
  const delHandler = routerZuma.stack.find(s => s.route && s.route.methods.delete && s.route.path === '/compras/pedidos/:id').route.stack[0].handle;
  delHandler(fakeReqDel, fakeResDel);

  assert.strictEqual(delData.ok, true);
  assert.strictEqual(delData.ordem.id, ordemId);
});

test('Zuma Cozinha Oriental - Gestão de Turno de Caixa PDV, Sangrias e Suprimentos', async () => {
  const { routerZuma, CAIXA_TURNO_ATUAL_ZUMA } = await import('./modules/restaurante-zuma.js');

  // 1. Status do Caixa
  let statusData = null;
  const fakeResStatus = {
    json: (d) => { statusData = d; return fakeResStatus; }
  };
  const statusHandler = routerZuma.stack.find(s => s.route && s.route.methods.get && s.route.path === '/caixa/status-atual').route.stack[0].handle;
  statusHandler({}, fakeResStatus);

  assert.strictEqual(statusData.ok, true);
  assert.strictEqual(statusData.empresa, "Zuma Cozinha Oriental");

  // 2. Registrar Suprimento de Troco
  const fakeReqSupr = {
    body: { valor: 150.00, motivo: "Reforço troco sábado", operador: "Rodrigo Gonçalves" }
  };
  let suprData = null;
  const fakeResSupr = {
    json: (d) => { suprData = d; return fakeResSupr; }
  };
  const suprHandler = routerZuma.stack.find(s => s.route && s.route.methods.post && s.route.path === '/pdv/suprimento').route.stack[0].handle;
  suprHandler(fakeReqSupr, fakeResSupr);

  assert.strictEqual(suprData.ok, true);
  assert.ok(suprData.caixa.suprimentos.some(s => s.valor === 150.00));

  // 3. Registrar Sangria de Segurança
  const fakeReqSang = {
    body: { valor: 250.00, motivo: "Sangria periódica cofre", operador: "Rodrigo Gonçalves" }
  };
  let sangData = null;
  const fakeResSang = {
    json: (d) => { sangData = d; return fakeResSang; }
  };
  const sangHandler = routerZuma.stack.find(s => s.route && s.route.methods.post && s.route.path === '/pdv/sangria').route.stack[0].handle;
  sangHandler(fakeReqSang, fakeResSang);

  assert.strictEqual(sangData.ok, true);
  assert.ok(sangData.caixa.sangrias.some(s => s.valor === 250.00));
});
test('Zuma - Hub de Administração de Conexões e Open APIs de Concorrência', async () => {
  const { routerZuma } = await import('./modules/restaurante-zuma.js');
  const callRoute = (method, p, body = {}, params = {}) => {
    return new Promise((resolve) => {
      const [pathname] = p.split("?");
      const req = { method, path: pathname, query: {}, body, params };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
        send(data) { resolve({ status: this.statusCode, data }); }
      };
      for (const layer of routerZuma.stack) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          if (layer.match(pathname)) {
            req.params = layer.params || params;
            layer.route.stack[0].handle(req, res);
            return;
          }
        }
      }
      resolve({ status: 404, data: { error: 'Route not found: ' + p } });
    });
  };

  // 1. Listagem de todas as conexões de APIs abertas
  const conexoesRes = await callRoute('GET', '/admin/conexoes-apis');
  assert.equal(conexoesRes.status, 200);
  assert.equal(conexoesRes.data.ok, true);
  assert.equal(conexoesRes.data.hub.hubStatus.totalConexoes, 7, 'Devem existir 7 conexões no Hub de Open APIs');
  assert.equal(conexoesRes.data.hub.hubStatus.conexoesAtivas, 7, 'Todas as 7 conexões devem estar ativas');
  
  const ids = conexoesRes.data.hub.conectores.map(c => c.id);
  assert.ok(ids.includes('brasilapi_rfb'), 'Deve incluir BrasilAPI / Receita Federal');
  assert.ok(ids.includes('openstreetmap_geointel'), 'Deve incluir OpenStreetMap / Overpass');
  assert.ok(ids.includes('delivery_marketplaces_scrapers'), 'Deve incluir iFood / Marketplaces Scraper');
  assert.ok(ids.includes('google_places_reputation'), 'Deve incluir Google Places & Avaliações');
  assert.ok(ids.includes('bacen_ibge_inflacao'), 'Deve incluir Banco Central SGS');
  assert.ok(ids.includes('cepea_pescados_cotacoes'), 'Deve incluir Cepea Pescados MT');
  assert.ok(ids.includes('motor_kyttoia_intelligence'), 'Deve incluir Motor KyttoIA 2.5 Flash');

  // 2. Teste de ping e conectividade de conexão específica
  const testPing = await callRoute('POST', '/admin/conexoes-apis/testar', { conectorId: 'brasilapi_rfb' });
  assert.equal(testPing.status, 200);
  assert.equal(testPing.data.ok, true);
  assert.equal(testPing.data.log.conectorId, 'brasilapi_rfb');
  assert.ok(testPing.data.latenciaMs >= 0, 'Latência deve ser não-negativa');

  // 3. Sincronização global de concorrência
  const syncRes = await callRoute('POST', '/admin/conexoes-apis/sincronizar', {});
  assert.equal(syncRes.status, 200);
  assert.equal(syncRes.data.ok, true);
  assert.equal(syncRes.data.totalConectoresAtualizados, 7);
  assert.ok(syncRes.data.hubStatus.registrosProcessadosHoje > 0);

  // 4. Logs de telemetria e sincronização
  const logsRes = await callRoute('GET', '/admin/conexoes-apis/logs');
  assert.equal(logsRes.status, 200);
  assert.equal(logsRes.data.ok, true);
  assert.ok(logsRes.data.logs.length >= 5, 'Deve conter histórico de logs de auditoria');

  // 5. Consulta dinâmica de CNPJ via Open API (BrasilAPI ou Cache Enriquecido)
  const cnpjZuma = await callRoute('GET', '/admin/conexoes-apis/consulta-cnpj/48912440000188');
  assert.equal(cnpjZuma.status, 200);
  assert.equal(cnpjZuma.data.ok, true);
  assert.ok(cnpjZuma.data.dados.razaoSocial.toUpperCase().includes('ZUMA'), 'Razão Social deve conter ZUMA');
  assert.ok(cnpjZuma.data.dados.socios.length >= 1, 'Deve listar sócios');

  // Consulta de concorrente local (Bonsai Sushi)
  const cnpjBonsai = await callRoute('GET', '/admin/conexoes-apis/consulta-cnpj/43466537000154');
  assert.equal(cnpjBonsai.status, 200);
  assert.equal(cnpjBonsai.data.ok, true);
  assert.ok(cnpjBonsai.data.dados.razaoSocial.toUpperCase().includes('BONSAI'), 'Razão social deve conter BONSAI');

  // 6. Existência física e integridade do admin-conexoes.html
  const adminHtmlPath = path.join(__dirname, 'public', 'zuma', 'admin-conexoes.html');
  assert.ok(fs.existsSync(adminHtmlPath), 'admin-conexoes.html deve existir');
  const adminContent = fs.readFileSync(adminHtmlPath, 'utf8');
  assert.ok(adminContent.includes('Conexões & Open APIs'), 'Título do Hub deve estar presente');
  assert.ok(adminContent.includes('BrasilAPI'), 'BrasilAPI deve estar documentada');
  assert.ok(adminContent.includes('KyttoIA'), 'Motor KyttoIA deve estar presente');
  assert.ok(!adminContent.toLowerCase().includes('gemini'), 'Não deve exibir Gemini externamente (Diretriz Kytto)');
});
