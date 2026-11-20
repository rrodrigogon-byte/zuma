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
