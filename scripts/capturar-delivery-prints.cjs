const puppeteer = require('puppeteer');

(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login Dino:', !!token ? 'Sucesso' : 'Falha');

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

    console.log('Navegando para https://kytto.com.br/admin/delivery...');
    await page.goto('https://kytto.com.br/admin/delivery', { waitUntil: 'load', timeout: 60000 });

    console.log('Esperando conteúdo carregar...');
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Central de Delivery') || document.body.innerText.includes('PED-101');
    }, { timeout: 25000 });

    await new Promise(r => setTimeout(r, 1500));

    // Print 28: Pedidos em Aberto
    await page.screenshot({ path: 'docs/prints/28-delivery-pedidos-multicanal-despacho.png' });
    console.log('Print 28 gerado com sucesso!');

    // Print 29: Motoboys
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('Motoboys'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'docs/prints/29-delivery-motoboys-repasses.png' });
    console.log('Print 29 gerado com sucesso!');

    // Print 30: CMV
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('CMV'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'docs/prints/30-delivery-cmv-teorico-vs-real.png' });
    console.log('Print 30 gerado com sucesso!');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
