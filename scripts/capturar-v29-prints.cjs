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

    // Print 37: Auditoria DIMP vs Fiscal
    console.log('Navegando para https://kytto.com.br/admin/fiscal...');
    await page.goto('https://kytto.com.br/admin/fiscal', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Clicar na aba "Auditoria DIMP vs Fiscal"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dimp = btns.find(b => b.innerText.includes('Auditoria DIMP'));
      if (dimp) dimp.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/prints/37-fiscal-auditoria-dimp-malha-fina.png' });
    console.log('Print 37 gerado com sucesso!');

    // Print 38: Supply Chain Hub - Cotações RFQ
    console.log('Navegando para https://kytto.com.br/admin/supply-chain...');
    await page.goto('https://kytto.com.br/admin/supply-chain', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'docs/prints/38-supply-chain-cotacoes-rfq-comparativo.png' });
    console.log('Print 38 gerado com sucesso!');

    // Print 39: Supply Chain Hub - 3-Way Matching
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const m = btns.find(b => b.innerText.includes('3-Way Matching'));
      if (m) m.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'docs/prints/39-supply-chain-3way-matching-conferencia.png' });
    console.log('Print 39 gerado com sucesso!');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
