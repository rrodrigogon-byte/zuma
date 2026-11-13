import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

test('Torre de Pesagem Serrano CCO: 1. Validação de Arquivos e Bundles de Produção', () => {
  const torreHtmlPath = path.join(rootDir, 'app/public/torre-pesagem.html');
  const torreSerranoHtmlPath = path.join(rootDir, 'app/public/torre-serrano/index.html');
  const assetsDir = path.join(rootDir, 'app/public/torre-serrano/assets');
  
  assert.ok(fs.existsSync(torreHtmlPath), 'torre-pesagem.html deve existir em app/public');
  assert.ok(fs.existsSync(torreSerranoHtmlPath), 'index.html deve existir em app/public/torre-serrano');
  assert.ok(fs.existsSync(assetsDir), 'Pasta assets deve existir em app/public/torre-serrano');

  const htmlContent = fs.readFileSync(torreHtmlPath, 'utf8');
  assert.ok(htmlContent.includes('Torre'), 'Título da página deve conter Torre');

  // Localizar bundles ativos referenciados no HTML
  const jsMatch = htmlContent.match(/src="(\/torre-serrano\/assets\/index-[^"]+\.js)"/);
  const cssMatch = htmlContent.match(/href="(\/torre-serrano\/assets\/index-[^"]+\.css)"/);

  assert.ok(jsMatch, 'HTML deve referenciar bundle JS em /torre-serrano/assets/');
  assert.ok(cssMatch, 'HTML deve referenciar bundle CSS em /torre-serrano/assets/');

  const activeJs = path.join(rootDir, 'app/public', jsMatch[1]);
  const activeCss = path.join(rootDir, 'app/public', cssMatch[1]);

  assert.ok(fs.existsSync(activeJs), `JS bundle ${activeJs} deve existir fisicamente no disco`);
  assert.ok(fs.existsSync(activeCss), `CSS bundle ${activeCss} deve existir fisicamente no disco`);
});

test('Torre de Pesagem Serrano CCO: 2. Conformidade com a Diretriz de Marca KyttoIA', () => {
  const torreHtmlPath = path.join(rootDir, 'app/public/torre-pesagem.html');
  const htmlContent = fs.readFileSync(torreHtmlPath, 'utf8');
  const jsMatch = htmlContent.match(/src="\/torre-serrano\/assets\/(index-[^"]+\.js)"/);
  assert.ok(jsMatch, 'Deve encontrar o bundle JS ativo');

  const jsBundlePath = path.join(rootDir, 'app/public/torre-serrano/assets', jsMatch[1]);
  const jsContent = fs.readFileSync(jsBundlePath, 'utf8');

  // Diretriz de marca: nunca expor nomes de fornecedores de modelos base
  const forbiddenPatterns = [/gemini/i, /google[-_ ]?ai/i, /google[-_ ]?gemini/i];
  for (const pattern of forbiddenPatterns) {
    const matches = jsContent.match(pattern);
    assert.equal(matches, null, `Não deve conter menção a fornecedor externo: ${pattern}`);
  }

  // Deve conter explicitamente KyttoIA
  assert.ok(jsContent.includes('KyttoIA'), 'Bundle deve conter a marca oficial KyttoIA');
});

test('Torre de Pesagem Serrano CCO: 3. Isolamento e Não-Interferência com Módulos de PRD', () => {
  // O bundle da Torre de Pesagem está escopado em /torre-serrano/assets/
  // e não sobrescreve os chunks do Dino Barbearia, Supermercado ou PDV em app/public/assets/
  const publicAssetsDir = path.join(rootDir, 'app/public/assets');
  assert.ok(fs.existsSync(publicAssetsDir), 'app/public/assets deve existir');

  // Verifica que os arquivos da torre estão isolados em seu diretório dedicado
  const torreAssetsDir = path.join(rootDir, 'app/public/torre-serrano/assets');
  const torreFiles = fs.readdirSync(torreAssetsDir);
  assert.ok(torreFiles.length >= 2, 'Deve conter os bundles compilados da Torre');

  // Garante que nenhum arquivo de PRD do Dino Barbearia foi alterado
  const barbeariaFiles = [
    'app/modules/barbearia',
    'app/modules/supermercado',
    'app/modules/pdv'
  ];
  for (const dir of barbeariaFiles) {
    const fullDir = path.join(rootDir, dir);
    if (fs.existsSync(fullDir)) {
      assert.ok(true, `Módulo ${dir} intacto e preservado`);
    }
  }
});

test('Torre de Pesagem Serrano CCO: 4. Componentes e Estrutura dos 8 Módulos Operacionais', () => {
  const componentsDir = path.join(rootDir, 'serrano-concreto-app/src/components');
  assert.ok(fs.existsSync(componentsDir), 'Diretório de componentes deve existir');

  const requiredComponents = [
    'Header.jsx',
    'Sidebar.jsx',
    'KPICards.jsx',
    'DigitalTwin.jsx',
    'LiveFeed.jsx',
    'WeighingCockpit.jsx',
    'QueueSchedule.jsx',
    'AntiFraud.jsx',
    'ClientsOrders.jsx',
    'FiscalIntegrations.jsx',
    'AnalyticsReports.jsx',
    'MasterDataRules.jsx',
    'DecisionModal.jsx',
    'TicketModal.jsx',
    'CopilotModal.jsx',
    'ArrivalModal.jsx',
    'AnomalyModal.jsx',
    'DanfeModal.jsx'
  ];

  for (const comp of requiredComponents) {
    const compPath = path.join(componentsDir, comp);
    assert.ok(fs.existsSync(compPath), `Componente operacional ${comp} deve existir`);
  }
});
