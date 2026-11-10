const puppeteer = require('puppeteer');

(async () => {
  console.log('[Puppeteer TEF] Conectando a https://kytto.com.br/admin/financeiro...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'dino', senha: '123456' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('sp_token', t);
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

    console.log('Navegando para /admin/financeiro...');
    await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise(r => setTimeout(r, 2000));

    // Clicar na aba Conciliação Bancária
    const botoes = await page.$$('button');
    for (const b of botoes) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Conciliação Bancária')) {
        console.log('Clicando na aba Conciliação Bancária...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));

    // 1. Clicar em "TEF & Maquininhas de Cartão"
    const subBotoes1 = await page.$$('button');
    for (const b of subBotoes1) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('TEF & Maquininhas de Cartão')) {
        console.log('Clicando na sub-aba TEF & Maquininhas...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/18-financeiro-conciliacao-tef-maquininhas.png' });
    console.log('✅ Print salvo: 18-financeiro-conciliacao-tef-maquininhas.png');

    // 2. Clicar em "Terminal Pinpad / Balcão"
    const subBotoes2 = await page.$$('button');
    for (const b of subBotoes2) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Terminal Pinpad / Balcão')) {
        console.log('Clicando na sub-aba Terminal Pinpad / Balcão...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/19-financeiro-tef-terminal-balcao.png' });
    console.log('✅ Print salvo: 19-financeiro-tef-terminal-balcao.png');

    // 3. Clicar em "Bancos & Adquirentes Homologados"
    const subBotoes3 = await page.$$('button');
    for (const b of subBotoes3) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Bancos & Adquirentes Homologados')) {
        console.log('Clicando na sub-aba Bancos & Adquirentes Homologados...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/20-financeiro-bancos-brasileiros-homologados.png' });
    console.log('✅ Print salvo: 20-financeiro-bancos-brasileiros-homologados.png');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
