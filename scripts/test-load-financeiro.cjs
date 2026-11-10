const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
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
      username: 'dino', user: 'dino', nome: 'Dino Barbearia', role: 'admin', roles: ['admin'], empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', nome: 'Dino Barbearia'
    }));
  }, token);

  await page.goto('https://kytto.com.br/admin/financeiro', { waitUntil: 'load', timeout: 60000 });
  console.log('Esperando sumir Carregando...');

  await page.waitForFunction(() => {
    const text = document.body.innerText || '';
    return text.length > 300 && !text.includes('Carregando...');
  }, { timeout: 25000 });

  console.log('Componente carregado com sucesso!');
  const botoes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean);
  });
  console.log('Botões na tela (primeiros 20):', botoes.slice(0, 20));

  await browser.close();
})();
