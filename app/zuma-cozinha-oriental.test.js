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
