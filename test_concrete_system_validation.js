import fs from 'fs';
import path from 'path';

console.log('--- INICIANDO VALIDAÇÃO DE CONFORMIDADE E SEGURANÇA DA TORRE DE PESAGEM ---');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✔ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`✖ [FAIL] ${message}`);
    failed++;
  }
}

// 1. Validar existência dos arquivos de bundle gerados
const htmlPath = '/home/ubuntu/agro-open/app/public/torre-pesagem.html';
assert(fs.existsSync(htmlPath), 'torre-pesagem.html existe em app/public');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = htmlContent.match(/src="\/torre-serrano\/assets\/(index-[^"]+\.js)"/);
const cssMatch = htmlContent.match(/href="\/torre-serrano\/assets\/(index-[^"]+\.css)"/);

assert(scriptMatch !== null, 'Tag de script bundle JS encontrada no HTML');
assert(cssMatch !== null, 'Tag de folha de estilos CSS encontrada no HTML');

if (scriptMatch && cssMatch) {
  const jsFile = `/home/ubuntu/agro-open/app/public/torre-serrano/assets/${scriptMatch[1]}`;
  const cssFile = `/home/ubuntu/agro-open/app/public/torre-serrano/assets/${cssMatch[1]}`;

  assert(fs.existsSync(jsFile), `Arquivo JS compilado existe: ${scriptMatch[1]}`);
  assert(fs.existsSync(cssFile), `Arquivo CSS compilado existe: ${cssMatch[1]}`);

  const jsSize = fs.statSync(jsFile).size;
  const cssSize = fs.statSync(cssFile).size;
  assert(jsSize > 400000, `JS bundle tem tamanho esperado (>400KB): ${jsSize} bytes`);
  assert(cssSize > 30000, `CSS bundle tem tamanho esperado (>30KB): ${cssSize} bytes`);

  // 2. Diretriz de Marca KyttoIA (Risco Zero e Compliance)
  const jsContent = fs.readFileSync(jsFile, 'utf8');
  const hasGemini = /gemini/i.test(jsContent);
  assert(!hasGemini, 'DIRETRIZ DE MARCA: Nenhuma menção a "Gemini" encontrada no bundle de produção');
  
  const hasKyttoIA = /KyttoIA/.test(jsContent);
  assert(hasKyttoIA, 'DIRETRIZ DE MARCA: "KyttoIA" devidamente presente no bundle');
}

// 3. Validar conformidade de isolamento em relação aos arquivos de PRD (barbearia, etc)
const dinoFiles = [
  '/home/ubuntu/agro-open/barbearia_new.js',
  '/home/ubuntu/agro-open/test-barbearia-caixa-comanda-melhorias.test.js'
];
dinoFiles.forEach(f => {
  assert(fs.existsSync(f), `Arquivo de PRD Dino Barbearia intacto: ${path.basename(f)}`);
});

// 4. Validar componentes reescritos
const components = [
  'DigitalTwin.jsx',
  'AntiFraud.jsx',
  'AnalyticsReports.jsx',
  'CopilotModal.jsx',
  'WeighingCockpit.jsx',
  'DanfeModal.jsx',
  'KPICards.jsx',
  'DecisionModal.jsx',
  'TicketModal.jsx'
];

components.forEach(comp => {
  const p = `/home/ubuntu/agro-open/serrano-concreto-app/src/components/${comp}`;
  assert(fs.existsSync(p), `Componente presente: ${comp}`);
  const content = fs.readFileSync(p, 'utf8');
  assert(!/gemini/i.test(content), `Componente ${comp} sem vazamento de marca (Zero Gemini)`);
});

console.log(`\nRESUMO: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
