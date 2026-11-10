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
    await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));

    // Passo 1: Clica no botão da aba Conciliação Bancária OFX
    const abas = await page.$$('button');
    let clicouAba = false;
    for (const b of abas) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && (texto.includes('Conciliação Bancária OFX') || texto.includes('Conciliação Bancária'))) {
        console.log('Clicando na aba Conciliação Bancária:', texto.trim());
        await b.click();
        clicouAba = true;
        break;
      }
    }
    console.log('Passo 1 clicou?', clicouAba);
    await new Promise(r => setTimeout(r, 2500));

    // Passo 2: Clica na sub-aba Parametrização TEF & Terminais
    const subAbas = await page.$$('button');
    let clicouParam = false;
    for (const b of subAbas) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Parametrização TEF')) {
        console.log('Clicando na sub-aba Parametrização TEF:', texto.trim());
        await b.click();
        clicouParam = true;
        break;
      }
    }
    console.log('Passo 2 clicou?', clicouParam);
    await new Promise(r => setTimeout(r, 2000));

    // Passo 3: Clica em Testar Ping do terminal do balcão
    const pingBtns = await page.$$('button');
    for (const b of pingBtns) {
      const texto = await page.evaluate(el => el.textContent, b);
      if (texto && texto.includes('Testar Ping')) {
        console.log('Clicando em Testar Ping...');
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));

    // Rola para posicionar a área de parametrização no topo
    await page.evaluate(() => {
      const allHeaders = Array.from(document.querySelectorAll('strong, h3'));
      const target = allHeaders.find(h => h.textContent && h.textContent.includes('Parametrização TEF'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else {
        window.scrollBy(0, 650);
      }
    });
    await new Promise(r => setTimeout(r, 800));

    // Salvar Print 21: Estabelecimento, Adquirentes e Terminais Provisionados com Ping
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/21-tef-parametrizacao-dino-terminais.png',
      fullPage: false
    });
    console.log('Print salvo: docs/prints/21-tef-parametrizacao-dino-terminais.png');

    // Salvar Print 22: Matriz de Taxas MDR Negociadas com Scroll
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/22-tef-matriz-taxas-mdr-negociadas.png',
      fullPage: false
    });
    console.log('Print salvo: docs/prints/22-tef-matriz-taxas-mdr-negociadas.png');

    // Salvar Print 23: Modal de Provisionamento de Novo Pinpad
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btnNovo = allBtns.find(b => b.textContent && b.textContent.includes('Provisionar Novo Pinpad'));
      if (btnNovo) {
        btnNovo.click();
      }
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({
      path: '/home/ubuntu/agro-open/docs/prints/23-tef-modal-provisionar-pinpad.png',
      fullPage: false
    });
    console.log('Print salvo: docs/prints/23-tef-modal-provisionar-pinpad.png');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
