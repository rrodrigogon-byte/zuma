import puppeteer from 'puppeteer';
import path from 'path';

const OUTPUT_DIR = '/home/ubuntu/agro-open/docs/prints-barbeiro';
const BASE_URL = 'https://setpoint-tm5n.onrender.com';

async function capturar() {
  console.log('Iniciando captura do modal editavel...');
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

  await page.goto(`${BASE_URL}/barbeiro/dino`, { waitUntil: 'networkidle2' });

  // Fecha banner de cookies
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnAceitar = btns.find(b => b.textContent.includes('Aceitar todos') || b.textContent.includes('Aceitar'));
      if (btnAceitar) btnAceitar.click();
    });
    await new Promise(r => setTimeout(r, 500));
  } catch (_) {}

  // Login como Bruno
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent.includes('Bruno'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.requestSubmit();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Bruno') || document.body.innerText.includes('Agenda'), { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));

  // Tenta abrir o modal pela Agenda (se houver agendamento) ou pela aba Clientes
  console.log('Indo para aba Clientes...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button'));
    const b = btns.find(btn => btn.textContent.includes('Clientes'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const abriu = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btnLembrar = btns.find(b => b.textContent.includes('Lembrar no Zap'));
    if (btnLembrar) {
      btnLembrar.click();
      return true;
    }
    return false;
  });

  if (abriu) {
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = 'Fala meu irmão Arthur! Aqui é o Bruno da Dino 💈 Passando pra te avisar que tô com um horário especial hoje às 16h30. Bora dar aquele talento no visual? Cervejinha já tá no grau!';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    console.log('Capturando print com a mensagem personalizada editada...');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '09_mensagem_personalizada_editavel.png') });
    console.log('Print salvo com sucesso: 09_mensagem_personalizada_editavel.png');
  } else {
    console.log('Tentando abrir pela Agenda...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(btn => btn.textContent.includes('Agenda'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    const abriuAgenda = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnZap = btns.find(b => b.textContent.includes('Avisar no Zap'));
      if (btnZap) {
        btnZap.click();
        return true;
      }
      return false;
    });
    if (abriuAgenda) {
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(OUTPUT_DIR, '09_mensagem_personalizada_editavel.png') });
      console.log('Print salvo da Agenda com sucesso: 09_mensagem_personalizada_editavel.png');
    }
  }

  await browser.close();
}

capturar().catch(console.error);
