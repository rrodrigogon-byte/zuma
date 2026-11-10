const puppeteer = require('puppeteer');

(async () => {
  console.log('[Puppeteer TEF com Login UI] Conectando a https://kytto.com.br/login...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });

    // Abre a página de login
    await page.goto('https://kytto.com.br/login', { waitUntil: 'load', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // Aceita cookies se houver
    await page.evaluate(() => {
      localStorage.setItem('sp_cookie_consent', 'all');
    });

    // Preenche usuário e senha
    console.log('Preenchendo credenciais...');
    const userInput = await page.$('input[name="user"], input[name="username"], input[type="text"]');
    if (userInput) {
      await userInput.click({ clickCount: 3 });
      await userInput.type('dino');
    }

    const passInput = await page.$('input[name="senha"], input[name="password"], input[type="password"]');
    if (passInput) {
      await passInput.click({ clickCount: 3 });
      await passInput.type('123456');
    }

    // Clica no botão Entrar
    console.log('Clicando em Entrar...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Entrar') || b.textContent.includes('Login')));
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 3500));
    console.log('URL atual após login:', page.url());

    // Navega para o Financeiro
    await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'load', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));

    // 1. Clicar no botão da aba "🏦 Conciliação Bancária OFX"
    console.log('Clicando na aba Conciliação Bancária OFX...');
    const clicouConciliacao = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Conciliação Bancária OFX'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        target.click();
        return true;
      }
      return false;
    });
    console.log('Clicou na aba Conciliação?', clicouConciliacao);
    await new Promise(r => setTimeout(r, 2500));

    // 2. Clicar na sub-aba "⚙️ Parametrização TEF & Terminais"
    console.log('Clicando na sub-aba Parametrização TEF & Terminais...');
    const clicouParam = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Parametrização TEF'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        target.click();
        return true;
      }
      return false;
    });
    console.log('Clicou na sub-aba Parametrização?', clicouParam);
    await new Promise(r => setTimeout(r, 2500));

    // 3. Clicar no botão Testar Ping do primeiro terminal
    console.log('Clicando no botão Testar Ping...');
    const clicouPing = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Testar Ping'));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    console.log('Clicou no Testar Ping?', clicouPing);
    await new Promise(r => setTimeout(r, 1800));

    // 4. Rola até o cabeçalho da seção de parametrização
    await page.evaluate(() => {
      const allH = Array.from(document.querySelectorAll('strong, h3'));
      const target = allH.find(el => el.textContent && el.textContent.includes('Parametrização TEF'));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else {
        window.scrollBy(0, 700);
      }
    });
    await new Promise(r => setTimeout(r, 800));

    // Salvar Print 21: Estabelecimento, Adquirentes e Terminais Provisionados com Ping
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/21-tef-parametrizacao-dino-terminais.png' });
    console.log('✅ Print salvo: 21-tef-parametrizacao-dino-terminais.png');

    // Salvar Print 22: Matriz de Taxas MDR Negociadas com Scroll
    await page.evaluate(() => window.scrollBy(0, 520));
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/22-tef-matriz-taxas-mdr-negociadas.png' });
    console.log('✅ Print salvo: 22-tef-matriz-taxas-mdr-negociadas.png');

    // Salvar Print 23: Modal de Provisionamento de Novo Pinpad
    await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const btnNovo = allBtns.find(b => b.textContent && b.textContent.includes('Provisionar Novo Pinpad'));
      if (btnNovo) {
        btnNovo.scrollIntoView({ behavior: 'instant', block: 'center' });
        btnNovo.click();
      }
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/23-tef-modal-provisionar-pinpad.png' });
    console.log('✅ Print salvo: 23-tef-modal-provisionar-pinpad.png');

  } catch (err) {
    console.error('❌ Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
