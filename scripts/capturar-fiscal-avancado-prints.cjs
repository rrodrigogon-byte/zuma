const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando captura das novas telas fiscais em produção...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login na API para obter credenciais
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

  // 2. Acessar a tela Fiscal
  await page.goto('https://kytto.com.br/admin/fiscal', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  // Fechar banner de cookies se existir
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const aceitar = btns.find(b => b.textContent && b.textContent.includes('Aceitar todos'));
      if (aceitar) aceitar.click();
    });
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {}

  // 3. Clicar na aba Boletos & Pix Híbrido
  console.log('Navegando para aba Boletos...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
    const tabBoleto = btns.find(b => b.textContent && b.textContent.includes('Boletos'));
    if (tabBoleto) tabBoleto.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'docs/prints/24-fiscal-boletos-hibridos-pix.png', fullPage: false });
  console.log('✓ Print 24 capturado: Boletos & Pix Híbrido');

  // 4. Clicar na aba ICMS-ST (MT)
  console.log('Navegando para aba ICMS-ST (MT)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
    const tabSt = btns.find(b => b.textContent && b.textContent.includes('ICMS-ST'));
    if (tabSt) tabSt.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Clicar em Calcular para preencher o memorial
  await page.evaluate(() => {
    const btnCalc = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Calcular ICMS-ST'));
    if (btnCalc) btnCalc.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'docs/prints/25-fiscal-icms-st-mato-grosso.png', fullPage: false });
  console.log('✓ Print 25 capturado: ICMS-ST Mato Grosso');

  // 5. Clicar na aba Manifestação (MD-e)
  console.log('Navegando para aba Manifestação (MD-e)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
    const tabMde = btns.find(b => b.textContent && b.textContent.includes('Manifestação'));
    if (tabMde) tabMde.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'docs/prints/26-fiscal-mde-manifestacao-destinatario.png', fullPage: false });
  console.log('✓ Print 26 capturado: Manifestação do Destinatário (MD-e)');

  await browser.close();
  console.log('Todos os prints fiscais capturados com sucesso!');
})();
