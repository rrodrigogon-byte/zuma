import puppeteer from 'puppeteer';

async function capturar() {
  console.log('1. Obtendo token de despacho via API de PRD...');
  const resLogin = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'despacho', senha: '123456' })
  });
  const dataLogin = await resLogin.json();
  console.log('Login efetuado com sucesso:', dataLogin.user?.nome, 'Token:', dataLogin.token?.slice(0, 15) + '...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  console.log('2. Acessando https://kytto.com.br/ e injetando sessão no localStorage...');
  await page.goto('https://kytto.com.br/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((sessao) => {
    localStorage.setItem('sp_token', sessao.token);
    localStorage.setItem('sp_user', JSON.stringify(sessao.user));
    localStorage.setItem('token', sessao.token);
    localStorage.setItem('user', JSON.stringify(sessao.user));
    localStorage.setItem('kytto_token', sessao.token);
    localStorage.setItem('kytto_user', JSON.stringify(sessao.user));
    localStorage.setItem('sp_empresa_ativa', JSON.stringify({
      id: 'c2c2ac01-8e50-4b61-8c79-de4aaa916da2',
      nome: 'Serrano Concreto Usinado & Mineração',
      cnpj: '03.849.201/0001-10',
      brandKey: 'serranoconcreto'
    }));
  }, dataLogin);

  console.log('3. Navegando para https://kytto.com.br/pdv?tab=balanca...');
  await page.goto('https://kytto.com.br/pdv?tab=balanca', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4500));

  console.log('4. Tirando print da Pista 21m com Ilustração Interativa da Balança e Cancelas...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/26_pdv_balanca_pista_interativa_svg.png', fullPage: false });

  console.log('5. Clicando na aba Câmeras CFTV...');
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const txt = await page.evaluate(el => el.textContent, b);
    if (txt && txt.includes('Câmeras CFTV')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 3500));

  console.log('6. Tirando print da Matriz de 4 Câmeras CFTV ao Vivo...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/27_pdv_balanca_matriz_cftv_4cameras.png', fullPage: false });

  console.log('Concluído com sucesso!');
  await browser.close();
}

capturar().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
