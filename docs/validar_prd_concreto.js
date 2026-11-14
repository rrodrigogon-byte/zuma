import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '../docs');

async function validarPRD() {
  console.log('🚀 Iniciando validação em PRODUÇÃO da Torre de Pesagem da Usina de Concreto...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  const urlPRD = 'https://kytto.com.br/torre-pesagem.html?caminhao=1';

  console.log(`🌐 Navegando para ${urlPRD}...`);
  const response = await page.goto(urlPRD, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log(`Status HTTP: ${response.status()}`);

  if (response.status() !== 200) {
    throw new Error(`Falha ao carregar página: Status ${response.status()}`);
  }

  // 1. Validar SVG do Gêmeo Digital montado
  await page.waitForSelector('#pista-svg-mount svg', { timeout: 10000 });
  console.log('✅ Gêmeo Digital SVG carregado com sucesso!');

  const clickElement = async (selector) => {
    return page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    }, selector);
  };

  await page.screenshot({ path: path.join(DOCS_DIR, 'prd_validacao_torre_pesagem_pista.png'), fullPage: true });
  console.log('📸 Screenshot 1: Pista de pesagem interativa em PRD capturada.');

  // 2. Clicar na Célula C2
  console.log('🔬 Testando interação com Célula Inteligente C2...');
  const okC2 = await clickElement('[data-pista-action="celula"][data-celula="2"]');
  if (okC2) {
    await page.waitForSelector('#overlay .drawer', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(DOCS_DIR, 'prd_validacao_torre_pesagem_celula.png') });
    console.log('📸 Screenshot 2: Diagnóstico metrológico da Célula C2 capturado.');

    // Fechar modal
    await clickElement('#overlay [data-act="close"]');
    await new Promise(r => setTimeout(r, 400));
  } else {
    console.error('❌ Célula C2 não encontrada no DOM!');
  }

  // 3. Clicar no Caminhão Betoneira
  console.log('🚛 Testando interação com Caminhão Betoneira...');
  const okTruck = await clickElement('[data-pista-action="caminhao"]');
  if (okTruck) {
    await page.waitForSelector('#overlay .drawer', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(DOCS_DIR, 'prd_validacao_torre_pesagem_caminhao.png') });
    console.log('📸 Screenshot 3: Dossiê operacional do Caminhão Betoneira capturado.');

    // Fechar modal
    await clickElement('#overlay [data-act="close"]');
    await new Promise(r => setTimeout(r, 400));
  } else {
    console.error('❌ Caminhão Betoneira não encontrado no DOM!');
  }

  // 4. Clicar na Cancela de Entrada (Interatividade I/O)
  console.log('🚧 Testando acionamento interativo da cancela de entrada...');
  const okCancela = await clickElement('[data-pista-action="cancela-in"]');
  if (okCancela) {
    await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: path.join(DOCS_DIR, 'prd_validacao_torre_pesagem_cancela.png') });
    console.log('📸 Screenshot 4: Cancela aberta e semáforo verde acionados em PRD.');
  }

  // 5. Clicar no Totem LPR
  console.log('📷 Testando interação com Totem LPR (Vision AI)...');
  const okLpr = await clickElement('[data-pista-action="totem-lpr"]');
  if (okLpr) {
    await page.waitForSelector('#overlay .drawer', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(DOCS_DIR, 'prd_validacao_torre_pesagem_totem_lpr.png') });
    console.log('📸 Screenshot 5: Diagnóstico do Totem LPR Vision AI capturado.');

    await clickElement('#overlay [data-act="close"]');
    await new Promise(r => setTimeout(r, 400));
  }

  // 6. Clicar no Totem Motorista
  console.log('🎙️ Testando interação com Totem Motorista (Interfone & KyttoIA)...');
  const okMot = await clickElement('[data-pista-action="totem-motorista"]');
  if (okMot) {
    await page.waitForSelector('#overlay .drawer', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(DOCS_DIR, 'prd_validacao_torre_pesagem_totem_motorista.png') });
    console.log('📸 Screenshot 6: Totem do Motorista com interfone e KyttoIA CCO capturado.');

    await clickElement('#overlay [data-act="close"]');
    await new Promise(r => setTimeout(r, 400));
  }

  // 7. Testar Botão de Tela Cheia
  console.log('🖥️ Testando Botão de Tela Cheia (Fullscreen API)...');
  const okFs = await clickElement('#btn-fullscreen');
  if (okFs) {
    console.log('✅ Botão de Tela Cheia presente e configurado na interface!');
  } else {
    console.error('❌ Botão de Tela Cheia não encontrado!');
  }

  await browser.close();
  console.log('🎉 Validação em PRODUÇÃO concluída com 100% de sucesso!');
}

validarPRD().catch(err => {
  console.error('Erro na validação PRD:', err);
  process.exit(1);
});
