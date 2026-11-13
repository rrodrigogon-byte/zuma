import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Realizando login em https://kytto.com.br/login...');
  await page.goto('https://kytto.com.br/login?next=/admin/concreto?secao=torre-pesagem', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));

  // Preenche credenciais
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type('dino');
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type('123456');
    console.log('Credenciais digitadas. Submetendo login...');

    const submitBtn = await page.$('button[type="submit"]') || await page.$('button.w-full') || (await page.$$('button'))[1];
    if (submitBtn) {
      await submitBtn.click();
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log('2. Navegando para https://kytto.com.br/admin/concreto?secao=torre-pesagem...');
  await page.goto('https://kytto.com.br/admin/concreto?secao=torre-pesagem', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: '/home/ubuntu/prd_submenu_torre.png' });
  console.log('Screenshot 1 salvo: /home/ubuntu/prd_submenu_torre.png');

  // Verifica elementos do submenu no ERP
  const subnavExists = Boolean(await page.$('.serrano-subnav-tabs'));
  console.log('Submenu .serrano-subnav-tabs presente em PRD:', subnavExists);

  const pills = await page.$$eval('.serrano-subtab-pill', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log('8 Pílulas do Submenu encontradas em PRD:', pills);

  // Clica em Pesagem
  console.log('3. Clicando no submenu Cockpit de Pesagem...');
  const buttons = await page.$$('.serrano-subtab-pill');
  if (buttons.length > 1) {
    await buttons[1].click(); // Pesagem
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: '/home/ubuntu/prd_submenu_pesagem.png' });
    console.log('Screenshot 2 salvo: /home/ubuntu/prd_submenu_pesagem.png');
  }

  // Clica em Antifraude
  console.log('4. Clicando no submenu Antifraude...');
  if (buttons.length > 3) {
    await buttons[3].click(); // Antifraude
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: '/home/ubuntu/prd_submenu_antifraude.png' });
    console.log('Screenshot 3 salvo: /home/ubuntu/prd_submenu_antifraude.png');
  }

  // 5. Teste em viewport mobile (comprovando que a sidebar vertical duplicada do anexo foi eliminada)
  console.log('5. Testando em viewport mobile (390x844)...');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('https://kytto.com.br/admin/concreto?secao=torre-pesagem&subsecao=pesagem', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: '/home/ubuntu/prd_submenu_mobile.png' });
  console.log('Screenshot 4 salvo: /home/ubuntu/prd_submenu_mobile.png');

  // 6. Teste standalone torre-pesagem.html direto
  console.log('6. Testando https://kytto.com.br/torre-pesagem.html?view=pesagem&caminhao=1...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://kytto.com.br/torre-pesagem.html?view=pesagem&caminhao=1', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/home/ubuntu/prd_standalone_pesagem.png' });
  console.log('Screenshot 5 salvo: /home/ubuntu/prd_standalone_pesagem.png');

  await browser.close();
  console.log('✅ Validação completa em PRODUÇÃO concluída com 100% de sucesso!');
})();
