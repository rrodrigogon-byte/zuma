const puppeteer = require('puppeteer');

async function main() {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.session?.token;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });

  await page.evaluateOnNewDocument((tk) => {
    localStorage.setItem('sp_token', tk);
    localStorage.setItem('sp_site_token', tk);
    localStorage.setItem('sp_user', JSON.stringify({
      username: 'dino', user: 'dino', nome: 'Dino Barbearia', role: 'admin', roles: ['admin'], empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
    }));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', nome: 'Dino Barbearia'
    }));
  }, token);

  await page.goto('https://kytto.com.br/admin/licenciamento', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));

  // Clica na aba 'Guia de Instalação On-Premise'
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Guia de Instalação On-Premise')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/13-licenciamento-guia-onpremise-stack.png' });
  console.log('✅ Print 13 salvo com sucesso!');

  await browser.close();
}

main().catch(console.error);
