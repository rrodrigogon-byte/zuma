import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import http from 'http';

function checkServer(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode < 500);
    }).on('error', () => resolve(false));
  });
}

async function run() {
  console.log('Iniciando captura de prints de Consolidação de Holding & Eventos Internos...');
  
  let serverProcess = null;
  const isRunning = await checkServer('http://localhost:3001/health');
  if (!isRunning) {
    console.log('Iniciando servidor temporário na porta 3001...');
    serverProcess = spawn('node', ['app/server.js'], {
      env: { ...process.env, PORT: '3001', NODE_ENV: 'development' },
      stdio: 'ignore',
      detached: true
    });
    serverProcess.unref();

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await checkServer('http://localhost:3001/health')) {
        console.log('Servidor 3001 pronto!');
        break;
      }
    }
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Login Administrativo
  console.log('Fazendo login administrativo...');
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    localStorage.setItem('sp_token', 'mock-admin-token');
    localStorage.setItem('sp_user', JSON.stringify({
      id: 'usr-admin-001',
      nome: 'Administrador Master Kytto',
      email: 'admin@kytto.com.br',
      role: 'admin',
      permissoes: ['*']
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Barbearia Dino Canônica'
    }));
  });

  // 2. Acessa Consolidação de Holding
  console.log('Navegando para /admin/consolidacao-grupo...');
  await page.goto('http://localhost:3001/admin/consolidacao-grupo', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Print 1: Visão Geral e KPIs da Holding
  await page.screenshot({
    path: 'docs/prints-consolidacao/01_dashboard_consolidado_holding.png',
    fullPage: false
  });
  console.log('✅ Print 1: 01_dashboard_consolidado_holding.png');

  // Print 2: Scroll para Segmentos Multi-Business e Empresas
  await page.evaluate(() => window.scrollBy(0, 380));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({
    path: 'docs/prints-consolidacao/02_multibusiness_segmentos.png',
    fullPage: false
  });
  console.log('✅ Print 2: 02_multibusiness_segmentos.png');

  // Print 3: Aba DRE Consolidado da Holding
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const btns = Array.from(document.querySelectorAll('button'));
    const btnDre = btns.find(b => b.textContent && b.textContent.includes('DRE Consolidado'));
    if (btnDre) btnDre.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: 'docs/prints-consolidacao/03_dre_consolidado_holding.png',
    fullPage: false
  });
  console.log('✅ Print 3: 03_dre_consolidado_holding.png');

  // Print 4: Aba Barramento de Eventos Internos (Nossa Gente × Ultra)
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const btns = Array.from(document.querySelectorAll('button'));
    const btnEvt = btns.find(b => b.textContent && b.textContent.includes('Barramento de Eventos Internos'));
    if (btnEvt) btnEvt.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: 'docs/prints-consolidacao/04_barramento_eventos_internos_nossa_gente_ultra.png',
    fullPage: false
  });
  console.log('✅ Print 4: 04_barramento_eventos_internos_nossa_gente_ultra.png');

  // Print 5: Modal Copilot Holding IA
  console.log('Abrindo Modal Copilot Holding IA...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnCopilot = btns.find(b => b.textContent && b.textContent.includes('Copilot Holding'));
    if (btnCopilot) btnCopilot.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({
    path: 'docs/prints-consolidacao/05_copilot_holding_ia_diagnostico.png',
    fullPage: false
  });
  console.log('✅ Print 5: 05_copilot_holding_ia_diagnostico.png');

  await browser.close();
  console.log('Capturas de tela concluídas com sucesso!');
  process.exit(0);
}

run().catch(err => {
  console.error('Erro na geração de prints:', err);
  process.exit(1);
});
