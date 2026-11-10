const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Connection': 'close' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const user = loginData.user;
  const empresaDino = {
    id: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    nome: 'Barbearia Dino',
    nomeFantasia: 'Barbearia Dino',
    cnpj: '50.073.355/0002-60',
    ativa: true
  };

  await page.evaluateOnNewDocument((token, user, empresa) => {
    localStorage.setItem('sp_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('sp_user', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresa));
    localStorage.setItem('sp_empresas_acessiveis', JSON.stringify([empresa]));
  }, token, user, empresaDino);

  await page.goto('https://kytto.com.br/admin/fiscal', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  // Clicar na aba Boletos
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
    const tabBoleto = btns.find(b => b.textContent && b.textContent.includes('Boletos'));
    if (tabBoleto) tabBoleto.click();
  });

  // Aguardar os dados chegarem na tabela
  await page.waitForFunction(() => {
    const tds = Array.from(document.querySelectorAll('td'));
    return tds.some(td => td.textContent && td.textContent.includes('Sicredi'));
  }, { timeout: 10000 });

  await page.screenshot({ path: 'docs/prints/24-fiscal-boletos-hibridos-pix.png', fullPage: false });
  console.log('✓ Print 24 atualizado com os boletos emitidos!');
  await browser.close();
})();
