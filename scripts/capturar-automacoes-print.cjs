const puppeteer = require('puppeteer');

(async () => {
  console.log('[Puppeteer] Iniciando navegador headless...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    console.log('[Puppeteer] Realizando login na API...');
    const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'dino', senha: '123456' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('[Puppeteer] Token recebido:', !!token);

    console.log('[Puppeteer] Navegando para inicializar domínio...');
    await page.goto('https://kytto.com.br/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('[Puppeteer] Injetando credenciais sp_ no localStorage...');
    await page.evaluate((tok) => {
      localStorage.setItem('sp_token', tok);
      localStorage.setItem('sp_site_token', tok);
      localStorage.setItem('token', tok);
      localStorage.setItem('sp_user', JSON.stringify({
        id: 'dino-adm',
        nome: 'Dino Barbearia',
        email: 'dino@barbeariadino.com.br',
        role: 'admin',
        empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
      }));
      localStorage.setItem('sp_empresa_ativa', JSON.stringify({
        id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
        nome: 'Dino Barbearia'
      }));
      localStorage.setItem('sp_loja_ativa', JSON.stringify({
        id: 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8',
        nome: 'Unidade Principal'
      }));
    }, token);

    console.log('[Puppeteer] Navegando para /admin/automacoes...');
    await page.goto('https://kytto.com.br/admin/automacoes', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Aguarda o React Suspense terminar
    console.log('[Puppeteer] Aguardando término do Suspense...');
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return text.includes('Automações') && !text.includes('Carregando...');
    }, { timeout: 35000 });

    await new Promise(r => setTimeout(r, 2000));

    // Fecha banner de cookies se existir
    try {
      await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll('button'));
        const btnCookies = botoes.find(b => b.textContent && b.textContent.includes('Aceitar'));
        if (btnCookies) btnCookies.click();
      });
      await new Promise(r => setTimeout(r, 500));
    } catch (_) {}

    const printPath = '/home/ubuntu/agro-open/docs/prints/08-automacoes-processos-corporativos.png';
    await page.screenshot({ path: printPath, fullPage: true });
    console.log(`[Puppeteer] ✅ Screenshot salvo em: ${printPath}`);

    // Agora clica na aba Vencimento de Planos
    try {
      await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll('button'));
        const btnPlanos = botoes.find(b => b.textContent && b.textContent.includes('Vencimento de Planos'));
        if (btnPlanos) btnPlanos.click();
      });
      await new Promise(r => setTimeout(r, 2500));
      const printPlanosPath = '/home/ubuntu/agro-open/docs/prints/09-automacoes-vencimento-planos-pix.png';
      await page.screenshot({ path: printPlanosPath, fullPage: true });
      console.log(`[Puppeteer] ✅ Screenshot salvo em: ${printPlanosPath}`);
    } catch (_) {}

    // Clica na aba Briefing Noturno
    try {
      await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll('button'));
        const btnBriefing = botoes.find(b => b.textContent && b.textContent.includes('Briefing Noturno'));
        if (btnBriefing) btnBriefing.click();
      });
      await new Promise(r => setTimeout(r, 2500));
      const printBriefingPath = '/home/ubuntu/agro-open/docs/prints/10-automacoes-briefing-noturno-gestao.png';
      await page.screenshot({ path: printBriefingPath, fullPage: true });
      console.log(`[Puppeteer] ✅ Screenshot salvo em: ${printBriefingPath}`);
    } catch (_) {}

  } catch (err) {
    console.error('[Puppeteer] Erro durante captura:', err);
  } finally {
    await browser.close();
  }
})();
