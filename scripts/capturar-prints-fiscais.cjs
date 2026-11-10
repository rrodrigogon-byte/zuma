const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login como Dino
  console.log('Realizando login como Dino...');
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const authData = await loginRes.json();
  const token = authData.token;

  await page.setExtraHTTPHeaders({
    'Authorization': 'Bearer ' + token
  });

  await page.evaluateOnNewDocument((auth) => {
    localStorage.setItem('sp_token', auth.token);
    localStorage.setItem('sp_user', JSON.stringify(auth.user || { username: 'dino' }));
    localStorage.setItem('kytto_user', JSON.stringify(auth.user || { username: 'dino' }));
    localStorage.setItem('empresa_ativa_id', 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6');
  }, authData);

  const printsDir = path.resolve(__dirname, '../docs/prints');
  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });

  // 2. Acessar Painel Fiscal na aba Emitente e Certificado
  console.log('Acessando aba Emitente e certificado...');
  await page.goto('https://kytto.com.br/admin/fiscal', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  // Clicar no botão 'Emitente e certificado'
  try {
    const btnEmitente = await page.$('button ::-p-text(Emitente e certificado)');
    if (btnEmitente) {
      await btnEmitente.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('Erro ao clicar em Emitente:', e.message);
  }

  await page.screenshot({ path: path.join(printsDir, '14-fiscal-emitente-dino-oficial.png'), fullPage: false });
  console.log('Print 14 capturado: Painel Fiscal Aba Emitente Dino com IM 30297');

  // 3. Capturar DANFE NFC-e Autorizada (SEFAZ-MT)
  console.log('Carregando DANFE NFC-e autorizada...');
  await page.goto('https://kytto.com.br/api/admin/fiscal/documentos/06b1d2e2-12f2-4640-ae63-6594c58bda1d/danfe', {
    waitUntil: 'networkidle2'
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(printsDir, '15-danfe-nfce-autorizada-sefaz-mt.png'), fullPage: true });
  console.log('Print 15 capturado: DANFE NFC-e Autorizada SEFAZ-MT');

  // 4. Capturar DANFE NF-e 55 Autorizada (SEFAZ-MT)
  console.log('Carregando DANFE NF-e 55 autorizada...');
  await page.goto('https://kytto.com.br/api/admin/fiscal/documentos/0e3873e2-6aa3-4b71-950e-66207cdb892f/danfe', {
    waitUntil: 'networkidle2'
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(printsDir, '16-danfe-nfe55-autorizada-sefaz-mt.png'), fullPage: true });
  console.log('Print 16 capturado: DANFE NF-e 55 Autorizada SEFAZ-MT');

  await browser.close();
  console.log('Todas as evidências fiscais foram capturadas com sucesso!');
})();
