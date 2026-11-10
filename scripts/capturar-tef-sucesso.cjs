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

    console.log('Navegando para https://kytto.com.br/admin/financeiro...');
    await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'load', timeout: 60000 });

    // 1. Espera o botão Conciliação aparecer e clica nele
    console.log('Esperando botão Conciliação aparecer no DOM...');
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent && b.textContent.includes('Conciliação'));
    }, { timeout: 35000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Conciliação'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        target.click();
      }
    });
    console.log('Clicou na aba Conciliação!');

    // 2. Espera a sub-aba Parametrização TEF aparecer e clica nela
    console.log('Esperando sub-aba Parametrização TEF...');
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent && b.textContent.includes('Parametrização TEF'));
    }, { timeout: 20000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Parametrização TEF'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        target.click();
      }
    });
    console.log('Clicou na sub-aba Parametrização TEF & Terminais!');

    // 3. Espera a tabela de terminais carregar
    console.log('Esperando tabela de terminais carregar...');
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Terminais Pinpad') || document.body.innerText.includes('Stone') || document.body.innerText.includes('Dino Barbearia');
    }, { timeout: 20000 });

    // 4. Clica em Testar Ping
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btnPing = btns.find(b => b.textContent && b.textContent.includes('Testar Ping'));
      if (btnPing) {
        btnPing.click();
      }
    });
    console.log('Clicou no botão Testar Ping do Pinpad Balcão!');
    await new Promise(r => setTimeout(r, 1800));

    // Rola a tela para mostrar a seção de Parametrização TEF completa
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('strong, h3'));
      const target = headers.find(h => h.textContent && h.textContent.includes('Parametrização TEF'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else {
        window.scrollBy(0, 750);
      }
    });
    await new Promise(r => setTimeout(r, 800));

    // Salvar Print 21: Estabelecimento, Adquirentes e Terminais Provisionados com Ping
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/21-tef-parametrizacao-dino-terminais.png',
      fullPage: false
    });
    console.log('✅ Print salvo com sucesso: docs/prints/21-tef-parametrizacao-dino-terminais.png');

    // Salvar Print 22: Matriz de Taxas MDR Negociadas com Scroll
    await page.evaluate(() => window.scrollBy(0, 520));
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/22-tef-matriz-taxas-mdr-negociadas.png',
      fullPage: false
    });
    console.log('✅ Print salvo com sucesso: docs/prints/22-tef-matriz-taxas-mdr-negociadas.png');

    // Salvar Print 23: Modal de Provisionamento de Novo Pinpad
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btnNovo = allBtns.find(b => b.textContent && b.textContent.includes('Provisionar Novo Pinpad'));
      if (btnNovo) {
        btnNovo.scrollIntoView({ behavior: 'instant', block: 'center' });
        btnNovo.click();
      }
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/23-tef-modal-provisionar-pinpad.png',
      fullPage: false
    });
    console.log('✅ Print salvo com sucesso: docs/prints/23-tef-modal-provisionar-pinpad.png');

  } catch (err) {
    console.error('❌ Erro durante captura:', err);
  } finally {
    await browser.close();
  }
})();
