const puppeteer = require('puppeteer');

(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.session?.token;
  console.log('Login Dino:', !!token ? 'Sucesso' : 'Falha');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });

    await page.evaluateOnNewDocument((tk) => {
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

    console.log('Navegando para https://kytto.com.br/admin/financeiro...');
    await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'networkidle2', timeout: 35000 });

    // Aguarda carregar
    await new Promise(r => setTimeout(r, 2000));

    // Clica no botão da aba Conciliação Bancária OFX
    const abas = await page.$$('button');
    let clicou = false;
    for (const b of abas) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Conciliação Bancária OFX')) {
        console.log('Clicando na aba Conciliação Bancária OFX...');
        await b.click();
        clicou = true;
        break;
      }
    }

    await new Promise(r => setTimeout(r, 2500));

    // Captura o print da Conciliação Bancária
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/17-financeiro-conciliacao-bancaria-ofx.png',
      fullPage: false
    });
    console.log('Print salvo: docs/prints/17-financeiro-conciliacao-bancaria-ofx.png');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
