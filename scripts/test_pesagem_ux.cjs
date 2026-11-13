const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('file:///home/ubuntu/agro-open/web/public/torre-pesagem.html');
  await new Promise(r => setTimeout(r, 1200));

  // Click on 'Pesagem' in the rail menu
  console.log('Navigating to Pesagem view...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-view="pesagem"]');
    if (btn) btn.click();
    else if (window.S) {
      window.S.view = 'pesagem';
      window.render();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: '/home/ubuntu/validacao_torre_pesagem_ux.png', fullPage: false });
  console.log('Screenshot gravado em /home/ubuntu/validacao_torre_pesagem_ux.png');

  // Test interactive click on a cell
  console.log('Testing click on C2...');
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-celula="2"]');
    if (el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  });
  console.log('Cell C2 clicked:', clicked);

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '/home/ubuntu/validacao_drawer_celula.png', fullPage: false });
  console.log('Screenshot do drawer gravado em /home/ubuntu/validacao_drawer_celula.png');

  // Test toggle cancela
  console.log('Testing toggle cancela in...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-pista-action="cancela-in"]');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/home/ubuntu/validacao_cancela_aberta.png', fullPage: false });
  console.log('Screenshot com cancela aberta gravado!');

  await browser.close();
})().catch(err => console.error(err));
