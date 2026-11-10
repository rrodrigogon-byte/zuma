const puppeteer = require('puppeteer');

(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login Dino:', token ? 'Sucesso' : 'Falha');

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
    }, token);

    // Print 31: KDS Monitor
    console.log('Navegando para https://kytto.com.br/admin/delivery...');
    await page.goto('https://kytto.com.br/admin/delivery', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Clicar na aba KDS
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const kds = btns.find(b => b.innerText.includes('Monitor KDS'));
      if (kds) kds.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'docs/prints/31-delivery-kds-monitor-producao.png' });
    console.log('Print 31 gerado com sucesso!');

    // Print 32: Zonas de Frete Tangará MT
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const zon = btns.find(b => b.innerText.includes('Zonas de Frete'));
      if (zon) zon.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'docs/prints/32-delivery-zonas-frete-tangara-mt.png' });
    console.log('Print 32 gerado com sucesso!');

    // Print 33: Comanda Térmica Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ped = btns.find(b => b.innerText.includes('Pedidos & Despacho'));
      if (ped) ped.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const com = btns.find(b => b.innerText.includes('Comanda 80mm'));
      if (com) com.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'docs/prints/33-delivery-comanda-termica-80mm.png' });
    console.log('Print 33 gerado com sucesso!');

    // Print 34: Central SPED Fiscal EFD, Pré-PVA & Salão Parceiro
    console.log('Navegando para https://kytto.com.br/admin/sped...');
    await page.goto('https://kytto.com.br/admin/sped', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/prints/34-sped-fiscal-efd-pre-pva-salao-parceiro.png' });
    console.log('Print 34 gerado com sucesso!');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
