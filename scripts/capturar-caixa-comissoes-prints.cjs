const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  await page.goto('https://kytto.com.br/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="text"], input[name="username"], input[name="user"]', 'dino');
  await page.type('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Fechar cookie banner
  try {
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Aceitar todos') || el.textContent.includes('Apenas essenciais'));
      if (b) b.click();
    });
  } catch (e) {}

  await page.goto('https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento', { waitUntil: 'networkidle2' });
  await delay(3000);

  // Mudar a data da operação para 2026-11-02
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="date"]'));
    if (inputs.length > 0) {
      const input = inputs[0];
      input.value = '2026-11-02';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await delay(3500);

  // Rolar até o elemento com o texto "Rateio de Comissões"
  await page.evaluate(() => {
    const h4s = Array.from(document.querySelectorAll('h4'));
    const alvo = h4s.find(h => h.textContent && h.textContent.includes('Rateio de Comissões'));
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.scrollBy(0, -50);
    } else {
      window.scrollBy(0, 1600);
    }
  });
  await delay(1500);

  await page.screenshot({
    path: path.join(__dirname, '../docs/prints/42-caixa-rateio-comissoes-bebidas-zero.png'),
    fullPage: false
  });
  console.log('Print 42 capturado no quadro de comissões!');

  // Rolar mais para as comandas fechadas no caixa (para mostrar a comanda cancelada do Geofrey)
  await page.evaluate(() => {
    const h3s = Array.from(document.querySelectorAll('h3'));
    const alvo = h3s.find(h => h.textContent && h.textContent.includes('Comandas Fechadas no Caixa'));
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.scrollBy(0, -30);
    } else {
      window.scrollBy(0, 800);
    }
  });
  await delay(1500);

  await page.screenshot({
    path: path.join(__dirname, '../docs/prints/41-caixa-fechamento-comandas-cancelamento.png'),
    fullPage: false
  });
  console.log('Print 41 capturado nas comandas fechadas!');

  await browser.close();
})();
