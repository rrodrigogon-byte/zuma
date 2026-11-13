import puppeteer from 'puppeteer';

async function testarBalanca() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Obtendo token de despacho via API...');
  const resLogin = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'despacho', senha: '123456' })
  });
  const dataLogin = await resLogin.json();
  console.log('Login efetuado com sucesso:', dataLogin.user?.nome, 'Token:', dataLogin.token?.slice(0, 15) + '...');

  console.log('2. Acessando https://kytto.com.br/ e injetando sessão no localStorage...');
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

  console.log('3. Navegando para https://kytto.com.br/pdv?tab=balanca...');
  await page.goto('https://kytto.com.br/pdv?tab=balanca', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));

  console.log('4. Tirando print do Cockpit da Balança Rodoviária 80t no PDV...');
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/20_pdv_balanca_cockpit_toledo80t.png', fullPage: true });

  console.log('5. Clicando no simulador Betoneira 33.5t...');
  const botoes = await page.$$('button');
  for (const b of botoes) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('Betoneira 33.5t')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/21_pdv_balanca_caminhao_posicionado.png', fullPage: true });

  console.log('6. Clicando na aba Histórico de Tickets...');
  const botoesAtualizados = await page.$$('button');
  for (const b of botoesAtualizados) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('Histórico de Tickets')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  console.log('7. Clicando em Visualizar Ticket no primeiro item da tabela...');
  const botoesHistorico = await page.$$('button');
  for (const b of botoesHistorico) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('Visualizar Ticket')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/home/ubuntu/manual-assets-concreto/22_pdv_balanca_modal_ticket_80mm.png' });

  console.log('Sucesso! Todos os 3 prints salvos em /home/ubuntu/manual-assets-concreto/.');
  await browser.close();
}

testarBalanca().catch(err => {
  console.error('Erro no puppeteer:', err);
  process.exit(1);
});
