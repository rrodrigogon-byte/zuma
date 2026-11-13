const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  await page.goto('file:///home/ubuntu/agro-open/web/public/torre-pesagem.html');
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = document.querySelector('button[data-view="pesagem"]');
    if (btn) btn.click();
    else if (window.S) {
      window.S.view = 'pesagem';
      window.render();
    }
  });

  // Aguardar caminhão entrar na balança
  await new Promise(r => setTimeout(r, 2500));

  // Testar clique no caminhão
  console.log('Clicando no caminhão betoneira...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-pista-action="caminhao"]');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/home/ubuntu/validacao_drawer_caminhao.png', fullPage: false });
  console.log('Screenshot do caminhão gravado!');

  // Fechar gaveta
  await page.evaluate(() => {
    const btn = document.querySelector('#drawer [data-act="close"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Testar clique no Totem LPR
  console.log('Clicando no Totem LPR...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-pista-action="totem-lpr"]');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/home/ubuntu/validacao_drawer_totem_lpr.png', fullPage: false });
  console.log('Screenshot do Totem LPR gravado!');

  // Fechar gaveta
  await page.evaluate(() => {
    const btn = document.querySelector('#drawer [data-act="close"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Testar clique no Totem Motorista
  console.log('Clicando no Totem Motorista...');
  await page.evaluate(() => {
    const el = document.querySelector('[data-pista-action="totem-motorista"]');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/home/ubuntu/validacao_drawer_totem_motorista.png', fullPage: false });
  console.log('Screenshot do Totem Motorista gravado!');

  await browser.close();
  console.log('Todos os testes de gaveta concluídos com sucesso!');
})().catch(err => console.error(err));
