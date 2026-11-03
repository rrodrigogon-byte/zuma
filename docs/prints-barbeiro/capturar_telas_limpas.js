import puppeteer from 'puppeteer';
import path from 'path';

const OUTPUT_DIR = '/home/ubuntu/agro-open/docs/prints-barbeiro';
const BASE_URL = 'https://setpoint-tm5n.onrender.com';

async function capturar() {
  console.log('Iniciando Puppeteer para captura limpa sem cookies...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 412,
    height: 890,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  console.log('1. Acessando /barbeiro/dino...');
  await page.goto(`${BASE_URL}/barbeiro/dino`, { waitUntil: 'networkidle2' });

  // Fecha banner de cookies se existir
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnAceitar = btns.find(b => b.textContent.includes('Aceitar todos') || b.textContent.includes('Aceitar'));
      if (btnAceitar) btnAceitar.click();
    });
    await new Promise(r => setTimeout(r, 600));
  } catch (_) {}

  // Print 1: Tela de login limpa
  console.log('Capturando Print 1: Tela de login...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_login_app_barbeiro.png') });

  // Toca no Bruno
  console.log('Tocando no atalho do Bruno...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent.includes('Bruno'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Print 1B: Tela de login preenchida com senha 123456
  console.log('Capturando Print 1B: Tela de login preenchida...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01b_login_preenchido.png') });

  // Envia o formulário
  console.log('Submetendo formulário...');
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.requestSubmit();
  });

  // Aguarda aparecer Olá, Bruno
  console.log('Aguardando agenda...');
  await page.waitForFunction(() => document.body.innerText.includes('Olá, Bruno'), { timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  // Garante que cookies continuam fechados
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnAceitar = btns.find(b => b.textContent.includes('Aceitar todos'));
      if (btnAceitar) btnAceitar.click();
    });
    await new Promise(r => setTimeout(r, 500));
  } catch (_) {}

  // Print 2: Agenda do Barbeiro
  console.log('Capturando Print 2: Agenda do Barbeiro...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_agenda_do_barbeiro.png') });

  // Print 3: Ganhos
  console.log('Navegando para Ganhos...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, button'));
    const b = btns.find(btn => btn.textContent.includes('Ganhos'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturando Print 3: Ganhos...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_ganhos_comissoes.png') });

  // Print 4: Metas
  console.log('Navegando para Metas...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, button'));
    const b = btns.find(btn => btn.textContent.includes('Metas'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturando Print 4: Metas...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_metas_bonificacoes.png') });

  // Print 5: Clientes
  console.log('Navegando para Clientes...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, button'));
    const b = btns.find(btn => btn.textContent.includes('Clientes'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturando Print 5: Clientes...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_clientes_historico.png') });

  // Print 6: Meu Link
  console.log('Navegando para Meu Link...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, button'));
    const b = btns.find(btn => btn.textContent.includes('Meu Link'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturando Print 6: Meu Link...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_meu_link_agendamento.png') });

  console.log('✅ TODAS AS TELAS CAPTURADAS 100% LIMPAS!');
  await browser.close();
}

capturar().catch(e => {
  console.error('Erro na captura:', e);
  process.exit(1);
});
