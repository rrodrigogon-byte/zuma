const puppeteer = require('puppeteer');

(async () => {
  console.log('[Puppeteer TEF Parametrização] Conectando a https://kytto.com.br/admin/financeiro...');
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

    await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'load', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // 1. Clicar na aba Conciliação Bancária OFX
    const abas = await page.$$('button');
    for (const b of abas) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && (texto.includes('Conciliação Bancária OFX') || texto.includes('Conciliação Bancária'))) {
        console.log('Clicou na aba principal Conciliação...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2500));

    // 2. Clicar na sub-aba Parametrização TEF & Terminais
    const subBotoes = await page.$$('button');
    for (const b of subBotoes) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Parametrização TEF')) {
        console.log('Clicou na sub-aba Parametrização TEF & Terminais...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));

    // 3. Clicar em "Testar Ping" do primeiro terminal
    const pingBotoes = await page.$$('button');
    for (const b of pingBotoes) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Testar Ping')) {
        console.log('Clicou em Testar Ping...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));

    // Salvar Print 21: Estabelecimento, Adquirentes e Terminais Provisionados com Ping
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/21-tef-parametrizacao-dino-terminais.png' });
    console.log('✅ Print salvo: 21-tef-parametrizacao-dino-terminais.png');

    // Salvar Print 22: Matriz de Taxas MDR Negociadas com Scroll
    await page.evaluate(() => window.scrollBy(0, 480));
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/22-tef-matriz-taxas-mdr-negociadas.png' });
    console.log('✅ Print salvo: 22-tef-matriz-taxas-mdr-negociadas.png');

    // Salvar Print 23: Modal de Provisionamento de Novo Pinpad
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 600));
    const modalBotoes = await page.$$('button');
    for (const b of modalBotoes) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Provisionar Novo Pinpad')) {
        console.log('Clicou em Provisionar Novo Pinpad...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/23-tef-modal-provisionar-pinpad.png' });
    console.log('✅ Print salvo: 23-tef-modal-provisionar-pinpad.png');

  } catch (err) {
    console.error('❌ Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
