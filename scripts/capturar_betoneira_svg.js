import puppeteer from 'puppeteer';

async function capturar() {
  console.log('1. Obtendo token de despacho...');
  const resLogin = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'despacho', senha: '123456' })
  });
  const dataLogin = await resLogin.json();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  await page.goto('https://kytto.com.br/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((sessao) => {
    localStorage.setItem('sp_token', sessao.token);
    localStorage.setItem('sp_user', JSON.stringify(sessao.user));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2',
      nome: 'Serrano Concreto Usinado & Mineração',
      cnpj: '03.849.201/0001-10',
      brandKey: 'serranoconcreto'
    }));
  }, dataLogin);

  await page.goto('https://kytto.com.br/pdv?tab=balanca', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  // Clicar em "🚛 Betoneira 33.5t"
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const txt = await page.evaluate(el => el.textContent, b);
    if (txt && txt.includes('Betoneira 33.5t')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  console.log('Tirando print da Betoneira posicionada na Balança...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/28_pdv_balanca_betoneira_posicionada_svg.png', fullPage: false });

  await browser.close();
  console.log('Sucesso!');
}

capturar().catch(console.error);
