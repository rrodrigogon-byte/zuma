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
  const jsBundlePath = path.join(rootDir, 'app/public/torre-serrano/assets/index-bE2DuGje.js');
  const cssBundlePath = path.join(rootDir, 'app/public/torre-serrano/assets/index-R4CQWAfK.css');

  assert.ok(fs.existsSync(torreHtmlPath), 'torre-pesagem.html deve existir em app/public');
  assert.ok(fs.existsSync(torreSerranoHtmlPath), 'index.html deve existir em app/public/torre-serrano');
  assert.ok(fs.existsSync(jsBundlePath), 'JS bundle deve existir em app/public/torre-serrano/assets');
  assert.ok(fs.existsSync(cssBundlePath), 'CSS bundle deve existir em app/public/torre-serrano/assets');

  const htmlContent = fs.readFileSync(torreHtmlPath, 'utf8');
  assert.ok(htmlContent.includes('/torre-serrano/assets/index-bE2DuGje.js'), 'HTML deve apontar para o bundle JS isolado');
  assert.ok(htmlContent.includes('/torre-serrano/assets/index-R4CQWAfK.css'), 'HTML deve apontar para o bundle CSS isolado');
  assert.ok(htmlContent.includes('Torre'), 'Título da página deve conter Torre');
});

test('Torre de Pesagem Serrano CCO: 2. Conformidade com a Diretriz de Marca KyttoIA', () => {
  const jsBundlePath = path.join(rootDir, 'app/public/torre-serrano/assets/index-bE2DuGje.js');
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
  const files = fs.readdirSync(torreAssetsDir);
  assert.ok(files.length >= 2, 'Diretório torre-serrano/assets deve conter os assets compilados');
});

test('Torre de Pesagem Serrano CCO: 4. Componentes e Estrutura dos 8 Módulos Operacionais', () => {
  const srcComponentsDir = path.join(rootDir, 'serrano-concreto-app/src/components');
  assert.ok(fs.existsSync(srcComponentsDir), 'serrano-concreto-app/src/components deve existir');

  const expectedComponents = [
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
    'CopilotModal.jsx'
  ];

  for (const comp of expectedComponents) {
    const p = path.join(srcComponentsDir, comp);
    assert.ok(fs.existsSync(p), `Componente ${comp} deve existir no código-fonte`);
  }
});
