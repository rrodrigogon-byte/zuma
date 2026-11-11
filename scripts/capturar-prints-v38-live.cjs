const puppeteer = require('puppeteer');
const path = require('path');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  console.log('--- CAPTURANDO PRINTS 52 A 55 EM PRODUÇÃO LIVE (v38) ---');
  await delay(20000);

  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) throw new Error('Falha login: ' + JSON.stringify(loginData));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  await page.evaluateOnNewDocument((tk) => {
    localStorage.setItem('token', tk);
    localStorage.setItem('kytto_token', tk);
    localStorage.setItem('authToken', tk);
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

  // Print 52: Documentos Fiscais (NF-e 55 e NFC-e 65 autorizadas + Contingência 0)
  await page.goto('https://kytto.com.br/admin/fiscal', { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(3000);
  const p52 = path.resolve(__dirname, '../docs/prints/52-fiscal-nfe55-contingencia-transmitida-sefaz.png');
  await page.screenshot({ path: p52, fullPage: false });
  console.log('Salvo:', p52);

  // Print 53: Aba CT-e (57) & MDF-e (58)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.innerText && el.innerText.includes('CT-e (57)'));
    if (b) b.click();
  });
  await delay(2500);
  const p53 = path.resolve(__dirname, '../docs/prints/53-fiscal-cte57-mdfe58-transporte-sefaz.png');
  await page.screenshot({ path: p53, fullPage: false });
  console.log('Salvo:', p53);

  // Print 54: Agro ERP (Balança Rodoviária, Romaneio, Silos, NFP-e)
  await page.goto('https://kytto.com.br/admin/agro-erp', { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(3000);
  const p54 = path.resolve(__dirname, '../docs/prints/54-agro-erp-balanca-silos-nfpe-crea.png');
  await page.screenshot({ path: p54, fullPage: false });
  console.log('Salvo:', p54);

  // Print 55: Central de Implantação Guiada & Go-Live (100%)
  await page.goto('https://kytto.com.br/admin/implantacao', { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(3000);
  const p55 = path.resolve(__dirname, '../docs/prints/55-implantacao-golive-100-homologado.png');
  await page.screenshot({ path: p55, fullPage: false });
  console.log('Salvo:', p55);

  await browser.close();
})();
