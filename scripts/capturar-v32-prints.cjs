const puppeteer = require('puppeteer');
const path = require('path');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function obterTokenComRetry() {
  for (let i = 0; i < 5; i++) {
    try {
      const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'dino', senha: '123456' })
      });
      const data = await loginRes.json();
      if (data && data.token) return data.token;
    } catch (e) {
      console.log('Tentativa de login falhou, aguardando 2s...');
      await delay(2000);
    }
  }
  throw new Error('Falha ao obter token');
}

(async () => {
  console.log('--- RECAPTURANDO PRINT 45 (REFORMA TRIBUTÁRIA IBS/CBS & SPLIT PAYMENT) ---');

  const token = await obterTokenComRetry();
  console.log('Token obtido com sucesso!');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050 });

  await page.evaluateOnNewDocument((tk) => {
    localStorage.setItem('token', tk);
    localStorage.setItem('sp_token', tk);
    localStorage.setItem('sp_site_token', tk);
    localStorage.setItem('sp_cookie_consent', 'all');
    localStorage.setItem('sp_user', JSON.stringify({
      username: 'dino',
      user: 'dino',
      nome: 'Guilherme Cunha (Dino)',
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

  // Navegar para https://kytto.com.br/admin/fiscal
  console.log('Navegando para /admin/fiscal...');
  await page.goto('https://kytto.com.br/admin/fiscal', { waitUntil: 'networkidle2' });
  await delay(2500);

  // Clicar na aba Reforma Tributária (IBS/CBS)
  console.log('Selecionando aba Reforma Tributária...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btnRef = buttons.find(b => b.innerText.includes('Reforma Tributária'));
    if (btnRef) btnRef.click();
  });
  await delay(2500);

  // Fechar banner de cookies se existir
  await page.evaluate(() => {
    const banner = document.querySelector('div[role="dialog"], .cookie-banner');
    if (banner) banner.remove();
    const btns = Array.from(document.querySelectorAll('button'));
    const aceitar = btns.find(b => b.innerText.includes('Aceitar todos'));
    if (aceitar) aceitar.click();
  });
  await delay(1000);

  await page.screenshot({
    path: path.resolve(__dirname, '../docs/prints/45-fiscal-reforma-tributaria-ibs-cbs-split.png'),
    fullPage: false
  });
  console.log('✅ Print 45 recapturado com sucesso!');

  await browser.close();
})();
