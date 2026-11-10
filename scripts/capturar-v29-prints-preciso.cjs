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
      localStorage.setItem('sp_empresas_acessiveis', JSON.stringify([{
        id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
        nome: 'Dino Barbearia'
      }]));
    }, token);

    // Print 37: Auditoria DIMP vs Fiscal
    console.log('Navegando para https://kytto.com.br/admin/dimp...');
    await page.goto('https://kytto.com.br/admin/dimp', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
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

    // Print 40: Regularização Fiscal em Lote
    console.log('Navegando de volta para https://kytto.com.br/admin/dimp para simular regularização...');
    await page.goto('https://kytto.com.br/admin/dimp', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const reg = btns.find(b => b.innerText.includes('Regularizar em Lote'));
      if (reg) reg.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'docs/prints/40-fiscal-dimp-regularizacao-lote-sucesso.png' });
    console.log('Print 40 gerado com sucesso!');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
