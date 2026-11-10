const puppeteer = require('puppeteer');

(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const { token } = await loginRes.json();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });

  await page.evaluateOnNewDocument((tk) => {
    localStorage.setItem('sp_token', tk);
    localStorage.setItem('sp_user', JSON.stringify({
      username: 'dino',
      nome: 'Dino Barbearia',
      role: 'admin',
      roles: ['admin'],
      empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
      nome: 'Barbearia Dino'
    }));
  }, token);

  await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));

  // Clica no botao 'Aceitar todos' do cookie
  const allBtns = await page.$$('button');
  for (const b of allBtns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Aceitar todos')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  // Clica na aba DRE Gerencial
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('DRE Gerencial')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2500));

  await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/07-financeiro-dre-gerencial-oficial.png' });
  console.log('Print 07 recarregado com perfeição!');

  await browser.close();
})();
