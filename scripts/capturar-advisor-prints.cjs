const puppeteer = require('puppeteer');

async function main() {
  console.log('🚀 Iniciando Puppeteer para captura de telas do Kytto Advisor e Licenciamento...');
  
  // 1. Login Dino com o campo senha correto
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.session?.token;
  console.log('Autenticação Dino realizada com sucesso! Token válido:', !!token);

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

  // 2. Captura Tela 1: Kytto Advisor (/admin/ia-advisor)
  console.log('Navegando para /admin/ia-advisor...');
  await page.goto('https://kytto.com.br/admin/ia-advisor', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));

  // Clica no botão 'Aceitar todos' do cookie banner se existir
  const allBtns1 = await page.$$('button');
  for (const b of allBtns1) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Aceitar todos')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/11-ia-advisor-forecast-simulador.png' });
  console.log('✅ Print 11 salvo: docs/prints/11-ia-advisor-forecast-simulador.png');

  // 3. Captura Tela 2: Licenciamento & Instâncias (/admin/licenciamento)
  console.log('Navegando para /admin/licenciamento...');
  await page.goto('https://kytto.com.br/admin/licenciamento', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));

  // Clica no botão 'Aceitar todos' do cookie banner se existir
  const allBtns2 = await page.$$('button');
  for (const b of allBtns2) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Aceitar todos')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: '/home/ubuntu/agro-open/docs/prints/12-licenciamento-cotas-instancias.png' });
  console.log('✅ Print 12 salvo: docs/prints/12-licenciamento-cotas-instancias.png');

  await browser.close();
  console.log('🎉 Captura de telas concluída com sucesso!');
}

main().catch(console.error);
