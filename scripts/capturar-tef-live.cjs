const puppeteer = require('puppeteer');

(async () => {
  console.log('[Puppeteer TEF Live] Conectando a https://kytto.com.br/admin/financeiro...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });

    const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      },
      body: JSON.stringify({ user: 'dino', senha: '123456' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login OK! Token obtido com sucesso.');

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
    console.log('Página carregada, aguardando hidratação do React...');
    await new Promise(r => setTimeout(r, 4000));

    // 1. Clicar na aba "🏦 Conciliação Bancária & TEF" (ou "Conciliação")
    console.log('Buscando e clicando na aba Conciliação Bancária...');
    const clicouAba = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && (b.textContent.includes('Conciliação') || b.textContent.includes('TEF')));
      if (target) {
        target.click();
        return target.textContent.trim();
      }
      return false;
    });
    console.log('Resultado do clique na aba:', clicouAba);
    await new Promise(r => setTimeout(r, 2500));

    // 2. Clicar na sub-aba "⚙️ Parametrização TEF & Terminais"
    console.log('Buscando e clicando na sub-aba Parametrização TEF & Terminais...');
    const clicouSubAba = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Parametrização TEF'));
      if (target) {
        target.click();
        return target.textContent.trim();
      }
      return false;
    });
    console.log('Resultado do clique na sub-aba:', clicouSubAba);
    await new Promise(r => setTimeout(r, 2000));

    // 3. Clicar no botão Testar Ping do terminal do balcão
    console.log('Testando Ping do terminal...');
    const clicouPing = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('Testar Ping'));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    console.log('Clicou no botão Testar Ping?', clicouPing);
    await new Promise(r => setTimeout(r, 1800));

    // Salvar Print 21: Estabelecimento, Adquirentes e Terminais Provisionados com Ping
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/21-tef-parametrizacao-dino-terminais.png' });
    console.log('✅ Print salvo: 21-tef-parametrizacao-dino-terminais.png');

    // Salvar Print 22: Matriz de Taxas MDR Negociadas com Scroll
    await page.evaluate(() => window.scrollBy(0, 480));
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/22-tef-matriz-taxas-mdr-negociadas.png' });
    console.log('✅ Print salvo: 22-tef-matriz-taxas-mdr-negociadas.png');

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
    await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/23-tef-modal-provisionar-pinpad.png' });
    console.log('✅ Print salvo: 23-tef-modal-provisionar-pinpad.png');

  } catch (err) {
    console.error('❌ Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
