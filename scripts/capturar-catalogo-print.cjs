const puppeteer = require('puppeteer');
const path = require('path');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });
    await page.evaluateOnNewDocument((tk) => {
      localStorage.setItem('token', tk);
      localStorage.setItem('sp_token', tk);
      localStorage.setItem('sp_site_token', tk);
      localStorage.setItem('sp_cookie_consent', 'all');
      localStorage.setItem('sp_user', JSON.stringify({
        username: 'dino',
        user: 'dino',
        nome: 'Dino Barbearia',
        role: 'admin',
        roles: ['admin'],
        empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
      }));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify({
        id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
        nome: 'Dino Barbearia'
      }));
    }, token);

    await page.goto('https://kytto.com.br/admin/barbearia-erp?area=catalogo&tab=Estoque+de+revenda', { waitUntil: 'networkidle2' });
    await delay(3000);

    await page.screenshot({
      path: path.join(__dirname, '../docs/prints/43-catalogo-produtos-bebidas-revenda.png'),
      fullPage: false
    });
    console.log('Print 43 capturado com sucesso!');
  } finally {
    await browser.close();
  }
})();
