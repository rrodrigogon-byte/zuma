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
      await delay(2000);
    }
  }
  throw new Error('Falha ao obter token');
}

(async () => {
  console.log('--- CAPTURANDO PRINT 48: OFICINA MECÂNICA, AUTOPEÇAS & OS ---');
  const token = await obterTokenComRetry();

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

  console.log('Navegando para /admin/oficina...');
  await page.goto('https://kytto.com.br/admin/oficina', { waitUntil: 'networkidle2' });
  await delay(2500);

  // Fechar cookie banner
  await page.evaluate(() => {
    const banner = document.querySelector('div[role="dialog"], .cookie-banner');
    if (banner) banner.remove();
  });
  await delay(1000);

  await page.screenshot({
    path: path.resolve(__dirname, '../docs/prints/48-oficina-mecanica-autopecas-os-veiculos.png'),
    fullPage: false
  });
  console.log('✅ Print 48 salvo com sucesso!');

  await browser.close();
})();
