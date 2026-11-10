const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1200 });

  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Connection': 'close' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // Obter primeiro boleto
  const rBoletos = await (await fetch('https://kytto.com.br/api/admin/boletos', {
    headers: { 'Authorization': 'Bearer ' + token, 'x-empresa-id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'Connection': 'close' }
  })).json();

  const boletoId = rBoletos.boletos?.[0]?.id;
  if (!boletoId) {
    console.error('Nenhum boleto encontrado!');
    await browser.close();
    return;
  }

  // Configurar header de autenticação na página
  await page.setExtraHTTPHeaders({
    'Authorization': 'Bearer ' + token,
    'x-empresa-id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
  });

  await page.goto(`https://kytto.com.br/api/admin/boletos/${boletoId}/html`, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'docs/prints/27-visualizador-boleto-sicredi-pix-hibrido.png', fullPage: true });
  console.log('✓ Print 27 capturado: Visualizador do Boleto FEBRABAN com Pix!');

  await browser.close();
})();
