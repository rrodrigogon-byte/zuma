const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5174/login', { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(() => {
    localStorage.setItem('sp_token', 'mock_token');
    localStorage.setItem('sp_empresa_ativa', 'emp-kytto-001');
    localStorage.setItem('sp_user', JSON.stringify({ id: 'u1', nome: 'Dino', role: 'admin' }));
  });
  
  await page.goto('http://localhost:5174/admin/barbearia-erp?area=gestao&tab=Metas+%26+Roleta', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/home/ubuntu/upload/kytto-roleta.png' });
  await browser.close();
  console.log('Screenshot saved to /home/ubuntu/upload/kytto-roleta.png');
})();
