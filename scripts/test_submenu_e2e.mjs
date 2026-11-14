import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Acessa a Torre de Controle no ERP
  console.log('1. Navegando para /admin/concreto?secao=torre-pesagem...');
  await page.goto('http://127.0.0.1:4173/admin/concreto?secao=torre-pesagem', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: '/home/ubuntu/validacao_submenu_torre.png' });
  console.log('Screenshot 1 salvo: /home/ubuntu/validacao_submenu_torre.png');

  // Verifica elementos do submenu
  const subnavExists = Boolean(await page.$('.serrano-subnav-tabs'));
  console.log('Submenu .serrano-subnav-tabs presente:', subnavExists);

  const pills = await page.$$eval('.serrano-subtab-pill', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log('Pílulas do Submenu encontradas:', pills);

  // 2. Clica em Pesagem
  console.log('2. Clicando no submenu Pesagem...');
  const buttons = await page.$$('.serrano-subtab-pill');
  if (buttons.length > 1) {
    await buttons[1].click(); // Pesagem
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: '/home/ubuntu/validacao_submenu_pesagem.png' });
    console.log('Screenshot 2 salvo: /home/ubuntu/validacao_submenu_pesagem.png');
  }

  // 3. Clica em Antifraude
  console.log('3. Clicando no submenu Antifraude...');
  if (buttons.length > 3) {
    await buttons[3].click(); // Antifraude
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: '/home/ubuntu/validacao_submenu_antifraude.png' });
    console.log('Screenshot 3 salvo: /home/ubuntu/validacao_submenu_antifraude.png');
  }

  // 4. Teste em viewport mobile (similar ao anexo enviado pelo usuário)
  console.log('4. Testando em viewport mobile (390x844)...');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/admin/concreto?secao=torre-pesagem&subsecao=pesagem', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/home/ubuntu/validacao_submenu_mobile.png' });
  console.log('Screenshot 4 salvo: /home/ubuntu/validacao_submenu_mobile.png');

  await browser.close();
  console.log('Testes e validações de tela concluídos com sucesso!');
})();
