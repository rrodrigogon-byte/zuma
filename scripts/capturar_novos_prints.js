import puppeteer from 'puppeteer';

async function capturarPrints() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Autenticando com despacho...');
  const resLogin = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'despacho', senha: '123456' })
  });
  const dataLogin = await resLogin.json();

  console.log('2. Injetando sessão no localStorage...');
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

  console.log('3. Abrindo /pdv?tab=balanca...');
  await page.goto('https://kytto.com.br/pdv?tab=balanca', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  console.log('4. Print Operação Ativa...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/23_pdv_balanca_operacao_minimalista.png', fullPage: true });

  console.log('5. Clicando na aba Configurações...');
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('Configurações')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/24_pdv_balanca_aba_configuracoes.png', fullPage: true });

  console.log('6. Clicando na aba Tickets...');
  const botoes2 = await page.$$('button');
  for (const b of botoes2) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('Tickets')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/25_pdv_balanca_aba_tickets_impressao.png', fullPage: true });

  console.log('Sucesso! Todas as capturas salvas.');
  await browser.close();
}

capturarPrints().catch(e => {
  console.error(e);
  process.exit(1);
});
